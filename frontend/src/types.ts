export type Role = "admin" | "maintainer" | "developer" | "security_reviewer" | "reader";

export interface Membership {
  org_id: string;
  org_name: string;
  role: Role;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
}

export interface RepoCounts {
  files?: number;
  entities?: number;
  chunks?: number;
  decisions?: number;
  findings?: number;
}

export interface Repo {
  repo_id: string;
  owner: string;
  name: string;
  full_name: string;
  description?: string;
  default_branch?: string;
  indexed_sha?: string;
  sync_status?: string;
  last_synced_at?: string;
  url?: string;
  embedding_backend?: string;
  synthetic?: boolean;
  counts?: RepoCounts;
}

export interface Citation {
  id: string;
  kind: "code" | "decision" | "finding" | "commit" | "pr" | "issue" | "file" | string;
  title: string;
  snippet: string;
  url?: string | null;
  path?: string | null;
  line_start?: number | null;
  line_end?: number | null;
  commit_sha?: string | null;
  label: string;
  score?: number | null;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  evidence: Citation[];
  mode: string;
  abstained: boolean;
  confidence: string;
  timings: Record<string, number>;
  audit_id?: string | null;
  indexed_sha?: string | null;
  engine?: string;
}

export interface HandoverSource {
  title: string;
  url?: string | null;
  path?: string | null;
  line_start?: number | null;
}

export interface HandoverSection {
  key: string;
  title: string;
  body: string;
  coverage: "fact" | "inferred" | "unknown";
  sources: HandoverSource[];
}

export interface Handover {
  repo: Repo & { org_name?: string };
  generated_at: string;
  sections: HandoverSection[];
  unknowns: string[];
}

export interface DecisionRef {
  decision_id: string;
  summary: string;
  rationale: string;
  evidence_url?: string | null;
  rationale_type?: string;
}

export interface Finding {
  finding_id: string;
  rule_id: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  confidence: string;
  status: string;
  scanner: string;
  path: string;
  line_start: number;
  line_end: number;
  message: string;
  url?: string | null;
  label: string;
  related_decisions: DecisionRef[];
}

export interface GraphNodeData {
  kind: string;
  title: string;
  subtitle?: string | null;
  meta: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
  title: string;
  subtitle?: string | null;
  meta: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  focus?: string | null;
}

export interface TimelineItem {
  kind: string;
  at: string;
  title: string;
  url?: string | null;
}

export interface Overview {
  repo: Repo;
  org: { org_id: string; name: string; role?: Role };
  counts: RepoCounts;
  recent_commits: Array<{
    sha?: string;
    message?: string;
    author_name?: string;
    committed_at?: string;
    url?: string;
  }>;
  timeline: TimelineItem[];
}

export interface AgentStep {
  n: number;
  tool: string;
  args: Record<string, unknown>;
  result_count: number;
  evidence_ids: string[];
  at: string;
}

export interface AgentRun {
  run_id: string;
  task_id: string;
  status: string;
  current_step: string;
  summary: string;
  seen_sha: string;
  steps: AgentStep[];
  source_refs: string[];
  resume_count: number;
  resume_note?: string | null;
  started_at?: string;
  updated_at?: string;
  resumed_at?: string | null;
  interrupted_at?: string | null;
  last_tool?: string | null;
}

export interface AgentTask {
  task_id: string;
  title: string;
  goal: string;
  status: string;
  current_step: string;
  summary: string;
  repo_id: string;
  created_at: string;
}

export interface AgentContextItem {
  kind: string;
  title: string;
  snippet: string;
  node_id?: string | null;
}

export interface RunState {
  run: AgentRun;
  task: AgentTask | null;
  context: AgentContextItem[];
  results?: Array<Record<string, unknown>>;
  validation?: {
    seen_sha: string;
    indexed_sha: string;
    head_sha?: string;
    moved: boolean;
    source: string;
  };
  tool?: string;
}
