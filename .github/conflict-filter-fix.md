# 冲突筛选功能修复说明

## 🔧 已修复的问题

### 1. API 层修复 (server/routers.ts)
**问题**：使用错误的字段名 `conflict.userId` 
**修复**：改为正确的 `conflict.applicantUserId`
**影响**：修复后能正确获取预约申请人信息

### 2. 数据库查询优化 (server/db.ts)
**问题**：
- 状态过滤逻辑不正确（同时应用默认条件和自定义条件）
- 时间范围过滤使用 `endTime` 而非 `startTime`

**修复**：
- 如果指定了 `status` 参数，只使用该状态；否则默认查询 pending + approved
- 时间过滤改为使用 `startTime` 字段，更符合预期

### 3. 添加详细日志
**后端日志**：
```
[Conflicts] Searching with filters: { ... }
[Conflicts] Found X reservations to check
[Conflicts] Result: Y conflicting reservations
[API] Found Y conflicting reservations
[API] Returning Y enriched conflicts
```

**前端日志**：
```
[Frontend] Using conflict data: X items
[Frontend] Converted conflict events: X
```

## 📊 数据库验证结果

根据 SQL 查询，当前数据库中有：
- ✅ **29 个预约**存在时间冲突
- ✅ **104 个冲突对**
- ✅ 分布：计算机实验室B (13个)、计算机实验室A (10个)、化学实验室 (6个)

## 🧪 测试步骤

### 1. 启动服务
```bash
# 终端 1 - 后端
pnpm dev

# 终端 2 - 前端
pnpm client:dev
```

### 2. 测试流程
1. 以**实验室管理员**身份登录
2. 进入**日历管理**页面
3. 点击左侧的 **"仅显示冲突"** 按钮（红色按钮）
4. 应该看到冲突预约列表

### 3. 预期结果
✅ 显示 29 个冲突预约的卡片列表  
✅ 每个卡片显示：
   - 标题和冲突数量徽章
   - 时间范围
   - 实验室名称
   - 申请人和人数
   - "处理冲突"按钮

✅ 左侧统计卡显示：**冲突预约 29**

### 4. 调试日志
打开浏览器开发者工具 (F12)，查看 Console：
- 应该看到 `[Frontend] Using conflict data: 29 items`
- 后端终端应该看到 `[Conflicts] Result: 29 conflicting reservations`

## 🔍 如果仍然显示"无冲突"

### 检查项 1：时间范围
当前查询范围是**当前月份**（2025-12-01 到 2025-12-31）  
如果冲突预约不在这个时间范围内，需要：
- 切换到包含冲突的月份
- 或修改时间范围筛选

### 检查项 2：实验室筛选
如果选择了特定实验室，只会显示该实验室的冲突  
建议：**不选择实验室**（显示全部）

### 检查项 3：状态筛选
如果设置了状态筛选（如"已拒绝"），会过滤掉冲突数据  
建议：选择 **"全部状态"**

### 检查项 4：权限验证
确认用户角色为 `labAdmin` 或 `sysAdmin`  
检查：`user?.role` 在控制台应显示正确角色

## 🎯 功能演示

### 场景 1：查看全部冲突
```
1. 不选择实验室
2. 状态选择"全部"
3. 点击"仅显示冲突"
→ 显示所有实验室的 29 个冲突预约
```

### 场景 2：查看特定实验室冲突
```
1. 选择"计算机实验室B"
2. 点击"仅显示冲突"
→ 只显示该实验室的 13 个冲突预约
```

### 场景 3：处理冲突
```
1. 点击冲突预约卡片
2. 查看冲突详情和替代方案
3. 使用"绕过规则"功能（管理员特权）
4. 解决时间冲突
```

## 📝 相关代码位置

- 后端 API: `server/routers.ts` line 1714-1750
- 数据库函数: `server/db.ts` line 271-333
- 前端组件: `client/src/pages/CalendarDashboard.tsx`
  - 冲突筛选按钮: line 474-488
  - 冲突列表显示: line 563-641
  - 数据处理逻辑: line 176-205

---

**修复日期**：2025-12-12  
**TypeScript 检查**：✅ 通过  
**预期影响**：管理员可正常使用冲突筛选功能查看和处理时间冲突
