-- Migration: Add lab_devices table for device management
CREATE TABLE `lab_devices` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `labId` int NOT NULL,
  `deviceNo` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `type` varchar(50),
  `purchaseDate` timestamp,
  `status` enum('available', 'maintenance', 'retired') NOT NULL DEFAULT 'available',
  `description` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_device_no` (`deviceNo`),
  FOREIGN KEY `fk_device_lab` (`labId`) REFERENCES `lab_rooms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_lab_id` ON `lab_devices`(`labId`);
CREATE INDEX `idx_status` ON `lab_devices`(`status`);
