from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from .. import db
from ..ingest.parser import repo_key
from ..retrieval import decisions_for_repo, findings_for_repo, search_code
from . import handover

TOOLS = ("search_code", "get_decisions", "get_findings", "handover_section")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _task_id() -> str:
    return f"task_{uuid.uuid4().hex[:12]}"


def _run_id() -> str:
    return f"run_{uuid.uuid4().hex[:12]}"


def create_task(org_id: str, repo_id: str, actor_id: str, title: str, goal: str) -> dict[str, Any]:
    task_id = _task_id()
    db.write(
        """
        MATCH (r:Repository {repo_id: $repo, org_id: $org})
        MERGE (t:Task {task_id: $task})
        SET t.org_id = $org, t.repo_id = $repo, t.title = $title, t.goal = $goal,
            t.status = 'open', t.current_step = 'created', t.summary = $goal,
            t.owner_id = $actor, t.created_at = $now, t.updated_at = $now
        MERGE (t)-[:WORKS_ON]->(r)
        """,
        {
            "repo": repo_id,
            "org": org_id,
            "task": task_id,
            "title": title[:240],
            "goal": goal[:1000],
            "actor": actor_id,
            "now": _now(),
        },
    )
    return get_task(org_id, repo_id, task_id) or {}


def get_task(org_id: str, repo_id: str, task_id: str) -> dict[str, Any] | None:
    row = db.read_one(
        """
        MATCH (t:Task {task_id: $task, org_id: $org, repo_id: $repo})
        OPTIONAL MATCH (t)-[:HAS_RUN]->(r:AgentRun)
        RETURN t {.*} AS task, collect(r {.*}) AS runs
        """,
        {"task": task_id, "org": org_id, "repo": repo_id},
    )
    if not row:
        return None
    return {"task": row["task"], "runs": [r for r in row["runs"] if r]}


def list_tasks(org_id: str, repo_id: str) -> list[dict[str, Any]]:
    rows = db.read(
        """
        MATCH (t:Task {org_id: $org, repo_id: $repo})
        OPTIONAL MATCH (t)-[:HAS_RUN]->(r:AgentRun)
        RETURN t {.*} AS task, count(r) AS run_count
        ORDER BY task.created_at DESC LIMIT 20
        """,
        {"org": org_id, "repo": repo_id},
    )
    return [{"task": r["task"], "run_count": r["run_count"]} for r in rows]


def create_run(org_id: str, repo_id: str, task_id: str) -> dict[str, Any]:
    repo = db.read_one(
        "MATCH (r:Repository {repo_id: $repo, org_id: $org}) RETURN r.indexed_sha AS sha",
        {"repo": repo_id, "org": org_id},
    )
    task = get_task(org_id, repo_id, task_id)
    if not repo or not task:
        raise ValueError("task or repository not found")
    run_id = _run_id()
    db.write(
        """
        MATCH (t:Task {task_id: $task, org_id: $org, repo_id: $repo})
        MERGE (r:AgentRun {run_id: $run})
        SET r.org_id = $org, r.repo_id = $repo, r.task_id = $task,
            r.status = 'running', r.current_step = 'plan', r.summary = $summary,
            r.seen_sha = $sha, r.steps_json = '[]', r.source_refs_json = '[]',
            r.started_at = $now, r.updated_at = $now, r.resume_count = 0
        MERGE (t)-[:HAS_RUN]->(r)
        """,
        {
            "task": task_id,
            "org": org_id,
            "repo": repo_id,
            "run": run_id,
            "summary": f"Run started for: {task['task'].get('goal') or task['task'].get('title')}",
            "sha": repo["sha"],
            "now": _now(),
        },
    )
    return get_run(org_id, repo_id, run_id) or {}


def get_run(org_id: str, repo_id: str, run_id: str) -> dict[str, Any] | None:
    row = db.read_one(
        """
        MATCH (r:AgentRun {run_id: $run, org_id: $org, repo_id: $repo})
        OPTIONAL MATCH (t:Task {task_id: r.task_id})
        OPTIONAL MATCH (r)-[:USES_CONTEXT]->(ctx)
        RETURN r {.*} AS run, t {.*} AS task,
               collect(DISTINCT ctx {.*, _labels: labels(ctx)})[0..12] AS context
        """,
        {"run": run_id, "org": org_id, "repo": repo_id},
    )
    if not row:
        return None
    run = row["run"]
    run["steps"] = json.loads(run.pop("steps_json", "[]") or "[]")
    run["source_refs"] = json.loads(run.pop("source_refs_json", "[]") or "[]")
    context = []
    for item in row.get("context") or []:
        if not item:
            continue
        labels = item.pop("_labels", [])
        kind = "chunk"
        if "Decision" in labels:
            kind = "decision"
        elif "SecurityFinding" in labels:
            kind = "finding"
        elif "CodeChunk" in labels:
            kind = "chunk"
        context.append(
            {
                "kind": kind,
                "title": item.get("summary") or item.get("path") or item.get("rule_id") or "context",
                "snippet": (item.get("rationale") or item.get("content_excerpt") or item.get("message") or "")[:240],
                "node_id": item.get("decision_id") or item.get("chunk_id") or item.get("finding_id"),
            }
        )
    return {"run": run, "task": row.get("task"), "context": context}


def _tool_results(org_id: str, repo_id: str, tool: str, args: dict[str, Any]) -> list[dict[str, Any]]:
    if tool == "search_code":
        return search_code(org_id, repo_id, str(args.get("query") or ""), int(args.get("limit") or 5))
    if tool == "get_decisions":
        return decisions_for_repo(org_id, repo_id, 6)
    if tool == "get_findings":
        return findings_for_repo(org_id, repo_id)[:6]
    if tool == "handover_section":
        section = handover.section(org_id, repo_id, str(args.get("key") or "overview"))
        return [section] if section else []
    raise ValueError(f"unknown tool {tool}")


def _link_context(org_id: str, repo_id: str, run_id: str, ids: list[str]) -> None:
    ids = [i for i in ids if i]
    if not ids:
        return
    db.write(
        """
        MATCH (r:AgentRun {run_id: $run, org_id: $org, repo_id: $repo})
        UNWIND $ids AS id
        MATCH (n)
        WHERE n.org_id = $org AND n.repo_id = $repo
          AND (n.chunk_id = id OR n.decision_id = id OR n.finding_id = id OR n.entity_id = id)
        MERGE (r)-[u:USES_CONTEXT]->(n)
        SET u.at = $now
        """,
        {"run": run_id, "org": org_id, "repo": repo_id, "ids": ids, "now": _now()},
    )


def _persist_step(
    org_id: str,
    repo_id: str,
    run_id: str,
    tool: str,
    args: dict[str, Any],
    results: list[dict[str, Any]],
) -> None:
    row = db.read_one(
        "MATCH (r:AgentRun {run_id: $run}) RETURN r.steps_json AS steps, r.source_refs_json AS refs",
        {"run": run_id},
    )
    if not row:
        return
    steps = json.loads(row.get("steps") or "[]")
    refs = json.loads(row.get("refs") or "[]")
    ids = [
        item.get("node_id") or item.get("finding_id") or item.get("decision_id")
        for item in results
    ]
    ids = [i for i in ids if i]
    n = len(steps) + 1
    steps.append(
        {
            "n": n,
            "tool": tool,
            "args": {k: (v[:120] if isinstance(v, str) else v) for k, v in args.items()},
            "result_count": len(results),
            "evidence_ids": ids[:8],
            "at": _now(),
        }
    )
    refs = list(dict.fromkeys(refs + ids))[:40]
    summary = f"Step {n}: {tool} returned {len(results)} source{'s' if len(results) != 1 else ''}."
    db.write(
        """
        MATCH (r:AgentRun {run_id: $run})
        SET r.steps_json = $steps, r.source_refs_json = $refs, r.current_step = $step,
            r.summary = $summary, r.updated_at = $now, r.last_tool = $tool
        """,
        {
            "run": run_id,
            "steps": json.dumps(steps),
            "refs": json.dumps(refs),
            "step": f"step_{n}",
            "summary": summary,
            "now": _now(),
            "tool": tool,
        },
    )
    _link_context(org_id, repo_id, run_id, ids)


def step(org_id: str, repo_id: str, run_id: str, tool: str, args: dict[str, Any]) -> dict[str, Any]:
    if tool not in TOOLS:
        raise ValueError("unsupported tool")
    run = get_run(org_id, repo_id, run_id)
    if not run:
        raise ValueError("run not found")
    if run["run"].get("status") != "running":
        raise ValueError(f"run is {run['run'].get('status')}, not running")
    results = _tool_results(org_id, repo_id, tool, args)
    _persist_step(org_id, repo_id, run_id, tool, args, results)
    return {"results": results, **get_run(org_id, repo_id, run_id)}  # type: ignore[dict-item]


def interrupt(org_id: str, repo_id: str, run_id: str) -> dict[str, Any]:
    db.write(
        """
        MATCH (r:AgentRun {run_id: $run, org_id: $org, repo_id: $repo})
        SET r.status = 'interrupted', r.interrupted_at = $now, r.updated_at = $now
        """,
        {"run": run_id, "org": org_id, "repo": repo_id, "now": _now()},
    )
    return get_run(org_id, repo_id, run_id) or {}


def resume(org_id: str, repo_id: str, run_id: str) -> dict[str, Any]:
    state = get_run(org_id, repo_id, run_id)
    if not state:
        raise ValueError("run not found")
    repo = db.read_one(
        """
        MATCH (r:Repository {repo_id: $repo, org_id: $org})
        RETURN r.indexed_sha AS sha, r.owner AS owner, r.name AS name
        """,
        {"repo": repo_id, "org": org_id},
    )
    seen = state["run"].get("seen_sha")
    current = (repo or {}).get("sha")
    validation = {"seen_sha": seen, "indexed_sha": current, "moved": seen != current, "source": "indexed revision"}
    if repo and repo.get("owner") and repo.get("name"):
        try:
            from ..ingest.github import GitHub

            gh = GitHub()
            try:
                head = gh.latest_sha(repo["owner"], repo["name"])
                validation["head_sha"] = head["sha"]
                validation["source"] = "github default branch"
                validation["moved"] = head["sha"] != seen
            finally:
                gh.close()
        except Exception:
            validation["source"] = "indexed revision (GitHub unavailable)"

    status = "paused" if validation["moved"] else "running"
    db.write(
        """
        MATCH (r:AgentRun {run_id: $run, org_id: $org, repo_id: $repo})
        SET r.status = $status, r.updated_at = $now, r.resumed_at = $now,
            r.resume_count = coalesce(r.resume_count, 0) + 1,
            r.resume_note = $note
        """,
        {
            "run": run_id,
            "org": org_id,
            "repo": repo_id,
            "status": status,
            "now": _now(),
            "note": (
                "Paused: repository moved beyond the revision this run last saw."
                if validation["moved"]
                else "Resumed from persisted graph state after revalidating the revision."
            ),
        },
    )
    return {**get_run(org_id, repo_id, run_id), "validation": validation}  # type: ignore[dict-item]


class AgentState(TypedDict, total=False):
    org_id: str
    repo_id: str
    run_id: str
    tool: str
    args: dict[str, Any]
    results: list[dict[str, Any]]
    summary: str


def _choose_tool(goal: str) -> tuple[str, dict[str, Any]]:
    lowered = (goal or "").lower()
    if any(w in lowered for w in ("security", "finding", "vulnerab", "risk")):
        return "get_findings", {}
    if any(w in lowered for w in ("why", "decision", "rationale", "history")):
        return "get_decisions", {}
    if any(w in lowered for w in ("setup", "onboard", "handover", "architecture")):
        return "handover_section", {"key": "overview"}
    return "search_code", {"query": goal or "entry points", "limit": 5}


def _build_graph():
    def load(state: AgentState) -> AgentState:
        run = get_run(state["org_id"], state["repo_id"], state["run_id"])
        if not run:
            raise ValueError("run not found")
        goal = (run.get("task") or {}).get("goal") or (run.get("task") or {}).get("title") or ""
        tool, args = _choose_tool(goal)
        return {**state, "tool": tool, "args": args, "summary": goal}

    def act(state: AgentState) -> AgentState:
        results = _tool_results(state["org_id"], state["repo_id"], state["tool"], state["args"])
        return {**state, "results": results}

    def record(state: AgentState) -> AgentState:
        _persist_step(
            state["org_id"],
            state["repo_id"],
            state["run_id"],
            state["tool"],
            state["args"],
            state.get("results") or [],
        )
        return state

    graph = StateGraph(AgentState)
    graph.add_node("load_state", load)
    graph.add_node("call_tool", act)
    graph.add_node("persist_state", record)
    graph.set_entry_point("load_state")
    graph.add_edge("load_state", "call_tool")
    graph.add_edge("call_tool", "persist_state")
    graph.add_edge("persist_state", END)
    return graph.compile()


_compiled = None


def auto_step(org_id: str, repo_id: str, run_id: str) -> dict[str, Any]:
    global _compiled
    if _compiled is None:
        _compiled = _build_graph()
    run = get_run(org_id, repo_id, run_id)
    if not run:
        raise ValueError("run not found")
    if run["run"].get("status") != "running":
        raise ValueError(f"run is {run['run'].get('status')}, not running")
    state = _compiled.invoke({"org_id": org_id, "repo_id": repo_id, "run_id": run_id})
    return {
        "tool": state.get("tool"),
        "results": state.get("results") or [],
        **get_run(org_id, repo_id, run_id),  # type: ignore[dict-item]
    }
