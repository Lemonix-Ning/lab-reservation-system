# 🚀 立即部署指南

> 你的域名 http://lemonix.loc.cc 已经可以访问了！  
> 现在可以开始部署完整的应用了。

---

## 📋 部署前最后检查

在服务器上执行部署前，先在本地运行检查：

```bash
pnpm deploy:check
```

这会自动检查：
- Git 状态
- 配置文件
- TypeScript 编译
- 单元测试
- 生产构建

---

## 🎯 快速部署（5 步完成）

### 1️⃣ 生成密钥

在本地执行，保存好生成的密钥：

```bash
# JWT 密钥
openssl rand -base64 64

# 数据库密码
openssl rand -base64 20
openssl rand -base64 20
```

### 2️⃣ 创建 GitHub OAuth 应用

访问：https://github.com/settings/developers

- Application name: `实验室预约系统`
- Homepage URL: `https://lemonix.loc.cc`
- Authorization callback URL: `https://lemonix.loc.cc/api/oauth/github/callback`

记录 Client ID 和 Client Secret

### 3️⃣ 连接服务器并克隆项目

```bash
ssh root@<你的ECS_IP>

# 安装 Docker（如果未安装）
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 克隆项目
cd /root
git clone <你的仓库地址> lab-reservation-system
cd lab-reservation-system
```

### 4️⃣ 配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置
nano .env
```

填写以下内容（用步骤1生成的密钥）：

```env
DB_ROOT_PASSWORD=<步骤1生成的密码1>
DB_USER=lab_user
DB_PASSWORD=<步骤1生成的密码2>
JWT_SECRET=<步骤1生成的JWT密钥>
OWNER_OPEN_ID=
GITHUB_CLIENT_ID=<步骤2的Client_ID>
GITHUB_CLIENT_SECRET=<步骤2的Client_Secret>
```

保存并退出（Ctrl+X, Y, Enter）

### 5️⃣ 执行部署

```bash
# 修改 SSL 脚本邮箱
nano init-ssl.sh
# 找到 EMAIL="" 改为 EMAIL="your-email@example.com"

# 添加执行权限
chmod +x init-ssl.sh update.sh

# 一键部署
./init-ssl.sh
```

---

## ✅ 部署完成后的验证

### 1. 检查容器状态

```bash
docker compose ps
```

应该看到 4 个容器都是 `Up` 状态：
- lab_db (MySQL)
- lab_app (应用)
- lab_nginx (Nginx)
- lab_certbot (证书管理)

### 2. 测试访问

```bash
curl -I https://lemonix.loc.cc
```

应该返回 `200 OK` 或 `301/302`

### 3. 浏览器访问

打开 https://lemonix.loc.cc，应该能看到登录页面

---

## 🔧 配置初始管理员

### 1. 首次登录

访问 https://lemonix.loc.cc，点击"GitHub 登录"

### 2. 获取 OpenID

在服务器上执行：

```bash
docker compose logs app | grep "openId\|github-"
```

找到类似这样的输出：
```
openId: github-123456789
```

### 3. 配置管理员

```bash
nano .env
```

找到 `OWNER_OPEN_ID=` 这一行，填入你的 openId：

```env
OWNER_OPEN_ID=github-123456789
```

保存后重启应用：

```bash
docker compose restart app
```

### 4. 验证权限

重新登录系统，检查：
- 左侧菜单是否显示"系统设置"、"用户管理"等管理员功能
- 右上角用户信息是否显示"系统管理员"角色

---

## 📊 初始化演示数据（可选）

如果需要演示数据：

```bash
docker compose exec app pnpm seed:demo
```

这会创建：
- 25 个测试用户（管理员、教师、学生）
- 5 个实验室
- 8 门课程
- 51 条排课记录

---

## 🎉 部署成功！

现在你可以：

1. ✅ 访问 https://lemonix.loc.cc
2. ✅ 使用 GitHub 登录
3. ✅ 测试各项功能
4. ✅ 邀请团队成员测试

---

## 📱 移动端测试

用手机访问 https://lemonix.loc.cc 测试：
- 扫码签到功能
- 位置签到功能
- 响应式布局

---

## 🔍 监控和维护

### 查看日志

```bash
# 应用日志
docker compose logs -f app

# Nginx 日志
docker compose logs -f nginx

# 所有日志
docker compose logs -f
```

### 重启服务

```bash
# 重启应用
docker compose restart app

# 重启所有服务
docker compose restart
```

### 更新代码

```bash
cd /root/lab-reservation-system
git pull
./update.sh
```

---

## ⚠️ 常见问题

### Q: 502 Bad Gateway

**A:** 应用可能启动失败，查看日志：

```bash
docker compose logs app
```

### Q: SSL 证书申请失败

**A:** 确保：
1. 域名 DNS 已生效
2. 端口 80 已放行
3. 重新运行 `./init-ssl.sh`

### Q: OAuth 登录失败

**A:** 检查：
1. GitHub OAuth 回调地址是否正确
2. Client ID 和 Secret 是否正确
3. `.env` 文件是否保存

### Q: 数据库连接失败

**A:** 检查：
1. `.env` 中的数据库密码
2. 数据库容器是否健康：`docker compose ps db`

---

## 📞 需要帮助？

如果遇到问题：

1. 查看日志：`docker compose logs -f`
2. 检查容器状态：`docker compose ps`
3. 查看详细文档：`DEPLOYMENT_GUIDE.md`

---

**祝部署顺利！🎊**
