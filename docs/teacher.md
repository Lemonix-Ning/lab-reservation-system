> 文档状态：历史设计稿（方案讨论用）
> 
> 当前执行请优先参考：
> - ../DEPLOYMENT_GUIDE.md
> - ../README.md
> - docs/README.md

好的，这是**教师主导模式**的实验室预约系统设计方案：

---

# 教师主导模式 - 国内高校实验室预约系统设计

## 一、国内高校实验室使用模式分析

### 1.1 典型使用场景

国内高校实验室主要分为以下几种使用模式：

| 模式 | 说明 | 典型场景 |
|------|------|----------|
| **教学实验** | 教师按课程安排，学生按班级统一进入 | 大学物理实验、化学实验、计算机基础等 |
| **开放实验** | 学生自主预约，完成创新实验或课外项目 | 创新实验室、开放机房 |
| **科研实验** | 导师课题组使用，研究生/项目组成员 | 科研实验室、课题组专用设备 |
| **竞赛培训** | 指导教师带队，学生团队使用 | ACM训练、电子设计竞赛等 |

### 1.2 现有系统的问题

当前系统采用"学生自主预约 → 审批"模式，存在以下问题：

1. **与教学脱节**：不支持按课程/班级批量预约
2. **教师被动**：教师只能审批，无法主动安排
3. **资源利用低**：教学时段与开放时段未分离
4. **签到困难**：班级统一上课时，逐人签到不现实

---

## 二、教师主导模式设计

### 2.1 核心理念

```
教师 → 创建课程/项目 → 预约实验室时段 → 学生加入 → 按安排使用
                    ↓
              实验室管理员审批
```

### 2.2 角色职责重新定义

| 角色 | 职责 |
|------|------|
| **学生** | 加入课程/项目组 → 按安排到场 → 完成签到 |
| **教师** | 创建课程 → 添加学生名单 → 预约实验室时段 → 查看出勤统计 |
| **实验室管理员** | 审批教师预约 → 管理开放时段 → 处理冲突 |
| **系统管理员** | 系统配置 → 用户管理 → 数据统计 |

### 2.3 预约模式分类

#### 模式A：课程教学预约（教师主导）

```
流程：
1. 教师创建课程（课程名、学期、班级）
2. 批量导入学生名单（学号/名单）
3. 教师申请实验室时段（可批量申请整学期）
   - 选择实验室
   - 选择时间段（如：每周二 3-4节，共16周）
   - 系统自动生成16条预约记录
4. 实验室管理员审批
5. 审批通过后，学生端自动显示课程安排
6. 上课时：
   - 教师一键开启签到（生成二维码/地理围栏）
   - 学生扫码/位置签到
   - 系统自动记录出勤
```

#### 模式B：开放预约（学生主导，现有模式）

```
适用场景：课程实验室的开放时段、开放创新实验室

流程：
1. 管理员设置实验室开放时段规则
2. 学生在开放时段内自主预约
3. 按现有流程审批/签到
```

#### 模式C：项目组预约（导师主导）

```
流程：
1. 导师创建项目/课题组
2. 添加组内成员（研究生、本科生）
3. 预约实验室（可申请长期固定时段）
4. 组内成员按需使用，导师可查看使用记录
```

---

## 三、数据库扩展设计

### 3.1 新增/修改表结构

```sql
-- =============================================
-- 1. 课程表扩展（修改现有 courses 表）
-- =============================================
ALTER TABLE courses ADD COLUMN classInfo VARCHAR(200) COMMENT '班级信息，如：计科2301班';
ALTER TABLE courses ADD COLUMN studentCount INT DEFAULT 0 COMMENT '学生人数';
ALTER TABLE courses ADD COLUMN weekCount INT DEFAULT 16 COMMENT '课程周数';
ALTER TABLE courses ADD COLUMN labId INT COMMENT '关联实验室ID';

-- =============================================
-- 2. 课程时间安排表（新增）
-- =============================================
CREATE TABLE course_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  courseId INT NOT NULL COMMENT '课程ID',
  labId INT NOT NULL COMMENT '实验室ID',
  dayOfWeek TINYINT NOT NULL COMMENT '星期几（1-7）',
  startPeriod TINYINT NOT NULL COMMENT '开始节次（1-12）',
  endPeriod TINYINT NOT NULL COMMENT '结束节次',
  startWeek TINYINT DEFAULT 1 COMMENT '开始周',
  endWeek TINYINT DEFAULT 16 COMMENT '结束周',
  weekType ENUM('all', 'odd', 'even') DEFAULT 'all' COMMENT '周类型（全部/单周/双周）',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_course_schedules_lab (labId),
  INDEX idx_course_schedules_course (courseId)
) COMMENT '课程时间安排表';

-- =============================================
-- 3. 课程签到记录表（新增）
-- =============================================
CREATE TABLE course_attendances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  courseId INT NOT NULL COMMENT '课程ID',
  scheduleId INT COMMENT '课程安排ID（某次课）',
  studentId INT NOT NULL COMMENT '学生ID',
  sessionDate DATE NOT NULL COMMENT '上课日期',
  checkinTime TIMESTAMP NULL COMMENT '签到时间',
  checkinMethod ENUM('qrcode', 'geofence', 'manual', 'face') COMMENT '签到方式',
  status ENUM('present', 'late', 'absent', 'leave') DEFAULT 'absent' COMMENT '出勤状态',
  note VARCHAR(200) COMMENT '备注（如请假原因）',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attendance_course_date (courseId, sessionDate),
  INDEX idx_attendance_student (studentId),
  UNIQUE KEY uq_attendance (courseId, studentId, sessionDate)
) COMMENT '课程签到记录表';

-- =============================================
-- 4. 签到会话表（新增 - 教师开启签到时创建）
-- =============================================
CREATE TABLE checkin_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  courseId INT NOT NULL COMMENT '课程ID',
  scheduleId INT COMMENT '关联的课程安排',
  sessionDate DATE NOT NULL COMMENT '签到日期',
  teacherId INT NOT NULL COMMENT '创建签到的教师ID',
  qrcodeToken VARCHAR(64) COMMENT '二维码令牌（定期刷新）',
  qrcodeExpireAt TIMESTAMP COMMENT '二维码过期时间',
  allowLateMinutes INT DEFAULT 15 COMMENT '允许迟到分钟数',
  useGeofence TINYINT DEFAULT 1 COMMENT '是否启用地理围栏',
  status ENUM('active', 'closed') DEFAULT 'active' COMMENT '签到状态',
  startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  closedAt TIMESTAMP COMMENT '关闭时间',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_course (courseId, sessionDate),
  INDEX idx_session_token (qrcodeToken)
) COMMENT '签到会话表';

-- =============================================
-- 5. 项目组表（新增 - 科研场景）
-- =============================================
CREATE TABLE research_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '项目组名称',
  leaderId INT NOT NULL COMMENT '负责人（导师）ID',
  description TEXT COMMENT '项目描述',
  defaultLabId INT COMMENT '默认使用的实验室',
  status ENUM('active', 'archived') DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT '项目组/课题组表';

-- =============================================
-- 6. 项目组成员表（新增）
-- =============================================
CREATE TABLE research_group_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  groupId INT NOT NULL COMMENT '项目组ID',
  userId INT NOT NULL COMMENT '成员ID',
  role ENUM('leader', 'member') DEFAULT 'member' COMMENT '角色',
  joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_member (groupId, userId)
) COMMENT '项目组成员表';

-- =============================================
-- 7. 实验室时段类型表（新增）
-- =============================================
CREATE TABLE lab_time_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  labId INT NOT NULL COMMENT '实验室ID',
  slotType ENUM('teaching', 'open', 'reserved', 'maintenance') NOT NULL COMMENT '时段类型',
  dayOfWeek TINYINT COMMENT '星期几（NULL表示适用所有天）',
  startTime VARCHAR(10) NOT NULL COMMENT '开始时间 HH:MM',
  endTime VARCHAR(10) NOT NULL COMMENT '结束时间 HH:MM',
  effectiveFrom DATE COMMENT '生效开始日期',
  effectiveTo DATE COMMENT '生效结束日期',
  priority INT DEFAULT 0 COMMENT '优先级（冲突时高优先级覆盖）',
  description VARCHAR(200),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slots_lab (labId)
) COMMENT '实验室时段类型配置';

-- =============================================
-- 8. 节次时间对照表（新增 - 节次与实际时间映射）
-- =============================================
CREATE TABLE period_time_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY,
  periodNo TINYINT NOT NULL COMMENT '节次号（1-12）',
  periodName VARCHAR(20) COMMENT '节次名称（如：第1节）',
  startTime VARCHAR(10) NOT NULL COMMENT '开始时间 HH:MM',
  endTime VARCHAR(10) NOT NULL COMMENT '结束时间 HH:MM',
  UNIQUE KEY uq_period (periodNo)
) COMMENT '节次时间对照表';

-- 插入默认节次（根据学校作息调整）
INSERT INTO period_time_mapping (periodNo, periodName, startTime, endTime) VALUES
(1, '第1节', '08:00', '08:45'),
(2, '第2节', '08:55', '09:40'),
(3, '第3节', '10:00', '10:45'),
(4, '第4节', '10:55', '11:40'),
(5, '第5节', '14:00', '14:45'),
(6, '第6节', '14:55', '15:40'),
(7, '第7节', '16:00', '16:45'),
(8, '第8节', '16:55', '17:40'),
(9, '第9节', '19:00', '19:45'),
(10, '第10节', '19:55', '20:40'),
(11, '第11节', '20:50', '21:35'),
(12, '第12节', '21:45', '22:30');
```

### 3.2 现有表关联

```sql
-- 预约记录关联课程（已有注释的字段，启用）
ALTER TABLE lab_reservations ADD COLUMN courseId INT COMMENT '课程ID（教学预约）';
ALTER TABLE lab_reservations ADD COLUMN reservationType ENUM('personal', 'course', 'research') DEFAULT 'personal' COMMENT '预约类型';
ALTER TABLE lab_reservations ADD COLUMN groupId INT COMMENT '项目组ID（科研预约）';

-- 添加索引
ALTER TABLE lab_reservations ADD INDEX idx_reservations_course (courseId);
ALTER TABLE lab_reservations ADD INDEX idx_reservations_type (reservationType);
```

---

## 四、功能模块设计

### 4.1 教师端功能

```
┌─────────────────────────────────────────────────────────┐
│                    教师工作台                            │
├─────────────────────────────────────────────────────────┤
│  📚 我的课程                                             │
│    ├── 创建课程                                         │
│    ├── 导入学生名单（Excel/手动）                        │
│    ├── 课程安排（预约实验室时段）                        │
│    └── 课程列表                                         │
│                                                         │
│  📅 实验安排                                             │
│    ├── 本周课表                                         │
│    ├── 预约实验室（单次/批量）                          │
│    └── 查看预约状态                                     │
│                                                         │
│  ✅ 课堂签到                                             │
│    ├── 开启签到（二维码/地理围栏）                       │
│    ├── 实时查看签到情况                                 │
│    ├── 手动补签/请假标记                                │
│    └── 关闭签到                                         │
│                                                         │
│  📊 统计报表                                             │
│    ├── 出勤统计（按课程/学生）                          │
│    ├── 实验室使用统计                                   │
│    └── 导出报表                                         │
│                                                         │
│  🔬 项目组管理（可选）                                   │
│    ├── 创建项目组                                       │
│    ├── 管理成员                                         │
│    └── 预约科研时段                                     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 学生端功能

```
┌─────────────────────────────────────────────────────────┐
│                    学生工作台                            │
├─────────────────────────────────────────────────────────┤
│  📚 我的课程                                             │
│    ├── 课程列表（已加入的课程）                          │
│    ├── 课程安排（实验时间表）                           │
│    └── 出勤记录                                         │
│                                                         │
│  ✅ 签到                                                 │
│    ├── 当前可签到课程                                   │
│    ├── 扫码签到                                         │
│    └── 位置签到                                         │
│                                                         │
│  📅 开放预约                                             │
│    ├── 可预约时段（开放实验室）                          │
│    ├── 我的预约                                         │
│    └── 预约记录                                         │
│                                                         │
│  🔬 我的项目组（可选）                                   │
│    └── 项目组信息与使用记录                             │
└─────────────────────────────────────────────────────────┘
```

### 4.3 实验室管理员端功能

```
┌─────────────────────────────────────────────────────────┐
│                  实验室管理员工作台                       │
├─────────────────────────────────────────────────────────┤
│  📋 预约审批                                             │
│    ├── 待审批列表（教学预约优先显示）                     │
│    ├── 冲突检测与提示                                   │
│    └── 批量审批                                         │
│                                                         │
│  📅 排课管理                                             │
│    ├── 实验室课表视图                                   │
│    ├── 时段类型配置（教学/开放/维护）                    │
│    └── 学期排课导入                                     │
│                                                         │
│  📊 使用统计                                             │
│    ├── 实验室利用率                                     │
│    ├── 教学课时统计                                     │
│    └── 开放预约统计                                     │
│                                                         │
│  ⚙️ 实验室配置                                           │
│    ├── 开放时段设置                                     │
│    ├── 预约规则配置                                     │
│    └── 地理围栏配置                                     │
└─────────────────────────────────────────────────────────┘
```
## 教师主导模式 - 完整逻辑链条

### 📊 数据模型层

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ semester_configs│     │period_time_mapping│   │   courses       │
│ ─────────────── │     │ ────────────────  │   │ ─────────────── │
│ id              │     │ periodNo (1-12)  │   │ id              │
│ name            │     │ startTime        │   │ name            │
│ startDate ──────┼──┐  │ endTime          │   │ teacherId       │
│ weekCount       │  │  │ label            │   │ semester        │
│ isCurrent       │  │  └─────────────────┘   │ weekCount       │
└─────────────────┘  │                         └────────┬────────┘
                     │                                  │
                     ▼                                  ▼
              ┌──────────────────────────────────────────────┐
              │              course_schedules                 │
              │ ───────────────────────────────────────────── │
              │ courseId → labId → dayOfWeek → period范围     │
              │ weekStart/weekEnd → weekType(all/odd/even)    │
              └──────────────────────────────────────────────┘
                                    │
                                    ▼
              ┌──────────────────────────────────────────────┐
              │              checkin_sessions                 │
              │ ───────────────────────────────────────────── │
              │ courseId → labId → sessionDate → weekNo       │
              │ qrcodeToken → status(active/closed)           │
              └──────────────────────────────────────────────┘
                                    │
                                    ▼
              ┌──────────────────────────────────────────────┐
              │              course_attendances               │
              │ ───────────────────────────────────────────── │
              │ sessionId → studentId → status                │
              │ checkinTime → checkinMethod → location        │
              └──────────────────────────────────────────────┘
```

---

### 🔄 完整业务流程

#### 阶段1：学期配置（管理员）
```
管理员 → 创建学期 → 设置开始日期 → 设为当前学期
         ↓
    系统自动计算"今天是第N周"
```

**API链条：**
- `classCheckin.createSemester` → `db.createSemester()`
- `classCheckin.setCurrentSemester` → `db.updateSemester()`
- `classCheckin.getCurrentWeek` → `db.calculateCurrentWeek()`

---

#### 阶段2：课程与排课（教师）
```
教师 → 创建课程 → 添加学生 → 设置排课
                              ↓
                    选择：星期几 + 第几节 + 实验室 + 周次范围
                              ↓
                    系统检测冲突 → 保存排课
```

**API链条：**
- `course.create` → `db.createCourse()`
- `course.addStudent` → `db.addCourseStudent()`
- `classCheckin.addSchedule` → `db.checkScheduleConflict()` → `db.addCourseSchedule()`

**前端入口：**
- 菜单"课程管理" → 课程卡片 → "课程排课"按钮 → 排课Dialog

---

#### 阶段3：课堂签到（教师开启）
```
教师 → 选择课程 → 开启签到
                    ↓
         选择实验室、周次、迟到阈值、是否地理围栏
                    ↓
              创建签到会话
                    ↓
         ┌─────────────────────────────┐
         │  生成二维码Token            │
         │  初始化全体学生出勤=缺勤    │
         │  显示实时二维码（自动刷新） │
         └─────────────────────────────┘
```

**API链条：**
- `classCheckin.startSession` → `db.createCheckinSession()` + `db.initCourseAttendances()`
- `classCheckin.refreshQrcode` → `db.updateCheckinSession()`
- `classCheckin.getSessionDetail` → `db.getSessionAttendances()`

**前端入口：**
- 菜单"课堂签到" → 选择课程 → "开启签到"按钮

---

#### 阶段4：学生签到
```
学生 → 打开签到页面 → 查看当前可签到课程
                         ↓
              ┌──────────┴──────────┐
              ▼                     ▼
         位置签到               扫码签到
              │                     │
              ▼                     ▼
    获取GPS坐标              扫描二维码获取Token
              │                     │
              ▼                     ▼
    验证地理围栏            验证Token有效性
              │                     │
              └──────────┬──────────┘
                         ▼
                计算是否迟到（对比开始时间）
                         ▼
                更新出勤状态: present/late
```

**API链条：**
- `classCheckin.getActiveCheckins` → `db.getStudentActiveCheckins()`
- `classCheckin.studentGeofenceCheckin` → 验证围栏 → `db.studentCheckin()`
- `classCheckin.studentCheckin` → 验证Token → `db.studentCheckin()`

**前端入口：**
- 菜单"课堂签到"（学生版）→ 点击"位置签到"按钮

---

#### 阶段5：教师管理出勤
```
教师 → 查看实时出勤列表
         ↓
    ┌────┴────┐
    ▼         ▼
 自动统计   手动调整
 出勤人数   个别状态
    │         │
    ▼         ▼
 present    → leave（请假）
 late       → absent（缺勤）
 absent     → present（补签）
```

**API链条：**
- `classCheckin.getSessionDetail` → `db.getSessionAttendances()`
- `classCheckin.updateAttendance` → `db.updateAttendanceStatus()`
- `classCheckin.closeSession` → `db.closeCheckinSession()`

---

#### 阶段6：出勤统计与历史
```
教师 → 查看课程出勤统计
         ↓
    ┌────┴────┐
    ▼         ▼
 签到历史   出勤率统计
    │         │
    ▼         ▼
 按日期查看  按学生统计
 各次签到    出勤/迟到/缺勤
```

**API链条：**
- `classCheckin.getHistory` → `db.getTeacherCheckinHistory()`
- `classCheckin.getCourseStats` → `db.getCourseAttendanceStats()`

---

#### 阶段7：学生查看记录
```
学生 → 选择课程 → 查看我的出勤记录
                    ↓
           显示每次签到状态
           统计出勤率
```

**API链条：**
- `classCheckin.getMyAttendance` → `db.getStudentCourseAttendances()`

---

### 🖥️ 前端页面入口汇总

| 角色 | 菜单项 | 路由 | 页面 | 功能 |
|------|--------|------|------|------|
| 教师 | 课程管理 | `/courses` | CourseManage.tsx | 课程CRUD、学生管理、**排课** |
| 教师 | 课堂签到 | `/class-checkin` | ClassCheckin.tsx | 开启签到、管理出勤、历史 |
| 学生 | 我的课程 | `/student/courses` | StudentCourses.tsx | 查看已选课程 |
| 学生 | 课堂签到 | `/student/checkin` | StudentCheckin.tsx | 签到、查看出勤记录 |
| 管理员 | （API） | - | - | 学期配置管理 |

---

### ✅ 已实现功能清单

| 功能模块 | 数据库 | 后端API | 前端UI | 状态 |
|---------|--------|---------|--------|------|
| 节次时间映射 | ✅ | ✅ `getPeriods` | ✅ 排课选择 | ✅ |
| 学期配置 | ✅ | ✅ CRUD | ⚠️ 仅API | 部分 |
| 课程排课 | ✅ | ✅ 冲突检测 | ✅ 课程管理内 | ✅ |
| 签到会话 | ✅ | ✅ 完整 | ✅ 完整 | ✅ |
| 二维码刷新 | ✅ | ✅ 自动刷新 | ✅ 实时显示 | ✅ |
| 位置签到 | ✅ | ✅ 围栏验证 | ✅ 按钮 | ✅ |
| 扫码签到 | ✅ | ✅ Token验证 | ⚠️ 需扫码器 | 部分 |
| 出勤管理 | ✅ | ✅ 手动调整 | ✅ 下拉选择 | ✅ |
| 出勤统计 | ✅ | ✅ `getCourseStats` | ✅ 页面内 | ✅ |
| 学生记录 | ✅ | ✅ 完整 | ✅ 完整 | ✅ |

---

### ⚠️ 待优化项

1. **学期配置管理界面** - 管理员需要通过API或数据库直接操作
2. **扫码签到入口** - 学生需要用手机扫码，Web端只有位置签到

---

## 五、关键业务流程

### 5.1 教师批量预约流程

```
教师创建课程安排
        ↓
选择：实验室 + 时间（每周X 第Y-Z节 × N周）
        ↓
系统检测时段冲突
        ↓
   ┌────┴────┐
   │冲突？    │
   └────┬────┘
        │
   有冲突 → 显示冲突详情 → 调整时间/申请特批
        │
   无冲突 → 提交审批
        ↓
实验室管理员审批
        ↓
   批准 → 自动生成N条预约记录
        │
        → 通知学生课程安排
        │
        → 写入实验室课表
```

### 5.2 课堂签到流程

```
教师端                         学生端
   │                              │
   ├─ 开启签到                     │
   │    ├─ 选择签到方式            │
   │    │   ├─ 二维码（定时刷新）   │
   │    │   ├─ 地理围栏            │
   │    │   └─ 二者结合            │
   │    │                         │
   │    └─ 设置迟到时间阈值        │
   │                              │
   ├─ 投屏显示二维码 ─────────────→├─ 看到签到入口
   │                              │
   │  ← 实时更新签到人数 ─────────├─ 扫码/位置签到
   │                              │
   │    签到状态：                 │    签到结果：
   │    ├─ 已签到 ✓ (45人)        │    ├─ 签到成功
   │    ├─ 迟到 ⏰ (3人)          │    ├─ 迟到
   │    └─ 未签到 ✗ (2人)         │    └─ 位置不在范围内
   │                              │
   ├─ 手动处理                     │
   │    ├─ 补签到                  │
   │    └─ 标记请假                │
   │                              │
   └─ 关闭签到                     │
        ↓
   自动记录到 course_attendances
```

### 5.3 时段冲突处理

```
时段优先级（高→低）：
1. 教学预约（课程安排）
2. 科研预约（项目组固定时段）
3. 开放预约（学生个人）
4. 临时维护

冲突检测规则：
- 教学预约之间不能冲突
- 开放预约需避开教学时段
- 维护时段覆盖所有预约
```

---

## 六、实施建议

### 6.1 分阶段实施

| 阶段 | 内容 | 工期 |
|------|------|------|
| **Phase 1** | 课程管理 + 批量预约 + 学生名单导入 | 2周 |
| **Phase 2** | 课堂签到（二维码+地理围栏） | 1周 |
| **Phase 3** | 出勤统计 + 报表导出 | 1周 |
| **Phase 4** | 项目组管理（可选） | 1周 |

### 6.2 与现有系统兼容

- **保留现有开放预约模式**：学生仍可在开放时段自主预约
- **渐进式迁移**：新模式与旧模式并行，不影响现有功能
- **数据复用**：复用现有用户、实验室、签到等基础设施

### 6.3 配置灵活性

- 每个实验室可独立配置：纯教学 / 纯开放 / 混合模式
- 节次时间表可按学校实际情况调整
- 签到规则可按课程/实验室配置

---

## 七、总结

本方案将实验室预约系统从"学生自主预约"扩展为"教师主导 + 学生自主"双模式：

| 维度 | 现有模式 | 教师主导模式 |
|------|----------|--------------|
| 预约主体 | 学生 | 教师/导师 |
| 适用场景 | 开放实验 | 教学实验、科研 |
| 时段管理 | 按时间段 | 按节次/周次 |
| 签到方式 | 个人签到 | 班级批量签到 |
| 统计维度 | 个人使用 | 课程出勤率 |

这种设计更符合国内高校实验室的实际使用场景，支持：
- ✅ 教学班统一安排
- ✅ 整学期批量预约
- ✅ 课堂二维码/位置签到
- ✅ 出勤率统计
- ✅ 与现有开放预约兼容