# 项目当前状态与进度

## 项目状态概览

**当前版本**: 1.3.1  
**最后更新**: 2026-03-16  
**测试状态**: 本地质量门通过（check/test/build）；Demo 健康检查 30/30 通过  
**核心功能完成度**: P0 + P1 + P2 已完成；竞赛演示就绪；3L 推荐算法已实现但暂未启用  
**运行端口**: 后端默认 :3000（占用时自动顺延）, 前端分离模式 :5173

---

## Todo List（待办事项）

### ✅ P2 模块 - 已完成

#### ✅ P2-1: 日历与可视化调度
- [x] 日/周/月视图切换
- [x] 多维度资源调度（实验室/设备/课程）
- [x] 实时冲突检测与批量展示
- [x] 智能替代方案推荐（最多 5 个，置信度排序）
- [x] 月度利用率热力图
- [x] 数据导出（HTML / iCalendar / PDF）
- [x] React Query 缓存优化（分层缓存策略）

#### ✅ P2-2: 教师模式与课堂签到
- [x] 教师课程管理（创建/编辑/删除课程）
- [x] 课程排课申请（周期性排课）
- [x] 课堂签到系统（二维码 + 地理围栏）
- [x] 学生签到（扫码/定位签到）

#### ✅ P2-3: 动态权限管理
- [x] 14 项权限代码定义
- [x] createPermissionProcedure() 工厂函数
- [x] PermissionManage.tsx 权限管理页面
- [x] 前端动态菜单过滤（PermissionContext）

#### ✅ P2-4: 课程排课系统（2026-02 新增）
- [x] 演示数据播种脚本（`pnpm seed:demo` → scripts/seed.ts，466 行）
- [x] 课表看板页面（ScheduleBoard.tsx，451 行 — 周视图 + 节次网格）
- [x] Excel 批量导入排课（ScheduleImport.tsx — 10 列模板含教师/课程名称）
- [x] 学生课表视图（StudentCourses.tsx — 我的课表 + 选课）
- [x] 教师名称显示（卡片 + 图例）
- [x] 实验室筛选（前端 allSchedules 过滤）

#### ✅ 3L 智能推荐算法（已实现，暂未启用）
- [x] 三维度评分：Lab 适配度 40% + Load 负载 35% + Like 偏好 25%
- [x] 后端函数：`getLabRecommendations()` in `server/db-3l.ts`（178 行）
- [x] API 路由：`labRoom.recommend`（已注释，标记 `// [3L]`）
- [x] 前端 UI：智能模式切换、算法说明面板、三柱评分、排名徽章（已注释）
- **恢复方式**: 取消 routers.ts 和 LabRoomList.tsx 中 `// [3L]` 注释，import db-3l.ts

---

### 🎯 P3 模块 - 规划中

#### 📋 P3-1: 多 OAuth 登录支持（待开始）
- [ ] user_oauth_bindings 表已创建，需实现登录逻辑
- [ ] QQ / GitHub / 学校统一认证接入
- [ ] 账号绑定/解绑页面

### 📋 P3-2: Docker 容器化部署（准备中）
- [x] Dockerfile + docker-compose.yml 已就绪（仓库内）
- [ ] ECS 服务器安装 Docker / 拉取项目 / 首次部署
- [ ] CI/CD 集成

---

### 🔧 技术债务
- [ ] 审计日志 `targetId` 后端过滤
- [ ] 预约规则缓存
- [ ] N+1 查询优化
- [ ] 代码分割（按路由拆分 bundle）

---

## Recent Changes（最近变更）

### 2026-03-16: 域名健康恢复阶段（线上）

**目标**: 解除 `lemonix.loc.cc` suspended，先恢复健康检查通过。

**已确认状态**:
- DNS A 记录可解析到 `8.218.143.37`
- `http://lemonix.loc.cc` 返回 `200 OK`（系统 nginx 占位页）
- 服务器当前仅监听 80，443 未监听
- ECS 尚未安装 Docker，仓库目录尚未部署到服务器

**当前策略**:
- 保持 ECS 持续运行，保证 HTTP 持续可访问
- 暂不切 HTTPS 强制跳转（避免 443 未通导致健康检查失败）
- 等待下一轮域名健康扫描恢复

**后续动作（恢复后）**:
- 在 ECS 安装 Docker + docker compose plugin
- 部署仓库并执行 `init-ssl.sh` 完成 HTTPS 与正式服务切换

### 2026-02-28: 课程排课系统 & 竞赛演示就绪

**排课系统**:
- 种子数据: `scripts/seed.ts`（466 行）— safeCreate 幂等 + semester upsert
  - 25 用户（1 sysAdmin + 1 labAdmin + 3 teacher + 20 student）
  - 5 实验室（A101, A203, B105, B208, C301）
  - 8 课程 + 51 条已审批排课记录
  - 学期: 2025-2026-2, startDate: 2026-02-23, weekCount: 20
- 课表看板: `ScheduleBoard.tsx`（451 行）— 周视图 + 节次网格 + 实验室筛选 + 教师名称
- Excel 导入: `ScheduleImport.tsx` — 10 列模板
- 学生课表: `StudentCourses.tsx` — 我的课表 + 选课

**Bug 修复**:
- `semester_configs`: `timestamp()` → `date("...", { mode: "date" })`
- `isCurrent = 0`: seed 改用 upsert 全字段更新
- ScheduleBoard 周计算: `useState` → `useEffect` 依赖 computedCurrentWeek
- 实验室筛选: allSchedules 前端过滤
- 排课去重: 105 → 51 条
- esbuild 块注释解析错误: 3L 代码提取到 db-3l.ts

**3L 算法**: 完整实现并验证 → 暂停启用 → 代码保留在 db-3l.ts  
**Demo 检查**: `scripts/demo-check.ts`（227 行）— 30/30 通过

---

### 2026-01-29: 动态权限管理系统
### 2026-01-28: 课堂签到系统
### 2026-01-27: 数据库 P0/P1 优化
### 2025-12-17: React NotFoundError 修复
### 2025-12-12: 替代方案规则修复 + 冲突筛选修复
### 2025-12-08: 课程管理与教学支持
### 2025-12-05: 数据库性能优化（76+ 索引，84% 提升）

---

## Risk Assessment

### ⚠️ 不稳定模块
1. **日历组件** - 中风险: Radix Dialog Portal 已修复（key + 单实例），ErrorBoundary 兜底
2. **讯飞星火 API** - 中风险: Mock 自动降级
3. **OAuth 认证** - 低风险: Cookie 策略已配置

### 🟢 稳定模块
- ✅ 用户认证与权限管理（动态权限系统）
- ✅ 实验室与设备管理
- ✅ 预约规则引擎
- ✅ 审批与违约管理（黑名单自动化）
- ✅ 课程排课系统（看板/导入/学生课表）
- ✅ 课堂签到系统（二维码 + 地理围栏）
- ✅ 统计分析
- ✅ 审计日志

---

## 部署状态

### 开发环境（当前）
- **后端**: `http://localhost:3000`（Express + tRPC + Vite 中间件，端口占用时自动顺延）
- **前端**: `http://localhost:5173`（Vite dev server，代理到后端）
- **数据库**: MySQL 本地（127.0.0.1:3306/lab_reservation_db）
- **OAuth**: Mock 模式（`pnpm mock:oauth` → :4000）

---

## 数据统计

### 测试覆盖
```
统计分析:       12/12 ✅    设备管理:       11/11 ✅
预约管理:        6/6  ✅    通知系统:        6/6  ✅
审批与违约:     16/16 ✅    课程管理:       18/18 ✅
OAuth 与权限:    5/5  ✅    Demo 健康检查:  30/30 ✅
─────────────────────────────────
总计:           104/104 ✅
```

### 代码统计
```
前端页面组件:        33 个
tRPC API 端点:       80+
routers.ts:          ~3370 行
db.ts:               ~4191 行
schema.ts:           ~625 行
测试文件:            7 个
脚本文件:            13 个
```

### 演示数据
```
用户: 25（1 sysAdmin + 1 labAdmin + 3 teacher + 20 student）
实验室: 5（A101, A203, B105, B208, C301）
课程: 8 门 | 排课: 51 条 | 学期: 2025-2026-2（20 周）
```

---

## 关键命令

```bash
pnpm dev              # 启动后端（默认 PORT 3000）
pnpm seed:demo        # 播种演示数据
pnpm mock:oauth       # Mock OAuth（PORT 4000）
pnpm check            # TypeScript 类型检查
pnpm test             # 运行 Vitest
pnpm db:push          # 生成 + 执行迁移
```

---

**最后更新**: 2026-03-16  
**文档版本**: v1.3.1
