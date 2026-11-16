from __future__ import annotations

import os
from typing import Any

from mcp.server.fastmcp import FastMCP

from memory.mem0_plugin import Mem0Adapter
from plugins.server_common import run_server, validate_tool_arguments
from tools.tool_contract import TOOL_SPECS

mcp = FastMCP("persistent-memory")
memory = Mem0Adapter(os.getenv("MEMORY_DB_PATH", "/data/memory/mem0.sqlite3"))


@mcp.tool(description=TOOL_SPECS["remember_memory"]["description"])
def remember_memory(project: str, fact: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    arguments: dict[str, Any] = {"project": project, "fact": fact}
    if metadata is not None:
        arguments["metadata"] = metadata
    validate_tool_arguments("remember_memory", arguments)
    return memory.remember(project, fact, metadata)


@mcp.tool(description=TOOL_SPECS["recall_memory"]["description"])
def recall_memory(project: str, query: str, limit: int = 20) -> dict[str, Any]:
    arguments = {"project": project, "query": query, "limit": limit}
    validate_tool_arguments("recall_memory", arguments)
    return {"project": project, "memories": memory.recall(project, query, limit)}


if __name__ == "__main__":
    run_server(mcp, 8103)
