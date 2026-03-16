-- Apply ENUM type for blocked_periods.reason
ALTER TABLE `blocked_periods`
  MODIFY `reason` ENUM('maintenance','vacation','inspection','other') NOT NULL;
