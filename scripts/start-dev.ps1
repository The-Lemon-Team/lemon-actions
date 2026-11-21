# Lemon Actions — Quick Dev Startup Script
Write-Host "🚀 Запуск Lemon Actions в dev режиме..." -ForegroundColor Cyan

# 1. Проверяем и запускаем Docker PostgreSQL
$pgRunning = docker ps --filter "name=lemon-core-postgres" --filter "name=lemon-actions-postgres" --format "{{.Names}}"
if (-not $pgRunning) {
    Write-Host "📦 Запуск контейнера PostgreSQL (порт 5432)..." -ForegroundColor Yellow
    docker start lemon-core-postgres 2>$null | Out-Null
    Start-Sleep -Seconds 2
} else {
    Write-Host "✓ PostgreSQL активен ($pgRunning)" -ForegroundColor Green
}

# 2. Если контейнеры production api / web запущены в Docker, останавливаем их для освобождения dev-портов (:3000, :4201)
$prodRunning = docker ps --filter "name=lemon-core-api" --filter "name=lemon-core-web" --format "{{.Names}}"
if ($prodRunning) {
    Write-Host "🛑 Остановка Docker-контейнеров ($prodRunning) для освобождения dev-портов..." -ForegroundColor Yellow
    docker stop lemon-core-api lemon-core-web | Out-Null
}

# 3. Проверяем сборку зависимых пакетов
if (-not (Test-Path "packages/core-combinator/dist/index.js") -or -not (Test-Path "packages/lemon-projectarium/dist/index.js") -or -not (Test-Path "packages/lemon-seasons-neurons/dist/index.js")) {
    Write-Host "🔨 Сборка базовых пакетов..." -ForegroundColor Yellow
    npm.cmd run build:core
    npm.cmd run build:projectarium
    npm.cmd run build:neurons
} else {
    Write-Host "✓ Базовые пакеты ядра собраны" -ForegroundColor Green
}

# 4. Запуск Backend API и Angular Frontend
Write-Host "⚡ Запуск серверов в фоне:" -ForegroundColor Cyan
Write-Host "   - API & Port Shield: http://localhost:3000 (Swagger/Health/Projectarium)" -ForegroundColor Gray
Write-Host "   - Web Frontend:      http://localhost:4201 (Lemon Actions UI)" -ForegroundColor Gray

Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start:api"
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start:web"

Write-Host "✨ Все сервисы запущены!" -ForegroundColor Green
