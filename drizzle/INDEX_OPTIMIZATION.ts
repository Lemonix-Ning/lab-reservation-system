/**
 * Drizzle ORM 索引配置文件
 * 用于在 schema 中定义优化索引
 * 建议在下一个迁移中添加这些索引
 */

import { index, mysqlTable, int, text, timestamp, varchar, mysqlEnum } from "drizzle-orm/mysql-core";

/**
 * 使用示例：在 schema.ts 中应用这些索引定义
 * 
 * 对于现有表，你可以：
 * 1. 方式A: 直接执行 database_optimization.sql 脚本
 * 2. 方式B: 创建新的迁移文件，将以下索引定义添加到相应的表中
 */

export const indexOptimizationGuide = {
  
  // =====================================================
  // lab_reservations 表索引
  // =====================================================
  
  labReservationsIndexes: [
    // 基础外键查询索引
    `CREATE INDEX idx_lab_reservations_labId ON lab_reservations(labId) COMMENT '实验室查询'`,
    `CREATE INDEX idx_lab_reservations_userId ON lab_reservations(userId) COMMENT '用户查询'`,
    
    // 复合索引：冲突检测（最重要）
    // 使用场景：检查时间段内是否有冲突
    `CREATE INDEX idx_lab_reservations_lab_time ON lab_reservations(labId, startTime, endTime, status) COMMENT '冲突检测核心索引'`,
    
    // 复合索引：用户预约统计
    `CREATE INDEX idx_lab_reservations_user_status ON lab_reservations(userId, status, createdAt) COMMENT '用户状态查询'`,
    
    // 状态和时间查询
    `CREATE INDEX idx_lab_reservations_status_time ON lab_reservations(status, createdAt) COMMENT '按状态和创建时间'`,
    
    // 时间范围查询
    `CREATE INDEX idx_lab_reservations_startTime ON lab_reservations(startTime) COMMENT '开始时间查询'`,
    `CREATE INDEX idx_lab_reservations_endTime ON lab_reservations(endTime) COMMENT '结束时间查询'`,
    
    // 改签查询
    `CREATE INDEX idx_lab_reservations_rescheduledFromId ON lab_reservations(rescheduledFromId) COMMENT '改签来源查询'`,
  ],

  // =====================================================
  // approval_histories 表索引
  // =====================================================
  
  approvalHistoriesIndexes: [
    `CREATE INDEX idx_approval_histories_reservationId ON approval_histories(reservationId) COMMENT '预约关联'`,
    `CREATE INDEX idx_approval_histories_approverUserId ON approval_histories(approverUserId) COMMENT '审批人查询'`,
    `CREATE INDEX idx_approval_histories_decision ON approval_histories(decision) COMMENT '审批结果查询'`,
    `CREATE INDEX idx_approval_histories_created ON approval_histories(createdAt) COMMENT '时间查询'`,
    `CREATE INDEX idx_approval_histories_stage ON approval_histories(approvalStage) COMMENT '审批阶段'`,
  ],

  // =====================================================
  // violation_records 表索引
  // =====================================================
  
  violationRecordsIndexes: [
    `CREATE INDEX idx_violation_records_userId ON violation_records(userId) COMMENT '用户违约记录'`,
    `CREATE INDEX idx_violation_records_reservationId ON violation_records(reservationId) COMMENT '预约关联违约'`,
    `CREATE INDEX idx_violation_records_user_recorded ON violation_records(userId, recordedAt) COMMENT '用户时间查询'`,
    `CREATE INDEX idx_violation_records_type ON violation_records(violationType) COMMENT '违约类型'`,
  ],

  // =====================================================
  // blacklist 表索引
  // =====================================================
  
  blacklistIndexes: [
    `CREATE INDEX idx_blacklist_userId ON blacklist(userId) COMMENT '用户黑名单查询'`,
    `CREATE INDEX idx_blacklist_restrictedUntil ON blacklist(restrictedUntil) COMMENT '限制期限查询'`,
    `CREATE INDEX idx_blacklist_status_time ON blacklist(restrictionType, restrictedUntil) COMMENT '限制类型和时间'`,
  ],

  // =====================================================
  // audit_logs 表索引
  // =====================================================
  
  auditLogsIndexes: [
    `CREATE INDEX idx_audit_logs_operatorUserId ON audit_logs(operatorUserId) COMMENT '操作人查询'`,
    `CREATE INDEX idx_audit_logs_operationType ON audit_logs(operationType) COMMENT '操作类型'`,
    `CREATE INDEX idx_audit_logs_targetType_targetId ON audit_logs(targetType, targetId) COMMENT '目标对象查询'`,
    `CREATE INDEX idx_audit_logs_createdAt ON audit_logs(createdAt) COMMENT '时间查询'`,
    `CREATE INDEX idx_audit_logs_result ON audit_logs(result) COMMENT '操作结果'`,
    `CREATE INDEX idx_audit_logs_operatedAt ON audit_logs(operatedAt) COMMENT '操作时间'`,
  ],

  // =====================================================
  // notifications 表索引
  // =====================================================
  
  notificationsIndexes: [
    `CREATE INDEX idx_notifications_userId_isRead ON notifications(userId, isRead) COMMENT '用户未读通知'`,
    `CREATE INDEX idx_notifications_createdAt ON notifications(createdAt) COMMENT '时间排序'`,
    `CREATE INDEX idx_notifications_type ON notifications(type) COMMENT '通知类型'`,
    `CREATE INDEX idx_notifications_relatedId ON notifications(relatedId) COMMENT '关联对象'`,
  ],

  // =====================================================
  // lab_devices 表索引
  // =====================================================
  
  labDevicesIndexes: [
    `CREATE INDEX idx_lab_devices_labId ON lab_devices(labId) COMMENT '实验室设备查询'`,
    `CREATE INDEX idx_lab_devices_status ON lab_devices(status) COMMENT '设备状态查询'`,
    `CREATE INDEX idx_lab_devices_lab_status ON lab_devices(labId, status) COMMENT '实验室状态设备'`,
    `CREATE INDEX idx_lab_devices_type ON lab_devices(type) COMMENT '设备类型'`,
  ],

  // =====================================================
  // course_reservations 表索引
  // =====================================================
  
  courseReservationsIndexes: [
    `CREATE INDEX idx_course_reservations_courseId ON course_reservations(courseId) COMMENT '课程预约'`,
    `CREATE INDEX idx_course_reservations_labId ON course_reservations(labId) COMMENT '实验室预约'`,
    `CREATE INDEX idx_course_reservations_status ON course_reservations(status) COMMENT '预约状态'`,
    `CREATE INDEX idx_course_reservations_time ON course_reservations(startTime, endTime) COMMENT '时间范围'`,
    `CREATE INDEX idx_course_reservations_created ON course_reservations(createdAt) COMMENT '创建时间'`,
  ],

  // =====================================================
  // course_students 表索引
  // =====================================================
  
  courseStudentsIndexes: [
    `CREATE INDEX idx_course_students_courseId ON course_students(courseId) COMMENT '课程学生列表'`,
    `CREATE INDEX idx_course_students_studentId ON course_students(studentId) COMMENT '学生课程查询'`,
    `CREATE INDEX idx_course_students_status ON course_students(status) COMMENT '选课状态'`,
    `CREATE INDEX idx_course_students_course_status ON course_students(courseId, status) COMMENT '课程状态学生'`,
  ],

  // =====================================================
  // 其他表索引
  // =====================================================
  
  otherIndexes: [
    // opening_rules
    `CREATE INDEX idx_opening_rules_labId ON opening_rules(labId) COMMENT '实验室开放规则'`,
    `CREATE INDEX idx_opening_rules_lab_dayofweek ON opening_rules(labId, dayOfWeek) COMMENT '实验室星期规则'`,
    `CREATE INDEX idx_opening_rules_status ON opening_rules(status) COMMENT '规则状态'`,

    // blocked_periods
    `CREATE INDEX idx_blocked_periods_labId ON blocked_periods(labId) COMMENT '实验室禁用时段'`,
    `CREATE INDEX idx_blocked_periods_deviceId ON blocked_periods(deviceId) COMMENT '设备禁用时段'`,
    `CREATE INDEX idx_blocked_periods_range ON blocked_periods(startDate, endDate, status) COMMENT '时间范围查询'`,
    `CREATE INDEX idx_blocked_periods_status ON blocked_periods(status) COMMENT '禁用状态'`,

    // courses
    `CREATE INDEX idx_courses_teacherId ON courses(teacherId) COMMENT '教师课程查询'`,
    `CREATE INDEX idx_courses_status ON courses(status) COMMENT '课程状态'`,
    `CREATE INDEX idx_courses_semester ON courses(semester) COMMENT '学期查询'`,
    `CREATE INDEX idx_courses_teacher_semester ON courses(teacherId, semester) COMMENT '教师学期课程'`,

    // users
    `CREATE INDEX idx_users_role ON users(role) COMMENT '用户角色查询'`,
    `CREATE INDEX idx_users_email ON users(email) COMMENT '邮箱查询'`,
    `CREATE INDEX idx_users_lastSignedIn ON users(lastSignedIn) COMMENT '最后登录时间'`,

    // lab_rooms
    `CREATE INDEX idx_lab_rooms_status ON lab_rooms(status) COMMENT '实验室状态'`,
    `CREATE INDEX idx_lab_rooms_managerId ON lab_rooms(managerId) COMMENT '管理员实验室'`,
    `CREATE INDEX idx_lab_rooms_building ON lab_rooms(building) COMMENT '建筑位置查询'`,

    // lab_reserve_rules
    `CREATE INDEX idx_lab_reserve_rules_status ON lab_reserve_rules(status) COMMENT '规则状态'`,

    // approval_configs
    `CREATE INDEX idx_approval_configs_labId ON approval_configs(labId) COMMENT '实验室审批配置'`,
    `CREATE INDEX idx_approval_configs_status ON approval_configs(status) COMMENT '配置状态'`,
  ],
};

/**
 * Drizzle ORM 中的索引定义语法（供参考）
 * 
 * export const myTable = mysqlTable('my_table', {
 *   id: int('id').autoincrement().primaryKey(),
 *   userId: int('userId').notNull(),
 *   labId: int('labId').notNull(),
 *   status: mysqlEnum('status', [...]).notNull(),
 * }, (table) => ({
 *   // 定义索引
 *   userIdx: index('idx_user').on(table.userId),
 *   labIdx: index('idx_lab').on(table.labId),
 *   // 复合索引
 *   compoundIdx: index('idx_user_lab').on(table.userId, table.labId),
 * }));
 */

/**
 * 执行步骤：
 * 
 * 1. 方式A - 直接执行 SQL（推荐快速方式）：
 *    mysql -u root -p lab_reservation_db < database_optimization.sql
 * 
 * 2. 方式B - 使用 Drizzle 迁移：
 *    - 修改 drizzle/schema.ts，在相应表中添加索引定义
 *    - 运行 pnpm db:push 生成迁移
 *    - 执行迁移
 * 
 * 3. 验证索引创建：
 *    SHOW INDEXES FROM lab_reservations;
 *    ANALYZE TABLE lab_reservations;
 * 
 * 4. 测试查询性能：
 *    EXPLAIN SELECT * FROM lab_reservations 
 *    WHERE labId = 1 AND status = 'pending';
 */
