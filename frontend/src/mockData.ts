import type {
  AdminRepo,
  AdminUser,
  AgentRun,
  AgentTask,
  AskResult,
  AuthConfig,
  AuditEvent,
  Citation,
  Finding,
  GraphResponse,
  Handover,
  Membership,
  Overview,
  Repo,
  TimelineItem,
  User,
} from "./types";

export interface BlastRadiusResult {
  target: string;
  target_type: "decision" | "commit" | "pr" | "function" | "file";
  author: string;
  original_pr: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  risk_score: number;
  hops: number;
  verdict: "BLOCKED" | "WARNING" | "ALLOWED";
  verdict_reason: string;
  direct_callers: Array<{
    name: string;
    path: string;
    line: number;
    impact: string;
  }>;
  cascading_services: Array<{
    service: string;
    criticality: "CRITICAL" | "HIGH" | "MEDIUM";
    failure_mode: string;
  }>;
  threatened_invariants: Array<{
    id: string;
    title: string;
    rationale: string;
    established_by: string;
  }>;
  security_regressions: Array<{
    scanner: string;
    rule_id: string;
    title: string;
    current_status: string;
    revert_status: string;
  }>;
}

export const DEMO_CONFIG: AuthConfig = {
  password_login: true,
  github_oauth: true,
  github_app: false,
  frontend_url: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
};

export const DEMO_USER_STAFF: User = {
  user_id: "usr_staff_ada",
  email: "ada@whyc.dev",
  name: "Ada Lovelace (Staff Architect)",
  github_login: "ada-lovelace",
  last_login_at: new Date().toISOString(),
};

export const DEMO_USER_AGENT: User = {
  user_id: "usr_agent_argosx",
  email: "dev@whyc.dev",
  name: "ArgosX Autonomous Agent (Coding Agent)",
  github_login: "argosx-agent",
  last_login_at: new Date().toISOString(),
};

export const DEMO_MEMBERSHIP_STAFF: Membership = {
  org_id: "org_northwind",
  org_name: "Northwind Engineering",
  role: "admin",
};

export const DEMO_MEMBERSHIP_AGENT: Membership = {
  org_id: "org_northwind",
  org_name: "Northwind Engineering",
  role: "developer",
};

export const DEMO_REPO: Repo = {
  repo_id: "repo_flask",
  owner: "pallets",
  name: "flask",
  full_name: "pallets/flask",
  description: "The Python micro framework for building web applications and APIs.",
  default_branch: "main",
  indexed_sha: "7d2b8e4f1a2c3d4e",
  sync_status: "ready",
  last_synced_at: new Date().toISOString(),
  url: "https://github.com/pallets/flask",
  embedding_backend: "minilm-l6-v2",
  counts: {
    files: 42,
    entities: 318,
    chunks: 890,
    decisions: 14,
    findings: 3,
  },
};

export const DEMO_REPOS: Repo[] = [DEMO_REPO];

export const DEMO_TIMELINE: TimelineItem[] = [
  {
    kind: "decision",
    at: "2024-03-12T14:22:10Z",
    title: "Preserve SHA-1 session cookie signature compatibility (PR #5460)",
    url: "https://github.com/pallets/flask/pull/5460",
  },
  {
    kind: "commit",
    at: "2024-03-12T14:15:00Z",
    title: "Merge pull request #5460: retain hashlib.sha1 for TaggedJSONSerializer",
    url: "https://github.com/pallets/flask/commit/7d2b8e4f1a2c3d4e",
  },
  {
    kind: "finding",
    at: "2024-03-12T14:10:00Z",
    title: "Bandit B324 marked Documented/Accepted under Decision #5460",
    url: "https://github.com/pallets/flask/security",
  },
  {
    kind: "decision",
    at: "2023-11-04T10:00:00Z",
    title: "Keep WSGI request context teardown synchronous across workers",
    url: "https://github.com/pallets/flask/pull/4912",
  },
  {
    kind: "commit",
    at: "2023-11-04T09:45:00Z",
    title: "Ensure teardown_appcontext executes even during uncaught exceptions",
    url: "https://github.com/pallets/flask/commit/a8f23c914e0b",
  },
];

export const DEMO_OVERVIEW: Overview = {
  repo: DEMO_REPO,
  org: {
    org_id: "org_northwind",
    name: "Northwind Engineering",
    role: "admin",
  },
  counts: {
    files: 42,
    entities: 318,
    chunks: 890,
    decisions: 14,
    findings: 3,
  },
  recent_commits: [
    {
      sha: "7d2b8e4f",
      message: "Merge PR #5460: Preserve SHA-1 session token compatibility",
      author_name: "David Lord (@davidism)",
      committed_at: "2024-03-12T14:22:10Z",
      url: "https://github.com/pallets/flask/commit/7d2b8e4f1a2c3d4e",
    },
    {
      sha: "a8f23c91",
      message: "Fix request context lifecycle teardown in async WSGI mode",
      author_name: "Pallets Maintainers",
      committed_at: "2023-11-04T09:45:00Z",
      url: "https://github.com/pallets/flask/commit/a8f23c914e0b",
    },
    {
      sha: "3e59a10c",
      message: "Enforce Argon2id & HMAC-SHA256 signature verification for CLI",
      author_name: "Security Team",
      committed_at: "2023-09-18T16:30:00Z",
      url: "https://github.com/pallets/flask/commit/3e59a10c22d1",
    },
  ],
  timeline: DEMO_TIMELINE,
};

export const DEMO_DECISIONS: Citation[] = [
  {
    id: "dec-1",
    kind: "decision",
    title: "Keep SHA-1 for TaggedJSONSerializer (PR #5460)",
    snippet:
      "Approved by @davidism: In src/flask/sessions.py, retain hashlib.sha1 for session cookie HMAC integrity checks. Prevents breaking ~1.4M active mobile client cookies.",
    url: "https://github.com/pallets/flask/pull/5460",
    path: "src/flask/sessions.py",
    line_start: 34,
    line_end: 52,
    commit_sha: "7d2b8e4f1a2c3d4e",
    label: "Decision #5460",
  },
  {
    id: "dec-2",
    kind: "decision",
    title: "Synchronous WSGI Teardown Guarantees (PR #4912)",
    snippet:
      "Teardown context callbacks must run synchronously before socket closure to avoid database connection pool leakage in gunicorn gevent workers.",
    url: "https://github.com/pallets/flask/pull/4912",
    path: "src/flask/ctx.py",
    line_start: 388,
    line_end: 415,
    commit_sha: "a8f23c914e0b",
    label: "Decision #4912",
  },
  {
    id: "dec-3",
    kind: "decision",
    title: "ArgosX & Coding Agent Guardrails (RFC-204)",
    snippet:
      "All automated agents (Claude Code, ArgosX, Codex) must verify active Neo4j architectural constraints before modifying cryptographic or lifecycle primitives.",
    url: "https://github.com/pallets/flask/wiki/Architectural-Invariants",
    path: "src/flask/sessions.py",
    line_start: 1,
    line_end: 25,
    label: "RFC-204 Invariant",
  },
];

export const DEMO_FINDINGS: Finding[] = [
  {
    finding_id: "find_bandit_b324",
    rule_id: "B324",
    severity: "HIGH",
    confidence: "HIGH",
    status: "DOCUMENTED_ACCEPTED",
    scanner: "Bandit",
    path: "src/flask/sessions.py",
    line_start: 42,
    line_end: 45,
    message: "Use of insecure MD5 or SHA1 hash function in TaggedJSONSerializer HMAC signer.",
    url: "https://bandit.readthedocs.io/en/latest/plugins/b324_hashlib.html",
    label: "Bandit B324",
    related_decisions: [
      {
        decision_id: "dec-1",
        summary: "Keep SHA-1 for TaggedJSONSerializer",
        rationale:
          "Hash is used strictly for HMAC cookie signatures, not passwords. Kept for mobile client backward compatibility (PR #5460).",
        evidence_url: "https://github.com/pallets/flask/pull/5460",
        rationale_type: "compatibility_exemption",
      },
    ],
  },
  {
    finding_id: "find_semgrep_xss",
    rule_id: "python.flask.security.xss",
    severity: "MEDIUM",
    confidence: "MEDIUM",
    status: "REVIEWED_SAFE",
    scanner: "Semgrep",
    path: "src/flask/templating.py",
    line_start: 88,
    line_end: 94,
    message: "Rendering untrusted template string without explicit HTML markup escaping.",
    url: "https://semgrep.dev/p/flask-xss",
    label: "Semgrep XSS",
    related_decisions: [
      {
        decision_id: "dec-xss",
        summary: "Jinja autoescaping enabled globally in Environment config",
        rationale: "Default environment autoescaping handles HTML/XML contexts automatically.",
        evidence_url: "https://github.com/pallets/flask/pull/3110",
        rationale_type: "framework_protection",
      },
    ],
  },
];

export const DEMO_HANDOVER: Handover = {
  repo: {
    ...DEMO_REPO,
    org_name: "Northwind Engineering",
  },
  generated_at: new Date().toISOString(),
  sections: [
    {
      key: "arch_overview",
      title: "1. Core WSGI Architecture & Execution Engine",
      body: "Flask is structured around the `Flask` application class which implements the WSGI protocol. Incoming requests instantiate a `RequestContext` on the local context stack (`_cv_request`). Crucially, context teardown handlers (`teardown_request`, `teardown_appcontext`) are guaranteed to execute synchronously before worker recycling, preventing connection leaks.",
      coverage: "fact",
      sources: [
        {
          title: "src/flask/app.py",
          path: "src/flask/app.py",
          line_start: 120,
          url: "https://github.com/pallets/flask/blob/main/src/flask/app.py#L120",
        },
        {
          title: "src/flask/ctx.py",
          path: "src/flask/ctx.py",
          line_start: 388,
          url: "https://github.com/pallets/flask/blob/main/src/flask/ctx.py#L388",
        },
      ],
    },
    {
      key: "crypto_sessions",
      title: "2. Session Serialization & Cryptographic Constraints",
      body: "Sessions are managed via `SecureCookieSessionInterface` and serialized by `TaggedJSONSerializer`. A critical architectural invariant is that `hashlib.sha1` is intentionally retained as the HMAC digest in `sessions.py` [ev1]. While static analysis tools flag Bandit B324, this was mandated by @davidism in PR #5460 to preserve compatibility with existing mobile client cookies. Upgrading to SHA-256 without a staged dual-verification fallback will invalidate 1.4M active sessions.",
      coverage: "fact",
      sources: [
        {
          title: "PR #5460: Preserve SHA-1 session token compatibility",
          path: "src/flask/sessions.py",
          line_start: 34,
          url: "https://github.com/pallets/flask/pull/5460",
        },
        {
          title: "Bandit B324 (Documented Security Exemption)",
          path: "src/flask/sessions.py",
          line_start: 42,
          url: "https://github.com/pallets/flask/security",
        },
      ],
    },
    {
      key: "invariants_agent",
      title: "3. ArgosX & Coding Agent Safety Invariants (Guardrails)",
      body: "When coding agents (ArgosX, Claude Code, Cursor, Codex) interact with this repository, the following architectural constraints are strictly enforced:\n\n1. **Invariant #12 (Session Integrity):** Never replace `hashlib.sha1` in `sessions.py` with SHA-256 in a single-step refactor.\n2. **Invariant #8 (Context Teardown):** Never convert `teardown_appcontext` handlers into asynchronous coroutines without checking sync WSGI server workers.\n3. **Invariant #4 (Signal Dispatch):** Do not remove `app.app_context()` wrapper around CLI commands; extensions rely on active application context bindings.",
      coverage: "fact",
      sources: [
        {
          title: "Architectural Invariant Specification (WhyCode Neo4j Graph)",
          path: "src/flask/sessions.py",
          line_start: 1,
          url: "https://github.com/pallets/flask",
        },
      ],
    },
    {
      key: "tech_debt",
      title: "4. Known Technical Debt & Migration Boundaries",
      body: "The repository maintains legacy compatibility layers for Python 3.8 and legacy Werkzeug 2.x request parsers. Migration to native async WSGI/ASGI dispatch is staged under issue #5100 but blocked pending finalization of the streaming response context lifecycle.",
      coverage: "inferred",
      sources: [
        {
          title: "src/flask/sansio/app.py",
          path: "src/flask/sansio/app.py",
          line_start: 50,
          url: "https://github.com/pallets/flask/blob/main/src/flask/sansio/app.py",
        },
      ],
    },
  ],
  unknowns: [
    "Exact deprecation timeline for legacy v1.x mobile app clients requiring HMAC-SHA1 session tokens.",
    "Hardware benchmark metrics for ASGI async streaming under high concurrency gunicorn gevent workers.",
  ],
};

export const DEMO_GRAPH: GraphResponse = {
  truncated: false,
  focus: "src/flask/sessions.py",
  nodes: [
    {
      id: "node_file_sessions",
      kind: "file",
      label: "File",
      title: "src/flask/sessions.py",
      subtitle: "Session handling & cookie serialization",
      meta: { path: "src/flask/sessions.py", lines: 350 },
    },
    {
      id: "node_entity_tagged_json",
      kind: "class",
      label: "Class",
      title: "TaggedJSONSerializer",
      subtitle: "Serializes values for session storage",
      meta: { path: "src/flask/sessions.py", line: 34 },
    },
    {
      id: "node_decision_5460",
      kind: "decision",
      label: "Decision",
      title: "Keep SHA-1 for Mobile Cookies (PR #5460)",
      subtitle: "Approved by @davidism",
      meta: { pr: 5460, status: "active" },
    },
    {
      id: "node_pr_5460",
      kind: "pr",
      label: "Pull Request",
      title: "PR #5460: Preserve SHA-1 session compatibility",
      subtitle: "Merged 2024-03-12 by David Lord",
      meta: { pr_number: 5460, sha: "7d2b8e4f" },
    },
    {
      id: "node_finding_b324",
      kind: "finding",
      label: "Finding",
      title: "Bandit B324: Use of SHA-1",
      subtitle: "Status: DOCUMENTED_ACCEPTED",
      meta: { severity: "HIGH", scanner: "Bandit" },
    },
    {
      id: "node_user_davidism",
      kind: "entity",
      label: "Maintainer",
      title: "David Lord (@davidism)",
      subtitle: "Lead Maintainer, Pallets",
      meta: { role: "lead" },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "node_file_sessions",
      target: "node_entity_tagged_json",
      label: "CONTAINS",
    },
    {
      id: "edge-2",
      source: "node_entity_tagged_json",
      target: "node_decision_5460",
      label: "GOVERNED_BY",
    },
    {
      id: "edge-3",
      source: "node_decision_5460",
      target: "node_pr_5460",
      label: "ESTABLISHED_IN",
    },
    {
      id: "edge-4",
      source: "node_pr_5460",
      target: "node_user_davidism",
      label: "AUTHORED_BY",
    },
    {
      id: "edge-5",
      source: "node_decision_5460",
      target: "node_finding_b324",
      label: "DOCUMENTS_RATIONALE",
    },
  ],
};

export const DEMO_BLAST_RADIUS: BlastRadiusResult = {
  target: "src/flask/sessions.py:TaggedJSONSerializer (Revert PR #5460)",
  target_type: "decision",
  author: "David Lord (@davidism)",
  original_pr: "PR #5460 (Merged 2024-03-12)",
  severity: "CRITICAL",
  risk_score: 88,
  hops: 3,
  verdict: "BLOCKED",
  verdict_reason:
    "Reverting PR #5460 or replacing SHA-1 breaks 2 architectural invariants and causes mass session invalidation for 1.4M mobile clients.",
  direct_callers: [
    {
      name: "TaggedJSONSerializer.dumps",
      path: "src/flask/sessions.py",
      line: 45,
      impact: "HMAC cookie signature algorithm mismatch",
    },
    {
      name: "SecureCookieSessionInterface.save_session",
      path: "src/flask/sessions.py",
      line: 198,
      impact: "Client response Set-Cookie serialization failure",
    },
    {
      name: "Flask.open_session",
      path: "src/flask/app.py",
      line: 720,
      impact: "Uncaught SessionDeserializationError during request lifecycle",
    },
    {
      name: "test_session_cookie_signature",
      path: "tests/test_sessions.py",
      line: 114,
      impact: "6 unit test assertion failures across test suite",
    },
  ],
  cascading_services: [
    {
      service: "Mobile Client API Gateway (iOS & Android v4.1)",
      criticality: "CRITICAL",
      failure_mode: "100% of existing user sessions invalidated; immediate mass 401 Unauthorized logout spike.",
    },
    {
      service: "Distributed Redis Session Cache",
      criticality: "HIGH",
      failure_mode: "Hash digest collision check fails across rolling deployment nodes.",
    },
    {
      service: "Single Sign-On (SSO) OAuth Token Bridge",
      criticality: "HIGH",
      failure_mode: "Incompatible HMAC signature rejection for cross-domain cookie exchange.",
    },
  ],
  threatened_invariants: [
    {
      id: "INV-12",
      title: "Mobile Client Backward Compatibility",
      rationale:
        "Mandated by @davidism in PR #5460: TaggedJSONSerializer must verify SHA-1 signatures until v5.0 mobile client deprecation.",
      established_by: "PR #5460 / Decision #5460",
    },
    {
      id: "INV-04",
      title: "Documented Security Exemption Consistency",
      rationale:
        "Bandit B324 scanner finding is verified and documented. Blindly reverting creates an unreviewed high-severity audit exception.",
      established_by: "Security Review (SecOps-2024)",
    },
  ],
  security_regressions: [
    {
      scanner: "Bandit",
      rule_id: "B324",
      title: "Use of insecure MD5 or SHA1 hash function",
      current_status: "DOCUMENTED_ACCEPTED (Linked to PR #5460)",
      revert_status: "UNREVIEWED HIGH SEVERITY VULNERABILITY",
    },
  ],
};

export const DEMO_ASK_ANSWERS: Record<string, AskResult> = {
  sha1: {
    answer: `In **src/flask/sessions.py**, \`hashlib.sha1\` is intentionally retained within \`TaggedJSONSerializer\` [ev1] to maintain backward compatibility with active mobile client session cookies [ev2].

While static security scanners flag this under **Bandit B324** [ev3] as a weak hash algorithm, PR #5460 by @davidism explicitly verified that the digest is used strictly for HMAC payload integrity verification with an application secret key, **not** for password hashing.

### Architectural Invariant & Blast Radius
> **Invariant #12 (Preserved Rationale):**
> Upgrading this hash to SHA-256 without a staged dual-signature fallback invalidates session tokens for approximately **1.4 million mobile app clients**, breaking 4 downstream authentication services.

WhyCode verifies this rationale directly against the Neo4j engineering graph, confirming that this is an intentional, documented architectural decision rather than accidental tech debt.`,
    citations: [
      {
        id: "ev1",
        kind: "code",
        label: "Code",
        title: "src/flask/sessions.py (TaggedJSONSerializer)",
        path: "src/flask/sessions.py",
        line_start: 34,
        line_end: 52,
        commit_sha: "7d2b8e4f1a2c3d4e",
        snippet: `class TaggedJSONSerializer:
    """A serializer that tags values to preserve specific types in JSON.
    Uses SHA-1 digest for payload integrity signatures to retain
    backward compatibility with v1.x mobile client sessions (PR #5460).
    """
    def __init__(self, secret_key: bytes) -> None:
        self.secret_key = secret_key
        self.signer = hmac.new(secret_key, digestmod=hashlib.sha1)`,
        code: `class TaggedJSONSerializer:
    """A serializer that tags values to preserve specific types in JSON.
    Uses SHA-1 digest for payload integrity signatures to retain
    backward compatibility with v1.x mobile client sessions (PR #5460).
    """
    def __init__(self, secret_key: bytes) -> None:
        self.secret_key = secret_key
        self.signer = hmac.new(secret_key, digestmod=hashlib.sha1)`,
      },
      {
        id: "ev2",
        kind: "pr",
        label: "Pull request",
        title: "PR #5460: Preserve SHA-1 session cookie signature compatibility",
        url: "https://github.com/pallets/flask/pull/5460",
        commit_sha: "7d2b8e4f1a2c3d4e",
        snippet:
          'Approved by @davidism: "Keep SHA-1 for TaggedJSONSerializer. Mobile clients on v1.x cannot parse upgraded SHA-256 tokens. Documented as accepted risk."',
      },
      {
        id: "ev3",
        kind: "finding",
        label: "Finding",
        title: "Bandit B324: Use of weak MD5/SHA1 hash in HMAC signer",
        path: "src/flask/sessions.py",
        line_start: 42,
        line_end: 45,
        url: "https://bandit.readthedocs.io/en/latest/plugins/b324_hashlib.html",
        snippet:
          "Finding status: DOCUMENTED_ACCEPTED. Linked to Decision #5460 by @davidism on 2024-03-12.",
      },
    ],
    evidence: [],
    mode: "auto",
    abstained: false,
    confidence: "high",
    timings: {
      retrieve: 84,
      total: 142,
      vector_disabled: false,
    },
    audit_id: "aud_9f82c41a",
    indexed_sha: "7d2b8e4f1a2c3d4e",
    engine: "groq:llama-3.3-70b-versatile",
    grounding: {
      total_claims: 3,
      supported_claims: 3,
      unsupported_claims: 0,
      grounding_verdict: "VERIFIED",
    },
  },
  default: {
    answer: `The WSGI application object is defined in **src/flask/app.py** as the \`Flask\` class [ev1]. 

It implements the \`__call__\` entrypoint required by the WSGI specification (PEP 3333). When an HTTP request reaches the server, it creates a \`RequestContext\` [ev2] and pushes it onto the current execution thread or async context variable, enabling globals like \`request\` and \`session\`.

All teardown context handlers are guaranteed to execute synchronously before the socket terminates, preventing connection leaks in gunicorn worker processes [ev3].`,
    citations: [
      {
        id: "ev1",
        kind: "code",
        label: "Code",
        title: "src/flask/app.py (Flask.__call__)",
        path: "src/flask/app.py",
        line_start: 1450,
        line_end: 1465,
        snippet: `    def __call__(self, environ: dict, start_response: t.Callable) -> t.Any:
        """The WSGI server calls the Flask application object as the
        standard WSGI callable entrypoint.
        """
        return self.wsgi_app(environ, start_response)`,
        code: `    def __call__(self, environ: dict, start_response: t.Callable) -> t.Any:
        """The WSGI server calls the Flask application object as the
        standard WSGI callable entrypoint.
        """
        return self.wsgi_app(environ, start_response)`,
      },
      {
        id: "ev2",
        kind: "code",
        label: "Code",
        title: "src/flask/ctx.py (RequestContext.push)",
        path: "src/flask/ctx.py",
        line_start: 388,
        line_end: 405,
        snippet: "Binds the request context to current thread/task locals.",
      },
      {
        id: "ev3",
        kind: "decision",
        label: "Decision",
        title: "Decision #4912: Synchronous Teardown Guarantees",
        snippet: "Guarantees database sessions and open file descriptors close cleanly.",
      },
    ],
    evidence: [],
    mode: "auto",
    abstained: false,
    confidence: "high",
    timings: {
      retrieve: 68,
      total: 118,
      vector_disabled: false,
    },
    audit_id: "aud_11bc90a2",
    indexed_sha: "7d2b8e4f1a2c3d4e",
    engine: "groq:llama-3.3-70b-versatile",
    grounding: {
      total_claims: 3,
      supported_claims: 3,
      unsupported_claims: 0,
      grounding_verdict: "VERIFIED",
    },
  },
};

export const DEMO_TASKS: Array<{ task: AgentTask; run_count: number }> = [
  {
    task: {
      task_id: "task_argosx_invariant_audit",
      title: "Audit Session Invariants for ArgosX Handover",
      goal: "Extract all active decisions and constraints on sessions.py and generate CLAUDE.md guardrails.",
      status: "COMPLETED",
      current_step: "step_4",
      summary: "Identified 3 active invariants and Bandit B324 documented rationale. Ready for agent handover.",
      repo_id: "repo_flask",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    run_count: 2,
  },
];

export const DEMO_RUNS: AgentRun[] = [
  {
    run_id: "run_argosx_01",
    task_id: "task_argosx_invariant_audit",
    status: "SUCCEEDED",
    current_step: "Verify Blast Radius & Export Guardrails",
    summary: "Graph traversal complete. No regressions detected. Handover bundle verified.",
    seen_sha: "7d2b8e4f",
    steps: [
      {
        n: 1,
        tool: "graph_traverse",
        args: { start_node: "src/flask/sessions.py", depth: 3 },
        result_count: 6,
        evidence_ids: ["ev1", "ev2"],
        at: new Date(Date.now() - 3400000).toISOString(),
      },
      {
        n: 2,
        tool: "invariant_check",
        args: { target: "TaggedJSONSerializer", rule: "INV-12" },
        result_count: 1,
        evidence_ids: ["ev3"],
        at: new Date(Date.now() - 3200000).toISOString(),
      },
    ],
    source_refs: ["src/flask/sessions.py", "PR #5460"],
    resume_count: 0,
    started_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3000000).toISOString(),
  },
];

export const DEMO_AUDIT: AuditEvent[] = [
  {
    event_id: "evt_001",
    org_id: "org_northwind",
    actor_id: "ada@whyc.dev",
    action: "ask.query",
    target_id: "repo_flask",
    timestamp: new Date(Date.now() - 120000).toISOString(),
    outcome: "success",
    correlation_id: "corr_sha1_query",
    meta_json: JSON.stringify({ query: "Why is hashlib.sha1 still used in sessions.py?", verdict: "VERIFIED" }),
  },
  {
    event_id: "evt_002",
    org_id: "org_northwind",
    actor_id: "argosx-agent",
    action: "agent.blast_radius_check",
    target_id: "src/flask/sessions.py",
    timestamp: new Date(Date.now() - 600000).toISOString(),
    outcome: "blocked",
    correlation_id: "corr_blast_sim",
    meta_json: JSON.stringify({ target: "PR #5460", verdict: "BLOCKED", risk_score: 88 }),
  },
];

export const DEMO_ADMIN_USERS: AdminUser[] = [
  {
    user: DEMO_USER_STAFF,
    role: "admin",
    membership_status: "active",
    memberships: [DEMO_MEMBERSHIP_STAFF],
  },
  {
    user: DEMO_USER_AGENT,
    role: "developer",
    membership_status: "active",
    memberships: [DEMO_MEMBERSHIP_AGENT],
  },
];

export const DEMO_ADMIN_REPOS: AdminRepo[] = [
  {
    ...DEMO_REPO,
    sync_status: "ready",
    counts: DEMO_REPO.counts,
  },
];
