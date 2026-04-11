-- Verify column types for TIME conversion

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND ((TABLE_NAME = 'lab_rooms' AND COLUMN_NAME IN ('openTimeStart','openTimeEnd'))
    OR (TABLE_NAME = 'opening_rules' AND COLUMN_NAME IN ('openTime','closeTime')))
ORDER BY TABLE_NAME, COLUMN_NAME;
