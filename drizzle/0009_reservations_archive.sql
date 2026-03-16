-- Create archive table for lab reservations
CREATE TABLE IF NOT EXISTS `lab_reservations_archive` (
  `id` int AUTO_INCREMENT NOT NULL,
  `originalId` int NOT NULL,
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
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `archivedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `lab_reservations_archive_id` PRIMARY KEY(`id`)
);

-- Useful indexes for archive queries
CREATE INDEX IF NOT EXISTS `idx_archive_lab_time`
  ON `lab_reservations_archive` (`labId`, `startTime`, `endTime`);

CREATE INDEX IF NOT EXISTS `idx_archive_user_time`
  ON `lab_reservations_archive` (`userId`, `startTime`);

CREATE INDEX IF NOT EXISTS `idx_archive_status_time`
  ON `lab_reservations_archive` (`status`, `endTime`);
