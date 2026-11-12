import os
import re
from pathlib import Path


def grep_code(path: str, pattern: str, include: str = "**/*.*", max_results: int = 50) -> list[dict[str, object]]:
    """Perform a targeted content grep across the repo and return a compact result list."""
    root = Path(path)
    matches: list[dict[str, object]] = []
    regex = re.compile(pattern)

    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(root)
        if not re.match(include.replace("**", ".*"), str(rel).replace(os.sep, "/")):
            continue

        try:
            content = file_path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue

        for line_number, line in enumerate(content.splitlines(), start=1):
            if regex.search(line):
                matches.append(
                    {
                        "file": str(rel).replace(os.sep, "/"),
                        "line": line_number,
                        "content": line.strip(),
                    }
                )
                if len(matches) >= max_results:
                    return matches

    return matches
