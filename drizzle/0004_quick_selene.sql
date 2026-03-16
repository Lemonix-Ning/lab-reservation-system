CREATE TABLE `lab_geofences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labId` int NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`radius` int NOT NULL DEFAULT 100,
	`name` varchar(100),
	`status` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_geofences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_oauth_bindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('qq','github','school','manus') NOT NULL,
	`providerUserId` varchar(128) NOT NULL,
	`providerEmail` varchar(320),
	`providerName` varchar(255),
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`bindAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	`status` enum('active','unbound') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_oauth_bindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_oauth_provider_user` UNIQUE(`provider`,`providerUserId`)
);
--> statement-breakpoint
ALTER TABLE `lab_reservations` ADD `checkinTime` timestamp;--> statement-breakpoint
ALTER TABLE `lab_reservations` ADD `checkoutTime` timestamp;--> statement-breakpoint
ALTER TABLE `lab_reservations` ADD `checkinMethod` enum('qrcode','geofence','face','manual');--> statement-breakpoint
ALTER TABLE `lab_reservations` ADD `checkinLatitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `lab_reservations` ADD `checkinLongitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `lab_reservations` ADD `checkinDeviceInfo` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_geofence_lab` ON `lab_geofences` (`labId`);--> statement-breakpoint
CREATE INDEX `idx_oauth_user` ON `user_oauth_bindings` (`userId`);