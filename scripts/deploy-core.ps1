param(
  [string]$DockerContext = "lemon-remote",
  [string]$DockerHost = "",
  [string]$TargetHost = "192.168.1.100",
  [string]$BuildConfig = "production"
)

$ErrorActionPreference = "Stop"

# Ensure local network Docker host bypasses any local HTTP/SOCKS proxy
$hostIp = if ($DockerHost) { ($DockerHost -replace '^tcp://', '' -replace ':\d+$', '') } else { $TargetHost }
$noProxyItems = @($env:NO_PROXY -split ',' | Where-Object { $_ -and $_.Trim() -ne '' })
if ($noProxyItems -notcontains $hostIp) {
  $noProxyItems += $hostIp
}
$env:NO_PROXY = ($noProxyItems -join ',')
$env:no_proxy = $env:NO_PROXY
if ($DockerHost) {
  $env:DOCKER_HOST = $DockerHost
} else {
  Remove-Item Env:DOCKER_HOST -ErrorAction SilentlyContinue
}
$env:WEB_BUILD_CONFIG = $BuildConfig
$targetDesc = if ($DockerHost) { $DockerHost } else { "context:$DockerContext ($hostIp)" }

function Invoke-DockerCompose {
  param([string[]]$ComposeArgs)
  if ($DockerHost) {
    & docker compose -p lemon-core -f docker-compose.core.yml @ComposeArgs
  } else {
    & docker --context $DockerContext compose -p lemon-core -f docker-compose.core.yml @ComposeArgs
  }
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed with exit code $LASTEXITCODE (args: $($ComposeArgs -join ' '))"
  }
}

Write-Host "🚀 Building Unified Core & Shield API image on $targetDesc ..." -ForegroundColor Cyan
Invoke-DockerCompose @("build", "api")

Write-Host "🌐 Building Unified Lemon App Shell ($BuildConfig) image on $targetDesc ..." -ForegroundColor Cyan
Invoke-DockerCompose @("build", "web")

$watchersShardPort = if ($env:WATCHERS_SHARD_PORT) { $env:WATCHERS_SHARD_PORT } else { "4326" }
$seasonsShardPort = if ($env:SEASONS_SHARD_PORT) { $env:SEASONS_SHARD_PORT } else { "4327" }
$spaceShardPort = if ($env:SPACE_SHARD_PORT) { $env:SPACE_SHARD_PORT } else { "4328" }

Write-Host "📦 Starting Unified Lemon Stack (postgres, api, watchers-shard:$watchersShardPort, seasons-shard:$seasonsShardPort, space-shard:$spaceShardPort, web) on $targetDesc ..." -ForegroundColor Cyan
Invoke-DockerCompose @("up", "-d", "--remove-orphans")

Write-Host "✅ Active containers on ${targetDesc}:" -ForegroundColor Green
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

foreach ($shardProbe in @(
  @{ Name = "Watchers Shard"; Port = $watchersShardPort },
  @{ Name = "Seasons Shard"; Port = $seasonsShardPort },
  @{ Name = "Space Shard"; Port = $spaceShardPort }
)) {
  $ok = $false
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      $shardResp = Invoke-RestMethod -Uri "http://$($hostIp):$($shardProbe.Port)/api/shard/health" -TimeoutSec 5
      Write-Host "    $($shardProbe.Name) :$($shardProbe.Port)/api/shard/health: $($shardResp | ConvertTo-Json -Compress)" -ForegroundColor Green
      $ok = $true
      break
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  if (-not $ok) {
    Write-Warning "$($shardProbe.Name) :$($shardProbe.Port) probe failed after retries"
  }
}

foreach ($port in @(80, 4201)) {
  try {
    $webResp = Invoke-WebRequest -Uri "http://$($hostIp):$($port)/" -UseBasicParsing -TimeoutSec 10
    Write-Host "    Web :${port}/ status: $($webResp.StatusCode)" -ForegroundColor Green
  } catch {
    Write-Warning "Web :${port} probe failed: $_"
  }
}
