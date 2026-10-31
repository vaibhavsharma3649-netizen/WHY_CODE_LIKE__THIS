import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CircleDot,
  Code2,
  FileCode2,
  GitCommitHorizontal,
  GitPullRequest,
  LayoutDashboard,
  MessageSquareText,
  Network,
  Scale,
  ShieldAlert,
  ClipboardList,
} from "lucide-react";
import type { Role } from "./types";

export type PageKey = "overview" | "ask" | "handover" | "security" | "agent" | "graph";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  maintainer: "Maintainer",
  developer: "Developer",
  security_reviewer: "Security reviewer",
  reader: "Reader",
};

export const ROLE_HOME: Record<Role, PageKey> = {
  admin: "overview",
  maintainer: "overview",
  developer: "ask",
  security_reviewer: "security",
  reader: "overview",
};

const ROLE_NAV: Record<Role, PageKey[]> = {
  admin: ["overview", "agent", "ask", "handover", "security", "graph"],
  maintainer: ["overview", "ask", "handover", "security", "agent", "graph"],
  developer: ["ask", "handover", "overview", "graph", "security", "agent"],
  security_reviewer: ["security", "ask", "agent", "graph", "handover", "overview"],
  reader: ["overview", "ask", "handover", "security", "graph", "agent"],
};

export interface NavItem {
  key: PageKey;
  label: string;
  icon: LucideIcon;
  hint: string;
}

export const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, hint: "Repository memory at a glance" },
  { key: "ask", label: "Ask", icon: MessageSquareText, hint: "Grounded answers with evidence" },
  { key: "handover", label: "Handover", icon: ClipboardList, hint: "What a new engineer needs" },
  { key: "security", label: "Security", icon: ShieldAlert, hint: "Signals and linked rationale" },
  { key: "agent", label: "Agent", icon: Bot, hint: "Persistent, resumable context" },
  { key: "graph", label: "Graph", icon: Network, hint: "The memory structure" },
];

export function navForRole(role: Role | null): NavItem[] {
  const order = ROLE_NAV[role ?? "reader"];
  const byKey = new Map(NAV.map((item) => [item.key, item]));
  return order.flatMap((key) => {
    const item = byKey.get(key);
    return item ? [item] : [];
  });
}

export interface KindMeta {
  label: string;
  tone: string;
  icon: LucideIcon;
}

export const KIND_META: Record<string, KindMeta> = {
  code: { label: "Code", tone: "code", icon: Code2 },
  file: { label: "File", tone: "file", icon: FileCode2 },
  decision: { label: "Decision", tone: "decision", icon: Scale },
  finding: { label: "Finding", tone: "finding", icon: ShieldAlert },
  pr: { label: "Pull request", tone: "pr", icon: GitPullRequest },
  pull_request: { label: "Pull request", tone: "pr", icon: GitPullRequest },
  commit: { label: "Commit", tone: "commit", icon: GitCommitHorizontal },
  issue: { label: "Issue", tone: "issue", icon: CircleDot },
  chunk: { label: "Chunk", tone: "file", icon: FileCode2 },
  module: { label: "Module", tone: "code", icon: Code2 },
  function: { label: "Function", tone: "code", icon: Code2 },
  class: { label: "Class", tone: "code", icon: Code2 },
  method: { label: "Method", tone: "code", icon: Code2 },
  repository: { label: "Repository", tone: "repo", icon: Network },
  entity: { label: "Entity", tone: "code", icon: Code2 },
};

export function kindMeta(kind: string): KindMeta {
  return KIND_META[kind] ?? { label: kind.replace(/_/g, " "), tone: "file", icon: CircleDot };
}

export const MODE_LABEL: Record<string, string> = {
  auto: "Auto",
  understand: "Understand",
  why: "Why",
  security: "Security",
  handover: "Handover",
};
