from __future__ import annotations

import os
import json
from pathlib import Path
from typing import Any


def ensure_project_structure(root: str) -> dict[str, Any]:
    workspace = Path(root).resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    for subdir in ("src", "tests", "config", "docs"):
        (workspace / subdir).mkdir(exist_ok=True)
    return {"root": str(workspace), "created": ["src", "tests", "config", "docs"]}

