from __future__ import annotations

import ast
import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

MAX_FILE_BYTES = 220_000
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 180


def stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.blake2b("\u241f".join(parts).encode(), digest_size=10).hexdigest()
    return f"{prefix}_{digest}"


def repo_key(org_id: str, owner: str, name: str) -> str:
    slug = f"{owner}_{name}".lower().replace("/", "_").replace("-", "_")
    return f"repo_{org_id}_{slug}"


def file_key(repo_id: str, path: str) -> str:
    return stable_id("file", repo_id, path)


def entity_key(repo_id: str, path: str, qualified_name: str, line: int) -> str:
    return stable_id("ent", repo_id, path, qualified_name, str(line))


def chunk_key(repo_id: str, path: str, line: int) -> str:
    return stable_id("chunk", repo_id, path, str(line))


def commit_key(repo_id: str, sha: str) -> str:
    return stable_id("cm", repo_id, sha)


def pr_key(repo_id: str, number: int) -> str:
    return stable_id("pr", repo_id, str(number))


def issue_key(repo_id: str, number: int) -> str:
    return stable_id("iss", repo_id, str(number))


def decision_key(repo_id: str, evidence_url: str, summary: str) -> str:
    return stable_id("dec", repo_id, evidence_url, summary[:120])


def finding_key(repo_id: str, rule: str, path: str, line: int) -> str:
    return stable_id("find", repo_id, rule, path, str(line))


def source_url(owner: str, name: str, sha: str, path: str, start: int | None = None, end: int | None = None) -> str:
    base = f"https://github.com/{owner}/{name}/blob/{sha}/{path}"
    if start and end and end > start:
        return f"{base}#L{start}-L{end}"
    if start:
        return f"{base}#L{start}"
    return base


@dataclass
class Entity:
    entity_id: str
    file_id: str
    repo_id: str
    org_id: str
    name: str
    qualified_name: str
    kind: str
    path: str
    line_start: int
    line_end: int
    docstring: str
    signature: str
    module: str
    source_url: str
    commit_sha: str
    calls: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)


@dataclass
class Chunk:
    chunk_id: str
    file_id: str
    repo_id: str
    org_id: str
    path: str
    content_excerpt: str
    line_start: int
    line_end: int
    commit_sha: str
    source_url: str
    language: str


@dataclass
class ParsedFile:
    path: str
    text: str
    language: str
    entities: list[dict[str, Any]]
    imports: list[str]


def _signature(node: ast.AST) -> str:
    try:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = [a.arg for a in node.args.args][:6]
            prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
            return f"{prefix} {node.name}({', '.join(args)}{', ...' if len(node.args.args) > 6 else ''})"
        if isinstance(node, ast.ClassDef):
            bases = [getattr(b, "id", "") for b in node.bases if getattr(b, "id", "")]
            return f"class {node.name}({', '.join(bases)})" if bases else f"class {node.name}"
    except Exception:
        pass
    return getattr(node, "name", "")


def parse_python(
    rel_path: str,
    text: str,
    org_id: str,
    repo_id: str,
    commit_sha: str,
    owner: str,
    name: str,
) -> ParsedFile:
    module_path = rel_path.replace("\\", "/").removesuffix(".py")
    if module_path.startswith("src/"):
        module_path = module_path[4:]
    module = module_path.replace("/", ".")
    if module.endswith(".__init__"):
        module = module.removesuffix(".__init__")
    file_id = file_key(repo_id, rel_path)
    entities: list[dict[str, Any]] = []
    imports: list[str] = []

    tree = ast.parse(text)
    module_doc = ast.get_docstring(tree) or ""
    entities.append(
        {
            "entity_id": entity_key(repo_id, rel_path, module, 1),
            "file_id": file_id,
            "repo_id": repo_id,
            "org_id": org_id,
            "name": module.split(".")[-1],
            "qualified_name": module,
            "kind": "module",
            "path": rel_path,
            "line_start": 1,
            "line_end": getattr(tree, "end_lineno", None) or text.count("\n") + 1,
            "docstring": module_doc[:600],
            "signature": f"module {module}",
            "module": module,
            "source_url": source_url(owner, name, commit_sha, rel_path),
            "commit_sha": commit_sha,
            "calls": [],
            "imports": [],
        }
    )

    def visit(node: ast.AST, scope: list[str]) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                qualified = ".".join([module, *scope, child.name])
                kind = "class" if isinstance(child, ast.ClassDef) else "function"
                calls = sorted(
                    {
                        call.func.id
                        for call in ast.walk(child)
                        if isinstance(call, ast.Call) and isinstance(call.func, ast.Name)
                    }
                )[:12]
                entities.append(
                    {
                        "entity_id": entity_key(repo_id, rel_path, qualified, child.lineno),
                        "file_id": file_id,
                        "repo_id": repo_id,
                        "org_id": org_id,
                        "name": child.name,
                        "qualified_name": qualified,
                        "kind": kind,
                        "path": rel_path,
                        "line_start": child.lineno,
                        "line_end": getattr(child, "end_lineno", None) or child.lineno,
                        "docstring": (ast.get_docstring(child) or "")[:600],
                        "signature": _signature(child)[:200],
                        "module": module,
                        "source_url": source_url(
                            owner,
                            name,
                            commit_sha,
                            rel_path,
                            child.lineno,
                            getattr(child, "end_lineno", None),
                        ),
                        "commit_sha": commit_sha,
                        "calls": calls,
                        "imports": [],
                    }
                )
                visit(child, [*scope, child.name])
            elif isinstance(child, ast.Import):
                for alias in child.names:
                    imports.append(alias.name)
            elif isinstance(child, ast.ImportFrom):
                base = child.module or ""
                if child.level:
                    package = module if rel_path.replace("\\", "/").endswith("__init__.py") else module.rsplit(".", 1)[0]
                    parts = package.split(".") if package else []
                    ascend = max(child.level - 1, 0)
                    if ascend:
                        parts = parts[: max(len(parts) - ascend, 0)]
                    resolved = ".".join([*parts, base]).strip(".")
                    imports.append(resolved or base)
                else:
                    imports.append(base)

    visit(tree, [])
    for item in entities:
        item["imports"] = sorted(set(imports))[:12]
    return ParsedFile(rel_path, text, "python", entities, sorted(set(imports)))


def chunk_file(
    rel_path: str,
    text: str,
    language: str,
    org_id: str,
    repo_id: str,
    commit_sha: str,
    owner: str,
    name: str,
) -> list[Chunk]:
    file_id = file_key(repo_id, rel_path)
    lines = text.splitlines()
    chunks: list[Chunk] = []
    start = 0
    total = len(text)
    while start < total:
        end = min(total, start + CHUNK_CHARS)
        excerpt = text[start:end]
        prefix_lines = text[:start].count("\n")
        line_start = prefix_lines + 1
        line_end = line_start + excerpt.count("\n")
        if excerpt.strip():
            chunks.append(
                Chunk(
                    chunk_id=chunk_key(repo_id, rel_path, line_start),
                    file_id=file_id,
                    repo_id=repo_id,
                    org_id=org_id,
                    path=rel_path,
                    content_excerpt=excerpt.strip(),
                    line_start=line_start,
                    line_end=line_end,
                    commit_sha=commit_sha,
                    source_url=source_url(owner, name, commit_sha, rel_path, line_start, line_end),
                    language=language,
                )
            )
        if end >= total:
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def normalize_rel(path: Path, root: Path) -> str:
    return str(path.relative_to(root)).replace("\\", "/")
