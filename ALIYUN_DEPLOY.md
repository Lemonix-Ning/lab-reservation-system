# 🚀 阿里云 ECS 部署指南

## 📋 部署信息

- **云服务商**：阿里云 ECS
- **域名**：lemonix.loc.cc
- **仓库**：https://github.com/Lemonix-Ning/lab-reservation-system.git
- **分支**：db-optimization-phase1

---

## 🔐 部署密钥（已生成）

```env
DB_ROOT_PASSWORD=wKM64EgLDXUhF9aT6nJ+
DB_PASSWORD=rSYrnNcUMBX0CRV0oydf
JWT_SECRET=UszePksFa4dzepkhYbv+uHJ+2NtIf0hphJThwHjQYqhfAtjTM2YBVDGjm+9JNw20
```

---

## 📝 部署前准备

### 1. 阿里云安全组配置

登录阿里云控制台，配置 ECS 安全组规则：

| 端口 | 协议 | 说明 |
|------|------|------|
| 22 | TCP | SSH 连接 |
| 80 | TCP | HTTP（SSL 证书验证） |
| 443 | TCP | HTTPS（网站访问） |

**操作步骤**：
1. 登录阿里云控制台
2. 进入 ECS 实例管理
3. 点击"安全组" → "配置规则"
4. 添加入方向规则，开放上述端口

### 2. 创建 GitHub OAuth 应用

1. 访问：https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - **Application name**: `实验室预约系统`
   - **Homepage URL**: `https://lemonix.loc.cc`
   - **Authorization callback URL**: `https://lemonix.loc.cc/api/oauth/github/callback`
4. 点击 "Register application"
5. 记录 **Client ID** 和生成 **Client Secret**

---

## 🚀 开始部署

### 步骤 1: SSH 连接到阿里云 ECS

```bash
ssh root@你的ECS公网IP
```

如果使用密钥登录：
```bash
ssh -i /path/to/your-key.pem root@你的ECS公网IP
```

### 步骤 2: 克隆项目

```bash
cd /root
git clone -b db-optimization-phase1 https://github.com/Lemonix-Ning/lab-reservation-system.git
cd lab-reservation-system
```

### 步骤 3: 运行自动部署脚本

```bash
bash server-deploy.sh
```

脚本会引导你完成以下操作：
1. 检查并安装 Docker
2. 创建并编辑 .env 文件
3. 配置 SSL 证书邮箱
4. 自动执行部署

---

## 📝 配置 .env 文件

当脚本提示编辑 .env 时，填写以下内容：

```env
# ============ 数据库配置 ============
DB_ROOT_PASSWORD=wKM64EgLDXUhF9aT6nJ+
DB_USER=lab_user
DB_PASSWORD=rSYrnNcUMBX0CRV0oydf

# ============ JWT 密钥 ============
JWT_SECRET=UszePksFa4dzepkhYbv+uHJ+2NtIf0hphJThwHjQYqhfAtjTM2YBVDGjm+9JNw20

# ============ 初始管理员 ============
# 首次部署留空，登录后再配置
OWNER_OPEN_ID=

# ============ GitHub OAuth ============
# 填写刚才创建的 GitHub OAuth 应用信息
GITHUB_CLIENT_ID=你的GitHub_Client_ID
GITHUB_CLIENT_SECRET=你的GitHub_Client_Secret

# ============ QQ OAuth（可选）============
QQ_APP_ID=
QQ_APP_KEY=

# ============ 讯飞星火 AI（可选）============
XFYUN_API_PASSWORD=
XFYUN_MODEL=spark-lite
```

**保存方式**：
- 按 `Ctrl + X`
- 按 `Y` 确认
- 按 `Enter` 保存

---

## ✅ 验证部署

### 1. 检查容器状态

```bash
docker compose ps
```

应该看到 4 个容器都是 `Up` 状态：
```
NAME          IMAGE                    STATUS
lab_app       lab-reservation-app      Up
lab_db        mysql:8.0                Up (healthy)
lab_nginx     nginx:1.27-alpine        Up
lab_certbot   certbot/certbot          Up
```

### 2. 查看应用日志

```bash
docker compose logs -f app
```

看到类似输出表示启动成功：
```
Server running on http://0.0.0.0:3000
Database connected successfully
```

按 `Ctrl + C` 退出日志查看

### 3. 测试 HTTPS 访问

```bash
curl -I https://lemonix.loc.cc
```

应该返回：
```
HTTP/2 200
```

### 4. 浏览器访问

打开浏览器，访问：**https://lemonix.loc.cc**

应该能看到登录页面 ✅

---

## 🔧 配置初始管理员

### 1. 首次登录

1. 访问 https://lemonix.loc.cc
2. 点击 "GitHub 登录"
3. 授权登录

### 2. 获取 OpenID

在服务器上执行：

```bash
docker compose logs app | grep "openId\|github-"
```

找到类似输出：
```
openId: github-123456789
```

### 3. 配置管理员权限

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

### 4. 验证管理员权限

重新登录系统，检查：
- ✅ 左侧菜单显示"系统设置"、"用户管理"等
- ✅ 右上角显示"系统管理员"角色

---

## 📊 初始化演示数据（可选）

如果需要测试数据：

```bash
docker compose exec app pnpm seed:demo
```

这会创建：
- 25 个测试用户
- 5 个实验室
- 8 门课程
- 51 条排课记录

---

## 📱 常用运维命令

### 查看状态
```bash
docker compose ps
```

### 查看日志
```bash
# 查看应用日志
docker compose logs -f app

# 查看所有日志
docker compose logs -f

# 查看最近 100 行
docker compose logs --tail=100 app
```

### 重启服务
```bash
# 重启应用
docker compose restart app

# 重启所有服务
docker compose restart

# 重启数据库
docker compose restart db
```

### 停止/启动服务
```bash
# 停止所有服务
docker compose down

# 启动所有服务
docker compose up -d
```

### 更新代码
```bash
cd /root/lab-reservation-system
git pull
./update.sh
```

### 查看磁盘使用
```bash
df -h
```

### 清理 Docker 资源
```bash
# 清理未使用的镜像和容器
docker system prune -a

# 查看 Docker 磁盘使用
docker system df
```

---

## ⚠️ 常见问题

### Q1: 502 Bad Gateway

**原因**：应用可能启动失败

**解决**：
```bash
# 查看应用日志
docker compose logs app

# 检查数据库是否健康
docker compose ps db

# 重启应用
docker compose restart app
```

### Q2: SSL 证书申请失败

**原因**：域名 DNS 未生效或端口未开放

**解决**：
1. 检查域名解析：`ping lemonix.loc.cc`
2. 检查安全组：确保端口 80 已开放
3. 重新申请证书：`./init-ssl.sh`

### Q3: 数据库连接失败

**原因**：数据库密码错误或容器未启动

**解决**：
```bash
# 检查数据库状态
docker compose ps db

# 查看数据库日志
docker compose logs db

# 检查 .env 中的密码是否正确
cat .env | grep DB_PASSWORD
```

### Q4: OAuth 登录失败

**原因**：GitHub OAuth 配置错误

**解决**：
1. 检查回调地址是否为：`https://lemonix.loc.cc/api/oauth/github/callback`
2. 检查 .env 中的 Client ID 和 Secret
3. 重启应用：`docker compose restart app`

### Q5: 阿里云安全组未开放端口

**解决**：
1. 登录阿里云控制台
2. ECS 实例 → 安全组 → 配置规则
3. 添加入方向规则：22, 80, 443

---

## 🎉 部署完成！

现在你可以：

1. ✅ 访问 https://lemonix.loc.cc
2. ✅ 使用 GitHub 登录
3. ✅ 管理实验室和预约
4. ✅ 邀请团队成员使用

---

## 📞 技术支持

如遇到问题：

1. 查看日志：`docker compose logs -f app`
2. 检查容器：`docker compose ps`
3. 查看文档：`START_DEPLOY.md`

**祝部署顺利！** 🎊
