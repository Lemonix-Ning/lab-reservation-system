# 高校实验室预约管理系统 - 演示视频脚本（10分钟）

##  系统全面分析与逻辑验证

### 系统核心架构
- **技术栈**: TypeScript全栈 + React 19 + tRPC + Drizzle ORM + MySQL
- **代码规模**: 3370行路由 + 4191行数据访问 + 33个页面组件
- **测试覆盖**: 104/104通过（100%）
- **数据库**: 25张表，76+索引，性能提升84%

### 两种预约方式（核心创新）

#### 方式1：教学预约（课程排课）
**数据流**:
`
教师创建课程  添加学生  批量排课（Excel导入/手动）
  
course_schedules表（周次+节次）
  
系统自动占用实验室时间
  
学生查看课表（无需预约） 课堂签到
`

**涉及表**: courses, course_students, course_schedules, semester_configs, checkin_sessions, course_attendances

**特点**: 学生无需操作，教师统一管理，支持周期性排课

#### 方式2：自由预约（个人预约）
**数据流**:
`
学生/教师选择实验室  填写预约信息
  
实时规则检查（lab_reserve_rules）
  
冲突检测（getConflictingReservations）
  
提交审批  管理员审核
  
lab_reservations表
  
日历页面查看替代方案（getAlternativeTimeSlots）
`

**涉及表**: lab_reservations, lab_reserve_rules, approval_configs, approval_histories

**特点**: 需要审批，支持冲突检测和替代方案推荐

### 完整功能模块（已验证）

####  核心功能（P0+P1）
1. **用户认证与权限**
   - GitHub OAuth登录（已实现）
   - 4种角色：student, teacher, labAdmin, sysAdmin
   - 14项动态权限配置
   - 白名单自动分配角色
   - 角色升级申请流程

2. **实验室管理**
   - 5个实验室（演示数据）
   - 设备管理（lab_devices表）
   - 开放规则配置（opening_rules表）
   - 禁用时段管理（blocked_periods表）
   - 地理围栏（lab_geofences表）

3. **预约管理**
   - 个人预约（lab_reservations）
   - 课程预约（course_reservations）
   - 规则引擎（lab_reserve_rules）
   - 审批流程（approval_configs + approval_histories）
   - 冲突检测（实时）
   - 改签功能

4. **课程排课系统**（P2-4）
   - 8门课程，51条排课记录
   - Excel批量导入（10列模板）
   - 周视图课表看板
   - 学生课表查看
   - 节次时间映射（period_time_mapping）
   - 学期配置（semester_configs）

5. **课堂签到系统**（P2-2）
   - 教师发起签到（checkin_sessions）
   - 二维码签到
   - 地理围栏签到
   - 学生签到记录（course_attendances）

####  高级功能（P2）
6. **日历可视化调度**（P2-1）
   - 日/周/月视图切换
   - 热力图（月度利用率）
   - 智能替代方案推荐（最多5个，置信度排序）
   - 数据导出（HTML/iCalendar/PDF）

7. **违约与黑名单管理**
   - 违约记录（violation_records）
   - 积分计算
   - 自动黑名单（blacklist表）
   - 限制期限管理

8. **统计分析**
   - 预约趋势分析
   - 实验室利用率
   - 违约率统计
   - 数据可视化（Recharts）

9. **审计日志**
   - 60+种操作类型
   - 完整追溯（audit_logs表）
   - IP地址记录
   - 操作详情

10. **AI辅助**
    - 讯飞星火集成
    - 预约理由润色
    - 数据洞察报告

11. **通知系统**
    - 站内通知（notifications表）
    - 未读数量提示
    - 多种通知类型

12. **动态权限管理**（P2-3）
    - 14项权限代码
    - 角色权限配置（role_permissions表）
    - 前端菜单动态过滤
    - createPermissionProcedure工厂函数

####  未启用功能
13. **3L推荐算法**（已实现，暂未启用）
    - Lab适配度40% + Load负载35% + Like偏好25%
    - 代码位置：server/db-3l.ts（178行）
    - 原因：无真实训练数据，容易被评委质疑

---

##  10分钟演示视频脚本

### 时间分配
- 0:00-0:45  震撼开场（问题背景）
- 0:45-1:30  系统概述（架构+价值）
- 1:30-3:00  技术亮点（提前展示）
- 3:00-6:30  核心功能演示（两种预约方式）
- 6:30-8:00  差异化功能
- 8:00-9:00  系统架构与创新总结
- 9:00-9:30  项目成果
- 9:30-10:00 结尾

---

### 【0:00-0:45】震撼开场

**画面**: 数据图表 + 实验室照片

**文案**:
