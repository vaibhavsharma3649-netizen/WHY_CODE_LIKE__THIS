from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app import audit, db  # noqa: E402
from app.auth import hash_password  # noqa: E402
from app.config import settings  # noqa: E402
from app.embeddings import embed_texts  # noqa: E402
from app.ingest.parser import chunk_key, decision_key, entity_key, file_key, finding_key, repo_key  # noqa: E402
from app.ingest.pipeline import ingest  # noqa: E402
from app.schema import init_schema, reset_database  # noqa: E402

DEMO_PASSWORD = "whyc-demo"

ORGS = [
    ("org_alpha", "Northwind Engineering"),
    ("org_beta", "Beta Labs"),
]

USERS = [
    ("usr_ada", "ada@whyc.dev", "Ada Lovelace", "org_alpha", "admin"),
    ("usr_maya", "maya@whyc.dev", "Maya Chen", "org_alpha", "maintainer"),
    ("usr_dev", "dev@whyc.dev", "Sam Rivera", "org_alpha", "developer"),
    ("usr_sec", "sec@whyc.dev", "Priya Nair", "org_alpha", "security_reviewer"),
    ("usr_read", "reader@whyc.dev", "Noah Kim", "org_alpha", "reader"),
    ("usr_grace", "grace@beta.dev", "Grace Hopper", "org_beta", "admin"),
]


def seed_orgs_users() -> None:
    password_hash = hash_password(DEMO_PASSWORD)
    for org_id, name in ORGS:
        db.write(
            """
            MERGE (o:Organization {org_id: $org})
            SET o.name = $name, o.status = 'active', o.created_at = $now
            """,
            {"org": org_id, "name": name, "now": datetime.now(timezone.utc).isoformat()},
        )
    for user_id, email, name, org_id, role in USERS:
        db.write(
            """
            MERGE (u:User {user_id: $uid})
            SET u.email = $email, u.name = $name, u.password_hash = $hash, u.created_at = $now
            WITH u
            MATCH (o:Organization {org_id: $org})
            MERGE (u)-[m:MEMBER_OF]->(o)
            SET m.role = $role, m.status = 'active', m.since = $now
            """,
            {
                "uid": user_id,
                "email": email,
                "name": name,
                "hash": password_hash,
                "org": org_id,
                "role": role,
                "now": datetime.now(timezone.utc).isoformat(),
            },
        )


def seed_beta_repo() -> str:
    org_id = "org_beta"
    repo_id = repo_key(org_id, "beta-labs", "ledger-core")
    db.write(
        """
        MATCH (o:Organization {org_id: $org})
        MERGE (r:Repository {repo_id: $repo})
        SET r.org_id = $org, r.provider = 'github', r.owner = 'beta-labs', r.name = 'ledger-core',
            r.full_name = 'beta-labs/ledger-core', r.default_branch = 'main',
            r.indexed_sha = $sha, r.sync_status = 'ready', r.last_synced_at = $now,
            r.description = 'Internal ledger service (seeded for tenant isolation tests)',
            r.synthetic = true, r.files_indexed = 2, r.entities_indexed = 3,
            r.chunks_indexed = 2, r.decisions_indexed = 1, r.findings_indexed = 1
        MERGE (o)-[:OWNS]->(r)
        """,
        {
            "org": org_id,
            "repo": repo_id,
            "sha": "beta0000synthetic0000ledger",
            "now": datetime.now(timezone.utc).isoformat(),
        },
    )
    path = "src/beta/ledger.py"
    file_id = file_key(repo_id, path)
    db.write(
        """
        MATCH (r:Repository {repo_id: $repo, org_id: $org})
        MERGE (f:File {file_id: $fid})
        SET f.org_id = $org, f.repo_id = $repo, f.path = $path, f.language = 'python',
            f.blob_sha = 'synthetic', f.source_url = null, f.commit_sha = $sha
        MERGE (r)-[:CONTAINS]->(f)
        """,
        {"repo": repo_id, "org": org_id, "fid": file_id, "path": path, "sha": "beta0000synthetic0000ledger"},
    )
    entity_id = entity_key(repo_id, path, "beta.ledger.Ledger", 1)
    db.write(
        """
        MATCH (f:File {file_id: $fid})
        MERGE (e:CodeEntity {entity_id: $eid})
        SET e.org_id = $org, e.repo_id = $repo, e.name = 'Ledger', e.qualified_name = 'beta.ledger.Ledger',
            e.kind = 'class', e.path = $path, e.line_start = 1, e.line_end = 40,
            e.docstring = 'Beta-only ledger. Must never be visible to org_alpha.'
        MERGE (f)-[:DEFINES]->(e)
        """,
        {"fid": file_id, "eid": entity_id, "org": org_id, "repo": repo_id, "path": path},
    )
    texts = [
        "class Ledger: implements beta-only double entry accounting and must remain tenant isolated.",
        "def post_entry(amount): beta-only ledger entry posting.",
    ]
    vectors, _ = embed_texts(texts)
    for index, (text, vector) in enumerate(zip(texts, vectors)):
        db.write(
            """
            MATCH (f:File {file_id: $fid})
            MERGE (c:CodeChunk {chunk_id: $cid})
            SET c.org_id = $org, c.repo_id = $repo, c.path = $path,
                c.content_excerpt = $text, c.line_start = $line, c.line_end = $line,
                c.commit_sha = $sha, c.embedding = $vec, c.embedding_model = 'seed'
            MERGE (f)-[:HAS_CHUNK]->(c)
            """,
            {
                "fid": file_id,
                "cid": chunk_key(repo_id, path, index + 1),
                "org": org_id,
                "repo": repo_id,
                "path": path,
                "text": text,
                "line": index + 1,
                "sha": "beta0000synthetic0000ledger",
                "vec": vector,
            },
        )
    dec_id = decision_key(repo_id, "https://example.invalid/beta/1", "Use ledger-first ordering")
    db.write(
        """
        MATCH (r:Repository {repo_id: $repo, org_id: $org})
        MERGE (d:Decision {decision_id: $dec})
        SET d.org_id = $org, d.repo_id = $repo, d.summary = 'Use ledger-first ordering',
            d.rationale = 'Beta-only decision used to prove tenant isolation.',
            d.rationale_type = 'explicit', d.status = 'accepted', d.confidence = 0.9,
            d.decided_at = $now, d.evidence_url = 'https://example.invalid/beta/1', d.path = $path
        MERGE (r)-[:HAS_DECISION]->(d)
        """,
        {"repo": repo_id, "org": org_id, "dec": dec_id, "now": datetime.now(timezone.utc).isoformat(), "path": path},
    )
    db.write(
        """
        MATCH (r:Repository {repo_id: $repo, org_id: $org})
        MERGE (x:SecurityFinding {finding_id: $fid})
        SET x.org_id = $org, x.repo_id = $repo, x.rule_id = 'B999', x.severity = 'MEDIUM',
            x.confidence = 'HIGH', x.status = 'open', x.scanner = 'synthetic',
            x.path = $path, x.line_start = 12, x.line_end = 12,
            x.message = 'Beta-only synthetic finding for isolation tests.',
            x.observed_at = $now, x.synthetic = true
        MERGE (r)-[:HAS_FINDING]->(x)
        """,
        {
            "repo": repo_id,
            "org": org_id,
            "fid": finding_key(repo_id, "B999", path, 12),
            "path": path,
            "now": datetime.now(timezone.utc).isoformat(),
        },
    )
    return repo_id


def seed_agent_demo(repo_id: str) -> str:
    from app.services import agent

    state = agent.create_task(
        "org_alpha",
        repo_id,
        "usr_ada",
        "Explain session signing",
        "Why is SHA-1 still used in sessions.py, and which decision explains it?",
    )
    task_id = state["task"]["task_id"]
    run = agent.create_run("org_alpha", repo_id, task_id)
    run_id = run["run"]["run_id"]
    agent.step("org_alpha", repo_id, run_id, "get_decisions", {})
    agent.step(
        "org_alpha",
        repo_id,
        run_id,
        "search_code",
        {"query": "SecureCookieSessionInterface sha1", "limit": 3},
    )
    return run_id


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the WhyCode demo tenant")
    parser.add_argument("--reset", action="store_true", help="Delete all nodes before seeding")
    parser.add_argument("--skip-ingest", action="store_true")
    parser.add_argument("--owner", default="pallets")
    parser.add_argument("--name", default="flask")
    parser.add_argument("--pinned-pr", type=int, action="append", default=None)
    args = parser.parse_args()

    if args.reset:
        print("resetting graph")
        reset_database(keep_schema=True)
    else:
        init_schema()

    seed_orgs_users()
    print(f"seeded {len(ORGS)} organisations and {len(USERS)} users (password: {DEMO_PASSWORD})")
    beta_repo = seed_beta_repo()
    print(f"seeded isolation repo {beta_repo}")

    if args.skip_ingest:
        return

    pinned = args.pinned_pr if args.pinned_pr is not None else [5460]
    print(f"ingesting {args.owner}/{args.name} pinned PRs {pinned}")
    summary = ingest("org_alpha", args.owner, args.name, None, pinned, True)
    repo_id = summary["repo_id"]
    db.write(
        """
        MATCH (r:Repository {repo_id: $repo, org_id: 'org_alpha'})
        SET r.pinned_prs_json = $pinned
        """,
        {"repo": repo_id, "pinned": __import__("json").dumps(pinned)},
    )
    audit.record("org_alpha", "usr_ada", "repository.import", repo_id, meta={"repo_id": repo_id, "status": "ok"})
    demo_run = seed_agent_demo(repo_id)
    print(f"seeded agent demo task with run {demo_run}")
    print("ingestion summary:")
    for key, value in summary.items():
        if key != "skipped":
            print(f"  {key}: {value}")
    print(f"  skipped: {len(summary['skipped'])}")
    print(f"\ndemo login: ada@whyc.dev / {DEMO_PASSWORD}")
    print(f"demo repo: {repo_id}")


if __name__ == "__main__":
    main()
