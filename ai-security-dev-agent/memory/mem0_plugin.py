from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


class ProjectMemory:
    """Local SQLite memory adapter used as a safe default."""

    def __init__(self, database_path: str):
        self.database_path = database_path
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as db:
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
        with sqlite3.connect(self.database_path) as db:
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
        with sqlite3.connect(self.database_path) as db:
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

    def project_summary(self, project: str) -> dict[str, Any]:
        facts = self.recall(project, limit=20)
        return {"project": project, "facts": facts, "count": len(facts)}


try:  # pragma: no cover
    from mem0 import MemoryClient  # type: ignore
except Exception:  # pragma: no cover
    MemoryClient = None  # type: ignore


class Mem0Adapter:
    """Production-safe adapter with a SQLite fallback for local operation."""

    def __init__(self, database_path: str, base_url: str | None = None):
        self.database_path = database_path
        self.base_url = base_url
        self._fallback = ProjectMemory(database_path)

    def remember(self, project: str, fact: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        if MemoryClient is not None and self.base_url:
            try:
                client = MemoryClient(self.base_url)
                client.add(project, fact, metadata or {})
                return {"project": project, "stored": True, "mode": "mem0"}
            except Exception:
                pass
        return self._fallback.remember(project, fact, metadata)

    def recall(self, project: str, limit: int = 20) -> list[dict[str, Any]]:
        if MemoryClient is not None and self.base_url:
            try:
                client = MemoryClient(self.base_url)
                return client.get(project, limit=limit)
            except Exception:
                pass
        return self._fallback.recall(project, limit)

    def project_summary(self, project: str) -> dict[str, Any]:
        return self._fallback.project_summary(project)
