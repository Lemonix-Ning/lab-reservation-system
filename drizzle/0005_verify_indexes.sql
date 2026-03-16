-- Verify index usage with EXPLAIN statements

EXPLAIN SELECT id, userId, labId, startTime, endTime, status
FROM lab_reservations
WHERE labId = 1
  AND status IN ('approved','pending')
  AND endTime > NOW()
  AND startTime < DATE_ADD(NOW(), INTERVAL 7 DAY)
ORDER BY startTime;

EXPLAIN SELECT id, labId, reason, startDate, endDate
FROM blocked_periods
WHERE status = 'active'
  AND (labId = 1 OR labId IS NULL)
  AND NOT (endDate <= NOW() OR startDate >= DATE_ADD(NOW(), INTERVAL 7 DAY));

EXPLAIN SELECT id, userId, isRead, createdAt
FROM notifications
WHERE userId = 1 AND isRead = 0
ORDER BY createdAt DESC;

EXPLAIN SELECT id, operatorUserId, operationType, operatedAt
FROM audit_logs
WHERE operatorUserId = 1
ORDER BY operatedAt DESC;

EXPLAIN SELECT id, approverUserId, approvalStage
FROM approval_histories
WHERE reservationId = 1
ORDER BY approvalStage;
