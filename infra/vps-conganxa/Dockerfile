# Ảnh dùng chung cho api, web và bước gieo dữ liệu của bản Công an xã trên VPS (infra/vps-conganxa/README.md).
# Chép cả kho: các script gieo dữ liệu đọc data/, content/, docs/demo/.
FROM oven/bun:1.3.14
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run build:web
ENV NODE_ENV=production
