#!/usr/bin/env bash
# Sao lưu CSDL và kho file. Xem ke-hoach/11-van-hanh-devops.md §5 (RPO 24 giờ, RTO 4 giờ).
# Dùng: scripts/backup.sh [thư-mục-đích]
set -euo pipefail

DEST="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_URL="${DATABASE_URL:?cần đặt DATABASE_URL}"
STORAGE="${STORAGE_DIR:-./data}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

mkdir -p "$DEST"

echo "==> Sao lưu CSDL"
# --format=custom cho phép khôi phục chọn lọc từng bảng.
pg_dump --dbname="$DB_URL" --format=custom --compress=9 \
        --file="$DEST/qdpl-$STAMP.dump"

echo "==> Sao lưu kho file (bản gốc PDF/DOCX không bao giờ được xóa)"
tar -czf "$DEST/storage-$STAMP.tar.gz" \
    --exclude='llm-cache' \
    -C "$(dirname "$STORAGE")" "$(basename "$STORAGE")"

echo "==> Ghi thông tin kiểm chứng"
{
  echo "thoi_diem=$STAMP"
  echo "kich_thuoc_dump=$(stat -c%s "$DEST/qdpl-$STAMP.dump")"
  echo "kich_thuoc_storage=$(stat -c%s "$DEST/storage-$STAMP.tar.gz")"
  echo "sha256_dump=$(sha256sum "$DEST/qdpl-$STAMP.dump" | cut -d' ' -f1)"
} > "$DEST/qdpl-$STAMP.info"

echo "==> Dọn bản sao lưu cũ hơn $KEEP_DAYS ngày"
find "$DEST" -name 'qdpl-*.dump' -mtime "+$KEEP_DAYS" -delete
find "$DEST" -name 'storage-*.tar.gz' -mtime "+$KEEP_DAYS" -delete
find "$DEST" -name 'qdpl-*.info' -mtime "+$KEEP_DAYS" -delete

echo "Xong: $DEST/qdpl-$STAMP.dump"
