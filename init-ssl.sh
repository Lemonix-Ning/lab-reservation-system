#!/bin/bash
# =============================================================
# init-ssl.sh — 首次部署：申请 Let's Encrypt SSL 证书
# 服务器上只需运行一次！之后证书自动续期
# =============================================================
set -e

DOMAIN="lemonix.loc.cc"
EMAIL=""   # ← 必填：你的真实邮箱（Let's Encrypt 证书到期提醒）
if [ -z "$EMAIL" ]; then
  echo "❌ 错误: 请先在 init-ssl.sh 中填写 EMAIL"
  exit 1
fi

echo "======================================================"
echo "  实验室预约系统 - SSL 证书初始化"
echo "  域名: $DOMAIN"
echo "======================================================"

# 确保 .env 存在
if [ ! -f .env ]; then
  echo "❌ 错误: .env 文件不存在"
  echo "   请先执行: cp .env.example .env 并填写配置"
  exit 1
fi

# 创建必要目录
mkdir -p certbot/www certbot/conf

echo ""
echo "📦 步骤 1/4: 启动 MySQL 数据库..."
docker compose up -d db
echo "   等待数据库健康检查通过..."
docker compose wait db 2>/dev/null || sleep 20

echo ""
echo "🌐 步骤 2/4: 以 HTTP 模式启动 Nginx（用于证书验证）..."
# 确保使用 HTTP-only 配置（app.conf，非 SSL）
docker compose up -d nginx
sleep 3

echo ""
echo "🔐 步骤 3/4: 申请 Let's Encrypt SSL 证书..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo ""
echo "⚙️  步骤 4/4: 切换到 HTTPS 模式..."
# 激活 SSL 配置（替换 HTTP-only 的 app.conf）
cp nginx/conf.d/app.ssl.conf.template nginx/conf.d/app.conf
docker compose exec nginx nginx -s reload

echo ""
echo "🚀 步骤 5/5: 启动应用和证书续期服务..."
docker compose up -d

echo ""
echo "======================================================"
echo "✅ 部署完成！"
echo ""
echo "   访问地址: https://$DOMAIN"
echo ""
echo "⚠️  记得在 GitHub OAuth 应用中更新回调地址："
echo "   https://github.com/settings/developers"
echo "   Authorization callback URL:"
echo "   https://$DOMAIN/api/oauth/github/callback"
echo "======================================================"
