# 部署指南

> 域名：https://lemonix.loc.cc  
> 服务器：阿里云 ECS（IP: 8.218.143.37）  
> 分支：`db-optimization-phase1`

---

## 首次部署

### 1. 服务器准备

SSH 连接服务器，安装 Docker：

```bash
ssh root@8.218.143.37
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

### 2. 克隆项目

```bash
cd /root
git clone -b db-optimization-phase1 https://github.com/Lemonix-Ning/lab-reservation-system.git
cd lab-reservation-system
```

### 3. 配置环境变量

```bash
cp .env.example .env
nano .env
```

填写以下内容：

```env
DB_ROOT_PASSWORD=wKM64EgLDXUhF9aT6nJ+
DB_USER=lab_user
DB_PASSWORD=rSYrnNcUMBX0CRV0oydf
JWT_SECRET=UszePksFa4dzepkhYbv+uHJ+2NtIf0hphJThwHjQYqhfAtjTM2YBVDGjm+9JNw20
OWNER_OPEN_ID=
GITHUB_CLIENT_ID=Ov23li1r0US2YHjsykMr
GITHUB_CLIENT_SECRET=efedb67397764bf611b5c28c17625046e50d8047
QQ_APP_ID=
QQ_APP_KEY=
XFYUN_API_PASSWORD=
XFYUN_MODEL=spark-lite
ENABLE_DEMO_LOGIN=true
```

### 4. 配置 SSL 邮箱

```bash
nano init-ssl.sh
# 找到 EMAIL="" 改为 EMAIL="3428476178@qq.com"
```

### 5. 执行部署

```bash
chmod +x init-ssl.sh update.sh
./init-ssl.sh
```

脚本自动完成：启动 MySQL → 申请 SSL 证书 → 启动所有容器。约 5-10 分钟。

### 6. 配置初始管理员

首次用 GitHub 登录后，获取 openId：

```bash
docker compose logs app | grep "openId\|github-"
```

写入 `.env` 并重启：

```bash
nano .env   # 填写 OWNER_OPEN_ID=github-xxxxxxx
docker compose restart app
```

### 7. 初始化演示数据

```bash
docker compose exec app pnpm seed:demo
```

---

## 更新部署（日常）

本地提交并推送后，在服务器执行：

```bash
cd /root/lab-reservation-system
git pull
./update.sh
```

`update.sh` 会重新构建镜像并重启 app 容器，约 3-5 分钟。

---

## 验证

```bash
docker compose ps          # 4 个容器均为 Up
curl -I https://lemonix.loc.cc   # 返回 200
```

---

## 常用运维命令

```bash
docker compose logs -f app       # 实时日志
docker compose restart app       # 重启应用
docker compose ps                # 查看状态
docker compose down              # 停止所有服务
docker compose up -d             # 启动所有服务
docker compose exec app bash     # 进入容器
```

---

## 故障排查

| 问题 | 处理 |
|------|------|
| 502 Bad Gateway | `docker compose logs app` 查看启动错误 |
| SSL 申请失败 | 确认端口 80 已放行，重跑 `./init-ssl.sh` |
| 数据库连接失败 | 检查 `.env` 密码，查看 `docker compose logs db` |
| OAuth 登录失败 | 确认 GitHub 回调地址为 `https://lemonix.loc.cc/api/oauth/github/callback` |
| 登录仍是 student | 检查 `OWNER_OPEN_ID` 是否正确，重启 app |
| 域名 suspended | 保证 `http://lemonix.loc.cc` 返回 200，等待健康检查恢复 |

---

## GitHub OAuth 配置

应用地址：https://github.com/settings/developers

- Homepage URL: `https://lemonix.loc.cc`
- Callback URL: `https://lemonix.loc.cc/api/oauth/github/callback`
- Client ID: `Ov23li1r0US2YHjsykMr`

---

## 演示登录

在 `.env` 中设置 `ENABLE_DEMO_LOGIN=true` 后重启，登录页会出现演示账号快速登录区域。

演示账号来自 `pnpm seed:demo`，包含：系统管理员、实验室管理员、教师、学生各一个。

关闭演示登录：将 `ENABLE_DEMO_LOGIN` 改为 `false` 并重启。
