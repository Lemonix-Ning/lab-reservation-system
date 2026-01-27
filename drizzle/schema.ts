import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["student", "teacher", "labAdmin", "sysAdmin"]).default("student").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 实验室信息表
 */
export const labRooms = mysqlTable("lab_rooms", {
  id: int("id").autoincrement().primaryKey(),
  roomNo: varchar("roomNo", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  building: varchar("building", { length: 100 }),
  location: varchar("location", { length: 200 }),
  capacity: int("capacity").default(0),
  type: varchar("type", { length: 50 }),
  managerId: int("managerId"),
  openTimeStart: varchar("openTimeStart", { length: 10 }).default("08:00"),
  openTimeEnd: varchar("openTimeEnd", { length: 10 }).default("22:00"),
  status: mysqlEnum("status", ["enabled", "disabled"]).default("enabled").notNull(),
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LabRoom = typeof labRooms.$inferSelect;
export type InsertLabRoom = typeof labRooms.$inferInsert;

/**
 * 预约记录表
 */
export const labReservations = mysqlTable("lab_reservations", {
  id: int("id").autoincrement().primaryKey(),
  labId: int("labId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  reason: text("reason"),
  peopleCount: int("peopleCount").default(1),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled", "completed", "violated"]).default("pending").notNull(),
  rejectReason: text("rejectReason"),
  applyTime: timestamp("applyTime").defaultNow().notNull(),
  approveTime: timestamp("approveTime"),
  rescheduledFromId: int("rescheduledFromId"), // 改签来源预约ID
  rescheduleCount: int("rescheduleCount").default(0), // 改签次数计数
  // deviceId: int("deviceId"), // 设备ID（外键，NULL表示不针对特定设备）- TODO: 待后续支持
  // courseId: int("courseId"), // 课程ID（外键，NULL表示非课程相关预约）- TODO: 待后续支持
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LabReservation = typeof labReservations.$inferSelect;
export type InsertLabReservation = typeof labReservations.$inferInsert;

/**
 * 预约规则配置表
 */
export const labReserveRules = mysqlTable("lab_reserve_rules", {
  id: int("id").autoincrement().primaryKey(),
  ruleCode: varchar("ruleCode", { length: 50 }).notNull().unique(),
  ruleName: varchar("ruleName", { length: 100 }).notNull(),
  ruleValue: varchar("ruleValue", { length: 100 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["enabled", "disabled"]).default("enabled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LabReserveRule = typeof labReserveRules.$inferSelect;
export type InsertLabReserveRule = typeof labReserveRules.$inferInsert;

/**
 * 实验室设备表
 */
export const labDevices = mysqlTable("lab_devices", {
  id: int("id").autoincrement().primaryKey(),
  labId: int("labId").notNull(),
  deviceNo: varchar("deviceNo", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }),
  purchaseDate: timestamp("purchaseDate"),
  status: mysqlEnum("status", ["available", "maintenance", "retired"]).default("available").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LabDevice = typeof labDevices.$inferSelect;
export type InsertLabDevice = typeof labDevices.$inferInsert;

/**
 * 通知消息表
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["reservation_approved", "reservation_rejected", "reservation_cancelled", "reservation_reminder", "system"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  relatedId: int("relatedId"), // 关联的预约ID等
  relatedType: varchar("relatedType", { length: 50 }), // 关联类型：reservation, lab, device
  isRead: int("isRead").default(0).notNull(), // 0-未读, 1-已读
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * 审批配置表 - 按实验室/课程配置审批流程
 */
export const approvalConfigs = mysqlTable("approval_configs", {
  id: int("id").autoincrement().primaryKey(),
  labId: int("labId"), // 针对特定实验室，null 表示全局规则
  name: varchar("name", { length: 100 }).notNull(), // 配置名称
  enableMultiLevel: int("enableMultiLevel").default(0).notNull(), // 0-单级, 1-多级
  approvalStages: text("approvalStages").notNull(), // JSON: [{ stage: 1, role: 'teacher', allowApprove: true, allowReject: true, canModifyTime: false }]
  rescheduleWindowHours: int("rescheduleWindowHours").default(24), // 允许改签的时间窗口（小时），开始前多少小时
  maxRescheduleCount: int("maxRescheduleCount").default(3), // 单个预约最多改签次数
  autoCancelHours: decimal("autoCancelHours", { precision: 5, scale: 2 }).default("1"), // 预约开始后未签到多少小时自动取消（0表示禁用）
  status: mysqlEnum("status", ["enabled", "disabled"]).default("enabled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApprovalConfig = typeof approvalConfigs.$inferSelect;
export type InsertApprovalConfig = typeof approvalConfigs.$inferInsert;

/**
 * 审批历史表 - 记录每次审批操作
 */
export const approvalHistories = mysqlTable("approval_histories", {
  id: int("id").autoincrement().primaryKey(),
  reservationId: int("reservationId").notNull(), // 对应预约ID
  approverUserId: int("approverUserId").notNull(), // 审批人ID
  approvalStage: int("approvalStage").notNull(), // 第几级审批 (1, 2, 3...)
  decision: mysqlEnum("decision", ["pending", "approved", "rejected", "rescheduled"]).notNull(), // 审批决策
  comment: text("comment"), // 审批意见/原因
  approvedAt: timestamp("approvedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalHistory = typeof approvalHistories.$inferSelect;
export type InsertApprovalHistory = typeof approvalHistories.$inferInsert;

/**
 * 违约记录表 - 记录用户违约行为与计分
 */
export const violationRecords = mysqlTable("violation_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // 违约用户
  reservationId: int("reservationId"), // 相关预约ID（可为空）
  violationType: mysqlEnum("violationType", ["no_show", "late_cancel", "timeout_checkout", "manual_record"]).notNull(), // 违约类型
  points: int("points").notNull().default(1), // 违约计分
  description: text("description"), // 违约描述
  recordedAt: timestamp("recordedAt").notNull().defaultNow(), // 记录时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ViolationRecord = typeof violationRecords.$inferSelect;
export type InsertViolationRecord = typeof violationRecords.$inferInsert;

/**
 * 黑名单表 - 存储被限制的用户及限制期限
 */
export const blacklist = mysqlTable("blacklist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  totalViolationPoints: int("totalViolationPoints").notNull(), // 当前总违约分
  violationThreshold: int("violationThreshold").notNull(), // 触发黑名单的阈值分数
  restrictionType: mysqlEnum("restrictionType", ["time_limit", "resource_limit"]).notNull(), // 限制类型：时间限制 或 资源限制
  restrictedUntil: timestamp("restrictedUntil"), // 限制截止时间（时间限制类型用）
  restrictedLabIds: text("restrictedLabIds"), // JSON: [1, 2, 3] 限制的实验室ID列表（资源限制类型用）
  reason: text("reason"), // 进入黑名单的原因
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Blacklist = typeof blacklist.$inferSelect;
export type InsertBlacklist = typeof blacklist.$inferInsert;

/**
 * 审计日志表 - 记录系统内所有关键操作
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  operatorUserId: int("operatorUserId").notNull(), // 操作人ID
  operationType: varchar("operationType", { length: 50 }).notNull(), // 操作类型: login, reservation_create, reservation_approve, reservation_reject, reservation_cancel, reservation_reschedule, violation_record, blacklist_add, blacklist_remove, rule_update, approval_config_update, data_export
  targetType: varchar("targetType", { length: 50 }).notNull(), // 目标类型: reservation, user, rule, approval_config
  targetId: int("targetId"), // 目标对象ID
  details: text("details"), // JSON 格式的详细信息
  reason: text("reason"), // 操作原因/备注
  result: mysqlEnum("result", ["success", "failed"]).default("success").notNull(), // 操作结果
  ipAddress: varchar("ipAddress", { length: 50 }), // 操作IP（如有）
  operatedAt: timestamp("operatedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * 课程表 - 支持教学场景（Phase 4 P1）
 */
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  courseNo: varchar("courseNo", { length: 50 }).notNull().unique(), // 课程编号
  name: varchar("name", { length: 100 }).notNull(), // 课程名称
  teacherId: int("teacherId").notNull(), // 授课教师ID（外键）
  description: text("description"), // 课程描述
  semester: varchar("semester", { length: 50 }).notNull(), // 学期：2024-1, 2024-2 等
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(), // 状态
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * 课程预约表 - 教师创建的课程级预约
 */
export const courseReservations = mysqlTable("course_reservations", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(), // 课程ID（外键）
  labId: int("labId").notNull(), // 实验室ID（外键）
  title: varchar("title", { length: 200 }).notNull(), // 预约标题
  reason: text("reason"), // 预约原因
  startTime: timestamp("startTime").notNull(), // 预约开始时间
  endTime: timestamp("endTime").notNull(), // 预约结束时间
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled", "completed"]).default("pending").notNull(),
  rejectReason: text("rejectReason"), // 拒绝原因
  approveTime: timestamp("approveTime"), // 审批时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourseReservation = typeof courseReservations.$inferSelect;
export type InsertCourseReservation = typeof courseReservations.$inferInsert;

/**
 * 课程学生表 - 学生参与的课程
 */
export const courseStudents = mysqlTable("course_students", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(), // 课程ID（外键）
  studentId: int("studentId").notNull(), // 学生ID（外键）
  status: mysqlEnum("status", ["enrolled", "dropped", "completed"]).default("enrolled").notNull(), // 选课状态
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourseStudent = typeof courseStudents.$inferSelect;
export type InsertCourseStudent = typeof courseStudents.$inferInsert;

/**
 * 开放规则表 - 实验室开放时间配置（Phase 4 P1）
 */
export const openingRules = mysqlTable("opening_rules", {
  id: int("id").autoincrement().primaryKey(),
  labId: int("labId"), // 实验室ID（外键，NULL表示全局规则）
  dayOfWeek: int("dayOfWeek").notNull(), // 星期几：0-6（0=周日）
  openTime: varchar("openTime", { length: 10 }).notNull(), // 开放时间：HH:mm
  closeTime: varchar("closeTime", { length: 10 }).notNull(), // 关闭时间：HH:mm
  isWorkday: int("isWorkday").default(1).notNull(), // 是否工作日：0-否, 1-是
  status: mysqlEnum("status", ["enabled", "disabled"]).default("enabled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OpeningRule = typeof openingRules.$inferSelect;
export type InsertOpeningRule = typeof openingRules.$inferInsert;

/**
 * 禁用时段表 - 维护期、假期等禁用时段（Phase 4 P1）
 */
export const blockedPeriods = mysqlTable("blocked_periods", {
  id: int("id").autoincrement().primaryKey(),
  labId: int("labId"), // 实验室ID（外键，NULL表示全局禁用）
  deviceId: int("deviceId"), // 设备ID（外键，NULL表示不针对特定设备）
  reason: varchar("reason", { length: 100 }).notNull(), // 禁用原因：maintenance, vacation, inspection 等
  startDate: timestamp("startDate").notNull(), // 禁用开始日期
  endDate: timestamp("endDate").notNull(), // 禁用结束日期
  handleExisting: mysqlEnum("handleExisting", ["allow", "warn", "cancel"]).default("warn").notNull(), // 处理已有预约方式：allow(保留), warn(提示), cancel(取消)
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlockedPeriod = typeof blockedPeriods.$inferSelect;
export type InsertBlockedPeriod = typeof blockedPeriods.$inferInsert;

/**
 * 班级表 - 学生班级信息
 */
export const classes = mysqlTable("classes", {
  id: int("id").autoincrement().primaryKey(),
  classNo: varchar("classNo", { length: 50 }).notNull().unique(), // 班级编号：如 2024-1-软工01
  name: varchar("name", { length: 100 }).notNull(), // 班级名称
  major: varchar("major", { length: 100 }), // 专业
  grade: varchar("grade", { length: 20 }), // 年级：2024, 2023 等
  counselorId: int("counselorId"), // 班主任ID（外键）
  capacity: int("capacity").default(0), // 班级容量
  description: text("description"), // 班级描述
  semester: varchar("semester", { length: 50 }), // 学期
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(), // 状态
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Class = typeof classes.$inferSelect;
export type InsertClass = typeof classes.$inferInsert;

/**
 * 班级学生表 - 学生所属班级
 */
export const classStudents = mysqlTable("class_students", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(), // 班级ID（外键）
  studentId: int("studentId").notNull(), // 学生ID（外键）
  studentNo: varchar("studentNo", { length: 50 }), // 学号
  status: mysqlEnum("status", ["active", "graduated", "suspended", "withdrawn"]).default("active").notNull(), // 学生状态
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClassStudent = typeof classStudents.$inferSelect;
export type InsertClassStudent = typeof classStudents.$inferInsert;

