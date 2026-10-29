import type {
  AgentTask,
  AskResult,
  Citation,
  Finding,
  GraphResponse,
  Handover,
  Membership,
  AgentRun,
  Overview,
  Repo,
  Role,
  RunState,
  TimelineItem,
  User,
} from "./types";

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000/api";

const TOKEN_KEY = "whyc.token";
const ORG_KEY = "whyc.org";
const REPO_KEY = "whyc.repo";

export const session = {
  token: (): string | null => localStorage.getItem(TOKEN_KEY),
  org: (): string | null => localStorage.getItem(ORG_KEY),
  repo: (): string | null => localStorage.getItem(REPO_KEY),
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  setOrg(org: string) {
    localStorage.setItem(ORG_KEY, org);
  },
  setRepo(repo: string) {
    localStorage.setItem(REPO_KEY, repo);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_KEY);
    localStorage.removeItem(REPO_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const token = session.token();
  const org = session.org();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(org ? { "X-Org-Id": org } : {}),
    ...(extra ?? {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: headers(init?.headers as Record<string, string> | undefined),
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(typeof detail === "string" ? detail : "Request failed", response.status);
  }
  return (await response.json()) as T;
}

export interface LoginResponse {
  token: string;
  user: User;
  memberships: Membership[];
  active_org: Membership;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  session.setToken(data.token);
  session.setOrg(data.active_org.org_id);
  return data;
}

export async function me(): Promise<{ user: User; memberships: Membership[]; active_org: Membership }> {
  return request("/me");
}

export async function listRepos(): Promise<{
  org: { org_id: string; name: string; role: Role };
  repos: Repo[];
}> {
  return request("/repos");
}

export async function overview(repoId: string): Promise<Overview> {
  return request(`/repos/${repoId}/overview`);
}

export async function refreshRepo(repoId: string): Promise<{ status: string; repo_id: string }> {
  return request(`/repos/${repoId}/refresh`, { method: "POST" });
}

export async function timeline(repoId: string): Promise<{ items: TimelineItem[] }> {
  return request(`/repos/${repoId}/timeline`);
}

export async function ask(repoId: string, question: string, mode = "auto"): Promise<AskResult> {
  return request("/ask", {
    method: "POST",
    body: JSON.stringify({ repo_id: repoId, question, mode }),
  });
}

export interface StreamHandlers {
  onMeta?: (meta: { indexed_sha?: string; repo?: string }) => void;
  onEvidence?: (payload: { evidence: Citation[]; mode: string; timing_ms?: number }) => void;
  onToken?: (text: string) => void;
  onDone?: (result: AskResult) => void;
}

function parseEvent(raw: string): { event: string; data: unknown } | null {
  const lines = raw.split("\n");
  let event = "message";
  const data: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

export async function askStream(
  repoId: string,
  question: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/ask/stream`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ repo_id: repoId, question, mode: "auto" }),
    signal,
  });
  if (!response.ok || !response.body) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(String(detail), response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf("\n\n");
    while (index >= 0) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const parsed = parseEvent(raw);
      if (parsed) {
        if (parsed.event === "meta") handlers.onMeta?.(parsed.data as never);
        else if (parsed.event === "evidence") handlers.onEvidence?.(parsed.data as never);
        else if (parsed.event === "token") handlers.onToken?.((parsed.data as { text: string }).text);
        else if (parsed.event === "done") handlers.onDone?.(parsed.data as AskResult);
      }
      index = buffer.indexOf("\n\n");
    }
  }
}

export async function handover(repoId: string): Promise<Handover> {
  return request(`/repos/${repoId}/handover`);
}

export async function findings(repoId: string): Promise<{ findings: Finding[] }> {
  return request(`/repos/${repoId}/findings`);
}

export async function decisions(repoId: string): Promise<{ decisions: Citation[] }> {
  return request(`/repos/${repoId}/decisions`);
}

export async function graph(repoId: string, focus?: string): Promise<GraphResponse> {
  const query = focus ? `?focus=${encodeURIComponent(focus)}` : "";
  return request(`/repos/${repoId}/graph${query}`);
}

export async function listTasks(repoId: string): Promise<{ tasks: Array<{ task: AgentTask; run_count: number }> }> {
  return request(`/agent/tasks?repo_id=${encodeURIComponent(repoId)}`);
}

export async function createTask(repoId: string, title: string, goal: string): Promise<{ task: AgentTask }> {
  return request("/agent/tasks", {
    method: "POST",
    body: JSON.stringify({ repo_id: repoId, title, goal }),
  });
}

export async function getTask(taskId: string): Promise<{ task: AgentTask; runs: AgentRun[] }> {
  return request(`/agent/tasks/${taskId}`);
}

export async function createRun(taskId: string): Promise<RunState> {
  return request(`/agent/tasks/${taskId}/runs`, { method: "POST" });
}

export async function getRun(runId: string): Promise<RunState> {
  return request(`/agent/runs/${runId}`);
}

export async function autoStep(runId: string): Promise<RunState> {
  return request(`/agent/runs/${runId}/auto`, { method: "POST" });
}

export async function interruptRun(runId: string): Promise<RunState> {
  return request(`/agent/runs/${runId}/interrupt`, { method: "POST" });
}

export async function resumeRun(runId: string): Promise<RunState> {
  return request(`/agent/runs/${runId}/resume`, { method: "POST" });
}

export async function runStep(runId: string, tool: string, args: Record<string, unknown>): Promise<RunState> {
  return request(`/agent/runs/${runId}/step`, {
    method: "POST",
    body: JSON.stringify({ tool, args }),
  });
}

export function formatDate(value?: string | null): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortSha(sha?: string | null): string {
  return sha ? sha.slice(0, 8) : "unknown";
}
