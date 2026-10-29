import { AlertCircle, FileCode2, Link2 } from "lucide-react";
import { formatDate, handover as loadHandover } from "../api";
import { useAuth } from "../auth";
import { useAsync } from "../hooks";
import { ErrorBlock, LoadingBlock, Pill, RichText, SectionLabel } from "../components/ui";

const COVERAGE: Record<string, { label: string; tone: string }> = {
  fact: { label: "Fact", tone: "ok" },
  inferred: { label: "Inferred", tone: "warn" },
  unknown: { label: "Unknown", tone: "neutral" },
};

export function Handover() {
  const { repoId, repo } = useAuth();
  const state = useAsync(
    () => (repoId ? loadHandover(repoId) : Promise.reject(new Error("No repository selected."))),
    [repoId],
  );

  if (!repoId) return <div className="page"><ErrorBlock message="No repository selected." /></div>;
  if (state.loading) return <div className="page"><LoadingBlock label="Assembling the handover…" /></div>;
  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorBlock message={state.error ?? "Handover unavailable"} onRetry={state.reload} />
      </div>
    );
  }

  const data = state.data;
  const counts = data.sections.reduce(
    (acc, section) => {
      acc[section.coverage] = (acc[section.coverage] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const generatedRepo = (data.repo ?? repo) as typeof repo;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Transferable context</p>
          <h1>Handover brief</h1>
          <p className="sub">
            Assembled section by section from the indexed graph. Facts carry sources; gaps stay explicit.
          </p>
          <div className="head-meta">
            <span className="sha-chip">{generatedRepo?.indexed_sha?.slice(0, 8) ?? "unknown"}</span>
            <span className="meta-dim">generated {formatDate(data.generated_at)}</span>
          </div>
        </div>
        <div className="coverage-summary">
          <span className="cov cov-fact">{counts.fact ?? 0} facts</span>
          <span className="cov cov-inferred">{counts.inferred ?? 0} inferred</span>
          <span className="cov cov-unknown">{counts.unknown ?? 0} unknown</span>
        </div>
      </header>

      <div className="handover-grid">
        {data.sections.map((section, index) => {
          const coverage = COVERAGE[section.coverage] ?? COVERAGE.unknown;
          const sources = section.sources.filter(
            (source, sourceIndex, all) =>
              all.findIndex(
                (other) =>
                  other.title === source.title &&
                  other.path === source.path &&
                  other.line_start === source.line_start,
              ) === sourceIndex,
          );
          return (
            <article key={section.key} className={`card handover-card cov-border-${section.coverage}`}>
              <header className="handover-card-head">
                <span className="section-num">{String(index + 1).padStart(2, "0")}</span>
                <h3>{section.title}</h3>
                <Pill tone={coverage.tone}>{coverage.label}</Pill>
              </header>
              <RichText text={section.body} />
              {sources.length > 0 ? (
                <div className="sources">
                  <span className="sources-label">
                    <Link2 size={12} /> Sources
                  </span>
                  <ul>
                    {sources.slice(0, 6).map((source, sourceIndex) => (
                      <li key={`${source.title}-${sourceIndex}`}>
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noreferrer">
                            <FileCode2 size={12} />
                            {source.title}
                          </a>
                        ) : (
                          <span className="source-static">
                            <FileCode2 size={12} />
                            {source.title}
                            {source.line_start ? <code>:{source.line_start}</code> : null}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {data.unknowns.length > 0 ? (
        <section className="card unknowns">
          <SectionLabel>Explicit unknowns</SectionLabel>
          <ul>
            {data.unknowns.map((unknown, index) => (
              <li key={index}>
                <AlertCircle size={14} />
                <span>{unknown}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            These gaps are written down on purpose. A handover that invents certainty is worse than one
            that names what it cannot verify.
          </p>
        </section>
      ) : null}

      <p className="page-foot">
        Generated from {generatedRepo?.full_name ?? "the indexed repository"} at{" "}
        <code>{generatedRepo?.indexed_sha?.slice(0, 10) ?? "unknown"}</code>. No free-form summary model was
        used to fill gaps.
      </p>
    </div>
  );
}
