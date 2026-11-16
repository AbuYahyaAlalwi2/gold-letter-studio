from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


def store_session(db_path: str, session_id: str, project: str, transcript: list[dict[str, Any]]) -> None:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                project TEXT NOT NULL,
                transcript TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.execute(
            "INSERT INTO sessions(id, project, transcript, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(id) DO UPDATE SET project=excluded.project, transcript=excluded.transcript, updated_at=CURRENT_TIMESTAMP",
            (session_id, project, json.dumps(transcript, ensure_ascii=False)),
        )


def fetch_session(db_path: str, session_id: str) -> dict[str, Any]:
    with sqlite3.connect(db_path) as db:
        row = db.execute(
            "SELECT id, project, transcript, updated_at FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
    if row is None:
        return {"session_id": session_id, "project": "", "transcript": [], "updated_at": None}
    return {
        "session_id": row[0],
        "project": row[1],
        "transcript": json.loads(row[2]),
        "updated_at": row[3],
    }

