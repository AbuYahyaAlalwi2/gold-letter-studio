from __future__ import annotations

import json
import subprocess
from typing import Any, Literal

from pydantic import BaseModel, Field


class Finding(BaseModel):
    id: str
    severity: Literal["info", "low", "medium", "high", "critical"]
    message: str
    file: str
    line: int
    rule: str
    confidence: str = "high"


class SemgrepScanResult(BaseModel):
    target: str
    findings: list[Finding] = Field(default_factory=list)
    summary: dict[str, int] = Field(default_factory=dict)


def run_semgrep_scan(path: str, rules: list[str] | None = None) -> dict[str, Any]:
    """Run Semgrep and return only a strict, compact JSON result for agent consumption."""
    rule_args = []
    if rules:
        rule_args.extend(["--config", *rules])

    cmd = ["semgrep", "scan", "--json", *rule_args, path]
    try:
        completed = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=120)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return {"target": path, "findings": [], "summary": {"total": 0, "errors": 1}}

    output = completed.stdout or completed.stderr or "{}"
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        return {"target": path, "findings": [], "summary": {"total": 0, "errors": 1}}

    results = payload.get("results", [])
    findings: list[dict[str, Any]] = []
    for item in results:
        check = item.get("check", {})
        if not check:
            continue
        findings.append(
            {
                "id": check.get("id", "semgrep-generic"),
                "severity": (item.get("extra", {}).get("severity") or "medium").lower(),
                "message": item.get("extra", {}).get("message", "Security finding"),
                "file": item.get("path", "unknown"),
                "line": int(item.get("start", {}).get("line", 1)),
                "rule": check.get("id", "semgrep-rule"),
                "confidence": "high",
            }
        )

    compact = SemgrepScanResult(
        target=path,
        findings=[Finding(**finding) for finding in findings],
        summary={
            "total": len(findings),
            "critical": sum(1 for f in findings if f["severity"] == "critical"),
            "high": sum(1 for f in findings if f["severity"] == "high"),
            "medium": sum(1 for f in findings if f["severity"] == "medium"),
            "low": sum(1 for f in findings if f["severity"] == "low"),
        },
    )
    return compact.model_dump(mode="json")
