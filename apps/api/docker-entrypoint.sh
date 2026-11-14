#!/bin/sh
set -e

echo "[api] Running Prisma migrations..."
npx prisma migrate deploy

if [ "${AUTO_SEED:-true}" = "true" ]; then
  PROFILE_COUNT=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.profile.count()
      .then((c) => { console.log(c); return p.\$disconnect(); })
      .catch(() => { console.log(0); process.exit(0); });
  ")
  if [ "$PROFILE_COUNT" = "0" ]; then
    echo "[api] Empty database detected — running initial seed..."
    node dist-seed/prisma/seed.js
  else
    echo "[api] Database already initialized ($PROFILE_COUNT profiles) — skipping seed."
  fi
fi

echo "[api] Starting NestJS Core Combinator API on :${PORT:-3000}..."
exec node dist/main
