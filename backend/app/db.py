from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from neo4j import GraphDatabase, Driver, Session

from .config import settings

_driver: Driver | None = None


def driver() -> Driver:
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver


def close() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


@contextmanager
def session() -> Iterator[Session]:
    with driver().session(database=settings.neo4j_database) as s:
        yield s


def read(query: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with session() as s:
        return s.run(query, params or {}).data()


def read_one(query: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    rows = read(query, params)
    return rows[0] if rows else None


def write(query: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with session() as s:
        return s.run(query, params or {}).data()


def write_many(query: str, rows: list[dict[str, Any]], batch: int = 200) -> None:
    with session() as s:
        for i in range(0, len(rows), batch):
            s.run(query, {"rows": rows[i : i + batch]})


def ping() -> dict[str, Any]:
    with session() as s:
        row = s.run("CALL dbms.components() YIELD name, versions RETURN name, versions").single()
        return {"name": row["name"], "versions": row["versions"]}
