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
        "description": "Search matching lines in the mounted project workspace.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "minLength": 1, "maxLength": 4096},
                "pattern": {"type": "string", "minLength": 1, "maxLength": 512},
                "include": {"type": "string", "minLength": 1, "maxLength": 256, "default": "**/*"},
                "max_results": {"type": "integer", "minimum": 1, "maximum": 100, "default": 50},
            },
            "required": ["path", "pattern"],
            "additionalProperties": False,
        },
    },
    "glob_files": {
        "description": "List project files matching a relative glob pattern.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "minLength": 1, "maxLength": 4096},
                "pattern": {"type": "string", "minLength": 1, "maxLength": 256},
                "max_results": {"type": "integer", "minimum": 1, "maximum": 100, "default": 50},
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
                "path": {"type": "string", "minLength": 1, "maxLength": 4096},
                "max_depth": {"type": "integer", "minimum": 1, "maximum": 8, "default": 3},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    },
    "smart_diff_edit": {
        "description": "Preview or apply one unique exact-text replacement inside the project workspace.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "minLength": 1, "maxLength": 4096},
                "old_text": {"type": "string", "minLength": 1, "maxLength": 20000},
                "new_text": {"type": "string", "maxLength": 20000},
                "dry_run": {"type": "boolean", "default": True},
            },
            "required": ["path", "old_text", "new_text"],
            "additionalProperties": False,
        },
    },
    "run_semgrep_scan": {
        "description": "Scan a project path and return bounded, validated security findings.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "minLength": 1, "maxLength": 4096},
                "rules": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^p/[a-z0-9-]{1,80}$"},
                    "minItems": 1,
                    "maxItems": 5,
                    "uniqueItems": True,
                },
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    },
    "remember_memory": {
        "description": "Persist a project-scoped security finding, domain, or note.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[A-Za-z0-9._:-]+$"},
                "fact": {"type": "string", "minLength": 1, "maxLength": 2000},
                "metadata": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "maxLength": 64},
                        "session_id": {"type": "string", "maxLength": 128},
                        "severity": {"type": "string", "enum": ["info", "low", "medium", "high", "critical"]},
                        "file": {"type": "string", "maxLength": 512},
                    },
                    "additionalProperties": False,
                },
            },
            "required": ["project", "fact"],
            "additionalProperties": False,
        },
    },
    "recall_memory": {
        "description": "Retrieve recent project-scoped notes from persistent memory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[A-Za-z0-9._:-]+$"},
                "query": {"type": "string", "minLength": 1, "maxLength": 500},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
            },
            "required": ["project", "query"],
            "additionalProperties": False,
        },
    },
    "scan_for_secrets": {
        "description": "Scan a project subtree for common secret and token patterns with low false-positive filtering.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "minLength": 1, "maxLength": 4096},
                "include": {"type": "string", "minLength": 1, "maxLength": 256, "default": "**/*"},
                "max_results": {"type": "integer", "minimum": 1, "maximum": 100, "default": 50},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    },
    "security_policy_check": {
        "description": "Apply a strict security policy to code and config files to detect shell, remote-download, and dangerous file patterns.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "minLength": 1, "maxLength": 4096},
                "policy": {"type": "string", "enum": ["strict", "default", "relaxed"], "default": "strict"},
                "max_results": {"type": "integer", "minimum": 1, "maximum": 100, "default": 50},
            },
            "required": ["path"],
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
