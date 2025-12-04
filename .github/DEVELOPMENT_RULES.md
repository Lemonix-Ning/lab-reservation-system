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
- Drizzle ORM：所有 JOIN、聚合查询必须显式添加表前缀避免字段歧义。
- 迁移与种子：清空表后必须重置 `AUTO_INCREMENT` 并使用 `connection.release()`。
- 日期：统一使用本地时间构造（避免隐式 UTC 转换），前后端传输使用 ISO 字符串。

## 8. 测试与质量门槛
- 单元测试：每个模块完成后必须新增或更新测试用例；运行 `pnpm vitest run`。
- 统计模块新增测试不少于 10 条；其他模块至少 5 条。
- 覆盖范围：
  - 后端：路由权限、输入校验、核心业务函数、SQL 聚合正确性。
  - 前端：关键交互、状态管理、权限显示、极端边界（空数据）。
- 发布前门槛：`pnpm check` 无错误、`pnpm test` 全部通过、重要视图手动冒烟测试。

## 9. 文档与日志
- `DEVELOPMENT_LOG.md`：仅记录"错误、原因、解决方案、关键学习"，禁止添加综述与阶段总结。包含三个阶段：第一阶段环境配置与OAuth、第二阶段讯飞星火与统计分析、第三阶段 UI 优化。
- `COMPLETE_DOCUMENTATION.md`：记录架构、接口、流程、部署、运行方式、索引到本规范与测试汇总。
- `TEST_SUMMARY.md`：汇总各模块的测试用例、覆盖范围、运行命令与最近状态。
- 更新频率：每次完成开发阶段时同步更新。

## 10. 发布与回滚
- 版本号：遵循 `major.minor.patch`（示例：`1.2.0`）。
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
