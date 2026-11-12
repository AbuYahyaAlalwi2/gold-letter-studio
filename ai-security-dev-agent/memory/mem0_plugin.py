from __future__ import annotations

import json
import sqlite3
from typing import Any

class ProjectMemory:
    """Persistent local project memory backed by SQLite; replaceable with a Mem0 adapter."""
    def __init__(self, database_path: str):
        self.database_path = database_path
        with sqlite3.connect(database_path) as db:
            db.execute("CREATE TABLE IF NOT EXISTS project_memory (id INTEGER PRIMARY KEY, project TEXT NOT NULL, fact TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
    def remember(self, project: str, fact: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        with sqlite3.connect(self.database_path) as db:
            db.execute("INSERT INTO project_memory(project,fact,metadata) VALUES(?,?,?)", (project, fact[:2000], json.dumps(metadata or {})))
            count = db.execute("SELECT COUNT(*) FROM project_memory WHERE project=?", (project,)).fetchone()[0]
        return {"project": project, "stored": True, "count": count}
    def recall(self, project: str, limit: int = 20) -> list[dict[str, Any]]:
        with sqlite3.connect(self.database_path) as db:
            rows = db.execute("SELECT fact,metadata,created_at FROM project_memory WHERE project=? ORDER BY id DESC LIMIT ?", (project, min(max(limit, 1), 100))).fetchall()
        return [{"fact": fact, "metadata": json.loads(metadata), "created_at": created} for fact, metadata, created in rows]
