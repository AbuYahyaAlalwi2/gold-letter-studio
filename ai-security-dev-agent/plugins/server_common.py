from __future__ import annotations

import hmac
import json
import os
from pathlib import Path
from typing import Any

import uvicorn
from jsonschema import Draft7Validator
from mcp.server.fastmcp import FastMCP

from tools.tool_contract import TOOL_SPECS


def validate_tool_arguments(name: str, arguments: dict[str, Any]) -> None:
    try:
        schema = TOOL_SPECS[name]["input_schema"]
    except KeyError as exc:
        raise ValueError(f"Unknown tool schema: {name}") from exc
    errors = sorted(Draft7Validator(schema).iter_errors(arguments), key=lambda error: list(error.path))
    if errors:
        raise ValueError(errors[0].message)


def workspace_root() -> Path:
    root = Path(os.getenv("PROJECT_ROOT", "/workspace")).resolve()
    if not root.is_dir():
        raise NotADirectoryError(f"Project workspace is unavailable: {root}")
    return root


def workspace_path(raw_path: str) -> Path:
    if not raw_path or len(raw_path) > 4096:
        raise ValueError("path must contain between 1 and 4096 characters")
    root = workspace_root()
    supplied = Path(raw_path).expanduser()
    target = (supplied if supplied.is_absolute() else root / supplied).resolve()
    if target != root and root not in target.parents:
        raise ValueError("Path escapes the mounted project workspace")
    return target


class TokenAuthMiddleware:
    def __init__(self, app: Any, token: str):
        if not token:
            raise RuntimeError("PLUGIN_SERVICE_TOKEN is required")
        self.app = app
        self.token = token

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if scope.get("path") == "/health":
            body = json.dumps({"status": "ok"}).encode()
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode()),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return

        headers = dict(scope.get("headers", []))
        authorization = headers.get(b"authorization", b"").decode("latin-1")
        if not hmac.compare_digest(authorization, f"Bearer {self.token}"):
            body = b'{"detail":"Unauthorized"}'
            await send(
                {
                    "type": "http.response.start",
                    "status": 401,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode()),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return

        await self.app(scope, receive, send)


def run_server(server: FastMCP, default_port: int) -> None:
    token = os.environ.get("PLUGIN_SERVICE_TOKEN", "")
    app = TokenAuthMiddleware(server.streamable_http_app(), token)
    port = int(os.getenv("MCP_PORT", str(default_port)))
    if not 1 <= port <= 65535:
        raise ValueError("MCP_PORT must be between 1 and 65535")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
