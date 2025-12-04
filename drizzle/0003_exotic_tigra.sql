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
