from __future__ import annotations

import ast
from pathlib import Path
from typing import Any


def build_repo_map(path: str, max_depth: int = 3) -> dict[str, Any]:
    """Create a lightweight repository map without loading the entire project into memory."""
    root = Path(path)
    files: list[str] = []
    entrypoints: list[str] = []
    top_level: list[str] = []

    for current in sorted(root.rglob("*")):
        if current.is_dir():
            if current.name.startswith("."):
                continue
            continue

        rel = current.relative_to(root).as_posix()
        files.append(rel)
        if rel.lower().endswith((".py", ".js", ".ts", ".tsx")):
            entrypoints.append(rel)

    for child in sorted(root.iterdir()):
        if child.is_dir() and not child.name.startswith("."):
            top_level.append(child.name)

    return {
        "root": str(root),
        "max_depth": max_depth,
        "top_level_dirs": top_level,
        "file_count": len(files),
        "entrypoints": entrypoints[:25],
        "summary": {"files": files[:25]},
    }


def extract_symbols_from_file(file_path: str) -> list[str]:
    """Best-effort symbol extraction, primarily for Python files."""
    path = Path(file_path)
    if not path.exists():
        return []

    try:
        source = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []

    tree = ast.parse(source)
    symbols: list[str] = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            symbols.append(node.name)
    return symbols
