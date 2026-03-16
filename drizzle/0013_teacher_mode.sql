-- =============================================
-- 教师主导模式数据库迁移（增量）
-- 0013_teacher_mode.sql
-- 
-- 现有已实现：
--   ✅ courses 课程表
--   ✅ course_students 课程学生表  
--   ✅ course_reservations 课程预约表（按具体时间）
--   ✅ classes / class_students 班级管理
--   ✅ opening_rules / blocked_periods 开放规则
--   ✅ lab_geofences 地理围栏
--   ✅ lab_reservations.checkinXxx 个人签到字段
--
-- 本次新增：
--   1. period_time_mapping 节次时间对照表
--   2. course_schedules 课程时间安排表（按周次/节次）
--   3. checkin_sessions 课堂签到会话表
--   4. course_attendances 课程出勤记录表
--   5. semester_configs 学期配置表
--   6. courses表扩展字段
-- =============================================

-- =============================================
-- 1. 节次时间对照表（学校作息时间）
-- =============================================
CREATE TABLE IF NOT EXISTS period_time_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY,
  periodNo TINYINT NOT NULL COMMENT '节次号（1-12）',
  periodName VARCHAR(20) COMMENT '节次名称（如：第1节）',
  startTime VARCHAR(10) NOT NULL COMMENT '开始时间 HH:MM',
  endTime VARCHAR(10) NOT NULL COMMENT '结束时间 HH:MM',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_period (periodNo)
) COMMENT '节次时间对照表';

-- 插入默认节次（根据学校作息调整）
INSERT INTO period_time_mapping (periodNo, periodName, startTime, endTime) VALUES
(1, '第1节', '08:00', '08:45'),
(2, '第2节', '08:55', '09:40'),
(3, '第3节', '10:00', '10:45'),
(4, '第4节', '10:55', '11:40'),
(5, '第5节', '14:00', '14:45'),
(6, '第6节', '14:55', '15:40'),
(7, '第7节', '16:00', '16:45'),
(8, '第8节', '16:55', '17:40'),
(9, '第9节', '19:00', '19:45'),
(10, '第10节', '19:55', '20:40'),
(11, '第11节', '20:50', '21:35'),
(12, '第12节', '21:45', '22:30')
ON DUPLICATE KEY UPDATE periodName = VALUES(periodName);

-- =============================================
-- 2. 学期配置表
-- =============================================
CREATE TABLE IF NOT EXISTS semester_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  semesterCode VARCHAR(20) NOT NULL COMMENT '学期代码，如：2025-2026-2',
  semesterName VARCHAR(50) NOT NULL COMMENT '学期名称',
  startDate DATE NOT NULL COMMENT '学期开始日期（第1周周一）',
  endDate DATE NOT NULL COMMENT '学期结束日期',
  weekCount INT DEFAULT 20 COMMENT '总周数',
  isCurrent TINYINT DEFAULT 0 COMMENT '是否当前学期',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_semester_code (semesterCode)
) COMMENT '学期配置表';

-- 插入当前学期
INSERT INTO semester_configs (semesterCode, semesterName, startDate, endDate, weekCount, isCurrent) VALUES
('2025-2026-2', '2025-2026学年第二学期', '2026-02-23', '2026-07-05', 20, 1)
ON DUPLICATE KEY UPDATE isCurrent = 1;

-- =============================================
-- 3. 扩展课程表（已有courses表，添加新字段）
-- =============================================
-- 说明：使用动态 SQL 避免重复添加列
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'classInfo'
    ),
    'SELECT 1',
    'ALTER TABLE courses ADD COLUMN classInfo VARCHAR(200) COMMENT ''班级信息'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'weekCount'
    ),
    'SELECT 1',
    'ALTER TABLE courses ADD COLUMN weekCount INT DEFAULT 16 COMMENT ''课程周数'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'defaultLabId'
    ),
    'SELECT 1',
    'ALTER TABLE courses ADD COLUMN defaultLabId INT COMMENT ''默认实验室ID'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =============================================
-- 4. 课程时间安排表（按周次/节次，区别于course_reservations按具体时间）
-- =============================================
CREATE TABLE IF NOT EXISTS course_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  courseId INT NOT NULL COMMENT '课程ID',
  labId INT NOT NULL COMMENT '实验室ID',
  dayOfWeek TINYINT NOT NULL COMMENT '星期几（1=周一, 7=周日）',
  startPeriod TINYINT NOT NULL COMMENT '开始节次（1-12）',
  endPeriod TINYINT NOT NULL COMMENT '结束节次（1-12）',
  startWeek TINYINT DEFAULT 1 COMMENT '开始周',
  endWeek TINYINT DEFAULT 16 COMMENT '结束周',
  weekType ENUM('all', 'odd', 'even') DEFAULT 'all' COMMENT '周类型（全部/单周/双周）',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审批状态',
  rejectReason TEXT COMMENT '拒绝原因',
  approvedAt TIMESTAMP NULL COMMENT '审批时间',
  approvedBy INT COMMENT '审批人ID',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedules_lab (labId),
  INDEX idx_schedules_course (courseId),
  INDEX idx_schedules_day (dayOfWeek, startPeriod)
) COMMENT '课程时间安排表（按周次/节次）';

-- =============================================
-- 5. 课堂签到会话表（教师开启签到时创建）
-- =============================================
CREATE TABLE IF NOT EXISTS checkin_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  courseId INT NOT NULL COMMENT '课程ID',
  scheduleId INT COMMENT '关联的课程安排ID',
  labId INT NOT NULL COMMENT '实验室ID',
  sessionDate DATE NOT NULL COMMENT '签到日期',
  weekNo TINYINT COMMENT '第几周',
  teacherId INT NOT NULL COMMENT '创建签到的教师ID',
  title VARCHAR(200) COMMENT '本次课标题/主题',
  qrcodeToken VARCHAR(64) COMMENT '二维码令牌',
  qrcodeExpireAt TIMESTAMP NULL COMMENT '二维码过期时间',
  qrcodeRefreshSeconds INT DEFAULT 30 COMMENT '二维码刷新间隔（秒）',
  allowLateMinutes INT DEFAULT 15 COMMENT '迟到阈值（分钟）',
  useGeofence TINYINT DEFAULT 1 COMMENT '是否启用地理围栏',
  status ENUM('active', 'closed') DEFAULT 'active' COMMENT '签到状态',
  startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  closedAt TIMESTAMP NULL COMMENT '关闭时间',
  presentCount INT DEFAULT 0 COMMENT '出勤人数',
  lateCount INT DEFAULT 0 COMMENT '迟到人数',
  absentCount INT DEFAULT 0 COMMENT '缺勤人数',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session_course (courseId, sessionDate),
  INDEX idx_session_token (qrcodeToken),
  INDEX idx_session_teacher (teacherId),
  INDEX idx_session_status (status)
) COMMENT '课堂签到会话表';

-- =============================================
-- 6. 课程出勤记录表（区别于lab_reservations的个人签到）
-- =============================================
CREATE TABLE IF NOT EXISTS course_attendances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sessionId INT NOT NULL COMMENT '签到会话ID',
  courseId INT NOT NULL COMMENT '课程ID',
  studentId INT NOT NULL COMMENT '学生ID',
  sessionDate DATE NOT NULL COMMENT '上课日期',
  checkinTime TIMESTAMP NULL COMMENT '签到时间',
  checkinMethod ENUM('qrcode', 'geofence', 'manual', 'face') COMMENT '签到方式',
  checkinLatitude DECIMAL(10, 7) COMMENT '签到纬度',
  checkinLongitude DECIMAL(10, 7) COMMENT '签到经度',
  status ENUM('present', 'late', 'absent', 'leave') DEFAULT 'absent' COMMENT '出勤状态',
  note VARCHAR(200) COMMENT '备注（如请假原因）',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_attendance_session (sessionId),
  INDEX idx_attendance_course_date (courseId, sessionDate),
  INDEX idx_attendance_student (studentId),
  UNIQUE KEY uq_attendance (sessionId, studentId)
) COMMENT '课程出勤记录表';
