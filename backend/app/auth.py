from __future__ import annotations

import hashlib
import hmac
import os
import time
from dataclasses import dataclass, field
from typing import Any, Iterable

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import db
from .config import settings

bearer = HTTPBearer(auto_error=False)

ROLE_RANK = {
    "reader": 1,
    "security_reviewer": 2,
    "developer": 3,
    "maintainer": 4,
    "admin": 5,
}


def hash_password(password: str, iterations: int = 120_000) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, iter_s, salt_hex, digest_hex = encoded.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iter_s)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def create_token(user_id: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + settings.token_ttl_minutes * 60,
        "iss": "whycoded",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=["HS256"], issuer="whycoded"
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials") from exc
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return str(user_id)


@dataclass
class Principal:
    user_id: str
    email: str
    name: str
    org_id: str
    org_name: str
    role: str
    memberships: list[dict[str, Any]] = field(default_factory=list)

    def at_least(self, role: str) -> bool:
        return ROLE_RANK.get(self.role, 0) >= ROLE_RANK.get(role, 99)


def _memberships(user_id: str) -> list[dict[str, Any]]:
    return db.read(
        """
        MATCH (u:User {user_id: $uid})-[m:MEMBER_OF {status: 'active'}]->(o:Organization)
        RETURN o.org_id AS org_id, o.name AS org_name, m.role AS role
        ORDER BY o.name
        """,
        {"uid": user_id},
    )


def get_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    x_org_id: str | None = Header(default=None),
) -> Principal:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    user_id = decode_token(credentials.credentials)
    user = db.read_one(
        "MATCH (u:User {user_id: $uid}) RETURN u.user_id AS user_id, u.email AS email, u.name AS name",
        {"uid": user_id},
    )
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown user")
    memberships = _memberships(user_id)
    if not memberships:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No organisation membership")
    selected = memberships[0]
    if x_org_id:
        match = next((m for m in memberships if m["org_id"] == x_org_id), None)
        if match is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this organisation")
        selected = match
    principal = Principal(
        user_id=user["user_id"],
        email=user["email"],
        name=user["name"],
        org_id=selected["org_id"],
        org_name=selected["org_name"],
        role=selected["role"],
        memberships=memberships,
    )
    request.state.principal = principal
    return principal


def require_roles(*roles: str):
    allowed = set(roles)

    def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.role not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Role '{principal.role}' cannot perform this action",
            )
        return principal

    return dependency


def require_min(role: str):
    def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if not principal.at_least(role):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires {role} or higher",
            )
        return principal

    return dependency


def repo_for(principal: Principal, repo_id: str) -> dict[str, Any]:
    repo = db.read_one(
        """
        MATCH (o:Organization {org_id: $org})-[:OWNS]->(r:Repository {repo_id: $repo})
        RETURN r {.*} AS repo
        """,
        {"org": principal.org_id, "repo": repo_id},
    )
    if not repo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Repository not found")
    return repo["repo"]


def audit_target_allowed(principal: Principal, repo_id: str | None) -> None:
    if repo_id:
        repo_for(principal, repo_id)
