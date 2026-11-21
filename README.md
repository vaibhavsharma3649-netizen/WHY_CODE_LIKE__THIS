# WhyCode

**Organisation-level engineering memory for humans and AI agents.**

Code tells you *what* is running. Git tells you *when* it changed. WhyCode is a Neo4j knowledge graph that proves *why* it was built that way — and stops engineers and AI agents from destroying past decisions.

---

## What it does

- **Graph-grounded answers** — every claim in `/ask` resolves to indexed evidence (code, decision, PR, commit, finding) or the answer abstains.
- **Grounding report** — each answer returns `total_claims`, `supported_claims`, `unsupported_claims`, and a `VERIFIED` / `PARTIAL` / `ABSTAINED` verdict.
- **Decision history** — rationale is mined from PR bodies and linked to the files and entities it affects.
- **Security context** — Bandit findings are linked to the code entities they sit in and the decisions that explain them.
- **Handover mode** — a generated onboarding report for new engineers.
- **Agent workspace** — a tool-using agent that reads the graph instead of guessing.

## Architecture

```
React + Vite (Vercel)
        │  HTTPS / JSON + SSE
        ▼
FastAPI (Render)  ──►  Groq (optional LLM synthesis)
        │
        ├──► Neo4j (Aura / local)  : CodeEntity, Decision, PR, Commit, Finding
        ├──► GitHub API            : repos, commits, PRs, issues
        └──► Bandit                : security findings
```

Retrieval is hybrid: Neo4j full-text + vector search + graph expansion, merged with reciprocal rank fusion. If the embedding backend changes between ingest and query, vector search is disabled automatically and lexical + graph retrieval continue.

## Local quickstart

Prerequisites: Python 3.12+, Node 18+, and a Neo4j instance (local Docker or Neo4j Aura).

```powershell
copy .env.example .env
# edit .env: set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, WHYCODE_JWT_SECRET

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd frontend
npm install
cd ..

# Windows demo launcher (starts Neo4j, API, and UI)
run.bat seed
```

Open http://127.0.0.1:5173. Demo login: `ada@whyc.dev` / `whyc-demo`.

Other seeded users: `maya`, `dev`, `sec`, `reader` @ `whyc.dev`; `grace@beta.dev`.

### Connecting repositories and people

Sign in as an admin (`ada@whyc.dev`) and open **Admin** from the sidebar or topbar. The console has four tabs:

- **People** — invite users by email, assign roles, disable memberships, reset passwords, and remove access. Temporary passwords are shown once and must be changed on first sign-in. The last active admin in an org cannot be removed or demoted.
- **Repositories** — connect any repository the org GitHub connection can read, using `owner/repo` or a GitHub URL. Indexing runs in the background; the same tab shows sync status, counts, errors, reindex, and removal.
- **GitHub** — shows whether a fine-grained org token and/or GitHub App are configured. With a token you can import any repo the token sees (public or private). With a GitHub App you can install it on selected repos for least-privilege access. Either way, imports are available from this tab.
- **Audit** — sign-ins, refreshes, imports, reindexes, and admin changes, scoped to the current organization.

GitHub OAuth is optional. If `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set, the login page offers "Continue with GitHub". A GitHub identity must match an existing invited user (or an org with `github_auto_join` enabled) before access is granted.

### Run pieces manually

```powershell
# API
cd backend
uvicorn app.main:app --reload --port 8000

# UI
cd frontend
npm run dev
```

API docs are available at `/docs` outside production.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | yes | Use Aura or a private Neo4j instance. Never expose the database publicly. |
| `WHYCODE_JWT_SECRET` | yes | ≥ 32 random bytes. Generate with `python -c "import secrets;print(secrets.token_urlsafe(48))"`. |
| `WHYCODE_ENV` | no | `dev` (default) or `prod`. Production enforces secret checks and disables docs. |
| `GITHUB_TOKEN` | recommended | Read-only org token for imports, refresh, and private repos. Needs repository metadata + contents read. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | Enable GitHub OAuth sign-in. |
| `GITHUB_OAUTH_REDIRECT` | with OAuth | Defaults to `WHYCODE_API_URL/auth/github/callback`. Must match the OAuth app exactly. |
| `GITHUB_APP_ID` / `GITHUB_APP_SLUG` / `GITHUB_APP_PRIVATE_KEY` | optional | Least-privilege per-repo access. Private key accepts literal `\n`. |
| `WHYCODE_FRONTEND_URL` | prod | Vercel URL used by OAuth redirects. |
| `WHYCODE_API_URL` | prod | Public API base including `/api`, used to derive the OAuth callback. |
| `WHYCODE_REFRESH_TOKEN_DAYS` | no | Refresh token lifetime, default `30`. |
| `GROQ_API_KEY` | optional | Empty runs deterministic evidence mode. |
| `WHYCODE_CORS_ORIGINS` | prod | Comma-separated exact origins, e.g. `https://your-app.vercel.app`. |
| `WHYCODE_CORS_ORIGIN_REGEX` | prod | e.g. `https://.*\.vercel\.app` for preview deployments. |
| `WHYCODE_EMBEDDING_MODE` | no | `auto` (MiniLM if installed) or `hash` for the small production image. |
| `VITE_API_URL` | frontend | Full API base, e.g. `https://whycode-api.onrender.com/api`. |

## Deployment

### Backend — Render (Docker)

1. Create a **Neo4j Aura** instance and copy its `bolt+s://` URI and credentials.
2. In Render, create a **Blueprint** from this repository (uses `render.yaml`) or a **Web Service** with runtime **Docker**.
3. Set the secret env vars:
   - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
   - `GITHUB_TOKEN` (read-only)
   - `GROQ_API_KEY` (optional)
   - `WHYCODE_FRONTEND_URL` = your Vercel URL; `WHYCODE_API_URL` = the Render `/api` base
   - `GITHUB_TOKEN` with read access to the repos you want to import (or configure the GitHub App)
   - Optional: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_REDIRECT`
   - `WHYCODE_CORS_ORIGINS` = your Vercel production URL
4. `WHYCODE_JWT_SECRET` is generated by the blueprint; keep it stable across deploys.
5. Health check: `GET /api/health`.

The production image uses `requirements-deploy.txt` and hash embeddings, so it builds quickly without downloading model weights.

### Frontend — Vercel

1. Import the repo and set **Root Directory** to `frontend`.
2. Framework preset: **Vite** (also pinned in `frontend/vercel.json`).
3. Add environment variable `VITE_API_URL = https://<your-render-service>.onrender.com/api`.
4. Deploy. `frontend/vercel.json` adds SPA rewrites and security headers.

After the first deploy, set `WHYCODE_CORS_ORIGINS` on Render to the final Vercel URL and redeploy the API.

## Security notes

- Production startup fails fast if `WHYCODE_JWT_SECRET` or `NEO4J_PASSWORD` are left at defaults, or if CORS allows `*` with credentials.
- API docs and OpenAPI schema are disabled when `WHYCODE_ENV=prod`.
- Security headers (nosniff, frame denial, referrer policy, permissions policy, HSTS) are set by the API and the frontend host.
- Login and Ask endpoints are rate-limited per client IP.
- Access tokens carry a version claim; password changes, admin resets, and disabling a membership revoke all refresh tokens and invalidate existing access tokens.
- Refresh tokens are one-time, stored only as SHA-256 hashes, rotated on use, and expire after `WHYCODE_REFRESH_TOKEN_DAYS`. OAuth login codes are also one-time and short-lived.
- All Cypher queries use parameters; no user input is interpolated into queries.
- The container runs as a non-root user.
- LLM output is treated as untrusted; retrieved repository text is fenced as untrusted evidence in the prompt.

## Tests

```powershell
python -m pytest backend/tests/ -q
cd frontend; npm run build
```

## Roadmap

See `improvement.md` for the full hackathon roadmap (decision supersession, blast-radius simulator, MCP agent bridge, guided onboarding).
