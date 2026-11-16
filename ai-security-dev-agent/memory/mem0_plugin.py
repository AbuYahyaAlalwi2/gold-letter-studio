from __future__ import annotations

import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any


class ProjectMemory:
    """Local SQLite memory adapter used as a safe default."""

    def __init__(self, database_path: str):
        self.database_path = database_path
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.database_path)) as db:
            with db:
                db.execute(
                    """
                    CREATE TABLE IF NOT EXISTS project_memory (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project TEXT NOT NULL,
                        fact TEXT NOT NULL,
                        metadata TEXT NOT NULL DEFAULT '{}',
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )

    def remember(self, project: str, fact: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        data = json.dumps(metadata or {}, ensure_ascii=False)
        with closing(sqlite3.connect(self.database_path)) as db:
            with db:
                db.execute(
                    "INSERT INTO project_memory(project, fact, metadata) VALUES (?, ?, ?)",
                    (project, fact[:2000], data),
                )
                count = db.execute(
                    "SELECT COUNT(*) FROM project_memory WHERE project = ?",
                    (project,),
                ).fetchone()[0]
        return {"project": project, "stored": True, "count": int(count)}

    def recall(self, project: str, limit: int = 20) -> list[dict[str, Any]]:
        with closing(sqlite3.connect(self.database_path)) as db:
            rows = db.execute(
                """
                SELECT fact, metadata, created_at
                FROM project_memory
                WHERE project = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (project, max(1, min(limit, 100))),
            ).fetchall()
        return [
            {
                "fact": fact,
                "metadata": json.loads(metadata) if metadata else {},
                "created_at": created_at,
            }
            for fact, metadata, created_at in rows
        ]

    def search(self, project: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        matches = self.recall(project, limit=100)
        needle = query.casefold()
        return [
            item
            for item in matches
            if needle in item["fact"].casefold()
        ][: max(1, min(limit, 100))]

    def project_summary(self, project: str) -> dict[str, Any]:
        facts = self.recall(project, limit=20)
        return {"project": project, "facts": facts, "count": len(facts)}


try:  # pragma: no cover
    from mem0 import MemoryClient  # type: ignore
except ImportError:  # pragma: no cover
    MemoryClient = None


class Mem0Adapter:
    """Mem0 Platform adapter with durable local SQLite storage when not configured."""

    def __init__(self, database_path: str, api_key: str | None = None):
        self.database_path = database_path
        self._fallback = ProjectMemory(database_path)
        configured_key = api_key or os.getenv("MEM0_API_KEY")
        self._client = None
        if configured_key:
            if MemoryClient is None:
                raise RuntimeError("MEM0_API_KEY is set but the mem0ai package is not installed")
            self._client = MemoryClient(api_key=configured_key)

    def remember(self, project: str, fact: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        if self._client is not None:
            self._client.add(
                [{"role": "user", "content": fact[:2000]}],
                user_id=project,
                metadata=metadata or {},
            )
            return {"project": project, "stored": True, "mode": "mem0"}
        return self._fallback.remember(project, fact, metadata)

    def recall(self, project: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        if self._client is not None:
            response = self._client.search(query, filters={"user_id": project})
            results = response.get("results", []) if isinstance(response, dict) else response
            if not isinstance(results, list):
                raise RuntimeError("Mem0 returned an unexpected memory response")
            return results[: max(1, min(limit, 100))]
        return self._fallback.search(project, query, limit)

    def project_summary(self, project: str) -> dict[str, Any]:
        facts = self._fallback.recall(project, limit=20)
        return {"project": project, "facts": facts, "count": len(facts)}
