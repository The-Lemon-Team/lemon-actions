param(
    [string]$DockerContext = "lemon-remote",
    [string]$DockerHost = "",
    [string]$TargetHost = "192.168.1.100",
    [string]$ProjectName = "lemon-projectarium",
    [string]$ComposeFile = "docker-compose.projectarium.yml",
    [string]$BuildConfig = "projectarium-production",
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

$targetHost = if ($DockerHost) { ($DockerHost -replace "^tcp://", "" -replace ":\d+$", "") } else { $TargetHost }
if ($env:NO_PROXY -notmatch [regex]::Escape($targetHost)) {
    $env:NO_PROXY = if ($env:NO_PROXY) { "$($env:NO_PROXY),$targetHost" } else { $targetHost }
}
$env:no_proxy = $env:NO_PROXY
if ($DockerHost) {
    $env:DOCKER_HOST = $DockerHost
} else {
    Remove-Item Env:DOCKER_HOST -ErrorAction SilentlyContinue
}
$env:WEB_BUILD_CONFIG = $BuildConfig
$targetDesc = if ($DockerHost) { $DockerHost } else { "context:$DockerContext ($targetHost)" }
$dockerPrefix = if ($DockerHost) { @() } else { @("--context", $DockerContext) }

Write-Host "==> Deploying $ProjectName ($BuildConfig) to $targetDesc ..." -ForegroundColor Cyan

$composeArgs = $dockerPrefix + @("compose", "-p", $ProjectName, "-f", $ComposeFile, "up", "-d", "--build")
if ($NoCache) {
    $buildArgs = $dockerPrefix + @("compose", "-p", $ProjectName, "-f", $ComposeFile, "build", "--no-cache")
    & docker @buildArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $composeArgs = $dockerPrefix + @("compose", "-p", $ProjectName, "-f", $ComposeFile, "up", "-d")
}

& docker @composeArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Container status:" -ForegroundColor Green
$psArgs = $dockerPrefix + @("compose", "-p", $ProjectName, "-f", $ComposeFile, "ps")
& docker @psArgs

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
