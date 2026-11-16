from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from plugins.server_common import run_server, validate_tool_arguments, workspace_path
from tools.code_intelligence.glob_tool import glob_files as list_glob_matches
from tools.code_intelligence.grep_tool import grep_code as search_code
from tools.code_intelligence.line_diff_editor import smart_line_diff_edit
from tools.code_intelligence.tree_sitter_mapper import build_repo_map
from tools.tool_contract import TOOL_SPECS

mcp = FastMCP("code-intel")


@mcp.tool(description=TOOL_SPECS["grep_code"]["description"])
def grep_code(path: str, pattern: str, include: str = "**/*", max_results: int = 50) -> dict[str, Any]:
    arguments = {"path": path, "pattern": pattern, "include": include, "max_results": max_results}
    validate_tool_arguments("grep_code", arguments)
    root = workspace_path(path)
    return {"results": search_code(str(root), pattern, include, max_results)}


@mcp.tool(description=TOOL_SPECS["glob_files"]["description"])
def glob_files(path: str, pattern: str, max_results: int = 50) -> dict[str, Any]:
    arguments = {"path": path, "pattern": pattern, "max_results": max_results}
    validate_tool_arguments("glob_files", arguments)
    return list_glob_matches(str(workspace_path(path)), pattern, max_results)


@mcp.tool(description=TOOL_SPECS["smart_diff_edit"]["description"])
def smart_diff_edit(path: str, old_text: str, new_text: str, dry_run: bool = True) -> dict[str, Any]:
    arguments = {"path": path, "old_text": old_text, "new_text": new_text, "dry_run": dry_run}
    validate_tool_arguments("smart_diff_edit", arguments)
    target = workspace_path(path)
    return smart_line_diff_edit(str(target), old_text, new_text, dry_run)


@mcp.tool(description=TOOL_SPECS["build_repo_map"]["description"])
def build_repository_map(path: str, max_depth: int = 3) -> dict[str, Any]:
    arguments = {"path": path, "max_depth": max_depth}
    validate_tool_arguments("build_repo_map", arguments)
    return build_repo_map(str(workspace_path(path)), max_depth)


if __name__ == "__main__":
    run_server(mcp, 8101)
