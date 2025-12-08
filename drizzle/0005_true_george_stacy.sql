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
