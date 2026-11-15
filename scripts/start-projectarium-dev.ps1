# Lemon Projectarium — Local Hot-Reload Dev Environment Startup Script
$ErrorActionPreference = "Stop"

Write-Host "🚀 Запуск локального dev-окружения Lemon Projectarium (hot reload)..." -ForegroundColor Cyan

# 1. Проверяем и запускаем локальный PostgreSQL (:5433)
$pgRunning = docker ps --filter "name=lemon-actions-postgres" --format "{{.Names}}"
if (-not $pgRunning) {
  Write-Host "📦 Запуск локального PostgreSQL (lemon-actions-postgres на :5433)..." -ForegroundColor Yellow
  docker start lemon-actions-postgres | Out-Null
  Start-Sleep -Seconds 2
} else {
  Write-Host "✓ PostgreSQL активен на localhost:5433" -ForegroundColor Green
}

# 2. Собираем workspace-пакеты (если dist отсутствует или устарел)
Write-Host "🔨 Сборка @lemon/projectarium и зависимых пакетов..." -ForegroundColor Yellow
npm run build:core
npm run build:projectarium

# 3. Применяем Prisma-миграции к локальной БД
Write-Host "🗄 Применение Prisma-миграций..." -ForegroundColor Yellow
npm run --workspace=apps/api prisma:migrate

# 4. Запуск NestJS API (--watch) и Angular Projectarium Shell (ng serve HMR)
Write-Host "⚡ Запуск dev-серверов с hot reload:" -ForegroundColor Cyan
Write-Host "   - API (--watch):       http://localhost:3000/api/health" -ForegroundColor Gray
Write-Host "   - Projectarium UI:     http://localhost:4203/projectarium" -ForegroundColor Gray

Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "start:api"
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "start:projectarium"

Write-Host "✨ Локальный Projectarium dev-стенд запущен!" -ForegroundColor Green
