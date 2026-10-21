# quydinhphapluat.vn

Hệ thống dịch vụ **tra cứu – đối chiếu – vận dụng** quy định pháp luật Việt Nam: kho văn bản quy phạm pháp luật có cấu trúc đến từng điều/khoản/điểm, hợp nhất theo thời điểm, tìm kiếm lai, hỏi đáp có trích dẫn, thư viện trường hợp ứng dụng và đào tạo theo chuyên đề.

Kế hoạch kỹ thuật và vận hành đầy đủ: [ke-hoach/00-tong-quan.md](ke-hoach/00-tong-quan.md).

Quy tắc hành văn cho mọi nội dung hiển thị (giao diện web, bài giảng, lời thoại nhân vật đồng hành, thông báo lỗi): [QUY-TAC-HANH-VAN.md](QUY-TAC-HANH-VAN.md). Soát bản kiểm tra ở §12 trước khi đưa bất kỳ chuỗi hiển thị nào lên trang.

## Khởi động nhanh

```bash
# 1. Hạ tầng (Postgres + pgvector)
docker compose -f infra/docker-compose.yml up -d postgres

# 2. Cấu hình
cp .env.example .env        # sửa nếu cần; để trống ANTHROPIC_API_KEY thì LLM chạy chế độ mock

# 3. Phụ thuộc, lược đồ, dữ liệu mẫu
bun install
bun run packages/db/src/migrate.ts
bun run packages/db/src/seed.ts

# 4. Chạy
bun run api      # API   http://127.0.0.1:3001
bun run web      # Web   http://127.0.0.1:3000
bun run worker   # Worker xử lý hàng đợi
bun run mcp      # MCP server (stdio). Thêm --http để chạy có xác thực Google

# 5. Kiểm thử
bun test
```

## Cấu trúc

| Thư mục | Nội dung |
|---------|----------|
| `packages/legal-model` | Lõi pháp lý: thứ bậc hiệu lực, URN, parser cấu trúc, engine hợp nhất theo thời điểm, diff |
| `packages/db` | Lược đồ Postgres, migration, lớp truy cập dữ liệu, seed |
| `packages/citation` | Phân giải viện dẫn tiếng Việt ↔ URN |
| `packages/search` | Tìm kiếm lai: BM25 + vector + khớp viện dẫn |
| `packages/llm` | Lớp gọi mô hình ngôn ngữ (Anthropic thật hoặc mock/replay), đo chi phí, kho prompt |
| `packages/sohoa` | Số hóa PDF bằng TypeScript: đọc lớp văn bản, chia cụm trang, ghép cụm, kiểm chứng |
| `packages/storage` | Kho đối tượng: Cloudflare R2 (S3 API) hoặc thư mục cục bộ, cùng một URI |
| `apps/api` | REST API (Hono trên Bun) |
| `apps/web` | Web app SSR (React Router v7 framework mode + Vite) |
| `apps/workers-ts` | Crawler và pipeline xử lý văn bản |
| `apps/mcp` | MCP server: cho trợ lý AI tra cứu và vận hành hệ thống, xác thực Google, phân quyền theo vai trò |
| `services/docproc` | **Đã ngưng dùng.** Bản Python cũ của bước chuyển đổi tài liệu, giữ để tham chiếu |
| `prompts` | Prompt production có phiên bản |
| `content` | Nội dung biên tập: phân loại, trường hợp ứng dụng, chuyên đề đào tạo |
| `evals` | Bộ dữ liệu vàng và script đánh giá chất lượng |
| `ke-hoach` | Bộ kế hoạch kỹ thuật và vận hành |

## Khái niệm cốt lõi

**URN** định danh bền vững tới từng nút:
```
vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2.diem-a@2026-03-01
```

**Truy vấn theo thời điểm**: mọi API nhận tham số `asOf`. Nội dung văn bản được dựng lại bằng cách áp các lệnh sửa đổi (`amendment_ops`) đã duyệt lên bản gốc, kèm chú thích theo kỹ thuật trình bày văn bản hợp nhất (Nghị định 250/2026/NĐ-CP).

**Thứ bậc hiệu lực** theo Điều 4 Luật Ban hành văn bản quy phạm pháp luật 2025 (64/2025/QH15), sửa đổi bởi Luật 87/2025/QH15: Hiến pháp → Luật/Bộ luật/Nghị quyết Quốc hội → Pháp lệnh/Nghị quyết UBTVQH → Lệnh, Quyết định Chủ tịch nước → Nghị định/Nghị quyết Chính phủ → Quyết định Thủ tướng → Nghị quyết HĐTP TANDTC → Thông tư → cấp tỉnh → cấp xã.

## Chế độ không có khóa API

Khi `ANTHROPIC_API_KEY` để trống, `packages/llm` dùng provider mock/replay: phát lại bản ghi trong `data/llm-cache` nếu có, nếu không thì trả kết quả tất định hợp lệ theo schema. Toàn bộ pipeline và test chạy được, không tốn chi phí. Đặt khóa vào `.env` là chuyển sang gọi thật.

## Miễn trừ

Nội dung do hệ thống sinh (bản hợp nhất tự động, câu trả lời, bài học) là **thông tin tham khảo**. Căn cứ chính thức để viện dẫn và áp dụng là văn bản hợp nhất do cơ quan nhà nước ban hành hoặc các văn bản được hợp nhất.

## Đăng nhập

Tra cứu văn bản không cần đăng nhập. Đăng nhập (Google Identity Services) là để biên tập,
duyệt lệnh sửa đổi và lấy token kết nối cho trợ lý AI. Link **Đăng nhập** nằm ở thanh đầu
trang web; trang riêng là `/dang-nhap`, trang tài khoản là `/tai-khoan`.

Cần đặt `GOOGLE_CLIENT_ID` (xem `.env.example`) và khai địa chỉ trang web trong mục
*Authorized JavaScript origins* của OAuth client trên Google Cloud Console.

**Người đăng nhập đầu tiên** của một kho chưa có tài khoản nào được cấp vai trò `quan_tri`
(toàn quyền, gồm quản lý tài khoản). Từ người thứ hai trở đi chỉ nhận `AUTH_DEFAULT_ROLE`
(mặc định `khach`) và phải được quản trị nâng quyền. Việc cấp quyền này được ghi vào
`audit_log`; tắt bằng `AUTH_BOOTSTRAP_ADMIN=0`.

## Kết nối trợ lý AI qua MCP

Hệ thống có sẵn MCP server để Claude hoặc trợ lý AI khác tra cứu và vận hành trực tiếp:
tìm quy định, đọc văn bản theo thời điểm, **kiểm chứng căn cứ trước khi kết luận**, so sánh
phiên bản, đối chiếu thứ bậc hiệu lực, và (với vai trò phù hợp) duyệt lệnh sửa đổi.

Chạy cục bộ bằng `.mcp.json` có sẵn trong repo, hoặc chạy HTTP có đăng nhập Google:

```bash
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com bun run dev:mcp
```

Chi tiết vai trò, quyền và bảo mật: [apps/mcp/README.md](apps/mcp/README.md).

## Triển khai

Bản chạy thật nằm trên **DigitalOcean App Platform**, dựng bằng **buildpack Bun** (không có
Dockerfile): hai ứng dụng — `qdpl` gồm web, api nội bộ, worker và việc migrate chạy trước mỗi
lần triển khai; `qdpl-mcp` là MCP server ở tên miền riêng.

Hướng dẫn từng bước trên bảng điều khiển: [docs/trien-khai-do.md](docs/trien-khai-do.md).
Bản đặc tả đối chiếu: [.do/app.yaml](.do/app.yaml) và [.do/mcp.yaml](.do/mcp.yaml).

Nhánh `main` bật autodeploy: mỗi lần đẩy mã lên là một lần triển khai.
