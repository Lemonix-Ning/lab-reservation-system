-- 角色权限配置表
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role` ENUM('student', 'teacher', 'labAdmin', 'sysAdmin') NOT NULL,
  `permissionCode` VARCHAR(100) NOT NULL,
  `enabled` ENUM('0', '1') NOT NULL DEFAULT '1',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_role_permission` (`role`, `permissionCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 初始化默认权限配置
-- 权限代码定义：
-- lab:manage - 实验室管理（增删改）
-- device:manage - 设备管理
-- reservation:approve - 预约审批
-- schedule:approve - 课程排课审批
-- course:manage - 课程管理
-- rule:manage - 规则管理
-- user:manage - 用户管理
-- statistics:view - 统计查看
-- violation:manage - 违约管理
-- audit:view - 审计日志查看
-- geofence:manage - 地理围栏管理
-- class:manage - 班级管理
-- checkin:teacher - 教师签到功能
-- system:settings - 系统设置

-- 学生默认权限（无管理权限）
-- 无需插入，默认无权限

-- 教师默认权限
INSERT INTO `role_permissions` (`role`, `permissionCode`, `enabled`) VALUES
('teacher', 'course:manage', '1'),
('teacher', 'checkin:teacher', '1');

-- 实验室管理员默认权限
INSERT INTO `role_permissions` (`role`, `permissionCode`, `enabled`) VALUES
('labAdmin', 'lab:manage', '1'),
('labAdmin', 'device:manage', '1'),
('labAdmin', 'reservation:approve', '1'),
('labAdmin', 'schedule:approve', '1'),
('labAdmin', 'rule:manage', '1'),
('labAdmin', 'statistics:view', '1'),
('labAdmin', 'violation:manage', '1'),
('labAdmin', 'audit:view', '1'),
('labAdmin', 'geofence:manage', '1');

-- 系统管理员默认权限（全部权限）
INSERT INTO `role_permissions` (`role`, `permissionCode`, `enabled`) VALUES
('sysAdmin', 'lab:manage', '1'),
('sysAdmin', 'device:manage', '1'),
('sysAdmin', 'reservation:approve', '1'),
('sysAdmin', 'schedule:approve', '1'),
('sysAdmin', 'course:manage', '1'),
('sysAdmin', 'rule:manage', '1'),
('sysAdmin', 'user:manage', '1'),
('sysAdmin', 'statistics:view', '1'),
('sysAdmin', 'violation:manage', '1'),
('sysAdmin', 'audit:view', '1'),
('sysAdmin', 'geofence:manage', '1'),
('sysAdmin', 'class:manage', '1'),
('sysAdmin', 'checkin:teacher', '1'),
('sysAdmin', 'system:settings', '1');
