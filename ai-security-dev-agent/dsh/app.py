from __future__ import annotations

import os
import secrets
import sqlite3
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse
from jsonschema import validate as validate_schema
from pydantic import BaseModel, Field

from memory.mem0_plugin import ProjectMemory
from security.semgrep_wrapper import run_semgrep_scan
from tools.code_intelligence.grep_tool import grep_code
from tools.code_intelligence.line_diff_editor import smart_line_diff_edit
from tools.code_intelligence.tree_sitter_mapper import build_repo_map

ROOT = Path(os.getenv("PROJECT_ROOT", "/workspace")).resolve()
DB_PATH = os.getenv("DATABASE_PATH", "/data/agent.sqlite3")
TOKEN = os.getenv("DASHBOARD_TOKEN", "")
TOOLS: dict[str, dict[str, Any]] = {
    "grep_code": {"description": "Search text in authorized workspace files.", "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "pattern": {"type": "string"}, "max_results": {"type": "integer", "minimum": 1, "maximum": 100}}, "required": ["path", "pattern"], "additionalProperties": False}},
    "build_repo_map": {"description": "Summarize project files and syntax-tree symbols.", "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "max_depth": {"type": "integer", "minimum": 1, "maximum": 8}}, "required": ["path"], "additionalProperties": False}},
    "smart_diff_edit": {"description": "Replace an exact text block in a workspace file; dry-run by default.", "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "old_text": {"type": "string"}, "new_text": {"type": "string"}, "dry_run": {"type": "boolean"}}, "required": ["path", "old_text", "new_text"], "additionalProperties": False}},
    "run_semgrep_scan": {"description": "Run Semgrep security rules and return validated findings JSON.", "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "rules": {"type": "array", "items": {"type": "string", "maxLength": 200}}}, "required": ["path"], "additionalProperties": False}},
}

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    project: str = Field(default="default", min_length=1, max_length=100)
    session_id: str | None = None

class ToolRequest(BaseModel):
    arguments: dict[str, Any]

@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as db:
        db.execute("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, project TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, transcript TEXT NOT NULL DEFAULT '[]')")
    yield

app = FastAPI(title="AI Security & Dev Agent", version="1.0.0", lifespan=lifespan)

def auth(authorization: str | None = Header(default=None)) -> None:
    if not TOKEN or not authorization or not secrets.compare_digest(authorization, f"Bearer {TOKEN}"):
        raise HTTPException(status_code=401, detail="Unauthorized")

def safe_path(value: str, *, must_exist: bool = True) -> Path:
    target = (ROOT / value).resolve()
    if target != ROOT and ROOT not in target.parents:
        raise ValueError("Path must stay inside the configured workspace")
    if must_exist and not target.exists():
        raise ValueError("Path does not exist in workspace")
    return target

def invoke_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name not in TOOLS:
        raise ValueError("Unknown tool")
    validate_schema(args, TOOLS[name]["input_schema"])
    path = safe_path(args["path"])
    if name == "grep_code":
        result = grep_code(str(path), args["pattern"], max_results=args.get("max_results", 50))
    elif name == "build_repo_map":
        result = build_repo_map(str(path), args.get("max_depth", 3))
    elif name == "smart_diff_edit":
        result = smart_line_diff_edit(str(path), args["old_text"], args["new_text"], args.get("dry_run", True))
    else:
        rules = args.get("rules", ["p/security-audit"])
        result = run_semgrep_scan(str(path), rules)
    return result if isinstance(result, dict) else {"results": result}

def db_connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/", response_class=HTMLResponse)
def dashboard(_: None = Depends(auth)) -> str:
    return """<!doctype html><html><head><meta charset='utf-8'><title>AI Security & Dev Agent</title></head><body><h1>AI Security &amp; Dev Agent</h1><p>Authenticated API is ready. Send Authorization: Bearer &lt;token&gt; to API routes.</p><p><a href='/docs'>API documentation</a></p></body></html>"""

@app.get("/api/tools")
def list_tools(_: None = Depends(auth)) -> dict[str, Any]:
    return {"tools": [{"name": name, **spec} for name, spec in TOOLS.items()]}

@app.post("/api/tools/{name}")
def direct_tool(name: str, request: ToolRequest, _: None = Depends(auth)) -> dict[str, Any]:
    try:
        return invoke_tool(name, request.arguments)
    except (ValueError, OSError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.get("/api/sessions")
def sessions(_: None = Depends(auth)) -> dict[str, Any]:
    with db_connect() as db:
        rows = db.execute("SELECT id, project, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 100").fetchall()
    return {"sessions": [dict(row) for row in rows]}

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, _: None = Depends(auth)) -> dict[str, Any]:
    with db_connect() as db:
        row = db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    import json
    data = dict(row)
    data["transcript"] = json.loads(data["transcript"])
    return data

@app.post("/api/chat")
async def chat(request: ChatRequest, _: None = Depends(auth)) -> dict[str, Any]:
    import json
    sid = request.session_id or str(uuid.uuid4())
    with db_connect() as db:
        row = db.execute("SELECT transcript, project FROM sessions WHERE id=?", (sid,)).fetchone()
        if row and row["project"] != request.project:
            raise HTTPException(status_code=400, detail="Session project mismatch")
        history = json.loads(row["transcript"]) if row else []
        history.append({"role": "user", "content": request.message})
    url = os.getenv("LITELLM_URL", "http://litellm:4000").rstrip("/") + "/v1/chat/completions"
    headers = {"Authorization": "Bearer " + os.getenv("LITELLM_MASTER_KEY", "")}
    tools = [{"type": "function", "function": {"name": name, **spec, "parameters": spec["input_schema"]}} for name, spec in TOOLS.items()]
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(url, headers=headers, json={"model": os.getenv("DEFAULT_MODEL", "local-model"), "messages": history, "tools": tools, "tool_choice": "auto"})
            response.raise_for_status()
            payload = response.json()
            message = payload["choices"][0]["message"]
            history.append(message)
            # Bound tool execution to prevent unbounded agent loops.
            for _ in range(4):
                calls = message.get("tool_calls", [])
                if not calls:
                    break
                for call in calls:
                    try:
                        args = json.loads(call["function"].get("arguments", "{}"))
                        result = invoke_tool(call["function"]["name"], args)
                    except Exception as exc:
                        result = {"error": str(exc)}
                    history.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result, ensure_ascii=False)[:20000]})
                response = await client.post(url, headers=headers, json={"model": os.getenv("DEFAULT_MODEL", "local-model"), "messages": history, "tools": tools, "tool_choice": "auto"})
                response.raise_for_status()
                message = response.json()["choices"][0]["message"]
                history.append(message)
            answer = message.get("content") or "Agent finished tool execution."
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Model gateway unavailable: {exc}") from exc
    with db_connect() as db:
        db.execute("INSERT INTO sessions(id, project, transcript) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=CURRENT_TIMESTAMP, transcript=excluded.transcript", (sid, request.project, json.dumps(history, ensure_ascii=False)))
    ProjectMemory(DB_PATH).remember(request.project, f"Latest agent interaction: {request.message[:500]}", {"session_id": sid})
    return {"session_id": sid, "project": request.project, "answer": answer}
