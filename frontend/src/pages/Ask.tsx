import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CornerDownLeft, Quote, Sparkles, SquarePen } from "lucide-react";
import { askStream } from "../api";
import type { AskResult, Citation } from "../types";
import { useAuth } from "../auth";
import { errorText } from "../hooks";
import { MODE_LABEL } from "../nav";
import { EvidenceCard, KindBadge, Pill, RichText, SectionLabel } from "../components/ui";

const SUGGESTIONS = [
  { text: "Where is the WSGI application object defined?", note: "Understand" },
  { text: "Why is hashlib.sha1 still used in sessions.py?", note: "Why" },
  { text: "What security issues are linked to a known rationale?", note: "Security" },
  { text: "Why was the payment retry limit set to three attempts?", note: "Abstain" },
];

type Phase = "idle" | "retrieving" | "streaming" | "done";

function ms(value?: number): string {
  if (value === undefined || value === null) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

export function Ask() {
  const { repoId, repo } = useAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<Citation[]>([]);
  const [result, setResult] = useState<AskResult | null>(null);
  const [mode, setMode] = useState("auto");
  const [phase, setPhase] = useState<Phase>("idle");
  const [retrievalMs, setRetrievalMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<string | null>(null);
  const [asked, setAsked] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const evidenceRef = useRef<Citation[]>([]);
  const railRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  evidenceRef.current = evidence;

  const run = async (text: string) => {
    const clean = text.trim();
    if (!repoId || clean.length < 2 || phase === "retrieving" || phase === "streaming") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAsked(clean);
    setQuestion(clean);
    setAnswer("");
    setEvidence([]);
    evidenceRef.current = [];
    setResult(null);
    setError(null);
    setMode("auto");
    setRetrievalMs(null);
    setPhase("retrieving");

    let streamed = "";
    try {
      await askStream(
        repoId,
        clean,
        {
          onEvidence: (payload) => {
            setEvidence(payload.evidence);
            evidenceRef.current = payload.evidence;
            setMode(payload.mode);
            setRetrievalMs(payload.timing_ms ?? null);
            setPhase("streaming");
          },
          onToken: (text) => {
            streamed += text;
            setAnswer(streamed);
          },
          onDone: (done) => {
            setResult({ ...done, evidence: evidenceRef.current });
            if (done.answer) setAnswer(done.answer);
            setPhase("done");
          },
        },
        controller.signal,
      );
      setPhase((current) => (current === "retrieving" ? "done" : current));
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError(errorText(err));
      setPhase("idle");
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(question);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void run(question);
    }
  };

  const focusCitation = (id: string) => {
    setActiveCitation(id);
    const node = document.getElementById(`evidence-${id}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (railRef.current) {
      railRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.setTimeout(() => setActiveCitation((current) => (current === id ? null : current)), 1800);
  };

  const busy = phase === "retrieving" || phase === "streaming";
  const confidence = result?.confidence;

  return (
    <div className="page ask-page">
      <header className="page-head compact">
        <div>
          <p className="eyebrow">Evidence or abstain</p>
          <h1>Ask the repository</h1>
          <p className="sub">
            Hybrid retrieval over reviewed Cypher templates. Every claim must resolve to a source in{" "}
            {repo?.full_name ?? "this repository"}.
          </p>
        </div>
      </header>

      <form className="composer" onSubmit={onSubmit}>
        <div className="composer-icon">
          <SquarePen size={17} />
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          maxLength={2000}
          placeholder="Why does this code do that? Where is it defined? What should I know before changing it?"
          aria-label="Question"
        />
        <div className="composer-bar">
          <span className="composer-hint">
            Auto-routes across code, history, security, and handover. Retrieval never invents Cypher.
          </span>
          <div className="composer-actions">
            <span className="kbd-hint">
              <span className="kbd">Ctrl</span>
              <span className="kbd">Enter</span>
            </span>
            <button type="submit" className="btn btn-primary" disabled={busy || question.trim().length < 2}>
              <Sparkles size={15} />
              {busy ? "Thinking…" : "Ask"}
            </button>
          </div>
        </div>
      </form>

      <div className="suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.text}
            type="button"
            className={`suggestion${asked === suggestion.text ? " is-active" : ""}`}
            onClick={() => void run(suggestion.text)}
            disabled={busy}
          >
            <span>{suggestion.text}</span>
            <em>{suggestion.note}</em>
          </button>
        ))}
      </div>

      {error ? (
        <div className="inline-error">
          <strong>Query failed.</strong> {error}
        </div>
      ) : null}

      <div className="ask-grid">
        <div className="stack answer-stack">
          <section className="card answer-card" ref={answerRef}>
          <div className="answer-head">
            <SectionLabel>Answer</SectionLabel>
            <div className="answer-badges">
              {phase !== "idle" ? <Pill tone="mode">{MODE_LABEL[mode] ?? mode}</Pill> : null}
              {result?.abstained ? <Pill tone="warn">abstained</Pill> : null}
              {result?.engine ? (
                <Pill tone={result.engine.startsWith("groq") ? "violet" : "neutral"}>
                  {result.engine.startsWith("groq") ? "Groq" : "deterministic"}
                </Pill>
              ) : null}
              {confidence && phase === "done" ? <span className="confidence">{confidence} confidence</span> : null}
            </div>
          </div>

          {phase === "idle" ? (
            <div className="answer-empty">
              <Quote size={26} />
              <h3>Ask something concrete.</h3>
              <p>
                WhyCode will retrieve code, pull requests, decisions, and scanner context, then answer only
                from what the graph can support. If the history does not establish an answer, it says so.
              </p>
              <div className="answer-empty-meta">
                <span>Evidence panel streams first</span>
                <span>Answer streams after</span>
                <span>Full turn under 15s</span>
              </div>
            </div>
          ) : null}

          {phase === "retrieving" ? (
            <div className="answer-loading">
              <div className="skeleton w-40" />
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton w-70" />
              <span className="loading-note">Retrieving evidence…</span>
            </div>
          ) : null}

          {phase !== "idle" && phase !== "retrieving" ? (
            <>
              {result?.abstained ? (
                <div className="abstain-note">
                  <strong>Not established by the indexed repository.</strong>
                  <span>
                    No decision or source passed the relevance gate. The evidence rail shows what was
                    retrieved, without pretending it is an answer.
                  </span>
                </div>
              ) : null}
              <div className="answer-text">
                <RichText text={answer || "Composing from evidence…"} onCitation={focusCitation} />
                {phase === "streaming" ? <span className="caret" /> : null}
              </div>
              <div className="answer-foot">
                <div className="timing-strip">
                  <span>
                    retrieve <strong>{ms(retrievalMs ?? result?.timings?.retrieve)}</strong>
                  </span>
                  <span>
                    total <strong>{ms(result?.timings?.total)}</strong>
                  </span>
                  <span>
                    evidence <strong>{evidence.length}</strong>
                  </span>
                  {result?.audit_id ? (
                    <span className="audit">
                      audit <code>{result.audit_id}</code>
                    </span>
                  ) : null}
                </div>
                {result?.indexed_sha ? (
                  <span className="sha-foot">indexed at {result.indexed_sha.slice(0, 10)}</span>
                ) : null}
              </div>
            </>
          ) : null}
          </section>

          {phase !== "idle" && phase !== "retrieving" ? (
            <section className="card answer-method">
              <SectionLabel>Grounding</SectionLabel>
              <div className="method-row">
                <span>
                  Mode <strong>{MODE_LABEL[mode] ?? mode}</strong>
                </span>
                <span>
                  Evidence <strong>{evidence.length} sources</strong>
                </span>
                <span>
                  Engine <strong>{result?.engine?.startsWith("groq") ? "Groq" : "deterministic"}</strong>
                </span>
              </div>
              <p>
                Claims resolve to the rail before the answer streams. Retrieval fuses lexical and vector
                candidates over reviewed Cypher templates; the model never writes Cypher and has no tools
                at generation time.
              </p>
            </section>
          ) : null}
        </div>

        <aside className="card evidence-rail" ref={railRef}>
          <div className="rail-head">
            <SectionLabel>Evidence</SectionLabel>
            <span className="rail-count">{evidence.length}</span>
          </div>
          {evidence.length === 0 && phase === "idle" ? (
            <div className="rail-empty">
              <KindBadge kind="decision" small />
              <p>
                Citations appear here as soon as retrieval finishes, before the answer finishes streaming.
              </p>
            </div>
          ) : null}
          {evidence.length === 0 && phase !== "idle" && phase !== "retrieving" ? (
            <div className="rail-empty">
              <p>No evidence passed the relevance gate. That is a result, not a failure.</p>
            </div>
          ) : null}
          <div className="evidence-list">
            {evidence.map((citation) => (
              <EvidenceCard
                key={citation.id}
                citation={citation}
                active={activeCitation === citation.id}
                onSelect={() => focusCitation(citation.id)}
              />
            ))}
          </div>
          {evidence.length > 0 ? (
            <p className="rail-foot">
              <CornerDownLeft size={12} /> Select a citation to jump to it. Links open the original artifact.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
