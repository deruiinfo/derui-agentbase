# 构建上下文 = template/（见 docker-compose.yml）
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY web/package.json ./package.json
RUN npm config set registry https://registry.npmmirror.com && npm install
COPY web/tsconfig.json web/vite.config.ts web/index.html ./
COPY web/src ./src
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
