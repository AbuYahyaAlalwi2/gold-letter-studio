from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import HTMLResponse
from jsonschema import Draft7Validator
from pydantic import BaseModel, Field

from memory.mem0_plugin import Mem0Adapter
from security.semgrep_wrapper import run_semgrep_scan
from tools.code_intelligence.grep_tool import grep_code
from tools.code_intelligence.line_diff_editor import smart_line_diff_edit
from tools.code_intelligence.tree_sitter_mapper import build_repo_map
from tools.playwright_mcp import run_playwright_action
from tools.tool_contract import TOOL_SPECS, build_tool_payload, call_litellm, require_auth

ROOT = Path(os.getenv("PROJECT_ROOT", "/workspace")).resolve()
DB_PATH = os.getenv("DATABASE_PATH", "/data/agent.sqlite3")
MEMORY_DB = str(Path(os.getenv("MEMORY_DB_PATH", "/data/mem0.sqlite3")).resolve())
TOKEN = os.getenv("DASHBOARD_TOKEN", "")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    project: str = Field(default="default", min_length=1, max_length=128)
    session_id: str | None = None


class ToolRequest(BaseModel):
    arguments: dict[str, Any]


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    Path(MEMORY_DB).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                project TEXT NOT NULL,
                transcript TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    yield


app = FastAPI(title="AI Security & Dev Agent", version="1.1.0", lifespan=lifespan)
memory = Mem0Adapter(MEMORY_DB, os.getenv("MEM0_URL"))


def db_connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def validate_tool_args(name: str, args: dict[str, Any]) -> None:
    validator = Draft7Validator(TOOL_SPECS[name].input_schema)
    errors = sorted(validator.iter_errors(args), key=lambda e: e.path)
    if errors:
        raise ValueError(errors[0].message)


def safe_path(raw: str) -> Path:
    workspace = ROOT
    target = Path(raw).expanduser()
    if not target.is_absolute():
        target = (workspace / target).resolve()
    else:
        target = target.resolve()
    if workspace not in target.parents and target != workspace:
        raise ValueError("Path escapes workspace")
    return target


def invoke_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
    validate_tool_args(name, args)
    if name == "grep_code":
        return {"results": grep_code(args["path"], args["pattern"], args.get("include", "**/*"), args.get("max_results", 50))}
    if name == "build_repo_map":
        return build_repo_map(args["path"], args.get("max_depth", 3))
    if name == "smart_diff_edit":
        return smart_line_diff_edit(args["path"], args["old_text"], args["new_text"], args.get("dry_run", True))
    if name == "run_semgrep_scan":
        return run_semgrep_scan(args["path"], args.get("rules"))
    if name == "playwright_browser_action":
        return run_playwright_action(args["url"], args["action"], args.get("selector"))
    raise ValueError("Unknown tool")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def dashboard(auth: str | None = Header(default=None)) -> str:
    try:
        require_auth(auth)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return """<!doctype html><html><head><title>AI Security &amp; Dev Agent</title></head><body><h1>AI Security &amp; Dev Agent</h1><p>Gateway is online.</p><p><a href='/docs'>Open API docs</a></p></body></html>"""


@app.get("/api/tools")
def list_tools(auth: str | None = Header(default=None)) -> dict[str, Any]:
    try:
        require_auth(auth)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return {"tools": [{"name": spec.name, "description": spec.description, "input_schema": spec.input_schema} for spec in TOOL_SPECS.values()]}


@app.post("/api/tools/{name}")
def direct_tool(name: str, request: ToolRequest, auth: str | None = Header(default=None)) -> dict[str, Any]:
    try:
        require_auth(auth)
        return invoke_tool(name, request.arguments)
    except (PermissionError, ValueError, FileNotFoundError, OSError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@app.get("/api/sessions")
def list_sessions(auth: str | None = Header(default=None)) -> dict[str, Any]:
    try:
        require_auth(auth)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    with db_connect() as db:
        rows = db.execute("SELECT id, project, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 100").fetchall()
    return {"sessions": [dict(row) for row in rows]}


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, auth: str | None = Header(default=None)) -> dict[str, Any]:
    try:
        require_auth(auth)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    with db_connect() as db:
        row = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    data = dict(row)
    data["transcript"] = json.loads(data["transcript"]) if data.get("transcript") else []
    return data


@app.post("/api/chat")
async def chat(request: ChatRequest, auth: str | None = Header(default=None)) -> dict[str, Any]:
    try:
        require_auth(auth)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    sid = request.session_id or str(uuid.uuid4())
    with db_connect() as db:
        row = db.execute("SELECT transcript FROM sessions WHERE id = ?", (sid,)).fetchone()
        history = json.loads(row["transcript"]) if row else []
        history.append({"role": "user", "content": request.message})

    tools_payload = build_tool_payload()
    try:
        model_response = await call_litellm(history, tools_payload)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Model gateway unavailable: {exc}") from exc

    if "choices" not in model_response:
        raise HTTPException(status_code=502, detail="Model gateway failed to produce a response")

    message = model_response["choices"][0]["message"]
    history.append(message)

    for _ in range(4):
        calls = message.get("tool_calls", [])
        if not calls:
            break
        for call in calls:
            try:
                tool_name = call["function"]["name"]
                tool_args = json.loads(call["function"].get("arguments", "{}"))
                result = invoke_tool(tool_name, tool_args)
            except Exception as exc:
                result = {"error": str(exc)}
            history.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result, ensure_ascii=False)[:20000]})
        model_response = await call_litellm(history, tools_payload)
        message = model_response["choices"][0]["message"]
        history.append(message)

    answer = message.get("content") or "Agent completed the requested workflow."
    with db_connect() as db:
        db.execute(
            "INSERT INTO sessions(id, project, transcript, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET project=excluded.project, transcript=excluded.transcript, updated_at=CURRENT_TIMESTAMP",
            (sid, request.project, json.dumps(history, ensure_ascii=False)),
        )
    memory.remember(request.project, request.message[:500], {"session_id": sid, "type": "chat"})
    return {"session_id": sid, "project": request.project, "answer": answer}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
