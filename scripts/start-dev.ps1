# Lemon Actions — Quick Dev Startup Script
Write-Host "🚀 Запуск Lemon Actions в dev режиме..." -ForegroundColor Cyan

# 1. Проверяем и запускаем Docker PostgreSQL
$pgRunning = docker ps --filter "name=lemon-actions-postgres" --format "{{.Names}}"
if (-not $pgRunning) {
    Write-Host "📦 Запуск контейнера PostgreSQL (порт 5433)..." -ForegroundColor Yellow
    docker start lemon-actions-postgres | Out-Null
    Start-Sleep -Seconds 1
} else {
    Write-Host "✓ PostgreSQL активен на :5433" -ForegroundColor Green
}

# 2. Проверяем сборку зависимых пакетов
if (-not (Test-Path "packages/core-combinator/dist/index.js") -or -not (Test-Path "packages/lemon-app-registrar/dist/index.js")) {
    Write-Host "🔨 Сборка базовых пакетов (@lemon/core-combinator, @lemon/app-registrar)..." -ForegroundColor Yellow
    npm run build:core
    npm run build:registrar
} else {
    Write-Host "✓ Пакеты ядра уже собраны" -ForegroundColor Green
}

# 3. Запуск Backend API и Angular Frontend
Write-Host "⚡ Запуск серверов в фоне:" -ForegroundColor Cyan
Write-Host "   - API & Port Shield: http://localhost:3000 (Swagger/Health/Registry)" -ForegroundColor Gray
Write-Host "   - Web Frontend:      http://localhost:4201 (Lemon Actions UI)" -ForegroundColor Gray

Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "start:api"
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "start:web"

Write-Host "✨ Все сервисы запущены!" -ForegroundColor Green
