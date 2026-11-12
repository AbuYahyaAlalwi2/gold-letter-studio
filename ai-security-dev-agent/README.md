# AI Security & Dev Agent

This repository contains a modular engineering scaffold for an AI-powered security and development agent built around a central DeepSeek Harness (DSH), with support for model routing, browser automation, static analysis, and persistent memory.

## Architecture

- DSH Core: browser dashboard, session loop, and Cordis plugin registry
- Code Intelligence Tools: grep, glob, diff editor, repository map
- LiteLLM Proxy: unified model interface with fallback routing
- Playwright MCP: browser automation and accessibility tree access
- Semgrep Wrapper: strict JSON scanning results
- Mem0 Memory: long-term project memory and prior findings

## Structure

```text
ai-security-dev-agent/
├── .env.example
├── README.md
├── docker-compose.yml
├── Makefile
├── dsh/
│   ├── Dockerfile
│   ├── app.py
│   ├── requirements.txt
│   └── plugins/
│       └── __init__.py
├── tools/
│   ├── __init__.py
│   └── code_intelligence/
│       ├── grep_tool.py
│       ├── line_diff_editor.py
│       └── tree_sitter_mapper.py
├── llm-proxy/
│   └── config.yaml
├── browser/
│   └── Dockerfile
├── security/
│   ├── __init__.py
│   └── semgrep_wrapper.py
├── memory/
│   ├── __init__.py
│   └── mem0_plugin.py
├── sandbox/
│   └── Dockerfile
└── workspace/
    └── .gitkeep
```

## Quick start

1. Copy `.env.example` to `.env` and set required values.
2. Run:

```bash
cd ai-security-dev-agent
make up
```

3. Open the dashboard:

```text
http://localhost:8080/dashboard
```

4. To stop:

```bash
make down
```

## Environment variables

See `.env.example` for details.

## Security model

- DSH and LLM services are isolated in a single Compose stack.
- Browser and sandbox services run with reduced privileges.
- Semgrep outputs a compact JSON object containing only matched findings.
- Memory persists cross-session project context via Mem0 plugin storage.
