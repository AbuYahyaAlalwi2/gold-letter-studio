from __future__ import annotations

import json
import os
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
    args = ["semgrep", "scan", "--json", "--metrics=off", "--quiet"]
    for rule in (rules or ["p/security-audit"]):
        if not rule or rule.startswith("-") or len(rule) > 200:
            raise ValueError("Invalid Semgrep ruleset")
        args.extend(["--config", rule])
    args.append(str(target))
    errors: list[str] = []
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=int(os.getenv("SEMGREP_TIMEOUT_SECONDS", "120")), check=False)
        payload = json.loads(proc.stdout or "{}")
        if proc.returncode not in (0, 1):
            errors.append("Semgrep exited with a non-zero status")
    except subprocess.TimeoutExpired:
        payload = {}
        errors.append("Semgrep scan timed out")
    except (FileNotFoundError, json.JSONDecodeError):
        payload = {}
        errors.append("Semgrep unavailable or returned invalid JSON")
    findings = []
    for item in payload.get("results", []):
        extra = item.get("extra", {})
        severity = str(extra.get("severity", "WARNING")).lower()
        severity = {"error": "high", "warning": "medium", "info": "info"}.get(severity, severity)
        if severity not in {"info", "low", "medium", "high", "critical"}:
            severity = "medium"
        findings.append({"id": str(item.get("check_id", "semgrep")), "severity": severity, "message": str(extra.get("message", "Security finding"))[:1000], "file": str(item.get("path", "unknown")), "line": int(item.get("start", {}).get("line", 1)), "rule": str(item.get("check_id", "semgrep"))})
    counts = {level: sum(f["severity"] == level for f in findings) for level in ("critical", "high", "medium", "low", "info")}
    return ScanResult(target=str(target), findings=[Finding(**x) for x in findings], summary={"total": len(findings), **counts}, errors=errors).model_dump()
