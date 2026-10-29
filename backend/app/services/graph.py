from __future__ import annotations

from typing import Any

from .. import db


def _node(node_id: str, kind: str, title: str, subtitle: str | None = None, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": node_id,
        "kind": kind,
        "label": kind,
        "title": title,
        "subtitle": subtitle,
        "meta": meta or {},
    }


def _edge(source: str, target: str, label: str) -> dict[str, Any]:
    return {"id": f"{source}->{target}:{label}", "source": source, "target": target, "label": label}


def graph_slice(org_id: str, repo_id: str, focus: str | None = None, limit: int = 60) -> dict[str, Any]:
    repo_row = db.read_one(
        """
        MATCH (o:Organization {org_id: $org})-[:OWNS]->(r:Repository {repo_id: $repo})
        RETURN r {.*} AS r
        """,
        {"org": org_id, "repo": repo_id},
    )
    if not repo_row:
        return {"nodes": [], "edges": [], "truncated": False, "focus": focus}
    repo = repo_row["r"]
    repo_node_id = f"repo:{repo_id}"

    file_rows = db.read(
        """
        MATCH (r:Repository {repo_id: $repo, org_id: $org})-[:CONTAINS]->(f:File)
        OPTIONAL MATCH (d:Decision {org_id: $org, repo_id: $repo})-[:AFFECTS]->(f)
        OPTIONAL MATCH (x:SecurityFinding {org_id: $org, repo_id: $repo})-[:LOCATED_IN]->(f)
        WITH f, count(DISTINCT d) AS decisions, count(DISTINCT x) AS findings
        RETURN f {.*} AS f
        ORDER BY decisions * 3 + findings DESC,
                 CASE WHEN f.language = 'python' THEN 0 ELSE 1 END,
                 f.path
        LIMIT 10
        """,
        {"org": org_id, "repo": repo_id},
    )
    files = [row["f"] for row in file_rows]
    file_ids = [f["file_id"] for f in files]
    paths = [f["path"] for f in files]

    entity_rows = db.read(
        """
        MATCH (f:File {repo_id: $repo, org_id: $org})-[:DEFINES]->(e:CodeEntity)
        WHERE f.file_id IN $files AND e.kind <> 'module'
        RETURN e {.*} AS e
        ORDER BY CASE e.kind WHEN 'class' THEN 1 ELSE 2 END, e.line_start
        LIMIT 34
        """,
        {"org": org_id, "repo": repo_id, "files": file_ids},
    )
    entities = [row["e"] for row in entity_rows]
    entity_ids = [e["entity_id"] for e in entities]
    if focus and focus in entity_ids:
        entities.sort(key=lambda e: 0 if e["entity_id"] == focus else 1)

    decision_rows = db.read(
        """
        MATCH (d:Decision {repo_id: $repo, org_id: $org})-[:AFFECTS]->(target)
        WHERE target.path IN $paths
        OPTIONAL MATCH (d)-[:DISCUSSED_IN]->(pr:PullRequest)
        RETURN d {.*} AS d, pr {.*} AS pr
        ORDER BY d.decided_at DESC
        LIMIT 6
        """,
        {"org": org_id, "repo": repo_id, "paths": paths},
    )
    decision_nodes = []
    pr_nodes = {}
    for row in decision_rows:
        d = row["d"]
        decision_nodes.append(d)
        if row.get("pr"):
            pr_nodes[row["pr"]["pr_id"]] = row["pr"]

    finding_rows = db.read(
        """
        MATCH (f:SecurityFinding {repo_id: $repo, org_id: $org})
        WHERE f.path IN $paths
        RETURN f {.*} AS f
        ORDER BY CASE f.severity WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC
        LIMIT 6
        """,
        {"org": org_id, "repo": repo_id, "paths": paths},
    )
    findings = [row["f"] for row in finding_rows]

    call_rows = db.read(
        """
        MATCH (a:CodeEntity)-[c:CALLS]->(b:CodeEntity)
        WHERE a.entity_id IN $ids AND b.entity_id IN $ids
        RETURN a.entity_id AS src, b.entity_id AS dst
        LIMIT 24
        """,
        {"ids": entity_ids},
    )

    nodes: list[dict[str, Any]] = [
        _node(
            repo_node_id,
            "repository",
            repo.get("name") or repo_id,
            f"{repo.get('owner')} \u00b7 {str(repo.get('indexed_sha') or '')[:8]}",
            {
                "full_name": repo.get("full_name"),
                "url": repo.get("url"),
                "indexed_sha": repo.get("indexed_sha"),
                "sync_status": repo.get("sync_status"),
            },
        )
    ]
    edges: list[dict[str, Any]] = []
    for f in files:
        nodes.append(
            _node(
                f"file:{f['file_id']}",
                "file",
                f["path"],
                f.get("language"),
                {"path": f["path"], "url": f.get("source_url"), "file_id": f["file_id"]},
            )
        )
        edges.append(_edge(repo_node_id, f"file:{f['file_id']}", "CONTAINS"))
    for e in entities:
        nodes.append(
            _node(
                f"entity:{e['entity_id']}",
                "entity",
                e.get("name") or e.get("qualified_name"),
                f"{e.get('kind')} \u00b7 {e.get('path')}:{e.get('line_start')}",
                {
                    "qualified_name": e.get("qualified_name"),
                    "path": e.get("path"),
                    "line_start": e.get("line_start"),
                    "line_end": e.get("line_end"),
                    "url": e.get("source_url"),
                    "entity_id": e["entity_id"],
                },
            )
        )
        edges.append(_edge(f"file:{e['file_id']}", f"entity:{e['entity_id']}", "DEFINES"))
    for row in call_rows:
        edges.append(_edge(f"entity:{row['src']}", f"entity:{row['dst']}", "CALLS"))
    for d in decision_nodes:
        decision_id = d["decision_id"]
        nodes.append(
            _node(
                f"decision:{decision_id}",
                "decision",
                (d.get("summary") or "Decision")[:80],
                f"{d.get('rationale_type')} \u00b7 {str(d.get('decided_at') or '')[:10]}",
                {
                    "rationale": d.get("rationale"),
                    "evidence_url": d.get("evidence_url"),
                    "confidence": d.get("confidence"),
                    "decision_id": decision_id,
                    "path": d.get("path"),
                },
            )
        )
        if d.get("path") and d["path"] in paths:
            file_row = next((f for f in files if f["path"] == d["path"]), None)
            if file_row:
                edges.append(_edge(f"decision:{decision_id}", f"file:{file_row['file_id']}", "AFFECTS"))
    for pr in pr_nodes.values():
        pr_id = pr["pr_id"]
        nodes.append(
            _node(
                f"pr:{pr_id}",
                "pull_request",
                f"#{pr.get('number')} {pr.get('title')}"[:90],
                str(pr.get("merged_at") or "")[:10],
                {"url": pr.get("url"), "pr_id": pr_id, "number": pr.get("number")},
            )
        )
        for d in decision_nodes:
            if d.get("pr_id") == pr_id or d.get("evidence_url") == pr.get("url"):
                edges.append(_edge(f"decision:{d['decision_id']}", f"pr:{pr_id}", "DISCUSSED_IN"))
    for f in findings:
        finding_id = f["finding_id"]
        nodes.append(
            _node(
                f"finding:{finding_id}",
                "finding",
                f"{f.get('rule_id')} \u00b7 {f.get('severity')}",
                f"{f.get('path')}:{f.get('line_start')}",
                {
                    "message": f.get("message"),
                    "severity": f.get("severity"),
                    "url": f.get("source_url"),
                    "finding_id": finding_id,
                    "path": f.get("path"),
                    "line_start": f.get("line_start"),
                },
            )
        )
        file_row = next((x for x in files if x["path"] == f.get("path")), None)
        if file_row:
            edges.append(_edge(f"finding:{finding_id}", f"file:{file_row['file_id']}", "LOCATED_IN"))

    seen_edges = set()
    unique_edges = []
    for edge in edges:
        if edge["id"] in seen_edges:
            continue
        seen_edges.add(edge["id"])
        unique_edges.append(edge)

    truncated = len(nodes) > limit
    nodes = nodes[:limit]
    allowed = {n["id"] for n in nodes}
    unique_edges = [e for e in unique_edges if e["source"] in allowed and e["target"] in allowed]
    return {"nodes": nodes, "edges": unique_edges, "truncated": truncated, "focus": focus}


def timeline(org_id: str, repo_id: str, limit: int = 20) -> list[dict[str, Any]]:
    commits = db.read(
        """
        MATCH (c:Commit {org_id: $org, repo_id: $repo})
        RETURN 'commit' AS kind, c.committed_at AS at, c.message AS title, c.url AS url
        ORDER BY c.committed_at DESC LIMIT $limit
        """,
        {"org": org_id, "repo": repo_id, "limit": limit},
    )
    decisions = db.read(
        """
        MATCH (d:Decision {org_id: $org, repo_id: $repo})
        RETURN 'decision' AS kind, d.decided_at AS at, d.summary AS title, d.evidence_url AS url
        ORDER BY d.decided_at DESC LIMIT $limit
        """,
        {"org": org_id, "repo": repo_id, "limit": limit},
    )
    items = commits + decisions
    items.sort(key=lambda item: item.get("at") or "", reverse=True)
    return items[:limit]
