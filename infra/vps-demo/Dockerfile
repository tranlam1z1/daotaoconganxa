# Ảnh dùng chung cho api, web và bước gieo dữ liệu của bản demo trên VPS (infra/vps-demo/README.md).
# Chép cả kho: các script gieo dữ liệu đọc data/, content/, docs/demo/.
FROM oven/bun:1.4.2
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run build:web
ENV NODE_ENV=production
