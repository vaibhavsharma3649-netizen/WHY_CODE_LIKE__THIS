import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, ExternalLink, ScanLine, ShieldCheck } from "lucide-react";
import { findings as loadFindings, formatDate } from "../api";
import { useAuth } from "../auth";
import { useAsync } from "../hooks";
import { EmptyBlock, ErrorBlock, KindBadge, LoadingBlock, Pill, SectionLabel } from "../components/ui";

const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function Security() {
  const { repoId } = useAuth();
  const state = useAsync(
    () => (repoId ? loadFindings(repoId) : Promise.reject(new Error("No repository selected."))),
    [repoId],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...(state.data?.findings ?? [])].sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
        a.path.localeCompare(b.path),
    );
  }, [state.data]);

  useEffect(() => {
    if (!sorted.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && sorted.some((f) => f.finding_id === current) ? current : sorted[0].finding_id));
  }, [sorted]);

  const selected = sorted.find((finding) => finding.finding_id === selectedId) ?? null;

  if (!repoId) return <div className="page"><ErrorBlock message="No repository selected." /></div>;
  if (state.loading) return <div className="page"><LoadingBlock label="Reading scanner findings…" /></div>;
  if (state.error) return <div className="page"><ErrorBlock message={state.error} onRetry={state.reload} /></div>;

  const counts = sorted.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Scanner signals, linked to history</p>
          <h1>Security review</h1>
          <p className="sub">
            Bandit findings from the indexed revision, with the decisions that may explain them. A finding
            is a prompt for review, not a verdict.
          </p>
        </div>
        <div className="sev-summary">
          <span className="sev-count sev-high">{counts.HIGH ?? 0} high</span>
          <span className="sev-count sev-medium">{counts.MEDIUM ?? 0} medium</span>
          <span className="sev-count sev-low">{counts.LOW ?? 0} low</span>
        </div>
      </header>

      {sorted.length === 0 ? (
        <EmptyBlock
          title="No scanner findings indexed"
          body="The latest ingest did not record any findings for this repository."
        />
      ) : (
        <div className="security-grid">
          <section className="card findings-list">
            <div className="list-head">
              <SectionLabel>Findings</SectionLabel>
              <span className="rail-count">{sorted.length}</span>
            </div>
            <div className="finding-rows">
              {sorted.map((finding) => (
                <button
                  key={finding.finding_id}
                  type="button"
                  className={`finding-row${selectedId === finding.finding_id ? " is-active" : ""}`}
                  onClick={() => setSelectedId(finding.finding_id)}
                >
                  <span className={`sev sev-${finding.severity.toLowerCase()}`}>{finding.severity}</span>
                  <span className="finding-row-copy">
                    <strong>{finding.rule_id}</strong>
                    <span>
                      {finding.path}:{finding.line_start}
                    </span>
                  </span>
                  <ChevronRight size={14} className="finding-chevron" />
                </button>
              ))}
            </div>
            <p className="list-foot">
              <ScanLine size={12} /> Bandit · indexed revision only
            </p>
          </section>

          {selected ? (
            <section className="card finding-detail">
              <div className="detail-top">
                <span className={`sev sev-${selected.severity.toLowerCase()}`}>{selected.severity}</span>
                <Pill tone="warn">scanner finding — unverified</Pill>
                <Pill tone="neutral">{selected.scanner}</Pill>
                {selected.status ? <Pill tone="neutral">{selected.status}</Pill> : null}
              </div>

              <h2 className="detail-title">{selected.rule_id}</h2>
              <p className="detail-message">{selected.message}</p>

              <dl className="facts detail-facts">
                <div>
                  <dt>Location</dt>
                  <dd>
                    {selected.url ? (
                      <a className="inline-link mono" href={selected.url} target="_blank" rel="noreferrer">
                        {selected.path}:{selected.line_start}
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="mono">
                        {selected.path}:{selected.line_start}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{selected.confidence}</dd>
                </div>
                <div>
                  <dt>Finding ID</dt>
                  <dd className="mono">{selected.finding_id}</dd>
                </div>
              </dl>

              <div className="rationale-block">
                <SectionLabel>Linked rationale</SectionLabel>
                {selected.related_decisions.length === 0 ? (
                  <div className="rationale-none">
                    <ShieldCheck size={17} />
                    <div>
                      <strong>No linked decision in the indexed history.</strong>
                      <p>
                        Treat this as an open scanner signal. Absence of rationale is not evidence that the
                        code is safe or unsafe.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rationale-list">
                    {selected.related_decisions.map((decision, index) => (
                      <article className="rationale-card" key={decision.decision_id ?? index}>
                        <div className="rationale-top">
                          <KindBadge kind="decision" small />
                          {decision.rationale_type ? (
                            <span className="rationale-type">{decision.rationale_type}</span>
                          ) : null}
                        </div>
                        <h4>{decision.summary}</h4>
                        {decision.rationale ? (
                          <blockquote>{decision.rationale}</blockquote>
                        ) : (
                          <p className="muted small">Rationale recorded without a quoted excerpt.</p>
                        )}
                        {decision.evidence_url ? (
                          <a
                            className="inline-link"
                            href={decision.evidence_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open the original discussion <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="muted small">No evidence URL was recorded.</span>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="caveat">
                <AlertTriangle size={14} />
                <span>
                  WhyCode does not prove exploitability. It shows the code location and the historical
                  context a reviewer needs to make that call.
                </span>
              </div>
            </section>
          ) : null}
        </div>
      )}

      <p className="page-foot">
        Generated {formatDate(new Date().toISOString())} from the indexed revision. Scanner output is
        deterministic and reproducible; linked rationale comes from pull request bodies and comments.
      </p>
    </div>
  );
}
