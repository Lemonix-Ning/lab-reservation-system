# =============================================================
# Stage 1: 构建阶段
# =============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@10

# 复制依赖描述文件
COPY package.json pnpm-lock.yaml ./

# 安装全部依赖（包含 devDependencies，构建需要）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY client ./client/
COPY server ./server/
COPY shared ./shared/
COPY drizzle ./drizzle/
COPY vite.config.ts tsconfig.json components.json drizzle.config.ts ./

# 构建前端（Vite）+ 后端（esbuild）
RUN pnpm build

# =============================================================
# Stage 2: 运行阶段（包含全部依赖，支持迁移 + seed 脚本）
# =============================================================
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@10

# 复制依赖描述文件
COPY package.json pnpm-lock.yaml ./

# 安装全部依赖（包含 devDependencies，以支持 drizzle-kit / tsx seed 脚本）
RUN pnpm install --frozen-lockfile

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist/

# 复制迁移文件 + 配置（drizzle-kit migrate 需要）
COPY drizzle ./drizzle/
COPY drizzle.config.ts ./
COPY shared ./shared/

# 复制 seed 脚本（演示数据初始化用）
COPY scripts ./scripts/

# 复制启动脚本
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
