from __future__ import annotations

import hashlib
import math
import os
import threading
from typing import Iterable

import numpy as np

from .config import settings

DIM = 384
_lock = threading.Lock()
_model = None
_backend = "uninitialised"


def _load_model():
    global _model, _backend
    if _model is not None or _backend == "hash":
        return _model
    with _lock:
        if _model is not None or _backend == "hash":
            return _model
        if os.getenv("WHYCODE_EMBEDDING_MODE", "auto") == "hash":
            _backend = "hash"
            return None
        try:
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer(settings.embedding_model, device="cpu")
            _model.max_seq_length = 256
            _backend = "minilm"
        except Exception:
            _model = None
            _backend = "hash"
    return _model


def _hash_embed(text: str) -> list[float]:
    vec = np.zeros(DIM, dtype=np.float32)
    tokens = [t for t in text.lower().replace("/", " ").replace("_", " ").split() if t]
    if not tokens:
        return vec.tolist()
    for token in tokens:
        digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
        idx = int.from_bytes(digest[:4], "little") % DIM
        sign = 1.0 if digest[4] & 1 else -1.0
        vec[idx] += sign
        idx2 = int.from_bytes(digest[4:], "little") % DIM
        vec[idx2] += sign * 0.5
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec.tolist()


def embed_texts(texts: Iterable[str]) -> tuple[list[list[float]], str]:
    items = [t or " " for t in texts]
    model = _load_model()
    if model is None:
        return [_hash_embed(t) for t in items], "hash-384"
    vectors = model.encode(
        items,
        batch_size=32,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vectors], "minilm-l6-v2"


def embed_query(text: str) -> tuple[list[float], str]:
    vectors, backend = embed_texts([text])
    return vectors[0], backend


def warmup() -> dict[str, str]:
    _, backend = embed_texts(["warmup"])
    return {"backend": backend, "dimensions": str(DIM)}


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(np.dot(va, vb) / denom) if denom else 0.0


def tokenize_count(text: str) -> int:
    return max(1, int(len(text) / 4))


def approx_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / 4))
