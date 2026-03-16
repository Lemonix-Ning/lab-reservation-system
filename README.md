# 实验室预约管理系统

一个面向高校实验室资源的预约与调度系统，提供预约申请、审核流、冲突检测、规则配置、统计分析与通知等能力，支持学生、教师、实验室管理员与系统管理员多角色协同。

## 目录
- 项目简介
- 功能特性
- 技术栈
- 文档导航
- 架构概览
- 目录结构
- 环境变量
- 快速开始
- 认证与权限
- API 概览
- 数据库设计概览
- 测试
- 部署建议
- 常见问题
- 许可证

## 文档导航
- 统一文档入口：docs/README.md
- 部署流程：DEPLOYMENT_GUIDE.md
- OAuth 配置：docs/OAUTH_SETUP.md
- 数据库结构：docs/DB_SCHEMA.md
- 数据库优化：docs/DB_OPTIMIZATION.md
- 账号注销：docs/ACCOUNT_DELETION.md

## 项目简介
- 目标：规范高校实验室资源使用流程，提升资源利用率与透明度
- 能力：在线预约、审核与改签、违约与黑名单治理、开放/禁用时段管理、数据仪表板与导出、AI 辅助
- 特点：类型安全 API（tRPC）、全栈 TypeScript、轻量可维护的 Drizzle ORM 数据访问

## 功能特性
- 学生
  - 浏览实验室与设备、在线预约、查看与取消个人预约
  - AI 润色预约理由，提升通过率
- 教师
  - 课程管理、班级管理（批量添加学生）
  - 为课程创建实验室预约，统一管理教学资源
- 管理员（实验室管理员/系统管理员）
  - 实验室与设备管理、预约审核与调整
  - 预约规则配置（每日次数、最长时长、提前天数）
  - 开放规则与禁用时段（维护期、假期）管理
  - 违约与黑名单、审计日志、统计仪表板与数据导出
  - 日/周/月/热力图视图的可视化调度与冲突建议

## 技术栈
- 后端
  - Node.js、TypeScript、Express
  - tRPC（类型安全 API）、Drizzle ORM（MySQL）
  - Vitest（单元测试）
- 前端
  - React + Vite、TanStack Query
  - Tailwind CSS、shadcn/ui、Wouter
  - Recharts（统计图表）
- AI
  - 讯飞星火 Spark（HTTP + APIPassword），支持 Mock 模式

## 架构概览
- 开发模式
  - 单进程集成：后端在开发环境自动挂载 Vite 中间件，提供 HMR 与前端资源
  - 分离模式：前端 Vite 开发服务器（5173）通过代理连接后端（3000）
- 生产模式
  - 前端构建产物输出至 `dist/public`，后端以 Node 进程提供静态资源与 API
- 关键位置
  - 开发服务器入口：[index.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/index.ts)
  - Vite 集成与静态资源服务：[vite.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/vite.ts)
  - tRPC 路由与权限：[routers.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts)
  - 环境变量读取：[env.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/env.ts)
  - 数据库表结构：[schema.ts](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts)
  - 测试配置：[vitest.config.ts](file:///d:/workspace/A_bs/lab-reservation-system/vitest.config.ts)
  - 构建配置：[vite.config.ts](file:///d:/workspace/A_bs/lab-reservation-system/vite.config.ts)

## 目录结构
```
lab-reservation-system/
├─ client/               # 前端
│  ├─ index.html
│  └─ src/
│     ├─ components/     # UI 组件与布局
│     ├─ pages/          # 页面：预约、管理、统计、日历等
│     ├─ lib/            # tRPC 客户端等
│     ├─ contexts/       # 主题等上下文
│     ├─ hooks/
│     ├─ App.tsx, main.tsx, index.css
│     └─ const.ts        # 登录地址生成等
├─ server/               # 后端
│  ├─ _core/             # 框架与集成
│  │  ├─ index.ts        # Express + tRPC + Vite 集成
│  │  ├─ context.ts, trpc.ts, cookies.ts, env.ts
│  │  ├─ oauth.ts, sdk.ts, vite.ts, xfspark.ts
│  ├─ routers.ts         # tRPC 路由聚合
│  ├─ db.ts              # 数据访问与规则校验
│  └─ *.test.ts          # 单元测试
├─ drizzle/              # 数据库（MySQL）
│  ├─ schema.ts, relations.ts
│  └─ *.sql, meta/
├─ shared/               # 共享类型与常量
├─ scripts/              # 实用脚本（Mock OAuth 等）
├─ package.json, vite.config.ts, vitest.config.ts
└─ tsconfig.json, pnpm-lock.yaml
```

## 环境变量
在项目根目录创建 `.env`：
```env
# 基础
NODE_ENV=development
PORT=3000                      # 首选端口，若占用将自动+1查找可用端口

# 会话与鉴权
JWT_SECRET="change-me"         # 会话签名密钥（用于后端 Cookie 会话）
OWNER_OPEN_ID="your-admin-openid"  # 项目所有者（自动授予 sysAdmin）

# 数据库
DATABASE_URL="mysql://root:password@localhost:3306/lab_reservation_db"

# OAuth - Manus（Mock OAuth，开发测试用）
OAUTH_SERVER_URL="http://localhost:4000"
OAUTH_CLIENT_ID="local-client-id"
MOCK_OAUTH_ENABLED="true"
MOCK_OPEN_ID="qq-admin-openid"
VITE_OAUTH_AUTHORIZE_URL="http://localhost:4000/oauth/authorize"

# OAuth - GitHub（可选）
# 从 https://github.com/settings/developers 创建 OAuth App
# 回调地址: http://localhost:3000/api/oauth/github/callback
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# OAuth - QQ（可选）
# 从 https://connect.qq.com/manage.html 创建应用
# 回调地址: http://localhost:3000/api/oauth/qq/callback
QQ_APP_ID=""
QQ_APP_KEY=""

# 前端
VITE_APP_ID="lab-reservation-local"
VITE_SERVER_ORIGIN="http://localhost:3000"
# （分离模式下前端代理到后端）
BACKEND_URL="http://localhost:3000"

# 可选：内置 Forge API（若使用）
BUILT_IN_FORGE_API_URL=""
BUILT_IN_FORGE_API_KEY=""

# AI（讯飞星火）
XFYUN_API_PASSWORD=""          # 留空将使用 Mock 模式
XFYUN_MODEL="4.0Ultra"         # lite | generalv3 | generalv3.5 | 4.0Ultra
```

**OAuth 配置说明**：
- 至少配置一种 OAuth 方式（Manus/GitHub/QQ）
- 详细配置步骤见 [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md)
- 开发环境可只使用 Manus Mock OAuth

## 快速开始
1. 安装依赖
   ```bash
   pnpm install
   ```
2. 初始化数据库（生成与迁移）
   ```bash
   pnpm db:push
   ```
3. 启动开发
   - 方式A：单进程集成（推荐）
     ```bash
     pnpm dev
     # 控制台显示 Server running on http://localhost:<port>/
     ```
     打开浏览器访问后端输出的地址（默认 3000，若占用将顺延）。
   - 方式B：前后端分离（用于前端独立调试）
     ```bash
     pnpm dev          # 后端（3000）
     pnpm client:dev   # 前端（5173），通过代理访问后端
     ```
4. 可选：启动本地 Mock OAuth
   ```bash
   pnpm mock:oauth
   ```
   登录流程将通过后端的 `/api/oauth/authorize` 代理到 Mock 服务。

## 认证与权限
- **多 OAuth 登录支持**（P3-1 新增）
  - GitHub OAuth：使用 GitHub 账号登录
  - QQ OAuth：使用 QQ 账号登录
  - 学校统一认证：预留接口，可对接学校 CAS/OAuth
  - 账号绑定：支持绑定多个 OAuth 账号，使用任意账号登录
  - 配置指南：见 [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md)
- Cookie 会话：后端在 OAuth 回调后设置 `app_session_id`（`JWT_SECRET` 签名）
- 角色体系：`student`、`teacher`、`labAdmin`、`sysAdmin`
- 动态权限：14 项权限代码，支持角色权限灵活配置
- 前端拦截：tRPC 调用在未登录时重定向到登录页（见 [main.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/main.tsx)）

## API 概览
- tRPC 路由聚合见 [routers.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts)
- 主要分组
  - `auth`：登录态、退出
  - `user`：用户查询
  - `labRoom`：实验室管理（增删改查）
  - `reservation`：预约申请、取消、审核与更新、冲突详情
  - `rule`：预约规则查询与更新
  - `device`：设备管理
  - `statistics`：统计分析与导出
  - `notification`：消息中心与未读数
  - `approval`：审批配置与历史、自动取消超时
  - `violation`/`blacklist`：违约记录与黑名单治理
  - `calendar`：日历数据、热力图、替代时间段建议
  - `course`/`courseReservation`：课程与课程预约

## 数据库设计概览
- 核心表（详见 [schema.ts](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts)）
  - `users`：用户（含角色枚举）
  - `lab_rooms`：实验室信息与状态
  - `lab_reservations`：预约记录（含状态、改签信息）
  - `lab_reserve_rules`：预约规则（每日次数、最长时长、提前天数）
  - `lab_devices`：设备（按实验室关联）
  - `opening_rules`：开放时间规则（全局/按实验室）
  - `blocked_periods`：禁用时段（维护、假期等）
  - `approval_configs`/`approval_histories`：审批配置与历史
  - `violation_records`/`blacklist`：违约与黑名单
  - `audit_logs`：审计日志
  - `courses`/`course_reservations`/`course_students`：教学场景

## 测试
- 运行测试
  ```bash
  pnpm test
  ```
- 范围：`server/**/*.test.ts`，包含冲突检测、统计计算、审批与违规则治理等
- 配置：见 [vitest.config.ts](file:///d:/workspace/A_bs/lab-reservation-system/vitest.config.ts)

## 部署建议
- 构建与启动
  ```bash
  pnpm build   # 构建前端 + 打包后端入口到 dist
  pnpm start   # 生产启动（Node 进程）
  ```
- 反向代理：使用 Nginx/Apache 将静态资源与 `/api` 代理到后端
- HTTPS 与 Cookie：生产下 `sameSite=none` + `secure=true`（后端自动判定）
- 数据库：建议启用连接池与只读副本（如需）
- 日志与审计：开启 `audit` 页面供运维检索关键操作

## 常见问题
- 无法登录或提示“请先登录”
  - 检查 `VITE_SERVER_ORIGIN` 与实际访问域一致
  - 确认后端 OAuth 回调与 Cookie 设置正常（见 [cookies.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/cookies.ts)）
- 端口占用
  - 后端会从 `PORT=3000` 起自动查找可用端口，控制台会提示实际端口
- 数据库连接失败
  - 确认 MySQL 服务、`DATABASE_URL`、数据库已创建与迁移已执行（`pnpm db:push`）
- AI 返回 Mock
  - 未配置 `XFYUN_API_PASSWORD` 时使用 Mock；配置后需重启服务

## 许可证
MIT
