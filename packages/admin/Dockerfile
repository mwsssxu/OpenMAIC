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

# Move standalone files to known location for easier COPY
# Next.js standalone output path varies based on workspace detection
RUN STANDALONE_PATH=$(find .next/standalone -name "server.js" -type f | head -1 | xargs dirname) && \
    cp -r "$STANDALONE_PATH" /standalone && \
    cp -r .next/static /standalone/.next/static

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /standalone ./

EXPOSE 3001

CMD ["node", "server.js"]
