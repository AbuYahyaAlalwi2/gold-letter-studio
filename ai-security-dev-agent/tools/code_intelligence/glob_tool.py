from __future__ import annotations

from pathlib import Path

_EXCLUDED = {".git", ".venv", "node_modules", "__pycache__", "dist", "build", ".pytest_cache"}


def glob_files(path: str, pattern: str, max_results: int = 50) -> dict[str, object]:
    root = Path(path).resolve()
    if not root.is_dir():
        raise NotADirectoryError(path)
    if not pattern or len(pattern) > 256 or Path(pattern).is_absolute() or ".." in Path(pattern).parts:
        raise ValueError("pattern must be a relative glob of at most 256 characters")
    if not 1 <= max_results <= 100:
        raise ValueError("max_results must be between 1 and 100")

    candidates: list[Path] = []
    scan_truncated = False
    for candidate in root.rglob("*"):
        if len(candidates) >= 10000:
            scan_truncated = True
            break
        if not candidate.is_file() or candidate.is_symlink():
            continue
        if any(part in _EXCLUDED for part in candidate.relative_to(root).parts):
            continue
        candidates.append(candidate)

    matches: list[str] = []
    for candidate in sorted(candidates):
        relative = candidate.relative_to(root).as_posix()
        if Path(relative).match(pattern):
            matches.append(relative)
            if len(matches) > max_results:
                break

    return {
        "matches": matches[:max_results],
        "truncated": scan_truncated or len(matches) > max_results,
        "count": min(len(matches), max_results),
    }
