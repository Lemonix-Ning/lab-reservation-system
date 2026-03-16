# 项目目录结构地图

## ASCII Tree（完整结构）

```
lab-reservation-system/
│
├── .ai/                              # AI 上下文体系
│   └── context/
│       ├── ARCHITECTURE.md           # 架构与设计规范
│       ├── CURRENT_STATE.md          # 项目当前状态与进度
│       ├── PROJECT_MAP.md            # 本文件 - 目录结构地图
│       └── AI_RULES.md               # AI 编码助手指令
│
├── client/                           # 前端应用（React 19 + Vite）
│   ├── index.html                    # HTML 入口
│   ├── public/                       # 静态资源
│   └── src/
│       ├── App.tsx                   # 应用根组件（31 条路由）
│       ├── main.tsx                  # 应用入口（React 渲染）
│       ├── index.css                 # 全局样式（Tailwind 导入）
│       ├── const.ts                  # 前端常量
│       │
│       ├── _core/                    # 核心抽象层
│       │   └── hooks/
│       │       └── useAuth.ts        # 认证状态管理 Hook
│       │
│       ├── components/               # UI 组件库
│       │   ├── AIChatBox.tsx         # AI 聊天框（讯飞星火集成）
│       │   ├── Calendar.tsx          # 日历组件
│       │   ├── DashboardLayout.tsx   # 管理后台布局（动态菜单过滤）
│       │   ├── DashboardLayoutSkeleton.tsx  # 布局骨架屏
│       │   ├── ErrorBoundary.tsx     # 错误边界
│       │   ├── ManusDialog.tsx       # Manus 对话框
│       │   ├── NotificationBell.tsx  # 通知铃铛（未读数量）
│       │   ├── ScheduleImport.tsx    # ⭐ 排课 Excel 导入（10 列模板）
│       │   └── ui/                   # shadcn/ui 基础组件（40+）
│       │
│       ├── contexts/                 # React Context（全局状态）
│       │   ├── RoleContext.tsx        # 用户角色上下文
│       │   ├── PermissionContext.tsx  # ⭐ 动态权限上下文
│       │   └── ThemeContext.tsx       # 主题上下文
│       │
│       ├── hooks/                    # 自定义 Hooks
│       │   ├── useComposition.ts     # 输入法组合事件处理
│       │   ├── useMobile.tsx         # 移动端检测
│       │   ├── usePersistFn.ts       # 函数引用持久化
│       │   └── useReservationRules.ts # 预约规则检查 Hook
│       │
│       ├── lib/                      # 工具函数库
│       │   ├── export.ts             # 数据导出（HTML/iCalendar/PDF）
│       │   ├── trpc.ts               # tRPC 客户端配置
│       │   └── utils.ts              # 通用工具函数（cn, clsx）
│       │
│       └── pages/                    # 页面组件（33 个）
│           │
│           │ # 普通用户页面
│           ├── Home.tsx              # 首页
│           ├── Login.tsx             # 登录页
│           ├── LabRoomList.tsx       # 实验室列表（预约入口，~497 行）
│           ├── MyReservations.tsx    # 我的预约
│           ├── CalendarDashboard.tsx # ⭐ 日历调度（~1069 行，核心页面）
│           ├── ScheduleBoard.tsx     # ⭐ 课表看板（451 行，周视图+节次网格）
│           ├── NotificationCenter.tsx # 通知中心
│           │
│           │ # 教师/课程页面
│           ├── CourseManage.tsx      # 课程管理（教师）
│           ├── StudentCourses.tsx    # 学生课程视图（我的课表+选课）
│           ├── ClassCheckin.tsx      # 教师发起签到
│           ├── StudentCheckin.tsx    # 学生签到
│           ├── CheckinScan.tsx       # 签到扫码
│           │
│           │ # 账户页面
│           ├── AccountProfile.tsx    # 个人资料
│           ├── AccountBindings.tsx   # OAuth 绑定管理
│           ├── AccountDelete.tsx     # 账号删除
│           ├── RoleUpgradeRequest.tsx # 角色升级申请
│           ├── OAuthDebug.tsx        # OAuth 调试（仅 DEV）
│           │
│           │ # 管理后台页面（/admin/*）
│           ├── LabRoomManage.tsx     # 实验室管理
│           ├── DeviceManage.tsx      # 设备管理
│           ├── ReservationManage.tsx # 预约审核
│           ├── RuleManage.tsx        # 规则配置
│           ├── StatisticsDashboard.tsx # 统计仪表板
│           ├── ApprovalConfig.tsx    # 审批配置
│           ├── ViolationManage.tsx   # 违约管理
│           ├── AuditLog.tsx          # 审计日志
│           ├── OpeningRuleManage.tsx # 开放规则
│           ├── BlockedPeriodManage.tsx # 禁用时段
│           ├── GeofenceManage.tsx    # 地理围栏管理
│           ├── SystemSettings.tsx    # 系统设置
│           ├── PermissionManage.tsx  # 权限管理
│           ├── RoleRequestReview.tsx # 角色申请审核
│           ├── WhitelistManage.tsx   # 白名单管理
│           └── NotFound.tsx          # 404 页面
│
├── server/                           # 后端应用（Node + Express + tRPC）
│   ├── routers.ts                    # ⭐ tRPC API 路由（80+ 端点，~3370 行）
│   ├── db.ts                         # ⭐ 数据访问层（~4191 行）
│   ├── db-3l.ts                      # ⭐ 3L 推荐算法（178 行，暂未启用）
│   ├── storage.ts                    # 文件存储
│   │
│   ├── _core/                        # 核心基础设施
│   │   ├── index.ts                  # 服务器入口（Express + tRPC + Vite）
│   │   ├── trpc.ts                   # tRPC 中间件（protected/admin/permission）
│   │   ├── context.ts                # tRPC Context 构建
│   │   ├── oauth.ts                  # OAuth 认证流程
│   │   ├── cookies.ts                # Cookie 管理
│   │   ├── xfspark.ts                # 讯飞星火 AI 集成
│   │   ├── env.ts                    # 环境变量加载
│   │   ├── vite.ts                   # Vite 开发服务器集成
│   │   ├── systemRouter.ts           # 系统路由（健康检查）
│   │   ├── dataApi.ts                # 外部数据 API
│   │   ├── sdk.ts                    # 第三方 SDK
│   │   ├── map.ts                    # 地图服务
│   │   ├── notification.ts           # 通知推送
│   │   └── types/                    # 类型定义
│   │
│   └── *.test.ts                     # 单元测试（7 个文件）
│       ├── alternative-slots.test.ts
│       ├── approval.test.ts
│       ├── calendar-update.test.ts
│       ├── course.test.ts
│       ├── device.test.ts
│       ├── oauth-providers.test.ts
│       └── statistics.test.ts
│
├── shared/                           # 共享代码（前后端通用）
│   ├── types.ts                      # 共享类型定义
│   ├── const.ts                      # 全局常量
│   └── _core/
│       └── errors.ts                 # 错误类型定义
│
├── drizzle/                          # 数据库 ORM 层
│   ├── schema.ts                     # 表结构定义（~625 行，18+ 表）
│   ├── relations.ts                  # 表关系定义
│   ├── 0000~0015_*.sql               # 迁移文件（16 个）
│   └── meta/                         # 迁移元数据
│
├── scripts/                          # 脚本工具（13 个）
│   ├── seed.ts                       # ⭐ 演示数据播种（466 行，pnpm seed:demo）
│   ├── demo-check.ts                 # ⭐ Demo 健康检查（227 行，30 项检查）
│   ├── mock-oauth.ts                 # OAuth Mock 服务器
│   ├── run-sql.ts                    # SQL 迁移执行
│   ├── archive-reservations.ts       # 预约归档
│   ├── check-permissions.ts          # 权限检查
│   ├── create-dev-accounts.ts        # 开发账号创建
│   ├── create-test-checkin.ts        # 签到测试数据
│   ├── quick-test.ts                 # 快速测试
│   ├── test-account-deletion.ts      # 账号删除测试
│   ├── test-role-logic.ts            # 角色逻辑测试
│   ├── test-role-management.ts       # 角色管理测试
│   └── verify-backend.ts             # 后端验证
│
├── docs/                             # 项目文档
│   ├── README.md                     # 文档导航入口
│   ├── PLAN_DOCS.md                  # 计划文档汇总
│   ├── ACCOUNT_DELETION.md           # 账号注销说明
│   ├── DB_OPTIMIZATION.md            # 数据库优化
│   ├── DB_SCHEMA.md                  # 数据库结构
│   ├── OAUTH_SETUP.md                # OAuth 配置
│   └── teacher.md                    # 教师模式历史设计稿

├── DEPLOYMENT_GUIDE.md               # 上线与运维执行手册
├── COMPETITION_PLAN.md               # 竞赛计划（含历史信息）
│
├── package.json                      # pnpm 依赖配置
├── tsconfig.json                     # TypeScript 配置（strict mode）
├── vite.config.ts                    # Vite 构建配置
├── vitest.config.ts                  # Vitest 测试配置
├── drizzle.config.ts                 # Drizzle ORM 配置
└── components.json                   # shadcn/ui 配置
```

---

## 核心目录职责说明

### 📁 `client/src/pages/` - 页面组件（33 个）

**路由结构**（参考 App.tsx）：

| 路由 | 组件 | 说明 |
|------|------|------|
| `/` | Home | 首页 |
| `/login` | Login | 登录（无 Layout） |
| `/labs` | LabRoomList | 实验室列表与预约 |
| `/my-reservations` | MyReservations | 我的预约 |
| `/notifications` | NotificationCenter | 通知中心 |
| `/calendar` | CalendarDashboard | 日历调度（核心） |
| `/schedule-board` | ScheduleBoard | 课表看板 |
| `/courses` | CourseManage | 课程管理（教师） |
| `/student/courses` | StudentCourses | 学生课表 |
| `/class-checkin` | ClassCheckin | 教师签到 |
| `/student/checkin` | StudentCheckin | 学生签到 |
| `/checkin` | CheckinScan | 扫码签到（无 Layout） |
| `/account/*` | Account* | 账户管理（4 页） |
| `/admin/*` | *Manage | 管理后台（13 页） |

---

### 📁 `server/` - 后端核心文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `routers.ts` | ~3370 | tRPC API 路由，80+ 端点 |
| `db.ts` | ~4191 | 数据访问层，所有 SQL 查询 |
| `db-3l.ts` | 178 | 3L 推荐算法（Lab-Load-Like，暂未启用） |
| `storage.ts` | - | 文件存储 |

**db.ts 核心函数**:
```
checkReservationRules()         预约规则验证
getConflictingReservations()    冲突检测
getAlternativeTimeSlots()       智能替代方案推荐
getAllApprovedSchedules()        获取排课数据
getPeriodTimeMapping()          节次时间映射
createAuditLog()                审计日志
calculateViolationPoints()      违约积分
hasPermission()                 动态权限检查
ALL_PERMISSIONS                 14 项权限代码定义
```

**db-3l.ts**（暂未启用）:
```
getLabRecommendations()         三维度推荐评分
  - Lab 适配度 (40%) — 容量 + 课程关联
  - Load 负载 (35%) — 7 日预约密度
  - Like 偏好 (25%) — 用户历史
```

---

### 📁 `scripts/` - 关键脚本

| 脚本 | 命令 | 说明 |
|------|------|------|
| `seed.ts` | `pnpm seed:demo` | 演示数据播种（25 用户 + 5 实验室 + 8 课程 + 51 排课） |
| `demo-check.ts` | `npx tsx scripts/demo-check.ts` | 30 项健康检查 |
| `mock-oauth.ts` | `pnpm mock:oauth` | Mock OAuth 服务器（:4000） |
| `archive-reservations.ts` | `pnpm db:archive` | 预约归档 |

---

### 📁 `drizzle/` - ORM 与迁移

- `schema.ts`（~625 行）— 18+ 表定义
- `relations.ts` — 表关系
- 迁移文件 0000~0015（16 个 SQL 文件）

**关键表**:
```
users, lab_rooms, lab_devices, lab_reservations,
lab_reserve_rules, courses, course_students, course_schedules,
semester_configs, notifications, approval_histories,
violations, blacklist, audit_logs, role_permissions,
user_oauth_bindings, lab_geofences, lab_reservations_archive
```

**注意**: `semester_configs.startDate/endDate` 使用 `date("...", { mode: "date" })`（非 timestamp）

---

## 关键数据流

### 预约创建流程
```
用户选择实验室+时段 → trpc.reservation.create.useMutation()
  → routers.ts: reservation.create
  → db.ts: checkReservationRules() + getConflictingReservations()
  → drizzle: labReservations 插入
  → React Query 缓存刷新 → UI 更新
```

### 排课数据流
```
Excel 上传 → ScheduleImport.tsx 解析
  → trpc.course.batchImportSchedules.useMutation()
  → routers.ts: 批量插入 course_schedules
  → ScheduleBoard.tsx: getAllApprovedSchedules → 周视图渲染
```

### 3L 推荐流程（暂未启用）
```
用户进入实验室列表 → 切换智能模式
  → trpc.labRoom.recommend.useQuery()
  → routers.ts → db-3l.ts: getLabRecommendations()
  → 三维度评分 → 排序展示
```

---

**最后更新**: 2026-03-16  
**文档版本**: v1.3.1
