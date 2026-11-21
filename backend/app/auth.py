from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass, field
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import db
from .config import settings

bearer = HTTPBearer(auto_error=False)

PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
TEMPORARY_PASSWORD_LENGTH = 18
MIN_PASSWORD_LENGTH = 10

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


def create_token(user_id: str, token_version: int = 0) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "ver": int(token_version),
        "iat": now,
        "exp": now + settings.token_ttl_minutes * 60,
        "iss": "whycoded",
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token_claims(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=["HS256"], issuer="whycoded"
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials") from exc
    if not payload.get("sub"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if payload.get("typ", "access") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return payload


def decode_token(token: str) -> str:
    return str(decode_token_claims(token)["sub"])


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_password(length: int = TEMPORARY_PASSWORD_LENGTH) -> str:
    return "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))


def validate_password(password: str, email: str = "") -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters",
        )
    if email and password.lower() == email.lower():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Password must not match the email address",
        )


def create_oauth_state(
    kind: str, org_id: str | None = None, user_id: str | None = None
) -> str:
    now = int(time.time())
    payload = {
        "typ": "oauth_state",
        "kind": kind,
        "org": org_id,
        "uid": user_id,
        "iat": now,
        "exp": now + 600,
        "iss": "whycoded",
        "nonce": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_oauth_state(state: str, kind: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            state, settings.jwt_secret, algorithms=["HS256"], issuer="whycoded"
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired state") from exc
    if payload.get("typ") != "oauth_state" or payload.get("kind") != kind:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired state")
    return payload


def issue_refresh_token(
    user_id: str,
    org_id: str | None,
    user_agent: str | None = None,
    ip: str | None = None,
) -> str:
    raw = secrets.token_urlsafe(48)
    now = int(time.time())
    expires_at = now + settings.refresh_token_days * 86_400
    db.write(
        """
        CREATE (t:RefreshToken {
            token_hash: $hash,
            user_id: $uid,
            org_id: $org,
            created_at: $now,
            expires_at: $exp,
            user_agent: $ua,
            ip: $ip
        })
        """,
        {
            "hash": hash_token(raw),
            "uid": user_id,
            "org": org_id,
            "now": now,
            "exp": expires_at,
            "ua": (user_agent or "")[:200],
            "ip": (ip or "")[:80],
        },
    )
    return raw


def consume_refresh_token(raw: str) -> dict[str, Any] | None:
    now = int(time.time())
    row = db.read_one(
        """
        MATCH (t:RefreshToken {token_hash: $hash})
        WHERE t.revoked_at IS NULL AND t.expires_at > $now
        SET t.revoked_at = $now
        RETURN t.user_id AS user_id, t.org_id AS org_id
        """,
        {"hash": hash_token(raw), "now": now},
    )
    return row


def revoke_refresh_token(raw: str) -> None:
    db.write(
        """
        MATCH (t:RefreshToken {token_hash: $hash})
        WHERE t.revoked_at IS NULL
        SET t.revoked_at = $now
        """,
        {"hash": hash_token(raw), "now": int(time.time())},
    )


def revoke_user_tokens(user_id: str) -> None:
    db.write(
        """
        MATCH (t:RefreshToken {user_id: $uid})
        WHERE t.revoked_at IS NULL
        SET t.revoked_at = $now
        """,
        {"uid": user_id, "now": int(time.time())},
    )


@dataclass
class Principal:
    user_id: str
    email: str
    name: str
    org_id: str
    org_name: str
    role: str
    memberships: list[dict[str, Any]] = field(default_factory=list)
    token_version: int = 0
    github_login: str | None = None

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
    claims = decode_token_claims(credentials.credentials)
    user_id = str(claims["sub"])
    user = db.read_one(
        """
        MATCH (u:User {user_id: $uid})
        RETURN u.user_id AS user_id, u.email AS email, u.name AS name,
               u.status AS status, u.token_version AS token_version,
               u.github_login AS github_login
        """,
        {"uid": user_id},
    )
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown user")
    if (user.get("status") or "active") != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    if int(claims.get("ver", 0)) != int(user.get("token_version") or 0):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session revoked")
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
        token_version=int(user.get("token_version") or 0),
        github_login=user.get("github_login"),
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
