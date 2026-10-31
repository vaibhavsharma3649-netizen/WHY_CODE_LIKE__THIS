import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowUpRight,
  AlertTriangle,
  Check,
  Code2,
  Copy,
  CornerDownLeft,
  MessageSquareText,
  Quote,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { askStream } from "../api";
import type { AskResult, AskTurn, Citation, Role } from "../types";
import { useAuth } from "../auth";
import { errorText } from "../hooks";
import { MODE_LABEL } from "../nav";
import { EvidenceCard, KindBadge, Pill, RichText, SectionLabel } from "../components/ui";

type Phase = "idle" | "retrieving" | "streaming" | "done";

interface Turn {
  id: string;
  question: string;
  answer: string;
  evidence: Citation[];
  result: AskResult | null;
  mode: string;
}

function ms(value?: number): string {
  if (value === undefined || value === null) return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

function engineLabel(engine?: string): string {
  if (engine?.startsWith("groq")) return "Groq";
  if (engine?.includes("fallback")) return "Fallback";
  return "Deterministic";
}

function engineTone(engine?: string): string {
  if (engine?.startsWith("groq")) return "violet";
  if (engine?.includes("fallback")) return "warn";
  return "neutral";
}

function suggestionsForRole(role: Role | null): Array<{ text: string; note: string }> {
  if (role === "security_reviewer") {
    return [
      { text: "Which security findings are linked to a recorded rationale?", note: "Security" },
      { text: "Why is hashlib.sha1 still used in sessions.py?", note: "Why" },
      { text: "What code is affected by the highest-severity finding?", note: "Code" },
      { text: "What should I check before changing the affected file?", note: "Follow-up" },
    ];
  }
  if (role === "developer") {
    return [
      { text: "Where is the WSGI application object defined?", note: "Understand" },
      { text: "How does the request context flow through this code?", note: "Trace" },
      { text: "Why is hashlib.sha1 still used in sessions.py?", note: "Why" },
      { text: "What tests or callers touch this code?", note: "Change" },
    ];
  }
  if (role === "maintainer") {
    return [
      { text: "What changed recently and why?", note: "History" },
      { text: "Which decisions affect the session code?", note: "Decisions" },
      { text: "What should a new maintainer know before changing this?", note: "Handover" },
      { text: "Which security findings have linked rationale?", note: "Security" },
    ];
  }
  return [
    { text: "Where is the WSGI application object defined?", note: "Understand" },
    { text: "Why is hashlib.sha1 still used in sessions.py?", note: "Why" },
    { text: "What security issues are linked to a known rationale?", note: "Security" },
    { text: "Why was the payment retry limit set to three attempts?", note: "Abstain" },
  ];
}

function followUpsFor(citation: Citation | null, role: Role | null): string[] {
  if (role === "security_reviewer") {
    return [
      "Show the security impact and the affected file.",
      "Which recorded rationale explains this code?",
      "What should I check before changing it?",
    ];
  }
  if (citation?.kind === "finding") {
    return [
      "Is this finding linked to a recorded decision?",
      "Show the affected code and surrounding lines.",
      "What should I verify before treating this as exploitable?",
    ];
  }
  if (citation?.kind === "decision") {
    return [
      "Which code does this decision affect?",
      "What evidence supports this rationale?",
      "What would break if this decision were reversed?",
    ];
  }
  if (citation?.kind === "code") {
    return [
      "Explain this code in more detail.",
      "What could break if I change it?",
      "Show the callers and surrounding context.",
    ];
  }
  return [
    "Where is this defined in the code?",
    "What should I check before changing it?",
    "Which decision or PR explains this?",
  ];
}

function CodePanel({ citation, onAsk }: { citation: Citation | null; onAsk: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = citation?.code || citation?.snippet || "";
  const lines = code ? code.split("\n") : [];
  const start = citation?.line_start ?? 1;
  const loc = citation?.path
    ? `${citation.path}${citation.line_start ? `:${citation.line_start}` : ""}`
    : "";

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  if (!citation) {
    return (
      <div className="code-empty">
        <Code2 size={24} />
        <h3>Code stays beside the answer</h3>
        <p>
          Ask a question, then select a code citation. The exact indexed excerpt will open here while
          you keep the conversation going.
        </p>
      </div>
    );
  }

  return (
    <div className="code-panel">
      <div className="code-head">
        <div>
          <div className="code-kicker">
            <KindBadge kind={citation.kind} small />
            <span>{citation.label}</span>
          </div>
          <h3>{citation.title}</h3>
          <p className="code-loc">{loc || citation.commit_sha?.slice(0, 10) || "linked source"}</p>
        </div>
        <div className="code-actions">
          {code ? (
            <button type="button" className="icon-btn" onClick={() => void copy()} title="Copy code">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          ) : null}
          {citation.url ? (
            <a className="icon-btn" href={citation.url} target="_blank" rel="noreferrer" title="Open source">
              <ArrowUpRight size={14} />
            </a>
          ) : null}
        </div>
      </div>

      {lines.length ? (
        <div className="code-scroll">
          <pre className="code-block">
            <code>
              {lines.map((line, index) => (
                <span className="code-line" key={`${index}-${line.slice(0, 12)}`}>
                  <span className="code-line-no">{start + index}</span>
                  <span className="code-line-text">{line || " "}</span>
                </span>
              ))}
            </code>
          </pre>
        </div>
      ) : (
        <p className="code-snippet">{citation.snippet || "No code excerpt is stored for this source."}</p>
      )}

      <button type="button" className="btn btn-soft btn-sm code-ask" onClick={onAsk}>
        <MessageSquareText size={14} />
        Ask about this code
      </button>
    </div>
  );
}

export function Ask() {
  const { repoId, repo, role } = useAuth();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<Citation[]>([]);
  const [result, setResult] = useState<AskResult | null>(null);
  const [mode, setMode] = useState("auto");
  const [phase, setPhase] = useState<Phase>("idle");
  const [retrievalMs, setRetrievalMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const evidenceRef = useRef<Citation[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  evidenceRef.current = evidence;

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [answer, phase, turns.length]);

  const history: AskTurn[] = turns.map((turn) => ({
    question: turn.question,
    answer: turn.answer,
    path: turn.result?.citations?.[0]?.path ?? null,
    line_start: turn.result?.citations?.[0]?.line_start ?? null,
    line_end: turn.result?.citations?.[0]?.line_end ?? null,
  }));

  const run = async (text: string, forcedFocus: Citation | null = null) => {
    const clean = text.trim();
    if (!repoId || clean.length < 2 || phase === "retrieving" || phase === "streaming") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const completed: Turn | null =
      asked && (answer || result)
        ? {
            id: `turn-${turns.length}-${asked.slice(0, 12)}`,
            question: asked,
            answer: result?.answer ?? answer,
            evidence,
            result,
            mode,
          }
        : null;
    const nextHistory = [
      ...history,
      ...(completed
        ? [
            {
              question: completed.question,
              answer: completed.answer,
              path: selectedCitation?.path ?? null,
              line_start: selectedCitation?.line_start ?? null,
              line_end: selectedCitation?.line_end ?? null,
            },
          ]
        : []),
    ].slice(-12);

    if (completed) setTurns((current) => [...current, completed]);
    const needsFocus =
      Boolean(forcedFocus) ||
      (nextHistory.length > 0 &&
        /\b(this|that|it|line|code|change|caller|function|method|file|here)\b/i.test(clean));
    const focus = forcedFocus ?? (needsFocus ? selectedCitation : null);

    setAsked(clean);
    setQuestion(clean);
    setAnswer("");
    setEvidence([]);
    evidenceRef.current = [];
    setResult(null);
    setSelectedCitation(focus);
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
            const firstCode = payload.evidence.find((item) => item.code) ?? payload.evidence[0] ?? null;
            setSelectedCitation((current) => current ?? firstCode);
            setMode(payload.mode);
            setRetrievalMs(payload.timing_ms ?? null);
            setPhase("streaming");
          },
          onToken: (token) => {
            streamed += token;
            setAnswer(streamed);
          },
          onDone: (done) => {
            setResult({ ...done, evidence: evidenceRef.current });
            if (done.answer) setAnswer(done.answer);
            setPhase("done");
          },
        },
        controller.signal,
        nextHistory,
        focus
          ? { path: focus.path, line_start: focus.line_start, line_end: focus.line_end }
          : null,
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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void run(question);
    }
  };

  const busy = phase === "retrieving" || phase === "streaming";
  const confidence = result?.confidence;
  const suggestions = suggestionsForRole(role);
  const followUps = followUpsFor(selectedCitation ?? evidence[0] ?? null, role);
  const hasConversation = turns.length > 0 || phase !== "idle";

  return (
    <div className="page ask-page">
      <header className="page-head compact">
        <div>
          <p className="eyebrow">Chat with the repository</p>
          <h1>Ask the code</h1>
          <p className="sub">
            Keep the answer and the source side by side. Every claim resolves to evidence in{" "}
            {repo?.full_name ?? "this repository"}, or the answer says it cannot establish one.
          </p>
        </div>
      </header>

      <div className="ask-chat-grid">
        <section className="card chat-panel">
          <div className="chat-thread" ref={threadRef}>
            {!hasConversation ? (
              <div className="chat-empty">
                <Quote size={26} />
                <h3>Ask something concrete.</h3>
                <p>
                  Start with a question about code, a decision, or a security signal. The answer streams
                  into the conversation while the exact indexed code opens on the right.
                </p>
                <div className="answer-empty-meta">
                  <span>Code stays on the side</span>
                  <span>Follow-ups keep context</span>
                  <span>Citations before claims</span>
                </div>
              </div>
            ) : null}

            {turns.map((turn) => (
              <div className="chat-turn" key={turn.id}>
                <div className="chat-user">
                  <span className="chat-avatar">
                    <User size={13} />
                  </span>
                  <p>{turn.question}</p>
                </div>
                <div className="chat-assistant">
                  <RichText
                    text={turn.answer}
                    onCitation={(id) => {
                      const citation = turn.evidence.find((item) => item.id === id);
                      if (citation) setSelectedCitation(citation);
                    }}
                  />
                  <div className="chat-turn-foot">
                    <Pill tone="mode">{MODE_LABEL[turn.mode] ?? turn.mode}</Pill>
                    <span>{turn.evidence.length} sources</span>
                    {turn.result?.engine ? <span>{engineLabel(turn.result.engine)}</span> : null}
                    {turn.evidence[0] ? (
                      <button type="button" className="link-btn" onClick={() => setSelectedCitation(turn.evidence[0])}>
                        View code
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {phase !== "idle" ? (
              <div className="chat-turn">
                <div className="chat-user">
                  <span className="chat-avatar">
                    <User size={13} />
                  </span>
                  <p>{asked}</p>
                </div>
                <div className="chat-assistant">
                  <div className="answer-head">
                    <SectionLabel>Answer</SectionLabel>
                    <div className="answer-badges">
                      <Pill tone="mode">{MODE_LABEL[mode] ?? mode}</Pill>
                      {result?.abstained ? <Pill tone="warn">abstained</Pill> : null}
                      {result?.engine ? (
                        <Pill tone={engineTone(result.engine)}>{engineLabel(result.engine)}</Pill>
                      ) : null}
                      {confidence && phase === "done" ? (
                        <span className="confidence">{confidence} confidence</span>
                      ) : null}
                    </div>
                  </div>

                  {phase === "retrieving" ? (
                    <div className="answer-loading">
                      <div className="skeleton w-40" />
                      <div className="skeleton" />
                      <div className="skeleton" />
                      <div className="skeleton w-70" />
                      <span className="loading-note">Retrieving evidence...</span>
                    </div>
                  ) : null}

                  {phase !== "retrieving" ? (
                    <>
                      {result?.abstained ? (
                        <div className="abstain-note">
                          <strong>I could not establish that from this repository.</strong>
                          <span>
                            Ask me to narrow it down: name the file, function, or line you mean. The evidence
                            rail shows what was retrieved without pretending it is an answer.
                          </span>
                        </div>
                      ) : null}
                      <div className="answer-text">
                        <RichText text={answer || "Composing from evidence..."} onCitation={(id) => {
                          const citation = evidence.find((item) => item.id === id);
                          if (citation) setSelectedCitation(citation);
                        }} />
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
                      {phase === "done" ? (
                        <div className="followups">
                          <SectionLabel>Ask a follow-up</SectionLabel>
                          <div className="followup-row">
                            {followUps.map((followUp) => (
                              <button
                                key={followUp}
                                type="button"
                                className="followup"
                                onClick={() => void run(followUp)}
                                disabled={busy}
                              >
                                {followUp}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="inline-error">
                <AlertTriangle size={15} />
                <strong>Query failed.</strong> {error}
              </div>
            ) : null}
          </div>

          <form className="chat-composer" onSubmit={onSubmit}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              maxLength={2000}
              placeholder="Ask about the code. Shift+Enter for a new line."
              aria-label="Question"
            />
            <div className="chat-composer-bar">
              <span className="composer-hint">
                <CornerDownLeft size={12} /> Enter to send
              </span>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy || question.trim().length < 2}>
                <Send size={14} />
                {busy ? "Thinking..." : "Send"}
              </button>
            </div>
          </form>

          {!hasConversation ? (
            <div className="suggestions chat-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.text}
                  type="button"
                  className="suggestion"
                  onClick={() => void run(suggestion.text)}
                  disabled={busy}
                >
                  <span>{suggestion.text}</span>
                  <em>{suggestion.note}</em>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="card code-rail">
          <div className="rail-head">
            <SectionLabel>Source</SectionLabel>
            <span className="rail-count">{evidence.length}</span>
          </div>
          <CodePanel
            citation={selectedCitation}
            onAsk={() => void run("What does this code do, and why does it matter?", selectedCitation)}
          />
          <div className="rail-divider" />
          <div className="rail-head">
            <SectionLabel>Evidence</SectionLabel>
            <span className="rail-count">{evidence.length}</span>
          </div>
          {evidence.length === 0 && phase === "idle" ? (
            <div className="rail-empty">
              <KindBadge kind="decision" small />
              <p>Citations appear as soon as retrieval finishes. Select one to pin the code here.</p>
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
                active={selectedCitation?.id === citation.id && selectedCitation?.path === citation.path}
                onSelect={(item) => setSelectedCitation(item)}
              />
            ))}
          </div>
          {evidence.length > 0 ? (
            <p className="rail-foot">
              <Sparkles size={12} /> Select a citation to pin its code beside the conversation.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
