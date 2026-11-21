from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    value = os.getenv(name, default).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1].strip()
    return value


def _int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)) or default)
    except ValueError:
        return default


def _normalize_neo4j_uri(uri: str) -> str:
    raw = (uri or "").strip()
    if not raw:
        return "bolt://localhost:7687"
    if ".databases.neo4j.io" in raw:
        host_part = raw
        if "://" in host_part:
            host_part = host_part.split("://", 1)[1]
        if host_part.endswith(":7687"):
            host_part = host_part[:-5]
        return f"neo4j+s://{host_part}"
    return raw


@dataclass(frozen=True)
class Settings:
    env: str = _env("WHYCODE_ENV", "dev")
    neo4j_uri: str = _normalize_neo4j_uri(_env("NEO4J_URI", "bolt://localhost:7687"))
    neo4j_user: str = _env("NEO4J_USER", "neo4j")
    neo4j_password: str = _env("NEO4J_PASSWORD", "neo4j")
    neo4j_database: str = _env("NEO4J_DATABASE", "neo4j")
    jwt_secret: str = _env(
        "WHYCODE_JWT_SECRET",
        "whyc-auth-secure-secret-key-2026-production-ready-32bytes",
    )
    token_ttl_minutes: int = _int("WHYCODE_TOKEN_TTL_MINUTES", 720)
    refresh_token_days: int = _int("WHYCODE_REFRESH_TOKEN_DAYS", 30)
    frontend_url: str = _env("WHYCODE_FRONTEND_URL", "http://127.0.0.1:5173")
    api_public_url: str = _env("WHYCODE_API_URL", "http://127.0.0.1:8000/api")
    github_token: str = _env("GITHUB_TOKEN")
    github_api: str = _env("GITHUB_API", "https://api.github.com")
    github_client_id: str = _env("GITHUB_CLIENT_ID")
    github_client_secret: str = _env("GITHUB_CLIENT_SECRET")
    github_oauth_redirect: str = _env("GITHUB_OAUTH_REDIRECT")
    github_app_id: str = _env("GITHUB_APP_ID")
    github_app_slug: str = _env("GITHUB_APP_SLUG")
    github_app_private_key: str = _env("GITHUB_APP_PRIVATE_KEY").replace("\\n", "\n")
    groq_key: str = _env("GROQ_API_KEY").removeprefix("Bearer ").strip()
    groq_model: str = _env("GROQ_MODEL", "llama-3.3-70b-versatile")
    llm_mode: str = _env("WHYCODE_LLM_MODE", "auto")
    embedding_model: str = _env("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    ingest_dir: Path = Path(_env("WHYCODE_INGEST_DIR", str(ROOT / "data" / "repos")))
    max_files: int = _int("WHYCODE_MAX_FILES", 140)
    max_commits: int = _int("WHYCODE_MAX_COMMITS", 25)
    max_prs: int = _int("WHYCODE_MAX_PRS", 8)
    max_issues: int = _int("WHYCODE_MAX_ISSUES", 8)
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in _env(
                "WHYCODE_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if o.strip()
        ]
    )
    cors_origin_regex: str = _env("WHYCODE_CORS_ORIGIN_REGEX")

    @property
    def llm_enabled(self) -> bool:
        if self.llm_mode == "deterministic":
            return False
        if self.llm_mode == "groq":
            return bool(self.groq_key)
        return bool(self.groq_key)

    @property
    def github_oauth_enabled(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)

    @property
    def github_app_enabled(self) -> bool:
        return bool(
            self.github_app_id and self.github_app_slug and self.github_app_private_key
        )

    @property
    def oauth_redirect_uri(self) -> str:
        if self.github_oauth_redirect:
            return self.github_oauth_redirect
        return f"{self.api_public_url.rstrip('/')}/auth/github/callback"

    @property
    def is_prod(self) -> bool:
        return self.env.lower() in {"prod", "production"}

    def validate_production(self) -> None:
        if not self.is_prod:
            return
        problems: list[str] = []
        if len(self.jwt_secret) < 32:
            problems.append("WHYCODE_JWT_SECRET must be at least 32 bytes")
        if self.neo4j_password.lower() in {"", "change-me", "password", "secret"}:
            problems.append("NEO4J_PASSWORD must not use an insecure default value")
        if "*" in self.cors_origins:
            problems.append("WHYCODE_CORS_ORIGINS must not contain '*' when credentials are enabled")
        if problems:
            raise RuntimeError("Invalid production configuration: " + "; ".join(problems))


settings = Settings()
settings.ingest_dir.mkdir(parents=True, exist_ok=True)
