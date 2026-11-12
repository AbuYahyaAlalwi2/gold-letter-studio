from __future__ import annotations

from typing import Any


class Mem0Plugin:
    """Minimal Mem0-compatible plugin for persistent project memory across sessions."""

    def __init__(self, base_path: str = "/tmp/mem0") -> None:
        self.base_path = base_path
        self._store: dict[str, list[dict[str, Any]]] = {}

    def remember(self, project_name: str, fact: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        if project_name not in self._store:
            self._store[project_name] = []

        entry = {"fact": fact, "metadata": metadata or {}, "source": "agent"}
        self._store[project_name].append(entry)
        return {"project": project_name, "stored": True, "count": len(self._store[project_name])}

    def recall(self, project_name: str) -> list[dict[str, Any]]:
        return self._store.get(project_name, [])

    def project_summary(self, project_name: str) -> dict[str, Any]:
        facts = self.recall(project_name)
        return {
            "project": project_name,
            "fact_count": len(facts),
            "facts": [f["fact"] for f in facts],
        }
