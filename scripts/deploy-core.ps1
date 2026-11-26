param(
  [string]$DockerHost = "tcp://192.168.1.100:2375",
  [string]$BuildConfig = "production"
)

$ErrorActionPreference = "Stop"

# Ensure local network Docker host bypasses any local HTTP/SOCKS proxy
$hostIp = ($DockerHost -replace '^tcp://', '' -replace ':\d+$', '')
$noProxyItems = @($env:NO_PROXY -split ',' | Where-Object { $_ -and $_.Trim() -ne '' })
if ($noProxyItems -notcontains $hostIp) {
  $noProxyItems += $hostIp
}
$env:NO_PROXY = ($noProxyItems -join ',')
$env:no_proxy = $env:NO_PROXY
$env:DOCKER_HOST = $DockerHost
$env:WEB_BUILD_CONFIG = $BuildConfig

function Invoke-DockerCompose {
  param([string[]]$ComposeArgs)
  & docker compose -p lemon-core -f docker-compose.core.yml @ComposeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed with exit code $LASTEXITCODE (args: $($ComposeArgs -join ' '))"
  }
}

Write-Host "🚀 Building Unified Core & Shield API image on $DockerHost ..." -ForegroundColor Cyan
Invoke-DockerCompose @("build", "api")

Write-Host "🌐 Building Unified Lemon App Shell ($BuildConfig) image on $DockerHost ..." -ForegroundColor Cyan
Invoke-DockerCompose @("build", "web")

Write-Host "📦 Starting Unified Lemon Stack (postgres, nats, api, watchers-shard, web) on $DockerHost ..." -ForegroundColor Cyan
Invoke-DockerCompose @("up", "-d", "--remove-orphans")

Write-Host "✅ Active containers on ${DockerHost}:" -ForegroundColor Green
Invoke-DockerCompose @("ps")

Write-Host "==> Verifying unified HTTP endpoints on $hostIp ..." -ForegroundColor Cyan
foreach ($ep in @("health", "seasons/status", "media/status", "ai/status", "projectarium/shards")) {
  try {
    $resp = Invoke-RestMethod -Uri "http://$($hostIp):3000/api/$ep" -TimeoutSec 10
    Write-Host "    API /api/${ep}: $($resp | ConvertTo-Json -Compress)" -ForegroundColor Green
  } catch {
    Write-Warning "API /api/$ep probe failed: $_"
  }
}

try {
  $shardResp = Invoke-RestMethod -Uri "http://$($hostIp):4320/api/shard/health" -TimeoutSec 10
  Write-Host "    Watchers Shard :4320/api/shard/health: $($shardResp | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
  Write-Warning "Watchers Shard :4320 probe failed: $_"
}

foreach ($port in @(80, 4201)) {
  try {
    $webResp = Invoke-WebRequest -Uri "http://$($hostIp):$($port)/" -UseBasicParsing -TimeoutSec 10
    Write-Host "    Web :${port}/ status: $($webResp.StatusCode)" -ForegroundColor Green
  } catch {
    Write-Warning "Web :${port} probe failed: $_"
  }
}
