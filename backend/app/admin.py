from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from . import audit, db
from .auth import (
    Principal,
    ROLE_RANK,
    generate_password,
    hash_password,
    normalize_email,
    revoke_user_tokens,
    require_roles,
    validate_password,
)
from .config import settings
from .github_auth import (
    accessible_repos,
    api_get,
    app_install_url,
    complete_installation,
    ingest_token,
    org_installation_id,
    parse_repo_ref,
)
from .ingest.pipeline import delete_repo_data, ingest
from .ingest.parser import repo_key
from .models import PasswordResetRequest, RepoCreate, UserCreate, UserUpdate

router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_roles("admin"))])
install_router = APIRouter(prefix="/api/admin")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_user(row: dict[str, Any]) -> dict[str, Any]:
    user = dict(row.get("user") or {})
    user.pop("password_hash", None)
    return user


def _org_members(org_id: str) -> list[dict[str, Any]]:
    rows = db.read(
        """
        MATCH (u:User)-[m:MEMBER_OF]->(o:Organization {org_id: $org})
        OPTIONAL MATCH (u)-[am:MEMBER_OF]->(ao:Organization)
        WITH u, m, collect({
            org_id: ao.org_id, org_name: ao.name,
            role: am.role, status: am.status
        }) AS memberships
        RETURN u {.*} AS user, m.role AS role,
               m.status AS membership_status, memberships
        ORDER BY toLower(u.name)
        """,
        {"org": org_id},
    )
    return [
        {
            "user": _public_user(row),
            "role": row["role"],
            "membership_status": row.get("membership_status") or "active",
            "memberships": [m for m in row["memberships"] if m.get("org_id")],
        }
        for row in rows
    ]


def _active_admin_count(org_id: str) -> int:
    row = db.read_one(
        """
        MATCH (u:User)-[m:MEMBER_OF {status: 'active'}]->(o:Organization {org_id: $org})
        WHERE m.role = 'admin' AND coalesce(u.status, 'active') = 'active'
        RETURN count(u) AS total
        """,
        {"org": org_id},
    )
    return int((row or {}).get("total") or 0)


def _guard_last_admin(org_id: str, user_id: str, role: str, status: str) -> None:
    row = db.read_one(
        """
        MATCH (u:User {user_id: $uid})-[m:MEMBER_OF]->(o:Organization {org_id: $org})
        RETURN m.role AS role, m.status AS status
        """,
        {"uid": user_id, "org": org_id},
    )
    if not row:
        return
    was_admin = row.get("role") == "admin" and (row.get("status") or "active") == "active"
    remains_admin = role == "admin" and status == "active"
    if was_admin and not remains_admin and _active_admin_count(org_id) <= 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "An organization must keep at least one active admin",
        )


@router.get("/users")
def list_users(principal: Principal = Depends(require_roles("admin"))) -> dict[str, Any]:
    return {"users": _org_members(principal.org_id)}


@router.post("/users", status_code=201)
def create_user(
    body: UserCreate, principal: Principal = Depends(require_roles("admin"))
) -> dict[str, Any]:
    email = normalize_email(body.email)
    if not email or "@" not in email:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A valid email is required")
    if body.role not in ROLE_RANK:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown role")
    now = _now()
    existing = db.read_one(
        "MATCH (u:User {email: $email}) RETURN u {.*} AS user", {"email": email}
    )
    generated: str | None = None
    if existing:
        user_id = existing["user"]["user_id"]
        membership = db.read_one(
            """
            MATCH (u:User {user_id: $uid})-[m:MEMBER_OF]->(o:Organization {org_id: $org})
            RETURN m
            """,
            {"uid": user_id, "org": principal.org_id},
        )
        if membership:
            db.write(
                """
                MATCH (u:User {user_id: $uid})-[m:MEMBER_OF]->(o:Organization {org_id: $org})
                SET m.role = $role, m.status = 'active'
                """,
                {"uid": user_id, "org": principal.org_id, "role": body.role},
            )
        else:
            db.write(
                """
                MATCH (u:User {user_id: $uid}), (o:Organization {org_id: $org})
                MERGE (u)-[m:MEMBER_OF]->(o)
                SET m.role = $role, m.status = 'active', m.since = $now
                """,
                {"uid": user_id, "org": principal.org_id, "role": body.role, "now": now},
            )
    else:
        generated = body.password
        if generated:
            validate_password(generated, email)
        else:
            generated = generate_password()
        user_id = f"usr_{secrets.token_hex(8)}"
        db.write(
            """
            CREATE (u:User {
                user_id: $uid, email: $email, name: $name,
                password_hash: $hash, status: 'active', token_version: 0,
                must_change_password: true, created_at: $now
            })
            WITH u
            MATCH (o:Organization {org_id: $org})
            MERGE (u)-[m:MEMBER_OF]->(o)
            SET m.role = $role, m.status = 'active', m.since = $now
            """,
            {
                "uid": user_id,
                "email": email,
                "name": body.name.strip() or email.split("@")[0],
                "hash": hash_password(generated),
                "now": now,
                "org": principal.org_id,
                "role": body.role,
            },
        )
    audit.record(
        principal.org_id,
        principal.user_id,
        "admin.user.create",
        user_id,
        meta={"role": body.role},
    )
    return {"user_id": user_id, "email": email, "temporary_password": generated}


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    body: UserUpdate,
    principal: Principal = Depends(require_roles("admin")),
) -> dict[str, Any]:
    row = db.read_one(
        """
        MATCH (u:User {user_id: $uid})-[m:MEMBER_OF]->(o:Organization {org_id: $org})
        RETURN m.role AS role, m.status AS status
        """,
        {"uid": user_id, "org": principal.org_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User is not a member of this organization")
    role = body.role or row["role"]
    status_value = body.status or (row.get("status") or "active")
    _guard_last_admin(principal.org_id, user_id, role, status_value)
    db.write(
        """
        MATCH (u:User {user_id: $uid})-[m:MEMBER_OF]->(o:Organization {org_id: $org})
        SET m.role = $role, m.status = $status
        """,
        {"uid": user_id, "org": principal.org_id, "role": role, "status": status_value},
    )
    if status_value != "active":
        revoke_user_tokens(user_id)
    audit.record(
        principal.org_id,
        principal.user_id,
        "admin.user.update",
        user_id,
        meta={"role": role, "status": status_value},
    )
    return {"user_id": user_id, "role": role, "status": status_value}


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: str,
    body: PasswordResetRequest,
    principal: Principal = Depends(require_roles("admin")),
) -> dict[str, str]:
    row = db.read_one(
        """
        MATCH (u:User {user_id: $uid})-[m:MEMBER_OF]->(o:Organization {org_id: $org})
        RETURN u.email AS email
        """,
        {"uid": user_id, "org": principal.org_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User is not a member of this organization")
    password = body.password or generate_password()
    validate_password(password, row.get("email") or "")
    db.write(
        """
        MATCH (u:User {user_id: $uid})
        SET u.password_hash = $hash, u.must_change_password = true,
            u.token_version = coalesce(u.token_version, 0) + 1,
            u.password_changed_at = $now
        """,
        {"uid": user_id, "hash": hash_password(password), "now": _now()},
    )
    revoke_user_tokens(user_id)
    audit.record(principal.org_id, principal.user_id, "admin.user.reset", user_id)
    return {"temporary_password": password}


@router.delete("/users/{user_id}")
def remove_user(
    user_id: str, principal: Principal = Depends(require_roles("admin"))
) -> dict[str, str]:
    _guard_last_admin(principal.org_id, user_id, "reader", "disabled")
    db.write(
        """
        MATCH (u:User {user_id: $uid})-[m:MEMBER_OF]->(o:Organization {org_id: $org})
        DELETE m
        """,
        {"uid": user_id, "org": principal.org_id},
    )
    revoke_user_tokens(user_id)
    audit.record(principal.org_id, principal.user_id, "admin.user.remove", user_id)
    return {"status": "ok"}


@router.get("/repos")
def list_repos(principal: Principal = Depends(require_roles("admin"))) -> dict[str, Any]:
    rows = db.read(
        """
        MATCH (o:Organization {org_id: $org})-[:OWNS]->(r:Repository)
        OPTIONAL MATCH (r)-[:CONTAINS]->(f:File)
        WITH r, count(DISTINCT f) AS files
        OPTIONAL MATCH (d:Decision {repo_id: r.repo_id, org_id: $org})
        WITH r, files, count(DISTINCT d) AS decisions
        OPTIONAL MATCH (x:SecurityFinding {repo_id: r.repo_id, org_id: $org})
        RETURN r {.*} AS repo, files, decisions, count(DISTINCT x) AS findings
        ORDER BY repo.name
        """,
        {"org": principal.org_id},
    )
    return {
        "repos": [
            {
                **row["repo"],
                "counts": {
                    "files": row["files"],
                    "decisions": row["decisions"],
                    "findings": row["findings"],
                },
            }
            for row in rows
        ]
    }


def _queue_ingest(
    org_id: str,
    owner: str,
    name: str,
    branch: str | None,
    pinned: list[int],
    background: BackgroundTasks,
) -> str:
    repo_id = repo_key(org_id, owner, name)
    credential = ingest_token(org_id)
    try:
        meta = api_get(f"/repos/{owner}/{name}", credential)
    except Exception as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Repository is not accessible with the organization's GitHub connection: {exc}",
        ) from exc
    now = _now()
    db.write(
        """
        MATCH (o:Organization {org_id: $org})
        MERGE (r:Repository {repo_id: $repo})
        SET r.org_id = $org, r.provider = 'github', r.owner = $owner, r.name = $name,
            r.full_name = $full, r.default_branch = $branch,
            r.url = $url, r.description = $description,
            r.sync_status = 'queued', r.pinned_prs_json = $pinned,
            r.created_at = coalesce(r.created_at, $now)
        MERGE (o)-[:OWNS]->(r)
        """,
        {
            "org": org_id,
            "repo": repo_id,
            "owner": owner,
            "name": name,
            "full": meta.get("full_name") or f"{owner}/{name}",
            "branch": branch or meta.get("default_branch") or "main",
            "url": meta.get("html_url"),
            "description": meta.get("description"),
            "pinned": json.dumps(pinned),
            "now": now,
        },
    )
    background.add_task(
        ingest,
        org_id,
        owner,
        name,
        branch,
        pinned,
        True,
        print,
        credential,
    )
    return repo_id


@router.post("/repos", status_code=202)
def add_repo(
    body: RepoCreate,
    background: BackgroundTasks,
    principal: Principal = Depends(require_roles("admin")),
) -> dict[str, Any]:
    if body.owner and body.name:
        owner, name = body.owner.strip(), body.name.strip()
    else:
        try:
            owner, name = parse_repo_ref(body.full_name or "")
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    repo_id = _queue_ingest(
        principal.org_id, owner, name, body.branch, body.pinned_prs, background
    )
    audit.record(
        principal.org_id,
        principal.user_id,
        "admin.repository.import",
        repo_id,
        meta={"repo_id": repo_id},
    )
    return {"status": "queued", "repo_id": repo_id, "full_name": f"{owner}/{name}"}


@router.delete("/repos/{repo_id}")
def remove_repo(
    repo_id: str, principal: Principal = Depends(require_roles("admin"))
) -> dict[str, str]:
    row = db.read_one(
        """
        MATCH (o:Organization {org_id: $org})-[:OWNS]->(r:Repository {repo_id: $repo})
        RETURN r.repo_id AS id
        """,
        {"org": principal.org_id, "repo": repo_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Repository not found")
    delete_repo_data(repo_id, principal.org_id)
    audit.record(principal.org_id, principal.user_id, "admin.repository.remove", repo_id)
    return {"status": "ok"}


@router.get("/github")
def github_status(principal: Principal = Depends(require_roles("admin"))) -> dict[str, Any]:
    installed = bool(org_installation_id(principal.org_id))
    return {
        "app_configured": settings.github_app_enabled,
        "app_installed": installed,
        "install_url": app_install_url(principal.org_id)
        if settings.github_app_enabled and not installed
        else None,
        "token_configured": bool(settings.github_token),
    }


@router.get("/github/repos")
def github_repos(principal: Principal = Depends(require_roles("admin"))) -> dict[str, Any]:
    return {"repos": accessible_repos(principal.org_id)}


@install_router.get("/github/callback")
def github_install_callback(code: str | None = None, state: str | None = None, installation_id: str | None = None, setup_action: str | None = None):
    if not state or not installation_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid installation callback")
    org_id = complete_installation(state, installation_id)
    return RedirectResponse(
        f"{settings.frontend_url.rstrip('/')}/#/admin?github=connected", status_code=302
    )
