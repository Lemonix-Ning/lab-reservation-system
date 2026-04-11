-- Phase 1 (B): Foreign keys and FULLTEXT index (with query refactor)

-- Foreign Keys
ALTER TABLE `lab_devices`
  ADD CONSTRAINT `fk_lab_devices_lab`
    FOREIGN KEY (`labId`) REFERENCES `lab_rooms`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `lab_reservations`
  ADD CONSTRAINT `fk_lab_reservations_lab`
    FOREIGN KEY (`labId`) REFERENCES `lab_rooms`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_lab_reservations_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `approval_histories`
  ADD CONSTRAINT `fk_approval_histories_approver`
    FOREIGN KEY (`approverUserId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Optional manager FK (enable if business needs)
-- ALTER TABLE `lab_rooms`
--   ADD CONSTRAINT `fk_lab_rooms_manager`
--     FOREIGN KEY (`managerId`) REFERENCES `users`(`id`)
--     ON DELETE RESTRICT ON UPDATE CASCADE;

-- FULLTEXT index for natural language search on reservations
ALTER TABLE `lab_reservations`
  ADD FULLTEXT INDEX `ft_lab_reservations_title_reason` (`title`, `reason`);
