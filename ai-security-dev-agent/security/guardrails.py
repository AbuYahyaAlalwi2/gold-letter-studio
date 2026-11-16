from __future__ import annotations

import re
from pathlib import Path
from typing import Any

_SECRETS_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("aws-key", re.compile(r"(?i)(AKIA[0-9A-Z]{16}|aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['\"][^'\"]{16,})")),
    ("google-api", re.compile(r"(?i)(AIza[0-9A-Za-z\-_]{35})")),
    ("github-token", re.compile(r"(?i)(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_\-]{20,})")),
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----")),
    ("env-secret", re.compile(r"(?i)(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PRIVATE[_-]?KEY)\s*[:=]\s*['\"][^'\"]{8,}['\"]")),
    ("generic-key", re.compile(r"(?i)(?:LITELLM_MASTER_KEY|UPSTREAM_API_KEY|MEM0_API_KEY|OPENAI_API_KEY|PLUGIN_SERVICE_TOKEN)\s*[:=]\s*['\"][^'\"]{8,}['\"]")),
]

_POLICY_RULES: list[tuple[str, re.Pattern[str], str]] = [
    ("dangerous-shell", re.compile(r"(?i)(?:exec\s*\(|eval\s*\(|os\.system\s*\(|subprocess\.(?:call|run|Popen)\s*\()"), "shell execution is invoked"),
    ("unsafe-download", re.compile(r"(?i)(?:curl\s+.*\|\s*(?:bash|sh)|wget\s+.*\|\s*(?:bash|sh)|curl\s+https?://)"), "remote shell or download is executed"),
    ("network-allow", re.compile(r"(?i)(?:\bhttp://\b|\bhttps?://\b)"), "network access is used directly in code"),
    ("env-file", re.compile(r"(?i)(?:\.env|\.env\.[A-Za-z0-9_-]+)"), "environment files are present in the project"),
]


def _iter_files(path: str, include: str = "**/*") -> list[Path]:
    root = Path(path).resolve()
    if not root.exists():
        raise FileNotFoundError(path)
    excluded_dirs = {".git", ".venv", "node_modules", "__pycache__", "dist", "build", ".pytest_cache", ".mypy_cache"}
    files: list[Path] = []
    for item in root.rglob("*"):
        if item.is_dir():
            if item.name in excluded_dirs:
                continue
            continue
        if item.is_symlink():
            continue
        rel = item.relative_to(root).as_posix()
        if include != "**/*" and not __import__("fnmatch").fnmatch(rel, include):
            continue
        files.append(item)
    return sorted(files)


def scan_for_secrets(path: str, include: str = "**/*", max_results: int = 50) -> dict[str, Any]:
    root = Path(path).resolve()
    if not root.exists():
        raise FileNotFoundError(path)
    if not 1 <= max_results <= 100:
        raise ValueError("max_results must be between 1 and 100")

    findings: list[dict[str, Any]] = []
    for file_path in _iter_files(str(root), include)[:5000]:
        try:
            text = file_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            for reason, pattern in _SECRETS_PATTERNS:
                if pattern.search(line):
                    findings.append({
                        "file": file_path.relative_to(root).as_posix(),
                        "line": line_no,
                        "reason": reason,
                        "snippet": line.strip()[:200],
                    })
                    if len(findings) >= max_results:
                        return {"target": str(root), "findings": findings[:max_results], "count": len(findings), "truncated": True}
    return {"target": str(root), "findings": findings[:max_results], "count": len(findings), "truncated": len(findings) > max_results}


def security_policy_check(path: str, policy: str = "strict", max_results: int = 50) -> dict[str, Any]:
    if policy not in {"strict", "default", "relaxed"}:
        raise ValueError("policy must be one of: strict, default, relaxed")
    root = Path(path).resolve()
    if not root.exists():
        raise FileNotFoundError(path)
    if not 1 <= max_results <= 100:
        raise ValueError("max_results must be between 1 and 100")

    violations: list[dict[str, Any]] = []
    ruleset = _POLICY_RULES if policy == "strict" else _POLICY_RULES[:2] if policy == "default" else []
    for file_path in _iter_files(str(root), "**/*")[:5000]:
        try:
            text = file_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            for rule_name, pattern, message in ruleset:
                if pattern.search(line):
                    violations.append({
                        "file": file_path.relative_to(root).as_posix(),
                        "line": line_no,
                        "rule": rule_name,
                        "message": message,
                        "snippet": line.strip()[:200],
                    })
                    if len(violations) >= max_results:
                        return {"target": str(root), "policy": policy, "violations": violations[:max_results], "count": len(violations), "truncated": True}
    return {"target": str(root), "policy": policy, "violations": violations[:max_results], "count": len(violations), "truncated": len(violations) > max_results}
