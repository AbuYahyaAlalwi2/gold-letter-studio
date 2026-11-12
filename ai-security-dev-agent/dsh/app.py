import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


class ToolSpec(BaseModel):
    name: str
    description: str
    input_schema: dict[str, Any] = Field(default_factory=dict)


class ToolRegistry:
    def __init__(self) -> None:
        self.tools: dict[str, ToolSpec] = {}

    def register(self, spec: ToolSpec) -> None:
        self.tools[spec.name] = spec

    def list(self) -> list[dict[str, Any]]:
        return [tool.model_dump() for _, tool in self.tools.items()]


registry = ToolRegistry()


registry.register(
    ToolSpec(
        name="grep_code",
        description="Search repository contents using a literal regex or token query.",
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Repository root or target directory."},
                "pattern": {"type": "string", "description": "Regex or token to match."},
                "include": {"type": "string", "default": "**/*.*", "description": "Glob filter."},
                "max_results": {"type": "integer", "default": 50},
            },
            "required": ["path", "pattern"],
            "additionalProperties": False,
        },
    )
)

registry.register(
    ToolSpec(
        name="build_repo_map",
        description="Build a structural repository map that compresses context for AI reasoning.",
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Repository root path."},
                "max_depth": {"type": "integer", "default": 3},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    )
)

registry.register(
    ToolSpec(
        name="smart_diff_edit",
        description="Apply targeted line-based edits in a controlled manner.",
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Target project path."},
                "patch": {"type": "string", "description": "Unified diff or minimal patch payload."},
                "dry_run": {"type": "boolean", "default": True},
            },
            "required": ["path", "patch"],
            "additionalProperties": False,
        },
    )
)

registry.register(
    ToolSpec(
        name="run_semgrep_scan",
        description="Execute a strict JSON semgrep scan and return only security findings.",
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Target repository path."},
                "rules": {"type": "array", "items": {"type": "string"}, "default": []},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    )
)

registry.register(
    ToolSpec(
        name="playwright_browser_action",
        description="Browse a web application, execute JavaScript, and inspect accessibility states.",
        input_schema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The page URL to open."},
                "action": {"type": "string", "description": "Browser action, such as navigate, click, or screenshot."},
                "selector": {"type": "string", "description": "Optional CSS selector."},
            },
            "required": ["url", "action"],
            "additionalProperties": False,
        },
    )
)

app = FastAPI(title="DeepSeek Harness", version="0.1.0")


def require_dashboard_token(x_auth_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("DASHBOARD_TOKEN", "change-me")
    if x_auth_token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "deepseek-harness"}


@app.get("/dashboard")
async def dashboard(request: Request, x_auth_token: str | None = Header(default=None)) -> dict[str, Any]:
    expected = os.getenv("DASHBOARD_TOKEN", "change-me")
    if x_auth_token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return {
        "service": "DeepSeek Harness",
        "mode": "agent-loop",
        "features": [
            "web_dashboard",
            "session_management",
            "plugin_registry",
            "tool_calling",
            "memory_bridge",
        ],
        "routes": {
            "health": "/health",
            "tools": "/api/tools",
            "sessions": "/api/sessions",
        },
    }


@app.get("/api/tools")
async def api_tools(x_auth_token: str | None = Header(default=None)) -> dict[str, Any]:
    require_dashboard_token(x_auth_token)
    return {"tools": registry.list()}


@app.get("/api/sessions")
async def api_sessions(x_auth_token: str | None = Header(default=None)) -> dict[str, Any]:
    require_dashboard_token(x_auth_token)
    return {
        "sessions": [
            {
                "id": "session-001",
                "project": "demo-project",
                "agent": "security-dev-agent",
                "status": "active",
            }
        ]
    }


@app.exception_handler(401)
async def unauthorized_handler(_request: Request, exc: HTTPException):
    return JSONResponse(status_code=401, content={"error": exc.detail})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
