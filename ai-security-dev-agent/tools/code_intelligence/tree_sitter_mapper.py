from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

try:
    import tree_sitter_language_pack  # type: ignore
except Exception:  # pragma: no cover
    tree_sitter_language_pack = None  # type: ignore


def build_repo_map(path: str, max_depth: int = 3) -> dict[str, Any]:
    root = Path(path).resolve()
    if not root.exists():
        return {"root": str(root), "entries": [], "depth": max_depth}

    entries: list[dict[str, Any]] = []
    for current, dirs, files in os.walk(root):
        current_path = Path(current)
        rel_dir = current_path.relative_to(root)
        if rel_dir.parts and len(rel_dir.parts) >= max_depth:
            dirs[:] = []
        dirs[:] = sorted(d for d in dirs if d not in {".git", ".venv", "node_modules", "__pycache__", "dist", "build", ".pytest_cache"})
        for file_name in sorted(files):
            file_path = current_path / file_name
            rel = file_path.relative_to(root).as_posix()
            entry: dict[str, Any] = {"path": rel, "extension": file_path.suffix}
            if tree_sitter_language_pack is not None and file_path.suffix in {".py", ".js", ".ts", ".tsx", ".go", ".rs"}:
                try:
                    parser_name = {
                        ".py": "python",
                        ".js": "javascript",
                        ".ts": "typescript",
                        ".tsx": "tsx",
                        ".go": "go",
                        ".rs": "rust",
                    }.get(file_path.suffix)
                    if parser_name:
                        parser = tree_sitter_language_pack.get_parser(parser_name)
                        tree = parser.parse(file_path.read_bytes())
                        symbols = []
                        for node in tree.root_node.children:
                            if node.type in {"function_definition", "class_definition", "function_declaration", "class_declaration", "method_definition", "function_item", "struct_item"}:
                                for child in node.children:
                                    if child.type in {"identifier", "type_identifier", "name"}:
                                        symbols.append(child.text.decode("utf-8", "replace"))
                                        break
                        if symbols:
                            entry["symbols"] = symbols[:20]
                except Exception:
                    pass
            entries.append(entry)
            if len(entries) >= 500:
                break
        if len(entries) >= 500:
            break
    return {"root": str(root), "entries": entries[:500], "depth": max_depth}
