# AI Security & Dev Agent
# Local-first blueprint for a modular AI security and engineering assistant.

## Architecture

- DSH: FastAPI dashboard + session manager + tool registry
- LiteLLM: unified model gateway with local Ollama + hosted fallback
- Playwright MCP: browser automation and accessibility inspection
- Semgrep Wrapper: strict JSON security scanning output
- Memory: SQLite-backed long-term project memory with Mem0 adapter support
- Sandbox: hardened, volume-isolated worker space

## Repository layout

```text
ai-security-dev-agent/
├── .env.example
├── .github/
│   └── workflows/
│       └── smoke.yml
├── README.md
├── docker-compose.yml
├── Makefile
├── dsh/
│   ├── Dockerfile
│   ├── __init__.py
│   ├── app.py
│   └── requirements.txt
├── llm-proxy/
│   └── config.yaml
├── memory/
│   ├── __init__.py
│   └── mem0_plugin.py
├── security/
│   ├── __init__.py
│   └── semgrep_wrapper.py
├── tests/
│   └── test_smoke.py
├── tools/
│   ├── __init__.py
│   ├── code_intelligence/
│   │   ├── __init__.py
│   │   ├── grep_tool.py
│   │   ├── line_diff_editor.py
│   │   └── tree_sitter_mapper.py
│   ├── playwight_mcp.py
│   ├── playwight_mcp.py
│   ├── tool_contract.py
│   └── playwright_mcp.py
└── workspace/
    └── .gitkeep
```

## Quick start

1. Copy `.env.example` to `.env` and replace secrets.
2. Run:

```bash
cd ai-security-dev-agent
cp .env.example .env
make up
```

3. Open the dashboard at:

```text
http://127.0.0.1:8080/
```

4. To stop:

```bash
make down
```

## Environment

Set these variables in `.env` before starting:

```dotenv
DASHBOARD_TOKEN=replace-with-a-long-random-secret
LITELLM_MASTER_KEY=replace-with-another-random-secret
DEFAULT_MODEL=local-model
OPENAI_API_KEY=
OLLAMA_BASE_URL=http://ollama:11434
PROJECT_ROOT=/workspace
```

## Security notes

- Services are isolated on an internal Docker network.
- The DSH service requires a bearer token on every protected API route.
- The Compose stack does not expose browser automation to the public internet by default.
- Memory is persisted locally and can be swapped with a proper Mem0 deployment later.
- Do not run untrusted code in a sensitive environment without a dedicated sandbox/VM boundary.

## CI / validation

The repository includes a smoke workflow that validates imports and container config.

```bash
cd ai-security-dev-agent
pytest -q
docker compose config
```
