from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .. import db
from ..config import settings
from ..embeddings import embed_texts
from . import parser as p
from .github import GitHub

MARKERS = (
    "because",
    "so that",
    "instead",
    "rather than",
    "we don't want",
    "we do not want",
    "support ",
    "deprecate",
    "replace",
    "remove",
    "no longer",
    "revert",
)
EXPLICIT_MARKERS = ("because", "so that", "we don't want", "we do not want", "instead", "rather than", "no longer", "revert")
NOISE_TITLES = ("bump ", "update ", "build(deps", "chore(deps")
SKIP_DIRS = {
    "tests", "test", ".github", ".tox", ".git", "__pycache__", "node_modules",
    "docs/_static", "docs/_templates", "build", "dist", ".venv", "venv", "examples",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _is_noise(title: str) -> bool:
    lowered = title.lower().strip()
    return any(lowered.startswith(prefix) for prefix in NOISE_TITLES)


def _select_files(root: Path) -> tuple[list[tuple[Path, str, str]], list[str]]:
    selected: list[tuple[Path, str, str]] = []
    skipped: list[str] = []
    candidates: list[tuple[int, Path, str]] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = p.normalize_rel(path, root)
        if any(part in SKIP_DIRS for part in rel.split("/")) or rel.startswith("docs/_static"):
            continue
        if path.stat().st_size > p.MAX_FILE_BYTES:
            skipped.append(f"{rel} (larger than {p.MAX_FILE_BYTES // 1000}KB)")
            continue
        suffix = path.suffix.lower()
        if suffix in {".py", ".md", ".rst", ".toml", ".cfg", ".txt", ".yaml", ".yml", ".json"}:
            if suffix == ".py":
                priority = 0 if rel.startswith("src/") else 1
            elif rel.lower().startswith("readme") or rel.lower().startswith("changes"):
                priority = 2
            else:
                priority = 3
            candidates.append((priority, path, rel))
        elif suffix not in {".png", ".jpg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".pdf"}:
            skipped.append(f"{rel} (unsupported type)")
    candidates.sort(key=lambda item: (item[0], len(item[2]), item[2]))
    for priority, path, rel in candidates:
        if len(selected) >= settings.max_files:
            skipped.append(f"{len(candidates) - len(selected)} additional files (file budget {settings.max_files})")
            break
        language = {
            ".py": "python", ".md": "markdown", ".rst": "rst", ".toml": "toml",
            ".cfg": "ini", ".txt": "text", ".yaml": "yaml", ".yml": "yaml", ".json": "json",
        }.get(path.suffix.lower(), "text")
        selected.append((path, rel, language))
    return selected, skipped


def _rationale(body: str) -> tuple[str, str]:
    cleaned = re.sub(r"\s+", " ", (body or "")).strip()
    if not cleaned:
        return "", "inferred"
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    chosen = [s for s in sentences if any(m in s.lower() for m in MARKERS)]
    text = " ".join(chosen[:2])[:500] if chosen else cleaned[:400]
    kind = "explicit" if any(m in text.lower() for m in EXPLICIT_MARKERS) else "inferred"
    return text, kind


def _merge_repo(org_id: str, repo_id: str, owner: str, name: str, meta: dict[str, Any], sha: str, branch: str) -> None:
    db.write(
        """
        MATCH (o:Organization {org_id: $org})
        MERGE (r:Repository {repo_id: $repo})
        SET r.org_id = $org,
            r.provider = 'github',
            r.owner = $owner,
            r.name = $name,
            r.full_name = $full_name,
            r.url = $url,
            r.default_branch = $branch,
            r.indexed_sha = $sha,
            r.sync_status = 'indexing',
            r.last_synced_at = $now,
            r.description = $description,
            r.synthetic = false
        MERGE (o)-[:OWNS]->(r)
        """,
        {
            "org": org_id,
            "repo": repo_id,
            "owner": owner,
            "name": name,
            "full_name": f"{owner}/{name}",
            "url": meta.get("html_url") or f"https://github.com/{owner}/{name}",
            "branch": branch,
            "sha": sha,
            "now": _now(),
            "description": (meta.get("description") or "")[:300],
        },
    )


def _write_files(rows: list[dict[str, Any]], repo_id: str, org_id: str) -> None:
    db.write_many(
        """
        UNWIND $rows AS row
        MATCH (r:Repository {repo_id: row.repo_id, org_id: row.org_id})
        MERGE (f:File {file_id: row.file_id})
        SET f += row
        MERGE (r)-[:CONTAINS]->(f)
        """,
        rows,
    )


def _write_entities(rows: list[dict[str, Any]]) -> None:
    db.write_many(
        """
        UNWIND $rows AS row
        MATCH (f:File {file_id: row.file_id})
        MERGE (e:CodeEntity {entity_id: row.entity_id})
        SET e += row
        MERGE (f)-[:DEFINES]->(e)
        """,
        rows,
    )


def _write_chunks(rows: list[dict[str, Any]]) -> None:
    db.write_many(
        """
        UNWIND $rows AS row
        MATCH (f:File {file_id: row.file_id})
        MERGE (c:CodeChunk {chunk_id: row.chunk_id})
        SET c += row
        MERGE (f)-[:HAS_CHUNK]->(c)
        """,
        rows,
    )


def _write_relations(rows: list[dict[str, Any]], rel: str) -> None:
    if not rows:
        return
    db.write_many(
        f"""
        UNWIND $rows AS row
        MATCH (a:CodeEntity {{entity_id: row.src}})
        MATCH (b:CodeEntity {{entity_id: row.dst}})
        MERGE (a)-[:{rel}]->(b)
        """,
        rows,
    )


def _embed_chunks(chunks: list[dict[str, Any]], batch: int = 48) -> str:
    backend = "hash-384"
    for i in range(0, len(chunks), batch):
        slice_ = chunks[i : i + batch]
        vectors, backend = embed_texts([c["content_excerpt"] for c in slice_])
        for chunk, vector in zip(slice_, vectors):
            chunk["embedding"] = vector
    if chunks:
        db.write_many(
            """
            UNWIND $rows AS row
            MATCH (c:CodeChunk {chunk_id: row.chunk_id})
            SET c.embedding = row.embedding, c.embedding_model = row.embedding_model
            """,
            [
                {
                    "chunk_id": c["chunk_id"],
                    "embedding": c["embedding"],
                    "embedding_model": backend,
                }
                for c in chunks
            ],
            batch=40,
        )
    return backend


def _ingest_commits(gh: GitHub, owner: str, name: str, sha: str, repo_id: str, org_id: str) -> list[dict[str, Any]]:
    rows = []
    for item in gh.commits(owner, name, sha, settings.max_commits):
        commit = item.get("commit", {})
        author = commit.get("author", {})
        rows.append(
            {
                "commit_id": p.commit_key(repo_id, item["sha"]),
                "sha": item["sha"],
                "org_id": org_id,
                "repo_id": repo_id,
                "message": (commit.get("message") or "")[:600],
                "author_name": author.get("name") or (item.get("author") or {}).get("login") or "",
                "committed_at": author.get("date") or "",
                "url": item.get("html_url") or "",
            }
        )
    db.write_many(
        """
        UNWIND $rows AS row
        MATCH (r:Repository {repo_id: row.repo_id, org_id: row.org_id})
        MERGE (c:Commit {commit_id: row.commit_id})
        SET c += row
        MERGE (r)-[:HAS_COMMIT]->(c)
        """,
        [{**row, "repo": repo_id, "org": org_id} for row in rows],
    )
    return rows


def _ingest_pulls(
    gh: GitHub, owner: str, name: str, repo_id: str, org_id: str, pinned: list[int]
) -> list[dict[str, Any]]:
    pulls: dict[int, dict[str, Any]] = {}
    for number in pinned:
        try:
            pulls[number] = gh.pull(owner, name, number)
        except Exception:
            continue
    try:
        for item in gh.pulls(owner, name, settings.max_prs * 5):
            if item.get("merged_at") and item["number"] not in pulls:
                pulls[item["number"]] = item
    except Exception:
        pass

    chosen = [
        item
        for item in pulls.values()
        if item.get("merged_at") and not _is_noise(item.get("title") or "")
    ]
    chosen.sort(key=lambda item: item.get("merged_at") or "", reverse=True)
    chosen = chosen[: settings.max_prs] + [pulls[n] for n in pinned if n in pulls and pulls[n] not in chosen]

    rows = []
    for item in chosen:
        rows.append(
            {
                "pr_id": p.pr_key(repo_id, item["number"]),
                "org_id": org_id,
                "repo_id": repo_id,
                "number": item["number"],
                "title": (item.get("title") or "")[:240],
                "body": (item.get("body") or "")[:4000],
                "state": item.get("state") or "closed",
                "merged_at": item.get("merged_at") or "",
                "url": item.get("html_url") or "",
                "author": (item.get("user") or {}).get("login") or "",
                "merge_commit_sha": item.get("merge_commit_sha") or "",
            }
        )
    db.write_many(
        """
        UNWIND $rows AS row
        MATCH (r:Repository {repo_id: row.repo_id, org_id: row.org_id})
        MERGE (pr:PullRequest {pr_id: row.pr_id})
        SET pr += row
        MERGE (r)-[:HAS_PULL_REQUEST]->(pr)
        """,
        [{**row, "repo": repo_id, "org": org_id} for row in rows],
    )
    return rows


def _ingest_issues(gh: GitHub, owner: str, name: str, repo_id: str, org_id: str) -> list[dict[str, Any]]:
    rows = []
    try:
        for item in gh.issues(owner, name, settings.max_issues * 2):
            if item.get("pull_request"):
                continue
            rows.append(
                {
                    "issue_id": p.issue_key(repo_id, item["number"]),
                    "org_id": org_id,
                    "repo_id": repo_id,
                    "number": item["number"],
                    "title": (item.get("title") or "")[:240],
                    "state": item.get("state") or "open",
                    "created_at": item.get("created_at") or "",
                    "url": item.get("html_url") or "",
                    "author": (item.get("user") or {}).get("login") or "",
                }
            )
            if len(rows) >= settings.max_issues:
                break
    except Exception:
        return []
    db.write_many(
        """
        UNWIND $rows AS row
        MATCH (r:Repository {repo_id: row.repo_id, org_id: row.org_id})
        MERGE (i:Issue {issue_id: row.issue_id})
        SET i += row
        MERGE (r)-[:HAS_ISSUE]->(i)
        """,
        [{**row, "repo": repo_id, "org": org_id} for row in rows],
    )
    return rows


def _ingest_decisions(
    gh: GitHub, owner: str, name: str, pulls: list[dict[str, Any]], repo_id: str, org_id: str
) -> list[dict[str, Any]]:
    candidates = []
    for pr in pulls:
        body = pr.get("body") or ""
        title = pr.get("title") or ""
        if not body or _is_noise(title):
            continue
        lowered = body.lower()
        if not any(marker in lowered for marker in MARKERS):
            continue
        rationale, kind = _rationale(body)
        if len(rationale) < 25:
            continue
        candidates.append((pr, rationale, kind))

    ingested_paths = {
        row["path"]
        for row in db.read(
            "MATCH (f:File {org_id: $org, repo_id: $repo}) RETURN f.path AS path",
            {"org": org_id, "repo": repo_id},
        )
    }
    decisions: list[dict[str, Any]] = []
    for pr, rationale, kind in candidates[:8]:
        paths: list[str] = []
        try:
            files = gh.pull_files(owner, name, pr["number"])
            paths = [f["filename"] for f in files if f.get("filename", "").endswith((".py", ".md", ".rst"))]
        except Exception:
            paths = []
        paths = [item for item in paths if item in ingested_paths and not item.startswith("tests/")]
        if not paths:
            continue
        path = next((item for item in paths if item.endswith(".py")), paths[0])
        summary = (pr.get("title") or "").strip()[:220]
        decision_id = p.decision_key(repo_id, pr.get("html_url") or "", summary)
        decisions.append(
            {
                "decision_id": decision_id,
                "org_id": org_id,
                "repo_id": repo_id,
                "summary": summary,
                "rationale": rationale,
                "rationale_type": kind,
                "status": "accepted",
                "confidence": 0.82 if kind == "explicit" else 0.55,
                "decided_at": pr.get("merged_at") or "",
                "evidence_url": pr.get("html_url") or "",
                "path": path,
                "commit_sha": pr.get("merge_commit_sha") or "",
                "pr_number": pr.get("number"),
                "pr_id": p.pr_key(repo_id, pr["number"]),
            }
        )

    if not decisions:
        return []

    texts = [f"{d['summary']}. {d['rationale']}" for d in decisions]
    vectors, _ = embed_texts(texts)
    for decision, vector in zip(decisions, vectors):
        decision["embedding"] = vector

    db.write_many(
        """
        UNWIND $rows AS row
        MATCH (r:Repository {repo_id: row.repo_id, org_id: row.org_id})
        MERGE (d:Decision {decision_id: row.decision_id})
        SET d += row
        MERGE (r)-[:HAS_DECISION]->(d)
        WITH d, row
        MATCH (pr:PullRequest {pr_id: row.pr_id})
        MERGE (d)-[:DISCUSSED_IN]->(pr)
        """,
        [{**d, "repo": repo_id, "org": org_id} for d in decisions],
    )

    for decision in decisions:
        if decision.get("path"):
            db.write(
                """
                MATCH (d:Decision {decision_id: $dec})
                MATCH (f:File {repo_id: $repo, org_id: $org, path: $path})
                MERGE (d)-[:AFFECTS]->(f)
                """,
                {"dec": decision["decision_id"], "repo": repo_id, "org": org_id, "path": decision["path"]},
            )
            db.write(
                """
                MATCH (d:Decision {decision_id: $dec})
                MATCH (e:CodeEntity {repo_id: $repo, org_id: $org, path: $path, kind: 'module'})
                MERGE (d)-[:AFFECTS]->(e)
                """,
                {
                    "dec": decision["decision_id"],
                    "repo": repo_id,
                    "org": org_id,
                    "path": decision["path"],
                },
            )
        if decision.get("commit_sha"):
            db.write(
                """
                MATCH (d:Decision {decision_id: $dec})
                MATCH (c:Commit {repo_id: $repo, org_id: $org, sha: $sha})
                MERGE (d)-[:INTRODUCED_BY]->(c)
                """,
                {"dec": decision["decision_id"], "repo": repo_id, "org": org_id, "sha": decision["commit_sha"]},
            )
    return decisions


def _scan_bandit(root: Path, repo_id: str, org_id: str, owner: str, name: str, sha: str) -> list[dict[str, Any]]:
    target = root / "src" if (root / "src").is_dir() else root
    with tempfile.NamedTemporaryFile(prefix="bandit_", suffix=".json", delete=False) as handle:
        report_path = Path(handle.name)
    try:
        subprocess.run(
            [sys.executable, "-m", "bandit", "-q", "-r", str(target), "-f", "json", "-o", str(report_path)],
            capture_output=True,
            timeout=180,
            check=False,
        )
        payload = json.loads(report_path.read_text(encoding="utf-8") or "{}")
    except Exception:
        return []
    finally:
        report_path.unlink(missing_ok=True)

    rows: list[dict[str, Any]] = []
    ignored_rules = {"B101", "B311"}
    for result in payload.get("results", []):
        rule = result.get("test_id") or ""
        message = result.get("issue_text") or ""
        if rule in ignored_rules:
            continue
        if rule == "B105" and "'None'" in message:
            continue
        filename = result.get("filename") or ""
        try:
            rel = p.normalize_rel(Path(filename).resolve(), root.resolve())
        except ValueError:
            continue
        line = int(result.get("line_number") or 0)
        rows.append(
            {
                "finding_id": p.finding_key(repo_id, rule, rel, line),
                "org_id": org_id,
                "repo_id": repo_id,
                "rule_id": rule,
                "severity": result.get("issue_severity") or "LOW",
                "confidence": result.get("issue_confidence") or "MEDIUM",
                "status": "open",
                "scanner": "bandit",
                "path": rel,
                "line_start": line,
                "line_end": int(result.get("line_range", [line])[-1]) if result.get("line_range") else line,
                "message": message[:500],
                "scanner_url": result.get("more_info") or "",
                "source_url": p.source_url(owner, name, sha, rel, line),
                "commit_sha": sha,
                "observed_at": _now(),
            }
        )
    if not rows:
        return rows
    db.write_many(
        """
        UNWIND $rows AS row
        MATCH (r:Repository {repo_id: row.repo_id, org_id: row.org_id})
        MERGE (f:SecurityFinding {finding_id: row.finding_id})
        SET f += row
        MERGE (r)-[:HAS_FINDING]->(f)
        """,
        [{**row, "repo": repo_id, "org": org_id} for row in rows],
    )
    for row in rows:
        db.write(
            """
            MATCH (f:SecurityFinding {finding_id: $fid})
            MATCH (e:CodeEntity {repo_id: $repo, org_id: $org, path: $path})
            WHERE e.line_start <= $line AND e.line_end >= $line
            WITH f, e ORDER BY (e.line_end - e.line_start) ASC LIMIT 1
            MERGE (f)-[:LOCATED_IN]->(e)
            """,
            {
                "fid": row["finding_id"],
                "repo": repo_id,
                "org": org_id,
                "path": row["path"],
                "line": row["line_start"],
            },
        )
        db.write(
            """
            MATCH (f:SecurityFinding {finding_id: $fid})
            MATCH (file:File {repo_id: $repo, org_id: $org, path: $path})
            MERGE (f)-[:LOCATED_IN]->(file)
            """,
            {"fid": row["finding_id"], "repo": repo_id, "org": org_id, "path": row["path"]},
        )
    return rows


def ingest(
    org_id: str,
    owner: str,
    name: str,
    ref: str | None = None,
    pinned_prs: list[int] | None = None,
    scan: bool = True,
    log: Callable[[str], None] = print,
) -> dict[str, Any]:
    started = time.perf_counter()
    repo_id = p.repo_key(org_id, owner, name)
    gh = GitHub()
    pinned = pinned_prs or []
    try:
        meta = gh.repo(owner, name)
        branch = ref or meta.get("default_branch") or "main"
        head = gh.latest_sha(owner, name, branch)
        sha = head["sha"]
        _merge_repo(org_id, repo_id, owner, name, meta, sha, branch)
        log(f"repository {owner}/{name} at {sha[:10]} ({branch})")

        dest = settings.ingest_dir / repo_id / sha[:12]
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
        root = gh.download_zipball(owner, name, sha, dest)
        log(f"downloaded into {root}")

        files, skipped = _select_files(root)
        file_rows: list[dict[str, Any]] = []
        entity_rows: list[dict[str, Any]] = []
        chunk_rows: list[dict[str, Any]] = []
        for path, rel, language in files:
            text = _read_text(path)
            if not text.strip():
                skipped.append(f"{rel} (empty)")
                continue
            file_id = p.file_key(repo_id, rel)
            file_rows.append(
                {
                    "file_id": file_id,
                    "org_id": org_id,
                    "repo_id": repo_id,
                    "path": rel,
                    "language": language,
                    "blob_sha": __import__("hashlib").sha1(text.encode()).hexdigest(),
                    "size_bytes": len(text.encode()),
                    "source_url": p.source_url(owner, name, sha, rel),
                    "commit_sha": sha,
                    "indexed_at": _now(),
                }
            )
            if language == "python":
                try:
                    parsed = p.parse_python(rel, text, org_id, repo_id, sha, owner, name)
                    entity_rows.extend(parsed.entities)
                except SyntaxError:
                    skipped.append(f"{rel} (python parse error)")
            for chunk in p.chunk_file(rel, text, language, org_id, repo_id, sha, owner, name):
                chunk_rows.append(chunk.__dict__)
            if len(chunk_rows) > 900:
                break

        _write_files(file_rows, repo_id, org_id)
        _write_entities(entity_rows)
        _write_chunks(chunk_rows)
        log(f"wrote {len(file_rows)} files, {len(entity_rows)} entities, {len(chunk_rows)} chunks")

        module_map: dict[str, str] = {}
        local_names: dict[tuple[str, str], str] = {}
        for row in entity_rows:
            if row["kind"] == "module":
                module_map[row["qualified_name"]] = row["entity_id"]
            local_names[(row["module"], row["name"])] = row["entity_id"]

        calls: list[dict[str, str]] = []
        for row in entity_rows:
            for callee in row.get("calls", [])[:8]:
                target_id = local_names.get((row["module"], callee))
                if target_id and target_id != row["entity_id"]:
                    calls.append({"src": row["entity_id"], "dst": target_id})
        imports: list[dict[str, str]] = []
        for row in entity_rows:
            if row["kind"] != "module":
                continue
            for imported in row.get("imports", [])[:8]:
                target_id = module_map.get(imported)
                if not target_id:
                    target_id = next(
                        (eid for qn, eid in module_map.items() if qn.startswith(imported + ".")),
                        None,
                    )
                if target_id and target_id != row["entity_id"]:
                    imports.append({"src": row["entity_id"], "dst": target_id})
        _write_relations(calls, "CALLS")
        _write_relations(imports, "IMPORTS")
        log(f"wrote {len(calls)} CALLS and {len(imports)} IMPORTS edges")

        chunks_with_vectors = [dict(c) for c in chunk_rows]
        backend = _embed_chunks(chunks_with_vectors)
        log(f"embedded {len(chunks_with_vectors)} chunks with {backend}")

        commits = _ingest_commits(gh, owner, name, sha, repo_id, org_id)
        pulls = _ingest_pulls(gh, owner, name, repo_id, org_id, pinned)
        issues = _ingest_issues(gh, owner, name, repo_id, org_id)
        decisions = _ingest_decisions(gh, owner, name, pulls, repo_id, org_id)
        findings = _scan_bandit(root, repo_id, org_id, owner, name, sha) if scan else []
        log(f"history: {len(commits)} commits, {len(pulls)} PRs, {len(issues)} issues, {len(decisions)} decisions, {len(findings)} findings")

        db.write(
            """
            MATCH (r:Repository {repo_id: $repo, org_id: $org})
            SET r.sync_status = 'ready',
                r.last_synced_at = $now,
                r.files_indexed = $files,
                r.entities_indexed = $entities,
                r.chunks_indexed = $chunks,
                r.decisions_indexed = $decisions,
                r.findings_indexed = $findings,
                r.skipped_json = $skipped,
                r.error_text = null,
                r.embedding_backend = $backend
            """,
            {
                "repo": repo_id,
                "org": org_id,
                "now": _now(),
                "files": len(file_rows),
                "entities": len(entity_rows),
                "chunks": len(chunks_with_vectors),
                "decisions": len(decisions),
                "findings": len(findings),
                "skipped": json.dumps(skipped[:40]),
                "backend": backend,
            },
        )
        return {
            "repo_id": repo_id,
            "owner": owner,
            "name": name,
            "sha": sha,
            "branch": branch,
            "files": len(file_rows),
            "entities": len(entity_rows),
            "chunks": len(chunk_rows),
            "commits": len(commits),
            "pulls": len(pulls),
            "issues": len(issues),
            "decisions": len(decisions),
            "findings": len(findings),
            "calls_edges": len(calls),
            "imports_edges": len(imports),
            "embedding_backend": backend,
            "skipped": skipped[:40],
            "duration_seconds": round(time.perf_counter() - started, 1),
        }
    except Exception as exc:
        db.write(
            """
            MATCH (r:Repository {repo_id: $repo, org_id: $org})
            SET r.sync_status = 'failed', r.error_text = $error
            """,
            {"repo": repo_id, "org": org_id, "error": str(exc)[:500]},
        )
        raise
    finally:
        gh.close()
