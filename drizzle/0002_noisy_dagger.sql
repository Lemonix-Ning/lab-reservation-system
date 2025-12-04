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
