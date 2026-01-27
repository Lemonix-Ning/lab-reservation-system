# 系统架构与设计规范

## 技术栈

### 核心技术
- **Runtime**: Node.js 22.13.0  
- **Language**: TypeScript 5.9.3 (strict mode enabled)  
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

### 后端技术
- **Web Server**: Express 4.21.2  
- **API Layer**: tRPC 11.6.0 (end-to-end type safety)  
- **Auth**: OAuth (统一认证平台) + Cookie Session  
- **AI Integration**: 讯飞星火 Spark X1.5 (HTTP REST API)  

---

## 模块分层策略

### Client (`client/`)
**职责**: 前端 UI、用户交互、状态管理、API 调用

**关键目录**:
```
client/src/
├── pages/           # 页面组件（路由级）
├── components/      # 可复用组件
├── hooks/           # 自定义 Hooks（含 useReservationRules.ts）
├── contexts/        # React Context（RoleContext, ThemeContext）
├── lib/             # 工具函数（trpc.ts, utils.ts, export.ts）
└── _core/           # 核心抽象层（useAuth.ts）
```

**重要原则**:
- 所有 API 调用必须通过 `trpc` 客户端（不直接 fetch）
- 共享类型从 `shared/` 导入，避免复制定义
- UI 组件使用 shadcn/ui，保持设计一致性
- 权限检查：前端仅作引导，真实鉴权在后端

---

### Server (`server/`)
**职责**: 业务逻辑、数据访问、权限控制、外部服务集成

**关键文件**:
```
server/
├── routers.ts       # tRPC API 路由定义（80+ endpoints）
├── db.ts            # 数据访问层（所有 SQL 查询集中处理）
├── _core/           # 核心基础设施
│   ├── trpc.ts      # tRPC 中间件配置（protectedProcedure, adminProcedure）
│   ├── oauth.ts     # OAuth 认证流程
│   ├── xfspark.ts   # 讯飞星火 AI 集成
│   └── context.ts   # tRPC Context 构建（用户会话）
└── *.test.ts        # 单元测试（18+ 测试文件）
```

**重要原则**:
- **数据流向**: `drizzle/schema.ts` → `server/db.ts` → `server/routers.ts`
- **权限模式**: 使用 `protectedProcedure` / `adminProcedure`（不绕过）
- **业务规则**: 从数据库 `lab_reserve_rules` 表读取，不硬编码常数
- **AI 密钥**: 仅后端持有，前端通过 tRPC `ai.*` 调用

---

### Shared (`shared/`)
**职责**: 跨前后端共享的类型定义、常量、工具函数

**关键文件**:
```
shared/
├── types.ts         # 共享类型（User, LabRoom, Reservation 等）
├── const.ts         # 全局常量（USER_ROLES, RESERVATION_STATUS）
└── _core/
    └── errors.ts    # 错误类型定义
```

**重要原则**:
- **单一来源**: 所有业务类型必须定义在此，避免前后端分别定义
- **Drizzle Infer**: 优先使用 `typeof schema.$inferSelect`，避免手动维护
- **导入规范**: 前后端都从 `shared/` 导入，使用绝对路径

---

### Drizzle (`drizzle/`)
**职责**: 数据库 Schema 定义、迁移历史

**关键文件**:
```
drizzle/
├── schema.ts        # 数据模型定义（16+ 表）
├── relations.ts     # 表关系定义
└── meta/
    ├── _journal.json
    └── 000X_snapshot.json
```

**重要原则**:
- **Schema 优先**: 所有表结构变更先修改 `schema.ts`，然后执行 `pnpm db:push`
- **类型导出**: 使用 `export type User = typeof users.$inferSelect`
- **迁移策略**: 开发阶段使用 `drizzle-kit push`，生产使用 `drizzle-kit migrate`

---

## 设计规范

### UI/UX 设计规则（来自 view设计.md）

#### 色彩系统
```css
Primary (主色):       #2563EB (bg-blue-600)    → 主按钮、选中状态
Secondary (次主色):   #4F46E5 (bg-indigo-600)  → AI 功能、数据图表
Success (成功):       #166534 (text-green-800) → "已通过"状态
Warning (警告):       #D97706 (text-amber-600) → "待审核"状态
Danger (危险):        #991B1B (text-red-800)   → "已拒绝"状态
Background (背景):    #F9FAFB (bg-gray-50)     → 全局页面背景
Surface (表面):       #FFFFFF (bg-white)       → 卡片、弹窗背景
Border (边框):        #F3F4F6 (border-gray-100) → 极淡分隔线
```

#### 布局规范
- **卡片容器**: `bg-white p-6 rounded-2xl shadow-sm border border-gray-100`
- **圆角**: 卡片 `rounded-2xl` (16px), 按钮 `rounded-lg` (8px), 标签 `rounded-full`
- **阴影**: 默认 `shadow-sm`, Hover `shadow-md` + `scale-105`
- **间距**: 统一使用 Tailwind spacing scale（p-4, p-6, gap-4）

#### 状态标签（Badges）
```typescript
// 统一使用 Pill 形状
pending:    bg-yellow-100 + text-yellow-800 + border-yellow-200
approved:   bg-green-100  + text-green-800  + border-green-200
rejected:   bg-red-100    + text-red-800    + border-red-200
cancelled:  bg-gray-100   + text-gray-800   + border-gray-200
completed:  bg-blue-100   + text-blue-800   + border-blue-200
```

#### 图标规范
- **库**: 统一使用 `lucide-react`（禁止 Emoji）
- **尺寸**: 默认 `h-4 w-4` 或 `h-5 w-5`，强调图标 `h-6 w-6`
- **语义色**:
  - Success: `text-green-600` (通过/成功)
  - Warning: `text-amber-600` (提醒/注意)
  - Danger: `text-red-600` (拒绝/错误)
  - Info: `text-blue-600` (系统通知)

#### 图表规范
- **配色序列**: `#4F46E5` (主数据) → `#10B981` (成功) → `#F59E0B` (警告) → `#EF4444` (错误)
- **柱状图**: 圆角柱顶 `radius: [4, 4, 0, 0]`
- **折线图**: 平滑曲线 `type="monotone"`，渐变填充
- **网格线**: 虚线 `strokeDasharray="3 3"` 或完全移除
- **Tooltip**: 自定义白色背景，圆角，阴影

---

### 数据库设计规范（来自 DATABASE.md）

#### 表命名规范
- **前缀统一**: 所有表使用 `lab_` 前缀（如 `lab_rooms`, `lab_reservations`）
- **复数形式**: 表名使用复数（`users`, `courses`, `devices`）
- **关联表**: 使用下划线连接（`course_students`, `class_students`）

#### 字段设计规范
```typescript
// Timestamp 模式（P2-2 新增，必须遵守）
createdAt: timestamp("createdAt").defaultNow().notNull()
updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()

// Enum 使用 mysqlEnum（不用 VARCHAR）
status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull()

// 外键使用 int + 表名 + Id
userId: int("userId").notNull()  // 关联 users.id
labId: int("labId").notNull()    // 关联 lab_rooms.id
```

#### 索引策略（Phase 7 优化）
- **分层索引**: Tier 1 (高频查询) → Tier 2 (中频) → Tier 3 (低频)
- **复合索引**: 查询条件多字段组合（如 `(labId, startTime, status)`）
- **验证方法**: 使用 `EXPLAIN SELECT` 验证执行计划
- **性能权衡**: 索引提升读性能，但影响写性能（当前 76+ 新索引，平均提升 84%）

#### 数据完整性
- **级联删除**: 谨慎使用，优先软删除（status = 'deleted'）
- **事务处理**: 涉及多表操作必须使用事务（`db.transaction()`）
- **并发控制**: 关键操作（如违约计分）使用乐观锁或 `FOR UPDATE`

---

### 核心编码原则（来自 DEVELOPMENT_RULES.md）

#### 代码风格
```typescript
// 命名约定
变量/函数:  camelCase (getReservationById, userId)
组件/类型:  PascalCase (LabRoomList, InsertUser)
常量:       UPPER_SNAKE (MAX_PER_DAY, ADVANCE_DAYS)

// 导入顺序
import React from 'react';              // 1. 第三方库
import { trpc } from '@/lib/trpc';      // 2. shared 或项目内绝对路径
import { Button } from './ui/button';   // 3. 相对路径组件
```

#### TypeScript 严格模式
```typescript
// tsconfig.json → strict: true
// 避免 any（确需使用需加注释）
const data: any; // ❌ 禁止

const data: unknown; // ✅ 推荐
if (typeof data === 'object') { ... }
```

#### Git 提交规范
```bash
# 提交信息格式
type(scope): subject

# 示例
feat(calendar): add conflict detection with alternative slots
fix(auth): resolve cookie sameSite policy for cross-origin
docs(readme): update quick start section
test(reservation): add unit tests for rule validation
```

#### 测试覆盖要求
- **后端**: 路由权限、输入校验、核心业务函数、SQL 聚合正确性
- **前端**: 关键交互、状态管理、权限显示、极端边界（空数据）
- **日历组件**: 冲突检测逻辑、多维度查询、事件详情完整性
- **门槛**: `pnpm check` 无错误 + `pnpm test` 全部通过 + 重要视图手动冒烟测试

---

## React Query 缓存策略（P2-2 新增）

### 缓存配置
```typescript
// 静态资源数据（变化少）
labsData:     { staleTime: 60min, gcTime: 120min }
devicesData:  { staleTime: 60min, gcTime: 120min }

// 动态资源数据
coursesData:  { staleTime: 30min, gcTime: 60min }

// 日历数据（频繁查看）
calendarData: { staleTime: 10min, gcTime: 30min }

// 实时数据（冲突检测）
conflictChecks: { staleTime: 5min }

// 统计数据
utilizationData: { staleTime: 15min, gcTime: 60min }
```

### 缓存刷新规范
```typescript
// ✅ 正确：使用 exact: false 刷新所有子查询
queryClient.invalidateQueries({ 
  queryKey: ['reservation'], 
  exact: false 
});
// 覆盖: ['reservation', 'allList', ...]、['reservation', 'detail', ...]

// ❌ 错误：使用 exact: true 导致缓存不完全刷新
queryClient.invalidateQueries({ 
  queryKey: ['reservation', 'allList'], 
  exact: true 
});
```

---

## 安全与权限

### tRPC 权限中间件
```typescript
// 公共端点（无需登录）
publicProcedure
  .input(z.object({ ... }))
  .query(async ({ input }) => { ... });

// 登录后端点（需要有效会话）
protectedProcedure
  .input(z.object({ ... }))
  .query(async ({ ctx, input }) => {
    const user = ctx.user; // 已鉴权用户
    // ...
  });

// 管理员端点（仅 labAdmin/sysAdmin）
adminProcedure
  .input(z.object({ ... }))
  .mutation(async ({ ctx, input }) => {
    // ctx.user.role 已验证为管理员
    // ...
  });
```

### Cookie 策略
```typescript
// 开发环境
sameSite: 'lax'
secure: false
httpOnly: true

// 生产环境
sameSite: 'none'
secure: true
httpOnly: true
```

### 前端权限检查
```typescript
// ✅ 正确：前端仅作引导，真实鉴权在后端
if (user?.role === 'labAdmin' || user?.role === 'sysAdmin') {
  return <AdminPanel />; // 显示管理界面
}
return <Navigate to="/unauthorized" />; // 重定向

// 后端再次验证（adminProcedure 中间件）
```

---

## 环境变量规范

### 前端环境变量（`.env`）
```bash
# 必须使用 VITE_ 前缀
VITE_API_BASE_URL=http://localhost:3000
VITE_OAUTH_CLIENT_ID=your_client_id

# 访问方式
import.meta.env.VITE_API_BASE_URL
```

### 后端环境变量（`.env`）
```bash
# 数据库
DATABASE_URL=mysql://user:pass@localhost:3306/lab_reservation_db

# OAuth
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret

# AI 服务
XFSPARK_API_KEY=your_api_key
XFSPARK_BASE_URL=https://spark-api-open.xf-yun.com/v1

# 访问方式
process.env.DATABASE_URL
```

### 安全注意事项
- `.env` 文件仅用于本地开发，不提交仓库
- 示例配置写入 `README.md` 的 "环境要求" 章节
- 生产环境使用环境变量注入（不使用 `.env` 文件）

---

## 常用命令速查

### 开发运行
```bash
pnpm install                              # 安装依赖
pnpm db:push                              # 生成/同步迁移（基于 schema.ts）
npx tsx scripts/seed.mjs                  # 初始化测试数据
pnpm dev                                  # 启动后端（PORT 3000）
pnpm client:dev                           # 启动前端（PORT 5173）
```

### 质量检查
```bash
pnpm check                                # TypeScript 类型检查
pnpm test                                 # 运行 Vitest（18+ 测试用例）
pnpm format                               # Prettier 格式化代码
```

### 数据库管理
```bash
pnpm db:push                              # 同步 schema 到数据库
npx tsx scripts/fix-role-enum.ts          # 修复 role enum 问题
npx tsx scripts/seed-comprehensive.ts     # 导入完整测试数据
pnpm db:reset                             # 清空并重建数据库
```

---

## 扩展开发指引

### 新增表
1. 在 `drizzle/schema.ts` 定义表结构
2. 导出类型 `export type NewTable = typeof newTable.$inferSelect`
3. 执行 `pnpm db:push` 同步数据库
4. 在 `server/db.ts` 添加 CRUD 函数
5. 在 `server/routers.ts` 添加 tRPC 端点
6. 在 `shared/types.ts` 添加共享类型（如需）

### 新增页面
1. 在 `client/src/pages/` 创建页面组件
2. 在 `client/src/App.tsx` 添加路由
3. 在 `client/src/components/DashboardLayout.tsx` 添加导航菜单
4. 在 `client/src/contexts/RoleContext.tsx` 配置权限控制

### 新增 API
1. 在 `server/routers.ts` 定义 tRPC 路由
2. 使用 `z.object()` 定义输入验证
3. 选择合适的中间件（publicProcedure / protectedProcedure / adminProcedure）
4. 前端通过 `trpc.xxx.useQuery()` 或 `trpc.xxx.useMutation()` 调用

---

**最后更新**: 2026-01-14  
**文档版本**: v1.0.0
