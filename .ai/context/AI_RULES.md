# Cursor Rules - AI 编码助手指令

## 快速入门

你正在开发一个 **TypeScript 全栈实验室预约管理系统**，使用 **React 19 + Vite** 前端，**Node.js + tRPC** 后端，**Drizzle ORM + MySQL** 数据库。

---

## 核心原则（必须遵守）

### 1. 数据流向
```
drizzle/schema.ts → server/db.ts → server/routers.ts → client
```
- **禁止绕过数据访问层**: 所有数据库操作必须在 `server/db.ts` 中定义
- **禁止硬编码业务规则**: 从数据库 `lab_reserve_rules` 表读取规则值
- **共享类型**: 从 `shared/types.ts` 导入，避免前后端分别定义

### 2. 权限控制
```typescript
// ✅ 正确：使用 tRPC 中间件
publicProcedure       // 公共端点（无需登录）
protectedProcedure    // 登录后端点
adminProcedure        // 管理员端点（labAdmin/sysAdmin）

// ❌ 错误：前端绕过权限检查
if (user?.role === 'admin') {
  // 仅作 UI 引导，真实鉴权必须在后端
}
```

### 3. 类型安全
```typescript
// ✅ 正确：使用 Drizzle 类型推导
import type { User } from '@/../../shared/types';
export type User = typeof users.$inferSelect;

// ❌ 错误：手动定义类型（会导致不一致）
type User = { id: number; name: string }; // ❌
```

### 4. React Query 缓存
```typescript
// ✅ 正确：使用 exact: false 刷新所有子查询
queryClient.invalidateQueries({ 
  queryKey: ['reservation'], 
  exact: false 
});

// ❌ 错误：exact: true 导致参数化查询未刷新
queryClient.invalidateQueries({ 
  queryKey: ['reservation', 'allList'], 
  exact: true 
});
```

---

## 文件修改检查清单

### 修改 Client 前
- [ ] 检查 `shared/types.ts` 是否有共用类型
- [ ] 确认 API 调用通过 `trpc` 客户端
- [ ] 确认 UI 组件使用 `shadcn/ui`（不自定义样式）
- [ ] 确认权限检查仅作 UI 引导（真实鉴权在后端）

### 修改 Server 前
- [ ] 检查 `server/db.ts` 是否已有类似函数
- [ ] 确认业务规则从数据库读取（不硬编码常数）
- [ ] 确认使用正确的中间件（publicProcedure/protectedProcedure/adminProcedure）
- [ ] 确认审计日志已记录（关键操作）

### 修改 Drizzle Schema 前
- [ ] 确认字段使用 `timestamp().defaultNow().onUpdateNow()`（自动更新）
- [ ] 确认 enum 使用 `mysqlEnum`（不用 VARCHAR）
- [ ] 确认外键命名规范（如 `userId` 关联 `users.id`）
- [ ] 确认类型导出（`export type User = typeof users.$inferSelect`）

---

## 常见任务模板

### 新增 API 端点
```typescript
// 1. server/db.ts - 数据访问层
export async function getNewData(filters: { status: string }) {
  return await db.select().from(newTable).where(eq(newTable.status, filters.status));
}

// 2. server/routers.ts - tRPC 路由
newFeature: router({
  getList: protectedProcedure
    .input(z.object({ status: z.string() }))
    .query(async ({ ctx, input }) => {
      return await db.getNewData(input);
    }),
}),

// 3. client - 前端调用
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), // ⚠️ 必须
});

export type NewTable = typeof newTable.$inferSelect;
export type InsertNewTable = typeof newTable.$inferInsert;

// 2. 执行迁移
// pnpm db:push
```

### 新增前端页面
```tsx
// 1. client/src/pages/NewPage.tsx
export function NewPage() {
  const { data, isLoading } = trpc.newFeature.getList.useQuery({});
  
  if (isLoading) return <div>加载中...</div>;
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">新页面</h1>
      {/* ... */}
    </div>
  );
}

// 2. client/src/App.tsx - 添加路由
<Route path="/new-page" component={NewPage} />

// 3. client/src/components/DashboardLayout.tsx - 添加导航
{ path: '/new-page', label: '新页面', icon: <IconName /> }

// 4. client/src/contexts/RoleContext.tsx - 配置权限（如需）
```

---

## 错误排查快速指南

### 问题: TypeScript 类型错误
```bash
# 检查命令
pnpm check

# 常见原因
1. shared/types.ts 类型定义过时
2. Drizzle schema 未重新生成类型
3. tRPC 路由类型推导错误

# 解决方案
1. 执行 pnpm db:push 重新生成类型
2. 重启 TypeScript 服务器（VSCode: Cmd+Shift+P → Reload Window）
```

### 问题: React Query 缓存未刷新
```typescript
// ❌ 错误：exact: true
queryClient.invalidateQueries({ queryKey: ['reservation', 'allList'], exact: true });

// ✅ 正确：exact: false（覆盖所有子查询）
queryClient.invalidateQueries({ queryKey: ['reservation'], exact: false });
```

### 问题: OAuth 登录失败
```bash
# 检查步骤
1. 确认 .env 文件配置正确
2. 检查 Cookie sameSite 策略（开发: lax，生产: none）
3. 查看后端日志（server/_core/oauth.ts）
4. 使用 Mock OAuth（scripts/mock-oauth.ts）

# 开发环境快速登录
pnpm mock:oauth
# 访问 http://localhost:3000/login?method=mock
```

### 问题: 数据库迁移失败
```bash
# role enum 错误（常见）
npx tsx scripts/fix-role-enum.ts

# 重建数据库
pnpm db:reset

# 验证
pnpm test
```

### 问题: 前端冲突检测无响应
```typescript
// 检查 1: enabled 配置
const conflictQuery = trpc.rule.preCheck.useQuery(
  { ... },
  { enabled: false }  // ⚠️ 需手动 refetch
);

// 检查 2: 手动触发
conflictQuery.refetch();

// 检查 3: 查看后端日志
// server/routers.ts → rule.preCheck
```

---

## AI 密钥管理

### 讯飞星火 API
```typescript
// ✅ 正确：仅后端持有密钥
// server/_core/xfspark.ts
const apiKey = process.env.XFSPARK_API_KEY;

// 前端调用
const润色 = trpc.ai.generateReason.useMutation();
润色.mutate({ originalText: '...' });

// ❌ 错误：前端直接调用
// fetch('https://spark-api...', { headers: { 'Authorization': 'Bearer xxx' }}) // ❌
```

### Mock 模式（开发用）
```typescript
// server/_core/xfspark.ts 自动降级
if (!process.env.XFSPARK_API_KEY) {
  console.log('[AI] Using mock mode (no API key)');
  return mockResponse;
}
```

---

## 测试要求

### 新增功能必须包含测试
```typescript
// server/新功能.test.ts
import { describe, it, expect } from 'vitest';

describe('新功能测试', () => {
  it('应该返回正确的数据', async () => {
    const result = await db.getNewData({ status: 'active' });
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});
```

### 运行测试
```bash
# 全部测试
pnpm test

# 单个文件
pnpm vitest run server/新功能.test.ts

# Watch 模式
pnpm vitest watch
```

### 测试覆盖要求
- 后端: 路由权限、输入校验、核心业务函数、SQL 聚合正确性
- 前端: 关键交互、状态管理、权限显示、极端边界（空数据）
- 日历: 冲突检测逻辑、多维度查询、事件详情完整性

---

## 性能优化检查

### 数据库查询
```typescript
// ✅ 正确：使用索引字段
.where(and(
  eq(labReservations.labId, labId),      // 索引字段
  eq(labReservations.status, 'pending')  // 索引字段
))

// ❌ 错误：全表扫描
.where(sql`DATE(startTime) = '2025-12-01'`)  // ❌ 无法使用索引
```

### React 渲染优化
```typescript
// ✅ 正确：使用 useMemo
const filteredData = useMemo(
  () => data?.filter(item => item.status === 'active'),
  [data]
);

// ❌ 错误：每次渲染都计算
const filteredData = data?.filter(item => item.status === 'active'); // ❌
```

### React Query 缓存配置
```typescript
// 静态数据（实验室/设备）
{ staleTime: 60 * 60 * 1000, gcTime: 120 * 60 * 1000 }

// 动态数据（日历）
{ staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }

// 实时数据（冲突检测）
{ staleTime: 5 * 60 * 1000 }
```

---

## Git 提交规范

### 提交信息格式
```bash
type(scope): subject

# 示例
feat(calendar): add conflict detection with alternative slots
fix(auth): resolve cookie sameSite policy for cross-origin
docs(readme): update quick start section
test(reservation): add unit tests for rule validation
refactor(db): optimize query performance with indexes
```

### Type 枚举
- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档更新
- `test` - 测试相关
- `refactor` - 代码重构
- `chore` - 构建/工具链
- `build` - 依赖更新

---

## 代码风格速查

### 命名约定
```typescript
// 变量/函数: camelCase
const userId = 1;
function getReservationById(id: number) {}

// 组件/类型: PascalCase
export function LabRoomList() {}
export type User = { ... };

// 常量: UPPER_SNAKE
const MAX_PER_DAY = 2;
const ADVANCE_DAYS = 7;

// 私有函数: _camelCase（可选）
function _internalHelper() {}
```

### 导入顺序
```typescript
// 1. 第三方库
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. shared 或项目内绝对路径
import { trpc } from '@/lib/trpc';
import type { User } from '@/../../shared/types';

// 3. 相对路径组件
import { Button } from './ui/button';
import { Card } from './ui/card';
```

### Tailwind CSS 规范
```tsx
// ✅ 正确：使用 Utility Classes
<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">

// ❌ 错误：内联样式
<div style={{ backgroundColor: 'white', padding: '24px' }}> // ❌

// 条件样式：使用 cn() 工具
import { cn } from '@/lib/utils';
<div className={cn("base-class", isActive && "active-class")} />
```

---

## 关键文件快速定位

### 核心业务逻辑
- `server/db.ts` L1883-2003 - 智能替代方案推荐
- `server/db.ts` L365 - 冲突检测函数
- `server/routers.ts` L621-632 - 冲突查询 API
- `client/src/hooks/useReservationRules.ts` - 规则检查 Hook

### 权限与认证
- `server/_core/trpc.ts` - tRPC 中间件定义
- `server/_core/oauth.ts` - OAuth 认证流程
- `client/src/_core/hooks/useAuth.ts` - 前端认证状态
- `client/src/contexts/RoleContext.tsx` - 角色权限控制

### 数据模型
- `drizzle/schema.ts` - 数据库表结构（16+ 表）
- `shared/types.ts` - 共享类型定义

### 前端核心页面
- `client/src/pages/CalendarDashboard.tsx` - 日历调度（1000+ lines）
- `client/src/pages/LabRoomList.tsx` - 实验室列表与预约入口
- `client/src/pages/ReservationManage.tsx` - 预约审核（管理员）

---

## 快速命令参考

```bash
# 开发运行
pnpm install          # 安装依赖
pnpm dev              # 启动后端（PORT 3000）
pnpm client:dev       # 启动前端（PORT 5173）

# 数据库管理
pnpm db:push          # 同步 schema 到数据库
npx tsx scripts/seed.mjs  # 初始化测试数据
pnpm db:reset         # 清空并重建数据库

# 质量检查
pnpm check            # TypeScript 类型检查
pnpm test             # 运行 Vitest（74+ 测试用例）
pnpm format           # Prettier 格式化

# OAuth Mock（开发用）
pnpm mock:oauth       # 启动 Mock OAuth 服务器
```

---

## 上下文文档索引

当遇到以下问题时，参考对应文档：

| 问题 | 参考文档 |
|------|---------|
| 不熟悉项目架构 | `.ai/context/ARCHITECTURE.md` |
| 需要了解当前进度 | `.ai/context/CURRENT_STATE.md` |
| 查找文件位置 | `.ai/context/PROJECT_MAP.md` |
| 编码规范疑问 | 本文件 `AI_RULES.md` |

---

**最后更新**: 2026-01-14  
**文档版本**: v1.0.0  
**适用场景**: Cursor / GitHub Copilot / 其他 AI 编码助手
