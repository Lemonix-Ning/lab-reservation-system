#!/bin/bash
# ============================================================
# 服务器端快速部署脚本
# 在服务器上运行此脚本可自动完成大部分配置
# ============================================================

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          实验室预约系统 - 服务器端部署脚本                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
  echo "❌ 请使用 root 用户运行此脚本"
  echo "   使用命令: sudo bash server-deploy.sh"
  exit 1
fi

# 1. 检查 Docker 是否安装
echo "📦 步骤 1/7: 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo "   Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "   ✅ Docker 安装完成"
else
    echo "   ✅ Docker 已安装"
fi

# 2. 检查 .env 文件
echo ""
echo "📝 步骤 2/7: 检查配置文件..."
if [ ! -f .env ]; then
    echo "   ⚠️  .env 文件不存在，从模板创建..."
    cp .env.example .env
    echo "   ✅ 已创建 .env 文件"
    echo ""
    echo "   ⚠️  重要：请编辑 .env 文件填写以下信息："
    echo "      - DB_ROOT_PASSWORD（数据库 root 密码）"
    echo "      - DB_PASSWORD（应用数据库密码）"
    echo "      - JWT_SECRET（JWT 密钥）"
    echo "      - GITHUB_CLIENT_ID（GitHub OAuth Client ID）"
    echo "      - GITHUB_CLIENT_SECRET（GitHub OAuth Client Secret）"
    echo ""
    read -p "   按回车键继续编辑 .env 文件..." 
    nano .env
else
    echo "   ✅ .env 文件已存在"
fi

# 3. 检查 init-ssl.sh 中的邮箱配置
echo ""
echo "📧 步骤 3/7: 检查 SSL 证书邮箱配置..."
if grep -q 'EMAIL=""' init-ssl.sh; then
    echo "   ⚠️  init-ssl.sh 中未配置邮箱"
    echo ""
    read -p "   请输入你的邮箱地址（用于 SSL 证书通知）: " email
    sed -i "s/EMAIL=\"\"/EMAIL=\"$email\"/" init-ssl.sh
    echo "   ✅ 邮箱配置完成: $email"
else
    echo "   ✅ 邮箱已配置"
fi

# 4. 添加执行权限
echo ""
echo "🔐 步骤 4/7: 设置脚本执行权限..."
chmod +x init-ssl.sh update.sh
echo "   ✅ 权限设置完成"

# 5. 验证配置
echo ""
echo "🔍 步骤 5/7: 验证配置..."
missing_vars=()

check_env_var() {
    if ! grep -q "^$1=.\+" .env; then
        missing_vars+=("$1")
    fi
}

check_env_var "DB_ROOT_PASSWORD"
check_env_var "DB_PASSWORD"
check_env_var "JWT_SECRET"
check_env_var "GITHUB_CLIENT_ID"
check_env_var "GITHUB_CLIENT_SECRET"

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "   ⚠️  以下环境变量未配置："
    for var in "${missing_vars[@]}"; do
        echo "      - $var"
    done
    echo ""
    read -p "   是否继续部署？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   ❌ 部署已取消"
        exit 1
    fi
else
    echo "   ✅ 所有必需的环境变量已配置"
fi

# 6. 执行部署
echo ""
echo "🚀 步骤 6/7: 开始部署..."
echo "   这可能需要 5-10 分钟，请耐心等待..."
echo ""

./init-ssl.sh

# 7. 验证部署
echo ""
echo "✅ 步骤 7/7: 验证部署..."
sleep 5

if docker compose ps | grep -q "Up"; then
    echo "   ✅ 容器启动成功"
    echo ""
    docker compose ps
else
    echo "   ⚠️  部分容器可能未正常启动"
    echo "   请运行以下命令查看日志："
    echo "   docker compose logs -f"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    🎉 部署完成！                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 下一步操作："
echo ""
echo "1. 访问 https://lemonix.loc.cc"
echo "2. 使用 GitHub 登录"
echo "3. 查看日志获取 openId："
echo "   docker compose logs app | grep 'openId\\|github-'"
echo "4. 配置管理员："
echo "   nano .env  # 填写 OWNER_OPEN_ID"
echo "   docker compose restart app"
echo ""
echo "📚 常用命令："
echo "   查看状态: docker compose ps"
echo "   查看日志: docker compose logs -f app"
echo "   重启应用: docker compose restart app"
echo ""
