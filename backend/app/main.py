from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .api import router
from .config import settings
from .schema import init_schema

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("whycoded")


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
        created = init_schema()
        log.info("neo4j schema ready %s", created)
    except Exception as exc:
        log.error("neo4j schema init failed: %s", exc)
    threading.Thread(target=_warm_embeddings, daemon=True).start()
    yield
    db.close()


app = FastAPI(
    title="WhyCode",
    version="0.1.0",
    description="Organisation-level engineering memory for humans and AI agents",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "WhyCode", "status": "ok", "docs": "/docs"}
