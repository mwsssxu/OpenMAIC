# 侧伴官网独立构建 - 从根目录构建上下文
# 使用方式: docker build -f packages/website/Dockerfile -t website-app .

FROM node:20-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy root package files for pnpm monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy all source files
COPY . .

# Build website package
WORKDIR /app/packages/website
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/packages/website/.next/standalone ./
COPY --from=builder /app/packages/website/.next/static ./.next/static
COPY --from=builder /app/packages/website/public ./public

EXPOSE 3000

CMD ["node", "server.js"]