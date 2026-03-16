# 详细上线操作文档

> 域名：lemonix.loc.cc  
> 服务器方案：阿里云 ECS 2核4G（经济型 e）+ Ubuntu 22.04  
> 上线目标：保证评审期间可稳定访问，避免免费时长不足导致停机

---

## 0. 你当前应采用的策略（方案 2）

因为 2核4G 的免费可用时长约 1181 小时，而从现在到 5/6 总时长更长，所以采用：

1. 现在先做域名恢复和部署准备，不长期运行 ECS。
2. 先进入“测试期”，验证功能和稳定性，不对外正式发布。
3. 正式演示窗口开始前再持续开机并切正式环境。
4. 预留少量付费余额（建议 50 元）兜底，避免评审期因欠费不可访问。

---

## 1. 今天立即执行：恢复 loc.cc 域名状态（最高优先级）

`loc.cc` 会检查根域 HTTP 可访问性。你必须保证 `http://lemonix.loc.cc` 能访问。

### 1-1. 阿里云安全组放行端口

在 ECS 安全组入方向放行：

1. TCP 22（SSH）
2. TCP 80（HTTP）
3. TCP 443（HTTPS）

### 1-2. 添加 DNS 解析

在域名解析平台添加 A 记录：

1. 主机记录：`lemonix`
2. 记录类型：`A`
3. 记录值：`<ECS 公网 IP>`
4. TTL：10 分钟（或默认）

### 1-3. 先提供一个 HTTP 可访问页面（救域名）

SSH 进服务器后执行：

```bash
ssh root@<ECS_IP>
apt update
apt install -y nginx
echo "lemonix.loc.cc alive" > /var/www/html/index.html
systemctl enable --now nginx
```

### 1-4. 立刻验证

在本地执行：

```bash
nslookup lemonix.loc.cc
curl -I http://lemonix.loc.cc
```

通过标准：

1. `nslookup` 返回你的 ECS IP
2. `curl -I` 返回 `200` 或 `301`

> 若域名仍 suspended，通常等下一轮健康检查会自动恢复；24 小时未恢复再提工单并附上上面两条验证结果。

---

## 2. 本周内完成：上线前准备（不要求长期开机）

### 2-1. 创建 GitHub OAuth 生产应用

1. 打开：<https://github.com/settings/developers>
2. 新建 OAuth App：
   - Application name: `实验室预约系统`
   - Homepage URL: `https://lemonix.loc.cc`
   - Authorization callback URL: `https://lemonix.loc.cc/api/oauth/github/callback`
3. 记录：`Client ID` 和 `Client Secret`

### 2-2. 修改脚本邮箱

编辑 `init-ssl.sh`：

```bash
nano init-ssl.sh
```

把 `EMAIL=""` 改成你的真实邮箱。

### 2-3. 生成并保存密钥

```bash
openssl rand -base64 64   # JWT_SECRET
openssl rand -base64 20   # DB_ROOT_PASSWORD
openssl rand -base64 20   # DB_PASSWORD
```

### 2-4. 提交代码

```bash
git add .
git commit -m "docs: finalize production deployment playbook"
git push
```

---

## 3. 测试期（当前阶段，不正式上线）

目标：先完成功能验证和演示彩排，域名保持可访问但不暴露正式业务数据。

### 3-1. 测试期建议策略

1. 仅保留静态占位页或测试环境页面（当前 `lemonix.loc.cc alive (hk)` 即可）。
2. 不执行生产数据初始化（先不跑 `pnpm seed:demo`）。
3. 不配置 `OWNER_OPEN_ID`（避免误设正式管理员）。
4. 先完成 OAuth 配置和本地/容器测试，再切正式上线。

### 3-2. 测试清单（建议全部打勾后再上线）

- [ ] `pnpm check` 通过
- [ ] `pnpm test` 通过
- [ ] 核心页面手动冒烟测试通过（登录、预约、课程、管理）
- [ ] Docker 本地构建通过（`pnpm build`）
- [ ] `.env` 生产变量已准备完毕（但未启用）
- [ ] GitHub OAuth 生产应用已创建
- [ ] 回调地址已核对：`https://lemonix.loc.cc/api/oauth/github/callback`

### 3-3. 测试期每日操作（简版）

```bash
# 仅保持域名健康（HTTP 可访问）
curl -I http://lemonix.loc.cc

# 项目测试（本地或测试机）
pnpm check
pnpm test
```

### 3-4. 何时切到正式上线

满足以下条件再进入下一阶段：

1. 上述测试清单全部完成
2. 比赛提交通道已确认
3. 评审时间窗口已确定
4. 团队确认可连续运行服务器

---

## 4. 正式上线日（建议在评审前 5-7 天启动持续运行）

## 4-1. 初始化服务器

```bash
ssh root@<ECS_IP>
apt update && apt upgrade -y
systemctl enable docker
git clone <repo-url> lab-reservation-system
cd lab-reservation-system
```

## 4-2. 配置生产环境变量

```bash
cp .env.example .env
nano .env
```

填写以下字段（首次部署时 `OWNER_OPEN_ID` 先留空）：

```env
DB_ROOT_PASSWORD=<你生成的强密码>
DB_USER=lab_user
DB_PASSWORD=<你生成的强密码>
JWT_SECRET=<你生成的 64 位随机串>
OWNER_OPEN_ID=
GITHUB_CLIENT_ID=<生产 Client ID>
GITHUB_CLIENT_SECRET=<生产 Client Secret>
QQ_APP_ID=
QQ_APP_KEY=
XFYUN_API_PASSWORD=
XFYUN_MODEL=spark-lite
```

## 4-3. 一键部署

```bash
chmod +x init-ssl.sh update.sh
./init-ssl.sh
```

脚本会自动执行：

1. 启动 MySQL
2. 启动 Nginx（HTTP）
3. 申请 Let's Encrypt 证书
4. 切换 HTTPS
5. 启动 app/nginx/certbot 全部服务

## 4-4. 首次管理员设置（OWNER_OPEN_ID）

1. 用 GitHub 登录一次系统
2. 查 openId：

```bash
docker compose logs app | grep "upsert\|openId\|github-"
```

3. 写入 `.env` 并重启：

```bash
nano .env
# OWNER_OPEN_ID=github-xxxxxxx
docker compose restart app
```

4. 重新登录，确认已是 `sysAdmin`

## 4-5. 初始化演示数据

```bash
docker compose exec app pnpm seed:demo
```

---

## 5. 评审期间每日巡检（建议每天 2 次）

```bash
docker compose ps
docker compose logs --tail=80 app
docker compose logs --tail=80 nginx
curl -I https://lemonix.loc.cc
```

检查点：

1. `app`, `db`, `nginx`, `certbot` 均为 `Up`
2. HTTPS 可访问（200/301）
3. 登录正常、关键页面可打开

---

## 6. 更新发布流程

```bash
git pull
./update.sh
docker compose ps
```

---

## 7. 常用运维命令

| 命令 | 用途 |
|:---|:---|
| `docker compose ps` | 查看容器状态 |
| `docker compose logs -f app` | 实时看应用日志 |
| `docker compose logs -f nginx` | 实时看网关日志 |
| `docker compose restart app` | 只重启应用容器 |
| `docker compose exec app bash` | 进入应用容器 |
| `docker compose exec db mysql -u root -p` | 进入数据库 |
| `docker compose down` | 停止服务 |
| `docker compose up -d` | 启动服务 |

---

## 8. 故障应急

| 问题 | 处理步骤 |
|:---|:---|
| SSL 申请失败 | 先确认 A 记录生效，再重跑 `./init-ssl.sh` |
| 502 Bad Gateway | `docker compose logs app` 检查 app 是否启动失败 |
| 数据库连接失败 | 检查 `.env` 密码，查看 `docker compose logs db` |
| OAuth 登录失败 | 检查 GitHub Callback URL 是否完全一致 |
| 登录仍是 student | 检查 `OWNER_OPEN_ID` 是否准确并重启 app |
| 域名再次 suspended | 先保证 `http://lemonix.loc.cc` 返回 200/301，等待健康检查恢复 |

---

## 9. 上线前最终检查清单

- [ ] `lemonix.loc.cc` A 记录正确
- [ ] HTTP 可访问（`curl -I http://lemonix.loc.cc`）
- [ ] HTTPS 可访问（`curl -I https://lemonix.loc.cc`）
- [ ] 测试期清单已全部通过
- [ ] GitHub OAuth 回调地址正确
- [ ] `OWNER_OPEN_ID` 已配置
- [ ] `pnpm seed:demo` 已执行
- [ ] 关键账号可登录，评审路径可走通
- [ ] 账户余额可覆盖超时长（建议 >= 50 元）
