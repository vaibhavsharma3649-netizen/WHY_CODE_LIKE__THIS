from __future__ import annotations

import secrets
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx
import jwt

from . import audit, db
from .auth import (
    create_oauth_state,
    decode_oauth_state,
    generate_password,
    hash_token,
    hash_password,
)
from .config import settings
from .ingest.parser import repo_key

GITHUB_API = "https://api.github.com"
GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
LOGIN_CODE_TTL_SECONDS = 300
USER_AGENT = "whycoded-prototype"


def request_headers(token: str | None = None) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def api_get(path: str, token: str | None, **params: Any) -> Any:
    with httpx.Client(headers=request_headers(token), timeout=30.0, follow_redirects=True) as client:
        response = client.get(f"{settings.github_api}{path}", params=params)
        response.raise_for_status()
        return response.json()


def oauth_authorize_url(org_id: str | None = None) -> str:
    state = create_oauth_state("github_login", org_id)
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.oauth_redirect_uri,
        "scope": "read:user user:email",
        "state": state,
        "allow_signup": "false",
    }
    return GITHUB_AUTHORIZE_URL + "?" + "&".join(
        f"{key}={quote(str(value), safe='')}" for key, value in params.items()
    )


def exchange_oauth_code(code: str) -> str:
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            GITHUB_OAUTH_TOKEN_URL,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.oauth_redirect_uri,
            },
            headers={"Accept": "application/json", "User-Agent": USER_AGENT},
        )
    response.raise_for_status()
    payload = response.json()
    token = payload.get("access_token")
    error = payload.get("error_description") or payload.get("error")
    if not token:
        raise ValueError(error or "GitHub did not return an access token")
    return str(token)


def github_identity(token: str) -> dict[str, Any]:
    user = api_get("/user", token)
    emails = api_get("/user/emails", token)
    primary = next(
        (row for row in emails if row.get("primary") and row.get("verified")), None
    )
    verified = next((row for row in emails if row.get("verified")), None)
    email = (primary or verified or {}).get("email") or user.get("email")
    if not email:
        raise ValueError("GitHub account has no verified email address")
    return {
        "github_id": str(user["id"]),
        "github_login": user.get("login") or "",
        "email": str(email).strip().lower(),
        "name": user.get("name") or user.get("login") or "GitHub user",
    }


def _memberships(user_id: str) -> list[dict[str, Any]]:
    return db.read(
        """
        MATCH (u:User {user_id: $uid})-[m:MEMBER_OF {status: 'active'}]->(o:Organization)
        RETURN o.org_id AS org_id, o.name AS org_name, m.role AS role
        ORDER BY o.name
        """,
        {"uid": user_id},
    )


def resolve_github_identity(identity: dict[str, Any], org_id: str | None) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    user_id = f"usr_gh_{identity['github_id']}"
    row = db.read_one(
        """
        MATCH (u:User)
        WHERE u.github_id = $gid OR u.email = $email
        RETURN u {.*} AS user
        LIMIT 1
        """,
        {"gid": identity["github_id"], "email": identity["email"]},
    )
    if row:
        user = row["user"]
        user_id = user["user_id"]
        db.write(
            """
            MATCH (u:User {user_id: $uid})
            SET u.github_id = $gid, u.github_login = $login,
                u.last_login_at = $now
            """,
            {"uid": user_id, "gid": identity["github_id"], "login": identity["github_login"], "now": now},
        )
    else:
        temporary = generate_password()
        db.write(
            """
            CREATE (u:User {
                user_id: $uid,
                email: $email,
                name: $name,
                password_hash: $hash,
                status: 'active',
                token_version: 0,
                must_change_password: false,
                github_id: $gid,
                github_login: $login,
                created_at: $now,
                last_login_at: $now
            })
            """,
            {
                "uid": user_id,
                "email": identity["email"],
                "name": identity["name"],
                "hash": hash_password(temporary),
                "gid": identity["github_id"],
                "login": identity["github_login"],
                "now": now,
            },
        )

    memberships = _memberships(user_id)
    if not memberships and org_id:
        auto = db.read_one(
            "MATCH (o:Organization {org_id: $org}) RETURN o.github_auto_join AS auto",
            {"org": org_id},
        )
        if auto and bool(auto.get("auto")):
            db.write(
                """
                MATCH (u:User {user_id: $uid}), (o:Organization {org_id: $org})
                MERGE (u)-[m:MEMBER_OF]->(o)
                SET m.role = 'reader', m.status = 'active', m.since = $now
                """,
                {"uid": user_id, "org": org_id, "now": now},
            )
            memberships = _memberships(user_id)
    if not memberships:
        return {"user_id": user_id, "org_id": None, "memberships": []}
    return {"user_id": user_id, "org_id": memberships[0]["org_id"], "memberships": memberships}


def issue_login_code(user_id: str, org_id: str | None) -> str:
    raw = secrets.token_urlsafe(32)
    now = int(time.time())
    db.write(
        """
        CREATE (c:LoginCode {
            code_hash: $hash,
            user_id: $uid,
            org_id: $org,
            created_at: $now,
            expires_at: $exp
        })
        """,
        {"hash": hash_token(raw), "uid": user_id, "org": org_id, "now": now, "exp": now + LOGIN_CODE_TTL_SECONDS},
    )
    return raw


def consume_login_code(raw: str) -> dict[str, Any] | None:
    row = db.read_one(
        """
        MATCH (c:LoginCode {code_hash: $hash})
        WHERE c.expires_at > $now
        SET c.used_at = $now
        RETURN c.user_id AS user_id, c.org_id AS org_id, c.used_at AS used_at
        """,
        {"hash": hash_token(raw), "now": int(time.time())},
    )
    if not row or row.get("used_at"):
        return None
    return {"user_id": row["user_id"], "org_id": row["org_id"]}


def app_install_url(org_id: str) -> str:
    state = create_oauth_state("github_install", org_id)
    return (
        f"https://github.com/apps/{quote(settings.github_app_slug, safe='')}"
        f"/installations/new?state={quote(state, safe='')}"
    )


def app_jwt() -> str:
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 480, "iss": settings.github_app_id}
    return jwt.encode(payload, settings.github_app_private_key, algorithm="RS256")


def installation_token(installation_id: str) -> str:
    with httpx.Client(headers=request_headers(app_jwt()), timeout=30.0) as client:
        response = client.post(
            f"{settings.github_api}/app/installations/{installation_id}/access_tokens"
        )
    response.raise_for_status()
    return str(response.json()["token"])


def org_installation_id(org_id: str) -> str | None:
    row = db.read_one(
        "MATCH (o:Organization {org_id: $org}) RETURN o.github_installation_id AS id",
        {"org": org_id},
    )
    return str(row["id"]) if row and row.get("id") else None


def complete_installation(state: str, installation_id: str) -> str:
    payload = decode_oauth_state(state, "github_install")
    org_id = payload.get("org")
    if not org_id:
        raise ValueError("Installation state is missing the organization")
    db.write(
        """
        MATCH (o:Organization {org_id: $org})
        SET o.github_installation_id = $id, o.github_installed_at = $now
        """,
        {"org": org_id, "id": str(installation_id), "now": datetime.now(timezone.utc).isoformat()},
    )
    audit.record(org_id, payload.get("uid") or "system", "github.install", org_id, meta={"status": "ok"})
    return str(org_id)


def accessible_repos(org_id: str | None = None) -> list[dict[str, Any]]:
    token = settings.github_token or None
    installation = org_installation_id(org_id) if org_id else None
    if settings.github_app_enabled and installation:
        token = installation_token(installation)
    if not token:
        return []
    rows: list[dict[str, Any]] = []
    page = 1
    while page <= 5:
        if installation and settings.github_app_enabled:
            path = "/installation/repositories"
            params = {"per_page": 100, "page": page}
        else:
            path = "/user/repos"
            params = {
                "per_page": 100,
                "page": page,
                "affiliation": "owner,collaborator,organization_member",
                "sort": "updated",
            }
        data = api_get(path, token, **params)
        rows.extend(data.get("repositories", []) if path.endswith("repositories") else data)
        if len(data.get("repositories", data if isinstance(data, list) else [])) < 100:
            break
        page += 1
    return [
        {
            "full_name": row["full_name"],
            "description": row.get("description"),
            "private": bool(row.get("private")),
            "default_branch": row.get("default_branch") or "main",
            "url": row.get("html_url"),
        }
        for row in rows
        if row.get("full_name") and not row.get("archived")
    ]


def ingest_token(org_id: str) -> str | None:
    installation = org_installation_id(org_id)
    if settings.github_app_enabled and installation:
        try:
            return installation_token(installation)
        except Exception:
            return settings.github_token or None
    return settings.github_token or None


def parse_repo_ref(value: str) -> tuple[str, str]:
    text = value.strip()
    if "github.com/" in text:
        text = text.split("github.com/", 1)[1]
    text = text.strip().strip("/").removesuffix(".git")
    parts = [part for part in text.split("/") if part]
    if len(parts) < 2:
        raise ValueError("Use owner/repo or a GitHub repository URL")
    return parts[0], parts[1]


def repo_id_for(org_id: str, owner: str, name: str) -> str:
    return repo_key(org_id, owner, name)
