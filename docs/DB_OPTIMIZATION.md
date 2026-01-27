# 数据库优化与扩展规划（最终版）

> 更新日期：2026-01-27  
> 状态：经过完整代码分析后的最终方案

## 一、现状分析

### 1.1 迁移文件真实状态

| 迁移文件 | 内容 | 当前状态 |
|---------|------|---------|
| 0000_light_richard_fisk.sql | 创建全部 17 张表 | ✅ 已应用 |
| 0001_handy_hellcat.sql | 添加 `deviceId`, `courseId` | ⚠️ 已应用 |
| 0002_quiet_impossible_man.sql | **删除** `deviceId`, `courseId` | ✅ 已应用 |

**结论**：`deviceId` 和 `courseId` 字段**当前不存在于数据库中**。原文档"同步 schema.ts 映射 deviceId/courseId"的建议是**错误的**，无需执行。

### 1.2 用户表现状 (`users`)

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) NOT NULL UNIQUE,  -- 当前仅支持单一 OAuth 提供商
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),             -- 记录登录方式，但无法多账号绑定
  role ENUM('student','teacher','labAdmin','sysAdmin') DEFAULT 'student',
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  lastSignedIn TIMESTAMP
);
```

**问题**：
- `openId` 是唯一索引，只能存储一个 OAuth 提供商的 ID
- 若用户先用 QQ 登录，后用 GitHub 登录，会创建两个独立账户，无法合并
- 无法支持"学校统一认证"强制绑定场景

### 1.3 预约表缺失签到字段 (`lab_reservations`)

当前表仅有 `autoCancelHours` 配置项（在 `approval_configs` 中），但预约表本身**没有**：
- 签到时间 (`checkinTime`)
- 签退时间 (`checkoutTime`)
- 签到方式 (`checkinMethod`: 二维码/地理围栏/人脸)
- 签到地点 (`checkinLocation`)

---

## 二、必须执行的优化（P0）

### 2.1 唯一约束（防止脏数据）

```sql
-- 课程学生：同一学生不能重复加入同一课程
ALTER TABLE course_students
  ADD CONSTRAINT uq_course_students UNIQUE (courseId, studentId);

-- 班级学生：同一学生不能重复加入同一班级
ALTER TABLE class_students
  ADD CONSTRAINT uq_class_students UNIQUE (classId, studentId);

-- 黑名单：同一用户只能有一条黑名单记录
ALTER TABLE blacklist
  ADD CONSTRAINT uq_blacklist_user UNIQUE (userId);
```

**注意**：`approval_histories` **不应**添加唯一约束。原因：
- 表名是 `histories`（历史记录），语义上应允许同一预约的同一审批级别被多次操作（如：拒绝→重新提交→再次审批）
- 添加唯一约束会导致"驳回后重新审批"场景报错

### 2.2 核心查询索引

```sql
-- 预约冲突检测（最常用查询，必须优化）
CREATE INDEX idx_reservations_lab_status_time
  ON lab_reservations (labId, status, startTime, endTime);

-- 禁用时段检测
CREATE INDEX idx_blocked_periods_lab_status_time
  ON blocked_periods (labId, status, startDate, endDate);

-- 通知列表
CREATE INDEX idx_notifications_user_read_time
  ON notifications (userId, isRead, createdAt);

-- 审计日志查询
CREATE INDEX idx_audit_logs_operator_time
  ON audit_logs (operatorUserId, operatedAt);

-- 审批历史查询（仅建普通索引，不建唯一约束）
CREATE INDEX idx_approval_histories_res_stage
  ON approval_histories (reservationId, approvalStage);
```

---

## 三、多 OAuth 提供商支持方案

### 3.1 新增 `user_oauth_bindings` 表

```sql
CREATE TABLE user_oauth_bindings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,                              -- 外键 → users.id
  provider ENUM('qq', 'github', 'school', 'manus') NOT NULL,  -- OAuth 提供商
  providerUserId VARCHAR(128) NOT NULL,             -- 提供商返回的用户 ID
  providerEmail VARCHAR(320),                       -- 提供商返回的邮箱（可选）
  providerName VARCHAR(255),                        -- 提供商返回的昵称（可选）
  accessToken TEXT,                                 -- 可选：存储 token 用于后续 API 调用
  refreshToken TEXT,                                -- 可选：刷新 token
  tokenExpiresAt TIMESTAMP,                         -- token 过期时间
  bindAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastUsedAt TIMESTAMP,                             -- 最后使用该方式登录的时间
  status ENUM('active', 'unbound') DEFAULT 'active' NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uq_provider_user (provider, providerUserId),  -- 同一提供商的同一用户只能绑定一次
  INDEX idx_user_bindings (userId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3.2 用户表调整

```sql
-- 保留 openId 用于兼容现有 Manus OAuth，但不再作为唯一登录方式
-- 新增字段
ALTER TABLE users
  ADD COLUMN primaryEmail VARCHAR(320) AFTER email,      -- 主邮箱（用于账号合并匹配）
  ADD COLUMN emailVerified TINYINT(1) DEFAULT 0,         -- 邮箱是否验证
  ADD COLUMN studentNo VARCHAR(50),                       -- 学号（学校认证后填充）
  ADD COLUMN schoolVerified TINYINT(1) DEFAULT 0;         -- 是否完成学校认证

-- 学号唯一索引（允许 NULL）
CREATE UNIQUE INDEX uq_users_student_no ON users (studentNo);
```

### 3.3 登录/绑定流程

```
┌─────────────────────────────────────────────────────────────┐
│                     OAuth 回调处理逻辑                        │
├─────────────────────────────────────────────────────────────┤
│ 1. 收到 provider + providerUserId                            │
│                                                              │
│ 2. 查询 user_oauth_bindings 是否已存在绑定？                  │
│    ├─ 是 → 更新 lastUsedAt，返回对应 userId，登录成功          │
│    └─ 否 → 继续步骤 3                                         │
│                                                              │
│ 3. 用户当前是否已登录（有 session）？                          │
│    ├─ 是 → 绑定模式：将新 OAuth 绑定到当前 userId              │
│    └─ 否 → 继续步骤 4                                         │
│                                                              │
│ 4. 是否有相同邮箱的已有用户？                                  │
│    ├─ 是 → 提示用户：发现已有账号，是否绑定？需验证原账号       │
│    └─ 否 → 创建新用户 + 绑定记录                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 学校统一认证特殊处理

学校认证通常返回**学号**，可作为强绑定依据：

```typescript
// 学校 OAuth 回调特殊逻辑
if (provider === 'school') {
  const studentNo = userInfo.studentNo; // 学校返回学号
  
  // 查找是否有同学号用户（可能是管理员预创建）
  const existingUser = await db.select().from(users)
    .where(eq(users.studentNo, studentNo)).limit(1);
  
  if (existingUser.length > 0) {
    // 强制绑定到已有账户，更新 schoolVerified
    await db.update(users)
      .set({ schoolVerified: 1 })
      .where(eq(users.id, existingUser[0].id));
    // 创建绑定记录...
  }
}
```

---

## 四、签到功能数据库设计

### 4.1 预约表扩展

```sql
ALTER TABLE lab_reservations
  ADD COLUMN checkinTime TIMESTAMP NULL,                    -- 签到时间
  ADD COLUMN checkoutTime TIMESTAMP NULL,                   -- 签退时间
  ADD COLUMN checkinMethod ENUM('qrcode', 'geofence', 'face', 'manual') NULL,  -- 签到方式
  ADD COLUMN checkinLatitude DECIMAL(10, 7) NULL,           -- 签到纬度
  ADD COLUMN checkinLongitude DECIMAL(10, 7) NULL,          -- 签到经度
  ADD COLUMN checkinDeviceInfo VARCHAR(255) NULL;           -- 签到设备信息（可选）
```

### 4.2 实验室地理围栏配置

```sql
CREATE TABLE lab_geofences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  labId INT NOT NULL,                                       -- 外键 → lab_rooms.id
  latitude DECIMAL(10, 7) NOT NULL,                         -- 中心纬度
  longitude DECIMAL(10, 7) NOT NULL,                        -- 中心经度
  radius INT NOT NULL DEFAULT 100,                          -- 围栏半径（米）
  name VARCHAR(100),                                        -- 围栏名称（如：主楼入口）
  status ENUM('enabled', 'disabled') DEFAULT 'enabled',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (labId) REFERENCES lab_rooms(id) ON DELETE CASCADE,
  INDEX idx_geofence_lab (labId)
);
```

### 4.3 签到二维码表（可选）

```sql
CREATE TABLE checkin_qrcodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  labId INT NOT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,                         -- 二维码内容（随机字符串）
  validFrom TIMESTAMP NOT NULL,                             -- 有效开始时间
  validUntil TIMESTAMP NOT NULL,                            -- 有效结束时间
  createdBy INT NOT NULL,                                   -- 创建人（管理员）
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (labId) REFERENCES lab_rooms(id) ON DELETE CASCADE,
  INDEX idx_qrcode_lab_time (labId, validFrom, validUntil)
);
```

### 4.4 签到验证逻辑

```typescript
async function validateCheckin(reservationId: number, method: string, location?: {lat: number, lng: number}) {
  const reservation = await getReservationById(reservationId);
  
  // 1. 检查时间窗口（预约开始前 15 分钟 ~ 预约结束）
  const now = new Date();
  const windowStart = new Date(reservation.startTime.getTime() - 15 * 60 * 1000);
  if (now < windowStart || now > reservation.endTime) {
    return { success: false, reason: '不在签到时间窗口内' };
  }
  
  // 2. 地理围栏验证
  if (method === 'geofence' && location) {
    const geofence = await getLabGeofence(reservation.labId);
    const distance = calculateDistance(location, { lat: geofence.latitude, lng: geofence.longitude });
    if (distance > geofence.radius) {
      return { success: false, reason: `距离实验室 ${distance} 米，超出围栏范围` };
    }
  }
  
  // 3. 更新签到记录
  await updateReservation(reservationId, {
    checkinTime: now,
    checkinMethod: method,
    checkinLatitude: location?.lat,
    checkinLongitude: location?.lng,
  });
  
  return { success: true };
}
```

---

## 五、暂缓执行的优化项

| 优化项 | 原因 | 何时重新评估 |
|-------|------|-------------|
| FULLTEXT 索引 | 当前搜索用 `LIKE`，FULLTEXT 无效，需同步改代码 | 决定重构搜索时 |
| `openTimeStart/End` 改 TIME 类型 | 风格优化，需配套解析代码，非必须 | 下次重构实验室模块时 |
| `blocked_periods.reason` 改 ENUM | 现有数据含中文自由文本，改 ENUM 会报错 | 统一取值后 |
| 历史数据归档 | 当前数据量小，无性能问题 | 预约量超过 10 万条时 |
| 时区统一 UTC | 需全量测试，灰度推进 | 部署多时区服务器时 |

---

## 六、执行计划

### Phase 1：数据库约束与索引（本周）

```sql
-- 1. 唯一约束
ALTER TABLE course_students ADD CONSTRAINT uq_course_students UNIQUE (courseId, studentId);
ALTER TABLE class_students ADD CONSTRAINT uq_class_students UNIQUE (classId, studentId);
ALTER TABLE blacklist ADD CONSTRAINT uq_blacklist_user UNIQUE (userId);

-- 2. 核心索引
CREATE INDEX idx_reservations_lab_status_time ON lab_reservations (labId, status, startTime, endTime);
CREATE INDEX idx_blocked_periods_lab_status_time ON blocked_periods (labId, status, startDate, endDate);
CREATE INDEX idx_notifications_user_read_time ON notifications (userId, isRead, createdAt);
CREATE INDEX idx_audit_logs_operator_time ON audit_logs (operatorUserId, operatedAt);
CREATE INDEX idx_approval_histories_res_stage ON approval_histories (reservationId, approvalStage);
```

### Phase 2：多 OAuth 支持（2 周内）

1. 创建 `user_oauth_bindings` 表
2. 修改 `users` 表添加 `primaryEmail`, `studentNo`, `schoolVerified` 字段
3. 重构 oauth.ts 支持多提供商
4. 实现 QQ OAuth（需申请 QQ 互联开发者）
5. 实现 GitHub OAuth（需创建 GitHub App）
6. 前端添加"账号绑定"设置页面

### Phase 3：签到功能（1 个月内）

1. 扩展 `lab_reservations` 表添加签到字段
2. 创建 `lab_geofences` 表
3. 实现签到 API：
   - `POST /api/trpc/reservation.checkin` - 签到
   - `POST /api/trpc/reservation.checkout` - 签退
4. 前端签到页面（二维码扫描 + 地理位置获取）
5. 自动违约处理（未签到 → 标记 `no_show`）

### Phase 4：学校统一认证（视学校 API 开放情况）

1. 对接学校 OAuth/CAS
2. 实现学号强绑定逻辑
3. 角色自动同步（教师/学生）

---

## 七、Drizzle Schema 变更汇总

```typescript
// drizzle/schema.ts 新增内容

// 用户 OAuth 绑定表
export const userOAuthBindings = mysqlTable("user_oauth_bindings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["qq", "github", "school", "manus"]).notNull(),
  providerUserId: varchar("providerUserId", { length: 128 }).notNull(),
  providerEmail: varchar("providerEmail", { length: 320 }),
  providerName: varchar("providerName", { length: 255 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  bindAt: timestamp("bindAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  status: mysqlEnum("status", ["active", "unbound"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// 实验室地理围栏
export const labGeofences = mysqlTable("lab_geofences", {
  id: int("id").autoincrement().primaryKey(),
  labId: int("labId").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  radius: int("radius").default(100).notNull(),
  name: varchar("name", { length: 100 }),
  status: mysqlEnum("status", ["enabled", "disabled"]).default("enabled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// users 表扩展（需要迁移）
// ALTER TABLE users ADD COLUMN primaryEmail VARCHAR(320);
// ALTER TABLE users ADD COLUMN emailVerified TINYINT(1) DEFAULT 0;
// ALTER TABLE users ADD COLUMN studentNo VARCHAR(50);
// ALTER TABLE users ADD COLUMN schoolVerified TINYINT(1) DEFAULT 0;

// lab_reservations 表扩展（需要迁移）
// ALTER TABLE lab_reservations ADD COLUMN checkinTime TIMESTAMP NULL;
// ALTER TABLE lab_reservations ADD COLUMN checkoutTime TIMESTAMP NULL;
// ALTER TABLE lab_reservations ADD COLUMN checkinMethod ENUM('qrcode','geofence','face','manual') NULL;
// ALTER TABLE lab_reservations ADD COLUMN checkinLatitude DECIMAL(10,7) NULL;
// ALTER TABLE lab_reservations ADD COLUMN checkinLongitude DECIMAL(10,7) NULL;
```

---

**文档版本**：2.0.0  
**审核状态**：✅ 经过完整代码分析，修正原文档错误，新增 OAuth 多提供商和签到方案

---

## 文档最终版（2.0.1）

- 更新日期：2026-01-27
- 说明：本节为当前权威版本，优先于上文所有历史片段。落地以此为准。

### A. 必须执行（P0）
- 唯一约束
  - course_students(courseId, studentId)
  - class_students(classId, studentId)
  - blacklist(userId)
- 关键索引
  - lab_reservations(labId, status, startTime, endTime)
  - blocked_periods(labId, status, startDate, endDate)
  - notifications(userId, isRead, createdAt)
  - audit_logs(operatorUserId, operatedAt)
- 查询同步
  - 在 [db.ts:getReservationsByTimeRange](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L1974-L2012) 接入 deviceId/courseId
  - 在设备日历 [routers.ts:getDeviceCalendar](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L1694-L1731) 接入设备维度预约数据

### B. 需确认后执行（P1）
- 外键约束：lab_devices.labId → lab_rooms.id（CASCADE）；lab_reservations.labId/userId → lab_rooms/users（RESTRICT）；notifications.userId → users；approval_histories.approverUserId → users；lab_rooms.managerId → users（按需）
- FULLTEXT：仅在将 `LIKE` 改为 `MATCH ... AGAINST` 后创建索引；参考当前 `LIKE` 使用处 [db.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L185-L201)
- 类型调整：
  - TIME：lab_rooms.openTimeStart/openTimeEnd、opening_rules.openTime/closeTime（需同步解析逻辑）
  - notifications.isRead → TINYINT(1)（微优化）
  - blocked_periods.reason → ENUM（需先统一取值，兼容现有中文，例如测试中的“年度维护” [course.test.ts](file:///d:/workspace/A_bs/lab-reservation-system/server/course.test.ts#L184-L204)）
- 审批历史唯一性：保留普通索引 `(reservationId, approvalStage)`，如需“同级多次操作历史”，避免设置 UNIQUE

### C. 中长期（P2）
- UTC 时区策略：统一存储为 UTC，“按日”比较按 UTC 零点；灰度验证与用例补充
- 历史归档：预约归档至 lab_reservations_archive，按实际数据量评估时机

### D. SQL 清单（执行示例）
- 唯一约束
  ```sql
  ALTER TABLE course_students
    ADD CONSTRAINT uq_course_students UNIQUE (courseId, studentId);
  ALTER TABLE class_students
    ADD CONSTRAINT uq_class_students UNIQUE (classId, studentId);
  ALTER TABLE blacklist
    ADD CONSTRAINT uq_blacklist_user UNIQUE (userId);
  ```
- 索引
  ```sql
  CREATE INDEX idx_reservations_lab_status_time
    ON lab_reservations (labId, status, startTime, endTime);
  CREATE INDEX idx_blocked_periods_lab_status_time
    ON blocked_periods (labId, status, startDate, endDate);
  CREATE INDEX idx_notifications_user_read_time
    ON notifications (userId, isRead, createdAt);
  CREATE INDEX idx_audit_logs_operator_time
    ON audit_logs (operatorUserId, operatedAt);
  CREATE INDEX idx_approval_histories_res_stage
    ON approval_histories (reservationId, approvalStage);
  ```
- 外键
  ```sql
  ALTER TABLE lab_devices
    ADD CONSTRAINT fk_lab_devices_lab
      FOREIGN KEY (labId) REFERENCES lab_rooms(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE lab_reservations
    ADD CONSTRAINT fk_lab_reservations_lab
      FOREIGN KEY (labId) REFERENCES lab_rooms(id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_lab_reservations_user
      FOREIGN KEY (userId) REFERENCES users(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  ```

### E. 验证与回滚
- 验证：基准查询对比、约束前去重、`pnpm test`
- 回滚：为每条变更提供逆操作（DROP INDEX/CONSTRAINT），变更前按表备份（mysqldump）

### F. 风险提示
- 新约束/索引会暴露脏数据，需迁移前清理
- ENUM/TIME 需确保与现有数据与代码解析一致
- 外键 RESTRICT 会使删除实验室/用户失败；接口层需给出错误与清理指引：
  - 参考删除入口 [deleteLabRoom](file:///d:/workspace/A_bs/lab-reservation-system/server/db.ts#L116-L125)、[labRoom.delete](file:///d:/workspace/A_bs/lab-reservation-system/server/routers.ts#L122-L135)
