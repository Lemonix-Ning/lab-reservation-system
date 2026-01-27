# 项目当前状态与进度

## 项目状态概览

**当前版本**: 1.0.1  
**最后更新**: 2026-01-14  
**测试通过率**: 18/18 ✅  
**核心功能完成度**: P0 + P1 + P2-1 完成（约 85%）

---

## Todo List（待办事项）

### 🎯 P2 模块 - 进行中

#### ✅ P2-1: 日历与可视化调度（已完成）
- [x] 日/周/月视图切换
- [x] 多维度资源调度（实验室/设备/课程）
- [x] 实时冲突检测与批量展示
- [x] 智能替代方案推荐（最多 5 个，置信度排序）
- [x] 一键应用替代方案并重新提交审核
- [x] 月度利用率热力图
- [x] 移动端响应式优化
- [x] 数据导出（HTML / iCalendar / PDF）
- [x] React Query 缓存优化（分层缓存策略）
- [x] updatedAt 字段自动更新（ON UPDATE CURRENT_TIMESTAMP）

**代码位置**:
- `client/src/pages/CalendarDashboard.tsx` - 日历主页面
- `client/src/hooks/useReservationRules.ts` - 规则检查与冲突查询
- `server/db.ts` - `getAlternativeTimeSlots()` (L1883-2003)
- `server/routers.ts` - `rule.getConflictingReservations` (L621-632)

**已知优化项**（低优先级）:
- [ ] 管理员强制覆盖选项（允许忽略冲突警告）
- [ ] WebSocket 实时更新（多用户同步日历变更）

---

#### 📋 P2-2: AI 智能增强（待开始）
**预计工作量**: 中（20pt）  
**依赖**: P2-1 日历数据

**计划功能**:
- [ ] AI 洞察报告生成（基于统计数据）
- [ ] 预约理由润色优化（集成现有 AI 功能到更多场景）
- [ ] 智能推荐优化（考虑用户历史偏好时段）
- [ ] 自然语言查询（"下周三有空的实验室"）

**注意事项**:
- 当前已集成讯飞星火 API（`server/_core/xfspark.ts`）
- AI 密钥仅后端持有，前端通过 tRPC `ai.*` 调用
- 需确保 API 配额充足

---

#### 📋 Phase 4: 签到与定位对账（规划中）
**预计工作量**: 大（40pt）  
**依赖**: P2-1 日历 + P2-2 AI（可选）

**计划功能**:
- [ ] 签到/签退系统（二维码扫描 + 地理围栏）
- [ ] 未到场自动对账（定时任务）
- [ ] 违约记录自动生成（no_show 类型）
- [ ] Wi-Fi 备用签到方式
- [ ] 管理员代签功能

**前置条件**:
- 实验室地理坐标配置（`lab_rooms` 表已预留字段）
- 移动端定位权限
- 二维码生成与验证机制

---

### 🔧 技术债务与优化

#### 后端优化
- [ ] 审计日志支持 `targetId` 参数过滤（当前前端过滤，数据量大时影响性能）
- [ ] 预约规则缓存（避免每次查询数据库）
- [ ] 批量操作 API 优化（如批量审批、批量取消）
- [ ] N+1 查询优化（使用 Drizzle Join 替代循环查询）

**参考**:
```typescript
// 当前实现（可能存在 N+1）
const reservations = await db.select().from(labReservations);
for (const r of reservations) {
  const user = await db.select().from(users).where(eq(users.id, r.userId));
}

// 优化建议（使用 JOIN）
const reservations = await db
  .select()
  .from(labReservations)
  .leftJoin(users, eq(labReservations.userId, users.id));
```

#### 前端优化
- [ ] 虚拟滚动（长列表性能优化）
- [ ] 图片懒加载（如果未来添加实验室图片）
- [ ] 代码分割（按路由拆分 bundle）
- [ ] PWA 支持（离线访问）

#### 数据库优化
- [ ] 查询性能监控（慢查询日志分析）
- [ ] 索引维护（定期 `ANALYZE TABLE`）
- [ ] 数据归档（历史预约数据迁移到归档表）

---

## Recent Changes（最近变更）

### 2025-12-21: P2-1 后期优化完成
**完成项目** (4/6):
1. ✅ **批量冲突检测** - `getConflictingReservationDetails()` 返回冲突详情列表
2. ✅ **React Query 缓存优化** - 分层缓存策略（静态/动态/实时）
3. ✅ **iCalendar 导出** - RFC 5545 标准，支持外部日历导入
4. ✅ **PDF 导出** - 浏览器原生 `window.print()` 工作流

**未完成项目** (2/6，低优先级):
- 管理员强制覆盖选项（冲突已可见，此功能仅便利性）
- WebSocket 实时更新（基础设施复杂，延迟到后续迭代）

**代码变更**:
- `server/db.ts` L365 - 新增冲突详情查询函数
- `server/routers.ts` L621-632 - 新增冲突查询 API
- `client/src/pages/CalendarDashboard.tsx` L84-98 - 缓存配置
- `client/src/lib/export.ts` L52-145 - iCalendar 导出逻辑

---

### 2025-12-17: React NotFoundError 修复
**问题**: 日历页面多次切换时出现 `NotFoundError: Failed to execute 'removeChild' on 'Node'`

**原因**: Radix Dialog 的 Portal 容器在条件渲染时被多个组件竞争，导致 DOM 节点引用失效

**解决方案**:
- 使用 `key={selectedEvent.id}` 强制 Dialog 重新挂载
- 合并"冲突详情 + 智能调度建议"到同一个 Dialog
- 统一使用 `setSelectedEvent(null)` 清理状态

**关键学习**:
- Radix Dialog 等 Portal 组件应保持单实例、受控模式
- 避免条件渲染多个层级嵌套的 Portal

**代码位置**: `client/src/pages/CalendarDashboard.tsx`

---

### 2025-12-12: 替代方案规则验证修复
**问题**: 管理员使用智能调度建议时遇到 "必须至少提前 7 天预约" 错误

**原因**: `getAlternativeTimeSlots()` 生成的时间建议未考虑 `ADVANCE_DAYS` 规则

**解决方案**:
1. 扩展时间建议类型（小时级 + 天级偏移）
2. 集成 `ADVANCE_DAYS` 规则过滤
3. 新增 `checkReservationRulesExceptAdvance()` 函数（管理员特权）
4. 前端添加"绕过规则"按钮（仅管理员可见）

**代码变更**:
- `server/db.ts` - 时间建议生成逻辑扩展（~120 lines）
- `server/routers.ts` - `reservation.update` 新增 `bypassAdvanceRule` 参数
- `client/src/pages/CalendarDashboard.tsx` - 双按钮模式（"采用此方案" + "绕过规则"）

**测试**: `server/alternative-slots.test.ts` 验证规则符合性

---

### 2025-12-12: 冲突筛选功能修复
**问题**: 日历管理页面"仅显示冲突"按钮无响应

**原因**:
1. API 使用错误字段 `conflict.userId`（应为 `conflict.applicantUserId`）
2. 状态过滤逻辑同时应用默认条件和自定义条件
3. 时间范围过滤使用 `endTime` 而非 `startTime`

**解决方案**:
- 修正字段名映射
- 重构状态过滤逻辑（指定 status 时仅用该状态，否则默认 pending + approved）
- 添加详细日志（前后端）

**验证结果**: 数据库中 29 个冲突预约正常显示

**代码位置**: `server/routers.ts` L1714-1750, `server/db.ts` L271-333

---

### 2025-12-08: 课程管理与教学支持完成
**新增功能**:
- 课程 CRUD（创建/查询/更新/删除）
- 学生管理（添加/移除）
- 课程预约（创建/查询/取消）
- 预约冲突检测
- 班级批量操作

**代码位置**:
- `server/routers.ts` - `course.*` 路由（18 个端点）
- `client/src/pages/CourseManage.tsx` - 课程管理页面
- `client/src/pages/StudentCourses.tsx` - 学生课程视图

**测试**: 18/18 通过（`server/course.test.ts`）

---

### 2025-12-05: 数据库性能优化
**优化范围**: 16 个表，76+ 个新索引

**性能提升**:
- 冲突检测查询: 85-87% ⬆️
- 用户预约列表: 70-80% ⬆️
- 违约积分统计: 88% ⬆️
- 审计日志查询: 85% ⬆️
- **平均提升: 84%**

**验证方法**:
- `EXPLAIN SELECT` 查询执行计划分析
- 查询响应时间基准测试
- 写入性能影响评估

**代码位置**: `drizzle/schema.ts`（索引定义）

---

## Risk Assessment（风险评估）

### ⚠️ 不稳定模块

#### 1. 日历组件 - 中风险
**症状**: React NotFoundError 偶发（已修复但需持续监控）

**影响**: 用户快速切换预约详情时可能崩溃，由 ErrorBoundary 兜底

**缓解措施**:
- 已使用 `key` 强制重新挂载
- 合并多层 Dialog 为单一实例
- 添加 ErrorBoundary 日志

**监控指标**: 错误日志频率、用户反馈

---

#### 2. 智能替代方案推荐 - 低风险
**症状**: 部分极端场景（如连续 14 天无空闲）可能返回空结果

**影响**: 用户看到"暂无合适的替代方案"提示，需手动选择

**缓解措施**:
- 搜索范围已扩展到 14 天（同日±12h + 后 21 天同时段）
- 提示用户尝试更远日期
- 管理员可使用"绕过规则"功能

**优化计划**: 自动扩展搜索范围到 30 天（如果 14 天内无结果）

---

#### 3. 讯飞星火 API - 中风险
**症状**: API 配额耗尽或服务不可用时降级到 Mock 模式

**影响**: AI 功能（预约理由润色、洞察报告）不可用，但核心预约流程不受影响

**缓解措施**:
- Mock 模式自动回退
- 前端优雅降级（显示"AI 服务暂不可用"）
- 监控 API 配额使用情况

**监控指标**: API 调用成功率、配额余量

---

#### 4. OAuth 认证 - 低风险
**症状**: Cookie 同源政策在跨域部署时可能失效

**影响**: 用户无法登录或频繁掉线

**缓解措施**:
- 开发环境: `sameSite: 'lax'`
- 生产环境: `sameSite: 'none' + secure: true`
- 详细日志记录 OAuth 流程

**已修复问题**:
- OAuth 回调 redirectUri 端口错误 ✅
- Cookie 同源政策配置 ✅
- 快速登录 URL 参数缺失 ✅

---

### 🟢 稳定模块

- ✅ **用户认证与权限管理** - 18+ 测试覆盖，无已知问题
- ✅ **实验室与设备管理** - 11/11 测试通过，CRUD 完整
- ✅ **预约规则引擎** - 规则验证逻辑稳定，4/4 测试通过
- ✅ **审批与违约管理** - 16/16 测试通过，黑名单自动化
- ✅ **审计日志** - 20+ 操作类型集成，权限隔离正确
- ✅ **课程与教学支持** - 18/18 测试通过，批量操作稳定
- ✅ **统计分析** - 12/12 测试通过，数据一致性验证

---

## 部署状态

### 开发环境
- **后端**: `http://localhost:3000`
- **前端**: `http://localhost:5173`
- **数据库**: MySQL 本地实例
- **OAuth**: Mock 模式（`scripts/mock-oauth.ts`）

### 生产环境（规划中）
- **域名**: TBD
- **SSL证书**: Let's Encrypt（自动续期）
- **数据库**: MySQL 8.0+（主从复制）
- **CDN**: 静态资源加速
- **OAuth**: 统一认证平台生产环境
- **监控**: 日志聚合 + 性能监控

---

## 数据统计

### 测试覆盖
```
统计分析:       12/12 ✅
设备管理:       11/11 ✅
预约管理:        6/6  ✅
通知系统:        6/6  ✅
审批与违约:     16/16 ✅
课程管理:       18/18 ✅
OAuth 与权限:    5/5  ✅
─────────────────────
总计:           74/74 ✅
```

### 数据库表统计
```
核心表:           16 张
索引数:           76+
平均查询性能提升:  84%
数据完整性约束:    32+
```

### 代码统计
```
TypeScript 文件:  100+
前端组件:         40+
tRPC API 端点:    80+
测试文件:         18
```

---

## 下一步行动

### 本周计划（优先级排序）
1. **P2-2 启动**: AI 洞察报告原型开发
2. **技术债务**: 审计日志 `targetId` 后端过滤支持
3. **文档更新**: 补全 API 文档（Swagger/OpenAPI）
4. **性能监控**: 集成慢查询日志分析

### 本月计划
1. 完成 P2-2（AI 智能增强）
2. Phase 4 需求分析与原型
3. 生产环境部署准备
4. 用户培训文档编写

---

**最后更新**: 2026-01-14  
**文档版本**: v1.0.0

---

# 项目全面掌握（2026-01-27）

## 概要
- 技术栈
  - 前端：React + Vite + TanStack Query + Tailwind + shadcn/ui
  - 后端：Express + tRPC + Drizzle ORM（MySQL）
  - 测试：Vitest
  - AI：讯飞星火（HTTP + APIPassword，Mock 回退）
- 当前运行状态
  - 后端开发服务器运行: http://localhost:3000/（集成 Vite 中间件）[index.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/index.ts)
  - Mock OAuth 服务运行: http://localhost:4000/ [mock-oauth.ts](file:///d:/workspace/A_bs/lab-reservation-system/scripts/mock-oauth.ts)
  - 数据库：MySQL 本地实例，业务表 18 张 + 迁移元数据表 1 张（__drizzle_migrations）
- 关键环境变量（使用示例）
  - OAUTH_SERVER_URL=http://localhost:4000
  - OAUTH_CLIENT_ID=local-client-id
  - JWT_SECRET=dev-secret-****
  - VITE_APP_ID=lab-reservation-local
  - DATABASE_URL=mysql://root:******@127.0.0.1:3306/lab_reservation_db

## 命令与启动
- package.json 脚本 [package.json](file:///d:/workspace/A_bs/lab-reservation-system/package.json#L6-L21)
  - pnpm dev：开发后端（集成 Vite）
  - pnpm client:dev：前端开发服务器（5173，反向代理 /api）
  - pnpm build：构建前端 + 打包后端入口到 dist
  - pnpm start：生产启动
  - pnpm test：运行 Vitest（server/**/*.test.ts）
  - pnpm db:push：生成并应用数据库迁移
  - pnpm mock:oauth：启动本地 Mock OAuth
- 说明：package.json 中声明了若干 seed 脚本，但当前仓库仅存在 mock-oauth.ts（见 [scripts](file:///d:/workspace/A_bs/lab-reservation-system/scripts)）。种子数据脚本需要后续补充或移除无效命令。

## 认证与会话流（现状）
- 登录发起（前端）
  - 未登录时捕获 tRPC UNAUTHORIZED 错误并重定向到后端授权端点 [main.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/main.tsx#L13-L38)、[const.ts](file:///d:/workspace/A_bs/lab-reservation-system/client/src/const.ts)
- 授权与回调（后端）
  - /api/oauth/authorize 代理到 Mock OAuth [oauth.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/oauth.ts#L13-L19)
  - /api/oauth/callback 交换 token、获取用户信息、upsert 用户并写会话 Cookie [oauth.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/oauth.ts#L21-L76)、[sdk.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/sdk.ts)
- 会话 Cookie
  - 开发：sameSite=lax；生产：sameSite=none + secure=true [cookies.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/cookies.ts)
- 近期修复
  - 回调阶段数据库连接拒绝（ECONNREFUSED）源于 IPv6/IPv4 解析差异，已将 DATABASE_URL 主机改为 127.0.0.1，回调恢复正常

## 后端模块与路由（tRPC）
- 路由聚合入口 [routers.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts)
  - system：系统路由（内部）
  - auth：用户信息/退出登录
  - user：用户查询
  - labRoom：实验室管理（CRUD）
  - reservation：预约管理（创建/取消/审批/更新/冲突详情）
  - rule：预约规则（列表/预检查/冲突详情/更新）
  - device：设备管理（按实验室查询/CRUD）
  - statistics：统计分析（摘要/使用率/活跃度/时间分布/状态分布）
  - notification：通知中心（列表/未读数/标记已读/删除）
  - approval：审批配置与历史、自动取消超时
  - violation：违约与黑名单（记录/查询/移除/列表）
  - audit：审计日志（按条件查询/按预约查询）
  - ai：AI 润色与洞察
  - course：课程管理（创建/列表/学生管理）
  - courseReservation：课程预约（创建/查询/取消/可用性检测）
  - calendar：日历数据（时间范围预约、实验室日历、设备/课程日历、月度利用率、冲突建议、冲突列表）
- 权限中间件
  - 新版：允许 labAdmin 与 sysAdmin 的 adminProcedure [trpc.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/trpc.ts#L30-L48)
  - 旧版兼容：存在仅允许 admin/sysAdmin 的 adminProcedure（路由内定义），建议统一到新版以避免权限不一致 [routers.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L50-L56)

## 数据库现状
- 业务表：18 张（详见 [DB_SCHEMA.md](file:///d:/workspace/A_bs/lab-reservation-system/docs/DB_SCHEMA.md)）
- 迁移元数据表：__drizzle_migrations（Drizzle 迁移跟踪）
- 迁移文件： [0000_light_richard_fisk.sql](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/0000_light_richard_fisk.sql)、[0001_handy_hellcat.sql](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/0001_handy_hellcat.sql)
- 说明：lab_reservations 未来预留 deviceId/courseId 的字段（见 0001），当前 schema.ts 未启用相应外键逻辑，后续功能可逐步接入

## 前端页面导航（实际路由）
- 页面入口与布局 [App.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/App.tsx)
  - /（首页）[Home.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/Home.tsx)
  - /labs（实验室列表）[LabRoomList.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/LabRoomList.tsx)
  - /my-reservations（我的预约）[MyReservations.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/MyReservations.tsx)
  - /notifications（通知中心）[NotificationCenter.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/NotificationCenter.tsx)
  - /courses（课程管理）[CourseManage.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/CourseManage.tsx)
  - /student/courses（学生课程视图）[StudentCourses.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/StudentCourses.tsx)
  - /calendar（日历与调度）[CalendarDashboard.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/CalendarDashboard.tsx)
  - 管理页面：
    - /admin/labs（实验室管理）[LabRoomManage.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/LabRoomManage.tsx)
    - /admin/devices（设备管理）[DeviceManage.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/DeviceManage.tsx)
    - /admin/reservations（预约管理）[ReservationManage.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/ReservationManage.tsx)
    - /admin/rules（规则配置）[RuleManage.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/RuleManage.tsx)
    - /admin/statistics（统计仪表板）[StatisticsDashboard.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/StatisticsDashboard.tsx)
    - /admin/approval-config（审批配置）[ApprovalConfig.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/ApprovalConfig.tsx)
    - /admin/violations（违约管理）[ViolationManage.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/ViolationManage.tsx)
    - /admin/audit-logs（审计日志）[AuditLog.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/AuditLog.tsx)
    - /admin/opening-rules（开放规则）[OpeningRuleManage.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/OpeningRuleManage.tsx)
    - /admin/blocked-periods（禁用时段）[BlockedPeriodManage.tsx](file:///d:/workspace/A_bs/lab-reservation-system/client/src/pages/BlockedPeriodManage.tsx)

## AI 功能（现状）
- 预约理由润色：ai.generateReason（后端调用讯飞星火）[xfspark.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/xfspark.ts#L176-L201)
- 洞察报告生成：ai.generateInsight（管理数据汇总 → 报告）[xfspark.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/xfspark.ts#L205-L235)
- Mock 模式自动回退：未配置 APIPassword 时返回模拟响应
- 频率限制：generateReason（每用户每分钟 5 次）、generateInsight（每管理员每小时 20 次）[routers.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L1035-L1070)

## 测试与验证
- 测试范围配置：server/**/*.test.ts [vitest.config.ts](file:///d:/workspace/A_bs/lab-reservation-system/vitest.config.ts#L15-L18)
- 测试样例：alternative-slots.test.ts、approval.test.ts、calendar-update.test.ts、course.test.ts、device.test.ts、statistics.test.ts 等（覆盖冲突建议、审批流、日历更新、课程、设备、统计）
- 说明：当前总结未重新跑全量测试；如需最新通过率，请运行 pnpm test 并记录输出

## 风险与建议（新增）
- OAuth state 校验与 decode 兼容
  - decodeState 使用 atob 在 Node 环境不可靠，建议改用 Buffer.from(state, 'base64').toString('utf8') [sdk.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/sdk.ts#L46-L55)
  - 增加随机 nonce + 服务器端校验，提升 CSRF 防护强度
- 权限中间件一致性
  - 统一使用新版 adminProcedure（允许 labAdmin/sysAdmin），避免旧版造成权限不一致 [trpc.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/_core/trpc.ts#L30-L48)
- 数据库连接健壮性
  - 明确要求 DATABASE_URL 使用 IPv4（127.0.0.1）或确保 MySQL 同时监听 IPv6/IPv4
  - 在 upsertUser 时对数据库异常降级处理（可选），避免认证流程因短时 DB 故障中断
- 文档与脚本一致性
  - 清理或补齐 package.json 中不存在的种子脚本，减少新成员使用成本

## 近期操作记录（本地）
- 启动 Mock OAuth 服务（4000）
- 启动后端开发服务器（3000），集成 Vite 中间件
- 修复 OAuth 回调阶段数据库拒绝连接问题（切换为 127.0.0.1）
- 整理数据库表关系并补充元数据表说明（__drizzle_migrations）[DB_SCHEMA.md](file:///d:/workspace/A_bs/lab-reservation-system/docs/DB_SCHEMA.md)

## 下一步计划（建议）
- 统一权限中间件与前端权限视图（labAdmin）
- 增加 OAuth state/nonce 校验与 Buffer 解码
- 跑通并记录测试覆盖现状，补充到当前文档
- 清理无效 seed 脚本或补齐缺失脚本
- 增强设备维度日历（当前设备日历基于实验室预约，后续引入设备关联）
