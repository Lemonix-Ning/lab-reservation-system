# 🚀 部署步骤指南

## 第一步：连接到服务器

1. 打开阿里云控制台
2. 找到你的 ECS 实例（IP: 8.218.143.37）
3. 点击"远程连接" → 选择"通过 Workbench 远程连接"
4. 输入用户名：`root`
5. 连接成功后，你会看到命令行界面

---

## 第二步：克隆项目

在服务器命令行中依次执行：

```bash
# 进入 root 目录
cd /root

# 克隆项目（指定分支）
git clone -b db-optimization-phase1 https://github.com/Lemonix-Ning/lab-reservation-system.git

# 进入项目目录
cd lab-reservation-system
```

---

## 第三步：配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置文件
nano .env
```

### 在 nano 编辑器中：

1. 删除所有内容（按住 Ctrl+K 多次）
2. 复制以下内容并粘贴（右键粘贴）：

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
```

3. 保存并退出：
   - 按 `Ctrl + X`
   - 按 `Y` 确认
   - 按 `Enter` 保存

---

## 第四步：配置 SSL 证书邮箱

```bash
# 编辑 SSL 脚本
nano init-ssl.sh
```

找到第 9 行（`EMAIL=""`），改为：

```bash
EMAIL="3428476178@qq.com"
```

保存并退出（Ctrl+X, Y, Enter）

---

## 第五步：执行部署

```bash
# 添加执行权限
chmod +x init-ssl.sh update.sh

# 开始部署（大约需要 5-10 分钟）
./init-ssl.sh
```

部署过程中会自动：
- 安装 Docker
- 申请 SSL 证书
- 启动所有服务

---

## 第六步：验证部署

```bash
# 检查容器状态
docker compose ps
```

应该看到 4 个容器都是 `Up` 状态

---

## 第七步：访问网站

打开浏览器，访问：**https://lemonix.loc.cc**

应该能看到登录页面！

---

## 第八步：配置管理员

1. 点击"GitHub 登录"并授权
2. 登录后，在服务器执行：

```bash
docker compose logs app | grep "openId\|github-"
```

3. 找到你的 openId（类似：`github-123456789`）
4. 配置管理员：

```bash
nano .env
```

找到 `OWNER_OPEN_ID=` 这一行，填入你的 openId

5. 重启应用：

```bash
docker compose restart app
```

6. 重新登录网站，确认有管理员权限

---

## 🎉 部署完成！

现在你可以：
- ✅ 管理实验室
- ✅ 创建课程
- ✅ 管理预约
- ✅ 邀请用户

---

## 📱 常用命令

```bash
# 查看日志
docker compose logs -f app

# 重启应用
docker compose restart app

# 查看状态
docker compose ps
```

---

**如有问题，随时告诉我！** 😊
