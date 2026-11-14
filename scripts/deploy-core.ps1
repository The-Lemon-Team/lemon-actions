param(
  [string]$DockerHost = "tcp://192.168.1.100:2375",
  [string]$BuildConfig = "core-production"
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

Write-Host "🚀 Building Core Combinator API image on $DockerHost ..." -ForegroundColor Cyan
Invoke-DockerCompose @("build", "api")

Write-Host "🌐 Building Core Console App Shell ($BuildConfig) image on $DockerHost ..." -ForegroundColor Cyan
Invoke-DockerCompose @("build", "web")

Write-Host "📦 Starting Core Combinator stack (postgres, api, web) on $DockerHost ..." -ForegroundColor Cyan
Invoke-DockerCompose @("up", "-d", "--remove-orphans")

Write-Host "✅ Active containers on ${DockerHost}:" -ForegroundColor Green
Invoke-DockerCompose @("ps")
