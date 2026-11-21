import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, KeyRound, LogOut, RefreshCw, RotateCw, Settings2 } from "lucide-react";
import { Mark } from "./Mark";
import { useAuth } from "../auth";
import { navForRole, type PageKey } from "../nav";
import { Pill } from "./ui";
import { refreshRepo, shortSha } from "../api";
import { errorText, useToast } from "../hooks";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  maintainer: "Maintainer",
  developer: "Developer",
  security_reviewer: "Security reviewer",
  reader: "Reader",
};

function initials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Layout({
  page,
  onNavigate,
  children,
}: {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}) {
  const { user, org, role, memberships, repos, repo, repoId, setRepoId, switchOrg, signOut, reloadRepos, mustChangePassword, changePassword } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useToast();
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const canRefresh = role === "admin" || role === "maintainer";
  const canAdmin = role === "admin";
  const nav = navForRole(role);
  const primaryPage: PageKey =
    role === "security_reviewer" ? "security" : role === "developer" ? "ask" : "ask";
  const primaryLabel =
    role === "security_reviewer" ? "Review security" : role === "developer" ? "Ask the code" : "Ask the repo";

  const onRefresh = async () => {
    if (!repoId) return;
    setRefreshing(true);
    try {
      await refreshRepo(repoId);
      await reloadRepos();
      setToast("Reindex queued. The graph will update when ingestion finishes.");
    } catch (error) {
      setToast(errorText(error));
    } finally {
      setRefreshing(false);
    }
  };

  const onSubmitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPwBusy(true);
    setPwError(null);
    try {
      await changePassword(pwCurrent, pwNext);
    } catch (error) {
      setPwError(errorText(error));
      setPwBusy(false);
    }
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => onNavigate("overview")}>
          <Mark size={32} />
          <span className="brand-text">
            <span className="brand-name">WhyCode</span>
            <span className="brand-sub">engineering memory</span>
          </span>
        </button>

        <nav className="nav-group" aria-label="Workspace">
          <span className="nav-label">
            {role === "security_reviewer"
              ? "Security workspace"
              : role === "developer"
                ? "Engineering workspace"
                : "Workspace"}
          </span>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item${page === item.key ? " is-active" : ""}`}
                onClick={() => onNavigate(item.key)}
                title={item.hint}
              >
                <Icon size={17} strokeWidth={1.9} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="org-block">
            <span className="nav-label">Organization</span>
            <div className="select-wrap">
              <select
                className="select org-select"
                value={org?.org_id ?? ""}
                onChange={(event) => void switchOrg(event.target.value)}
                aria-label="Switch organization"
              >
                {memberships.map((membership) => (
                  <option key={membership.org_id} value={membership.org_id}>
                    {membership.org_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
            <span className="org-role">{role ? ROLE_LABEL[role] : ""}</span>
          </div>

          <div className="user-card">
            <span className="avatar">{initials(user?.name, user?.email)}</span>
            <span className="user-text">
              <strong>{user?.name ?? "Signed in"}</strong>
              <span>{user?.email}</span>
            </span>
            <button type="button" className="icon-btn" onClick={() => void signOut()} title="Sign out" aria-label="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button type="button" className="mobile-brand" onClick={() => onNavigate("overview")}>
            <Mark size={26} />
            <span>WhyCode</span>
          </button>

          <div className="topbar-left">
            <span className="crumb">Repository</span>
            <div className="select-wrap">
              <select
                className="select repo-select"
                value={repoId ?? ""}
                onChange={(event) => setRepoId(event.target.value)}
                aria-label="Select repository"
              >
                {repos.map((item) => (
                  <option key={item.repo_id} value={item.repo_id}>
                    {item.full_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
            {repo?.indexed_sha ? (
              <span className="sha-chip" title="Indexed revision">
                {shortSha(repo.indexed_sha)}
              </span>
            ) : null}
            <Pill
              tone={repo?.sync_status === "failed" ? "red" : repo?.sync_status === "queued" ? "warn" : "ok"}
              title={repo?.error_text ?? "Repository sync status"}
            >
              <span className="live-dot" />
              {repo?.sync_status === "failed"
                ? "Sync failed"
                : repo?.sync_status === "queued"
                  ? "Queued"
                  : "Indexed"}
            </Pill>
          </div>

          <div className="topbar-right">
            {canRefresh ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm refresh-btn"
                onClick={onRefresh}
                disabled={refreshing || !repoId || repo?.sync_status === "queued"}
                title="Queue a reindex"
              >
                <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
                {refreshing ? "Queueing" : "Refresh"}
              </button>
            ) : null}
            {canAdmin ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate("admin")}
                title="Manage people, repositories, and audit"
              >
                <Settings2 size={14} />
                Manage
              </button>
            ) : null}
            <span className="role-chip">{role ? ROLE_LABEL[role] : ""}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate(primaryPage)}>
              {primaryLabel}
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {toast ? (
        <div className="toast" role="status">
          <RotateCw size={14} />
          <span>{toast}</span>
        </div>
      ) : null}

      {mustChangePassword ? (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={onSubmitPassword}>
            <span className="modal-icon"><KeyRound size={19} /></span>
            <h2>Set your password</h2>
            <p>
              An administrator created or reset your password. Choose a new one before continuing.
              You will be asked to sign in again.
            </p>
            <label>
              Temporary password
              <input
                type="password"
                value={pwCurrent}
                onChange={(event) => setPwCurrent(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={pwNext}
                onChange={(event) => setPwNext(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            {pwError ? <p className="form-error">{pwError}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={pwBusy}>
              {pwBusy ? "Saving…" : "Save password"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
