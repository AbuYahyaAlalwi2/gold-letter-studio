from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft7Validator

from plugins.server_common import TokenAuthMiddleware, validate_tool_arguments, workspace_path
from tools.code_intelligence.glob_tool import glob_files
from tools.code_intelligence.tree_sitter_mapper import build_repo_map
from tools.tool_contract import TOOL_SPECS


def test_tool_schemas_are_valid_and_reject_unknown_fields() -> None:
    examples: dict[str, dict[str, Any]] = {
        "grep_code": {"path": ".", "pattern": "needle"},
        "glob_files": {"path": ".", "pattern": "**/*.py"},
        "build_repo_map": {"path": "."},
        "smart_diff_edit": {"path": "a.py", "old_text": "old", "new_text": "new"},
        "run_semgrep_scan": {"path": "."},
        "remember_memory": {"project": "demo", "fact": "finding"},
        "recall_memory": {"project": "demo", "query": "finding"},
        "scan_for_secrets": {"path": "."},
        "security_policy_check": {"path": "."},
    }

    assert set(examples) == set(TOOL_SPECS)
    for name, spec in TOOL_SPECS.items():
        schema = spec["input_schema"]
        Draft7Validator.check_schema(schema)
        assert schema["additionalProperties"] is False
        validator = Draft7Validator(schema)
        assert not list(validator.iter_errors(examples[name]))
        assert list(validator.iter_errors({**examples[name], "unexpected": True}))


def test_validator_rejects_bad_semgrep_rule() -> None:
    with pytest.raises(ValueError):
        validate_tool_arguments("run_semgrep_scan", {"path": ".", "rules": ["https://example.test/rules.yml"]})


def test_workspace_path_rejects_escape(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROJECT_ROOT", str(tmp_path))
    with pytest.raises(ValueError, match="escapes"):
        workspace_path("../outside")


def test_glob_is_bounded_and_excludes_git_data(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("print('ok')", encoding="utf-8")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "hidden.py").write_text("secret", encoding="utf-8")

    result = glob_files(str(tmp_path), "**/*.py", max_results=1)
    assert result == {"matches": ["src/main.py"], "truncated": False, "count": 1}


def test_repo_map_includes_tree_sitter_symbols(tmp_path: Path) -> None:
    (tmp_path / "sample.py").write_text("class Example:\n    def run(self):\n        pass\n", encoding="utf-8")

    result = build_repo_map(str(tmp_path))
    sample = next(entry for entry in result["entries"] if entry["path"] == "sample.py")
    assert "Example" in sample["symbols"]
    assert "run" in sample["symbols"]


def test_plugin_mcp_endpoints_require_bearer_token() -> None:
    sent: list[dict[str, Any]] = []

    async def app(scope: dict[str, Any], receive: Any, send: Any) -> None:
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    middleware = TokenAuthMiddleware(app, "unit-test-token")
    asyncio.run(
        middleware(
            {"type": "http", "path": "/mcp", "headers": []},
            receive,
            send,
        )
    )
    assert sent[0]["status"] == 401
