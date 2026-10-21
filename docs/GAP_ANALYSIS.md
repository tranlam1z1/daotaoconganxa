# PHÂN TÍCH KHOẢNG CÁCH: PRD ↔ MÃ NGUỒN HIỆN TẠI

*Hệ thống học tập, sát hạch và tra cứu nghiệp vụ ứng dụng trí tuệ nhân tạo*

| | |
|---|---|
| Ngày khảo sát | 24/9/2026 |
| Mốc mã nguồn | commit `87b65f0` ("khởi tạo dự án") + các thay đổi chưa commit trong thư mục làm việc |
| Tài liệu đối chiếu | PRD do khách hàng gửi (nội dung dán trực tiếp; **tệp `docs/PRD.md` chưa có trong repo**) |
| Phạm vi | Chỉ đọc, chưa sửa mã |

---

## 0. Tóm tắt nhanh

1. **Mã nguồn hiện tại không phải một hệ thống viết cho PRD này.** Đây là nền tảng **quydinhphapluat.vn**: một dịch vụ công khai để tra cứu, đối chiếu và vận dụng văn bản quy phạm pháp luật, có thêm mô-đun "đào tạo theo chuyên đề". Lĩnh vực đào tạo đầu tiên là *đầu tư CNTT từ ngân sách nhà nước*. Lĩnh vực *giao thông đường bộ cho CSGT* được thêm sau và mới soạn xong một phần.
2. **Phần tra cứu văn bản mạnh hơn PRD yêu cầu.** Văn bản được lưu có cấu trúc đến điều/khoản/điểm, dựng lại theo thời điểm, so sánh được giữa các phiên bản, và có hỏi đáp AI kèm trích dẫn đã kiểm chứng.
3. **Phần sát hạch, trò chơi hóa, đơn vị, báo cáo và PWA hầu như chưa có.** Cụ thể là chưa có:
   - đề thi có tính giờ, trộn đề;
   - điểm, XP, huy hiệu, chuỗi ngày học, bảng xếp hạng;
   - mô hình đơn vị (tổ chức);
   - vai trò *cán bộ quản lý* và việc giao bài;
   - xuất Excel/PDF;
   - PWA, chế độ offline;
   - nhận dạng giọng nói (STT);
   - tra cứu nhanh mức phạt và biển báo.
4. **Công nghệ lệch với PRD.**
   - Backend dùng **Hono trên Bun**, không phải NestJS.
   - Không có FE Admin tách riêng: trang quản trị là nhánh `/quan-tri` trong cùng ứng dụng web SSR.
   - Không có PWA.
5. **Giao diện web đang dựng lại dở dang.** Ở thư mục làm việc, hầu hết các trang (tìm kiếm, đọc văn bản, hỏi đáp, học, ôn tập, quản trị) đã bị thay bằng trang giữ chỗ `PageStub`. Bản chạy được đầy đủ nằm ở commit `HEAD`.
6. **Có lỗ hổng phân quyền cần xử lý trước khi làm demo** (xem §3.4):
   - API duyệt lệnh sửa đổi không yêu cầu đăng nhập;
   - API hỏi đáp AI (tốn phí) mở công khai;
   - API học tập không kiểm tra ghi danh có thuộc về người đang gọi hay không.

---

## 1. Kiến trúc hiện tại

### 1.1. Tổng quan monorepo

Repo dùng Bun workspaces (`package.json`, `bun.lock`) và viết bằng TypeScript. Mã chạy thẳng bằng Bun, không có bước build (trừ web).

```
apps/
  api/          REST API — Hono trên Bun.serve
  web/          Web SSR — React Router v7 (framework mode) + Vite; chứa luôn trang quản trị /quan-tri
  workers-ts/   Crawler + pipeline xử lý văn bản trên BullMQ/Redis
  mcp/          MCP server: cho trợ lý AI tra cứu/biên tập/số hóa, xác thực Google
packages/
  legal-model   Lõi pháp lý: URN, parser cấu trúc, hợp nhất theo thời điểm, diff, thứ bậc hiệu lực
  db            Migration SQL, truy cập dữ liệu (SQL thuần qua postgres.js), seed
  auth          Google Identity, đăng nhập demo, phiên, RBAC
  dao-tao       Logic đào tạo thuần: khối nội dung, chấm điểm, mức thành thạo (BKT), ôn giãn cách (SM-2), lộ trình, thống kê
  llm           Lớp gọi Anthropic (hoặc mock/replay), đo chi phí, kho prompt
  search        Tìm kiếm lai: full-text + trigram + pgvector + khớp viện dẫn
  mascot        Nhân vật đồng hành: định tuyến, chọn hành động, dựng SVG tham số
  citation, queue, storage, sohoa, config
services/docproc  (Python, ĐÃ NGƯNG DÙNG) — bản cũ của bước OCR/chuyển đổi PDF
content/, prompts/, evals/, ke-hoach/, infra/, .do/
```

### 1.2. Từng phân hệ so với cách PRD chia

| Phân hệ PRD | Hiện trạng | Công nghệ |
|---|---|---|
| **Backend** | `apps/api` với các nhóm route: `auth`, `documents`, `nodes`, `search`, `ask`, `citations`, `dao-tao`, `mascot`, `quan-tri`, `editorial` (tiền tố `/v1`) | **Hono 4.9** trên **Bun 1.3**; zod 4 (thông báo lỗi tiếng Việt); postgres.js 3.4 (drizzle-orm có khai báo nhưng truy vấn thực tế là SQL thuần); BullMQ 5 + ioredis |
| **FE Admin** | **Không có ứng dụng riêng.** Trang quản trị là các route `/quan-tri/*` trong `apps/web`, yêu cầu vai trò `bien_tap` trở lên. Ở `HEAD` có: tổng quan, chuyên đề + bảng kiểm trước xuất bản, xưởng soạn bài AI, 4 màn hình nhân vật đồng hành. Ở thư mục làm việc tất cả đều là `PageStub` | React 19, React Router 7 SSR, Tailwind 4 |
| **FE User (Web)** | `apps/web`, gồm: trang chủ, tìm kiếm, đọc văn bản theo thời điểm, thuộc tính, lược đồ quan hệ, phiên bản, so sánh, hỏi đáp AI, trường hợp ứng dụng, danh mục đào tạo, trang bài học, tiến độ, ôn tập, bài vá lỗi, hướng dẫn sử dụng. Mọi lời gọi API chạy phía máy chủ trong loader/action | React Router 7.9 (SSR bật), React 19.1, Tailwind 4.1, Vite 6.3, marked, katex |
| **PWA (Mobile)** | **Chưa có.** Không có manifest, service worker hay cache offline. Web đã responsive (menu hamburger, drawer mục lục, vùng chạm 44px) | — |
| **Mô-đun AI** | `packages/llm` + `apps/api/src/routes/ask.ts` + worker `soan-bai`. Gồm: hỏi đáp RAG có trích dẫn đã kiểm chứng, soạn bài và sinh bài tập vào bản nháp, trích lệnh sửa đổi, số hóa PDF qua MCP | **Anthropic** (tầng heavy/bulk/light = `claude-opus-5` / `claude-sonnet-5` / `claude-haiku-4-5`); embedding **bge-m3** qua TEI (mặc định chạy chế độ `local` dùng băm giả lập, không có ngữ nghĩa); **TTS Vbee**; **không có STT** |
| **Database** | 10 migration SQL trong `packages/db/migrations` | **PostgreSQL 16** + `pgvector`, `ltree`, `pg_trgm`, `unaccent`, `uuid-ossp` |
| **Hạ tầng** | DigitalOcean App Platform (vùng sgp), buildpack Bun: app `qdpl` (web + api + worker + migrate) và app `qdpl-mcp`. Postgres/Valkey dùng dịch vụ managed của DO. Lưu trữ tệp trên Cloudflare R2. CI trên GitHub Actions (typecheck, lint, test, smoke, eval trích dẫn) | Docker Compose chỉ dùng cho dev/test |

### 1.3. Mô hình dữ liệu chính

- **Văn bản:** `documents`, `document_versions`, `nodes` (cây điều/khoản/điểm, URN), `relations`, `amendment_ops` (lệnh sửa đổi phải được duyệt), `embeddings`, `citations`, `review_queue`, cùng các bảng thu thập (`source_records`, `ingest_*`, `corpus_*`, `sohoa_*`).
- **Người dùng:** `accounts` (email, google_sub, `role`, `hosted_domain`, `enabled`), `sessions`, `audit_log`, `mcp_call_log`, `ask_logs`. **Không có bảng đơn vị.**
- **Đào tạo:** chia theo cấp như sau.
  - `fields` (lĩnh vực) → `courses` (chuyên đề). Chuyên đề có quan hệ cha/con (`parent_id`) và nối tiếp (`follows_id`), cùng nhóm đối tượng `khach_hang|tu_van`.
  - Mỗi chuyên đề chứa `lessons` (bài) → `lesson_blocks` (19 loại khối nội dung).
  - `activities` là bài tập, 15 dạng. Mỗi bài tập **gắn cứng với `course_id`**, và `lesson_id` là tùy chọn.
  - `skills` (bản đồ năng lực có điều kiện tiên quyết), `error_tags` (mã lỗi khái niệm).
  - `assessments` có sẵn các trường `pass_score` và `config {so_cau, thoi_gian_phut, xao_cau, xao_phuong_an}`, **nhưng không đoạn mã nào dùng bảng này**.
  - Dữ liệu học của từng người: `enrollments`, `lesson_progress`, `attempts`, `mastery`, `srs_cards`, `learning_events`.
  - Việc soạn bài và cấp chứng nhận: `authoring_jobs`, `certificates`.
- **Nhân vật đồng hành:** 7 bảng `mascot_*`.

### 1.4. Nội dung đang có

- `content/courses/dau-tu-cntt-nsnn`: 12 bài và 6 biểu mẫu về đầu tư CNTT. 10 trường hợp ứng dụng `uc-cntt-*` cũng thuộc lĩnh vực này.
- `packages/db/src/seed-dao-tao-gtdb.ts` (khoảng 3.000 dòng) chứa cây 8 chuyên đề **giao thông đường bộ cho CSGT**, có khoảng 7 bài đã soạn đầy đủ khối nội dung.
  - Văn bản viện dẫn: Luật TTATGTĐB 36/2024, Luật Đường bộ 35/2024, NĐ **168/2024**, NĐ 238/2026 (sửa NĐ 168), các thông tư BCA 69/72/73/2024…
  - Số khối/bài tập theo loại: `trac_nghiem` 7, `ghep_cap` 4, `sap_xep` 2, `the_lat` 6, `kich_ban` 3, `cay_quyet_dinh` 1…
  - **Không có QCVN 41:2024 (biển báo) và không có hình ảnh biển báo nào.**

---

## 2. Bảng đối chiếu yêu cầu PRD ↔ mã nguồn

**Cách đọc:**
- ✅ **Đã có**: có cả backend và giao diện (tính theo `HEAD`).
- 🟡 **Có một phần**: có nền tảng hoặc làm được một phần.
- ❌ **Chưa có**.
- Dấu ⚠️ **UI đang dựng lại** nghĩa là giao diện có ở `HEAD` nhưng ở thư mục làm việc đã bị thay bằng `PageStub`.

### 2.1. Mục đích và phạm vi (PRD §I)

| # | Yêu cầu | Trạng thái | Bằng chứng / ghi chú |
|---|---|---|---|
| I.1a | Hỗ trợ cán bộ tự học pháp luật, luật giao thông, tài liệu chuyên môn | 🟡 | Mô-đun đào tạo đầy đủ; nội dung giao thông mới có ~7 bài hoàn chỉnh (`seed-dao-tao-gtdb.ts`) |
| I.1b | Học theo hướng trò chơi hóa, tương tác | 🟡 | Có 15 dạng bài tập tương tác và nhân vật đồng hành, nhưng **không có** cơ chế game (điểm, cấp độ, màn chơi) |
| I.1c | Lãnh đạo theo dõi, đánh giá bằng số liệu tập trung | 🟡 | Chỉ có thống kê theo chuyên đề/câu hỏi (`/v1/quan-tri/dao-tao/.../thong-ke`); không có theo người, theo đơn vị |
| I.1d | Web User và PWA cực kỳ đơn giản | 🟡 | Web thiên về tra cứu pháp lý chuyên sâu (thời điểm hiệu lực, hợp nhất, lược đồ): nhiều khái niệm, không "cực kỳ đơn giản". PWA chưa có |
| I.2a | Thí điểm lĩnh vực Giao thông | 🟡 | Lĩnh vực `giao-thong-duong-bo` ở trạng thái `bien_tap`; thiếu biển báo, bảng mức phạt |
| I.2b | Mở rộng sang lĩnh vực khác | ✅ | Bảng `fields` + cây chuyên đề, thêm lĩnh vực không cần sửa mã |
| I.2c | Nguồn dữ liệu do đơn vị chuyên môn cung cấp, kiểm duyệt | 🟡 | Pipeline hiện **tự crawl** từ vbpl.vn, congbao.chinhphu.vn, vanban.chinhphu.vn. Có đường nạp tệp và số hóa PDF qua MCP, nhưng **không có màn hình tải tài liệu lên cho quản trị viên** |
| I.2d | AI soạn giáo trình từ tài liệu (NĐ 168, QCVN 41…) | 🟡 | Worker `soan-bai` và xưởng `/quan-tri/soan-bai-ai` soạn dàn ý → bài → bài tập → rubric → soát, rồi đưa vào bản nháp. Chỉ soạn được từ văn bản **đã nằm trong kho** (URN); QCVN 41 chưa có trong kho |
| I.3a | Vai trò Quản trị viên | ✅ | Vai trò `quan_tri` |
| I.3b | Vai trò Cán bộ quản lý (giao bài, theo dõi đơn vị) | ❌ | Không có vai trò, không có đơn vị, không có giao bài |
| I.3c | Vai trò Cán bộ, chiến sĩ | 🟡 | Người học hiện dùng vai trò `khach` hoặc `tra_cuu`; không có hồ sơ cán bộ (cấp bậc, chức vụ, đơn vị) |

### 2.2. Kiến trúc (PRD §II)

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| II.1 | Backend **NestJS** | ❌ | Dùng **Hono + Bun** (xem §3.1) |
| II.2 | **PostgreSQL** | ✅ | PostgreSQL 16 + pgvector |
| II.3 | API dùng chung cho các phân hệ | ✅ | `apps/api` REST `/v1`, định dạng lỗi thống nhất |
| II.4 | **FE Admin ReactJS** riêng | 🟡 | Có React nhưng nằm chung ứng dụng SSR với web người dùng ⚠️ UI đang dựng lại |
| II.5 | FE User Web định hướng hàn lâm | ✅ ⚠️ | Đúng định hướng (đọc văn bản, tra cứu, ôn luyện) |
| II.6 | **PWA** cài được iOS/Android, định hướng trò chơi | ❌ | Không có manifest, service worker |
| II.7 | Mô-đun AI: hỏi – đáp theo văn bản | ✅ ⚠️ | `POST /v1/ask`: có kiểm chứng URN còn hiệu lực, từ chối khi thiếu căn cứ |
| II.8 | Mô-đun AI: sinh câu hỏi tự động | 🟡 | Bước `sinh_bai_tap` trong worker `soan-bai`, kết quả vào bản nháp chờ biên tập |
| II.9 | Mô-đun AI: hỗ trợ giọng nói | 🟡 | Chỉ có **TTS (Vbee)** cho lời thoại nhân vật; **không có STT** |

### 2.3. Phân hệ quản trị (PRD §III.1)

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| 1.1a | Quản lý văn bản theo lĩnh vực, hiệu lực, phiên bản | 🟡 | Backend rất mạnh: phiên bản, trạng thái hiệu lực, hợp nhất theo thời điểm, hàng đợi biên tập. **Không có màn hình quản trị văn bản** (thêm, sửa, gắn lĩnh vực); thao tác qua CLI, crawler, MCP. Văn bản chỉ được phân loại theo *pháp điển* (`taxonomy`), chưa gắn trực tiếp với `fields` |
| 1.1b | Ngân hàng câu hỏi ~1.000 câu, phân loại chủ đề / mức độ / loại | 🟡 | `activities` có `kind` (loại), `difficulty` (0–1), `skills`, `error_tags`, thống kê độ khó và độ phân biệt (`/ngan-hang`). Nhưng câu hỏi **gắn cứng vào chuyên đề**, không phải một ngân hàng độc lập; không có mức độ kiểu Nhận biết/Thông hiểu/Vận dụng; không có nhập hàng loạt từ Excel |
| 1.1c | Quản lý người dùng, **đơn vị**, phân quyền | 🟡 / ❌ | Có tài khoản và 5 vai trò, nhưng chỉ đổi vai trò được qua công cụ MCP `quan_ly_tai_khoan`; **không có màn hình quản lý người dùng**. **Không có đơn vị** |
| 1.2a | Câu hỏi phải được **duyệt** trước khi dùng | 🟡 | Có quy trình trạng thái `nhap → … → cho_phap_che → xuat_ban`, nhưng duyệt **theo bài/chuyên đề**, không theo từng câu hỏi |
| 1.2b | Tạo bài giảng | ✅ ⚠️ | API đầy đủ: lưu bài, khối, sắp xếp khối, bảng kiểm trước xuất bản, bộ kiểm tra hành văn. UI quản trị ở `HEAD` mới có danh sách và bảng kiểm, **chưa có trình soạn khối** |
| 1.2c | Tạo đề thi | ❌ | Bảng `assessments` có sẵn nhưng không có API/UI |
| 1.2d | Trộn đề, đảo câu, đảo đáp án | ❌ | Chỉ có các trường cấu hình `xao_cau`, `xao_phuong_an` trong `assessments.config`, chưa có mã xử lý |
| 1.2e | Cấu hình số câu (30–40), thời gian, ngưỡng đạt | ❌ | Như trên (`so_cau`, `thoi_gian_phut`, `pass_score`), chưa dùng |
| 1.3a | Báo cáo điểm, thời gian làm bài, số lần thực hiện | 🟡 | Dữ liệu thô có đủ (`attempts.score`, `seconds_spent`, `attempt_no`). Chỉ có thống kê gộp theo chuyên đề, không có báo cáo theo người học |
| 1.3b | Xếp hạng cá nhân và đơn vị | ❌ | Không có (trang tiến độ còn **cố ý** không có bảng xếp hạng) |
| 1.3c | Xuất Excel/PDF | ❌ | Không có thư viện hay endpoint xuất |

### 2.4. Phân hệ học tập (PRD §III.2)

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| 2.1a | Học bài giảng do CA cung cấp hoặc AI tạo | ✅ ⚠️ | Bài có trường `source = nguoi | ai | ai_da_sua` |
| 2.1b | Hình thức: **chơi game** | 🟡 | Có bài tập tương tác (xem §2.6), không có game đúng nghĩa |
| 2.1c | Hình thức: **xem slide** | ❌ | Bài học hiển thị dạng trang cuộn gồm các khối, không có chế độ trình chiếu |
| 2.1d | Hình thức: **sách nói** | 🟡 | TTS Vbee đã tích hợp (`/v1/mascot/giong-doc`) nhưng chỉ đọc lời thoại nhân vật, chưa đọc cả bài |
| 2.1e | Chuỗi màn chơi, qua màn trước mới mở màn sau | ❌ | Bài học **không khóa**: mọi bài đã xuất bản đều mở được. Hàm mở khóa kỹ năng theo tiên quyết (`kyNangDaMo`) có trong `packages/dao-tao` nhưng không route nào gọi |
| 2.1f | Điểm, huy hiệu, chuỗi ngày học, bảng xếp hạng cá nhân/đơn vị | ❌ | Chỉ có trường `activities.points` và mục tiêu số phút mỗi tuần |
| 2.1g | Hỏi – đáp bằng **giọng nói** với AI | ❌ | Không có STT; hỏi đáp AI chỉ nhận văn bản |
| 2.1h | Học ngắn 5–10 phút mỗi lượt | 🟡 | Có chế độ học `nhanh`, phiên ôn tập khoảng 5 phút; thời lượng mặc định của một bài là 15 phút |
| 2.1i | Thông báo nhắc học, thử thách mới | ❌ | Không có push, email hay lịch nhắc; chỉ có nhân vật đồng hành nhắc trong trang |
| 2.2a | Thư viện văn bản: đọc, tìm kiếm | ✅ ⚠️ | Đọc theo thời điểm, mục lục, chú thích hợp nhất, sao chép trích dẫn; tìm kiếm lai có bộ lọc |
| 2.2b | Thư viện: **đánh dấu, ghi chú theo điều khoản** | ❌ | Không có bảng hay UI bookmark/ghi chú cá nhân |
| 2.2c | Tra cứu nhanh **mức xử phạt**, hình thức bổ sung **theo tốc độ** | ❌ | Chỉ tra được bằng tìm kiếm văn bản hoặc khối `bang_tra` trong bài. Không có dữ liệu có cấu trúc kiểu hành vi → mức phạt → trừ điểm → hình thức bổ sung |
| 2.2d | Tra cứu nhanh **biển báo** | ❌ | Không có QCVN 41, không có ảnh biển báo |
| 2.2e | Tra cứu **quy trình xử lý vi phạm/tai nạn theo từng bước** | 🟡 | Có khối `so_do_trinh_tu` trong bài học, không có mục tra cứu độc lập |
| 2.2f | Hỏi – đáp AI dựa trên văn bản gốc, trích dẫn điều khoản | ✅ ⚠️ | Điểm mạnh nhất của hệ thống; có ghi nhật ký chi phí (`ask_logs`) |
| 2.3a | Ôn luyện theo chủ đề | 🟡 | Có bài tập trong bài và phiên ôn giãn cách theo ghi danh; chưa có kiểu "rút ngẫu nhiên N câu của chủ đề X" |
| 2.3b | Thi sát hạch theo đề được giao, có tính giờ | ❌ | Không có đề thi, giao bài hay đồng hồ đếm ngược |
| 2.3c | Lịch sử học tập, kết quả | 🟡 ⚠️ | Có trang tiến độ theo chuyên đề và các bản ghi `attempts`; không có lịch sử các lượt thi |
| 2.3d | Câu sai để ôn lại | ✅ ⚠️ | Câu trả lời sai tự tạo thẻ ôn (SM-2), có bài "vá lỗi" theo mã lỗi khái niệm |
| 2.3e | **Offline vẫn học được** | ❌ | Kiến trúc SSR gọi API phía máy chủ, không có cache phía client |

### 2.5. Phi chức năng, bảo mật (PRD §IV)

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| IV.1 | Máy chủ có Internet, dùng dịch vụ AI | ✅ | DigitalOcean + Anthropic + Vbee + R2 |
| IV.2 | Làm bài tập và tra cứu là quan trọng nhất | 🟡 | Tra cứu mạnh; làm bài tập có, nhưng thiếu thi sát hạch |
| IV.3a | Xác thực người dùng | 🟡 | Google Identity + **một mật khẩu demo dùng chung**; không có tài khoản/mật khẩu riêng cho từng người |
| IV.3b | Phân quyền theo vai trò | 🟡 | Có RBAC 5 bậc, nhưng một số API bỏ sót kiểm tra quyền (§3.4) |
| IV.3c | Nhật ký truy cập và thao tác | 🟡 | `audit_log` ghi thay đổi quản trị, `mcp_call_log`, `ask_logs`, `learning_events`. **Không** có nhật ký truy cập API và đăng nhập (chỉ có `last_login_at`) |
| IV.4a | Giao diện tiếng Việt | ✅ | Toàn bộ tiếng Việt, có bộ quy tắc hành văn được kiểm tự động trong CI |
| IV.4b | Đáp ứng máy tính và điện thoại | ✅ | Tailwind responsive |
| IV.4c | PWA hoạt động khi mạng yếu/offline | ❌ | |
| IV.5 | Tra cứu thông thường < 3 giây | 🟡 | Chưa đo. Tìm kiếm chạy trong Postgres nên có khả năng đạt; embedding mặc định là băm giả lập, chuyển sang bge-m3 sẽ thêm độ trễ gọi TEI. Hỏi đáp AI (Opus + suy luận) chắc chắn vượt 3 giây |

### 2.6. 20 trò chơi (PRD §V) ↔ dạng bài tập/khối đang có

| # | Trò chơi | Trạng thái | Nền tảng có thể tái dụng |
|---|---|---|---|
| 1 | Thử thách vượt màn | ❌ | Có câu hỏi; thiếu cơ chế màn và khóa màn |
| 2 | Đua thời gian 60 giây | ❌ | — |
| 3 | Ai là triệu phú nghiệp vụ | ❌ | Có `difficulty` để xếp câu tăng dần |
| 4 | Đoán biển báo | ❌ | Không có dữ liệu biển báo |
| 5 | Ghép cặp lỗi – mức phạt | 🟡 | Bài tập `ghep_cap` (chấm máy) |
| 6 | Sắp xếp quy trình | 🟡 | Bài tập `sap_xep` (chấm bằng Kendall tau, có phương án thay kéo thả bằng bàn phím) |
| 7 | Đúng hay sai | 🟡 | `dung_sai` có, nhưng mặc định **chấm bằng AI**, mà chấm AI **chưa được cài đặt** (`cham-ai.ts` không tồn tại) |
| 8 | Tình huống hiện trường phân nhánh | 🟡 | Bài tập `phan_nhanh`, khối `cay_quyet_dinh`, `kich_ban` |
| 9 | Ô chữ pháp luật | ❌ | — |
| 10 | Lật thẻ ghi nhớ (tìm cặp) | 🟡 | Khối `the_lat` (lật thẻ), chưa có luật chơi tìm cặp |
| 11 | Điền vào chỗ trống | 🟡 | Bài tập `dien_khuyet` (so khớp không phân biệt dấu) |
| 12 | Thẻ ghi nhớ thông minh (lặp lại ngắt quãng) | ✅ ⚠️ | SM-2, ưu tiên câu sai, tự tạm dừng thẻ khi căn cứ pháp lý thay đổi |
| 13 | Đấu trí đối kháng thời gian thực | ❌ | Không có WebSocket hay ghép cặp người chơi |
| 14 | Thi đua đơn vị | ❌ | Không có đơn vị |
| 15 | Hỏi nhanh bằng giọng nói | 🟡 | Có TTS để đọc câu hỏi; thiếu STT |
| 16 | Thử thách hằng ngày, chuỗi ngày học | ❌ | — |
| 17 | Tìm lỗi vi phạm qua ảnh/video | ❌ | `soi_loi` là soi lỗi trên văn bản, chấm AI (chưa cài đặt); khối `diem_nong`/`video` có khai báo kiểu |
| 18 | Vòng quay kiến thức | ❌ | — |
| 19 | Phân loại nhanh (kéo thả vào nhóm) | 🟡 | `keo_tha_so_do`, `ghep_cap` |
| 20 | Nhập vai cán bộ tuần tra | 🟡 | Khối `kich_ban`, bài tập `phan_nhanh`; thiếu chuỗi tình huống có chấm điểm tổng hợp |

Nhận xét: phần "ruột" của khoảng 8/20 trò chơi (câu hỏi, cách chấm) đã có. Phần "vỏ game" thì chưa: màn chơi, đồng hồ, điểm, âm thanh, hiệu ứng, bảng xếp hạng.

---

## 3. Những chỗ mã hiện tại mâu thuẫn với PRD

### 3.1. Sai công nghệ

| # | PRD | Mã hiện tại | Mức độ |
|---|---|---|---|
| C1 | Backend **NestJS** | **Hono 4 + Bun**, không DI container, không decorator, validation bằng zod, SQL thuần. Chuyển sang NestJS nghĩa là **viết lại lớp API**; lõi nghiệp vụ trong `packages/*` là TypeScript thuần nên phần lớn tái dùng được (nếu chạy trên Node thì phải thay `Bun.S3Client`, `Bun.serve`…) | **Cao** — cần quyết định sớm |
| C2 | **FE Admin ReactJS** là phân hệ riêng | Quản trị nằm chung ứng dụng SSR với web người dùng (`/quan-tri`), cùng phiên đăng nhập, cùng bản build | Trung bình |
| C3 | **PWA** cho mobile, học được offline | Kiến trúc **SSR-first**: loader gọi API phía máy chủ, cookie HttpOnly, không có client loader hay service worker. Muốn offline phải thêm lớp dữ liệu phía client (IndexedDB, đồng bộ kết quả) hoặc làm PWA thành ứng dụng SPA riêng | **Cao** |
| C4 | Hỗ trợ hỏi – đáp bằng giọng nói | Chỉ có TTS (Vbee) một chiều | Trung bình |
| C5 | Runtime ngầm hiểu là Node.js (do chọn NestJS) | Toàn bộ repo phụ thuộc Bun (`bun test`, `Bun.S3Client`, buildpack Bun trên DO) | Trung bình |

### 3.2. Sai định hướng sản phẩm

| # | PRD | Mã hiện tại |
|---|---|---|
| P1 | Hệ thống **nội bộ** cho cán bộ, chiến sĩ CA | Nền tảng **công khai** quydinhphapluat.vn: tra cứu không cần đăng nhập, người đăng nhập đầu tiên thành quản trị, người sau nhận vai trò `khach` |
| P2 | Lĩnh vực thí điểm: **Giao thông** | Lĩnh vực chính là **đầu tư CNTT/NSNN**. Toàn bộ `content/courses`, `content/use-cases` và nhiều prompt, eval, hướng dẫn sử dụng đều viết cho lĩnh vực đó |
| P3 | **Trò chơi hóa**: điểm, huy hiệu, bảng xếp hạng, màn chơi | Triết lý thiết kế ngược lại: trang tiến độ **cố ý không có bảng xếp hạng**; bài học không khóa; tạo động lực bằng nhân vật đồng hành, mức thành thạo và ôn giãn cách |
| P4 | Học ngắn, **cực kỳ đơn giản** | Thiết kế hàn lâm pháp lý: mọi màn hình xoay quanh `asOf` (thời điểm hiệu lực), hợp nhất, thứ bậc văn bản, 19 loại khối, 4 chế độ học, rubric có tiêu chí căn cứ bắt buộc |
| P5 | Đối tượng là **cán bộ, chiến sĩ** theo đơn vị | Đối tượng là `khach_hang` (người áp dụng) / `tu_van` (người tư vấn). Nhân vật đồng hành, lời thoại và giọng điệu viết cho người học dân sự |
| P6 | Nguồn dữ liệu **do đơn vị chuyên môn cung cấp** | Nguồn chính là **crawler** các cổng văn bản công khai; có hàng đợi biên tập, nhưng không có luồng "đơn vị gửi tài liệu → duyệt" |

### 3.3. Sai cấu trúc dữ liệu

| # | PRD cần | Mô hình hiện tại | Hệ quả |
|---|---|---|---|
| D1 | **Đơn vị** (xếp hạng, thi đua, báo cáo theo đơn vị; cán bộ quản lý xem đơn vị mình) | Không có bảng hay cột đơn vị; `accounts` chỉ có `hosted_domain` | Phải thêm bảng đơn vị (dạng cây) và liên kết tài khoản với đơn vị |
| D2 | 3 vai trò nghiệp vụ: Quản trị viên / Cán bộ quản lý / Cán bộ, chiến sĩ | 5 vai trò **biên tập nội dung** theo bậc tuyến tính: `khach < tra_cuu < bien_tap < phap_che < quan_tri` | Không biểu diễn được "quản lý đơn vị X"; quyền cần gắn **theo phạm vi đơn vị**, không chỉ theo bậc |
| D3 | **Ngân hàng câu hỏi** độc lập, phân loại chủ đề / mức độ / loại, duyệt **từng câu** | `activities.course_id NOT NULL`; mức độ là số thực `difficulty`; duyệt theo bài | Câu hỏi không dùng chung được giữa đề thi và chuyên đề; không đếm được "1.000 câu đã duyệt" |
| D4 | **Đề thi** được giao, có phiên bản trộn cho từng người, tính giờ | `assessments` gắn với chuyên đề + `level` + `after_lesson_id`; không có bảng đề đã sinh, bảng giao đề, bảng lượt thi | Cần thêm các bảng: đề thi, ma trận đề, lượt giao (người/đơn vị/hạn), lượt thi (thời điểm bắt đầu/nộp, thứ tự câu/đáp án đã đảo) |
| D5 | Kết quả gắn với **người dùng** | Mọi bản ghi học tập (`attempts`, `mastery`, `srs_cards`, `lesson_progress`) gắn với **`enrollment`** (ghi danh một chuyên đề) | Báo cáo theo người phải đi vòng qua ghi danh; bài thi không thuộc chuyên đề thì không có chỗ lưu |
| D6 | Điểm, XP, huy hiệu, chuỗi ngày, bảng xếp hạng | Không có bảng nào | Cần thêm sổ điểm, huy hiệu, streak, bảng xếp hạng theo kỳ |
| D7 | Đánh dấu, ghi chú theo điều khoản | Không có | Cần bảng bookmark/ghi chú theo `node_urn` + người dùng |
| D8 | Dữ liệu tra cứu nhanh (mức phạt, biển báo, quy trình) | Chỉ có văn bản dạng cây `nodes` | Cần dữ liệu có cấu trúc riêng, có trích dẫn về `node_urn` |
| D9 | Tài khoản cho cán bộ (nhiều khả năng không dùng Google) | `accounts.email UNIQUE NOT NULL`, đăng nhập bằng Google hoặc mật khẩu demo chung | Cần tài khoản tên đăng nhập/mật khẩu riêng hoặc SSO nội bộ, và nhập danh sách hàng loạt |

### 3.4. Lỗi bảo mật trái với PRD §IV (xác thực, phân quyền)

Các lỗi dưới đây đã được kiểm tra lại trực tiếp trong mã:

| # | Vị trí | Vấn đề |
|---|---|---|
| S1 | `apps/api/src/routes/editorial.ts` (mount tại `app.ts`: `app.route("/v1", editorial)`) | **Không có kiểm tra quyền.** Ai cũng gọi được `POST /v1/amend-ops/:id/approve`, `/reject`, `/review-queue/:id/resolve`; `reviewerId` lấy từ body. Kẻ xấu có thể làm sai lệch nội dung văn bản hợp nhất |
| S2 | `apps/api/src/routes/ask.ts` | `POST /v1/ask` không yêu cầu đăng nhập, không giới hạn tần suất, mà gọi mô hình tốn phí (PRD ghi rõ "mất phí API") |
| S3 | `apps/api/src/routes/dao-tao.ts` | Chỉ kiểm tra "đã đăng nhập", không kiểm tra ghi danh `:id` có thuộc người gọi. Người A có thể đọc tiến độ hoặc nộp bài thay người B, điều không chấp nhận được với thi sát hạch |
| S4 | `packages/auth/src/demo.ts` | Đăng nhập demo bằng **một mật khẩu chung** có thể vào thẳng tài khoản `quan_tri` |
| S5 | `apps/api/src/app.ts:36` | CORS chỉ cho `GET, POST, OPTIONS` trong khi API có `PATCH/PUT/DELETE`. Hiện chưa lộ lỗi vì web gọi API từ phía máy chủ, nhưng sẽ hỏng khi PWA hoặc FE Admin gọi thẳng API từ trình duyệt |

### 3.5. Hiện trạng dở dang cần lưu ý

- **Giao diện web đang dựng lại.** Ở thư mục làm việc có 57 tệp bị xóa (staged) và các tệp mới chưa theo dõi. Mọi trang chức năng đều là `PageStub`; các thành phần bài tập (`BaiTap.tsx`), nhân vật đồng hành, TTS, đọc văn bản đều đã xóa. Muốn xem hệ thống chạy đầy đủ phải dùng `HEAD`.
- **Chấm bài bằng AI chưa có.** 6/15 dạng bài tập mặc định chấm AI (`dung_sai`, `soi_loi`, `dien_bieu_mau`, `viet_co_can_cu`, `dong_vai_hoi_dong`, `phan_bien`). Hiện các dạng này được lưu với điểm 0 và chờ chấm tiếp. Prompt `prompts/dao-tao/cham-tu-luan.md` đã có nhưng chưa được nạp.
- **Tạo ảnh nhân vật chưa gọi mô hình ảnh thật.** Worker `mascot-anh` chỉ sinh prompt văn bản và ảnh SVG tham chiếu.
- **Embedding mặc định là băm giả lập** (`EMBEDDING_PROVIDER=local`), nên tìm kiếm theo ngữ nghĩa chưa thực sự hoạt động khi chưa chạy TEI/bge-m3.

---

## 4. Những điểm PRD còn mơ hồ cần làm rõ

### 4.1. Quyết định nền tảng (ảnh hưởng lớn nhất, cần trả lời trước)

1. **NestJS là bắt buộc** (hồ sơ thầu, quy định của đơn vị, đội vận hành) **hay chỉ là gợi ý?** Nếu không bắt buộc, có chấp nhận giữ Hono + Bun không? Việc này quyết định giữ hay viết lại toàn bộ lớp API.
2. **Quan hệ với nền tảng quydinhphapluat.vn:** tách một bản riêng (fork) cho CA, hay dùng chung một hệ thống nhiều đơn vị (multi-tenant)? Có giữ các chức năng ngoài PRD không: nhân vật đồng hành, hợp nhất theo thời điểm, so sánh phiên bản, lược đồ quan hệ, MCP, chứng nhận, trường hợp ứng dụng, lĩnh vực đầu tư CNTT? Giữ ẩn, giữ hiện hay gỡ bỏ?
3. **FE Admin có bắt buộc là ứng dụng tách riêng** (triển khai, tên miền riêng) không, hay được phép là một khu vực trong cùng ứng dụng web?
4. **Web User và PWA:** một bản mã chung với hai giao diện (hàn lâm / game), hay hai ứng dụng riêng? PWA có cần đầy đủ tra cứu văn bản không, hay chỉ học nhanh và game?
5. **Hạ tầng:** máy chủ Internet thương mại (DigitalOcean Singapore như hiện nay) có được chấp nhận với đơn vị CA không? Có yêu cầu đặt máy chủ trong nước, cấp độ an toàn thông tin (theo NĐ 85/2016), hay tên miền `.gov.vn`/nội bộ không?

### 4.2. Tổ chức, người dùng, phân quyền

6. **Cấu trúc đơn vị** có bao nhiêu cấp (ví dụ Cục → Phòng → Đội → Tổ)? Một cán bộ thuộc một hay nhiều đơn vị? Có thông tin cấp bậc, chức vụ, số hiệu không?
7. **Cán bộ quản lý** được xem và giao bài cho **đơn vị mình** hay **cả các đơn vị cấp dưới**? Có được sửa nội dung, câu hỏi không?
8. **Cách đăng nhập** của cán bộ, chiến sĩ: tài khoản do quản trị cấp (tên đăng nhập/mật khẩu), SSO nội bộ, VNeID hay Google? Có cần **nhập danh sách người dùng từ Excel** không?
9. Có cần tách vai trò **biên tập/duyệt nội dung** khỏi Quản trị viên không? Mã hiện có tách `bien_tap` (soạn) và `phap_che` (duyệt); PRD gộp chung vào Quản trị viên.

### 4.3. Ngân hàng câu hỏi và đề thi

10. "Câu hỏi **(chỉ áp dụng với dữ liệu công khai)**" nghĩa là gì? Có loại dữ liệu mật hoặc nội bộ bị loại khỏi hệ thống, hay chỉ câu hỏi từ văn bản công khai mới được AI sinh?
11. **Mẫu câu hỏi KH gửi** gồm những dạng nào: chỉ trắc nghiệm 4 phương án, hay có Đúng/Sai, nhiều đáp án, có hình ảnh? Thang **mức độ** là gì (Dễ/Trung bình/Khó, hay Nhận biết/Thông hiểu/Vận dụng)?
12. **Duyệt câu hỏi** một cấp hay hai cấp? Ai duyệt? Câu do AI sinh có cần quy trình khác câu do người soạn không?
13. **Đề thi** là đề cố định do người soạn chọn câu, hay sinh ngẫu nhiên theo **ma trận** (số câu theo chủ đề × mức độ)? "Trộn đề" nghĩa là mỗi người một đề khác nhau, hay vài mã đề?
14. **Giao bài/giao đề:** giao cho cá nhân, đơn vị hay nhóm? Có hạn nộp không? Được làm lại mấy lần, lấy điểm cao nhất hay lần cuối?
15. **Thang điểm** (10 hay 100) và **ngưỡng đạt** mặc định? Khi mất mạng hoặc đóng trình duyệt giữa giờ thi thì xử lý thế nào? Có cần chống gian lận (chặn chuyển tab, xáo thứ tự, giới hạn thiết bị) không?
16. **Thi sát hạch có được làm offline không**, hay chỉ ôn luyện mới được offline?

### 4.4. Học tập và trò chơi hóa

17. **"Bài giảng"** cụ thể là gì? "Xem slide" là slide do AI sinh từ nội dung bài, hay tệp PowerPoint/PDF đơn vị tải lên? "Sách nói" là đọc TTS toàn bài, hay tệp ghi âm có sẵn?
18. **"Màn chơi"** tương ứng với bài học, chủ đề hay một bộ 10 câu? Ngưỡng qua màn là bao nhiêu?
19. **Công thức điểm/XP, danh sách huy hiệu, cách lên cấp**: KH có yêu cầu cụ thể, hay đội dự án tự đề xuất? PRD ghi "cần đề xuất thêm yếu tố" và "danh sách trò chơi chưa hay, cần đề xuất lại". **Ai duyệt danh sách mới, và demo cần bao nhiêu trò?**
20. **Bảng xếp hạng** hiển thị họ tên thật hay biệt danh? Phạm vi (đơn vị mình hay toàn hệ thống) và chu kỳ (tuần, tháng, mùa)?
21. **Thông báo nhắc học** qua kênh nào: Web Push (iOS chỉ hỗ trợ từ 16.4 và phải cài PWA ra màn hình chính), email, SMS hay Zalo?
22. **Offline cụ thể** gồm những gì: đọc bài, làm bài tập, chơi game, đọc văn bản? Kết quả làm offline có được tính điểm và xếp hạng khi đồng bộ lại không?

### 4.5. Tra cứu nhanh và AI

23. **"Hình thức xử phạt bổ sung theo tốc độ"** nghĩa là bảng tra theo khoảng vượt tốc độ (5–10, 10–20, 20–35, trên 35 km/h) × loại phương tiện? Có cần tra theo **trừ điểm giấy phép lái xe** không? Ai xây và duyệt bảng dữ liệu này (đội dự án trích từ NĐ 168/2024 + NĐ 238/2026, hay đơn vị cung cấp)?
24. **Biển báo:** nguồn hình ảnh (phụ lục QCVN 41:2024/BGTVT) và bản quyền sử dụng? Cần đủ khoảng 400+ biển hay chỉ nhóm phổ biến?
25. **Quy trình xử lý vi phạm/tai nạn:** căn cứ văn bản nào (thông tư BCA về tuần tra kiểm soát, điều tra giải quyết tai nạn)? Có tài liệu nghiệp vụ nội bộ nào **không được đưa lên máy chủ Internet** không?
26. **Đánh dấu/ghi chú** là riêng từng người, hay có ghi chú chung do đơn vị soạn?
27. **Hỏi đáp bằng giọng nói:** cần nhận dạng giọng vùng miền không? Nhà cung cấp STT/TTS ưu tiên (Vbee đang dùng, FPT.AI, Viettel AI, Google)? Có ràng buộc không gửi âm thanh ra dịch vụ nước ngoài không?
28. **Chi phí AI:** ai chịu, ngân sách tháng bao nhiêu? Có giới hạn số câu hỏi AI mỗi người mỗi ngày không? Tính năng nào được dùng AI (hỏi đáp, sinh câu hỏi, chấm tự luận)?
29. **"Tài liệu do KH gửi hoặc lấy trên mạng"**: KH gửi dưới định dạng nào (Word, PDF scan, PDF có lớp chữ)? Ai là người tải lên hệ thống?

### 4.6. Báo cáo, phi chức năng, lộ trình

30. **Mẫu báo cáo** cụ thể (cột, bộ lọc, kỳ báo cáo)? KH có biểu mẫu Excel/PDF sẵn không?
31. **Nhật ký truy cập và thao tác:** cần ghi những hành động nào, lưu bao lâu, ai được xem?
32. **"Dưới 3 giây"** áp dụng cho những thao tác nào? Hỏi đáp AI có được miễn không (với mô hình hiện tại thường mất 10–30 giây)?
33. **Quy mô:** tổng số người dùng dự kiến, số người thi đồng thời lớn nhất (ảnh hưởng thiết kế ca thi)?
34. **Phạm vi Demo (Bước 1 lộ trình):** những chức năng nào bắt buộc có trong demo, và thời hạn? Demo có cần dữ liệu thật (1.000 câu) hay chỉ mẫu?

---

## 5. Nhận định và đề xuất hướng xử lý (để thảo luận, chưa triển khai)

- **Tái dùng được nhiều:** lõi văn bản pháp luật (`legal-model`, `search`, `citation`, `ask`), pipeline nạp và số hóa văn bản, logic chấm bài và ôn giãn cách (`dao-tao`), TTS, nội dung giao thông đã soạn. Đây đều là phần khó, và đang làm tốt hơn mức PRD yêu cầu.
- **Phải xây mới** (không phụ thuộc vào việc giữ hay đổi backend):
  - đơn vị và phân quyền theo phạm vi;
  - ngân hàng câu hỏi độc lập có duyệt từng câu;
  - đề thi, giao bài, lượt thi tính giờ;
  - trò chơi hóa (điểm, XP, huy hiệu, streak, bảng xếp hạng);
  - báo cáo và xuất Excel/PDF;
  - PWA offline;
  - STT;
  - dữ liệu tra cứu nhanh (mức phạt, biển báo, quy trình);
  - bookmark và ghi chú.
- **Nên làm ngay bất kể hướng nào:** vá S1–S3 ở §3.4, và quyết định dừng hay hoàn tất đợt dựng lại giao diện đang dở dang để có bản chạy được làm nền cho demo.
- **Câu hỏi 1–5 ở §4.1 quyết định phần lớn khối lượng công việc.** Nên chốt các câu này trước khi lập kế hoạch chi tiết.
