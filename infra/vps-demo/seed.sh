#!/bin/sh
# Migration và gieo dữ liệu demo, theo đúng thứ tự gieoDuLieu() trong scripts/demo.ts.
# Chạy lại nhiều lần không sinh bản trùng.
set -e
cd /app
step() { echo; echo "== $1"; shift; "$@"; }
step "Migration" bun run packages/db/src/migrate.ts
step "Dữ liệu nền và hai văn bản mẫu" bun run packages/db/src/seed.ts
step "Nhân vật, danh mục đào tạo" bun run packages/db/src/seed-dao-tao.ts
step "Bài giảng giao thông đường bộ" bun run packages/db/src/seed-dao-tao-gtdb.ts
step "Ngân hàng câu hỏi" bun run packages/db/src/seed-ngan-hang.ts
step "Tra cứu nhanh" bun run scripts/tra-cuu-nhanh.ts
step "Biển báo" bun run scripts/bien-bao.ts
step "Văn bản chép từ kho thật" bun run packages/db/src/seed-demo-van-ban.ts
step "Văn bản từ tệp Markdown" bun run scripts/demo-van-ban-tep.ts
step "Đơn vị và tài khoản mẫu" bun run packages/db/src/seed-don-vi.ts
step "Chỉ mục tìm kiếm" bun run packages/search/src/cli.ts
echo; echo "Gieo dữ liệu xong."
