#!/bin/sh
# docker-compose 的 depends_on condition: service_healthy 已确保 MySQL 就绪
set -e

echo "📦 Pushing database schema..."
pnpm drizzle-kit push
echo "✅ Schema pushed!"

echo "🌐 Starting server on port ${PORT:-3000}..."
exec node dist/index.js
