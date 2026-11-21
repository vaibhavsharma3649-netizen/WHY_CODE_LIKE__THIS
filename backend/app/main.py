from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from neo4j.exceptions import ServiceUnavailable, Neo4jError

from . import db
from .admin import install_router, router as admin_router
from .api import router
from .config import settings
from .schema import init_schema

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("whycoded")

RATE_LIMITS = {
    "/api/auth/login": (20, 60),
    "/api/ask": (60, 60),
    "/api/ask/stream": (60, 60),
}
_rate_buckets: dict[str, list[float]] = defaultdict(list)
_rate_lock = threading.Lock()


def _warm_embeddings() -> None:
    try:
        from .embeddings import warmup

        result = warmup()
        log.info("embeddings ready: %s (%s dims)", result["backend"], result["dimensions"])
    except Exception as exc:
        log.warning("embedding warmup failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        settings.validate_production()
    except RuntimeError as exc:
        log.warning("Production configuration warning: %s", exc)
    try:
        created = init_schema()
        log.info("neo4j schema ready %s", created)
    except Exception as exc:
        log.error("neo4j schema init failed: %s", exc)
    threading.Thread(target=_warm_embeddings, daemon=True).start()
    yield
    db.close()


app = FastAPI(
    title="WhyCode",
    version="1.0.0",
    description="Organisation-level engineering memory for humans and AI agents",
    lifespan=lifespan,
    docs_url=None if settings.is_prod else "/docs",
    redoc_url=None if settings.is_prod else "/redoc",
    openapi_url=None if settings.is_prod else "/openapi.json",
)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    limit = RATE_LIMITS.get(request.url.path)
    if limit:
        forwarded = request.headers.get("x-forwarded-for", "")
        client = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else "unknown")
        )
        key = f"{client}:{request.url.path}"
        window = limit[1]
        now = time.time()
        with _rate_lock:
            bucket = [t for t in _rate_buckets[key] if now - t < window]
            if len(bucket) >= limit[0]:
                return JSONResponse({"detail": "Too many requests"}, status_code=429)
            bucket.append(now)
            _rate_buckets[key] = bucket
            if len(_rate_buckets) > 5000:
                for stale in [k for k, v in _rate_buckets.items() if not v]:
                    _rate_buckets.pop(stale, None)
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    if settings.is_prod:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex or r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(admin_router)
app.include_router(install_router)


@app.exception_handler(ServiceUnavailable)
async def service_unavailable_handler(request: Request, exc: ServiceUnavailable):
    log.warning("Database unavailable: %s", exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database connection unavailable. If using Neo4j AuraDB, verify the instance is resumed and active at console.neo4j.io.",
            "code": "DATABASE_UNAVAILABLE",
        },
    )


@app.exception_handler(Neo4jError)
async def neo4j_error_handler(request: Request, exc: Neo4jError):
    log.warning("Database error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Database error: {exc.message}", "code": "DATABASE_ERROR"},
    )


@app.api_route("/", methods=["GET", "HEAD"])
def root() -> dict[str, str]:
    return {"name": "WhyCode", "status": "ok"}
