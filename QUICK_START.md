# 快速启动指南（比赛演示版）

> 一键启动实验室预约管理系统，包含演示数据

## 🚀 方式1：Docker 一键启动（推荐）

### 前置要求
- Docker 20.10+
- Docker Compose 2.0+

### 启动步骤

1. **克隆项目**
```bash
git clone <your-repo-url>
cd lab-reservation-system
```

2. **配置环境变量（可选）**
```bash
# 如果需要GitHub OAuth，创建 .env 文件
cp .env.example .env
# 编辑 .env，填入你的 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET
```

3. **一键启动**
```bash
docker-compose -f docker-compose.demo.yml up -d
```

4. **等待初始化（约1-2分钟）**
```bash
# 查看启动日志
docker-compose -f docker-compose.demo.yml logs -f app

# 看到以下信息表示启动成功：
# ✅ Migrations complete!
# ✅ Demo data seeded!
# 🚀 Starting server on port 3000...
```

5. **访问系统**
```
http://localhost:3000
```

6. **使用演示账号登录**
- 系统管理员：`demo-admin`
- 实验室管理员：`demo-labadmin`
- 教师：`demo-teacher-001`
- 学生：`demo-student-001`

### 停止服务
```bash
docker-compose -f docker-compose.demo.yml down
```

### 清理数据（重新开始）
```bash
docker-compose -f docker-compose.demo.yml down -v
```

---

## 💻 方式2：本地开发模式

### 前置要求
- Node.js 20+
- pnpm 9+
- MySQL 8.0+

### 启动步骤

1. **安装依赖**
```bash
pnpm install
```

2. **配置数据库**
```bash
# 创建 .env 文件
cp .env.example .env

# 编辑 .env，配置数据库连接
# DATABASE_URL=mysql://user:password@localhost:3306/lab_reservation
```

3. **初始化数据库**
```bash
# 运行迁移
pnpm db:push

# 播种演示数据
pnpm seed:demo
```

4. **启动服务**
```bash
pnpm dev
```

5. **访问系统**
```
http://localhost:3000
```

---

## 📊 演示数据说明

系统自动创建以下演示数据：

### 用户（25个）
- 1个系统管理员
- 1个实验室管理员
- 3个教师
- 20个学生

### 实验室（5个）
- A101（计算机实验室，50人）
- A203（物理实验室，40人）
- B105（化学实验室，30人）
- B208（生物实验室，35人）
- C301（多媒体实验室，60人）

### 课程（8门）
- 数据结构
- 操作系统
- 计算机网络
- 数据库原理
- 软件工程
- 人工智能
- 机器学习
- Web开发

### 排课（51条）
- 已审批的课程排课记录
- 覆盖周一至周五
- 包含多个节次

### 学期配置
- 2025-2026学年第2学期
- 开始日期：2026-02-23
- 周数：20周

---

## 🎯 快速体验流程

### 1. 学生预约实验室
1. 使用 `demo-student-001` 登录
2. 进入"实验室列表"
3. 选择实验室和时间
4. 提交预约申请

### 2. 管理员审批
1. 使用 `demo-admin` 登录
2. 进入"预约管理"
3. 查看待审核预约
4. 批准或拒绝

### 3. 教师批量预约
1. 使用 `demo-teacher-001` 登录
2. 进入"课程管理"
3. 创建课程
4. 批量预约实验室

### 4. 查看统计
1. 使用 `demo-admin` 登录
2. 进入"统计分析"
3. 查看利用率、热门时段等

---

## 🔧 故障排查

### Docker启动失败
```bash
# 查看日志
docker-compose -f docker-compose.demo.yml logs

# 常见问题：
# 1. 端口被占用 → 修改 docker-compose.demo.yml 中的端口
# 2. 数据库连接失败 → 等待数据库健康检查完成
```

### 本地启动失败
```bash
# 检查数据库连接
pnpm db:push

# 检查环境变量
cat .env

# 查看详细错误
pnpm dev
```

---

## 📞 技术支持

如有问题，请查看：
- 完整文档：`docs/README.md`
- 部署指南：`DEPLOYMENT_GUIDE.md`
- 比赛路线图：`docs/COMPETITION_ROADMAP.md`

---

**最后更新**：2026-03-16
