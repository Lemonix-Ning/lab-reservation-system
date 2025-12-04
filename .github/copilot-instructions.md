# Copilot / AI 助手 快速入门

目的：让 AI 编码助手快速进入本仓库并安全产出可审查补丁。

## 架构一览

**前端** React 19 + Vite（`client/`） | **后端** Node + Express + tRPC（`server/`） | **数据库** Drizzle ORM（`drizzle/schema.ts`） | **共享** 类型在 `shared/`

## 必知命令

```bash
pnpm install                              # 安装依赖
pnpm db:push                              # 生成/同步迁移（基于 schema.ts）
npx tsx scripts/seed.mjs                  # 初始化测试数据
pnpm dev                                  # 启动后端（PORT 3000）
pnpm client:dev                           # 启动前端（PORT 5173）
pnpm test                                 # 运行 Vitest（18 个测试用例）
pnpm check                                # 检查 TypeScript
```

## 优先阅读的文件

| 文件 | 用途 |
|------|------|
| `server/routers.ts` | tRPC API 面（权限、规则、业务逻辑） |
| `server/db.ts` | 数据库访问层（所有 DB 操作汇聚处） |
| `drizzle/schema.ts` | 数据模型与表结构 |
| `server/reservation.test.ts` | 规则引擎与冲突检测的单元测试 |
| `client/src/hooks/useReservationRules.ts` | 前端规则检查 Hook（新增） |
| `client/src/pages/LabRoomList.tsx` | 预约表单页面（集成规则提示） |

## 核心实现（第一阶段 ✅ 完成）

### 预约规则引擎

**后端** (`server/db.ts`):
```typescript
checkReservationRules(userId, labId, startTime, endTime)
  → { valid: boolean; reason?: string }
```
检查 `MAX_PER_DAY`（每日预约次数）、`MAX_DURATION`（单次时长）、`ADVANCE_DAYS`（提前天数）。
- 调用位置：`routers.ts` L177（预约创建时）
- 返回清晰的拒绝原因，前端实时显示

**前端** (`client/src/hooks/useReservationRules.ts`):
```typescript
useReservationRules()
  → { checkReservation, errorMessage, formatRuleDescription, ... }
```
- `rule.listEnabled` 查询获取当前规则
- `rule.preCheck` 查询实时验证预约
- 在 `LabRoomList.tsx` 中显示蓝色规则提示 & 红色错误提示

### 时间冲突检测

使用区间重叠逻辑：`NOT (end_new <= start_exist OR start_new >= end_exist)`
- 调用位置：`routers.ts` L147（预约创建）、L207（审核通过）
- 排除已取消/拒绝的预约

## 必须遵守的约定

1. **数据层流程**：`drizzle/schema.ts` → `server/db.ts` → `server/routers.ts`
2. **权限模式**：使用 `protectedProcedure` / `adminProcedure`（不要绕过）
3. **业务规则**：从数据库 `lab_reserve_rules` 表读取，不硬编码常数
4. **共享类型**：从 `shared/` 导入，避免复制
5. **AI 密钥**：仅后端持有，前端通过 tRPC `ai.*` 调用

## 测试覆盖

✅ 18 个单元测试（`server/reservation.test.ts`）：
- 时间冲突检测（5 个用例）
- 规则引擎（4 个用例）
- 预约操作与权限（4 个用例）
- 规则管理（4 个用例）

> **改动规则/预约逻辑 → 必须更新对应测试**

## 快速排查

| 问题 | 位置 |
|------|------|
| OAuth/登录失败 | `scripts/mock-oauth.ts` 或 `server/_core/oauth.ts` |
| 前端跳转登录 | `client/src/main.tsx` 的 `redirectToLoginIfUnauthorized` |
| 规则检查失败 | `server/db.ts` 的 `checkReservationRules` 或前端 Hook |
| AI 调用失败 | `server/_core/xfspark.ts` 的 mock 模式或环境变量检查 |

## 常见陷阱

❌ **错误**：在代码中硬编码 `if (count >= 2) throw ...`  
✅ **正确**：`await db.getRuleByCode('MAX_PER_DAY')` 后读取规则值

❌ **错误**：前端直接调用讯飞 API  
✅ **正确**：`trpc.ai.generateReason.useMutation()`

❌ **错误**：每次启动都要 `pnpm install && pnpm db:push`  
✅ **正确**：首次初始化，后续只需 `pnpm dev` 和 `pnpm client:dev`

## 下一阶段任务

- [ ] 前端完善（实验室管理页、预约详情）
- [ ] 统计仪表板（图表、热力图）
- [ ] 通知系统（邮件、站内消息）
- [ ] 性能优化（缓存、N+1 查询）

---

**最后更新**：2025-12-01  
**项目版本**：1.0.0 | **测试通过率**：18/18 ✅
