# Admin子包独立构建 - 从根目录构建上下文
# 使用方式: docker build -f packages/admin/Dockerfile -t admin-app .

FROM node:20-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy root package files for pnpm monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build admin package
WORKDIR /app/packages/admin
RUN pnpm build

# Find the standalone output path (varies based on workspace detection)
RUN find .next/standalone -name "server.js" -type f | head -1

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy standalone files - use wildcard to handle nested path
COPY --from=builder /app/packages/admin/.next/standalone/*/project/*/packages/admin ./
COPY --from=builder /app/packages/admin/.next/static ./.next/static

EXPOSE 3001

CMD ["node", "server.js"]