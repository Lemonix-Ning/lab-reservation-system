# GitHub Pages 部署指南

## 快速开始

### 1. 启用 GitHub Pages

进入 GitHub 仓库设置：
1. **Repository Settings** → **Pages**
2. **Source** 选择 `GitHub Actions`
3. 保存配置

### 2. 自动部署

当你推送代码到以下分支时，自动触发部署：
- `main`
- `master`
- `db-optimization-phase1`（可配置）

GitHub Actions 会：
- 自动安装依赖（Node.js + pnpm）
- 执行 `pnpm build:static` 生成静态前端资源
- 将产物部署到 GitHub Pages

### 3. 访问你的站点

部署完成后，访问：
```
https://[your-username].github.io/lab-reservation-system/
```

例如：`https://lemonix-ning.github.io/lab-reservation-system/`

---

## 工作流说明

工作流文件位置：[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)

### 触发条件
- Push 到指定分支
- 手动通过 `workflow_dispatch` 触发

### 构建步骤
1. **检出代码**：拉取最新提交
2. **环境设置**：Node.js 20 + pnpm 10
3. **缓存优化**：pnpm 依赖缓存
4. **依赖安装**：`pnpm install`
5. **静态构建**：`pnpm build:static`
6. **Pages部署**：自动上传至 GitHub Pages

---

## 常见问题

### Q: Pages 部署一直失败？
A: 检查以下几点：
- ✅ 仓库 **Settings → Pages** 已配置为 `GitHub Actions`
- ✅ 工作流文件存在且语法正确
- ✅ `pnpm-lock.yaml` 存在（确保依赖锁定）
- ✅ 查看 Actions 选项卡的构建日志

### Q: 如何更新 Pages 内容？
A: 只需推送代码到对应分支，自动触发部署。

### Q: 能否从其他分支触发部署？
A: 可以，编辑 `.github/workflows/deploy-pages.yml` 中的 `branches` 配置：
```yaml
on:
  push:
    branches:
      - main
      - your-branch-name  # 添加你的分支
```

### Q: 如何禁用自动部署？
A: 在 **Settings → Pages → Source** 改为 `None` 或删除工作流文件。

---

## 与完整系统的关系

**注意**：GitHub Pages 上部署的是 **前端静态资源**，不包含后端 API。

- ✅ **可用**：UI 预览、组件展示、静态内容
- ❌ **不可用**：实时功能（预约、登录、数据库）

如需完整系统，参考 [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) 进行完整部署。

---

## 自定义部署

### 生成的构建产物
```bash
pnpm build:static  # 输出至 dist-static/
```

### 本地预览
```bash
pnpm build:static
cd dist-static
python -m http.server 8000  # 或任何本地 HTTP 服务器
# 访问 http://localhost:8000
```

---

## 更新分支触发配置

编辑 `.github/workflows/deploy-pages.yml`：

```yaml
on:
  push:
    branches:
      - main          # 主分支
      - master        # 备选主分支
      - develop       # 开发分支（可选）
      - db-optimization-phase1  # 当前活跃分支
```

保存后自动生效。
