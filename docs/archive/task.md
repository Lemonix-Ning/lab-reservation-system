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

## 一、P0 模块  未完成

### 0. 用户中心与个人信息管理（P0 基础功能）

目标：为所有用户提供个人资料查看和安全管理能力。

#### 0.1 核心需求

- 用户信息查看
- [x] 功能说明：查看个人资料信息与角色
- [x] 操作说明：点击用户中心即可查看个人资料
- [x] 显示字段：姓名、邮箱、登录方式、角色、最后登录时间
- [x] 权限：已登录用户可查看自己的信息

- 修改密码
- [x] 功能说明：密码修改通过统一认证平台进行
- [x] 操作说明：进入统一认证平台，按提示完成密码修改
- [x] 实现方式：提供统一认证平台的入口链接和指导文案
- [x] 权限：已登录用户可访问修改密码入口

#### 0.2 代码位置

- 前端：[client/src/pages/Profile.tsx](client/src/pages/Profile.tsx)（个人资料页面，待补完）
- 后端：[server/routers.ts](server/routers.ts)（auth.me 查询当前用户信息）
- 上下文：[client/src/_core/hooks/useAuth.ts](client/src/_core/hooks/useAuth.ts)（用户认证状态管理）

#### 0.3 验收准则

- [x] 用户可在导航栏/菜单中找到"用户中心"或个人资料入口
- [x] 点击进入后能看到完整的个人信息（姓名、邮箱、角色、登录方式等）
- [x] 页面提供指向统一认证平台修改密码的清晰入口和说明
- [x] 权限控制正确：仅登录用户可访问

---

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

**后续优化**（P2-1 后期完成）✅ 2025-12-17：
- [x] 导出功能：导出为 iCalendar 格式（供日历应用导入）✅ 已实现
- [x] 导出功能：导出为 PDF 格式（打印友好）✅ 已实现
- [x] 批量冲突检测：预约表单中实时显示冲突预约详情 ✅ 已实现
- [x] 缓存优化：React Query 按资源维度分层缓存，减少数据库查询 ✅ 已实现

**长期优化**（性能相关）：
- [ ] 批量冲突检测（创建预约前预检查）- 已由前端实时检测覆盖
- [ ] 管理员强制覆盖选项（忽略冲突警告）- 优先级低，推迟到后续迭代
- [ ] WebSocket 实时更新：预约状态变更自动刷新 - 推迟到后续迭代

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

### 6. AI 智能化调度增强（P2-2） 📋 规划中

**优先级调整**：由 P2 → P2-2（次要，依赖日历）  
**原因**：依赖日历数据聚合，可选扩展功能

#### 6.1 核心用例

 - S1 智能时间推荐（个人预约 / 主动资源优化）
 - [x] 当前：用户选择时间范围时，返回 2-3 个替代建议（基于现有智能替代方案算法：同日 ±1-12 小时、后续 21 天同一时间段、工作时间 6:00-22:00、间隙分析 + 置信度排序）
 - [ ] 下一步：在此基础上结合用户历史习惯、实验室利用率和课程表，输出 2-3 个“更优时间段”及推荐理由

 - S2 智能实验方案推荐
 - [ ] 用户用自然语言描述实验目的/背景，系统生成所需设备、建议实验室类型、预估时长、注意事项等结构化方案，并可一键带入预约表单

 - S3 实验伙伴匹配
 - [ ] 在同一时间段、相同/相近实验室中，根据专业/研究方向/技能标签匹配潜在协作伙伴，输出匹配度与说明

 - S4 周期性报告 & 主动资源优化
 - [ ] 自动生成周/月报：使用统计、冲突/违约热点、推荐的资源优化建议（如“建议扩展周三晚间开放时段”）
 - [ ] 为课程/教师生成可执行的批量排期建议（在合法时间窗内给出一组推荐排期）

#### 6.2 模块与接口设计

**后端模块（server）**

- 数据表（drizzle/schema.ts）
  - [ ] `ai_configs`：全局权重、阈值与功能开关（角色/实验类型权重、违约惩罚系数、实验室均衡度因子等），支持多套配置（演示 / 生产），使用 `is_default` 标记默认配置
  - [ ] `user_stats`：用户近 N 次预约统计（常用时间窗、爽约率、常用实验室等特征），由定时任务/离线 Job 聚合生成，避免阻塞实时预约接口
  - [ ] `user_tags`：用户专业、研究方向、技能标签，考虑增加 `onboarding_completed` 标记，首次登录时引导用户完成标签补全
  - [ ] `ai_recommendation_logs`：每次 AI 调用的输入摘要、输出结果、命中方案、用户反馈

- 服务层（可在 server/db.ts 或独立模块中实现）
  - [ ] `AiRuleService`（L1）：封装规则过滤与候选时间段生成，复用 `checkReservationRules`、`getAlternativeTimeSlots`
  - [ ] `AiScoreService`（L2）：基于可配置权重实现 `scoreTimeSlot`、`scorePartner` 等评分函数
  - [ ] `AiExplainService`（L3）：封装星火调用，统一生成“推荐理由”和可解释性字段

- tRPC 路由（server/routers.ts）
  - [ ] `ai.recommendTimeSlots(input)`：智能时间推荐 / 主动资源优化（输入：期望时间窗、用户/课程信息；输出：候选列表 + 置信度 + 结构化原因）
  - [ ] `ai.recommendExperimentPlan(input)`：实验方案推荐（输入：自然语言需求 + 专业信息；输出：结构化方案 + 推荐理由）
  - [ ] `ai.recommendPartners(input)`：实验伙伴匹配（输入：时间段、实验室、用户标签；输出：候选人列表 + 匹配度 + 说明）
  - [ ] `ai.generateUsageReport(input)`：周期性报告（输入：时间范围/范围；输出：结构化 JSON + Markdown 摘要）

**前端模块（client）**

- [ ] Hook：`useAiRecommendations`，统一封装上述 tRPC 调用、加载态与错误处理
- [ ] 组件：
  - [ ] 预约表单/日历右侧“AI 推荐时间”卡片（LabRoomList / CalendarDashboard 复用）
  - [ ] “AI 实验方案”抽屉组件：展示结构化方案并支持一键填充预约表单
  - [ ] “推荐伙伴”列表与协作邀请入口

#### 6.3 实现要求（L1 / L2 / L3 分层）

- L1 规则层（已部分完成）
  - [x] 所有推荐在生成候选时必须通过规则与冲突检测（复用 `checkReservationRules`、`getAlternativeTimeSlots`）
  - [ ] 统一错误码设计（如 `MAX_PER_DAY_EXCEEDED`、`TIME_CONFLICT` 等），供前端展示与报告统计使用

- L2 评分层（本轮 AI 的核心增量）
  - [ ] 在 `AiScoreService` 中实现 `scoreTimeSlot`：综合用户角色、实验类型、时间紧急度、违约历史、实验室使用均衡度、用户常用时间窗等特征，并对各特征做归一化（Normalization），防止某一维度数值范围过大导致权重失衡
  - [ ] 为每个候选时间段计算 `confidence`（0-1）和特征贡献度（用于 L3 可解释性）
  - [ ] 对伙伴匹配实现 `scorePartner`：基于专业/方向/技能标签和历史协作记录给出匹配度

- L3 解释与大模型层（可按需逐步引入）
  - [ ] 基于 server/_core/llm.ts / xfspark.ts 定义统一 LLM 调用包装
  - [ ] 为时间推荐、实验方案、伙伴匹配分别定义 `explanationTemplate`，将结构化评分结果转化为简短中文说明
  - [ ] LLM 解释采用异步/单独接口：推荐主接口仅返回 L2 结果，前端可额外调用 `ai.getExplanation` 或使用流式展示，避免 2-5 秒 LLM 延迟阻塞预约流程

- 审计与可观测性
  - [x] 所有 AI 推荐写入 `ai_recommendation_logs`（或沿用现有审计日志），至少包含 userId、输入摘要、top-N 推荐结果、是否被采纳
  - [ ] 管理端提供简单的 AI 调用列表与筛选（按时间、功能类型、用户）

- 隐私与安全
  - [ ] 实验伙伴匹配结果默认不暴露真实姓名/联系方式，仅返回角色、专业、标签、匹配度等概要信息及受控的邀请 handle
  - [ ] “邀请协作”通过站内信/通知完成，双方同意后才可互相查看具体联系方式
  - [ ] 在管理员端/日志中也应避免展示不必要的个人敏感信息

#### 6.4 验收准则

- [x] 推荐接口文档化（当前以 tRPC 路由 + README / DATABASE 描述为主）
- [ ] 示例周报（JSON + Markdown）
- [x] AI 调用审计可追踪（通过审计日志记录预约更新时间和审核结果）

#### 6.5 后续优化建议（本轮未完成）

- [ ] 替代方案算法考虑用户历史偏好时段（统计用户常用时间窗）
- [ ] 引入实验室利用率、设备占用情况作为推荐权重
- [ ] 支持多实验室候选（当前限定单实验室）
- [ ] 主动资源优化评分模型：将用户角色、实验类型、紧急度、违约历史、实验室均衡度等抽象为可配置权重，并用于排序推荐结果
- [ ] 智能实验方案推荐：基于用户自然语言需求 + 专业信息，调用讯飞星火生成所需设备、建议实验室类型、预估时长、注意事项等结构化 JSON（recommendExperimentPlan）
- [ ] 智能时间推荐：在现有替代时间槽基础上，引入用户习惯/课程表/实验室利用率等统计特征，并通过星火生成“最佳时间段 + 置信度 + 推荐理由”（recommendBestTime）
- [ ] 实验伙伴匹配系统：根据预约时间、实验室、专业、研究方向和技能标签筛选候选人，由星火计算匹配度并给出可解释的协作建议

#### 6.6 开发实施路线图（六阶段）

> 目标：给 P2-2 提供一套可直接照着执行的工程化路线，从 DB → 服务层 → API → 前端 → LLM → Demo 打磨，尽量避免“想法落不了地”。

**阶段一：基础设施与数据库层（Infrastructure & DB）**

- Step 1.1 Schema 定义与迁移
  - [ ] 在 [drizzle/schema.ts](drizzle/schema.ts) 新增/扩展以下表结构：
    - `ai_configs`：`key`(PK)、`value`(JSON/数值)、`description`、`is_default`、`updated_at`
    - `user_stats`：`user_id`(FK)、`favorite_time_slots`(JSON)、`no_show_rate`(Float)、`last_updated`
    - `user_tags`：`user_id`(FK)、`tags`(string[])、`research_area`、`onboarding_completed`(Boolean)
    - 复用 `audit_logs` 或新增 `ai_recommendation_logs`：记录 AI 调用输入摘要、输出结果、命中方案、用户反馈
  - [ ] 运行 `pnpm db:push`，确认数据库迁移成功

- Step 1.2 种子数据与 Mock 脚本
  - [ ] 在 [scripts/](scripts) 下扩展现有 `seed.mjs` 或新增 `seed-ai.mjs`：
    - 插入一套默认权重配置到 `ai_configs`（含“生产配置”“DEMO 配置”两套）
    - 生成约 50 个虚拟用户及其 `user_tags`（专业、研究方向、技能标签）
    - 为部分用户生成历史预约记录，为后续 `user_stats` 聚合提供原始数据
  - [ ] 验证数据库中存在可用于调度算法的测试数据

**阶段二：L1 & L2 核心服务层（Core Services）**

- Step 2.1 规则服务封装（L1 - AiRuleService）
  - [ ] 在 `server/services/ai/ruleService.ts` 中封装：
    - 对现有 `checkReservationRules`、`getAlternativeTimeSlots` 做轻量封装，形成 `getCandidateTimeSlots` 等方法
    - 统一返回结构（包含错误码，如 `TIME_CONFLICT` / `MAX_PER_DAY_EXCEEDED` 等）
  - [ ] 确认现有预约流程复用 L1 能力后行为不变

- Step 2.2 评分引擎实现（L2 - AiScoreService）
  - [ ] 在 `server/services/ai/scoreService.ts` 中实现：
    - `normalize(value, min, max)` 工具函数
    - `scoreTimeSlot(slot, userContext, config)`：
      - 从 `ai_configs` 读取权重
      - 计算角色权重、习惯匹配度、违约惩罚、实验室利用率、均衡度等特征
      - 对各特征做归一化，避免数值范围不一致导致权重失衡
      - 返回 `{ score, breakdown }`，其中 `breakdown` 为后续 L3 解释准备数据
  - [ ] 为不同角色/违约程度编写若干单元测试：确保“教授 > 普通学生”“高违约 < 低违约”等直觉结果成立

- Step 2.3 聚合统计任务（User Stats Job）
  - [ ] 在 `server/jobs/userStats.ts` 或 `scripts/aggregate-user-stats.mjs` 中实现 `aggregateUserStats(userId)`：
    - 查询用户过去 N 个月预约记录
    - 统计常用 `dayOfWeek + hour` 组合、计算 no_show_rate
    - 写入/更新 `user_stats` 表
  - [ ] 支持批量模式：`aggregateUserStatsForAllUsers()`，便于定时任务运行

**阶段三：API 接口开发（tRPC Layer）**

- Step 3.1 智能时间推荐接口
  - [ ] 在 [server/routers.ts](server/routers.ts) 中新增 `ai` 路由（或独立 `aiRouter`）：
    - `ai.recommendTimeSlots(input)`：
      - 调用 L1：`getCandidateTimeSlots` 获取候选时间段
      - 调用 L2：`scoreTimeSlot` 为每个候选打分
      - 按分数降序排序，取 Top 3
      - 写入 `ai_recommendation_logs`
      - 暂不调用 LLM，直接返回结构化结果 `{ slots: [{ start, end, confidence, breakdown }...] }`

- Step 3.2 实验伙伴匹配接口
  - [ ] 在 `ai` 路由中新增 `ai.recommendPartners(input)`：
    - 输入：`date`, `timeSlot`, `labId`
    - 逻辑：
      - 查询该时段该实验室的其他预约用户
      - 基于 `user_tags` 计算相似度（例如 Jaccard 相似度）
      - 做脱敏处理（隐藏真实姓名/联系方式，仅返回角色、专业、标签、匹配度等）
    - 输出：按匹配度排序的候选人列表

**阶段四：前端集成（Client Integration）**

- Step 4.1 推荐组件开发
  - [ ] 在 [client/src/hooks](client/src/hooks) 下实现 `useAiRecommendations`：统一封装 `ai.recommendTimeSlots` / `ai.recommendPartners` 调用
  - [ ] 在 [client/src/pages/LabRoomList.tsx](client/src/pages/LabRoomList.tsx) 与 [client/src/pages/CalendarDashboard.tsx](client/src/pages/CalendarDashboard.tsx) 集成：
    - 开发 `AiRecommendationCard` 组件：展示 Top 3 时间、推荐指数（星级/百分比）
    - 支持点击推荐时间，一键回填预约表单并重新触发规则检查

- Step 4.2 标签补全引导
  - [ ] 在首页或个人中心（如 Dashboard / Profile 页）检查 `user_tags.onboarding_completed`
  - [ ] 若为 false，则弹出引导 Modal：提示用户选择专业、研究方向和技能标签
  - [ ] 填写完成后更新 `user_tags` 并置 `onboarding_completed = true`

**阶段五：L3 大模型增强（LLM Integration）**

- Step 5.1 LLM 服务封装
  - [ ] 在 `server/services/ai/explainService.ts` 中封装基于 [server/_core/llm.ts](server/_core/llm.ts)、[server/_core/xfspark.ts](server/_core/xfspark.ts) 的统一调用
  - [ ] 设计 Prompt 模板：把 L2 的 `breakdown`（如“习惯匹配高 / 实验室空闲高 / 紧迫度高”）转为自然语言解释
  - [ ] 实现 `generateExplanation(context)`，支持时间推荐、实验方案、伙伴匹配三种场景

- Step 5.2 异步加载解释
  - [ ] 在 `ai` 路由中新增 `ai.getExplanation(input)`：输入为推荐结果摘要 + 评分 `breakdown`
  - [ ] 前端在推荐列表渲染后，对 Top 1 或用户 hover/点击的项发起解释请求
  - [ ] UI 状态：先展示推荐列表，再显示“AI 正在生成理由...” 占位，完成后替换为解释文案

**阶段六：演示准备与优化（Polish & Demo）**

- Step 6.1 演示模式配置
  - [ ] 在 `ai_configs` 中插入一条 `DEMO_MODE` 配置：例如极高的违约惩罚权重或研究生优先级
  - [ ] 后台或环境变量提供简单开关，可在“生产配置 / DEMO 配置”之间切换

- Step 6.2 审计日志看板
  - [ ] 在管理员后台新增“AI 调用日志”页面（可复用 [client/src/pages/AuditLog.tsx](client/src/pages/AuditLog.tsx) 的表格样式）：
    - 显示：调用时间、用户、调用类型（时间推荐/伙伴匹配/方案推荐）、Top-N 推荐结果摘要、是否被采纳
  - [ ] 支持按时间范围、功能类型、用户进行筛选，辅助比赛展示“AI 在实际工作的证据”

- Step 6.3 验收指标（性能 / 可观测性 / 降级）
  - [ ] `ai.recommendTimeSlots` 返回 `meta` 字段（用于 Demo 展示与排障）：
    - `requestId`（前后端贯通）
    - `elapsedMs`（接口耗时，ms）
    - `candidateCount`（候选数量）
    - `scoredCount`（参与打分数量）
    - `configKey` / `configVersion`（当前使用的配置，用于对比 Demo/生产）
  - [ ] `ai_recommendation_logs`（或 audit_logs 扩展字段）记录最小证据链：
    - `requestId`、`featureType`、`userId`
    - `inputDigest`（脱敏摘要：时间窗/时长/labId 等）
    - `topResultsDigest`（Top3 的 start/end/score/confidence 摘要）
    - `accepted`（是否采纳）与 `acceptedSlotIndex`（采纳第几条）
    - `elapsedMs`、`configKey/configVersion`
  - [ ] LLM 不得阻塞主流程：
    - 推荐主接口仅返回 L2 结构化结果（含 `breakdown`）
    - 解释文案通过 `ai.getExplanation` 异步获取（或 hover/click 触发）
  - [ ] LLM 降级策略（比赛稳定性保障）：
    - 星火调用失败/超时（建议 2-3s）时，回退为“本地模板解释”（基于 L2 breakdown 拼接 2-3 条要点）
    - UI 明确提示“当前为简要解释/已降级”，避免误导
  - [ ] Demo 口径 KPI（以可视化为准，不强制线上真实口径）：
    - 推荐响应耗时（P95）< 500ms（不含 LLM 解释）
    - 推荐采纳率 ≥ 60%（演示环境可通过固定脚本操作达成）

- Step 6.4 3-5 分钟演示脚本（含固定数据）
  - [ ] Demo 前置准备
    - [ ] 运行/准备固定种子数据：`scripts/seed-ai.mjs`（或扩展现有 seed）
    - [ ] 确保存在 3 组可复现场景：
      - 场景 A：同实验室同时间已有占位，必定冲突 → 推荐给出可用时段
      - 场景 B：用户有违约历史（高 no_show_rate） → 推荐更保守/低风险时段
      - 场景 C：热门实验室过载（利用率高） → 推荐均衡到更空闲时段或相近资源（如有支持）
    - [ ] 提供一键重置方式（仅 Demo 环境）：重置并重新 seed，保证每次演示一致
  - [ ] Demo 主线（建议顺序）
    - [ ] 1) 进入日历/预约页面，选择一个会冲突的时间窗（触发场景 A）
    - [ ] 2) 展示“开启 AI 推荐（L2）”的 Top3：包含 `confidence` + 2-3 条结构化理由（或异步解释）
    - [ ] 3) 一键应用 Top1，完成预约创建/提交审核，页面即时刷新（证明确实可用）
    - [ ] 4) 切换到“基础规则推荐/关闭 AI”（或切换到“生产配置”），同样输入再对比推荐排序差异（对比点）
    - [ ] 5) 打开“AI 调用日志”看板，筛选当前用户/时间范围，展示本次调用的证据链（requestId/top3/采纳）

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
