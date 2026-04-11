-- Phase 1: Unique constraints and key indexes
ALTER TABLE `course_students`
  ADD CONSTRAINT `uq_course_students` UNIQUE (`courseId`, `studentId`);

ALTER TABLE `class_students`
  ADD CONSTRAINT `uq_class_students` UNIQUE (`classId`, `studentId`);

ALTER TABLE `blacklist`
  ADD CONSTRAINT `uq_blacklist_user` UNIQUE (`userId`);

CREATE INDEX `idx_reservations_lab_status_time`
  ON `lab_reservations` (`labId`, `status`, `startTime`, `endTime`);

CREATE INDEX `idx_blocked_periods_lab_status_time`
  ON `blocked_periods` (`labId`, `status`, `startDate`, `endDate`);

CREATE INDEX `idx_notifications_user_read_time`
  ON `notifications` (`userId`, `isRead`, `createdAt`);

CREATE INDEX `idx_audit_logs_operator_time`
  ON `audit_logs` (`operatorUserId`, `operatedAt`);

CREATE INDEX `idx_approval_histories_res_stage`
  ON `approval_histories` (`reservationId`, `approvalStage`);
