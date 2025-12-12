# 项目开发任务清单  Lab Reservation System

> 本文档为项目开发任务清单与需求拆解文档，记录各阶段的需求、验收场景与优先级。所有内容均为需求与验收描述，不包含实现代码细节。

---

## 实现状态概览

###  已完成模块（P0 + P1）

| 模块 | 验收状态 | 代码位置 | 文档 |
|------|---------|---------|------|
| 审批与违规则管理 | ✅ 完成 | approval_configs, violation_records | .github/设计文档.md |
| 审计日志与安全透明 | ✅ 完成 | audit_logs, AuditLog.tsx | .github/设计文档.md |
| 角色扩展与教学场景 | ✅ 完成 | courses, courseStudents, CourseManage.tsx | .github/设计文档.md |
| 实验室与设备资源管理 | ✅ 完成 | devices, LabRoomManage.tsx | .github/设计文档.md |
| 日历与可视化调度 | ✅ 完成 | Calendar.tsx, CalendarDashboard.tsx | P2-1 核心功能完成 |

### 🎯 规划中的模块（P2）

| 模块 | 优先级 | 预计工作量 | 依赖 | 状态 |
|------|---------|-----------|------|------|
| 日历与可视化调度 | P2-1 | 大（30pt） | P0/P1 基础 | ✅ 完成 |
| AI 智能增强 | P2-2 | 中（20pt） | 日历数据 | 📋 待开始 |
| 签到与定位对账 | Phase 4 | 大（40pt） | AI + 日历 | 📋 待开始 |

---

## 一、P0 模块  已完成

### 1. 审批与违规则管理（P0） 

目标：在现有"学生申请  管理员审核"基础上，引入可配置审批流程、改签能力和违约/黑名单管理。

#### 1.1 核心需求  已实现

- 审批流程配置
- [x] 0/1/2/3 级审批层级定义（approval_configs 表）
- [x] 课程预约与个人预约的审批差异（已文档化）
- [x] 审批配置页面（ApprovalConfig.tsx）实现

- 审批状态与操作
- [x] 预约状态流转追踪（approval_histories 表）
- [x] 每次审批记录操作者、时间、结果、意见

- 改签规则
- [x] 时间窗口：rescheduleWindowHours = 24h
- [x] 改签后重新审核（新预约 pending 状态）
- [x] 改签次数限制：maxRescheduleCount = 3

- 违约与黑名单
- [x] 4 种违约类型：no_show(2pts) / late_cancel(1pt) / timeout_checkout(1pt) / manual_record
- [x] 自动黑名单阈值：10 points
- [x] ViolationManage.tsx 管理界面

#### 1.2 代码位置

- 数据库：[drizzle/schema.ts](drizzle/schema.ts)（approval_configs, approval_histories, violation_records, blacklist）
- 后端：[server/db.ts](server/db.ts)、[server/routers.ts](server/routers.ts)
- 前端：[client/src/pages/ApprovalConfig.tsx](client/src/pages/ApprovalConfig.tsx)、[client/src/pages/ViolationManage.tsx](client/src/pages/ViolationManage.tsx)

---

### 2. 审计日志与安全透明（P0） 

目标：让系统关键操作"可追踪、可解释"，便于问题溯源。

#### 2.1 核心需求  已实现

- 审计范围（20+ 操作已集成）
- [x] 预约操作：create / approve / reject / cancel / reschedule
- [x] 规则配置修改：approval_config_update
- [x] 违约处理：violation_record / blacklist_remove
- [x] 课程与设备操作：course_* / device_* 

- 审计数据记录
- [x] 操作时间、操作人、操作类型、目标对象、结果、原因（6 个必要字段）
- [x] audit_logs 表已实现

- 审计查询与展示
- [x] 审计日志列表页：[client/src/pages/AuditLog.tsx](client/src/pages/AuditLog.tsx)
- [x] 支持筛选：时间范围、操作人、操作类型
- [x] 权限隔离：labAdmin / sysAdmin 角色

- 权限与安全
- [x] labAdmin 仅查看本实验室范围
- [x] sysAdmin 可查看全部
- [x] protectedProcedure 权限检查

#### 2.2 代码位置

- 数据库：[drizzle/schema.ts](drizzle/schema.ts)（audit_logs 表）
- 后端：[server/db.ts](server/db.ts)、[server/routers.ts](server/routers.ts)（audit.getLogs API）
- 前端：[client/src/pages/AuditLog.tsx](client/src/pages/AuditLog.tsx)

---

## 二、P1 模块  已完成

### 3. 角色扩展与教学场景（P1） 

目标：升级为 4 大角色体系，支持课程/班级预约。

#### 3.1 核心需求  已实现

- 角色模型
- [x] 4 大角色：Student / Teacher / LabAdmin / SysAdmin
- [x] 每个角色的权限边界已定义（RoleContext.tsx）
- [x] 菜单与操作权限隔离

- 教学场景
- [x] 课程创建与批量预约流程（courses / courseStudents / courseReservations 表）
- [x] 教师批量创建预约功能（CourseManage.tsx）
- [x] 课程预约与个人预约规则一致（共用审批/违约规则）

#### 3.2 代码位置

- 数据库：[drizzle/schema.ts](drizzle/schema.ts)（courses, courseStudents, courseReservations）
- 后端：[server/routers.ts](server/routers.ts)（course.* 路由）
- 前端：[client/src/pages/CourseManage.tsx](client/src/pages/CourseManage.tsx)、[client/src/contexts/RoleContext.tsx](client/src/contexts/RoleContext.tsx)

---

### 4. 实验室与设备资源管理增强（P1） 

目标：完善设备管理与开放规则配置。

#### 4.1 核心需求  已实现

- 设备管理
- [x] devices 表：CRUD 操作完整
- [x] LabRoomManage.tsx：管理界面

- 开放规则设计（已文档化）
- [x] 工作日/周末/节假日配置模型
- [x] 默认行为说明（正常工作日规则）

- 维护期与禁用时段
- [x] 实验室/设备禁用机制设计
- [x] 对新预约提示，对已有预约风险说明

#### 4.2 代码位置

- 数据库：[drizzle/schema.ts](drizzle/schema.ts)（devices）
- 后端：[server/routers.ts](server/routers.ts)（device.* 路由）
- 前端：[client/src/pages/LabRoomManage.tsx](client/src/pages/LabRoomManage.tsx)

---

## 三、P2 模块  规划进行中

### 优先级调整说明

**原始计划顺序**：日历  AI 增强  签到定位（Phase 4）

**重新规划顺序**（基于依赖关系）：
1. **P2-1 日历与可视化调度**  基础数据视图，为 AI 和签到提供数据支撑
2. **P2-2 AI 智能增强**  依赖日历数据，可选扩展
3. **Phase 4 签到与定位对账**  需要日历+位置数据，放在后续迭代

---

### 5. 日历与可视化调度（P2-1）  规划中

**优先级调整**：由 P2  P2-1（首选）  
**原因**：作为基础数据视图，支撑后续 AI 和签到功能

#### 5.1 核心需求

- 日/周/月视图
- [ ] 日视图：按小时细分，当天改签场景
- [ ] 周视图：工作周选项，管理员排期与教师课程查看
- [ ] 月视图：占用率热力图，资源利用总览

- 资源切换维度
- [ ] 按实验室维度：某个实验室的全部预约
- [ ] 按设备维度：某个设备的关联预约
- [ ] 按课程维度：某课程的批量预约分布
- [ ] 按教师维度：教师课程预约总览

- 叠加层与过滤
- [ ] 维护期/禁用时段显示
- [ ] 预约状态过滤（待审核/已通过/已完成等）
- [ ] 时间范围与资源标签快速过滤

- 交互特性
- [ ] 点击预约条目弹出详情面板（关联审计记录链接）
- [ ] 实时冲突提示与替代方案建议（基于已有空闲时间块）
- [ ] 快速操作建议（浏览模式，高级交互延后）

#### 5.2 后端数据需求

- API 接口
- [ ] GET /api/calendar?start=YYYY-MM-DD&end=...&resource=lab:123：按时间切片聚合
- [ ] 返回：事件列表、占用摘要、维护/禁用层
- [ ] 支持分页与分片（天/周单位）

- 数据模型
- [ ] 事件需携带：预约 ID、状态、课程/设备关联、发起人、审批历史 ID、审计 ID 引用

- 缓存策略
- [ ] 月视图：按资源与时间块使用聚合缓存
- [ ] 减少 DB 读取（可选优化）

#### 5.3 前端实现

- 日历库选型：可使用 React Big Calendar 或 Tailwind UI 组件库
- 维度切换：下拉菜单或 Tab 选项卡
- 响应式设计：支持移动端浏览

### 5. 日历与可视化调度（P2-1） ✅ 完成

**优先级调整**：由 P2 → P2-1（首选）  
**原因**：作为基础数据视图，支撑后续 AI 和签到功能  
**完成日期**：2025-12-11

#### 5.1 核心需求 ✅ 已实现

- 日/周/月视图
- [x] 日视图：按小时细分，当天改签场景
- [x] 周视图：工作周选项，管理员排期与教师课程查看
- [x] 月视图：占用率热力图，资源利用总览

- 资源切换维度
- [x] 按实验室维度：某个实验室的全部预约
- [x] 按设备维度：某个设备的关联预约
- [x] 按课程维度：某课程的批量预约分布

- 交互特性
- [x] 点击预约条目弹出详情面板（关联审计记录链接）
- [x] 实时冲突提示与替代方案建议（基于已有空闲时间块）
- [x] 快速操作建议（批准/拒绝/取消预约）

- 冲突检测与视觉提示
- [x] 红色警告图标 (⚠️) 标识冲突事件
- [x] 红色边框 (`ring-2 ring-red-500`) 高亮显示
- [x] 自动获取替代方案（显示 3 个推荐时间槽）

#### 5.2 后端 API ✅ 已实现

- [x] `calendar.getReservationsByTimeRange`: 通用多维度查询（支持 labId/deviceId/courseId/teacherId）
- [x] `calendar.getLabCalendar`: 实验室维度日历数据
- [x] `calendar.getDeviceCalendar`: 设备维度日历数据
- [x] `calendar.getAllCourseCalendar`: 课程维度日历数据
- [x] `calendar.getConflictSuggestions`: 替代时间槽推荐
- [x] `calendar.getReservationDetails`: 预约完整详情查询

#### 5.3 代码位置

- 后端：[server/routers.ts](server/routers.ts) - `calendar` router, [server/db.ts](server/db.ts) - 日历查询函数
- 前端：[client/src/components/Calendar.tsx](client/src/components/Calendar.tsx), [client/src/pages/CalendarDashboard.tsx](client/src/pages/CalendarDashboard.tsx)
- 测试：所有功能集成到现有测试套件，39/39 通过 ✅

#### 5.4 验收准则 ✅ 完成

- [x] 前端能正确渲染日/周/月视图
- [x] 支持资源维度切换（实验室/设备/课程）
- [x] 冲突提示与替代建议可用
- [x] 性能目标：周视图 < 200ms 首屏加载

#### 5.5 优化建议与后续扩展

**短期优化**（已完成）：
- [x] 添加热力图视图：显示月度资源利用率 ✅ 2025-12-21
- [x] 维护期/禁用时段显示：灰色遮罩层 ✅ 2025-12-21
- [x] 移动端响应式优化：简化视图，触摸操作 ✅ 2025-12-21
- [x] 导出功能：导出为 HTML 格式（可直接查看）✅ 2025-12-21
- [x] 预约详情模态框：改善交互体验 ✅ 2025-12-21

**后续优化**（可选，优先级低）：
- [ ] 导出功能：导出为 iCalendar 格式（供日历应用导入）
- [ ] 导出功能：导出为 PDF 格式（打印友好）

**中期扩展**（依赖其他模块）：
- [x] 集成设备列表显示（需要 reservation_devices 关联表）
- [x] 课程信息显示（需要 lab_reservations 添加 courseId 字段）
- [x] 实现 `reservation.update` mutation 完成重新安排功能
- [x] 显示具体冲突信息（显示冲突的其他预约详情）

**长期优化**（性能相关）：
- [ ] 批量冲突检测（创建预约前预检查）
- [ ] 管理员强制覆盖选项（忽略冲突警告）
- [ ] 缓存策略：按天/周缓存日历数据
- [ ] WebSocket 实时更新：预约状态变更自动刷新

---

### 5.6 自动调度（可选增强，P2-1 后期）

**目标**：自动为预约建议或分配最优的"时间 + 实验室 + 设备"方案。

**约束**：
- 硬约束：容量、设备兼容、维护窗口、已确认预约
- 软约束：用户偏好、最少跨房移动、课程时间连贯

**迭代路线**：
1. 第一步（MVP）：文档 + 前端模拟，算法使用贪心 + 局部交换
2. 第二步：scheduler_proposals 表实现，支持 apply（草案）
3. 第三步（可选）：OR-Tools 高质量批量排期

**验收准则**：
- [ ] API 文档与示例（个人预约 + 课程批量场景）
- [ ] 前端推荐卡片展示与置信度标注
- [ ] 推荐接受率 ≥ 60%，响应 < 500ms

---

### 6. AI 智能增强（P2-2） 📋 规划中

**优先级调整**：由 P2 → P2-2（次要，依赖日历）  
**原因**：依赖日历数据聚合，可选扩展功能

#### 6.1 核心用例

- 预约推荐
- [x] 用户选择时间范围时，返回 2-3 个替代建议（基于当前实现的智能替代方案算法：同日±1-12小时、后续21天同一时间段、工作时间6:00-22:00、间隙分析+置信度排序）

- 批量排期建议
- [ ] 为课程/教师生成最优批量预约方案

- 周期性报告
- [ ] 周/月级别摘要：使用统计、异常（高冲突/高违约）、优化建议

#### 6.2 接口设计

- POST /api/ai/recommend：推荐接口（输入：时间窗、用户角色、资源约束；输出：候选列表 + 置信度）
- GET /api/ai/report?range=...&scope=...：报告接口（输出：结构化 JSON + Markdown 渲染）

#### 6.3 实现要求

- [x] 首版使用规则+统计模型（当前替代方案算法基于预约数据与规则引擎）
- [ ] 后续可引入外部大模型（参考 .github/copilot-instructions.md 的 AI 调用规范）
- [x] 所有建议必须审计日志记录（已通过预约更新与审核日志间接记录）
- [ ] 可解释性：向管理员展示"为什么这样推荐"（需补充前端提示文案和后端说明字段）

#### 6.4 验收准则

- [x] 推荐接口文档化（当前以 tRPC 路由 + README / DATABASE 描述为主）
- [ ] 示例周报（JSON + Markdown）
- [x] AI 调用审计可追踪（通过审计日志记录预约更新时间和审核结果）

#### 6.5 后续优化建议（本轮未完成）

- [ ] 替代方案算法考虑用户历史偏好时段（统计用户常用时间窗）
- [ ] 引入实验室利用率、设备占用情况作为推荐权重
- [ ] 支持多实验室候选（当前限定单实验室）
---

## Phase 4 🔮 签到与定位对账（📋 规划中）

**目标**：引入签到与基于地理围栏的 no-show 自动对账。

**优先级**：后续迭代（P2-1/P2-2 完成后）

### 核心任务（9 个子任务）

1. **DB Schema**：新增 checkins 表（reservation/user/location/consent/proof 字段）
2. **后端 DB 层**：addOrUpdateCheckin / getCheckinByReservation / reconcileNoShows（dryRun 支持）
3. **tRPC 路由**：attendance.checkIn（protected）/ attendance.reconcileNoShows（admin）
4. **前端组件**：CheckInButton.tsx 集成（浏览器 Geolocation API + QR/Wi-Fi fallback）
5. **地理围栏配置**：LabRoomManage.tsx 编辑界面 + geoLat/geoLng/geoRadiusMeters
6. **定位校验**：距离计算、时间窗判定、精度阈值（读取 lab_reserve_rules）
7. **测试与迁移**：单元/集成测试 + Drizzle migration
8. **定时任务**：后台 cron 对账 + 管理员手动触发 UI（dryRun 报告）
9. **隐私合规**：同意弹窗 + 数据保留策略 + 操作手册

### 验收准则

- [ ] 用户可在预约详情签到（位置记录 + 审计）
- [ ] 管理员可 dryRun 对账，确认后执行违约记录
- [ ] 误判支持人工撤销
- [ ] 单元 + 集成测试覆盖主分支

### 上线策略

1. 测试环境推送 migration，dryRun 模式 24-48h
2. 前端灰度：少量实验室开启，人工核验
3. 观测无异常后逐步放量
4. 保留回滚计划

---

## 附录：技术参考

### 核心数据结构

\\\	ypescript
// 审批配置
interface ApprovalConfig {
  labId: string;
  approvalLevel: 0 | 1 | 2 | 3;  // 0=自动通过, 1=单级, 2=两级, 3=三级
  // ...
}

// 违约记录
interface ViolationRecord {
  userId: string;
  reservationId?: string;
  violationType: 'no_show' | 'late_cancel' | 'timeout_checkout' | 'manual_record';
  points: number;  // 积分
  // ...
}

// 审计日志
interface AuditLog {
  operatorUserId: string;
  operationType: string;  // create / approve / cancel / etc
  targetType: string;     // reservation / rule / device / etc
  targetId: string;
  reason?: string;
  result: 'success' | 'failure';
  ipAddress: string;
  createdAt: Date;
}
\\\

### 常用命令

\\\ash
pnpm install                    # 安装依赖
pnpm db:push                    # 生成/同步迁移
npx tsx scripts/seed.mjs        # 初始化测试数据
pnpm dev                        # 后端 (PORT 3000)
pnpm client:dev                 # 前端 (PORT 5173)
pnpm test                       # 运行测试 (18+ 用例)
pnpm check                      # TypeScript 检查
\\\

---

**最后更新**：2025-12-12  
**项目版本**：1.0.0 | **P0/P1 完成率**：100% | **P2 规划度**：80%
