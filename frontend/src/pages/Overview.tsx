import {
  ArrowUpRight,
  Bot,
  Check,
  ShieldCheck,
  Boxes,
  ClipboardList,
  FileCode2,
  GitCommitHorizontal,
  MessageSquareText,
  Network,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../auth";
import { formatDate, shortSha, overview as loadOverview } from "../api";
import { useAsync } from "../hooks";
import { ErrorBlock, KindBadge, LoadingBlock, Pill, SectionLabel } from "../components/ui";
import type { PageKey } from "../nav";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  maintainer: "Maintainer",
  developer: "Developer",
  security_reviewer: "Security reviewer",
  reader: "Reader",
};

export function Overview({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const { repoId, org, role } = useAuth();
  const state = useAsync(
    () => (repoId ? loadOverview(repoId) : Promise.reject(new Error("No repository selected."))),
    [repoId],
  );

  if (!repoId) {
    return (
      <div className="page">
        <ErrorBlock message="No repository is available for this organization." />
      </div>
    );
  }
  if (state.loading) return <div className="page"><LoadingBlock label="Loading repository memory…" /></div>;
  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorBlock message={state.error ?? "Repository not found"} onRetry={state.reload} />
      </div>
    );
  }

  const data = state.data;
  const repo = data.repo;
  const counts = data.counts;
  const timeline = (data.timeline ?? []).slice(0, 9);

  const stats = [
    { label: "Files", value: counts.files ?? 0, icon: FileCode2, tone: "green", note: "parsed and indexed" },
    { label: "Code entities", value: counts.entities ?? 0, icon: Boxes, tone: "blue", note: `${counts.chunks ?? 0} retrieval chunks` },
    { label: "Decisions", value: counts.decisions ?? 0, icon: Scale, tone: "amber", note: "with quoted evidence" },
    { label: "Findings", value: counts.findings ?? 0, icon: ShieldAlert, tone: "red", note: "scanner signals" },
  ];

  const explore: Array<{ page: PageKey; title: string; body: string; icon: typeof MessageSquareText }> = [
    { page: "ask", title: "Ask the repository", body: "Grounded answers with citations, or an explicit abstention.", icon: MessageSquareText },
    { page: "handover", title: "Read the handover", body: "Setup, entry points, tests, and the unknowns left open.", icon: ClipboardList },
    { page: "security", title: "Review security signals", body: "Bandit findings linked to the decisions that explain them.", icon: ShieldAlert },
    { page: "agent", title: "Inspect agent memory", body: "Persistent task state that revalidates against the indexed SHA.", icon: Bot },
  ];

  return (
    <div className="page">
      <header className="page-head overview-head">
        <div className="page-head-copy">
          <p className="eyebrow">
            {org?.org_name} <span className="sep">/</span> {repo.owner}
          </p>
          <h1>{repo.full_name}</h1>
          <p className="sub">
            {repo.description ||
              "Repository memory assembled from source, pull requests, issues, and security scans."}
          </p>
          <div className="head-meta">
            <span className="sha-chip">{shortSha(repo.indexed_sha)}</span>
            <span className="meta-dim">on {repo.default_branch ?? "main"}</span>
            <span className="meta-dim">·</span>
            <span className="meta-dim">synced {formatDate(repo.last_synced_at)}</span>
            {repo.synthetic ? <Pill tone="warn">synthetic fixture</Pill> : null}
          </div>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("ask")}>
            <MessageSquareText size={15} />
            Ask the repo
          </button>
        </div>
      </header>

      <div className="stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`stat-card stat-${stat.tone}`}>
              <span className="stat-icon">
                <Icon size={17} strokeWidth={1.9} />
              </span>
              <div>
                <span className="stat-label">{stat.label}</span>
                <span className="stat-value">{stat.value.toLocaleString()}</span>
                <span className="stat-note">{stat.note}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overview-grid">
        <section className="card">
          <SectionLabel
            action={
              <button type="button" className="link-btn" onClick={() => onNavigate("ask")}>
                Ask about history <ArrowUpRight size={13} />
              </button>
            }
          >
            Recent activity
          </SectionLabel>
          {timeline.length === 0 ? (
            <p className="muted">No commits or decisions are indexed yet.</p>
          ) : (
            <ol className="timeline">
              {timeline.map((item, index) => (
                <li key={`${item.kind}-${item.at}-${index}`} className={`timeline-item tl-${item.kind}`}>
                  <span className="timeline-dot" />
                  <div className="timeline-body">
                    <div className="timeline-top">
                      <KindBadge kind={item.kind} small />
                      <span className="timeline-date">{formatDate(item.at)}</span>
                    </div>
                    <p className="timeline-title">{item.title}</p>
                  </div>
                  {item.url ? (
                    <a className="timeline-link" href={item.url} target="_blank" rel="noreferrer" title="Open source">
                      <ArrowUpRight size={14} />
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <SectionLabel>Indexed revision</SectionLabel>
            <dl className="facts">
              <div>
                <dt>Commit</dt>
                <dd className="mono">{repo.indexed_sha ?? "unknown"}</dd>
              </div>
              <div>
                <dt>Branch</dt>
                <dd>{repo.default_branch ?? "main"}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>{role ? ROLE_LABEL[role] : "unknown"}</dd>
              </div>
              <div>
                <dt>Embeddings</dt>
                <dd className="mono">{repo.embedding_backend ?? "minilm-l6-v2"}</dd>
              </div>
            </dl>
            <p className="fact-note">
              Answers are revalidated against this revision. If the repo moves, the UI says so rather than
              silently mixing history.
            </p>
          </section>

          <section className="card card-quiet">
            <SectionLabel
              action={
                <button type="button" className="link-btn" onClick={() => onNavigate("graph")}>
                  Open graph <Network size={13} />
                </button>
              }
            >
              Memory shape
            </SectionLabel>
            <div className="mini-shape">
              <div className="mini-node">
                <GitCommitHorizontal size={13} /> commits
              </div>
              <span className="mini-edge" />
              <div className="mini-node">
                <Scale size={13} /> decisions
              </div>
              <span className="mini-edge" />
              <div className="mini-node">
                <ShieldAlert size={13} /> findings
              </div>
            </div>
            <p className="muted small">
              Every edge is a claim with a source. The graph explorer caps nodes and keeps layout ordered
              so structure stays readable.
            </p>
          </section>

          <section className="card card-quiet">
            <SectionLabel>Access boundary</SectionLabel>
            <div className="access-head">
              <span className="access-icon">
                <ShieldCheck size={16} />
              </span>
              <div>
                <strong>{role ? ROLE_LABEL[role] : "Signed in"}</strong>
                <span>{org?.org_name}</span>
              </div>
            </div>
            <ul className="access-list">
              <li>
                <Check size={13} /> Every query is scoped to this organization
              </li>
              <li>
                <Check size={13} /> Cross-tenant reads return 404, not empty data
              </li>
              <li>
                <Check size={13} />
                {role === "reader" ? "Read-only: refresh and agent writes are blocked" : "Role-gated writes are enforced per request"}
              </li>
            </ul>
          </section>
        </div>
      </div>

      <section className="explore">
        <SectionLabel>Explore the memory</SectionLabel>
        <div className="explore-grid">
          {explore.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.page} type="button" className="explore-card" onClick={() => onNavigate(item.page)}>
                <span className="explore-icon">
                  <Icon size={17} />
                </span>
                <span className="explore-title">{item.title}</span>
                <span className="explore-body">{item.body}</span>
                <ArrowUpRight size={14} className="explore-arrow" />
              </button>
            );
          })}
        </div>
      </section>

      <p className="page-foot">
        {counts.files ?? 0} files · {counts.entities ?? 0} entities · {counts.chunks ?? 0} chunks indexed in
        Neo4j. Findings are scanner signals, not exploitability verdicts.
      </p>
    </div>
  );
}
