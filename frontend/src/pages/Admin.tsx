import { useState, type FormEvent } from "react";
import {
  Github,
  KeyRound,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Trash2,
  Users,
  GitFork,
} from "lucide-react";
import {
  adminAddRepo,
  adminCreateUser,
  adminGithubRepos,
  adminGithubStatus,
  adminRemoveRepo,
  adminRemoveUser,
  adminRepos,
  adminResetPassword,
  adminUpdateUser,
  adminUsers,
  formatDate,
  orgAudit,
  refreshRepo,
  shortSha,
} from "../api";
import { useAuth } from "../auth";
import { errorText, useAsync, useToast } from "../hooks";
import { EmptyBlock, ErrorBlock, LoadingBlock, Pill, SectionLabel } from "../components/ui";
import type { PageKey } from "../nav";
import type { Role } from "../types";

type Tab = "people" | "repositories" | "github" | "audit";

const ROLES: Role[] = ["admin", "maintainer", "developer", "security_reviewer", "reader"];
const TABS: Array<{ key: Tab; label: string; icon: typeof Users }> = [
  { key: "people", label: "People", icon: Users },
  { key: "repositories", label: "Repositories", icon: GitFork },
  { key: "github", label: "GitHub", icon: Github },
  { key: "audit", label: "Audit", icon: ScrollText },
];

export function Admin({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const { org, repoId, setRepoId, reloadRepos } = useAuth();
  const [tab, setTab] = useState<Tab>("people");
  const [secret, setSecret] = useState<string | null>(null);
  const [toast, setToast] = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("reader");
  const [fullName, setFullName] = useState("");
  const [branch, setBranch] = useState("");

  const users = useAsync(adminUsers, []);
  const repos = useAsync(adminRepos, []);
  const github = useAsync(adminGithubStatus, []);
  const audit = useAsync(() => orgAudit(80), []);
  const ghRepos = useAsync(adminGithubRepos, []);

  const report = (message: string) => setToast(message);
  const fail = (error: unknown) => setToast(errorText(error));

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await adminCreateUser({ email, name, role });
      setSecret(result.temporary_password);
      setEmail("");
      setName("");
      users.reload();
      report(`Invited ${result.email}`);
    } catch (error) {
      fail(error);
    }
  };

  const changeRole = async (userId: string, nextRole: Role, status: string) => {
    try {
      await adminUpdateUser(userId, { role: nextRole, status: status as "active" | "disabled" });
      users.reload();
      report("Membership updated");
    } catch (error) {
      fail(error);
    }
  };

  const reset = async (userId: string) => {
    try {
      const result = await adminResetPassword(userId);
      setSecret(result.temporary_password);
      report("Temporary password generated");
    } catch (error) {
      fail(error);
    }
  };

  const removeUser = async (userId: string) => {
    try {
      await adminRemoveUser(userId);
      users.reload();
      report("Membership removed");
    } catch (error) {
      fail(error);
    }
  };

  const addRepo = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await adminAddRepo({ full_name: fullName, branch: branch || undefined });
      setFullName("");
      setBranch("");
      repos.reload();
      await reloadRepos();
      report(`Queued ${result.full_name}`);
    } catch (error) {
      fail(error);
    }
  };

  const reindex = async (id: string) => {
    try {
      await refreshRepo(id);
      repos.reload();
      await reloadRepos();
      report("Reindex queued");
    } catch (error) {
      fail(error);
    }
  };

  const removeRepo = async (id: string) => {
    if (!window.confirm("Remove this repository and all of its indexed memory?")) return;
    try {
      await adminRemoveRepo(id);
      repos.reload();
      await reloadRepos();
      report("Repository removed");
    } catch (error) {
      fail(error);
    }
  };

  const importRepo = async (full_name: string) => {
    try {
      const result = await adminAddRepo({ full_name });
      ghRepos.reload();
      repos.reload();
      report(`Queued ${result.full_name}`);
    } catch (error) {
      fail(error);
    }
  };

  const openRepo = (id: string) => {
    setRepoId(id);
    onNavigate("overview");
  };

  return (
    <div className="page admin-page">
      <header className="page-head">
        <div className="page-head-copy">
          <p className="eyebrow">{org?.org_name} <span className="sep">/</span> Administration</p>
          <h1>Workspace controls</h1>
          <p className="sub">Manage people, repositories, GitHub access, and the audit trail for this organization.</p>
        </div>
        <div className="head-actions">
          <Pill tone="ok"><ShieldCheck size={12} /> Org scoped</Pill>
        </div>
      </header>

      <div className="admin-tabs" role="tablist">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`admin-tab${tab === item.key ? " is-active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              <Icon size={15} /> {item.label}
            </button>
          );
        })}
      </div>

      {secret ? (
        <div className="admin-secret" role="status">
          <KeyRound size={16} />
          <div>
            <strong>Save this password now</strong>
            <p>It will not be shown again. The user must change it on first sign-in.</p>
            <code>{secret}</code>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSecret(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {tab === "people" ? (
        <section className="card admin-card">
          <SectionLabel>Invite a teammate</SectionLabel>
          <form className="admin-form" onSubmit={invite}>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional" />
            </label>
            <label>
              Role
              <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button type="submit" className="btn btn-primary">
              <Plus size={14} /> Invite
            </button>
          </form>

          {users.loading ? <LoadingBlock label="Loading people…" /> : null}
          {users.error ? <ErrorBlock message={users.error} onRetry={users.reload} /> : null}
          {users.data && users.data.users.length === 0 ? (
            <EmptyBlock title="No members yet" body="Invite someone to get started." />
          ) : null}
          {users.data && users.data.users.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last sign-in</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.users.map((item) => (
                    <tr key={item.user.user_id}>
                      <td>
                        <strong>{item.user.name || item.user.email}</strong>
                        <span className="admin-sub">{item.user.email}</span>
                        {item.user.github_login ? (
                          <span className="admin-sub">@{item.user.github_login}</span>
                        ) : null}
                      </td>
                      <td>
                        <select
                          className="admin-inline-select"
                          value={item.role}
                          onChange={(event) =>
                            void changeRole(item.user.user_id, event.target.value as Role, item.membership_status)
                          }
                        >
                          {ROLES.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="admin-inline-select"
                          value={item.membership_status}
                          onChange={(event) =>
                            void changeRole(item.user.user_id, item.role, event.target.value)
                          }
                        >
                          <option value="active">active</option>
                          <option value="disabled">disabled</option>
                        </select>
                      </td>
                      <td className="admin-sub">{formatDate(item.user.last_login_at)}</td>
                      <td className="admin-actions">
                        <button type="button" className="icon-btn" title="Reset password" onClick={() => void reset(item.user.user_id)}>
                          <KeyRound size={14} />
                        </button>
                        <button type="button" className="icon-btn" title="Remove membership" onClick={() => void removeUser(item.user.user_id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "repositories" ? (
        <section className="card admin-card">
          <SectionLabel>Connect a repository</SectionLabel>
          <form className="admin-form" onSubmit={addRepo}>
            <label className="admin-form-grow">
              Repository
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                required
              />
            </label>
            <label>
              Branch
              <input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="default" />
            </label>
            <button type="submit" className="btn btn-primary">
              <Plus size={14} /> Index repository
            </button>
          </form>
          <p className="admin-hint">
            The org GitHub connection needs read access to the repository. Indexing runs in the background.
          </p>

          {repos.loading ? <LoadingBlock label="Loading repositories…" /> : null}
          {repos.error ? <ErrorBlock message={repos.error} onRetry={repos.reload} /> : null}
          {repos.data && repos.data.repos.length === 0 ? (
            <EmptyBlock title="No repositories" body="Connect one above to start building memory." />
          ) : null}
          {repos.data && repos.data.repos.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Status</th>
                    <th>Indexed</th>
                    <th>Memory</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {repos.data.repos.map((item) => (
                    <tr key={item.repo_id} className={item.repo_id === repoId ? "is-current" : undefined}>
                      <td>
                        <strong>{item.full_name}</strong>
                        <span className="admin-sub">{item.default_branch ?? "main"} · {shortSha(item.indexed_sha)}</span>
                        {item.error_text ? <span className="admin-sub admin-error">{item.error_text}</span> : null}
                      </td>
                      <td><Pill tone={item.sync_status === "failed" ? "red" : item.sync_status === "ready" ? "ok" : "warn"}>{item.sync_status ?? "unknown"}</Pill></td>
                      <td className="admin-sub">{formatDate(item.last_synced_at)}</td>
                      <td className="admin-sub">
                        {item.counts?.files ?? 0} files · {item.counts?.decisions ?? 0} decisions · {item.counts?.findings ?? 0} findings
                      </td>
                      <td className="admin-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openRepo(item.repo_id)}>Open</button>
                        <button type="button" className="icon-btn" title="Reindex" onClick={() => void reindex(item.repo_id)}>
                          <RefreshCw size={14} />
                        </button>
                        <button type="button" className="icon-btn" title="Remove repository" onClick={() => void removeRepo(item.repo_id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "github" ? (
        <section className="card admin-card">
          <SectionLabel>GitHub connection</SectionLabel>
          {github.loading ? <LoadingBlock label="Checking GitHub…" /> : null}
          {github.error ? <ErrorBlock message={github.error} onRetry={github.reload} /> : null}
          {github.data ? (
            <div className="admin-github-status">
              <div>
                <strong>Organization token</strong>
                <Pill tone={github.data.token_configured ? "ok" : "warn"}>
                  {github.data.token_configured ? "configured" : "missing"}
                </Pill>
              </div>
              <div>
                <strong>GitHub App</strong>
                <Pill tone={github.data.app_installed ? "ok" : github.data.app_configured ? "warn" : "neutral"}>
                  {github.data.app_installed
                    ? "installed"
                    : github.data.app_configured
                      ? "not installed"
                      : "not configured"}
                </Pill>
              </div>
              {github.data.install_url ? (
                <a className="btn btn-soft btn-sm" href={github.data.install_url}>
                  <Github size={14} /> Install GitHub App
                </a>
              ) : null}
            </div>
          ) : null}
          <p className="admin-hint">
            A fine-grained organization token works for public and private repos. For least-privilege access,
            install the GitHub App and let it grant per-repository access.
          </p>

          <SectionLabel>Available repositories</SectionLabel>
          {ghRepos.loading ? <LoadingBlock label="Loading GitHub repositories…" /> : null}
          {ghRepos.error ? <ErrorBlock message={ghRepos.error} onRetry={ghRepos.reload} /> : null}
          {ghRepos.data && ghRepos.data.repos.length === 0 ? (
            <EmptyBlock
              title="No repositories found"
              body="Set GITHUB_TOKEN on the API or install the GitHub App to list repositories."
            />
          ) : null}
          {ghRepos.data && ghRepos.data.repos.length > 0 ? (
            <div className="admin-repo-list">
              {ghRepos.data.repos.map((item) => (
                <div key={item.full_name} className="admin-repo-row">
                  <div>
                    <strong>{item.full_name}</strong>
                    <span className="admin-sub">{item.private ? "private" : "public"} · {item.default_branch}</span>
                  </div>
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => void importRepo(item.full_name)}>
                    <Plus size={13} /> Index
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="card admin-card">
          <SectionLabel>Recent activity</SectionLabel>
          {audit.loading ? <LoadingBlock label="Loading audit…" /> : null}
          {audit.error ? <ErrorBlock message={audit.error} onRetry={audit.reload} /> : null}
          {audit.data && audit.data.events.length === 0 ? (
            <EmptyBlock title="No events yet" body="Sign-ins, imports, and admin changes appear here." />
          ) : null}
          {audit.data && audit.data.events.length > 0 ? (
            <ol className="admin-audit">
              {audit.data.events.map((event) => (
                <li key={event.event_id}>
                  <span className={`admin-audit-dot ${event.outcome === "ok" ? "is-ok" : ""}`} />
                  <div>
                    <strong>{event.action}</strong>
                    <span className="admin-sub">
                      {event.actor_id} · {event.outcome} · {formatDate(event.timestamp)}
                    </span>
                  </div>
                  {event.target_id ? <code className="admin-sub">{event.target_id}</code> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
