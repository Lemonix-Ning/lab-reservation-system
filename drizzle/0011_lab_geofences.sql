CREATE TABLE IF NOT EXISTS `lab_geofences` (
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

CREATE INDEX `idx_geofence_lab`
  ON `lab_geofences` (`labId`);

ALTER TABLE `lab_geofences`
  ADD CONSTRAINT `fk_geofence_lab`
    FOREIGN KEY (`labId`) REFERENCES `lab_rooms`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
