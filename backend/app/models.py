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
    refresh_token: str = ""
    user: dict[str, Any]
    memberships: list[MembershipOut]
    active_org: MembershipOut
    must_change_password: bool = False


class MeResponse(BaseModel):
    user: dict[str, Any]
    memberships: list[MembershipOut]
    active_org: MembershipOut
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None
    all_devices: bool = False


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class GitHubExchangeRequest(BaseModel):
    code: str


class UserCreate(BaseModel):
    email: str
    name: str = ""
    role: Role = "reader"
    password: str | None = None


class UserUpdate(BaseModel):
    role: Role | None = None
    status: Literal["active", "disabled"] | None = None


class PasswordResetRequest(BaseModel):
    password: str | None = None


class RepoCreate(BaseModel):
    full_name: str | None = None
    owner: str | None = None
    name: str | None = None
    branch: str | None = None
    pinned_prs: list[int] = Field(default_factory=list, max_length=20)


class AskTurn(BaseModel):
    question: str = Field(max_length=2000)
    answer: str = Field(default="", max_length=8000)
    path: str | None = None
    line_start: int | None = None
    line_end: int | None = None


class AskRequest(BaseModel):
    repo_id: str
    question: str = Field(min_length=2, max_length=2000)
    mode: Literal["auto", "understand", "why", "security", "handover"] = "auto"
    history: list[AskTurn] = Field(default_factory=list, max_length=12)
    focus_path: str | None = None
    focus_line_start: int | None = None
    focus_line_end: int | None = None


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
    code: str | None = None
    language: str | None = None


class GroundingReport(BaseModel):
    total_claims: int
    supported_claims: int
    unsupported_claims: int
    grounding_verdict: str


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    evidence: list[Citation]
    mode: str
    abstained: bool
    confidence: str
    timings: dict[str, Any]
    audit_id: str | None = None
    indexed_sha: str | None = None
    engine: str | None = None
    grounding: GroundingReport | None = None


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
