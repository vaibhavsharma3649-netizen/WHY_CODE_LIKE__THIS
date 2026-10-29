from __future__ import annotations

from . import db
from .config import settings

UNIQUE = [
    ("Organization", "org_id"),
    ("User", "user_id"),
    ("Repository", "repo_id"),
    ("File", "file_id"),
    ("CodeEntity", "entity_id"),
    ("CodeChunk", "chunk_id"),
    ("Commit", "commit_id"),
    ("PullRequest", "pr_id"),
    ("Issue", "issue_id"),
    ("Decision", "decision_id"),
    ("SecurityFinding", "finding_id"),
    ("SecurityFix", "fix_id"),
    ("Task", "task_id"),
    ("AgentRun", "run_id"),
    ("AuditEvent", "event_id"),
]

RANGE = [
    ("Repository", "org_id"),
    ("File", "repo_id"),
    ("CodeEntity", "repo_id"),
    ("CodeChunk", "repo_id"),
    ("Decision", "repo_id"),
    ("SecurityFinding", "repo_id"),
    ("Commit", "repo_id"),
    ("PullRequest", "repo_id"),
    ("Issue", "repo_id"),
    ("Task", "repo_id"),
    ("AgentRun", "repo_id"),
    ("AuditEvent", "org_id"),
    ("User", "email"),
]


def _vector_dim() -> int:
    return 384


def init_schema() -> dict[str, int]:
    created = {"constraints": 0, "indexes": 0}
    with db.session() as s:
        for label, prop in UNIQUE:
            s.run(
                f"CREATE CONSTRAINT {label.lower()}_{prop} IF NOT EXISTS "
                f"FOR (n:{label}) REQUIRE n.{prop} IS UNIQUE"
            )
            created["constraints"] += 1
        for label, prop in RANGE:
            s.run(
                f"CREATE INDEX {label.lower()}_{prop}_idx IF NOT EXISTS "
                f"FOR (n:{label}) ON (n.{prop})"
            )
            created["indexes"] += 1

        s.run(
            "CREATE FULLTEXT INDEX chunk_text IF NOT EXISTS "
            "FOR (c:CodeChunk) ON EACH [c.content_excerpt, c.path]"
        )
        s.run(
            "CREATE FULLTEXT INDEX entity_text IF NOT EXISTS "
            "FOR (e:CodeEntity) ON EACH [e.qualified_name, e.path, e.docstring]"
        )
        s.run(
            "CREATE FULLTEXT INDEX decision_text IF NOT EXISTS "
            "FOR (d:Decision) ON EACH [d.summary, d.rationale]"
        )
        dim = _vector_dim()
        s.run(
            "CREATE VECTOR INDEX chunk_vec IF NOT EXISTS "
            "FOR (c:CodeChunk) ON (c.embedding) "
            "OPTIONS {indexConfig: {`vector.dimensions`: $dim, "
            "`vector.similarity_function`: 'cosine'}}",
            {"dim": dim},
        )
        s.run(
            "CREATE VECTOR INDEX decision_vec IF NOT EXISTS "
            "FOR (d:Decision) ON (d.embedding) "
            "OPTIONS {indexConfig: {`vector.dimensions`: $dim, "
            "`vector.similarity_function`: 'cosine'}}",
            {"dim": dim},
        )
        s.run(
            "CREATE FULLTEXT INDEX file_text IF NOT EXISTS "
            "FOR (f:File) ON EACH [f.path, f.language]"
        )
        created["indexes"] += 6
    return created


def reset_database(keep_schema: bool = True) -> None:
    with db.session() as s:
        s.run("MATCH (n) DETACH DELETE n")
    if keep_schema:
        init_schema()


def schema_report() -> dict[str, list[str]]:
    with db.session() as s:
        constraints = [r["name"] for r in s.run("SHOW CONSTRAINTS YIELD name RETURN name")]
        indexes = [r["name"] for r in s.run("SHOW INDEXES YIELD name RETURN name")]
    return {"constraints": sorted(constraints), "indexes": sorted(indexes)}


if __name__ == "__main__":
    print(init_schema())
    print(schema_report())
