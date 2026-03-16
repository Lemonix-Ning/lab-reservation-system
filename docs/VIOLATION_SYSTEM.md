# 违约管理系统说明

## 概述

违约管理系统用于记录和管理用户的违规行为，通过积分制度自动或手动记录违约，累计达到阈值后自动加入黑名单限制预约权限。

## 违约记录方式

### 1. 自动记录（系统触发）

#### 1.1 未按时签到（no_show）
- **触发条件**：预约状态为"approved"，且当前时间超过`开始时间 + autoCancelHours`
- **扣分**：5分
- **处理**：自动取消预约，记录违约
- **触发方式**：
  - 管理员手动触发：`reservation.triggerAutoCancelOverdue`
  - 建议配置定时任务每小时执行一次

#### 1.2 超时未签退（timeout_checkout）
- **触发条件**：已签到但未签退，且当前时间超过`结束时间 + 30分钟`
- **扣分**：3分
- **处理**：记录违约（不影响预约状态）
- **触发方式**：
  - 签退时自动检测：用户签退时如果超时会自动记录
  - 管理员手动触发：`reservation.triggerTimeoutDetection`
  - 建议配置定时任务每小时执行一次

### 2. 手动记录（管理员操作）

管理员可通过违约管理页面手动记录以下违约类型：

| 违约类型 | 代码 | 默认扣分 | 说明 |
|---------|------|---------|------|
| 未签到 | no_show | 5分 | 预约获批但未到场签到 |
| 迟到取消 | late_cancel | 2分 | 开始前24小时内取消预约 |
| 超时占用 | timeout_checkout | 3分 | 未及时签出归还实验室 |
| 手动记录 | manual_record | 自定义 | 设备损坏或其他违规行为 |

## 个人预约违约判定逻辑

### 完整流程

```
1. 用户创建预约 → 状态：pending
   ↓
2. 管理员审批通过 → 状态：approved
   ↓
3. 预约开始时间到达
   ↓
4. 用户签到 → checkinTime记录
   │
   ├─ 未签到 → 超过autoCancelHours → 自动取消 + 记录违约(5分)
   │
   └─ 已签到
      ↓
5. 预约结束时间到达
   ↓
6. 用户签退 → checkoutTime记录
   │
   ├─ 未签退 → 超过30分钟 → 记录违约(3分)
   │
   └─ 已签退
      ├─ 正常签退 → 状态：completed
      └─ 超时签退 → 状态：completed + 记录违约(3分)
```

### 自动违约检测时机

1. **未签到检测**
   - 检查时机：定时任务（建议每小时）
   - 检查对象：status = 'approved' 且 checkinTime = null
   - 判定条件：当前时间 > 开始时间 + autoCancelHours

2. **超时签退检测**
   - 检查时机：
     - 用户签退时实时检测
     - 定时任务扫描（建议每小时）
   - 检查对象：checkinTime != null 且 checkoutTime = null
   - 判定条件：当前时间 > 结束时间 + 30分钟

## 黑名单机制

### 自动加入黑名单

- **触发条件**：累计违约积分 ≥ 10分
- **限制类型**：time_limit（禁止预约）
- **限制时长**：7天
- **自动解除**：需要管理员手动解除

### 黑名单效果

- 用户无法创建新的预约
- 创建预约时会提示："您因违约已被限制预约，请联系管理员"
- 不影响已有的预约

## 配置建议

### 1. 审批配置（approval_configs表）

```sql
-- 设置自动取消时间（小时）
UPDATE approval_configs 
SET autoCancelHours = 2  -- 预约开始后2小时未签到自动取消
WHERE labId = ?;
```

### 2. 定时任务配置

建议使用cron或系统定时任务，每小时执行：

```bash
# 每小时检测未签到预约
curl -X POST http://localhost:3000/api/trpc/reservation.triggerAutoCancelOverdue

# 每小时检测超时未签退
curl -X POST http://localhost:3000/api/trpc/reservation.triggerTimeoutDetection
```

### 3. 违约积分阈值

当前硬编码为10分，可在 `server/db.ts` 的 `recordViolation` 函数中修改：

```typescript
const threshold = 10; // 修改此值调整阈值
```

## API接口

### 违约记录相关

- `violation.getRecords` - 获取当前用户违约记录
- `violation.getAllRecords` - 获取所有用户违约记录（管理员）
- `violation.getTotalPoints` - 获取当前用户总违约分
- `violation.recordViolation` - 手动记录违约（管理员）

### 黑名单相关

- `violation.getAllBlacklist` - 获取所有黑名单用户（管理员）
- `violation.removeBlacklist` - 移除黑名单（管理员）

### 自动检测相关

- `reservation.triggerAutoCancelOverdue` - 手动触发未签到检测（管理员）
- `reservation.triggerTimeoutDetection` - 手动触发超时签退检测（管理员）

## 注意事项

1. **迟到取消**目前需要管理员手动记录，系统不会自动检测
2. **设备损坏**等其他违规行为需要管理员手动记录
3. 违约记录一旦创建无法删除，只能通过移除黑名单来恢复用户权限
4. 建议定期审查违约记录，对于误判的情况可以移除黑名单
5. 超时签退的30分钟阈值可在代码中调整（`server/db.ts`）

## 数据库表结构

### violation_records（违约记录表）

- id: 主键
- userId: 用户ID
- reservationId: 关联预约ID（可选）
- violationType: 违约类型
- points: 扣除积分
- description: 描述
- recordedAt: 记录时间

### blacklist（黑名单表）

- id: 主键
- userId: 用户ID
- totalViolationPoints: 总违约积分
- violationThreshold: 触发阈值
- restrictionType: 限制类型
- restrictedUntil: 限制截止时间
- reason: 加入原因
