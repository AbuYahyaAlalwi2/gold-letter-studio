from __future__ import annotations

from pathlib import Path


def smart_line_diff_edit(path: str, old_text: str, new_text: str, dry_run: bool = True) -> dict[str, object]:
    """Replace one exact, unique text block. Never applies ambiguous edits."""
    target = Path(path)
    if not target.is_file():
        raise ValueError("Target must be an existing file")
    source = target.read_text(encoding="utf-8")
    if not old_text:
        raise ValueError("old_text cannot be empty")
    count = source.count(old_text)
    if count != 1:
        raise ValueError(f"Expected old_text exactly once; found {count}")
    updated = source.replace(old_text, new_text, 1)
    if not dry_run:
        target.write_text(updated, encoding="utf-8")
    return {"path": target.name, "dry_run": dry_run, "changed": True, "before_lines": len(source.splitlines()), "after_lines": len(updated.splitlines())}
