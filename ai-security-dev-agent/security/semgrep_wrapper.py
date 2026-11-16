from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class Finding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    severity: Literal["info", "low", "medium", "high", "critical"]
    message: str
    file: str
    line: int
    rule: str


class ScanResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target: str
    findings: list[Finding]
    summary: dict[str, int]
    errors: list[str]


def run_semgrep_scan(path: str, rules: list[str] | None = None) -> dict[str, Any]:
    target = Path(path).resolve()
    if not target.exists():
        raise FileNotFoundError(path)
    if not target.is_file() and not target.is_dir():
        raise ValueError("target must be a regular file or directory")

    args = ["semgrep", "scan", "--json", "--metrics=off", "--quiet"]
    selected_rules = ["p/security-audit"] if rules is None else rules
    if not 1 <= len(selected_rules) <= 5:
        raise ValueError("rules must contain between 1 and 5 rule packs")
    for rule in selected_rules:
        if not re.fullmatch(r"p/[a-z0-9-]{1,80}", rule):
            raise ValueError(f"Invalid Semgrep rule: {rule!r}")
        args.extend(["--config", rule])
    args.append(str(target))

    errors: list[str] = []
    payload: dict[str, Any] = {}
    try:
        timeout = int(os.getenv("SEMGREP_TIMEOUT_SECONDS", "120"))
        if not 1 <= timeout <= 600:
            raise ValueError("SEMGREP_TIMEOUT_SECONDS must be between 1 and 600")
        safe_env = {
            "PATH": os.getenv("PATH", ""),
            "HOME": os.getenv("HOME", "/tmp"),
            "TMPDIR": os.getenv("TMPDIR", "/tmp"),
            "CI": "true",
            "NO_COLOR": "1",
        }
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False, env=safe_env)
        if not proc.stdout:
            raise RuntimeError("Semgrep returned an empty response")
        payload = json.loads(proc.stdout)
        if not isinstance(payload.get("results", []), list):
            raise RuntimeError("Semgrep returned an invalid findings list")
        if proc.returncode not in (0, 1):
            errors.append(f"Semgrep exited with status {proc.returncode}: {proc.stderr[-1000:]}")
    except FileNotFoundError as exc:
        raise RuntimeError("Semgrep executable is not installed") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError("Semgrep returned invalid JSON") from exc
    except subprocess.TimeoutExpired:
        raise TimeoutError("Semgrep scan timed out") from None

    findings = []
    for item in payload.get("results", []):
        extra = item.get("extra", {})
        severity = str(extra.get("severity", "warning")).lower()
        severity = {"error": "high", "warning": "medium", "info": "info"}.get(severity, severity)
        if severity not in {"info", "low", "medium", "high", "critical"}:
            severity = "medium"
        findings.append(
            {
                "id": str(item.get("check_id", "semgrep")),
                "severity": severity,
                "message": str(extra.get("message", "Security finding"))[:1000],
                "file": str(item.get("path", "unknown")),
                "line": int(item.get("start", {}).get("line", 1)),
                "rule": str(item.get("check_id", "semgrep")),
            }
        )

    counts = {level: sum(1 for f in findings if f["severity"] == level) for level in ("critical", "high", "medium", "low", "info")}
    total = len(findings)
    findings = findings[:500]
    return ScanResult(
        target=str(target),
        findings=[Finding(**item) for item in findings],
        summary={"total": total, **counts},
        errors=errors,
    ).model_dump(mode="json")
