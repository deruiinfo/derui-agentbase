# 构建上下文 = template/（见 docker-compose.yml）
# 注意：需先把 @rls-kit/* 发布到 registry（或改为可安装来源）。
FROM node:22-bookworm-slim

WORKDIR /app

COPY api/package.json ./package.json
COPY vendor /vendor
RUN npm config set registry https://registry.npmmirror.com && npm install

COPY api/tsconfig.json ./tsconfig.json
COPY api/src ./src
COPY db ./db

ENV MIGRATIONS_DIR=/app/db/migrations
EXPOSE 3001

CMD ["sh", "-c", "npx tsx src/migrate.ts && npx tsx src/server.ts"]
