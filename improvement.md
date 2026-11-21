# WhyCode: Hackathon Improvement & Differentiation Masterplan
**Organisation-Level Engineering Memory for Humans and AI Agents**

---

## 1. Executive Summary & Hackathon Positioning

In a hackathon with **160+ competing teams**, over half will submit generic RAG chatbots (*"Chat with your GitHub repo using LangChain + Chroma"*). Judges tune these out in under thirty seconds because they hallucinate, lack organizational context, and provide no real engineering guardrails.

WhyCode's unfair advantage is that it is a **Neo4j Engineering Knowledge Graph**, not a chatbot wrapper. 

> **Core Product Thesis:**  
> *"Code tells you **WHAT** is running. Git tells you **WHEN** it changed. WhyCode is the only platform that proves **WHY** it was built that way, and stops engineers and AI agents from destroying past decisions."*

This document unifies the findings from `WhyCode_Improvement_Plan.docx` and the hackathon track criteria into an actionable blueprint.

---

## 2. Alignment with Hackathon Tracks

### A. Primary Track: "Why The Code Is Like This" (Applied AI)
* **Ingest Repository History:** Commits, PR discussions, issues, and design docs into Neo4j.
* **Graph Connectivity:** Code entities (modules, classes, functions) connected to decisions, people, incidents, and each other.
* **Evidence Chain:** Answers backed by clickable, source-linked provenance (PR, commit SHA, author, timestamp).
* **Confidence & Abstention:** Refusal to hallucinate when the repository cannot establish rationale.
* **Decision Supersession:** *Directly addresses the prompt requirement:* When a later decision quietly overrides an earlier one, WhyCode explicitly flags it as superseded rather than citing dead rationale.

### B. Secondary / Sponsored Track: Neo4j Graph & GraphOps Synergy
* **Multi-Hop Cypher Traversal:** Real-time 1-hop, 2-hop, and 3-hop neighborhood analysis for change blast radius.
* **Graph Algorithm Primitives:** Native Cypher `shortestPath` for attack kill-chains and call hierarchy tracing.
* **Hybrid GraphRAG:** Combining Neo4j vector search + full-text search with graph neighborhood expansion (`_graph_expansion`).

---

## 3. Pass 1: The 4 Critical Credibility Leaks (Fix First)

These are defects in the current code that could cause silent failure during live judging.

### 3.1 Stale Revision Data on Refresh
* **Root Cause:** In `backend/app/ingest/parser.py`, `chunk_key` and `entity_key` depend on line numbers. On refresh, new nodes are merged, but old nodes from moved lines remain orphaned. Counts inflate and stale code is served.
* **Fix:** In `backend/app/ingest/pipeline.py`, explicitly delete repository-scoped `File`, `CodeEntity`, `CodeChunk`, and `SecurityFinding` nodes before rewriting a fresh revision. Preserve append-only history nodes (`Commit`, `PullRequest`, `Issue`).
* **Test:** Ingest repository twice; node counts must be identical and commit SHAs must match the current indexed SHA.

### 3.2 Embedding Backend Mismatch & Vector Disclosure
* **Root Cause:** `embed_query` returns an embedding backend name (e.g., `hash-384` vs. `minilm-l6-v2`), but `retrieval.py` discards it and queries the Neo4j vector index blindly. If the server restarts in hash mode while the database was indexed in MiniLM, cosine similarity becomes meaningless random noise.
* **Fix:** Compare query backend with repository `embedding_backend`. If they mismatch, gracefully disable vector search, rely on lexical + graph expansion, and surface `vector_disabled: true (backend mismatch)` in `/ask` timings and health endpoints.

### 3.3 Verifiable Grounding Report
* **Root Cause:** `llm.py` only validates that cited citation IDs (`[ev1]`) exist in the evidence list, not that the cited text actually supports the sentence.
* **Fix:** Add a **Grounding Report** to every answer:
  - `total_claims`: Number of factual sentences.
  - `supported_claims`: Sentences with semantic/lexical overlap with the cited snippet.
  - `unsupported_claims`: Claims lacking evidence support.
  - `grounding_verdict`: `VERIFIED` or `ABSTAINED`.
  - If support is below threshold, abstain automatically.

### 3.4 Reader Role Bypass on Agent Endpoints
* **Root Cause:** In `backend/app/api.py`, `agent_interrupt` (line 564) and `agent_resume` (line 577) lacked role checks, permitting read-only users to mutate agent state.
* **Fix:** Enforce `principal.role != "reader"` dependency guards across all agent execution endpoints.

---

## 4. Pass 2: Graph & Retrieval Depth

### 4.1 AST-Aligned Symbol Chunking
* **Current State:** Fixed 1,200-character windows that split functions mid-line.
* **Improvement:** Chunk by Python AST boundaries:
  - 1 chunk per module.
  - 1 chunk per class.
  - 1 chunk per function/method.
  - Bounded sliding chunks only for oversized functions (>1,500 chars).
* **Payoff:** Citations and code viewer display complete functions with exact line ranges.

### 4.2 Multi-Source Rationale Mining
* **Current State:** Decisions only extracted from merged PR bodies containing simple string markers.
* **Improvement:** Ingest rationale from:
  1. Code comments: `# HACK`, `# NOTE`, `# SECURITY`, `# TODO`, `# FIXME`, `# DEPRECATED`.
  2. Commit messages: Header + body linked to files touched.
  3. PR review comments and issue discussions.
  4. Explicit vs. Inferred tags on all decision nodes.

### 4.3 Decision Supersession & Drift Modeling
* **Current State:** Older decisions sit alongside newer decisions with equal authority.
* **Improvement:**
  - Create Cypher edge: `(d2:Decision)-[:SUPERSEDES]->(d1:Decision)`.
  - When PR B modifies the same file or function as Decision A with replacement language (*"revert"*, *"replace"*, *"deprecate"*, *"no longer"*), mark `d1.status = 'superseded'`.
  - In Ask / Why mode, flag superseded decisions with an alert:  
    `"Decision #1 originally mandated X, but was SUPERSEDED on 2024-03-12 by PR #5460."`

### 4.4 Security Page Depth: Tradeoffs vs. Unreviewed Debt
* **Current State:** Flat list of Bandit warnings.
* **Improvement:** Categorize findings into two distinct buckets:
  1. 🟢 **Documented Tradeoff:** Finding has a linked Decision explaining why it exists (e.g., SHA-1 kept for client cookie compatibility).
  2. 🔴 **Unreviewed Technical Debt:** Finding has zero rationale in the graph.
  - Display exact code excerpt, affected `CodeEntity`, callers, and decision validity badge.

---

## 5. Pass 3: Newcomer Comprehension & Project Hierarchy

### 5.1 Guided Onboarding Mode in Handover
* Upgrade `Handover.tsx` to offer two view modes:
  - **Executive Report:** High-level summary of architecture, entry points, setup, and risks.
  - **Guided Path:** An interactive 8-step sequence for new joiners:
    1. *What this is* (product & purpose).
    2. *How to run it* (fenced setup commands from docs).
    3. *What to read first* (5 central files by graph degree centrality).
    4. *One end-to-end flow* (API route $\rightarrow$ logic $\rightarrow$ data access).
    5. *Tests* (pinned test suites).
    6. *Recent changes* (latest PRs and decisions).
    7. *Do Not Break* (critical decisions & invariants).
    8. *Unknowns & Who to Ask* (uncovered areas + inferred path owners).

### 5.2 "Explain-Like-I-Am-New" Toggle in Ask
* Add an onboarding toggle to the Ask composer:
  - System prompt switches to define domain acronyms on first mention, provides high-level architectural context before deep-diving into code lines, but strictly maintains citation rules.

### 5.3 Organization $\rightarrow$ Project $\rightarrow$ Repository Hierarchy
* Transition data model from flat `Organization -> Repository` to:
  `(:Organization)-[:OWNS]->(:Project)-[:CONTAINS]->(:Repository)`
* Allows multiple services/repos to share cross-cutting decisions (e.g., company-wide authentication or logging conventions) while preserving strict multi-tenant isolation.

---

## 6. Pass 4: The 2 Standout Additions

### 6.1 Feature A: The Revert & Blast Radius Simulator (Neo4j / GraphOps Track)
* **The Goal:** Answer *"What breaks if I undo or refactor this code or decision?"*
* **The Cypher Engine:**
  ```cypher
  // 1-to-3 Hop Blast Radius Calculation
  MATCH (start:CodeEntity {entity_id: $entity_id})
  OPTIONAL MATCH (start)<-[:AFFECTS]-(d:Decision)
  OPTIONAL MATCH (start)<-[:CALLS*1..2]-(caller:CodeEntity)
  OPTIONAL MATCH (caller)<-[:LOCATED_IN]-(vuln:SecurityFinding)
  RETURN count(DISTINCT start) AS direct_entities,
         count(DISTINCT caller) AS downstream_callers,
         collect(DISTINCT d.summary) AS threatened_decisions,
         collect(DISTINCT vuln.rule_id) AS resurrected_risks
  ```
* **Attack Path Discovery (Shortest Path):**
  ```cypher
  MATCH (entry:CodeEntity), (vuln:SecurityFinding)
  WHERE entry.kind = 'function' AND entry.name IN ['route', 'post', 'get', 'dispatch']
  MATCH path = shortestPath((entry)-[:CALLS*1..5]->(:CodeEntity)<-[:LOCATED_IN]-(vuln))
  RETURN path
  ```
* **UI Delivery:**
  - Interactive **Blast Radius Drawer** displaying affected call chains, threatened invariants, and a visual risk gauge.

---

### 6.2 Feature B: External AI Agent Memory Bridge (Claude Code, Codex, Cursor via MCP)
* **The Goal:** Connect autonomous coding agents (Claude Code CLI, OpenAI Codex, Cursor) to WhyCode's Neo4j memory graph via **Model Context Protocol (MCP)**.
* **Why it matters:** AI agents suffer from context amnesia. When asked to refactor code, they delete backwards-compatibility hacks and cause outages. WhyCode acts as their external memory guardrail.
```
┌──────────────────────────────────────────────┐
│ External Coding Agents                       │
│ • Claude Code (Terminal CLI)                 │
│ • OpenAI Codex / Cursor IDE                  │
└──────────────────────┬───────────────────────┘
                       │ Model Context Protocol (MCP) JSON-RPC
                       ▼
┌──────────────────────────────────────────────┐
│ WhyCode MCP Gateway (/api/mcp)               │
└──────────────────────┬───────────────────────┘
                       │ Native Cypher Queries
                       ▼
┌──────────────────────────────────────────────┐
│ Neo4j Engineering Knowledge Graph            │
│ (Decisions ↔ PRs ↔ Calls ↔ Security Rules)   │
└──────────────────────────────────────────────┘
```

#### MCP Tools Exposed:
1. `whycode_check_intent(symbol, file_path)`: Returns recorded decisions, PR discussions, and authors before an agent modifies code.
2. `whycode_blast_radius(symbol, file_path)`: Evaluates multi-hop collateral damage and threatened invariants for proposed changes.
3. `whycode_get_active_decisions(repo_id)`: Supplies active organizational constraints on startup.
4. `whycode_export_agent_rules(repo_id)`: Generates updated `.cursorrules` or `CLAUDE.md` constraint files.

#### UI Integration:
* Add an **"Agent Connect"** panel with:
  - Copyable `mcp.json` config for Claude Code & Cursor:
    ```json
    {
      "mcpServers": {
        "whycode": {
          "url": "http://127.0.0.1:8000/api/mcp"
        }
      }
    }
    ```
  - Live **Agent Audit Stream** showing external queries from Claude Code/Codex hitting Neo4j in real time.

---

## 7. Implementation Roadmap & Priority Matrix

| Sprint Tier | Focus Area | Key Deliverables | Estimated Time |
| :--- | :--- | :--- | :--- |
| **Tier 1: Credibility** | Integrity & Auditing | • Stale node cleanup on refresh<br>• Query/Repo embedding mismatch check<br>• Reader role guard on agent endpoints<br>• Grounding Report panel in `/ask` | 4 - 6 Hours |
| **Tier 2: Core Graph** | Depth & Supersession | • AST symbol-aware chunking<br>• `SUPERSEDES` decision edge & drift check<br>• Security page: Documented vs. Unreviewed tags<br>• "Inspect in Graph" pivot button on citations | 6 - 8 Hours |
| **Tier 3: Standout Tech** | Agent Bridge & Blast Radius | • MCP JSON-RPC endpoint (`/api/mcp`)<br>• Multi-hop Blast Radius simulator endpoint & UI drawer<br>• Export `CLAUDE.md` / `.cursorrules` button | 5 - 7 Hours |
| **Tier 4: Experience** | Onboarding & Proof | • Guided Handover Mode with task checklist<br>• Comprehensive `README.md` with architecture diagram<br>• Benchmark evaluation script (`scripts/eval.py`) | 3 - 4 Hours |

---

## 8. The Winning 3-Minute Live Pitch Script

* **0:00 - 0:45 | The Hook (The Problem Every Judge Knows):**
  > *"Every engineering team has one person who knows why things are built the way they are. When they leave, that memory is gone. New developers read code, but they can't read intent. And autonomous coding agents like Claude Code or Copilot blindly refactor critical backwards-compatibility code and crash production."*

* **0:45 - 1:30 | The Core Demo (WhyCode in Action):**
  > *"Here is `sessions.py` using SHA-1. A static scanner flags Bandit B324. A regular dev or AI would upgrade it to SHA-256 immediately. But in WhyCode, we query: 'Why is SHA-1 used here?' In 120ms, WhyCode traverses Neo4j, retrieves PR #5460 from @davidism, and proves: it was intentionally kept for backward compatibility with mobile client cookies. Notice the Grounding Report: 100% verified against indexed commit history."*

* **1:30 - 2:15 | The Differentiator (Blast Radius & Agent MCP):**
  > *"Now watch what happens when an AI agent or engineer attempts to revert this. We click 'Simulate Blast Radius'. Neo4j computes a 3-hop neighborhood: 4 dependent services fail, and Bandit finding B324 is resurrected. Furthermore, we connected Claude Code via WhyCode's MCP server. When Claude Code attempts to touch `sessions.py`, WhyCode intercepts it with graph constraints and blocks the regression."*

* **2:15 - 3:00 | The Close (Enterprise Architecture):**
  > *"WhyCode combines Neo4j GraphRAG, multi-tenant isolation, decision supersession, and live agent memory. It doesn't just explain code—it preserves the engineering memory of your organisation."*
