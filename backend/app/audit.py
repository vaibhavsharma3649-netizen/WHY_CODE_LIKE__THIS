from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from . import db

SAFE_META_KEYS = {"mode", "repo_id", "result_count", "abstained", "engine", "tool", "status"}


def record(
    org_id: str,
    actor_id: str,
    action: str,
    target_id: str | None = None,
    outcome: str = "ok",
    correlation_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> str | None:
    event_id = f"evt_{uuid.uuid4().hex[:16]}"
    safe = {k: v for k, v in (meta or {}).items() if k in SAFE_META_KEYS}
    try:
        db.write(
            """
            CREATE (e:AuditEvent {
                event_id: $event_id,
                org_id: $org_id,
                actor_id: $actor_id,
                action: $action,
                target_id: $target_id,
                timestamp: $ts,
                outcome: $outcome,
                correlation_id: $correlation_id,
                meta_json: $meta
            })
            """,
            {
                "event_id": event_id,
                "org_id": org_id,
                "actor_id": actor_id,
                "action": action,
                "target_id": target_id,
                "ts": datetime.now(timezone.utc).isoformat(),
                "outcome": outcome,
                "correlation_id": correlation_id or uuid.uuid4().hex[:12],
                "meta": json.dumps(safe, separators=(",", ":")),
            },
        )
    except Exception:
        return None
    return event_id


def recent(org_id: str, limit: int = 40) -> list[dict[str, Any]]:
    return db.read(
        """
        MATCH (e:AuditEvent {org_id: $org})
        RETURN e {.*} AS event
        ORDER BY e.timestamp DESC
        LIMIT $limit
        """,
        {"org": org_id, "limit": limit},
    )
