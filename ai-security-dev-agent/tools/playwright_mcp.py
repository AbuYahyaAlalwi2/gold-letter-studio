from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any


def run_playwright_action(url: str, action: str, selector: str | None = None, wait_ms: int = 1500) -> dict[str, Any]:
    """A safe, local-first browser wrapper.

    It tries a direct local Playwright invocation first and falls back to a remote MCP-style
    endpoint when configured. The function returns a compact JSON payload that fits an LLM tool
    call contract.
    """
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        sync_playwright = None

    remote_url = os.getenv("PLAYWRIGHT_MCP_URL")
    if remote_url and remote_url.startswith("http"):
        try:
            import httpx
            response = httpx.post(
                remote_url,
                json={"url": url, "action": action, "selector": selector, "wait_ms": wait_ms},
                timeout=30,
            )
            response.raise_for_status()
            return response.json()
        except Exception:
            pass

    if sync_playwright is None:
        return {"status": "unavailable", "url": url, "action": action, "message": "playwright is not installed"}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")
        if selector and action in {"click", "fill", "hover"}:
            target = page.locator(selector)
            if action == "click":
                target.click(timeout=15000)
            elif action == "fill":
                target.fill("")
            elif action == "hover":
                target.hover()
        title = page.title()
        text = page.locator("body").inner_text()
        browser.close()
        return {
            "status": "ok",
            "url": url,
            "action": action,
            "title": title,
            "excerpt": text[:3000],
            "selector": selector,
        }
