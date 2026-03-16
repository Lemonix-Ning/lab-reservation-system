# Cursor Rules - AI 编码助手指令

## 快速入门

你正在开发一个 **TypeScript 全栈实验室预约管理系统**，使用 **React 19 + Vite** 前端，**Node.js + tRPC** 后端，**Drizzle ORM + MySQL** 数据库。

**运行端口**: 后端默认 :3000（占用时自动顺延）, 前端分离模式 :5173  
**关键文件**: `server/routers.ts`（~3370 行）, `server/db.ts`（~4191 行）, `drizzle/schema.ts`（~625 行）

---

## 核心原则（必须遵守）

### 0. 域名恢复期运维约束（2026-03 临时）
- 当前 `lemonix.loc.cc` 处于健康恢复阶段，优先目标是保持 HTTP 连续可访问。
- 未完成 443 打通前，禁止把 HTTP 强制跳转到不可达 HTTPS。
- 未完成正式部署前，禁止停用当前线上 nginx（会导致健康检查再次失败）。

### 1. 数据流向
```
drizzle/schema.ts → server/db.ts → server/routers.ts → client
```
- **禁止绕过数据访问层**: 所有数据库操作必须在 `server/db.ts` 中定义
- **禁止硬编码业务规则**: 从数据库 `lab_reserve_rules` 表读取规则值
- **共享类型**: 从 `shared/types.ts` 导入

### 2. 权限控制
```typescript
publicProcedure         // 公共端点
protectedProcedure      // 需登录
adminProcedure          // labAdmin/sysAdmin
createPermissionProcedure('code', ['fallbackRole'])  // 动态权限
```
- 前端仅作 UI 引导，真实鉴权在后端

### 3. 类型安全
```typescript
// ✅ Drizzle 类型推导
export type User = typeof users.$inferSelect;
import type { User } from '@/../../shared/types';

// ❌ 手动定义（会不一致）
type User = { id: number; name: string };
```

### 4. React Query 缓存
```typescript
// ✅ exact: false 刷新所有子查询
queryClient.invalidateQueries({ queryKey: ['reservation'], exact: false });

// ❌ exact: true 导致参数化查询未刷新
```

### 5. 日期字段类型
```typescript
// ✅ 学期日期用 date()，非 timestamp()
startDate: date("startDate", { mode: "date" }).notNull()

// ❌ 会引入时区问题
startDate: timestamp("startDate")
```

---

## 文件修改检查清单

### 修改 Client 前
- [ ] 检查 `shared/types.ts` 是否有共用类型
- [ ] API 调用通过 `trpc` 客户端（不直接 fetch）
- [ ] UI 组件使用 `shadcn/ui`
- [ ] 权限检查仅作 UI 引导

### 修改 Server 前
- [ ] 检查 `server/db.ts` 是否已有类似函数
- [ ] 业务规则从数据库读取
- [ ] 使用正确中间件（public/protected/admin/permission）
- [ ] 关键操作记录审计日志

### 修改 Drizzle Schema 前
- [ ] `timestamp().defaultNow().onUpdateNow()` 用于 updatedAt
- [ ] enum 用 `mysqlEnum`（不用 VARCHAR）
- [ ] 日期字段用 `date()`（不用 `timestamp()`）
- [ ] 导出类型: `export type X = typeof table.$inferSelect`

---

## 常见任务模板

### 新增 API 端点
```typescript
// 1. server/db.ts
export async function getNewData(filters: { status: string }) {
  return await db.select().from(newTable).where(eq(newTable.status, filters.status));
}

// 2. server/routers.ts
newFeature: router({
  getList: protectedProcedure
    .input(z.object({ status: z.string() }))
    .query(async ({ ctx, input }) => {
      return await db.getNewData(input);
    }),
}),

// 3. client
const { data } = trpc.newFeature.getList.useQuery({ status: 'active' });
```

### 新增数据表
```typescript
// 1. drizzle/schema.ts
export const newTable = mysqlTable("new_table", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NewTable = typeof newTable.$inferSelect;

// 2. pnpm db:push
```

### 新增前端页面
```
1. client/src/pages/NewPage.tsx    — 创建页面组件
2. client/src/App.tsx              — 添加路由
3. client/src/components/DashboardLayout.tsx — 添加导航菜单
4. client/src/contexts/PermissionContext.tsx — 配置权限（如需）
```

---

## 排课系统注意事项

### 种子数据
- `pnpm seed:demo` → `scripts/seed.ts`（466 行）
- 使用 `safeCreate()` 幂等创建，避免重复
- 学期用 upsert（先 update 再 insert fallback）
- 当前学期: 2025-2026-2, startDate: 2026-02-23, weekCount: 20

### ScheduleBoard 设计要点
- 实验室筛选：前端从 `allSchedules` 提取 `scheduledLabs`，不传参到 API
- 周计算：用 `useEffect` 同步 `currentWeek`（不用 `useState` 直接赋值）
- 教师名称：显示在排课卡片和图例中

### Excel 导入模板（10 列）
```
实验室ID | 课程ID | 教师ID | 星期几 | 节次 | 开始周 | 结束周 | 课程名称 | 教师姓名 | 备注
```

---

## 3L 推荐算法恢复指南

**代码位置**: `server/db-3l.ts`（178 行，独立文件）

**恢复步骤**:
1. `server/routers.ts`: 搜索 `// [3L]`，取消相关代码注释
2. `client/src/pages/LabRoomList.tsx`: 搜索 `// [3L]`，取消相关代码注释
3. 确保 routers.ts 中添加: `import { getLabRecommendations } from './db-3l'`

**为何独立文件**: 原代码在 db.ts 中用 `/* */` 块注释，导致 esbuild 解析 `string[]` 和嵌套 `/** */` JSDoc 失败。提取到独立文件是正确解决方案。

---

## 错误排查快速指南

### TypeScript 类型错误
```bash
pnpm check  # 类型检查
# 常见: schema 未同步 → pnpm db:push → 重启 TS 服务器
```

### OAuth 登录失败
```bash
pnpm mock:oauth  # 启动 Mock OAuth（:4000）
# 检查 .env, Cookie sameSite, 后端日志
```

### 数据库迁移失败
```bash
pnpm db:push     # 生成 + 执行迁移
pnpm db:reset    # 清空重建
```

### React Query 缓存未刷新
```typescript
// 用 exact: false，覆盖所有子查询
queryClient.invalidateQueries({ queryKey: ['xxx'], exact: false });
```

---

## 代码风格速查

### 命名
```
变量/函数:  camelCase    (getReservationById, userId)
组件/类型:  PascalCase   (LabRoomList, InsertUser)
常量:       UPPER_SNAKE  (MAX_PER_DAY, ADVANCE_DAYS)
```

### 导入顺序
```typescript
import React from 'react';              // 1. 第三方库
import { trpc } from '@/lib/trpc';      // 2. 项目内绝对路径
import { Button } from './ui/button';   // 3. 相对路径
```

### Tailwind CSS
```tsx
// ✅ Utility Classes
<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
// 条件样式: cn()
<div className={cn("base", isActive && "active")} />
```

---

## 关键文件快速定位

| 类别 | 文件 | 说明 |
|------|------|------|
| 核心路由 | `server/routers.ts` | 80+ API 端点 (~3370 行) |
| 数据层 | `server/db.ts` | 所有 SQL 查询 (~4191 行) |
| 3L 推荐 | `server/db-3l.ts` | 推荐算法 (178 行，暂停) |
| 表结构 | `drizzle/schema.ts` | 18+ 表 (~625 行) |
| 日历页 | `client/src/pages/CalendarDashboard.tsx` | 核心调度 (~1069 行) |
| 课表看板 | `client/src/pages/ScheduleBoard.tsx` | 排课视图 (451 行) |
| 实验室 | `client/src/pages/LabRoomList.tsx` | 预约入口 (~497 行) |
| 排课导入 | `client/src/components/ScheduleImport.tsx` | Excel 导入 |
| 种子数据 | `scripts/seed.ts` | 演示数据 (466 行) |
| 健康检查 | `scripts/demo-check.ts` | 30 项检查 (227 行) |
| 认证 | `server/_core/oauth.ts` | OAuth 流程 |
| 权限 | `server/_core/trpc.ts` | 中间件定义 |

---

## 上下文文档索引

| 问题 | 参考文档 |
|------|---------|
| 不熟悉项目架构 | `.ai/context/ARCHITECTURE.md` |
| 需要了解当前进度 | `.ai/context/CURRENT_STATE.md` |
| 查找文件位置 | `.ai/context/PROJECT_MAP.md` |
| 编码规范疑问 | 本文件 `AI_RULES.md` |

---

## 快速命令参考

```bash
pnpm dev              # 启动后端（默认 PORT 3000，集成 Vite）
pnpm seed:demo        # 播种演示数据
pnpm mock:oauth       # Mock OAuth（PORT 4000）
pnpm check            # TypeScript 类型检查
pnpm test             # Vitest 测试
pnpm db:push          # 数据库迁移
```

---

**最后更新**: 2026-03-16  
**文档版本**: v1.3.1  
**适用场景**: Cursor / GitHub Copilot / 其他 AI 编码助手
