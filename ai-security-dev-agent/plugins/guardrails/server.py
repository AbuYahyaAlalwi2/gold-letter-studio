from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from plugins.server_common import run_server, validate_tool_arguments, workspace_path
from security.guardrails import scan_for_secrets, security_policy_check
from tools.tool_contract import TOOL_SPECS

mcp = FastMCP("security-guardrails")


@mcp.tool(description=TOOL_SPECS["scan_for_secrets"]["description"])
def guard_secrets(path: str, include: str = "**/*", max_results: int = 50) -> dict[str, Any]:
    arguments = {"path": path, "include": include, "max_results": max_results}
    validate_tool_arguments("scan_for_secrets", arguments)
    return scan_for_secrets(str(workspace_path(path)), include, max_results)


@mcp.tool(description=TOOL_SPECS["security_policy_check"]["description"])
def guard_policy(path: str, policy: str = "strict", max_results: int = 50) -> dict[str, Any]:
    arguments = {"path": path, "policy": policy, "max_results": max_results}
    validate_tool_arguments("security_policy_check", arguments)
    return security_policy_check(str(workspace_path(path)), policy, max_results)


if __name__ == "__main__":
    run_server(mcp, 8104)
