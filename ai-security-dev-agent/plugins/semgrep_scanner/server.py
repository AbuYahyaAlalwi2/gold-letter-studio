from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from plugins.server_common import run_server, validate_tool_arguments, workspace_path
from security.semgrep_wrapper import run_semgrep_scan
from tools.tool_contract import TOOL_SPECS

mcp = FastMCP("semgrep-scanner")


@mcp.tool(description=TOOL_SPECS["run_semgrep_scan"]["description"])
def scan_project(path: str, rules: list[str] | None = None) -> dict[str, Any]:
    arguments: dict[str, Any] = {"path": path}
    if rules is not None:
        arguments["rules"] = rules
    validate_tool_arguments("run_semgrep_scan", arguments)
    return run_semgrep_scan(str(workspace_path(path)), rules)


if __name__ == "__main__":
    run_server(mcp, 8102)
