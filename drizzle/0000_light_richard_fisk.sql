CREATE TABLE `approval_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labId` int,
	`name` varchar(100) NOT NULL,
	`enableMultiLevel` int NOT NULL DEFAULT 0,
	`approvalStages` text NOT NULL,
	`rescheduleWindowHours` int DEFAULT 24,
	`maxRescheduleCount` int DEFAULT 3,
	`autoCancelHours` decimal(5,2) DEFAULT '1',
	`status` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approval_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`approverUserId` int NOT NULL,
	`approvalStage` int NOT NULL,
	`decision` enum('pending','approved','rejected','rescheduled') NOT NULL,
	`comment` text,
	`approvedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operatorUserId` int NOT NULL,
	`operationType` varchar(50) NOT NULL,
	`targetType` varchar(50) NOT NULL,
	`targetId` int,
	`details` text,
	`reason` text,
	`result` enum('success','failed') NOT NULL DEFAULT 'success',
	`ipAddress` varchar(50),
	`operatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blacklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalViolationPoints` int NOT NULL,
	`violationThreshold` int NOT NULL,
	`restrictionType` enum('time_limit','resource_limit') NOT NULL,
	`restrictedUntil` timestamp,
	`restrictedLabIds` text,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blacklist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `class_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`studentId` int NOT NULL,
	`studentNo` varchar(50),
	`status` enum('active','graduated','suspended','withdrawn') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `class_students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classNo` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`major` varchar(100),
	`grade` varchar(20),
	`counselorId` int,
	`capacity` int DEFAULT 0,
	`description` text,
	`semester` varchar(50),
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `classes_classNo_unique` UNIQUE(`classNo`)
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
CREATE TABLE `lab_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labId` int NOT NULL,
	`deviceNo` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` varchar(50),
	`purchaseDate` timestamp,
	`status` enum('available','maintenance','retired') NOT NULL DEFAULT 'available',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lab_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`reason` text,
	`peopleCount` int DEFAULT 1,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`status` enum('pending','approved','rejected','cancelled','completed','violated') NOT NULL DEFAULT 'pending',
	`rejectReason` text,
	`applyTime` timestamp NOT NULL DEFAULT (now()),
	`approveTime` timestamp,
	`rescheduledFromId` int,
	`rescheduleCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lab_reserve_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleCode` varchar(50) NOT NULL,
	`ruleName` varchar(100) NOT NULL,
	`ruleValue` varchar(100) NOT NULL,
	`description` text,
	`status` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_reserve_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `lab_reserve_rules_ruleCode_unique` UNIQUE(`ruleCode`)
);
--> statement-breakpoint
CREATE TABLE `lab_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomNo` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`building` varchar(100),
	`location` varchar(200),
	`capacity` int DEFAULT 0,
	`type` varchar(50),
	`managerId` int,
	`openTimeStart` varchar(10) DEFAULT '08:00',
	`openTimeEnd` varchar(10) DEFAULT '22:00',
	`status` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`remark` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `lab_rooms_roomNo_unique` UNIQUE(`roomNo`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('reservation_approved','reservation_rejected','reservation_cancelled','reservation_reminder','system') NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`relatedId` int,
	`relatedType` varchar(50),
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
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
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('student','teacher','labAdmin','sysAdmin') NOT NULL DEFAULT 'student',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `violation_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reservationId` int,
	`violationType` enum('no_show','late_cancel','timeout_checkout','manual_record') NOT NULL,
	`points` int NOT NULL DEFAULT 1,
	`description` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `violation_records_id` PRIMARY KEY(`id`)
);
