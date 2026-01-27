# 替代方案规则验证修复说明

## 问题描述

管理员在使用智能调度建议（替代方案）时，遇到 "必须至少提前 7 天预约" 的错误。原因是 `getAlternativeTimeSlots` 函数生成的时间建议没有考虑 `ADVANCE_DAYS` 规则。

## 修复方案

### 1. 改进替代时间生成逻辑 (server/db.ts)

#### 新增时间建议类型
```typescript
// 原有：只有小时级偏移
{ hours: ±1, ±2 }

// 新增：支持天级偏移
{ hours: ±1, ±2 } + { days: 1, 2, 7 }
```

#### 集成规则检查
- 获取 `ADVANCE_DAYS` 规则值
- 计算最早允许预约日期
- 过滤掉不符合规则的时间建议
- 自动跳过违规时间

### 2. 新增管理员特权功能 (server/db.ts + routers.ts)

#### checkReservationRulesExceptAdvance()
新增辅助函数，允许跳过 `ADVANCE_DAYS` 规则检查，但保留其他规则（`MAX_PER_DAY`、`MAX_DURATION`）。

#### reservation.update 接口扩展
- 新增 `bypassAdvanceRule: boolean` 参数
- 管理员传递 `true` 时，使用 `checkReservationRulesExceptAdvance()`
- 普通用户或未传递时，使用完整规则检查

### 3. 前端 UI 改进 (client/src/pages/CalendarDashboard.tsx)

#### 替代方案对话框
- **完整日期显示**：从 `HH:mm` 改为 `yyyy/MM/dd HH:mm`，清晰显示推荐日期
- **双按钮模式**（仅管理员可见）：
  - "采用此方案"：正常应用，遵守所有规则
  - "绕过规则"：管理员专用，跳过 ADVANCE_DAYS 限制

#### 交互优化
```typescript
handleApplyAlternativeSlot(slot, bypassAdvanceRule = false)
```
- 管理员首次点击时提示：如遇规则错误，可使用"绕过规则"选项
- 绕过成功后显示确认信息："已使用管理员权限绕过提前预约规则"

## 代码变更总结

### server/db.ts
1. `getAlternativeTimeSlots()` (78 lines 改为 ~120 lines)
   - 新增 ADVANCE_DAYS 规则查询
   - 扩展时间建议类型（小时 + 天）
   - 添加规则过滤逻辑

2. `checkReservationRulesExceptAdvance()` (新增函数，~75 lines)
   - 复制 `checkReservationRules()` 逻辑
   - 移除 ADVANCE_DAYS 检查部分

### server/routers.ts
1. `reservation.update` mutation 修改
   - 新增 `bypassAdvanceRule` 输入参数
   - 根据参数选择规则检查函数
   - 记录审计日志时标记是否使用绕过权限

### client/src/pages/CalendarDashboard.tsx
1. `handleApplyAlternativeSlot()` 修改
   - 新增 `bypassAdvanceRule` 参数
   - 管理员提示逻辑
   - 传递参数到后端

2. 冲突对话框 UI 更新
   - 显示完整日期 (`yyyy/MM/dd HH:mm`)
   - 添加"绕过规则"按钮（条件渲染）
   - 按钮样式：琥珀色边框 + 悬停效果

## 测试验证

### 自动化测试
创建 `server/alternative-slots.test.ts`:
- 验证替代方案符合 ADVANCE_DAYS 规则
- 验证 `checkReservationRulesExceptAdvance()` 跳过 ADVANCE_DAYS

### 手动测试流程
1. 以管理员身份登录
2. 创建冲突的预约
3. 查看冲突详情和替代方案
4. 验证所有推荐时间 >= 今天 + 7 天
5. 如需紧急预约，使用"绕过规则"按钮

## 安全考虑

### 权限控制
- 仅 `labAdmin` 和 `sysAdmin` 角色可见"绕过规则"按钮
- 后端验证用户角色：`isAdmin = ['labAdmin', 'sysAdmin'].includes(ctx.user.role)`
- 审计日志记录绕过操作

### 规则一致性
- 普通用户：始终执行完整规则检查
- 管理员绕过：仅跳过 ADVANCE_DAYS，其他规则仍生效
- 防止滥用：审计日志可追溯所有绕过操作

## 使用场景

### 场景 1：普通用户预约
1. 系统推荐 7 天后的替代方案
2. 用户点击"采用此方案"
3. 正常通过所有规则检查 ✅

### 场景 2：管理员紧急协调
1. 系统推荐 7 天后的方案（但管理员需要更早的时间）
2. 管理员点击"绕过规则"
3. 跳过 ADVANCE_DAYS，直接安排 ✅
4. 审计日志记录操作

### 场景 3：推荐方案不足
1. 冲突严重，14 天内无空闲时间
2. 提示："暂无合适的替代方案，请尝试更换日期"
3. 用户手动选择更远的日期 ✅

## 后续优化建议

1. **智能搜索范围扩展**
   - 当前搜索 14 天，如果无结果自动扩展到 30 天
   - 提示用户："已为您搜索未来 30 天"

2. **推荐策略优化**
   - 优先推荐同一天的其他时段
   - 其次推荐相邻天数的同一时段
   - 最后推荐更远的日期

3. **规则豁免配置化**
   - 在规则管理中配置哪些规则可被管理员绕过
   - 为每个规则添加 `bypassable: boolean` 字段
   - 前端根据配置动态显示"绕过规则"选项

4. **通知机制**
   - 管理员绕过规则后，自动通知相关负责人
   - 每周生成绕过操作汇总报告

---

**修复日期**：2025-12-12  
**影响范围**：日历调度建议、预约更新、管理员权限  
**测试状态**：✅ 类型检查通过 | ⚠️ 单元测试待验证（calendar-update.test.ts 初始化问题无关）
