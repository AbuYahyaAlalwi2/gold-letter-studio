from __future__ import annotations

import os
import re
from typing import Any


def normalize_tool_call(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Ensure tool data is valid and the arguments are safe to pass to the LLM tool-calling contract."""
    safe: dict[str, Any] = {}
    for key, value in arguments.items():
        if key.startswith("_"):
            continue
        if isinstance(value, str):
            safe[key] = re.sub(r"\s+", " ", value)[:4000]
        else:
            safe[key] = value
    return {"name": tool_name, "arguments": safe}

