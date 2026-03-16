# 🚀 部署流程图

## 方式一：使用自动化脚本（推荐）

```
┌─────────────────────────────────────────────────────────────┐
│                    本地 Windows 环境                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  运行 prepare-deploy.bat
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
          生成部署密钥            提交并推送代码
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   服务器 Linux 环境                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  SSH 连接到服务器
                            │
                            ▼
                    克隆 Git 仓库
                            │
                            ▼
                运行 bash server-deploy.sh
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
          安装 Docker            配置 .env 文件
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                    执行 init-ssl.sh
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
          申请 SSL 证书          启动 Docker 容器
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                    ✅ 部署完成
                            │
                            ▼
                  访问 https://lemonix.loc.cc
                            │
                            ▼
                    首次 GitHub 登录
                            │
                            ▼
                  获取 openId 并配置管理员
                            │
                            ▼
                    🎉 系统上线运行
```

## 方式二：手动部署

### 本地准备

1. ✅ 生成密钥：`pnpm deploy:secrets`
2. ✅ 提交代码：`git add . && git commit -m "部署" && git push`

### 服务器操作

1. 📦 安装 Docker
2. 📥 克隆项目
3. 📝 配置 .env
4. 📧 配置邮箱
5. 🚀 执行部署：`./init-ssl.sh`
6. 🔧 配置管理员

---

## 📋 部署前准备清单

### 需要准备的信息

- [ ] 服务器 IP 地址
- [ ] Git 仓库地址
- [ ] GitHub OAuth Client ID 和 Secret
- [ ] 你的邮箱地址（用于 SSL 证书）
- [ ] 部署密钥（运行 `pnpm deploy:secrets` 生成）

### 需要完成的配置

- [ ] 创建 GitHub OAuth 应用
  - Homepage: `https://lemonix.loc.cc`
  - Callback: `https://lemonix.loc.cc/api/oauth/github/callback`

- [ ] 服务器安全组配置
  - 开放端口：22 (SSH), 80 (HTTP), 443 (HTTPS)

---

## 🎯 快速开始

### 在本地运行：

```bash
# Windows
prepare-deploy.bat

# 或手动执行
pnpm deploy:secrets
git add . && git commit -m "部署" && git push
```

### 在服务器运行：

```bash
# 连接服务器
ssh root@你的服务器IP

# 克隆项目
cd /root
git clone 你的仓库地址 lab-reservation-system
cd lab-reservation-system

# 自动部署
bash server-deploy.sh
```

---

## ⏱️ 预计时间

- 本地准备：2-3 分钟
- 服务器部署：5-10 分钟
- 配置管理员：1-2 分钟

**总计：约 10-15 分钟**

---

## 📞 遇到问题？

查看日志：
```bash
docker compose logs -f app
```

查看容器状态：
```bash
docker compose ps
```

重启服务：
```bash
docker compose restart app
```

---

**准备好了吗？运行 `prepare-deploy.bat` 开始吧！** 🚀
