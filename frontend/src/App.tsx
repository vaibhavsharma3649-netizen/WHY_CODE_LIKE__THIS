import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { Mark } from "./components/Mark";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Ask } from "./pages/Ask";
import { Handover } from "./pages/Handover";
import { Security } from "./pages/Security";
import { Agent } from "./pages/Agent";
import { Graph } from "./pages/Graph";
import { Admin } from "./pages/Admin";
import { ROLE_HOME, type PageKey } from "./nav";

const PAGES: PageKey[] = [
  "overview",
  "ask",
  "handover",
  "security",
  "agent",
  "graph",
  "admin",
];

function readPage(): PageKey {
  const raw = window.location.hash.replace(/^#\/?/, "");
  return PAGES.includes(raw as PageKey) ? (raw as PageKey) : "overview";
}

function Splash() {
  return (
    <div className="splash">
      <Mark size={38} />
      <span>Opening the memory…</span>
    </div>
  );
}

export default function App() {
  const { ready, user, role } = useAuth();
  const [page, setPage] = useState<PageKey>(readPage);

  useEffect(() => {
    const onHash = () => setPage(readPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!ready || !user || window.location.hash) return;
    const next = ROLE_HOME[role ?? "reader"];
    window.location.hash = `#/${next}`;
    setPage(next);
  }, [ready, user, role]);

  const navigate = (next: PageKey) => {
    if (window.location.hash !== `#/${next}`) window.location.hash = `#/${next}`;
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!ready) return <Splash />;
  if (!user) return <Login />;

  const activePage: PageKey = page === "admin" && role !== "admin" ? "overview" : page;

  return (
    <Layout page={activePage} onNavigate={navigate}>
      {activePage === "overview" ? <Overview onNavigate={navigate} /> : null}
      {activePage === "ask" ? <Ask /> : null}
      {activePage === "handover" ? <Handover /> : null}
      {activePage === "security" ? <Security /> : null}
      {activePage === "agent" ? <Agent /> : null}
      {activePage === "graph" ? <Graph /> : null}
      {activePage === "admin" ? <Admin onNavigate={navigate} /> : null}
    </Layout>
  );
}
