# 快速启动指南

## 📋 前置条件

- **Node.js**: 20 LTS 或更高版本
- **pnpm**: 10.x 版本（[安装](https://pnpm.io/installation)）
- **MySQL**: 8.0+ 或 Docker（可选，用于完整功能）
- **Git**: 用于版本控制

## 🚀 5 分钟快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/Lemonix-Ning/lab-reservation-system.git
cd lab-reservation-system
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动开发服务器

#### 方式 A：集成模式（推荐 - 一条命令运行完整系统）

```bash
pnpm dev
```

- 后端：自动启动在 `http://localhost:3000`
- 前端：自动挂载到后端（无需单独启动）
- 自动打开浏览器

**输出示例**：
```
Server running on http://localhost:3000
```

#### 方式 B：分离模式（前后端各自运行）

**终端 1 - 后端**：
```bash
pnpm dev
```

**终端 2 - 前端**：
```bash
pnpm client:dev
# 访问 http://localhost:5173，自动代理到后端
```

### 4. 使用 Mock OAuth 快速登录（无需配置）

```bash
pnpm mock:oauth
# 这将启动模拟 OAuth 服务器
# 登录时使用测试账号即可
```

---

## 📊 完整功能需要数据库

若要完整体验预约、审核、统计等功能，需要 MySQL：

### Docker 方式（推荐）

```bash
# 启动 MySQL 容器
docker run --name lab-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=lab_reservation_db \
  -p 3306:3306 \
  -d mysql:8.0

# 初始化数据库
pnpm db:push

# 生成示例数据
pnpm seed:comprehensive
```

### 本地 MySQL 方式

1. 创建数据库和用户
2. 修改 `.env` 中的 `DATABASE_URL`
3. 运行迁移：`pnpm db:push`

---

## 🌐 部署到 GitHub Pages

### 前端静态站点（UI 预览）

自动部署到 GitHub Pages（已配置）：

1. **推送代码**到 GitHub：
   ```bash
   git add .
   git commit -m "Update project"
   git push origin main
   ```

2. **查看部署状态**：
   - GitHub 仓库 → **Actions** 选项卡
   - 等待 `Deploy to GitHub Pages` 工作流完成

3. **访问在线演示**：
   ```
   https://lemonix-ning.github.io/lab-reservation-system/
   ```

详细配置见：[docs/GITHUB_PAGES_SETUP.md](../docs/GITHUB_PAGES_SETUP.md)

---

## 🔐 环境变量配置

### 开发环境 `.env`（已包含示例）

```env
# 基础
NODE_ENV=development
PORT=3000

# 数据库（可选，用 Mock 数据）
DATABASE_URL="mysql://root:password@localhost:3306/lab_reservation_db"

# JWT
JWT_SECRET="change-me"

# OAuth（可选，使用 Mock）
OAUTH_SERVER_URL="http://localhost:4000"
MOCK_OAUTH_ENABLED="true"
```

### 生产环境（GitHub Actions 自动处理）

- 无需数据库连接
- 仅生成前端静态资源

---

## 🧪 测试与质量

```bash
# 类型检查
pnpm check

# 运行单元测试
pnpm test

# 代码格式化
pnpm format
```

---

## 📁 项目结构概览

```
lab-reservation-system/
├─ client/              # ⚛️  前端（React + Vite）
│  ├─ src/
│  │  ├─ pages/         # 页面：预约、管理、统计等
│  │  ├─ components/    # UI 组件
│  │  ├─ App.tsx, main.tsx
│  │  └─ const.ts       # 登录地址等常量
│  └─ index.html
├─ server/              # 🖥️  后端（Express + tRPC）
│  ├─ _core/            # 框架集成
│  ├─ routers.ts        # API 路由
│  └─ db.ts             # 数据访问层
├─ drizzle/             # 🗄️  数据库
│  ├─ schema.ts
│  └─ *.sql             # 迁移脚本
├─ shared/              # 📦 共享类型
├─ .github/workflows/   # 🤖 自动部署
└─ package.json
```

---

## ❓ 常见问题

### Q: 启动后报错 `EADDRINUSE`？
**A**: 3000 端口被占用。系统会自动尝试 3001, 3002... 或改为：
```bash
PORT=3001 pnpm dev
```

### Q: 数据库连接失败？
**A**: 
- 检查 `.env` 中的 `DATABASE_URL`
- 确保 MySQL 服务运行中
- 运行 `pnpm db:push` 初始化

### Q: GitHub Pages 没有显示？
**A**:
- 检查 **Settings → Pages** 配置
- 查看 **Actions** 标签确认部署成功
- 可能需要 5-10 分钟生效

### Q: 如何只看前端 UI（无需后端）？
**A**:
```bash
pnpm build:static   # 生成静态文件
pnpm client:dev     # 启动 Vite 前端开发服务器
# 访问 http://localhost:5173
```

---

## 📚 深入了解

- 完整部署：[DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
- OAuth 配置：[docs/OAUTH_SETUP.md](../docs/OAUTH_SETUP.md)
- 数据库设计：[docs/DB_SCHEMA.md](../docs/DB_SCHEMA.md)
- 权限系统：[docs/VIOLATION_SYSTEM.md](../docs/VIOLATION_SYSTEM.md)

---

## 💡 开发工作流

1. **创建分支**：`git checkout -b feature/your-feature`
2. **编写代码**：在 `client/src` 或 `server/` 中修改
3. **本地测试**：`pnpm dev` 开发，`pnpm test` 单元测试
4. **提交代码**：`git commit -m "feat: description"`
5. **推送 PR**：`git push origin feature/your-feature`

---

## 📦 构建与发布

```bash
# 构建前端静态资源（用于 GitHub Pages）
pnpm build:static    # 输出至 dist-static/

# 构建完整系统（后端 + 前端）
pnpm build           # 输出至 dist/

# 启动生产环境
pnpm start
```

---

**祝你使用愉快！** 🎉 有问题欢迎提 Issue。
