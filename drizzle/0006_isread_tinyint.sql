-- Convert notifications.isRead to TINYINT(1) with default 0
ALTER TABLE `notifications`
  MODIFY `isRead` TINYINT(1) NOT NULL DEFAULT 0;
