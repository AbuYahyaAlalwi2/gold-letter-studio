# AI Security & Dev Agent — Phase 1

Phase 1 composes the official DeepSeek Harness web runtime with LiteLLM and three isolated MCP tool services. The Harness owns the agent loop, sessions, dashboard, tool execution, and authentication; Python services provide workspace code intelligence, Semgrep, and project memory.

## Architecture

```text
Browser
  └── DeepSeek Harness web UI (host port 3000; tokenized launch URL)
        ├── LiteLLM (private port 4000; primary + fallback model routes)
        ├── code-intel MCP (private port 8101; workspace read/write)
        ├── semgrep-scanner MCP (private port 8102; workspace read-only)
        ├── persistent-memory MCP (private port 8103; SQLite volume / optional Mem0)
        └── official Playwright MCP (private port 8931)
```

`dsh/model-gateway.patch.yml` configures the LiteLLM route and the built-in DSH Cordis `mcp-manager`. Each directory under `plugins/` is a separately deployable MCP service. DSH's MCP manager connects to the services and exposes their tools to the agent. This uses Harness's supported MCP integration rather than treating Python modules as native Cordis modules.

## Start

Docker Compose is the single deployment entry point. Keep all real credentials in an environment file **outside this repository**; `.env.example` contains placeholders only.

PowerShell example:

```powershell
Set-Location .\ai-security-dev-agent
$envFile = Join-Path $HOME '.config\gold-letter-studio\agent.env'
New-Item -ItemType Directory -Force (Split-Path $envFile) | Out-Null
Copy-Item .\.env.example $envFile
notepad $envFile
```

Generate distinct values for `LITELLM_MASTER_KEY` and `PLUGIN_SERVICE_TOKEN` locally, for example:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Enter credentials only in the external env file. Do not paste them into chat or put them in a repository file. Validate and start without printing expanded configuration:

```powershell
docker compose --env-file $envFile config -q
docker compose --env-file $envFile up --build -d
docker compose --env-file $envFile ps
```

Open the DSH URL printed locally at startup. DSH uses a short-lived launch token and signed session cookie; the tokenized URL is a credential, so do not share it or post unredacted startup logs.

The UI is published on host port `3000`. DSH intentionally rejects wildcard listener addresses; its container listener binds to the container's concrete interface while Compose publishes port `3000` on the host interfaces. The default trusted host is `localhost`. For remote access, configure `DSH_PUBLIC_URL` and `DSH_TRUSTED_HOST` in the external env file, terminate TLS at a reverse proxy, and restrict the host port to that proxy with firewall rules. Do not expose the LiteLLM or MCP ports.

## Models and secrets

- LiteLLM exposes one OpenAI-compatible `gateway-model` to DSH and automatically routes failures to `gateway-fallback`.
- For hosted providers, set both API base URLs, provider-prefixed model names, and API keys in the external env file.
- For a local Ollama fallback, run Ollama where Docker can reach it and configure `FALLBACK_MODEL` (for example `ollama/qwen2.5-coder:7b`), `FALLBACK_API_BASE` (for example `http://host.docker.internal:11434` on Docker Desktop), and a local placeholder `FALLBACK_API_KEY`.
- `LITELLM_MASTER_KEY`, `PLUGIN_SERVICE_TOKEN`, provider keys, and an optional `MEM0_API_KEY` are read from the process environment. They are never copied into the image or written to the project workspace.
- Mem0 Platform is enabled when `MEM0_API_KEY` is set. Without it, the same project-memory tools persist locally in the named `memory-data` SQLite volume. A configured Mem0 failure is surfaced, not silently redirected to SQLite.

## Tool services and isolation

- `plugins/code_intel/` exposes bounded Grep, Glob, exact unique Line-Diff Edit, and a Tree-sitter repository map. File operations are confined to `./workspace`; edits default to dry-run.
- `plugins/semgrep_scanner/` scans the workspace mounted read-only. Only bounded Semgrep registry pack identifiers are accepted; output is validated JSON containing findings and severity counts.
- `plugins/persistent_memory/` stores project-scoped findings, discovered domains, and notes. The SQLite database is in a persistent named volume, separate from the workspace.
- `browser/` runs the official Playwright MCP server on the private Compose network. Use it only with web applications you own or are authorized to test.
- `tools/tool_contract.py` is the shared strict JSON Schema registry. MCP handlers validate inputs again before invoking the implementation.
- Services have no published MCP ports. Compose applies `no-new-privileges`, drops Linux capabilities, makes service roots read-only, and gives the scanner a read-only workspace. The DSH container mounts only the project workspace and its persistent home.

Useful local checks:

```powershell
docker compose --env-file $envFile config -q
docker compose --env-file $envFile ps
```

Use `docker compose --env-file $envFile down` to stop services without deleting data. `down -v` also removes the persistent DSH and memory volumes.

## Adding a Phase 2 plugin

1. Add an isolated service in `plugins/<plugin_name>/` with bounded input/output and tests.
2. Register every exposed tool and its strict schema in `tools/tool_contract.py`.
3. Add a dedicated service and private MCP URL to `docker-compose.yml`.
4. Add the service entry to `mcp-manager.servers` in `dsh/model-gateway.patch.yml`; do not expose its port on the host.
5. Add required configuration as environment-variable references and placeholder names only. Put actual credentials in an external env file or a CI secret.
6. Document authorization boundaries and verify schema validation, workspace confinement, container health, and Compose configuration.

## Phase 3 deployment hardening and validation

The project is now ready for a production-style deployment on any Docker host. The final hardening checklist is:

- `no-new-privileges: true` is enabled on all worker containers.
- container resource caps are enforced: `cpus`, `mem_limit`, and `pids_limit` are defined for DSH, LiteLLM, the MCP tool services, and Playwright.
- the service roots are read-only where the workload does not require a writable filesystem, and all writable state is limited to the named volumes or the mounted workspace.
- traffic is restricted to the Compose bridge network; only DSH exposes port `3000` to the host.
- the DSH launch patch is attached directly in the container entrypoint, so the `mcp-manager` configuration is applied on startup without any manual patch step.

### Run the deployment verification scripts

Linux/macOS:

```bash
cd ai-security-dev-agent
chmod +x verify_deployment.sh
./verify_deployment.sh /path/to/external.env
```

Windows PowerShell:

```powershell
Set-Location .\ai-security-dev-agent
.\verify_deployment.ps1 -EnvFile 'C:\path\to\external.env'
```

The scripts perform the following in order:

1. load the external env file safely,
2. validate `docker compose config`,
3. bring the stack up in detached mode,
4. wait for the health checks and state transitions,
5. confirm DSH is reachable on port `3000`,
6. call each internal service health endpoint through the container loopback interface,
7. invoke the real guardrails and Semgrep tool functions inside the containers,
8. verify the Playwright MCP socket remains open.

### Final operating checklist

- Keep API keys and provider credentials in a file outside the repository.
- Run Compose with `--env-file` and never commit `.env` files.
- Prefer `docker compose down` to stop services; use `docker compose down -v` only when you want to discard persistent volumes.
- Use the DSH launch URL from startup logs and do not share it publicly.
- Treat the DSH token and signed cookie as credentials.

## Limitations

The Python plugin containers and Docker images cannot be built in this environment because Docker is unavailable here. The live DSH dashboard, provider routing, remote Mem0, and browser MCP connection must be smoke-tested on a Docker host with local credentials. No provider credential is needed for the repository's unit tests.


## Phase 2 additions

The project now includes a dedicated `security-guardrails` plugin that exposes two production-focused tools:

- `scan_for_secrets`: scans the mounted workspace for common credential and private-key patterns while preserving a strict bounded result set.
- `security_policy_check`: hunts for dangerous shell execution, remote-download patterns, direct network calls, and environment-file exposure in a repo.

This expands the trigger surface for the agent without weakening the workspace and secret-handling boundaries.
