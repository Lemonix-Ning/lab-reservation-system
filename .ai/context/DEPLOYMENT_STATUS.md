# 部署状态总结

## 当前状态

✅ 项目已准备好部署到生产环境  
🌐 域名：http://lemonix.loc.cc（已恢复可访问）  
📅 更新时间：2026-03-16

---

## 已完成的准备工作

### 1. 代码功能 ✅

所有核心功能已实现并测试：
- ✅ 节次时间配置（CRUD API）
- ✅ 课程学生列表自动刷新
- ✅ 签到历史周次自动计算
- ✅ 签到会话创建（SQL 语法修复）
- ✅ 学生签到可见性（查询优化）
- ✅ 签到方式优化（6位数字签到码 + 手动输入）

### 2. 部署文档 ✅

已创建完整的部署指南：
- ✅ `DEPLOY_NOW.md` - 5步快速部署指南
- ✅ `QUICK_DEPLOY.md` - 详细部署说明
- ✅ `DEPLOYMENT_GUIDE.md` - 完整部署文档
- ✅ `.ai/context/DEPLOYMENT_CHECKLIST.md` - 检查清单

### 3. 部署脚本 ✅

- ✅ `init-ssl.sh` - SSL证书初始化（Let's Encrypt）
- ✅ `update.sh` - 代码更新脚本
- ✅ `scripts/pre-deploy-check.ts` - 部署前检查
- ✅ `docker-compose.yml` - Docker编排配置
- ✅ `Dockerfile` - 应用容器配置

### 4. 配置文件 ✅

- ✅ `.env.example` - 环境变量模板
- ✅ `nginx/conf.d/app.conf` - HTTP配置
- ✅ `nginx/conf.d/app.ssl.conf.template` - HTTPS配置模板

---

## 部署前检查命令

在本地运行以下命令验证准备情况：

```bash
pnpm deploy:check
```

这会自动检查：
- Git 状态（是否有未提交的更改）
- 配置文件完整性
- TypeScript 类型检查
- 单元测试
- 生产构建

---

## 快速部署步骤（5步）

### 1️⃣ 生成密钥

```bash
# JWT 密钥
openssl rand -base64 64

# 数据库密码（生成2个）
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

填写必填项：
- `DB_ROOT_PASSWORD` - 步骤1生成的密码1
- `DB_PASSWORD` - 步骤1生成的密码2
- `JWT_SECRET` - 步骤1生成的JWT密钥
- `GITHUB_CLIENT_ID` - 步骤2的Client ID
- `GITHUB_CLIENT_SECRET` - 步骤2的Client Secret
- `OWNER_OPEN_ID` - 首次部署留空，登录后再配置

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

## 部署后配置

### 1. 配置初始管理员

首次登录后，在服务器上执行：

```bash
# 查看日志获取 openId
docker compose logs app | grep "openId\|github-"

# 编辑 .env 文件
nano .env
# 找到 OWNER_OPEN_ID= 这一行，填入你的 openId

# 重启应用
docker compose restart app
```

### 2. 初始化演示数据（可选）

```bash
docker compose exec app pnpm seed:demo
```

---

## 验证部署

### 检查容器状态

```bash
docker compose ps
```

应该看到 4 个容器都是 `Up` 状态：
- lab_db (MySQL)
- lab_app (应用)
- lab_nginx (Nginx)
- lab_certbot (证书管理)

### 测试访问

```bash
curl -I https://lemonix.loc.cc
```

应该返回 `200 OK` 或 `301/302`

### 浏览器访问

打开 https://lemonix.loc.cc，应该能看到登录页面

---

## 监控和维护

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

## 常见问题

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

## 下一步

用户需要在服务器上执行部署操作。建议按照 `DEPLOY_NOW.md` 中的5步指南进行。

部署完成后，系统将在 https://lemonix.loc.cc 上线运行。
