# 🚀 开始部署 - 实验室预约系统

## 📋 准备好的信息

### 1. 生成的密钥（已生成）

```env
DB_ROOT_PASSWORD=6T7EBgrbdCUXB7TPwYKg
DB_PASSWORD=J1SV/+4PAMLMErFHnVeA
JWT_SECRET=Ttrc7p++znOTC1nv/n5eD2D8CK07y/8wkEyJEDkdri+BuT2NDR8Hbzz9RQO0pqC5
```

### 2. 域名信息

- 域名：`lemonix.loc.cc`
- 状态：✅ 已恢复可访问

---

## 🎯 部署步骤

### 步骤 1: 创建 GitHub OAuth 应用

1. 访问：https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - Application name: `实验室预约系统`
   - Homepage URL: `https://lemonix.loc.cc`
   - Authorization callback URL: `https://lemonix.loc.cc/api/oauth/github/callback`
4. 点击 "Register application"
5. 记录 **Client ID** 和生成 **Client Secret**

### 步骤 2: 连接服务器

```bash
ssh root@<你的ECS服务器IP>
```

### 步骤 3: 安装 Docker（如果未安装）

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

### 步骤 4: 克隆项目

```bash
cd /root
git clone <你的Git仓库地址> lab-reservation-system
cd lab-reservation-system
```


### 步骤 5: 配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置文件
nano .env
```

**填写以下内容：**

```env
# 数据库配置（使用上面生成的密钥）
DB_ROOT_PASSWORD=6T7EBgrbdCUXB7TPwYKg
DB_USER=lab_user
DB_PASSWORD=J1SV/+4PAMLMErFHnVeA

# JWT 密钥（使用上面生成的密钥）
JWT_SECRET=Ttrc7p++znOTC1nv/n5eD2D8CK07y/8wkEyJEDkdri+BuT2NDR8Hbzz9RQO0pqC5

# 初始管理员（首次部署留空，登录后再配置）
OWNER_OPEN_ID=

# GitHub OAuth（填写步骤1创建的应用信息）
GITHUB_CLIENT_ID=<你的GitHub_Client_ID>
GITHUB_CLIENT_SECRET=<你的GitHub_Client_Secret>

# QQ OAuth（可选，暂时留空）
QQ_APP_ID=
QQ_APP_KEY=

# 讯飞星火 AI（可选，暂时留空）
XFYUN_API_PASSWORD=
XFYUN_MODEL=spark-lite
```

保存并退出（Ctrl+X, Y, Enter）

### 步骤 6: 配置 SSL 证书邮箱

```bash
# 编辑 SSL 脚本
nano init-ssl.sh
```

找到第 9 行：
```bash
EMAIL=""   # ← 必填
```

改为你的真实邮箱：
```bash
EMAIL="your-email@example.com"   # ← 填写你的邮箱
```

保存并退出（Ctrl+X, Y, Enter）

### 步骤 7: 执行部署

```bash
# 添加执行权限
chmod +x init-ssl.sh update.sh

# 一键部署（会自动申请 SSL 证书）
./init-ssl.sh
```

部署过程大约需要 5-10 分钟，请耐心等待。

---

## ✅ 验证部署

### 1. 检查容器状态

```bash
docker compose ps
```

应该看到 4 个容器都是 `Up` 状态：
- lab_db (MySQL)
- lab_app (应用)
- lab_nginx (Nginx)
- lab_certbot (证书管理)

### 2. 查看应用日志

```bash
docker compose logs -f app
```

按 Ctrl+C 退出日志查看

### 3. 测试访问

```bash
curl -I https://lemonix.loc.cc
```

应该返回 `200 OK` 或 `301/302`

### 4. 浏览器访问

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

如果需要演示数据进行测试：

```bash
docker compose exec app pnpm seed:demo
```

这会创建：
- 25 个测试用户（管理员、教师、学生）
- 5 个实验室
- 8 门课程
- 51 条排课记录

---

## 🎉 部署完成！

现在你可以：

1. ✅ 访问 https://lemonix.loc.cc
2. ✅ 使用 GitHub 登录
3. ✅ 测试各项功能
4. ✅ 邀请团队成员测试

---

## 📱 常用命令

```bash
# 查看所有容器状态
docker compose ps

# 查看应用日志
docker compose logs -f app

# 重启应用
docker compose restart app

# 重启所有服务
docker compose restart

# 停止所有服务
docker compose down

# 启动所有服务
docker compose up -d

# 更新代码
git pull
./update.sh
```

---

## ⚠️ 常见问题

### Q: 502 Bad Gateway
**A:** 应用可能启动失败，查看日志：`docker compose logs app`

### Q: SSL 证书申请失败
**A:** 确保域名 DNS 已生效，端口 80 已放行，重新运行 `./init-ssl.sh`

### Q: OAuth 登录失败
**A:** 检查 GitHub OAuth 回调地址、Client ID 和 Secret 是否正确

### Q: 数据库连接失败
**A:** 检查 .env 中的数据库密码，查看数据库容器状态：`docker compose ps db`

---

**祝部署顺利！如有问题，请查看日志或联系技术支持。** 🎊
