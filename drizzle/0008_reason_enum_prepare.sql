-- Normalize blocked_periods.reason values before ENUM migration

-- maintenance synonyms
UPDATE `blocked_periods`
SET `reason` = 'maintenance'
WHERE LOWER(TRIM(`reason`)) IN (
  'maintenance','maintain','维护','年度维护','维保','检修','保养','维护期'
);

-- vacation/holiday synonyms
UPDATE `blocked_periods`
SET `reason` = 'vacation'
WHERE LOWER(TRIM(`reason`)) IN (
  'vacation','holiday','假期','节假日','放假'
);

-- inspection synonyms
UPDATE `blocked_periods`
SET `reason` = 'inspection'
WHERE LOWER(TRIM(`reason`)) IN (
  'inspection','inspect','年检','巡检','设备检查','检查'
);

-- fallback any non-enumerated values to 'other'
UPDATE `blocked_periods`
SET `reason` = 'other'
WHERE LOWER(TRIM(`reason`)) NOT IN ('maintenance','vacation','inspection','other');
