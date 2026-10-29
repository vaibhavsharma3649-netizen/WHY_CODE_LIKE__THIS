import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as client from "./api";
import type { Membership, Repo, Role, User } from "./types";

interface AuthContextValue {
  ready: boolean;
  user: User | null;
  memberships: Membership[];
  org: Membership | null;
  role: Role | null;
  repos: Repo[];
  repoId: string | null;
  repo: Repo | null;
  setRepoId: (repoId: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  switchOrg: (orgId: string) => Promise<void>;
  reloadRepos: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function pickRepo(repos: Repo[], saved: string | null): string | null {
  if (saved && repos.some((repo) => repo.repo_id === saved)) return saved;
  return repos[0]?.repo_id ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [org, setOrg] = useState<Membership | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoId, setRepoIdState] = useState<string | null>(client.session.repo());

  const loadRepos = useCallback(async () => {
    const data = await client.listRepos();
    setRepos(data.repos);
    setOrg((current) =>
      current && current.org_id === data.org.org_id
        ? { ...current, name: data.org.name, org_name: data.org.name, role: data.org.role }
        : current,
    );
    setRepoIdState((current) => {
      const next = pickRepo(data.repos, current);
      if (next) client.session.setRepo(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!client.session.token()) {
        setReady(true);
        return;
      }
      try {
        const data = await client.me();
        if (cancelled) return;
        setUser(data.user);
        setMemberships(data.memberships);
        setOrg(data.active_org);
        await loadRepos();
      } catch {
        client.session.clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRepos]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await client.login(email, password);
      setUser(data.user);
      setMemberships(data.memberships);
      setOrg(data.active_org);
      await loadRepos();
    },
    [loadRepos],
  );

  const signOut = useCallback(() => {
    client.session.clear();
    setUser(null);
    setMemberships([]);
    setOrg(null);
    setRepos([]);
    setRepoIdState(null);
  }, []);

  const switchOrg = useCallback(
    async (orgId: string) => {
      const target = memberships.find((m) => m.org_id === orgId);
      if (!target) return;
      client.session.setOrg(orgId);
      setOrg(target);
      setRepos([]);
      setRepoIdState(null);
      await loadRepos();
    },
    [loadRepos, memberships],
  );

  const setRepoId = useCallback((next: string) => {
    client.session.setRepo(next);
    setRepoIdState(next);
  }, []);

  const repo = useMemo(
    () => repos.find((item) => item.repo_id === repoId) ?? null,
    [repos, repoId],
  );

  const value: AuthContextValue = {
    ready,
    user,
    memberships,
    org,
    role: org?.role ?? null,
    repos,
    repoId,
    repo,
    setRepoId,
    signIn,
    signOut,
    switchOrg,
    reloadRepos: loadRepos,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
