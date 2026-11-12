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


TOOL_SPECS: dict[str, Any] = {
    "grep_code": {
        "description": "Search repository text in the authorized workspace.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "pattern": {"type": "string"},
                "include": {"type": "string", "default": "**/*"},
                "max_results": {"type": "integer", "minimum": 1, "maximum": 100},
            },
            "required": ["path", "pattern"],
            "additionalProperties": False,
        },
    },
    "build_repo_map": {
        "description": "Build a compact structural map of the target repo.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "max_depth": {"type": "integer", "minimum": 1, "maximum": 8},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    },
    "smart_diff_edit": {
        "description": "Apply a unique exact-text replacement to a file with dry-run support.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "old_text": {"type": "string"},
                "new_text": {"type": "string"},
                "dry_run": {"type": "boolean", "default": True},
            },
            "required": ["path", "old_text", "new_text"],
            "additionalProperties": False,
        },
    },
    "run_semgrep_scan": {
        "description": "Run Semgrep and return only validated security findings JSON.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "rules": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    },
    "playwright_browser_action": {
        "description": "Open a web page, click or fill a selector, and return a compact browser result.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "action": {"type": "string", "enum": ["navigate", "click", "fill", "hover", "snapshot"]},
                "selector": {"type": ["string", "null"]},
            },
            "required": ["url", "action"],
            "additionalProperties": False,
        },
    },
}


def build_tool_payload() -> list[dict[str, Any]]:
    return [{"type": "function", "function": {"name": name, **meta}} for name, meta in TOOL_SPECS.items()]


async def call_litellm(messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
    import httpx

    base_url = os.getenv("LITELLM_URL", "http://litellm:4000").rstrip("/")
    token = os.getenv("LITELLM_MASTER_KEY", "")
    endpoint = f"{base_url}/v1/chat/completions"
    payload = {
        "model": os.getenv("DEFAULT_MODEL", "local-model"),
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
    }
    async with httpx.AsyncClient(timeout=180) as client:
        response = await client.post(endpoint, headers={"Authorization": f"Bearer {token}"}, json=payload)
        response.raise_for_status()
        return response.json()


def require_auth(token: str | None) -> None:
    expected = os.getenv("DASHBOARD_TOKEN", "")
    if not expected or not token or token != f"Bearer {expected}":
        raise PermissionError("Unauthorized")
