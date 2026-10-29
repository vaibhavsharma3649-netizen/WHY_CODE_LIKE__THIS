# WhyCode - Product Requirements Document
**Organisation-level engineering memory for humans and AI agents**  
**Version:** 1.0  
**Prepared:** 27 October 2026  
**Prototype submission deadline:** 29 October 2026, 23:59 IST  
**Status:** Build-ready hackathon prototype specification

> **Product promise:** Understand the code. Recover the why. Continue the work. Secure the change.

---

## 1. Executive Summary

WhyCode is an organisation-level engineering memory and code intelligence platform for humans and AI agents. It helps teams understand what code does, where it lives, why a design decision was made, what work remains, and how to continue safely when contributors or agents change.

The product connects current code with its engineering history: commits, pull requests, issues, design documents, security findings, tasks, and agent traces. Answers must include source evidence and precise locations, distinguish facts from inferences, identify superseded decisions when supported by evidence, and abstain when the repository cannot establish an answer.

Neo4j is the primary application database and knowledge store. It persists organisation and membership metadata, repositories, code entities and chunks, decisions, source references, security findings, tasks, audit events, agent runs, and embeddings used by Neo4j vector search. GitHub remains the source of truth for code and hosted collaboration history. The prototype will not use ChromaDB or another database for application persistence.

> **Important:** Prototype target: submit a working, demonstrable vertical slice by Thursday, 29 October 2026, 23:59 India Standard Time (IST). The PRD separates must-have prototype functionality from production enterprise capabilities.

| Product principle | Meaning |
| --- | --- |
| Evidence before eloquence | Important claims are tied to source links, identifiers, timestamps, and code locations; unknowns are labelled. |
| Graph first | Neo4j models relationships among code, decisions, people, incidents, tasks, and agent activity. |
| Organisation-safe by default | Every request is authorised within an organisation and repository scope before data retrieval. |
| Human and agent parity | Humans and authorised agents use the same retrieval and evidence APIs, subject to the same permissions. |
| Read-only prototype | The prototype reads repository data and produces guidance. It does not push commits, merge PRs, or change production systems. |

## 2. Problem Statement

Engineering knowledge is fragmented across source code, commit messages, PR reviews, issues, design documents, incident discussions, and individual memory. Code search can find where a concept appears but usually cannot reconstruct the decision that governs it. Static documentation becomes stale, and historical statements may no longer describe current behaviour.

The impact becomes acute when a developer leaves, a new joiner arrives, an incident occurs, or an AI coding agent resumes work after interruption. Teams lose context about why a workaround exists, which changes remain unfinished, which security checks are intentional, and which decisions have been replaced.

| Current failure | Why it matters | WhyCode response |
| --- | --- | --- |
| Search finds keywords, not intent | Developers inspect multiple unrelated artefacts and can still miss the decision. | Traverse the graph from code entity to decision, PR, issue, commit, and contributor. |
| Docs drift | Onboarding and operational guidance may contradict the current implementation. | Generate a source-linked, refreshable handover view from current code and recorded history. |
| Old decisions look authoritative | A reversed decision may be reused after its context has changed. | Represent supersession explicitly when evidence supports the relationship; flag ambiguity otherwise. |
| Security rationale is lost | A later change can remove a safeguard without understanding why it exists. | Connect security findings and invariants to code changes and historical fixes. |
| Agents lack durable project context | A resumed agent may repeat failed approaches or violate conventions. | Expose scoped context tools and persist task/run state in Neo4j. |

## 3. Product Vision and Positioning

Vision: preserve the reasoning and operational context of an engineering organisation so that a new human or authorised AI agent can understand the project and continue work without depending on one person’s memory.

Positioning: WhyCode is not only a code explainer, documentation generator, vulnerability scanner, or generic chatbot. Its differentiator is the evidence-backed relationship between current code, historical decisions, outstanding work, security posture, and agent activity.

Primary product questions: What does this code do? Where is it implemented? Why was it designed this way? What changed and what is still pending? Is there a security concern? What context does the next developer or agent need to continue safely?

| Mode | User outcome |
| --- | --- |
| Understand | Explain a file, function, class, API flow, dependency, configuration key, or test using code structure and references. |
| Why | Recover design intent from commits, discussions, issues, design docs, and related code; distinguish explicit rationale from inference. |
| Handover | Create an onboarding map and current-work summary for a new engineer or replacement team member. |
| Secure | Link static-analysis findings and security-sensitive code to relevant safeguards, previous fixes, and historical rationale. |
| Agent context | Give a read-only agent the relevant project context and permit it to resume a tracked task from persisted state. |

## 4. Target Users and Roles

| Persona / role | Primary needs | Prototype permissions |
| --- | --- | --- |
| Organisation Admin | Connect repositories, manage members, choose roles, view sync and audit status. | Manage the workspace and repository connections; assign roles. |
| Repository Maintainer | Understand architecture, investigate changes, maintain decision links, review security signals. | Read repository data; trigger sync; manage repository-level configuration. |
| Developer / New Joiner | Find code, learn the system, understand past decisions, identify next tasks. | Query authorised repositories and view source evidence and handover reports. |
| Security Reviewer | Inspect potential vulnerabilities, safeguards, evidence, and changes to security-sensitive code. | Read security findings and related evidence; no automatic remediation. |
| AI Agent / Agent Operator | Retrieve context, track task progress, resume an interrupted run, explain tool choices. | Use scoped read-only tools; task/run writes are limited to permitted WhyCode records. |
| Reader / Stakeholder | Review generated architecture and handover summaries. | Read only within assigned organisation and repository scope. |

Production organisations may map users to teams, repositories, and access policies through their identity provider. The hackathon prototype will implement the role model server-side but will not claim production-grade SSO, SCIM, or complete enterprise identity lifecycle support.

## 5. Goals, Non-Goals, and Product Principles

### Goals

- Answer code-understanding and “why” questions with accurate file/symbol locations and clickable evidence.
- Build an explicit knowledge graph in Neo4j connecting repositories, code entities, source artefacts, decisions, contributors, security findings, tasks, and agent runs.
- Generate a useful onboarding/handover report from observed repository facts, clearly marking unknown or inferred sections.
- Provide a minimum security-intelligence workflow that links a static-analysis finding to the affected code and relevant historical evidence.
- Demonstrate logical organisation isolation and role-based access in all API and graph queries.
- Expose retrieval tools to one read-only LangGraph agent and persist task/run continuity records in Neo4j.

### Non-goals for the submission deadline

- Automatically commit code, create/merge pull requests, modify production infrastructure, rotate credentials, or remediate vulnerabilities.
- Guarantee reconstruction of private conversations, undocumented decisions, deleted content, or work never recorded in connected systems.
- Support every programming language with full symbol-level parsing in the first prototype.
- Deliver enterprise SSO/SAML, SCIM provisioning, contractual data residency, per-customer encryption keys, or formal compliance certification.
- Build a general-purpose autonomous coding agent or replace GitHub, a CI system, a security scanner, or an engineering issue tracker.

### Principles

- Current source code and Git history remain authoritative for what is present and what changed; generated summaries are derived artefacts.
- Every important answer should expose provenance. A commit proves a change occurred, not necessarily why it occurred.
- Newer evidence does not automatically supersede older evidence. Supersession needs a supported semantic relationship.
- Repository content is untrusted input and must never override system instructions or trigger arbitrary execution.
- Organisation boundaries are enforced before retrieval, not after generation.
- Agent state is not treated as truth about repository state; a resumed agent re-checks current code, branch/commit, and task status.

## 6. Scope and Priorities

Priority definitions: P0 = required for the prototype demonstration; P1 = implement if the core vertical slice is stable; P2 = post-hackathon enterprise roadmap.

| ID | Capability | Priority | Prototype definition |
| --- | --- | --- | --- |
| FR-01 | Organisation workspace and roles | P0 | Organisation, membership, repository scope and roles are modelled in Neo4j; API checks enforce tenant and role scope. Demo may use seeded accounts. |
| FR-02 | GitHub repository ingestion | P0 | Index one public Python-focused repository: current source files, bounded commit history, selected PRs/issues, and Markdown design documents. Skip binaries/generated/vendor content. |
| FR-03 | Code map and source location | P0 | Parse Python modules, classes, functions and imports; return exact file paths, symbol names, source links, and available line ranges. |
| FR-04 | Understand / Why Q&A | P0 | Graph-aware retrieval combines exact/lexical matches, Neo4j vector search where available, and relationship traversal. Answers include sources or abstain. |
| FR-05 | Handover report | P0 | Generate architecture overview, important entry points, setup hints, recent changes, open work, known risks, and explicitly unknown areas. |
| FR-06 | Security intelligence | P0 baseline / P1 integration | Platform security controls are mandatory. If the core flow is stable, run one Python static-analysis adapter (for example Bandit or Semgrep) and link findings to code nodes. |
| FR-07 | Agent context and continuity | P0 focused demo | One read-only LangGraph workflow calls WhyCode retrieval tools; Task and AgentRun state are persisted in Neo4j and can be reloaded after interruption. |
| FR-08 | Evidence and abstention | P0 | Store source IDs/URLs, timestamps, commit SHAs, line ranges where known, and fact/inference labels. No evidence means no confident rationale claim. |
| FR-09 | Incremental update | P1 | At minimum, an idempotent manual Refresh action. GitHub webhook-driven ingestion is a stretch goal if time permits. |
| FR-10 | Audit and admin visibility | P0 basic | Record repository import/refresh, member/role changes in demo, agent runs, and query metadata without storing secrets or unnecessary prompt data. |
| FR-11 | Private repositories and GitHub App | P2 | Add read-only GitHub App installation and support for private repositories after the prototype. |
| FR-12 | Enterprise identity and controls | P2 | SSO/SAML, SCIM, fine-grained policy integration, retention controls, audit export, and deployment-specific isolation options. |

## 7. Key User Journeys

### Journey A - A new developer joins

1. Organisation Admin creates/selects a workspace and grants the developer repository access.
2. Maintainer imports a repository and checks the indexing report for skipped or failed artefacts.
3. New developer opens Handover and receives a source-linked project map, entry points, setup guidance, recent changes, and outstanding work.
4. Developer asks “Where is authentication implemented?” and receives exact files, symbols, call relationships, tests, and evidence links.
5. Developer asks “Why is this check required?” and receives the decision trail, or an explicit “not established by available evidence” response.

### Journey B - Review a security-sensitive change

1. The security adapter reports a potential issue with a source location and scanner identifier.
2. WhyCode creates/updates a SecurityFinding node and links it to the relevant CodeEntity/File and source revision.
3. The graph retrieves related safeguards, previous fixes, and decision evidence where present.
4. The UI distinguishes scanner finding, confirmed historical fact, and inferred risk; a human reviewer decides whether the change is exploitable or needs action.

### Journey C - An AI agent continues a task

1. An authorised agent asks WhyCode for task context and relevant implementation patterns using scoped read-only tools.
2. The agent records Task and AgentRun state, completed steps, source references, and pending next steps in Neo4j.
3. After interruption, the agent reloads state and validates the current repository commit and task status before continuing.
4. The agent can explain which evidence it used. It cannot push code, merge changes, or change organisation permissions in the prototype.

## 8. Neo4j-First Data and Graph Design

Neo4j AuraDB is the primary database for all persistent WhyCode application data. The graph model is the product foundation, not an optional visualisation layer. The graph stores entities and their relationships; node properties retain searchable summaries, provenance, timestamps, status, and (for searchable chunks) embedding vectors.

GitHub remains the external source of truth for the repository and its collaboration records. WhyCode stores identifiers, snapshots or bounded excerpts needed for retrieval, provenance, and reproducibility. It should link back to immutable commit-specific URLs whenever possible.

### Required node types

| Node label | Important properties | Purpose |
| --- | --- | --- |
| Organization | org_id, name, created_at, status | Tenant root and organisation settings. |
| User / Membership | user_id, org_id, role, status | Identity reference and organisation-scoped access. |
| Team | team_id, org_id, name | Logical team/repository ownership; optional in MVP. |
| Repository | repo_id, org_id, provider, owner, name, default_branch, indexed_sha, sync_status | Repository identity and sync state. |
| File | file_id, org_id, repo_id, path, blob_sha, language, source_url | File metadata, current source revision and navigation. |
| CodeEntity | entity_id, org_id, repo_id, qualified_name, kind, path, line_start, line_end | Function/class/module/configuration/symbol and code relationships. |
| CodeChunk | chunk_id, org_id, repo_id, path, content_excerpt, embedding, commit_sha | Bounded text unit for retrieval with source provenance. |
| Commit / PullRequest / Issue | external_id, org_id, repo_id, title/message, author, created_at, url, commit_sha/state | Historical engineering artefacts. |
| Decision | decision_id, org_id, summary, rationale, rationale_type, status, confidence, decided_at | A captured design/security/operational decision with evidence. |
| SecurityFinding | finding_id, org_id, rule_id, severity, status, path, line_start, line_end, scanner, observed_at | Potential issue reported by an analyzer; not an automatic exploitability verdict. |
| Task / AgentRun | task_id/run_id, org_id, repo_id, status, current_step, summary, source_refs, updated_at | Work tracking and agent continuity. |
| AuditEvent | event_id, org_id, actor_id, action, target_id, timestamp, outcome | Minimal audit trail for sensitive application operations. |

### Important relationship types

| Relationship | Interpretation |
| --- | --- |
| (:Organization)-[:OWNS]->(:Repository) | Repository is scoped to an organisation. |
| (:Repository)-[:CONTAINS]->(:File) | File belongs to a repository. |
| (:File)-[:DEFINES]->(:CodeEntity) | A file defines a symbol. |
| (:CodeEntity)-[:CALLS\|IMPORTS\|DEPENDS_ON]->(:CodeEntity) | Code structure and dependency path. |
| (:Decision)-[:AFFECTS]->(:CodeEntity\|File) | Decision impacts current or historical implementation. |
| (:Decision)-[:INTRODUCED_BY]->(:Commit) | Commit is associated with a decision change. |
| (:Decision)-[:DISCUSSED_IN]->(:PullRequest\|Issue) | Discussion provides rationale or context. |
| (:Decision)-[:SUPERSEDES]->(:Decision) | Later supported decision replaces or revises an earlier decision. |
| (:SecurityFinding)-[:LOCATED_IN]->(:File\|CodeEntity) | Finding points to affected code. |
| (:SecurityFix)-[:FIXES]->(:SecurityFinding) | Historical fix is linked when evidence supports the mapping. |
| (:Task)-[:WORKS_ON]->(:Repository\|Issue) | Tracked task is associated with project work. |
| (:AgentRun)-[:USES_CONTEXT]->(:Decision\|CodeChunk\|SecurityFinding) | Agent run records context sources without treating them as instructions. |

### Database rules

- Use deterministic, idempotent identifiers and Cypher MERGE patterns so refreshing data does not create duplicate nodes or relationships.
- Use constraints and indexes for stable IDs, organisation/repository lookups, status, source IDs, and symbol paths.
- Use Neo4j vector indexes for CodeChunk embeddings when supported by the selected Neo4j/Aura version; use full-text and exact identifier lookup alongside vector search. If vector indexing is unavailable in the chosen environment, keep the MVP inside Neo4j and fall back to lexical + graph retrieval rather than adding ChromaDB.
- All tenant-owned nodes and artefacts carry org_id. All application graph queries are scoped by a server-derived org_id and authorised repository IDs; the client cannot choose a tenant scope by submitting arbitrary IDs.
- Never create cross-tenant edges. In automated tests, verify that a user in organisation A cannot retrieve, count, cite, or traverse data belonging to organisation B.
- Do not store raw secrets or full unrestricted chat transcripts in the graph. Store necessary excerpts and references with size limits, redaction, and retention rules.

## 9. Technical Architecture

| Layer | Prototype choice | Responsibilities |
| --- | --- | --- |
| Frontend | React + Vite (reuse existing project if stable) | Workspace selection, repository indexing status, Understand/Why query, source evidence panel, Handover report, security findings, agent run status. |
| API | FastAPI | Authentication/session checks, role and repository authorisation, query endpoints, admin and sync actions. |
| GitHub connector | PyGithub / GitHub REST API; public read access for MVP | Bounded retrieval of repository files, commits, pull requests, issues, and source URLs. |
| Parser | Python AST for MVP; Tree-sitter planned | Extract module/class/function/import structure and source ranges. Unknown language files remain file-level text. |
| Ingestion service | Python service / background task | Normalise artefacts, chunk text, generate embeddings, map source IDs and write idempotently to Neo4j. |
| Primary database | Neo4j AuraDB | All persistent application data, graph relationships, searchable chunks and embeddings, membership/roles, sync state, tasks, runs, and audit records. |
| Retrieval / GraphRAG | Parameterised Cypher + Neo4j full-text/vector retrieval + relationship traversal | Find candidate evidence, traverse relevant relationships, rank evidence and construct bounded context. |
| LLM orchestration | LangGraph + existing Groq-compatible model adapter | Classify query, retrieve context, draft answer, verify citations/answerability, return answer or abstention. |
| Security analyser | Bandit for Python or Semgrep if already available | Produce scanner findings with rule IDs and source locations; findings are evidence for review, not definitive exploitability claims. |
| Agent continuity | LangGraph read-only retrieval tools; Task/AgentRun records in Neo4j | Persist task summary, step/status, evidence references, tool-call metadata, and resume context. |
| Embeddings | Local sentence-transformer or currently available embedding model | Create vectors for chunks and decision summaries; persist vector values in Neo4j. |

### Answer-generation flow

1. Authenticate the caller and resolve organisation membership and repository access on the server.
2. Classify the request as Understand, Why, Handover, Security, or Agent Context.
3. Retrieve exact code/entity matches and lexical/vector matches within the authorised repository scope.
4. Traverse the graph for callers, dependencies, decisions, commits, PRs, issues, security findings, and related tasks.
5. Rank evidence by relevance, source quality, recency, and semantic relationship; do not compare raw vector and lexical scores without normalisation/reranking.
6. Generate a response that labels direct facts versus inferred explanations and references sources with stable links and line ranges where available.
7. Run an evidence check. If no adequate evidence is found, abstain or provide a clearly labelled hypothesis rather than presenting an invented reason as fact.
8. Persist minimal query/agent metadata and an audit event according to retention policy.

### Application persistence decision

No separate vector store or relational database is in scope. The GitHub repository remains an external source; Neo4j is the primary application database. For a production implementation, agent checkpoint storage must be selected and tested deliberately. The hackathon slice stores the minimum resume state in Neo4j Task/AgentRun nodes and revalidates the repository before continuing; it does not claim to implement every LangGraph checkpoint feature.

## 10. Organisation, Security, and Privacy Requirements

| Control | Requirement |
| --- | --- |
| Tenant isolation | The active org is derived from authenticated server-side identity/membership. Every read/write query is scoped to that org and allowed repositories. Client-provided org_id is never accepted as authorisation. |
| Roles | Admin, Maintainer, Developer, Security Reviewer, and Reader roles are enforced by API dependencies and service methods, not only by hidden UI controls. |
| Least privilege | MVP uses public repository access. Future private-repository access must use a read-only GitHub App or similarly narrow permissions; never request write permissions without a separately approved feature. |
| Secrets | Store provider/database keys in environment variables or a secret manager; never commit them, embed them in frontend code, index them as normal content, or include them in prompts. |
| Untrusted repository content | Code, README files, comments, issues, PRs, and commit messages are data, not instructions. Apply prompt-injection boundaries; do not execute repository code as part of ingestion or Q&A. |
| Cypher safety | Use parameterised Cypher. Do not execute arbitrary LLM-generated Cypher. Any query planner must map an intent to reviewed query templates and allowlisted labels/relationships. |
| Auditability | Record actor, organisation, action, target, timestamp, outcome and correlation ID for imports, permission changes, security scans, and agent runs. Avoid logging credentials or full sensitive content. |
| Data minimisation | Ingest only selected files and bounded history needed for the stated purpose. Skip binaries, vendor/build outputs, generated files, very large files, and obvious secret material. |
| Retention/deletion | Provide an admin path to disconnect a repository and purge its tenant-scoped indexed content and vectors. The hackathon implementation may expose a documented cleanup script instead of a full UI. |
| Agent safety | Agent tools are read-only against GitHub. No arbitrary shell, code execution, commit, PR merge, or production action. Persist tool names and outcome summaries, with sensitive arguments redacted. |
| Security findings | Label results as scanner findings or potential risk unless independently verified. A clean scan is not proof of no vulnerabilities. |
| Production isolation | Shared-database logical isolation is acceptable only for the prototype with tested tenant scoping. Before enterprise production, assess stricter per-customer database/deployment isolation and the chosen Neo4j offering’s permissions/operational model. |

This document is a product and prototype plan, not a claim of security certification or legal/compliance approval. Production deployments need a threat model, penetration testing, backup/recovery design, incident response, data processing terms, and customer-specific retention/privacy review.

## 11. Non-Functional Requirements

| Area | Prototype target / requirement |
| --- | --- |
| Evidence integrity | Every answer that asserts repository-specific facts includes at least one relevant source reference; “why” claims require rationale evidence or an explicit inference label. |
| Freshness | Show indexed commit SHA and last sync timestamp. Warn when the working repository has moved beyond the indexed revision. |
| Reliability | Ingestion can be retried safely; failures are surfaced per source type and do not silently mark partial indexing as complete. |
| Performance | For the bounded demo repository, aim for common Q&A responses within 10 seconds excluding unusually slow model responses. Show loading/indexing states instead of freezing the UI. |
| Traceability | A source reference identifies repository, path or external artefact, commit SHA where available, timestamp, URL, and line range if known. |
| Maintainability | Separate API, graph repository/query layer, ingestion, parsing, retrieval, prompting, and UI. Keep prompts and query templates versioned. |
| Portability | Provide an .env.example, setup guide, seed/demo data instructions, and a repeatable local launch path. |
| Accessibility | Readable labels, keyboard-usable controls, clear loading/error states, and no reliance on colour alone to communicate finding severity/status. |

## 12. Evaluation and Acceptance Criteria

The prototype is accepted when the following are demonstrated end to end. These are targets for test execution, not claims about results already achieved.

| Test | Acceptance gate | Evidence to capture |
| --- | --- | --- |
| Repository ingestion | A selected public repo is indexed; source types and skipped artefacts are reported. Re-running ingestion does not create duplicate nodes/edges. | Import summary; before/after node and relationship counts; retry test. |
| Code location | At least 9 of 10 curated “where is X?” questions return the correct file/symbol in the top three results. | Question set with expected path/symbol; screenshots or JSON result log. |
| Why answer grounding | At least 8 of 10 answerable questions provide a source that supports the claim; explicit rationale is distinguished from inference. | Manual citation review with evidence links and labels. |
| Abstention | For 5 deliberately unanswerable “why” questions, the system does not invent a historical reason and communicates the evidence gap. | Captured outputs and reviewer checklist. |
| Handover completeness | Report includes architecture/entry points, setup hints, recent work, open issues, risks, and unknowns where source data supports them; each section is traceable. | Generated report and source coverage checklist. |
| Security workflow | At least one actual scanner result maps to a file/source range and can retrieve related code. False-positive and exploitability uncertainty are labelled. | Scanner output, graph link, and demonstrated query. |
| Tenant boundary | Automated tests verify a caller from Org A cannot retrieve Org B repositories, nodes, answers, counts, citations, or agent state. | Passing isolation tests using two tenant fixtures. |
| Agent continuity | AgentRun/Task state survives application restart or interrupted run, can be loaded, and is revalidated against current repository state before resuming. | Run record before restart and continuation after restart. |
| RAG evaluation | Run a small curated benchmark with RAGAS metrics such as faithfulness and answer relevancy where compatible; manually score citation accuracy and abstention separately. | Benchmark CSV/JSON plus documented limitations. |
| Submission readiness | Clean start instructions work; no secrets in repo; a 3-5 minute demo is rehearsed; fallback screenshots/logs are available. | README, environment checklist, demo script, final tag/commit. |

Do not use RAGAS scores alone as proof that decisions are historically correct, graph relationships are correct, tenant isolation is safe, or security findings are valid. Those require curated ground truth and targeted tests.

## 13. Two-Day Prototype Plan

> **Important:** Deadline assumption: Thursday, 29 October 2026, at 23:59 IST. Freeze feature work by 20:00 IST on the 29th and aim to upload the final submission package by 23:00 IST, leaving a buffer for platform or packaging failures.

| When (IST) | Deliverable | Definition of done |
| --- | --- | --- |
| Tue 27 Oct - late evening | Scope and infrastructure lock | Choose one mature public Python repository; create Neo4j AuraDB instance; confirm connectivity; create .env.example; freeze node schema and API contract. |
| Wed 28 Oct - morning | Ingestion vertical slice | GitHub importer reads bounded source files and selected history; Python AST parser emits symbols/line ranges; idempotent graph writes work. |
| Wed 28 Oct - afternoon | Graph retrieval and citations | Neo4j lexical/vector search as supported plus graph traversal; Understand/Why query returns source-linked answers or abstains. |
| Wed 28 Oct - evening | Handover and UI | Workspace view, indexing status, source evidence panel, handover report; error handling and empty states. |
| Thu 29 Oct - morning | Security and agent flow | Connect one scanner or pre-installed adapter; link finding to code. One LangGraph workflow uses read-only tools and persists a Task/AgentRun to Neo4j. |
| Thu 29 Oct - afternoon | Isolation, refresh and evaluation | Two-tenant isolation tests pass; refresh is idempotent; run curated answerability/citation tests and address critical defects. |
| Thu 29 Oct - 18:00 to 20:00 | Feature freeze and demo hardening | No new major features. Fix crashes, check source links, verify secrets hygiene, rehearse the demo, capture screenshots. |
| Thu 29 Oct - 20:00 to 23:00 | Submission package | Final README/setup, architecture diagram, PRD, demo script/video if required, evaluation evidence, tagged commit, submit before platform deadline. |

### Scope cuts if behind schedule

1. Drop webhook automation and use a visible manual Refresh action.
2. Support only Python AST symbol parsing and treat other languages as file-level text.
3. Keep security scanning to one Python scanner; do not build a custom vulnerability engine.
4. Keep the agent read-only and persist concise task/run state in Neo4j rather than attempting a full autonomous coding workflow.
5. Use a simple but clear interface; do not spend the final day polishing complex graph visualisations.
6. Do not cut tenant isolation, evidence links, secret hygiene, reproducible setup, or the abstention path.

## 14. Prototype Demonstration Script

Target duration: 3-5 minutes. Demonstrate one story from the perspective of a new developer joining an unfamiliar engineering team.

1. Open the organisation workspace and show the selected repository, indexing timestamp, and indexed commit SHA.
2. Ask “Where is this behaviour implemented?” Show exact paths/symbols, dependencies, tests, and clickable source links.
3. Ask “Why was this check added?” Show a decision/PR/commit chain. If the repository contains no rationale, demonstrate the honest evidence-gap response instead of fabricating history.
4. Open Handover and show architecture entry points, recently changed areas, open work, and unknowns with provenance.
5. Run or open one actual static-analysis finding and trace it to code and any associated historical fix available in the repository.
6. Ask the LangGraph agent to retrieve context for a task, interrupt or stop the run, restart/reload it, and show that it reads the persisted Task/AgentRun state and rechecks current repository revision.
7. Close with the architecture: Neo4j stores the connected engineering memory and searchable embeddings; source code and collaboration history remain grounded in GitHub; every user and agent request is organisation-scoped.

Choose a repository with at least one non-trivial historical decision and one reproducible security finding before committing to the demo. If either is absent, adjust the story rather than inventing evidence.

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Insufficient rationale in public history | A “why” question may have no recoverable answer. | Make abstention a product feature; select a repository with useful PR/issue discussion; do not hallucinate. |
| Scope exceeds two days | Core end-to-end path remains broken. | Protect the vertical slice; use the explicit scope cuts in Section 13; freeze at 20:00 IST on submission day. |
| GitHub API limits or incomplete history | Importer may return partial evidence. | Bound ingestion, cache API results in Neo4j, expose failures, retry with backoff, and report data coverage. |
| Neo4j vector index/API version mismatch | Semantic search fails in demo. | Test the target Aura version early; use documented compatible syntax; retain lexical search and graph traversal as a fallback. |
| Graph schema becomes overcomplicated | Ingestion and retrieval are slow to debug. | Start with a small stable node/relationship set; add only relationships needed for an acceptance test. |
| Cross-tenant leakage | Critical organisation-level security failure. | Derive scope server-side; scope every query; include automated negative isolation tests before the demo. |
| Prompt injection in repository content | Model may follow hostile instructions embedded in data. | Treat retrieved text as untrusted quoted evidence; do not execute repo content; limit tools and validate all outputs. |
| Agent state diverges from actual repository | Agent resumes against stale assumptions. | Persist last-seen commit and step; re-read branch/commit/task before resuming; pause if the repo has changed materially. |
| Scanner false positives | Users may trust unverified findings. | Display scanner/rule/severity/source; label as potential findings; require human confirmation. |
| Model/provider outage | Live answer generation unavailable. | Show deterministic indexing/graph views, retain test fixtures and screenshots, and prepare a recorded fallback only if event rules permit. |

## 16. Post-Hackathon Roadmap

| Phase | Capability | Expected outcome |
| --- | --- | --- |
| Phase 1 - Harden | Webhook-driven incremental updates, multiple repos per org, robust retries, audit UI, configurable retention, better evaluation. | Reliable engineering memory for small teams. |
| Phase 2 - Enterprise access | GitHub App private-repo access, SSO/OIDC or SAML, SCIM, team-to-repo mappings, security review and admin controls. | Operational fit for real organisations. |
| Phase 3 - Decision intelligence | Decision extraction review workflow, evidence-backed supersession, incident links, decision freshness and change-impact analysis. | More trustworthy historical reasoning. |
| Phase 4 - Agent platform | Tool registry, richer trace ingestion, policy gates, resumable workflows, agent evaluations, approval gates and run comparison. | Shared institutional context for multiple agents. |
| Phase 5 - Scale and governance | Stricter tenant data-plane isolation options, data export/deletion, backup/recovery, observability, performance tests, compliance work. | Production-readiness assessed against customer needs. |

## 17. Open Decisions / Assumptions

- Working product name is WhyCode; naming and branding are not blockers.
- Deadline is interpreted as 29 October 2026 at 23:59 IST; submission portal time zone/rules must be verified by the team.
- MVP uses one mature public Python repository so code parsing and a Python security scanner are feasible; the data model supports multiple organisations and repositories, but broad language coverage is post-prototype.
- Neo4j AuraDB is the primary persistent application database. No ChromaDB, Postgres, MongoDB, or SQLite is introduced for prototype application state.
- The model provider can be the existing Groq-compatible provider. All model calls must be isolated behind an adapter and secrets held server-side.
- No GitHub write actions are permitted in the prototype. Human approval and scoped write permissions would be required for future automation.
- Use a small, manually verified question set for evaluation. Do not claim enterprise readiness, security certification, or accuracy rates until tests have been run and results recorded.

### Launch gate

The submission is ready when a clean environment can connect to Neo4j, ingest the chosen repository, answer one code-location question with citations, answer or abstain on one “why” question, generate a source-linked handover summary, show one security finding where available, demonstrate an agent Task/AgentRun reload, pass cross-tenant isolation tests, and launch using the documented steps.

## 18. References

Technical references for the implementation team. Re-check exact syntax and feature availability against the Neo4j version/driver selected for the prototype.

- [Neo4j Aura documentation](https://neo4j.com/docs/aura/) - Deployment and Aura platform concepts.
- [Neo4j graph database concepts](https://neo4j.com/docs/getting-started/graph-database/) - Nodes, relationships and properties as the core graph model.
- [Neo4j vector indexes](https://neo4j.com/docs/cypher-manual/current/indexes/search-indexes/vector-indexes/) - Vector index creation, query behaviour and version considerations.
- [Neo4j search indexes / hybrid retrieval](https://neo4j.com/docs/cypher-manual/current/indexes/search-indexes/) - Full-text and vector search, including hybrid retrieval concepts.
- [GitHub webhook types](https://docs.github.com/en/webhooks/types-of-webhooks) - Event-driven repository/organisation integration.
- [LangGraph persistence](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/persistence.mdx) - Thread-scoped checkpoints and longer-lived store concepts.
- [Neo4j RBAC documentation](https://neo4j.com/docs/operations-manual/current/authentication-authorization/manage-privileges/) - Database RBAC and least-privilege concepts; applicability depends on Neo4j offering/version.
