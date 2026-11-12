# AI Security & Dev Agent — DeepSeek Harness web UI + LiteLLM model connection

This deployment uses the **official DeepSeek Harness web profile** as the browser UI and agent runtime. LiteLLM provides one OpenAI-compatible endpoint for a configured model provider. This replaces the earlier FastAPI mock UI; it does not claim that every optional security/memory component has been integrated into DSH.

## Connect your API model

1. Copy `.env.example` to `.env`.
2. Edit `UPSTREAM_API_BASE`, `UPSTREAM_API_KEY`, and `UPSTREAM_MODEL` for your provider. The example values are for an OpenAI-compatible endpoint. Set the model in LiteLLM's provider-prefixed form (for example `openai/model-name`; check your provider's LiteLLM adapter if it is not OpenAI-compatible).
3. Set `LITELLM_MASTER_KEY` to a long random secret. Never commit `.env`.
4. Start the application:

```sh
docker compose up --build -d
```

5. Inspect startup logs for the `dsh web:` URL and open it in your browser. The process URL contains a short-lived access credential; do not share it. The listener is localhost-only by default: `http://localhost:3080/`.

The DSH profile uses LiteLLM at `http://litellm:4000/v1`, exposes the configured `gateway-model`, and sends `LITELLM_MASTER_KEY` to that internal gateway. The upstream provider key is only passed to LiteLLM. The API key is not stored in Git or placed in the DSH patch.

## Verify

```sh
docker compose config
docker compose ps
docker compose logs --tail=100 dsh litellm
```

Then use the DSH UI's Settings → Models to confirm the configured gateway model is available. To stop without deleting persistent DSH profile/session data:

```sh
docker compose down
```

## VPS / reverse proxy

The default is intentionally bound to loopback. For a VPS, configure `DSH_PUBLIC_URL=https://your-domain/` and `DSH_TRUSTED_HOST=your-domain`, place a TLS-terminating reverse proxy in front, and expose the host-side DSH port only to that proxy/firewall. Follow the official DSH public deployment guidance for proxy headers, host/origin validation, and TLS. Do not expose LiteLLM's port publicly.

## Scope and limitations

This commit wires the official DSH web app to one configurable LiteLLM OpenAI-compatible route. It does **not** make Semgrep, repository tools, Playwright MCP, or Mem0 callable from DSH unless those integrations are separately installed/configured as DSH Cordis plugins or MCP servers. The existing Python prototype files remain reference code and are not the DSH web runtime. No Docker build, provider API call, or live smoke test can be run from this GitHub-only environment; validate with the commands above on your host.

Official references:

- DSH Web: https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/bundle/web-app
- DSH model routing: https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/llm/llm-pi-ai
- LiteLLM: https://docs.litellm.ai/
