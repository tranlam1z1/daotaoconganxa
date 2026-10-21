# 02. Kiến trúc hệ thống và tech stack

## 1. Sơ đồ tổng thể

```
┌──────────────────────── Nguồn chính thống ─────────────────────────┐
│ congbao.chinhphu.vn │ vbpl.vn │ vanban.chinhphu.vn │ cổng bộ/tỉnh │
└───────────┬────────────────────────────────────────────────────────┘
            │ (1) Crawler (Bun workers, Playwright khi cần JS)
            ▼
┌──────────────────────┐    ┌───────────────────────────────┐
│ Object storage (R2)  │◄──►│ PostgreSQL (nguồn sự thật)    │
│ raw PDF/DOCX/HTML,   │    │ documents, versions, nodes,   │
│ ảnh trang, hình,     │    │ relations, amend-ops,         │
│ bản sao Markdown     │    │ sohoa_tasks, pgvector         │
└──────────┬───────────┘    └──────────┬────────────────────┘
           │ (2) Số hóa (05)                        │
           ▼                                        │
┌──────────────────────────────┐                    │
│ Worker TS: cắt cụm trang,    │                    │
│ lớp văn bản, ghép, kiểm chứng│                    │
│ + agent đọc trang qua MCP    │                    │
└──────────┬───────────────────┘                    │
           │ Markdown + cây cấu trúc                │
           ▼                                        ▼
┌──────────────────────────────┐    ┌───────────────────────────────┐
│ (3) Structure & Consolidation│    │ (4) Indexers                  │
│ parser, amend-op extractor,  │    │ OpenSearch (BM25, facet),     │
│ point-in-time renderer       │    │ pgvector (embedding),         │
└──────────────────────────────┘    │ graph tables (quan hệ)        │
                                    └──────────┬────────────────────┘
                                               │
┌──────────────────────────────────────────────▼────────────────────┐
│ (5) API layer (Bun + Hono): search, document, consolidation,      │
│     ask (RAG), use-cases, courses, admin/editorial                 │
└──────────────────────────────┬────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────┐
│ (6) Web app: React Router v7 framework mode (SSR) + Vite + Bun    │
│     public site (mobile-first), editorial console                 │
└───────────────────────────────────────────────────────────────────┘
```

## 2. Tech stack

| Tầng | Lựa chọn | Ghi chú |
|------|----------|---------|
| Runtime / package manager | **Bun** ≥ 1.2 | Chạy web SSR, API, workers TS; `bun install`, `bun test` |
| Web framework | **React Router v7** (framework mode, `@react-router/dev` Vite plugin) | Loader/action, SSR, code-splitting, type-safe routes. Adapter: `@react-router/node` chạy trên Bun; nếu adapter Bun chính thức ổn định thì chuyển |
| UI | React 19, TypeScript strict, Tailwind CSS v4, Radix primitives | Typography tối ưu đọc dài; dark mode |
| API | **Hono** trên Bun (tách khỏi web để pipeline/admin/API công khai dùng chung) | OpenAPI qua `@hono/zod-openapi`; web app gọi API qua loader (server-side) |
| Xác thực | Lucia-style session + OAuth (Google/Zalo), RBAC: `reader`, `editor`, `legal_reviewer`, `admin` | |
| CSDL | PostgreSQL 16+, extensions: `pgvector`, `ltree`, `pg_trgm`, `unaccent` | ORM: Drizzle (TS). Python dùng SQLAlchemy chỉ đọc/ghi bảng job và asset |
| Tìm kiếm từ khóa | OpenSearch 2.x + plugin `analysis-icu` + analyzer tiếng Việt (tách từ; ứng viên: `elasticsearch-analysis-vietnamese` port cho OpenSearch, hoặc tiền xử lý tách từ bằng `underthesea`/`pyvi` rồi index) | Đánh giá 2 phương án ở giai đoạn PoC (12-chat-luong) |
| Vector | pgvector HNSW (cosine) | Chuyển Qdrant khi >20M chunk hoặc cần multi-tenant |
| Hàng đợi | pg-boss (TS) ; Python worker poll bảng job qua thư viện nhỏ tự viết hoặc `pgqueuer` | Job có `priority`, `retry`, `dead-letter` |
| Số hóa PDF | TypeScript: MuPDF (WASM) cho lớp văn bản/bbox/ảnh trang, pdf-lib để cắt cụm trang; phần đọc hiểu trang do **agent** làm qua công cụ MCP | Không còn nhánh Python, không cần GPU. Chi tiết 05 |
| LLM | Anthropic SDK (`@anthropic-ai/sdk` cho TS, `anthropic` cho Python). Model: `claude-opus-5` (khó), `claude-sonnet-5` (khối lượng), `claude-haiku-4-5` (phân loại). Batch API + prompt caching | Chi tiết 05, 07, 11 |
| Embedding | Giai đoạn 1: `BAAI/bge-m3` (đa ngữ, dense + sparse, 8192 token) tự host; reranker `bge-reranker-v2-m3` hoặc ViRanker. Đánh giá thêm mô hình tiếng Việt chuyên biệt theo VN-MTEB | Serve bằng TEI (text-embeddings-inference) hoặc vLLM |
| Object storage | Cloudflare R2 (giao thức S3, qua `Bun.S3Client`); tự lùi về thư mục cục bộ khi chưa cấu hình | Tiền tố: `raw`, `pages`, `assets`, `derived`, `work` |
| Cache | Redis (tùy chọn) cho session/rate-limit; giai đoạn 1 dùng Postgres | |
| Quan sát | OpenTelemetry → Grafana stack (Loki, Tempo, Prometheus) | Chi tiết 11 |
| Hạ tầng | Docker Compose (dev/staging) → Kubernetes hoặc Nomad khi scale; GPU node cho OCR/embedding | |

## 3. Cấu trúc monorepo

```
quydinhphapluat/
├── apps/
│   ├── web/                 # React Router v7 (SSR) – site công khai + console biên tập
│   ├── api/                 # Hono trên Bun – REST/OpenAPI
│   └── workers-ts/          # crawler, indexer, consolidation, notifier (pg-boss)
├── services/
│   └── docproc/             # ĐÃ NGƯNG DÙNG — bản Python cũ, giữ để tham chiếu
├── packages/
│   ├── db/                  # Drizzle schema, migrations, seed
│   ├── legal-model/         # kiểu dữ liệu nút, URN, parser cấu trúc, renderer VBHN, diff
│   ├── citation/            # chuẩn hóa & phân giải viện dẫn (text ↔ URN)
│   ├── search-client/       # OpenSearch + vector query builder, hybrid fusion
│   ├── llm/                 # wrapper Anthropic SDK, prompt registry, cost meter, batch helper
│   ├── sohoa/               # số hóa PDF: lớp văn bản, chia cụm, ghép cụm, kiểm chứng
│   ├── storage/             # kho đối tượng R2/cục bộ
│   ├── ui/                  # design system (Tailwind + Radix)
│   └── config/              # tsconfig, eslint, biome
├── infra/                   # docker-compose, k8s manifests, terraform (tùy chọn)
├── evals/                   # bộ dữ liệu vàng và script đánh giá (12)
├── prompts/                 # prompt có phiên bản (YAML), dùng chung TS/Python
└── ke-hoach/                # bộ kế hoạch này
```

Quy ước: Bun workspaces; `bun run --filter`. Toàn bộ mã chạy trên Bun/TypeScript.

## 4. Luồng dữ liệu chính

### 4.1 Nạp văn bản mới (happy path)
1. Crawler phát hiện văn bản mới ở Công báo → tạo `source_record` + tải PDF/DOCX vào S3 → job `ingest`.
2. `ingest`: tính hash, khử trùng lặp, tạo `document` (metadata thô) → job `convert`.
3. `convert`: DOCX/HTML chuyển thẳng trong TypeScript → job `parse`. PDF → job `sohoa` (dựng việc cho agent); agent số hóa xong mới đẩy `parse` (05).
4. `parse` (TS `legal-model`): sinh cây nút, URN cho từng nút, phát hiện văn bản sửa đổi → nếu là văn bản sửa đổi: job `extract-amend-ops`.
5. `extract-amend-ops`: LLM trích lệnh sửa đổi có cấu trúc → hàng đợi duyệt (editor) → sau duyệt: job `consolidate` cho văn bản bị sửa đổi.
6. `consolidate`: sinh phiên bản mới của văn bản bị ảnh hưởng tại ngày hiệu lực; cập nhật trạng thái nút; ghi quan hệ.
7. `index`: OpenSearch + embedding + graph.
8. `notify`: cảnh báo trường hợp ứng dụng / bài đào tạo có căn cứ bị ảnh hưởng (08, 09).

### 4.2 Truy vấn người dùng
- Tra cứu: `GET /search?q=&as_of=&rank=&status=&field=` → hybrid → kết quả cấp nút với ngữ cảnh cha.
- Đọc văn bản: `GET /doc/{urn}?as_of=` → cây nút phiên bản tương ứng + chú thích hợp nhất.
- Hỏi đáp: `POST /ask` → retrieval → Claude với `citations` bắt buộc → câu trả lời + danh sách URN.

## 5. API công khai (rút gọn)

| Endpoint | Mô tả |
|----------|-------|
| `GET /v1/documents/{urn}` | Metadata, trạng thái, quan hệ, danh sách phiên bản |
| `GET /v1/documents/{urn}/content?as_of=&format=md|json|akn` | Nội dung tại thời điểm; export Akoma Ntoso |
| `GET /v1/nodes/{urn}` | Một điều/khoản/điểm với lịch sử sửa đổi |
| `GET /v1/documents/{urn}/diff?from=&to=` | Diff giữa hai thời điểm |
| `GET /v1/search` | Hybrid search |
| `POST /v1/ask` | RAG có trích dẫn |
| `GET /v1/use-cases`, `/v1/courses` | Thư viện ứng dụng và đào tạo |
| `POST /v1/citations/resolve` | Chuỗi viện dẫn → URN |

Phiên bản API theo header; rate limit theo API key.

## 6. Bảo mật và tuân thủ ở tầng kiến trúc
- Toàn bộ nội dung công khai là VBQPPL (không có bản quyền); nội dung do hệ thống biên tập (use case, khóa học) có bản quyền riêng.
- Dữ liệu người dùng: tối thiểu hóa, tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân và Luật Bảo vệ dữ liệu cá nhân (2025); lưu trong nước.
- Tách mạng: workers gọi LLM qua egress proxy có log chi phí; không gửi dữ liệu người dùng vào prompt pipeline offline.
