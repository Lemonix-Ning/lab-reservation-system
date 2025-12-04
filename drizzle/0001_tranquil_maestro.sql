CREATE TABLE `lab_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`reason` text,
	`peopleCount` int DEFAULT 1,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`status` enum('pending','approved','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
	`rejectReason` text,
	`applyTime` timestamp NOT NULL DEFAULT (now()),
	`approveTime` timestamp,
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
