from __future__ import annotations

import fnmatch
from pathlib import Path


_EXCLUDED = {".git", ".venv", "node_modules", "__pycache__", "dist", "build", ".pytest_cache"}


def grep_code(path: str, pattern: str, include: str = "**/*", max_results: int = 50) -> list[dict[str, object]]:
    root = Path(path).resolve()
    if not root.is_dir():
        raise NotADirectoryError(path)
    if not pattern or len(pattern) > 512:
        raise ValueError("pattern must contain between 1 and 512 characters")
    if not include or len(include) > 256:
        raise ValueError("include must contain between 1 and 256 characters")
    if not 1 <= max_results <= 100:
        raise ValueError("max_results must be between 1 and 100")
    results: list[dict[str, object]] = []

    scanned = 0
    for candidate in root.rglob("*"):
        relative_path = candidate.relative_to(root)
        if any(part in _EXCLUDED for part in relative_path.parts):
            continue
        if not candidate.is_file() or candidate.is_symlink():
            continue
        scanned += 1
        if scanned > 10000:
            break
        if candidate.stat().st_size > 1024 * 1024:
            continue
        rel = relative_path.as_posix()
        if include != "**/*" and not fnmatch.fnmatch(rel, include):
            continue
        try:
            text = candidate.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            if pattern in line:
                results.append({"file": rel, "line": line_no, "content": line.strip()[:500]})
                if len(results) >= max_results:
                    return results
    return results
