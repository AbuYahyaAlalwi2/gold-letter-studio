from __future__ import annotations

import os
from pathlib import Path
from typing import Any

SKIP = {".git", ".venv", "node_modules", "__pycache__", "dist", "build"}


def build_repo_map(path: str, max_depth: int = 3) -> dict[str, Any]:
    root = Path(path).resolve()
    entries: list[dict[str, Any]] = []
    for current, dirs, files in os.walk(root):
        rel_dir = Path(current).relative_to(root)
        depth = len(rel_dir.parts)
        dirs[:] = sorted(d for d in dirs if d not in SKIP and not d.startswith(".")) if depth < max_depth else []
        for name in sorted(files):
            file = Path(current) / name
            rel = file.relative_to(root).as_posix()
            item: dict[str, Any] = {"path": rel}
            if file.suffix in {".py", ".js", ".ts", ".tsx", ".go", ".rs"}:
                try:
                    from tree_sitter_language_pack import get_parser
                    parser = get_parser({".py": "python", ".js": "javascript", ".ts": "typescript", ".tsx": "tsx", ".go": "go", ".rs": "rust"}[file.suffix])
                    tree = parser.parse(file.read_bytes())
                    names: list[str] = []
                    stack = [tree.root_node]
                    while stack:
                        node = stack.pop()
                        if node.type in {"function_definition", "class_definition", "function_declaration", "class_declaration", "method_definition", "struct_item", "function_item"}:
                            identifier = next((c for c in node.children if "identifier" in c.type or c.type == "type_identifier"), None)
                            if identifier:
                                names.append(identifier.text.decode("utf-8", "replace"))
                        stack.extend(reversed(node.children))
                    if names:
                        item["symbols"] = names[:50]
                except Exception:
                    pass
            entries.append(item)
            if len(entries) >= 5000:
                break
        if len(entries) >= 5000:
            break
    return {"root": str(root), "file_count": len(entries), "files": entries}
