from __future__ import annotations

import os
import subprocess
from pathlib import Path


def grep_code(path: str, pattern: str, include: str = "**/*", max_results: int = 50) -> list[dict[str, object]]:
    root = Path(path).resolve()
    results: list[dict[str, object]] = []
    if not root.exists():
        return results

    for candidate in root.rglob("*"):
        if not candidate.is_file():
            continue
        if any(part in {".git", ".venv", "node_modules", "__pycache__", "dist", "build"} for part in candidate.parts):
            continue
        rel = candidate.relative_to(root).as_posix()
        if include != "**/*":
            import fnmatch
            if not fnmatch.fnmatch(rel, include):
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


def build_repo_map(path: str, max_depth: int = 3) -> dict[str, object]:
    root = Path(path).resolve()
    entries: list[dict[str, object]] = []
    if not root.exists():
        return {"root": str(root), "depth": max_depth, "entries": []}

    for current, dirs, files in os.walk(root):
        rel = Path(current).relative_to(root)
        if rel.parts and len(rel.parts) >= max_depth:
            dirs[:] = []
        dirs[:] = sorted(d for d in dirs if d not in {".git", ".venv", "node_modules", "__pycache__", "dist", "build", ".pytest_cache"})
        for file_name in sorted(files):
            file_path = Path(current) / file_name
            rel_path = file_path.relative_to(root).as_posix()
            entries.append({"path": rel_path, "extension": file_path.suffix})
            if len(entries) >= 500:
                break
        if len(entries) >= 500:
            break
    return {"root": str(root), "depth": max_depth, "entries": entries[:500]}


def smart_line_diff_edit(path: str, old_text: str, new_text: str, dry_run: bool = True) -> dict[str, object]:
    target = Path(path).resolve()
    if not target.exists():
        raise FileNotFoundError(path)
    source = target.read_text(encoding="utf-8")
    if not old_text:
        raise ValueError("old_text cannot be empty")
    count = source.count(old_text)
    if count != 1:
        raise ValueError(f"Expected exactly one old_text match; found {count}")
    updated = source.replace(old_text, new_text, 1)
    if not dry_run:
        target.write_text(updated, encoding="utf-8")
    return {
        "path": str(target),
        "dry_run": dry_run,
        "before_lines": len(source.splitlines()),
        "after_lines": len(updated.splitlines()),
        "changed": True,
    }
