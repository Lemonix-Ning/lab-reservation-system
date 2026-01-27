# 开发规范与规则

## 1. 总则
- 本项目仅保留两类文档：`COMPLETE_DOCUMENTATION.md`（总说明）与 `DEVELOPMENT_LOG.md`（仅错误与解决方案）。
- 新增本规范文件用于约束开发流程与质量；不记录问题，仅规定规则。

## 2. 代码风格
- TypeScript：开启严格模式（`tsconfig.json` → `strict: true`），避免 `any`（确需使用需加注释说明）。
- 命名约定：`camelCase`（变量/函数）、`PascalCase`（组件/类型）、`UPPER_SNAKE`（常量）。
- 文件结构：按功能分层（`client/` 前端、`server/` 后端、`shared/` 共享类型、`drizzle/` 迁移、`scripts/` 脚本）。
- 导入顺序：第三方 → `shared` → 项目内部绝对路径 → 相对路径。
- 样式：Tailwind 优先，避免内联样式；组件用 `shadcn/ui` 保持一致性。

## 3. Git 分支与提交
- 分支策略：`feature/*`、`fix/*`、`docs/*`、`chore/*`。
- 提交信息：`type(scope): subject`，示例：`feat(statistics): add lab usage API with date range filter`。
- `type` 枚举：`feat`、`fix`、`docs`、`test`、`refactor`、`chore`、`build`。
- 每次合并前需确保：`pnpm check`、`pnpm test` 均通过。

## 4. 评审与合并
- 后端 API 与前端页面改动需至少一次代码评审（Review）。
- 禁止直接向 `main` 推送：采用 PR / 合并请求流程；PR 必须通过测试与 lint。
- 变更说明：PR 描述需包含改动点、影响模块、回滚方案。

## 5. 环境与配置
- `.env` 文件仅用于本地开发，不提交仓库；示例配置写入 `COMPLETE_DOCUMENTATION.md`。
- 前端环境变量使用 `VITE_*` 前缀，通过 `import.meta.env` 访问。
- Cookie 策略：开发 `sameSite: 'lax'`，生产 `sameSite: 'none' + secure: true`。

## 6. 安全与权限
- tRPC 路由：公共 `publicProcedure`、登录后 `protectedProcedure`、管理员 `adminProcedure`。
- 所有管理端路由与页面必须检查 `user.role === 'admin'`。
- 服务器端再次校验权限，前端仅作引导。

## 7. 数据与数据库
- Drizzle ORM：所有 JOIN、聚合查询必须显式添加表前缀避免字段歧异。
- 迁移与种子：清空表后必须重置 `AUTO_INCREMENT` 并使用 `connection.release()`。
- 日期：统一使用本地时间构造（避免隐式 UTC 转换），前后端传输使用 ISO 字符串。
- **Timestamp 字段模式**（P2-2 新增）：
  - 使用 `ON UPDATE CURRENT_TIMESTAMP` 自动更新时间戳
  - 示例：`ALTER TABLE lab_reservations MODIFY COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
  - 排序时优先用 `updatedAt DESC` 而非 `createdAt DESC`
- **React Query 缓存策略**（P2-2 新增）：
  - 参数化查询使用 `exact: false` 刷新所有子查询
  - 示例：`invalidateQueries({ queryKey: ['reservation'], exact: false })` 覆盖 `['reservation', 'allList', ...]`、`['reservation', 'detail', ...]`
  - 避免使用 `exact: true` 导致缓存不完全刷新
- **前端过滤与后端查询**（P2-2 新增）：
  - 后端 API 不支持的参数（如 `targetId`）可在前端过滤
  - 示例：审计日志通过 URL 参数 `?targetId=xxx`，前端使用 `useMemo` 过滤结果
  - 若查询量大，优先向后端添加参数支持
- **数据库索引**（Phase 4 优化）：
  - 查询性能优化采用分层索引策略（Tier 1/2/3）
  - 新增复合索引时需验证查询执行计划：`EXPLAIN SELECT ...`
  - 大表修改后需执行 `ANALYZE TABLE` 更新统计信息
  - 索引过多会影响写入性能，应权衡读写比例（目前 76+ 新索引，平均提升 84%）

## 8. 测试与质量门槛
- 单元测试：每个模块完成后必须新增或更新测试用例；运行 `pnpm vitest run`。
- 统计模块新增测试不少于 10 条；其他模块至少 5 条。
- 覆盖范围：
  - 后端：路由权限、输入校验、核心业务函数、SQL 聚合正确性。
  - 前端：关键交互、状态管理、权限显示、极端边界（空数据）。
  - **日历组件**（P2-1 新增）：冲突检测逻辑、多维度查询参数正确性、事件详情显示完整性。
- 发布前门槛：`pnpm check` 无错误、`pnpm test` 全部通过、重要视图手动冒烟测试。
- **日历测试规范**（P2-1 新增）：
  - 冲突检测：必须覆盖边界场景（相邻不冲突、完全重叠、部分重叠）。
  - 替代方案推荐：验证返回数量（≤5 个）、时间合法性（不与已有预约冲突）、置信度排序。
  - 多维度查询：确保 `labId`、`deviceId`、`courseId` 参数独立过滤有效。

## 9. 文档与日志
- `DEVELOPMENT_LOG.md`：仅记录"错误、原因、解决方案、关键学习"，禁止添加综述与阶段总结。包含四个阶段：第一阶段环境配置与OAuth、第二阶段讯飞星火与统计分析、第三阶段 UI 优化、第四阶段日历与可视化（P2-1 完成）、第五阶段审计与违约、第六阶段数据库恢复、第七阶段性能优化、第八阶段课程管理、第九阶段日历优化与冲突管理（P2-2 完成）。
- `README.md`：记录项目简介、核心功能、技术栈、快速开始、AI 智能功能（含日历替代方案）。
- `copilot-instructions.md`：AI 助手快速入门，含核心实现、日历优化、下一阶段任务。
- `TEST_SUMMARY.md`：汇总各模块的测试用例、覆盖范围、运行命令与最近状态。
- `DATABASE.md`：记录数据库表结构、高级查询说明、Timestamp 模式（P2-2 新增）。
- 发布清单：改动摘要、迁移步骤、测试结果、回滚说明。
- 回滚策略：保留上一个稳定标签，出现严重问题 30 分钟内可回滚。

---

附：常用命令
```powershell
# 代码质量检查
pnpm check

# 运行全部测试
pnpm vitest run

# 单模块测试示例
pnpm vitest run server/statistics.test.ts
```
