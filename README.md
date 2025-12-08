# 实验室预约管理系统 - 完整文档

基于规则配置的高校实验室资源预约与调度管理系统。

## 📋 目录
1. [项目简介](#项目简介)
2. [核心功能](#核心功能)
3. [技术栈](#技术栈)
4. [快速开始](#快速开始)
5. [项目结构](#项目结构)
6. [使用指南](#使用指南)
7. [AI 智能功能](#ai-智能功能)
8. [数据库设计](#数据库设计)
9. [API 文档](#api-文档)
10. [核心算法](#核心算法)
11. [扩展开发](#扩展开发)
12. [常见问题](#常见问题)
13. [项目标准](#项目标准)

---

## 项目简介

实验室预约管理系统是一个现代化的Web应用，旨在解决高校实验室资源管理中的痛点。系统提供了完整的在线预约、审核、冲突检测和规则配置功能，帮助学校规范化管理实验室资源，提高资源利用效率。

### 核心特性
- 🔍 **智能冲突检测**：自动检测时间冲突，避免重复预约
- 📏 **规则引擎**：支持多种预约规则的动态配置
- 🔐 **权限管理**：基于角色的访问控制（学生/管理员）
- 🎨 **现代UI**：响应式设计，支持多种设备访问
- 🤖 **AI 智能**：集成讯飞星火大模型，支持预约理由润色和管理洞察报告

---

## 核心功能

### 学生端
- 📋 **实验室浏览**：查看所有可用实验室的详细信息
- 📝 **在线预约**：提交实验室预约申请，填写预约事由和时间
- ✨ **AI 润色**：使用 AI 智能润色预约理由，提高申请通过率
- 📊 **预约管理**：查看个人预约记录，跟踪预约状态
- ❌ **预约取消**：在审核前可主动取消预约
- 📍 **签到与签退**：在预约实验室时使用定位/扫描 QR 完成签到，支持备用方式（Wi‑Fi、管理员代签）
- 📚 **课程查看**：查看已加入课程及其实验室预约信息

### 教师端
- 📖 **课程管理**：创建课程、添加/移除学生、按班级筛选批量操作
- 🏫 **班级管理**：使用班级功能批量添加学生到课程
- 🔬 **课程预约**：为课程预约实验室，统一管理教学用实验室资源
- 📋 **预约管理**：查看和取消课程的实验室预约

### 管理员端
- 🏢 **实验室管理**：维护实验室信息（增删改查）、配置地理围栏信息
- ✅ **预约审核**：审核学生提交的预约申请（通过/拒绝）
- ⚙️ **规则配置**：灵活配置预约规则（次数限制、时长限制等）
- 📋 **审批配置管理**：配置多级审批流程、改签规则
- 🚫 **违约管理**：记录违约、管理黑名单、自动积分计算（≥10分自动进入黑名单）、执行未到场对账
- 📍 **签到与定位**：管理签到记录、手动触发对账操作、支持 dryRun 预览影响
- 📊 **审计日志**：完整的系统操作追踪，含操作员、IP、时间戳
- 📈 **数据仪表板**：查看预约统计、趋势图表、资源使用情况
- 🤖 **AI 洞察**：一键生成 AI 智能分析报告，获取运营建议
- 🎓 **班级管理**：创建和管理班级，为批量学生管理提供支持

---

## 技术栈

### 后端
- **运行时**：Node.js 22.13.0
- **语言**：TypeScript 5.9.3
- **API框架**：tRPC 11.6.0（类型安全的API）
- **Web服务器**：Express 4.21.2
- **数据库ORM**：Drizzle ORM 0.44.5
- **数据库**：MySQL
- **测试框架**：Vitest

### 前端
- **框架**：React 19.1.1
- **构建工具**：Vite 7.1.7
- **数据管理**：TanStack Query
- **UI组件**：shadcn/ui
- **样式**：Tailwind CSS 4.1.14
- **路由**：Wouter
- **图表**：Recharts 2.15.2

### AI 服务
- **大模型**：讯飞星火 Spark X1.5 (4.0Ultra)
- **协议**：HTTP REST API
- **认证**：APIPassword Bearer Token

---

## 快速开始

### 环境要求
- Node.js 22.13.0+
- MySQL 8.0+
- pnpm 10.4.1+

### 环境变量配置

创建 `.env` 文件在项目根目录：

```env
# 数据库
DATABASE_URL="mysql://root:296131@localhost:3306/lab_reservation_db"

# 会话加密密钥
JWT_SECRET="256ec08ba53dbb44e95050cb5d00883f3f6dd2cb14a4103d24fb7f0f66bae7ef"

# OAuth 配置
OAUTH_SERVER_URL="http://localhost:4000"
OAUTH_CLIENT_ID="local-client-id"
OAUTH_CLIENT_SECRET="local-client-secret"
MOCK_OAUTH_ENABLED="true"
MOCK_OAUTH_PORT="4000"
MOCK_OPEN_ID="qq-admin-openid"
OWNER_OPEN_ID="qq-admin-openid"

# 前端配置
VITE_APP_ID="lab-reservation-local"
VITE_OAUTH_AUTHORIZE_URL="http://localhost:4000/authorize"
VITE_OAUTH_CLIENT_ID="local-client-id"
VITE_SERVER_ORIGIN="http://localhost:3000"

# 服务
NODE_ENV="development"
PORT="3000"

# ============ 讯飞星火 AI 配置 ============
# 从控制台获取: https://console.xfyun.cn/services/cbm → HTTP服务接口认证信息
XFYUN_API_PASSWORD="your-api-password"
# 模型选项: lite(免费) | generalv3 | generalv3.5 | 4.0Ultra (X1.5)
XFYUN_MODEL="4.0Ultra"
```

### 初始化步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 创建数据库表
pnpm db:push

# 3. 初始化测试数据
npx tsx scripts/seed.mjs

# 4. 启动本地 OAuth 模拟服务（可选，自动启动）
pnpm mock:oauth

# 5. 启动后端开发服务器
pnpm dev
# 后端将运行在 http://localhost:3000

# 6. 新开终端，启动前端开发服务器
pnpm client:dev
# 前端将运行在 http://localhost:5173
```

### 首次使用

1. 访问 http://localhost:5173
2. 点击"登录"按钮，自动跳转到本地 OAuth 模拟器
3. 使用默认 openId (`qq-admin-openid`) 获得管理员权限
4. 完成初始化

---

## 项目结构

```
lab-reservation-system/
├── client/                          # 前端代码
│   ├── public/                      # 静态资源
│   ├── index.html                   # HTML 入口
│   └── src/
│       ├── components/              # UI 组件
│       │   ├── ui/                  # shadcn/ui 组件库
│       │   ├── DashboardLayout.tsx  # 仪表板布局
│       │   ├── Map.tsx              # 地图组件
│       │   └── ...
│       ├── pages/                   # 页面组件
│       │   ├── Home.tsx
│       │   ├── LabDashboard.tsx    # 完整仪表板
│       │   ├── LabRoomList.tsx
│       │   └── ...
│       ├── lib/
│       │   ├── trpc.ts              # tRPC 客户端配置
│       │   └── utils.ts
│       ├── contexts/
│       │   └── ThemeContext.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useMobile.tsx
│       │   └── useComposition.ts
│       ├── App.tsx                  # 路由和主应用
│       ├── main.tsx                 # 应用入口
│       └── index.css
│
├── server/                          # 后端代码
│   ├── _core/                       # 核心框架
│   │   ├── index.ts                 # 服务器启动入口
│   │   ├── context.ts               # tRPC 上下文
│   │   ├── trpc.ts                  # tRPC 路由定义
│   │   ├── cookies.ts               # Cookie 处理
│   │   ├── oauth.ts                 # OAuth 流程
│   │   ├── oauthPaths.ts
│   │   ├── env.ts                   # 环境变量校验
│   │   ├── vite.ts                  # Vite 开发服务集成
│   │   ├── xfspark.ts               # 讯飞星火 AI 客户端
│   │   ├── systemRouter.ts
│   │   └── ...
│   ├── db.ts                        # 数据库查询函数
│   ├── routers.ts                   # API 路由定义（tRPC）
│   ├── storage.ts                   # 存储抽象
│   ├── *.test.ts                    # 单元测试
│   └── ...
│
├── drizzle/                         # 数据库
│   ├── schema.ts                    # 表结构定义
│   ├── relations.ts
│   ├── migrations/
│   ├── meta/
│   └── *.sql
│
├── shared/                          # 共享代码
│   ├── types.ts                     # 共享类型
│   ├── const.ts                     # 常量
│   └── _core/
│       ├── errors.ts                # 错误定义
│       └── ...
│
├── scripts/                         # 脚本
│   ├── seed.mjs                     # 数据初始化
│   └── mock-oauth.ts                # OAuth 模拟服务
│
├── docs/                            # 文档
│   └── (已合并到本文件)
│
├── .env                             # 环境变量配置
├── .env.example                     # 环境变量模板
├── tsconfig.json                    # TypeScript 配置
├── vite.config.ts                   # Vite 配置
├── vitest.config.ts                 # Vitest 配置
├── drizzle.config.ts                # Drizzle 配置
├── package.json                     # 项目依赖
├── pnpm-lock.yaml                   # 依赖锁文件
└── README.md                        # 项目说明
```

---

## 使用指南

### 学生用户

#### 1. 登录系统
- 点击"登录"按钮，跳转到本地 OAuth 模拟器
- 默认 openId: `qq-admin-openid` （可在 `.env` 修改）

#### 2. 浏览实验室
- 导航栏点击"浏览实验室"或"实验室列表"
- 查看实验室基本信息（名称、楼号、容量、类型等）

#### 3. 提交预约
- 选择实验室，点击"立即预约"按钮
- 填写预约表单：
  - **预约日期**：选择预约日期
  - **开始时间**：选择预约开始时间
  - **结束时间**：选择预约结束时间
  - **预约理由**：简述预约原因
- 点击"提交预约"
- 预约进入"待审核"状态

#### 4. 查看预约
- 点击"我的预约"查看个人预约列表
- 查看预约状态：
  - ✅ **已通过**：预约被批准
  - ⏳ **待审核**：等待管理员审核
  - ❌ **已拒绝**：预约被拒绝

#### 5. 管理预约
- 待审核状态的预约可点击"取消"按钮主动取消

### 管理员用户

#### 1. 进入管理模式
- 确保 openId 与 `.env` 中 `OWNER_OPEN_ID` 一致
- 登录后导航栏显示管理员菜单

#### 2. 实验室管理
- 点击"实验室管理"进入管理页面
- 操作：
  - **添加实验室**：点击"新增"按钮，填写实验室信息
  - **编辑实验室**：点击表格中的"编辑"，修改信息
  - **删除实验室**：点击表格中的"删除"，确认删除

#### 3. 预约审核
- 点击"预约审核"查看所有待审核的预约
- 对每个预约可选择：
  - **通过**：批准预约
  - **拒绝**：拒绝预约（需填写拒绝原因）

#### 4. 规则配置
- 点击"规则配置"进入规则管理页面
- 支持的规则：
  - **MAX_PER_DAY**：每日最多预约次数（默认 2 次）
  - **MAX_DURATION**：单次预约最长时长（默认 4 小时）
  - **ADVANCE_DAYS**：提前预约天数（默认 1 天）
- 操作：
  - **启用/停用**：切换规则开关
  - **修改规则值**：编辑规则参数

#### 5. 数据查看
- 点击"所有预约"查看系统内所有预约记录
- 按状态、实验室等维度筛选
- 导出数据报表（如已实现）

---

## AI 智能功能

系统集成了讯飞星火大模型，提供两大 AI 功能。

### 功能概述

| 功能 | 用户 | 说明 |
| --- | --- | --- |
| **AI 润色** | 学生 | 智能优化预约理由，使其更专业、清晰 |
| **AI 洞察** | 管理员 | 生成数据分析报告和运营建议 |

### 配置讯飞星火

#### 1. 获取 APIPassword

1. 访问 [讯飞开放平台控制台](https://console.xfyun.cn/services/cbm)
2. 找到 **HTTP服务接口认证信息**
3. 复制 **APIPassword**

#### 2. 配置环境变量

在 `.env` 文件中添加：

```env
# 讯飞星火 AI 配置
XFYUN_API_PASSWORD="你的APIPassword"
XFYUN_MODEL="4.0Ultra"
```

#### 3. 支持的模型

| 模型 | model 值 | 说明 |
| --- | --- | --- |
| Spark 4.0 Ultra (X1.5) | `4.0Ultra` | 最强大，对标 GPT-4 Turbo |
| Spark Max | `generalv3.5` | 旗舰级，逻辑推理优异 |
| Spark Pro | `generalv3` | 专业级，性能响应平衡 |
| Spark Lite | `lite` | 轻量级，**免费使用** |

### 使用方法

#### 学生端 - AI 润色预约理由

1. 在预约弹窗中，输入简单的预约理由关键词
2. 点击 **✨ AI 润色** 按钮
3. AI 会自动扩展和优化理由，使其更专业

**示例**：
- 输入：`做实验`
- 润色后：`基于学术研究需要，本人计划使用该实验室进行课程相关实验。实验内容涉及项目研究，预计需要使用实验室的专业设备进行数据采集与分析工作。`

#### 管理员端 - AI 洞察报告

1. 进入 **数据仪表板** (`/dashboard`)
2. 点击 **生成报告** 按钮
3. AI 会基于当前预约数据生成分析报告，包括：
   - 预约趋势分析
   - 热门实验室排名
   - 潜在问题识别
   - 优化建议

### Mock 模式

如果未配置 `XFYUN_API_PASSWORD`，系统会自动切换到 **Mock 模式**：
- 返回预设的模拟响应
- 不消耗 API 额度
- 适合开发和演示

启动时控制台会显示：
```
[XFSpark] ⚠️ XFYUN_API_PASSWORD 未配置，将使用 Mock 模式
```

配置成功后显示：
```
[XFSpark] ✅ 已配置 HTTP 客户端，模型: 4.0Ultra
```

### API 接口

#### `ai.generateReason` - AI 润色预约理由

```typescript
mutation({
  userInput: string,  // 用户输入的原始理由
  labName: string,    // 实验室名称
}) → { text: string }  // 润色后的理由
```

#### `ai.generateInsight` - AI 生成管理洞察

```typescript
mutation({
  totalReservations: number,
  pendingCount: number,
  approvedCount: number,
  rejectedCount: number,
  topLabs: { name: string, count: number }[],
  weeklyTrend: { date: string, count: number }[],
}) → { text: string }  // Markdown 格式的分析报告
```

---

## 数据库设计

### 核心表结构

#### `users` 表 - 用户表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| openId | VARCHAR(255) | OAuth 用户 ID（唯一） |
| name | VARCHAR(255) | 用户名 |
| email | VARCHAR(255) | 邮箱 |
| avatar | VARCHAR(255) | 头像 URL |
| role | VARCHAR(50) | 角色：`student` 或 `admin` |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### `lab_rooms` 表 - 实验室表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| roomNo | VARCHAR(50) | 实验室编号 |
| name | VARCHAR(255) | 实验室名称 |
| building | VARCHAR(100) | 所属楼号 |
| location | VARCHAR(255) | 具体位置 |
| capacity | INT | 容量 |
| type | VARCHAR(100) | 实验室类型 |
| managerId | INT | 管理员 ID |
| status | ENUM | 状态：`available`, `maintenance`, `closed` |
| createdAt | TIMESTAMP | 创建时间 |

#### `lab_reservations` 表 - 预约记录表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| userId | INT | 预约用户 ID（外键） |
| labId | INT | 实验室 ID（外键） |
| startTime | DATETIME | 预约开始时间 |
| endTime | DATETIME | 预约结束时间 |
| reason | TEXT | 预约原因 |
| status | ENUM | 状态：`pending`, `approved`, `rejected`, `cancelled` |
| rejectReason | TEXT | 拒绝原因 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### `lab_reserve_rules` 表 - 规则配置表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| code | VARCHAR(50) | 规则编码：`MAX_PER_DAY`, `MAX_DURATION`, `ADVANCE_DAYS` |
| value | INT | 规则值 |
| enabled | BOOLEAN | 是否启用 |
| description | TEXT | 规则描述 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### `approval_configs` 表 - 审批配置表（Phase 4）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| labId | INT | 实验室 ID（外键，NULL 表示全局配置） |
| level | INT | 审批级数：0-3 |
| maxAutoApprove | INT | 最大自动批准时长（分钟） |
| requiresApproval | BOOLEAN | 是否需要审批 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### `approval_histories` 表 - 审批历史表（Phase 4）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| reservationId | INT | 预约 ID（外键） |
| level | INT | 审批级数 |
| approverUserId | INT | 审批人 ID（外键） |
| status | ENUM | 状态：`pending`, `approved`, `rejected` |
| reason | TEXT | 审批意见 |
| createdAt | TIMESTAMP | 创建时间 |

#### `violation_records` 表 - 违约记录表（Phase 4）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| userId | INT | 违约用户 ID（外键） |
| type | VARCHAR(50) | 违约类型：`no_show`, `late_cancel`, `timeout_checkout` |
| points | INT | 扣分：no_show(5), late_cancel(3), timeout_checkout(5) |
| reservationId | INT | 相关预约 ID（外键，可空） |
| reason | TEXT | 违约原因 |
| createdAt | TIMESTAMP | 创建时间 |

#### `blacklist` 表 - 黑名单表（Phase 4）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| userId | INT | 用户 ID（外键，唯一） |
| reason | TEXT | 加入原因 |
| totalViolationPoints | INT | 累计违约积分 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### `audit_logs` 表 - 审计日志表（Phase 4）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT | 主键 |
| operatorUserId | INT | 操作人 ID（外键，可空） |
| action | VARCHAR(100) | 操作类型：`create`, `update`, `delete`, `approve`, `record_violation` 等 |
| target | VARCHAR(100) | 操作对象：`reservation`, `user`, `violation` 等 |
| targetId | INT | 操作对象 ID |
| details | JSON | 操作详情（变更前后数据） |
| ipAddress | VARCHAR(50) | 操作者 IP 地址 |
| operatedAt | DATETIME | 操作时间 |
| createdAt | TIMESTAMP | 日志创建时间 |

### 表关系

```
users (1) ──→ (N) lab_reservations (N) ──→ (1) lab_rooms
users (1) ──→ (N) lab_rooms (as manager)
users (1) ──→ (N) violation_records (Phase 4)
users (1) ──→ (1) blacklist (Phase 4)
approval_configs (N) ──→ (1) lab_rooms (Phase 4)
approval_histories (N) ──→ (1) lab_reservations (Phase 4)
```

---

## API 文档

系统使用 tRPC 构建类型安全的 API。

### 认证接口

#### `auth.me` - 获取当前用户
```typescript
query() → { id, openId, name, email, avatar, role }
```

#### `auth.logout` - 退出登录
```typescript
mutation() → { success: boolean }
```

### 实验室管理接口

#### `labRoom.list` - 获取实验室列表
```typescript
query() → LabRoom[]
```

#### `labRoom.getById` - 获取实验室详情
```typescript
query({ id: number }) → LabRoom | null
```

#### `labRoom.create` - 创建实验室（管理员）
```typescript
mutation({
  roomNo: string,
  name: string,
  building?: string,
  location?: string,
  capacity?: number,
  type?: string,
  managerId?: number
}) → { success: boolean }
```

#### `labRoom.update` - 更新实验室（管理员）
```typescript
mutation({
  id: number,
  roomNo?: string,
  name?: string,
  ... // 其他字段
}) → { success: boolean }
```

#### `labRoom.delete` - 删除实验室（管理员）
```typescript
mutation({ id: number }) → { success: boolean }
```

### 预约管理接口

#### `reservation.myList` - 获取个人预约列表
```typescript
query() → Reservation[]
```

#### `reservation.allList` - 获取所有预约列表（管理员）
```typescript
query() → Reservation[]
```

#### `reservation.create` - 创建预约
```typescript
mutation({
  labId: number,
  startTime: string,
  endTime: string,
  reason: string
}) → { success: boolean, message?: string }
```

#### `reservation.cancel` - 取消预约
```typescript
mutation({ id: number }) → { success: boolean }
```

#### `reservation.approve` - 批准预约（管理员）
```typescript
mutation({ id: number }) → { success: boolean }
```

#### `reservation.reject` - 拒绝预约（管理员）
```typescript
mutation({
  id: number,
  reason: string
}) → { success: boolean }
```

### 规则管理接口

#### `rule.list` - 获取规则列表（管理员）
```typescript
query() → Rule[]
```

#### `rule.update` - 更新规则（管理员）
```typescript
mutation({
  id: number,
  value?: number,
  enabled?: boolean
}) → { success: boolean }
```

### 审批管理接口（Phase 4）

#### `approval.getConfig` - 获取审批配置
```typescript
query({ labId?: number }) → ApprovalConfig | null
```
获取全局或特定实验室的审批配置。

#### `approval.updateConfig` - 更新审批配置（管理员）
```typescript
mutation({
  labId?: number,
  level: number,
  maxAutoApprove: number,
  requiresApproval: boolean
}) → { success: boolean }
```
更新全局或特定实验室的审批配置。

#### `approval.getHistory` - 获取审批历史（管理员）
```typescript
query({
  reservationId?: number,
  level?: number,
  status?: 'pending' | 'approved' | 'rejected'
}) → ApprovalHistory[]
```
查询审批历史记录。

#### `approval.approve` - 批准预约（管理员）
```typescript
mutation({
  reservationId: number,
  reason?: string
}) → { success: boolean }
```
批准待审批的预约。

#### `approval.reject` - 拒绝预约（管理员）
```typescript
mutation({
  reservationId: number,
  reason: string
}) → { success: boolean }
```
拒绝待审批的预约。

### 违约管理接口（Phase 4）

#### `violation.getRecords` - 获取个人违约记录
```typescript
query() → ViolationRecord[]
```
获取当前用户的违约记录列表。

#### `violation.getAllRecords` - 获取所有违约记录（管理员）
```typescript
query({
  userId?: number,
  type?: 'no_show' | 'late_cancel' | 'timeout_checkout'
}) → Array<ViolationRecord & { userName: string }>
```
获取系统内所有用户的违约记录，包含用户名。

#### `violation.getUserViolationStats` - 获取用户违约统计
```typescript
query({ userId?: number }) → { 
  totalRecords: number,
  totalPoints: number,
  blacklisted: boolean
}
```
获取用户的违约统计信息。

### 黑名单管理接口（Phase 4）

#### `blacklist.list` - 获取黑名单（管理员）
```typescript
query() → Array<{ userId: number, userName: string, totalViolationPoints: number, createdAt: string }>
```
获取所有黑名单用户。

#### `blacklist.add` - 手动加入黑名单（管理员）
```typescript
mutation({
  userId: number,
  reason: string
}) → { success: boolean }
```
手动将用户加入黑名单。

#### `blacklist.remove` - 从黑名单移除（管理员）
```typescript
mutation({
  userId: number,
  reason?: string
}) → { success: boolean }
```
将用户从黑名单移除。

### 审计日志接口（Phase 4）

#### `audit.getLogs` - 获取审计日志（管理员）
```typescript
query({
  action?: string,
  target?: string,
  targetId?: number,
  operatorUserId?: number,
  dateRange?: { start: string, end: string },
  limit?: number,
  offset?: number
}) → Array<{ 
  id: number,
  operatorName: string,
  action: string,
  target: string,
  targetId: number,
  details: any,
  ipAddress: string,
  operatedAt: string,
  createdAt: string
}>
```
查询系统审计日志，支持多条件过滤。

---

## 核心算法

### 时间冲突检测

系统使用区间重叠算法检测预约时间冲突。两个时间段不重叠的条件是：

```
不重叠 = (新预约结束 ≤ 现有预约开始) OR (新预约开始 ≥ 现有预约结束)
有重叠 = NOT (不重叠)
```

算法实现（伪代码）：

```typescript
function hasConflict(newStart: Date, newEnd: Date, existStart: Date, existEnd: Date): boolean {
  return !(newEnd <= existStart || newStart >= existEnd);
}
```

### 预约规则引擎

当前支持的规则：

| 规则代码 | 说明 | 默认值 |
| --- | --- | --- |
| `MAX_PER_DAY` | 每天最多预约次数 | 2 |
| `MAX_DURATION` | 单次预约最长时长（小时） | 4 |
| `ADVANCE_DAYS` | 最多可提前预约天数 | 1 |

规则验证流程：

```
1. 检查规则是否启用
2. 计算用户在该天已有预约数
3. 计算新预约的时长
4. 计算预约相对于当前时间的天数
5. 若任何规则违反，返回错误
6. 否则通过验证，创建预约
```

---

## 扩展开发

### 添加新功能的标准流程

#### 1. 数据库层
在 `drizzle/schema.ts` 中定义新表或修改现有表：

```typescript
export const newTable = sqliteTable('new_table', {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int().references(() => users.id),
  // ...其他字段
});
```

#### 2. 数据访问层
在 `server/db.ts` 中添加查询函数：

```typescript
export async function getNewData(id: number) {
  return db.query.newTable.findFirst({
    where: eq(newTable.id, id),
  });
}
```

#### 3. API 层
在 `server/routers.ts` 中添加 tRPC 路由：

```typescript
export const appRouter = router({
  // ...其他路由
  newFeature: router({
    list: publicProcedure.query(async () => {
      return await db.getAllNewData();
    }),
    create: protectedProcedure
      .input(z.object({ /* 输入类型 */ }))
      .mutation(async ({ input }) => {
        return await db.createNewData(input);
      }),
  }),
});
```

#### 4. 前端层
在 `client/src/pages/` 中创建页面组件：

```typescript
import { trpc } from '@/lib/trpc';

export function NewFeaturePage() {
  const { data: items } = trpc.newFeature.list.useQuery();
  // 实现页面逻辑
}
```

在 `client/src/App.tsx` 中注册路由。

### 推荐的扩展方向

1. **📊 统计分析**
   - 实验室使用率统计
   - 预约数据可视化（图表）
   - 热力图分析

2. **📧 通知系统**
   - 站内消息通知
   - 邮件通知
   - 短信提醒

3. **📱 移动端优化**
   - 响应式设计完善
   - PWA 支持
   - 移动应用封装

4. **🔧 设备管理**
   - 实验室设备信息维护
   - 设备预约关联
   - 设备故障报告

5. **📅 日历视图**
   - 可视化预约时间选择
   - 日历冲突提示
   - 拖拽调整时间

6. **📈 数据导出**
   - Excel 报表导出
   - CSV 格式输出
   - PDF 生成

7. **🔒 高级权限**
   - 细粒度权限控制
   - 部门管理员
   - 审核工作流

---

## 常见问题

### Q: 如何成为管理员？
**A:** 项目所有者（`.env` 中 `OWNER_OPEN_ID`）自动获得管理员权限。其他用户需要：
1. 在 MySQL 中修改用户记录的 `role` 字段：
   ```sql
   UPDATE users SET role = 'admin' WHERE openId = 'your-openid';
   ```

### Q: 如何修改预约规则？
**A:** 管理员登录后，点击"规则配置"，可以：
- 修改规则的值（如将每天最多预约次数改为 3）
- 启用或停用某条规则
- 规则修改立即生效

### Q: 数据库连接失败怎么办？
**A:** 检查以下几点：
1. MySQL 服务是否运行：`mysql -u root -p`
2. `.env` 中 `DATABASE_URL` 是否正确
3. 数据库是否存在：`SHOW DATABASES;`
4. 用户权限是否充足

### Q: 如何清空所有数据并重新初始化？
**A:** 
```bash
# 删除数据库
mysql -u root -p -e "DROP DATABASE lab_reservation_db;"

# 重新创建并初始化
pnpm db:push
npx tsx scripts/seed.mjs
```

### Q: 如何修改 OAuth 模拟服务的默认用户？
**A:** 修改 `.env` 中的 `MOCK_OPEN_ID` 和 `OWNER_OPEN_ID`，然后重启服务。

### Q: 前端能否直接连接生产数据库？
**A:** 不建议。前端应只通过后端 API 访问数据库，这样可以：
- 保护数据库凭证安全
- 实施权限控制
- 便于审计日志

### Q: 如何部署到生产环境？
**A:** 
1. 修改 `.env` 中的敏感信息（数据库密码、JWT密钥等）
2. 构建前端：`pnpm build`
3. 启用数据库连接池（生产推荐）
4. 使用 PM2 或类似工具管理后端进程
5. 配置 Nginx 反向代理前端和后端
6. 启用 HTTPS

### Q: 支持多语言吗？
**A:** 暂不支持。如需添加，建议：
1. 使用 `i18next` 或 `react-i18next` 库
2. 为所有 UI 文本提取翻译键
3. 管理多语言翻译文件

### Q: 支持暗模式吗？
**A:** 系统已集成 `next-themes`，通过 `ThemeContext` 管理主题。修改主题设置页面可启用暗模式切换。

---

## 故障排查

### 常见错误及解决方案

#### 启动时报 `Cannot find module`
- **原因**：依赖未安装
- **解决**：运行 `pnpm install`

#### Dashboard 显示 Mock 数据而不是实时数据
- **原因**：早期版本使用本地状态，需要使用 tRPC 实时查询
- **解决**：
  1. 确认前端已更新到最新版本
  2. 使用 tRPC hooks 而非 useState 获取数据
  3. 使用 mutations 进行写操作，并在 onSuccess 中调用 `invalidate()` 刷新缓存

#### React 报错 "Rendered more hooks than during the previous render"
- **原因**：在条件语句中调用 hooks，导致不同渲染中 hooks 数量不一致
- **解决**：
  1. 不在 if/for/while 中调用 hooks
  2. 分离组件：权限检查放外层，业务逻辑放内层
  3. 避免条件化 hooks 的 enabled 选项

#### Dashboard 一直显示"加载中..."
- **原因**：isLoading 状态初始化为 true，但从未变为 false
- **解决**：
  1. 使用 `useAuth()` 返回的 `user` 状态判断
  2. `user === undefined` 表示加载中
  3. `user === null` 表示已加载但未登录
  4. `user` 存在表示已加载且已认证

#### 预约提交失败
- **原因**：可能违反了预约规则
- **检查**：
  1. 检查每日预约数是否超限
  2. 检查预约时长是否过长
  3. 检查预约是否已过期
  4. 查看浏览器控制台的错误信息

#### 登录后仍显示"请先登录"
- **原因**：Cookie 未正确设置
- **解决**：
  1. 检查 `.env` 中 `VITE_SERVER_ORIGIN` 是否正确
  2. 清空浏览器 Cookie，重新登录
  3. 检查后端日志中的 Cookie 设置情况

#### 实验室管理页面为空
- **原因**：数据库中无实验室数据
- **解决**：运行 `npx tsx scripts/seed.mjs` 初始化测试数据

---

## 许可证

MIT License

## Phase 2 - 扩展功能

### 优先级 1.1: 设备管理模块 (2.1.3) - ✅ 已完成

#### 功能概述
实验室设备信息的完整管理系统，支持设备的创建、编辑、删除和查询。

#### 访问地址
- **URL**: `/admin/devices`
- **权限**: 仅管理员可访问

#### API 端点

**公开查询**：
```bash
GET /trpc/device.list
GET /trpc/device.getById?input={"id":1}
GET /trpc/device.listByLab?input={"labId":1}
```

**管理操作** (需要 admin 权限)：
```bash
POST /trpc/device.create
POST /trpc/device.update
POST /trpc/device.delete
```

#### 数据模型

**lab_devices 表**：
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INT | 主键 (自增) |
| labId | INT | 所属实验室 (FK) |
| deviceNo | VARCHAR(50) | 设备编号 (唯一) |
| name | VARCHAR(100) | 设备名称 |
| type | VARCHAR(50) | 设备类型 |
| purchaseDate | TIMESTAMP | 购置日期 |
| status | ENUM | 状态: available/maintenance/retired |
| description | TEXT | 设备说明 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

#### 关键特性
- ✅ 设备状态追踪 (可用/维修中/报废)
- ✅ 按实验室关联查询
- ✅ 权限控制 (查询公开，修改限制管理员)
- ✅ 完整的数据验证
- ✅ 级联删除规则

#### 已知 Bug 修复

**问题**：添加设备时不选择日期导致插入失败
**修复**：
1. 前端：增加空字符串和日期有效性检查
2. 后端：显式数据清理，只向数据库发送有效值

#### 测试覆盖

- ✅ 设备 CRUD 操作 (11 个测试)
- ✅ 权限控制 (admin/user)
- ✅ 数据验证 (必填项、状态枚举)
- ✅ 总测试通过率：100% (29/29)

#### 下一步规划

**优先级 1.2** - 统计分析增强 (2.1.6) - ✅ 已完成
- ✅ 实验室使用率统计
- ✅ 预约活跃度排行
- ✅ 时间段分析
- ✅ 数据导出 (CSV 格式)

**优先级 2.1** - 通知与提醒 (2.1.7)
- 预约状态通知
- 消息中心
- 提醒管理
- 预计时间：2-3 天

**优先级 2.2** - 系统日志 (2.1.8)
- 操作审计日志
- 日志查询与统计
- 预计时间：2 天

---

### 优先级 1.2: 统计分析增强模块 (2.1.6) - ✅ 已完成

#### 功能概述
为管理员提供全面的数据分析仪表板，支持多维度统计分析、趋势展示和数据导出功能。

#### 访问地址
- **URL**: `/admin/statistics`
- **权限**: 仅管理员可访问
- **导航集成**: 所有管理页面均有导航链接

#### 核心特性

1. **📊 统计摘要** - 关键指标一览
   - 总预约数、已批准、待审核、参与用户数

2. **🏢 实验室使用统计** - 柱状图展示
   - 各实验室的预约总数、批准数

3. **👥 用户活跃度排行** - Top 10 排行榜
   - 按预约数量降序排列
   - 显示预约总数、批准数、使用时长

4. **📈 时间趋势分析** - 折线图展示
   - 每日预约数总量
   - 每日批准数趋势

5. **🎯 预约状态分布** - 饼图展示
   - 待审核、已通过、已拒绝等状态占比

6. **💾 数据导出**
   - 支持 CSV 格式导出
   - 支持导出实验室数据、用户数据

#### API 端点 - 统计查询接口

所有端点都需要 `adminProcedure` 权限检查。

**请求格式**：
```typescript
input: {
  startDate: Date,    // 开始日期
  endDate: Date,      // 结束日期
  limit?: number      // 返回条数（userActivity 专用）
}
```

##### 1. `statistics.summary` - 获取统计摘要
```bash
GET /trpc/statistics.summary?input={"startDate":"2024-01-01","endDate":"2024-12-31"}
```

**返回数据**：
```typescript
{
  totalReservations: number,      // 总预约数
  approvedReservations: number,   // 已批准数
  pendingReservations: number,    // 待审核数
  rejectedReservations: number,   // 已拒绝数
  totalUsers: number,             // 参与用户总数
  totalLabs: number,              // 涉及实验室总数
  totalHours: number              // 总使用时长（小时）
}
```

##### 2. `statistics.labUsage` - 获取实验室使用统计
```bash
GET /trpc/statistics.labUsage?input={"startDate":"2024-01-01","endDate":"2024-12-31"}
```

**返回数据**（数组）：
```typescript
[
  {
    labId: number,
    labName: string,
    totalReservations: number,
    approvedReservations: number,
    totalHours: number
  },
  // ...
]
```

##### 3. `statistics.userActivity` - 获取用户活跃度排行
```bash
GET /trpc/statistics.userActivity?input={
  "startDate":"2024-01-01",
  "endDate":"2024-12-31",
  "limit":10
}
```

**返回数据**（数组，按预约数降序）：
```typescript
[
  {
    userId: number,
    userName: string,
    totalReservations: number,     // 预约总数（降序）
    approvedCount: number,
    totalHours: number
  },
  // 最多返回 limit 条数据
]
```

##### 4. `statistics.timeDistribution` - 获取预约时间分布
```bash
GET /trpc/statistics.timeDistribution?input={
  "startDate":"2024-01-01",
  "endDate":"2024-12-31"
}
```

**返回数据**（数组，按日期排序）：
```typescript
[
  {
    date: string,           // YYYY-MM-DD 格式
    count: number,          // 该日期总预约数
    approvedCount: number,  // 该日期批准数
    pendingCount: number    // 该日期待审核数
  },
  // ...
]
```

##### 5. `statistics.statusStatistics` - 获取预约状态统计
```bash
GET /trpc/statistics.statusStatistics?input={
  "startDate":"2024-01-01",
  "endDate":"2024-12-31"
}
```

**返回数据**（数组）：
```typescript
[
  {
    status: string,         // pending/approved/rejected/cancelled/completed
    count: number,          // 该状态的预约数
    totalHours: number      // 该状态的总时长
  },
  // ...
]
```

#### 前端组件结构

**StatisticsDashboard.tsx** (318 行)
```
├── 导航栏
├── 标题和描述
├── 时间范围选择器 + 导出按钮
├── 摘要卡片 (4 个 KPI)
└── 图表区域 (2x2 网格)
    ├── 预约状态分布 (饼图)
    ├── 预约时间趋势 (折线图)
    ├── 实验室使用统计 (柱状图)
    └── 用户活跃度排行 (水平柱状图)
```

#### 数据导出功能

**Export.ts** - 导出工具库
```typescript
exportToCSV(data: any[], filename: string)
exportToJSON(data: any[], filename: string)
```

**特性**：
- ✅ BOM 编码支持中文
- ✅ 特殊字符自动转义
- ✅ 浏览器原生 Blob API
- ✅ 自动触发下载

**使用示例**：
```typescript
// 导出实验室使用统计
exportToCSV(labUsageData, `实验室使用统计_${startDate}_${endDate}`);

// 导出用户活跃度排行
exportToCSV(userActivityData, `用户活跃度_${startDate}_${endDate}`);
```

#### 测试覆盖

- ✅ Summary 数据结构验证
- ✅ Lab Usage 数据完整性
- ✅ User Activity 排序验证
- ✅ Time Distribution 时间序列
- ✅ Status Statistics 状态分类
- ✅ 非负数验证
- ✅ 数据聚合一致性
- ✅ 日期范围处理
- ✅ 空数据集处理
- ✅ **总测试数**：12 个（100% 通过）

**总体测试结果**：✅ **41/41 通过** (12 个新统计测试 + 29 个现有测试)

#### 性能优化

1. **数据库层**：
   - SQL 聚合函数 (COUNT, SUM, DATE)
   - 数据库端日期过滤
   - DISTINCT 去重

2. **应用层**：
   - tRPC 缓存机制
   - 延迟加载数据
   - 条件过滤

3. **前端层**：
   - Recharts 库优化
   - 响应式设计
   - 客户端导出

#### 权限与安全

- ✅ adminProcedure 权限检查
- ✅ 非管理员自动重定向
- ✅ 服务器端日期验证
- ✅ 数据库查询优化

---

## 技术支持

如有问题或建议，请查阅项目文档或联系开发团队。

---

## 项目标准

- 开发规范：见 `DEVELOPMENT_RULES.md`
- 单元测试汇总：见 `TEST_SUMMARY.md`
- 开发日志（仅错误与解决方案）：见 `DEVELOPMENT_LOG.md`

上述三份文档与本总说明共同构成项目文档体系：
- `COMPLETE_DOCUMENTATION.md` 负责架构、接口、部署与使用说明
- `DEVELOPMENT_RULES.md` 约束开发流程与质量门槛（代码、分支、评审、测试）
- `TEST_SUMMARY.md` 汇总各模块测试用例与最近状态（发布前必须更新）
- `DEVELOPMENT_LOG.md` 仅记录错误、原因、解决方案与关键学习（包含三个开发阶段）

---

## 下一阶段开发规划（Phase 4）

### 阶段定位

- 阶段名称：Phase 4 – 管理与决策能力增强
- 阶段目标：在已完成预约流程、冲突检测、通知、设备管理和统计仪表板的基础上，进一步提升系统在“流程治理、风险管控和决策支持”方面的能力，让系统从“能用”升级为“好管、可追责、可度量”。

### 目标模块与优先级

本阶段围绕三个优先级层级进行推进：

**P0（必须完成）**
- 审批与违规则管理模块
- 审计日志与安全透明模块

**P1（强烈推荐本阶段完成）**
- 角色扩展与教学场景模块
- 实验室与设备资源管理增强（在已有设备管理基础上补齐“开放规则/维护期/禁用时段”等治理能力）

**P2（视时间与资源择机推进）**
- 日历与可视化调度模块
- AI 智能增强模块（在现有润色与洞察能力上的“调度/建议”升级）

### 模块概述

#### 1. 审批与违规则管理模块（P0）

- 模块目标：在现有“学生申请 → 管理员审核”基础上，引入可配置审批流程、改签能力与违约/黑名单管理，使预约流程具备更强的约束与容错性。
- 关键能力：
  - 多级审批（如：教师/课题负责人 → 实验室管理员），可按实验室/课程配置启用与否。
  - 改签规则：在允许的时间窗口内调整预约时间或实验室，并可配置是否触发重新审核。
  - 违约与黑名单：定义“爽约/临时取消/超时未签退”等违约行为，累计计分并触发阶段性的预约限制。
- 典型场景：课程实验审批、贵重设备使用前的多级把关、多次爽约学生的使用限制。

#### 2. 审计日志与安全透明模块（P0）

- 模块目标：让系统的关键操作“可追踪、可解释”，支撑运维排查和校内治理要求。
- 关键能力：
  - 审计范围：登录与权限变更、预约审核/强制取消、违约清零与黑名单操作、规则配置修改、统计报表导出等。
  - 审计视图：提供按时间、操作人、操作类型等维度的查询与过滤能力，可查看单条预约/规则的完整操作历史。
- 典型场景：
  - 追踪“某预约为何被强制取消”以及“谁在何时操作”。
  - 回溯“某条规则从何时起被修改导致大量拒绝”的决策链路。

#### 3. 角色扩展与教学场景模块（P1）

- 模块目标：从“学生/管理员”升级为“学生/教师/实验室管理员/系统管理员”等更贴近高校实际的角色体系，并支持以课程/课题为载体的预约与管理模式。
- 关键能力：
  - 角色扩展：Teacher、LabAdmin、SysAdmin 等角色的权限边界与专属视图。
  - 教学场景支持：以“课程”为单位进行批量预约，学生通过“报名/占位”加入；教师可查看名下课程和学生使用情况。
- 典型场景：
  - 教师为整班同学统一申请实验室时段，学生只需确认参与。
  - 实验室管理员仅管理自己负责的实验室与相关预约。

#### 4. 实验室与设备资源管理增强模块（P1）

- 模块目标：在已实现设备管理和基础预约的前提下，引入资源开放规则、维护期与禁用时段管理，使资源管理更符合真实运维场景。
- 关键能力：
  - 资源开放规则：按工作日/周末/节假日配置开放时段。
  - 特殊时期控制：支持考试周、维护期等特殊时间段的统一禁用或策略调整。
  - 设备与实验室联动：当设备或实验室进入维护状态时，对新预约行为施加合理约束（例如禁止预约或仅允许已审核预约继续）。
- 典型场景：
  - 某栋楼实验室因改造在一段时间内全部关闭。
  - 某台大型设备进入维护状态期间暂停预约。

#### 5. 日历与可视化调度模块（P2）

- 模块目标：为实验室管理员和教师提供直观的周/月视图，展示资源占用情况，并支持从可视化视角发起或调整预约。
- 关键能力：
  - 资源日历：按实验室/设备/课程维度切换视图，查看时间区间内的预约分布。
  - 可视化操作（可选）：从日历视图快速发起预约或对部分预约进行时间调整（受审批与规则限制）。
- 典型场景：
  - 管理员通过周视图快速找到空档时段做集中排期。
  - 教师查看与自己课程相关的预约分布。

#### 6. AI 智能增强模块（P2）

- 模块目标：在现有“理由润色”和“管理洞察报告”基础上，引入智能调度建议与更结构化的管理报告，进一步提高决策效率。
- 关键能力：
  - 智能推荐时间与实验室：在学生创建预约或教师批量预约时，根据历史数据与当前规则给出推荐方案。
  - 智能管理报告：按周/月生成结构化的“实验室使用分析 + 问题点 + 优化建议”，供管理层参考。
- 典型场景：
  - 学生创建预约时看到系统推荐的“较不拥挤、冲突风险低”的时段与实验室。
  - 管理员周期性查看 AI 生成的管理建议，并据此调整开放策略或资源配置。

### 阶段验收标准（Phase 4）

- 流程与治理：
  - 典型审批流程（单级/多级）、违约限制与黑名单策略在真实业务场景下可用且可配置。
  - 关键操作在审计日志中可被完整追踪，并可通过前端页面检索和查看详情。
- 管理与教学场景：
  - 至少一种教学场景（按课程/课题管理预约）在系统中可顺畅完成。
  - 资源开放与维护规则能够覆盖典型的“假期关闭/维护停用”等场景。
- 体验与决策：
  - 管理员可以在不查阅数据库的情况下，从系统中获取足够的决策信息（统计仪表板 + 审计日志 + AI 报告，视完成范围而定）。

---

**最后更新**：2025年12月20日 22:35  
**项目版本**：1.4.0 (Phase 4.P0 实现完成)  
**开发状态**：Phase 4 P0 模块（审批与违约管理、审计日志与安全透明）已完全实现并通过所有 39 个单元测试。关键特性已在后端完成：多级审批配置、违约积分与自动黑名单、审计日志完整跟踪。待完成：P1 角色扩展、P1 资源管理增强、P2 日历与 AI 模块。
