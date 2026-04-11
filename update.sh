#!/bin/bash
# =============================================================
# update.sh — 更新代码后重新部署（非首次）
# =============================================================
set -e

echo "🔄 更新部署中..."

echo "📦 重新构建镜像..."
docker compose build app

echo "🚀 重启应用（零停机切换）..."
docker compose up -d --no-deps app

echo "✅ 更新完成！"
echo "   查看日志: docker compose logs -f app"
