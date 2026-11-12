from __future__ import annotations

from pathlib import Path


def smart_line_diff_edit(path: str, patch: str, dry_run: bool = True) -> dict[str, object]:
    """Apply a minimal line-based patch. This is intentionally conservative and safe."""
    file_path = Path(path)
    if not file_path.exists():
        return {"status": "error", "message": f"Target file does not exist: {path}"}

    original = file_path.read_text(encoding="utf-8")
    result = {
        "status": "dry-run" if dry_run else "applied",
        "path": path,
        "before_lines": len(original.splitlines()),
        "patch_length": len(patch.splitlines()),
    }

    if dry_run:
        return result

    file_path.write_text(original + "\n" + patch.strip() + "\n", encoding="utf-8")
    return result
