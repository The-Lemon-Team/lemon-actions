param(
    [string]$DockerHost = "tcp://192.168.1.100:2375",
    [string]$ProjectName = "lemon-projectarium",
    [string]$ComposeFile = "docker-compose.projectarium.yml",
    [string]$BuildConfig = "projectarium-production",
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

$targetHost = ($DockerHost -replace "^tcp://", "" -replace ":\d+$", "")
if ($env:NO_PROXY -notmatch [regex]::Escape($targetHost)) {
    $env:NO_PROXY = if ($env:NO_PROXY) { "$($env:NO_PROXY),$targetHost" } else { $targetHost }
}
$env:no_proxy = $env:NO_PROXY
$env:DOCKER_HOST = $DockerHost
$env:WEB_BUILD_CONFIG = $BuildConfig

Write-Host "==> Deploying $ProjectName ($BuildConfig) to $DockerHost ..." -ForegroundColor Cyan

$composeArgs = @("compose", "-p", $ProjectName, "-f", $ComposeFile, "up", "-d", "--build")
if ($NoCache) {
    $composeArgs = @("compose", "-p", $ProjectName, "-f", $ComposeFile, "build", "--no-cache")
    & docker @composeArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $composeArgs = @("compose", "-p", $ProjectName, "-f", $ComposeFile, "up", "-d")
}

& docker @composeArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Container status:" -ForegroundColor Green
& docker compose -p $ProjectName -f $ComposeFile ps

$apiPort = if ($env:API_PORT) { $env:API_PORT } else { "3200" }
$webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { "8088" }

Write-Host "==> Verifying HTTP endpoints on $targetHost ..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://$($targetHost):$($apiPort)/api/health" -TimeoutSec 10
    Write-Host "    API /api/health: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Warning "API health probe failed: $_"
}

try {
    $webResp = Invoke-WebRequest -Uri "http://$($targetHost):$($webPort)/" -UseBasicParsing -TimeoutSec 10
    Write-Host "    Web / status: $($webResp.StatusCode)" -ForegroundColor Green
} catch {
    Write-Warning "Web probe failed: $_"
}
