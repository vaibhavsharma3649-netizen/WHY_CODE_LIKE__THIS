from __future__ import annotations

import re
import time
from typing import Any

from . import db
from .embeddings import embed_query

STOPWORDS = {
    "the", "this", "that", "where", "what", "why", "how", "is", "are", "was", "were",
    "implemented", "implementation", "code", "does", "do", "for", "and", "with", "from",
    "into", "about", "which", "when", "there", "here", "please", "explain", "tell",
    "used", "use", "required", "check", "function", "class", "file", "method",
}

IDENT_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]{2,}")
WORD_RE = re.compile(r"[A-Za-z0-9_]{3,}")


def classify(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ("why", "reason", "rationale", "decision", "chose", "chosen", "because")):
        return "why"
    if any(w in q for w in ("security", "vulnerab", "finding", "scan", "cve", "exploit", "risk")):
        return "security"
    if any(w in q for w in ("handover", "onboarding", "new developer", "setup", "getting started")):
        return "handover"
    if any(w in q for w in ("where", "which file", "locate", "defined", "implemented")):
        return "locate"
    return "understand"


def _fulltext_query(question: str) -> str | None:
    tokens = []
    for raw in WORD_RE.findall(question.lower()):
        if raw in STOPWORDS or raw in tokens:
            continue
        tokens.append(raw)
    if not tokens:
        return None
    return " OR ".join(f'"{t}"' for t in tokens[:12])


def _identifiers(question: str) -> list[str]:
    out: list[str] = []
    for raw in IDENT_RE.findall(question):
        if raw.lower() in STOPWORDS or raw in out:
            continue
        out.append(raw)
    return out[:8]


def _rrf(*ranked_lists: list[tuple[str, float]], k: int = 60) -> dict[str, float]:
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        for rank, (item_id, _) in enumerate(ranked, start=1):
            scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (k + rank)
    return scores


def _entity_rows(org: str, repo: str, question: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    ids = _identifiers(question)
    exact: list[dict[str, Any]] = []
    if ids:
        exact = db.read(
            """
            MATCH (e:CodeEntity {org_id: $org, repo_id: $repo})
            WHERE any(k IN $ids WHERE toLower(e.name) = toLower(k)
                      OR toLower(e.qualified_name) ENDS WITH toLower(k))
            RETURN e {.*} AS e
            LIMIT 10
            """,
            {"org": org, "repo": repo, "ids": ids},
        )
    ft: list[dict[str, Any]] = []
    q = _fulltext_query(question)
    if q:
        try:
            ft = db.read(
                """
                CALL db.index.fulltext.queryNodes('entity_text', $q) YIELD node, score
                WHERE node.org_id = $org AND node.repo_id = $repo
                RETURN node {.*} AS e, score
                LIMIT 12
                """,
                {"org": org, "repo": repo, "q": q},
            )
        except Exception:
            ft = []
    return exact, ft


def _chunk_candidates(org: str, repo: str, question: str) -> dict[str, dict[str, Any]]:
    collected: dict[str, dict[str, Any]] = {}
    lexical: list[tuple[str, float]] = []
    q = _fulltext_query(question)
    if q:
        try:
            rows = db.read(
                """
                CALL db.index.fulltext.queryNodes('chunk_text', $q) YIELD node, score
                WHERE node.org_id = $org AND node.repo_id = $repo
                RETURN node {.*} AS c, score
                LIMIT 16
                """,
                {"org": org, "repo": repo, "q": q},
            )
        except Exception:
            rows = []
        for row in rows:
            c = row["c"]
            c["_lexical"] = True
            c["_lex_score"] = row["score"]
            collected[c["chunk_id"]] = c
            lexical.append((c["chunk_id"], row["score"]))
    vector: list[tuple[str, float]] = []
    try:
        vec, _ = embed_query(question)
        rows = db.read(
            """
            CALL db.index.vector.queryNodes('chunk_vec', $k, $vec) YIELD node, score
            WHERE node.org_id = $org AND node.repo_id = $repo
            RETURN node {.*} AS c, score
            LIMIT 16
            """,
            {"org": org, "repo": repo, "vec": vec, "k": 40},
        )
    except Exception:
        rows = []
    for row in rows:
        c = row["c"]
        c["_vector"] = True
        c["_vec_score"] = row["score"]
        existing = collected.get(c["chunk_id"])
        if existing:
            existing["_vector"] = True
            existing["_vec_score"] = row["score"]
        else:
            collected[c["chunk_id"]] = c
        vector.append((c["chunk_id"], row["score"]))

    fused = _rrf(lexical, vector)
    for chunk_id, score in fused.items():
        if chunk_id in collected:
            collected[chunk_id]["_rrf"] = score
    ordered = sorted(collected.values(), key=lambda c: c.get("_rrf", 0.0), reverse=True)
    return {c["chunk_id"]: c for c in ordered[:12]}


def _entity_code(org: str, repo: str, entity: dict[str, Any]) -> dict[str, str] | None:
    path = entity.get("path")
    if not path:
        return None
    row = db.read_one(
        """
        MATCH (c:CodeChunk {org_id: $org, repo_id: $repo, path: $path})
        WHERE c.line_end >= coalesce($start, c.line_start)
          AND c.line_start <= coalesce($end, c.line_end)
        RETURN c.content_excerpt AS code, c.language AS language
        ORDER BY abs(c.line_start - coalesce($start, c.line_start))
        LIMIT 1
        """,
        {
            "org": org,
            "repo": repo,
            "path": path,
            "start": entity.get("line_start"),
            "end": entity.get("line_end"),
        },
    )
    if not row or not row.get("code"):
        return None
    return {"code": str(row["code"])[:6000], "language": row.get("language") or "text"}


def _evidence_from_entity(org: str, repo: str, e: dict[str, Any], score: float, label: str = "fact") -> dict[str, Any]:
    doc = (e.get("docstring") or "").strip().replace("\n", " ")
    snippet = doc[:280] if doc else f"{e.get('kind')} `{e.get('qualified_name')}`"
    code = _entity_code(org, repo, e)
    return {
        "kind": "code",
        "title": e.get("qualified_name") or e.get("name"),
        "symbol": e.get("name"),
        "snippet": snippet,
        "url": e.get("source_url"),
        "path": e.get("path"),
        "line_start": e.get("line_start"),
        "line_end": e.get("line_end"),
        "commit_sha": e.get("commit_sha"),
        "node_id": e.get("entity_id"),
        "label": label,
        "score": round(score, 4),
        **({"code": code["code"], "language": code["language"]} if code else {}),
    }


def _focused_chunks(
    org: str, repo: str, path: str, line: int | None, limit: int = 3
) -> list[dict[str, Any]]:
    rows = db.read(
        """
        MATCH (c:CodeChunk {org_id: $org, repo_id: $repo, path: $path})
        WHERE $line IS NULL OR (c.line_end >= $line - 18 AND c.line_start <= $line + 18)
        RETURN c {.*} AS c
        ORDER BY abs(c.line_start - coalesce($line, c.line_start)), c.line_start
        LIMIT $limit
        """,
        {"org": org, "repo": repo, "path": path, "line": line, "limit": limit},
    )
    return [row["c"] for row in rows]


def _decision_evidence(row: dict[str, Any], score: float = 0.0) -> dict[str, Any]:
    d = row["d"]
    pr = row.get("pr")
    commit = row.get("commit")
    parts = []
    if d.get("rationale"):
        parts.append(d["rationale"].strip())
    label = "explicit" if d.get("rationale_type") == "explicit" else "inference"
    if pr:
        parts.append(f"Discussed in PR #{pr.get('number')} \u2014 {pr.get('title')}.")
    if commit:
        parts.append(f"Introduced by commit {commit.get('sha', '')[:8]} {commit.get('message', '')[:90]}.")
    return {
        "kind": "decision",
        "title": d.get("summary") or d.get("decision_id"),
        "snippet": " ".join(parts)[:600],
        "url": d.get("evidence_url") or (pr or {}).get("url"),
        "path": d.get("path"),
        "line_start": d.get("line_start"),
        "line_end": d.get("line_end"),
        "commit_sha": (commit or {}).get("sha") or d.get("commit_sha"),
        "node_id": d.get("decision_id"),
        "label": label,
        "status": d.get("status", "accepted"),
        "confidence": float(d.get("confidence") or 0.5),
        "score": round(score, 4),
    }


def _graph_expansion(org: str, repo: str, entity_ids: list[str], paths: list[str], mode: str, question: str) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    decision_scores: dict[str, tuple[dict[str, Any], float]] = {}
    if paths:
        path_rows = db.read(
            """
            MATCH (d:Decision {org_id: $org, repo_id: $repo})-[:AFFECTS]->(target)
            WHERE target.path IN $paths
            OPTIONAL MATCH (d)-[:DISCUSSED_IN]->(pr:PullRequest)
            OPTIONAL MATCH (d)-[:INTRODUCED_BY]->(cm:Commit)
            RETURN d {.*} AS d, pr {.*} AS pr, cm {.*} AS commit
            LIMIT 8
            """,
            {"org": org, "repo": repo, "paths": paths},
        )
        for row in path_rows:
            decision_scores[row["d"]["decision_id"]] = (
                row,
                1.2 if mode == "why" else 0.6,
            )
    term_rows: list[dict[str, Any]] = []
    q = _fulltext_query(question)
    if q:
        try:
            term_rows = db.read(
                """
                CALL db.index.fulltext.queryNodes('decision_text', $q) YIELD node, score
                WHERE node.org_id = $org AND node.repo_id = $repo
                OPTIONAL MATCH (node)-[:DISCUSSED_IN]->(pr:PullRequest)
                OPTIONAL MATCH (node)-[:INTRODUCED_BY]->(cm:Commit)
                RETURN node {.*} AS d, pr {.*} AS pr, cm {.*} AS commit
                LIMIT 5
                """,
                {"org": org, "repo": repo, "q": q},
            )
        except Exception:
            term_rows = []
    for row in term_rows:
        did = row["d"]["decision_id"]
        score = 0.9 if mode == "why" else 0.45
        if did not in decision_scores or decision_scores[did][1] < score:
            decision_scores[did] = (row, score)
    for row, score in decision_scores.values():
        evidence.append(_decision_evidence(row, score))

    if entity_ids:
        finding_rows = db.read(
            """
            MATCH (f:SecurityFinding {org_id: $org, repo_id: $repo})-[:LOCATED_IN]->(e:CodeEntity)
            WHERE e.entity_id IN $ids
            OPTIONAL MATCH (f)-[:LOCATED_IN]->(target)
            RETURN f {.*} AS f, target {.*} AS target
            LIMIT 6
            """,
            {"org": org, "repo": repo, "ids": entity_ids},
        )
        for row in finding_rows:
            f = row["f"]
            target = row.get("target") or {}
            evidence.append(
                {
                    "kind": "finding",
                    "title": f"{f.get('rule_id')} \u00b7 {f.get('severity')}",
                    "snippet": f.get("message") or "",
                    "url": f.get("source_url"),
                    "path": f.get("path") or target.get("path"),
                    "line_start": f.get("line_start"),
                    "line_end": f.get("line_end"),
                    "commit_sha": f.get("commit_sha"),
                    "node_id": f.get("finding_id"),
                    "label": "scanner finding \u2014 unverified",
                    "severity": f.get("severity"),
                    "score": 1.4 if mode == "security" else 0.5,
                }
            )

        neighbour_rows = db.read(
            """
            UNWIND $ids AS eid
            MATCH (e:CodeEntity {entity_id: eid, org_id: $org, repo_id: $repo})
            MATCH (e)-[:CALLS|IMPORTS]->(n:CodeEntity)
            WHERE n.org_id = $org AND n.repo_id = $repo
            RETURN DISTINCT n {.*} AS e
            LIMIT 6
            """,
            {"org": org, "repo": repo, "ids": entity_ids},
        )
        for row in neighbour_rows:
            evidence.append(_evidence_from_entity(org, repo, row["e"], 0.35))

    return evidence


def retrieve(
    org_id: str,
    repo_id: str,
    question: str,
    mode: str = "auto",
    limit: int = 8,
    focus: dict[str, Any] | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    resolved_mode = classify(question) if mode == "auto" else mode
    exact, ft = _entity_rows(org_id, repo_id, question)

    identifiers = {item.lower() for item in _identifiers(question)}
    entity_scores = _rrf(
        [(r["e"]["entity_id"], 0.0) for r in exact],
        [(r["e"]["entity_id"], r.get("score", 0.0)) for r in ft],
    )
    entities: dict[str, dict[str, Any]] = {}
    for row in exact + ft:
        e = row["e"]
        entities[e["entity_id"]] = e
    ranked_entities = sorted(
        entities.values(), key=lambda e: entity_scores.get(e["entity_id"], 0.0), reverse=True
    )[:6]

    chunks = _chunk_candidates(org_id, repo_id, question)
    top_chunks = list(chunks.values())[:6]

    evidence: list[dict[str, Any]] = []
    focus_path = (focus or {}).get("path")
    focus_line = (focus or {}).get("line_start")
    if focus_path:
        for c in _focused_chunks(org_id, repo_id, str(focus_path), focus_line):
            evidence.append(
                {
                    "kind": "code",
                    "title": c.get("path") or "focused source",
                    "snippet": (c.get("content_excerpt") or "")[:480],
                    "code": (c.get("content_excerpt") or "")[:6000],
                    "language": c.get("language") or "text",
                    "url": c.get("source_url"),
                    "path": c.get("path"),
                    "line_start": c.get("line_start"),
                    "line_end": c.get("line_end"),
                    "commit_sha": c.get("commit_sha"),
                    "node_id": c.get("chunk_id"),
                    "label": "fact",
                    "score": 1.0,
                }
            )
    for e in ranked_entities:
        evidence.append(
            _evidence_from_entity(org_id, repo_id, e, entity_scores.get(e["entity_id"], 0.1))
        )
    for c in top_chunks:
        evidence.append(
            {
                "kind": "code",
                "title": c.get("path") or "source excerpt",
                "snippet": (c.get("content_excerpt") or "")[:480],
                "code": (c.get("content_excerpt") or "")[:6000],
                "language": c.get("language") or "text",
                "url": c.get("source_url"),
                "path": c.get("path"),
                "line_start": c.get("line_start"),
                "line_end": c.get("line_end"),
                "commit_sha": c.get("commit_sha"),
                "node_id": c.get("chunk_id"),
                "label": "fact",
                "score": round(c.get("_rrf", 0.05), 4),
            }
        )

    entity_ids = [e["entity_id"] for e in ranked_entities]
    exact_paths = {row["e"].get("path") for row in exact if row["e"].get("path")}
    lexical_paths = {c.get("path") for c in top_chunks if c.get("_lexical") and c.get("path")}
    strong_paths = list(dict.fromkeys([*exact_paths, *lexical_paths]))[:10]
    evidence.extend(
        _graph_expansion(
            org_id, repo_id, entity_ids, strong_paths, resolved_mode, question
        )
    )

    seen: set[tuple[str, str, int | None]] = set()
    deduped: list[dict[str, Any]] = []
    for item in evidence:
        key = (item["kind"], item.get("path") or item.get("title", ""), item.get("line_start"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    def priority(item: dict[str, Any]) -> float:
        base = float(item.get("score") or 0.0)
        if focus_path and item.get("path") == focus_path:
            base += 3.0
        if resolved_mode == "why" and item["kind"] == "decision":
            base += 2.0
        if resolved_mode == "security" and item["kind"] == "finding":
            base += 2.0
        if resolved_mode in {"locate", "understand"} and item["kind"] == "code":
            base += 0.8
            if str(item.get("symbol", "")).lower() in identifiers:
                base += 1.2
        if item.get("label") in {"explicit", "fact", "scanner finding \u2014 unverified"}:
            base += 0.05
        return base

    deduped.sort(key=priority, reverse=True)
    if resolved_mode == "why":
        decision_paths = {
            item.get("path")
            for item in deduped
            if item["kind"] == "decision" and item.get("path")
        }
        if decision_paths:
            deduped = [
                item
                for item in deduped
                if item["kind"] == "decision" or item.get("path") in decision_paths
            ]
        else:
            deduped = [
                item
                for item in deduped
                if item["kind"] != "decision" and item.get("path") in exact_paths
            ]
        strong = set(strong_paths)
        if focus_path:
            strong.add(str(focus_path))
        focused = [
            item
            for item in deduped
            if item["kind"] in {"decision", "finding"}
            or (item["kind"] == "code" and item.get("path") in strong)
        ]
        if focused:
            deduped = focused
        limit = min(limit, 6)
    deduped = deduped[: max(limit, 4)]
    for idx, item in enumerate(deduped, start=1):
        item["id"] = f"ev{idx}"

    return {
        "mode": resolved_mode,
        "evidence": deduped,
        "entity_ids": entity_ids,
        "paths": strong_paths,
        "timings": {"retrieve": round((time.perf_counter() - started) * 1000, 1)},
    }


def search_code(org_id: str, repo_id: str, query: str, limit: int = 6) -> list[dict[str, Any]]:
    result = retrieve(org_id, repo_id, query, mode="understand", limit=limit)
    source = [
        e
        for e in result["evidence"]
        if e["kind"] == "code" and str(e.get("path") or "").endswith((".py", ".pyi"))
    ]
    return (source or [e for e in result["evidence"] if e["kind"] == "code"])[:limit]


def decisions_for_repo(org_id: str, repo_id: str, limit: int = 12) -> list[dict[str, Any]]:
    rows = db.read(
        """
        MATCH (d:Decision {org_id: $org, repo_id: $repo})
        OPTIONAL MATCH (d)-[:DISCUSSED_IN]->(pr:PullRequest)
        OPTIONAL MATCH (d)-[:INTRODUCED_BY]->(cm:Commit)
        RETURN d {.*} AS d, pr {.*} AS pr, cm {.*} AS commit
        ORDER BY d.decided_at DESC
        LIMIT $limit
        """,
        {"org": org_id, "repo": repo_id, "limit": limit},
    )
    return [_decision_evidence(row) for row in rows]


def findings_for_repo(org_id: str, repo_id: str) -> list[dict[str, Any]]:
    rows = db.read(
        """
        MATCH (f:SecurityFinding {org_id: $org, repo_id: $repo})
        OPTIONAL MATCH (f)-[:LOCATED_IN]->(e:CodeEntity)
        OPTIONAL MATCH (d:Decision {org_id: $org, repo_id: $repo})-[:AFFECTS]->(target)
        WHERE target.path = f.path
        OPTIONAL MATCH (d)-[:DISCUSSED_IN]->(pr:PullRequest)
        RETURN f {.*} AS f,
               collect(DISTINCT e {.*})[0..2] AS entities,
               collect(DISTINCT d {.*, _pr_url: pr.url})[0..3] AS decisions
        ORDER BY CASE f.severity WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC
        """,
        {"org": org_id, "repo": repo_id},
    )
    out = []
    for row in rows:
        f = row["f"]
        related = [
            {
                "decision_id": d.get("decision_id"),
                "summary": d.get("summary"),
                "rationale": (d.get("rationale") or "")[:300],
                "evidence_url": d.get("evidence_url") or d.get("_pr_url"),
                "rationale_type": d.get("rationale_type"),
            }
            for d in row.get("decisions") or []
            if d
        ]
        out.append(
            {
                "finding_id": f.get("finding_id"),
                "rule_id": f.get("rule_id"),
                "severity": f.get("severity"),
                "confidence": f.get("confidence") or "MEDIUM",
                "status": f.get("status") or "open",
                "scanner": f.get("scanner") or "bandit",
                "path": f.get("path"),
                "line_start": f.get("line_start") or 0,
                "line_end": f.get("line_end") or f.get("line_start") or 0,
                "message": f.get("message") or "",
                "url": f.get("source_url"),
                "label": "scanner finding \u2014 unverified",
                "related_decisions": related,
            }
        )
    return out


def repo_overview(org_id: str, repo_id: str) -> dict[str, Any]:
    repo = db.read_one(
        """
        MATCH (o:Organization {org_id: $org})-[:OWNS]->(r:Repository {repo_id: $repo})
        RETURN r {.*} AS r, o {.*} AS o
        """,
        {"org": org_id, "repo": repo_id},
    )
    if not repo:
        return {}
    counts = db.read_one(
        """
        MATCH (r:Repository {repo_id: $repo, org_id: $org})
        OPTIONAL MATCH (r)-[:CONTAINS]->(f:File)
        WITH r, count(DISTINCT f) AS files
        OPTIONAL MATCH (e:CodeEntity {repo_id: $repo, org_id: $org})
        WITH files, count(DISTINCT e) AS entities
        OPTIONAL MATCH (c:CodeChunk {repo_id: $repo, org_id: $org})
        WITH files, entities, count(DISTINCT c) AS chunks
        OPTIONAL MATCH (d:Decision {repo_id: $repo, org_id: $org})
        WITH files, entities, chunks, count(DISTINCT d) AS decisions
        OPTIONAL MATCH (x:SecurityFinding {repo_id: $repo, org_id: $org})
        RETURN files, entities, chunks, decisions, count(DISTINCT x) AS findings
        """,
        {"org": org_id, "repo": repo_id},
    )
    recent = db.read(
        """
        MATCH (c:Commit {org_id: $org, repo_id: $repo})
        RETURN c {.*} AS c
        ORDER BY c.committed_at DESC
        LIMIT 6
        """,
        {"org": org_id, "repo": repo_id},
    )
    return {
        "repo": repo["r"],
        "org": repo["o"],
        "counts": counts or {},
        "recent_commits": [r["c"] for r in recent],
    }
