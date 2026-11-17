# KẾ HOẠCH SỬA MÃ THEO GIAI ĐOẠN

*Dựa trên [GAP_ANALYSIS.md](GAP_ANALYSIS.md). Lập ngày 24/9/2026. Chưa triển khai.*

---

## 0. Nguyên tắc chung

### 0.1. Thứ tự ưu tiên

PRD §IV xếp **làm bài tập** và **tra cứu** lên đầu, và yêu cầu giao diện **cực kỳ đơn giản**. Kế hoạch đi theo thứ tự đó:

1. Nền móng và vá bảo mật: bắt buộc trước mọi thứ.
2. **Tra cứu**, rồi tài khoản và đơn vị, **ngân hàng câu hỏi**, **luyện tập**, **tra cứu nhanh**, **thi sát hạch**.
3. Báo cáo cho lãnh đạo.
4. Bài giảng, biển báo, PWA offline, giọng nói, nhắc học.

### 0.2. Mỗi giai đoạn phải "chạy được, kiểm thử được"

Một giai đoạn tương đương một nhánh và một PR, và chỉ được gộp khi qua đủ **cổng chung** sau:

```bash
bun run db:migrate          # migration mới áp dụng sạch trên CSDL trống và CSDL đang có dữ liệu
bun run typecheck
bun run lint
bun test                    # CSDL test riêng, tự tạo qua packages/db/src/test-setup.ts
bun run build:web
bun run smoke
```

Cộng thêm các mục **"Kiểm tra đã xong"** riêng của từng giai đoạn.

Quy ước kiểm thử, đi theo cách repo đang làm:

| Lớp | Cách kiểm | Ví dụ có sẵn |
|---|---|---|
| Logic thuần (`packages/*`) | `bun test`, không cần CSDL | `packages/dao-tao/tests/grading.test.ts` |
| API | `createApp().request(...)` trên Postgres test thật | `apps/api/src/dao-tao.test.ts` |
| Web | typecheck, build, rồi kịch bản trình duyệt bằng `playwright-core` (đã có trong devDependencies) cho các luồng chính | *(tạo mới ở GĐ4: `scripts/e2e/`)* |
| Giao diện đơn giản | Soát tay ở **bề rộng 360px**, theo bảng kiểm §0.4 | — |

### 0.3. Giả định đang dùng

Các câu hỏi ở GAP_ANALYSIS §4 chưa có trả lời. Kế hoạch tạm dùng giả định bên dưới, chọn sao cho **ít phải làm lại nhất nếu câu trả lời khác đi**.

| # | Giả định | Nếu câu trả lời khác |
|---|---|---|
| A1 | **Giữ Hono + Bun** cho backend (câu hỏi 4.1-1) | Nếu NestJS là bắt buộc: chèn giai đoạn **"GĐ-N: Chuyển lớp API sang NestJS"** ngay sau GĐ0. Logic nghiệp vụ mới đều viết trong `packages/*` (TypeScript thuần, không phụ thuộc Hono), nên chỉ phải viết lại lớp route mỏng. Cần thay `Bun.serve`, `Bun.S3Client`, `Bun.password` nếu chuyển sang Node |
| A2 | Quản trị vẫn là khu `/quan-tri` trong `apps/web`, nhưng dùng **layout riêng** và **chỉ gọi API** (không import thẳng mã phía máy chủ của web) | Nếu phải tách FE Admin riêng: chuyển nguyên thư mục route sang một app Vite SPA mới; API không đổi |
| A3 | PWA là **chính `apps/web`** thêm manifest và service worker (GĐ13), không làm app riêng | Nếu phải làm app riêng: các màn hình luyện tập đã viết thành component độc lập, chuyển được |
| A4 | Cán bộ đăng nhập bằng **tên đăng nhập + mật khẩu** do quản trị cấp, nhập danh sách từ Excel. Vẫn giữ Google cho Admin quản lý | Nếu dùng SSO hoặc VNeID: thêm một provider trong `packages/auth`, bảng `accounts` không đổi |
| A5 | Vai trò: thêm `can_bo` và `quan_ly` vào thang hiện có (chi tiết ở GĐ2). Quyền của `quan_ly` **giới hạn theo cây đơn vị** | Đổi được bằng một migration ánh xạ lại vai trò |
| A6 | Mức độ câu hỏi dùng 3 bậc `de / trung_binh / kho`. Thang điểm 100, ngưỡng đạt mặc định 70 | Chỉ là giá trị CHECK và cấu hình, sửa bằng migration nhỏ |
| A7 | **Thi sát hạch chỉ làm online**; luyện tập được làm offline | Thi offline cần thiết kế chống gian lận riêng, ngoài kế hoạch này |
| A8 | Dữ liệu và chức năng ngoài phạm vi PRD (nhân vật đồng hành, trường hợp ứng dụng, lĩnh vực đầu tư CNTT, so sánh, lược đồ) được **ẩn khỏi menu**, **không xóa mã**, cho tới khi có quyết định | — |

### 0.4. Bảng kiểm "cực kỳ đơn giản"

Áp dụng cho mọi màn hình người học ở mọi giai đoạn:

- [ ] Menu của cán bộ có **tối đa 4 mục**: **Tra cứu · Luyện tập · Thi · Tôi**.
- [ ] Mỗi màn hình có **một hành động chính**, nút to (cao ≥ 48px), bấm được bằng ngón cái.
- [ ] Không có thuật ngữ kỹ thuật: không hiện URN, "asOf", "hợp nhất", "nút".
- [ ] **Ngày hiệu lực mặc định là hôm nay** và chỉ hiện khi người dùng mở "Xem theo ngày khác".
- [ ] Mỗi câu hỏi chiếm một màn hình; phản hồi đúng/sai hiện ngay, kèm **một câu giải thích** và **liên kết tới điều khoản gốc**.
- [ ] Dùng được ở bề rộng 360px, không cuộn ngang, chữ nội dung ≥ 16px.
- [ ] Chuỗi hiển thị qua bộ kiểm hành văn (`QUY-TAC-HANH-VAN.md`).

### 0.5. Tổng quan giai đoạn và mốc

| GĐ | Tên | Phụ thuộc | Mốc |
|---|---|---|---|
| 0 | Nền móng và vá bảo mật | — | |
| 1 | Tra cứu văn bản và hỏi đáp AI, giao diện đơn giản | 0 | |
| 2 | Tài khoản, đơn vị, vai trò, nhật ký truy cập | 0 | |
| 3 | Ngân hàng câu hỏi: nhập, duyệt, phân loại | 2 | |
| 4 | **Luyện tập** theo chủ đề, câu sai, lịch sử | 3 | **M1: demo nội bộ** (tra cứu + luyện tập) |
| 5 | Tra cứu nhanh: mức phạt, tốc độ, quy trình | 1 | |
| 6 | **Thi sát hạch**: đề, trộn, giao, tính giờ | 3, 4 | |
| 7 | Báo cáo, xếp hạng, xuất Excel/PDF | 6 | **M2: demo khách hàng** (Bước 1 lộ trình PRD) |
| 8 | AI sinh câu hỏi vào ngân hàng | 3 | |
| 11 | Bài giảng đơn giản: đọc bài, chế độ slide | 2 | |
| 12 | Biển báo | 1 | |
| 13 | PWA và luyện tập offline | 4 | **M3: bản cài được trên điện thoại** |
| 14 | Giọng nói: hỏi bằng giọng, sách nói | 1, 11 | |
| 15 | Nhắc học (Web Push) | 13 | |
| 16a | Nhóm học cùng: CSDL, tiến độ, cổ vũ, API người học | 4, 11; 15 nếu N9 chọn có thông báo | |
| 16b | Nhóm học cùng: giao diện người học, hộp thoại | 16a | |
| 16c | Nhóm học cùng: quản lý xem tiến độ học, báo cáo Excel/PDF | 7, 16a | |
| 16d | Nhóm học cùng: AI gợi ý thứ tự học, tóm tắt tiến độ | 8, 16a, 16b, 16c | |

GĐ1 và GĐ2 làm song song được. GĐ5 chỉ cần GĐ1, nên có thể xen vào bất cứ lúc nào sau GĐ1.

**Nhóm học cùng** (GĐ16a–16d, thêm ngày 29/9/2026): đặc tả, câu hỏi N1–N17, đề xuất Đ1–Đ18 và prompt từng giai đoạn ở [PROMPT_NHOM_HOC_CUNG.md](PROMPT_NHOM_HOC_CUNG.md).
- Làm tuần tự 16a → 16b → 16c → 16d, mỗi giai đoạn một phiên. 16d bỏ được nếu N12 chọn không làm AI.
- Trước mỗi giai đoạn, trả lời các câu và đề xuất ghi ở dòng "Thiết kế" của giai đoạn đó. Chỗ ghi "đề xuất Đn" là phần phụ thuộc đề xuất chưa được đồng ý.

Migration mới đánh số tiếp từ **`0010_`**. Thư mục hiện có hai tệp `0006_*`, nhưng `migrate.ts` sắp theo tên nên không ảnh hưởng.

---

## GĐ0 — Nền móng và vá bảo mật

**Mục tiêu**
- Có một mốc mã **build được**, và bịt các lỗ hổng S1–S5 ở GAP §3.4.
- Chưa thêm chức năng mới.

**Việc làm**
1. **Chốt trạng thái giao diện đang dựng lại.** Commit đợt dựng lại hiện tại (bộ `components/ui`, `components/layout`, các trang `PageStub`) thành một mốc riêng. Từ đây các trang được dựng lại **theo từng giai đoạn** bên dưới, không khôi phục bản cũ ở `HEAD`; bản cũ chỉ dùng để tham khảo qua `git show`.
2. **S1 — API biên tập:**
   - Xem hàng đợi và xử lý việc cần `quan_ly`.
   - Duyệt hoặc từ chối lệnh sửa đổi cần `quan_ly`.
   - `reviewer_id` lấy từ người đăng nhập, không lấy từ body.
3. **S2 — Hỏi đáp AI:**
   - Bắt buộc đăng nhập.
   - Giới hạn số câu hỏi mỗi tài khoản mỗi ngày qua biến `ASK_QUOTA_PER_DAY` (mặc định 30).
   - Ghi `account_id` vào `ask_logs`.
4. **S3 — API học tập:** mọi route nhận `:id` ghi danh hoặc thẻ ôn đều phải kiểm tra bản ghi thuộc về người gọi; nếu không, trả 403.
5. **S4 — Đăng nhập demo:** tắt tài khoản demo `quan_tri` khi `NODE_ENV=production`, trừ khi đặt rõ `AUTH_DEMO_ADMIN=1`.
6. **S5 — CORS:** cho phép thêm `PATCH, PUT, DELETE`; danh sách origin đọc từ biến `CORS_ORIGINS`.

**File sửa**
- `apps/api/src/routes/editorial.ts`
- `apps/api/src/routes/ask.ts`
- `apps/api/src/routes/dao-tao.ts`
- `apps/api/src/app.ts`
- `packages/auth/src/demo.ts`, `packages/auth/src/config.ts`
- `packages/db/src/dao-tao.ts`: thêm hàm `chuGhiDanh(id)` và `chuTheOn(id)`
- `.env.example`: thêm `ASK_QUOTA_PER_DAY`, `CORS_ORIGINS`, `AUTH_DEMO_ADMIN`

**File tạo**
- `apps/api/src/phan-quyen.test.ts`: gom các ca kiểm tra quyền của GĐ0

**Migration**
- `0010_ask_logs_tai_khoan.sql`:
  ```sql
  ALTER TABLE ask_logs ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS ask_logs_account_day_idx ON ask_logs(account_id, created_at);
  ```

**Kiểm tra đã xong**
- [x] `POST /v1/amend-ops/:id/approve` trả **401** khi không có token và **403** với vai trò `can_bo`; thành công với `quan_ly`, và `reviewer_id` là email người duyệt.
- [x] `POST /v1/ask` trả 401 khi chưa đăng nhập; câu hỏi thứ `ASK_QUOTA_PER_DAY + 1` trong ngày trả **429**.
- [x] Người B gọi `GET /v1/dao-tao/ghi-danh/<id của A>/tien-do` nhận **403**.
- [x] Với `NODE_ENV=production`, `POST /v1/auth/demo` vai trò `quan_tri` bị từ chối.
- [x] Preflight `OPTIONS` với `Access-Control-Request-Method: DELETE` từ origin hợp lệ được chấp nhận.
- [x] Cổng chung qua; `bun run build:web` qua dù các trang còn là `PageStub`.

**Trạng thái (25/9/2026):** đã xong S1–S5 và đạt 6/6 mục kiểm tra. Việc 1 (commit mốc giao diện) không làm: lịch sử git đã được đặt lại về commit đầu, người dùng tự commit.
- S1 làm ngày 24/9. S2–S5 làm ngày 25/9, sau khi `docs/REVIEW_GD0.md` chỉ ra bốn mục này chưa làm.
- **S2:**
  - `routes/ask.ts` bắt đăng nhập.
  - Hạn mức lấy từ `ASK_QUOTA_PER_DAY`, mặc định 30; giá trị thiếu hoặc sai cũng dùng 30.
  - Đếm theo ngày giờ Việt Nam (từ 0 giờ `Asia/Ho_Chi_Minh`), tính cả câu đang xử lý dở để gửi dồn song song không vượt được hạn mức.
  - Ghi `ask_logs.account_id`.
  - Migration đặt số **`0026_ask_logs_tai_khoan.sql`** thay cho 0010, vì dãy migration đã tới 0025.
  - Thêm `LLM_PROVIDER=none`: hỏi đáp trả 503 "chưa cấu hình" thay vì câu trả lời giữ chỗ của mock. Dùng cho bản demo không có key; trang web hiện đúng thông báo.
- **S3:**
  - Thêm `chuGhiDanh(id)` và `chuTheOn(id)` ở `packages/db/src/dao-tao.ts`.
  - Mọi route nhận id ghi danh hay thẻ ôn đều kiểm chủ sở hữu: 5 route còn hở, kể cả `ghiDanhId` lấy từ body của `POST /hoat-dong/:id/nop`. Của người khác trả 403, id không tồn tại trả 404.
- **S4:** `demoQuanTriDuocPhep()` ở `packages/auth/src/demo.ts` chặn demo `quan_tri` khi `NODE_ENV=production`, trừ khi `AUTH_DEMO_ADMIN=1`.
- **S5:**
  - CORS cho phép `PATCH, PUT, DELETE`.
  - `CORS_ORIGINS` rỗng hoặc thiếu: máy phát triển cho mọi origin, máy chủ thật không cho origin nào.
- `.env.example`: thêm `ASK_QUOTA_PER_DAY`, `CORS_ORIGINS`, `AUTH_DEMO_ADMIN`.
- **Test:**
  - `phan-quyen.test.ts` có thêm 17 ca cho S2–S5, gồm ranh giới ngày giờ Việt Nam và giá trị hạn mức sai.
  - `ask.test.ts` hỏi bằng tài khoản riêng.
  - `scripts/smoke.ts` kiểm `/v1/ask` trả 401 khi chưa đăng nhập.
- **Cổng chung:** `bun test` 993 đạt, 5 hỏng (cả 5 ở `ports.test.ts`, lỗi môi trường Windows có từ trước); `bun run build:web` qua.
- **Còn lại, ngoài phạm vi GĐ0:**
  - Công cụ MCP `duyet_lenh_sua_doi` và `xu_ly_viec_bien_tap` đã chặn đúng vai trò, nhưng vẫn ghi người duyệt theo tham số client gửi lên.
  - `POST /v1/mascot/phan-hoi` nhận `ghiDanhId` mà không kiểm chủ; route này chỉ ghi sự kiện thống kê.
  - `GET /v1/dao-tao/ghi-danh/:id/on-tap` trả 500 khi người học có thẻ lật: câu SQL của `theOnDenHan` ép `ref_id::uuid` trong điều kiện JOIN.

---

## GĐ1 — Tra cứu văn bản và hỏi đáp AI (giao diện đơn giản)

**Mục tiêu**
- Người dùng tìm được quy định, đọc đúng điều khoản và hỏi AI, trong **3 màn hình**: Tìm → Đọc điều → Hỏi.
- Ẩn các chức năng nâng cao khỏi menu.

**Việc làm**
1. **Header đơn giản:** 4 mục *Tra cứu · Luyện tập · Thi · Tôi*. Hai mục Luyện tập và Thi tạm dẫn tới trang "sắp có".
2. **Trang chủ:** một ô tìm kiếm lớn, 3 gợi ý tìm nhanh (ví dụ "nồng độ cồn", "vượt đèn đỏ", "không đội mũ bảo hiểm"), nút "Hỏi trợ lý AI".
3. **`/tim-kiem`:**
   - Mỗi kết quả là một thẻ gồm tên điều, trích đoạn có tô sáng, tên văn bản rút gọn.
   - Chỉ có **một** bộ lọc: loại văn bản (Luật / Nghị định / Thông tư).
   - Ngày hiệu lực ẩn trong "Tùy chọn".
4. **`/van-ban/...` (đọc):**
   - Mở thẳng tới điều được chọn, có nút *Điều trước / Điều sau*.
   - Mục lục đặt trong ngăn kéo, nút "Sao chép trích dẫn".
   - Các tab Thuộc tính, Lược đồ, Phiên bản gộp vào menu "Thông tin thêm".
5. **`/hoi-dap`:** một ô hỏi và các câu gợi ý; câu trả lời hiện kèm **thẻ căn cứ** bấm được để mở điều khoản. Chưa đăng nhập thì mời đăng nhập, theo GĐ0.
6. **Đo thời gian phản hồi:** thêm vào `scripts/smoke.ts` phép đo p95 của `/v1/search` và `/v1/documents/:urn/content`.

**File sửa**
- `apps/web/app/routes/home.tsx`, `search.tsx`, `document.tsx`, `document.read.tsx`, `ask.tsx`
- `apps/web/app/components/layout/SiteHeader.tsx`, `SearchBox.tsx`
- `apps/web/app/lib/api.ts`: giữ nguyên các hàm, chỉ bổ sung kiểu nếu cần
- `apps/web/app/lib/format.ts`
- `scripts/smoke.ts`

**File tạo**
- `apps/web/app/components/tra-cuu/TheKetQua.tsx`
- `apps/web/app/components/tra-cuu/NoiDungDieu.tsx`: hiển thị điều/khoản/điểm; tham khảo `NodeView.tsx` ở `HEAD`
- `apps/web/app/components/tra-cuu/MucLucNganKeo.tsx`
- `apps/web/app/components/tra-cuu/NutSaoChepTrichDan.tsx`
- `apps/web/app/components/tra-cuu/TheCanCu.tsx`
- `apps/web/app/routes/sap-co.tsx`: trang tạm cho Luyện tập và Thi

**Migration:** không có.

**Kiểm tra đã xong**
- [x] Với dữ liệu seed, tìm từ khóa trong văn bản mẫu thì thấy điều tương ứng ở **3 kết quả đầu**, và bấm vào mở đúng điều.
  - "kế hoạch thử nghiệm" cho 9 kết quả; đầu tiên là Điều 3 của Nghị định số 100/2026/NĐ-CP.
  - Liên kết `?dieu=dieu-3#dieu-3.khoan-2` mở đúng Điều 3 và tô nền khoản 2.
- [ ] Trên kho giao thông thật (nạp theo `LENH.md` §3.1a, `bull backfill --nhom gtdb`), tìm "nồng độ cồn" thì ra điều của NĐ 168/2024 về nồng độ cồn trong 3 kết quả đầu. Soát tay.
  - **Chưa đạt:** CSDL cục bộ chỉ có văn bản mẫu, chưa nạp kho giao thông. Việc nạp kho phải crawl các cổng văn bản bên ngoài, cần người phụ trách chạy.
- [x] Hỏi đáp chạy với `LLM_PROVIDER=mock` trả câu trả lời có ít nhất một thẻ căn cứ mở được.
  - Có 1 thẻ căn cứ, dẫn tới `?dieu=dieu-3#dieu-3.khoan-2`.
- [x] `bun run smoke` báo p95 của tìm kiếm và đọc điều **< 1 giây** trên máy dev. Mục tiêu PRD < 3 giây còn chừa chỗ cho mạng.
  - Smoke đạt 10/10; p95 tìm kiếm 9 ms, đọc văn bản 16 ms (trên dữ liệu mẫu).
- [x] Qua bảng kiểm §0.4 ở 360px; menu không còn Ứng dụng, So sánh (route vẫn tồn tại).
  - Đo bằng Chrome không giao diện trên 6 trang: không cuộn ngang, mọi vùng bấm ≥ 44px, chữ nội dung 16–17px.
  - Menu gồm 4 mục: Tra cứu · Luyện tập · Thi · Tôi/Đăng nhập.
- [ ] `bun run huong-dan:kiem-tra` qua. Nếu script yêu cầu route mới có bài hướng dẫn thì thêm bài tối thiểu hoặc khai ngoại lệ.
  - **Chưa đạt, nhưng không do GĐ1:** lệnh đã báo lỗi từ trước GĐ1, vì đợt dựng lại giao diện làm 23 bài hướng dẫn lỗi thời; trước và sau GĐ1 vẫn là 23 bài.
  - Route mới `sap-co.tsx` đã khai ngoại lệ trong `content/huong-dan/muc-luc.json`. Test `bao-ve.test.ts` ("mọi trang có giao diện đều có bài hướng dẫn hoặc được miễn") đã qua.
  - Cập nhật ảnh và bài hướng dẫn (`bun run huong-dan:cap-nhat`) để sau khi giao diện ổn định.

**Trạng thái (24/9/2026):** đã làm xong phần mã, còn 2 mục kiểm tra chưa đạt (xem trên).
- `bun test`: 623 đạt, 5 hỏng. Cả 5 lỗi nằm ở `packages/config/src/ports.test.ts` (không tìm được tiến trình giữ cổng trên máy Windows này); gói đó không bị sửa.
- Typecheck, lint và `build:web` đều qua.
- Ngoài danh sách dự kiến, đã sửa thêm:
  - `lib/site.ts`: menu 4 mục
  - `lib/tree.ts`: lấy lại từ `HEAD`, thêm `findDieu`
  - `lib/citation.ts`: `dieuHrefFromUrn`
  - `routes.ts`: 2 route tạm
  - `components/layout/SiteFooter.tsx`: bỏ liên kết So sánh
  - `components/ui/Icon.tsx`: 4 biểu tượng
  - `content/huong-dan/muc-luc.json`: ngoại lệ cho `sap-co.tsx`
- GĐ0 còn S2–S5 chưa làm. Trang hỏi đáp đã gửi token phiên và xử lý sẵn 401/429, nhưng hai nhánh này chỉ kiểm được sau S2.

---

## GĐ2 — Tài khoản, đơn vị, vai trò, nhật ký truy cập

**Mục tiêu**
- Có **đơn vị** dạng cây, tài khoản cán bộ đăng nhập bằng tên/mật khẩu, vai trò **Cán bộ, chiến sĩ** và **Lãnh đạo Công an xã** giới hạn theo đơn vị.
- Admin quản trị hệ thống có màn hình quản lý người dùng và đơn vị, nhập danh sách từ Excel.
- Có nhật ký truy cập.

**Thiết kế vai trò (A5)**
- Thang tổ chức 5 bậc: `khach < can_bo < lanh_dao < quan_ly < quan_tri`
  (Khách < Cán bộ, chiến sĩ < Lãnh đạo Công an xã < Admin quản lý < Admin quản trị hệ thống).
- `can_bo` là người học: học, luyện tập, thi, tra cứu.
- `lanh_dao` = quản lý **trong cây đơn vị của mình**: giao bài, xem báo cáo, quản lý người dùng trong đơn vị.
- `quan_ly` = quản trị nội dung toàn hệ thống: soạn, duyệt và xuất bản. Thấy mọi đơn vị.
- `quan_tri` = toàn quyền, gồm quản lý tài khoản và cây đơn vị.
- Phạm vi đơn vị kiểm bằng một hàm `trongPhamVi(principal, unitId)` dùng chung. **Không** dựa vào thứ bậc vai trò.
- Hệ quả đã chấp nhận: vai trò soạn nội dung và vai trò phê duyệt gộp làm một (`quan_ly`) — người soạn cũng là người duyệt.
  Muốn tách trở lại thì phải tách thứ bậc, không chỉ đổi nhãn.

**Việc làm**
1. **Bảng `units`** dạng cây (`parent_id` + `path ltree` để truy vấn cây con). Có mã, tên, loại cấp (tùy ý), thứ tự.
2. **Mở rộng `accounts`:** `username` (duy nhất), `password_hash`, `full_name`, `unit_id`, `rank_title` (cấp bậc, chức vụ, tùy chọn), `must_change_password`. `email` được phép rỗng.
3. **Đăng nhập tên/mật khẩu:**
   - Băm bằng `Bun.password` (argon2id).
   - Khóa tạm sau 5 lần sai trong 15 phút.
   - Bắt đổi mật khẩu ở lần đăng nhập đầu.
4. **Nhập Excel người dùng** theo mẫu có sẵn (họ tên, tên đăng nhập, mã đơn vị, vai trò). Kết quả trả về từng dòng lỗi; có chế độ **chạy thử** không ghi vào CSDL.
5. **Nhật ký truy cập:** middleware ghi phương thức, đường dẫn mẫu, tài khoản, mã trạng thái, thời gian xử lý (không ghi body). Đăng nhập thành công và thất bại ghi vào `audit_log`.
6. **Màn hình quản trị:**
   - `/quan-tri/don-vi`: cây đơn vị, thêm, sửa, chuyển cha.
   - `/quan-tri/nguoi-dung`: danh sách, lọc theo đơn vị, tạo, khóa, đặt lại mật khẩu, nhập Excel, tải mẫu.
7. **Trang `/dang-nhap`:** form tên đăng nhập + mật khẩu làm mặc định; nút Google hiện ngay bên dưới (sau dòng "hoặc") cho mọi người khi đã đặt `GOOGLE_CLIENT_ID`, chưa đặt thì ẩn. Email Google trùng tài khoản cán bộ thì gộp vào tài khoản đó (`upsertAccount`, `ON CONFLICT (email)`). Tài khoản demo nằm trong mục thu gọn "Tài khoản demo".

**File sửa**
- `packages/auth/src/rbac.ts`: `ROLES`, `ROLE_LABEL`, hàm `trongPhamVi`
- `packages/auth/src/session.ts`: `Principal` thêm `unitId`, `unitPath`
- `packages/auth/src/index.ts`
- `apps/api/src/routes/auth.ts`: `POST /v1/auth/mat-khau`, `POST /v1/auth/doi-mat-khau`
- `apps/api/src/auth.ts`: thêm `batBuocPhamViDonVi`
- `apps/api/src/app.ts`: middleware nhật ký truy cập, mount route mới
- `apps/web/app/routes/dang-nhap.tsx`, `apps/web/app/routes/quan-tri.tsx` (menu), `apps/web/app/routes.ts`
- `apps/web/app/lib/session.server.ts`: thang vai trò mới
- `packages/db/src/index.ts`
- `package.json` (gốc) hoặc `packages/db/package.json`: thêm `exceljs`

**File tạo**
- `packages/auth/src/mat-khau.ts`
- `packages/auth/tests/mat-khau.test.ts`, `packages/auth/tests/pham-vi.test.ts`
- `packages/db/src/don-vi.ts`: CRUD đơn vị, truy vấn cây con
- `packages/db/src/nguoi-dung.ts`: CRUD tài khoản, nhập hàng loạt
- `packages/db/src/excel.ts`: đọc/ghi Excel dùng chung, GĐ3 và GĐ7 dùng lại
- `apps/api/src/routes/nguoi-dung.ts`: `/v1/quan-tri/don-vi`, `/v1/quan-tri/nguoi-dung`, `/v1/quan-tri/nguoi-dung/nhap`
- `apps/api/src/nguoi-dung.test.ts`
- `apps/web/app/routes/quan-tri.don-vi.tsx`, `quan-tri.nguoi-dung.tsx`, `doi-mat-khau.tsx`
- `data/mau/mau-nhap-nguoi-dung.xlsx`
- `packages/db/src/seed-don-vi.ts`: cây đơn vị mẫu (1 phòng, 3 đội) và 10 tài khoản mẫu

**Migration**
- `0011_don_vi_tai_khoan.sql`:
  - tạo `units(id, code UNIQUE, name, parent_id, path ltree, level_label, ordinal, enabled, created_at, updated_at)`, index GIST trên `path`
  - `ALTER TABLE accounts`: thêm các cột ở mục 2; `email DROP NOT NULL`; CHECK `email IS NOT NULL OR username IS NOT NULL`
  - bảng `login_attempts(username, ok, ip, created_at)` để khóa tạm
- `0012_nhat_ky_truy_cap.sql`:
  - `access_log(id bigserial, account_id, method, route, status, ms, ip, created_at)` + index theo `created_at`
  - ghi chú về thời hạn lưu (câu hỏi GAP 4.6-31)

**Kiểm tra đã xong**
- [x] Unit test: băm và kiểm mật khẩu; khóa tạm sau 5 lần sai; `trongPhamVi` đúng với cây 3 cấp (quản lý phòng thấy đội con, quản lý đội không thấy đội bên cạnh).
  - `packages/auth/tests/mat-khau.test.ts` và `pham-vi.test.ts`.
  - Có thêm ca nhãn đơn vị trùng tiền tố (`udoia` / `udoiab`) và ca tên đăng nhập không tồn tại trả cùng lỗi với sai mật khẩu.
- [x] API test:
  - nhập tệp mẫu 10 dòng, trong đó 2 dòng lỗi, được **8 tài khoản** và 2 lỗi có số dòng;
    - Lỗi ở dòng 5 và dòng 9; mỗi người một mật khẩu tạm khác nhau (`apps/api/src/nguoi-dung.test.ts`).
  - chạy thử không ghi gì vào CSDL.
- [x] Đăng nhập bằng tài khoản vừa nhập thì bị bắt đổi mật khẩu; đổi xong vào được trang chủ.
  - Kiểm bằng API test và bằng Chrome không giao diện ở 360px.
  - Khi chưa đổi mật khẩu: mọi trang chuyển về `/doi-mat-khau`, API trả 403 `phai_doi_mat_khau`.
  - Đổi xong thì về trang định mở ban đầu (mặc định là trang chủ).
- [x] `quan_ly` đội A gọi danh sách người dùng đội B nhận **403**.
  - API trả 403 `ngoai_pham_vi`; trang web báo "Không đủ quyền" kèm lý do.
- [x] Mỗi request API sinh một dòng `access_log`; đăng nhập sai sinh một dòng `audit_log`.
  - Hai loại request không ghi: preflight `OPTIONS` và `/health` (máy giám sát gọi liên tục).
- [x] Các test cũ về RBAC và MCP vẫn qua. `can_bo` giữ quyền MCP cũ.
  - Câu kiểm danh sách `ROLES` trong `rbac.test.ts` đã sửa theo thang mới, có thêm kiểm `can_bo` vẫn trên `khach` và dưới `lanh_dao`.

**Trạng thái (24/9/2026):** đã làm xong, đạt 6/6 mục kiểm tra.
- `bun test`: 743 đạt, 6 hỏng. Không lỗi nào do GĐ2:
  - 5 lỗi ở `ports.test.ts`: lỗi môi trường Windows, đã có từ trước.
  - 1 lỗi ở `sohoa.test.ts`: chạy riêng thì đạt 6/6. Lỗi xuất hiện khi hai phiên GĐ3 và GĐ5 chạy test cùng lúc trên cùng CSDL test.
- Typecheck (api, web, mcp, auth, db) và `build:web` đều qua.
- Khác với dự kiến:
  - Họ tên dùng lại cột `accounts.name` sẵn có, không thêm cột `full_name`.
  - Hàm phạm vi nhận đường dẫn ltree của đơn vị (`trongPhamVi(principal, unitPath)`); API có `batBuocPhamViDonVi(c, unitId)` tra đường dẫn rồi gọi hàm này.
  - Nhập Excel chỉ nhận vai trò Cán bộ và Lãnh đạo Công an xã. Vai trò Admin quản lý và quản trị cấp từng người trên màn hình.
  - Mật khẩu tạm sinh ngẫu nhiên cho từng người và chỉ hiện một lần.
- Thêm ngoài danh sách:
  - `apps/web/app/lib/quan-tri.server.ts`
  - `routes/quan-tri.nguoi-dung.mau.tsx`: tải mẫu
  - `root.tsx`: chuyển về trang đổi mật khẩu
  - `tai-khoan.tsx`
  - `lib/types.ts`
  - `content/huong-dan/muc-luc.json`: miễn hướng dẫn tạm cho 3 trang mới
  - script `db:seed:don-vi`
- Tài khoản mẫu (`bun run db:seed:don-vi`): `quantri`, `quanly`, `lanhdao.phong`, `lanhdao.doi1`, 7 tài khoản `canbo.*`. Mật khẩu `Matkhau2026`, hoặc đặt qua `SEED_MAT_KHAU`.
- Việc chuyển sang giai đoạn sau:
  - Tạo xong một người dùng trên điện thoại, thông báo mật khẩu tạm nằm ở đầu trang, cần cuộn lên mới thấy.
  - Trang `/quan-tri` (tổng quan đào tạo) vẫn là trang tạm; Lãnh đạo Công an xã vào thẳng `/quan-tri/nguoi-dung` từ trang Tài khoản.

---

## GĐ3 — Ngân hàng câu hỏi (nhập, duyệt từng câu, phân loại)

**Mục tiêu**
- Có ngân hàng câu hỏi **độc lập với chuyên đề**, phân loại theo **chủ đề / mức độ / loại**.
- **Duyệt từng câu** trước khi dùng. Nhập từ Excel theo mẫu của KH.
- Đây là nguồn dữ liệu chung cho luyện tập và thi.

**Thiết kế**
- **Bảng `question_topics`:** cây chủ đề gắn với lĩnh vực (`fields`). Ví dụ Giao thông → Quy tắc giao thông → Tốc độ, khoảng cách.
- **Bảng `questions`:** tách khỏi `activities`, vì `activities.course_id` là NOT NULL và mang ngữ nghĩa bài học.
- **Loại câu hỏi** ở giai đoạn này là các loại **chấm máy**:
  - `mot_dap_an`, `nhieu_dap_an`
  - `dung_sai` (đáp án cố định, **không** cần AI)
  - `dien_khuyet`, `sap_xep`, `ghep_cap`
- **Chấm điểm** dùng lại `packages/dao-tao/src/grading.ts` qua một lớp ánh xạ, không viết thuật toán chấm mới.
- **Trạng thái:** `nhap → cho_duyet → da_duyet | tu_choi`, và `da_duyet → luu_tru`. Chỉ câu `da_duyet` mới được rút vào luyện tập và thi.
- **Sửa câu đã duyệt** thì câu quay về `cho_duyet`, tăng `version`. Các lượt làm cũ giữ ảnh chụp đề (lưu ở GĐ4/GĐ6).
- **Quyền:** `quan_ly` tạo và sửa; `quan_ly` duyệt (có thể chỉnh qua cấu hình khi KH trả lời câu hỏi GAP 4.3-12).

**Việc làm**
1. Logic thuần: kiểm tra hợp lệ theo loại (đủ phương án, đúng một đáp án với `mot_dap_an`…), chấm, ánh xạ sang `grading.ts`.
2. **API quản trị:**
   - danh sách có lọc (chủ đề, mức độ, loại, trạng thái, nguồn, từ khóa);
   - tạo, sửa;
   - gửi duyệt, duyệt, từ chối kèm lý do;
   - **duyệt hàng loạt**;
   - lưu trữ;
   - nhập Excel (có chạy thử), xuất Excel.
3. **Màn hình `/quan-tri/cau-hoi`:**
   - bảng lọc;
   - form một câu, xem trước đúng như người học sẽ thấy;
   - tab "Chờ duyệt" có nút Duyệt / Từ chối;
   - bộ đếm "Đã duyệt: N / mục tiêu 1.000".
4. **Seed:**
   - chuyển các `trac_nghiem`, `ghep_cap`, `sap_xep` trong `seed-dao-tao-gtdb.ts` thành câu hỏi ngân hàng ở trạng thái `da_duyet`;
   - thêm khoảng 40 câu mẫu giao thông ở `cho_duyet` để thử luồng duyệt.

**File sửa**
- `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts`
- `apps/api/src/app.ts`: mount route
- `apps/web/app/routes.ts`, `apps/web/app/routes/quan-tri.tsx`: menu
- `package.json`: script `db:seed:ngan-hang`

**File tạo**
- `packages/dao-tao/src/cau-hoi.ts`
- `packages/dao-tao/tests/cau-hoi.test.ts`
- `packages/db/src/ngan-hang.ts`
- `packages/db/src/seed-ngan-hang.ts`
- `apps/api/src/routes/ngan-hang.ts`: `/v1/quan-tri/ngan-hang/*`
- `apps/api/src/ngan-hang.test.ts`
- `apps/web/app/routes/quan-tri.cau-hoi.tsx`, `quan-tri.cau-hoi.sua.tsx`
- `apps/web/app/components/cau-hoi/HienThiCauHoi.tsx`: component hiển thị dùng chung cho xem trước, luyện tập, thi
- `data/mau/mau-nhap-cau-hoi.xlsx`

**Migration**
- `0013_ngan_hang_cau_hoi.sql`:
  - `question_topics(id, field_id, parent_id, code, name, ordinal)`
  - `questions`, gồm các cột:
    - phân loại: `id, code UNIQUE, topic_id, level CHECK (de|trung_binh|kho), kind CHECK (...)`
    - nội dung: `stem, options jsonb, answer jsonb, explanation, citations text[], image_uri`
    - vòng đời: `status CHECK, source CHECK (nguoi|ai|nhap_excel), version`
    - người thao tác: `created_by, approved_by, approved_at, reject_reason`
    - khác: `offline_ok boolean DEFAULT true, created_at, updated_at`
  - `question_reviews(question_id, version, action, actor, note, created_at)`: lịch sử duyệt
  - index trên `(topic_id, level, status)`

**Kiểm tra đã xong**
- [x] Unit test: với mỗi loại có ít nhất một ca đúng, một ca sai, một ca đề không hợp lệ.
  - `packages/dao-tao/tests/cau-hoi.test.ts`: 42 ca, gồm cả vòng đời duyệt và đọc/ghi dòng Excel.
- [x] API test (`apps/api/src/ngan-hang.test.ts`, 15 ca):
  - nhập tệp mẫu 50 câu, trong đó 3 câu lỗi, ra 47 câu ở `cho_duyet`; lỗi báo đúng số dòng 7, 22, 43; chạy thử không ghi gì;
  - duyệt hàng loạt 10 câu thì bộ đếm `da_duyet` tăng 10;
  - sửa một câu đã duyệt thì câu về `cho_duyet` và `version = 2`; gửi version cũ nhận 409.
- [x] `can_bo` gọi API quản trị ngân hàng nhận 403; `lanh_dao` không duyệt được (403).
- [x] **Không có API người học nào trả về trường `answer`.** Test quét mọi phản hồi JSON của các route người học ở GĐ4 và GĐ6 để tìm khóa `answer`.
  - GĐ3 chưa có route người học; ranh giới là `deChoNguoiHoc`.
  - GĐ4: `apps/api/src/luyen-tap.test.ts` quét đệ quy mọi phản hồi của `/v1/luyen-tap/*` và `/v1/toi/*`, không có khóa `answer`.
  - GĐ6: `apps/api/src/thi.test.ts` quét các khóa cấm (`answer`, `noi_dung`, `dap_an`…) trên route thi.
- [x] Soát tay: tạo một câu trên điện thoại 360px được.
  - Chrome không giao diện, khung 360×740: tạo câu → làm thử → gửi duyệt → duyệt chạy được; bốn màn hình không cuộn ngang; mọi vùng bấm cao từ 44px.

**Trạng thái (24/9/2026):** đã xong. Mục quét `answer` hoàn tất cùng GĐ4 và GĐ6.
- Cổng chung:
  - `bun run typecheck` qua; `build:web` qua.
  - `bun test`: 744 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows này (xem GĐ1).
  - `bun run lint`: các tệp của GĐ3 qua. Còn 1 lỗi định dạng (CRLF) ở `apps/api/src/auth.test.ts`, thuộc phần GĐ2.
  - `bun run smoke`: 9/11 đạt. Mục hỏng là tra cứu nhanh (GĐ5) trả 404, do API đang chạy ở cổng 3031 là bản cũ.
- GĐ3 làm song song với GĐ2, nên dùng `excel.ts`, vai trò `can_bo` và menu quản trị lọc theo vai trò của GĐ2.
- Thay đổi so với dự kiến:
  - Nội dung tệp mẫu (cột, hướng dẫn, dòng mẫu) và phần đọc/ghi dòng Excel đặt ở `packages/dao-tao/src/cau-hoi.ts`, để API và seed dùng chung.
  - Thêm `apps/web/app/lib/ngan-hang.ts` (kiểu, nhãn), `lib/ngan-hang.server.ts` (trả về cả danh sách lỗi của API) và `routes/quan-tri.cau-hoi.tep.tsx` (tải tệp mẫu, xuất Excel).
  - Route `cau-hoi/moi` và `cau-hoi/:id` dùng chung `quan-tri.cau-hoi.sua.tsx`.
  - Khai hai ngoại lệ hướng dẫn trong `content/huong-dan/muc-luc.json`.
- Quy tắc nghiệp vụ đã chốt:
  - Câu đúng là câu đúng hoàn toàn; `ty_le` giữ điểm từng phần.
  - Giải thích là bắt buộc.
  - Ghép cặp cho phép nhiều vế trái cùng một vế phải (câu phân loại).
  - Đề cho người học xếp vế phải và các bước theo chữ cái, để thứ tự không lộ đáp án.
  - Vai trò được duyệt đặt bằng `NGAN_HANG_VAI_TRO_DUYET` (mặc định `quan_ly`); mục tiêu đặt bằng `NGAN_HANG_MUC_TIEU` (mặc định 1.000).
- Seed `bun run db:seed:ngan-hang`:
  - 13 chủ đề giao thông;
  - 13/13 bài tập của các chuyên đề giao thông chuyển thành câu đã duyệt (cần chạy `db:seed:dao-tao:gtdb` trước);
  - 40 câu mẫu chờ duyệt. Dữ kiện lấy từ seed giao thông; người duyệt vẫn phải đối chiếu căn cứ;
  - ghi tệp `data/mau/mau-nhap-cau-hoi.xlsx`.
- Chưa có màn hình quản lý chủ đề; tạo chủ đề qua `POST /v1/quan-tri/ngan-hang/chu-de`.

---

## GĐ4 — Luyện tập theo chủ đề, câu sai, lịch sử (MỐC M1)

**Mục tiêu**
- Cán bộ chọn chủ đề, làm **10 câu**, mỗi câu một màn hình, biết đúng/sai ngay kèm giải thích và căn cứ, rồi xem kết quả.
- Câu sai được gom vào **"Câu sai của tôi"** để luyện lại.
- Có trang lịch sử.
- Đây là chức năng quan trọng nhất theo PRD.

**Thiết kế**
- Phiên luyện tập lưu **ảnh chụp đề** (id + version), thứ tự câu và thứ tự phương án đã đảo. Chấm **trên máy chủ**.
- Mỗi câu trả lời gửi lên ngay, nhờ vậy mất mạng giữa chừng vẫn không mất bài.
- Cách rút câu:
  - trộn các mức độ theo tỷ lệ 4 dễ / 4 trung bình / 2 khó, thiếu mức nào thì bù bằng mức khác;
  - ưu tiên câu chưa làm hoặc hay sai.
- Câu sai: làm đúng **2 lần liên tiếp** thì rời danh sách.
- Web dùng **action/fetcher của React Router** gọi API phía máy chủ; không cần khôi phục route cầu nối `api.dao-tao` cũ.

**Việc làm**
1. Logic thuần:
   - rút câu có seed (tái lập được khi test);
   - đảo phương án và ánh xạ ngược khi chấm;
   - quy tắc rời danh sách câu sai.
2. **API người học:**
   - `GET /v1/luyen-tap/chu-de`: cây chủ đề + số câu đã duyệt + tiến độ của tôi
   - `POST /v1/luyen-tap/phien`: tạo phiên, theo chủ đề hoặc `nguon=cau_sai`
   - `GET /v1/luyen-tap/phien/:id`: đề, **không** có đáp án
   - `POST /v1/luyen-tap/phien/:id/tra-loi`: trả về đúng/sai, đáp án đúng, giải thích, căn cứ
   - `POST /v1/luyen-tap/phien/:id/ket-thuc`
   - `GET /v1/toi/lich-su`, `GET /v1/toi/cau-sai`
3. **Màn hình:**
   - `/luyen-tap`: lưới thẻ chủ đề to, thanh tiến độ mỗi chủ đề, nút "Luyện câu sai (N)"
   - `/luyen-tap/:phien`: một câu mỗi màn hình, nút "Kiểm tra" rồi "Câu tiếp", thanh 1/10, căn cứ mở trong ngăn kéo (tái dùng `NoiDungDieu` của GĐ1)
   - `/luyen-tap/:phien/ket-qua`: điểm, số câu đúng, danh sách câu sai, nút "Luyện lại câu sai"
   - `/toi`: tên, đơn vị, lịch sử 20 phiên gần nhất, số câu sai
4. **Khung E2E:** `scripts/e2e/` dùng `playwright-core` với Chrome có sẵn trên máy; thêm script `bun run e2e`.

**File sửa**
- `apps/web/app/routes.ts`
- `apps/web/app/components/layout/SiteHeader.tsx`: mục Luyện tập hoạt động
- `apps/api/src/app.ts`
- `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts`
- `package.json`: script `e2e`

**File tạo**
- `packages/dao-tao/src/luyen-tap.ts`, `packages/dao-tao/tests/luyen-tap.test.ts`
- `packages/db/src/luyen-tap.ts`
- `apps/api/src/routes/luyen-tap.ts`, `apps/api/src/routes/toi.ts`
- `apps/api/src/luyen-tap.test.ts`
- `apps/web/app/routes/luyen-tap._index.tsx`, `luyen-tap.phien.tsx`, `luyen-tap.ket-qua.tsx`, `toi.tsx`
- `apps/web/app/components/luyen-tap/ThanhTienDo.tsx`, `PhanHoiCauTraLoi.tsx`
- `apps/web/app/lib/luyen-tap.server.ts`
- `scripts/e2e/chay.ts`, `scripts/e2e/luyen-tap.ts`

**Migration**
- `0014_luyen_tap.sql`:
  - `practice_sessions(id, account_id, topic_id NULL, source CHECK (chu_de|cau_sai|thu_thach), items jsonb, started_at, finished_at, correct, total, seconds_spent)`. `items` chứa `[{question_id, version, option_order}]`
  - `practice_answers(id, session_id, question_id, question_version, response jsonb, correct boolean, seconds, client_id UNIQUE NULL, created_at)`. `client_id` được dùng ở GĐ13
  - `wrong_questions(account_id, question_id, wrong_count, correct_streak, last_wrong_at, cleared_at, PRIMARY KEY(account_id, question_id))`
  - index `practice_sessions(account_id, started_at DESC)`

**Kiểm tra đã xong**
- [x] Unit test (`packages/dao-tao/tests/luyen-tap.test.ts`, 13 ca):
  - cùng seed thì ra cùng đề;
  - đảo phương án rồi chấm vẫn đúng với mọi loại câu;
  - đúng 2 lần liên tiếp thì câu rời danh sách sai.
  - Cộng thêm: tỷ lệ 4/4/2 và bù mức thiếu, ưu tiên câu chưa làm hoặc hay sai.
- [x] API test, luồng đầy đủ: tạo phiên → `GET` không chứa `answer` → trả lời 10 câu (3 sai) → kết thúc với `correct = 7` → `cau-sai` có 3 câu → phiên `nguon=cau_sai` rút đúng 3 câu đó.
  - `apps/api/src/luyen-tap.test.ts`, 14 ca. Có thêm: làm đúng 2 phiên câu sai liên tiếp thì danh sách về 0.
- [x] Người B đọc hoặc trả lời phiên của A nhận **403**. Câu `cho_duyet` không bao giờ xuất hiện trong phiên.
- [x] Trả lời cùng câu hai lần trong một phiên nhận **409**, không chấm hai lần.
- [x] `bun run e2e` chạy kịch bản đăng nhập → luyện tập 10 câu → xem kết quả trên khung nhìn 360×740.
  - `scripts/e2e/luyen-tap.ts` đạt: đăng nhập bằng mật khẩu → chọn chủ đề → 10 câu (mở ngăn kéo căn cứ ở câu 1) → kết quả → trang Tôi.
- [x] Soát bảng kiểm §0.4.
  - Kịch bản E2E kiểm không cuộn ngang ở 4 màn hình; ảnh chụp đã soát tay.
  - Mỗi câu một màn hình, một nút chính cao 48px; phản hồi có một câu giải thích và nút mở điều khoản gốc.
- [ ] **Demo M1:** một cán bộ mẫu làm được toàn bộ luồng tra cứu (GĐ1) và luyện tập (GĐ4) trên điện thoại thật mà không cần hướng dẫn.
  - **Chưa làm:** cần người thật và điện thoại thật.

**Trạng thái (24/9/2026):** đã làm xong phần mã; còn buổi demo M1 với cán bộ thật.
- Cổng chung:
  - `bun run typecheck` qua.
  - `bun test`: 830 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows này.
  - `build:web` qua.
  - `bun run e2e`: 2/2 kịch bản đạt, gồm cả kịch bản `thi` của GĐ6.
  - `bun run lint`: các tệp GĐ4 qua. Còn lỗi ở `apps/api/src/auth.test.ts` (định dạng, GĐ2) và `packages/db/src/pdf.ts` (GĐ7, đang làm).
- Thay đổi so với dự kiến:
  - `items` của phiên lưu ảnh chụp đầy đủ (phần đề đã đảo và nội dung kèm đáp án), giống `exam_attempts.items` của GĐ6, thay cho chỉ `{question_id, version, option_order}`. Lý do: bảng `questions` chỉ giữ bản mới nhất, nên phải chụp nội dung thì sửa câu sau đó mới không đổi đề đang làm hay kết quả đã chấm.
  - Đảo phương án dùng chung `daoPhuongAn`, `taoRng`, `tron` của GĐ6 (`de-thi.ts`); id phương án giữ nguyên nên chấm không cần ánh xạ ngược.
  - Ngăn kéo căn cứ lấy nội dung Điều qua resource route `routes/luyen-tap.can-cu.tsx`, hiển thị bằng `NoiDungDieu` của GĐ1.
  - `HienThiCauHoi` thêm tùy chọn `anPhanHoi`: trang luyện tập dùng phản hồi riêng có ngăn kéo.
  - Mục "Tôi" trên header trỏ tới `/toi`; trang này có liên kết sang `/tai-khoan`.
- Lỗi giao diện phát hiện nhờ E2E và đã sửa:
  - Sau khi chấm, trang tự nhảy sang câu chưa làm kế tiếp nên người học không đọc được phản hồi. Nay số câu luôn nằm trên URL.
  - Câu trả lời bị xóa khi bấm quá nhanh ngay lúc câu mới hiện ra.
- Khung E2E `scripts/e2e/chay.ts`:
  - build web, dựng API và web ở cổng 3291/3290 (không bao giờ tự kết thúc tiến trình giữ cổng), rồi mở Chrome có sẵn qua `playwright-core`;
  - kịch bản nhận các tiện ích tạo tài khoản, đăng nhập, dọn dữ liệu, chụp ảnh, kiểm cuộn ngang;
  - hỏng thì tự chụp mọi trang đang mở; `E2E_LOG=1` in nhật ký máy chủ; ảnh ở `scripts/e2e/.anh/` (đã thêm vào `.gitignore`).
- Chưa làm: đồng bộ offline dùng `client_id` (cột đã có, API đã nhận) để dành cho GĐ13.

---

## GĐ5 — Tra cứu nhanh: mức phạt, tốc độ, quy trình

**Mục tiêu**
- Tra **mức xử phạt** theo hành vi và loại xe.
- Tra **mức phạt theo tốc độ**: nhập tốc độ cho phép và tốc độ đo được.
- Xem **quy trình xử lý vi phạm và tai nạn** theo từng bước.
- Mọi kết quả đều có liên kết tới điều khoản gốc.

**Thiết kế**
- Dữ liệu có cấu trúc, **mỗi dòng bắt buộc có `citation_urn`** trỏ tới điểm/khoản/điều trong kho. CI kiểm tra URN tồn tại và còn hiệu lực, dùng lại `packages/db/src/citation-health.ts`.
- Dữ liệu gốc nằm trong `data/tra-cuu/*.json`, được biên tập và duyệt bởi người như nội dung khác, rồi nạp bằng script. Chưa làm màn hình quản trị ở giai đoạn này.
- Có trường hiệu lực (`effective_from`, `effective_to`) để tra đúng theo ngày, vì NĐ 168/2024 đã được sửa bởi NĐ 238/2026.

**Việc làm**
1. Trích bảng mức phạt NĐ 168/2024 (đã tính các sửa đổi) cho **ô tô** và **xe mô tô, xe gắn máy** trước. Mỗi dòng gồm:
   - hành vi, loại xe, mức phạt từ–đến;
   - hình thức bổ sung (tước giấy phép lái xe, tịch thu), trừ điểm giấy phép lái xe;
   - khoảng tốc độ nếu có, từ khóa đồng nghĩa.
2. Soạn **quy trình** xử lý vi phạm và tai nạn. Mỗi bước có tiêu đề, mô tả ngắn và căn cứ. Chỉ dùng văn bản công khai; cần KH xác nhận theo câu hỏi GAP 4.5-25.
3. **API:**
   - `GET /v1/tra-cuu/muc-phat?q=&xe=&ngay=`
   - `GET /v1/tra-cuu/toc-do?xe=&cho_phep=&do_duoc=&ngay=`
   - `GET /v1/tra-cuu/quy-trinh`, `GET /v1/tra-cuu/quy-trinh/:ma`
4. **Màn hình `/tra-cuu-nhanh`:** 3 ô lớn: *Mức phạt · Tốc độ · Quy trình*.
   - **Mức phạt:** ô tìm kiếm + chip chọn loại xe. Mỗi thẻ kết quả ghi mức tiền in đậm, hình thức bổ sung, số điểm bị trừ, nút "Xem điều khoản".
   - **Tốc độ:** 2 ô số và chọn loại xe; hiện một thẻ kết quả.
   - **Quy trình:** danh sách; bấm vào mở dạng các bước đánh số, có thể đánh dấu từng bước đã làm (lưu trên máy).
5. Mục **Tra cứu** trên header mở trang chọn giữa "Văn bản" và "Tra cứu nhanh".

**File sửa**
- `apps/api/src/app.ts`
- `apps/web/app/routes.ts`, `apps/web/app/components/layout/SiteHeader.tsx`
- `packages/db/src/index.ts`
- `scripts/check-citations.ts`: kiểm thêm URN của dữ liệu tra cứu nhanh
- `package.json`: script `tra-cuu:nap`

**File tạo**
- `data/tra-cuu/muc-phat.json`, `data/tra-cuu/quy-trinh.json`
- `packages/dao-tao/src/tra-cuu-nhanh.ts`: logic khớp khoảng tốc độ, kiểm tra hợp lệ dữ liệu
- `packages/dao-tao/tests/tra-cuu-nhanh.test.ts`
- `packages/db/src/tra-cuu-nhanh.ts`
- `scripts/tra-cuu-nhanh.ts`: nạp, kiểm tra, báo URN hỏng
- `apps/api/src/routes/tra-cuu-nhanh.ts`, `apps/api/src/tra-cuu-nhanh.test.ts`
- `apps/web/app/routes/tra-cuu-nhanh._index.tsx`, `tra-cuu-nhanh.muc-phat.tsx`, `tra-cuu-nhanh.toc-do.tsx`, `tra-cuu-nhanh.quy-trinh.tsx`
- `apps/web/app/components/tra-cuu/TheMucPhat.tsx`, `CacBuocQuyTrinh.tsx`

**Migration**
- `0015_tra_cuu_nhanh.sql`:
  - `violations`, gồm các cột:
    - hành vi: `id, code UNIQUE, vehicle CHECK, group_name, behavior, keywords text[]`
    - mức phạt: `fine_min, fine_max, extra_penalties jsonb, point_deduction int`
    - tốc độ: `speed_over_min, speed_over_max`
    - căn cứ và hiệu lực: `citation_urn NOT NULL, effective_from, effective_to`
    - khác: `status, updated_at`
  - index trigram trên `behavior` và `keywords`
  - `procedures(id, code UNIQUE, kind CHECK (vi_pham|tai_nan), title, steps jsonb, status, updated_at)`

**Kiểm tra đã xong**
- [x] Unit test tốc độ: xe máy vượt 5–<10 km/h, 10–20 km/h và trên 20 km/h rơi đúng khoảng; biên đúng 10 km/h thuộc đúng một khoảng; không có khoảng chồng nhau (kiểm trên toàn bộ tệp dữ liệu).
  - `packages/dao-tao/tests/tra-cuu-nhanh.test.ts`: 16 ca. Trên tệp thật, quét tốc độ vượt từ 5 đến 80 km/h (bước 0,5): mỗi giá trị ra đúng một dòng cho mỗi loại xe.
- [ ] `bun run tra-cuu:nap` báo **0 URN hỏng** trên kho giao thông thật. CI chạy bước kiểm tra này.
  - **Chưa đạt:** kho cục bộ chưa có NĐ 168/2024 và Luật Xử lý vi phạm hành chính, nên 10/10 URN báo "không tìm thấy". Script chỉ **cảnh báo** với dòng bản nháp, **chặn** với dòng đã duyệt (`--nghiem` chặn cả bản nháp).
  - CI đã có bước `bun run tra-cuu:nap --kiem-tra`; `scripts/check-citations.ts` kiểm thêm căn cứ của dữ liệu đã duyệt.
- [ ] Mỗi dòng có `citation_urn` mở được trang điều khoản ở GĐ1.
  - Nút "Xem điều khoản" dựng bằng `dieuHrefFromUrn`, giống thẻ căn cứ GĐ1. Chỉ kiểm được sau khi nạp kho giao thông.
- [x] Tra "nồng độ cồn" với loại xe mô tô ra đủ các bậc nồng độ, kèm số điểm bị trừ.
  - API test trên dữ liệu mẫu (căn cứ trỏ vào văn bản mẫu). Trên dữ liệu nháp thật, bật xem bản nháp thì ra 4 dòng: 3 bậc nồng độ và hành vi không chấp hành kiểm tra.
- [x] p95 của `/v1/tra-cuu/*` **< 300 ms** trên máy dev (đo trong `smoke`).
  - Smoke đạt 11/11: mức phạt 6 ms, tốc độ 6 ms, quy trình 4 ms.
- [ ] Soát tay 20 dòng ngẫu nhiên đối chiếu với văn bản gốc (biên bản soát lưu trong PR).
  - "**Chưa làm:** cần Admin quản lý, xem mục "Dữ liệu" bên dưới.

**Trạng thái (24/9/2026):** đã làm xong phần mã; dữ liệu mới là **bản nháp chờ đối chiếu**, nên người học chưa thấy mục nào.
- **Dữ liệu:**
  - `data/tra-cuu/muc-phat.json` có 21 dòng (tốc độ, nồng độ cồn, đèn tín hiệu, điện thoại, mũ bảo hiểm, dây an toàn) cho ô tô và xe máy.
  - `data/tra-cuu/quy-trinh.json` có 2 quy trình xử phạt (không lập và có lập biên bản).
  - Các dòng được soạn khi kho **chưa có** văn bản gốc để đối chiếu, nên đều để `trang_thai: "nhap"` và căn cứ mới trỏ ở mức Điều.
  - Trước khi duyệt, Admin quản lý phải: đối chiếu mức tiền và điểm trừ; thay căn cứ bằng URN tới đúng điểm, khoản; tách dòng theo hiệu lực nếu NĐ 238/2026 đã đổi mức phạt.
  - Quy trình xử lý tai nạn chưa soạn, chờ khách hàng cung cấp văn bản (GAP 4.5-25).
- **Xem trước bản nháp:** API chỉ trả dòng `da_duyet`. Đặt `TRA_CUU_NHANH_BAN_NHAP=1` (chỉ dùng ở môi trường phát triển) thì API trả cả bản nháp, và mỗi thẻ ghi "Bản nháp, chưa đối chiếu văn bản".
- **Khác với thiết kế ban đầu:**
  - Khoảng tốc độ có thêm cột `speed_bounds` (`[)`, `[]`, `(]`, `()`), vì văn bản viết lẫn "đến dưới 10" và "đến 20" rồi "trên 20".
  - `violations` có thêm `search_text` (bỏ dấu) để tìm không dấu; `procedures` có thêm `summary`, `ordinal`, `note`.
  - Dòng hoặc quy trình không còn trong tệp thì chuyển sang `ngung` khi nạp lại, không xóa.
- **Giao diện:**
  - Mục Tra cứu trên header nay mở `/tra-cuu`: ô tìm văn bản và 3 ô tra cứu nhanh.
  - Đã soát ở 360px bằng Chrome không giao diện trên 9 trang: không cuộn ngang, không lỗi JS; dấu "đã làm" của bước quy trình còn sau khi tải lại trang.
  - 5 route mới được khai tạm miễn hướng dẫn trong `content/huong-dan/muc-luc.json`.
- **Cổng chung:**
  - `bun test`: 744 đạt, 5 hỏng. Cả 5 là lỗi cũ ở `packages/config/src/ports.test.ts` trên Windows, như GĐ1.
  - `build:web` và smoke qua.
  - Typecheck và lint của các tệp GĐ5 sạch. Toàn repo lúc chốt còn lỗi ở tệp GĐ2/GĐ3 đang làm song song (`quan-tri.cau-hoi*.tsx`, `ngan-hang*.ts`, `HienThiCauHoi.tsx`, `auth.test.ts`).
- Ngoài danh sách dự kiến, đã sửa hoặc tạo thêm:
  - `routes/tra-cuu.tsx`
  - `components/tra-cuu/LuoiTraCuuNhanh.tsx`, `ChonNgayApDung.tsx`
  - `lib/tra-cuu-nhanh.ts` (web)
  - `lib/site.ts`, `components/ui/Icon.tsx` (3 biểu tượng)
  - `scripts/smoke.ts`, `.github/workflows/ci.yml`, `content/huong-dan/muc-luc.json`
  - `SiteHeader.tsx` không cần sửa, vì menu lấy từ `lib/site.ts`.

---

## GĐ6 — Thi sát hạch: đề thi, trộn đề, giao bài, tính giờ

**Mục tiêu**
- **Quản trị viên** tạo đề: cấu hình 30–40 câu theo **ma trận** chủ đề × mức độ, thời gian, ngưỡng đạt, số lần làm, trộn câu và đảo đáp án.
- **Lãnh đạo Công an xã** giao đề cho đơn vị hoặc cá nhân, kèm hạn làm.
- **Cán bộ** làm bài có **đồng hồ đếm ngược**, nộp bài và xem kết quả.

**Thiết kế**
- **Mỗi lượt thi sinh một đề riêng** từ ma trận, với thứ tự câu và phương án riêng, lưu trong `exam_attempts`. Hai người cùng đơn vị nhận đề khác thứ tự.
- **Đồng hồ do máy chủ quyết định.** `deadline_at = started_at + thời lượng`. Câu trả lời gửi sau `deadline_at + 30 giây` bị từ chối. Hết giờ thì tự nộp, gồm cả lúc người thi đã đóng trình duyệt (worker quét định kỳ).
- **Làm tiếp khi rớt mạng:** mở lại lượt đang làm thì thấy đúng câu đã chọn và thời gian còn lại.
- **Chỉ làm online (A7).** Câu `offline_ok` không liên quan tới thi.
- **Bảng `assessments` cũ không dùng.** Ghi chú trong migration là để dành cho bài kiểm tra trong chuyên đề; không xóa.

**Việc làm**
1. Logic thuần:
   - kiểm tra ma trận khả thi so với số câu đã duyệt;
   - sinh đề (có seed), đảo, chấm;
   - quyết định đạt/không đạt;
   - kiểm tra số lần làm và khung giờ mở.
2. **API quản trị:** `/v1/quan-tri/de-thi` để tạo, sửa, xem trước một đề sinh thử, xuất bản, đóng.
3. **API giao bài:** `/v1/giao-bai` để giao, xem danh sách đã giao, hủy. `quan_ly` chỉ giao được trong phạm vi đơn vị (dùng `trongPhamVi` của GĐ2).
4. **API người thi:**
   - `GET /v1/thi`: bài được giao, trạng thái, hạn
   - `POST /v1/thi/:giaoBai/bat-dau`
   - `GET /v1/thi/luot/:id`: đề + thời gian còn lại, không có đáp án
   - `PUT /v1/thi/luot/:id/cau/:thuTu`: lưu câu trả lời, được sửa trước khi nộp
   - `POST /v1/thi/luot/:id/nop`
   - `GET /v1/thi/luot/:id/ket-qua`: có xem lại đáp án hay không tùy cấu hình đề
5. **Worker** `qdpl-thi-het-gio`: job lặp mỗi phút, tự nộp các lượt quá hạn.
6. **Màn hình:**
   - Quản trị `/quan-tri/de-thi`: form ma trận dạng bảng với số câu khả dụng hiện ngay trong từng ô; xem trước.
   - Quản lý `/quan-tri/giao-bai`: chọn đề, chọn đơn vị hoặc người, đặt hạn.
   - Người học `/thi`: danh sách thẻ "Chưa làm / Đang làm / Đã xong", mỗi thẻ có hạn.
   - `/thi/luot/:id`: đồng hồ cố định ở đầu trang, lưới số câu (đã làm / chưa làm), mỗi câu một màn hình, nút "Nộp bài" có hộp xác nhận ghi rõ số câu chưa làm.
   - `/thi/luot/:id/ket-qua`: đạt/không đạt in to, điểm, thời gian làm.

**File sửa**
- `apps/api/src/app.ts`
- `apps/workers-ts/src/bull/workers/index.ts`
- `packages/queue/src/types.ts`: thêm tên hàng đợi
- `.do/app.yaml`: thêm hàng đợi vào `--queues` của worker
- `apps/web/app/routes.ts`, `SiteHeader.tsx`: mục Thi hoạt động
- `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts`

**File tạo**
- `packages/dao-tao/src/de-thi.ts`, `packages/dao-tao/tests/de-thi.test.ts`
- `packages/db/src/de-thi.ts`
- `apps/api/src/routes/de-thi.ts`: quản trị và giao bài
- `apps/api/src/routes/thi.ts`: người thi
- `apps/api/src/thi.test.ts`
- `apps/workers-ts/src/bull/workers/thi-het-gio.ts`
- `apps/web/app/routes/quan-tri.de-thi.tsx`, `quan-tri.de-thi.sua.tsx`, `quan-tri.giao-bai.tsx`
- `apps/web/app/routes/thi._index.tsx`, `thi.luot.tsx`, `thi.ket-qua.tsx`
- `apps/web/app/components/thi/DongHo.tsx`, `LuoiCauHoi.tsx`, `HopXacNhanNop.tsx`
- `scripts/e2e/thi.ts`

**Migration**
- `0016_de_thi.sql`:
  - `exams`: `id, code, title, field_id, matrix jsonb, question_count CHECK (question_count BETWEEN 30 AND 40), duration_minutes, pass_score DEFAULT 70, shuffle_questions, shuffle_options, max_attempts DEFAULT 1, show_answers CHECK (khong|sau_nop|sau_han), status CHECK (nhap|xuat_ban|dong), created_by, timestamps`
    - Khoảng 30–40 câu là theo PRD. Nếu KH cần đề ngắn hơn cho kiểm tra nhanh, nới bằng migration sau.
  - `exam_assignments`: `id, exam_id, unit_id NULL, account_id NULL, include_subunits, opens_at, due_at, assigned_by, created_at`, CHECK có đúng một trong `unit_id` và `account_id`
  - `exam_attempts`: `id, exam_id, assignment_id, account_id, attempt_no, items jsonb, started_at, deadline_at, submitted_at, submit_kind CHECK (nguoi_thi|het_gio), score, passed, status CHECK (dang_lam|da_nop)`
    - UNIQUE `(assignment_id, account_id, attempt_no)`
    - index riêng một phần cho lượt `dang_lam`, dùng cho worker
  - `exam_answers(attempt_id, ordinal, question_id, question_version, response jsonb, correct, updated_at, PRIMARY KEY(attempt_id, ordinal))`

**Kiểm tra đã xong**
- [x] Unit test:
  - ma trận đòi 10 câu khó mà chỉ có 6 câu thì báo lỗi rõ ở ô nào;
    - Thông báo: "Chủ đề Tốc độ, mức Khó: cần 10 câu, ngân hàng mới có 6 câu đã duyệt."
  - sinh đề 35 câu đúng ma trận;
  - hai seed khác nhau cho hai thứ tự khác nhau;
  - chấm sau khi đảo phương án vẫn đúng.
  - Tổng cộng 17 test trong `packages/dao-tao/tests/de-thi.test.ts`. Có thêm các ca: chọn theo vị trí hiển thị thì chấm theo đúng phương án được chọn; câu bỏ trống tính sai; đồng hồ và điều kiện bắt đầu.
- [x] API test:
  - giao đề cho đội A (có `include_subunits`): người đội A thấy đề, người đội B không thấy;
    - Cán bộ ở tổ A1 (cấp dưới đội A) thấy đề; giao không kèm cấp dưới thì tổ A1 không thấy.
  - `quan_ly` đội B giao đề cho đội A nhận 403;
  - `max_attempts = 1` thì lần bắt đầu thứ hai nhận 409.
  - 15 test trong `apps/api/src/thi.test.ts`.
- [x] API test thời gian, dùng đồng hồ giả lập qua tham số `now` trong lớp logic: trả lời sau `deadline + 30 giây` nhận 409; worker tự nộp lượt quá hạn với `submit_kind = het_gio`.
  - Lớp logic nhận tham số `now`. API test lùi `deadline_at` trong CSDL:
    - hạn + 20 giây vẫn nhận;
    - hạn + 31 giây nhận 409 và lượt tự nộp kiểu `het_gio`.
  - `tuNopLuotQuaHan` (hàm worker gọi) nộp lượt quá hạn; chạy lại không chấm lần hai.
- [x] Mở lại lượt đang làm thì giữ nguyên câu đã chọn và thời gian còn lại giảm đúng.
  - Lùi hạn 120 giây thì thời gian còn lại giảm 119–122 giây.
- [x] Không phản hồi nào của API người thi chứa `answer` trước khi nộp (test quét của GĐ3).
  - Test quét đệ quy mọi khóa `answer`, `noi_dung`, `dap_an`, `giai_thich`, `can_cu` trong phản hồi GET lượt và PUT câu trả lời.
- [x] `bun run e2e` với kịch bản thi: bắt đầu → trả lời → tải lại trang giữa chừng → nộp → xem kết quả.
  - Kịch bản `scripts/e2e/thi.ts`, dùng khung E2E của GĐ4, khung điện thoại 360×740.
  - Lần chạy đầu hỏng một lần: bấm "Bắt đầu" ra trang lỗi chung, trong lúc các phiên khác đang sửa tệp cùng lúc. Chạy lại 2 lần (có và không build lại) đều đạt, không tái hiện được lỗi.

**Trạng thái (24/9/2026):** đã làm xong, đạt 6/6 mục kiểm tra.
- `bun test`: 829 đạt, 6 hỏng. Không lỗi nào do GĐ6:
  - 5 lỗi ở `ports.test.ts`: lỗi môi trường Windows, đã có từ trước.
  - 1 lỗi ở `bao-ve.test.ts`: 4 trang GĐ4 (`luyen-tap.*`, `toi.tsx`) chưa có bài hướng dẫn hay miễn trừ; phiên GĐ4 đang làm.
- Typecheck `apps/api` còn 1 lỗi ở `luyen-tap.test.ts` (GĐ4, đang làm). Mọi tệp GĐ6 đều qua typecheck, lint và `build:web`.
- Thiết kế:
  - Mỗi lượt chụp nội dung từng câu, kèm đáp án, vào `exam_attempts.items`. Sửa câu trong ngân hàng sau đó không làm đổi đề đang thi hay kết quả đã chấm.
  - Hạn nộp của lượt không vượt hạn bài giao: bắt đầu sát hạn thì chỉ còn phần thời gian tới hạn.
  - Ngoài worker, API cũng tự nộp lượt quá hạn khi người thi mở danh sách hoặc mở lượt. Nhờ vậy bản triển khai gọn `app-gon.yaml` (không có worker) vẫn chấm đúng.
  - Đề đã xuất bản chỉ sửa được tên và mô tả; cấu hình và ma trận khóa lại.
  - Tạo và sửa đề: `quan_tri`. Giao bài: từ `quan_ly`, trong phạm vi đơn vị.
- Thêm ngoài danh sách:
  - `apps/web/app/routes/thi.luot.luu.tsx`: route lưu từng câu, gửi tuần tự, gửi lại khi mất mạng
  - `apps/web/app/lib/thi.ts`
  - `lib/format.ts`: `formatNgayGio`, chuyển đổi giờ Việt Nam cho ô `datetime-local`
  - `apps/workers-ts/src/bull/runner.ts` và `registry.ts`: đăng ký lịch lặp mỗi phút
  - `packages/db/package.json`: phụ thuộc `@qdpl/dao-tao`
  - `content/huong-dan/muc-luc.json`: miễn hướng dẫn tạm cho 6 trang mới
- Đã xóa `routes/sap-co.tsx`: trang tạm của GĐ1, không còn route nào dùng.

---

## GĐ7 — Báo cáo, xếp hạng, xuất Excel/PDF (MỐC M2)

**Mục tiêu**
- Lãnh đạo Công an xã xem kết quả **theo cá nhân và đơn vị**: điểm, thời gian làm bài, số lần làm, xếp hạng.
- Xuất ra **Excel** và **PDF**.

**Việc làm**
1. **Báo cáo:**
   - **Kết quả một đề thi:** theo người (điểm, đạt, thời gian, số lần), lọc theo đơn vị (cây con) và khoảng ngày.
   - **Tổng hợp đơn vị:** số người được giao, đã làm, tỷ lệ đạt, điểm trung bình; xếp hạng các đơn vị cùng cấp.
   - **Luyện tập:** số phiên, số câu, tỷ lệ đúng theo chủ đề, theo người hoặc đơn vị.
   - **Câu hỏi khó:** tỷ lệ sai cao nhất, dùng lại thống kê độ khó ở `packages/dao-tao/src/stats.ts`.
2. **Phạm vi:** `quan_ly` chỉ thấy cây đơn vị của mình, `quan_tri` thấy tất cả. Áp ở tầng truy vấn, không chỉ ở giao diện.
3. **Xuất file:**
   - **Excel:** dùng `exceljs` (đã thêm ở GĐ2).
   - **PDF:** dùng `pdf-lib` + `@pdf-lib/fontkit`, nhúng phông **Noto Sans** (có đủ dấu tiếng Việt). Có tiêu đề đơn vị, ngày xuất, người xuất.
   - Mọi lần xuất đều ghi `audit_log`.
4. **Màn hình `/quan-tri/bao-cao`:** 4 tab tương ứng 4 báo cáo, bộ lọc trên cùng, nút "Tải Excel" và "Tải PDF". Không vẽ biểu đồ ở giai đoạn này.

**File sửa**
- `apps/api/src/app.ts`, `apps/web/app/routes.ts`, `apps/web/app/routes/quan-tri.tsx`
- `packages/db/src/index.ts`
- `package.json`: thêm `@pdf-lib/fontkit`

**File tạo**
- `packages/db/src/bao-cao.ts`
- `packages/db/src/pdf.ts`: dựng bảng PDF dùng chung
- `assets/fonts/NotoSans-Regular.ttf`, `NotoSans-Bold.ttf` (giấy phép OFL)
- `apps/api/src/routes/bao-cao.ts`: `/v1/bao-cao/*`; tham số `?dinh_dang=xlsx|pdf` trả file
- `apps/api/src/bao-cao.test.ts`
- `apps/web/app/routes/quan-tri.bao-cao.tsx`
- `apps/web/app/routes/quan-tri.bao-cao.tai.tsx`: resource route chuyển tiếp file tải về

**Migration**
- `0017_bao_cao.sql`:
  - view `v_ket_qua_thi`, nối lượt thi với tài khoản và đơn vị (có `path`), lấy lượt tốt nhất theo cấu hình
  - index hỗ trợ lọc theo `(exam_id, submitted_at)` và `practice_sessions(account_id, finished_at)`
  - chưa dùng materialized view; chỉ thêm khi đo thấy chậm

**Kiểm tra đã xong**
- [x] API test trên dữ liệu gieo (3 đội, 10 người, 1 đề, 15 lượt):
  - báo cáo đề cho số dòng, điểm trung bình, tỷ lệ đạt khớp với phép tính tay trong test;
  - `quan_ly` đội A chỉ thấy người đội A.
  - `apps/api/src/bao-cao.test.ts`, 13 ca. Ngoài hai ý trên còn kiểm:
    - lượt tốt nhất, số lần làm, thời gian làm, xếp hạng;
    - tổng hợp đơn vị (được giao, đã làm, tỷ lệ đạt, điểm trung bình, thứ hạng);
    - luyện tập theo người và theo chủ đề; câu hỏi khó;
    - lọc khoảng ngày;
    - 401/403: `quan_ly` đội A lọc đội B nhận 403; báo cáo luyện tập và câu khó của đội A không có người đội B.
- [x] Mở file `.xlsx` xuất ra bằng `exceljs` trong test: đúng tiêu đề cột, đúng số dòng, số là kiểu số (không phải chuỗi).
  - Test đọc qua hàm mới `docOExcelTho` của `packages/db/src/excel.ts` (bên trong là exceljs), vì `apps/api` không có dependency `exceljs`. Cùng test kiểm có dòng `audit_log` `bao_cao.xuat`.
- [x] PDF xuất ra có 1 trang trở lên. Trích chữ bằng `mupdf` (đã có trong repo) còn đúng chữ có dấu, ví dụ "Đội Cảnh sát giao thông".
- [x] Báo cáo 1.000 lượt thi trả về **< 2 giây** trên máy dev.
  - Trong test: 1.000 lượt, 35.000 câu trả lời. Kết quả đề, tổng hợp đơn vị, câu hỏi khó và xuất Excel mỗi yêu cầu đều dưới 2 giây; cả tệp test chạy khoảng 3 giây.
- [ ] **Demo M2:** đầy đủ luồng quản trị nhập câu hỏi → duyệt → tạo đề → quản lý giao đề → cán bộ thi → quản lý xem báo cáo và tải Excel.
  - **Chưa làm.** Đây là buổi demo với người thật trên dữ liệu thật, cần GĐ6 (đang làm ở phiên song song) chạy xong. Màn hình `/quan-tri/bao-cao` đã typecheck và build qua, nhưng chưa soát trong trình duyệt ở bề rộng 360px.

**Trạng thái (24/9/2026):** đã làm xong phần mã; còn mục Demo M2 (xem trên).
- Cổng chung:
  - `bun run typecheck`: qua toàn bộ.
  - `bun run build:web`: qua.
  - `bun test`: 855 đạt, 6 hỏng, không ca nào thuộc GĐ7.
    - 5 ca ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows này.
    - 1 ca ở `packages/search/src/search.test.ts` (tầng vector). Ca này đạt khi chạy riêng (20/20), nên hỏng là do nhiều phiên cùng chạy test trên một CSDL test.
  - `bun run lint`: các tệp của GĐ7 qua. Lỗi còn lại nằm ở `apps/api/src/auth.test.ts` (GĐ2).
  - `bun run smoke`: 9/11, như GĐ3 và GĐ8.
  - Migration `0017_bao_cao.sql` áp dụng sạch trên CSDL test đã có `0018` (migrate.ts ghi nhận theo tên tệp).
- Tệp đã làm:
  - Migration `0017_bao_cao.sql`: view `v_ket_qua_thi`, index `exam_attempts_da_nop_idx`, `practice_sessions_account_finished_idx`, `exam_answers_question_idx`.
  - `packages/db/src/bao-cao.ts`, `packages/db/src/pdf.ts`.
  - `assets/fonts/NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`, kèm `OFL.txt`.
  - `apps/api/src/routes/bao-cao.ts`, `apps/api/src/bao-cao.test.ts`.
  - `apps/web/app/routes/quan-tri.bao-cao.tsx`, `quan-tri.bao-cao.tai.tsx`, `apps/web/app/lib/bao-cao.ts`.
  - Mục "Báo cáo" trong nhóm Thi của menu quản trị.
  - `@pdf-lib/fontkit` vào `devDependencies` gốc, cạnh `pdf-lib`. Bản build trên DigitalOcean chạy `bun install` đầy đủ nên có gói này.
- Thay đổi so với dự kiến:
  - Thêm `GET /v1/bao-cao/bo-loc`: đề thi và đơn vị trong phạm vi, cho bộ lọc.
  - Hai index của kế hoạch đã có sẵn hoặc được thay:
    - `(exam_id, submitted_at)` đã có từ 0016;
    - index luyện tập là index một phần (`finished_at IS NOT NULL`).
  - Thêm `docOExcelTho` vào `excel.ts`, chỉ thêm hàm, không đổi hàm cũ.
  - Khai tạm miễn bài hướng dẫn cho `quan-tri.bao-cao.tsx` trong `content/huong-dan/muc-luc.json`.
- Quy tắc nghiệp vụ đã chốt:
  - **Kết quả đề:**
    - Mỗi người tính lượt đã nộp có điểm cao nhất; bằng điểm thì lấy lượt nộp sớm hơn.
    - `so_lan` đếm mọi lượt đã nộp. Lọc khoảng ngày theo lúc nộp của lượt được tính.
    - Xếp hạng theo điểm, bằng điểm thì ai làm nhanh hơn đứng trước.
  - **Phạm vi và ngày:**
    - Đơn vị của người là đơn vị hiện tại của tài khoản.
    - Ngày lọc theo giờ Việt Nam, tính cả hai đầu.
    - Tài khoản không phải quản trị mà chưa gắn đơn vị thì nhận 403.
  - **Tổng hợp đơn vị:**
    - Các dòng là đơn vị con trực tiếp của đơn vị đang lọc; không lọc thì của gốc phạm vi. Mỗi dòng cộng cả cây con.
    - "Được giao" là mọi tài khoản đang hoạt động thuộc diện bài giao chưa hủy, kể cả tài khoản quản lý thuộc đơn vị đó.
    - Xếp hạng theo tỷ lệ đạt, rồi điểm trung bình; bằng nhau thì cùng hạng; đơn vị chưa ai làm không xếp hạng.
  - **Luyện tập:**
    - Chỉ tính phiên có `source` là `chu_de`, `cau_sai`, `nhom`.
    - Đếm theo câu trả lời trong khoảng ngày.
  - **Câu hỏi khó:**
    - Gộp câu trả lời thi (lượt đã nộp) và mọi câu trả lời luyện tập, tính bằng `chiSoCauHoi`; chọn một đề thì chỉ lấy câu trả lời của đề đó.
    - Mặc định chỉ tính câu có từ 5 lượt trở lên; lấy 50 câu có tỷ lệ sai cao nhất.
  - **Xuất tệp:**
    - Mọi lần xuất ghi `audit_log` với `action = bao_cao.xuat`.
    - PDF: khổ A4 ngang, lặp dòng tiêu đề cột mỗi trang, chữ dài quá ô thì cắt kèm "…". Đầu tệp ghi đơn vị, khoảng ngày, ngày xuất, người xuất.
    - Excel: ghi các thông tin đó dưới bảng.
  - **Lưu ý kỹ thuật:** phông nhúng phải tắt các tính năng `ccmp`, `liga`, `locl` của fontkit. Nếu không, chữ trích từ PDF sai dấu, ví dụ "vị" thành "vi�".

---

## GĐ8 — AI sinh câu hỏi vào ngân hàng

**Mục tiêu**
- Biên tập viên chọn văn bản hoặc điều khoản và chủ đề; AI sinh N câu hỏi **kèm căn cứ**, vào ngân hàng ở trạng thái **`cho_duyet`**.
- Không có câu AI nào được dùng khi chưa có người duyệt.

**Việc làm**
1. **Thêm bước `sinh_cau_hoi_ngan_hang`** vào worker `soan-bai` hiện có. Worker này đã có sẵn ngân sách, đo chi phí và ghi `authoring_jobs`.
   - Đầu vào: danh sách `node_urn`, chủ đề, mức độ, loại, số câu.
   - Đầu ra: JSON theo schema câu hỏi của GĐ3.
2. **Hậu kiểm tất định**, không nhờ mô hình tự kiểm:
   - mọi `citations` phải tồn tại và còn hiệu lực (dùng lại kiểm căn cứ của `/v1/ask`);
   - câu phải qua kiểm tra hợp lệ của `cau-hoi.ts`;
   - câu trùng gần đúng (trigram trên `stem`) với câu đã có thì bị đánh dấu.
3. **Màn hình:** nút "Sinh bằng AI" trên `/quan-tri/cau-hoi` mở form (chọn điều khoản, số câu, mức độ) và ước tính chi phí; kết quả hiện trong tab "Chờ duyệt" với nhãn "AI".

**File sửa**
- `apps/workers-ts/src/bull/workers/soan-bai.ts`
- `packages/llm/src/prompts.ts`
- `apps/api/src/routes/ngan-hang.ts`: `POST /v1/quan-tri/ngan-hang/sinh-ai`
- `apps/web/app/routes/quan-tri.cau-hoi.tsx`

**File tạo**
- `prompts/dao-tao/sinh-cau-hoi-ngan-hang.md`
- `packages/dao-tao/src/hau-kiem-cau-hoi.ts`, `packages/dao-tao/tests/hau-kiem-cau-hoi.test.ts`
- `apps/api/src/sinh-cau-hoi.test.ts`

**Migration**
- `0018_cau_hoi_ai.sql`: `questions` thêm `authoring_job_id uuid REFERENCES authoring_jobs(id) ON DELETE SET NULL`, `duplicate_of uuid NULL`

**Kiểm tra đã xong**
- [x] Với `LLM_PROVIDER=mock`, job sinh 5 câu vào `cho_duyet` với `source = ai`; chi phí được ghi vào `authoring_jobs`.
  - `apps/api/src/sinh-cau-hoi.test.ts`, 12 ca: tạo việc qua API → chạy worker → 5 câu `cho_duyet`, `source = ai`, lịch sử `ai_sinh`; `authoring_jobs` có `model`, `tokens_in`, `tokens_out`, `cost_usd` (mock tính chi phí bằng 0).
  - Cùng tệp: 401/403, chạy thử không tạo việc, điều khoản chưa hiệu lực hoặc đã bãi bỏ trả 400, chạy lại một việc không sinh thêm câu, sinh lại trên cùng điều khoản thì mọi câu bị loại vì trùng câu đã có, vượt trần chi phí thì Admin quản lý nhận 403.
- [x] Unit test: câu có căn cứ trỏ tới điều đã bãi bỏ bị loại kèm lý do; câu trùng bị đánh dấu `duplicate_of`.
  - `packages/dao-tao/tests/hau-kiem-cau-hoi.test.ts`, 15 ca: bãi bỏ, chưa hoặc hết hiệu lực, không có trong kho, ngoài ngữ cảnh, không có căn cứ, sai loại, trùng với câu đã có, trùng trong cùng lô, đọc JSON của mô hình.
- [ ] Không route luyện tập hay thi nào rút được câu `source = ai` chưa duyệt (dùng lại test của GĐ4 và GĐ6).
  - **Thi (GĐ6):** đã kiểm trong `sinh-cau-hoi.test.ts`. `nguonCauHoiChoMaTran` không rút câu AI chưa duyệt; duyệt một câu thì rút được đúng câu đó.
  - **Luyện tập (GĐ4):** GĐ4 đang làm ở nhánh song song. Các truy vấn rút câu trong `packages/db/src/luyen-tap.ts` đều lọc `status = 'da_duyet'`. Còn chờ test API của GĐ4 chạy qua.
- [ ] Chạy thật với khóa API trên 3 điều của NĐ 168/2024: Admin quản lý soát, và ghi tỷ lệ câu dùng được vào PR để làm mốc chất lượng.
  - **Chưa làm:** máy này chưa có `ANTHROPIC_API_KEY`, và CSDL chưa nạp NĐ 168/2024. Cách chạy: mở `/quan-tri/cau-hoi` → "Sinh bằng AI" → dán URN 3 điều → "Ước tính chi phí" → "Sinh câu hỏi" (cần worker `bun run start:worker` và Redis).

**Trạng thái (24/9/2026):** đã làm xong phần mã; còn 2 mục kiểm tra chưa đạt (xem trên).
- Cổng chung:
  - `bun run typecheck`: các gói qua. `@qdpl/api` còn 1 lỗi ở `src/luyen-tap.test.ts`, là tệp của GĐ4 đang làm dở.
  - `bun run build:web` qua.
  - `bun test`: 829 đạt, 6 hỏng, không ca nào thuộc GĐ8.
    - 5 ca ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows này.
    - 1 ca ở `scripts/huong-dan/bao-ve.test.ts`: 4 route của GĐ4 chưa có bài hướng dẫn.
  - `bun run lint`: các tệp của GĐ8 qua. Còn 3 lỗi định dạng ở `apps/api/src/auth.test.ts` (GĐ2), `scripts/e2e/luyen-tap.ts`, `scripts/e2e/thi.ts` (GĐ4, GĐ6).
  - `bun run smoke`: 9/11 đạt, như GĐ3 (API đang chạy ở cổng 3031 là bản cũ; web chưa chạy).
  - Migration `0018_cau_hoi_ai.sql` áp dụng sạch trên CSDL test.
- Thay đổi so với dự kiến:
  - Phần chạy việc sinh câu hỏi đặt ở tệp riêng `apps/workers-ts/src/bull/workers/sinh-cau-hoi.ts`. `soan-bai.ts` chỉ rẽ nhánh sang tệp này. Tệp không phụ thuộc BullMQ nên test API gọi thẳng được.
  - Không sửa `packages/llm/src/prompts.ts`. Provider mock (`packages/llm/src/mock.ts`) có thêm phần sinh câu tất định cho prompt `dao-tao/sinh-cau-hoi-ngan-hang`, dựng từ nguyên văn điều khoản trong ngữ cảnh, để chạy trọn luồng khi chưa có khóa API.
  - Ngữ cảnh được nạp theo `documents.urn` + `nodes.path` (hàm mới `dieuKhoanNguCanh`). Hàm `nguCanhTuUrn` cũ của `soan-bai.ts` truy vấn cột `nodes.urn`, `nodes.text` không có trong CSDL. Các bước soạn bài cũ **vẫn còn lỗi này**; GĐ8 không sửa vì nằm ngoài phạm vi.
  - `tinhTrangCanCu` hiểu hiệu lực giống `lookupNode` (phiên bản chứa ngày soạn, `valid_to` loại trừ), và phân biệt thêm "chưa có hiệu lực" với "đã hết hiệu lực". Hàm này không gọi thẳng hậu kiểm của `/v1/ask`, vì hậu kiểm đó nằm trong `apps/api`, worker không import được.
  - Thêm `GET /v1/quan-tri/ngan-hang/sinh-ai`: danh sách việc gần đây, kèm số câu, câu bị loại và lý do, chi phí.
  - Thêm cột ảo `duplicate_code` vào danh sách và chi tiết câu hỏi.
  - Trang sửa câu có nhắc "câu do AI sinh" và "gần giống câu …".
  - Thêm index trigram `questions_stem_trgm_idx`.
- Quy tắc nghiệp vụ đã chốt:
  - Câu bị **loại** (không ghi vào ngân hàng) khi:
    - không qua `kiemTraCauHoi`, hoặc sai loại được yêu cầu;
    - không có căn cứ, hoặc có căn cứ nằm ngoài các điều khoản đã chọn (cho phép khoản con và văn bản chứa điều đó);
    - có căn cứ không còn hiệu lực tại ngày soạn.
  - Câu **gần giống** câu đã có (trigram ≥ 0,6, không phân biệt dấu) vẫn được ghi, kèm `duplicate_of`; người duyệt quyết định. Hai câu gần giống trong cùng lô thì câu sau trỏ về câu trước.
  - Riêng lối "Sinh bằng AI" của ngân hàng (`input.loai_trung = true`): câu gần giống bị **loại** kèm lý do, không ghi. Đề thi, bài học và soạn tự động cần đủ số câu nên vẫn nhận câu trùng kèm `duplicate_of`.
  - Ngăn trùng từ gốc (mọi lối): prompt có mục CÂU ĐÃ CÓ gồm đề bài tối đa 50 câu mới nhất có căn cứ thuộc các điều khoản đang sinh (`deBaiDaCoTheoCanCu`), mô hình được dặn không hỏi lại ý đó.
  - Không sinh từ điều khoản đã bãi bỏ hoặc đang ngưng hiệu lực: API trả 400 ngay từ đầu vào.
  - Mỗi lần sinh tối đa 20 câu và 40 điều khoản; mặc định 5 câu, loại Một đáp án và Đúng/sai, mức độ trộn 4 dễ, 4 trung bình, 2 khó.
  - Việc sinh không đi Batch API, vì người soạn đang chờ kết quả. Ngân sách của việc bằng gấp đôi ước tính. Ước tính trên `NGAN_HANG_AI_TRAN_USD` (mặc định 2 USD) thì cần vai trò `quan_tri`.
  - Không nối được Redis trong 3 giây thì API vẫn tạo việc ở trạng thái `cho`, không treo yêu cầu.

---

## GĐ11 — Bài giảng đơn giản (đọc bài, chế độ slide)

**Mục tiêu**
- Cán bộ học các **bài giảng** giao thông đã soạn (dữ liệu `lesson_blocks` có sẵn) dưới dạng đơn giản:
  - **đọc cuộn**, hoặc
  - **chế độ slide**: mỗi khối một trang, vuốt ngang.
- Cuối bài có 3–5 câu kiểm tra nhanh, rút từ ngân hàng theo chủ đề của bài.

**Việc làm**
1. Dựng lại trang bài học trên bộ giao diện mới. Chỉ hiển thị các loại khối cần cho nội dung giao thông đang có: `giang`, `can_cu`, `tom_tat`, `canh_bao`, `bang_tra`, `so_do_trinh_tu`, `the_lat`, `hoi_nhanh`, `kich_ban`. Loại khối khác hiện dạng văn bản thô, kèm cảnh báo trong nhật ký.
2. **Chế độ slide:** cùng dữ liệu, chỉ khác cách trình bày (`?che_do=slide`).
3. Gắn bài học với chủ đề ngân hàng câu hỏi để rút câu cuối bài.
4. Danh mục `/hoc`: lĩnh vực Giao thông → các chuyên đề → các bài, **bỏ bớt** các lớp nhóm đối tượng và cấp độ.
6. Nhân vật đồng hành **tắt mặc định**, theo A8.

**File sửa**
- `apps/web/app/routes/training.tsx`, `training.course.tsx`, `training.lesson.tsx`: dựng lại; có thể đổi URL sang `/hoc` và giữ chuyển hướng từ `/dao-tao`
- `apps/web/app/routes.ts`
- `apps/api/src/routes/dao-tao.ts`: trả `topic_id` của bài
- `SiteHeader.tsx`: mục "Luyện tập" đổi thành "Học & luyện tập", gộp bài giảng vào đó để menu vẫn chỉ có 4 mục

**File tạo**
- `apps/web/app/components/bai-giang/KhoiNoiDung.tsx`, `CheDoSlide.tsx`, `KiemTraCuoiBai.tsx`
- `apps/api/src/bai-giang.test.ts`

**Migration**
- `0021_bai_hoc_chu_de.sql`: `lessons` thêm `topic_id uuid REFERENCES question_topics(id) ON DELETE SET NULL`

**Kiểm tra đã xong**
- [x] Mỗi bài `xuat_ban` trong seed giao thông mở được ở cả hai chế độ, không lỗi render. Test tự động duyệt qua tất cả bài.
  - `scripts/e2e/bai-giang.ts` (`bun run e2e bai-giang`) mở 7/7 bài trên khung 360×740.
    - Chế độ đọc cuộn: kiểm có phần kết bài, không cuộn ngang.
    - Chế độ slide: đi hết mọi trang, kiểm không cuộn ngang ở từng trang, không có lỗi JavaScript.
    - Kết quả: đạt, 6,2 giây.
  - `apps/api/src/bai-giang.test.ts` kiểm API của mọi bài: trả 200, có khối, mỗi khối có dữ liệu, `topicId` đúng.
- [x] Hoàn thành bài thì `lesson_progress` chuyển trạng thái xong.
  - API test:
    - bấm hai lần trạng thái vẫn là xong, không sinh dòng ghi trùng;
    - đi đường `tien-do` với `xong: true` cũng không cộng lần hai;
    - mở lại bài vẫn "xong".
  - E2E: bấm "Hoàn thành bài" trong trình duyệt thì bài chuyển sang trạng thái xong.
- [x] Chế độ slide: vuốt hoặc phím mũi tên chuyển trang; đạt bảng kiểm §0.4.
  - E2E kiểm hai chiều phím →, ← và vuốt trái, vuốt phải bằng sự kiện chạm.
  - Soát ảnh chụp 360px: nút "Trang trước" và "Trang tiếp" cao 48px ở đáy màn hình; chữ nội dung 16px; không hiện URN; căn cứ có nút "Mở điều khoản gốc".
  - Chưa soát trên điện thoại thật.

**Trạng thái (24/9/2026):** đã làm xong, đạt 3/3 mục kiểm tra.
- Cổng chung:
  - `bun run typecheck`: qua toàn bộ.
  - `bun run build:web`: qua.
  - `bun test`: 898 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows này.
  - `bun run lint`: các tệp của GĐ11 qua.
  - `bun run smoke`: 9/11, như các GĐ trước.
  - `bun run e2e bai-giang`: đạt.
- Tệp đã làm:
  - Migration `0021_bai_hoc_chu_de.sql` (`lessons.topic_id`).
  - Component `components/bai-giang/KhoiNoiDung.tsx`, `CheDoSlide.tsx`, `KiemTraCuoiBai.tsx`.
  - Thư viện web `lib/bai-giang.ts`, `lib/bai-giang.server.ts`.
  - Dựng lại `training.tsx` (`/hoc`), `training.course.tsx` (`/hoc/:course`), `training.lesson.tsx` (`/hoc/:course/:lesson`). Tên tệp giữ nguyên để bài hướng dẫn vẫn khớp.
  - `routes/dao-tao.chuyen-huong.tsx`: chuyển `/dao-tao`, `/dao-tao/:course`, `/dao-tao/:course/:lesson` sang `/hoc` (301). Ba trang tiến độ, ôn tập, vá lỗi vẫn ở `/dao-tao`.
  - `apps/api/src/bai-giang.test.ts`, `scripts/e2e/bai-giang.ts`.
- Thay đổi so với dự kiến:
  - Nhãn menu nằm ở `lib/site.ts` (`MAIN_NAV`), không ở `SiteHeader.tsx`. Mục đổi thành "Học & luyện tập", khớp cả `/hoc`, `/dao-tao`. Trang `/luyen-tap` có thẻ "Bài giảng" dẫn tới `/hoc`.
  - API thêm `POST /v1/dao-tao/chuyen-de/:slug/bai/:baiSlug/hoan-thanh`. Hàm `hoanThanhBaiHoc` trong `packages/db/src/dao-tao.ts` làm trong một giao dịch: ghi danh nếu chưa có, đánh dấu xong.
  - `GET` bài học trả thêm `topicId`, `trangThai`, `kiemTraCuoiBai`.
  - Kiểm tra cuối bài dùng lại phiên luyện tập GĐ4. `POST /v1/luyen-tap/phien` nhận thêm `so_cau` (3–10, bỏ trống vẫn là 10).
  - Bài được gắn chủ đề trong `seed-ngan-hang.ts` (hàm `ganChuDeChoBaiHoc`), theo ánh xạ chuyên đề → chủ đề đã có trong `CAY_CHU_DE_GT`. Chỉ gắn bài chưa có chủ đề. Migration không tự gắn, vì lúc chạy migration có thể chưa có chủ đề.
  - Thêm `KHOI_BAI_GIANG` và `SO_CAU_KIEM_TRA_CUOI_BAI` vào `packages/dao-tao/src/blocks.ts`.
  - Không cần sửa `apps/web/app/components/layout/SiteHeader.tsx`.
- Sửa lỗi có sẵn:
  - `ghiTienDo` không còn kéo bài đã xong lùi về "đang học". Trước đây mỗi lần mở lại bài, `GET` bài học ghi đè `state = 'dang_hoc'`.
  - `POST /v1/dao-tao/bai/:id/tien-do` nay kiểm ghi danh thuộc người gọi (403 nếu không), vì route này ghi tiến độ của người gọi.
  - Các route khác nhận `:id` ghi danh trong `dao-tao.ts` vẫn chưa kiểm, xem GĐ0 mục S3.
- Quy tắc nghiệp vụ đã chốt:
  - Khối được dựng đầy đủ: `giang`, `can_cu`, `tom_tat`, `canh_bao`, `bang_tra`, `so_do_trinh_tu`, `the_lat`, `hoi_nhanh`, `kich_ban`.
  - Khối khác hiện chữ thô, và máy chủ web ghi cảnh báo `[bai-giang]`. Trong seed giao thông hiện có ba loại như vậy: `dong_thoi_gian`, `cay_quyet_dinh`, `doi_chieu`.
  - Bài giảng lấy mọi khối (`cheDo=day_du`), không lọc theo chế độ học cũ.
  - Khối `hoi_nhanh` là câu tự kiểm tra trong bài: chấm ngay trên trình duyệt, không tính điểm, như thiết kế cũ.
  - Kiểm tra cuối bài có khi chủ đề của bài (gồm chủ đề con) có từ 3 câu đã duyệt; số câu là min(5, số câu có).
  - Đọc bài không cần đăng nhập. Hoàn thành bài và kiểm tra cuối bài cần đăng nhập.
  - Nhân vật đồng hành không hiện trên trang bài giảng mới (A8).

---

## GĐ12 — Biển báo

*Phụ thuộc câu trả lời GAP 4.5-24: nguồn ảnh và bản quyền.*

**Mục tiêu**
- Tra cứu biển báo theo nhóm và tên, có ảnh, ý nghĩa và căn cứ QCVN 41:2024/BGTVT.

**Việc làm**
1. Nạp văn bản QCVN 41:2024 vào kho: số hóa PDF qua MCP (`nhan_viec_so_hoa` → … → `hoan_tat_so_hoa`), để có `citation_urn` cho từng biển.
2. **Dữ liệu biển báo** `data/bien-bao/bien-bao.json` gồm: mã (ví dụ P.102), nhóm (cấm, nguy hiểm, hiệu lệnh, chỉ dẫn, phụ), tên, ý nghĩa, tên tệp ảnh, căn cứ. Ảnh SVG/PNG tải lên R2 qua `packages/storage`.
3. **Màn hình:** `/tra-cuu-nhanh/bien-bao` gồm lưới ảnh, lọc theo nhóm, tìm theo tên hoặc mã; bấm vào xem chi tiết.

**File tạo**
- `data/bien-bao/bien-bao.json`, `data/bien-bao/anh/*`
- `scripts/bien-bao.ts`: nạp, kiểm tra ảnh và URN
- `packages/db/src/bien-bao.ts`
- `apps/api/src/routes/bien-bao.ts`, `apps/api/src/bien-bao.test.ts`
- `apps/web/app/routes/tra-cuu-nhanh.bien-bao.tsx`

**File sửa**
- `apps/api/src/app.ts`, `apps/web/app/routes.ts`, `tra-cuu-nhanh._index.tsx`

**Migration**
- `0022_bien_bao.sql`: `traffic_signs(code PK, group_name CHECK, name, meaning, image_uri, citation_urn, ordinal, status)` + index trigram trên `name`

**Kiểm tra đã xong**
- [ ] `scripts/bien-bao.ts` báo: 0 ảnh thiếu, 0 URN hỏng.
  - Đạt **0 ảnh thiếu** (13/13 ảnh, mỗi ảnh dưới 400 byte).
  - **Chưa đạt 0 URN hỏng:** kho chưa có QCVN 41:2024/BGTVT, nên URN `vn:vbqppl:qcvn:41/2024/BGTVT` của cả 13 biển báo "không tìm thấy". Script chỉ **cảnh báo** với biển bản nháp, **chặn** với biển đã duyệt (`--nghiem` chặn cả bản nháp), như GĐ5.
- [x] Unit test dữ liệu biển báo: mã đúng dạng, mã trùng, xếp nhầm nhóm, thiếu nội dung, căn cứ sai.
  - `packages/dao-tao/tests/bien-bao.test.ts`, 3 ca.
- [x] Lưới biển báo tải lần đầu < 2 giây trên mạng 4G giả lập (ảnh lazy-load, kích thước ≤ 20 KB mỗi ảnh).
  - `scripts/e2e/bien-bao.ts` giả lập 4G (4 Mbit/s, trễ 20 ms) qua Chrome DevTools Protocol: 1,2–1,3 giây, đo tới lúc mọi ảnh trong khung nhìn tải xong.
  - Ảnh có `loading="lazy"` và kích thước cố định; script nạp chặn ảnh trên 20 KB.

**Trạng thái (24/9/2026):** đã làm xong phần mã; dữ liệu là **bản nháp mẫu**, người học chưa thấy biển nào. Người dùng chọn cách này vì GAP 4.5-24 chưa được trả lời và chưa có tệp PDF QCVN 41:2024.
- **Chưa làm việc 1** (số hóa QCVN 41:2024 qua MCP) vì chưa có tệp PDF. Khi có tệp, số hóa theo vòng `nhan_viec_so_hoa` → `lay_cua_so_trang` → `nop_cua_so` → `hoan_tat_so_hoa`, rồi sửa `can_cu` của từng biển trỏ tới đúng mục của QCVN.
- **Dữ liệu:** `data/bien-bao/bien-bao.json` có 13 biển phổ biến (7 biển cấm, 2 nguy hiểm, 2 hiệu lệnh, 1 chỉ dẫn, 1 biển phụ), tất cả ở trạng thái `nhap`.
  - Tên và ý nghĩa do hệ thống soạn để thử chức năng. Ảnh SVG tự vẽ theo hình dạng chuẩn, chưa phải ảnh chính thức.
  - Biên tập viên phải đối chiếu từng biển với QCVN 41:2024/BGTVT rồi mới chuyển `da_duyet`. Ghi chú này có trong trường `ghi_chu` của từng dòng.
  - Xem trước bản nháp: đặt `TRA_CUU_NHANH_BAN_NHAP=1` cho API, như dữ liệu mức phạt của GĐ5.
- **Cổng chung:**
  - `bun run typecheck` qua.
  - `bun test`: 923 đạt, 6 hỏng.
    - 5 lỗi ở `ports.test.ts`, đã hỏng từ trước trên máy Windows này.
    - 1 lỗi ở `bao-ve.test.ts`, do `routes/luyen-tap.offline.tsx` của GĐ13 (phiên khác, đang làm) chưa có mục hướng dẫn.
  - `build:web` qua.
  - E2E `luyen-tap`, `bien-bao`: 2/2 đạt.
  - Lint các tệp GĐ12 qua.
- **Thay đổi so với dự kiến:**
  - Ảnh lưu qua `packages/storage` dưới `assets/bien-bao/` (R2, hoặc `data/assets/` khi chạy cục bộ; đã thêm vào `.gitignore`). API phục vụ ảnh ở `/v1/tra-cuu/bien-bao/anh/:tep`, web chuyển tiếp qua resource route `routes/bien-bao.anh.tsx`, bộ nhớ đệm một ngày.
  - Tra cứu công khai ở `/v1/tra-cuu/bien-bao`.
  - Migration 0022 nới CHECK `practice_sessions.source`.
  - Ô "Biển báo" thêm vào lưới dùng chung `components/tra-cuu/LuoiTraCuuNhanh.tsx` (hiện ở cả `/tra-cuu` và `/tra-cuu-nhanh`), thay cho sửa riêng `tra-cuu-nhanh._index.tsx`.
  - Thêm script `bun run bien-bao:nap` (`--kiem-tra`, `--nghiem`).
  - Kiểm tra hợp lệ dữ liệu đặt ở `packages/dao-tao/src/bien-bao.ts`: mã đúng dạng, chữ đầu mã khớp nhóm (P cấm, W nguy hiểm, R hiệu lệnh, I chỉ dẫn, S phụ).

---

## GĐ13 — PWA và luyện tập offline (MỐC M3)

**Mục tiêu**
- Cài được ứng dụng lên màn hình chính iOS và Android.
- Khi **mất mạng**:
  - vẫn mở được app;
  - vẫn **luyện tập** được với các chủ đề đã tải về;
  - kết quả tự đồng bộ khi có mạng lại.
- Thi sát hạch và hỏi đáp AI hiện thông báo "Cần có mạng" (A7).

**Thiết kế**
- **Service worker:** `vite-plugin-pwa` (Workbox), chiến lược:
  - tài nguyên tĩnh: cache-first;
  - trang: network-first, có trang dự phòng offline;
  - API: không cache.
- **Gói offline:** `GET /v1/luyen-tap/goi-offline/:chuDe` trả các câu `da_duyet` có `offline_ok = true` **kèm đáp án** để chấm trên máy. Chỉ dùng cho luyện tập, không liên quan tới thi.
- **Dữ liệu trên máy:**
  - lưu trong IndexedDB (gói câu hỏi, hàng đợi kết quả);
  - mỗi câu trả lời offline mang `client_id` (UUID) để máy chủ **bỏ qua bản trùng** khi đồng bộ lại (cột đã có từ GĐ4).
- **Ranh giới SSR:**
  - Màn hình luyện tập offline là **route chạy phía client** (`clientLoader`), đọc từ IndexedDB.
  - Khi có mạng, nó gọi API qua resource route chuyển tiếp `routes/api.$.tsx`. Resource route này giữ token trong cookie HttpOnly và chỉ cho phép một danh sách đường dẫn cố định.
- **Kết quả offline** được ghi vào lịch sử khi đồng bộ, theo thời điểm làm bài thật (có giới hạn trong 7 ngày).

**File sửa**
- `apps/web/package.json`: thêm `vite-plugin-pwa`, `idb`
- `apps/web/vite.config.ts`
- `apps/web/app/root.tsx`: thẻ manifest, đăng ký service worker, biểu ngữ "Đang offline"
- `apps/web/app/routes.ts`
- `apps/api/src/routes/luyen-tap.ts`: gói offline, đồng bộ
- `apps/api/src/app.ts`: CORS nếu cần

**File tạo**
- `apps/web/public/manifest.webmanifest`, `apps/web/public/icons/*` (192, 512, maskable)
- `apps/web/app/routes/offline.tsx`: trang dự phòng
- `apps/web/app/routes/luyen-tap.offline.tsx`: `clientLoader` + IndexedDB
- `apps/web/app/routes/api.$.tsx`: cầu nối có danh sách cho phép
- `apps/web/app/lib/offline/kho.ts`: IndexedDB
- `apps/web/app/lib/offline/dong-bo.ts`: hàng đợi, thử lại, dùng `client_id`
- `apps/web/app/lib/offline/cham.ts`: chấm trên máy bằng cách import thẳng `packages/dao-tao/src/cau-hoi.ts`, cùng một mã với máy chủ
- `apps/api/src/offline.test.ts`
- `scripts/e2e/offline.ts`

**Migration**
- `0023_offline.sql`:
  - `practice_sessions` thêm `client_id uuid UNIQUE NULL`, `offline boolean DEFAULT false`
  - `practice_answers.client_id` đã có từ GĐ4; thêm index nếu thiếu

**Kiểm tra đã xong**
- [x] Lighthouse (Chrome DevTools) báo **Installable**; manifest có đủ icon.
  - Không chạy Lighthouse. Kịch bản E2E hỏi thẳng Chrome qua `Page.getInstallabilityErrors`, cùng kiểm tra mà Lighthouse dùng cho mục Installable:
    - không có lỗi nào, trừ `in-incognito` (context của Playwright luôn ở chế độ ẩn danh);
    - manifest có icon 192, 512 và maskable, tải về đều trả 200.
- [x] `scripts/e2e/offline.ts` bằng playwright-core:
  1. tải gói một chủ đề;
  2. `context.setOffline(true)`;
  3. tải lại trang, luyện 10 câu;
  4. `setOffline(false)`;
  5. kiểm tra máy chủ có đúng 10 `practice_answers`.

  Chạy đồng bộ lần hai thì không sinh bản trùng.
  - `bun run e2e offline` đạt (khoảng 9 giây), gồm cả tải lại trang giữa chừng khi vẫn mất mạng: làm tiếp đúng câu 4.
  - Kịch bản đánh dấu mọi phiên trên máy là chưa gửi để buộc gửi lại, sau đó máy chủ vẫn có đúng 10 câu trả lời.
- [x] Gói offline **không** chứa câu `offline_ok = false`. Không có route nào trả đáp án câu hỏi thi.
  - `apps/api/src/offline.test.ts` (10 ca): gói chỉ có câu `da_duyet` và `offline_ok`.
  - Đáp án chỉ có trong `GET /v1/luyen-tap/goi-offline/:chuDe`, là câu ngân hàng dùng cho luyện tập. Thi không có gói offline, không route nào mới trả dữ liệu thi.
- [x] Offline mà mở `/thi` hoặc `/hoi-dap` thì thấy thông báo "Cần có mạng", không phải trang lỗi.
  - Mở trang mới khi mất mạng: service worker trả `public/offline.html`. E2E kiểm thấy tiêu đề "Cần có mạng" ở cả hai trang.
  - Chuyển trang trong ứng dụng khi mất mạng: `ErrorBoundary` gốc hiện "Cần có mạng" kèm nút "Luyện tập không cần mạng".
- [ ] Soát tay trên iPhone (Safari, thêm vào màn hình chính) và Android (Chrome).
  - **Chưa làm:** cần điện thoại thật và bản chạy HTTPS (DigitalOcean). Service worker chỉ chạy trên HTTPS hoặc localhost.

**Trạng thái (24/9/2026):** đã làm xong phần mã; còn mục soát tay trên điện thoại thật.
- Cổng chung:
  - `bun run build:web`: qua.
  - `bun run typecheck`: các gói của GĐ13 qua. Còn 1 lỗi ở `apps/workers-ts/src/bull/registry.ts` (import `nhac-hoc.ts` chưa có), của GĐ15 đang làm ở phiên song song.
  - `bun test`: 953 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows này.
  - `bun run lint`: các tệp của GĐ13 qua.
  - `bun run smoke`: 9/11, như các GĐ trước.
  - `bun run e2e offline`: đạt, kể cả sau khi GĐ15 chèn listener push vào `sw.js`.
- Tệp đã làm:
  - Migration `0023_offline.sql`: `practice_sessions.client_id` (UNIQUE một phần), `offline`.
  - `packages/db/src/luyen-tap.ts`: `goiOfflineTheoChuDe`, `cauHoiTheoIds`, `layHoacTaoPhienOffline`, `ketThucPhienOffline`.
  - `apps/api/src/routes/luyen-tap.ts`: `GET /goi-offline/:chuDe`, `POST /dong-bo`.
  - Web:
    - `public/manifest.webmanifest`, `public/icons/*` (192, 512, maskable, apple-touch);
    - `public/sw.js`, `public/offline.html`;
    - `routes/luyen-tap.offline.tsx`, `routes/api.$.tsx`;
    - `lib/offline/kho.ts`, `lib/offline/dong-bo.ts`, `lib/offline/cham.ts`;
    - `components/layout/TrangThaiMang.tsx`.
  - `scripts/pwa-icons.ts`: sinh icon bằng Chrome có sẵn.
  - `apps/api/src/offline.test.ts`, `scripts/e2e/offline.ts`.
  - Tệp chung chỉ chèn dòng: `root.tsx` (manifest, icon iOS, đăng ký service worker, biểu ngữ mất mạng, "Cần có mạng" trong ErrorBoundary), `routes.ts`, `luyen-tap._index.tsx` (thẻ "Luyện tập không cần mạng"), `apps/web/package.json` (`idb`), `muc-luc.json` (tạm miễn bài hướng dẫn).
- Thay đổi so với dự kiến:
  - **Không dùng `vite-plugin-pwa`.** Ứng dụng render phía máy chủ (React Router SSR), không có `index.html` để plugin sinh danh sách tệp. Service worker viết tay trong `public/sw.js`, đúng các chiến lược đã định:
    - tài nguyên tĩnh: cache-first;
    - trang: network-first, có trang dự phòng;
    - API, dữ liệu loader (`*.data`) và `/api/*`: không cache.
  - **Không cần sửa `vite.config.ts`** (vì không dùng `vite-plugin-pwa`).
  - **Trang dự phòng là HTML tĩnh `public/offline.html`**, không phải route `routes/offline.tsx`. Trả một trang React cho URL khác (ví dụ `/thi`) sẽ làm React hydrate sai route.
  - **Phiên 10 câu chạy trong state của trang**, không đổi URL giữa các câu. Đổi URL làm React Router gọi lại loader máy chủ của trang gốc, việc hỏng khi mất mạng. Cùng lý do đó, trang không dùng `useRevalidator`.
  - **Trạng thái mạng:** trang coi là mất mạng khi `navigator.onLine` báo mất, HOẶC khi một lần gọi máy chủ hỏng vì lỗi mạng. `onLine` báo sai khi có Wi-Fi mà không có Internet (và khi Playwright giả lập mất mạng).
  - **`app.ts` không cần sửa CORS:** trình duyệt gọi `/api/*` cùng nguồn với web.
- Quy tắc nghiệp vụ đã chốt:
  - **Gói offline:** câu `da_duyet` và `offline_ok` của chủ đề (gồm chủ đề con), tối đa 300 câu, kèm đáp án. Gói nằm trong IndexedDB, không nằm trong cache của service worker.
  - **Chấm trên máy:** dùng thẳng `chamCauHoi`, `rutCauLuyenTap` của `packages/dao-tao` (ngoại lệ có chủ đích của A2).
  - **Máy chủ luôn CHẤM LẠI khi đồng bộ,** bằng nội dung câu hiện tại. Kết quả chấm do máy gửi lên bị bỏ qua.
  - **Chống trùng:** phiên theo `client_id` của phiên; câu trả lời theo `client_id` riêng (UNIQUE). `client_id` đã thuộc tài khoản khác thì phiên bị bỏ qua, có báo lỗi cho phiên đó.
  - **Phiên chưa xong** vẫn gửi phần đã làm; gửi lại khi xong thì máy chủ kết thúc phiên.
  - **Ghi kết quả:** ghi khi đồng bộ, theo thời điểm làm bài thật, không muộn hơn lúc gửi. Làm quá 7 ngày mới gửi thì vẫn lưu kết quả.
  - **Gửi tự động:** khi có mạng lại, khi mở trang, sau mỗi phiên. Lỗi thì thử lại sau 5 giây, 10 giây, 20 giây…, tối đa 5 phút.
  - **Cầu nối `/api/*`** chỉ cho ba đường dẫn: `GET luyen-tap/chu-de`, `GET luyen-tap/goi-offline/:chuDe`, `POST luyen-tap/dong-bo`. Thân yêu cầu tối đa 512 KB.
  - **Service worker** chỉ giữ trang `/luyen-tap/offline` (và mọi tệp `/assets/` trang dùng), ngoài ra các tệp tĩnh và ảnh biển báo `/bien-bao/anh/*`. Đăng ký chỉ ở bản build, không ở bản dev.

---

## GĐ14 — Giọng nói: hỏi bằng giọng, đọc câu hỏi, sách nói

**Mục tiêu**
- Nút **micro** ở hỏi đáp AI và khi luyện tập, để nói câu hỏi hoặc đáp án.
- **Đọc câu hỏi** thành tiếng.
- **Sách nói**: nghe toàn bài giảng.

**Thiết kế**
- **Nhận dạng giọng nói (STT)**
  - Bước đầu dùng **Web Speech API** của trình duyệt (`vi-VN`): không tốn phí, không cần máy chủ.
  - Trình duyệt không hỗ trợ thì ẩn nút micro.
  - STT phía máy chủ (Vbee, FPT.AI hoặc Viettel AI) chỉ thêm khi KH trả lời câu hỏi GAP 4.5-27. Khi đó chỉ thêm một provider trong `apps/api/src/giong-doc.ts`.
- **Đọc thành tiếng (TTS)** dùng lại Vbee, đã có `POST /v1/mascot/giong-doc` với cache theo băm nội dung.
  - Tách thành route trung lập `/v1/giong-doc` và giữ route cũ làm bí danh.
  - Bắt buộc đăng nhập (GĐ0).
- **Sách nói:** worker dựng trước âm thanh cho từng khối của bài đã xuất bản, lưu R2. Trình phát có tua, tốc độ 1×/1.25×/1.5×, và nhớ vị trí nghe.
- **Trả lời bằng giọng khi luyện tập:** khớp lời nói với phương án ("A", "đáp án B", hoặc đọc gần đúng nội dung phương án) bằng so khớp không dấu. Nếu không chắc thì hỏi lại, **không đoán**.

**File sửa**
- `apps/api/src/giong-doc.ts`, `apps/api/src/routes/mascot.ts` (bí danh), `apps/api/src/app.ts`
- `apps/web/app/routes/ask.tsx`, `luyen-tap.phien.tsx`, `training.lesson.tsx`
- `apps/workers-ts/src/bull/workers/index.ts`, `packages/queue/src/types.ts`

**File tạo**
- `apps/api/src/routes/giong-doc.ts`
- `apps/web/app/components/giong-noi/NutMicro.tsx`, `useNhanDangGiong.ts`, `useDocThanhTieng.ts` (tham khảo `useGiongDoc.ts` ở `HEAD`), `TrinhPhatSachNoi.tsx`
- `packages/dao-tao/src/khop-loi-noi.ts`, `packages/dao-tao/tests/khop-loi-noi.test.ts`
- `apps/workers-ts/src/bull/workers/sach-noi.ts`

**Migration**
- `0024_sach_noi.sql`:
  - `lesson_audio(lesson_id, block_id, uri, seconds, text_hash, created_at, PRIMARY KEY(lesson_id, block_id))`
  - `audio_positions(account_id, lesson_id, block_id, offset_seconds, updated_at, PK(account_id, lesson_id))`

**Kiểm tra đã xong**
- [x] Unit test khớp lời nói: "a", "đáp án a", "A." khớp phương án A; "bê" khớp B; lời nói mơ hồ trả "không chắc".
- [x] Trình duyệt không có `SpeechRecognition` thì không hiện nút micro. Kiểm bằng e2e với Firefox giả lập, hoặc bằng cách xóa API khỏi `window`.
- [x] Worker sách nói dựng đủ âm thanh cho một bài mẫu. Lần chạy thứ hai **không** gọi lại Vbee (cache theo `text_hash`), kiểm bằng bộ đếm gọi giả lập.
- [ ] Soát tay trên Chrome Android và Safari iOS: nói "nồng độ cồn xe máy phạt bao nhiêu" thì ô hỏi đáp điền đúng câu.

**Trạng thái (24/9/2026):** đã làm xong phần mã, đạt 3/4 mục kiểm tra. Còn mục soát tay trên Chrome Android và Safari iOS: cần điện thoại thật và micro thật, e2e chỉ giả lập được micro.
- Cổng chung:
  - `bun run build:web`: qua.
  - Typecheck các gói đã sửa qua: dao-tao, db, llm, queue, workers-ts, api, web.
  - `bun test`: 977 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows.
  - Biome: các tệp của GĐ14 qua.
  - `bun run e2e giong-noi`: đạt. Chạy với `VBEE_APP_ID= STORAGE_BACKEND=local STORAGE_DIR=<thư mục tạm>` để không gọi Vbee và không ghi lên R2.
- Tệp đã làm:
  - Migration `0024_sach_noi.sql`:
    - Hai bảng `lesson_audio` và `audio_positions`.
    - Giữ đủ các giá trị `source` đã có tới 0022.
  - `packages/dao-tao`:
    - `khop-loi-noi.ts`: bỏ dấu; nhận tên chữ cái ("bê", "xê", "đê"), số thứ tự sau "phương án"; khớp nội dung bằng hệ số Dice. Nói hai chữ cái, lời phủ định, hay nội dung gần đều nhiều phương án thì trả "không chắc".
    - `sach-noi.ts`: lời đọc từng loại khối; khối video, ảnh, công cụ thì bỏ qua.
    - Test ở `tests/khop-loi-noi.test.ts`.
  - `packages/llm/src/vbee.ts`: phần gọi Vbee tách từ `apps/api/src/giong-doc.ts`, để API và worker dùng chung. `giong-doc.ts` giữ nguyên bộ nhớ đệm, hạn mức và giới hạn đồng thời. Khóa băm và đường dẫn kho không đổi, nên bản đọc cũ vẫn dùng được.
  - `packages/db/src/sach-noi.ts`.
  - API:
    - Route trung lập `/v1/giong-doc`, mọi endpoint bắt buộc đăng nhập, hạn mức tính theo tài khoản:
      - đọc thành tiếng, đọc trước;
      - `POST /khop`;
      - sách nói: danh sách, tệp MP3, vị trí nghe.
    - `/v1/mascot/giong-doc` và `/chuan-bi` là bí danh cùng handler, nên giờ cũng bắt đăng nhập.
    - Xuất bản bài học thì xếp job sách nói.
    - Test ở `apps/api/src/giong-noi.test.ts`.
  - Worker `qdpl-sach-noi` (`workers/sach-noi.ts`):
    - Job một bài, và lịch lặp 6 giờ quét mọi bài đã xuất bản.
    - Lời đọc có băm không đổi thì không gọi Vbee; tệp trùng lời ở bài khác thì dùng lại.
    - Test bằng bộ đếm giả lập ở `apps/workers-ts/tests/sach-noi.test.ts`.
    - Đăng ký ở queue, registry, runner và `.do/app.yaml`.
  - Web:
    - `components/giong-noi/`: `useNhanDangGiong`, `NutMicro`, `useDocThanhTieng`, `ThanhGiongNoiCauHoi`, `TrinhPhatSachNoi`.
    - Cầu nối `routes/api.giong-doc.$.tsx`: chỉ các đường dẫn trong danh sách cho phép, chờ Vbee tối đa 100 giây.
    - Hỏi đáp: nút "Nói câu hỏi" điền vào ô hỏi.
    - Luyện tập: "Đọc câu hỏi" và "Nói đáp án". Nói chỉ chọn đáp án, người học vẫn bấm "Kiểm tra".
    - Bài giảng: trình phát sách nói, có tua, tốc độ 1×/1,25×/1,5× và nhớ vị trí nghe; chỉ khi đã đăng nhập.
    - Kịch bản `scripts/e2e/giong-noi.ts`.
- Lưu ý:
  - Chrome nhận dạng giọng nói qua máy chủ Google, nên cần mạng.

---

## GĐ15 — Nhắc học (Web Push)

**Mục tiêu**
- Gửi thông báo đẩy khi:
  - đến giờ học (người dùng tự chọn giờ);
  - có đề thi mới được giao;

**Thiết kế**
- Web Push chuẩn (VAPID) qua thư viện `web-push`.
- **iOS** chỉ nhận được thông báo khi đã cài PWA ra màn hình chính (iOS 16.4+). Giao diện hướng dẫn cài đặt trước khi xin quyền.
- Job lặp BullMQ `qdpl-nhac-hoc` chạy mỗi 15 phút, gom người dùng đến giờ nhắc, và tôn trọng giờ yên lặng 22h–6h.
- Chỉ xin quyền thông báo sau một hành động của người dùng (nút "Bật nhắc học" ở `/toi`), không xin ngay khi mở trang.

**File sửa**
- `apps/web/app/routes/toi.tsx`
- Service worker của GĐ13: thêm xử lý sự kiện `push` và `notificationclick`
- `packages/db/src/de-thi.ts`: phát sự kiện khi giao bài
- `packages/queue/src/types.ts`, `.do/app.yaml`, `.env.example` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)

**File tạo**
- `packages/db/src/thong-bao.ts`
- `apps/api/src/routes/thong-bao.ts`: đăng ký, hủy, cài đặt giờ nhắc
- `apps/api/src/thong-bao.test.ts`
- `apps/workers-ts/src/bull/workers/nhac-hoc.ts`
- `packages/dao-tao/src/lich-nhac.ts`, `packages/dao-tao/tests/lich-nhac.test.ts`

**Migration**
- `0025_thong_bao.sql`:
  - `push_subscriptions(id, account_id, endpoint UNIQUE, p256dh, auth, user_agent, created_at, last_ok_at, failed_count)`
  - `notification_prefs(account_id PK, remind_at time, new_exam boolean, quiet_from, quiet_to)` (cột `streak_warning` cũ vẫn còn trong bảng nhưng không dùng)
  - `notifications_sent(id, account_id, kind, ref, sent_at, UNIQUE(account_id, kind, ref))`: chống gửi trùng

**Kiểm tra đã xong**
- [x] Unit test lịch nhắc, dùng tham số `now` theo giờ Việt Nam:
  - đúng giờ thì có tên trong danh sách gửi;
  - giờ yên lặng thì không;
  - `packages/dao-tao/tests/lich-nhac.test.ts`, 13 ca. Có thêm: qua mốc 0h giờ Việt Nam, cửa sổ gửi khi job trễ một nhịp, giờ yên lặng qua nửa đêm, đề thi mới.
- [x] Gửi hai lần cùng `kind` và `ref` thì chỉ một bản ghi `notifications_sent` (UNIQUE).
  - `apps/api/src/thong-bao.test.ts`: hai lần phát chỉ có một bản ghi và một lần gửi thật. Một nhịp job lặp lại trong cùng cửa sổ không gửi lại.
- [x] Endpoint trả 410 (hết hạn) thì đăng ký bị xóa sau lần gửi thất bại.
  - Cùng tệp test: 410 thì đăng ký bị xóa; 500 chỉ tăng `failed_count` (bỏ đăng ký sau 5 lần lỗi liên tiếp).
  - `apps/workers-ts/src/bull/workers/nhac-hoc.test.ts` kiểm hàm gửi dùng `web-push` thật: yêu cầu có chữ ký VAPID, thân mã hóa aes128gcm, TTL 12 giờ; mã 410/500 được trả nguyên.
- [ ] Soát tay: nhận được thông báo trên Android Chrome và iPhone đã cài PWA; bấm vào mở đúng trang.
  - **Chưa làm:** cần điện thoại thật và khóa VAPID thật trên máy chủ.
  - Đã kiểm tự động bằng `scripts/e2e/nhac-hoc.ts` (Chrome không giao diện, 360×740):
    - cấp quyền → "Bật nhắc học" → máy chủ lưu đăng ký → đặt giờ nhắc → tắt thông báo;
    - đẩy một thông báo vào service worker qua DevTools Protocol thì thông báo hiện đúng tiêu đề, mang đường dẫn `/luyen-tap`.
  - Chrome không giao diện không đăng ký được với dịch vụ đẩy thật, nên kịch bản thay `PushManager.subscribe` bằng đăng ký giả.

**Trạng thái (24/9/2026):** đã làm xong phần mã; còn mục soát tay trên điện thoại thật.
- Cổng chung:
  - `bun run typecheck` qua.
  - `bun test`: 977 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows này.
  - `build:web` qua.
  - E2E `luyen-tap`, `nhac-hoc`: 2/2 đạt. `nhac-hoc` cần `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` trong môi trường.
  - Lint các tệp GĐ15 qua.
- Để chạy thật: sinh khóa bằng `bunx web-push generate-vapid-keys`, đặt `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (và `VAPID_SUBJECT`) cho API và worker. `.do/app.yaml` đã có ba biến này, và worker đã nghe thêm hàng đợi `nhac-hoc`. Chưa có khóa thì trang Tôi báo "chưa cấu hình", worker bỏ qua nhịp và không ghi `notifications_sent`.
- Thay đổi so với dự kiến:
  - **Không sửa `packages/db/src/de-thi.ts`.** Thông báo "có bài thi mới" do chính job 15 phút phát hiện: bài giao đang mở, giao trong 7 ngày, người đó chưa làm lượt nào và chưa được báo (`ref` là id bài giao). Nhờ vậy thông báo đề thi cũng tôn trọng giờ yên lặng. Đổi lại, thông báo có thể trễ tối đa 15 phút sau khi giao.
  - Mỗi loại thông báo gửi trong một cửa sổ 2 giờ, không phải đúng một thời điểm, để job trễ hoặc lỡ một nhịp vẫn gửi: giờ nhắc tự chọn, đề thi mới. Đã học hôm nay thì không nhắc giờ học nữa.
  - Thêm cột `notifications_sent.delivered` (số thiết bị nhận được).
  - Ghi `notifications_sent` TRƯỚC khi gửi, để hai tiến trình worker chạy cùng lúc không gửi trùng. Đổi lại, lượt gửi hỏng không được thử lại (gửi nhiều nhất một lần).
  - Thư viện `web-push` chỉ cài ở `apps/workers-ts`. `packages/db` nhận hàm gửi từ ngoài vào, nên test không cần mạng.
  - Web: resource route `routes/thong-bao.tsx` làm cầu nối (token nằm trong cookie HttpOnly). Khối `components/thong-bao/NhacHoc.tsx` đặt ở `/toi`:
    - chỉ xin quyền khi người dùng bấm "Bật nhắc học";
    - trên iPhone chưa cài ra Màn hình chính thì hiện hướng dẫn cài trước;
    - chỉ báo "đã bật" khi máy chủ lưu đăng ký thành công; lưu hỏng thì gỡ đăng ký ở trình duyệt.
  - `sw.js` (GĐ13) thêm hai listener `push` và `notificationclick`. Bấm thông báo thì đưa tab đang mở về đúng trang, không có tab thì mở tab mới. Thông báo cùng loại thay nhau (`tag`), không chất đống.

---

## GĐ16a — Nhóm học cùng: CSDL, tiến độ, cổ vũ, API người học

**Mục tiêu**
- Cán bộ lập nhóm học cùng, mời đồng đội bằng mã mời, chia sẻ bài học và đề ôn tập vào nhóm.
- Mỗi thành viên có phần trăm tiến độ của từng mục và phần trăm chung, tính trên máy chủ từ dữ liệu gốc. Thành viên cổ vũ lẫn nhau.
- Giai đoạn này làm CSDL, logic và API cho người học. Giao diện làm ở GĐ16b.

**Thiết kế** ([PROMPT_NHOM_HOC_CUNG.md](PROMPT_NHOM_HOC_CUNG.md) mục 2.1–2.5; câu N2–N10, N15–N17 trả lời theo đề xuất và đề xuất Đ1–Đ6, Đ8–Đ10, Đ14 được đồng ý ngày 29/9/2026)
- **Tiến độ tính lúc đọc** từ `lesson_progress`, `practice_sessions`, `practice_answers`. Không lưu cột phần trăm; không API nào nhận phần trăm do máy khách gửi.
- **Phần trăm một mục**, số nguyên 0–100:
  - bài học: công thức `phanTramBai` hiện có, chuyển thành hàm thuần ở `packages/dao-tao/src/nhom-hoc.ts`, kết quả của route cũ không đổi (đề xuất Đ2). Trang bài học chưa gửi vị trí khối, nên bài học hiện là 0 hoặc 100 (N14);
  - đề ôn tập: lấy phiên `source = 'nhom'` có phần trăm cao nhất. Phiên đã kết thúc là 100 (N6). Phiên đang làm là số câu đã trả lời chia `total` của phiên, tối đa 99 (đề xuất Đ4).
- **Phần trăm chung** của thành viên là trung bình cộng các mục được tính, làm tròn xuống (N5); không có mục nào thì `null`. **Trung bình nhóm** tính trên thành viên đang ở trong nhóm, làm tròn xuống.
- **Không tính:** mục đã gỡ; bài hoặc chuyên đề không còn `xuat_ban` (đề xuất Đ1); đề ôn tập còn dưới 5 câu `da_duyet`. Học trước khi vào nhóm vẫn tính.
- **Đề ôn tập** (đề xuất Đ3):
  - lúc chia sẻ: chọn 5–20 câu bằng `nguonTheoChuDe` và `rutCauLuyenTap`, chốt vào `question_ids`;
  - lúc bắt đầu: `cauHoiDaDuyetTheoId`, `taoPhienLuyenTap`; đã có phiên đang làm thì trả phiên cũ;
  - làm và kết thúc qua `/v1/luyen-tap/phien/:id` có sẵn. `POST /v1/luyen-tap/phien` vẫn không nhận nguồn `nhom`. Đề ôn tập không vào gói offline.
- **Quyền:**
  - người không phải thành viên, kể cả `quan_ly`, gọi `/v1/nhom/:id…` nhận 404;
  - nhóm `luu_tru` trả 409 với mọi thao tác ghi;
  - phản hồi cho thành viên không có điểm, số câu đúng, số lần làm, kết quả thi;
  - trưởng nhóm bị khóa tài khoản xử lý theo N16.
- **Cổ vũ** theo N7: mỗi người cổ vũ một thành viên khác tối đa một lần mỗi ngày giờ Việt Nam trong mỗi nhóm; bấm lại trong ngày thì bỏ lượt; không tự cổ vũ, không cổ vũ người đã rời.
- **Giới hạn tần suất** (đề xuất Đ8): mã mời sai quá 10 lần trong 15 phút thì 429; bấm cổ vũ quá 60 lần mỗi phút thì 429. `ApiError` không có mã 429, nên trả bằng `c.json(..., 429)`.
- **Thông báo** (N9, N15, đề xuất Đ9): API không gửi được Web Push. Thông báo nhóm phát trong nhịp job `nhac-hoc`, mỗi người tối đa một thông báo `nhom_hoc` mỗi ngày.
- **Truy vấn:** tiến độ một nhóm gom trong một lượt truy vấn, không lặp theo từng người. Trong `routes/nhom.ts`, các đường tĩnh (`/ma/:ma`, `/tham-gia`, `/nguon`) khai trước `/:id`.

**Việc làm**
1. Migration `0056_nhom_hoc_cung.sql` (xem mục Migration).
2. `packages/dao-tao/src/nhom-hoc.ts`:
   - hằng số giới hạn (N10);
   - sinh mã mời 8 ký tự bằng `crypto`, bỏ các ký tự 0, O, 1, I, L;
   - hàm thuần `phanTramBai`, `tinhTienDoNhom`; luật cổ vũ theo ngày giờ Việt Nam, nhận tham số `now`.
   - `apps/api/src/routes/dao-tao.ts` gọi lại `phanTramBai` mới.
3. `packages/db/src/nhom-hoc.ts`: truy vấn và giao dịch tạo nhóm, tham gia, rời, mời ra, chuyển quyền, chia sẻ, gỡ, sắp thứ tự, đặt hạn gợi ý, cổ vũ, lưu trữ; gom tiến độ một nhóm.
4. Đề ôn tập: chốt câu lúc chia sẻ, bắt đầu phiên `nhom`.
5. `apps/api/src/routes/nhom.ts`: các route `/v1/nhom` ở bảng mục 2.5, zod `.strict()`. Gắn trong `app.ts`.
6. N6 chọn tính phiên `nhom` vào báo cáo luyện tập: thêm `'nhom'` vào hằng `NGUON_LUYEN_TAP` của `packages/db/src/bao-cao.ts`, không đổi phần khác.
7. N9 chọn có thông báo: thêm `nhom_hoc` vào `LoaiThongBao`, nhánh gửi trong `thongBaoCanGui` và `chayNhacHoc`, công tắc theo N15.
8. `GET /v1/luyen-tap/phien/:id` trả thêm `nhom: { id, ten_de }` khi `source = 'nhom'` (đề xuất Đ14, phần API).

**File sửa**
- `apps/api/src/app.ts`: gắn `/v1/nhom`
- `apps/api/src/routes/dao-tao.ts`: chỉ phần `phanTramBai`
- `apps/api/src/routes/luyen-tap.ts`: chỉ trường `nhom` của `GET /phien/:id` (đề xuất Đ14)
- `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts`: export
- `packages/db/src/luyen-tap.ts`: kiểu `NguonPhien` thêm `nhom`
- `packages/db/src/bao-cao.ts`: chỉ `NGUON_LUYEN_TAP`, khi N6 chọn tính
- `packages/dao-tao/src/lich-nhac.ts`, `packages/db/src/thong-bao.ts`, `apps/api/src/routes/thong-bao.ts` (công tắc N15): chỉ khi N9 chọn có
- `docs/PLAN.md`

**File tạo**
- `packages/db/migrations/0056_nhom_hoc_cung.sql`
- `packages/dao-tao/src/nhom-hoc.ts`, `packages/dao-tao/tests/nhom-hoc.test.ts`
- `packages/db/src/nhom-hoc.ts`
- `apps/api/src/routes/nhom.ts`, `apps/api/src/nhom.test.ts`

**Migration**
- `0056_nhom_hoc_cung.sql`, chỉ thêm, chạy lại được:
  - `study_groups`, `study_group_members`, `study_group_items`, `study_group_cheers` theo mục 2.2. Không tạo `join_scope`, `show_progress`, `exam_id` vì N3, N4, N2 chọn đề xuất (đề xuất Đ5);
  - `practice_sessions.group_item_id uuid REFERENCES study_group_items(id) ON DELETE SET NULL`, index một phần `(group_item_id, account_id) WHERE group_item_id IS NOT NULL`;
  - xóa rồi tạo lại `practice_sessions_source_check` với 9 giá trị: 8 giá trị của `0024` cộng `nhom`;
  - bảng `study_group_join_attempts` (đề xuất Đ8), cột `notification_prefs.group_activity` (N15);
  - UNIQUE một phần `practice_sessions_nhom_dang_lam` `(group_item_id, account_id) WHERE group_item_id IS NOT NULL AND finished_at IS NULL`: mỗi người một phiên đang làm cho mỗi đề.
- Khóa ngoại `study_groups.owner_account_id ... ON DELETE RESTRICT`: test dọn dữ liệu phải xóa nhóm trước khi xóa tài khoản gieo.

**Kiểm tra đã xong**
- [x] Unit test `packages/dao-tao/tests/nhom-hoc.test.ts`, tối thiểu 9 ca:
  1. `phanTramBai` mới cho cùng kết quả với hàm cũ trên 7 bộ đầu vào: `xong` → 100; `dang_hoc` 0/4 khối → 0; 1/3 → 33; 2/3 → 67; 4/4 → 99; `dang_hoc` với 0 khối → 0; `chua_mo` → 0.
  2. Đề ôn tập đã trả lời 5/5 câu mà chưa kết thúc → 99.
  3. Hai phiên 40 và 100 của cùng một mục → 100.
  4. Mục đã gỡ và mục có nội dung không còn xuất bản không vào mẫu số.
  5. Thành viên không có mục nào được tính → `null`.
  6. Ba mục 100, 0, 100 → 66 (làm tròn xuống, không phải 67).
  7. Trung bình nhóm bỏ thành viên đã rời.
  8. Cổ vũ lúc 23:30 ngày 01/10/2026 và 00:30 ngày 02/10/2026 giờ Việt Nam là hai ngày khác nhau.
  9. 1.000 mã mời sinh ra đều dài 8 ký tự và không chứa 0, O, 1, I, L.
  - Đạt 16 ca. Ngoài 9 ca trên còn kiểm: bỏ byte lệch phân bố khi sinh mã, chuẩn hóa mã người dùng gõ, bộ đếm 60 lần mỗi phút, và 2 ca thông báo `nhom_hoc` (có hoạt động thì gửi một thông báo; không hoạt động, tắt công tắc, giờ yên lặng thì không gửi).
- [x] API test tính tiến độ trong `apps/api/src/nhom.test.ts`. Dữ liệu gieo tiền tố `test-gd16a`:
  - thành viên A (trưởng nhóm), B, C; bài 1 có 4 khối, bài 2 có 5 khối, cùng một chuyên đề `xuat_ban`; một đề ôn tập 5 câu;
  - B xong bài 1 **trước khi** vào nhóm và đã kết thúc phiên đề ôn tập;
  - C đọc bài 2 tới khối 2 (gieo thẳng `lesson_progress`) và trả lời 3/5 câu đề ôn tập, chưa kết thúc;
  - kết quả phải khớp phép tính tay: A = 0; B = ⌊(100 + 0 + 100) / 3⌋ = 66; C = ⌊(0 + 40 + 60) / 3⌋ = 33; trung bình nhóm = ⌊(0 + 66 + 33) / 3⌋ = 33.
  - Đạt. Phần trăm từng mục của C là 0, 40, 60; của B là 100, 0, 100. Danh sách nhóm của B trả 66 và 33.
- [x] API test quyền và lỗi, cùng tệp, mỗi ý một ca:
  - không phải thành viên gọi `GET /v1/nhom/:id` nhận 404; `quan_ly` không là thành viên nhận 404; thành viên thường đổi mã mời nhận 403;
  - sai mã 10 lần thì lần thứ 11 trong 15 phút nhận 429; mã cũ sau khi đổi nhận 404; nhóm đủ số thành viên theo N10 nhận 409;
  - nhóm `luu_tru` nhận 409 ở cả 13 route ghi của nhóm (mục 2.5, trừ `POST /`);
  - chia sẻ bài chưa xuất bản nhận 400; bài `xuat_ban` thuộc chuyên đề chưa xuất bản nhận 400 (đề xuất Đ1); chủ đề dưới 5 câu đã duyệt nhận 400; chia sẻ trùng bài nhận 409; gửi kèm khóa `phan_tram` nhận 400;
  - quét khóa cấm `score`, `diem`, `correct`, `so_cau_dung`, `passed`, `dat` ở mọi độ sâu của `GET /v1/nhom/:id` và `GET /v1/nhom/:id/thanh-vien/:accountId/tien-do`: 0 khóa;
  - tự cổ vũ nhận 400; bấm hai lần trong ngày thì `tong` về 0; cổ vũ người đã rời bị từ chối và không có dòng mới trong `study_group_cheers`; lần bấm thứ 61 trong một phút nhận 429;
  - trưởng nhóm rời khi còn thành viên nhận 409; chuyển quyền rồi rời được; thành viên cuối rời thì nhóm thành `luu_tru`;
  - bắt đầu đề ôn tập hai lần trả cùng id phiên; kết thúc phiên thì phần trăm mục là 100;
  - đề 6 câu bị gỡ duyệt 1 câu: phiên mới có 5 câu; gỡ thêm 1 câu: mục hiện "Nội dung không còn đủ câu" và không vào mẫu số.
  - `apps/api/src/nhom.test.ts` đạt 27/27 ca. Ngoài các ý trên còn kiểm:
    - khách nhận 403, chưa đăng nhập nhận 401, id sai dạng nhận 404; mã mời gõ chữ thường vẫn tham gia được; người bị mời ra nhận 404;
    - trang `/nguon` chỉ trả bài và chuyên đề `xuat_ban`, chủ đề đủ 5 câu; tham số lạ nhận 400; tên có thẻ HTML nhận 400;
    - gỡ mục (thành viên chỉ gỡ mục mình chia sẻ), sắp thứ tự (thiếu mục, lặp mục nhận 400), đặt và bỏ hạn gợi ý;
    - trưởng nhóm bị khóa tài khoản: quyền chuyển cho người vào sớm nhất; không còn ai thì nhóm lưu trữ (N16);
    - `GET /v1/luyen-tap/phien/:id` trả `nhom: { id, ten_de }` (Đ14);
    - thông báo: người được cổ vũ nhận đúng một `nhom_hoc` qua `chayNhacHoc`, nhịp sau không gửi lại, người tắt `group_activity` không nhận.
- [x] Hiệu năng: `GET /v1/nhom/:id` với 30 thành viên và 30 mục (20 bài học, 10 đề ôn tập 20 câu), mỗi thành viên có tiến độ ở mọi mục: trung vị của 5 lần gọi dưới 300 ms trên máy dev.
  - Đạt: 56, 55, 84, 53, 54 ms (trung vị 55 ms). Dữ liệu gieo có 600 dòng `lesson_progress`, 300 phiên `nhom`, 1.500 câu trả lời.
- [x] `apps/api/src/bai-giang.test.ts` vẫn đạt, gồm ca phần trăm bài `p-1`, `p-2`, `p-3` là 100, 75, 99 sau khi chuyển `phanTramBai`.
- [x] Migration áp sạch trên CSDL trống và trên CSDL test đang có dữ liệu; chạy lại lần hai không lỗi; tạo được phiên với cả 9 giá trị `source`.
  - CSDL trống: tạo CSDL tạm trên Postgres cục bộ, `migrate.ts` áp đủ 42 tệp; chạy lần hai báo "Không có migration mới"; chạy riêng lại nội dung `0056` không lỗi; xóa CSDL tạm.
  - CSDL test có dữ liệu (đã tới `0050`): `test-setup` áp `0056` sạch.
  - Ca "CHECK nguồn phiên" trong `nhom.test.ts` tạo được phiên với 9 giá trị; giá trị lạ bị `practice_sessions_source_check` chặn.
- [x] Cổng chung §0.2 đạt. Test hỏng từ trước ghi rõ tên tệp.

**Trạng thái (29/9/2026):** đã làm xong, đạt 7/7 mục kiểm tra.
- Quyết định của người dùng khi làm giai đoạn này: N2–N10, N15, N16, N17 theo cột "Đề xuất"; đồng ý đề xuất Đ1–Đ6, Đ8, Đ9, Đ10, Đ14. Đã ghi vào cột "Trả lời" của PROMPT_NHOM_HOC_CUNG.md mục 2.8, 2.9 và sửa mục 2, mục 4 theo.
- Cổng chung:
  - `bun run typecheck`: 16/16 gói qua.
  - `bun test`: 1.638 đạt, 7 bỏ qua, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, lỗi môi trường Windows có từ trước.
  - `bun run lint`: các tệp của GĐ16a qua. Lỗi còn lại ở 3 tệp có từ trước, giai đoạn này không sửa: `apps/api/src/auth.test.ts`, `apps/api/src/routes/mascot.ts`, `apps/web/app/lib/luyen-tap.server.ts`.
  - `bun run build:web`: qua.
  - `bun run smoke`: 10/11 đạt, 1 bỏ qua (web SSR tìm web ở cổng 3030, lúc chạy web không ở cổng đó).
  - Postgres cục bộ chạy qua `bun run db:up` (Docker Desktop).
- Thay đổi so với dự kiến:
  - Tiến độ một nhóm đọc bằng 3 truy vấn cố định chạy song song (mục, thành viên, dữ liệu tiến độ của mọi thành viên × mọi mục), cộng một truy vấn kiểm thành viên. Số truy vấn không phụ thuộc số người.
  - Thêm UNIQUE một phần `practice_sessions_nhom_dang_lam` để hai lần bấm "Làm đề" cùng lúc chỉ tạo một phiên; lần thứ hai bắt lỗi trùng rồi trả phiên đã có. Thêm index `study_group_cheers(to_account_id, day)` cho job thông báo.
  - `GET /v1/nhom/ma/:ma` (xem trước) cũng ghi lượt thử và tính vào giới hạn 10 lần sai, để không dò mã qua đường xem trước.
  - `POST /:id/muc/:itemId/bat-dau` trả 201 khi tạo phiên mới, 200 khi trả phiên đang làm.
  - `luuCaiDatNhac` nhận `group_activity` không bắt buộc; thiếu thì giữ giá trị đang có. Nhờ vậy `apps/api/src/thong-bao.test.ts` và web hiện có không phải sửa.
  - Tên nhóm, mô tả, tên đề ôn tập từ chối ký tự `<`, `>` và ký tự điều khiển (mô tả cho phép xuống dòng), theo quy tắc "không nhận HTML".
  - Route cũ `apps/api/src/routes/dao-tao.ts` giữ một hàm bọc `phanTramCuaBai` gọi `phanTramBai` mới.
  - Test thông báo nhóm đặt trong `apps/api/src/nhom.test.ts` (gọi `chayNhacHoc` với hàm gửi giả), không sửa `thong-bao.test.ts`.
  - Không sửa tệp ngoài danh sách "File sửa".
- Quy tắc nghiệp vụ đã chốt:
  - **Giới hạn (N10):** 30 thành viên đang ở trong một nhóm; 30 mục chưa gỡ trong một nhóm; một người làm trưởng nhóm tối đa 5 nhóm đang hoạt động (đếm theo trưởng nhóm hiện tại, không theo người tạo); một người ở trong tối đa 10 nhóm đang hoạt động, kể cả nhóm mình tạo. Nhóm lưu trữ không tính.
  - **Mã mời:** 8 ký tự từ bảng 31 ký tự. Người dùng gõ không phân biệt hoa thường, bỏ khoảng trắng và gạch nối. Sai quá 10 lần trong 15 phút thì 429 cho cả xem trước và tham gia; lượt đúng không xóa lượt sai.
  - **Tham gia:** đã ở trong nhóm thì trả nhóm đó (200). Người đã rời hoặc bị mời ra vào lại được bằng mã hiện tại, `joined_at` tính lại.
  - **Rời nhóm, lưu trữ:** nhóm đã lưu trữ không rời được (409, như mọi thao tác ghi) và vẫn hiện trong danh sách nhóm của tôi. Người cuối rời, hoặc trưởng nhóm bị khóa mà không còn ai, thì nhóm lưu trữ với `archived_by` trống.
  - **Trưởng nhóm bị khóa (N16):** chuyển quyền ở lần đọc hoặc ghi kế tiếp vào nhóm; trưởng nhóm cũ ở lại nhóm với vai trò thành viên. Không chuyển quyền được cho tài khoản đang bị khóa (400).
  - **Phần trăm:** bài học làm tròn bằng `Math.round`, chặn 99; đề ôn tập đang làm làm tròn xuống, chặn 99; phần trăm chung và trung bình nhóm làm tròn xuống.
  - **Họ tên hiển thị:** `accounts.name`, thiếu thì tên đăng nhập; không dùng email.
  - **Chia sẻ:** mọi thành viên chia sẻ được; mục mới đứng cuối danh sách; bài đã gỡ chia sẻ lại được. Đề ôn tập chọn câu bằng `rutCauLuyenTap` (chia đủ ba mức độ); chủ đề ít câu hơn số yêu cầu thì lấy hết, tối thiểu 5.
  - **Làm đề ôn tập:** thứ tự câu giữ theo đề đã chốt, phương án đảo theo seed của mục, người và thời điểm bắt đầu.
  - **Báo cáo luyện tập GĐ7** tính phiên `nhom` (N6).
  - **Cổ vũ:** `tong` là tổng lượt nhận trong nhóm từ trước tới nay. Cổ vũ người đã rời nhận 400; người chưa từng ở trong nhóm nhận 404. Giới hạn 60 lần mỗi phút kiểm trước khi kiểm thành viên.
  - **Thông báo (N9, N15):** nội dung "Hôm nay bạn nhận N lượt cổ vũ. Nhóm của bạn có M bài mới được chia sẻ."; "bài mới" là bài người khác chia sẻ trong ngày, sau lúc người nhận vào nhóm. Bấm vào mở `/nhom` (trang làm ở GĐ16b).

---

## GĐ16b — Nhóm học cùng: giao diện người học và hộp thoại

**Mục tiêu**
- Cán bộ dùng nhóm học cùng trên điện thoại: xem nhóm, học tiếp, cổ vũ, mời đồng đội, chia sẻ bài.
- Có component hộp thoại dùng chung `HopThoai` cho mọi hộp thoại mới.

**Thiết kế** (PROMPT_NHOM_HOC_CUNG.md mục 2.6; ngày 29/9/2026: N1 chọn khác, N14 theo đề xuất, đồng ý Đ13; N4, N7, N15, Đ14 đã trả lời ở GĐ16a)
- Ba trang: `/nhom`, `/nhom/:id`, `/nhom/tham-gia/:ma`. Bảy hộp thoại ở bảng mục 2.6: tạo nhóm, tham gia, chia sẻ từ trong nhóm, chia sẻ từ trang bài học, mời thành viên, tiến độ thành viên, xác nhận. Hộp gợi ý AI làm ở GĐ16d.
- **`HopThoai`** dựng trên `<dialog>` và `showModal()` theo mẫu `HopXacNhanNop.tsx`:
  - lớp `.sheet` dưới 768px, hộp giữa màn hình từ 768px;
  - `aria-labelledby`; Esc đóng; trả tiêu điểm về nút đã mở; khóa cuộn nền khi mở (`.sheet` hiện không khóa);
  - có hiệu ứng thì tắt dưới `prefers-reduced-motion`.
  - Không sửa `HopXacNhanNop.tsx` và ngăn "Thêm" của `BottomNav.tsx`.
- Hộp thoại có biểu mẫu dùng `fetcher.Form`; lỗi hiện trong hộp, không đóng hộp khi lỗi; nút chính khóa khi đang gửi.
- **Lối vào** theo N1 (chọn khác): thẻ "Nhóm học cùng" trên `/luyen-tap` và dòng "Nhóm học cùng" trong ngăn "Thêm" (`MORE_NAV`) trên điện thoại; không có dòng ở `/toi`. Thêm `/nhom` vào `MAIN_NAV[1].khop` trong `lib/site.ts`; mục "Học" của `BOTTOM_NAV` chép `khop` từ đó nên tự sáng theo. Menu cán bộ vẫn 4 mục.
- **Thanh phần trăm** mới `ThanhPhanTram`, không dùng `ThanhTienDo` vì thanh đó hiện số câu đúng (đề xuất Đ13). Phần trăm luôn có số đi kèm, không chỉ dựa vào màu.
- **Nút "Cổ vũ"**: biểu tượng SVG mới trong `Icon.tsx`, `aria-label`, `aria-pressed`; cập nhật ngay, lỗi thì trả trạng thái cũ và báo lỗi. Không emoji, không dùng chữ "like", "thả tim".
- Làm đề ôn tập trên trang `/luyen-tap/:phien` có sẵn; trang kết quả có nút "Về nhóm" (đề xuất Đ14).
- Web gọi API ở máy chủ web qua `lib/nhom.server.ts`, theo mẫu `lib/luyen-tap.server.ts`.

**Việc làm**
1. `components/ui/HopThoai.tsx`.
2. Ba trang và bảy hộp thoại. Chưa đăng nhập mà mở liên kết mời thì chuyển sang đăng nhập rồi quay lại.
3. Nút "Cổ vũ" và biểu tượng.
4. Lối vào theo N1.
5. Nút "Chia sẻ vào nhóm" trên `/hoc/:course/:lesson`, chỉ hiện khi đã đăng nhập và có ít nhất một nhóm.
6. Câu nêu quyền riêng tư trong hộp thoại tham gia theo N4.
7. Trang luyện tập nhận nguồn `nhom` (đề xuất Đ14). N14 chọn không sửa trang bài học. N15 chọn đề xuất: thêm công tắc thông báo nhóm vào khối nhắc học ở `/toi`.
8. Bài hướng dẫn hoặc khai miễn tạm cho 3 trang mới trong `content/huong-dan/muc-luc.json`.
9. Thêm luồng demo nhóm học cùng vào `docs/DEMO.md`.

**File sửa**
- `apps/web/app/routes.ts`
- `apps/web/app/lib/site.ts`: chỉ `khop` và lối vào theo N1 (một dòng `MORE_NAV`)
- `apps/web/app/routes/luyen-tap._index.tsx`: thẻ "Nhóm học cùng"
- `apps/web/app/routes/training.lesson.tsx`: nút chia sẻ (loader lấy nhóm đang hoạt động, action `chia-se-nhom`)
- `apps/web/app/components/ui/Icon.tsx`: thêm biểu tượng
- `apps/web/app/lib/luyen-tap.server.ts`, `apps/web/app/routes/luyen-tap.phien.tsx`, `apps/web/app/routes/luyen-tap.ket-qua.tsx`: chỉ nguồn `nhom`, tên đề, nút "Về nhóm" (đề xuất Đ14)
- `apps/web/app/components/thong-bao/NhacHoc.tsx`: công tắc, chỉ khi N15 chọn đề xuất
- `content/huong-dan/muc-luc.json`, `docs/DEMO.md`, `docs/PLAN.md`

**File tạo**
- `apps/web/app/components/ui/HopThoai.tsx`
- `apps/web/app/routes/nhom.tsx`, `nhom.chi-tiet.tsx`, `nhom.tham-gia.tsx`; `nhom.nguon.tsx`, `nhom.tien-do.tsx` (chỉ có loader, cho hộp thoại đọc qua fetcher)
- `apps/web/app/components/nhom/`: `HopTaoNhom`, `HopThamGia`, `HopChiaSe`, `HopChiaSeBai`, `HopMoiThanhVien`, `HopTienDoThanhVien`, `HopTuyChonMuc`, `HopSuaNhom`, `HopXacNhanNhom`, `KhoiLienKetMoi`, `NutCoVu`, `DanhSachMuc`, `DanhSachThanhVien`, `ThanhPhanTram` (đề xuất Đ13)
- `apps/web/app/lib/nhom.ts`, `apps/web/app/lib/nhom.server.ts`
- `scripts/e2e/nhom-hoc.ts`

Kiểm lại tên tệp route thật trước khi sửa. Tên khác danh sách trên thì dùng tên thật và ghi vào "Thay đổi so với dự kiến".

**Migration**
- Không có.

**Kiểm tra đã xong**
- [x] `bun run e2e nhom-hoc` trên khung 360×740, chạy trọn dưới 90 giây trên máy dev:
  - tài khoản A tạo nhóm, sao chép liên kết mời; tài khoản B chưa đăng nhập mở liên kết, được chuyển sang đăng nhập, quay lại trang tham gia và bấm "Tham gia nhóm";
  - A chia sẻ một bài học và một đề ôn tập 5 câu; B bấm "Hoàn thành bài"; A thấy phần trăm chung của B là 50;
  - A cổ vũ B; B thấy 1 lượt cổ vũ; A bấm lại thì B thấy 0;
  - B làm đề ôn tập từ nhóm, kết thúc phiên, bấm "Về nhóm" và thấy mục đó là 100%, phần trăm chung là 100.
  - Đạt hai lần liền: kịch bản 21,2 và 19,5 giây; cả lượt kể cả dựng máy chủ 27 và 24 giây (thêm khoảng 12 giây khi build web).
- [x] Bố cục, đo trong cùng kịch bản: 3 trang và 7 hộp thoại không cuộn ngang (`kiemKhongCuonNgang`); mọi nút cao ≥ 48px; chữ nội dung ≥ 16px.
  - Đo ở 3 trang và 9 hộp thoại (thêm hộp Tùy chọn mục và hộp chia sẻ từ trang bài học). Mọi nút, liên kết, ô chọn trong vùng nhóm cao ≥ 48px (ô chọn tính theo nhãn bao ngoài); không nút nào tràn chữ.
  - Chữ nội dung (tên nhóm, tên mục, họ tên, lời giải thích trong hộp, câu quyền riêng tư) ≥ 16px. Dòng phụ khai `text-sm` (loại mục, số thành viên, nhãn ô nhập, nhãn nút "Cổ vũ") 14px như các trang có sẵn.
- [x] Bàn phím, đo bằng `document.activeElement`: mở từng hộp thoại bằng Enter; Tab không ra khỏi hộp; Esc đóng hộp và tiêu điểm về đúng nút đã mở; gửi biểu mẫu bằng Enter.
  - Hộp "Tham gia nhóm" và "Tạo nhóm" mở bằng Enter; 8 lần Tab trong hộp "Tạo nhóm" không ra ngoài; tạo nhóm bằng Tab tới ô tên, gõ, Enter. Esc trả tiêu điểm về "Nhập mã mời" và về họ tên thành viên.
- [x] Khi hộp thoại mở, trang phía sau khóa cuộn; đóng hộp thì trở lại như cũ.
  - Khóa đặt ở `<html>` (`document.documentElement`), không ở `body`. Kịch bản đo `getComputedStyle(document.documentElement).overflow` là `hidden` khi mở, và hết `hidden` trong 2 giây sau khi đóng (sự kiện `close` chạy ở lượt xử lý sau).
- [x] Chế độ giảm chuyển động (`reducedMotion: reduce`): hộp thoại có `animation-name: none` và không có `transition` về vị trí; mở, gửi, đóng vẫn làm được.
  - Chế độ thường: hộp trượt lên 200 ms (đo được ≥ 100 ms). Giảm chuyển động: thời lượng ≤ 1 ms (quy tắc chung ở `styles/app.css` ép về 0,01 ms), `animation-name: none`; hộp vẫn mở, đóng được.
- [x] Nút "Cổ vũ": `aria-pressed` đổi sau khi bấm; máy chủ báo lỗi thì nút trả về trạng thái cũ và hiện thông báo lỗi.
  - Không chặn được lời gọi API bằng Playwright vì web gọi API từ máy chủ. Kịch bản gọi thẳng API tới khi nhận 429 (giới hạn 60 lần mỗi phút), rồi bấm trên giao diện: hiện lỗi "Bấm cổ vũ quá nhiều lần…", `aria-pressed` giữ giá trị trước khi bấm.
- [x] Ở `/nhom` và `/nhom/:id`, mục "Học & luyện tập" (1280px) và "Học" (360px) ở trạng thái đang chọn; menu cán bộ vẫn 4 mục.
  - Thêm: ngăn "Thêm" trên điện thoại có dòng "Nhóm học cùng" (N1).
- [x] Chuỗi mới qua bảng kiểm §0.4 và QUY-TAC-HANH-VAN: tìm trong các tệp mới được 0 emoji, 0 dấu chấm than trong chuỗi hiển thị, 0 chữ "like", "thả tim".
  - Cũng 0 tiểu từ tình thái ("nhé", "nha", "ạ"), 0 "chúng ta", "rất", "cực kỳ".
- [x] `scripts/huong-dan/bao-ve.test.ts` đạt với 3 trang mới; `bun run e2e bai-giang` và `bun run e2e luyen-tap` vẫn đạt.
  - `bao-ve.test.ts` 9/9. E2E `bai-giang` 7,7 giây, `luyen-tap` 8,0 giây. `nhac-hoc` đạt (4,7 giây) khi có cặp khóa VAPID tạm trong biến môi trường; không có khóa thì hỏng như đã ghi ở GĐ15.
- [x] Cổng chung §0.2 đạt.

**Trạng thái (29/9/2026):** đã làm xong, đạt 10/10 mục kiểm tra.
- Quyết định của người dùng khi làm giai đoạn này: N1 chọn khác (dòng trong ngăn "Thêm", giữ thẻ ở `/luyen-tap`, không có dòng ở `/toi`); N14 không sửa trang bài học; đồng ý Đ13.
- Cổng chung:
  - `bun run typecheck`: qua toàn bộ.
  - `bun test`: 1.648 đạt, 7 bỏ qua, 13 hỏng. Không ca nào thuộc GĐ16b (giai đoạn này chỉ sửa web):
    - 5 ở `packages/config/src/ports.test.ts`, lỗi môi trường Windows có từ trước;
    - 1 ở báo cáo tiến độ học, test của GĐ16c do phiên khác đang làm cùng lúc;
    - 7 ở `sinh-cau-hoi.test.ts`, `tu-lai.test.ts`, `search.test.ts` do máy tải nặng; chạy riêng ba tệp này đạt 66/66.
  - `bun run lint`: các tệp của GĐ16b qua. Lỗi định dạng có từ trước ở `apps/web/app/lib/luyen-tap.server.ts` (kiểu `KetQuaTroChoi`) để nguyên.
  - `bun run build:web`: qua. `bun run smoke`: 10/11 đạt, 1 bỏ qua (web SSR ở cổng 3030 chưa chạy).
- Thay đổi so với dự kiến:
  - Theo N1 chọn khác: không sửa `apps/web/app/routes/toi.tsx`.
  - Thêm hai route chỉ có loader `nhom.nguon.tsx` và `nhom.tien-do.tsx` cho hộp chia sẻ và hộp tiến độ; không cần bài hướng dẫn.
  - Thêm hai hộp ngoài bảng mục 2.6: "Tùy chọn mục" (chuyển lên, chuyển xuống, hạn gợi ý, gỡ) và "Sửa tên và mô tả", để trưởng nhóm dùng được các API sắp thứ tự, hạn gợi ý, sửa nhóm của GĐ16a. Đã ghi vào bảng mục 2.6.
  - `HopThoai` kèm hook `useHop`: biết hộp nào đang mở, đếm số lần mở để làm mới biểu mẫu mỗi lần mở. Hộp chỉ gọi `onDong` khi người dùng tự đóng (Esc, nút Đóng); khi nơi gọi đổi sang hộp khác thì không gọi, để hộp mới không bị đóng theo.
  - Hiệu ứng trượt lên dùng biến thể `starting:` của Tailwind (`@starting-style`), chỉ bật dưới `motion-safe`.
  - Công tắc thông báo nhóm đọc `group_activity` như trường không bắt buộc trong `NhacHoc.tsx`, không sửa kiểu ở `routes/thong-bao.tsx`.
  - Trang kết quả luyện tập: với phiên của nhóm, "Về nhóm" là nút chính, "Luyện lại câu sai" và "Chọn chủ đề khác" thành nút phụ.
  - Hàm `tenPhienLuyenTap` đặt ở `lib/nhom.ts` vì trang làm bài chạy cả ở trình duyệt, không nhập được từ tệp `.server`.
- Quy tắc nghiệp vụ đã chốt:
  - Nút "Học tiếp" ở đầu trang nhóm dẫn tới mục đầu tiên được tính mà người xem chưa đạt 100%; không còn mục nào thì không hiện.
  - Nút "Chia sẻ vào nhóm" ở trang bài học chỉ hiện khi đã đăng nhập và có ít nhất một nhóm đang hoạt động; tài khoản không vào được nhóm (khách) coi như không có nhóm, trang bài vẫn mở bình thường. Nhóm đã có bài đó thì báo riêng, không chặn nhóm khác.
  - Mở liên kết mời khi đã ở trong nhóm thì chuyển thẳng tới nhóm.
  - Nhóm đã lưu trữ: ẩn mọi nút ghi (chia sẻ, mời, cổ vũ, học, tùy chọn, rời) và hiện "Nhóm đã lưu trữ, chỉ còn xem được."
  - Mã mời gõ trong hộp tham gia được chuẩn hóa như API (bỏ khoảng trắng, gạch nối, viết hoa).

---

## GĐ16c — Nhóm học cùng: quản lý xem tiến độ học

**Mục tiêu**
- Lãnh đạo Công an xã xem các nhóm học cùng có thành viên trong đơn vị mình, và tiến độ của từng thành viên trong phạm vi.
- Có báo cáo "Tiến độ học" của từng cán bộ trong cây đơn vị theo N13, xuất Excel và PDF như các báo cáo GĐ7.

**Thiết kế** (PROMPT_NHOM_HOC_CUNG.md mục 2.1, 2.5 phần Quản lý và Báo cáo, 2.6 Trang quản lý; câu N11, N13 trả lời theo đề xuất, đề xuất Đ11, Đ12 được đồng ý, Đ18 trả lời "Không" ngày 29/9/2026)
- **Phạm vi áp ở tầng truy vấn** bằng `phamViCua` và điều kiện `units.path <@ phạm vi`, theo đơn vị **hiện tại** của từng thành viên.
  - Thành viên ngoài phạm vi chỉ trả số lượng, không trả tên, không trả id.
  - `quan_ly` chưa gắn đơn vị nhận 403; thành viên chưa gắn đơn vị là ngoài phạm vi với mọi `quan_ly` (đề xuất Đ11). `quan_tri` thấy tất cả.
- `apps/api/src/routes/nhom.ts` export thêm `quanTriNhomRoute`, gắn `/v1/quan-tri/nhom` trước dòng `app.route("/v1/quan-tri", quanTri)`.
- **Báo cáo** dùng lại `chuanBi()` và `traVe()` của `routes/bao-cao.ts` (đề xuất Đ12): cùng bộ lọc `don_vi`, `tu`, `den`, thêm `nhom`; cùng cách xuất tệp và ghi `audit_log` `bao_cao.xuat`.
- **Cột báo cáo**, 13 cột: họ tên; đơn vị; bài đã xong; bài đã ghi danh; phần trăm bài học; số phiên luyện tập; tỷ lệ đúng; bài thi được giao; đã nộp; đạt; số nhóm đang tham gia; phần trăm trung bình trong các nhóm; lần học gần nhất. Cách đếm ba cột "bài đã ghi danh", "bài thi được giao", "lần học gần nhất" theo đề xuất Đ12.
- Lưu trữ nhóm từ trang quản trị theo N11, ghi `audit_log` `nhom.luu_tru`.
- Index thêm khi đo thấy cần, bằng migration mới. Đ18 trả lời "Không": cần thì dùng `0057_nhom_hoc_bao_cao.sql` và GĐ16d chuyển sang `0058`. Không sửa `0056` đã áp.

**Việc làm**
1. API `/v1/quan-tri/nhom`: danh sách, chi tiết, lưu trữ theo N11.
2. Hàm `tienDoHocVien` trong `packages/db/src/bao-cao.ts` (chỉ thêm hàm); route `GET /v1/bao-cao/tien-do-hoc`.
3. Trang `/quan-tri/nhom`, `/quan-tri/nhom/:id`; tab "Tiến độ học" trong `/quan-tri/bao-cao`; mục "Nhóm học cùng" trong nhóm menu "Thi" của quản trị, cạnh "Báo cáo".
4. Đo báo cáo trên 1.000 cán bộ; thêm index nếu cần.
5. Bài hướng dẫn hoặc khai miễn tạm cho 2 trang mới.

**File sửa**
- `apps/api/src/app.ts`, `apps/api/src/routes/nhom.ts`, `apps/api/src/routes/bao-cao.ts`
- `packages/db/src/bao-cao.ts`: chỉ thêm hàm, không đổi hàm cũ
- `packages/db/src/nhom-hoc.ts`
- `apps/web/app/routes.ts`, `apps/web/app/routes/quan-tri.tsx` (mục menu), `apps/web/app/routes/quan-tri.bao-cao.tsx` (thêm tab)
- `apps/web/app/lib/bao-cao.ts`: thêm `tien-do-hoc` vào `LOAI_BAO_CAO` và `nhom` vào `LOC_BAO_CAO`; `quan-tri.bao-cao.tai.tsx` chặn loại không có trong danh sách này
- `content/huong-dan/muc-luc.json`, `docs/PLAN.md`

**File tạo**
- `apps/web/app/routes/quan-tri.nhom.tsx`, `quan-tri.nhom.chi-tiet.tsx`
- `apps/api/src/quan-tri-nhom.test.ts`

**Migration**
- Không có: đo trên 1.000 cán bộ và 50 nhóm thấy không cần index (xem mục Hiệu năng). Cần sau này thì `0057_nhom_hoc_bao_cao.sql`, GĐ16d chuyển sang `0058` (Đ18).

**Kiểm tra đã xong**
- [x] API test `apps/api/src/quan-tri-nhom.test.ts`. Dữ liệu gieo tiền tố `test-gd16c`:
  - phòng P có đội A và đội B; 10 cán bộ, 5 đội A và 5 đội B; một `quan_ly` đội A, một `quan_ly` phòng P, một `quan_tri`, một `quan_ly` chưa gắn đơn vị;
  - nhóm N1 gồm 3 cán bộ đội A; nhóm N2 gồm 2 cán bộ đội A và 3 cán bộ đội B, trưởng nhóm thuộc đội B.
  - Đạt 18/18 ca. Dữ liệu gieo thêm: cán bộ X0 chưa gắn đơn vị ở N1 (kiểm Đ11); nhóm N3 chỉ có B4, B5 (kiểm 404 với quản lý đội A). Nhóm lập, tham gia, chia sẻ qua API người học của GĐ16a; tiến độ bài học, phiên luyện tập, lượt thi gieo bằng SQL với mốc giờ cố định.
- [x] Phạm vi, mỗi ý một ca:
  - `quan_ly` đội A: danh sách có N1 và N2; chi tiết N2 có 2 thành viên và số thành viên ngoài phạm vi là 3; phản hồi không chứa họ tên hay id của người đội B;
  - `quan_ly` đội A lọc `don_vi` là đội B nhận 403; `quan_ly` phòng P thấy đủ 10 cán bộ; `quan_tri` thấy tất cả; `can_bo` gọi `/v1/quan-tri/nhom` nhận 403; `quan_ly` chưa gắn đơn vị nhận 403;
  - `quan_ly` đội A lưu trữ N2 nhận 403; `quan_ly` phòng P lưu trữ N2 được và có đúng 1 dòng `audit_log` `nhom.luu_tru`.
  - Đạt. Thêm: quản lý đội A xem N3 nhận 404; X0 là ngoài phạm vi với cả quản lý phòng P, trong phạm vi với quản trị (N1: 3 trong và 1 ngoài phạm vi với quản lý, 4 và 0 với quản trị); lưu trữ lần hai nhận 409; tham số lạ nhận 400; thành viên vẫn xem được N2 sau khi lưu trữ.
- [x] Báo cáo tiến độ học: 13 cột của 3 cán bộ gieo sẵn số liệu khớp phép tính tay trong test; lọc `nhom` là N2 với `quan_ly` đội A trả đúng 2 dòng.
  - Đạt với A1, A4, B1 (phép tính tay ghi ở đầu tệp test), kèm ca lọc khoảng ngày 12/9–16/9 và ca người chưa học gì. Nhóm N3 không có ai trong phạm vi của quản lý đội A: lọc theo N3 nhận 404.
- [x] Tệp `.xlsx` đọc bằng `docOExcelTho`: đúng 13 tiêu đề cột, số dòng bằng số cán bộ trong phạm vi, cột số là kiểu số. PDF có ít nhất 1 trang, chữ trích bằng `mupdf` giữ đúng dấu tiếng Việt. Mỗi lần xuất có 1 dòng `audit_log` `bao_cao.xuat`.
  - Đạt. Excel của quản lý phòng P có 12 dòng (10 cán bộ và 2 quản lý thuộc phòng P). PDF có đủ 13 tiêu đề cột không bị cắt; nhật ký lần xuất có lọc nhóm ghi thêm id nhóm.
- [x] Hiệu năng: báo cáo 1.000 cán bộ và 50 nhóm (mỗi nhóm 20 thành viên, 10 mục) trả JSON và Excel dưới 2 giây mỗi yêu cầu trên máy dev.
  - Dữ liệu gieo: 5.000 dòng tiến độ bài học, 6.000 phiên luyện tập (5.000 phiên đề ôn tập), 30.000 câu trả lời, 1.000 lượt thi. Test lấy trung vị 5 lần gọi mỗi đường, như GĐ16a.
  - Hai lượt chạy: JSON 728–867 ms và 304–435 ms; Excel 849–970 ms và 415–579 ms; danh sách nhóm 521–695 ms và 142–173 ms.
  - Lượt chạy đầu tiên có một lần gọi JSON mất 19 giây, hai lần còn lại dưới 0,9 giây. Đo riêng từng truy vấn thì không thấy kế hoạch truy vấn hỏng (truy vấn tiến độ nhóm 204 ms trong `EXPLAIN ANALYZE` khi bảng chưa có thống kê); nhiều khả năng đĩa ảo của Docker bị nghẽn ngay sau khi nạp dữ liệu. Vì vậy test so trung vị với 2 giây, không so lần chậm nhất.
  - Ngày 30/9/2026 lại gặp một lượt có hai lần gọi JSON 4,1 và 4,5 giây (trung vị 704 ms). Ba lượt chạy sau đó không có lần nào quá 0,72 giây. Gọi thẳng `tienDoHocVien` 10 lần liền cũng không có lần chậm (250–630 ms). Một lượt có ghi `pg_stat_activity` mỗi 0,3 giây không bắt được truy vấn nào quá 0,4 giây ngoài bước test tự nạp dữ liệu. **Chưa tìm ra nguyên nhân.** Lúc đó có hai phiên khác (GĐ16b, GĐ16d) làm việc trên cùng máy và cùng CSDL test. Cần theo dõi lại trên máy chủ thật.
- [x] Soát ảnh chụp `/quan-tri/nhom`, `/quan-tri/nhom/:id`, tab "Tiến độ học" ở 1280px và 360px: trang không cuộn ngang (bảng cuộn trong khung riêng), bộ lọc và hai nút tải dùng được bằng bàn phím.
  - Đạt, bằng một kịch bản E2E tạm trên CSDL dev (đã xóa sau khi chạy, dữ liệu `e2e-` đã dọn): `kiemKhongCuonNgang` ở 6 trang; bấm Tab từ đầu trang tới được ô chọn nhóm, nút "Xem báo cáo", "Tải Excel", "Tải PDF"; tải Excel qua web giữ bộ lọc nhóm. Sau lần soát đầu đã sửa: tiêu đề cột và kết quả đề ôn tập không xuống dòng, tiêu đề tab trang chi tiết không lặp chữ "Nhóm".
- [x] `apps/api/src/bao-cao.test.ts` (13 ca của GĐ7) vẫn đạt. `apps/api/src/nhom.test.ts` của GĐ16a vẫn đạt 27/27.
- [x] Cổng chung §0.2 đạt. Test hỏng từ trước ghi rõ tên tệp ở mục Trạng thái.

**Trạng thái (29/9/2026):** đã làm xong, đạt 8/8 mục kiểm tra.
- Quyết định của người dùng khi làm giai đoạn này: N11, N13 theo cột "Đề xuất"; đồng ý đề xuất Đ11, Đ12; Đ18 trả lời "Không" (cần index thì dùng `0057`, GĐ16d chuyển sang `0058`). Đã ghi vào cột "Trả lời" của PROMPT_NHOM_HOC_CUNG.md mục 2.8, 2.9 và sửa mục 0, mục 2 theo.
- Cổng chung:
  - `bun run db:migrate`: "Không có migration mới".
  - `bun run typecheck`: 16/16 gói qua.
  - `bun test`: 1.656 đạt, 7 bỏ qua, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, lỗi môi trường Windows có từ trước.
  - `bun run lint`: các tệp của GĐ16c qua. Lỗi còn lại ở 3 tệp có từ trước, như GĐ16a: `apps/api/src/auth.test.ts`, `apps/api/src/routes/mascot.ts`, `apps/web/app/lib/luyen-tap.server.ts`.
  - `bun run build:web`: qua (build trong lượt E2E soát ảnh).
  - `bun run smoke`: 10/11 đạt, 1 bỏ qua (web SSR tìm web ở cổng 3030, lúc chạy web không ở cổng đó), như GĐ16a.
- Làm song song với phiên GĐ16b: phiên đó sửa cùng lúc `apps/web/app/routes.ts`, `content/huong-dan/muc-luc.json`, `docs/PLAN.md`, `docs/PROMPT_NHOM_HOC_CUNG.md`. Các thay đổi của hai phiên trong những tệp này đang cùng tồn tại; cần soát lại diff trước khi commit.
- Thay đổi so với dự kiến:
  - Không có migration (xem Hiệu năng).
  - `packages/db/src/nhom-hoc.ts`: hai hàm đọc mục và dữ liệu tiến độ của GĐ16a nhận nhiều nhóm cùng lúc (`docMucCacNhom`, `docDuLieuTienDoCacNhom`), hàm một nhóm gọi lại hàm mới. Truy vấn dữ liệu tiến độ chỉ đếm câu đã trả lời của phiên đề ôn tập đang làm, vì phiên đã kết thúc luôn là 100. Kết quả của GĐ16a không đổi (27/27 ca); `GET /v1/nhom/:id` 30×30 còn trung vị 29 ms và 37 ms ở hai lượt chạy (GĐ16a ghi 55 ms).
  - Thêm loại lỗi `ngoai_pham_vi` vào `LoiNhom`, route đổi sang 403 `NgoaiPhamVi`.
  - `traVe()` của `routes/bao-cao.ts` nhận thêm trường không bắt buộc `nhatKy` để ghi id nhóm vào nhật ký xuất; bốn báo cáo cũ không đổi.
  - Tiêu đề cột của tệp xuất viết ngắn ("Bài ghi danh", "Được giao", "TB nhóm (%)"…) để 13 cột vừa khổ A4 ngang của PDF; nghĩa từng cột ghi ở phần ghi chú dưới bảng.
  - `quan-tri.bao-cao.tai.tsx` không phải sửa: tệp này đã kiểm loại theo `LOAI_BAO_CAO` và chép bộ lọc theo `LOC_BAO_CAO`.
  - Xác nhận lưu trữ nhóm dùng `confirm()`, không dùng `HopThoai` của GĐ16b vì tệp đó chưa có khi bắt đầu và không nằm trong danh sách tệp của GĐ16c.
  - Danh sách nhóm trả tối đa 300 nhóm cập nhật gần nhất (`GIOI_HAN_DANH_SACH_NHOM`); đủ 300 thì trang nhắc thu hẹp bộ lọc.
  - Không sửa tệp ngoài danh sách "File sửa", trừ `docs/PROMPT_NHOM_HOC_CUNG.md` (ghi câu trả lời theo quy tắc 13).
  - Ngày 30/9/2026, theo yêu cầu của người dùng, thêm dữ liệu demo: `scripts/demo-nhom-hoc.ts` (4 nhóm "[Demo]", chỉ chạy trên CSDL `_demo`), một bước trong `scripts/demo.ts`, mục 7n của `docs/DEMO.md`. Cùng lúc đổi thứ tự dòng báo cáo tiến độ học (trước đây theo đường dẫn ltree, sinh từ uuid nên thứ tự đội trông như ngẫu nhiên).
- Quy tắc nghiệp vụ đã chốt:
  - **Phạm vi:** thành viên trong phạm vi khi đơn vị hiện tại của tài khoản nằm trong cây đơn vị của quản lý; tài khoản chưa gắn đơn vị ngoài phạm vi của mọi `quan_ly` (Đ11). Quản lý chỉ thấy nhóm có ít nhất một thành viên đang ở trong nhóm thuộc phạm vi; nhóm khác trả 404. Nhóm không còn thành viên nào (người cuối đã rời) không có trong danh sách.
  - **Người ngoài phạm vi:** chỉ có số lượng; trưởng nhóm ngoài phạm vi không có tên. Tiến độ trung bình của nhóm trên trang quản lý chỉ tính người trong phạm vi, làm tròn xuống.
  - **Kết quả đề ôn tập** (chỉ quản lý thấy): phiên đã kết thúc có tỷ lệ đúng cao nhất, hiện dạng "4/5 đúng".
  - **Lưu trữ (N11):** thứ tự kiểm 404 (không thấy nhóm), 409 (đã lưu trữ), 403 (trưởng nhóm ngoài phạm vi). `archived_by` là tài khoản quản lý; `audit_log` `nhom.luu_tru` ghi id nhóm, tên nhóm, số thành viên. Trưởng nhóm bị khóa được xử lý theo N16 trước khi đọc hoặc lưu trữ.
  - **Báo cáo tiến độ học, người có dòng:** tài khoản đang hoạt động, vai trò từ `can_bo` trở lên, đơn vị hiện tại trong phạm vi, kể cả tài khoản quản lý (như cột "Được giao" của GĐ7). Tài khoản chưa gắn đơn vị không có dòng, như các báo cáo GĐ7. Xếp đơn vị cấp trên trước, cùng cấp theo thứ tự đơn vị (`units.ordinal`), rồi họ tên.
  - **Báo cáo tiến độ học, cách đếm:**
    - bài đã ghi danh, được giao theo Đ12, không lọc ngày; bài đã xong lọc theo lúc xong;
    - luyện tập như báo cáo luyện tập theo người (có phiên `nhom`);
    - đã nộp, đạt đếm trên các đề được giao: có lượt đã nộp, có lượt đạt trong khoảng ngày;
    - số nhóm là nhóm đang hoạt động người đó đang ở trong; phần trăm trung bình trong các nhóm làm tròn xuống, trống khi không có nhóm hoặc các nhóm chưa có mục nào được tính;
    - lần học gần nhất theo Đ12, không lọc ngày.
  - **Lọc nhóm:** thành viên đang ở trong nhóm (kể cả nhóm đã lưu trữ) thuộc phạm vi; nhóm không có ai trong phạm vi trả 404.

---

## GĐ16d — Nhóm học cùng: AI gợi ý thứ tự học và tóm tắt tiến độ

**Mục tiêu**
- Trưởng nhóm nhận gợi ý thứ tự học cho các mục trong nhóm (AI-1) và tự quyết định có áp dụng không.
- Lãnh đạo Công an xã đọc bản tóm tắt tiến độ nhóm do AI soạn từ số liệu trong phạm vi (AI-2), đặt cạnh bảng số liệu để đối chiếu.
- Giai đoạn bỏ được nếu N12 chọn không làm AI.

**Thiết kế** (PROMPT_NHOM_HOC_CUNG.md mục 2.7; N12 trả lời "AI-1 và AI-2", đồng ý đề xuất Đ7, Đ15, Đ16, Đ17 ngày 30/9/2026; mẫu GĐ8)
- Gọi `complete()` với `modelFor("light")`, đồng bộ, hết giờ sau 20 giây. Phần còn lại của trang không phụ thuộc AI.
- **Không gửi dữ liệu định danh.** Họ tên, tên đăng nhập, email, đơn vị, cấp bậc (`accounts.name`, `username`, `email`, `unit_id`, `rank_title`) không vào yêu cầu gửi mô hình.
  - Thành viên gửi dưới mã `TV1…TVn`, mục gửi dưới mã `M1…Mn` kèm tên (đề xuất Đ15).
  - Bảng đối chiếu giữ ở máy chủ; máy chủ thay mã bằng họ tên, tên mục **sau** hậu kiểm.
- **Hậu kiểm tất định**, không nhờ mô hình tự kiểm:
  - AI-1: `thu_tu` là hoán vị đúng của các mã mục đầu vào; `ghi_chu` tối đa 300 ký tự;
  - AI-2: 3–5 câu; mọi con số có trong đầu vào, trừ chữ số nằm trong mã `TVn`, `Mn`; mọi mã `TVn`, `Mn` tồn tại;
  - cả hai: không có mẫu viện dẫn (`Điều \d`, `khoản`, `Nghị định`, `Thông tư`, `Luật`, số hiệu dạng `/\d{4}/`, số tiền); `soatChu` không báo lỗi chặn (emoji, dấu chấm than, khẩu ngữ) (đề xuất Đ16).
- **Hậu kiểm hỏng:** ghi `study_group_ai_notes` `status = 'bi_loai'` kèm lý do, không hiện kết quả. AI-1 hiện "Hệ thống chưa gợi ý được thứ tự cho nhóm này."; AI-2 không hiện khối tóm tắt.
- AI-1 không tự áp dụng: trưởng nhóm bấm "Áp dụng thứ tự này", web gọi `PUT /v1/nhom/:id/muc/thu-tu`.
- Khối AI-2 luôn có dòng "Tóm tắt do AI soạn từ số liệu trong bảng dưới đây, cần đối chiếu với bảng." AI-2 chỉ dùng thành viên trong phạm vi của quản lý đang xem; mỗi phạm vi một bản.
- **Bộ nhớ đệm và hạn mức:** cùng `input_hash` thì trả kết quả đã có, không gọi mô hình. Chỉ tính lần gọi thật (đề xuất Đ17): AI-1 tối đa 5 lần mỗi nhóm mỗi ngày, AI-2 tối đa 20 lần mỗi quản lý mỗi ngày; quá thì 429.
- **Chưa bật khóa API:** provider là mock ngoài `NODE_ENV=test` (`isMock()`, gồm cả `LLM_PROVIDER=none`) thì API trả 503 với câu "Chức năng gợi ý bằng AI chưa được bật.", giao diện ẩn nút. Không hiện văn bản của mock cho người dùng thật.
- Ghi `model`, `tokens_in`, `tokens_out`, `cost_usd` mỗi lần gọi thật.

**Việc làm**
1. Migration `0057_nhom_hoc_ai.sql`. Kiểm số migration lớn nhất trước khi đặt tên.
2. Prompt `prompts/nhom-hoc/goi-y-thu-tu.md`, `prompts/nhom-hoc/tom-tat-tien-do.md`, cùng định dạng `prompts/dao-tao/sinh-cau-hoi-ngan-hang.md` (frontmatter `version`, `## SYSTEM`, `## USER`). Prompt cấm nêu quy định, mức phạt, điều khoản; yêu cầu JSON đúng schema; viết theo QUY-TAC-HANH-VAN.
3. `packages/dao-tao/src/hau-kiem-nhom-hoc.ts`: hậu kiểm tất định.
4. `packages/db/src/nhom-hoc.ts`: dựng đầu vào đã ẩn danh, tính `input_hash`, dùng lại kết quả cũ khi trùng, ghi `study_group_ai_notes`. AI-2 gửi sẵn số tổng hợp (trung bình nhóm, tỷ lệ hoàn thành từng mục, số người chưa bắt đầu) (đề xuất Đ15).
5. API `POST /v1/nhom/:id/ai/thu-tu` (trưởng nhóm) và `POST /v1/quan-tri/nhom/:id/ai/tom-tat` (`quan_ly` trở lên).
6. Giao diện: nút "Gợi ý thứ tự học" và hộp thoại `HopGoiYThuTu` trong `/nhom/:id` (trưởng nhóm); khối tóm tắt trong `/quan-tri/nhom/:id`.
7. `packages/llm/src/mock.ts`: nhánh kết quả tất định cho hai prompt, dựng từ dữ liệu đầu vào.

**File sửa**
- `packages/llm/src/mock.ts`: chỉ thêm nhánh
- `packages/dao-tao/src/index.ts`
- `packages/db/src/nhom-hoc.ts`, `apps/api/src/routes/nhom.ts`
- `apps/web/app/routes/nhom.chi-tiet.tsx`, `apps/web/app/routes/quan-tri.nhom.chi-tiet.tsx`
- `docs/PLAN.md`

**File tạo**
- `packages/db/migrations/0057_nhom_hoc_ai.sql`
- `prompts/nhom-hoc/goi-y-thu-tu.md`, `prompts/nhom-hoc/tom-tat-tien-do.md`
- `packages/dao-tao/src/hau-kiem-nhom-hoc.ts`, `packages/dao-tao/tests/hau-kiem-nhom-hoc.test.ts`
- `apps/web/app/components/nhom/HopGoiYThuTu.tsx`
- `apps/api/src/nhom-ai.test.ts`

**Migration**
- `0057_nhom_hoc_ai.sql`, chỉ thêm, chạy lại được:
  - bảng `study_group_ai_notes` theo mục 2.2, `id` có `DEFAULT uuid_generate_v4()`;
  - chống trùng bằng index duy nhất trên `(group_id, kind, COALESCE(scope_path::text, ''), input_hash)` (đề xuất Đ7);
  - index để đếm hạn mức theo nhóm và theo người yêu cầu trong ngày.

**Kiểm tra đã xong**
- [x] Unit test `packages/dao-tao/tests/hau-kiem-nhom-hoc.test.ts`, tối thiểu 14 ca (có 35 ca, đạt cả 35):
  - 12 ca loại, mỗi ca một lý do: thiếu mã mục; thừa mã mục; lặp mã mục; số không có trong đầu vào; mã `TV` không tồn tại; mã `M` không tồn tại; có "Điều 5"; có "Nghị định"; có số tiền "500.000 đồng"; có emoji; có dấu chấm than; `ghi_chu` dài 301 ký tự;
  - 2 ca đạt: đầu ra hợp lệ của AI-1 và của AI-2; chữ số trong mã `TV12` không bị coi là số mới.
- [x] API test `apps/api/src/nhom-ai.test.ts` với `LLM_PROVIDER=mock`. Dữ liệu gieo tiền tố `test-gd16d`: nhóm 6 mục, 5 thành viên (3 đội A, 2 đội B). Có 15 ca, đạt cả 15.
  - AI-1 trả hoán vị hợp lệ của 6 mục và thứ tự trong CSDL chưa đổi; gọi `PUT …/muc/thu-tu` với thứ tự đó thì thứ tự đổi.
  - AI-2 của `quan_ly` đội A trả tóm tắt có họ tên thật của 3 thành viên đội A, không chứa họ tên và số liệu riêng của 2 thành viên đội B.
  - Yêu cầu gửi provider, bắt bằng provider giả qua `setProvider`, không chứa họ tên, tên đăng nhập, email, tên đơn vị, cấp bậc của bất kỳ ai trong dữ liệu gieo.
  - Gọi lại với cùng dữ liệu thì provider chỉ được gọi 1 lần. Lần gọi thật thứ 6 của AI-1 trong ngày nhận 429; lần gọi thật thứ 21 của AI-2 nhận 429.
  - Provider giả trả đầu ra có "Nghị định": có 1 dòng `bi_loai` kèm lý do; phản hồi không chứa đầu ra đó.
  - Provider giả chậm quá thời hạn: API trả lỗi hết giờ, không treo. Thời hạn đọc từ tham số để ca này chạy dưới 2 giây.
  - Giả lập mock ngoài `NODE_ENV=test`: cả hai API trả 503; trang `/nhom/:id` không có nút "Gợi ý thứ tự học".
- [x] Hộp thoại gợi ý đạt các mục bố cục và bàn phím của GĐ16b ở 360×740 (kịch bản E2E `scripts/e2e/nhom-ai.ts`).
- [ ] Chạy thật với `ANTHROPIC_API_KEY` trên một nhóm demo, ít nhất 10 lần gọi mỗi loại: ghi vào PLAN.md tỷ lệ đầu ra qua hậu kiểm, số token và chi phí trung bình mỗi lần. Máy không có khóa thì ghi "Chưa làm" kèm lệnh chạy. **Chưa làm**: máy không có khóa, xem mục Trạng thái.
- [x] Cổng chung §0.2 đạt. Test hỏng từ trước ghi rõ tên tệp ở mục Trạng thái.

**Trạng thái (30/9/2026):** đã làm xong phần mã, đạt 5/6 mục kiểm tra. Còn mục chạy thật với khóa API.
- Quyết định của người dùng khi làm giai đoạn này: N12 trả lời "AI-1 và AI-2"; đồng ý đề xuất Đ7, Đ15, Đ16, Đ17. Đã ghi vào cột "Trả lời" của PROMPT_NHOM_HOC_CUNG.md mục 2.8, 2.9 và sửa mục 2.7 theo.
- Kiểm tra:
  - Unit test hậu kiểm: 35 ca đạt. Ngoài 12 lý do loại bắt buộc có thêm: không phải JSON, `thu_tu` có phần tử không phải chuỗi, chép tên mục, "Luật", "khoản", số hiệu "3/2026", số tiền "20 triệu", câu quá 300 ký tự, ít hơn 3 câu, nhiều hơn 5 câu, `muc_can_chu_y` sai; biên 300 ký tự đạt, 301 bị loại; dựng đầu vào không có họ tên, id; thay mã bằng tên.
  - API test: 15 ca đạt. Ngoài các ca bắt buộc có thêm: thành viên thường gọi AI-1 nhận 403, người ngoài nhóm nhận 404, cán bộ gọi AI-2 nhận 403; kết quả `bi_loai` không được dùng lại; AI-2 của `quan_tri` (5 người) không dùng lại bản của `quan_ly` đội A (3 người); hạn mức AI-2 tính theo người (quản lý hết lượt thì quản trị vẫn gọi được); provider không phải mock thì AI bật ở mọi môi trường. Ca hết giờ đặt `NHOM_AI_HET_GIO_MS=300`, API trả trong dưới 1,2 giây.
  - E2E `scripts/e2e/nhom-ai.ts`, chạy hai lần:
    - `bun run e2e nhom-ai`: provider mock, AI tắt. Không có nút "Gợi ý thứ tự học", không có khối tóm tắt ở trang quản trị, API trả 503. Đạt.
    - `NHOM_AI_CHO_PHEP_MOCK=1 bun run e2e nhom-ai --khong-build`: mở hộp bằng Enter; Tab không ra ngoài hộp; Esc đóng hộp, trả tiêu điểm về nút; khóa cuộn nền; không cuộn ngang; nút ≥ 48px, chữ không tràn; chữ nội dung ≥ 16px. Gợi ý đúng thứ tự mock, thứ tự nhóm chưa đổi; áp dụng thì đổi; mở lại thì báo đã khớp. Trang quản trị: có câu cảnh báo, nhận xét có họ tên thật, không còn mã. Đạt. Ảnh ở `scripts/e2e/.anh/nhom-ai-*.png`.
- Cổng chung:
  - `bun run db:migrate`: "Không có migration mới" (0057 đã áp khi chạy test). Chạy lại `0057_nhom_hoc_ai.sql` hai lần liền không lỗi.
  - `bun run typecheck`: mọi gói qua.
  - `bun test`: 1.703 đạt, 6 hỏng. 5 ca ở `packages/config/src/ports.test.ts`, lỗi môi trường Windows có từ trước. 1 ca hiệu năng của GĐ16c ("báo cáo 1.000 cán bộ, 50 nhóm") hỏng khi chạy chung với toàn bộ test (72 giây); chạy riêng `apps/api/src/quan-tri-nhom.test.ts` thì đạt 18/18. GĐ16d không sửa truy vấn báo cáo.
  - `bun run lint`: các tệp của GĐ16d qua. Lỗi còn lại ở 7 tệp có từ trước, như GĐ16c.
  - `bun run build:web`: qua (build trong lượt E2E).
  - `bun run smoke`: 10/11 đạt, 1 bỏ qua (web SSR ở cổng 3030 không chạy), như GĐ16a, GĐ16c.
- Chạy thật với khóa API: **chưa làm**, máy này không có `ANTHROPIC_API_KEY`. Cách chạy:
  1. Trong `.env`: `ANTHROPIC_API_KEY=<khóa>`, `LLM_PROVIDER=anthropic`. Nạp nhóm demo: `bun run scripts/demo-nhom-hoc.ts` trên CSDL `_demo` (GĐ16c).
  2. Chạy API và web (`bun run dev`). Trưởng nhóm của một nhóm "[Demo]" bấm "Gợi ý thứ tự học"; quản lý mở `/quan-tri/nhom/:id` bấm "Tóm tắt tiến độ bằng AI". Để có 10 lần gọi thật, đổi dữ liệu giữa các lần (đặt hạn gợi ý, học thêm một bài), vì cùng dữ liệu thì hệ thống dùng lại kết quả cũ. Hạn mức: AI-1 5 lần mỗi nhóm mỗi ngày, nên cần 2 nhóm.
  3. Đọc kết quả: `SELECT kind, status, count(*), avg(tokens_in), avg(tokens_out), avg(cost_usd) FROM study_group_ai_notes GROUP BY 1, 2;` và `SELECT kind, reject_reason FROM study_group_ai_notes WHERE status = 'bi_loai';`. Ghi tỷ lệ đạt, token và chi phí trung bình vào mục này.
- Thay đổi so với dự kiến:
  - Index chống trùng của Đ7 là index duy nhất **một phần** (`WHERE status = 'dat'`): chỉ kết quả đạt mới chặn trùng. Nhờ vậy một dữ liệu vào bị loại vẫn gọi lại được, mỗi lần bị loại vẫn có dòng riêng để đếm hạn mức và soát lý do.
  - Kết quả dùng lại từ bộ nhớ đệm trả được cả khi đã hết hạn mức: kiểm bộ nhớ đệm trước, chỉ kiểm hạn mức khi cần gọi mô hình (Đ17).
  - Hết giờ và lỗi gọi mô hình cũng ghi một dòng `bi_loai` (lý do "Hết giờ sau … giây." hoặc "Lỗi gọi mô hình: …", không có `model`), nên cũng tính vào hạn mức.
  - Thời hạn đọc từ biến môi trường `NHOM_AI_HET_GIO_MS` (mặc định 20.000). Biến `NHOM_AI_CHO_PHEP_MOCK=1` bật AI với provider mock ngoài môi trường test, chỉ dùng cho E2E.
  - `GET /v1/nhom/:id` và `GET /v1/quan-tri/nhom/:id` trả thêm `ai_bat`; giao diện dựa vào trường này để ẩn nút và khối tóm tắt.
  - Nhóm dưới 2 mục thì AI-1 không gọi mô hình, trả câu "Nhóm cần có từ 2 mục trở lên để gợi ý thứ tự."; giao diện không hiện nút. AI-2 khi không có thành viên nào trong phạm vi thì trả `dat: false`, không gọi mô hình; giao diện không hiện khối.
  - Hậu kiểm thêm một điều kiện: câu chữ không chép nguyên tên mục (từ 8 ký tự) mà phải dùng mã, theo Đ15.
  - AI-2 bị loại: khối "Tóm tắt tiến độ" vẫn còn và hiện câu cố định, thay cho "không hiện khối" của đặc tả, vì tóm tắt chỉ soạn khi quản lý bấm nút trong khối. Đã sửa PROMPT_NHOM_HOC_CUNG.md mục 2.7 theo quy tắc 13.
  - AI-2 gửi `so_ngay_tu_lan_hoc_gan_nhat` (số ngày) thay cho mốc giờ, và `so_ngay_den_han` cho hạn gợi ý, để mô hình không phải tự tính.
  - Không sửa `apps/web/app/lib/nhom.ts`, `nhom.server.ts` (ngoài danh sách "File sửa"): kiểu dữ liệu của hai API mới khai trong `HopGoiYThuTu.tsx` và `quan-tri.nhom.chi-tiet.tsx`; trang nhóm gọi API qua `goiApiQuanTri` có sẵn.
  - Tạo thêm `scripts/e2e/nhom-ai.ts` (không có trong "File tạo") để kiểm hộp thoại ở 360×740 và kiểm nút bị ẩn khi AI tắt.
  - Phụ lục B: `0057` nay là của GĐ16d; index cho báo cáo nếu cần sau này dùng số kế tiếp.
- Quy tắc nghiệp vụ đã chốt:
  - **Ai gọi được:** AI-1 chỉ trưởng nhóm của nhóm đang hoạt động (thành viên thường 403, người ngoài nhóm 404, nhóm lưu trữ 409). AI-2 từ `quan_ly` trở lên, cùng kiểm phạm vi như trang quản lý (GĐ16c): không thấy nhóm thì 404.
  - **AI bật khi** provider không phải mock; hoặc provider là mock mà `NODE_ENV=test`, hoặc `NHOM_AI_CHO_PHEP_MOCK=1`. Khác đi thì 503 mã `chua_bat_ai`, câu "Chức năng gợi ý bằng AI chưa được bật.".
  - **Dữ liệu gửi đi:** AI-1 gồm mã `M1…Mn` theo thứ tự hiện tại, tên mục, loại, chủ đề, số khối và số phút (bài học), số câu (đề ôn tập), số ngày tới hạn gợi ý (âm là đã quá). AI-2 chỉ gồm mục được tính tiến độ và thành viên trong phạm vi: số thành viên, trung bình, số người chưa bắt đầu, từng mục (số người xong, tỷ lệ xong làm tròn xuống), từng thành viên theo mã `TVn` (phần trăm chung, phần trăm từng mục, số ngày từ lần học gần nhất). Không có họ tên, tên đăng nhập, email, đơn vị, cấp bậc, id.
  - **Bộ nhớ đệm:** khóa là (nhóm, loại, phạm vi, `input_hash`); `input_hash` băm tên prompt, phiên bản prompt và dữ liệu vào đã ẩn danh. Đổi prompt, đổi dữ liệu (thứ tự, hạn, tiến độ, số ngày) thì gọi lại. Mỗi phạm vi quản lý một bản; `quan_tri` là một phạm vi riêng.
  - **Hạn mức** đếm mọi dòng ghi trong ngày giờ Việt Nam, cả dòng bị loại và hết giờ: AI-1 5 lần mỗi nhóm, AI-2 20 lần mỗi người yêu cầu. Quá thì 429 mã `qua_han_muc`. Dùng lại từ bộ nhớ đệm không tính.
  - **Hiển thị:** tên thật thay vào sau hậu kiểm; mục hiện trong ngoặc kép “…”. Bị loại thì AI-1 hiện câu cố định, AI-2 hiện câu "Hệ thống chưa tóm tắt được tiến độ của nhóm này. Số liệu trong bảng dưới đây vẫn đầy đủ.", không hiện chữ nào của mô hình. Lý do loại chỉ ghi vào CSDL và nhật ký máy chủ.
  - **Áp dụng gợi ý** đi qua thao tác sắp thứ tự có sẵn; danh sách mục đổi giữa lúc gợi ý và lúc áp dụng thì API sắp thứ tự báo lỗi, hộp giữ nguyên và hiện lỗi.

---

## Phụ lục A — Việc không nằm trong kế hoạch này

Các việc sau chờ quyết định, xem GAP_ANALYSIS §4:

- Chuyển backend sang NestJS (xem giả định A1).
- Tách FE Admin thành ứng dụng riêng (A2).
- Gỡ hẳn các chức năng ngoài phạm vi PRD: nhân vật đồng hành, trường hợp ứng dụng, lĩnh vực đầu tư CNTT, MCP. Hiện chỉ ẩn theo A8.
- Chấm tự luận bằng AI (`cham-ai.ts`): PRD không yêu cầu tự luận.
- Chống gian lận khi thi (theo dõi chuyển tab, khóa thiết bị): chờ câu hỏi GAP 4.3-15.

## Phụ lục B — Danh sách migration dự kiến

| Tệp | GĐ | Nội dung |
|---|---|---|
| `0010_ask_logs_tai_khoan.sql` | 0 | Gắn tài khoản vào nhật ký hỏi đáp, để tính hạn mức |
| `0011_don_vi_tai_khoan.sql` | 2 | Đơn vị (cây), mở rộng tài khoản, lượt đăng nhập |
| `0012_nhat_ky_truy_cap.sql` | 2 | Nhật ký truy cập |
| `0013_ngan_hang_cau_hoi.sql` | 3 | Chủ đề, câu hỏi, lịch sử duyệt |
| `0014_luyen_tap.sql` | 4 | Phiên luyện tập, câu trả lời, câu sai |
| `0015_tra_cuu_nhanh.sql` | 5 | Mức phạt, quy trình |
| `0016_de_thi.sql` | 6 | Đề thi, giao bài, lượt thi, câu trả lời thi |
| `0017_bao_cao.sql` | 7 | View kết quả và index báo cáo |
| `0018_cau_hoi_ai.sql` | 8 | Liên kết câu hỏi với job AI, đánh dấu trùng |
| `0019_diem_thuong.sql` | 9 (cũ) | XP, chuỗi ngày, huy hiệu, thử thách hằng ngày |
| `0020_tro_choi.sql` | 10 (cũ) | Màn chơi, tiến độ, kỷ lục |
| `0021_bai_hoc_chu_de.sql` | 11 | Gắn bài học với chủ đề câu hỏi |
| `0022_bien_bao.sql` | 12 | Biển báo |
| `0023_offline.sql` | 13 | Đồng bộ offline chống trùng |
| `0024_sach_noi.sql` | 14 | Âm thanh bài giảng, vị trí nghe |
| `0025_thong_bao.sql` | 15 | Đăng ký nhận thông báo, cài đặt, chống gửi trùng |
| `0026_ask_logs_tai_khoan.sql` | 0 | Thay cho `0010` (xem trạng thái GĐ0) |
| `0027_tro_choi_nen.sql` | G0 (cũ) | Đăng ký trò chơi, nội dung trò chơi, lịch sử duyệt chung, lượt chơi, bước, gói offline, hồ sơ chủ đề; vòng đời duyệt cho mức phạt, biển báo, quy trình; `xp_ledger.unit_id` |
| `0029_toc_do_toi_da.sql` | G2 (cũ) | Tốc độ tối đa theo loại xe và loại đường. Đã có |
| `0030_lap_bien_ban.sql` | G3 (cũ) | Đăng ký trò. Đã có |
| `0033_mua_giai.sql` | G6 (cũ) | Mùa giải, bảng hạng theo tuần. Đã có |
| `0035_bien_bao_phan_ung.sql` | G8 (cũ) | Phản ứng đúng với từng biển báo. Đã có |
| `0036_kiem_tra_giay_to.sql` | T1 (cũ) | Luật giấy tờ, tiến độ màn chơi, đăng ký trò |
| `0037_phong_thoat_hiem.sql` | T2 (cũ) | Đếm lần nhập mật mã, đăng ký trò |
| `0038_cam_bien.sql` | T3 (cũ) | Đăng ký trò |
| `0039_dung_xe.sql` | T4 (cũ) | Bước quy trình có thao tác, đăng ký trò |
| `0040_soi_camera.sql` | T5 (cũ) | Đăng ký trò |
| `0041_dieu_phoi.sql` | T6 (cũ) | Loại sự việc, đăng ký trò |
| `0042_thanh_pho.sql` | T7 (cũ) | Khu phố của đơn vị, công trình đã đặt, đăng ký trò |
| `0043_dieu_tiet_giao_lo.sql` | T8 (cũ) | Hiệu lệnh điều khiển giao thông, đăng ký trò |
| `0044_tu_lai.sql` | T9 (cũ) | Đăng ký trò |
| `0045_tai_dung.sql` | T10 (cũ) | Đăng ký trò. Đã viết |
| `0046_phat_nguoi.sql` | T11 (cũ) | Cột `nhom` và nhóm luật hồ sơ phạt nguội trong `document_rules` (D16), đăng ký trò. Đã viết |
| `0047_tram_can.sql` | T12 (cũ) | Ngưỡng tải trọng `load_limits`, bốn cột khung quá tải của `violations`, đăng ký trò. Đã viết |
| `0048_len_xe_khach.sql` | T13 (cũ) | Nhóm luật vận tải hành khách trong `document_rules`, đăng ký trò. Đã viết |
| `0049_soi_xe_cai_tao.sql` | T14 (cũ) | Đăng ký trò. Đã viết |
| `0050_chot_dem.sql` | T15 (cũ) | Đăng ký trò |
| `0051_phan_luong.sql` | T16 (cũ) | Đăng ký trò |
| `0052_truy_vet.sql` | T17 (cũ) | Đăng ký trò (`offline_ok = true` theo D24; không bảng mới). Đã viết |
| `0053_muoi_phut_dau.sql` | T18 (cũ) | Đăng ký trò |
| `0054_tam_giu.sql` | T19 (cũ) | Đăng ký trò |
| `0055_diem_den.sql` | T20 (cũ) | Đăng ký trò (không offline) |
| `0056_nhom_hoc_cung.sql` | 16a | Nhóm học cùng: nhóm, thành viên, mục chia sẻ, lượt cổ vũ; `practice_sessions.group_item_id` và nguồn `nhom` |
| `0057_nhom_hoc_ai.sql` | 16d | Kết quả AI của nhóm học cùng (`study_group_ai_notes`) |

`0056`, `0057` cho Nhóm học cùng (GĐ16a–16d). GĐ16c đo thấy không cần index nên không có migration; `0057` là của GĐ16d (đã tạo ngày 30/9/2026). Nếu sau này cần index cho báo cáo thì dùng số kế tiếp còn trống (Đ18 trả lời "Không" ngày 29/9/2026, PROMPT_NHOM_HOC_CUNG.md mục 2.9).

Các migration của trò chơi và trò chơi hóa (`0019`, `0020`, `0027`, `0030`, `0033`, `0035`, `0036`–`0055`) vẫn còn trong kho để không phá CSDL đang chạy; không có mã nào dùng tới các bảng đó.


Số `0028`, `0031`, `0032`, `0034` giữ chỗ cho danh sách cũ, không dùng. `migrate.ts` sắp theo tên nên khoảng trống không ảnh hưởng.

T11–T20 đánh số từ `0046`: tệp lớn nhất đang có trong `packages/db/migrations` là `0044_tu_lai.sql`, còn `0045` đã giữ chỗ cho T10. `migrate.ts` áp mọi tệp chưa áp theo thứ tự tên, nên làm theo thứ tự T11 → T12 → T14 → T13 (tức `0046`, `0047`, `0049`, rồi `0048`) vẫn áp đủ.

**Migration nới CHECK:** `content_reviews.kind` (`0036`, `0041`, `0043`, `0047`), `document_rules.check_kind`, `doc_kind` (`0036`, `0046`, `0048`), `document_rules.nhom` (`0046`, `0048`) và `practice_sessions.source` (`0014`, `0020`, `0022`, `0024`, `0056`) được xóa rồi tạo lại ở nhiều migration. Vì các migration có thể được viết và áp không theo thứ tự số, mỗi migration nới CHECK phải liệt kê **mọi giá trị đã có trong mọi migration đã viết**, kể cả migration số lớn hơn. Ví dụ: viết `0041` sau khi đã có `0047` thì CHECK của `0041` phải có cả `load_limit`.

Mọi migration đều **chỉ thêm** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) và không xóa dữ liệu cũ. Nhờ vậy chạy lại được, và CSDL thật trên DigitalOcean nâng cấp an toàn qua job `migrate` có sẵn.
