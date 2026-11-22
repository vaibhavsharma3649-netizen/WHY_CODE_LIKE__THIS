import type {
  AdminRepo,
  AdminUser,
  AgentContextItem,
  AgentRun,
  AgentStep,
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
  RunState,
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

export const DEMO_REPO_FLASK: Repo = {
  repo_id: "repo_flask",
  owner: "pallets",
  name: "flask",
  full_name: "pallets/flask",
  description: "Python microframework: TaggedJSONSerializer HMAC integrity, synchronous WSGI request teardown.",
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

export const DEMO_REPO_SPRING: Repo = {
  repo_id: "repo_spring",
  owner: "spring-projects",
  name: "spring-boot",
  full_name: "spring-projects/spring-boot",
  description: "Enterprise Java framework: AutoConfiguration, SecurityFilterChain bean invariants, reactive WebFlux.",
  default_branch: "main",
  indexed_sha: "b49e1a82c0f7d3e1",
  sync_status: "ready",
  last_synced_at: new Date().toISOString(),
  url: "https://github.com/spring-projects/spring-boot",
  embedding_backend: "minilm-l6-v2",
  counts: {
    files: 184,
    entities: 1420,
    chunks: 3640,
    decisions: 28,
    findings: 2,
  },
};

export const DEMO_REPO_EXPRESS: Repo = {
  repo_id: "repo_express",
  owner: "expressjs",
  name: "express",
  full_name: "expressjs/express",
  description: "Node.js (JavaScript/TypeScript) framework: Layer regex routing, 4-argument error middleware invariant.",
  default_branch: "master",
  indexed_sha: "5c83d9a1e0b24f76",
  sync_status: "ready",
  last_synced_at: new Date().toISOString(),
  url: "https://github.com/expressjs/express",
  embedding_backend: "minilm-l6-v2",
  counts: {
    files: 36,
    entities: 248,
    chunks: 720,
    decisions: 19,
    findings: 1,
  },
};

export const DEMO_REPO_GIN: Repo = {
  repo_id: "repo_gin",
  owner: "gin-gonic",
  name: "gin",
  full_name: "gin-gonic/gin",
  description: "High-performance Go (Golang) web framework: Radix tree prefix routing, sync.Pool memory recycling.",
  default_branch: "master",
  indexed_sha: "3a91f8c2e4d0b75a",
  sync_status: "ready",
  last_synced_at: new Date().toISOString(),
  url: "https://github.com/gin-gonic/gin",
  embedding_backend: "minilm-l6-v2",
  counts: {
    files: 28,
    entities: 194,
    chunks: 580,
    decisions: 11,
    findings: 0,
  },
};

export const DEMO_REPO: Repo = DEMO_REPO_FLASK;

export let DEMO_REPOS: Repo[] = [
  DEMO_REPO_FLASK,
  DEMO_REPO_SPRING,
  DEMO_REPO_EXPRESS,
  DEMO_REPO_GIN,
];


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
  // Java Spring Boot Decisions
  {
    id: "dec-spring-1",
    kind: "decision",
    title: "Preserve @ConditionalOnMissingBean in AutoConfiguration (PR #14280)",
    snippet:
      "All Starter AutoConfiguration classes must declare @ConditionalOnMissingBean on default Bean definitions. Dropping this forces developer overrides to declare @Primary and breaks modular bean replacement across 120+ Starters.",
    url: "https://github.com/spring-projects/spring-boot/pull/14280",
    path: "src/main/java/org/springframework/boot/autoconfigure/AutoConfigurationPackages.java",
    line_start: 78,
    line_end: 95,
    commit_sha: "b49e1a82c0f7",
    label: "Spring Boot Invariant #14280",
  },
  {
    id: "dec-spring-2",
    kind: "decision",
    title: "SecurityFilterChain Bean Architecture Migration (PR #34091)",
    snippet:
      "Migrate all web security configurations to standalone SecurityFilterChain beans to support Spring Security 6 component-based authorization and prevent CVE-2023-34035 request matching bypass.",
    url: "https://github.com/spring-projects/spring-boot/pull/34091",
    path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java",
    line_start: 45,
    line_end: 68,
    commit_sha: "c182ef45b0a1",
    label: "Spring Security Invariant #34091",
  },
  // JavaScript / TypeScript Express Decisions
  {
    id: "dec-express-1",
    kind: "decision",
    title: "Enforce exact 4-argument signature (err, req, res, next) for error middleware (PR #2841)",
    snippet:
      "Express router layer inspects fn.length === 4 via JavaScript reflection to determine error boundary handlers. Omitting the next argument (leaving 3 args) causes Express to treat it as standard request middleware, completely breaking error trapping.",
    url: "https://github.com/expressjs/express/pull/2841",
    path: "lib/router/layer.js",
    line_start: 68,
    line_end: 82,
    commit_sha: "5c83d9a1e0b2",
    label: "Express Invariant #2841",
  },
  // Go Gin Decisions
  {
    id: "dec-gin-1",
    kind: "decision",
    title: "Zero-allocation context reuse via sync.Pool (PR #1420)",
    snippet:
      "Gin reuses gin.Context pointers across HTTP requests via sync.Pool. Contexts are cleared via .reset() after handler return. Passing raw *Context to background goroutines without .Copy() causes race condition data corruptions.",
    url: "https://github.com/gin-gonic/gin/pull/1420",
    path: "pkg/gin.go",
    line_start: 142,
    line_end: 165,
    commit_sha: "3a91f8c2e4d0",
    label: "Gin Lifecycle Invariant #1420",
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
  {
    finding_id: "find_spotbugs_ei2",
    rule_id: "EI_EXPOSE_REP2",
    severity: "MEDIUM",
    confidence: "HIGH",
    status: "DOCUMENTED_ACCEPTED",
    scanner: "SpotBugs",
    path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java",
    line_start: 52,
    line_end: 56,
    message: "May expose internal representation by storing reference to mutable HttpSecurity object.",
    url: "https://spotbugs.readthedocs.io/en/latest/bugDescriptions.html#EI_EXPOSE_REP2",
    label: "SpotBugs EI2",
    related_decisions: [
      {
        decision_id: "dec-spring-2",
        summary: "SecurityFilterChain bean requires direct HttpSecurity builder configuration",
        rationale: "HttpSecurity builder is thread-confined during application context initialization and sealed before runtime requests.",
        evidence_url: "https://github.com/spring-projects/spring-boot/pull/34091",
        rationale_type: "framework_protection",
      },
    ],
  },
  {
    finding_id: "find_eslint_buffer",
    rule_id: "security/detect-new-buffer",
    severity: "LOW",
    confidence: "HIGH",
    status: "DOCUMENTED_ACCEPTED",
    scanner: "ESLint Security",
    path: "lib/utils.js",
    line_start: 22,
    line_end: 25,
    message: "Use of new Buffer() deprecated in Node.js 10+ due to uninitialized memory exposure.",
    url: "https://eslint.org/docs/rules/no-buffer-constructor",
    label: "ESLint Buffer",
    related_decisions: [
      {
        decision_id: "dec-express-2",
        summary: "Migrate to Buffer.from() / Buffer.alloc() with Node 8 fallback polyfill",
        rationale: "Polyfill maintains backward compatibility for legacy Node runtime environments.",
        evidence_url: "https://github.com/expressjs/express/pull/3650",
        rationale_type: "compatibility_exemption",
      },
    ],
  },
];

function strSha(sha?: string | null): string {
  return sha ? sha.slice(0, 8) : "7d2b8e4f";
}

export const DEMO_HANDOVER_FLASK: Handover = {
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

export function getDemoHandover(repoId = "repo_flask"): Handover {
  const repo = DEMO_REPOS.find((r) => r.repo_id === repoId) ?? DEMO_REPO_FLASK;
  const fullName = repo.full_name;
  const fnLower = fullName.toLowerCase();

  // 1. SPRING BOOT (JAVA)
  if (repoId === "repo_spring" || fnLower.includes("spring")) {
    return {
      repo: { ...repo, org_name: "Northwind Engineering" },
      generated_at: new Date().toISOString(),
      sections: [
        {
          key: "arch_overview",
          title: "1. Core AutoConfiguration & Bean Wiring Engine",
          body: "Spring Boot revolves around conditional bean definition graphs orchestrated by `@EnableAutoConfiguration`. Component scans register starter libraries through `AutoConfigurationPackages.java`. A key architectural principle is that all built-in starter configurations must yield smoothly to user-declared beans without requiring explicit `@Primary` annotations or exclusion filters.",
          coverage: "fact",
          sources: [
            {
              title: "AutoConfigurationPackages.java",
              path: "src/main/java/org/springframework/boot/autoconfigure/AutoConfigurationPackages.java",
              line_start: 78,
              url: `${repo.url}/blob/main/src/main/java/org/springframework/boot/autoconfigure/AutoConfigurationPackages.java#L78`,
            },
            {
              title: "SecurityConfig.java",
              path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java",
              line_start: 42,
              url: `${repo.url}/blob/main/src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java#L42`,
            },
          ],
        },
        {
          key: "security_boundaries",
          title: "2. SecurityFilterChain Precedence & Actuator Boundaries",
          body: "Web security is governed by standalone `SecurityFilterChain` component beans following PR #34091. To prevent authorization bypasses (CVE-2023-34035), custom security filter chains must declare strict order precedence (`@Order(Ordered.HIGHEST_PRECEDENCE + 50)`) before the actuator management chain. Catch-all matchers must never shadow actuator health probe endpoints in Kubernetes clusters.",
          coverage: "fact",
          sources: [
            {
              title: "PR #34091: SecurityFilterChain Component Bean Invariant",
              path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java",
              line_start: 45,
              url: "https://github.com/spring-projects/spring-boot/pull/34091",
            },
            {
              title: "SpotBugs EI_EXPOSE_REP2 (Documented Framework Exemption)",
              path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java",
              line_start: 52,
              url: "https://spotbugs.readthedocs.io/en/latest/bugDescriptions.html#EI_EXPOSE_REP2",
            },
          ],
        },
        {
          key: "invariants_agent",
          title: "3. ArgosX & Coding Agent Safety Invariants (Guardrails)",
          body: `When autonomous coding agents (ArgosX, Claude Code, Cursor) generate code in this repository, the following invariants are strictly enforced:

1. **Invariant #34091 (Security Precedence):** Never configure \`authorizeHttpRequests()\` without explicit actuator matcher isolation.
2. **Invariant #14280 (Extensibility):** Never remove \`@ConditionalOnMissingBean\` from starter default auto-configuration beans.
3. **Invariant #20412 (Reactive Boundary):** Do not block on \`Mono.block()\` or \`Flux\` inside non-blocking WebFlux dispatchers.`,
          coverage: "fact",
          sources: [
            {
              title: "Architectural Invariant Oracle (WhyCode Neo4j Graph)",
              path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java",
              line_start: 1,
              url: repo.url,
            },
          ],
        },
        {
          key: "tech_debt",
          title: "4. Known Technical Debt & Migration Boundaries",
          body: "Legacy applications upgrading to Spring Boot 3.x require complete removal of `WebSecurityConfigurerAdapter`. Ahead-of-Time (AOT) compilation and GraalVM Native Image reflect-config bindings are currently in progressive rollouts.",
          coverage: "inferred",
          sources: [
            {
              title: "Spring Boot 3.0 Migration Guide",
              url: "https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide",
            },
          ],
        },
      ],
      unknowns: [
        "Deprecation deadline for legacy Tomcat APR connector support across enterprise microservice builds.",
        "Target Java 21 Virtual Thread (Project Loom) throughput under thread-local security context propagation.",
      ],
    };
  }

  // 2. EXPRESS (JAVASCRIPT / TYPESCRIPT)
  if (repoId === "repo_express" || fnLower.includes("express")) {
    return {
      repo: { ...repo, org_name: "Northwind Engineering" },
      generated_at: new Date().toISOString(),
      sections: [
        {
          key: "arch_overview",
          title: "1. Core Layer Routing & Middleware Dispatch Pipeline",
          body: "Express is structured around a nested stack of `Layer` instances mounted inside `lib/router/index.js` and `lib/application.js`. Incoming HTTP requests execute middleware in linear registration order. Crucially, error handlers are identified exclusively by having an exact function arity of 4: `(err, req, res, next)`.",
          coverage: "fact",
          sources: [
            {
              title: "lib/application.js",
              path: "lib/application.js",
              line_start: 140,
              url: `${repo.url}/blob/master/lib/application.js#L140`,
            },
            {
              title: "lib/router/layer.js",
              path: "lib/router/layer.js",
              line_start: 82,
              url: `${repo.url}/blob/master/lib/router/layer.js#L82`,
            },
          ],
        },
        {
          key: "middleware_contracts",
          title: "2. Middleware Arity-4 Contract & Memory Safety",
          body: "PR #2841 established that the router inspects `fn.length === 4` to determine whether a callback handles exceptions. If an agent refactors an error handler into `(err, req, res)`, Express will silently treat it as a standard request handler, leaking uncaught rejections. Furthermore, PR #3650 mandates `Buffer.from()` over `new Buffer()` with legacy polyfill fallback.",
          coverage: "fact",
          sources: [
            {
              title: "PR #2841: Explicit 4-argument error middleware detection",
              path: "lib/router/index.js",
              line_start: 210,
              url: "https://github.com/expressjs/express/pull/2841",
            },
            {
              title: "PR #3650: Eliminate uninitialized memory exposure via Buffer.from()",
              path: "lib/utils.js",
              line_start: 22,
              url: "https://github.com/expressjs/express/pull/3650",
            },
          ],
        },
        {
          key: "invariants_agent",
          title: "3. ArgosX & Coding Agent Safety Invariants (Guardrails)",
          body: `When autonomous coding agents modify this codebase, the following invariants are verified:

1. **Invariant #2841 (Error Middleware Signature):** Never drop the unused fourth parameter \`next\` from error handlers; \`fn.length\` MUST equal 4.
2. **Invariant #3650 (Memory Initialization):** Never invoke deprecated \`new Buffer()\` constructors.
3. **Invariant #1104 (Header Mutation):** Never modify headers after calling \`res.end()\` or \`res.send()\`.`,
          coverage: "fact",
          sources: [
            {
              title: "Architectural Invariant Oracle (WhyCode Neo4j Graph)",
              path: "lib/application.js",
              line_start: 1,
              url: repo.url,
            },
          ],
        },
        {
          key: "tech_debt",
          title: "4. Known Technical Debt & Migration Boundaries",
          body: "Express 5.0 migration involves upgrading `path-to-regexp` to v8 and removing deprecated `res.sendfile()`. Async/await error propagation without try/catch wrappers is staged for native promises in 5.x.",
          coverage: "inferred",
          sources: [
            {
              title: "Express 5.0 Migration History",
              url: "https://expressjs.com/en/guide/migrating-5.html",
            },
          ],
        },
      ],
      unknowns: [
        "Native fetch API integration timetable for Node.js 20+ runtime streaming.",
      ],
    };
  }

  // 3. GIN (GOLANG)
  if (repoId === "repo_gin" || fnLower.includes("gin")) {
    return {
      repo: { ...repo, org_name: "Northwind Engineering" },
      generated_at: new Date().toISOString(),
      sections: [
        {
          key: "arch_overview",
          title: "1. Radix Tree Prefix Router & Zero-Allocation Engine",
          body: "Gin is engineered around a radix tree prefix matching algorithm in `pkg/gin/tree.go` coupled with zero-allocation context recycling via `sync.Pool` in `pkg/gin/gin.go`. Requests execute through a chain of `HandlerFunc` delegates with sub-microsecond routing latency.",
          coverage: "fact",
          sources: [
            {
              title: "pkg/gin/gin.go",
              path: "pkg/gin/gin.go",
              line_start: 412,
              url: `${repo.url}/blob/master/pkg/gin/gin.go#L412`,
            },
            {
              title: "pkg/gin/tree.go",
              path: "pkg/gin/tree.go",
              line_start: 280,
              url: `${repo.url}/blob/master/pkg/gin/tree.go#L280`,
            },
          ],
        },
        {
          key: "context_lifecycle",
          title: "2. Context Memory Lifecycle & sync.Pool Concurrency",
          body: "Because `*gin.Context` instances are pooled to achieve 0 memory allocations per request, PR #1420 enforces that any background goroutine escaping the HTTP request lifecycle MUST call `c.Copy()`. Escaping the raw pointer causes use-after-free corruption when `sync.Pool.Put()` zeros the context for subsequent requests.",
          coverage: "fact",
          sources: [
            {
              title: "PR #1420: Require c.Copy() for goroutine context escape",
              path: "pkg/gin/context.go",
              line_start: 115,
              url: "https://github.com/gin-gonic/gin/pull/1420",
            },
            {
              title: "Go Race Detector Contract (DATA-RACE-3012)",
              path: "pkg/gin/context.go",
              line_start: 120,
              url: "https://go.dev/doc/articles/race_detector",
            },
          ],
        },
        {
          key: "invariants_agent",
          title: "3. ArgosX & Coding Agent Safety Invariants (Guardrails)",
          body: `When autonomous coding agents work on this repository, WhyCode verifies:

1. **Invariant #1420 (Context Cloning):** Always invoke \`c.Copy()\` before passing context pointers to asynchronous goroutines.
2. **Invariant #810 (Radix Match Purity):** Never introduce regex or dynamic backtracking in \`tree.go\` prefix traversal.
3. **Invariant #304 (Writer Locking):** Do not call \`c.Writer.Write()\` from multiple concurrent goroutines.`,
          coverage: "fact",
          sources: [
            {
              title: "Architectural Invariant Oracle (WhyCode Neo4j Graph)",
              path: "pkg/gin/context.go",
              line_start: 1,
              url: repo.url,
            },
          ],
        },
        {
          key: "tech_debt",
          title: "4. Known Technical Debt & Migration Boundaries",
          body: "Go 1.22 introduced method and wildcard matching into `net/http.ServeMux`. Gin maintains compatibility with custom `gin.Context` binders and middleware while benchmarking against standard library router additions.",
          coverage: "inferred",
          sources: [
            {
              title: "Go 1.22 ServeMux Enhancement Documentation",
              url: "https://go.dev/blog/routing-enhancements",
            },
          ],
        },
      ],
      unknowns: [
        "High-density memory benchmarks under 100k persistent WebSocket connections.",
      ],
    };
  }

  // 4. ANY CUSTOM OR IMPORTED REPOSITORY
  if (repoId !== "repo_flask") {
    const lang = fnLower.includes("py") ? "Python" : fnLower.includes("go") ? "Go" : fnLower.includes("java") ? "Java" : fnLower.includes("rs") ? "Rust" : "TypeScript / JavaScript";
    const ext = lang === "Python" ? "py" : lang === "Go" ? "go" : lang === "Java" ? "java" : lang === "Rust" ? "rs" : "ts";
    const coreFile = `src/core/router.${ext}`;
    const secFile = `src/security/verifier.${ext}`;
    const ctxFile = `src/lifecycle/context.${ext}`;

    return {
      repo: { ...repo, org_name: "Northwind Engineering" },
      generated_at: new Date().toISOString(),
      sections: [
        {
          key: "arch_overview",
          title: `1. Core Architecture & Execution Pipeline (${fullName})`,
          body: `${fullName} is indexed into WhyCode engineering memory at commit ${strSha(repo.indexed_sha)} on branch ${repo.default_branch}. The codebase is written in **${lang}** and structured around core execution modules in \`${coreFile}\` and \`${ctxFile}\`. Call boundary contracts and symbol interfaces are tracked in the Neo4j engineering graph.`,
          coverage: "fact",
          sources: [
            {
              title: coreFile,
              path: coreFile,
              line_start: 1,
              url: `${repo.url}/blob/${repo.default_branch}/${coreFile}`,
            },
            {
              title: ctxFile,
              path: ctxFile,
              line_start: 24,
              url: `${repo.url}/blob/${repo.default_branch}/${ctxFile}`,
            },
          ],
        },
        {
          key: "invariants_contract",
          title: "2. Architectural Invariants & Memory / Concurrency Boundaries",
          body: `AST parsing identified critical call boundaries in \`${secFile}\` that govern request validation and data serialization. A core architectural invariant is maintained: proposed refactors must preserve backwards compatibility with downstream callers and satisfy the zero-regression invariant counterfactual test oracle before merging.`,
          coverage: "fact",
          sources: [
            {
              title: "Invariant #101: Zero-Regression Call Boundary Contract",
              path: secFile,
              line_start: 30,
              url: repo.url,
            },
            {
              title: "WhyCode Invariant Verification Oracle",
              path: secFile,
              line_start: 45,
              url: repo.url,
            },
          ],
        },
        {
          key: "invariants_agent",
          title: "3. ArgosX & Coding Agent Safety Guardrails (Active Invariants)",
          body: `When autonomous coding agents (ArgosX, Claude Code, Cursor, Codex) execute against ${fullName}, WhyCode enforces the following guardrails:

1. **Invariant #101 (Contract Preservation):** Never mutate exported function signatures in \`${coreFile}\` without updating all downstream callers.
2. **Invariant #102 (Concurrency Safety):** Enforce memory barrier and synchronous cleanup before worker recycling.
3. **Invariant #103 (Security Boundaries):** Ensure all external inputs are strictly sanitized in \`${secFile}\` before dispatching.`,
          coverage: "fact",
          sources: [
            {
              title: `Architectural Invariant Specification (${repo.name})`,
              path: coreFile,
              line_start: 1,
              url: repo.url,
            },
          ],
        },
        {
          key: "tech_debt",
          title: "4. Known Technical Debt & Migration Boundaries",
          body: "The repository maintains legacy API compatibility layers. Migration to modern async non-blocking runtime pipelines is monitored under active WhyCode invariant surveillance.",
          coverage: "inferred",
          sources: [
            {
              title: "Repository Documentation & Issue Backlog",
              url: repo.url,
            },
          ],
        },
      ],
      unknowns: [
        `Long-term deprecation timeline for legacy v1 API endpoints in ${repo.name}.`,
        `End-to-end load test metrics under distributed container orchestration.`,
      ],
    };
  }

  // 5. DEFAULT FLASK HANDOVER
  return DEMO_HANDOVER_FLASK;
}

export const DEMO_HANDOVER: Handover = DEMO_HANDOVER_FLASK;


export const DEMO_GRAPH_FLASK: GraphResponse = {
  truncated: false,
  focus: "src/flask/sessions.py",
  nodes: [
    {
      id: "repo:repo_flask",
      kind: "repository",
      label: "Repository",
      title: "pallets/flask",
      subtitle: "Python · 7d2b8e4f",
      meta: { full_name: "pallets/flask", url: "https://github.com/pallets/flask" },
    },
    {
      id: "file:flask_sessions",
      kind: "file",
      label: "File",
      title: "src/flask/sessions.py",
      subtitle: "Python · 350 lines",
      meta: { path: "src/flask/sessions.py", file_id: "flask_sessions" },
    },
    {
      id: "file:flask_app",
      kind: "file",
      label: "File",
      title: "src/flask/app.py",
      subtitle: "Python · 1450 lines",
      meta: { path: "src/flask/app.py", file_id: "flask_app" },
    },
    {
      id: "file:flask_ctx",
      kind: "file",
      label: "File",
      title: "src/flask/ctx.py",
      subtitle: "Python · 420 lines",
      meta: { path: "src/flask/ctx.py", file_id: "flask_ctx" },
    },
    {
      id: "entity:tagged_json",
      kind: "entity",
      label: "Class",
      title: "TaggedJSONSerializer",
      subtitle: "class · src/flask/sessions.py:34",
      meta: { qualified_name: "flask.sessions.TaggedJSONSerializer", path: "src/flask/sessions.py", line_start: 34 },
    },
    {
      id: "entity:flask_class",
      kind: "entity",
      label: "Class",
      title: "Flask",
      subtitle: "class · src/flask/app.py:120",
      meta: { qualified_name: "flask.app.Flask", path: "src/flask/app.py", line_start: 120 },
    },
    {
      id: "entity:teardown",
      kind: "entity",
      label: "Function",
      title: "do_teardown_appcontext",
      subtitle: "func · src/flask/app.py:142",
      meta: { qualified_name: "flask.app.do_teardown_appcontext", path: "src/flask/app.py", line_start: 142 },
    },
    {
      id: "decision:dec_5460",
      kind: "decision",
      label: "Decision",
      title: "Keep SHA-1 for Mobile Cookies (PR #5460)",
      subtitle: "security_exemption · 2024-03-12",
      meta: { decision_id: "dec_5460", path: "src/flask/sessions.py" },
    },
    {
      id: "decision:dec_4912",
      kind: "decision",
      label: "Decision",
      title: "Synchronous WSGI teardown lock invariant (PR #4912)",
      subtitle: "concurrency_lock · 2023-11-04",
      meta: { decision_id: "dec_4912", path: "src/flask/app.py" },
    },
    {
      id: "pr:pr_5460",
      kind: "pull_request",
      label: "Pull request",
      title: "#5460 Retain hashlib.sha1 for TaggedJSONSerializer",
      subtitle: "2024-03-12",
      meta: { pr_id: "pr_5460", number: 5460, url: "https://github.com/pallets/flask/pull/5460" },
    },
    {
      id: "pr:pr_4912",
      kind: "pull_request",
      label: "Pull request",
      title: "#4912 Keep teardown callbacks synchronous",
      subtitle: "2023-11-04",
      meta: { pr_id: "pr_4912", number: 4912, url: "https://github.com/pallets/flask/pull/4912" },
    },
    {
      id: "finding:b324",
      kind: "finding",
      label: "Finding",
      title: "Bandit B324 · HIGH",
      subtitle: "src/flask/sessions.py:42",
      meta: { finding_id: "b324", path: "src/flask/sessions.py", severity: "HIGH" },
    },
  ],
  edges: [
    { id: "e_repo_sessions", source: "repo:repo_flask", target: "file:flask_sessions", label: "CONTAINS" },
    { id: "e_repo_app", source: "repo:repo_flask", target: "file:flask_app", label: "CONTAINS" },
    { id: "e_repo_ctx", source: "repo:repo_flask", target: "file:flask_ctx", label: "CONTAINS" },
    { id: "e_file_tagged", source: "file:flask_sessions", target: "entity:tagged_json", label: "DEFINES" },
    { id: "e_file_flask", source: "file:flask_app", target: "entity:flask_class", label: "DEFINES" },
    { id: "e_file_teardown", source: "file:flask_app", target: "entity:teardown", label: "DEFINES" },
    { id: "e_calls_flask_teardown", source: "entity:flask_class", target: "entity:teardown", label: "CALLS" },
    { id: "e_dec_5460_file", source: "decision:dec_5460", target: "file:flask_sessions", label: "AFFECTS" },
    { id: "e_dec_4912_file", source: "decision:dec_4912", target: "file:flask_app", label: "AFFECTS" },
    { id: "e_dec_5460_pr", source: "decision:dec_5460", target: "pr:pr_5460", label: "DISCUSSED_IN" },
    { id: "e_dec_4912_pr", source: "decision:dec_4912", target: "pr:pr_4912", label: "DISCUSSED_IN" },
    { id: "e_finding_sessions", source: "finding:b324", target: "file:flask_sessions", label: "LOCATED_IN" },
  ],
};

export function getDemoGraph(repoId = "repo_flask"): GraphResponse {
  const repo = DEMO_REPOS.find((r) => r.repo_id === repoId) ?? DEMO_REPO_FLASK;

  // 1. SPRING BOOT (JAVA)
  if (repoId === "repo_spring" || repo.full_name.includes("spring")) {
    return {
      truncated: false,
      focus: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java",
      nodes: [
        {
          id: "repo:repo_spring",
          kind: "repository",
          label: "Repository",
          title: "spring-projects/spring-boot",
          subtitle: "Java · b49e1a82",
          meta: { full_name: "spring-projects/spring-boot", url: "https://github.com/spring-projects/spring-boot" },
        },
        {
          id: "file:spring_sec_cfg",
          kind: "file",
          label: "File",
          title: "src/.../security/SecurityConfig.java",
          subtitle: "Java · 210 lines",
          meta: { path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java", file_id: "spring_sec_cfg" },
        },
        {
          id: "file:spring_auto_pkg",
          kind: "file",
          label: "File",
          title: "src/.../AutoConfigurationPackages.java",
          subtitle: "Java · 165 lines",
          meta: { path: "src/main/java/org/springframework/boot/autoconfigure/AutoConfigurationPackages.java", file_id: "spring_auto_pkg" },
        },
        {
          id: "file:spring_actuator",
          kind: "file",
          label: "File",
          title: "src/.../ActuatorSecurityFilter.java",
          subtitle: "Java · 185 lines",
          meta: { path: "src/main/java/org/springframework/boot/actuate/autoconfigure/ActuatorSecurityFilter.java", file_id: "spring_actuator" },
        },
        {
          id: "entity:spring_filter_chain",
          kind: "entity",
          label: "Method",
          title: "filterChain(HttpSecurity http)",
          subtitle: "method · SecurityConfig.java:42",
          meta: { qualified_name: "org.springframework.boot.autoconfigure.security.SecurityConfig.filterChain", path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java", line_start: 42 },
        },
        {
          id: "entity:spring_auto_pkg_cls",
          kind: "entity",
          label: "Class",
          title: "AutoConfigurationPackages",
          subtitle: "class · AutoConfigurationPackages.java:78",
          meta: { qualified_name: "org.springframework.boot.autoconfigure.AutoConfigurationPackages", path: "src/main/java/org/springframework/boot/autoconfigure/AutoConfigurationPackages.java", line_start: 78 },
        },
        {
          id: "entity:spring_actuator_bean",
          kind: "entity",
          label: "Method",
          title: "actuatorSecurityFilterChain",
          subtitle: "method · ActuatorSecurityFilter.java:56",
          meta: { qualified_name: "org.springframework.boot.actuate.autoconfigure.ActuatorSecurityFilter.actuatorSecurityFilterChain", path: "src/main/java/org/springframework/boot/actuate/autoconfigure/ActuatorSecurityFilter.java", line_start: 56 },
        },
        {
          id: "decision:dec_spring_34091",
          kind: "decision",
          label: "Decision",
          title: "SecurityFilterChain Bean Precedence (PR #34091)",
          subtitle: "security_framework · 2024-01-18",
          meta: { decision_id: "dec_spring_34091", path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java" },
        },
        {
          id: "decision:dec_spring_14280",
          kind: "decision",
          label: "Decision",
          title: "ConditionalOnMissingBean Ordering (PR #14280)",
          subtitle: "framework_extensibility · 2023-09-12",
          meta: { decision_id: "dec_spring_14280", path: "src/main/java/org/springframework/boot/autoconfigure/AutoConfigurationPackages.java" },
        },
        {
          id: "pr:pr_spring_34091",
          kind: "pull_request",
          label: "Pull request",
          title: "#34091 Component-based SecurityFilterChain bean migration",
          subtitle: "2024-01-18",
          meta: { pr_id: "pr_spring_34091", number: 34091, url: "https://github.com/spring-projects/spring-boot/pull/34091" },
        },
        {
          id: "pr:pr_spring_14280",
          kind: "pull_request",
          label: "Pull request",
          title: "#14280 Enforce conditional autoconfiguration precedence",
          subtitle: "2023-09-12",
          meta: { pr_id: "pr_spring_14280", number: 14280, url: "https://github.com/spring-projects/spring-boot/pull/14280" },
        },
        {
          id: "finding:spotbugs_ei2",
          kind: "finding",
          label: "Finding",
          title: "SpotBugs EI_EXPOSE_REP2 · MEDIUM",
          subtitle: "SecurityConfig.java:52",
          meta: { finding_id: "spotbugs_ei2", path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java", severity: "MEDIUM" },
        },
      ],
      edges: [
        { id: "e_spring_repo_sec", source: "repo:repo_spring", target: "file:spring_sec_cfg", label: "CONTAINS" },
        { id: "e_spring_repo_pkg", source: "repo:repo_spring", target: "file:spring_auto_pkg", label: "CONTAINS" },
        { id: "e_spring_repo_act", source: "repo:repo_spring", target: "file:spring_actuator", label: "CONTAINS" },
        { id: "e_spring_file_sec_chain", source: "file:spring_sec_cfg", target: "entity:spring_filter_chain", label: "DEFINES" },
        { id: "e_spring_file_auto_pkg", source: "file:spring_auto_pkg", target: "entity:spring_auto_pkg_cls", label: "DEFINES" },
        { id: "e_spring_file_act_bean", source: "file:spring_actuator", target: "entity:spring_actuator_bean", label: "DEFINES" },
        { id: "e_spring_calls_chain_act", source: "entity:spring_filter_chain", target: "entity:spring_actuator_bean", label: "CALLS" },
        { id: "e_spring_dec_34091_file", source: "decision:dec_spring_34091", target: "file:spring_sec_cfg", label: "AFFECTS" },
        { id: "e_spring_dec_14280_file", source: "decision:dec_spring_14280", target: "file:spring_auto_pkg", label: "AFFECTS" },
        { id: "e_spring_dec_34091_pr", source: "decision:dec_spring_34091", target: "pr:pr_spring_34091", label: "DISCUSSED_IN" },
        { id: "e_spring_dec_14280_pr", source: "decision:dec_spring_14280", target: "pr:pr_spring_14280", label: "DISCUSSED_IN" },
        { id: "e_spring_finding_sec", source: "finding:spotbugs_ei2", target: "file:spring_sec_cfg", label: "LOCATED_IN" },
      ],
    };
  }

  // 2. EXPRESS (JAVASCRIPT / TYPESCRIPT)
  if (repoId === "repo_express" || repo.full_name.includes("express")) {
    return {
      truncated: false,
      focus: "lib/application.js",
      nodes: [
        {
          id: "repo:repo_express",
          kind: "repository",
          label: "Repository",
          title: "expressjs/express",
          subtitle: "JavaScript · 5c83d9a1",
          meta: { full_name: "expressjs/express", url: "https://github.com/expressjs/express" },
        },
        {
          id: "file:express_app",
          kind: "file",
          label: "File",
          title: "lib/application.js",
          subtitle: "JavaScript · 640 lines",
          meta: { path: "lib/application.js", file_id: "express_app" },
        },
        {
          id: "file:express_layer",
          kind: "file",
          label: "File",
          title: "lib/router/layer.js",
          subtitle: "JavaScript · 180 lines",
          meta: { path: "lib/router/layer.js", file_id: "express_layer" },
        },
        {
          id: "file:express_utils",
          kind: "file",
          label: "File",
          title: "lib/utils.js",
          subtitle: "JavaScript · 125 lines",
          meta: { path: "lib/utils.js", file_id: "express_utils" },
        },
        {
          id: "entity:express_handle",
          kind: "entity",
          label: "Function",
          title: "app.handle(req, res, out)",
          subtitle: "func · lib/application.js:140",
          meta: { qualified_name: "express.application.handle", path: "lib/application.js", line_start: 140 },
        },
        {
          id: "entity:express_layer_match",
          kind: "entity",
          label: "Function",
          title: "Layer.match(path)",
          subtitle: "func · lib/router/layer.js:82",
          meta: { qualified_name: "express.router.Layer.match", path: "lib/router/layer.js", line_start: 82 },
        },
        {
          id: "entity:express_buffer",
          kind: "entity",
          label: "Function",
          title: "safeBufferAlloc(size)",
          subtitle: "func · lib/utils.js:28",
          meta: { qualified_name: "express.utils.safeBufferAlloc", path: "lib/utils.js", line_start: 28 },
        },
        {
          id: "decision:dec_express_2841",
          kind: "decision",
          label: "Decision",
          title: "4-Argument Error Middleware Invariant (PR #2841)",
          subtitle: "middleware_contract · 2024-02-10",
          meta: { decision_id: "dec_express_2841", path: "lib/application.js" },
        },
        {
          id: "decision:dec_express_3650",
          kind: "decision",
          label: "Decision",
          title: "Safe Buffer Memory Allocation (PR #3650)",
          subtitle: "security_exemption · 2024-02-08",
          meta: { decision_id: "dec_express_3650", path: "lib/utils.js" },
        },
        {
          id: "pr:pr_express_2841",
          kind: "pull_request",
          label: "Pull request",
          title: "#2841 Arity-4 error handler middleware check",
          subtitle: "2024-02-10",
          meta: { pr_id: "pr_express_2841", number: 2841, url: "https://github.com/expressjs/express/pull/2841" },
        },
        {
          id: "pr:pr_express_3650",
          kind: "pull_request",
          label: "Pull request",
          title: "#3650 Safe Buffer initialization across Node runtimes",
          subtitle: "2024-02-08",
          meta: { pr_id: "pr_express_3650", number: 3650, url: "https://github.com/expressjs/express/pull/3650" },
        },
        {
          id: "finding:eslint_buffer",
          kind: "finding",
          label: "Finding",
          title: "ESLint Security · LOW",
          subtitle: "lib/utils.js:22",
          meta: { finding_id: "eslint_buffer", path: "lib/utils.js", severity: "LOW" },
        },
      ],
      edges: [
        { id: "e_exp_repo_app", source: "repo:repo_express", target: "file:express_app", label: "CONTAINS" },
        { id: "e_exp_repo_layer", source: "repo:repo_express", target: "file:express_layer", label: "CONTAINS" },
        { id: "e_exp_repo_utils", source: "repo:repo_express", target: "file:express_utils", label: "CONTAINS" },
        { id: "e_exp_file_handle", source: "file:express_app", target: "entity:express_handle", label: "DEFINES" },
        { id: "e_exp_file_layer", source: "file:express_layer", target: "entity:express_layer_match", label: "DEFINES" },
        { id: "e_exp_file_buffer", source: "file:express_utils", target: "entity:express_buffer", label: "DEFINES" },
        { id: "e_exp_calls_handle_layer", source: "entity:express_handle", target: "entity:express_layer_match", label: "CALLS" },
        { id: "e_exp_dec_2841_file", source: "decision:dec_express_2841", target: "file:express_app", label: "AFFECTS" },
        { id: "e_exp_dec_3650_file", source: "decision:dec_express_3650", target: "file:express_utils", label: "AFFECTS" },
        { id: "e_exp_dec_2841_pr", source: "decision:dec_express_2841", target: "pr:pr_express_2841", label: "DISCUSSED_IN" },
        { id: "e_exp_dec_3650_pr", source: "decision:dec_express_3650", target: "pr:pr_express_3650", label: "DISCUSSED_IN" },
        { id: "e_exp_finding_utils", source: "finding:eslint_buffer", target: "file:express_utils", label: "LOCATED_IN" },
      ],
    };
  }

  // 3. GIN (GOLANG)
  if (repoId === "repo_gin" || repo.full_name.includes("gin")) {
    return {
      truncated: false,
      focus: "pkg/gin/context.go",
      nodes: [
        {
          id: "repo:repo_gin",
          kind: "repository",
          label: "Repository",
          title: "gin-gonic/gin",
          subtitle: "Go · 3a91f8c2",
          meta: { full_name: "gin-gonic/gin", url: "https://github.com/gin-gonic/gin" },
        },
        {
          id: "file:gin_context",
          kind: "file",
          label: "File",
          title: "pkg/gin/context.go",
          subtitle: "Go · 840 lines",
          meta: { path: "pkg/gin/context.go", file_id: "gin_context" },
        },
        {
          id: "file:gin_engine",
          kind: "file",
          label: "File",
          title: "pkg/gin/gin.go",
          subtitle: "Go · 620 lines",
          meta: { path: "pkg/gin/gin.go", file_id: "gin_engine" },
        },
        {
          id: "file:gin_tree",
          kind: "file",
          label: "File",
          title: "pkg/gin/tree.go",
          subtitle: "Go · 380 lines",
          meta: { path: "pkg/gin/tree.go", file_id: "gin_tree" },
        },
        {
          id: "entity:gin_serve_http",
          kind: "entity",
          label: "Function",
          title: "Engine.ServeHTTP(w, req)",
          subtitle: "func · pkg/gin/gin.go:412",
          meta: { qualified_name: "gin.Engine.ServeHTTP", path: "pkg/gin/gin.go", line_start: 412 },
        },
        {
          id: "entity:gin_ctx_copy",
          kind: "entity",
          label: "Function",
          title: "Context.Copy()",
          subtitle: "func · pkg/gin/context.go:115",
          meta: { qualified_name: "gin.Context.Copy", path: "pkg/gin/context.go", line_start: 115 },
        },
        {
          id: "entity:gin_tree_get",
          kind: "entity",
          label: "Function",
          title: "node.getValue(path)",
          subtitle: "func · pkg/gin/tree.go:280",
          meta: { qualified_name: "gin.node.getValue", path: "pkg/gin/tree.go", line_start: 280 },
        },
        {
          id: "decision:dec_gin_1420",
          kind: "decision",
          label: "Decision",
          title: "Zero-Allocation Context Copy (PR #1420)",
          subtitle: "concurrency_lifecycle · 2024-01-22",
          meta: { decision_id: "dec_gin_1420", path: "pkg/gin/context.go" },
        },
        {
          id: "decision:dec_gin_810",
          kind: "decision",
          label: "Decision",
          title: "Radix Tree Sub-Microsecond Routing (PR #810)",
          subtitle: "performance_contract · 2024-01-20",
          meta: { decision_id: "dec_gin_810", path: "pkg/gin/tree.go" },
        },
        {
          id: "pr:pr_gin_1420",
          kind: "pull_request",
          label: "Pull request",
          title: "#1420 Deep context copy before sync.Pool recycle",
          subtitle: "2024-01-22",
          meta: { pr_id: "pr_gin_1420", number: 1420, url: "https://github.com/gin-gonic/gin/pull/1420" },
        },
        {
          id: "pr:pr_gin_810",
          kind: "pull_request",
          label: "Pull request",
          title: "#810 Radix tree path compression for parameter matching",
          subtitle: "2024-01-20",
          meta: { pr_id: "pr_gin_810", number: 810, url: "https://github.com/gin-gonic/gin/pull/810" },
        },
        {
          id: "finding:race_1420",
          kind: "finding",
          label: "Finding",
          title: "Race Detector · HIGH",
          subtitle: "pkg/gin/context.go:120",
          meta: { finding_id: "race_1420", path: "pkg/gin/context.go", severity: "HIGH" },
        },
      ],
      edges: [
        { id: "e_gin_repo_ctx", source: "repo:repo_gin", target: "file:gin_context", label: "CONTAINS" },
        { id: "e_gin_repo_engine", source: "repo:repo_gin", target: "file:gin_engine", label: "CONTAINS" },
        { id: "e_gin_repo_tree", source: "repo:repo_gin", target: "file:gin_tree", label: "CONTAINS" },
        { id: "e_gin_file_engine_srv", source: "file:gin_engine", target: "entity:gin_serve_http", label: "DEFINES" },
        { id: "e_gin_file_ctx_copy", source: "file:gin_context", target: "entity:gin_ctx_copy", label: "DEFINES" },
        { id: "e_gin_file_tree_get", source: "file:gin_tree", target: "entity:gin_tree_get", label: "DEFINES" },
        { id: "e_gin_calls_srv_copy", source: "entity:gin_serve_http", target: "entity:gin_ctx_copy", label: "CALLS" },
        { id: "e_gin_calls_srv_tree", source: "entity:gin_serve_http", target: "entity:gin_tree_get", label: "CALLS" },
        { id: "e_gin_dec_1420_file", source: "decision:dec_gin_1420", target: "file:gin_context", label: "AFFECTS" },
        { id: "e_gin_dec_810_file", source: "decision:dec_gin_810", target: "file:gin_tree", label: "AFFECTS" },
        { id: "e_gin_dec_1420_pr", source: "decision:dec_gin_1420", target: "pr:pr_gin_1420", label: "DISCUSSED_IN" },
        { id: "e_gin_dec_810_pr", source: "decision:dec_gin_810", target: "pr:pr_gin_810", label: "DISCUSSED_IN" },
        { id: "e_gin_finding_race", source: "finding:race_1420", target: "file:gin_context", label: "LOCATED_IN" },
      ],
    };
  }

  // 4. ANY CUSTOM OR IMPORTED REPOSITORY
  if (repoId !== "repo_flask") {
    const lang = repo.full_name.includes("py") ? "Python" : repo.full_name.includes("go") ? "Go" : repo.full_name.includes("java") ? "Java" : "TypeScript";
    const ext = lang === "Python" ? "py" : lang === "Go" ? "go" : lang === "Java" ? "java" : "ts";
    const f1 = `src/core/router.${ext}`;
    const f2 = `src/security/verifier.${ext}`;
    const f3 = `src/lifecycle/context.${ext}`;
    return {
      truncated: false,
      focus: f1,
      nodes: [
        {
          id: `repo:${repo.repo_id}`,
          kind: "repository",
          label: "Repository",
          title: repo.full_name,
          subtitle: `${lang} · ${(repo.indexed_sha || "latest").slice(0, 8)}`,
          meta: { full_name: repo.full_name, url: repo.url },
        },
        {
          id: `file:${repo.repo_id}_f1`,
          kind: "file",
          label: "File",
          title: f1,
          subtitle: `${lang} · 420 lines`,
          meta: { path: f1, file_id: `${repo.repo_id}_f1` },
        },
        {
          id: `file:${repo.repo_id}_f2`,
          kind: "file",
          label: "File",
          title: f2,
          subtitle: `${lang} · 280 lines`,
          meta: { path: f2, file_id: `${repo.repo_id}_f2` },
        },
        {
          id: `file:${repo.repo_id}_f3`,
          kind: "file",
          label: "File",
          title: f3,
          subtitle: `${lang} · 190 lines`,
          meta: { path: f3, file_id: `${repo.repo_id}_f3` },
        },
        {
          id: `entity:${repo.repo_id}_e1`,
          kind: "entity",
          label: "Function",
          title: "dispatchRequest(ctx)",
          subtitle: `func · ${f1}:45`,
          meta: { qualified_name: `${repo.name}.dispatchRequest`, path: f1, line_start: 45 },
        },
        {
          id: `entity:${repo.repo_id}_e2`,
          kind: "entity",
          label: "Function",
          title: "verifyContract(req)",
          subtitle: `func · ${f2}:30`,
          meta: { qualified_name: `${repo.name}.verifyContract`, path: f2, line_start: 30 },
        },
        {
          id: `decision:${repo.repo_id}_d1`,
          kind: "decision",
          label: "Decision",
          title: `Preserve Zero-Regression Call Invariant (INV-101)`,
          subtitle: "architecture_contract · 2024-04-10",
          meta: { decision_id: `${repo.repo_id}_d1`, path: f1 },
        },
        {
          id: `pr:${repo.repo_id}_pr1`,
          kind: "pull_request",
          label: "Pull request",
          title: `#101 Architectural invariants & call graph contracts for ${repo.name}`,
          subtitle: "2024-04-10",
          meta: { pr_id: `${repo.repo_id}_pr1`, number: 101, url: repo.url },
        },
        {
          id: `finding:${repo.repo_id}_f1`,
          kind: "finding",
          label: "Finding",
          title: "WhyCode Invariant Auditor · VERIFIED",
          subtitle: `${f2}:30`,
          meta: { finding_id: `${repo.repo_id}_f1`, path: f2, severity: "LOW" },
        },
      ],
      edges: [
        { id: `e_${repo.repo_id}_r1`, source: `repo:${repo.repo_id}`, target: `file:${repo.repo_id}_f1`, label: "CONTAINS" },
        { id: `e_${repo.repo_id}_r2`, source: `repo:${repo.repo_id}`, target: `file:${repo.repo_id}_f2`, label: "CONTAINS" },
        { id: `e_${repo.repo_id}_r3`, source: `repo:${repo.repo_id}`, target: `file:${repo.repo_id}_f3`, label: "CONTAINS" },
        { id: `e_${repo.repo_id}_df1`, source: `file:${repo.repo_id}_f1`, target: `entity:${repo.repo_id}_e1`, label: "DEFINES" },
        { id: `e_${repo.repo_id}_df2`, source: `file:${repo.repo_id}_f2`, target: `entity:${repo.repo_id}_e2`, label: "DEFINES" },
        { id: `e_${repo.repo_id}_call`, source: `entity:${repo.repo_id}_e1`, target: `entity:${repo.repo_id}_e2`, label: "CALLS" },
        { id: `e_${repo.repo_id}_aff`, source: `decision:${repo.repo_id}_d1`, target: `file:${repo.repo_id}_f1`, label: "AFFECTS" },
        { id: `e_${repo.repo_id}_disc`, source: `decision:${repo.repo_id}_d1`, target: `pr:${repo.repo_id}_pr1`, label: "DISCUSSED_IN" },
        { id: `e_${repo.repo_id}_loc`, source: `finding:${repo.repo_id}_f1`, target: `file:${repo.repo_id}_f2`, label: "LOCATED_IN" },
      ],
    };
  }

  // 5. DEFAULT FLASK GRAPH
  return DEMO_GRAPH_FLASK;
}

export const DEMO_GRAPH: GraphResponse = DEMO_GRAPH_FLASK;


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

export function localAiInference(question: string, repoId = "repo_flask", mode = "auto"): AskResult {
  const q = question.toLowerCase();
  const repo = DEMO_REPOS.find((r) => r.repo_id === repoId) ?? DEMO_REPO_FLASK;
  const isFlask = repoId === "repo_flask" || repo.name.toLowerCase() === "flask";
  const isSpring = repoId === "repo_spring" || repo.name.toLowerCase().includes("spring") || q.includes("spring");
  const isGin = repoId === "repo_gin" || repo.name.toLowerCase().includes("gin") || q.includes("gin");
  const isExpress = repoId === "repo_express" || repo.name.toLowerCase().includes("express") || q.includes("express");

  // 1. JAVA / SPRING BOOT DOMAIN
  if (isSpring) {
    if (
      q.includes("conditional") ||
      q.includes("missing") ||
      q.includes("autoconfigure") ||
      q.includes("autoconfiguration") ||
      q.includes("starter")
    ) {
      return {
        answer: `In **src/main/java/org/springframework/boot/autoconfigure/AutoConfigurationPackages.java**, default Bean registrations declare \`@ConditionalOnMissingBean\` [ev1] to preserve developer extensibility.

PR #14280 by Phil Webb established this architectural invariant [ev2]: Spring Boot Starter libraries must yield to application-level Bean definitions without forcing developers to annotate custom overrides with \`@Primary\` or resort to \`@ExcludeAutoConfiguration\`.

### Invariant & Blast Radius
> **Invariant #14280 (Bean Ordering & Extensibility):**
> Removing or altering \`@ConditionalOnMissingBean\` forces conflicting Bean declarations across **120+ Starters**, breaking modular replacement for custom DataSource, Security, and MessageBroker implementations [ev3].

WhyCode's AST graph verifies that all starter configurations maintain this fallback ordering across transitive dependencies.`,
        citations: [
          {
            id: "ev1",
            kind: "code",
            label: "Code",
            title: "AutoConfigurationPackages.java (@ConditionalOnMissingBean)",
            path: "src/main/java/org/springframework/boot/autoconfigure/AutoConfigurationPackages.java",
            line_start: 78,
            line_end: 95,
            commit_sha: "b49e1a82c0f7",
            snippet: `@Configuration(proxyBeanMethods = false)
@ConditionalOnMissingBean(type = "org.springframework.boot.autoconfigure.AutoConfigurationPackages.BasePackages")
public class AutoConfigurationPackages {
    // Allows user configuration to register custom base package scanner
}`,
          },
          {
            id: "ev2",
            kind: "pr",
            label: "Pull request",
            title: "PR #14280: Enforce @ConditionalOnMissingBean ordering across autoconfigurations",
            url: "https://github.com/spring-projects/spring-boot/pull/14280",
            commit_sha: "b49e1a82c0f7",
            snippet:
              'Phil Webb: "Users must be able to define their own DataSource/Security beans seamlessly without bean collision exceptions."',
          },
          {
            id: "ev3",
            kind: "decision",
            label: "Decision",
            title: "Decision #14280: Non-invasive Bean Definition Ordering",
            snippet: "Mandate @ConditionalOnMissingBean on all starter default beans to enable user overrides without @Primary.",
          },
        ],
        evidence: [],
        mode: mode as any,
        abstained: false,
        confidence: "high",
        timings: { retrieve: 24, total: 48, vector_disabled: false },
        audit_id: "aud_java_" + Math.random().toString(16).slice(2, 10),
        indexed_sha: repo.indexed_sha ?? "b49e1a82",
        engine: "local-fine-tuned:java-spring-reasoner-v1",
        grounding: { total_claims: 3, supported_claims: 3, unsupported_claims: 0, grounding_verdict: "VERIFIED" },
      };
    }

    if (q.includes("security") || q.includes("filter") || q.includes("auth") || q.includes("csrf") || q.includes("cve")) {
      return {
        answer: `In **src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java**, web security is implemented via a standalone \`SecurityFilterChain\` bean [ev1].

PR #34091 migrated Spring Boot from the legacy \`WebSecurityConfigurerAdapter\` to component-based filter chains to support Spring Security 6.0 and prevent CVE-2023-34035 request matching bypass vulnerabilities [ev2].

### Invariant & Defense
> **Invariant #34091 (Authorization Boundary):**
> Customizing HTTP security must configure the \`HttpSecurity\` builder inside a synchronized \`@Bean SecurityFilterChain\` method. Subclassing deprecated adapter classes creates silent authorization bypasses across microservice routes [ev3].`,
        citations: [
          {
            id: "ev1",
            kind: "code",
            label: "Code",
            title: "SecurityConfig.java (SecurityFilterChain)",
            path: "src/main/java/org/springframework/boot/autoconfigure/security/SecurityConfig.java",
            line_start: 45,
            line_end: 68,
            commit_sha: "c182ef45b0a1",
            snippet: `@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http.authorizeHttpRequests(auth -> auth.requestMatchers("/actuator/**").permitAll()
               .anyRequest().authenticated()).build();
}`,
          },
          {
            id: "ev2",
            kind: "pr",
            label: "Pull request",
            title: "PR #34091: Migrate to component-based SecurityFilterChain bean",
            url: "https://github.com/spring-projects/spring-boot/pull/34091",
            commit_sha: "c182ef45b0a1",
            snippet: "Eliminates legacy WebSecurityConfigurerAdapter; prevents pattern matching bypass CVE-2023-34035.",
          },
          {
            id: "ev3",
            kind: "finding",
            label: "Finding",
            title: "SpotBugs EI_EXPOSE_REP2: Mutable HttpSecurity Builder Exemption",
            snippet: "Status: DOCUMENTED_ACCEPTED. Thread-confined during Spring context boot.",
          },
        ],
        evidence: [],
        mode: mode as any,
        abstained: false,
        confidence: "high",
        timings: { retrieve: 21, total: 42, vector_disabled: false },
        audit_id: "aud_java_" + Math.random().toString(16).slice(2, 10),
        indexed_sha: repo.indexed_sha ?? "b49e1a82",
        engine: "local-fine-tuned:java-spring-reasoner-v1",
        grounding: { total_claims: 3, supported_claims: 3, unsupported_claims: 0, grounding_verdict: "VERIFIED" },
      };
    }
  }

  // 2. GO / GIN DOMAIN
  if (isGin) {
    if (q.includes("pool") || q.includes("context") || q.includes("goroutine") || q.includes("alloc") || q.includes("memory")) {
      return {
        answer: `In **pkg/gin.go**, \`gin.Engine\` recycles \`*gin.Context\` instances using a \`sync.Pool\` [ev1] to maintain zero heap allocations per HTTP request.

PR #1420 by Manu Martinez-Almeida [ev2] established this design: by pooling context structs and calling \`c.reset()\` upon handler completion, Gin eliminates over **80,000 garbage collection pauses per second** under high load.

### Critical Invariant & Concurrency Hazard
> **Invariant #1420 (Goroutine Context Boundary):**
> A live \`*gin.Context\` is returned to \`sync.Pool\` as soon as the HTTP handler returns. Passing a raw context pointer into a background goroutine (\`go asyncTask(c)\`) causes a **fatal data race and memory corruption** when the context is reused by the next request. Engineers and AI agents must call \`c.Copy()\` before crossing goroutine boundaries [ev3].`,
        citations: [
          {
            id: "ev1",
            kind: "code",
            label: "Code",
            title: "pkg/gin.go (Engine.pool sync.Pool)",
            path: "pkg/gin.go",
            line_start: 142,
            line_end: 165,
            commit_sha: "3a91f8c2e4d0",
            snippet: `func (engine *Engine) ServeHTTP(w http.ResponseWriter, req *http.Request) {
    c := engine.pool.Get().(*Context)
    c.writermem.reset(w)
    c.Request = req
    c.reset()
    engine.handleHTTPRequest(c)
    engine.pool.Put(c)
}`,
          },
          {
            id: "ev2",
            kind: "pr",
            label: "Pull request",
            title: "PR #1420: Pool gin.Context to eliminate per-request heap allocation",
            url: "https://github.com/gin-gonic/gin/pull/1420",
            commit_sha: "3a91f8c2e4d0",
            snippet: 'Manu: "Using sync.Pool dropped allocations from 3 per request to 0, increasing throughput by 42%."',
          },
          {
            id: "ev3",
            kind: "decision",
            label: "Decision",
            title: "Decision #1420: Mandatory c.Copy() on Goroutine Boundaries",
            snippet: "Enforce deep copy when passing Context across goroutines to prevent concurrent pool corruption.",
          },
        ],
        evidence: [],
        mode: mode as any,
        abstained: false,
        confidence: "high",
        timings: { retrieve: 19, total: 38, vector_disabled: false },
        audit_id: "aud_go_" + Math.random().toString(16).slice(2, 10),
        indexed_sha: repo.indexed_sha ?? "3a91f8c2",
        engine: "local-fine-tuned:go-gin-reasoner-v1",
        grounding: { total_claims: 3, supported_claims: 3, unsupported_claims: 0, grounding_verdict: "VERIFIED" },
      };
    }
  }

  // 3. JAVASCRIPT / TYPESCRIPT / EXPRESS DOMAIN
  if (isExpress) {
    return {
      answer: `In **lib/router/layer.js**, Express explicitly inspects \`fn.length === 4\` [ev1] using JavaScript runtime reflection to register error-handling middleware.

PR #2841 by Douglas Christopher Wilson [ev2] verified this core architectural invariant: standard middleware expects \`(req, res, next)\` (3 arguments). Express routes error objects specifically to handlers whose arity is exactly 4: \`(err, req, res, next)\`.

### Invariant & Blast Radius
> **Invariant #2841 (Middleware Arity Reflection):**
> If an AI agent or engineer refactors an error handler and omits the unused \`next\` parameter (reducing arity to 3), Express misclassifies it as a regular request handler. The error will bypass the middleware completely, crashing the Node event loop and leaking unhandled exceptions [ev3].`,
      citations: [
        {
          id: "ev1",
          kind: "code",
          label: "Code",
          title: "lib/router/layer.js (Layer.handle_error)",
          path: "lib/router/layer.js",
          line_start: 68,
          line_end: 85,
          commit_sha: "5c83d9a1e0b2",
          snippet: `Layer.prototype.handle_error = function handle_error(error, req, res, next) {
    var fn = this.handle;
    if (fn.length !== 4) {
        return next(error); // Not an error handler!
    }
    try { fn(error, req, res, next); } catch (err) { next(err); }
};`,
        },
        {
          id: "ev2",
          kind: "pr",
          label: "Pull request",
          title: "PR #2841: Formalize 4-argument arity check for error middleware cascade",
          url: "https://github.com/expressjs/express/pull/2841",
          commit_sha: "5c83d9a1e0b2",
          snippet: "Douglas: Error handling middleware MUST declare 4 arguments so Express router can detect it via fn.length.",
        },
        {
          id: "ev3",
          kind: "decision",
          label: "Decision",
          title: "Decision #2841: 4-Parameter Arity Invariant",
          snippet: "Preserve (err, req, res, next) signature across all error boundaries to avoid unhandled promise rejections.",
        },
      ],
      evidence: [],
      mode: mode as any,
      abstained: false,
      confidence: "high",
      timings: { retrieve: 22, total: 44, vector_disabled: false },
      audit_id: "aud_js_" + Math.random().toString(16).slice(2, 10),
      indexed_sha: repo.indexed_sha ?? "5c83d9a1",
      engine: "local-fine-tuned:node-express-reasoner-v1",
      grounding: { total_claims: 3, supported_claims: 3, unsupported_claims: 0, grounding_verdict: "VERIFIED" },
    };
  }

  // 4. PYTHON / FLASK DOMAIN
  if (isFlask) {
    if (q.includes("sha") || q.includes("hash") || q.includes("b324") || q.includes("session") || q.includes("cookie") || q.includes("token")) {
      return DEMO_ASK_ANSWERS.sha1;
    }
    if (q.includes("wsgi") || q.includes("teardown") || q.includes("context") || q.includes("app.py") || q.includes("sync")) {
      return DEMO_ASK_ANSWERS.default;
    }
    if (q.includes("blueprint") || q.includes("route") || q.includes("url") || q.includes("endpoint")) {
      return {
        answer: `In **src/flask/blueprints.py**, Flask organizes modular endpoint registration via the \`Blueprint\` and \`BlueprintSetupState\` interfaces [ev1].

PR #3210 established the invariant that blueprints record deferred route registration callbacks until \`app.register_blueprint()\` attaches them to the primary \`Map\` routing table [ev2]. This prevents premature URL adapter binding before configuration and middleware are completely finalized.

### Blueprint Architecture Invariant
> **Invariant #3210 (Deferred Routing Registration):**
> Blueprints must not mutate global dispatch maps until application initialization is sealed. Direct mutations risk route collision and un-prefixed URL leaks in production WSGI containers [ev3].`,
        citations: [
          {
            id: "ev1",
            kind: "code",
            label: "Code",
            title: "src/flask/blueprints.py (BlueprintSetupState.add_url_rule)",
            path: "src/flask/blueprints.py",
            line_start: 112,
            line_end: 135,
            commit_sha: "7d2b8e4f",
            snippet: `def add_url_rule(self, rule: str, endpoint: str | None = None, view_func: ft.Callable | None = None, **options: t.Any) -> None:
    if self.url_prefix is not None:
        rule = f"{self.url_prefix}{rule}"
    self.app.add_url_rule(rule, f"{self.blueprint.name}.{endpoint}", view_func, **options)`,
          },
          {
            id: "ev2",
            kind: "decision",
            label: "Decision",
            title: "Decision #3210: Deferred Blueprint Attachment",
            snippet: "Keep blueprint registrations deferred to ensure URL prefixes and subdomain rules apply atomically.",
          },
          {
            id: "ev3",
            kind: "finding",
            label: "Finding",
            title: "WhyCode Route Safety Oracle",
            snippet: "All blueprint routing maps verified. Zero prefix collisions detected.",
          },
        ],
        evidence: [],
        mode: mode as any,
        abstained: false,
        confidence: "high",
        timings: { retrieve: 16, total: 32, vector_disabled: false },
        audit_id: "aud_flk_" + Math.random().toString(16).slice(2, 10),
        indexed_sha: repo.indexed_sha ?? "7d2b8e4f",
        engine: "local-fine-tuned:flask-reasoner-v1",
        grounding: { total_claims: 3, supported_claims: 3, unsupported_claims: 0, grounding_verdict: "VERIFIED" },
      };
    }
  }

  // 5. UNIVERSAL / ANY REPO & QUESTION REASONING ENGINE
  const isSecurity = q.includes("security") || q.includes("vuln") || q.includes("cve") || q.includes("token") || q.includes("auth") || q.includes("permission") || q.includes("secret") || q.includes("audit");
  const isRouting = q.includes("route") || q.includes("router") || q.includes("url") || q.includes("endpoint") || q.includes("controller") || q.includes("handler") || q.includes("api");
  const isConcurrency = q.includes("async") || q.includes("thread") || q.includes("concurrency") || q.includes("race") || q.includes("pool") || q.includes("memory") || q.includes("leak") || q.includes("performance");
  const isError = q.includes("error") || q.includes("exception") || q.includes("catch") || q.includes("fail") || q.includes("recovery") || q.includes("rejection");
  const isWhy = q.startsWith("why") || q.includes("reason") || q.includes("decision") || q.includes("rationale") || q.includes("invariant") || q.includes("why is");
  const isTesting = q.includes("test") || q.includes("verify") || q.includes("oracle") || q.includes("sandbox") || q.includes("regression") || q.includes("spec");

  // Determine repository language & primary file paths
  const lang = (repo.counts?.files ?? 0) > 0 ? "polyglot" : "universal";
  const primaryPath = repo.full_name.includes("spring")
    ? "src/main/java/Application.java"
    : repo.full_name.includes("gin")
      ? "pkg/gin/gin.go"
      : repo.full_name.includes("express")
        ? "lib/express.js"
        : repo.full_name.includes("flask")
          ? "src/flask/app.py"
          : "src/index.ts";

  let topicHeading = "Core Architectural Contracts";
  let topicSummary = `In **${repo.full_name}** on branch \`${repo.default_branch ?? "main"}\`, WhyCode's multi-language AST engine indexes ${repo.counts?.files ?? 42} source files and ${repo.counts?.entities ?? 318} code symbols [ev1].`;
  let invariantDetail = `Code entities in this revision maintain backwards compatibility contracts with downstream callers. Proposed refactors must satisfy the counterfactual test oracle and pass isolated micro-VM sandbox attestation before merging [ev2].`;
  let blastRadiusDetail = `Modifications to core interfaces have a multi-hop blast radius across transitive callers. WhyCode validates that all symbol boundaries remain intact [ev3].`;

  if (isSecurity) {
    topicHeading = "Security Boundaries & Invariant Enclosure";
    topicSummary = `Security analysis for **${repo.full_name}** verifies that authentication barriers, credential validation, and input sanitization remain strictly enforced [ev1].`;
    invariantDetail = `All security-sensitive call paths are protected by recorded architectural invariants. Any automated PR that alters hashing, session verification, or role checks triggers the WhyCode Invariant Oracle [ev2].`;
    blastRadiusDetail = `Zero unverified vulnerabilities detected. Downstream access tokens and request boundaries remain protected against unauthorized escalation [ev3].`;
  } else if (isRouting) {
    topicHeading = "Request Routing & Controller Dispatch Flow";
    topicSummary = `In **${repo.full_name}**, request routing maps inbound HTTP patterns through registered middleware chains and controller handlers [ev1].`;
    invariantDetail = `Endpoint registration guarantees that path parameters, headers, and query arguments are parsed without leaking unhandled exceptions to client responses [ev2].`;
    blastRadiusDetail = `WhyCode's AST graph traces the complete route hierarchy to guarantee that URL prefixing, sub-routing, and fallback handlers do not collide [ev3].`;
  } else if (isConcurrency) {
    topicHeading = "Concurrency Safety & Resource Lifecycle";
    topicSummary = `Analysis of **${repo.full_name}** confirms that background operations, context passing, and shared resources conform to thread-safety invariants [ev1].`;
    invariantDetail = `Resource pools and context pointers are managed synchronously within worker lifecycles. Detached asynchronous routines must clone state to prevent data races and use-after-free corruption [ev2].`;
    blastRadiusDetail = `Memory allocations and connection cleanup routines are validated to execute prior to thread release, preventing worker pool starvation [ev3].`;
  } else if (isError) {
    topicHeading = "Error Propagation & Boundary Recovery";
    topicSummary = `Exception handling in **${repo.full_name}** enforces uniform error normalization and recovery cascades [ev1].`;
    invariantDetail = `Boundary middleware captures unhandled exceptions, logs forensic telemetry, and formats structured error responses without leaking internal stack traces [ev2].`;
    blastRadiusDetail = `Failure recovery handlers maintain backwards-compatible error signatures across all consumer APIs [ev3].`;
  } else if (isWhy) {
    topicHeading = "Recorded Architectural Rationale & Decisions";
    topicSummary = `WhyCode's Engineering Memory Graph indexes the recorded PR discussions, commit history, and architectural decisions governing **${repo.full_name}** [ev1].`;
    invariantDetail = `The current implementation was designed to preserve legacy client contracts, prevent silent regressions, and ensure seamless backward compatibility [ev2].`;
    blastRadiusDetail = `Reversing this architectural invariant threatens downstream consumers across the repository's dependency graph [ev3].`;
  } else if (isTesting) {
    topicHeading = "Invariant Verification & Sandbox Attestation";
    topicSummary = `WhyCode validates **${repo.full_name}** by synthesizing counterfactual test oracles from historical PR contracts and executing them in isolated gVisor sandboxes [ev1].`;
    invariantDetail = `Tests confirm that proposed refactorings preserve both functional correctness and non-functional guarantees (security, concurrency, backwards compatibility) [ev2].`;
    blastRadiusDetail = `Synthesized dual-adapter self-healing patches ensure zero regressions before code reaches production [ev3].`;
  }

  const dynamicAnswer = `### ${topicHeading}
${topicSummary}

Regarding your query: *"${question}"*

${invariantDetail}

### Invariant & Blast Radius
> **Verified Invariant (Active Memory):**
> ${blastRadiusDetail}

WhyCode's AST graph continuously verifies all caller hierarchies in **${repo.full_name}** to prevent unexpected regressions.`;

  return {
    answer: dynamicAnswer,
    citations: [
      {
        id: "ev1",
        kind: "code",
        label: "Code",
        title: `${repo.name} Core Architecture (${primaryPath})`,
        path: primaryPath,
        line_start: 1,
        line_end: 45,
        commit_sha: repo.indexed_sha ?? "7d2b8e4f",
        snippet: `// ${repo.full_name} (${lang}) on branch ${repo.default_branch ?? "main"}\n// Indexed by WhyCode Engineering Memory Graph\n// Invariant Contracts: Verified across ${repo.counts?.entities ?? 250} entities`,
      },
      {
        id: "ev2",
        kind: "decision",
        label: "Decision",
        title: `${repo.name.toUpperCase()} Architecture Invariant & Contract`,
        snippet: `Architectural constraints and compatibility guarantees active for ${repo.full_name}.`,
      },
      {
        id: "ev3",
        kind: "finding",
        label: "Finding",
        title: "WhyCode Invariant Verification Oracle",
        snippet: "Zero regressions detected. Micro-VM sandbox attestation confirmed.",
      },
    ],
    evidence: [],
    mode: mode as any,
    abstained: false,
    confidence: "high",
    timings: { retrieve: 18, total: 32, vector_disabled: false },
    audit_id: "aud_gen_" + Math.random().toString(16).slice(2, 10),
    indexed_sha: repo.indexed_sha ?? "7d2b8e4f",
    engine: "local-fine-tuned:invariant-reasoner-v1",
    grounding: { total_claims: 3, supported_claims: 3, unsupported_claims: 0, grounding_verdict: "VERIFIED" },
  };
}

export function getDemoRepo(repoId = "repo_flask"): Repo {
  return DEMO_REPOS.find((r) => r.repo_id === repoId) ?? DEMO_REPO_FLASK;
}

export function getDemoOverview(repoId = "repo_flask"): Overview {
  const repo = getDemoRepo(repoId);
  return {
    repo,
    org: DEMO_OVERVIEW.org,
    counts: repo.counts ?? DEMO_OVERVIEW.counts,
    recent_commits: DEMO_OVERVIEW.recent_commits,
    timeline: getDemoTimeline(repoId),
  };
}

export function getDemoTimeline(repoId = "repo_flask"): TimelineItem[] {
  if (repoId === "repo_spring") {
    return [
      {
        kind: "decision",
        at: "2024-04-18T10:14:00Z",
        title: "Preserve @ConditionalOnMissingBean in AutoConfiguration (PR #14280)",
        url: "https://github.com/spring-projects/spring-boot/pull/14280",
      },
      {
        kind: "finding",
        at: "2024-04-18T09:30:00Z",
        title: "SpotBugs EI_EXPOSE_REP2 marked Documented/Accepted under Invariant #34091",
        url: "https://github.com/spring-projects/spring-boot/security",
      },
      {
        kind: "commit",
        at: "2024-04-15T16:20:00Z",
        title: "Merge PR #34091: Migrate to component-based SecurityFilterChain bean",
        url: "https://github.com/spring-projects/spring-boot/commit/c182ef45b0a1",
      },
    ];
  }
  if (repoId === "repo_express") {
    return [
      {
        kind: "decision",
        at: "2024-02-10T12:00:00Z",
        title: "Enforce exact 4-argument signature (err, req, res, next) for error middleware (PR #2841)",
        url: "https://github.com/expressjs/express/pull/2841",
      },
      {
        kind: "commit",
        at: "2024-02-08T18:45:00Z",
        title: "Merge PR #3650: Eliminate uninitialized memory exposure via Buffer.from()",
        url: "https://github.com/expressjs/express/commit/5c83d9a1e0b2",
      },
      {
        kind: "finding",
        at: "2024-02-05T11:15:00Z",
        title: "ESLint detect-new-buffer marked Documented/Accepted under Node 8 polyfill",
        url: "https://github.com/expressjs/express/security",
      },
    ];
  }
  if (repoId === "repo_gin") {
    return [
      {
        kind: "decision",
        at: "2024-01-22T08:30:00Z",
        title: "Zero-allocation context reuse via sync.Pool (PR #1420)",
        url: "https://github.com/gin-gonic/gin/pull/1420",
      },
      {
        kind: "commit",
        at: "2024-01-20T14:10:00Z",
        title: "Merge PR #810: Sub-microsecond routing via Radix Tree",
        url: "https://github.com/gin-gonic/gin/commit/3a91f8c2e4d0",
      },
    ];
  }
  return DEMO_TIMELINE;
}

export function getDemoDecisions(repoId = "repo_flask"): Citation[] {
  if (repoId === "repo_spring") {
    return DEMO_DECISIONS.filter((d) => d.id.includes("spring"));
  }
  if (repoId === "repo_express") {
    return DEMO_DECISIONS.filter((d) => d.id.includes("express"));
  }
  if (repoId === "repo_gin") {
    return DEMO_DECISIONS.filter((d) => d.id.includes("gin"));
  }
  return DEMO_DECISIONS.filter((d) => !d.id.includes("spring") && !d.id.includes("express") && !d.id.includes("gin"));
}

export function getDemoFindings(repoId = "repo_flask"): Finding[] {
  if (repoId === "repo_spring") {
    return DEMO_FINDINGS.filter((f) => f.finding_id.includes("spotbugs"));
  }
  if (repoId === "repo_express") {
    return DEMO_FINDINGS.filter((f) => f.finding_id.includes("eslint"));
  }
  if (repoId === "repo_gin") {
    return [];
  }
  return DEMO_FINDINGS.filter((f) => !f.finding_id.includes("spotbugs") && !f.finding_id.includes("eslint"));
}

export function addCustomRepo(fullName: string, defaultBranch = "main"): Repo {
  const parts = fullName.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "").split("/");
  const owner = parts[0]?.trim() || "community";
  const name = parts[1]?.trim() || parts[0]?.trim() || "custom-repo";
  const id = `repo_${owner}_${name}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  const existing = DEMO_REPOS.find((r) => r.repo_id === id || r.full_name.toLowerCase() === `${owner}/${name}`.toLowerCase());
  if (existing) return existing;

  const newRepo: Repo = {
    repo_id: id,
    owner,
    name,
    full_name: `${owner}/${name}`,
    description: `Imported GitHub repository (${owner}/${name}) indexed into WhyCode engineering memory.`,
    default_branch: defaultBranch || "main",
    indexed_sha: Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10),
    sync_status: "ready",
    last_synced_at: new Date().toISOString(),
    url: `https://github.com/${owner}/${name}`,
    embedding_backend: "minilm-l6-v2",
    counts: {
      files: Math.floor(Math.random() * 80) + 25,
      entities: Math.floor(Math.random() * 400) + 180,
      chunks: Math.floor(Math.random() * 1000) + 400,
      decisions: Math.floor(Math.random() * 15) + 8,
      findings: Math.floor(Math.random() * 4) + 1,
    },
  };

  DEMO_REPOS = [newRepo, ...DEMO_REPOS];
  return newRepo;
}


// ==========================================
// STATEFUL AGENT RUNS & TASKS MOCK STORE
// ==========================================

const _tasksByRepo: Record<string, Array<{ task: AgentTask; run_count: number }>> = {};
const _runsByTask: Record<string, AgentRun[]> = {};
const _runStates: Record<string, RunState> = {};

function initRepoTasks(repoId: string): Array<{ task: AgentTask; run_count: number }> {
  if (_tasksByRepo[repoId]) return _tasksByRepo[repoId];

  const repo = DEMO_REPOS.find((r) => r.repo_id === repoId) ?? DEMO_REPO_FLASK;
  let taskList: Array<{ task: AgentTask; run_count: number }> = [];

  if (repoId === "repo_flask") {
    taskList = [
      {
        task: {
          task_id: "task_flask_session_audit",
          title: "Audit Session Invariants for ArgosX Handover",
          goal: "Extract all active decisions and constraints on sessions.py and generate CLAUDE.md guardrails.",
          status: "COMPLETED",
          current_step: "step_4",
          summary: "Identified 3 active invariants and Bandit B324 documented rationale. Ready for agent handover.",
          repo_id: repoId,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        run_count: 1,
      },
      {
        task: {
          task_id: "task_flask_wsgi_teardown",
          title: "Verify Synchronous WSGI Context Lifecycle",
          goal: "Verify teardown_appcontext callbacks execute synchronously before worker threads accept new requests.",
          status: "RUNNING",
          current_step: "step_2",
          summary: "Inspecting AppContext.pop() and database connection pool cleanup hooks.",
          repo_id: repoId,
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
        run_count: 1,
      },
    ];
  } else if (repoId === "repo_spring") {
    taskList = [
      {
        task: {
          task_id: "task_spring_sec_filter",
          title: "Audit SecurityFilterChain Bean Precedence (Java)",
          goal: "Verify CVE-2023-34035 @Order precedence between custom SecurityFilterChain and Actuator endpoints.",
          status: "COMPLETED",
          current_step: "step_3",
          summary: "Enforced @Order(HIGHEST_PRECEDENCE + 50). Actuator /actuator/env endpoints safely isolated.",
          repo_id: repoId,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        run_count: 1,
      },
      {
        task: {
          task_id: "task_spring_autoconfig_check",
          title: "Audit @ConditionalOnMissingBean Starter Invariants",
          goal: "Verify that starter bean definitions yield cleanly to application-level bean overrides across 120+ modules.",
          status: "RUNNING",
          current_step: "step_1",
          summary: "Traversing AutoConfigurationPackages dependency tree.",
          repo_id: repoId,
          created_at: new Date(Date.now() - 1200000).toISOString(),
        },
        run_count: 1,
      },
    ];
  } else if (repoId === "repo_gin") {
    taskList = [
      {
        task: {
          task_id: "task_gin_syncpool_audit",
          title: "Verify Context sync.Pool Escape & Concurrency (Go)",
          goal: "Ensure *gin.Context escaping to goroutines strictly uses c.Copy() to prevent use-after-free data races.",
          status: "COMPLETED",
          current_step: "step_3",
          summary: "Verified INV-1420 contract. Deep context copy eliminates data race warning on recycled pool objects.",
          repo_id: repoId,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        run_count: 1,
      },
      {
        task: {
          task_id: "task_gin_engine_recovery",
          title: "Audit Engine Middleware Recovery Cascade",
          goal: "Inspect Recovery() and Logger() middleware handler ordering in Engine.handleHTTPRequest.",
          status: "RUNNING",
          current_step: "step_1",
          summary: "Analyzing middleware dispatch chain in pkg/gin/gin.go.",
          repo_id: repoId,
          created_at: new Date(Date.now() - 1200000).toISOString(),
        },
        run_count: 1,
      },
    ];
  } else if (repoId === "repo_express") {
    taskList = [
      {
        task: {
          task_id: "task_express_error_arity",
          title: "Audit 4-Argument Error Middleware Arity (Node.js)",
          goal: "Verify fn.length === 4 arity invariant across all router error boundaries to prevent unhandled rejections.",
          status: "COMPLETED",
          current_step: "step_3",
          summary: "Layer.prototype.handle_error arity contract confirmed. Prevents error handler bypass.",
          repo_id: repoId,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        run_count: 1,
      },
      {
        task: {
          task_id: "task_express_router_async",
          title: "Audit Route Layer Async Exception Forwarding",
          goal: "Inspect router layer dispatch to verify promise rejection forwarding across next() callbacks.",
          status: "RUNNING",
          current_step: "step_1",
          summary: "Analyzing router dispatch cascade.",
          repo_id: repoId,
          created_at: new Date(Date.now() - 900000).toISOString(),
        },
        run_count: 1,
      },
    ];
  } else {
    // Dynamic tasks for custom imported repo
    taskList = [
      {
        task: {
          task_id: `task_${repo.name}_invariant_audit`,
          title: `Audit Core Invariants for ${repo.name} Handover`,
          goal: `Extract all active architectural constraints, call boundaries, and dependencies for ${repo.full_name}.`,
          status: "RUNNING",
          current_step: "step_2",
          summary: `Analyzing ${repo.counts?.files ?? 30} files and ${repo.counts?.entities ?? 250} AST entities. Zero regressions detected.`,
          repo_id: repoId,
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
        run_count: 1,
      },
      {
        task: {
          task_id: `task_${repo.name}_blast_radius`,
          title: `Verify AST Call Boundaries & Blast Radius`,
          goal: `Traverse AST call graph across public interface boundaries and synthesize counterfactual test oracles.`,
          status: "COMPLETED",
          current_step: "step_3",
          summary: `Counterfactual oracle generated and verified in gVisor sandbox. All invariant contracts intact.`,
          repo_id: repoId,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        run_count: 1,
      },
    ];
  }

  // Pre-seed runs for each task
  for (const item of taskList) {
    const taskId = item.task.task_id;
    const runId = `run_${taskId}_01`;
    const initialRun: AgentRun = {
      run_id: runId,
      task_id: taskId,
      status: item.task.status === "COMPLETED" ? "SUCCEEDED" : "RUNNING",
      current_step: item.task.status === "COMPLETED" ? "Verify Blast Radius & Export Guardrails" : "AST Call Graph Traversal",
      summary: item.task.summary,
      seen_sha: repo.indexed_sha ?? "7d2b8e4f",
      steps: [
        {
          n: 1,
          tool: "graph_traverse",
          args: { repo: repo.full_name, depth: 3 },
          result_count: 6,
          evidence_ids: ["ev1", "ev2"],
          at: new Date(Date.now() - 1200000).toISOString(),
        },
        {
          n: 2,
          tool: "invariant_check",
          args: { target: repo.name, contract: "INV-101" },
          result_count: 1,
          evidence_ids: ["ev3"],
          at: new Date(Date.now() - 600000).toISOString(),
        },
      ],
      source_refs: [repo.full_name, "PR #108"],
      resume_count: 0,
      started_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 300000).toISOString(),
    };

    _runsByTask[taskId] = [initialRun];
    _runStates[runId] = {
      run: initialRun,
      task: item.task,
      context: [
        {
          node_id: "ctx1",
          kind: "decision",
          title: `${repo.name.toUpperCase()} Architecture Contract`,
          snippet: `Public interfaces and lifecycle hooks in ${repo.full_name} are protected by AST invariant rules.`,
        },
        {
          node_id: "ctx2",
          kind: "code",
          title: `${repo.name} Entrypoint Definition`,
          snippet: `// ${repo.full_name} (${repo.full_name.includes("spring") ? "src/main/java" : repo.full_name.includes("gin") ? "pkg/gin.go" : "src/index.ts"})\n// AST call graph validated by WhyCode Engine`,
        },
      ],
      results: [
        {
          id: "ev1",
          kind: "code",
          title: "AST Call Graph Traversal",
          snippet: `Verified 0 broken call paths across ${repo.counts?.entities ?? 250} code entities.`,
        },
        {
          id: "ev2",
          kind: "decision",
          title: "Invariant Validation Result",
          snippet: "Contract boundaries verified. Counterfactual test oracle confirmed valid.",
        },
      ],
      validation: {
        seen_sha: repo.indexed_sha ?? "7d2b8e4f",
        indexed_sha: repo.indexed_sha ?? "7d2b8e4f",
        moved: false,
        source: "local-indexed-cache",
      },
    };
  }

  _tasksByRepo[repoId] = taskList;
  return taskList;
}

export function getDemoTasks(repoId: string): Array<{ task: AgentTask; run_count: number }> {
  return initRepoTasks(repoId);
}

export function getDemoTaskDetail(taskId: string): { task: AgentTask; runs: AgentRun[] } {
  let foundTask: AgentTask | null = null;
  for (const list of Object.values(_tasksByRepo)) {
    const item = list.find((t) => t.task.task_id === taskId);
    if (item) {
      foundTask = item.task;
      break;
    }
  }

  if (!foundTask) {
    foundTask = {
      task_id: taskId,
      title: "Inspect Codebase Invariants",
      goal: "Analyze AST call graph, detect active invariants, and prepare agent handover context.",
      status: "RUNNING",
      current_step: "step_1",
      summary: "Exploring codebase topology and invariant contracts.",
      created_at: new Date().toISOString(),
      repo_id: "repo_custom",
    };
  }

  const runs = _runsByTask[taskId] ?? [];
  if (runs.length === 0) {
    const initialRun: AgentRun = {
      run_id: `run_${taskId}_01`,
      task_id: taskId,
      status: "RUNNING",
      current_step: "AST Call Graph Traversal",
      summary: "Exploring codebase topology and invariant contracts.",
      seen_sha: "7d2b8e4f",
      steps: [
        {
          n: 1,
          tool: "graph_traverse",
          args: { depth: 2 },
          result_count: 4,
          evidence_ids: ["ev1"],
          at: new Date().toISOString(),
        },
      ],
      source_refs: [foundTask.title],
      resume_count: 0,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    runs.push(initialRun);
    _runsByTask[taskId] = runs;
    _runStates[initialRun.run_id] = {
      run: initialRun,
      task: foundTask,
      context: [],
      results: [],
      validation: { seen_sha: "7d2b8e4f", indexed_sha: "7d2b8e4f", moved: false, source: "cache" },
    };
  }

  return { task: foundTask, runs };
}

export function createDemoTask(repoId: string, title: string, goal: string): { task: AgentTask } {
  const tasks = initRepoTasks(repoId);
  const taskId = `task_${Math.random().toString(16).slice(2, 10)}`;
  const task: AgentTask = {
    task_id: taskId,
    repo_id: repoId,
    title,
    goal,
    status: "RUNNING",
    current_step: "Ready to run",
    summary: `Task created for ${repoId}. Ready for autonomous execution.`,
    created_at: new Date().toISOString(),
  };

  tasks.unshift({ task, run_count: 0 });
  _runsByTask[taskId] = [];
  return { task };
}

export function createDemoRun(taskId: string): RunState {
  const detail = getDemoTaskDetail(taskId);
  const runId = `run_${Math.random().toString(16).slice(2, 10)}`;
  const run: AgentRun = {
    run_id: runId,
    task_id: taskId,
    status: "RUNNING",
    current_step: "Step 1: AST Invariant Scan",
    summary: "Scanning symbol dependencies and invariant constraints.",
    seen_sha: "7d2b8e4f",
    steps: [
      {
        n: 1,
        tool: "invariant_scan",
        args: { task_id: taskId },
        result_count: 3,
        evidence_ids: ["ev1"],
        at: new Date().toISOString(),
      },
    ],
    source_refs: [detail.task.title],
    resume_count: 0,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const runs = _runsByTask[taskId] ?? [];
  runs.unshift(run);
  _runsByTask[taskId] = runs;

  for (const list of Object.values(_tasksByRepo)) {
    const item = list.find((t) => t.task.task_id === taskId);
    if (item) {
      item.run_count = runs.length;
      break;
    }
  }

  const state: RunState = {
    run,
    task: detail.task,
    context: [
      {
        node_id: "ctx_1",
        kind: "decision",
        title: "Active Architectural Contract",
        snippet: `Constraints for ${detail.task.title} loaded into agent working memory.`,
      },
    ],
    results: [
      {
        id: "res_1",
        kind: "code",
        title: "AST Call Graph Traversal",
        snippet: "Active symbol references isolated. Preparing invariant oracle verification.",
      },
    ],
    validation: {
      seen_sha: "7d2b8e4f",
      indexed_sha: "7d2b8e4f",
      moved: false,
      source: "local-repo",
    },
  };

  _runStates[runId] = state;
  return state;
}

export function getDemoRun(runId: string): RunState {
  if (_runStates[runId]) return _runStates[runId];

  const syntheticRun: AgentRun = {
    run_id: runId,
    task_id: "task_auto",
    status: "SUCCEEDED",
    current_step: "Verify Blast Radius & Export Guardrails",
    summary: "Graph traversal complete. No regressions detected. Handover bundle verified.",
    seen_sha: "7d2b8e4f",
    steps: [
      {
        n: 1,
        tool: "graph_traverse",
        args: { depth: 3 },
        result_count: 6,
        evidence_ids: ["ev1", "ev2"],
        at: new Date().toISOString(),
      },
      {
        n: 2,
        tool: "invariant_check",
        args: { rule: "INV-101" },
        result_count: 1,
        evidence_ids: ["ev3"],
        at: new Date().toISOString(),
      },
    ],
    source_refs: ["Audit Invariants"],
    resume_count: 0,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const state: RunState = {
    run: syntheticRun,
    task: null,
    context: [],
    results: [],
    validation: { seen_sha: "7d2b8e4f", indexed_sha: "7d2b8e4f", moved: false, source: "memory" },
  };

  _runStates[runId] = state;
  return state;
}

export function stepDemoRun(
  runId: string,
  actionKind: "auto" | "step" | "interrupt" | "resume",
  tool?: string,
  args?: Record<string, unknown>,
): RunState {
  const state = getDemoRun(runId);
  const now = new Date().toISOString();

  if (actionKind === "interrupt") {
    state.run.status = "INTERRUPTED";
    state.run.updated_at = now;
    return state;
  }

  if (actionKind === "resume") {
    state.run.status = "RUNNING";
    state.run.resume_count = (state.run.resume_count ?? 0) + 1;
    state.run.updated_at = now;
    return state;
  }

  const stepCount = (state.run.steps?.length ?? 0) + 1;
  const toolName = tool || (stepCount === 2 ? "invariant_oracle_synth" : stepCount === 3 ? "dual_adapter_patch" : "blast_radius_sim");
  const toolArgs = args || { step: stepCount, timestamp: now };

  state.run.steps = [
    ...(state.run.steps || []),
    {
      n: stepCount,
      tool: toolName,
      args: toolArgs,
      result_count: 3,
      evidence_ids: [`ev_${stepCount}`],
      at: now,
    },
  ];

  if (stepCount >= 3) {
    state.run.status = "SUCCEEDED";
    state.run.current_step = "Execution Complete · Zero Regressions";
    state.run.summary = "All counterfactual test oracles passed. Dual-adapter patch verified in gVisor sandbox.";
  } else {
    state.run.status = "RUNNING";
    state.run.current_step = `Step ${stepCount}: ${toolName}`;
    state.run.summary = `Executing ${toolName} across repository AST nodes.`;
  }

  state.run.updated_at = now;
  state.results = [
    ...(state.results || []),
    {
      id: `ev_${stepCount}`,
      kind: "finding",
      title: `Step ${stepCount}: ${toolName} Output`,
      snippet: `Execution completed successfully. AST call graph verified with zero regression risk.`,
    },
  ];

  return state;
}

export const DEMO_TASKS: Array<{ task: AgentTask; run_count: number }> = getDemoTasks("repo_flask");
export const DEMO_RUNS: AgentRun[] = _runsByTask["task_flask_session_audit"] ?? [];

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
