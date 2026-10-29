from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Role = Literal["admin", "maintainer", "developer", "security_reviewer", "reader"]


class LoginRequest(BaseModel):
    email: str
    password: str


class MembershipOut(BaseModel):
    org_id: str
    org_name: str
    role: Role


class TokenResponse(BaseModel):
    token: str
    user: dict[str, Any]
    memberships: list[MembershipOut]
    active_org: MembershipOut


class MeResponse(BaseModel):
    user: dict[str, Any]
    memberships: list[MembershipOut]
    active_org: MembershipOut


class AskRequest(BaseModel):
    repo_id: str
    question: str = Field(min_length=2, max_length=2000)
    mode: Literal["auto", "understand", "why", "security", "handover"] = "auto"


class Citation(BaseModel):
    id: str
    kind: str
    title: str
    snippet: str
    url: str | None = None
    path: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    commit_sha: str | None = None
    label: str = "fact"
    score: float | None = None


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    evidence: list[Citation]
    mode: str
    abstained: bool
    confidence: str
    timings: dict[str, float]
    audit_id: str | None = None
    indexed_sha: str | None = None


class HandoverSource(BaseModel):
    title: str
    url: str | None = None
    path: str | None = None
    line_start: int | None = None


class HandoverSection(BaseModel):
    key: str
    title: str
    body: str
    coverage: Literal["fact", "inferred", "unknown"]
    sources: list[HandoverSource]


class HandoverResponse(BaseModel):
    repo: dict[str, Any]
    generated_at: str
    sections: list[HandoverSection]
    unknowns: list[str]


class FindingOut(BaseModel):
    finding_id: str
    rule_id: str
    severity: str
    confidence: str
    status: str
    scanner: str
    path: str
    line_start: int
    line_end: int
    message: str
    url: str | None = None
    label: str = "scanner finding — unverified"
    related_decisions: list[dict[str, Any]] = []


class GraphNode(BaseModel):
    id: str
    label: str
    kind: str
    title: str
    subtitle: str | None = None
    meta: dict[str, Any] = {}


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    truncated: bool
    focus: str | None = None


class TaskCreate(BaseModel):
    repo_id: str
    title: str
    goal: str = ""


class RunCreate(BaseModel):
    task_id: str


class StepRequest(BaseModel):
    tool: Literal["search_code", "get_decisions", "get_findings", "handover_section"]
    args: dict[str, Any] = {}


class ResumeRequest(BaseModel):
    pass
