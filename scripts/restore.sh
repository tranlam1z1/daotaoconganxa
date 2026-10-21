#!/usr/bin/env bash
# Khôi phục từ bản sao lưu và KIỂM CHỨNG kết quả.
# Kế hoạch yêu cầu kiểm tra khôi phục hằng tháng (ke-hoach/11 §5) — script này dùng cho việc đó.
# Dùng: scripts/restore.sh backups/qdpl-20260906-120000.dump [DATABASE_URL_ĐÍCH]
set -euo pipefail

DUMP="${1:?cần đường dẫn file .dump}"
TARGET="${2:-${DATABASE_URL:?cần đặt DATABASE_URL hoặc truyền tham số thứ hai}}"

if [ -f "${DUMP%.dump}.info" ]; then
  echo "==> Kiểm tra toàn vẹn"
  EXPECTED=$(grep '^sha256_dump=' "${DUMP%.dump}.info" | cut -d= -f2)
  ACTUAL=$(sha256sum "$DUMP" | cut -d' ' -f1)
  [ "$EXPECTED" = "$ACTUAL" ] || { echo "LỖI: sha256 không khớp"; exit 1; }
  echo "    sha256 khớp"
fi

echo "==> Khôi phục vào $TARGET"
pg_restore --dbname="$TARGET" --clean --if-exists --no-owner --jobs=4 "$DUMP"

echo "==> Kiểm chứng sau khôi phục"
psql "$TARGET" -v ON_ERROR_STOP=1 <<'SQL'
\pset format aligned
SELECT 'documents' AS bang, count(*) FROM documents
UNION ALL SELECT 'document_versions', count(*) FROM document_versions
UNION ALL SELECT 'nodes', count(*) FROM nodes
UNION ALL SELECT 'amendment_ops', count(*) FROM amendment_ops
UNION ALL SELECT 'relations', count(*) FROM relations;

-- Không được có phiên bản nào mất nút
SELECT v.id, v.version_no
FROM document_versions v LEFT JOIN nodes n ON n.version_id = v.id
GROUP BY v.id, v.version_no HAVING count(n.id) = 0;

-- payload lệnh sửa đổi phải là object, không phải chuỗi (lỗi mã hóa JSON hai lần)
SELECT count(*) AS payload_sai_kieu FROM amendment_ops
WHERE payload IS NOT NULL AND jsonb_typeof(payload) <> 'object';
SQL

echo "Khôi phục xong. Hãy đối chiếu số liệu trên với hệ thống nguồn."
