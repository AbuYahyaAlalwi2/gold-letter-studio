# AI Security & Dev Agent

A defensive, local-first security and development assistant scaffold. It keeps analysis tools inside a configured workspace, requires a dashboard bearer token, routes chat through LiteLLM, and persists sessions and project notes in SQLite. It is designed for authorized code review and testing only.

> This is a self-hostable starter application, not a certified security product. Review the security notes before exposing it beyond localhost. The current backend is a small FastAPI harness; it is not the upstream DeepSeek Harness/Cordis implementation.

## Components

- **Harness API / dashboard:** FastAPI service, bearer-token authentication, chat/tool loop, SQLite sessions.
- **Code tools:** bounded grep, file listing, repository map (Tree-sitter when supported), exact-match edits.
- **Model gateway:** LiteLLM with local Ollama and optional OpenAI fallback.
- **Static analysis:** Semgrep wrapper with strict JSON result schema.
- **Browser:** official Playwright MCP server is available as a separate service; it is not exposed to the public host by default.
- **Memory:** persistent SQLite project memory with a clear adapter boundary for a Mem0 deployment. This compose setup does not pretend a mock is a Mem0 server.
- **Sandbox:** Compose hardening, no privileged mode, dropped capabilities, read-only container filesystems where applicable, and a dedicated workspace mount. No arbitrary shell tool is provided to the model.

## Requirements

Docker Engine with the Compose plugin, at least 8 GB RAM for local Ollama, and a model key only if you enable a hosted provider.

## Start

```bash
cd ai-security-dev-agent
cp .env.example .env
# Edit .env and replace DASHBOARD_TOKEN with a long random secret.
docker compose up --build -d
```

Pull a local model (default configuration):

```bash
docker compose exec ollama ollama pull llama3.1
```

Dashboard/API: `http://localhost:8080/` (send `Authorization: Bearer <DASHBOARD_TOKEN>`). Health check: `http://localhost:8080/health`.

Example authenticated request:

```bash
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" http://localhost:8080/api/tools
```

To chat, `POST /api/chat` with JSON `{"message":"Review the project for common security issues","project":"demo"}`. The agent can call only the registered bounded tools. Put the authorized target repository under `workspace/` first.

Stop without deleting persistent data:

```bash
docker compose down
```

`docker compose down -v` deletes the database and Ollama model volume.

## Configuration

Copy `.env.example` to `.env`. Never commit `.env` or paste secrets into source files. Set `DASHBOARD_TOKEN` to a unique random value. To enable OpenAI fallback, set `OPENAI_API_KEY`; otherwise the local Ollama model is used. Change model names in `llm-proxy/config.yaml` to match providers you configured. Keep the LiteLLM admin key private.

## API

- `GET /health` — unauthenticated liveness check.
- `GET /` — dashboard/API usage information (authentication required).
- `GET /api/tools`, `GET /api/sessions`, `GET /api/sessions/{id}` — authenticated API.
- `POST /api/chat` — authenticated chat with bounded tool execution.
- `POST /api/tools/{name}` — authenticated direct invocation for registered tools.

## Security boundaries and limitations

- Bind host ports to `127.0.0.1` by default. Put a TLS reverse proxy and network controls in front before remote use.
- The auth token is a shared bearer secret, not user identity management, CSRF protection, or rate limiting. Rotate it if exposed.
- The workspace is mounted read/write so approved edits can be made. Do not mount sensitive host directories or a Docker socket.
- Semgrep and browser automation process untrusted project/web content. Use an isolated host/VM for untrusted targets; do not browse arbitrary untrusted URLs from a sensitive network.
- Browser MCP runs in its own container and is not included as a callable chat tool yet. Do not assume arbitrary JavaScript/network inspection is wired into the agent API.
- SQLite memory is local persistent project notes, not the Mem0 product. The adapter can be replaced with a secured Mem0 deployment.
- This project does not execute arbitrary shell commands. Tool execution is limited to declared operations.
- Run tests and inspect Compose configuration before deployment; this repository update cannot validate your Docker host, provider keys, model availability, or network policy.

## Development / tests

```bash
python -m pip install -r dsh/requirements.txt
python -m pytest -q
```

The included unit tests run without external services. For full-stack validation use `docker compose config` and `docker compose up --build` on your own host.
