# 数据库表结构与关系说明

面向实验室预约管理系统的完整数据库说明，基于当前代码库的 Drizzle ORM 模型与后端查询逻辑整理。包含每张表的用途、关键字段、逻辑关系及典型数据流与代码参考。

## 总览
- 数据库类型：MySQL
- ORM：Drizzle ORM
- 主要领域：用户、实验室、预约、设备、开放与禁用规则、审批配置与历史、违约与黑名单、审计日志、课程与课程预约、班级与班级学生、通知
- 入口模型文件：[schema.ts](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts)

## 表清单
- 用户：users
- 实验室：lab_rooms
- 预约：lab_reservations
- 预约规则：lab_reserve_rules
- 设备：lab_devices
- 通知：notifications
- 审批配置：approval_configs
- 审批历史：approval_histories
- 违约记录：violation_records
- 黑名单：blacklist
- 审计日志：audit_logs
- 课程：courses
- 课程预约：course_reservations
- 课程学生：course_students
- 开放规则：opening_rules
- 禁用时段：blocked_periods
- 班级：classes
- 班级学生：class_students
- 元数据表：__drizzle_migrations（迁移跟踪，不参与业务）

## 表详解
- users（用户）[schema.ts:8-27](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L8-L27)
  - 主键：id，自增
  - 唯一：openId（OAuth 标识）
  - 角色枚举：student, teacher, labAdmin, sysAdmin
  - 时间戳：createdAt, updatedAt, lastSignedIn
  - 用途：系统登录身份与权限来源

- lab_rooms（实验室）[schema.ts:31-50](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L31-L50)
  - 主键：id
  - 唯一：roomNo
  - 基本信息：name, building, location, capacity, type, managerId
  - 开放时段：openTimeStart, openTimeEnd
  - 状态：enabled/disabled
  - 用途：资源基础信息，预约与设备关联的载体

- lab_reservations（预约）[schema.ts:54-77](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L54-L77)
  - 主键：id
  - 关联：labId→lab_rooms.id，userId→users.id
  - 业务字段：title, reason, peopleCount, startTime, endTime
  - 状态：pending/approved/rejected/cancelled/completed/violated
  - 审批字段：rejectReason, approveTime
  - 改签字段：rescheduledFromId, rescheduleCount
  - 用途：学生/管理员/教师侧的预约核心记录

- lab_reserve_rules（预约规则）[schema.ts:81-93](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L81-L93)
  - 唯一：ruleCode（MAX_PER_DAY、MAX_DURATION、ADVANCE_DAYS）
  - 字段：ruleName, ruleValue, description, status
  - 用途：预约规则引擎参数来源

- lab_devices（设备）[schema.ts:98-113](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L98-L113)
  - 主键：id
  - 关联：labId→lab_rooms.id
  - 字段：deviceNo, name, type, purchaseDate, status, description
  - 用途：实验室设备管理与展示

- notifications（通知）[schema.ts:117-130](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L117-L130)
  - 主键：id
  - 关联：userId→users.id
  - 枚举：type（预约通过/拒绝/取消/提醒/system）
  - 字段：title, content, relatedId, relatedType, isRead
  - 用途：消息提醒中心

- approval_configs（审批配置）[schema.ts:135-150](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L135-L150)
  - 主键：id
  - 关联：labId（NULL 表示全局）
  - 字段：enableMultiLevel, approvalStages(JSON), rescheduleWindowHours, maxRescheduleCount, autoCancelHours, status
  - 用途：定义审批流程与自动取消规则

- approval_histories（审批历史）[schema.ts:155-167](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L155-L167)
  - 主键：id
  - 关联：reservationId→lab_reservations.id, approverUserId→users.id
  - 枚举：decision（pending/approved/rejected/rescheduled）
  - 用途：记录每次审批操作与意见

- violation_records（违约记录）[schema.ts:172-184](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L172-L184)
  - 主键：id
  - 关联：userId→users.id, reservationId→lab_reservations.id（可空）
  - 枚举：violationType（no_show/late_cancel/timeout_checkout/manual_record）
  - 字段：points, description, recordedAt
  - 用途：违约治理与黑名单触发依据

- blacklist（黑名单）[schema.ts:189-203](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L189-L203)
  - 主键：id
  - 关联：userId→users.id
  - 字段：totalViolationPoints, violationThreshold, restrictionType, restrictedUntil, restrictedLabIds(JSON), reason
  - 用途：预约限制与资源限制

- audit_logs（审计日志）[schema.ts:208-223](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L208-L223)
  - 主键：id
  - 关联：operatorUserId→users.id
  - 字段：operationType, targetType, targetId, details(JSON), reason, result, ipAddress, operatedAt
  - 用途：关键操作的可追踪、可检索

- courses（课程）[schema.ts:228-241](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L228-L241)
  - 主键：id
  - 唯一：courseNo
  - 关联：teacherId→users.id
  - 字段：name, description, semester, status
  - 用途：教学场景载体

- course_reservations（课程预约）[schema.ts:246-262](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L246-L262)
  - 主键：id
  - 关联：courseId→courses.id, labId→lab_rooms.id
  - 字段：title, reason, startTime, endTime, status, rejectReason, approveTime
  - 用途：教师为课程创建的预约

- course_students（课程学生）[schema.ts:267-277](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L267-L277)
  - 主键：id
  - 关联：courseId→courses.id, studentId→users.id
  - 枚举：status（enrolled/dropped/completed）
  - 用途：课程参与关系

- opening_rules（开放规则）[schema.ts:282-295](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L282-L295)
  - 主键：id
  - 关联：labId（NULL 表示全局）
  - 字段：dayOfWeek, openTime, closeTime, isWorkday, status
  - 用途：按星期开放时间校验预约是否在开放范围内

- blocked_periods（禁用时段）[schema.ts:300-314](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L300-L314)
  - 主键：id
  - 关联：labId（NULL 表示全局禁用）, deviceId→lab_devices.id（可空）
  - 枚举：reason（maintenance/vacation/inspection/…），handleExisting（allow/warn/cancel），status
  - 用途：维护期/假期等统一禁止预约的时间段

- classes（班级）[schema.ts:319-335](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L319-L335)
  - 主键：id
  - 唯一：classNo
  - 字段：name, major, grade, counselorId, capacity, description, semester, status
  - 用途：组织教学管理与批量学生关联

- class_students（班级学生）[schema.ts:340-351](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/schema.ts#L340-L351)
  - 主键：id
  - 关联：classId→classes.id, studentId→users.id
  - 字段：studentNo, status
  - 用途：学生所属班级关系

## 逻辑关系（文本）
- 用户→预约：users.id = lab_reservations.userId
- 实验室→预约：lab_rooms.id = lab_reservations.labId
- 预约→审批历史：lab_reservations.id = approval_histories.reservationId
- 审批配置→实验室（或全局）：approval_configs.labId = lab_rooms.id 或 NULL
- 违约→用户/预约：violation_records.userId = users.id；reservationId 关联预约（可空）
- 黑名单→用户：blacklist.userId = users.id
- 审计日志→操作人：audit_logs.operatorUserId = users.id；targetType + targetId 指向业务对象
- 通知→用户：notifications.userId = users.id；relatedId + relatedType 指向相关对象
- 设备→实验室：lab_devices.labId = lab_rooms.id
- 开放规则→实验室（或全局）：opening_rules.labId = lab_rooms.id 或 NULL
- 禁用时段→实验室/设备（或全局）：blocked_periods.labId = lab_rooms.id 或 NULL；deviceId = lab_devices.id
- 课程→教师：courses.teacherId = users.id
- 课程预约→课程/实验室：course_reservations.courseId = courses.id；labId = lab_rooms.id
- 课程学生→课程/学生：course_students.courseId = courses.id；studentId = users.id
- 班级学生→班级/学生：class_students.classId = classes.id；studentId = users.id

## 核心业务流
- 预约创建与审核
  - 学生提交预约 → 冲突检测、规则校验 → 进入 pending → 管理员审核（approved/rejected），并记录审计日志与通知
  - 代码参考：预约创建与审核 [routers.ts:212-368](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L212-L368)
  - 冲突检测 [db.ts:232-252](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L232-L252)、冲突详情 [db.ts:258-281](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L258-L281)
  - 规则校验（每日次数、最大时长、提前天数、禁用时段、开放规则）[db.ts:453-633](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L453-L633)

- 审批配置与自动取消
  - 按实验室或全局配置审批与自动取消超时预约
  - 自动取消实现 [db.ts:1905-1970](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L1905-L1970)
  - 路由入口 [routers.ts:868-890](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L868-L890)

- 违约与黑名单
  - 记录违约并累计分数，超过阈值自动加入黑名单，支持限制期限与资源范围
  - 实现 [db.ts:1167-1212](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L1167-L1212)
  - 查询统计与黑名单操作 [db.ts:1249-1310](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L1249-L1310)、[db.ts:1394-1418](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L1394-L1418)

- 开放规则与禁用时段
  - 开放时间按星期与实验室（或全局）合并，作为预约合法性校验依据
  - 实现 [db.ts:1668-1714](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L1668-L1714)
  - 禁用时段重叠校验 [db.ts:1774-1801](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L1774-L1801)

- 课程与课程预约
  - 教师创建课程、添加学生、提交课程预约，学生视图可见有效预约
  - 路由入口 [routers.ts:1091-1294](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L1091-L1294)、课程预约 [routers.ts:1297-1414](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L1297-L1414)

- 日历与统计
  - 时间范围预约查询、实验室日历数据（含禁用时段）、月度利用率、管理员冲突列表
  - 实现 [db.ts:1974-2179](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L1974-L2179)、[routers.ts:1659-1826](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L1659-L1826)
  - 统计与导出接口 [db.ts:849-1006](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L849-L1006)、[routers.ts:707-753](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L707-L753)

## 典型查询与代码参考
- 获取个人预约（含实验室信息）[routers.ts:165-177](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L165-L177)
- 管理员分页预约列表（含搜索/分类）[routers.ts:179-209](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L179-L209)
- 获取冲突详情（含申请人与实验室信息）[routers.ts:552-589](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L552-L589)
- 设备按实验室查询、设备 CRUD [routers.ts:649-704](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L649-L704)
- 课程学生列表与添加/移除 [routers.ts:1256-1293](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L1256-L1293)
- 审计日志按条件检索 [routers.ts:1003-1029](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L1003-L1029)
- 通知未读数与标记已读 [routers.ts:756-792](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L756-L792)

## 维护建议
- 严格维护 users.openId 唯一与角色枚举一致性
- 预约与课程预约均需做时间冲突与规则校验；修改预约时间优先重新设为 pending
- 审批配置与自动取消需谨慎配置 autoCancelHours，避免误取消
- 违约积分与黑名单阈值根据实际管理需要调整
- 全局与实验室开放规则需保证日覆盖一致性；禁用时段与开放规则并行生效时以禁用为先

## 元数据表说明
- __drizzle_migrations
  - 作用：记录已应用的迁移文件与顺序（drizzle-kit 使用），用于保障迁移的幂等与回放一致性
  - 业务：不参与任何业务读写与关系计算
  - 参考：迁移 SQL 位于 [drizzle](file:///d:/workspace/A_bs/lab-reservation-system/drizzle) 目录（例如 [0000_light_richard_fisk.sql](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/0000_light_richard_fisk.sql)、[0001_handy_hellcat.sql](file:///d:/workspace/A_bs/lab-reservation-system/drizzle/0001_handy_hellcat.sql)）

---

最后更新：以当前仓库代码为准；如 schema 或业务新增，请同步更新本说明并关联代码参考。
