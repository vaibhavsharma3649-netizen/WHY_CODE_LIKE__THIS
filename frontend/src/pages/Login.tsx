import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, LockKeyhole } from "lucide-react";
import { Mark } from "../components/Mark";
import { useAuth } from "../auth";
import { errorText } from "../hooks";

interface DemoAccount {
  email: string;
  role: string;
  note: string;
  tone: string;
}

const DEMOS: DemoAccount[] = [
  { email: "ada@whyc.dev", role: "Admin", note: "Northwind Engineering", tone: "green" },
  { email: "maya@whyc.dev", role: "Maintainer", note: "Can reindex the repo", tone: "green" },
  { email: "dev@whyc.dev", role: "Developer", note: "Asks and runs agents", tone: "blue" },
  { email: "sec@whyc.dev", role: "Security reviewer", note: "Findings + rationale", tone: "amber" },
  { email: "reader@whyc.dev", role: "Reader", note: "Read-only, cannot refresh", tone: "neutral" },
  { email: "grace@beta.dev", role: "Beta admin", note: "Separate tenant — isolation demo", tone: "violet" },
];

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("ada@whyc.dev");
  const [password, setPassword] = useState("whyc-demo");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (nextEmail: string, nextPassword: string, marker: string) => {
    setBusy(marker);
    setError(null);
    try {
      await signIn(nextEmail, nextPassword);
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(email, password, "form");
  };

  return (
    <div className="login">
      <section className="login-aside">
        <div className="login-brand">
          <Mark size={34} />
          <span>WhyCode</span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Org-level engineering memory</p>
          <h1>
            Answers that cite
            <br />
            the commit, not the vibe.
          </h1>
          <p className="lede">
            WhyCode connects code, pull requests, decisions, and scanner findings in Neo4j so
            engineers and AI agents can ask <em>why</em> — and get evidence or an honest abstention.
          </p>

          <ul className="proof-list">
            <li>
              <Check size={15} /> Every answer carries a URL, path, or commit
            </li>
            <li>
              <Check size={15} /> Tenant and role boundaries enforced per request
            </li>
            <li>
              <Check size={15} /> Agent state survives restarts, then revalidates
            </li>
          </ul>
        </div>

        <footer className="login-foot">
          <span>Demo build</span>
          <span>pallets/flask</span>
          <span>Neo4j · MiniLM · FastAPI</span>
        </footer>
      </section>

      <section className="login-main">
        <div className="login-card">
          <header>
            <h2>Sign in</h2>
            <p>Pick a demo identity to explore role-aware access.</p>
          </header>

          <form onSubmit={onSubmit} className="login-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary login-submit" disabled={busy !== null}>
              {busy === "form" ? <Loader2 size={15} className="spin" /> : <LockKeyhole size={15} />}
              {busy === "form" ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="demo-block">
            <div className="demo-head">
              <span>One-click demo accounts</span>
              <span className="demo-pass">password: whyc-demo</span>
            </div>
            <div className="demo-list">
              {DEMOS.map((demo, index) => (
                <button
                  key={demo.email}
                  type="button"
                  className={`demo-row${index === 5 ? " demo-row-sep" : ""}`}
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword("whyc-demo");
                    void submit(demo.email, "whyc-demo", demo.email);
                  }}
                  disabled={busy !== null}
                >
                  <span className={`demo-dot demo-${demo.tone}`} />
                  <span className="demo-identity">
                    <strong>{demo.email}</strong>
                    <span>{demo.note}</span>
                  </span>
                  <span className="demo-role">{demo.role}</span>
                  {busy === demo.email ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <ArrowRight size={14} className="demo-arrow" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
