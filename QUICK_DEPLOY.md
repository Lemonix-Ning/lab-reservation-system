# 快速部署指南

> 域名：http://lemonix.loc.cc  
> 当前状态：域名已恢复，可以开始部署

---

## 部署前检查清单

### 1. 本地准备 ✅

- [x] 代码已提交到 Git
- [ ] 本地测试通过（`pnpm check` 和 `pnpm test`）
- [ ] 构建测试通过（`pnpm build`）

### 2. 服务器准备

- [ ] ECS 已启动并可 SSH 访问
- [ ] 域名 DNS 解析已配置（A 记录指向 ECS IP）
- [ ] 安全组已放行端口 22, 80, 443
- [ ] Docker 和 Docker Compose 已安装

### 3. 配置准备

- [ ] GitHub OAuth 应用已创建（生产环境）
  - Homepage URL: `https://lemonix.loc.cc`
  - Callback URL: `https://lemonix.loc.cc/api/oauth/github/callback`
- [ ] 已生成密钥（JWT_SECRET, DB_PASSWORD 等）
- [ ] 已修改 `init-ssl.sh` 中的 EMAIL 字段

---

## 快速部署步骤

### 步骤 1: 连接服务器

```bash
ssh root@<你的ECS_IP>
```

### 步骤 2: 安装 Docker（如果未安装）

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 启动 Docker
systemctl enable docker
systemctl start docker

# 验证安装
docker --version
docker compose version
```

### 步骤 3: 克隆项目

```bash
cd /root
git clone <你的仓库地址> lab-reservation-system
cd lab-reservation-system
```

### 步骤 4: 配置环境变量

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置
nano .env
```

填写以下必填项：

```env
# 数据库密码（生成命令：openssl rand -base64 20）
DB_ROOT_PASSWORD=<生成的强密码>
DB_PASSWORD=<生成的强密码>

# JWT 密钥（生成命令：openssl rand -base64 64）
JWT_SECRET=<生成的64位密钥>

# GitHub OAuth（从 GitHub 开发者设置获取）
GITHUB_CLIENT_ID=<你的Client_ID>
GITHUB_CLIENT_SECRET=<你的Client_Secret>

# 初始管理员（首次部署留空，登录后再配置）
OWNER_OPEN_ID=
```

### 步骤 5: 修改 SSL 脚本邮箱

```bash
nano init-ssl.sh
```

找到 `EMAIL=""` 这一行，改为：

```bash
EMAIL="your-email@example.com"
```

### 步骤 6: 执行部署

```bash
# 添加执行权限
chmod +x init-ssl.sh update.sh

# 执行部署（会自动申请 SSL 证书）
./init-ssl.sh
```

### 步骤 7: 验证部署

```bash
# 检查容器状态
docker compose ps

# 查看应用日志
docker compose logs -f app

# 测试访问
curl -I https://lemonix.loc.cc
```

### 步骤 8: 配置初始管理员

1. 访问 `https://lemonix.loc.cc`
2. 使用 GitHub 登录一次
3. 查看日志获取 openId：

```bash
docker compose logs app | grep "openId\|github-"
```

4. 将 openId 写入 `.env`：

```bash
nano .env
# 找到 OWNER_OPEN_ID= 这一行，填入你的 openId
# OWNER_OPEN_ID=github-123456789
```

5. 重启应用：

```bash
docker compose restart app
```

6. 重新登录，确认角色为 `sysAdmin`

### 步骤 9: 初始化演示数据（可选）

```bash
docker compose exec app pnpm seed:demo
```

---

## 部署后验证

访问以下页面确认功能正常：

- [ ] 首页：`https://lemonix.loc.cc`
- [ ] 登录：GitHub OAuth 登录正常
- [ ] 管理员功能：系统设置、用户管理等
- [ ] 学生功能：课程签到、我的预约等
- [ ] 教师功能：课程管理、课堂签到等

---

## 常见问题

### Q: SSL 证书申请失败？

**A:** 确保：
1. 域名 DNS 已生效（`nslookup lemonix.loc.cc`）
2. 端口 80 已放行
3. Nginx 已启动（`docker compose ps`）

### Q: 502 Bad Gateway？

**A:** 检查应用是否启动失败：

```bash
docker compose logs app
```

### Q: 数据库连接失败？

**A:** 检查：
1. `.env` 中的数据库密码是否正确
2. 数据库容器是否健康：`docker compose ps db`

### Q: OAuth 登录失败？

**A:** 确认：
1. GitHub OAuth 回调地址完全一致
2. Client ID 和 Secret 正确
3. 域名可访问

---

## 更新部署

后续更新代码时：

```bash
cd /root/lab-reservation-system
git pull
./update.sh
```

---

## 紧急回滚

如果部署出现问题需要回滚：

```bash
# 停止所有服务
docker compose down

# 回滚代码
git reset --hard <上一个版本的commit>

# 重新启动
docker compose up -d
```

---

## 监控和维护

### 每日检查

```bash
# 检查容器状态
docker compose ps

# 检查磁盘空间
df -h

# 检查内存使用
free -h

# 查看最近日志
docker compose logs --tail=100 app
```

### 日志管理

```bash
# 清理旧日志（Docker 会自动轮转，但可手动清理）
docker system prune -a --volumes
```

---

**部署完成后，记得在项目文档中更新线上地址！** 🎉
