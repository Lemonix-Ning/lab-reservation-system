CREATE TABLE `blocked_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labId` int,
	`deviceId` int,
	`reason` varchar(100) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`handleExisting` enum('allow','warn','cancel') NOT NULL DEFAULT 'warn',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blocked_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`labId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`reason` text,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`status` enum('pending','approved','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
	`rejectReason` text,
	`approveTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`studentId` int NOT NULL,
	`status` enum('enrolled','dropped','completed') NOT NULL DEFAULT 'enrolled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseNo` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`teacherId` int NOT NULL,
	`description` text,
	`semester` varchar(50) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `courses_courseNo_unique` UNIQUE(`courseNo`)
);
--> statement-breakpoint
CREATE TABLE `opening_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labId` int,
	`dayOfWeek` int NOT NULL,
	`openTime` varchar(10) NOT NULL,
	`closeTime` varchar(10) NOT NULL,
	`isWorkday` int NOT NULL DEFAULT 1,
	`status` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opening_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- 迁移旧的 role 值到新的枚举值
UPDATE `users` SET `role` = 'sysAdmin' WHERE `role` = 'admin';
UPDATE `users` SET `role` = 'student' WHERE `role` = 'user';
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('student','teacher','labAdmin','sysAdmin') NOT NULL DEFAULT 'student';