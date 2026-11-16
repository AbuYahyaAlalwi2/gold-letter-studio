from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import tree_sitter_language_pack


def build_repo_map(path: str, max_depth: int = 3) -> dict[str, Any]:
    root = Path(path).resolve()
    if not root.is_dir():
        raise NotADirectoryError(path)
    if not 1 <= max_depth <= 8:
        raise ValueError("max_depth must be between 1 and 8")

    entries: list[dict[str, Any]] = []
    parse_errors: list[str] = []
    for current, dirs, files in os.walk(root):
        current_path = Path(current)
        rel_dir = current_path.relative_to(root)
        if rel_dir.parts and len(rel_dir.parts) >= max_depth:
            dirs[:] = []
        dirs[:] = sorted(d for d in dirs if d not in {".git", ".venv", "node_modules", "__pycache__", "dist", "build", ".pytest_cache"})
        for file_name in sorted(files):
            file_path = current_path / file_name
            if file_path.is_symlink():
                continue
            rel = file_path.relative_to(root).as_posix()
            entry: dict[str, Any] = {"path": rel, "extension": file_path.suffix}
            if file_path.stat().st_size > 2 * 1024 * 1024:
                entry["skipped"] = "file exceeds 2 MiB symbol-map limit"
                entries.append(entry)
                continue
            parser_name = {
                ".py": "python",
                ".js": "javascript",
                ".ts": "typescript",
                ".tsx": "tsx",
                ".go": "go",
                ".rs": "rust",
            }.get(file_path.suffix)
            if parser_name:
                try:
                    parser = tree_sitter_language_pack.get_parser(parser_name)
                    tree = parser.parse(file_path.read_bytes())
                    symbols: list[str] = []
                    symbol_types = {
                        "function_definition",
                        "class_definition",
                        "function_declaration",
                        "class_declaration",
                        "method_definition",
                        "function_item",
                        "struct_item",
                    }
                    stack = [tree.root_node]
                    while stack:
                        node = stack.pop()
                        if node.type in symbol_types:
                            name = node.child_by_field_name("name")
                            if name is not None:
                                symbols.append(name.text.decode("utf-8", "replace"))
                        stack.extend(reversed(node.children))
                    if symbols:
                        entry["symbols"] = symbols[:40]
                except (OSError, UnicodeDecodeError, LookupError, ValueError) as exc:
                    parse_errors.append(f"{rel}: {type(exc).__name__}")
            entries.append(entry)
            if len(entries) >= 500:
                break
        if len(entries) >= 500:
            break
    return {
        "root": str(root),
        "entries": entries[:500],
        "depth": max_depth,
        "truncated": len(entries) >= 500,
        "parse_errors": parse_errors[:50],
    }
