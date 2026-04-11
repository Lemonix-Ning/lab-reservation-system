-- 用户角色白名单表 - 预导入教师/管理员名单
CREATE TABLE IF NOT EXISTS `user_role_whitelist` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(320) NOT NULL UNIQUE,
  `role` ENUM('student', 'teacher', 'labAdmin', 'sysAdmin') NOT NULL,
  `name` VARCHAR(100),
  `department` VARCHAR(200),
  `employeeNo` VARCHAR(50),
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

-- 角色升级申请表 - 用户申请成为教师/管理员
CREATE TABLE IF NOT EXISTS `role_upgrade_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `requestedRole` ENUM('teacher', 'labAdmin') NOT NULL,
  `reason` TEXT,
  `department` VARCHAR(200),
  `employeeNo` VARCHAR(50),
  `proofUrl` VARCHAR(500),
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' NOT NULL,
  `reviewerId` INT,
  `reviewComment` TEXT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `reviewedAt` TIMESTAMP,
  INDEX `idx_upgrade_user` (`userId`),
  INDEX `idx_upgrade_status` (`status`)
);

-- 预设一些示例白名单（可根据实际情况修改）
-- INSERT INTO user_role_whitelist (email, role, name, department, employeeNo) VALUES
-- ('teacher@example.edu.cn', 'teacher', '示例教师', '计算机学院', 'T001'),
-- ('admin@example.edu.cn', 'labAdmin', '示例管理员', '实验中心', 'A001');
