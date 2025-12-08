-- 修复 role 字段：从 ('user','admin') 更新为 ('student','teacher','labAdmin','sysAdmin')
ALTER TABLE `users` 
MODIFY COLUMN `role` enum('student','teacher','labAdmin','sysAdmin') NOT NULL DEFAULT 'student';
