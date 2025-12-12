# 数据库文档

## 概述

本项目使用 MySQL 数据库，通过 Drizzle ORM 进行数据管理。数据库名称为 `lab_reservation_db`。

**当前版本**：2025-12-12  
**最后更新**：日历优化与冲突管理（P2-2），updatedAt 字段优化

## 快速恢复指南

### 如果数据库出现问题

```bash
# 1. 清空并重建数据库
pnpm db:push                          # 同步 schema 到数据库

# 2. 运行修复脚本（如果遇到 role enum 问题）
npx tsx scripts/fix-role-enum.ts      # 清空所有表并修复 role 字段

# 3. 初始化测试数据
npx tsx scripts/seed.mjs              # 导入基础数据
npx tsx scripts/create-violation-users.ts  # 导入违约测试数据（可选）

# 4. 验证
pnpm test                             # 运行单元测试
```

## 数据库表结构

### 核心表

#### `users` - 用户表
存储所有用户信息和认证数据。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 用户 ID |
| openId | VARCHAR(64) | NOT NULL, UNIQUE | OAuth 用户 ID（唯一标识） |
| name | TEXT | | 用户名 |
| email | VARCHAR(320) | | 邮箱 |
| loginMethod | VARCHAR(64) | | 登录方式（mock, wechat 等） |
| **role** | ENUM | NOT NULL, DEFAULT 'student' | 用户角色：`student`, `teacher`, `labAdmin`, `sysAdmin` |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |
| lastSignedIn | TIMESTAMP | DEFAULT NOW() | 最后登录时间 |

**重要**：`role` 字段必须是以下 4 个值之一：
- `student` - 学生
- `teacher` - 教师
- `labAdmin` - 实验室管理员
- `sysAdmin` - 系统管理员

**常见问题**：
- ⚠️ 如果看到 "Data truncated for column 'role'" 错误，表示 role enum 定义不正确
- ✅ 解决方法：运行 `npx tsx scripts/fix-role-enum.ts`

---

#### `lab_rooms` - 实验室表
存储所有实验室基本信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 实验室 ID |
| roomNo | VARCHAR(50) | NOT NULL, UNIQUE | 实验室编号（如 LAB-101） |
| name | VARCHAR(100) | NOT NULL | 实验室名称 |
| building | VARCHAR(100) | | 建筑名称 |
| location | VARCHAR(200) | | 位置描述 |
| capacity | INT | DEFAULT 0 | 容纳人数 |
| type | VARCHAR(50) | | 实验室类型（机房、化学实验室等） |
| managerId | INT | | 管理员 ID（FK: users.id） |
| openTimeStart | VARCHAR(10) | DEFAULT '08:00' | 开放开始时间 |
| openTimeEnd | VARCHAR(10) | DEFAULT '22:00' | 开放结束时间 |
| status | ENUM | DEFAULT 'enabled' | 状态：`enabled`, `disabled` |
| remark | TEXT | | 备注 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

#### `lab_reservations` - 预约表
记录所有实验室预约信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 预约 ID |
| labId | INT | NOT NULL, FK | 实验室 ID |
| userId | INT | NOT NULL, FK | 预约用户 ID |
| title | VARCHAR(200) | NOT NULL | 预约标题 |
| reason | TEXT | | 预约原因 |
| peopleCount | INT | DEFAULT 1 | 人数 |
| startTime | TIMESTAMP | NOT NULL | 开始时间 |
| endTime | TIMESTAMP | NOT NULL | 结束时间 |
| status | ENUM | DEFAULT 'pending' | 状态：`pending`, `approved`, `rejected`, `cancelled`, `completed` |
| rejectReason | TEXT | | 拒绝原因 |
| applyTime | TIMESTAMP | DEFAULT NOW() | 申请时间 |
| approveTime | TIMESTAMP | | 审批时间 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

#### `lab_reserve_rules` - 预约规则表
定义预约系统的业务规则（每次查询应从这里读取，不硬编码）。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 规则 ID |
| ruleCode | VARCHAR(50) | NOT NULL, UNIQUE | 规则代码（如 MAX_PER_DAY） |
| ruleName | VARCHAR(100) | NOT NULL | 规则名称 |
| ruleValue | VARCHAR(100) | NOT NULL | 规则值 |
| description | TEXT | | 规则描述 |
| status | ENUM | DEFAULT 'enabled' | 状态：`enabled`, `disabled` |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

**默认规则**：
```
MAX_PER_DAY: 最多每天预约次数 (值: 2)
MAX_DURATION: 单次预约最长时长，分钟 (值: 120)
ADVANCE_DAYS: 提前预约天数 (值: 7)
```

---

### 违约管理表

#### `violation_records` - 违约记录表
记录用户违约行为。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 记录 ID |
| userId | INT | NOT NULL, FK | 违约用户 ID |
| violationType | VARCHAR(50) | NOT NULL | 违约类型：`no_show`（无故缺席）, `late_cancel`（迟到取消）, `timeout_checkout`（超时未签出） |
| points | INT | NOT NULL | 扣分（通常 5-15 分） |
| relatedReservationId | INT | | 相关预约 ID |
| reason | TEXT | | 违约原因描述 |
| recordedAt | TIMESTAMP | DEFAULT NOW() | 记录时间 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

#### `blacklist` - 黑名单表
记录因违约积分过高而被限制的用户。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 记录 ID |
| userId | INT | NOT NULL, FK, UNIQUE | 黑名单用户 ID |
| totalViolationPoints | INT | NOT NULL | 总违约积分 |
| violationThreshold | INT | NOT NULL | 触发黑名单的积分阈值 |
| restrictionType | ENUM | NOT NULL | 限制类型：`time_limit`（时间限制）, `resource_limit`（资源限制） |
| restrictedUntil | TIMESTAMP | | 限制解除时间 |
| restrictedLabIds | TEXT | | 限制的实验室 ID 列表（逗号分隔） |
| reason | TEXT | | 限制原因 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**黑名单触发条件**：违约积分 ≥ 20 分

---

### 审计与批准表

#### `audit_logs` - 审计日志表
记录系统中所有重要操作。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 日志 ID |
| operatorUserId | INT | NOT NULL, FK | 操作者用户 ID |
| operationType | VARCHAR(50) | NOT NULL | 操作类型（如 `violation_record`, `user_update`） |
| targetType | VARCHAR(50) | NOT NULL | 目标类型（如 `user`, `reservation`） |
| targetId | INT | | 目标对象 ID |
| details | TEXT | | 操作详情（JSON） |
| reason | TEXT | | 原因 |
| result | ENUM | DEFAULT 'success' | 结果：`success`, `failed` |
| ipAddress | VARCHAR(50) | | 操作者 IP 地址 |
| operatedAt | TIMESTAMP | DEFAULT NOW() | 操作时间 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

#### `approval_configs` - 审批配置表
定义预约审批流程的配置。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 配置 ID |
| labId | INT | | 应用的实验室 ID（NULL 为全局） |
| name | VARCHAR(100) | NOT NULL | 配置名称 |
| enableMultiLevel | INT | DEFAULT 0 | 是否启用多级审批 |
| approvalStages | TEXT | NOT NULL | 审批阶段定义（JSON） |
| rescheduleWindowHours | INT | DEFAULT 24 | 允许改期的时间窗口（小时） |
| maxRescheduleCount | INT | DEFAULT 3 | 最多改期次数 |
| status | ENUM | DEFAULT 'enabled' | 状态 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

#### `approval_histories` - 审批历史表
记录每次预约的审批流程。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 记录 ID |
| reservationId | INT | NOT NULL, FK | 预约 ID |
| approverUserId | INT | NOT NULL, FK | 审批者用户 ID |
| approvalStage | INT | NOT NULL | 审批阶段序号 |
| decision | ENUM | NOT NULL | 决策：`pending`, `approved`, `rejected`, `rescheduled` |
| comment | TEXT | | 审批意见 |
| approvedAt | TIMESTAMP | DEFAULT NOW() | 审批时间 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

### 课程管理表

#### `courses` - 课程表
存储课程信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 课程 ID |
| code | VARCHAR(50) | NOT NULL, UNIQUE | 课程代码 |
| name | VARCHAR(100) | NOT NULL | 课程名称 |
| description | TEXT | | 课程描述 |
| teacherId | INT | NOT NULL, FK | 教师 ID |
| credits | INT | | 学分 |
| capacity | INT | | 容量 |
| semester | VARCHAR(20) | | 学期 |
| status | ENUM | DEFAULT 'active' | 状态 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

#### `course_students` - 课程学生表
关联学生与课程。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 记录 ID |
| courseId | INT | NOT NULL, FK | 课程 ID |
| studentId | INT | NOT NULL, FK | 学生用户 ID |
| enrolledAt | TIMESTAMP | DEFAULT NOW() | 选课时间 |

---

#### `course_reservations` - 课程实验室预约表
记录课程级别的实验室预约（整个班级）。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 预约 ID |
| courseId | INT | NOT NULL, FK | 课程 ID |
| labId | INT | NOT NULL, FK | 实验室 ID |
| title | VARCHAR(200) | NOT NULL | 预约标题 |
| reason | TEXT | | 预约原因 |
| startTime | TIMESTAMP | NOT NULL | 开始时间 |
| endTime | TIMESTAMP | NOT NULL | 结束时间 |
| status | ENUM | DEFAULT 'pending' | 状态：`pending`, `approved`, `rejected`, `cancelled`, `completed` |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

### 班级管理表

#### `classes` - 班级表
存储班级信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 班级 ID |
| classNo | VARCHAR(50) | NOT NULL, UNIQUE | 班级编号（如 CS2024-1） |
| name | VARCHAR(100) | NOT NULL | 班级名称 |
| major | VARCHAR(100) | | 专业 |
| grade | VARCHAR(20) | | 年级（2024, 2023 等） |
| counselorId | INT | FK | 班主任 ID |
| capacity | INT | DEFAULT 0 | 班级容量 |
| description | TEXT | | 班级描述 |
| semester | VARCHAR(50) | | 学期 |
| status | ENUM | DEFAULT 'active' | 状态：`active`, `archived` |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

#### `class_students` - 班级学生表
关联学生与班级。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 记录 ID |
| classId | INT | NOT NULL, FK | 班级 ID |
| studentId | INT | NOT NULL, FK | 学生用户 ID |
| studentNo | VARCHAR(50) | | 学号 |
| status | ENUM | DEFAULT 'active' | 状态：`active`, `graduated`, `suspended`, `withdrawn` |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

### 设备管理表

#### `lab_devices` - 实验室设备表
记录每个实验室的设备。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 设备 ID |
| labId | INT | NOT NULL, FK | 所属实验室 ID |
| deviceNo | VARCHAR(50) | NOT NULL, UNIQUE | 设备编号 |
| name | VARCHAR(100) | NOT NULL | 设备名称 |
| type | VARCHAR(50) | | 设备类型 |
| quantity | INT | DEFAULT 1 | 数量 |
| purchaseDate | DATE | | 购置日期 |
| status | ENUM | DEFAULT 'normal' | 状态：`normal`, `maintenance`, `retired` |
| remark | TEXT | | 备注 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

### 其他表

#### `notifications` - 通知表
存储系统通知。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 通知 ID |
| userId | INT | NOT NULL, FK | 接收者用户 ID |
| type | VARCHAR(50) | NOT NULL | 通知类型 |
| title | VARCHAR(200) | | 标题 |
| content | TEXT | | 内容 |
| relatedId | INT | | 相关对象 ID |
| isRead | TINYINT | DEFAULT 0 | 是否已读 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

#### `opening_rules` - 开放规则表
定义实验室的开放时间规则。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 规则 ID |
| labId | INT | NOT NULL, FK | 实验室 ID |
| dayOfWeek | INT | NOT NULL | 星期几（0-6） |
| openTime | TIME | NOT NULL | 开放时间 |
| closeTime | TIME | NOT NULL | 关闭时间 |
| isAvailable | TINYINT | DEFAULT 1 | 是否可用 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

#### `blocked_periods` - 封禁时段表
定义实验室的不可预约时段。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 时段 ID |
| labId | INT | NOT NULL, FK | 实验室 ID |
| startTime | TIMESTAMP | NOT NULL | 开始时间 |
| endTime | TIMESTAMP | NOT NULL | 结束时间 |
| reason | TEXT | | 原因 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

## 测试数据

### 默认用户

| openId | 名称 | 邮箱 | 角色 | 用途 |
|--------|------|------|------|------|
| qq-admin-openid | 系统管理员 | admin@example.com | sysAdmin | 系统管理员测试 |
| sysadmin-001 | 系统管理员 | sysadmin@example.com | sysAdmin | 快速登录 |
| labadmin-001 | 实验室管理员 | labadmin@example.com | labAdmin | 快速登录 |
| teacher-001 | 教师 | teacher@example.com | teacher | 快速登录 |
| student-001 | 学生 | student@example.com | student | 快速登录 |

### 快速登录 URL（开发模式）

在浏览器侧边栏点击快速登录按钮，或手动访问以下 URL：

```
# 系统管理员
http://localhost:4000/oauth/authorize?redirect_uri=http://localhost:3000/api/oauth/callback&openid=sysadmin-001&name=系统管理员&email=sysadmin@example.com&role=sysAdmin

# 实验室管理员
http://localhost:4000/oauth/authorize?redirect_uri=http://localhost:3000/api/oauth/callback&openid=labadmin-001&name=实验室管理员&email=labadmin@example.com&role=labAdmin

# 教师
http://localhost:4000/oauth/authorize?redirect_uri=http://localhost:3000/api/oauth/callback&openid=teacher-001&name=教师&email=teacher@example.com&role=teacher

# 学生
http://localhost:4000/oauth/authorize?redirect_uri=http://localhost:3000/api/oauth/callback&openid=student-001&name=学生&email=student@example.com&role=student
```

---

## 常见问题与解决方案

### Q1: "Data truncated for column 'role' at row 1"

**原因**：数据库中 `users.role` 字段的 enum 定义不包含新的角色值。

**解决方案**：
```bash
npx tsx scripts/fix-role-enum.ts
```

这个脚本会：
1. 清空所有表
2. 修改 `role` enum 从 `('user','admin')` 更新为 `('student','teacher','labAdmin','sysAdmin')`
3. 重新初始化数据

⚠️ **警告**：这会删除所有现有数据！

---

### Q2: OAuth 登录显示"无法访问此网站"

**原因**：可能是以下几种情况：
1. Mock OAuth 没有正确返回 role
2. 后端的 OAuth 回调处理失败
3. 会话 Cookie 没有正确设置

**解决方案**：
```bash
# 运行 OAuth 测试脚本
npx tsx scripts/test-oauth.ts

# 查看后端日志
pnpm dev  # 查看 [OAuth] 开头的日志
```

---

### Q3: 快速登录后菜单项不更新

**原因**：前端 RoleContext 没有正确更新。

**解决方案**：
1. 清除浏览器 Cookie：`document.cookie = "session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"`
2. 刷新页面
3. 重新快速登录

---

### Q4: 预约系统一直显示"数据加载失败"

**原因**：通常是后端 tRPC 路由没有正确定义或数据库查询超时。

**解决方案**：
```bash
# 检查 TypeScript 编译
pnpm check

# 查看后端日志（如果有 500 错误）
# 可能需要检查 server/routers.ts 中的路由定义
```

---

## 维护建议

1. **定期备份**：如果有重要测试数据，使用 `mysqldump` 定期备份
2. **日志监控**：关注审计日志表的增长，定期清理
3. **规则同步**：所有业务规则应从 `lab_reserve_rules` 表读取，不在代码中硬编码
4. **权限检查**：始终使用 `protectedProcedure`、`adminProcedure` 等检查权限

---

## Timestamp 字段最佳实践（P2-2 新增）

### updatedAt 字段配置

**问题**：更新时间需自动刷新，以支持"最近更新的记录显示在顶部"功能。

**解决方案**：添加 `ON UPDATE CURRENT_TIMESTAMP` 触发器

```sql
-- 修复现有字段
ALTER TABLE lab_reservations 
MODIFY COLUMN updatedAt TIMESTAMP NOT NULL 
DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 新表定义示例
CREATE TABLE lab_reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ...
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ...
);
```

**验证**：
```sql
-- 查看字段定义
SHOW CREATE TABLE lab_reservations \G
-- 应该看到 updatedAt: timestamp ... on update current_timestamp()

-- 测试更新
UPDATE lab_reservations SET title = '...' WHERE id = 1;
SELECT id, updatedAt FROM lab_reservations WHERE id = 1;
-- updatedAt 应该更新为当前时间
```

---

### 查询排序最佳实践

**问题**：使用 `createdAt DESC` 无法反映最近的更新。

**解决方案**：优先使用 `updatedAt`，并保留 `createdAt` 作为次要排序

```typescript
// ❌ 错误
.orderBy(desc(lab_reservations.createdAt))

// ✅ 正确（P2-2 推荐）
.orderBy(desc(lab_reservations.updatedAt), desc(lab_reservations.createdAt))
```

**应用场景**：
- 管理员审核列表：需展示最新更新的预约
- 用户预约历史：保持按创建顺序
- 统计查询：按更新时间分组

---

## 高级查询说明（P2-1 日历相关）

### 日历多维度查询

#### 1. `getReservationsByTimeRange`（通用查询）
**位置**：[server/routers.ts](server/routers.ts) - `calendar.getReservationsByTimeRange`

**输入参数**：
```typescript
{
  startDate: string;     // ISO 8601 日期时间
  endDate: string;       // ISO 8601 日期时间
  labId?: number;        // 可选：按实验室过滤
  deviceId?: number;     // 可选：按设备过滤
  courseId?: number;     // 可选：按课程过滤
  teacherId?: number;    // 可选：按教师过滤
}
```

**返回结果**：
```typescript
{
  id: number;
  labId: number;
  userId: number;
  title: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  peopleCount: number;
}[]
```

**使用场景**：通用日历视图，支持多维度切换

---

#### 2. `getReservationDetails`（详情查询）
**位置**：[server/db.ts](server/db.ts#L1724-L1772) - `getReservationDetails()`

**输入参数**：
```typescript
{
  reservationId: number;  // 预约 ID
}
```

**返回结果**：
```typescript
{
  id: number;
  labId: number;
  userId: number;
  title: string;
  reason: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  peopleCount: number;
  applicant: {           // 申请人信息（JOIN users）
    id: number;
    name: string;
    email: string;
    role: UserRole;
  };
  lab: {                 // 实验室信息（JOIN lab_rooms）
    id: number;
    roomNo: string;
    name: string;
    building: string;
    capacity: number;
  };
  approvalHistory: {     // 审批历史（JOIN approval_histories）
    approvalStage: number;
    decision: 'pending' | 'approved' | 'rejected' | 'rescheduled';
    comment: string;
    approvedAt: Date;
  }[];
}
```

**使用场景**：点击日历事件后显示完整详情面板

**注意事项**：
- 当前版本 devices 和 course 字段返回空/null（数据库 schema 限制）
- 审批历史按 `approvalStage` 正序排列

---

#### 3. `getConflictSuggestions`（替代方案推荐）
**位置**：[server/routers.ts](server/routers.ts) - `calendar.getConflictSuggestions`

**输入参数**：
```typescript
{
  labId: number;
  startTime: string;     // ISO 8601 日期时间
  endTime: string;       // ISO 8601 日期时间
}
```

**返回结果**：
```typescript
{
  start: Date;
  end: Date;
}[]  // 最多返回 3 个建议
```

**算法逻辑**：
1. 查询指定实验室在当天的所有已批准预约
2. 根据预约间隙计算空闲时段
3. 按相似度评分（时间接近优先）
4. 返回前 3 个推荐

**使用场景**：冲突检测后自动推荐替代时间槽

---

### 冲突检测逻辑

**前端实现**：[client/src/components/Calendar.tsx](client/src/components/Calendar.tsx) - `checkConflict()`

**检测条件**：
```typescript
const checkConflict = (event) => {
  // 时间重叠检测：NOT (end1 <= start2 OR start1 >= end2)
  const hasTimeOverlap = !(new Date(event.endTime) <= new Date(otherEvent.startTime) || 
                            new Date(event.startTime) >= new Date(otherEvent.endTime));
  
  // 只检测已批准或待审核的预约
  const isActiveStatus = ['approved', 'pending'].includes(otherEvent.status);
  
  return hasTimeOverlap && isActiveStatus;
};
```

**视觉提示**：
- ⚠️ 红色警告图标
- `ring-2 ring-red-500` 红色边框高亮
- Hover 显示"存在时间冲突"提示

---

## 更新历史

| 日期 | 事件 | 修改人 |
|------|------|--------|
| 2025-12-11 | 添加日历多维度查询说明（P2-1） | AI Assistant |
| 2025-12-04 | 修复 role enum 定义，更新至 4 层角色系统 | AI Assistant |
| 2025-12-04 | 创建数据库文档 | AI Assistant |


