import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, ExternalLink, Loader2, SearchX } from "lucide-react";
import type { Citation } from "../types";
import { kindMeta } from "../nav";

export function KindBadge({ kind, small = false }: { kind: string; small?: boolean }) {
  const meta = kindMeta(kind);
  const Icon = meta.icon;
  return (
    <span className={`kind kind-${meta.tone}${small ? " kind-sm" : ""}`}>
      <Icon size={small ? 11 : 12} strokeWidth={2} />
      {meta.label}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: string;
  title?: string;
}) {
  return (
    <span className={`pill pill-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function locationOf(citation: Citation): string {
  if (!citation.path) return "";
  return citation.line_start ? `${citation.path}:${citation.line_start}` : citation.path;
}

function snippet(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function EvidenceCard({
  citation,
  active,
  onSelect,
}: {
  citation: Citation;
  active?: boolean;
  onSelect?: (citation: Citation) => void;
}) {
  const meta = kindMeta(citation.kind);
  const Icon = meta.icon;
  const loc = locationOf(citation);
  return (
    <article
      id={`evidence-${citation.id}`}
      className={`evidence${active ? " is-active" : ""}${onSelect ? " is-clickable" : ""}`}
      onClick={() => onSelect?.(citation)}
    >
      <div className="evidence-top">
        <span className={`kind kind-${meta.tone} kind-sm`}>
          <Icon size={11} />
          {meta.label}
        </span>
        <span className="evidence-label">{citation.label}</span>
      </div>
      <h4 className="evidence-title">{citation.title}</h4>
      {citation.snippet ? <p className="evidence-snippet">{snippet(citation.snippet)}</p> : null}
      <div className="evidence-foot">
        <span className="evidence-loc" title={loc}>
          {loc || citation.commit_sha?.slice(0, 10) || "linked record"}
        </span>
        {citation.url ? (
          <a
            className="evidence-link"
            href={citation.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            title="Open original evidence"
          >
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[ev\d+\])/g;

function Inline({ text, onCitation }: { text: string; onCitation?: (id: string) => void }) {
  const parts = text.split(INLINE).filter((part) => part !== "");
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={index}>{part.slice(1, -1)}</code>;
        }
        if (/^\[ev\d+\]$/.test(part)) {
          const id = part.slice(1, -1);
          return (
            <button
              key={index}
              type="button"
              className="cite"
              onClick={() => onCitation?.(id)}
              title={`Evidence ${id}`}
            >
              {id}
            </button>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export function RichText({ text, onCitation }: { text: string; onCitation?: (id: string) => void }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  return (
    <div className="prose">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim().length > 0);
        const groups: Array<{ type: "p" | "ul" | "h3"; lines: string[] }> = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (/^[-*]\s+/.test(trimmed)) {
            const last = groups[groups.length - 1];
            if (last?.type === "ul") last.lines.push(trimmed.replace(/^[-*]\s+/, ""));
            else groups.push({ type: "ul", lines: [trimmed.replace(/^[-*]\s+/, "")] });
          } else if (trimmed.startsWith("### ")) {
            groups.push({ type: "h3", lines: [trimmed.slice(4)] });
          } else {
            const last = groups[groups.length - 1];
            if (last?.type === "p") last.lines.push(trimmed);
            else groups.push({ type: "p", lines: [trimmed] });
          }
        }
        return groups.map((group, index) => {
          const key = `${blockIndex}-${index}`;
          if (group.type === "ul") {
            return (
              <ul key={key}>
                {group.lines.map((line, lineIndex) => (
                  <li key={lineIndex}>
                    <Inline text={line} onCitation={onCitation} />
                  </li>
                ))}
              </ul>
            );
          }
          if (group.type === "h3") {
            return <h3 key={key}>{group.lines[0]}</h3>;
          }
          return (
            <p key={key}>
              {group.lines.map((line, lineIndex) => (
                <span key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  <Inline text={line} onCitation={onCitation} />
                </span>
              ))}
            </p>
          );
        });
      })}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner">
      <Loader2 size={15} className="spin" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function LoadingBlock({ label = "Reading the graph…" }: { label?: string }) {
  return (
    <div className="state-block">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block state-error">
      <AlertTriangle size={18} />
      <div>
        <strong>Could not load this view</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyBlock({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-block">
      <SearchX size={22} />
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {children}
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-label">
      <span>{children}</span>
      {action}
    </div>
  );
}

export function ExternalArrow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="inline-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}
