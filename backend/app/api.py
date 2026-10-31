from __future__ import annotations

import json
import re
import time
from typing import Any, Iterator

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from . import audit, db
from .config import settings
from .auth import (
    Principal,
    create_token,
    get_principal,
    repo_for,
    require_roles,
    verify_password,
)
from .ingest.pipeline import ingest
from .llm import compose_deterministic, synth_stream
from .models import (
    AskRequest,
    AskResponse,
    Citation,
    FindingOut,
    GraphResponse,
    HandoverResponse,
    LoginRequest,
    MeResponse,
    StepRequest,
    TaskCreate,
    TokenResponse,
)
from .retrieval import (
    decisions_for_repo,
    findings_for_repo,
    repo_overview,
    retrieve,
)
from .services import agent as agent_service
from .services import graph as graph_service
from .services import handover as handover_service

router = APIRouter(prefix="/api")


def _memberships(principal_row: dict[str, Any]) -> list[dict[str, Any]]:
    return db.read(
        """
        MATCH (u:User {user_id: $uid})-[m:MEMBER_OF {status: 'active'}]->(o:Organization)
        RETURN o.org_id AS org_id, o.name AS org_name, m.role AS role
        ORDER BY o.name
        """,
        {"uid": principal_row["user_id"]},
    )


@router.get("/health")
def health() -> dict[str, Any]:
    llm = {
        "enabled": settings.llm_enabled,
        "mode": settings.llm_mode,
        "model": settings.groq_model if settings.groq_key else None,
    }
    try:
        version = db.ping()
    except Exception as exc:
        return {"status": "degraded", "database": str(exc)[:200], "llm": llm}
    return {"status": "ok", "database": version, "llm": llm}


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    user = db.read_one(
        "MATCH (u:User {email: $email}) RETURN u {.*} AS u",
        {"email": body.email.strip().lower()},
    )
    if not user or not verify_password(body.password, user["u"].get("password_hash") or ""):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    row = user["u"]
    memberships = _memberships(row)
    if not memberships:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No organisation membership")
    return TokenResponse(
        token=create_token(row["user_id"]),
        user={"user_id": row["user_id"], "email": row["email"], "name": row.get("name")},
        memberships=memberships,
        active_org=memberships[0],
    )


@router.get("/me", response_model=MeResponse)
def me(principal: Principal = Depends(get_principal)) -> MeResponse:
    return MeResponse(
        user={"user_id": principal.user_id, "email": principal.email, "name": principal.name},
        memberships=principal.memberships,
        active_org={
            "org_id": principal.org_id,
            "org_name": principal.org_name,
            "role": principal.role,
        },
    )


@router.get("/repos")
def repos(principal: Principal = Depends(get_principal)) -> dict[str, Any]:
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
        "org": {"org_id": principal.org_id, "name": principal.org_name, "role": principal.role},
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
        ],
    }


@router.get("/repos/{repo_id}/overview")
def overview(repo_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    repo_for(principal, repo_id)
    data = repo_overview(principal.org_id, repo_id)
    if not data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Repository not found")
    data["timeline"] = graph_service.timeline(principal.org_id, repo_id, 8)
    return data


@router.get("/repos/{repo_id}/timeline")
def timeline(repo_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    repo_for(principal, repo_id)
    return {"items": graph_service.timeline(principal.org_id, repo_id, 20)}


@router.get("/repos/{repo_id}/decisions")
def decisions(repo_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    repo_for(principal, repo_id)
    return {"decisions": decisions_for_repo(principal.org_id, repo_id, 20)}


@router.get("/repos/{repo_id}/findings")
def findings(repo_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    repo_for(principal, repo_id)
    return {"findings": findings_for_repo(principal.org_id, repo_id)}


@router.get("/repos/{repo_id}/handover", response_model=HandoverResponse)
def handover(repo_id: str, principal: Principal = Depends(get_principal)) -> HandoverResponse:
    repo_for(principal, repo_id)
    data = handover_service.build(principal.org_id, repo_id)
    return HandoverResponse(**data)


@router.get("/repos/{repo_id}/graph", response_model=GraphResponse)
def graph(
    repo_id: str,
    focus: str | None = Query(default=None),
    principal: Principal = Depends(get_principal),
) -> GraphResponse:
    repo_for(principal, repo_id)
    return GraphResponse(**graph_service.graph_slice(principal.org_id, repo_id, focus))


@router.post("/repos/{repo_id}/refresh", status_code=202)
def refresh(
    repo_id: str,
    background: BackgroundTasks,
    principal: Principal = Depends(require_roles("admin", "maintainer")),
) -> dict[str, Any]:
    repo = repo_for(principal, repo_id)
    pinned = []
    try:
        pinned = json.loads(repo.get("pinned_prs_json") or "[]")
    except json.JSONDecodeError:
        pinned = []
    owner, name = repo.get("owner"), repo.get("name")
    if not owner or not name or repo.get("synthetic"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Repository is not refreshable")
    audit.record(principal.org_id, principal.user_id, "repository.refresh", repo_id, meta={"repo_id": repo_id})
    background.add_task(
        ingest,
        principal.org_id,
        owner,
        name,
        repo.get("default_branch"),
        pinned,
        True,
    )
    db.write(
        "MATCH (r:Repository {repo_id: $repo, org_id: $org}) SET r.sync_status = 'queued'",
        {"repo": repo_id, "org": principal.org_id},
    )
    return {"status": "queued", "repo_id": repo_id}


def _citation(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "kind": item["kind"],
        "title": item.get("title") or item["kind"],
        "snippet": item.get("snippet") or "",
        "url": item.get("url"),
        "path": item.get("path"),
        "line_start": item.get("line_start"),
        "line_end": item.get("line_end"),
        "commit_sha": item.get("commit_sha"),
        "label": item.get("label") or "fact",
        "score": item.get("score"),
        "code": item.get("code"),
        "language": item.get("language"),
    }


def _retrieval_question(question: str, history: list[Any], has_focus: bool = False) -> str:
    if not history:
        return question
    lowered = question.strip().lower()
    if has_focus and lowered.startswith(
        ("what does", "what is", "how does", "explain", "show ", "where is")
    ):
        return question
    words = re.findall(r"[A-Za-z0-9_]+", lowered)
    has_reference = any(
        token in {"it", "this", "that", "these", "those", "there", "they", "them", "same", "above"}
        for token in words
    )
    asks_about_previous = lowered.startswith(
        ("why", "how", "what about", "where", "and ", "then ", "does ", "is ", "are ", "can ")
    )
    if len(words) <= 9 or has_reference or asks_about_previous:
        previous = getattr(history[-1], "question", "") or ""
        if previous and previous.lower() not in lowered:
            return f"{previous}\nFollow-up: {question}"
    return question


def _focus(body: AskRequest) -> dict[str, Any] | None:
    if not body.focus_path:
        return None
    return {
        "path": body.focus_path,
        "line_start": body.focus_line_start,
        "line_end": body.focus_line_end,
    }


def _run_query(
    principal: Principal, body: AskRequest
) -> dict[str, Any]:
    started = time.perf_counter()
    repo = repo_for(principal, body.repo_id)
    retrieval_question = _retrieval_question(
        body.question, body.history, bool(body.focus_path)
    )
    retrieval = retrieve(
        principal.org_id, body.repo_id, retrieval_question, body.mode, focus=_focus(body)
    )
    evidence = retrieval["evidence"]
    answer, citation_ids, abstained, confidence = compose_deterministic(
        retrieval_question, retrieval["mode"], evidence, repo
    )
    engine = "deterministic"
    final: dict[str, Any] | None = None
    text = ""
    for delta, done in synth_stream(
        retrieval_question,
        retrieval["mode"],
        evidence,
        answer,
        citation_ids,
        history=body.history,
        focus=_focus(body),
    ):
        text += delta
        if done:
            final = done
    final = final or {
        "answer": answer,
        "citation_ids": citation_ids,
        "abstained": abstained,
        "engine": engine,
    }
    if final.get("engine", "").startswith("groq"):
        engine = final["engine"]
    valid = {e["id"]: e for e in evidence}
    citations = [_citation(valid[cid]) for cid in final.get("citation_ids", []) if cid in valid]
    if not citations:
        abstained = True
        if not final.get("answer"):
            final["answer"] = "Not established by the indexed repository."
    timings = {
        **retrieval.get("timings", {}),
        "total": round((time.perf_counter() - started) * 1000, 1),
    }
    audit_id = audit.record(
        principal.org_id,
        principal.user_id,
        "query.ask",
        body.repo_id,
        meta={
            "mode": retrieval["mode"],
            "result_count": len(evidence),
            "abstained": abstained,
            "engine": engine,
        },
    )
    return {
        "answer": final.get("answer") or answer,
        "citations": citations,
        "evidence": [_citation(e) for e in evidence],
        "mode": retrieval["mode"],
        "abstained": abstained,
        "confidence": confidence if engine == "deterministic" else final.get("confidence", confidence),
        "timings": timings,
        "audit_id": audit_id,
        "indexed_sha": repo.get("indexed_sha"),
        "engine": engine,
    }


@router.post("/ask", response_model=AskResponse)
def ask(body: AskRequest, principal: Principal = Depends(get_principal)) -> AskResponse:
    result = _run_query(principal, body)
    return AskResponse(**result)


def _sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, default=str)}\n\n"


@router.post("/ask/stream")
def ask_stream(body: AskRequest, principal: Principal = Depends(get_principal)) -> StreamingResponse:
    repo = repo_for(principal, body.repo_id)

    def generate() -> Iterator[str]:
        started = time.perf_counter()
        yield _sse(
            "meta",
            {
                "stage": "retrieving",
                "indexed_sha": repo.get("indexed_sha"),
                "repo": repo.get("full_name"),
            },
        )
        retrieval_question = _retrieval_question(
            body.question, body.history, bool(body.focus_path)
        )
        retrieval = retrieve(
            principal.org_id, body.repo_id, retrieval_question, body.mode, focus=_focus(body)
        )
        evidence = retrieval["evidence"]
        yield _sse(
            "evidence",
            {
                "evidence": [_citation(e) for e in evidence],
                "mode": retrieval["mode"],
                "timing_ms": retrieval["timings"].get("retrieve"),
            },
        )
        answer, ids, abstained, confidence = compose_deterministic(
            retrieval_question, retrieval["mode"], evidence, repo
        )
        final: dict[str, Any] | None = None
        for delta, done in synth_stream(
            retrieval_question,
            retrieval["mode"],
            evidence,
            answer,
            ids,
            history=body.history,
            focus=_focus(body),
        ):
            if delta:
                yield _sse("token", {"text": delta})
            if done:
                final = done
        final = final or {"answer": answer, "citation_ids": ids, "abstained": abstained, "engine": "deterministic"}
        valid = {e["id"]: e for e in evidence}
        citations = [_citation(valid[cid]) for cid in final.get("citation_ids", []) if cid in valid]
        if not citations:
            abstained = True
        engine = final.get("engine", "deterministic")
        timings = {
            **retrieval.get("timings", {}),
            "total": round((time.perf_counter() - started) * 1000, 1),
        }
        audit_id = audit.record(
            principal.org_id,
            principal.user_id,
            "query.ask",
            body.repo_id,
            meta={
                "mode": retrieval["mode"],
                "result_count": len(evidence),
                "abstained": abstained,
                "engine": engine,
            },
        )
        yield _sse(
            "done",
            {
                "answer": final.get("answer") or answer,
                "citations": citations,
                "abstained": abstained,
                "confidence": confidence if engine == "deterministic" else final.get("confidence", confidence),
                "mode": retrieval["mode"],
                "timings": timings,
                "audit_id": audit_id,
                "indexed_sha": repo.get("indexed_sha"),
                "engine": engine,
            },
        )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/org/audit")
def org_audit(
    limit: int = Query(default=40, ge=1, le=200),
    principal: Principal = Depends(require_roles("admin")),
) -> dict[str, Any]:
    return {"events": audit.recent(principal.org_id, limit)}


@router.post("/agent/tasks", status_code=201)
def create_task(body: TaskCreate, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    if principal.role == "reader":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Readers cannot create agent tasks")
    repo_for(principal, body.repo_id)
    task = agent_service.create_task(
        principal.org_id,
        body.repo_id,
        principal.user_id,
        body.title,
        body.goal,
        principal.role,
    )
    audit.record(principal.org_id, principal.user_id, "agent.task.create", body.repo_id, meta={"tool": "task"})
    return task


@router.get("/agent/tasks")
def list_tasks(repo_id: str = Query(...), principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    repo_for(principal, repo_id)
    return {"tasks": agent_service.list_tasks(principal.org_id, repo_id)}


@router.get("/agent/tasks/{task_id}")
def get_task(task_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    row = db.read_one(
        "MATCH (t:Task {task_id: $task, org_id: $org}) RETURN t.repo_id AS repo_id",
        {"task": task_id, "org": principal.org_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    repo_for(principal, row["repo_id"])
    data = agent_service.get_task(principal.org_id, row["repo_id"], task_id)
    if not data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return data


@router.post("/agent/tasks/{task_id}/runs", status_code=201)
def create_run(task_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    if principal.role == "reader":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Readers cannot run the agent")
    task_row = db.read_one(
        "MATCH (t:Task {task_id: $task, org_id: $org}) RETURN t.repo_id AS repo_id",
        {"task": task_id, "org": principal.org_id},
    )
    if not task_row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    repo_for(principal, task_row["repo_id"])
    run = agent_service.create_run(principal.org_id, task_row["repo_id"], task_id)
    audit.record(principal.org_id, principal.user_id, "agent.run.create", task_id, meta={"tool": "run"})
    return run


@router.get("/agent/runs/{run_id}")
def get_run(run_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    row = db.read_one(
        "MATCH (r:AgentRun {run_id: $run, org_id: $org}) RETURN r.repo_id AS repo_id",
        {"run": run_id, "org": principal.org_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    repo_for(principal, row["repo_id"])
    return agent_service.get_run(principal.org_id, row["repo_id"], run_id) or {}


@router.post("/agent/runs/{run_id}/step")
def agent_step(run_id: str, body: StepRequest, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    if principal.role == "reader":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Readers cannot run the agent")
    row = db.read_one(
        "MATCH (r:AgentRun {run_id: $run, org_id: $org}) RETURN r.repo_id AS repo_id",
        {"run": run_id, "org": principal.org_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    repo_for(principal, row["repo_id"])
    try:
        result = agent_service.step(principal.org_id, row["repo_id"], run_id, body.tool, body.args)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    audit.record(
        principal.org_id,
        principal.user_id,
        "agent.run.step",
        run_id,
        meta={"tool": body.tool, "result_count": len(result.get("results") or [])},
    )
    return result


@router.post("/agent/runs/{run_id}/auto")
def agent_auto(run_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    if principal.role == "reader":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Readers cannot run the agent")
    row = db.read_one(
        "MATCH (r:AgentRun {run_id: $run, org_id: $org}) RETURN r.repo_id AS repo_id",
        {"run": run_id, "org": principal.org_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    repo_for(principal, row["repo_id"])
    try:
        result = agent_service.auto_step(principal.org_id, row["repo_id"], run_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    audit.record(
        principal.org_id,
        principal.user_id,
        "agent.run.auto",
        run_id,
        meta={"tool": result.get("tool"), "result_count": len(result.get("results") or [])},
    )
    return result


@router.post("/agent/runs/{run_id}/interrupt")
def agent_interrupt(run_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    row = db.read_one(
        "MATCH (r:AgentRun {run_id: $run, org_id: $org}) RETURN r.repo_id AS repo_id",
        {"run": run_id, "org": principal.org_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    repo_for(principal, row["repo_id"])
    audit.record(principal.org_id, principal.user_id, "agent.run.interrupt", run_id, meta={"status": "interrupted"})
    return agent_service.interrupt(principal.org_id, row["repo_id"], run_id)


@router.post("/agent/runs/{run_id}/resume")
def agent_resume(run_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    row = db.read_one(
        "MATCH (r:AgentRun {run_id: $run, org_id: $org}) RETURN r.repo_id AS repo_id",
        {"run": run_id, "org": principal.org_id},
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    repo_for(principal, row["repo_id"])
    result = agent_service.resume(principal.org_id, row["repo_id"], run_id)
    audit.record(
        principal.org_id,
        principal.user_id,
        "agent.run.resume",
        run_id,
        meta={"status": (result.get("run") or {}).get("status")},
    )
    return result
