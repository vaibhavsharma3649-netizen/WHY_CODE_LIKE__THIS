from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from .. import db
from ..retrieval import findings_for_repo, repo_overview

ENTRY_NAMES = ["Flask", "Blueprint", "cli", "run", "make_response", "FlaskGroup", "create_app"]


def _source(title: str, url: str | None = None, path: str | None = None, line: int | None = None) -> dict[str, Any]:
    return {"title": title, "url": url, "path": path, "line_start": line}


def _entry_points(org: str, repo: str) -> list[dict[str, Any]]:
    return db.read(
        """
        MATCH (e:CodeEntity {org_id: $org, repo_id: $repo})
        WHERE e.name IN $names OR e.path ENDS WITH '/__init__.py'
        RETURN e {.*} AS e
        ORDER BY CASE e.name WHEN 'Flask' THEN 1 WHEN 'Blueprint' THEN 2 ELSE 3 END
        LIMIT 8
        """,
        {"org": org, "repo": repo, "names": ENTRY_NAMES},
    )


def _setup_excerpts(org: str, repo: str) -> list[dict[str, Any]]:
    rows = db.read(
        """
        MATCH (c:CodeChunk {org_id: $org, repo_id: $repo})
        WHERE toLower(c.path) CONTAINS 'readme'
           OR toLower(c.path) CONTAINS 'install'
           OR toLower(c.path) CONTAINS 'quickstart'
           OR toLower(c.path) CONTAINS 'testing'
           OR toLower(c.path) CONTAINS 'contribut'
        RETURN c {.*} AS c
        LIMIT 80
        """,
        {"org": org, "repo": repo},
    )
    priority = {
        "docs/installation.rst": 0,
        "readme.md": 1,
        "docs/quickstart.rst": 2,
        "docs/testing.rst": 3,
        "docs/cli.rst": 4,
        "docs/tutorial/install.rst": 5,
        "docs/contributing.rst": 6,
    }
    chunks = [r["c"] for r in rows]
    chunks.sort(key=lambda c: priority.get(str(c.get("path") or "").lower(), 9))
    return chunks


def _extract_setup_lines(chunks: list[dict[str, Any]]) -> list[tuple[str, dict[str, Any]]]:
    pattern = re.compile(
        r"^(pip install|uv sync|uv run|python3? -m|flask run|pytest|poetry install|"
        r"make\s+(?:test|install|docs|build|lint)|npm\s+(?:install|run))\b",
        re.I,
    )
    found: list[tuple[str, dict[str, Any]]] = []
    seen: set[str] = set()
    for chunk in chunks:
        for line in (chunk.get("content_excerpt") or "").splitlines():
            raw = line.strip()
            if not raw.startswith(("$", ">")):
                continue
            cleaned = raw.lstrip("$> ").strip().strip("\"'").strip()
            if not pattern.match(cleaned) or len(cleaned) >= 140:
                continue
            if any(ch in cleaned for ch in "\"',[]{}="):
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            found.append((cleaned, chunk))
            if len(found) >= 5:
                return found
    return found


def build(org_id: str, repo_id: str) -> dict[str, Any]:
    overview = repo_overview(org_id, repo_id)
    repo = overview["repo"]
    org = overview["org"]
    counts = overview.get("counts") or {}
    commits = overview.get("recent_commits") or []
    entry_points = _entry_points(org_id, repo_id)
    setup = _extract_setup_lines(_setup_excerpts(org_id, repo_id))
    findings = findings_for_repo(org_id, repo_id)
    issues = db.read(
        """
        MATCH (i:Issue {org_id: $org, repo_id: $repo})
        RETURN i {.*} AS i ORDER BY i.created_at DESC LIMIT 6
        """,
        {"org": org_id, "repo": repo_id},
    )
    decisions = db.read(
        """
        MATCH (d:Decision {org_id: $org, repo_id: $repo})
        RETURN d {.*} AS d ORDER BY d.decided_at DESC LIMIT 5
        """,
        {"org": org_id, "repo": repo_id},
    )

    sections: list[dict[str, Any]] = []

    sections.append(
        {
            "key": "overview",
            "title": "Architecture overview",
            "body": (
                f"{repo.get('full_name')} is indexed at commit {str(repo.get('indexed_sha') or '')[:10]} "
                f"on branch {repo.get('default_branch')}. The graph contains {counts.get('files', 0)} files, "
                f"{counts.get('entities', 0)} code entities and {counts.get('chunks', 0)} searchable chunks. "
                f"{counts.get('decisions', 0)} decisions and {counts.get('findings', 0)} scanner findings are recorded."
            ),
            "coverage": "fact",
            "sources": [_source(repo.get("full_name") or "repository", repo.get("url"))],
        }
    )

    if entry_points:
        lines = [
            f"- `{r['e'].get('qualified_name')}` \u2014 {r['e'].get('path')}:{r['e'].get('line_start')}"
            for r in entry_points
        ]
        sections.append(
            {
                "key": "entry_points",
                "title": "Entry points",
                "body": "Likely places to start reading:\n" + "\n".join(lines),
                "coverage": "inferred",
                "sources": [
                    _source(
                        r["e"].get("qualified_name") or "symbol",
                        r["e"].get("source_url"),
                        r["e"].get("path"),
                        r["e"].get("line_start"),
                    )
                    for r in entry_points[:5]
                ],
            }
        )
    else:
        sections.append(
            {
                "key": "entry_points",
                "title": "Entry points",
                "body": "No entry-point candidates were identified from indexed symbols.",
                "coverage": "unknown",
                "sources": [],
            }
        )

    if setup:
        body = "Commands found in repository documentation:\n" + "\n".join(f"- `{line}`" for line, _ in setup)
        sources = [
            _source(chunk.get("path") or "documentation", chunk.get("source_url"), chunk.get("path"))
            for _, chunk in setup[:4]
        ]
        sections.append(
            {"key": "setup", "title": "Setup hints", "body": body, "coverage": "fact", "sources": sources}
        )
    else:
        sections.append(
            {
                "key": "setup",
                "title": "Setup hints",
                "body": "No setup instructions were found in the indexed documentation.",
                "coverage": "unknown",
                "sources": [],
            }
        )

    if commits:
        body = "Most recent commits in the indexed history:\n" + "\n".join(
            f"- {c.get('committed_at', '')[:10]} \u2014 {c.get('message', '').splitlines()[0][:120]}"
            for c in commits[:5]
        )
        sections.append(
            {
                "key": "recent_changes",
                "title": "Recent changes",
                "body": body,
                "coverage": "fact",
                "sources": [
                    _source(c.get("message", "").splitlines()[0][:80] or "commit", c.get("url"))
                    for c in commits[:4]
                ],
            }
        )
    else:
        sections.append(
            {
                "key": "recent_changes",
                "title": "Recent changes",
                "body": "No commit history was ingested.",
                "coverage": "unknown",
                "sources": [],
            }
        )

    if issues:
        body = "Open work recorded in the repository:\n" + "\n".join(
            f"- #{i['i'].get('number')} {i['i'].get('title')}" for i in issues
        )
        sections.append(
            {
                "key": "open_work",
                "title": "Open work",
                "body": body,
                "coverage": "fact",
                "sources": [_source(f"#{i['i'].get('number')}", i["i"].get("url")) for i in issues[:4]],
            }
        )
    else:
        sections.append(
            {
                "key": "open_work",
                "title": "Open work",
                "body": "No open issues were ingested; unfinished work cannot be established from this revision.",
                "coverage": "unknown",
                "sources": [],
            }
        )

    if findings:
        body = "Potential risks reported by the scanner, not verified exploitability:\n" + "\n".join(
            f"- [{f['severity']}] {f['rule_id']} at {f['path']}:{f['line_start']} \u2014 {f['message'][:110]}"
            for f in findings[:5]
        )
        sections.append(
            {
                "key": "known_risks",
                "title": "Known risks",
                "body": body,
                "coverage": "fact",
                "sources": [_source(f"{f['rule_id']} {f['path']}", f.get("url")) for f in findings[:4]],
            }
        )
    else:
        sections.append(
            {
                "key": "known_risks",
                "title": "Known risks",
                "body": "No scanner findings are stored. A clean scan is not proof that the code is safe.",
                "coverage": "unknown",
                "sources": [],
            }
        )

    unknowns: list[str] = []
    if not decisions:
        unknowns.append("No decision records could be extracted, so historical intent cannot be established.")
    if not issues:
        unknowns.append("No open issues were ingested, so outstanding work is unknown.")
    if not findings:
        unknowns.append("No scanner findings were produced; this does not prove the absence of vulnerabilities.")
    if not setup:
        unknowns.append("No setup instructions were found in indexed documentation.")
    unknowns.append("Superseded decisions are not asserted unless a source explicitly says a decision was replaced.")
    unknowns.append("Generated summaries are derived artefacts; the indexed commit remains authoritative.")

    if decisions:
        body = "Recorded decisions with source evidence:\n" + "\n".join(
            f"- {d['d'].get('summary')} ({d['d'].get('rationale_type')}, {d['d'].get('decided_at', '')[:10]})"
            for d in decisions
        )
        sections.append(
            {
                "key": "decisions",
                "title": "Recorded decisions",
                "body": body,
                "coverage": "fact",
                "sources": [_source(d["d"].get("summary") or "decision", d["d"].get("evidence_url")) for d in decisions],
            }
        )

    return {
        "repo": {**repo, "org_name": org.get("name")},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sections": sections,
        "unknowns": unknowns,
    }


def section(org_id: str, repo_id: str, key: str) -> dict[str, Any] | None:
    report = build(org_id, repo_id)
    for item in report["sections"]:
        if item["key"] == key:
            return item
    return None
