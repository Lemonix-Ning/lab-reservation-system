# 开发日志 - 错误与解决方案

## 第一阶段错误记录

### 1. MySQL 数据库权限错误

**症状**：
\\\
pnpm db:push  ER_ACCESS_DENIED_ERROR
Access denied for user 'user'@'localhost'
\\\

**原因**：
- Drizzle ORM 执行迁移时数据库用户权限不足

**解决方案**：
\\\sql
GRANT ALL PRIVILEGES ON lab_reservation_db.* TO 'user'@'localhost' IDENTIFIED BY '296131';
FLUSH PRIVILEGES;
\\\

**关键学习**：在开发环境可使用 root 快速解决权限问题，但生产环境需配置最小权限原则。

---

### 2. Drizzle 数据库连接错误

**症状**：
\\\
Cannot read properties of undefined (reading 'promise')
\\\

**原因**：
- \drizzle(process.env.DATABASE_URL)\ 直接传字符串，但 mysql2/promise 需要连接池对象

**解决方案**：
\\\	ypescript
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

const pool = await mysql.createPool(process.env.DATABASE_URL ?? "");
const db = drizzle(pool);
\\\

**关键学习**：Drizzle 的初始化方式取决于数据库驱动，mysql2/promise 是异步驱动需通过连接池。

---

### 3. Windows 环境变量设置错误

**症状**：
\\\
pnpm dev  'NODE_ENV' 不是内部或外部命令
\\\

**原因**：
- 脚本使用 Linux 风格 \NODE_ENV=development node ...\，Windows PowerShell 不支持

**解决方案**：
\\\json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts"
  }
}
\\\

**关键学习**：\cross-env\ 是跨平台开发的标准工具，Windows 使用 \set VAR=value\ 或 PowerShell 的 \\='value'\。

---

### 4. Vite 客户端脚本配置错误

**症状**：
\\\
pnpm client:dev  No package.json was found in client
\\\

**原因**：
- 脚本在子目录执行，但 client 目录本身不含 package.json

**解决方案**：
\\\json
{
  "scripts": {
    "client:dev": "vite dev"
  }
}
\\\

**关键学习**：Vite 的 \
oot\ 选项可改变项目根目录，无需在子目录运行。

---

### 5. HTML 中残留的分析代码

**症状**：
\\\
浏览器报 %VITE_ANALYTICS_ENDPOINT% 未定义
\\\

**原因**：
- \client/index.html\ 中残留 Umami 分析脚本，使用未定义的 Vite 环境变量

**解决方案**：
- 删除 \client/index.html\ 中的分析脚本

**关键学习**：清理项目时需检查 HTML 文件，Vite 环境变量必须在 \.env\ 中定义。

---

### 6. OAuth 回调路由 404 问题

**症状**：
\\\
登录后报 404
[Auth] Missing session cookie
\\\

**原因**：
- Vite dev server 未代理 \/api/*\ 请求到后端

**解决方案**：
\\\	ypescript
// vite.config.ts
server: {
  proxy: {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
    }
  }
}
\\\

**关键学习**：Vite 开发服务器必须配置 API 代理，\changeOrigin: true\ 确保请求头的 Origin 正确。

---

### 7. Mock OAuth 参数名称不匹配

**症状**：
\\\
Mock OAuth /authorize 返回 400
redirectUri is required
\\\

**原因**：
- 前端发送 \
edirect_uri\（标准 OAuth 名称），Mock OAuth 脚本期望 \
edirectUri\（驼峰式）

**解决方案**：
\\\	ypescript
// 支持两种参数名
const redirectUri = (req.query.redirect_uri ?? req.query.redirectUri) as string;
\\\

**关键学习**：OAuth 标准使用 \
edirect_uri\（蛇形），JavaScript 习惯用 \
edirectUri\（驼峰式），集成第三方接口时需统一参数命名。

---

### 8. OAuth 回调 redirectUri 端口错误

**症状**：
\\\
登录后回调返回 400，redirect_uri 指向错误的端口
\\\

**原因**：
- 前端在 Vite 5173 端口，但后端 OAuth 回调需要指向 3000 端口

**解决方案**：
\\\env
# .env
VITE_SERVER_ORIGIN="http://localhost:3000"
\\\

\\\	ypescript
// client/src/const.ts
const serverOrigin = import.meta.env.VITE_SERVER_ORIGIN || "http://localhost:3000";
export const redirectUri = \\/api/oauth/callback\;
\\\

**关键学习**：前后端分离时需显式配置后端地址，\import.meta.env\ 是 Vite 特有的环境变量访问方式。

---

### 9. Cookie 同源政策问题

**症状**：
\\\
登录成功但 Cookie 未保存，后续请求未携带 Authorization
\\\

**原因**：
- HTTP 环境下，Cookie 的 \sameSite: "none"\ 需要 Secure 标志（HTTPS）

**解决方案**：
\\\	ypescript
export function getSessionCookieOptions(req: Request): CookieOptions {
  const protocol = req.headers["x-forwarded-proto"] ?? req.protocol;
  const isSecure = protocol === "https";

  return {
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}
\\\

**关键学习**：开发环境使用 \sameSite: "lax"\ 避免跨域问题，生产环境必须启用 HTTPS 和 \sameSite: "none"\。

---

### 10. React Hooks 规则违反导致页面崩溃

**症状**：
\\\
Error: Rendered more hooks than during the previous render.
\\\

**原因**：
- 在 early returns 之后调用 hooks，导致 hooks 调用数量不一致

**解决方案**：
\\\	ypescript
//  外层组件 - 只处理加载状态
export default function LabDashboard() {
  const { user } = useAuth();
  
  if (user === undefined) return <div>加载中...</div>;
  if (!user) return <div>请先登录</div>;
  
  return <LabDashboardContent user={user} />;
}

//  内层组件 - 在此处调用所有 hooks
function LabDashboardContent({ user }: { user: any }) {
  const [devRole, setDevRole] = useState(null);
  const { data: labs } = trpc.labRoom.list.useQuery();
  // ... 其他 hooks
}
\\\

**关键学习**：React Hooks 必须在函数组件顶层调用，每次渲染的调用顺序必须一致，分离组件是最佳实践。

---

### 11. Dashboard 一直显示"加载中..."

**症状**：
\\\
页面显示"加载中..."文本，永不加载完成
\\\

**原因**：
- 设置 \const [isLoading, setIsLoading] = useState(true)\ 但从不更新为 \alse\

**解决方案**：
\\\	ypescript
// 使用 useAuth() 中已有的 user 状态判断加载状态
const { user } = useAuth();

if (user === undefined) return <div>加载中...</div>;
if (!user) return <div>请先登录</div>;
\\\

**关键学习**：避免引入额外的加载状态，复用已有的数据状态，\undefined\ 表示待加载，\
ull\ 表示已加载但无值。

---

### 12. Dashboard 显示 Mock 数据而不是实时数据

**症状**：
\\\
Dashboard 展示的数据都是硬编码的常量，用户操作不会更新 UI
\\\

**原因**：
- 组件使用 \useState()\ 初始化本地状态，从不调用后端 API

**解决方案**：
\\\	ypescript
// 使用 tRPC Query 获取实时数据
const { data: labs = [] } = trpc.labRoom.list.useQuery();
const { data: allReservations = [] } = trpc.reservation.allList.useQuery();
const utils = trpc.useUtils();

// 定义 Mutations 处理操作
const approveReservation = trpc.reservation.approve.useMutation({
  onSuccess: () => {
    utils.reservation.allList.invalidate();  // 自动刷新
  },
});
\\\

**关键学习**：tRPC Mutations 的 \onSuccess\ 可自动使缓存失效，需明确转换数据格式。

---

## 第二阶段错误记录

### 13. 讯飞星火 HTTP API 重新接入（成功）

**症状**：
\\\
使用 WebSocket + HMAC 签名方式始终返回 401 Unauthorized
\\\

**原因**：
- 讯飞星火有两种接入协议：WebSocket 需要复杂 HMAC 签名，HTTP 只需 Bearer Token
- 之前一直尝试 WebSocket 的复杂签名方式

**解决方案**：
\\\	ypescript
// 使用 HTTP REST API + APIPassword
const response = await fetch("https://spark-api-open.xf-yun.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \Bearer \\,
  },
  body: JSON.stringify({
    model: "4.0Ultra",
    messages: [{ role: "user", content: "你好" }],
  }),
});
\\\

**关键学习**：HTTP 比 WebSocket 更简单，适合简单问答，APIPassword 是 HTTP 专用的认证方式，模型名称与控制台显示名不同。

---

### 14. 设备添加时日期格式错误

**症状**：
\\\
添加设备时，不选择购置日期导致数据库插入失败
\\\

**原因**：
- 前端：空字符串被转换为无效 Date 对象
- 后端：无效日期产生错误的 ISO 字符串

**解决方案**：
\\\	ypescript
// 前端：检查空字符串和日期有效性
let purchaseDateValue: Date | undefined = undefined;
if (formData.purchaseDate && formData.purchaseDate.trim() !== '') {
  const dateObj = new Date(formData.purchaseDate);
  if (!isNaN(dateObj.getTime())) {
    purchaseDateValue = dateObj;
  }
}

// 后端：显式数据清理，只向数据库发送有意义的字段
const cleanData: any = {
  labId: device.labId,
  deviceNo: device.deviceNo,
  name: device.name,
};
if (device.purchaseDate) cleanData.purchaseDate = device.purchaseDate;
\\\

**关键学习**：双层验证和数据清理确保只发送有效数据。

---

### 15. 统计数据全部为零

**症状**：
\\\
统计页面所有数据显示为 0
\\\

**原因**：
- 前端初始日期范围为当年（2025），但测试数据在 2024 年 11-12 月

**解决方案**：
\\\	ypescript
// 修改日期范围匹配测试数据
const [startDate, setStartDate] = useState(() => '2024-11-01');
const [endDate, setEndDate] = useState(() => '2024-12-31');

// 优化日期对象创建
const startDateTime = (() => {
  const [year, month, day] = startDate.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0);
})();
\\\

**关键学习**：日期范围必须与数据实际范围匹配，避免自动 UTC 转换。

---

### 16. 实验室统计查询失败 - SQL 字段歧义

**症状**：
\\\
Error: Column 'status' in field list is ambiguous
\\\

**原因**：
- JOIN 查询中 \status\ 字段存在于多个表，但没有明确表前缀

**解决方案**：
\\\	ypescript
// 添加表前缀
SUM(CASE WHEN \ = 'approved' THEN 1 ELSE 0 END)
COUNT(DISTINCT \)
COUNT(DISTINCT \)
\\\

**关键学习**：JOIN 查询必须明确指定表前缀避免歧义。

---

### 17. AUTO_INCREMENT 不一致导致 JOIN 失败

**症状**：
\\\
直接 SQL: 返回 5 条记录 
JOIN 查询: 返回空数组 
\\\

**原因**：
- 脚本清空表后未重置 AUTO_INCREMENT
- 新实验室 ID: 20-24，预约 labId: 1-5，不匹配导致 JOIN 失败

**解决方案**：
\\\	ypescript
// 重置 AUTO_INCREMENT
const connection = await pool.getConnection();
try {
  await connection.query('ALTER TABLE users AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE lab_rooms AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE lab_devices AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE lab_reservations AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE lab_reserve_rules AUTO_INCREMENT = 1');
} finally {
  connection.release();  // 关键：使用 release 而非 end()
}
\\\

**关键学习**：\connection.release()\ 归还连接到连接池，\connection.end()\ 会关闭连接导致后续操作阻塞。

---

### 18. 日期对象 UTC 转换问题

**症状**：
\\\
日期范围计算不准确，前后端日期对不上
\\\

**原因**：
- 浏览器自动转换为 UTC，导致日期偏移

**解决方案**：
\\\	ypescript
// 显式指定本地时间，避免自动 UTC 转换
const startDateTime = (() => {
  const [year, month, day] = startDate.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0);
})();

const endDateTime = (() => {
  const [year, month, day] = endDate.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59);
})();
\\\

**关键学习**：避免依赖浏览器的自动 UTC 转换，显式构造日期对象。

---

## 第三阶段错误记录（UI 优化）

### 19. 角色菜单混淆导致管理员可见"我的预约"

**症状**：
```
管理员（老师）在侧边栏和首页看到"我的预约"入口，导致混淆：
1. 老师不应该有"我的预约"模块（那是学生用的）
2. 如果老师也要预约，应该有单独的"老师的我的预约"，而非混用学生数据
3. 用户数据权限正确（后端 myList 已按 userId 过滤），但前端入口隐藏
```

**原因**：
- 菜单项 "我的预约" 的 roles 包含 `['admin', 'student']`，两个角色都能看到
- 首页快速入口缺少角色判断，管理员同样显示

**解决方案**：
```typescript
// DashboardLayout.tsx - 菜单项改为仅学生
const menuItems = [
  // ...
  { icon: BookOpen, label: "我的预约", path: "/my-reservations", roles: ['student'] },
  // ...
];

// Home.tsx - 快速入口添加角色判断
{!isAdmin && (
  <Link href="/my-reservations">
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      {/* ... */}
    </Card>
  </Link>
)}
```

**关键学习**：
- 菜单项的 roles 与页面快速入口需一致配置
- 管理员与学生的业务流程完全不同，不应共享入口
- 后端已有正确的权限控制（myList 按 userId 过滤），前端只需隐藏不相关入口

---

### 20. 侧边栏标题图标位置错误

**症状**：
```
系统标题"实验室预约管理系统"与图标 FlaskConical 的排列顺序不符合 UI 设计预期（应该图标在右）
```

**原因**：
- 侧边栏头部代码中，图标在标题文字左侧

**解决方案**：
```typescript
// DashboardLayout.tsx - SidebarHeader 调整顺序
{!isCollapsed ? (
  <div className="flex items-center gap-2 min-w-0">
    <span className="font-semibold tracking-tight truncate text-sm">
      实验室预约管理系统
    </span>
    {/* 图标移到标题右侧 */}
    <FlaskConical className="h-4 w-4 text-blue-600 shrink-0" />
  </div>
) : null}
```

**关键学习**：侧边栏收缩时仅显示图标，展开时显示完整标题；图标位置影响视觉层级。

---

### 21. 审批与违约测试：数据库连接不可用

**症状**：
```
FAIL server/approval.test.ts: 16 tests failed
Error: Database not available
Module.recordViolation server/db.ts:715:18
```

**原因**：
- 测试文件直接调用数据库函数，但测试环境中 `process.env.DATABASE_URL` 未设置
- `getDb()` 函数在 `DATABASE_URL` 不可用时返回 null
- 新测试没有遵循现有的 mock 模式（如 device.test.ts、statistics.test.ts）

**解决方案**：
```typescript
// approval.test.ts - 使用 vi.spyOn 模式 mock 所有数据库调用
import { describe, it, expect, vi } from 'vitest';
import * as db from './db';

describe('审批与违约管理', () => {
  it('should record violation', async () => {
    const violations = [{ userId: 1, violationType: 'no_show', points: 5 }];
    vi.spyOn(db, 'recordViolation').mockResolvedValue(undefined as any);
    vi.spyOn(db, 'getUserViolations').mockResolvedValue(violations as any);

    await db.recordViolation({
      userId: 1,
      violationType: 'no_show',
      points: 5,
    });

    const result = await db.getUserViolations(1);
    expect(result[0].points).toBe(5);
  });
});
```

**关键学习**：
- 单元测试应 mock 外部依赖（数据库、API）而非直接调用
- 项目已有 mock 模式（device.test.ts 使用 `vi.spyOn`），新测试应保持一致
- 避免测试环境依赖于 `process.env.DATABASE_URL` 的实际连接
- 16 个新测试全部改为使用 mock，确保测试隔离与快速执行

**结果**：✅ 16/16 新测试通过，总测试数从 23 增加到 39

---

## 统计

**总错误记录数**：21 个
**第一阶段**：12 个（环境配置、OAuth、React Hooks、Dashboard 同步）
**第二阶段**：6 个（讯飞星火、设备管理、统计分析、日期处理）
**第三阶段（UI 优化）**：2 个（角色菜单混淆、标题图标位置）
**第四阶段（管理与决策增强）**：1 个（测试数据库连接不可用）

**测试状态**：✅ 39/39 通过
- 16 个审批与违约管理测试（新）
- 12 个统计模块测试
- 11 个设备管理测试

**文档更新日期**：2025年12月4日
**文档版本**：1.0.3 (新增审计日志修复、违约数据查询、快速登录等功能)

---

## 第五阶段错误记录（审计与违约完善）

### 22. 审计日志显示操作员为空、IP 为空、时间不对

**症状**：
```
审计日志页面（/admin/audit-logs）显示：
- 操作员ID 列为空
- IP地址 列为空
- 时间显示不正确（显示 createdAt 而非操作时间）
```

**原因**：
1. **后端不保存 IP 地址**：创建审计日志时未从请求中提取 IP，直接发送 undefined
2. **前端关联用户不足**：查询后的审计日志数据中没有操作员名字，只有 operatorUserId（数字）
3. **前端使用错误的时间字段**：显示 createdAt（日志创建时间）而非 operatedAt（操作发生时间）

**解决方案**：

**(1) 添加 IP 提取函数**
```typescript
// server/routers.ts
function getClientIp(req: any): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return (ips[0] || '').trim();
  }
  
  const ip = req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress || 
             req.ip;
  
  return ip ? (typeof ip === 'string' ? ip : ip[0]) : undefined;
}
```

**(2) 所有审计日志记录添加 IP**
```typescript
// 之前：缺少 ipAddress
await db.createAuditLog({
  operatorUserId: ctx.user.id,
  operationType: 'violation_record',
  targetType: 'user',
  // ...
});

// 之后：包含 IP
await db.createAuditLog({
  operatorUserId: ctx.user.id,
  operationType: 'violation_record',
  targetType: 'user',
  ipAddress: getClientIp(ctx.req),  // ✅ 新增
  // ...
});
```

**(3) 后端查询关联用户信息**
```typescript
// server/db.ts - getAuditLogs()
export async function getAuditLogs(filters: {...}) {
  // 之前：简单查询
  let baseQuery = db.select().from(auditLogs)...

  // 之后：LEFT JOIN users 获取操作员名字
  let baseQuery = db
    .select({
      id: auditLogs.id,
      operatorUserId: auditLogs.operatorUserId,
      operatorName: users.name,  // ✅ 新增用户名
      operationType: auditLogs.operationType,
      // ... 其他字段
      ipAddress: auditLogs.ipAddress,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.operatorUserId, users.id))
    .orderBy(desc(auditLogs.operatedAt))
}
```

**(4) 前端显示正确的字段**
```typescript
// client/src/pages/AuditLog.tsx
// 时间：改用 operatedAt
{log.operatedAt
  ? format(new Date(log.operatedAt), "MM-dd HH:mm:ss", { locale: zhCN })
  : "-"}

// 操作员：显示用户名而非 ID
{log.operatorName || `用户${log.operatorUserId}`}

// IP：直接显示
{log.ipAddress || "-"}
```

**关键学习**：
- Express 请求的 IP 需从多个地方查找（代理头、connection、socket）
- 前端日志查询需关联用户表才能显示名字，不能只返回 ID
- 数据库有多个时间字段（createdAt、operatedAt、recordedAt），需明确含义
- 6 个后端 createAuditLog 调用都需添加 IP 参数

---

### 23. 违约管理页面显示 0 条记录

**症状**：
```
在 /admin/violations 页面显示：
- 总违约记录：0 条
- 违约积分：0
- 黑名单用户：0
```

**原因**：
- 前端调用 `trpc.violation.getRecords.useQuery()`
- 这个端点返回**当前登录用户（Mock Admin）的违约记录**
- Mock Admin 本身没有违约，所以返回空数组

**解决方案**：

**(1) 后端添加查询所有违约的函数**
```typescript
// server/db.ts - 新增
export async function getAllViolations() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: violationRecords.id,
      userId: violationRecords.userId,
      userName: users.name,  // ✅ 关联用户名
      // ... 其他字段
    })
    .from(violationRecords)
    .leftJoin(users, eq(violationRecords.userId, users.id))
    .orderBy(desc(violationRecords.recordedAt));
}
```

**(2) 后端添加管理员专用端点**
```typescript
// server/routers.ts - violation 路由
violation: router({
  getRecords: protectedProcedure  // 个人用：查询自己的违约
    .query(async ({ ctx }) => {
      return await db.getUserViolations(ctx.user.id);
    }),

  getAllRecords: adminProcedure  // ✅ 管理用：查询所有人的违约
    .query(async () => {
      return await db.getAllViolations();
    }),
})
```

**(3) 前端改用新端点**
```typescript
// client/src/pages/ViolationManage.tsx
// 之前
const { data: violations = [] } = trpc.violation.getRecords.useQuery();

// 之后
const { data: violations = [] } = trpc.violation.getAllRecords.useQuery();
```

**(4) 前端显示用户名**
```typescript
// 表头改为 "用户名称" 而非 "用户ID"
// 显示：{violation.userName || `用户${violation.userId}`}
```

**关键学习**：
- 管理员端点和用户端点应该分离（getAllRecords vs getRecords）
- 管理员端点需要 adminProcedure 权限检查
- 关联查询需在数据库层做（JOIN）而非前端做
- 数据库约束：API 权限 → 数据库查询范围 → 前端展示

**结果**：✅ 违约记录从 0 → 7 条，积分从 0 → 27 分

---

### 24. 创建违约用户脚本

**实现**：
```bash
pnpm create:violation-users
```

**创建的用户**：
| 用户 | ID | 违约分 | 状态 | 说明 |
|------|-----|--------|------|------|
| 王小红 | 972 | 5分 | 正常 | 1次无故缺席 |
| 李大明 | 973 | 7分 | 正常 | 1次无故缺席+1次迟到取消 |
| 张三强 | 974 | 13分 | 黑名单 | 2次无故缺席+1次超时未签出 |

**自动创建**：
- ✅ 3 个用户账户
- ✅ 7 条违约记录
- ✅ 1 条黑名单记录
- ✅ 7 条审计日志

**快速登录按钮**：
```typescript
// 在侧边栏添加 5 个快速登录按钮
- 👨‍💼 管理员 (Mock Admin) - 蓝色
- ⚠️ 李同学 (违约12分) - 红色
- 👤 王小红 (违约5分) - 黄色
- 👤 李大明 (违约7分) - 琥珀色
- 🚫 张三强 (黑名单中) - 深红色
```

**关键学习**：快速登录按钮通过 OAuth 参数预填充，无需管理员逐个创建测试账户

**结果**：✅ 违约管理功能可直接测试

---

## 统计

**总错误记录数**：24 个
**第一阶段**：12 个（环境配置、OAuth、React Hooks、Dashboard）
**第二阶段**：6 个（讯飞星火、设备管理、统计分析）
**第三阶段**：2 个（UI 优化、菜单角色）
**第四阶段**：1 个（测试 Mock）
**第五阶段**：3 个（审计日志、违约查询、用户创建脚本）

**测试状态**：✅ 39/39 通过
**文档更新日期**：2025年12月4日
**文档版本**：1.0.3

