CREATE TABLE `approval_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labId` int,
	`name` varchar(100) NOT NULL,
	`enableMultiLevel` int NOT NULL DEFAULT 0,
	`approvalStages` text NOT NULL,
	`rescheduleWindowHours` int DEFAULT 24,
	`maxRescheduleCount` int DEFAULT 3,
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
--> statement-breakpoint
ALTER TABLE `lab_reservations` MODIFY COLUMN `status` enum('pending','approved','rejected','cancelled','completed','violated') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `lab_reservations` ADD `rescheduledFromId` int;--> statement-breakpoint
ALTER TABLE `lab_reservations` ADD `rescheduleCount` int DEFAULT 0;