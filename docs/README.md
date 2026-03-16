# 文档导航

本文档用于统一入口，按“可执行优先、历史方案隔离”的原则整理。

## 1. 上线与运维（优先）

- 部署总流程：../DEPLOYMENT_GUIDE.md
- 项目总览与启动：../README.md

适用场景：准备测试环境、正式上线、日常巡检与更新发布。

## 2. 认证与账号

- OAuth 配置：OAUTH_SETUP.md
- 账号注销：ACCOUNT_DELETION.md

适用场景：配置 GitHub/QQ 登录、处理账号生命周期与合规说明。

## 3. 数据库

- 表结构与关系：DB_SCHEMA.md
- 优化与扩展规划：DB_OPTIMIZATION.md

适用场景：数据库建模理解、性能与演进规划、迁移前评审。

## 4. 竞赛与历史方案

- 计划文档汇总（集中入口）：PLAN_DOCS.md
- 赛前计划（含历史信息）：../COMPETITION_PLAN.md
- 教师主导模式设计稿（历史方案）：teacher.md

说明：本分组文档用于方案讨论与归档，不作为上线执行清单。

## 5. 推荐阅读顺序

1. ../README.md
2. ../DEPLOYMENT_GUIDE.md
3. OAUTH_SETUP.md
4. DB_SCHEMA.md
5. ACCOUNT_DELETION.md

## 6. 维护约定

- 新增文档时，必须先在本文件补入口。
- 执行类文档放“上线与运维/认证与账号/数据库”。
- 历史或讨论类文档放“竞赛与历史方案”，并在文首标注“历史稿”。
