-- Verify normalized reasons distribution
SELECT `reason`, COUNT(*) AS cnt
FROM `blocked_periods`
GROUP BY `reason`
ORDER BY cnt DESC, reason ASC;
