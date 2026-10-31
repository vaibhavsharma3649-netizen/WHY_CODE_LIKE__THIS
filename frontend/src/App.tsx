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
import { ROLE_HOME, type PageKey } from "./nav";

const PAGES: PageKey[] = ["overview", "ask", "handover", "security", "agent", "graph"];

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

  return (
    <Layout page={page} onNavigate={navigate}>
      {page === "overview" ? <Overview onNavigate={navigate} /> : null}
      {page === "ask" ? <Ask /> : null}
      {page === "handover" ? <Handover /> : null}
      {page === "security" ? <Security /> : null}
      {page === "agent" ? <Agent /> : null}
      {page === "graph" ? <Graph /> : null}
    </Layout>
  );
}
