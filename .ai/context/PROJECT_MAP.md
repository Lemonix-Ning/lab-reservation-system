# 项目目录结构地图

## ASCII Tree（完整结构）

```
lab-reservation-system/
│
├── .ai/                              # ✨ AI 上下文体系（新）
│   └── context/
│       ├── ARCHITECTURE.md           # 架构与设计规范
│       ├── CURRENT_STATE.md          # 项目当前状态与进度
│       ├── PROJECT_MAP.md            # 本文件 - 目录结构地图
│       └── AI_RULES.md               # AI 编码助手指令
│
├── client/                           # 前端应用（React + Vite）
│   ├── index.html                    # HTML 入口
│   ├── public/                       # 静态资源
│   └── src/
│       ├── App.tsx                   # 应用根组件（路由配置）
│       ├── main.tsx                  # 应用入口（React 渲染）
│       ├── index.css                 # 全局样式（Tailwind 导入）
│       ├── const.ts                  # 前端常量
│       │
│       ├── _core/                    # 核心抽象层
│       │   └── hooks/
│       │       └── useAuth.ts        # 认证状态管理 Hook
│       │
│       ├── components/               # UI 组件库
│       │   ├── AIChatBox.tsx         # AI 聊天框（讯飞星火集成）
│       │   ├── Calendar.tsx          # 日历组件（Recharts）
│       │   ├── DashboardLayout.tsx   # 管理后台布局
│       │   ├── ErrorBoundary.tsx     # 错误边界（捕获 React 错误）
│       │   ├── Map.tsx               # 地图组件（Google Maps）
│       │   ├── NotificationBell.tsx  # 通知铃铛（未读数量）
│       │   └── ui/                   # shadcn/ui 基础组件
│       │       ├── button.tsx
│       │       ├── dialog.tsx
│       │       ├── card.tsx
│       │       ├── calendar.tsx
│       │       ├── table.tsx
│       │       └── ... （40+ 组件）
│       │
│       ├── contexts/                 # React Context（全局状态）
│       │   ├── RoleContext.tsx       # 用户角色上下文（权限控制）
│       │   └── ThemeContext.tsx      # 主题上下文（暗黑/明亮模式）
│       │
│       ├── hooks/                    # 自定义 Hooks
│       │   ├── useComposition.ts     # 输入法组合事件处理
│       │   ├── useMobile.tsx         # 移动端检测
│       │   ├── usePersistFn.ts       # 函数引用持久化
│       │   └── useReservationRules.ts # ⭐ 预约规则检查（冲突/规则验证）
│       │
│       ├── lib/                      # 工具函数库
│       │   ├── export.ts             # 数据导出（HTML/iCalendar/PDF）
│       │   ├── trpc.ts               # tRPC 客户端配置
│       │   └── utils.ts              # 通用工具函数（cn, clsx）
│       │
│       └── pages/                    # 页面组件（路由级）
│           ├── Home.tsx              # 首页
│           ├── LabRoomList.tsx       # 实验室列表（学生预约入口）
│           ├── MyReservations.tsx    # 我的预约
│           ├── CalendarDashboard.tsx # ⭐ 日历管理（核心调度页面）
│           ├── ReservationManage.tsx # 预约审核（管理员）
│           ├── LabRoomManage.tsx     # 实验室管理
│           ├── DeviceManage.tsx      # 设备管理
│           ├── RuleManage.tsx        # 规则配置
│           ├── ApprovalConfig.tsx    # 审批配置
│           ├── ViolationManage.tsx   # 违约管理
│           ├── AuditLog.tsx          # 审计日志
│           ├── StatisticsDashboard.tsx # 统计仪表板
│           ├── CourseManage.tsx      # 课程管理（教师）
│           ├── StudentCourses.tsx    # 学生课程视图
│           ├── NotificationCenter.tsx # 通知中心
│           ├── ComponentShowcase.tsx  # UI 组件展示（开发用）
│           └── NotFound.tsx          # 404 页面
│
├── server/                           # 后端应用（Node + Express + tRPC）
│   ├── routers.ts                    # ⭐ tRPC API 路由（80+ 端点）
│   ├── db.ts                         # ⭐ 数据访问层（所有 SQL 查询）
│   ├── storage.ts                    # 文件存储（AWS S3）
│   │
│   ├── _core/                        # 核心基础设施
│   │   ├── index.ts                  # 服务器入口（Express + tRPC）
│   │   ├── trpc.ts                   # tRPC 配置（中间件、权限）
│   │   ├── context.ts                # tRPC Context 构建（用户会话）
│   │   ├── oauth.ts                  # OAuth 认证流程（统一平台）
│   │   ├── cookies.ts                # Cookie 管理工具
│   │   ├── xfspark.ts                # 讯飞星火 AI 集成
│   │   ├── env.ts                    # 环境变量加载
│   │   ├── vite.ts                   # Vite 开发服务器集成
│   │   ├── systemRouter.ts           # 系统路由（健康检查等）
│   │   ├── dataApi.ts                # 外部数据 API 封装
│   │   ├── sdk.ts                    # 第三方 SDK 封装
│   │   ├── map.ts                    # 地图服务（Google Maps API）
│   │   ├── notification.ts           # 通知推送服务
│   │   └── types/
│   │       ├── cookie.d.ts           # Cookie 类型定义
│   │       └── manusTypes.ts         # Manus 类型定义
│   │
│   └── *.test.ts                     # 单元测试（18+ 文件）
│       ├── reservation.test.ts       # 预约规则测试
│       ├── statistics.test.ts        # 统计分析测试
│       ├── device.test.ts            # 设备管理测试
│       ├── course.test.ts            # 课程管理测试
│       ├── approval.test.ts          # 审批流程测试
│       ├── alternative-slots.test.ts # 替代方案测试
│       ├── calendar-update.test.ts   # 日历更新测试
│       └── ...
│
├── shared/                           # ⭐ 共享代码（前后端通用）
│   ├── types.ts                      # 共享类型（User, LabRoom, Reservation）
│   ├── const.ts                      # 全局常量（USER_ROLES, RESERVATION_STATUS）
│   └── _core/
│       └── errors.ts                 # 错误类型定义
│
├── drizzle/                          # ⭐ 数据库 ORM 层
│   ├── schema.ts                     # 表结构定义（16+ 表）
│   ├── relations.ts                  # 表关系定义
│   ├── 0000_light_richard_fisk.sql   # 迁移文件
│   ├── 0001_handy_hellcat.sql        # 迁移文件
│   └── meta/                         # 迁移元数据
│       ├── _journal.json
│       ├── 0000_snapshot.json
│       └── 0001_snapshot.json
│
├── scripts/                          # 脚本工具
│   ├── mock-oauth.ts                 # OAuth Mock 服务器
│   ├── seed.mjs                      # 基础测试数据初始化
│   ├── seed-comprehensive.ts         # 完整测试数据
│   ├── seed-phase4-data.ts           # Phase 4 数据
│   ├── create-violation-users.ts     # 违约测试数据
│   └── fix-role-enum.ts              # 修复 role enum 问题
│
├── docs/                             # 📁 归档文档（待创建）
│   └── archive/                      # 旧文档归档目录
│       └── (将移动旧 .md 文件到此处)
│
├── .github/                          # GitHub 配置（当前文档位置）
│   ├── copilot-instructions.md       # 旧版 AI 助手指令（将被 .ai/ 替代）
│   ├── task.md                       # 任务清单（待整合）
│   ├── order.md                      # 订单逻辑？（待分析）
│   ├── view设计.md                   # UI 设计规范（已整合）
│   ├── DATABASE.md                   # 数据库设计（已整合）
│   ├── 设计文档.md                   # 设计文档（已整合）
│   ├── DEVELOPMENT_RULES.md          # 开发规范（已整合）
│   ├── conflict-filter-fix.md        # 冲突过滤修复（已整合）
│   ├── alternative-slots-fix.md      # 替代方案修复（已整合）
│   ├── calendar-enhancement-summary.md # 日历增强总结（已整合）
│   └── 论文.txt                      # 论文材料（待归档）
│
├── package.json                      # NPM 依赖配置（pnpm workspace）
├── pnpm-lock.yaml                    # pnpm 锁定文件
├── tsconfig.json                     # TypeScript 配置（strict mode）
├── vite.config.ts                    # Vite 构建配置
├── vitest.config.ts                  # Vitest 测试配置
├── drizzle.config.ts                 # Drizzle ORM 配置
├── components.json                   # shadcn/ui 配置
│
├── README.md                         # 项目说明文档（保留）
├── DEVELOPMENT_LOG.md                # 开发日志 - 错误与解决方案（保留）
├── TEST_SUMMARY.md                   # 测试汇总（保留）
└── text.md                           # 临时文本文件（待删除）
```

---

## 核心目录职责说明

### 📁 `.ai/context/` - AI 上下文体系（新增）
**用途**: 为 AI 编码助手提供标准化上下文，替代散乱的文档

**文件说明**:
- `ARCHITECTURE.md` - 技术栈、模块分层、设计规范、编码原则
- `CURRENT_STATE.md` - 待办事项、最近变更、风险评估、部署状态
- `PROJECT_MAP.md` - 本文件，目录结构与职责说明
- `AI_RULES.md` - Cursor Rules 精简指令

**使用场景**: AI 助手首次进入项目时阅读，快速了解架构与约定

---

### 📁 `client/` - 前端应用
**技术**: React 19 + Vite + Tailwind CSS + shadcn/ui

**核心文件**:
- `src/pages/CalendarDashboard.tsx` - 日历调度核心页面（1000+ lines）
- `src/hooks/useReservationRules.ts` - 规则检查与冲突验证 Hook
- `src/lib/trpc.ts` - tRPC 客户端配置（类型安全 API 调用）
- `src/lib/export.ts` - 数据导出工具（HTML/iCalendar/PDF）

**关键特性**:
- **响应式设计**: 移动端优化（`useMobile.tsx`）
- **权限控制**: `RoleContext.tsx` 动态菜单
- **错误处理**: `ErrorBoundary.tsx` 捕获渲染错误
- **AI 集成**: `AIChatBox.tsx` 讯飞星火对话

---

### 📁 `server/` - 后端应用
**技术**: Node.js + Express + tRPC + Drizzle ORM

**核心文件**:
- `routers.ts` - tRPC API 路由（80+ 端点，2000+ lines）
- `db.ts` - 数据访问层（所有 SQL 查询，2500+ lines）
- `_core/trpc.ts` - tRPC 中间件（`protectedProcedure`, `adminProcedure`）
- `_core/oauth.ts` - OAuth 认证流程
- `_core/xfspark.ts` - 讯飞星火 AI 集成（HTTP REST API）

**关键函数**:
```typescript
// db.ts 核心函数示例
checkReservationRules()            // 预约规则验证（次数/时长/提前天数）
getConflictingReservations()       // 冲突检测
getAlternativeTimeSlots()          // 智能替代方案推荐（L1883-2003）
createAuditLog()                   // 审计日志记录
calculateViolationPoints()         // 违约积分计算
```

**测试覆盖**:
- 18+ 测试文件，74+ 测试用例
- 测试通过率: 100% ✅

---

### 📁 `shared/` - 共享代码层
**用途**: 前后端共享类型定义、常量、工具函数

**为什么需要 shared/**:
1. **类型一致性**: 前后端使用相同的 `User`, `LabRoom`, `Reservation` 类型
2. **避免重复**: 不在前后端分别定义相同的类型
3. **重构安全**: 修改类型定义时，前后端同步更新

**示例**:
```typescript
// shared/types.ts
export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: 'student' | 'teacher' | 'labAdmin' | 'sysAdmin';
};

// 前端导入
import type { User } from '@/../../shared/types';

// 后端导入
import type { User } from '../shared/types';
```

---

### 📁 `drizzle/` - ORM 与迁移
**技术**: Drizzle ORM（类型安全的 SQL 构建器）

**核心文件**:
- `schema.ts` - 表结构定义（16+ 表）
- `relations.ts` - 表关系定义（外键关联）

**表结构**:
```typescript
// drizzle/schema.ts
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  role: mysqlEnum("role", ["student", "teacher", "labAdmin", "sysAdmin"]).default("student").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), // ⚠️ 自动更新
});

export type User = typeof users.$inferSelect; // 类型推导
export type InsertUser = typeof users.$inferInsert;
```

**迁移流程**:
1. 修改 `schema.ts`
2. 执行 `pnpm db:push`（开发环境）
3. 生成 `000X_*.sql` 迁移文件
4. 生产环境执行 `drizzle-kit migrate`

---

### 📁 `scripts/` - 脚本工具
**用途**: 数据库初始化、测试数据生成、问题修复

**常用脚本**:
```bash
# 基础测试数据（10+ 用户，20+ 预约）
npx tsx scripts/seed.mjs

# 完整测试数据（包含课程、班级、违约记录）
npx tsx scripts/seed-comprehensive.ts

# 修复 role enum 问题
npx tsx scripts/fix-role-enum.ts

# OAuth Mock 服务器（开发用）
npx tsx scripts/mock-oauth.ts
```

---

## 关键数据流

### 预约创建流程
```
用户提交预约（client）
    ↓
CalendarDashboard.tsx → trpc.reservation.create.useMutation()
    ↓
tRPC Client（类型安全传输）
    ↓
server/routers.ts → reservation.create
    ↓
server/db.ts → checkReservationRules()  // 规则验证
    ↓
server/db.ts → getConflictingReservations()  // 冲突检测
    ↓
drizzle/schema.ts → labReservations 表插入
    ↓
返回结果（包含 ID 和状态）
    ↓
前端 React Query 缓存刷新
    ↓
UI 更新（显示新预约）
```

### AI 调用流程
```
用户点击"AI 润色"按钮
    ↓
client/src/pages/LabRoomList.tsx → trpc.ai.generateReason.useMutation()
    ↓
server/routers.ts → ai.generateReason
    ↓
server/_core/xfspark.ts → 讯飞星火 HTTP API
    ↓
返回润色后的文本
    ↓
前端填充到表单字段
```

### 冲突检测流程
```
用户选择时间（client）
    ↓
useReservationRules.ts → trpc.rule.preCheck.useQuery()
    ↓
server/routers.ts → rule.preCheck
    ↓
server/db.ts → checkReservationRules()  // 规则检查
    ↓
server/db.ts → getConflictingReservations()  // 冲突查询
    ↓
返回 { valid: false, reason: "冲突预约 3 个" }
    ↓
前端显示黄色警告卡片 + 冲突详情列表
```

---

## 依赖关系图

```
前端依赖:
React 19
  ├─ TanStack Query (数据管理)
  ├─ Wouter (路由)
  ├─ shadcn/ui (UI 组件)
  │   └─ Radix UI + Tailwind CSS
  ├─ Recharts (图表)
  └─ tRPC Client (API 调用)

后端依赖:
Node.js 22
  ├─ Express (Web 服务器)
  ├─ tRPC (API 层)
  ├─ Drizzle ORM (数据库)
  │   └─ MySQL Driver
  ├─ Vitest (测试)
  └─ 讯飞星火 SDK (AI 服务)

共享依赖:
TypeScript 5.9
Zod (类型验证)
SuperJSON (序列化)
```

---

## 扩展点说明

### 如何新增页面
1. 在 `client/src/pages/` 创建页面组件（如 `NewFeature.tsx`）
2. 在 `client/src/App.tsx` 添加路由:
   ```tsx
   <Route path="/new-feature" component={NewFeature} />
   ```
3. 在 `client/src/components/DashboardLayout.tsx` 添加导航:
   ```tsx
   { path: '/new-feature', label: '新功能', icon: <IconName /> }
   ```
4. 在 `client/src/contexts/RoleContext.tsx` 配置权限

### 如何新增 API
1. 在 `server/routers.ts` 添加路由:
   ```typescript
   export const appRouter = router({
     // ...
     newFeature: router({
       getList: protectedProcedure
         .input(z.object({ ... }))
         .query(async ({ ctx, input }) => {
           return await db.getNewFeatureList(input);
         }),
     }),
   });
   ```
2. 在 `server/db.ts` 添加数据访问函数
3. 前端调用:
   ```typescript
   const { data } = trpc.newFeature.getList.useQuery({ ... });
   ```

### 如何新增数据表
1. 在 `drizzle/schema.ts` 定义表结构
2. 执行 `pnpm db:push` 同步数据库
3. 在 `server/db.ts` 添加 CRUD 函数
4. 在 `shared/types.ts` 添加共享类型（如需）

---

**最后更新**: 2026-01-14  
**文档版本**: v1.0.0
