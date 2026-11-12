from __future__ import annotations

import os
from typing import Any


def run_playwright_action(url: str, action: str, selector: str | None = None) -> dict[str, Any]:
    """Local-first browser wrapper. Uses a remote MCP endpoint when configured; otherwise a local Playwright browser is launched."""
    remote_url = os.getenv("PLAYWRIGHT_MCP_URL")
    if remote_url and remote_url.startswith("http"):
        try:
            import httpx
            response = httpx.post(remote_url, json={"url": url, "action": action, "selector": selector}, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception:
            pass

    try:
        from playwright.sync_api import sync_playwright
    except Exception:
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
        return {"status": "ok", "url": url, "action": action, "title": title, "excerpt": text[:3000]}
