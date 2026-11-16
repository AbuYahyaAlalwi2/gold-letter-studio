#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-${ENV_FILE:-$SCRIPT_DIR/.env}}"
COMPOSE=(docker compose)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[verify] no env file found at: $ENV_FILE" >&2
  echo "[verify] create an external file with the required variables and re-run: ./verify_deployment.sh /path/to/env-file" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[verify] docker is required but not in PATH" >&2
  exit 1
fi

cd "$SCRIPT_DIR"

echo "[verify] validating compose file with $ENV_FILE"
"${COMPOSE[@]}" --env-file "$ENV_FILE" config -q

echo "[verify] building and starting containers"
"${COMPOSE[@]}" --env-file "$ENV_FILE" up -d --build

wait_for_service() {
  local service="$1"
  local deadline=$((SECONDS + 120))
  while (( SECONDS < deadline )); do
    local state
    state=$(docker compose ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk -v s="$service" '$1 == s {print $2; exit}')
    if [[ "$state" == "running" || "$state" == "healthy" || "$state" == "running (healthy)" ]]; then
      echo "[verify] $service is ready"
      return 0
    fi
    sleep 3
  done
  echo "[verify] $service did not become healthy within 120s" >&2
  docker compose ps >&2 || true
  return 1
}

for svc in dsh litellm code-intel semgrep-scanner persistent-memory security-guardrails playwright-mcp; do
  wait_for_service "$svc"
done

echo "[verify] checking DSH HTTP reachability"
if curl -fsS http://127.0.0.1:3000/ >/tmp/dsh_verify.html 2>/dev/null; then
  echo "[verify] DSH responded on port 3000"
else
  echo "[verify] DSH did not respond on 3000; check the startup logs" >&2
  docker compose --env-file "$ENV_FILE" logs --tail=80 dsh >&2 || true
  exit 1
fi

echo "[verify] verifying internal tool health endpoints via container loopback"
for pair in \
  "litellm 4000" \
  "code-intel 8101" \
  "semgrep-scanner 8102" \
  "persistent-memory 8103" \
  "security-guardrails 8104"; do
  set -- $pair
  name=$1
  port=$2
  if docker compose exec -T "$name" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:${port}/health', timeout=5).read()" >/dev/null 2>&1; then
    echo "[verify] $name is answering on port $port"
  else
    echo "[verify] $name is not reachable on port $port" >&2
    exit 1
  fi
done

echo "[verify] exercising plugin tooling directly inside the running containers"

docker compose exec -T security-guardrails python -c "from security.guardrails import scan_for_secrets; import tempfile, os; td=tempfile.mkdtemp(); open(os.path.join(td, '.env'), 'w', encoding='utf-8').write('API_KEY=demo-token\n'); print(scan_for_secrets(td, max_results=10))" >/tmp/guardrails_result.json

docker compose exec -T semgrep-scanner python -c "from security.semgrep_wrapper import run_semgrep_scan; print(run_semgrep_scan('/workspace', ['p/security-audit']))" >/tmp/semgrep_result.json

docker compose exec -T playwright-mcp node -e "require('net').createConnection({ host: '127.0.0.1', port: 8931 }).on('connect', () => process.exit(0)).on('error', () => process.exit(1)); setTimeout(() => process.exit(1), 5000);" >/dev/null 2>&1

echo "[verify] deployment checks completed successfully"
echo "[verify] summary: DSH reachable, health endpoints OK, guardrails and semgrep invoked successfully, Playwright socket open"
