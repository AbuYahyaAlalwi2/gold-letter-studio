from __future__ import annotations

import fnmatch
import re
from pathlib import Path

IGNORED = {".git", ".venv", "node_modules", "__pycache__", "dist", "build"}

def grep_code(path: str, pattern: str, include: str = "**/*", max_results: int = 50) -> list[dict[str, object]]:
    root = Path(path).resolve()
    regex = re.compile(pattern)
    results: list[dict[str, object]] = []
    for file in root.rglob("*"):
        if not file.is_file() or any(part in IGNORED for part in file.parts):
            continue
        rel = file.relative_to(root).as_posix()
        if include != "**/*" and not fnmatch.fnmatch(rel, include):
            continue
        try:
            for number, line in enumerate(file.read_text(encoding="utf-8").splitlines(), 1):
                if regex.search(line):
                    results.append({"file": rel, "line": number, "content": line.strip()[:500]})
                    if len(results) >= max_results:
                        return results
        except (UnicodeDecodeError, OSError):
            continue
    return results
