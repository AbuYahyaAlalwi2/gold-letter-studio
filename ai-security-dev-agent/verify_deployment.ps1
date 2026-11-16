param(
    [string]$EnvFile = ""
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $EnvFile) {
    $EnvFile = $env:ENV_FILE
}
if (-not $EnvFile) {
    $defaultEnv = Join-Path $scriptDir '.env'
    if (Test-Path $defaultEnv) {
        $EnvFile = $defaultEnv
    }
}
if (-not $EnvFile) {
    $userEnv = Join-Path $HOME '.config\gold-letter-studio\agent.env'
    if (Test-Path $userEnv) {
        $EnvFile = $userEnv
    }
}
if (-not $EnvFile -or -not (Test-Path $EnvFile)) {
    throw "No env file found. Pass -EnvFile or set ENV_FILE to a file containing Docker variables."
}

Set-Location $scriptDir
Write-Host "[verify] validating compose file with $EnvFile"
docker compose --env-file $EnvFile config -q

Write-Host "[verify] building and starting containers"
docker compose --env-file $EnvFile up -d --build

$services = @('dsh', 'litellm', 'code-intel', 'semgrep-scanner', 'persistent-memory', 'security-guardrails', 'playwright-mcp')
foreach ($svc in $services) {
    $state = $null
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        $state = docker compose ps --format '{{.Service}} {{.State}}' 2>$null | Select-String -Pattern "^$([regex]::Escape($svc))\s+" | ForEach-Object { $_.Line.Split()[1] }
        if ($state -match 'running|healthy') {
            Write-Host "[verify] $svc is ready"
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not ($state -match 'running|healthy')) {
        throw "[verify] $svc did not become healthy within 120s"
    }
}

Write-Host "[verify] checking DSH HTTP reachability"
try {
    $null = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Write-Host "[verify] DSH responded on port 3000"
}
catch {
    Write-Host "[verify] DSH did not respond on 3000; checking logs" -ForegroundColor Red
    docker compose --env-file $EnvFile logs --tail=80 dsh
    throw
}

Write-Host "[verify] verifying internal tool health endpoints via container loopback"
foreach ($endpoint in @(
    @{ Name = 'litellm'; Port = 4000 },
    @{ Name = 'code-intel'; Port = 8101 },
    @{ Name = 'semgrep-scanner'; Port = 8102 },
    @{ Name = 'persistent-memory'; Port = 8103 },
    @{ Name = 'security-guardrails'; Port = 8104 }
)) {
    $code = @"
import urllib.request
url = 'http://127.0.0.1:$($endpoint.Port)/health'
with urllib.request.urlopen(url, timeout=5) as response:
    response.read()
print('ok')
"@
    try {
        $out = $code | docker compose exec -T $endpoint.Name python -
        Write-Host "[verify] $($endpoint.Name) is answering on port $($endpoint.Port)"
    }
    catch {
        throw "[verify] $($endpoint.Name) is not reachable on port $($endpoint.Port)"
    }
}

Write-Host "[verify] exercising plugin tooling directly inside the running containers"
$guard = @'
from security.guardrails import scan_for_secrets
import tempfile, os
root = tempfile.mkdtemp()
with open(os.path.join(root, '.env'), 'w', encoding='utf-8') as fh:
    fh.write('API_KEY=demo-token\n')
print(scan_for_secrets(root, max_results=10))
'@
$guard | docker compose exec -T security-guardrails python -

$scan = @'
from security.semgrep_wrapper import run_semgrep_scan
print(run_semgrep_scan('/workspace', ['p/security-audit']))
'@
$scan | docker compose exec -T semgrep-scanner python -

$playwrightCheck = @'
require('net').createConnection({ host: '127.0.0.1', port: 8931 }).on('connect', () => process.exit(0)).on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 5000);
'@
$playwrightCheck | docker compose exec -T playwright-mcp node -

Write-Host "[verify] deployment checks completed successfully"
Write-Host "[verify] summary: DSH reachable, health endpoints OK, guardrails and semgrep invoked successfully, Playwright socket open"
