-- Add autoCancelHours field to approval_configs table
ALTER TABLE approval_configs ADD COLUMN autoCancelHours DECIMAL(5, 2) DEFAULT 1 NOT NULL;

-- Comment for clarity
ALTER TABLE approval_configs MODIFY COLUMN autoCancelHours DECIMAL(5, 2) DEFAULT 1 COMMENT '预约开始后未签到多少小时自动取消（0表示禁用）';
