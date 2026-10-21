# 11. Vận hành, hạ tầng và DevOps

## 1. Môi trường
| Môi trường | Mục đích | Hạ tầng |
|-----------|----------|---------|
| dev | Máy cá nhân, Docker Compose (Redis, OpenSearch); CSDL dùng Postgres do DigitalOcean quản lý (cụm `db-postgresql-sgp1-06837`, CSDL `qdpl`). Postgres trong Compose chỉ để chạy `bun test`. Kho đối tượng dùng thư mục `data/` | |
| staging | Kiểm thử tích hợp, eval trước phát hành | 1 node CPU + 1 GPU dùng chung |
| prod | Dịch vụ công khai | Xem §2 |

## 2. Hạ tầng sản xuất (giai đoạn 1, ước lượng)
| Thành phần | Cấu hình | Ghi chú |
|-----------|----------|---------|
| Web (RR7 SSR) ×2 | 2 vCPU / 4 GB | sau CDN/WAF (Cloudflare) |
| API (Hono) ×2 | 2 vCPU / 4 GB | |
| Workers TS ×2 | 2 vCPU / 4 GB | crawler, indexer, consolidation |
| worker số hóa (TS) ×1–2 | 4 vCPU / 8 GB | Chỉ dựng việc: đọc lớp văn bản, chia cụm trang. Không cần GPU |
| Embedding/rerank server | GPU L4 hoặc CPU 16 vCPU (bge-m3 chạy được CPU với thông lượng thấp) | TEI |
| PostgreSQL | 8 vCPU / 32 GB / NVMe 1 TB, replica đọc | pgvector HNSW cần RAM |
| OpenSearch ×3 | 4 vCPU / 16 GB mỗi node | |
| Cloudflare R2 | 4 TB (raw + pages + derived) | Không phí egress; bản sao Markdown ở `derived/` |
| Redis (tùy chọn) | 2 GB | |

Đặt máy chủ trong nước (yêu cầu lưu trữ dữ liệu người dùng và độ trễ). Giai đoạn đầu dùng Docker Compose + systemd trên 2–3 máy là đủ; không còn nút GPU nào cho khâu số hóa.

## 3. CI/CD
- GitHub Actions: lint (biome), typecheck, `bun test`, test Python (`pytest`), **eval gate** (12) khi thay đổi prompt/parser/model; build image; migrate DB (Drizzle) có kiểm tra tương thích ngược; deploy blue/green.
- Prompt và model id là cấu hình có phiên bản (`prompts/*.yaml`, `llm.config.ts`); thay đổi phải qua PR và eval.

## 4. Giám sát và cảnh báo
| Nhóm | Chỉ số | Ngưỡng cảnh báo |
|------|--------|-----------------|
| Thu thập | văn bản mới/ngày theo nguồn; độ trễ Công báo → hệ thống | nguồn im lặng > 3 ngày; độ trễ > 48 giờ |
| Chuyển đổi | hàng đợi chờ; thời gian/trang; tỷ lệ `needs_review`; chi phí LLM/ngày | hàng đợi > 2.000 trang; chi phí > ngân sách ngày |
| Hợp nhất | ops chờ duyệt; xung đột | ops chờ > 7 ngày |
| Tìm kiếm | p95 latency; tỷ lệ không kết quả | p95 > 800 ms |
| RAG | tỷ lệ câu trả lời không citation; báo sai/ngày | > 2% |
| Hệ thống | CPU/RAM/disk, lỗi 5xx, uptime | chuẩn |
Công cụ: OpenTelemetry, Prometheus, Grafana, Loki; Sentry cho lỗi frontend/backend; trang trạng thái công khai.

## 5. Sao lưu và khôi phục
- Postgres: WAL streaming + snapshot hằng ngày, giữ 30 ngày; kiểm tra restore hằng tháng.
- R2: bật versioning và sao chép sang vùng khác; bản gốc PDF không bao giờ xóa.
- OpenSearch và embeddings: có thể tái tạo từ Postgres + S3 (job `reindex`), không cần backup riêng nhưng snapshot hằng tuần để rút ngắn thời gian khôi phục.
- RPO 24 giờ, RTO 4 giờ (giai đoạn 1).

## 6. Chi phí AI (ước tính để lập ngân sách; giá theo bảng Anthropic tại 06/2026: Opus 5 $5/$25 mỗi triệu token vào/ra; Sonnet 5 $2/$10; Haiku 4.5 $1/$5; Batch giảm 50%; cache read giảm mạnh)

| Hạng mục | Khối lượng giả định | Đơn giá/đơn vị | Thành tiền (USD) |
|----------|--------------------|----------------|------------------|
| Chuyển đổi tuyến C (Sonnet, batch) | 2,5 triệu trang × (3k vào + 1,5k ra) | ≈ $0,0105/trang | ≈ 26.000 |
| Chuyển đổi tuyến D/E (Opus, batch) | 1,3 triệu trang × (5k vào + 2k ra) | ≈ $0,0375/trang | ≈ 49.000 |
| Kiểm chứng LLM (10% + cảnh báo) | 0,6 triệu trang, Opus batch | ≈ $0,03/trang | ≈ 18.000 |
| Trích amendment ops | ~15.000 văn bản sửa đổi × 30k token | Opus | ≈ 4.000 |
| Embedding (tự host) | ~25 triệu chunk | GPU giờ | ≈ 1.500 |
| RAG vận hành (Opus toàn bộ) | 5.000 câu hỏi/ngày × 25k vào (cache 70%) + 1,5k ra | ≈ $0,085/câu | ≈ 12.500/tháng |
| RAG vận hành (định tuyến: Sonnet cho câu đơn giản ~70%, Opus cho câu phức tạp) | như trên | ≈ $0,045/câu | ≈ 6.500/tháng |
| **Backfill toàn kho TW (một lần)** | | | **≈ 100.000** |

Giảm chi phí: ưu tiên DOCX/HTML (không tốn LLM), gom trang sạch vào Sonnet, dùng Opus chỉ khi confidence thấp, prompt caching, batch. Con số thực đo lại sau PoC 1.000 trang (13).

## 7. Vận hành dữ liệu và biên tập
Nhân sự tối thiểu giai đoạn 1: 1 trưởng nhóm pháp chế, 2 biên tập viên số hóa (duyệt OCR, ops), 1 chuyên gia chuyên đề (CNTT/đầu tư công) bán thời gian, 3 kỹ sư (1 full-stack, 1 data/pipeline, 1 ML/OCR).

SLA nội bộ:
- Văn bản mới TW: lên hệ thống dạng bản gốc + metadata ≤ 24 giờ; bản Markdown đã duyệt ≤ 5 ngày làm việc; ops sửa đổi được duyệt trước ngày hiệu lực (thường ≥ 45 ngày).
- Báo sai từ người dùng: phản hồi ≤ 3 ngày.
- Rà soát use case/bài học có `citation_health != ok`: ≤ 10 ngày.

Quy trình thay đổi trạng thái hiệu lực: chỉ biên tập viên cấp `legal_reviewer` mới xác nhận `het_hieu_luc`; hệ thống chỉ "đề xuất".

## 8. Bảo mật
- WAF + rate limit; chống cào ồ ạt nội dung biên tập (use case/khóa học) bằng giới hạn theo IP/tài khoản; VBQPPL thì mở API có key miễn phí.
- Xác thực: mật khẩu băm Argon2, 2FA cho biên tập; phân quyền RBAC; audit log bất biến.
- Bảo vệ dữ liệu cá nhân: thu tối thiểu, chính sách rõ, xóa theo yêu cầu, không đưa dữ liệu người dùng vào prompt huấn luyện; nhật ký câu hỏi ẩn danh hóa sau 90 ngày.
- Bí mật: quản lý bằng SOPS/Vault; khóa API LLM xoay vòng; egress proxy ghi chi phí.
- Kiểm thử xâm nhập trước ra mắt; cập nhật phụ thuộc định kỳ (Renovate).
