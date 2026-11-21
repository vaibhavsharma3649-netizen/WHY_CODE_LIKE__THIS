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


@dataclass(frozen=True)
class Settings:
    env: str = _env("WHYCODE_ENV", "dev")
    neo4j_uri: str = _env("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user: str = _env("NEO4J_USER", "neo4j")
    neo4j_password: str = _env("NEO4J_PASSWORD", "neo4j")
    neo4j_database: str = _env("NEO4J_DATABASE", "neo4j")
    jwt_secret: str = _env("WHYCODE_JWT_SECRET", "dev-only-change-me-32-byte-default-secret!")
    token_ttl_minutes: int = _int("WHYCODE_TOKEN_TTL_MINUTES", 720)
    github_token: str = _env("GITHUB_TOKEN")
    github_api: str = _env("GITHUB_API", "https://api.github.com")
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
    def is_prod(self) -> bool:
        return self.env.lower() in {"prod", "production"}

    def validate_production(self) -> None:
        if not self.is_prod:
            return
        problems: list[str] = []
        if self.jwt_secret.startswith("dev-only") or len(self.jwt_secret) < 32:
            problems.append("WHYCODE_JWT_SECRET must be a strong random value of at least 32 bytes")
        if self.neo4j_password.lower() in {"", "neo4j", "change-me", "password", "secret"}:
            problems.append("NEO4J_PASSWORD must not use a default value")
        if "*" in self.cors_origins:
            problems.append("WHYCODE_CORS_ORIGINS must not contain '*' when credentials are enabled")
        if problems:
            raise RuntimeError("Invalid production configuration: " + "; ".join(problems))


settings = Settings()
settings.ingest_dir.mkdir(parents=True, exist_ok=True)
