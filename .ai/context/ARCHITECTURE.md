# 系统架构与设计规范

## 技术栈

### 核心技术
- **Runtime**: Node.js 22.13.0  
- **Language**: TypeScript 5.9.3 (strict mode)  
- **Build Tool**: Vite 7.1.7  
- **Package Manager**: pnpm workspace  
- **ORM**: Drizzle ORM 0.44.5  
- **Database**: MySQL  
- **Test Framework**: Vitest  

### 前端技术
- **Framework**: React 19.1.1  
- **State Management**: TanStack Query 5.90.2 + React Context  
- **Router**: Wouter 3.3.5  
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS 4.1.14)  
- **Charts**: Recharts 2.15.2  
- **Forms**: React Hook Form 7.64.0 + Zod 4.1.12  
- **Excel**: xlsx 库（排课导入）

### 后端技术
- **Web Server**: Express 4.21.2  
- **API Layer**: tRPC 11.6.0 (end-to-end type safety)  
- **Auth**: OAuth (统一认证平台) + Cookie Session  
- **AI Integration**: 讯飞星火 Spark X1.5 (HTTP REST API)  

---

## 模块分层策略

## 线上部署现状（2026-03）

- 仓库内容器化配置已具备（`Dockerfile`、`docker-compose.yml`、`init-ssl.sh`）。
- ECS 当前处于“域名健康恢复”阶段：仅系统 nginx 提供 HTTP 占位页。
- 当前线上并非容器化运行：服务器尚未安装 Docker，443 尚未启用。
- 近期目标是先维持 `http://lemonix.loc.cc` 连续可访问，待 suspended 恢复后再切正式容器部署。

### Client (`client/`)
**职责**: 前端 UI、用户交互、状态管理、API 调用

**关键目录**:
```
client/src/
├── pages/           # 页面组件（33 个，路由级）
├── components/      # 可复用组件（含 ScheduleImport.tsx）
├── hooks/           # 自定义 Hooks（useReservationRules.ts）
├── contexts/        # React Context（Role/Permission/Theme）
├── lib/             # 工具函数（trpc.ts, utils.ts, export.ts）
└── _core/           # 核心抽象层（useAuth.ts）
```

**重要原则**:
- 所有 API 调用必须通过 `trpc` 客户端
- 共享类型从 `shared/` 导入
- UI 组件使用 shadcn/ui
- 权限检查：前端仅作引导，真实鉴权在后端

---

### Server (`server/`)
**职责**: 业务逻辑、数据访问、权限控制、外部服务集成

**关键文件**:
```
server/
├── routers.ts       # tRPC API 路由（80+ endpoints，~3370 行）
├── db.ts            # 数据访问层（所有 SQL 查询，~4191 行）
├── db-3l.ts         # 3L 推荐算法（178 行，暂未启用）
├── storage.ts       # 文件存储
├── _core/           # 核心基础设施
│   ├── trpc.ts      # tRPC 中间件（protected/admin/permission）
│   ├── oauth.ts     # OAuth 认证
│   ├── xfspark.ts   # 讯飞星火 AI
│   └── context.ts   # tRPC Context
└── *.test.ts        # 单元测试（7 个文件）
```

**重要原则**:
- **数据流向**: `drizzle/schema.ts` → `server/db.ts` → `server/routers.ts`
- **权限模式**: `protectedProcedure` / `adminProcedure` / `createPermissionProcedure()`
- **业务规则**: 从数据库 `lab_reserve_rules` 表读取
- **AI 密钥**: 仅后端持有

---

### Shared (`shared/`)
**职责**: 前后端共享类型、常量

```
shared/
├── types.ts         # 共享类型（User, LabRoom, Reservation 等）
├── const.ts         # 全局常量
└── _core/errors.ts  # 错误类型
```

---

### Drizzle (`drizzle/`)
**职责**: Schema 定义、迁移历史

```
drizzle/
├── schema.ts        # 表结构（~625 行，18+ 表）
├── relations.ts     # 表关系
├── 0000~0015_*.sql  # 迁移文件（16 个）
└── meta/            # 迁移元数据
```

**注意**:
- `semester_configs.startDate/endDate` 使用 `date("...", { mode: "date" })`（非 timestamp）
- Schema 变更 → `pnpm db:push` → 自动生成迁移

---

## 核心模块架构

### 课程排课系统（P2-4，2026-02 新增）

**数据模型**:
```
semester_configs   → 学期配置（startDate, endDate, weekCount, isCurrent）
course_schedules   → 排课记录（courseId, labId, teacherId, dayOfWeek, period, weekStart~weekEnd）
courses            → 课程信息
course_students    → 选课关系
```

**数据流**:
```
scripts/seed.ts           → 播种演示数据（51 条排课）
ScheduleImport.tsx        → Excel 解析 → batchImportSchedules API
routers.ts                → course.batchImportSchedules / getScheduleBoard
db.ts                     → getAllApprovedSchedules() / getPeriodTimeMapping()
ScheduleBoard.tsx         → 周视图渲染（前端 allSchedules 过滤）
StudentCourses.tsx        → 学生课表 + 选课
```

**关键设计**:
- 实验室筛选：前端从 allSchedules 提取 scheduledLabs，不传 labId 到 API
- 周计算：`useEffect` + computedCurrentWeek（非 useState）
- 节次映射：`getPeriodTimeMapping()` 返回 `{1: "08:00-09:40", ...}`

---

### 3L 智能推荐算法（暂未启用）

**位置**: `server/db-3l.ts`（178 行，独立文件，避免 esbuild 解析问题）

**算法**:
```
Lab 适配度 (40%):  容量匹配 + 课程关联度
Load 负载 (35%):   7 日预约密度（越低越好）
Like 偏好 (25%):   用户历史使用频率
```

**恢复步骤**:
1. `server/routers.ts`: 取消 `// [3L]` 标记的注释
2. `client/src/pages/LabRoomList.tsx`: 取消 `// [3L]` 标记的注释
3. 确保 routers.ts 中 import `{ getLabRecommendations } from './db-3l'`

---

### 动态权限系统（P2-3）

**权限代码**（14 项）:
```
lab:manage, device:manage, reservation:approve, schedule:approve,
course:manage, rule:manage, user:manage, statistics:view,
violation:manage, audit:view, geofence:manage, class:manage,
checkin:teacher, system:settings
```

**检查逻辑**（`createPermissionProcedure()`）:
1. sysAdmin → 始终拥有所有权限
2. fallbackRoles 数组中的角色 → 默认拥有
3. 其他角色 → 查询 role_permissions 表

---

## 设计规范

### UI/UX 设计规则

#### 色彩系统
```
Primary:     #2563EB (bg-blue-600)    → 主按钮、选中
Secondary:   #4F46E5 (bg-indigo-600)  → AI、图表
Success:     #166534 (text-green-800)  → "已通过"
Warning:     #D97706 (text-amber-600)  → "待审核"
Danger:      #991B1B (text-red-800)    → "已拒绝"
Background:  #F9FAFB (bg-gray-50)     → 页面背景
Surface:     #FFFFFF (bg-white)        → 卡片
```

#### 布局规范
- **卡片**: `bg-white p-6 rounded-2xl shadow-sm border border-gray-100`
- **圆角**: 卡片 `rounded-2xl`, 按钮 `rounded-lg`, 标签 `rounded-full`
- **图标**: 统一 `lucide-react`，默认 `h-4 w-4`

#### 状态标签
```
pending:    bg-yellow-100 + text-yellow-800
approved:   bg-green-100  + text-green-800
rejected:   bg-red-100    + text-red-800
cancelled:  bg-gray-100   + text-gray-800
completed:  bg-blue-100   + text-blue-800
```

---

### 数据库设计规范

#### 表命名
- 前缀: `lab_`（如 `lab_rooms`, `lab_reservations`）
- 复数: `users`, `courses`, `devices`
- 关联表: `course_students`, `class_students`

#### 字段设计
```typescript
createdAt: timestamp("createdAt").defaultNow().notNull()
updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
status: mysqlEnum("status", [...]).default("pending").notNull()
// 日期字段用 date()，非 timestamp()
startDate: date("startDate", { mode: "date" }).notNull()
```

#### 索引策略
- 76+ 索引，查询平均提升 84%
- 复合索引: `(labId, startTime, status)` 等
- FULLTEXT: `lab_reservations(title, reason)`

---

### 安全与权限

#### tRPC 中间件
```typescript
publicProcedure        // 公共端点
protectedProcedure     // 需登录
adminProcedure         // labAdmin/sysAdmin
createPermissionProcedure('code', ['fallbackRole'])  // 动态权限
```

#### Cookie 策略
```
开发: sameSite='lax', secure=false, httpOnly=true
生产: sameSite='none', secure=true, httpOnly=true
```

---

### React Query 缓存策略

```typescript
// 静态数据（实验室/设备）
{ staleTime: 60min, gcTime: 120min }

// 动态数据（日历/排课）
{ staleTime: 10min, gcTime: 30min }

// 实时数据（冲突检测）
{ staleTime: 5min }
```

```typescript
// ✅ 刷新所有子查询
queryClient.invalidateQueries({ queryKey: ['reservation'], exact: false });
```

---

## 依赖关系图

```
前端:
React 19 → TanStack Query + Wouter + shadcn/ui (Radix+Tailwind) + Recharts + tRPC Client

后端:
Node.js 22 → Express + tRPC + Drizzle ORM (MySQL) + Vitest + 讯飞星火

共享:
TypeScript 5.9, Zod 4, SuperJSON
```

---

## 数据库优化历史

- **P0**: 唯一约束 + 关键索引（0003）
- **P1**: 外键 + FULLTEXT（0004），TIME/TINYINT/ENUM 类型（0006/0007/0008）
- **P2**: 归档表 lab_reservations_archive（0009）
- **扩展**: user_oauth_bindings（0010），lab_geofences（0011），reservations_checkin（0012），teacher_mode（0013），role_permissions（0014），role_whitelist（0015）

---

**最后更新**: 2026-03-16  
**文档版本**: v1.3.1
