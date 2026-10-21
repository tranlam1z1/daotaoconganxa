# KẾ HOẠCH SỬA MÃ THEO GIAI ĐOẠN

*Dựa trên [GAP_ANALYSIS.md](GAP_ANALYSIS.md). Lập ngày 24/9/2026. Chưa triển khai.*

---

## 0. Nguyên tắc chung

### 0.1. Thứ tự ưu tiên

PRD §IV xếp **làm bài tập** và **tra cứu** lên đầu, và yêu cầu giao diện **cực kỳ đơn giản**. Kế hoạch đi theo thứ tự đó:

1. Nền móng và vá bảo mật: bắt buộc trước mọi thứ.
2. **Tra cứu**, rồi tài khoản và đơn vị, **ngân hàng câu hỏi**, **luyện tập**, **tra cứu nhanh**, **thi sát hạch**.
3. Báo cáo cho lãnh đạo, trò chơi hóa, game.
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
| A3 | PWA là **chính `apps/web`** thêm manifest và service worker (GĐ13), không làm app riêng | Nếu phải làm app riêng: các màn hình luyện tập và game đã viết thành component độc lập, chuyển được |
| A4 | Cán bộ đăng nhập bằng **tên đăng nhập + mật khẩu** do quản trị cấp, nhập danh sách từ Excel. Vẫn giữ Google cho biên tập viên | Nếu dùng SSO hoặc VNeID: thêm một provider trong `packages/auth`, bảng `accounts` không đổi |
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
| 9 | Trò chơi hóa: XP, chuỗi ngày, thử thách hằng ngày, bảng xếp hạng | 4 | |
| 10 | Game: vượt màn, đua thời gian, ghép cặp lỗi – mức phạt | 5, 9 | |
| 11 | Bài giảng đơn giản: đọc bài, chế độ slide | 2 | |
| 12 | Biển báo và game đoán biển báo | 9 | |
| 13 | PWA và luyện tập offline | 4 | **M3: bản cài được trên điện thoại** |
| 14 | Giọng nói: hỏi bằng giọng, sách nói | 1, 11 | |
| 15 | Nhắc học (Web Push) | 9, 13 | |
| 16a | Nhóm học cùng: CSDL, tiến độ, cổ vũ, API người học | 4, 9, 11; 15 nếu N9 chọn có thông báo | |
| 16b | Nhóm học cùng: giao diện người học, hộp thoại | 16a | |
| 16c | Nhóm học cùng: quản lý xem tiến độ học, báo cáo Excel/PDF | 7, 16a | |
| 16d | Nhóm học cùng: AI gợi ý thứ tự học, tóm tắt tiến độ | 8, 16a, 16b, 16c | |
| 17a | Hộp kết quả đúng/sai: component chung, khung chơi chung, chơi offline, Vượt màn | G0, 16b | |
| 17b | Hộp kết quả đúng/sai: Đua thời gian, Hỏi nhanh giọng nói, Ghép cặp | 17a | |
| 17c | Hộp kết quả đúng/sai: chi tiết riêng của từng trò | 17a | |

GĐ1 và GĐ2 làm song song được. GĐ5 chỉ cần GĐ1, nên có thể xen vào bất cứ lúc nào sau GĐ1.

**Nhóm học cùng** (GĐ16a–16d, thêm ngày 29/9/2026): đặc tả, câu hỏi N1–N17, đề xuất Đ1–Đ18 và prompt từng giai đoạn ở [PROMPT_NHOM_HOC_CUNG.md](PROMPT_NHOM_HOC_CUNG.md).
- Làm tuần tự 16a → 16b → 16c → 16d, mỗi giai đoạn một phiên. 16d bỏ được nếu N12 chọn không làm AI.
- Trước mỗi giai đoạn, trả lời các câu và đề xuất ghi ở dòng "Thiết kế" của giai đoạn đó. Chỗ ghi "đề xuất Đn" là phần phụ thuộc đề xuất chưa được đồng ý.

**Hộp kết quả đúng/sai trong trò chơi** (GĐ17a–17c, thêm ngày 30/9/2026): đặc tả, hiện trạng mã, câu hỏi H1–H11, đề xuất Đ1–Đ12 và prompt từng giai đoạn ở [PROMPT_HOP_KET_QUA_TRO_CHOI.md](PROMPT_HOP_KET_QUA_TRO_CHOI.md).
- Chỉ sửa giao diện web: không sửa API, **không có migration**.
- Làm tuần tự 17a → 17b → 17c, mỗi giai đoạn một phiên. 17b và 17c đều dùng component của 17a. 17c bỏ được nếu H7 chọn không.
- Không chạy song song với phiên khác đang sửa `routes/tro-choi.luot.tsx`, `components/tro-choi/**` hoặc kịch bản e2e của trò chơi.
- Trước mỗi giai đoạn, trả lời các câu H và đề xuất Đ ghi ở dòng "Thiết kế" của giai đoạn đó. Chỗ ghi "Hn" hoặc "Đn" là phần theo cột "Đề xuất" khi câu đó chưa có trả lời.

**Các giai đoạn trò chơi** (thêm ngày 25/9/2026, lập lại ngày 27/9/2026 theo [PRD.md](PRD.md) mục V và [GAME_DESIGN.md](GAME_DESIGN.md)):

| GĐ | Tên | Phụ thuộc | Mô-đun dùng chung tạo hoặc mở rộng (GAME_DESIGN §4) | Mốc |
|---|---|---|---|---|
| G0 | Nền dùng chung: lượt chơi, duyệt nội dung trò chơi, offline, hồ sơ chủ đề | 9, 10, 13 | — (đã xong) | |
| T1 | Kiểm tra giấy tờ | G0 | Tạo M1, M2 (chạm, đóng dấu), M3, M4, M8 | |
| T2 | Phòng thoát hiểm pháp luật | T1 | — | |
| T3 | Cắm biển cho tuyến đường | T1 | Tạo M5, M6, M7; M2 (kéo thả) | |
| T4 | Dừng xe đúng quy trình | T1 | M2 (giữ, vuốt) | **M4: bốn trò đầu** |
| T5 | Soi camera | T3 | M5 (nhiều xe, vi phạm), M6 (camera), M2 (khoanh vùng) | |
| T6 | Điều phối ca trực | T1 | Tạo M9 | |
| T7 | Thành phố an toàn | T6 | — (dùng M9) | |
| T8 | Điều tiết giao lộ | T4, T5 | M5 (giao lộ, xung đột, xe ưu tiên) | |
| T9 | Tự lái qua phố | T8 | M5 (xe người lái, phát hiện lỗi) | |
| T10 | Tái dựng hiện trường | T9 | M5 (va chạm, vết phanh) | **M5: đủ 10 trò** |
| T11 | Duyệt hồ sơ phạt nguội | T1 | — (dùng M2 vuốt, M3, M4, M8) | |
| T12 | Trạm cân tải trọng | T1 | M1 (giấy kiểm định, phiếu cân, giấy phép lưu hành), M2 (đóng dấu nhiều lựa chọn) | |
| T13 | Lên xe khách | T12 | M1 (lệnh vận chuyển, phù hiệu, giám sát hành trình) | |
| T14 | Soi xe cải tạo | T5, T12 | M1 (thông số kỹ thuật) | |
| T15 | Dựng chốt an toàn ban đêm | T3, T5 | M5 (vật cản tạm, tầm nhìn đêm, vùng nguy hiểm) | |
| T16 | Phân luồng khi có sự cố | T6 (M9), T9 | M5 (lưu lượng theo giờ, đo ùn); tạo M9 nếu T6 chưa làm (câu D22) | |
| T17 | Truy vết xe bỏ trốn | T5, T16 | — (sửa khung, câu D23) | |
| T18 | 10 phút đầu tại hiện trường | T4 | — | |
| T19 | Tạm giữ phương tiện | T14 | M4 (biên bản tạm giữ) | |
| T20 | Bản đồ điểm đen | T6 (M9), T7 | M9 (lớp dữ liệu tai nạn, lớp nhiệt, mô hình 12 tháng) | **M6: đủ 20 trò** |

- T11–T20 thêm ngày 28/9/2026 theo [PRD.md](PRD.md) mục V.5. Thứ tự đề xuất: T11 → T12 → T14 → T13 → T19 → T18 → T15 → T16 → T17 → T20 (GAME_DESIGN §4.4).
- Làm **tuần tự đúng thứ tự T1 → T10** (người dùng chỉ định ngày 27/9/2026). Cột "Phụ thuộc" ghi phụ thuộc kỹ thuật thật; theo đó T2, T4, T6 có thể làm sớm hơn nếu đổi thứ tự (GAME_DESIGN §8 câu D14).
- Mỗi giai đoạn là một nhánh và một PR, qua cổng chung §0.2 và các **mục kiểm tra chung GĐ-T** (đầu phần "Các giai đoạn trò chơi").
- Chỉ sửa file của trò đang làm; cần sửa khung chung hoặc mô-đun đã có thì hỏi trước (GAME_DESIGN §1.7). Tạo và mở rộng mô-đun đúng như cột trên thì đã được đồng ý.
- Không giai đoạn nào sửa CHECK danh sách trò chơi: trò mới đăng ký bằng một dòng trong bảng `games`, mặc định `enabled = false`.
- Mục **"Đủ nội dung đã duyệt"** trong phần kiểm tra của từng trò cần biên tập viên và người duyệt; phần mã xong mà thiếu nội dung thì trò vẫn tắt.

Migration mới đánh số tiếp từ **`0010_`**. Thư mục hiện có hai tệp `0006_*`, nhưng `migrate.ts` sắp theo tên nên không ảnh hưởng.

---

## GĐ0 — Nền móng và vá bảo mật

**Mục tiêu**
- Có một mốc mã **build được**, và bịt các lỗ hổng S1–S5 ở GAP §3.4.
- Chưa thêm chức năng mới.

**Việc làm**
1. **Chốt trạng thái giao diện đang dựng lại.** Commit đợt dựng lại hiện tại (bộ `components/ui`, `components/layout`, các trang `PageStub`) thành một mốc riêng. Từ đây các trang được dựng lại **theo từng giai đoạn** bên dưới, không khôi phục bản cũ ở `HEAD`; bản cũ chỉ dùng để tham khảo qua `git show`.
2. **S1 — API biên tập:**
   - Xem hàng đợi và xử lý việc cần `bien_tap`.
   - Duyệt hoặc từ chối lệnh sửa đổi cần `phap_che`.
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
- [x] `POST /v1/amend-ops/:id/approve` trả **401** khi không có token và **403** với vai trò `bien_tap`; thành công với `phap_che`, và `reviewer_id` là email người duyệt.
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
- Có **đơn vị** dạng cây, tài khoản cán bộ đăng nhập bằng tên/mật khẩu, vai trò **Cán bộ** và **Cán bộ quản lý** giới hạn theo đơn vị.
- Quản trị viên có màn hình quản lý người dùng và đơn vị, nhập danh sách từ Excel.
- Có nhật ký truy cập.

**Thiết kế vai trò (A5)**
- Thang mới: `khach < can_bo < tra_cuu < quan_ly < bien_tap < phap_che < quan_tri`.
- `can_bo` là người học: học, luyện tập, thi, tra cứu.
- `quan_ly` = quyền của `can_bo` + giao bài + xem kết quả, **chỉ trong cây đơn vị của mình**. `quan_tri` xem được mọi đơn vị.
- Phạm vi đơn vị kiểm bằng một hàm `trongPhamVi(principal, unitId)` dùng chung. **Không** dựa vào thứ bậc vai trò.
- `bien_tap` và `phap_che` giữ nguyên nghĩa (soạn và duyệt nội dung). Họ chỉ thấy báo cáo đơn vị khi được gắn đơn vị.

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
- [x] Các test cũ về RBAC và MCP vẫn qua. `tra_cuu` giữ quyền MCP cũ.
  - Câu kiểm danh sách `ROLES` trong `rbac.test.ts` đã sửa theo thang mới, có thêm kiểm `tra_cuu` vẫn trên `khach` và dưới `bien_tap`.

**Trạng thái (24/9/2026):** đã làm xong, đạt 6/6 mục kiểm tra.
- `bun test`: 743 đạt, 6 hỏng. Không lỗi nào do GĐ2:
  - 5 lỗi ở `ports.test.ts`: lỗi môi trường Windows, đã có từ trước.
  - 1 lỗi ở `sohoa.test.ts`: chạy riêng thì đạt 6/6. Lỗi xuất hiện khi hai phiên GĐ3 và GĐ5 chạy test cùng lúc trên cùng CSDL test.
- Typecheck (api, web, mcp, auth, db) và `build:web` đều qua.
- Khác với dự kiến:
  - Họ tên dùng lại cột `accounts.name` sẵn có, không thêm cột `full_name`.
  - Hàm phạm vi nhận đường dẫn ltree của đơn vị (`trongPhamVi(principal, unitPath)`); API có `batBuocPhamViDonVi(c, unitId)` tra đường dẫn rồi gọi hàm này.
  - Nhập Excel chỉ nhận vai trò Cán bộ và Cán bộ quản lý. Vai trò biên tập, pháp chế, quản trị cấp từng người trên màn hình.
  - Mật khẩu tạm sinh ngẫu nhiên cho từng người và chỉ hiện một lần.
- Thêm ngoài danh sách:
  - `apps/web/app/lib/quan-tri.server.ts`
  - `routes/quan-tri.nguoi-dung.mau.tsx`: tải mẫu
  - `root.tsx`: chuyển về trang đổi mật khẩu
  - `tai-khoan.tsx`
  - `lib/types.ts`
  - `content/huong-dan/muc-luc.json`: miễn hướng dẫn tạm cho 3 trang mới
  - script `db:seed:don-vi`
- Tài khoản mẫu (`bun run db:seed:don-vi`): `quantri`, `quanly.phong`, `quanly.doi1`, 7 tài khoản `canbo.*`. Mật khẩu `Matkhau2026`, hoặc đặt qua `SEED_MAT_KHAU`.
- Việc chuyển sang giai đoạn sau:
  - Tạo xong một người dùng trên điện thoại, thông báo mật khẩu tạm nằm ở đầu trang, cần cuộn lên mới thấy.
  - Trang `/quan-tri` (tổng quan đào tạo) vẫn là trang tạm; cán bộ quản lý vào thẳng `/quan-tri/nguoi-dung` từ trang Tài khoản.

---

## GĐ3 — Ngân hàng câu hỏi (nhập, duyệt từng câu, phân loại)

**Mục tiêu**
- Có ngân hàng câu hỏi **độc lập với chuyên đề**, phân loại theo **chủ đề / mức độ / loại**.
- **Duyệt từng câu** trước khi dùng. Nhập từ Excel theo mẫu của KH.
- Đây là nguồn dữ liệu chung cho luyện tập, thi và game.

**Thiết kế**
- **Bảng `question_topics`:** cây chủ đề gắn với lĩnh vực (`fields`). Ví dụ Giao thông → Quy tắc giao thông → Tốc độ, khoảng cách.
- **Bảng `questions`:** tách khỏi `activities`, vì `activities.course_id` là NOT NULL và mang ngữ nghĩa bài học.
- **Loại câu hỏi** ở giai đoạn này là các loại **chấm máy**:
  - `mot_dap_an`, `nhieu_dap_an`
  - `dung_sai` (đáp án cố định, **không** cần AI)
  - `dien_khuyet`, `sap_xep`, `ghep_cap`
- **Chấm điểm** dùng lại `packages/dao-tao/src/grading.ts` qua một lớp ánh xạ, không viết thuật toán chấm mới.
- **Trạng thái:** `nhap → cho_duyet → da_duyet | tu_choi`, và `da_duyet → luu_tru`. Chỉ câu `da_duyet` mới được rút vào luyện tập, thi, game.
- **Sửa câu đã duyệt** thì câu quay về `cho_duyet`, tăng `version`. Các lượt làm cũ giữ ảnh chụp đề (lưu ở GĐ4/GĐ6).
- **Quyền:** `bien_tap` tạo và sửa; `phap_che` duyệt (có thể chỉnh qua cấu hình khi KH trả lời câu hỏi GAP 4.3-12).

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
- [x] `can_bo` gọi API quản trị ngân hàng nhận 403; `bien_tap` không duyệt được (403).
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
  - Vai trò được duyệt đặt bằng `NGAN_HANG_VAI_TRO_DUYET` (mặc định `phap_che`); mục tiêu đặt bằng `NGAN_HANG_MUC_TIEU` (mặc định 1.000).
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
  - **Chưa làm:** cần biên tập viên, xem mục "Dữ liệu" bên dưới.

**Trạng thái (24/9/2026):** đã làm xong phần mã; dữ liệu mới là **bản nháp chờ đối chiếu**, nên người học chưa thấy mục nào.
- **Dữ liệu:**
  - `data/tra-cuu/muc-phat.json` có 21 dòng (tốc độ, nồng độ cồn, đèn tín hiệu, điện thoại, mũ bảo hiểm, dây an toàn) cho ô tô và xe máy.
  - `data/tra-cuu/quy-trinh.json` có 2 quy trình xử phạt (không lập và có lập biên bản).
  - Các dòng được soạn khi kho **chưa có** văn bản gốc để đối chiếu, nên đều để `trang_thai: "nhap"` và căn cứ mới trỏ ở mức Điều.
  - Trước khi duyệt, biên tập viên phải: đối chiếu mức tiền và điểm trừ; thay căn cứ bằng URN tới đúng điểm, khoản; tách dòng theo hiệu lực nếu NĐ 238/2026 đã đổi mức phạt.
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
- **Cán bộ quản lý** giao đề cho đơn vị hoặc cá nhân, kèm hạn làm.
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
- Lãnh đạo và cán bộ quản lý xem kết quả **theo cá nhân và đơn vị**: điểm, thời gian làm bài, số lần làm, xếp hạng.
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
  - `bun run lint`: các tệp của GĐ7 qua. Lỗi còn lại nằm ở `apps/api/src/auth.test.ts` (GĐ2) và các tệp `diem-thuong`, `tro-choi` (GĐ9, GĐ10 đang làm).
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
    - Chỉ tính phiên có `source` là `chu_de`, `cau_sai`, `thu_thach`. Phiên game của GĐ10 (`game:...`) không tính.
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
  - Cùng tệp: 401/403, chạy thử không tạo việc, điều khoản chưa hiệu lực hoặc đã bãi bỏ trả 400, chạy lại một việc không sinh thêm câu, sinh lại trên cùng điều khoản thì mọi câu bị loại vì trùng câu đã có, vượt trần chi phí thì `bien_tap` nhận 403.
- [x] Unit test: câu có căn cứ trỏ tới điều đã bãi bỏ bị loại kèm lý do; câu trùng bị đánh dấu `duplicate_of`.
  - `packages/dao-tao/tests/hau-kiem-cau-hoi.test.ts`, 15 ca: bãi bỏ, chưa hoặc hết hiệu lực, không có trong kho, ngoài ngữ cảnh, không có căn cứ, sai loại, trùng với câu đã có, trùng trong cùng lô, đọc JSON của mô hình.
- [ ] Không route luyện tập hay thi nào rút được câu `source = ai` chưa duyệt (dùng lại test của GĐ4 và GĐ6).
  - **Thi (GĐ6):** đã kiểm trong `sinh-cau-hoi.test.ts`. `nguonCauHoiChoMaTran` không rút câu AI chưa duyệt; duyệt một câu thì rút được đúng câu đó.
  - **Luyện tập (GĐ4):** GĐ4 đang làm ở nhánh song song. Các truy vấn rút câu trong `packages/db/src/luyen-tap.ts` đều lọc `status = 'da_duyet'`. Còn chờ test API của GĐ4 chạy qua.
- [ ] Chạy thật với khóa API trên 3 điều của NĐ 168/2024: biên tập viên soát, và ghi tỷ lệ câu dùng được vào PR để làm mốc chất lượng.
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
  - Việc sinh không đi Batch API, vì biên tập viên đang chờ kết quả. Ngân sách của việc bằng gấp đôi ước tính. Ước tính trên `NGAN_HANG_AI_TRAN_USD` (mặc định 2 USD) thì cần vai trò `phap_che`.
  - Không nối được Redis trong 3 giây thì API vẫn tạo việc ở trạng thái `cho`, không treo yêu cầu.

---

## GĐ9 — Trò chơi hóa: XP, chuỗi ngày, thử thách hằng ngày, bảng xếp hạng

**Mục tiêu**
- Có **điểm kinh nghiệm (XP)**, **cấp độ**, **chuỗi ngày học**, **thử thách 5 câu mỗi ngày**, **huy hiệu** cơ bản.
- Có **bảng xếp hạng** cá nhân (trong đơn vị) và giữa các đơn vị, theo tuần.

**Thiết kế**
- **Sổ XP chỉ ghi thêm** (`xp_ledger`), có khóa `UNIQUE (source_kind, source_id)` để không cộng hai lần cho một hành động.
- **Quy tắc tính XP** tập trung trong `packages/dao-tao/src/diem-thuong.ts`, là một bảng cấu hình dễ sửa khi KH chốt câu hỏi GAP 4.4-19. Ví dụ:
  - câu đúng khi luyện tập: +2
  - hoàn thành thử thách ngày: +10
  - đạt bài thi: +50
- **Cấp độ** tính từ tổng XP theo bảng ngưỡng.
- **Chuỗi ngày** tính theo ngày giờ Việt Nam (`Asia/Ho_Chi_Minh`). Mỗi tuần được 1 lần "đóng băng" để giữ chuỗi.
- **Bảng xếp hạng**
  - Mặc định chỉ hiện **trong đơn vị của mình**, hiển thị họ tên.
  - Xếp hạng đơn vị dùng **XP trung bình mỗi người**, không dùng tổng, để đơn vị đông người không luôn đứng đầu.
- **Thử thách hằng ngày**: 5 câu giống nhau cho mọi người trong ngày (seed theo ngày), dùng lại phiên luyện tập với `source = thu_thach`.

**Việc làm**
1. Cộng XP khi kết thúc phiên luyện tập, nộp bài thi, hoàn thành thử thách, gọi trong cùng transaction với các hành động đó.
2. **API:** `GET /v1/toi/tong-quan` (XP, cấp, chuỗi, huy hiệu, thử thách hôm nay), `GET /v1/bang-xep-hang?pham_vi=don_vi|cac_don_vi&ky=tuan|thang`.
3. **Màn hình:**
   - Trang chủ khi đã đăng nhập: thẻ "Thử thách hôm nay", chip 🔥 chuỗi ngày và XP ở header.
   - Trang `/bang-xep-hang`.
   - Huy hiệu hiện ở `/toi`.
   - Có hiệu ứng khi lên cấp, nhẹ, tôn trọng `prefers-reduced-motion`.

**File sửa**
- `packages/db/src/luyen-tap.ts`, `packages/db/src/de-thi.ts`: gọi cộng XP
- `apps/api/src/routes/toi.ts`, `apps/api/src/app.ts`
- `apps/web/app/routes/home.tsx`, `toi.tsx`, `routes.ts`
- `apps/web/app/components/layout/SiteHeader.tsx`

**File tạo**
- `packages/dao-tao/src/diem-thuong.ts`, `packages/dao-tao/tests/diem-thuong.test.ts`
- `packages/db/src/diem-thuong.ts`
- `apps/api/src/routes/bang-xep-hang.ts`, `apps/api/src/diem-thuong.test.ts`
- `apps/web/app/routes/bang-xep-hang.tsx`
- `apps/web/app/components/tro-choi/ChipChuoiNgay.tsx`, `TheThuThach.tsx`, `HuyHieu.tsx`

**Migration**
- `0019_diem_thuong.sql`:
  - `xp_ledger(id bigserial, account_id, source_kind, source_id, xp int, created_at, UNIQUE(source_kind, source_id))`
  - `daily_activity(account_id, day date, xp int, PRIMARY KEY(account_id, day))`
  - `streaks(account_id PK, current, best, last_day, freezes_left)`
  - `badges(code PK, name, description, rule jsonb)`, `account_badges(account_id, badge_code, awarded_at, PK)`
  - `daily_challenges(day PK, question_ids uuid[])`
  - index `xp_ledger(account_id, created_at)`

**Kiểm tra đã xong**
- [x] Unit test chuỗi ngày: học các ngày 1, 2, 3 thì chuỗi = 3; bỏ ngày 4 mà còn lượt đóng băng thì chuỗi vẫn 3; bỏ ngày 5 thì chuỗi về 0. Test chạy qua mốc 0h giờ Việt Nam (UTC+7), dùng tham số `now`.
  - Học lúc 23:30 giờ VN, kiểm lúc 0:30 giờ VN ngày sau.
  - 13 test trong `packages/dao-tao/tests/diem-thuong.test.ts`, gồm cả cấp lại lượt đóng băng khi sang tuần mới.
- [x] Nộp lại cùng một phiên hai lần thì chỉ cộng XP một lần, nhờ ràng buộc UNIQUE.
  - Kết thúc phiên luyện tập hai lần thì chỉ có 1 dòng `xp_ledger`, XP = 2×2 + 5.
  - Nộp bài thi hai lần cũng không cộng lại: hàm `nopLuot` dừng ở lượt đã nộp, thêm UNIQUE.
- [x] Thử thách hôm nay giống nhau với hai tài khoản; ngày mai khác.
  - Hai tài khoản nhận cùng 5 câu, cùng thứ tự; bấm lại thì trả phiên cũ (200); ngày mai ra bộ khác.
- [x] Bảng xếp hạng đơn vị khớp với phép tính tay trên dữ liệu gieo; người đội A không thấy tên người đội B trong bảng cá nhân.
  - Đội B (50 + 0, trung bình 25) đứng trên đội A (30 + 10, trung bình 20).
  - XP của Chủ nhật tuần trước không tính vào tuần này.
- [x] Soát bảng kiểm §0.4 và kiểm tra `prefers-reduced-motion`.
  - Chrome không giao diện ở 360px: không cuộn ngang, không vùng bấm nào dưới 44px trên trang chủ, `/toi`, `/bang-xep-hang`.
  - Bật "giảm chuyển động" (`reducedMotion: reduce`) thì `animation-name` của biểu tượng sao và thông báo lên cấp đều là `none`; thông báo vẫn hiện.

**Trạng thái (24/9/2026):** đã làm xong, đạt 5/5 mục kiểm tra.
- `bun test`: 897 đạt, 6 hỏng. Không lỗi nào do GĐ9:
  - 5 lỗi ở `ports.test.ts`: lỗi môi trường Windows, đã có từ trước.
  - 1 lỗi ở `packages/auth/tests/mat-khau.test.ts` (GĐ2): hết giờ 5 giây khi máy bận vì argon2 chậm có chủ đích. Đã nới giới hạn của test đó lên 20 giây; chạy riêng thì đạt 13/13.
- Typecheck api, web, db, dao-tao, workers-ts qua. `build:web` qua.
- Lỗi phát hiện và đã sửa khi soát: thanh đầu trang có thêm chip điểm thì ở 360px nút menu bị đẩy khỏi màn hình. Cách sửa:
  - dưới cỡ `sm`, chip chỉ hiện chuỗi ngày, ẩn phần XP;
  - nút giao diện sáng/tối chuyển vào menu điện thoại;
  - tên trang nhỏ lại dưới 360px.
  - Đã đo lại ở 320 và 360px: không nút nào vượt mép.
- Thiết kế:
  - `congXp(tx, …)` trong `packages/db/src/diem-thuong.ts` là lối duy nhất cộng XP, gọi trong giao dịch của hành động được thưởng.
  - Đang gọi từ: kết thúc phiên luyện tập (không tính phiên `game:*`) và nộp bài thi. GĐ10 (trò chơi) và GĐ11 (bài giảng) dùng cùng hàm, nguồn `game:*` và `bai_hoc`.
  - Chip ở thanh đầu trang lấy điểm từ `/v1/auth/me`, không gọi thêm API mỗi trang.
  - Biểu tượng ngọn lửa, ngôi sao, cúp là SVG, không dùng emoji (QUY-TAC-HANH-VAN §3.4). Kế hoạch ghi 🔥 nhưng quy tắc hành văn không cho dùng emoji.
  - Huy hiệu và mọi mức XP là đề xuất, gom trong `QUY_TAC_XP` và migration 0019, chờ khách hàng chốt (GAP 4.4-19).
  - Thử thách hằng ngày chốt danh sách câu ở lần hỏi đầu trong ngày. Câu bị gỡ duyệt giữa ngày thì thử thách ngắn lại cho mọi người, không thay câu khác, để mọi người vẫn làm cùng một bộ.
- Thêm ngoài danh sách:
  - `apps/web/app/lib/diem-thuong.ts`
  - `components/ui/Icon.tsx`: 3 biểu tượng
  - `apps/api/src/routes/auth.ts`: trả `diem` trong `/me`
  - `apps/api/src/routes/luyen-tap.ts`: nguồn `thu_thach`
  - `content/huong-dan/muc-luc.json`: miễn hướng dẫn tạm cho `/bang-xep-hang`

---

## GĐ10 — Game đầu tiên: vượt màn, đua thời gian, ghép cặp lỗi – mức phạt

**Mục tiêu**
- Có 3 trò chơi dùng lại ngân hàng câu hỏi và dữ liệu mức phạt: **Thử thách vượt màn** (PRD #1), **Đua thời gian 60 giây** (#2), **Ghép cặp lỗi – mức phạt** (#5).
- Danh sách game được KH chốt lại sau (GAP 4.4-19). Ba game này dùng lại được nhiều nhất và làm ra **khung game chung** cho các game sau.

**Thiết kế**
- **Khung game chung:** vòng đời *bắt đầu → chơi → kết thúc → tính XP*, dùng phiên luyện tập với `source = game:<ma>`.
- **Chấm trên máy chủ.** Với game tính giờ, máy chủ ghi thời điểm bắt đầu và từ chối câu trả lời gửi sau khi hết 60 giây cộng dung sai.
- **Vượt màn:**
  - mỗi chủ đề có các màn, mỗi màn 10 câu, đạt ≥ 80% thì mở màn sau;
  - chấm 1–3 sao theo tỷ lệ đúng.
- **Ghép cặp:** rút ngẫu nhiên 5 dòng từ `violations` (GĐ5), ghép hành vi với mức phạt. Dữ liệu tra cứu được dùng lại làm nội dung game.

**File sửa**
- `apps/api/src/routes/luyen-tap.ts`: nhận `source = game:*`
- `packages/dao-tao/src/diem-thuong.ts`: quy tắc XP cho game
- `apps/web/app/routes.ts`, `apps/web/app/routes/luyen-tap._index.tsx`: thêm khu "Trò chơi"

**File tạo**
- `packages/dao-tao/src/tro-choi/vuot-man.ts`, `dua-thoi-gian.ts`, `ghep-cap-muc-phat.ts`
- `packages/dao-tao/tests/tro-choi.test.ts`
- `packages/db/src/tro-choi.ts`
- `apps/api/src/routes/tro-choi.ts`, `apps/api/src/tro-choi.test.ts`
- `apps/web/app/routes/tro-choi._index.tsx`, `tro-choi.vuot-man.tsx`, `tro-choi.dua-thoi-gian.tsx`, `tro-choi.ghep-cap.tsx`
- `apps/web/app/components/tro-choi/KhungGame.tsx`, `BanDoMan.tsx`, `DongHoNguoc.tsx`, `BangGhepCap.tsx`

**Migration**
- `0020_tro_choi.sql`:
  - `game_levels(id, topic_id, ordinal, question_count DEFAULT 10, pass_ratio DEFAULT 0.8, UNIQUE(topic_id, ordinal))`
  - `game_progress(account_id, level_id, best_ratio, stars, completed_at, PRIMARY KEY(account_id, level_id))`
  - `game_scores(id, account_id, game_code, score, played_at)`: kỷ lục đua thời gian

**Kiểm tra đã xong**
- [x] Unit test (`packages/dao-tao/tests/tro-choi.test.ts`, 16 ca):
  - màn 2 bị khóa khi màn 1 chưa đạt 80%, và mở khi đạt;
  - đua thời gian không nhận câu trả lời sau 60 giây cộng dung sai (tham số `now`);
  - ghép cặp chấm đúng khi ghép đảo thứ tự.
  - Cộng thêm: chia màn dễ → khó, sao theo tỷ lệ, chơi lại kém hơn không mất sao, ván không đủ mức phạt khác nhau thì báo thiếu dữ liệu, bảng XP.
- [x] API test: gọi thẳng màn 3 khi chưa mở nhận 403.
  - `apps/api/src/tro-choi.test.ts`, 11 ca. Kiểm thêm:
    - màn 1 đạt 70% thì màn 2 vẫn khóa, đạt 100% thì mở;
    - đua thời gian lùi giờ bắt đầu 64 giây thì câu trả lời nhận 409;
    - ghép cặp chỉ dùng dòng đã duyệt, nộp lại nhận 409;
    - XP mỗi ván chỉ ghi một lần vào `xp_ledger`, dù kết thúc phiên hai lần;
    - không phản hồi nào có khóa `answer`.
- [x] Kịch bản e2e cho vượt màn: qua màn 1 thì màn 2 mở trên bản đồ.
  - `scripts/e2e/tro-choi.ts` đạt. Kịch bản chơi thêm ghép cặp bằng chạm và đua thời gian.
- [x] Chơi được bằng một tay trên điện thoại 360px; kéo thả có phương án chạm (chạm hai lần để ghép).
  - Ghép cặp chỉ dùng chạm (chạm hành vi rồi chạm mức phạt, chạm lại để gỡ); không có kéo thả. Đua thời gian chơi bằng một chạm mỗi câu.
  - E2E kiểm không cuộn ngang ở 5 màn hình; ảnh chụp đã soát tay.

**Trạng thái (24/9/2026):** đã làm xong, đạt 4/4 mục kiểm tra.
- Cổng chung:
  - `bun run typecheck` qua.
  - `bun test`: 898 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên máy Windows này.
    - Một lần chạy chung khác có thêm lỗi ở `sinh-cau-hoi.test.ts` và `search`. Chạy riêng thì đạt, chạy lại toàn bộ thì cũng đạt; nguyên nhân là nhiều phiên cùng chạy test trên một CSDL test.
  - `build:web` qua.
  - `bun run e2e luyen-tap thi tro-choi`: 3/3 đạt.
  - Lint: các tệp GĐ10 qua. Còn lỗi định dạng ở tệp của GĐ2 và GĐ11 (GĐ11 đang làm).
- Làm song song với GĐ9 (phiên khác):
  - XP game ghi qua `congXp` của GĐ9, nguồn `game:<mã>`, khóa theo id phiên. `ketThucPhien` của GĐ9 bỏ qua phiên game nên không cộng hai lần.
  - Bảng XP riêng của game là `packages/dao-tao/src/tro-choi/xp.ts`, không nằm trong `diem-thuong.ts`.
- Thay đổi so với dự kiến:
  - Nguồn phiên dùng `game:vuot_man`, `game:dua_thoi_gian`, `game:ghep_cap`; migration 0020 nới CHECK `practice_sessions.source`.
  - Thêm cột `practice_sessions.game_level_id` và `game_scores.session_id UNIQUE`, để một ván chỉ ghi điểm một lần.
  - Vượt màn và đua thời gian dùng lại toàn bộ API và màn hình luyện tập (chấm, ảnh chụp đề, câu sai). `routes/luyen-tap.ts` chỉ thêm 3 chỗ gọi sang `routes/tro-choi.ts`: chặn ván ghép cặp, kiểm giờ đua, xử lý khi kết thúc game.
  - Ván ghép cặp lưu 5 dòng mức phạt trong `items` của phiên, nộp một lần qua `/v1/tro-choi/ghep-cap/:id/nop`.
  - Màn sinh tự động theo số câu đã duyệt: 10 câu mỗi màn, tối đa 10 màn, xếp dễ → khó.
  - Lối vào "Trò chơi" đặt ở trang Luyện tập; mục menu "Học & luyện tập" sáng khi ở `/tro-choi`.
  - Khung E2E nay báo lỗi khi cổng đã có máy chủ khác, để hai lượt E2E chạy cùng lúc không dùng nhầm máy chủ của nhau.
- Lưu ý dữ liệu: game ghép cặp chỉ lấy mức phạt đã duyệt. Dữ liệu GĐ5 hiện toàn là bản nháp, nên trên dữ liệu thật ván ghép cặp báo "Chưa đủ dữ liệu" cho tới khi biên tập viên duyệt ít nhất 3 mức phạt khác nhau.

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
5. Hoàn thành bài được cộng XP (GĐ9).
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
- [x] Hoàn thành bài thì `lesson_progress` chuyển trạng thái xong và XP được cộng một lần.
  - API test:
    - bấm hai lần chỉ có một dòng `xp_ledger` (`bai_hoc`, +15);
    - đi đường `tien-do` với `xong: true` cũng không cộng lần hai;
    - mở lại bài vẫn "xong".
  - E2E: bấm "Hoàn thành bài" trong trình duyệt thì có dòng XP.
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
  - Nhãn menu nằm ở `lib/site.ts` (`MAIN_NAV`), không ở `SiteHeader.tsx`. Mục đổi thành "Học & luyện tập", khớp cả `/hoc`, `/dao-tao`, `/tro-choi`. Trang `/luyen-tap` có thẻ "Bài giảng" dẫn tới `/hoc`.
  - API thêm `POST /v1/dao-tao/chuyen-de/:slug/bai/:baiSlug/hoan-thanh`. Hàm `hoanThanhBaiHoc` trong `packages/db/src/dao-tao.ts` làm trong một giao dịch: ghi danh nếu chưa có, đánh dấu xong, cộng XP qua `congXp` của GĐ9.
  - `GET` bài học trả thêm `topicId`, `trangThai`, `kiemTraCuoiBai`.
  - Kiểm tra cuối bài dùng lại phiên luyện tập GĐ4. `POST /v1/luyen-tap/phien` nhận thêm `so_cau` (3–10, bỏ trống vẫn là 10).
  - Bài được gắn chủ đề trong `seed-ngan-hang.ts` (hàm `ganChuDeChoBaiHoc`), theo ánh xạ chuyên đề → chủ đề đã có trong `CAY_CHU_DE_GT`. Chỉ gắn bài chưa có chủ đề. Migration không tự gắn, vì lúc chạy migration có thể chưa có chủ đề.
  - Thêm `KHOI_BAI_GIANG` và `SO_CAU_KIEM_TRA_CUOI_BAI` vào `packages/dao-tao/src/blocks.ts`.
  - Không cần sửa `apps/web/app/components/layout/SiteHeader.tsx`.
- Sửa lỗi có sẵn:
  - `ghiTienDo` không còn kéo bài đã xong lùi về "đang học". Trước đây mỗi lần mở lại bài, `GET` bài học ghi đè `state = 'dang_hoc'`.
  - `POST /v1/dao-tao/bai/:id/tien-do` nay kiểm ghi danh thuộc người gọi (403 nếu không), vì route này giờ có thể cộng XP.
  - Các route khác nhận `:id` ghi danh trong `dao-tao.ts` vẫn chưa kiểm, xem GĐ0 mục S3.
- Quy tắc nghiệp vụ đã chốt:
  - Khối được dựng đầy đủ: `giang`, `can_cu`, `tom_tat`, `canh_bao`, `bang_tra`, `so_do_trinh_tu`, `the_lat`, `hoi_nhanh`, `kich_ban`.
  - Khối khác hiện chữ thô, và máy chủ web ghi cảnh báo `[bai-giang]`. Trong seed giao thông hiện có ba loại như vậy: `dong_thoi_gian`, `cay_quyet_dinh`, `doi_chieu`.
  - Bài giảng lấy mọi khối (`cheDo=day_du`), không lọc theo chế độ học cũ.
  - Khối `hoi_nhanh` là câu tự kiểm tra trong bài: chấm ngay trên trình duyệt, không tính điểm, như thiết kế cũ.
  - Kiểm tra cuối bài có khi chủ đề của bài (gồm chủ đề con) có từ 3 câu đã duyệt; số câu là min(5, số câu có).
  - XP hoàn thành bài: +15 (`QUY_TAC_XP.hoan_thanh_bai_hoc`), khóa `bai_hoc` + `<ghi danh>|<bài>`, mỗi người mỗi bài một lần.
  - Đọc bài không cần đăng nhập. Hoàn thành bài và kiểm tra cuối bài cần đăng nhập.
  - Nhân vật đồng hành không hiện trên trang bài giảng mới (A8).

---

## GĐ12 — Biển báo và game "Đoán biển báo"

*Phụ thuộc câu trả lời GAP 4.5-24: nguồn ảnh và bản quyền.*

**Mục tiêu**
- Tra cứu biển báo theo nhóm và tên, có ảnh, ý nghĩa và căn cứ QCVN 41:2024/BGTVT.
- Có game đoán biển báo (PRD #4).

**Việc làm**
1. Nạp văn bản QCVN 41:2024 vào kho: số hóa PDF qua MCP (`nhan_viec_so_hoa` → … → `hoan_tat_so_hoa`), để có `citation_urn` cho từng biển.
2. **Dữ liệu biển báo** `data/bien-bao/bien-bao.json` gồm: mã (ví dụ P.102), nhóm (cấm, nguy hiểm, hiệu lệnh, chỉ dẫn, phụ), tên, ý nghĩa, tên tệp ảnh, căn cứ. Ảnh SVG/PNG tải lên R2 qua `packages/storage`.
3. **Màn hình:** `/tra-cuu-nhanh/bien-bao` gồm lưới ảnh, lọc theo nhóm, tìm theo tên hoặc mã; bấm vào xem chi tiết.
4. **Game đoán biển báo** dùng khung game của GĐ10: hiện ảnh, chọn 1 trong 4 tên, lấy phương án nhiễu cùng nhóm.

**File tạo**
- `data/bien-bao/bien-bao.json`, `data/bien-bao/anh/*`
- `scripts/bien-bao.ts`: nạp, kiểm tra ảnh và URN
- `packages/db/src/bien-bao.ts`
- `apps/api/src/routes/bien-bao.ts`, `apps/api/src/bien-bao.test.ts`
- `packages/dao-tao/src/tro-choi/doan-bien-bao.ts`
- `apps/web/app/routes/tra-cuu-nhanh.bien-bao.tsx`, `tro-choi.doan-bien-bao.tsx`

**File sửa**
- `apps/api/src/app.ts`, `apps/web/app/routes.ts`, `tra-cuu-nhanh._index.tsx`, `tro-choi._index.tsx`

**Migration**
- `0022_bien_bao.sql`: `traffic_signs(code PK, group_name CHECK, name, meaning, image_uri, citation_urn, ordinal, status)` + index trigram trên `name`

**Kiểm tra đã xong**
- [ ] `scripts/bien-bao.ts` báo: 0 ảnh thiếu, 0 URN hỏng.
  - Đạt **0 ảnh thiếu** (13/13 ảnh, mỗi ảnh dưới 400 byte).
  - **Chưa đạt 0 URN hỏng:** kho chưa có QCVN 41:2024/BGTVT, nên URN `vn:vbqppl:qcvn:41/2024/BGTVT` của cả 13 biển báo "không tìm thấy". Script chỉ **cảnh báo** với biển bản nháp, **chặn** với biển đã duyệt (`--nghiem` chặn cả bản nháp), như GĐ5.
- [x] Unit test game: 4 phương án khác nhau, cùng nhóm, có đúng một đáp án đúng.
  - `packages/dao-tao/tests/bien-bao.test.ts`, 9 ca. Có thêm: nhóm không đủ 4 biển thì bù từ nhóm khác, đề gửi đi không lộ mã biển, kiểm tra tệp dữ liệu.
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
  - E2E `luyen-tap`, `tro-choi`, `bien-bao`: 3/3 đạt.
  - Lint các tệp GĐ12 qua.
- **Thay đổi so với dự kiến:**
  - Ảnh lưu qua `packages/storage` dưới `assets/bien-bao/` (R2, hoặc `data/assets/` khi chạy cục bộ; đã thêm vào `.gitignore`). API phục vụ ảnh ở `/v1/tra-cuu/bien-bao/anh/:tep`, web chuyển tiếp qua resource route `routes/bien-bao.anh.tsx`, bộ nhớ đệm một ngày.
  - Tra cứu công khai ở `/v1/tra-cuu/bien-bao`. Game ở `/v1/tro-choi/doan-bien-bao` với phiên `game:doan_bien_bao`: chấm trên máy chủ, trả lời lại nhận 409, XP một lần mỗi ván qua `congXp`.
  - Migration 0022 nới CHECK `practice_sessions.source` và `game_scores.game_code`.
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
- **XP từ kết quả offline** được cộng khi đồng bộ, theo thời điểm làm bài thật (có giới hạn trong 7 ngày), nhờ ràng buộc UNIQUE của GĐ9.

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
  - **XP:** cộng khi đồng bộ, theo thời điểm làm bài thật, không muộn hơn lúc gửi (`congXp` với `luc`). Làm quá 7 ngày mới gửi thì vẫn lưu kết quả nhưng không cộng XP.
  - **Gửi tự động:** khi có mạng lại, khi mở trang, sau mỗi phiên. Lỗi thì thử lại sau 5 giây, 10 giây, 20 giây…, tối đa 5 phút.
  - **Cầu nối `/api/*`** chỉ cho ba đường dẫn: `GET luyen-tap/chu-de`, `GET luyen-tap/goi-offline/:chuDe`, `POST luyen-tap/dong-bo`. Thân yêu cầu tối đa 512 KB.
  - **Service worker** chỉ giữ trang `/luyen-tap/offline` (và mọi tệp `/assets/` trang dùng), ngoài ra các tệp tĩnh và ảnh biển báo `/bien-bao/anh/*`. Đăng ký chỉ ở bản build, không ở bản dev.

---

## GĐ14 — Giọng nói: hỏi bằng giọng, đọc câu hỏi, sách nói

**Mục tiêu**
- Nút **micro** ở hỏi đáp AI và khi luyện tập, để nói câu hỏi hoặc đáp án.
- **Đọc câu hỏi** thành tiếng.
- **Sách nói**: nghe toàn bài giảng.
- Game "Hỏi nhanh bằng giọng nói" (PRD #15).

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
- `apps/web/app/routes/tro-choi.hoi-nhanh-giong-noi.tsx`

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
    - Thêm nguồn phiên `game:hoi_nhanh_giong_noi` và mã điểm `hoi_nhanh_giong_noi`; giữ đủ các giá trị đã có tới 0022.
  - `packages/dao-tao`:
    - `khop-loi-noi.ts`: bỏ dấu; nhận tên chữ cái ("bê", "xê", "đê"), số thứ tự sau "phương án"; khớp nội dung bằng hệ số Dice. Nói hai chữ cái, lời phủ định, hay nội dung gần đều nhiều phương án thì trả "không chắc".
    - `sach-noi.ts`: lời đọc từng loại khối; khối video, ảnh, công cụ thì bỏ qua.
    - `tro-choi/hoi-nhanh-giong-noi.ts`, và luật XP của game trong `xp.ts`.
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
    - Game: `/v1/tro-choi/hoi-nhanh-giong-noi` và `/bat-dau`; khi kết thúc phiên thì ghi kỷ lục và cộng XP một lần.
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
    - Trang game `tro-choi.hoi-nhanh-giong-noi.tsx`, thẻ ở trang Trò chơi, mục miễn hướng dẫn.
    - Kịch bản `scripts/e2e/giong-noi.ts`.
- Lưu ý:
  - Game rút câu từ mọi câu đã duyệt, như đua thời gian. Khi chạy song song với test của phiên khác, câu mẫu của test có thể bị xóa giữa lượt và gây lỗi 500 ở câu đó; đây không phải lỗi của game.
  - Chrome nhận dạng giọng nói qua máy chủ Google, nên cần mạng.

---

## GĐ15 — Nhắc học và thông báo thử thách (Web Push)

**Mục tiêu**
- Gửi thông báo đẩy khi:
  - đến giờ học (người dùng tự chọn giờ);
  - chuỗi ngày sắp đứt (20h mà hôm nay chưa học);
  - có đề thi mới được giao;
  - có thử thách mới.

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
  - `notification_prefs(account_id PK, remind_at time, streak_warning boolean, new_exam boolean, quiet_from, quiet_to)`
  - `notifications_sent(id, account_id, kind, ref, sent_at, UNIQUE(account_id, kind, ref))`: chống gửi trùng

**Kiểm tra đã xong**
- [x] Unit test lịch nhắc, dùng tham số `now` theo giờ Việt Nam:
  - đúng giờ thì có tên trong danh sách gửi;
  - giờ yên lặng thì không;
  - người đã học hôm nay không nhận cảnh báo chuỗi ngày.
  - `packages/dao-tao/tests/lich-nhac.test.ts`, 13 ca. Có thêm: qua mốc 0h giờ Việt Nam, cửa sổ gửi khi job trễ một nhịp, giờ yên lặng qua nửa đêm, thử thách 7h, đề thi mới.
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
  - Mỗi loại thông báo gửi trong một cửa sổ 2 giờ, không phải đúng một thời điểm, để job trễ hoặc lỡ một nhịp vẫn gửi: giờ nhắc tự chọn, cảnh báo chuỗi 20h, thử thách 7h (dùng `cauThuThachNgay` của GĐ9). Đã học hôm nay thì không nhắc giờ học nữa.
  - Thêm cột `notification_prefs.new_challenge` (bật tắt thông báo thử thách) và `notifications_sent.delivered` (số thiết bị nhận được).
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
- **Đề ôn tập dùng lại mã thử thách hằng ngày** (đề xuất Đ3):
  - lúc chia sẻ: chọn 5–20 câu bằng `nguonTheoChuDe` và `rutCauLuyenTap`, chốt vào `question_ids`;
  - lúc bắt đầu: `cauHoiDaDuyetTheoId`, `dungCauThuThach`, `taoPhienLuyenTap`; đã có phiên đang làm thì trả phiên cũ;
  - làm và kết thúc qua `/v1/luyen-tap/phien/:id` có sẵn. `POST /v1/luyen-tap/phien` vẫn không nhận nguồn `nhom`. Đề ôn tập không vào gói offline.
- **XP:** không cộng XP mới cho việc làm trong nhóm. Kết thúc phiên đề ôn tập cộng XP qua `ketThucPhien` như phiên luyện tập, theo N17. Cổ vũ theo N8.
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
4. Đề ôn tập: chốt câu lúc chia sẻ, bắt đầu phiên `nhom`, khóa XP theo N17 trong `ketThucPhien`.
5. `apps/api/src/routes/nhom.ts`: các route `/v1/nhom` ở bảng mục 2.5, zod `.strict()`. Gắn trong `app.ts`.
6. N6 chọn tính phiên `nhom` vào báo cáo luyện tập: thêm `'nhom'` vào hằng `NGUON_LUYEN_TAP` của `packages/db/src/bao-cao.ts`, không đổi phần khác.
7. N9 chọn có thông báo: thêm `nhom_hoc` vào `LoaiThongBao`, nhánh gửi trong `thongBaoCanGui` và `chayNhacHoc`, công tắc theo N15.
8. `GET /v1/luyen-tap/phien/:id` trả thêm `nhom: { id, ten_de }` khi `source = 'nhom'` (đề xuất Đ14, phần API).

**File sửa**
- `apps/api/src/app.ts`: gắn `/v1/nhom`
- `apps/api/src/routes/dao-tao.ts`: chỉ phần `phanTramBai`
- `apps/api/src/routes/luyen-tap.ts`: chỉ trường `nhom` của `GET /phien/:id` (đề xuất Đ14)
- `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts`: export
- `packages/db/src/luyen-tap.ts`: kiểu `NguonPhien` thêm `nhom`; khóa XP của phiên `nhom` trong `ketThucPhien` (N17)
- `packages/dao-tao/src/diem-thuong.ts`: chỉ kiểu `NguonPhienXp` thêm `nhom`
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
  - Đạt 16 ca. Ngoài 9 ca trên còn kiểm: bỏ byte lệch phân bố khi sinh mã, chuẩn hóa mã người dùng gõ, khóa XP đề ôn tập, bộ đếm 60 lần mỗi phút, và 2 ca thông báo `nhom_hoc` (có hoạt động thì gửi một thông báo; không hoạt động, tắt công tắc, giờ yên lặng thì không gửi).
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
  - N8 chọn không: sau các lần cổ vũ, `xp_ledger` không có dòng nào sinh ra từ cổ vũ;
  - trưởng nhóm rời khi còn thành viên nhận 409; chuyển quyền rồi rời được; thành viên cuối rời thì nhóm thành `luu_tru`;
  - bắt đầu đề ôn tập hai lần trả cùng id phiên; kết thúc phiên thì phần trăm mục là 100 và `xp_ledger` có đúng 1 dòng; làm lại lần hai thì số dòng XP đúng như N17;
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
  - `bun run lint`: các tệp của GĐ16a qua. Lỗi còn lại ở 7 tệp có từ trước, giai đoạn này không sửa: `apps/api/src/auth.test.ts`, `apps/api/src/routes/mascot.ts`, `apps/web/app/lib/luyen-tap.server.ts`, `packages/dao-tao/src/tro-choi/tu-lai.ts`, `packages/dao-tao/tests/lap-bien-ban.test.ts`, `scripts/e2e/dung-xe.ts`, `scripts/e2e/kiem-tra-giay-to.ts`.
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
  - **Làm đề ôn tập:** thứ tự câu giữ theo đề đã chốt, phương án đảo theo seed của mục, người và thời điểm bắt đầu. XP nguồn `phien_luyen_tap`, khóa `nhom:<mục>:<người>`: lần kết thúc đầu tiên có trả lời ít nhất một câu mới có XP (N17).
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
- **Lối vào** theo N1 (chọn khác): thẻ "Nhóm học cùng" trên `/luyen-tap` và dòng "Nhóm học cùng" trong ngăn "Thêm" (`MORE_NAV`) trên điện thoại; không có dòng ở `/toi`. Thêm `/nhom` vào `MAIN_NAV[1].khop` trong `lib/site.ts`; mục "Học" của `BOTTOM_NAV` chép `khop` từ đó nên tự sáng theo, như trang Bảng xếp hạng. Menu cán bộ vẫn 4 mục.
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
- Cán bộ quản lý xem các nhóm học cùng có thành viên trong đơn vị mình, và tiến độ của từng thành viên trong phạm vi.
- Có báo cáo "Tiến độ học" của từng cán bộ trong cây đơn vị theo N13, xuất Excel và PDF như các báo cáo GĐ7.

**Thiết kế** (PROMPT_NHOM_HOC_CUNG.md mục 2.1, 2.5 phần Quản lý và Báo cáo, 2.6 Trang quản lý; câu N11, N13 trả lời theo đề xuất, đề xuất Đ11, Đ12 được đồng ý, Đ18 trả lời "Không" ngày 29/9/2026)
- **Phạm vi áp ở tầng truy vấn** bằng `phamViCua` và điều kiện `units.path <@ phạm vi`, theo đơn vị **hiện tại** của từng thành viên.
  - Thành viên ngoài phạm vi chỉ trả số lượng, không trả tên, không trả id.
  - `quan_ly` chưa gắn đơn vị nhận 403; thành viên chưa gắn đơn vị là ngoài phạm vi với mọi `quan_ly` (đề xuất Đ11). `quan_tri` thấy tất cả.
- `apps/api/src/routes/nhom.ts` export thêm `quanTriNhomRoute` theo mẫu `mua-giai.ts`, gắn `/v1/quan-tri/nhom` trước dòng `app.route("/v1/quan-tri", quanTri)`.
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
  - `bun run lint`: các tệp của GĐ16c qua. Lỗi còn lại ở 7 tệp có từ trước, như GĐ16a: `apps/api/src/auth.test.ts`, `apps/api/src/routes/mascot.ts`, `apps/web/app/lib/luyen-tap.server.ts`, `packages/dao-tao/src/tro-choi/tu-lai.ts`, `packages/dao-tao/tests/lap-bien-ban.test.ts`, `scripts/e2e/dung-xe.ts`, `scripts/e2e/kiem-tra-giay-to.ts`.
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
  - Xác nhận lưu trữ nhóm dùng `confirm()` như trang mùa giải (`quan-tri.mua-giai.tsx`), không dùng `HopThoai` của GĐ16b vì tệp đó chưa có khi bắt đầu và không nằm trong danh sách tệp của GĐ16c.
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
    - luyện tập như báo cáo luyện tập theo người (có phiên `nhom`, không có phiên trò chơi);
    - đã nộp, đạt đếm trên các đề được giao: có lượt đã nộp, có lượt đạt trong khoảng ngày;
    - số nhóm là nhóm đang hoạt động người đó đang ở trong; phần trăm trung bình trong các nhóm làm tròn xuống, trống khi không có nhóm hoặc các nhóm chưa có mục nào được tính;
    - lần học gần nhất theo Đ12, kể cả câu trả lời trong trò chơi, không lọc ngày.
  - **Lọc nhóm:** thành viên đang ở trong nhóm (kể cả nhóm đã lưu trữ) thuộc phạm vi; nhóm không có ai trong phạm vi trả 404.

---

## GĐ16d — Nhóm học cùng: AI gợi ý thứ tự học và tóm tắt tiến độ

**Mục tiêu**
- Trưởng nhóm nhận gợi ý thứ tự học cho các mục trong nhóm (AI-1) và tự quyết định có áp dụng không.
- Cán bộ quản lý đọc bản tóm tắt tiến độ nhóm do AI soạn từ số liệu trong phạm vi (AI-2), đặt cạnh bảng số liệu để đối chiếu.
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

## GĐ17a — Hộp kết quả đúng/sai: component chung, khung chơi chung, chơi offline, Vượt màn

**Mục tiêu**
- Chốt đáp án xong, kết quả hiện trong hộp thoại "Đúng" / "Chưa đúng" / "Hết giờ" (và "Đúng một phần" theo H6), nút đi tiếp nằm trong hộp, trong tầm ngón cái.
- Giải thích và căn cứ pháp lý thu gọn sau nút "Xem chi tiết"; người chơi bấm mới hiện.
- Có component dùng chung `HopKetQuaCau`, `ChiTietKetQua` cho GĐ17b, GĐ17c.

**Thiết kế** (PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.1–2.7; ngày 30/9/2026 câu H1, H2, H6, H8, H9, H10, H11 trả lời theo đề xuất, đồng ý Đ1–Đ10; Đ6 có âm thanh và rung theo cài đặt trò chơi)
- Dựng trên `components/ui/HopThoai.tsx` của GĐ16b, **không sửa `HopThoai.tsx`**. Tiêu đề hộp là tên truy cập của hộp.
- Tiêu đề theo H6: `dung === true` là "Đúng"; `dung === null` thì bằng điểm tối đa là "Đúng", 0 điểm là "Chưa đúng", còn lại "Đúng một phần" màu `--warn`; `het_gio` luôn là "Hết giờ". Hàm thuần ở `lib/ket-qua-cau.ts`, đầu vào là kiểu chung cho `KetQuaBuocWeb` và `KetQuaCauHoi` (đề xuất Đ5).
- "Xem chi tiết" mặc định thu gọn mỗi lần hộp mở (H9): `aria-expanded`, `aria-controls`, phần chi tiết `hidden`. Chi tiết gồm giải thích, căn cứ (H8: mở rộng nguyên văn tại chỗ bằng `NoiDungDieu`, không lồng `NganKeoCanCu`; offline chỉ nhãn). Không có nội dung chi tiết thì không có nút.
- Phần chi tiết cuộn trong khung riêng, nút chính luôn trong khung nhìn ở 360×740 (đề xuất Đ2). Nút chính nhận tiêu điểm khi hộp mở bằng `ref` và `focus()`, không dựa vào `autoFocus` (đề xuất Đ1).
- Đóng hộp (X, Esc) để nhìn lại bảng chơi (H11): đáy trang có "Xem lại kết quả" và nút đi tiếp, tiêu điểm về "Xem lại kết quả" (đề xuất Đ7). Đổi bước thì hộp đóng hẳn; tải lại trang sau khi chấm không tự mở hộp.
- Đồng hồ cả lượt không dừng (H2). Hộp hiện dòng "Còn m:ss" tính từ cùng mốc với đồng hồ đầu trang, chỉ hiển thị (đề xuất Đ4). Hết giờ cả lượt lúc hộp mở: hộp đóng, giữ `hetCa` như cũ.
- Âm thanh, rung phát một lần khi hộp mở lần đầu mỗi câu; mở lại không phát. Hiệu ứng tắt theo `prefers-reduced-motion` và công tắc "Giảm hiệu ứng" (đề xuất Đ3). Bảng chơi vẫn tô đáp án và rung ngang khi sai.
- Vượt màn theo H1: chỉ phiên `game:vuot_man` trên `/luyen-tap/:phien` có hộp; luyện tập thường, thử thách, đề ôn tập của nhóm giữ `PhanHoiCauTraLoi` như cũ. Hộp ở trang này bọc `VungTroChoi` (đề xuất Đ6).
- Màn "Xem lại từng câu" không dùng hộp (H10): mỗi câu dòng "Đúng"/"Chưa đúng" và `ChiTietKetQua` thu gọn tại chỗ.
- Chơi offline: nút đi tiếp trong hộp vẫn là nút đổi state, không đổi URL (đề xuất Đ10).

**Việc làm**
1. `apps/web/app/lib/ket-qua-cau.ts`: `tieuDeKetQua`, `coChiTiet`, kiểu đầu vào chung; unit test.
2. `components/tro-choi/chung/ChiTietKetQua.tsx`: nút "Xem chi tiết"/"Ẩn chi tiết", phần chi tiết (giải thích, căn cứ theo H8), chỗ nhận chi tiết riêng của trò cho GĐ17c.
3. `components/tro-choi/chung/HopKetQuaCau.tsx` theo PROMPT mục 2.2.
4. `components/tro-choi/PhanHoiBuoc.tsx`: export `DongDiem`, `DauKetQua` có trạng thái "một phần"; tách phần phát âm, rung để hộp gọi. Giữ hành vi mặc định cho `routes/game-style-demo.tsx` (đề xuất Đ8).
5. `routes/tro-choi.luot.tsx` (`BuocDangChoi`, phần "Xem lại từng câu") và `components/tro-choi/TongKetLuot.tsx` (`DanhSachBuoc`, đề xuất Đ8). Giữ `shouldRevalidate`, `DongHoBuoc`, `hetCa`, rung ngang, lớp "Hết giờ".
6. `routes/tro-choi.offline.tsx`: như việc 5, căn cứ dạng chữ.
7. `routes/luyen-tap.phien.tsx`: hộp cho câu Vượt màn theo H1; kiểu `nguon` trong `lib/luyen-tap.server.ts` nhận `game:*` (đề xuất Đ6).
8. Sửa các kịch bản e2e ở PROMPT mục 1.3 thuộc đường đã đổi; `luyen-tap.ts`, `nhom-hoc.ts`, `offline.ts` chỉ sửa nếu H1 áp cho cả luyện tập.
9. Sửa bài trong `content/huong-dan/` nếu có bài tả cách xem kết quả trò chơi.

**File sửa**
- `apps/web/app/routes/tro-choi.luot.tsx`, `apps/web/app/routes/tro-choi.offline.tsx`
- `apps/web/app/routes/luyen-tap.phien.tsx`: chỉ nhánh Vượt màn theo H1
- `apps/web/app/components/tro-choi/PhanHoiBuoc.tsx`
- `apps/web/app/components/luyen-tap/PhanHoiCauTraLoi.tsx`: chỉ tách phần dùng lại được, không đổi hành vi luyện tập thường
- `apps/web/app/components/tro-choi/TongKetLuot.tsx`, `apps/web/app/lib/luyen-tap.server.ts` (chỉ kiểu `nguon`): chỉ khi đề xuất Đ8 được đồng ý
- `scripts/e2e/`: `tro-choi-khung.ts`, `sung-ban-toc-do.ts`, `cung-duong.ts`, `kiem-tra-giay-to.ts`, `duyet-phat-nguoi.ts`, `len-xe-khach.ts`, `soi-xe-cai-tao.ts`, `tram-can.ts`, `lap-bien-ban.ts`, `dung-xe.ts`, `cam-bien.ts`, `chot-dem.ts`, `soi-camera.ts`, `tu-lai.ts`, `tro-choi.ts` (phần Vượt màn), `tro-choi-muot.ts`
- `content/huong-dan/` (nếu cần), `docs/PLAN.md`, `docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md` (ghi câu trả lời)

**File tạo**
- `apps/web/app/lib/ket-qua-cau.ts`, `apps/web/tests/ket-qua-cau.test.ts`
- `apps/web/app/components/tro-choi/chung/HopKetQuaCau.tsx`, `apps/web/app/components/tro-choi/chung/ChiTietKetQua.tsx`
- `scripts/e2e/hop-ket-qua.ts`

Kiểm lại tên tệp thật trước khi sửa. Tên khác danh sách trên thì dùng tên thật và ghi vào "Thay đổi so với dự kiến".

**Migration**
- Không có. Không sửa API.

**Kiểm tra đã xong**
- [x] Unit test `apps/web/tests/ket-qua-cau.test.ts`: `dung` true, false; `het_gio` với mọi giá trị `dung`; `dung: null` với điểm tối đa, 0 điểm, một phần điểm (H6); kết quả không có điểm (Vượt màn); không giải thích, không căn cứ, không chi tiết riêng thì không có nút "Xem chi tiết".
  - 10 ca đạt, thêm ca đáp án một dòng (Đ9) và định dạng giờ m:ss.
- [x] `bun run e2e hop-ket-qua` ở 360×740, trên Cung đường biển báo (có đồng hồ cả lượt) và một trò không có đồng hồ:
  - chốt đúng thì hộp tên "Đúng" hiện; chốt sai thì hộp "Chưa đúng" hiện, bảng chơi vẫn tô đáp án;
  - lúc mở hộp giải thích không nhìn thấy; bấm "Xem chi tiết" thì giải thích, căn cứ hiện, `aria-expanded="true"`; bấm lại thì ẩn; câu sau mở hộp thì lại thu gọn;
  - nút chính có tiêu điểm khi hộp mở; Esc đóng hộp, tiêu điểm ở "Xem lại kết quả"; bấm nút đó mở lại hộp, không phát lại âm thanh;
  - bấm "Câu tiếp" trong hộp thì sang bước sau, không còn dialog mở, trang cuộn được;
  - đồng hồ cả lượt vẫn giảm lúc hộp mở; dòng giờ trong hộp khớp đồng hồ đầu trang (lệch dưới 1 giây);
  - phần chi tiết dài thì nút chính vẫn trong khung nhìn;
  - không cuộn ngang; "Xem chi tiết" và nút chính cao ≥ 48px; chữ nội dung ≥ 16px;
  - giảm chuyển động (`reducedMotion: reduce`) và công tắc "Giảm hiệu ứng": hộp không có hoạt ảnh.
  - Đạt ba lần liền (18,9; 18,2; 18,3 giây). Trò không có đồng hồ là Lập biên bản: hộp không có dòng giờ, con dấu "ĐẠT"/"CHƯA ĐẠT" vẫn trên mẫu biên bản; biên bản sai tiền ra hộp "Chưa đúng". Âm thanh đo bằng số oscillator được tạo: có khi hộp mở lần đầu, không tăng khi mở lại. Giờ trong hộp lệch đồng hồ đầu trang ≤ 1 giây và giảm sau 2,3 giây.
- [x] Chơi offline: hộp hiện, "Xem chi tiết" có "Căn cứ: …" dạng chữ; nút đi tiếp trong hộp chạy đúng.
  - Kiểm trong `tro-choi-khung.ts` (phần offline): giải thích và "Căn cứ: …" của câu 1 tính từ gói trên máy; nút "Câu tiếp", "Xem kết quả" bấm trong hộp.
- [x] Vượt màn: hộp hiện cho câu của màn; luyện tập thường vẫn là khối cũ (nếu H1 theo đề xuất); `bun run e2e luyen-tap` vẫn đạt.
  - Trong `hop-ket-qua.ts`: câu sai có "Đáp án: …"; giải thích dài cuộn trong khung riêng, "Câu tiếp" vẫn trong khung nhìn; căn cứ mở rộng tại chỗ, không có ngăn kéo; tải lại trang thì hộp không tự mở, không phát âm. `luyen-tap`, `nhom-hoc`, `offline` (luyện tập) đạt, không phải sửa.
- [x] Màn "Xem lại từng câu": không có hộp; mỗi câu có "Xem chi tiết" thu gọn.
  - Kiểm trong `tro-choi-khung.ts`: không có dialog mở; số nút "Xem chi tiết" bằng số câu có giải thích hoặc căn cứ; nút đầu thu gọn, bấm thì mở.
- [x] Mọi kịch bản e2e trò chơi ở PROMPT mục 1.3 đạt sau khi sửa. **Trừ `soi-xe-cai-tao`**, hỏng từ trước (xem Trạng thái).
  - Đạt 20/21 kịch bản: `cam-bien`, `chot-dem`, `cung-duong`, `dung-xe`, `duyet-phat-nguoi`, `giong-noi`, `hop-ket-qua`, `kiem-tra-giay-to`, `lap-bien-ban`, `len-xe-khach`, `luyen-tap`, `nhom-hoc`, `offline`, `soi-camera`, `sung-ban-toc-do`, `tram-can`, `tro-choi`, `tro-choi-khung`, `tro-choi-muot`, `tu-lai`. `cung-duong`, `soi-camera`, `tu-lai` đạt ở lượt chạy lại sau khi sửa kịch bản.
- [x] Chuỗi mới qua QUY-TAC-HANH-VAN: không emoji, không dấu chấm than, không lời khen. `scripts/huong-dan/bao-ve.test.ts` đạt.
  - Chuỗi mới: "Xem chi tiết", "Ẩn chi tiết", "Căn cứ pháp lý", "Chi tiết kết quả", "Đúng một phần", "Xem lại kết quả", "Thời gian còn lại của lượt:", "Đáp án:". Không có bài hướng dẫn nào tả cách xem kết quả trò chơi nên không sửa `content/huong-dan/`.
- [x] Mã riêng mỗi trò vẫn ≤ 8 KB gzip (≤ 12 KB nếu dùng bộ mô phỏng).
  - Không đổi: giai đoạn này không sửa tệp riêng của trò nào. Phần dùng chung mới (`bun build --minify`, tính cả tệp nội bộ được nhập như `HopThoai`, `NoiDungDieu`): `HopKetQuaCau` 11,2 KB gzip, trong đó `ChiTietKetQua` 8,1 KB; `lib/ket-qua-cau.ts` 0,6 KB.
- [x] Cổng chung §0.2 đạt. Test hỏng từ trước ghi rõ tên tệp ở mục Trạng thái.

**Trạng thái (30/9/2026):** đã làm xong, đạt 9/9 mục kiểm tra; riêng kịch bản `soi-xe-cai-tao` hỏng từ trước.
- Quyết định của người dùng: H1, H2, H6, H8, H9, H10, H11 theo đề xuất; đồng ý Đ1–Đ10, Đ6 có âm thanh và rung theo cài đặt trò chơi. Đã ghi vào cột "Trả lời" của PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.8, 2.9 và sửa mục 2.2, 2.3 theo Đ1, Đ2, Đ4, Đ9.
- Cổng chung:
  - `bun run db:migrate`: "Không có migration mới".
  - `bun run typecheck`: 16/16 gói qua.
  - `bun test`: 1.715 đạt, 7 bỏ qua, 6 hỏng. 5 ở `packages/config/src/ports.test.ts` (lỗi môi trường Windows có từ trước); 1 ca hiệu năng của GĐ16c ("báo cáo 1.000 cán bộ, 50 nhóm") hỏng khi chạy chung toàn bộ test, như GĐ16d đã ghi. Unit mới 10/10.
  - `bun run lint`: các tệp của GĐ17a qua. Lỗi còn lại ở 6 tệp có từ trước: `apps/api/src/auth.test.ts`, `apps/api/src/routes/mascot.ts`, `apps/web/app/lib/luyen-tap.server.ts` (kiểu `KetQuaTroChoi`, không phải dòng sửa ở giai đoạn này), `packages/dao-tao/tests/lap-bien-ban.test.ts`, `scripts/e2e/dung-xe.ts`, `scripts/e2e/kiem-tra-giay-to.ts`.
  - `bun run build:web`: qua. `bun run smoke`: 10/11 đạt, 1 bỏ qua (web SSR ở cổng 3030 không chạy), như GĐ16a, GĐ16c, GĐ16d.
- **`soi-xe-cai-tao` hỏng từ trước:** kịch bản dừng ở bước đo thước của xe 1, trước khi chốt đáp án ("Thước đo đổi 99 mm, cần 100 mm", lần khác 95 mm). Chạy trên mã web gốc (tạm cất thay đổi của GĐ17a) cũng hỏng đúng chỗ đó, nên không do giai đoạn này. Phần sau của kịch bản (chờ hộp kết quả) chưa chạy tới được; cách sửa giống `tram-can`, `len-xe-khach` đã đạt.
- Thay đổi so với dự kiến:
  - `PhanHoiBuoc` nay gồm dòng điểm và `ChiTietKetQua` thu gọn (không còn khối `role="status"` "Đúng."/"Chưa đúng."); trang chơi không dùng nó cho kết quả vừa chấm. Màn "Xem lại từng câu" và trang duyệt hiệu ứng `/game-style-demo` vẫn dùng, nên không phải sửa `game-style-demo.tsx` (Đ8). Export thêm `DongDiem` (có `anTieuDe`), `phatKetQua`, `lopChuKetQua`; `DauKetQua` nhận `loai` thay cho `dung` để có "Đúng một phần" màu `--warn`.
  - `PhanHoiCauTraLoi.tsx` tách phần hiện nguyên văn căn cứ thành `NoiDungCanCu`, dùng chung với `ChiTietKetQua`; ngăn kéo căn cứ của luyện tập không đổi.
  - `HopKetQuaCau.tsx` export thêm `NutXemLaiKetQua` cho ba trang. Không dùng `autoFocus` (Đ1): hộp tìm nút đầu tiên trong vùng nút và gọi `focus()` sau `showModal()`.
  - Hiệu ứng trượt tắt theo công tắc "Giảm hiệu ứng" bằng lớp `in-data-[giam-hieu-ung=1]:transition-none!` truyền qua `className` của `HopThoai` (Đ3).
  - Dòng "Đáp án: …" (Đ9) có ở Vượt màn và trò mẫu `thu_nghiem` (cả online và offline).
  - Kịch bản e2e: `hop-ket-qua.ts` export `hopKetQua` để các kịch bản khác chờ hộp; `lap-bien-ban.ts` export `chuanBi`, `vaoChoi`, `dienVaKy` để dùng lại. `cung-duong.ts` bấm "Xem chi tiết" trước khi đọc "Phản ứng đúng …/12 biển" (đó là lời giải thích của máy chủ). `soi-camera.ts`, `tu-lai.ts` đóng hộp (Esc) trước khi bấm nút tua lại, xem lại trên bảng chơi: khi hộp mở, bảng chơi phía sau không bấm được. `cam-bien`, `chot-dem`, `dung-xe`, `tro-choi-muot` không phải sửa.
  - Kịch bản "trò không có đồng hồ" dùng Lập biên bản; chơi offline kiểm trong `tro-choi-khung.ts` thay vì `hop-ket-qua.ts`.
- Quy tắc nghiệp vụ đã chốt:
  - **Tiêu đề hộp** (H6): hết giờ luôn là "Hết giờ"; `dung` true/false theo đó; `dung: null` thì đủ điểm tối đa là "Đúng", 0 điểm là "Chưa đúng", còn lại "Đúng một phần". Kết quả không có điểm (Vượt màn) chỉ theo `dung`. Máy chủ trả `dung: false` thì hộp là "Chưa đúng" dù được một phần điểm (ví dụ đường chạy Cung đường biển báo 110/120).
  - **Mở hộp:** tự mở khi kết quả vừa chấm. Vượt màn tải lại trang thì không tự mở, đáy trang có "Xem lại kết quả". Khung chung tải lại trang sau khi chấm thì máy chủ mở bước kế, không còn kết quả để hiện.
  - **Nút đi tiếp** chỉ có một chỗ: trong hộp khi hộp mở; ở đáy trang, dưới "Xem lại kết quả", khi hộp đã đóng.
  - **Âm thanh, rung** một lần khi hộp mở lần đầu với kết quả vừa chấm; "Đúng" dùng âm đúng, "Chưa đúng" và "Đúng một phần" dùng âm sai; "Hết giờ" không phát (đồng hồ đã báo). Mở lại không phát.
  - **Hết giờ cả lượt** lúc hộp mở: hộp đóng, lớp "Hết giờ" hiện, lượt tự chốt sau 2.500 ms như cũ.
  - **Giờ trong hộp** (Đ4): chỉ khi trang đang hiện đồng hồ cả lượt; mốc tính lúc bước được mở, cập nhật 4 lần mỗi giây, không báo đọc.
  - **Chi tiết:** giải thích, rồi "Căn cứ pháp lý" (mỗi căn cứ một nút mở rộng, tải nguyên văn lần đầu mở), rồi chi tiết riêng của trò. Offline: "Căn cứ: …" dạng chữ. Khung chi tiết cao tối đa 35dvh, cuộn riêng.
  - **Vượt màn** là phiên có nguồn `game:vuot_man`; nguồn khác trên `/luyen-tap/:phien` giữ khối phản hồi cũ.

---

## GĐ17b — Hộp kết quả đúng/sai: Đua thời gian, Hỏi nhanh giọng nói, Ghép cặp

**Mục tiêu**
- Ba trò riêng lẻ báo kết quả và giải thích theo cùng cách với GĐ17a, không đổi nhịp chơi của từng trò.

**Thiết kế** (PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.2, 2.3, 2.5, 2.6; ngày 30/9/2026 câu H3, H4 theo đề xuất; H5 một hộp, tiêu đề theo H6; đồng ý Đ11; H8, H9, Đ5, Đ9 đã trả lời ở GĐ17a)
- Dùng lại `HopKetQuaCau`, `ChiTietKetQua`, `lib/ket-qua-cau.ts` của GĐ17a, không viết lại.
- **Đua thời gian** (H3): không có hộp mỗi câu; giữ nháy màu và nhịp 350 ms, không dừng `DongHoNguoc`. Action giữ thêm `giai_thich`, `can_cu` từng câu (API đã trả). Màn kết thúc có danh sách câu sai, mỗi câu "Xem chi tiết" thu gọn.
- **Hỏi nhanh giọng nói** (H4): có hộp mỗi câu, bỏ tự sang câu sau 1800 ms; "Câu tiếp" trong hộp nhận tiêu điểm; câu sau vẫn tự đọc khi hiện. Action giữ thêm `giai_thich`, `can_cu`. Chưa đúng có dòng "Đáp án: …" (Đ9). Hộp không có dòng điểm (Đ5).
- **Ghép cặp** (H5): một hộp sau khi nộp, dòng "Đúng x/y cặp" theo số cặp thật (3–5); "Mức phạt đúng" và căn cứ từng cặp vào "Xem chi tiết", liên kết "Xem điều khoản" đổi theo H8; bảng ghép vẫn tô màu. Nút chính là "Chơi ván mới", "Trò chơi khác" ở đáy trang (Đ11). Không thêm trường giải thích vào API.

**Việc làm**
1. `routes/tro-choi.dua-thoi-gian.tsx` theo H3.
2. `routes/tro-choi.hoi-nhanh-giong-noi.tsx` theo H4.
3. `routes/tro-choi.ghep-cap.tsx` theo H5; `BangGhepCap.tsx` chỉ khi cần.
4. Sửa e2e `tro-choi.ts` (phần Đua, Ghép cặp) và `giong-noi.ts`; thêm trường hợp vào `hop-ket-qua.ts`.

**File sửa**
- `apps/web/app/routes/tro-choi.dua-thoi-gian.tsx`, `apps/web/app/routes/tro-choi.hoi-nhanh-giong-noi.tsx`, `apps/web/app/routes/tro-choi.ghep-cap.tsx`
- `apps/web/app/components/tro-choi/BangGhepCap.tsx`: chỉ nếu cần
- `apps/web/app/components/tro-choi/chung/ChiTietKetQua.tsx`: chỉ thêm chỗ nhận danh sách nếu thiếu, không đổi hành vi GĐ17a
- `scripts/e2e/tro-choi.ts`, `scripts/e2e/giong-noi.ts`, `scripts/e2e/hop-ket-qua.ts`
- `docs/PLAN.md`, `docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md` (ghi câu trả lời)

**File tạo**
- Không có.

**Migration**
- Không có. Không sửa API.

**Kiểm tra đã xong**
- [x] Đua: từ lúc bấm tới câu sau vẫn khoảng 350 ms; đồng hồ không dừng; màn kết thúc có danh sách câu sai, "Xem chi tiết" thu gọn, mở ra thấy giải thích (theo H3).
  - `tro-choi.ts`: trả lời sai 3 câu (đáp án đọc từ phiên trong CSDL), đo từ lúc hiện "Sai" tới câu sau: 283–331 ms ở lượt cuối; một lượt khi máy đang tải nặng có hai lần 790–797 ms (kịch bản chấp nhận 250–1.000 ms vì gồm cả thời gian Playwright dò). Chờ hết 60 giây: mục "Câu chưa đúng" có đúng 3 câu, mỗi câu có câu hỏi, "Đáp án: …", "Xem chi tiết" thu gọn, bấm thì thấy giải thích.
- [x] Hỏi nhanh: trả lời bằng chạm thì hộp "Đúng"/"Chưa đúng" hiện, chưa đúng có "Đáp án: …"; không tự sang câu; "Câu tiếp" có tiêu điểm; câu sau tự đọc (theo H4).
  - `giong-noi.ts`: câu 1 chạm phương án sai thì hộp "Chưa đúng" có "Đáp án: <chữ phương án đúng>"; tiêu điểm ở "Câu tiếp"; sau 2,5 giây hộp vẫn mở, vẫn câu 1; bấm "Câu tiếp" thì sang câu 2. Các câu sau chơi bằng lời nói như cũ, sang câu bằng nút trong hộp, tới màn kết quả.
  - **Câu sau tự đọc: chưa kiểm được trên máy này.** Máy chủ chưa cấu hình Vbee (`VBEE_APP_ID` trống) nên trang không có giọng đọc, trước và sau giai đoạn này đều vậy. Kịch bản đếm số lần phát âm thanh và chỉ kiểm khi trang có nút "Đọc câu hỏi"; không có thì in cảnh báo. Mã giữ nguyên `ThanhGiongNoiCauHoi … tuDoc` với `key` theo câu, nên câu mới vẫn tự đọc khi hiện ra.
- [x] Ghép cặp: nộp xong một hộp hiện với "Đúng x/y cặp"; mức phạt đúng chỉ hiện sau khi bấm "Xem chi tiết" (theo H5).
  - `tro-choi.ts`: hộp "Đúng" với "Đúng 5/5 cặp"; tiêu đề "Mức phạt đúng" không nhìn thấy tới khi bấm "Xem chi tiết"; Esc đóng hộp thì có "Xem lại kết quả".
- [x] 360×740: không cuộn ngang, vùng chạm ≥ 48px, giảm chuyển động tắt hoạt ảnh.
  - Không cuộn ngang ở hộp Ghép cặp, hộp Hỏi nhanh, màn kết thúc Đua. "Xem chi tiết" và "Chơi ván mới" cao ≥ 48px. Giảm chuyển động (hệ điều hành): hộp Ghép cặp không có hoạt ảnh, chuyển tiếp ≤ 1 ms. Công tắc "Giảm hiệu ứng" dùng cùng lớp đã kiểm ở GĐ17a.
- [x] `bun run e2e tro-choi`, `bun run e2e giong-noi`, `bun run e2e hop-ket-qua` đạt.
  - Đạt ở lượt cuối: `tro-choi` 70,3 giây, `giong-noi` 20,3 giây, `hop-ket-qua` 17,6 giây. `hop-ket-qua.ts` không phải thêm trường hợp: phần kiểm của ba trò nằm trong `tro-choi.ts` và `giong-noi.ts`.
- [x] Mã riêng mỗi trò vẫn ≤ 8 KB gzip.
  - Tệp route, `bun build --minify`, không tính tệp được nhập: Đua 2,6 KB (trước 2,2 KB), Hỏi nhanh 2,8 KB (trước 2,6 KB), Ghép cặp 2,1 KB (trước 2,0 KB).
- [x] Cổng chung §0.2 đạt. Test hỏng từ trước ghi rõ tên tệp ở mục Trạng thái.

**Trạng thái (30/9/2026):** đã làm xong, đạt 7/7 mục kiểm tra; riêng bước "câu sau tự đọc" chưa kiểm được vì máy không có Vbee (xem trên).
- Quyết định của người dùng: H3, H4 theo đề xuất; H5 một hộp với tiêu đề theo H6 ("Đúng một phần" khi đúng một số cặp); đồng ý Đ11; đồng ý thêm prop không bắt buộc `dongDiem` vào `HopKetQuaCau.tsx` (tệp ngoài danh sách, đã hỏi trước theo quy tắc 11). Đã ghi vào cột "Trả lời" của PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.8, 2.9.
- Cổng chung:
  - `bun run db:migrate`: "Không có migration mới". `bun run typecheck`: mọi gói qua.
  - `bun test`: 1.716 đạt, 7 bỏ qua, 5 hỏng, cả 5 ở `packages/config/src/ports.test.ts` (lỗi môi trường Windows có từ trước).
  - `bun run lint`: các tệp của GĐ17b qua. Lỗi ở 6 tệp có từ trước như GĐ17a, cộng các tệp phiên GĐ17c đang sửa dở cùng lúc (`DungXe.tsx`, `DuyetPhatNguoi.tsx`, `KiemTraGiayTo.tsx`, `giao-dien.tsx`, `scripts/e2e/duyet-phat-nguoi.ts`, `scripts/e2e/hop-ket-qua.ts`).
  - `bun run build:web`: qua. `bun run smoke`: 10/11 đạt, 1 bỏ qua (web SSR ở cổng 3030 không chạy).
- **Làm song song với phiên GĐ17c:** phiên đó sửa cùng lúc `giao-dien.tsx`, `tro-choi.luot.tsx`, các component trò, `scripts/e2e/hop-ket-qua.ts` và build lại web giữa lúc kịch bản của GĐ17b đang chạy (một lượt hỏng cả ba kịch bản vì thư mục build bị thay). Các số liệu trên lấy ở lượt chạy khi bản build không đổi. Cần soát diff của hai phiên trước khi commit.
- Thay đổi so với dự kiến:
  - `HopKetQuaCau.tsx` thêm prop không bắt buộc `dongDiem` (dòng riêng cạnh dấu kết quả, thay "Điểm: x/y"); không truyền thì như GĐ17a.
  - `ChiTietKetQua.tsx` chỉ export thêm `CanCuMoRong` để Ghép cặp mở căn cứ từng cặp tại chỗ (H8), không đổi hành vi.
  - Ghép cặp: bỏ dải `role="status"` "Ghép đúng hết." / "Đúng x/y cặp."; mục "Mức phạt đúng" chuyển vào phần chi tiết của hộp, liên kết "Xem điều khoản" (rời trang) đổi thành nút mở rộng nguyên văn; mỗi cặp ghi thêm chữ "bạn ghép đúng" / "bạn ghép chưa đúng" để không chỉ dựa vào màu. Không phải sửa `BangGhepCap.tsx`.
  - Hỏi nhanh: bỏ `CHO_CAU_TIEP_MS` và dòng `aria-live` "Đúng" / "Sai. Đáp án: …" (hộp thay thế); vùng `aria-live` còn dùng cho lỗi chấm. Câu cuối, nút trong hộp là "Xem kết quả". Hỏi nhanh nay phát âm thanh, rung theo cài đặt trò chơi khi hộp mở, như các trò khác.
  - Đua: ngoài giải thích, căn cứ, action giữ thêm `dap_an` để màn kết thúc có "Đáp án: …" (Đ9). Sửa chuỗi cũ "Kỷ lục mới!" thành "Kỷ lục mới." theo QUY-TAC-HANH-VAN, như Hỏi nhanh.
  - E2E: `tro-choi.ts` phần Đua đợi hết 60 giây để kiểm màn kết thúc (kịch bản dài thêm khoảng 60 giây); danh sách câu sai chọn bằng `ol > li` vì danh sách căn cứ trong phần chi tiết cũng là `listitem`.
- Quy tắc nghiệp vụ đã chốt:
  - **Đua:** không có hộp; câu chưa đúng (đã trả lời sai, không tính câu bỏ lỡ khi hết giờ) được giữ trên máy theo thứ tự trả lời, hiện ở màn kết thúc dưới tiêu đề "Câu chưa đúng": số câu, câu hỏi, đáp án một dòng nếu có, "Xem chi tiết" thu gọn. Không có câu sai thì không có mục này.
  - **Hỏi nhanh:** hộp mỗi câu, tiêu đề "Đúng" / "Chưa đúng" (không có điểm nên không có "Đúng một phần"); không tự sang câu; đóng hộp thì đáy trang có "Xem lại kết quả" và "Câu tiếp".
  - **Ghép cặp:** một hộp sau khi nộp; tiêu đề theo số cặp đúng (đủ là "Đúng", 0 là "Chưa đúng", còn lại "Đúng một phần"); dòng "Đúng x/y cặp", kèm "+N XP" khi có. Nút chính "Chơi ván mới"; "Trò chơi khác" luôn ở đáy trang; đóng hộp thì đáy trang có thêm "Xem lại kết quả" và "Chơi ván mới".

---

## GĐ17c — Hộp kết quả đúng/sai: chi tiết riêng của từng trò

**Mục tiêu**
- Khối kết quả dài riêng của từng trò (danh sách lỗi, biên bản, bảng so sánh quy trình, bảng từng biển báo, các mục "Căn cứ: …") chuyển vào "Xem chi tiết" của hộp. Đánh dấu trực quan trên bảng chơi ở lại.
- Giai đoạn bỏ được nếu H7 chọn không.

**Thiết kế** (PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.3, 2.5 và quy tắc cứng 6; H7, H8 theo đề xuất, đồng ý Đ12, trả lời ngày 30/9/2026)
- Thêm trường không bắt buộc `ChiTiet` vào `GiaoDienTroChoi` (`components/tro-choi/giao-dien.tsx`), nhận `de`, `chiTiet`, `ketQua`. Trang chơi online, offline và màn "Xem lại từng câu" đưa `ChiTiet` vào `ChiTietKetQua`. `gd.Buoc` bỏ phần chữ dài khi đã có `ChiTiet`.
- Theo bảng PROMPT mục 2.5: Kiểm tra giấy tờ, Duyệt phạt nguội (`DanhSachLoi`, biên bản); Dừng xe (bảng so sánh quy trình, điểm trừ, `DanhSachLoi`, biên bản); Cắm biển, Soi camera (thêm biên bản, Đ12), Tự lái, Chốt đêm (các mục "Căn cứ: …"); Trạm cân, Lên xe khách, Soi xe cải tạo (khối kết quả dưới bảng chơi); Cung đường biển báo (`KetQuaDuong`); Lập biên bản (chỉ "Đáp án: …" của từng ô; `KetQuaO` và dấu "ĐẠT"/"CHƯA ĐẠT" ở lại, H7). Súng bắn tốc độ không có chi tiết riêng.
- Trò thay cả bảng chơi bằng khối kết quả (Cắm biển, Soi camera, Tự lái, Chốt đêm, và Cung đường biển báo theo Đ12): sau khi chấm vùng chơi hiện phần tóm tắt trực quan; phần chữ vào `ChiTiet`. Trò nào không tách được mà không đổi luật chơi thì hỏi trước khi làm khác.

**Việc làm**
1. Trường `ChiTiet` trong `giao-dien.tsx`; nối vào `tro-choi.luot.tsx`, `tro-choi.offline.tsx`, màn "Xem lại từng câu".
2. Chuyển phần chữ của từng trò trong bảng mục 2.5 (cột GĐ = 17c) sang `ChiTiet`, mỗi trò xong thì chạy lại e2e của trò đó rồi mới sang trò sau.
3. Kiểm dung lượng mã riêng từng trò.

**File sửa**
- `apps/web/app/components/tro-choi/giao-dien.tsx`
- `apps/web/app/routes/tro-choi.luot.tsx`, `apps/web/app/routes/tro-choi.offline.tsx`: chỉ chỗ đưa `ChiTiet` vào hộp
- `apps/web/app/components/tro-choi/`: `KiemTraGiayTo.tsx`, `DuyetPhatNguoi.tsx`, `DungXe.tsx`, `CamBien.tsx`, `SoiCamera.tsx`, `TuLai.tsx`, `ChotDem.tsx`, `TramCan.tsx`, `LenXeKhach.tsx`, `SoiXeCaiTao.tsx`, `DuongChay.tsx`, `MauBienBan.tsx`, `chung/DanhSachLoi.tsx` (nếu cần)
- `scripts/e2e/` của các trò trên, `scripts/e2e/hop-ket-qua.ts`
- `docs/PLAN.md`, `docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md` (ghi câu trả lời)

**File tạo**
- Không có.

Kiểm lại tên tệp thật trước khi sửa.

**Migration**
- Không có. Không sửa API.

**Kiểm tra đã xong**
- [x] Với mỗi trò cột GĐ = 17c ở bảng mục 2.5: sau khi chấm, danh sách lỗi, biên bản, bảng so sánh không nhìn thấy trên trang; mở hộp, bấm "Xem chi tiết" thì thấy đủ, nội dung giống trước khi chuyển (so số mục lỗi, số dòng căn cứ).
  - Hàm dùng chung mới ở `scripts/e2e/hop-ket-qua.ts`: `moChiTietRieng` (khi hộp vừa mở, các vùng chi tiết của trò không có trên trang; bấm "Xem chi tiết" thì có đủ, khung chi tiết `overflow-y: auto`, nút chính của hộp trong khung 740px), `chiTietDaCham` (chấm lại câu trả lời đã ghi trong `game_run_steps` bằng `chamBuoc` của trò, đúng như máy chủ dựng màn xem lại, để có `chi_tiet` gốc), `demCanCu`, `dongHopXemBang`, `moXemLai`.
  - Từng kịch bản so số mục và số dòng "Căn cứ: …" trong chi tiết với `chi_tiet` máy chủ trả: lỗi và căn cứ (`kiem-tra-giay-to`, `duyet-phat-nguoi`: mọi người lái, mọi hồ sơ, hai màn), bước quy trình, lỗi giấy tờ, căn cứ (`dung-xe`), vị trí (`cam-bien`), vi phạm, biên bản (`soi-camera`), lỗi trong biên bản (`tu-lai`, và "Biên bản trắng" ở màn không lỗi), sáu tiêu chí (`chot-dem`), cặp số, biên bản (`tram-can`), lỗi, biên bản (`len-xe-khach`), chỗ khác giấy, biên bản (`soi-xe-cai-tao`), 12 biển (`cung-duong`), đáp án ô tiền (`lap-bien-ban`).
- [x] Bảng chơi vẫn tô đáp án sau khi đóng hộp; trò thay cả bảng chơi vẫn có phần tóm tắt trực quan.
  - `dongHopXemBang`: Esc, đánh dấu vẫn nhìn thấy, mở lại bằng "Xem lại kết quả". Đánh dấu kiểm: `[data-ket-qua]` (giấy tờ, hồ sơ, trạm cân), ô người đếm dư tô đỏ (lên xe khách), vùng đáp án trên hình (soi xe cải tạo), dải từng bước (dừng xe), bảng từng vị trí (cắm biển), điểm từng tiêu chí (chốt đêm), dải biển và "Xử lý đúng 11/12 biển" (cung đường), "Chưa đúng" trên ô tiền (lập biên bản). Soi camera, Tự lái: đóng hộp rồi tua lại trên bảng chơi như GĐ17a.
- [x] Màn "Xem lại từng câu" hiện đủ chi tiết của từng trò sau khi bấm "Xem chi tiết".
  - `moXemLai` ở cả 12 kịch bản: vùng chi tiết của câu chưa hiện khi thu gọn; mở ra có đủ, cùng số mục và số dòng căn cứ như trong hộp.
- [x] `dung-xe.ts` vẫn thấy "Căn cứ: Căn cứ đang được cập nhật" (sau khi mở chi tiết); `lap-bien-ban.ts` vẫn thấy dấu "ĐẠT"/"CHƯA ĐẠT" và chữ "Đúng" trên từng ô.
- [x] 360×740: không cuộn ngang; chi tiết dài cuộn trong hộp, nút chính vẫn trong khung nhìn.
  - `kiemKhongCuonNgang` ở các chỗ kết quả sẵn có của từng kịch bản; khung cuộn và vị trí nút chính kiểm trong `moChiTietRieng` mỗi lần mở chi tiết.
- [ ] Mã riêng mỗi trò vẫn ≤ 8 KB gzip (≤ 12 KB nếu dùng bộ mô phỏng).
  - Mỗi tệp giao diện tăng 18–244 B. Chưa đo lại tổng từng trò theo cách của giai đoạn làm trò đó; các trò đã vượt từ trước (Duyệt phạt nguội, Lên xe khách, Soi xe cải tạo, Tự lái) vẫn vượt, Soi camera có thể vừa chạm 12 KB (xem Trạng thái). Đo từng tệp giao diện riêng (`bun build --minify`, mọi import để ngoài, gzip -9), trước → sau: `KiemTraGiayTo` 2.709 → 2.727 B, `DuyetPhatNguoi` 4.290 → 4.316, `DungXe` 4.854 → 5.098, `CamBien` 4.723 → 4.875, `SoiCamera` 6.075 → 6.206, `TuLai` 5.886 → 5.985, `ChotDem` 5.166 → 5.305, `TramCan` 3.908 → 3.955, `LenXeKhach` 4.140 → 4.168, `SoiXeCaiTao` 4.020 → 4.045, `DuongChay` 4.700 → 4.816, `MauBienBan` 3.526 → 3.755, `giao-dien` 4.440 → 4.654.
- [x] Cổng chung §0.2 đạt. Test hỏng từ trước ghi rõ tên tệp ở mục Trạng thái.

**Trạng thái (30/9/2026):** đã làm xong, đạt 6/7 mục kiểm tra; mục ngân sách mã riêng chưa đạt vì nhiều trò đã vượt từ trước (giai đoạn này chỉ tăng 18–244 B mỗi tệp).
- Quyết định của người dùng: H7 theo đề xuất (có làm GĐ17c), H8 theo đề xuất, đồng ý Đ12. Đã ghi vào cột "Trả lời" của PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.8, 2.9 và sửa bảng mục 2.5 (Soi camera thêm biên bản; Cung đường biển báo giữ tóm tắt số biển).
- E2E (khung 360×740, chạy ở cổng 3390/3391 để không đụng phiên khác), mỗi trò chạy ngay sau khi sửa trò đó: `kiem-tra-giay-to`, `duyet-phat-nguoi`, `dung-xe`, `cam-bien`, `soi-camera`, `tu-lai`, `chot-dem`, `tram-can`, `len-xe-khach`, `soi-xe-cai-tao`, `cung-duong`, `lap-bien-ban` đều đạt. Sau cùng chạy lại `hop-ket-qua`, `tro-choi-khung` (có phần chơi offline), `sung-ban-toc-do`, `tro-choi-muot`: đạt.
- **`soi-xe-cai-tao` chập chờn từ trước:** lần chạy sau khi sửa đạt trọn (có kiểm chi tiết, xem lại); lần chạy lại cuối phiên hỏng ở bước đo thước của xe 1 ("Thước đo đổi 95 mm, cần 100 mm"), trước khi chốt đáp án, đúng lỗi GĐ17a đã ghi. Không do giai đoạn này.
- **Làm song song với phiên GĐ17b** (phiên đó bắt đầu sau khi phiên này đã đọc PROMPT): không sửa tệp riêng của GĐ17b (`HopKetQuaCau.tsx`, ba route Đua, Hỏi nhanh, Ghép cặp, `tro-choi.ts`, `giong-noi.ts`); phần thêm vào `scripts/e2e/hop-ket-qua.ts` là một khối riêng các hàm export. Cổng e2e riêng không tránh được việc hai phiên cùng build vào `apps/web/build`, nên một lượt kịch bản của GĐ17b đã hỏng giữa chừng (GĐ17b đã ghi). Cần soát diff của hai phiên trước khi commit.
- **Soi camera sát ngân sách:** GĐ-T5 ghi mã riêng 11,9/12 KB; `SoiCamera.tsx` tăng 131 B nên có thể vừa chạm 12 KB. Chưa đo lại tổng theo đúng cách của GĐ-T5 (cách đo đó không ghi rõ tệp nào được tính).
- Cổng chung:
  - `bun run typecheck`: 16/16 gói qua.
  - `bun test`: 1.716 đạt, 7 bỏ qua, 5 hỏng, cả 5 ở `packages/config/src/ports.test.ts` (lỗi môi trường Windows có từ trước).
  - `bun run lint`: các tệp của GĐ17c qua (đã đổi tên hàm `escape` trong `scripts/e2e/kiem-tra-giay-to.ts`, lỗi có từ trước). Còn 4 lỗi ở tệp ngoài phạm vi, có từ trước: `packages/dao-tao/src/tro-choi/tu-lai.ts` (2 lỗi `useOptionalChain`), định dạng ở `apps/api/src/auth.test.ts`, `apps/api/src/routes/mascot.ts`, `apps/web/app/lib/luyen-tap.server.ts`, `packages/dao-tao/tests/lap-bien-ban.test.ts`.
  - `bun run build:web`: qua. `bun run smoke`: 10/11 đạt, 1 bỏ qua (web SSR ở 127.0.0.1:3030; máy chủ dev của web chỉ nghe `localhost`), như GĐ17a.
- Thay đổi so với dự kiến:
  - `giao-dien.tsx` thêm `PropsChiTiet`, trường `ChiTiet` và hàm `chiTietRieng(gd, de, ketQua)` (null khi trò không khai hoặc kết quả không có `chi_tiet`); ba chỗ dùng: hộp ở `tro-choi.luot.tsx`, hộp ở `tro-choi.offline.tsx`, màn "Xem lại từng câu".
  - Màn "Xem lại từng câu" dựng `DongDiem` + `ChiTietKetQua` thay cho `PhanHoiBuoc` (cùng nội dung, thêm chi tiết riêng), để không phải sửa `PhanHoiBuoc.tsx` ngoài danh sách tệp.
  - `CamBien`, `SoiCamera` có thêm prop không bắt buộc `chiTietTrongHop`, chỉ `giao-dien.tsx` bật: trang chạy thử trong quản trị (`SoanDoanDuong`, `SoanKichBanXe`) không có hộp kết quả nên vẫn hiện đủ phần chữ như cũ, không phải sửa hai tệp đó.
  - Tự lái: danh sách lỗi gọn (số, tên lỗi, điểm trừ, nút "Xem lại lúc …") ở lại bảng chơi, vì nút tua lại phải điều khiển bản đồ ngay bên dưới; biên bản đầy đủ (chi tiết, "Đúng ra", mức phạt, căn cứ) vào chi tiết, không có nút tua. Dòng trạng thái "Tới đích … n lỗi, trừ … điểm" ở lại bảng chơi.
  - Chốt đêm: bảng chơi giữ điểm từng tiêu chí (có dấu tích/chéo) và ảnh bố trí lúc xe đầu tiên phanh gấp; đo được, ngưỡng, căn cứ và kết quả chạy vào chi tiết.
  - Dừng xe: bảng chơi thay bằng cảnh lúc kết thúc, dòng "Quy trình: x/y bước đúng" và dải từng bước có dấu (chữ đọc được cho trình đọc màn hình).
  - Cắm biển: bảng từng vị trí (biển đã cắm, biển đúng, điểm) ở lại bảng chơi; lý do, căn cứ, tình huống, số lần chạy vào chi tiết.
  - Soi camera: mỗi vi phạm giữ khung hình tua lại được, "Đã bắt/Bỏ sót", điểm; mô tả, cách chấm, căn cứ, khoanh nhầm, biên bản vào chi tiết (Đ12).
  - Các trò đổi lời trong màn hướng dẫn ("Màn kết quả so từng bước…" của Dừng xe, "Tới đích thì có biên bản…" của Tự lái, "Ngưỡng hiện ở màn kết quả…" của Chốt đêm) cho khớp chỗ mới.
  - Lý do không hợp lệ (`hop_le = false`) của Cắm biển, Soi camera, Chốt đêm, Cung đường chuyển vào chi tiết cùng phần chữ; Tự lái giữ ở dòng trạng thái.
  - Kịch bản e2e `cam-bien`, `chot-dem`, `dung-xe`, `soi-camera`, `tu-lai` (GĐ17a không phải sửa) nay mở chi tiết để đọc nội dung đã chuyển. `lap-bien-ban.ts` nhập hàm của `hop-ket-qua.ts` (hai tệp nhập lẫn nhau, chỉ dùng trong hàm nên không lỗi).
- Quy tắc nghiệp vụ đã chốt:
  - **Chỗ nào ở lại bảng chơi:** mọi đánh dấu trực quan (tô chỗ sai, chỗ đúng, "Đáp án đúng", con dấu, "Đúng/Chưa đúng" từng ô, số điểm từng phần) và mọi nút thao tác trên bảng chơi (tua lại, xem khung đã khoanh). Chữ giải thích, căn cứ, biên bản, bảng so sánh vào "Xem chi tiết".
  - **Trò thay cả bảng chơi** (Dừng xe, Cắm biển, Soi camera, Tự lái, Chốt đêm, Cung đường): sau khi chấm vùng chơi luôn còn một phần tóm tắt nhìn được (dải từng bước, bảng vị trí, khung hình, bản đồ, điểm tiêu chí, dải biển).
  - **Thứ tự trong chi tiết:** giải thích, căn cứ pháp lý (GĐ17a), rồi chi tiết riêng của trò. Nội dung chi tiết riêng giữ nguyên chữ như trước khi chuyển; chỉ thêm tiêu đề vùng khi trước đó không có ("Lý do từng vị trí", "Từng vi phạm", "Sáu tiêu chí", "Từng biển trên đường", "Đáp án các ô chưa đúng").
  - **Lập biên bản:** chi tiết chỉ liệt kê đáp án của ô chưa đúng, theo thứ tự ô trên mẫu; ô bổ sung chỉ có dòng đáp án khi đáp án là "không có mục nào" (các mục cần chọn đã tô "Cần chọn" trên mẫu).
  - **Câu khởi động của Cung đường** không có chi tiết riêng (chỉ tô phương án trên bảng chơi).

---

# CÁC GIAI ĐOẠN TRÒ CHƠI

*Thêm ngày 25/9/2026, lập lại ngày 27/9/2026 cho danh sách 10 trò mới ở [PRD.md](PRD.md) mục V. Thiết kế chi tiết, quy tắc chung khi làm trò chơi và các điểm chờ quyết định ở [GAME_DESIGN.md](GAME_DESIGN.md); kế hoạch dưới đây làm theo các đề xuất ở GAME_DESIGN §8.*

- GĐ-G0 (nền dùng chung) đã xong và giữ nguyên.
- Các giai đoạn GĐ-G1 đến GĐ-G10 của danh sách cũ **dừng**, chuyển sang [luu-tru/PLAN_TRO_CHOI_CU.md](luu-tru/PLAN_TRO_CHOI_CU.md) cùng trạng thái lúc dừng (G2 Súng bắn tốc độ và G8 Cung đường biển báo đã xong phần mã; G3 Lập biên bản đang dở). **G6 Mùa giải đơn vị: [x] xong phần mã ngày 27/9/2026 và được giữ lại** (tab "Mùa giải" ở `/bang-xep-hang`, quản trị `/quan-tri/mua-giai`); câu D2 còn chờ chốt có chạy song song với trò 7 không.
- Các trò mới đánh số **GĐ-T1 đến GĐ-T10**, làm đúng thứ tự 1 → 10. Mọi giai đoạn theo GAME_DESIGN §1 "Quy tắc chung khi làm trò chơi".
- **GĐ-T11 đến GĐ-T20** (thêm ngày 28/9/2026) cho 10 trò bổ sung ở PRD mục V.5. Mỗi trò làm trong một phiên riêng theo prompt ở [PROMPT_TRO_CHOI_MOI.md](PROMPT_TRO_CHOI_MOI.md) mục 3. Trả lời các câu D15 đến D32 ở GAME_DESIGN §8 trước khi làm.

---

## GĐ-G0 — Nền dùng chung cho trò chơi

*Các số mục "GAME_DESIGN §…" trong giai đoạn này trỏ tới bản thiết kế cũ, nay ở [luu-tru/GAME_DESIGN_cu.md](luu-tru/GAME_DESIGN_cu.md).*

**Mục tiêu**
- Có **bộ máy lượt chơi chung**: một trò mới chỉ cần viết phần riêng (sinh lượt, dựng đề, chấm bước) và một trang giao diện.
- **Nội dung trò chơi đi qua cùng quy trình duyệt với câu hỏi**; trò chơi chỉ rút được nội dung đã duyệt, kể cả gián tiếp.
- Mức phạt, biển báo, quy trình được **duyệt trong ứng dụng**, không còn duyệt bằng cách sửa JSON.
- Có **hồ sơ điểm mạnh/yếu theo chủ đề**.
- Đồng bộ offline dùng được cho mọi trò có cờ offline.
- Chưa thêm trò mới nào cho người chơi.

**Thiết kế** (GAME_DESIGN §2, §3, §4.2)
- `DinhNghiaTroChoi` trong `packages/dao-tao/src/tro-choi/khung.ts`; bảng mã → định nghĩa ở `dang-ky.ts`, import được ở máy chủ và trình duyệt.
- Lượt chơi lưu ở `game_runs` / `game_run_steps`, ảnh chụp các bước kèm đáp án trong `game_runs.items`, chấm trên máy chủ.
- Tính giờ theo bước hoặc cả lượt; trả lời quá hạn + 2 giây được 0 điểm, không trả 409.
- XP qua `congXp`, nguồn `game:<mã>`, khóa theo id lượt; giảm dần khi chơi lặp trong ngày (`xp.ts`).
- `noiDungDungDuoc(game, bộ lọc)` là lối rút nội dung trò chơi duy nhất: chỉ nhận `game_content` đã duyệt mà mọi mục trong `refs` đang `da_duyet` và cùng phiên bản đã ghi.
- Vòng đời duyệt tách từ `cau-hoi.ts` ra `vong-doi-duyet.ts`, dùng cho câu hỏi và mọi loại nội dung khác.
- 5 trò cũ **giữ nguyên** trên `practice_sessions`. Đua thời gian, ghép cặp ẩn khỏi trang Trò chơi (route còn); vượt màn chuyển sang trang Luyện tập (GAME_DESIGN §7 Q2).
- Một **trò mẫu** `thu_nghiem` (3 câu hỏi ngân hàng, giờ từng bước) chỉ đăng ký khi `NODE_ENV=test`, để test toàn bộ khung khi chưa có trò thật.

**Việc làm**
1. **Logic thuần** (`packages/dao-tao`):
   - `khung.ts`: kiểu định nghĩa trò, vòng đời lượt, kiểm hạn bước, thưởng nhanh, tổng kết (tỷ lệ, sao);
   - `vong-doi-duyet.ts`: chuyển trạng thái, hệ quả khi sửa; `cau-hoi.ts` gọi lại, không đổi hành vi;
   - `tham-chieu.ts`: so `refs` với trạng thái và phiên bản hiện tại, trả lý do "cần xem lại";
   - `ho-so-chu-de.ts`: cập nhật `score_ema`, chọn chủ đề mạnh/yếu (tối thiểu 5 lượt, gộp lên chủ đề cha);
   - `tro-choi/xp.ts`: XP theo tỷ lệ điểm và bậc giảm dần theo số lượt trong ngày.
2. **Dữ liệu** (`packages/db`):
   - `luot-choi.ts`: tạo lượt, mở bước, ghi bước (chấm trong giao dịch, cập nhật `wrong_questions` khi bước là câu hỏi), kết thúc (XP, hồ sơ chủ đề, huy hiệu), đồng bộ offline, dọn lượt bỏ dở quá 24 giờ;
   - `noi-dung-tro-choi.ts`: CRUD `game_content`, gửi duyệt, duyệt (ghi `refs` kèm phiên bản), từ chối, lưu trữ, duyệt hàng loạt, danh sách "cần xem lại";
   - `du-lieu-tra-cuu.ts`: vòng đời duyệt cho `violations`, `traffic_signs`, `procedures`, ghi `content_reviews`;
   - `ho-so-chu-de.ts`: `ghiKetQuaChuDe(tx, …)`, đọc hồ sơ, script tính lại từ `practice_answers`, `exam_answers`, `game_run_steps`;
   - `congXp` nhận và ghi `unit_id`.
3. **Nạp dữ liệu tra cứu theo quy trình mới:** `scripts/tra-cuu-nhanh.ts`, `scripts/bien-bao.ts` đưa dòng mới hoặc dòng đổi nội dung vào `cho_duyet`, bỏ qua `trang_thai` trong tệp (trừ khi có `--chap-nhan-trang-thai`, chỉ cho CSDL phát triển).
4. **API:**
   - `/v1/luot-choi/*` theo bảng GAME_DESIGN §2.9;
   - `/v1/quan-tri/noi-dung-tro-choi/*`: danh sách có lọc (trò, trạng thái, chủ đề, cần xem lại), tạo, sửa, gửi duyệt, duyệt, từ chối, duyệt hàng loạt, xem trước;
   - `/v1/quan-tri/du-lieu-tra-cuu/:loai/*` với `loai` là `muc-phat`, `bien-bao`, `quy-trinh`;
   - `GET /v1/toi/ho-so-chu-de`.
   - Quyền: `bien_tap` soạn; vai trò duyệt đọc từ `NGAN_HANG_VAI_TRO_DUYET`.
5. **Luyện tập và thi ghi hồ sơ chủ đề:** `packages/db/src/luyen-tap.ts` (khi chấm), `de-thi.ts` (khi nộp) gọi `ghiKetQuaChuDe` trong cùng giao dịch.
6. **Web:**
   - quản trị `/quan-tri/noi-dung-tro-choi` (bảng lọc, tab Chờ duyệt, tab Cần xem lại, nút Chơi thử) và `/quan-tri/du-lieu-tra-cuu` (3 tab Mức phạt · Biển báo · Quy trình, sửa từng dòng, duyệt, lịch sử);
   - form soạn nội dung trò chơi nhận một component soạn riêng theo trò (đăng ký ở `components/quan-tri/tro-choi/index.ts`); G0 chỉ có trình soạn JSON có kiểm lỗi làm mặc định;
   - component chung `DongHoBuoc`, `PhanHoiBuoc`, `TongKetLuot`, hook `useLuotChoi`;
   - route client `/tro-choi/offline`: danh sách gói đã tải, chơi trò offline bất kỳ qua `dang-ky.ts`;
   - `/toi`: khối "Điểm mạnh, điểm yếu";
   - trang `/tro-choi` lấy danh sách từ `games` (chỉ trò `enabled`).
7. **Offline:** kho IndexedDB thêm `goi_tro_choi`, `luot_choi`; `dong-bo.ts` gửi thêm lượt chơi; cầu nối `api.$.tsx` cho phép `GET luot-choi/goi-offline/:ma`, `POST luot-choi/dong-bo`; `sw.js` giữ trang `/tro-choi/offline` và thư mục `/tro-choi/` của `public`.
8. **Căn cứ:** `scripts/check-citations.ts` kiểm URN của `game_content` đã duyệt.

**File sửa**
- `packages/dao-tao/src/cau-hoi.ts`, `packages/dao-tao/src/index.ts`, `packages/dao-tao/src/tro-choi/xp.ts`, `packages/dao-tao/src/diem-thuong.ts` (chỉ số huy hiệu theo trò)
- `packages/db/src/diem-thuong.ts` (`congXp` ghi `unit_id`), `luyen-tap.ts`, `de-thi.ts`, `tra-cuu-nhanh.ts`, `bien-bao.ts`, `index.ts`
- `scripts/tra-cuu-nhanh.ts`, `scripts/bien-bao.ts`, `scripts/check-citations.ts`
- `apps/api/src/app.ts`, `apps/api/src/routes/toi.ts`, `apps/api/src/routes/tro-choi.ts` (danh sách trò đọc từ `games`)
- `apps/web/app/routes.ts`, `routes/tro-choi._index.tsx`, `routes/luyen-tap._index.tsx` (thẻ Vượt màn), `routes/toi.tsx`, `routes/quan-tri.tsx` (menu), `routes/api.$.tsx`
- `apps/web/app/lib/offline/kho.ts`, `lib/offline/dong-bo.ts`, `apps/web/public/sw.js`
- `content/huong-dan/muc-luc.json`
- `package.json`: script `ho-so-chu-de:tinh-lai`

**File tạo**
- `packages/dao-tao/src/tro-choi/khung.ts`, `tro-choi/dang-ky.ts`, `tro-choi/thu-nghiem.ts`
- `packages/dao-tao/src/vong-doi-duyet.ts`, `tham-chieu.ts`, `ho-so-chu-de.ts`
- `packages/dao-tao/tests/khung-tro-choi.test.ts`, `vong-doi-duyet.test.ts`, `tham-chieu.test.ts`, `ho-so-chu-de.test.ts`
- `packages/db/src/luot-choi.ts`, `noi-dung-tro-choi.ts`, `du-lieu-tra-cuu.ts`, `ho-so-chu-de.ts`
- `apps/api/src/routes/luot-choi.ts`, `routes/noi-dung-tro-choi.ts`, `routes/du-lieu-tra-cuu.ts`
- `apps/api/src/luot-choi.test.ts`, `noi-dung-tro-choi.test.ts`, `du-lieu-tra-cuu.test.ts`
- `apps/web/app/routes/quan-tri.noi-dung-tro-choi.tsx`, `quan-tri.noi-dung-tro-choi.sua.tsx`, `quan-tri.du-lieu-tra-cuu.tsx`, `tro-choi.offline.tsx`
- `apps/web/app/components/tro-choi/DongHoBuoc.tsx`, `PhanHoiBuoc.tsx`, `TongKetLuot.tsx`, `HoSoChuDe.tsx`, `useLuotChoi.ts`
- `apps/web/app/components/quan-tri/tro-choi/index.ts`, `SuaJson.tsx`
- `apps/web/app/lib/luot-choi.ts`, `lib/luot-choi.server.ts`
- `scripts/ho-so-chu-de.ts`
- `scripts/e2e/tro-choi-khung.ts`

**Migration**
- `0027_tro_choi_nen.sql`:
  - `games(code PK, name, offline_ok, enabled, ordinal, config jsonb)`; chèn 5 trò cũ (tắt `dua_thoi_gian`, `ghep_cap` trên trang Trò chơi) và `thu_nghiem` (`enabled = false`)
  - `game_content`, `content_reviews`, `game_runs`, `game_run_steps`, `game_packs`, `topic_stats` theo GAME_DESIGN §4.2
  - `violations`, `traffic_signs`, `procedures`: thêm `version int DEFAULT 1`, `approved_by`, `approved_at`, `reject_reason`, `topic_id`; nới CHECK `status` gồm `cho_duyet`, `tu_choi` (giữ `nhap`, `da_duyet`, `ngung`)
  - dòng đang `da_duyet` giữ nguyên trạng thái, `approved_by = 'nap-du-lieu'`, ghi một dòng `content_reviews` cho mỗi dòng
  - `xp_ledger` thêm `unit_id`; điền cho dòng cũ bằng đơn vị hiện tại của tài khoản
  - index: `game_content(game_code, status, topic_id, level)`, `game_runs(account_id, game_code, started_at DESC)`, `game_runs(game_code, finished_at) WHERE status = 'xong'`, `game_runs(client_id)` UNIQUE một phần, `xp_ledger(unit_id, day)`

**Kiểm tra đã xong**
- [x] Unit test khung (`khung-tro-choi.test.ts`), dùng tham số `now`:
  - trả lời bước sau hạn + 2 giây được 0 điểm, lượt vẫn đi tiếp; trong dung sai vẫn được điểm;
  - thưởng nhanh giảm tuyến tính, không vượt 50% điểm bước, bằng 0 với lượt offline;
  - sao: 49% → 0 sao, 50% → 1, 70% → 2, 90% → 3;
  - XP lượt 1–3 trong ngày đủ, lượt 4–6 một nửa, lượt 7 bằng 0; qua 0h giờ Việt Nam thì đếm lại.
  - Hệ số XP kiểm ở unit test. Việc đếm lại khi sang ngày mới kiểm ở `luot-choi.test.ts`, vì số lượt trong ngày do CSDL đếm theo `played_at` giờ Việt Nam.
  - Cộng thêm: trò mẫu sinh lượt tất định theo seed, không phụ thuộc thứ tự nguồn (máy chủ sinh lại được lượt offline); đề không lộ đáp án; câu trả lời sai dạng bị từ chối.
- [x] Unit test vòng đời: mọi ca của `cau-hoi.test.ts` về duyệt vẫn đạt sau khi tách `vong-doi-duyet.ts`; sửa nội dung đã duyệt thì về `cho_duyet` và tăng `version`.
  - `packages/dao-tao/tests/vong-doi-duyet.test.ts`. Tên cũ `chuyenTrangThaiCauHoi`, `hauQuaSua` trỏ đúng hàm chung.
- [x] Unit test tham chiếu: tình huống trỏ tới mức phạt `version 3` bị loại khi mức phạt lên `version 4` hoặc về `cho_duyet`, kèm lý do đọc được.
  - Cùng tệp. Ca kiểm dùng phiên bản 2 → 3, luật giống nhau. Ví dụ lý do: "Mức phạt oto-toc-do-5-10 đã được sửa (phiên bản 2 thành 3), cần duyệt lại tình huống."
- [x] API test trò mẫu `thu_nghiem` (`luot-choi.test.ts`), luồng đủ: bắt đầu → GET lượt không có khóa cấm (`answer`, `dap_an`, `giai_thich`, `can_cu`) → trả lời 3 bước → kết thúc hai lần → đúng **một** dòng `xp_ledger`, có `unit_id` → `topic_stats` tăng đúng số lượt.
  - Người B đọc hoặc trả lời lượt của A nhận 403; trả lời một bước hai lần nhận 409.
  - Cộng thêm:
    - máy khách gửi kèm `diem: 999`, `dung: true` thì bị bỏ qua;
    - nhảy cóc bước nhận 409;
    - tải lại trang không làm đồng hồ bước chạy lại;
    - 5 lượt liên tiếp được XP `[10, 10, 10, 5]`, rồi sang ngày mới thì lượt kế tiếp được 10.
- [x] API test duyệt (`noi-dung-tro-choi.test.ts`):
  - `bien_tap` tạo, gửi duyệt được, duyệt nhận 403; `phap_che` duyệt được;
  - tình huống `cho_duyet` không bao giờ xuất hiện trong lượt chơi;
  - đưa mức phạt được trỏ tới về `cho_duyet` thì tình huống rời khỏi `noiDungDungDuoc` và hiện ở "Cần xem lại"; duyệt lại cả hai thì quay lại.
  - Cộng thêm: tình huống trỏ tới mức phạt còn là bản nháp thì không duyệt được (409); gửi phiên bản cũ khi sửa nhận 409.
- [x] API test dữ liệu tra cứu (`du-lieu-tra-cuu.test.ts`): sửa một mức phạt đã duyệt thì về `cho_duyet`, tra cứu nhanh (GĐ5) không còn trả dòng đó, `content_reviews` có lịch sử. Chạy `bun run tra-cuu:nap` lần hai không đổi trạng thái dòng không đổi nội dung.
  - Các ca này nằm trong `noi-dung-tro-choi.test.ts` (khối "dữ liệu tra cứu"), không tách tệp riêng.
  - Có thêm: nạp dòng đã duyệt mà đổi mức tiền thì dòng về `cho_duyet`, phiên bản lên 2; từ chối bắt buộc có lý do; lưu trữ chuyển sang `ngung`.
- [x] API test offline: đồng bộ một lượt `thu_nghiem` offline hai lần chỉ sinh một `game_runs`; lượt dùng câu **không** có trong gói đã cấp bị từ chối; máy chủ chấm lại, bỏ qua `dung` do máy gửi.
  - Máy khách không gửi nội dung hay kết quả chấm: máy chủ sinh lại lượt từ gói và seed. Vì vậy lượt không thể trỏ tới câu ngoài gói. Test kiểm các đường còn lại:
    - dùng gói của người khác thì bị bỏ qua;
    - `client_id` đã thuộc người khác thì bị bỏ qua;
    - chơi trước khi tải gói hoặc sau khi gói hết hạn thì bị bỏ qua;
    - gửi phần đầu rồi phần sau thì không trùng bước, XP cộng một lần;
    - chơi quá 7 ngày mới gửi thì không có XP;
    - câu bị gỡ duyệt sau khi tải gói thì bước đó 0 điểm.
- [x] `bun run e2e tro-choi-khung`: tải gói trò mẫu → `setOffline(true)` → chơi hết lượt ở `/tro-choi/offline` → `setOffline(false)` → máy chủ có đúng 1 lượt, 3 bước. Khung 360×740, không cuộn ngang.
  - Kịch bản đạt (6,1 giây). Có thêm:
    - lượt online từ trang chủ bằng một chạm "Chơi ngay", xem lại từng câu, đúng một dòng XP;
    - gửi lại lần hai không sinh bản trùng, không cộng XP lần hai.
- [x] Trang `/toi` hiện khối điểm mạnh/yếu khi có ≥ 5 lượt trả lời ở một chủ đề; không hiện khi chưa đủ.
  - Khi chưa đủ lượt, khối vẫn hiện nhưng ghi "Chưa đủ dữ liệu…", không để trống.
  - E2E kiểm chủ đề đủ 6 lượt hiện ở "Cần luyện thêm" với 30%. Ngưỡng 5 lượt kiểm ở unit test.
- [x] Các test cũ của GĐ3, GĐ4, GĐ5, GĐ9, GĐ10, GĐ12, GĐ13 vẫn đạt. Test quét khóa `answer` mở rộng sang `/v1/luot-choi/*`.
  - `bun test`: 1046 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, lỗi môi trường Windows có từ trước.
  - E2E `offline` và `tro-choi` của GĐ13, GĐ10 vẫn đạt sau khi kho IndexedDB lên phiên bản 2.
  - Test quét khóa cấm của `luot-choi.test.ts` kiểm `answer`, `dap_an`, `giai_thich`, `can_cu`, `explanation`, `noi_dung` trên phản hồi trước khi chấm.

**Trạng thái (25/9/2026):** đã làm xong, đạt 10/10 mục kiểm tra.
- Cổng chung:
  - `bun run typecheck` qua mọi gói.
  - `bun run build:web` qua.
  - `bun test`: 1046 đạt, 5 hỏng (như trên).
  - Biome: các tệp của GĐ-G0 qua. Còn lỗi định dạng CRLF ở 5 tệp cũ không sửa trong giai đoạn này: `auth.test.ts`, `mascot.ts`, `SiteHeader.tsx`, `luyen-tap.server.ts`, `sach-noi.ts`.
  - `bun run e2e tro-choi-khung offline tro-choi`: 3/3 đạt.
  - Migration `0027` áp dụng sạch trên CSDL test.
  - Chưa chạy `bun run smoke`.
- Trò mẫu:
  - `thu_nghiem` "Trắc nghiệm nhanh": 3 câu một đáp án hoặc đúng/sai lấy từ ngân hàng đã duyệt, 20 giây mỗi câu, có thưởng nhanh, chơi được offline.
  - Trò này **đang bật** (`games.enabled = true`) để demo khung. Tắt ở `/quan-tri/noi-dung-tro-choi`, mục "Trò chơi hiện cho người học" (chỉ `quan_tri`).
- Thay đổi so với dự kiến:
  - Trò mẫu bật cho mọi môi trường, không chỉ khi `NODE_ENV=test`, vì cần chứng minh khung chạy trọn vòng trên giao diện.
  - Test dữ liệu tra cứu gộp vào `noi-dung-tro-choi.test.ts`.
  - Thêm `tham-chieu.ts` (luật tham chiếu) và `du-lieu-tra-cuu.ts` (tầng CSDL duyệt dữ liệu tra cứu). Không tạo `SuaJson.tsx` và `components/quan-tri/tro-choi/index.ts`: form soạn JSON nằm thẳng trong `quan-tri.noi-dung-tro-choi.sua.tsx`, trình soạn riêng của từng trò thêm từ GĐ-G1.
  - Không có `scripts/ho-so-chu-de.ts` và script `ho-so-chu-de:tinh-lai`: hàm `tinhLaiHoSoChuDe()` đã có ở `packages/db/src/ho-so-chu-de.ts`, chưa nối vào script.
  - Chưa sửa `scripts/check-citations.ts` để kiểm URN của `game_content`: chưa có nội dung trò chơi nào đã duyệt. Làm cùng trò đầu tiên dùng `game_content` (GĐ-G3).
  - Giao diện riêng của từng trò đăng ký ở `components/tro-choi/giao-dien.tsx`; trang chơi online và offline dùng chung.
  - Đồng hồ từng bước chạy từ lúc máy chủ gửi đề. Phản hồi của bước trước không kèm đề bước sau: bước sau chỉ mở khi bấm "Câu tiếp" (trang không tải lại loader sau khi trả lời).
  - Lượt đang chơi quá 24 giờ chuyển sang "bỏ dở" khi người đó mở danh sách trò chơi; không dùng worker.
  - Service worker lên `qdpl-v2` để giữ thêm trang `/tro-choi/offline`.
- Quy tắc nghiệp vụ đã chốt:
  - **Nạp dữ liệu:** `bun run tra-cuu:nap` và `bun run bien-bao:nap` mặc định đưa dòng mới hoặc đổi nội dung vào `cho_duyet`; dòng không đổi giữ trạng thái. `--chap-nhan-trang-thai` giữ cách cũ, chỉ dùng cho CSDL phát triển.
    - Dòng đang `da_duyet` trước GĐ-G0 giữ nguyên, người duyệt ghi là `nap-du-lieu`.
  - **XP:** lượt đạt 100% được 10 XP, nhân hệ số theo thứ tự lượt trong ngày; thưởng nhanh không vào XP, không vào sao.
    - `xp_ledger.unit_id` ghi đơn vị lúc nhận XP, cho mọi nguồn XP, không chỉ trò chơi.
  - **Offline:**
    - gói hết hạn sau 14 ngày;
    - máy chủ nhận lượt bắt đầu trong khoảng [lúc tải gói − 5 phút, hạn gói];
    - chơi quá 7 ngày mới gửi thì lưu kết quả, không có XP;
    - câu bị gỡ duyệt sau khi tải gói thì bước đó 0 điểm.
  - **Hồ sơ chủ đề:** mạnh khi `score_ema` ≥ 0,7, yếu khi dưới 0,7. Luyện tập (GĐ4) và nộp bài thi (GĐ6) nay cũng cập nhật hồ sơ, cùng giao dịch với việc chấm.
  - **Trang Trò chơi:** đua thời gian và ghép cặp ẩn theo PRD §V.4 (bật lại được trong quản trị). Vượt màn vẫn ở trang Trò chơi, chưa chuyển sang trang Luyện tập.
  - **Trang Trò chơi dạng lưới ứng dụng (30/9/2026, theo yêu cầu của người dùng):**
    - mỗi trò là một biểu tượng (ảnh ở `app/assets/tro-choi/`, như carousel trang chủ); lưới 3 cột ở 360px, 4 cột từ 420px, 5–6 cột trên màn hình rộng;
    - chạm biểu tượng mở ngăn chi tiết bằng `HopThoai` (tấm trượt từ đáy trên điện thoại, hộp giữa màn hình từ 768px): mô tả, số liệu của tôi, nút "Chơi" hoặc danh sách màn; Vượt màn có danh sách chủ đề; trò cũ có trang riêng thì có nút "Mở trò chơi";
    - ngăn đi theo tham số `?tro=<mã>`: nút Quay lại đóng ngăn, trang chủ dẫn thẳng tới ngăn; neo cũ `#tro-choi-<mã>`, `#vuot-man` được đổi sang tham số; mở, đóng ngăn không tải lại dữ liệu (`shouldRevalidate`);
    - loader và action không đổi. 17 kịch bản E2E vào trò từ trang này được sửa theo cách chạm biểu tượng rồi bấm trong ngăn.

---

## Mục kiểm tra chung cho mọi giai đoạn GĐ-T

Mỗi giai đoạn GĐ-T1 đến GĐ-T20 có mục "Kiểm tra đã xong" riêng, **cộng thêm** 8 mục chung sau (GAME_DESIGN §1.8). Các mục chung được chép vào cuối danh sách kiểm tra của từng giai đoạn để đánh dấu riêng.

- Test chấm điểm: unit test hàm chấm (ca biên, ca gian lận) và API test luồng lượt chơi đạt.
- API test bảo mật: máy khách gửi kèm điểm, cờ đúng/sai thì bị bỏ qua; người B đọc hoặc ghi lượt của A nhận 403; phản hồi trước khi chấm không có khóa cấm; test phân quyền GĐ0 (`phan-quyen.test.ts`) vẫn đạt.
- Cổng chung §0.2 qua (`typecheck`, `bun test`, `build:web`; lint các tệp của giai đoạn) và test của mọi trò đã xong trước đó vẫn đạt.
- Chơi thử một lượt đầy đủ ở 360×740, cả chế độ thường và giảm chuyển động; màn hướng dẫn và màn kết quả có căn cứ hiện đúng.
- Hiệu năng theo VISUAL_STYLE §6 trên Chrome giả lập CPU chậm 4×; mã riêng của trò trong ngân sách.
- Dữ liệu mẫu đánh dấu "demo, chưa duyệt"; bảng "Cần đơn vị chuyên môn kiểm tra" và "Hình cần bổ sung" của trò ở GAME_DESIGN §5 được cập nhật theo thực tế.
- DEMO.md có dòng màn hình và cách chơi thử của trò.
- Có bản tóm tắt thay đổi để người dùng commit.

Mục **"Đủ nội dung đã duyệt"** cần biên tập viên và người duyệt; phần mã xong mà thiếu nội dung thì trò vẫn tắt (`games.enabled = false`), giai đoạn ghi "đã làm xong phần mã".

---

## GĐ-T1 — Kiểm tra giấy tờ

**Mục tiêu**
- Người chơi soi giấy tờ của từng người lái, đánh dấu chỗ không khớp, đóng dấu cho qua hoặc giữ lại.
- Tạo các mô-đun dùng chung đầu tiên: M1 (giấy tờ), M2 phần chạm và đóng dấu, M3 (hướng dẫn, kết quả có căn cứ), M4 (biên bản cuối lượt), M8 (màn chơi).

**Thiết kế** (GAME_DESIGN §5.1, §4)
- Người lái và giấy tờ sinh từ seed; đáp án suy ra từ `document_rules` đã duyệt. Tổ hợp thiếu luật đã duyệt thì không sinh.
- 5 màn; giờ cả ca theo màn. Điểm: quyết định đúng +10, lý do đúng +5 mỗi chỗ, giữ nhầm −10, đánh dấu nhầm −2, không âm.
- M4 tách phần tra hành vi, khung tiền, hình thức bổ sung từ `lap-bien-ban.ts`; `lap-bien-ban.ts` gọi lại M4, không đổi hành vi.
- Giấy tờ giản lược, có chữ "MẪU TRÒ CHƠI".

**Việc làm**
1. Tra kho văn bản: danh mục giấy tờ phải mang theo, hạng giấy phép lái xe theo loại xe, bảo hiểm bắt buộc. Ghi URN tìm được và phần chưa có vào bảng cần kiểm ở GAME_DESIGN §5.1.
2. Soạn `data/tro-choi/luat-giay-to.json` (demo, chưa duyệt), nạp vào `document_rules` ở `cho_duyet`; tab "Luật giấy tờ" ở `/quan-tri/du-lieu-tra-cuu`.
3. Logic thuần: M1 `chung/giay-to.ts` (sinh giấy tờ có lỗi cố ý, kiểm theo luật), M4 `chung/bien-ban.ts`, M8 `chung/man-choi.ts`, trò `kiem-tra-giay-to.ts`.
4. Dữ liệu: `packages/db/src/man-choi.ts` (`game_levels`), nguồn nội dung của trò trong `nguon-tro-choi.ts` (một dòng).
5. Web: `GiayTo.tsx` (thẻ phóng to), M2 phần chạm và đóng dấu, `HuongDan.tsx`, `DanhSachLoi.tsx`, `BienBan.tsx`, `ChonMan.tsx`, giao diện trò đăng ký ở `giao-dien.tsx`.
6. Tắt các trò cũ theo GAME_DESIGN §8 câu D1 (một migration cập nhật `games.enabled`), sau khi người dùng xác nhận.

**File sửa**
- `packages/dao-tao/src/tro-choi/dang-ky.ts` (một dòng), `packages/dao-tao/src/tro-choi/lap-bien-ban.ts` (gọi M4), `packages/dao-tao/src/index.ts`
- `packages/db/src/nguon-tro-choi.ts` (một dòng), `packages/db/src/du-lieu-tra-cuu.ts` (loại `luat-giay-to`), `packages/db/src/index.ts`
- `apps/api/src/routes/du-lieu-tra-cuu.ts`
- `apps/web/app/components/tro-choi/giao-dien.tsx` (một dòng), `apps/web/app/routes/quan-tri.du-lieu-tra-cuu.tsx` (tab mới)
- `scripts/tra-cuu-nhanh.ts` (nạp luật giấy tờ), `scripts/check-citations.ts`

**File tạo**
- `packages/dao-tao/src/tro-choi/chung/giay-to.ts`, `chung/bien-ban.ts`, `chung/man-choi.ts`, `tro-choi/kiem-tra-giay-to.ts`
- `packages/dao-tao/tests/giay-to.test.ts`, `bien-ban.test.ts`, `man-choi.test.ts`, `kiem-tra-giay-to.test.ts`
- `packages/db/src/man-choi.ts`
- `apps/api/src/kiem-tra-giay-to.test.ts`
- `apps/web/app/components/tro-choi/chung/GiayTo.tsx`, `HuongDan.tsx`, `DanhSachLoi.tsx`, `BienBan.tsx`, `ChonMan.tsx`, `tuong-tac/DongDau.tsx`
- `apps/web/app/components/tro-choi/KiemTraGiayTo.tsx`
- `data/tro-choi/luat-giay-to.json`
- `scripts/e2e/kiem-tra-giay-to.ts`

**Migration**
- `0036_kiem_tra_giay_to.sql`: `document_rules` (cột vòng đời duyệt như `violations`, `topic_id`, `citation_urn`, hiệu lực); `game_level_progress(account_id, game_code, level, best_stars, best_score, plays, cleared_at, PK)`; `game_runs.level`; `content_reviews.kind` nhận `document_rule`; `INSERT INTO games`: `kiem_tra_giay_to`, `offline_ok = true`, `enabled = false`. 5 màn khai trong mã (`MAN_KIEM_TRA_GIAY_TO`), không trong `games.config`.

**Kiểm tra đã xong**
- [x] Unit test M1: cùng seed cùng người lái và giấy tờ; mỗi lỗi cố ý được bộ kiểm phát hiện; giấy tờ hợp lệ không bị báo lỗi; luật chưa duyệt thì không sinh tổ hợp đó.
  - `packages/dao-tao/tests/giay-to.test.ts`, 15 ca. Hàm sinh thử cả 10 lỗi, dạng thường và tinh vi, mỗi dạng 5 lần. Thiếu luật cho lỗi yêu cầu thì hàm sinh báo lỗi rõ, không sinh bừa.
- [x] Unit test chấm: giữ đúng kèm lý do đúng được đủ điểm; ~~giữ nhầm −10~~; đánh dấu nhầm −2; điểm ca không âm; hết giờ thì người lái còn lại tính chưa kiểm.
  - `packages/dao-tao/tests/kiem-tra-giay-to.test.ts`, 12 ca, gồm cả 30 hồ sơ mẫu thật.
  - **Đổi so với dự kiến:** giữ nhầm người hợp lệ được 0 điểm, không phải −10. Khung chung không cho điểm bước âm. Muốn trừ nặng hơn thì phải sửa khung (câu D5).
  - Hết giờ cả ca: kiểm ở API test (lượt chuyển sang hết giờ, bước chưa trả lời tính 0 theo `tongKetLuot`).
- [x] Unit test M4: biên bản lấy đúng khung tiền, hình thức bổ sung của dòng mức phạt đã duyệt tại ngày chơi; mã chưa duyệt thì ghi "Chưa có mức phạt đã duyệt". Test cũ của `lap-bien-ban` vẫn đạt.
  - `packages/dao-tao/tests/man-choi.test.ts`. M4 là tệp mới `chung/bien-ban.ts`; **chưa** chuyển `lap-bien-ban.ts` sang dùng M4, để không sửa tệp của trò khác. Test cũ vẫn đạt.
- [x] Unit test M8: qua màn 1 sao thì mở màn sau; không mở vượt màn.
- [x] API test: đề không có trường nào cho biết giấy tờ nào sai; giữ lại mà không đánh dấu chỗ nào bị từ chối (400); XP một lần.
  - `apps/api/src/kiem-tra-giay-to.test.ts`, 8 ca. Có thêm: chọn màn chưa mở nhận 409; hồ sơ chờ duyệt không vào lượt; màn 2 có giờ cả ca 4 phút, quá giờ nhận 409 và lượt hết giờ; tiến độ màn ghi một lần dù kết thúc hai lần; sửa một luật giấy tờ thì hồ sơ cần luật đó rút khỏi trò, duyệt lại thì chơi được (biên tập nhận 403 khi duyệt).
- [x] API test offline: đồng bộ một ca offline hai lần chỉ sinh một lượt; máy chủ chấm lại.
  - Có thêm: gói offline có danh sách màn; lượt ở màn chưa mở bị từ chối; lượt ghi đúng màn.
- [x] `bun run e2e kiem-tra-giay-to`: chơi hết màn 1 và màn 2 ở 360×740, phóng to giấy tờ đọc được chữ ≥ 16px.
  - Đạt 3 lần liên tiếp (khoảng 24 giây). Màn 2 chơi ở chế độ giảm chuyển động.
  - Giấy tờ phóng to: giá trị cỡ 16px, nhãn dòng 14px. Soát bằng ảnh chụp, E2E chưa đo cỡ chữ.
- [ ] **Đủ nội dung đã duyệt:** luật giấy tờ cho ô tô con và xe mô tô, mã mức phạt cho mỗi lỗi giấy tờ.
  - **Chưa làm được:** 12 luật giấy tờ và 30 hồ sơ là dữ liệu demo, chưa duyệt. Kho văn bản chưa có Luật số 36/2024/QH15, văn bản bảo hiểm bắt buộc, Nghị định số 168/2024/NĐ-CP; bảng mức phạt chưa có dòng nào cho lỗi giấy tờ. Danh sách cần kiểm ở GAME_DESIGN §5.1. Trò đang tắt.
- Mục kiểm tra chung GĐ-T:
  - [x] Test chấm điểm: như trên.
  - [x] API test bảo mật: điểm và cờ đúng máy khách gửi bị bỏ qua; người khác đọc lượt nhận 403; phản hồi trước khi chấm không có khóa cấm (`loi`, `luat`, `bien_ban`, `loi_du_kien`, `giai_thich`, `can_cu`, `answer`, `noi_dung`); `phan-quyen.test.ts` vẫn đạt.
  - [x] Cổng chung: `bun test` 1211 đạt, 5 hỏng (cả 5 ở `ports.test.ts`, lỗi môi trường Windows có từ trước); `bun run build:web` qua; Biome qua với các tệp của giai đoạn; E2E `tro-choi-khung`, `sung-ban-toc-do`, `cung-duong`, `offline`, `tro-choi`, `tro-choi-muot` vẫn đạt sau khi sửa khung.
    - Typecheck: mọi tệp của GĐ-T1 qua. `packages/dao-tao` và `packages/db` còn một lỗi ở `tro-choi/dung-xe.ts` (xuất trùng `LECH_GIO_TOI_DA`). Tệp này do phiên làm GĐ-T4 tạo song song, không thuộc giai đoạn này.
  - [x] Chơi thử một lượt đầy đủ ở 360×740, chế độ thường (màn 1) và giảm chuyển động (màn 2), qua E2E và soát ảnh chụp.
  - [ ] Hiệu năng trên Chrome giả lập CPU chậm 4×: **chưa đo** cho trò này. Trò không có hoạt cảnh liên tục, chỉ có hiệu ứng trượt và đập dấu theo VISUAL_STYLE.
  - [x] Dữ liệu mẫu đánh dấu "demo, chưa duyệt"; bảng cần kiểm tra và hình cần bổ sung ở GAME_DESIGN §5.1.
  - [x] DEMO.md có dòng màn hình và cách chơi thử.
  - [x] Có bản tóm tắt thay đổi để người dùng commit.

**Trạng thái (27/9/2026):** đã làm xong phần mã. Còn hai mục chưa đạt: nội dung đã duyệt (chờ văn bản và đơn vị chuyên môn) và đo hiệu năng CPU chậm 4×.
- Quyết định của người dùng khi làm giai đoạn này:
  - **Sửa khung cho màn chơi** (đã hỏi trước):
    - `khung.ts`: thêm `manChoi`, tham số `man` của `taoLuot`, hàm `dinhNghiaTheoMan` (giờ và XP cơ bản theo màn), tên nguồn `giay_to_ho_so`;
    - `packages/db/src/luot-choi.ts`: lưu `level`, ghi tiến độ màn trong giao dịch kết thúc lượt;
    - API `/v1/luot-choi`: nhận `man` khi bắt đầu và khi đồng bộ, kiểm màn đã mở, trả danh sách màn, giờ cả lượt còn lại;
    - trang chơi: nhãn bước và nút theo trò, ẩn "Chốt đáp án" khi trò tự nộp, đồng hồ cả ca dạng phút:giây (`DongHoBuoc`), hết giờ thì chốt lượt, màn hướng dẫn, nút "Chơi màn tiếp";
    - trang Trò chơi: chọn màn; trang offline: chơi các màn đang mở lúc tải gói.
    - Trò không có màn giữ nguyên hành vi.
  - **Chưa tắt trò cũ** (câu D1).
  - **Giấy tờ giản lược**, có chữ chìm "MẪU TRÒ CHƠI".
- Thay đổi so với dự kiến:
  - Bảng tiến độ màn tên là `game_level_progress`: tên `game_levels` đã dùng cho trò Vượt màn (migration 0020).
  - Hồ sơ là nội dung soạn sẵn có duyệt (30 hồ sơ mẫu), không sinh lúc chơi. Hàm sinh `sinhHoSo` (M1) dùng để soạn hồ sơ (`scripts/sinh-ho-so-giay-to.ts`) và để các trò sau dùng lại. Đáp án vẫn suy ra từ luật đã duyệt lúc chơi.
  - Hồ sơ không trỏ `refs` tới luật giấy tờ (khung tham chiếu chưa có loại này). Thay vào đó, luật được sửa thì rời nguồn, và hồ sơ mà luật đã duyệt không còn cho đúng lỗi dự kiến thì không vào lượt (`dungDuocOMan`). Hồ sơ đó chưa hiện ở tab "Cần xem lại".
  - Mỗi màn 8 người lái (không đổi số người theo màn). Giờ cả ca: màn 1 không tính giờ, màn 2–3 4 phút, màn 4 3 phút 30 giây, màn 5 3 phút. XP cơ bản 10, 12, 14, 16, 18.
  - Chưa có trình soạn hồ sơ riêng: soạn bằng trình soạn JSON mặc định ở `/quan-tri/noi-dung-tro-choi`.
  - `lap-bien-ban.ts` chưa chuyển sang M4 (xem trên).
- Tệp đã làm:
  - Migration `0036_kiem_tra_giay_to.sql`.
  - `packages/dao-tao`: `tro-choi/chung/giay-to.ts` (M1), `chung/bien-ban.ts` (M4), `chung/man-choi.ts` (M8), `tro-choi/kiem-tra-giay-to.ts`; sửa `khung.ts`, `dang-ky.ts`, `index.ts`.
  - `packages/db`: `kiem-tra-giay-to.ts`, `man-choi.ts`; sửa `luot-choi.ts`, `du-lieu-tra-cuu.ts`, `nguon-tro-choi.ts`, `seed-tro-choi.ts`, `index.ts`.
  - API: sửa `routes/luot-choi.ts`, `routes/du-lieu-tra-cuu.ts`.
  - Web:
    - tạo `components/tro-choi/chung/` (`GiayTo.tsx`, `giay-to.css`, `tuong-tac/DongDau.tsx`, `HuongDan.tsx`, `DanhSachLoi.tsx`, `BienBan.tsx`, `ChonMan.tsx`), `KiemTraGiayTo.tsx`, `lib/kiem-tra-giay-to.ts`;
    - sửa `giao-dien.tsx`, `DongHoBuoc.tsx`, `routes/tro-choi.luot.tsx`, `tro-choi._index.tsx`, `tro-choi.offline.tsx`, `quan-tri.du-lieu-tra-cuu.tsx` (tab Luật giấy tờ), `game-style-demo.tsx`, `lib/luot-choi.ts`, `lib/luot-choi.server.ts`, `lib/offline/kho.ts`, `lib/offline/dong-bo.ts`.
  - Dữ liệu: `data/tra-cuu/luat-giay-to.json` (12 luật demo), `data/tro-choi/kiem-tra-giay-to.json` (30 hồ sơ demo).
  - Script: `scripts/sinh-ho-so-giay-to.ts`; sửa `tra-cuu-nhanh.ts` (nạp luật giấy tờ), `check-citations.ts`, `demo-tro-choi.ts`, `demo.ts`.
  - Test: `packages/dao-tao/tests/giay-to.test.ts`, `kiem-tra-giay-to.test.ts`, `man-choi.test.ts`, `luat-giay-to-thu.ts`; `apps/api/src/kiem-tra-giay-to.test.ts`; `scripts/e2e/kiem-tra-giay-to.ts`.

---

## GĐ-T2 — Phòng thoát hiểm pháp luật

**Mục tiêu**
- Người chơi mở từng phòng bằng mật mã tìm được qua tra cứu nhanh, tìm kiếm và đọc văn bản trong hệ thống.

**Thiết kế** (GAME_DESIGN §5.2)
- Công cụ tra cứu mở trong ngăn phủ, lượt và đồng hồ giữ nguyên khi chuyển qua lại.
- Mật mã chỉ ở máy chủ; chuẩn hóa trước khi so; tối đa 10 lần nhập mỗi phòng.
- Khi duyệt, bộ kiểm mở URN tại ngày tra và kiểm mật mã có trong nội dung điều khoản (hoặc trong dòng mức phạt được trỏ tới).
- Không offline ở bản đầu (câu D6).

**Việc làm**
1. Logic thuần `tro-choi/phong-thoat-hiem.ts`: chuẩn hóa mật mã, chấm phòng, gợi ý mở dần.
2. Dữ liệu: kiểm mật mã có trong điều khoản khi duyệt (dùng đọc nút văn bản có sẵn); đếm lần nhập.
3. Web: giao diện phòng, ổ khóa, ngăn phủ tra cứu (nhúng các trang tra cứu hiện có ở chế độ gọn, không đổi các trang đó).
4. Trình soạn câu đố: chọn công cụ, dán URN hoặc chọn từ tìm kiếm, ngày tra, mật mã, 2 gợi ý; nút "Kiểm mật mã" chạy bộ kiểm.
5. Soạn 1 khu demo 3 phòng trên văn bản đang có trong kho (demo, chưa duyệt).

**File sửa**
- `packages/dao-tao/src/tro-choi/dang-ky.ts` (một dòng), `packages/db/src/nguon-tro-choi.ts` (một dòng)
- `packages/db/src/noi-dung-tro-choi.ts`: **cần hỏi trước** (thêm móc kiểm riêng theo trò khi duyệt, nếu khung chưa có)
- `apps/web/app/components/tro-choi/giao-dien.tsx` (một dòng)

**File tạo**
- `packages/dao-tao/src/tro-choi/phong-thoat-hiem.ts`, `packages/dao-tao/tests/phong-thoat-hiem.test.ts`
- `packages/db/src/phong-thoat-hiem.ts`
- `apps/api/src/phong-thoat-hiem.test.ts`
- `apps/web/app/components/tro-choi/PhongThoatHiem.tsx`, `NganTraCuu.tsx`
- `apps/web/app/components/quan-tri/tro-choi/SoanPhongThoatHiem.tsx`
- `data/tro-choi/phong-thoat-hiem.json`
- `scripts/e2e/phong-thoat-hiem.ts`

**Migration**
- `0037_phong_thoat_hiem.sql`: `game_code_attempts(run_id, room, attempts, PK)`; `INSERT INTO games`: `phong_thoat_hiem`, `offline_ok = false`, `enabled = false`.

**Kiểm tra đã xong**
- [ ] Unit test chuẩn hóa mật mã: "1.000.000", "1 000 000", "1000000" bằng nhau; chữ hoa, chữ thường, có dấu, không dấu theo quy tắc của câu đố.
- [ ] Unit test chấm: gợi ý −5, nhập sai từ lần thứ 4 −2, điểm phòng không âm.
- [ ] API test: không phản hồi nào có mật mã; lần nhập thứ 11 nhận 429; tình huống có mật mã không có trong điều khoản không duyệt được (409); văn bản được trỏ tới đổi phiên bản thì khu rút khỏi trò.
- [ ] E2E 360px: mở ngăn tra cứu, tìm, đọc điều khoản, đóng ngăn, nhập mật mã, thoát; đồng hồ không chạy lại khi mở ngăn.
- [ ] **Đủ nội dung đã duyệt:** ít nhất 2 khu, phủ tra cứu nhanh, tìm kiếm và đọc văn bản.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục).

---

## GĐ-T3 — Cắm biển cho tuyến đường

**Mục tiêu**
- Người chơi đặt biển vào vị trí trên đoạn đường, cho xe mô phỏng chạy thử, được chấm theo bố trí cuối.
- Tạo M5 (bộ mô phỏng giao thông, phần đoạn đường, biển, xe tự chạy), M6 (bộ vẽ cảnh từ trên xuống), M7 (nhật ký thao tác và chấm lại), M2 phần kéo thả.

**Thiết kế** (GAME_DESIGN §5.3, §2.3, §4)
- M5 tất định: nhịp 50 ms, tọa độ số nguyên, hướng rời rạc, không dùng hàm lượng giác trong logic. Kiểu dữ liệu đủ cho trò 5, 8, 9, 10 (xe có hướng, tốc độ, làn, sự kiện), dù T3 chỉ dùng xe chạy theo làn.
- M6 tách cách làm của `DuongChay.tsx`: Canvas 2D một lớp, nội suy giữa nhịp, giới hạn 2× điểm ảnh, tạm dừng khi tab ẩn. `DuongChay.tsx` không đổi.
- Chấm từ bố trí cuối; hoạt cảnh chạy thử chỉ để minh họa và liệt kê tình huống nguy hiểm.

**Việc làm**
1. M5 `mo-phong/`: lưới làn, đoạn đường, vị trí đặt biển, xe theo làn, phản ứng với biển (dùng `phan_ung` của biển đã duyệt), sự kiện `phanh_gap`, `nguy_hiem`.
2. M7 `chung/nhat-ky.ts`: định dạng nhật ký, kiểm mốc thời gian, chạy lại, băm trạng thái.
3. M6 `CanhTrenXuong.tsx`, `lib/ve-canh/`; M2 kéo thả có đường thay thế chạm-chạm và bàn phím.
4. Trò `cam-bien.ts`: kiểm bố cục, chấm từng vị trí.
5. Trình soạn đoạn đường theo lưới ô; soạn 5 đoạn demo (demo, chưa duyệt), dùng 30 biển demo đã có.
6. Trang `/game-style-demo` thêm mục trình diễn M2 kéo thả và M6.

**File sửa**
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx` (mỗi tệp một dòng)
- `apps/web/app/routes/game-style-demo.tsx` (thêm mục trình diễn)

**File tạo**
- `packages/dao-tao/src/mo-phong/` (`duong.ts`, `xe.ts`, `bien.ts`, `mo-phong.ts`, `index.ts`), `packages/dao-tao/src/tro-choi/chung/nhat-ky.ts`, `tro-choi/cam-bien.ts`
- `packages/dao-tao/tests/mo-phong.test.ts`, `nhat-ky.test.ts`, `cam-bien.test.ts`
- `apps/api/src/cam-bien.test.ts`
- `apps/web/app/components/tro-choi/chung/CanhTrenXuong.tsx`, `tuong-tac/KeoTha.tsx`, `apps/web/app/lib/ve-canh/`
- `apps/web/app/components/tro-choi/CamBien.tsx`, `apps/web/app/components/quan-tri/tro-choi/SoanDoanDuong.tsx`
- `data/tro-choi/cam-bien.json`
- `scripts/e2e/cam-bien.ts`

**Migration**
- `0038_cam_bien.sql`: `INSERT INTO games`: `cam_bien`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test M5 tất định: cùng đề, cùng nhật ký, chạy hai lần và chạy trong trình duyệt (E2E) ra cùng băm trạng thái cuối; mã logic không gọi `Math.sin`, `Math.cos`, `Math.random`, `Date.now` (test quét mã nguồn).
- [x] Unit test M7: mốc trước lúc mở đề, sau lúc kết thúc, tổng thời gian lệch quá 10% + 2 giây thì bước 0 điểm; nhật ký quá 2.000 thao tác bị từ chối.
- [x] Unit test chấm: biển đúng +10, chấp nhận được +5, sai −5, vị trí nên để trống mà cắm −3; chỉ lần chạy cuối được chấm.
- [x] Unit test kiểm bố cục: vị trí ngoài đường, biển đúng không có trong khay, biển chưa duyệt đều báo lỗi chỉ đúng vị trí.
- [x] API test: đề không có biển đúng của vị trí nào; chạy lại một lượt ở máy chủ dưới 200 ms.
- [x] Kéo thả dùng được bằng chạm-chạm và bằng bàn phím; E2E 360px chơi hết màn 1–2.
- [ ] Hiệu năng: đoạn đường 6 vị trí, 4 xe chạy thử ≥ 50 khung hình/giây trên CPU chậm 4×. *(Đã đo đoạn 1 vị trí, 4 xe: 59,5 khung/giây, p95 16,8 ms. Chưa đo đoạn 6 vị trí vì E2E chỉ mở tới màn 2.)*
- [ ] **Đủ nội dung đã duyệt:** ít nhất 5 đoạn đường, phủ biển cấm, nguy hiểm, hiệu lệnh, chỉ dẫn. *(Có 6 đoạn demo chờ duyệt; biển cấm chỉ xuất hiện là biển nhiễu và biển "chấp nhận được".)*
- [x] Các mục kiểm tra chung GĐ-T (8 mục).

**Trạng thái (27/9/2026):** đã làm xong phần mã; trò tắt (`games.enabled = false`) cho tới khi có đoạn đường và biển đã duyệt. Còn hai mục chưa đạt (xem trên). Kết quả: `bun run typecheck` đạt; `bun test` 1314 đạt, 5 hỏng ở `packages/config/src/ports.test.ts` (đã hỏng trước giai đoạn này, không liên quan); `bun run e2e cam-bien` đạt; mã riêng của trò 10,5 KB gzip (M5 3,6 KB, M6 3,4 KB, M7 1,2 KB). Khác kế hoạch:
- Làm T3 trước T2 theo chỉ định của người dùng (27/9/2026), để trò 8 dùng được M5, M6, M7.
- M2 kéo thả (`tuong-tac/KeoTha.tsx`) do GĐ-T4 tạo sớm; T3 dùng lại, không sửa.
- `khung.ts` thêm một tên nguồn `cam_bien_doan_duong` (cùng cách T1, T4 đã làm). `packages/dao-tao/src/index.ts` xuất M5 và M7 dạng không gian tên (`moPhong`, `nhatKy`) vì trùng tên với Cung đường biển báo và Dừng xe.
- Sửa thêm ngoài danh sách: `quan-tri.noi-dung-tro-choi.sua.tsx` (gắn trình soạn đoạn đường thay hai ô JSON), `seed-tro-choi.ts` và `scripts/demo-tro-choi.ts` (nạp, duyệt đoạn demo), `packages/db/src/cam-bien.ts` (nguồn và nạp mẫu), `apps/web/app/lib/cam-bien.ts`.
- Chưa làm: bộ kiểm hợp lệ chạy ở máy chủ khi lưu và khi duyệt (GAME_DESIGN §3). Cần sửa API chung `routes/noi-dung-tro-choi.ts`, chờ người dùng đồng ý. Hiện bộ kiểm chạy ở trình soạn, khi nạp mẫu và khi lấy nguồn (đoạn lỗi không vào lượt).
- Bổ sung theo yêu cầu người dùng (27/9/2026, sau khi T3 xong phần mã):
  - M5 thêm **rẽ** và **phát hiện va chạm** ngay ở T3 (kế hoạch cũ để tới T8, T10), để trò 8, 9, 10 dùng lại: xe đi theo lộ trình qua nhiều làn nối liền (`XeKhoiTao.lo_trinh`), sự kiện `re`; giảm tốc trước khúc ngoặt và chỗ rẽ theo độ gắt (`TOC_DO_QUA_KHUC`, thông số mô phỏng); va chạm theo hộp bao thẳng trục (`hopBao`, `chongNhau`), sự kiện `va_cham` một lần mỗi cặp, hai xe đứng yên tại chỗ. Xe khác làn không nhường nhau ở giao lộ (luật nhường đường để trò 8). Đoạn đường của trò 3 là làn thẳng nên hoạt cảnh và điểm không đổi. Thêm 10 test M5 (rẽ, khúc ngoặt, lộ trình không nối, va chạm, lệch giờ không va chạm, xe sau dừng sau xe va chạm, tất định).
  - Chạy thử có **giải thích vì sao** xe xử lý sai: thiếu biển trước chỗ nguy hiểm, biển đã cắm không báo giảm tốc (nêu tên biển và vị trí), biển đặt sau chỗ nguy hiểm, biển cấm chặn đường, và loại mới `dung_vo_co` (biển dừng lại ở chỗ không cần dừng). Giải thích chỉ dựa trên dữ kiện công khai và biển người chơi đã cắm, không lộ biển đúng. Khung "Tình huống nguy hiểm khi chạy thử" đổi tên thành "Xe xử lý sai khi chạy thử". Thêm 6 test.
  - Biển trên khay và trên cảnh: dùng ảnh SVG vector của hệ thống (`data/bien-bao/anh/`), đã có từ trước; đó là hình tự vẽ theo hình dạng chuẩn, chưa phải ảnh chính thức QCVN 41:2024 (GAP 4.5-24), kho văn bản chưa có QCVN 41:2024.
  - Phối hợp với phiên đang làm GĐ-T5, cũng mở rộng M5: phần T3 sửa xong trước, T5 thêm sau.
  - Kiểm lại sau khi T5 thêm phần M5: `typecheck` đạt; `bun test` 1330 đạt, 5 hỏng (các test giải phóng cổng, hỏng từ trước); `bun run e2e cam-bien` đạt, chạy thử ở CPU chậm 4× trung bình 59,1 khung/giây, p95 16,8 ms; biome sạch trên các tệp đã sửa.

---

## GĐ-T4 — Dừng xe đúng quy trình

**Mục tiêu**
- Người chơi thực hiện từng thao tác dừng xe, kiểm giấy tờ, đo nồng độ cồn, chọn hướng xử lý, được chấm theo quy trình đã duyệt.
- Mở rộng M2: giữ và vuốt.

**Thiết kế** (GAME_DESIGN §5.4)
- Quy trình là máy trạng thái đọc từ `procedures` mở rộng (bước có thao tác, bước bắt buộc, điều kiện rẽ nhánh).
- Máy chủ chạy lại chuỗi thao tác qua máy trạng thái. Sai thứ tự −3, thiếu bước bắt buộc ghi lỗi, thao tác không an toàn −10.
- Kiểm giấy tờ dùng M1 rút gọn; biên bản dùng M4.
- Thông số máy đo không tự đặt; chưa có văn bản thì dùng số trong tình huống demo, ghi "chưa đối chiếu".

**Việc làm**
1. Tra kho văn bản: quy trình tuần tra, kiểm soát, xử lý vi phạm; quy trình kiểm tra nồng độ cồn. Ghi URN và phần chưa có vào GAME_DESIGN §5.4.
2. Mở rộng `procedures` và `data/tra-cuu/quy-trinh.json` với quy trình "Dừng xe kiểm tra" (demo, chưa duyệt).
3. Logic thuần `tro-choi/dung-xe.ts`: máy trạng thái quy trình, chấm chuỗi thao tác.
4. M2: `tuong-tac/Giu.tsx` (vòng tiến độ), `tuong-tac/Vuot.tsx` (8 hướng).
5. Web: giao diện trò; tab quy trình ở `/quan-tri/du-lieu-tra-cuu` sửa được bước có thao tác.

**File sửa**
- `packages/dao-tao/src/tra-cuu-nhanh.ts` (kiểu bước quy trình có thao tác, không đổi quy trình cũ), `packages/db/src/tra-cuu-nhanh.ts`
- `apps/web/app/routes/quan-tri.du-lieu-tra-cuu.tsx` (tab Quy trình), `apps/web/app/routes/tra-cuu-nhanh.quy-trinh*.tsx` (ẩn trường thao tác khỏi tra cứu)
- `data/tra-cuu/quy-trinh.json`
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx` (mỗi tệp một dòng)

**File tạo**
- `packages/dao-tao/src/tro-choi/dung-xe.ts`, `packages/dao-tao/tests/dung-xe.test.ts`
- `apps/api/src/dung-xe.test.ts`
- `apps/web/app/components/tro-choi/chung/tuong-tac/Giu.tsx`, `tuong-tac/Vuot.tsx`
- `apps/web/app/components/tro-choi/DungXe.tsx`
- `data/tro-choi/dung-xe.json`
- `scripts/e2e/dung-xe.ts`

**Migration**
- `0039_dung_xe.sql`: `procedures` thêm cột mô tả bước có thao tác (hoặc mở rộng lược đồ `steps`, kiểm bằng hàm thuần); `INSERT INTO games`: `dung_xe`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test máy trạng thái: đi đúng quy trình được đủ điểm; sai thứ tự −3; thiếu bước bắt buộc ghi lỗi đúng bước; thao tác không an toàn −10; rẽ nhánh theo kết quả đo đúng.
- [x] Unit test đo nồng độ cồn: thả sớm lần đầu không trừ, lần hai −2; giữ đủ thời gian thì có kết quả.
- [x] Unit test quy trình cũ: 2 quy trình xử phạt hiện có vẫn đọc được, tra cứu nhanh quy trình (GĐ5) không đổi.
- [x] API test: đề không có thứ tự bước đúng; thao tác gửi không thuộc máy trạng thái bị bỏ qua.
- [ ] E2E 360px: vuốt, chạm, kéo, giữ bằng một tay; giảm chuyển động thì cử chỉ vẫn dùng được, không có hoạt ảnh. (Đạt phần vuốt, chạm, kéo ở cả hai chế độ; phần giữ máy đo chưa có trong E2E vì E2E chỉ chơi màn 1–2.)
- [ ] **Đủ nội dung đã duyệt:** quy trình dừng xe kiểm tra và kiểm tra nồng độ cồn đã đối chiếu văn bản; ít nhất 6 tình huống.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục). Đạt 6/8: test chấm, bảo mật, cổng chung, chơi thử 360×740 hai chế độ (qua E2E), dữ liệu demo và hai bảng ở GAME_DESIGN §5.4, DEMO.md, bản tóm tắt. Chưa: đo hiệu năng CPU chậm 4×; `bun run e2e` toàn bộ.

**Trạng thái (27/9/2026):** đã làm xong phần mã; trò tắt (`games.enabled = false`) vì chưa có nội dung đã duyệt.
- Căn cứ: tra kho văn bản ngày 27/9/2026, kho chỉ có 2 văn bản thử, **không bước nào có căn cứ**. Quy trình `dung-xe-kiem-tra` là bản nháp demo, mọi bước `can_cu = null`, `nguon = chua_co_can_cu`. Bảng 13 điểm cần hỏi đơn vị ở GAME_DESIGN §5.4.
- Dữ liệu: 5 tình huống mẫu (mỗi màn một) ở `data/tro-choi/dung-xe.json`, sinh bằng `scripts/sinh-tinh-huong-dung-xe.ts` qua `sinhHoSo` của GĐ-T1; nạp chờ duyệt bằng `packages/db/src/seed-tro-choi.ts`. Kế hoạch cần 6 tình huống đã duyệt; người dùng yêu cầu 5 mẫu.
- Cổng: `typecheck` qua; `bun test` 1304 đạt, 5 hỏng (các test giải phóng cổng, hỏng từ trước); `build:web` qua; biome qua trên các tệp của giai đoạn; `bun run e2e dung-xe` đạt; test riêng: 27 unit, 10 API.
- Thay đổi so với dự kiến:
  - Một lượt là **một tình huống** (`soBuoc = 1`), không phải nhiều tình huống.
  - Chấm theo mili giây như Cung đường biển báo, không theo nhịp: trò không có mô phỏng liên tục.
  - Kéo thả (M2) tạo sớm ở `tuong-tac/KeoTha.tsx`, vốn ghi ở GĐ-T3; GĐ-T3 dùng lại và mở rộng.
  - Thêm `NguonNoiDung` `dung_xe_tinh_huong` (một dòng ở `khung.ts`), `packages/db/src/dung-xe.ts`, hàm nạp ở `seed-tro-choi.ts`.
  - Sửa `apps/api/src/routes/du-lieu-tra-cuu.ts`: lược đồ sửa quy trình trước đây **xóa mất** phần `tro_choi` của bước khi biên tập viên lưu; nay giữ và kiểm bằng `kiemTraBuocCoThaoTac`. Tab Quy trình vẫn sửa bằng JSON, nhãn ô ghi thêm các khóa mới. Không sửa `tra-cuu-nhanh.quy-trinh*.tsx`: API tra cứu vốn chỉ trả tiêu đề, mô tả, căn cứ (có test).
  - Migration `0039_dung_xe.sql` chỉ đăng ký trò; phần thao tác nằm trong `procedures.steps` (jsonb), không thêm cột.
- Quy tắc trò chơi đã chốt (quy ước, chờ đơn vị xác nhận): màn 5 mỗi thao tác 15 giây, quá giờ −2; kiểm giấy tờ được điểm theo tỷ lệ giấy xếp đúng khay; bước phản ứng (xin bỏ qua, không chịu thổi) không có vị trí cố định trong thứ tự.

---

## GĐ-T5 — Soi camera

**Mục tiêu**
- Người chơi xem hoạt cảnh camera, dừng hình đúng lúc vi phạm, khoanh vùng xe và gắn thẻ lỗi.
- Mở rộng M5: nhiều xe, đèn tín hiệu, sự kiện vi phạm; mở rộng M2: khoanh vùng.

**Thiết kế** (GAME_DESIGN §5.5)
- Kịch bản xe gửi xuống dạng lộ trình, không có cờ vi phạm; cửa sổ vi phạm và nhãn lỗi chỉ ở máy chủ.
- Máy chủ chạy lại hoạt cảnh, tính vị trí xe ở nhịp dừng hình, chấm dừng đúng lúc (+5), khoanh đúng (phủ ≥ 50%, +5), thẻ lỗi đúng (+10), khoanh nhầm −5.
- Tua lại tối đa 3 lần; biên bản dùng M4.

**Việc làm**
1. M5: đèn tín hiệu theo chu kỳ, nhiều xe, sự kiện `vuot_den_do`, `sai_lan`, `dung_do_sai`, thuộc tính nhìn thấy (không mũ bảo hiểm…).
2. M6: khung camera, góc nhìn chéo (biến đổi tuyến tính cố định), chế độ ban đêm.
3. M2: `tuong-tac/KhoanhVung.tsx` (kéo khung hoặc vẽ vòng, quy về hộp bao).
4. Trò `soi-camera.ts`; trình soạn kịch bản xe; 5 đoạn demo.

**File sửa**
- `packages/dao-tao/src/mo-phong/*` (phần mở rộng đã ghi trong kế hoạch)
- `apps/web/app/components/tro-choi/chung/CanhTrenXuong.tsx`, `apps/web/app/lib/ve-canh/*` (khung camera, góc chéo)
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx` (mỗi tệp một dòng)

**File tạo**
- `packages/dao-tao/src/tro-choi/soi-camera.ts`, `packages/dao-tao/tests/soi-camera.test.ts`
- `apps/api/src/soi-camera.test.ts`
- `apps/web/app/components/tro-choi/chung/tuong-tac/KhoanhVung.tsx`, `apps/web/app/components/tro-choi/SoiCamera.tsx`
- `apps/web/app/components/quan-tri/tro-choi/SoanKichBanXe.tsx`
- `data/tro-choi/soi-camera.json`
- `scripts/e2e/soi-camera.ts`

**Migration**
- `0040_soi_camera.sql`: `INSERT INTO games`: `soi_camera`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test chấm: dừng hình trước lúc vi phạm hoặc quá 2 giây sau thì không có điểm dừng; vùng phủ 49% không có điểm khoanh, 50% có; vùng trùm 3 xe khác bị loại; bỏ sót được liệt kê.
- [x] Unit test M5 mở rộng: test tất định và test của trò 3 vẫn đạt.
- [x] API test: đề không có cửa sổ vi phạm, nhãn lỗi hay cờ vi phạm; tua lại lần thứ 4 bị bỏ qua.
- [x] E2E 360px: dừng hình, khoanh, kéo thẻ lỗi bằng một tay; giảm chuyển động thì hoạt cảnh chạy từng đoạn 2 giây.
- [ ] Hiệu năng: 12 xe ≥ 50 khung hình/giây trên CPU chậm 4×. *(Đã đo đoạn màn 1, 3 xe: 59,7 khung/giây, p95 16,8 ms. Chưa đo đoạn 12 xe vì E2E chỉ mở tới màn 2.)*
- [ ] **Đủ nội dung đã duyệt:** ít nhất 8 đoạn phim, phủ 4 hành vi vi phạm có mức phạt đã duyệt. *(Có 8 đoạn demo chờ duyệt, phủ 4 hành vi; đi sai làn và dừng xe sai nơi chưa có dòng mức phạt.)*
- [x] Các mục kiểm tra chung GĐ-T (8 mục).

**Trạng thái (27/9/2026):** đã làm xong phần mã; trò tắt (`games.enabled = false`) cho tới khi có kịch bản và mức phạt đã duyệt. Còn hai mục chưa đạt (xem trên). Kết quả: `bun run typecheck` đạt; `bun test` 1357 đạt, 5 hỏng ở `packages/config/src/ports.test.ts` (đã hỏng từ trước, không liên quan); `bun run e2e soi-camera` và `bun run e2e cam-bien` đạt; mã riêng của trò 11,9 KB gzip (ngân sách 12 KB). Khác kế hoạch:
- 8 đoạn demo thay vì 5 (theo yêu cầu người dùng; đủ số cho mục "Đủ nội dung").
- M5 sửa cùng lúc với một phiên khác (phần rẽ, va chạm); đã phối hợp, thêm phần T5 theo từng đoạn trên bản của phiên kia. Thêm `CauHinhMoPhong.chay_du_nhip` (không tự kết thúc khi mọi xe chờ đèn đỏ), không có trong kế hoạch nhưng cần cho đoạn phim có đèn đỏ dài.
- M6: `CanhTrenXuong` thêm `tyLeCao` (giữ tỷ lệ khung camera); `lib/ve-canh/ve-camera.ts` mới. Góc nhìn chéo là phép chiếu tuyến tính đặt ở M5 (`mo-phong/camera.ts`) để máy chủ chấm cùng phép chiếu.
- Sửa thêm ngoài danh sách: `khung.ts` (một tên nguồn), `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts`, `seed-tro-choi.ts`, `scripts/demo-tro-choi.ts`, `quan-tri.noi-dung-tro-choi.sua.tsx`, `game-style-demo.tsx`; tạo `packages/db/src/soi-camera.ts`, `apps/web/app/lib/soi-camera.ts`.
- Bộ kiểm hợp lệ chưa chạy ở máy chủ khi lưu, khi duyệt (như GĐ-T3, chờ người dùng đồng ý sửa API chung).

---

## GĐ-T6 — Điều phối ca trực

**Mục tiêu**
- Người chơi điều tổ công tác tới sự việc trên bản đồ theo mức ưu tiên.
- Tạo M9 (bản đồ dạng ô). *M9 đã tạo ở GĐ-T17 (câu D22, 30/9/2026): dùng lại `packages/dao-tao/src/ban-do/`, `BanDoO.tsx`; phần thiếu (tổ đi theo đường trên lưới…) thêm vào M9 thì hỏi trước.*

**Thiết kế** (GAME_DESIGN §5.6)
- Mô phỏng ở mức lưới ô, tất định theo §2.3; tổ đi theo đường ngắn nhất trên lưới; sự việc leo thang khi quá hạn.
- Điểm theo mức ưu tiên × hệ số thời gian đáp ứng; tổ không phù hợp × 0,5; sai thứ tự ưu tiên −5.
- Quy tắc ưu tiên từ `incident_types`; chưa có tài liệu thì dùng quy tắc chung dễ kiểm, đánh dấu demo (câu D7).

**Việc làm**
1. M9 `ban-do/`: lưới ô, đường đi ngắn nhất, đặt vật thể vào ô.
2. `incident_types` và tab "Loại sự việc" ở `/quan-tri/du-lieu-tra-cuu`; `data/tro-choi/loai-su-viec.json` (demo, chưa duyệt).
3. Trò `dieu-phoi.ts`; web `BanDoO.tsx`, giao diện trò; 3 ca trực demo.

**File sửa**
- `packages/db/src/du-lieu-tra-cuu.ts` (loại `loai-su-viec`), `apps/api/src/routes/du-lieu-tra-cuu.ts`, `apps/web/app/routes/quan-tri.du-lieu-tra-cuu.tsx` (tab mới)
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx` (mỗi tệp một dòng)

**File tạo**
- `packages/dao-tao/src/ban-do/` (`luoi.ts`, `duong-di.ts`, `index.ts`), `packages/dao-tao/src/tro-choi/dieu-phoi.ts`
- `packages/dao-tao/tests/ban-do.test.ts`, `dieu-phoi.test.ts`
- `apps/api/src/dieu-phoi.test.ts`
- `apps/web/app/components/tro-choi/chung/BanDoO.tsx`, `apps/web/app/components/tro-choi/DieuPhoi.tsx`
- `data/tro-choi/loai-su-viec.json`, `data/tro-choi/dieu-phoi.json`
- `scripts/e2e/dieu-phoi.ts`

**Migration**
- `0041_dieu_phoi.sql`: `incident_types` (vòng đời duyệt); `content_reviews.kind` nhận `incident_type`; `INSERT INTO games`: `dieu_phoi`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [ ] Unit test M9: đường đi ngắn nhất đúng trên lưới có vật cản; không có đường thì báo rõ.
- [ ] Unit test chấm: tới trong hạn hệ số 1, trễ giảm tuyến tính tới 0,3; tổ không phù hợp × 0,5; sai thứ tự ưu tiên ghi lỗi đúng sự việc; cùng nhật ký cùng kết quả.
- [ ] API test: đề không có thứ tự ưu tiên đúng; lệnh điều tổ đang bận bị bỏ qua.
- [ ] E2E 360px: kéo tổ tới sự việc bằng một ngón, bản đồ không cuộn ngang; giảm chuyển động thì tổ nhảy ô theo bước.
- [ ] **Đủ nội dung đã duyệt:** danh mục loại sự việc đã được đơn vị xác nhận; ít nhất 3 ca trực.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục).

---

## GĐ-T7 — Thành phố an toàn

**Mục tiêu**
- Mỗi đơn vị có khu phố chung; XP của thành viên thành điểm xây dựng; đặt công trình đúng chỗ làm chỉ số tai nạn giảm.

**Thiết kế** (GAME_DESIGN §5.7)
- Điểm xây dựng tính ở máy chủ từ `xp_ledger` theo `unit_id`, chia theo quân số, trần mỗi người mỗi tuần; dùng lại luật đã viết ở `mua-giai.ts` (câu D2).
- Lệnh đặt công trình: máy chủ kiểm quyền, đủ điểm, luật đặt, phiên bản khu phố; hai lệnh trùng thì lệnh sau nhận 409.
- Không có lượt chơi riêng, không cộng XP. Không offline.
- Ghi rõ "chỉ số mô phỏng, không phải số liệu tai nạn thật".

**Việc làm**
1. Logic thuần `thanh-pho.ts`: điểm xây dựng từ XP, luật đặt, tính chỉ số tai nạn, mở giai đoạn.
2. Dữ liệu `packages/db/src/thanh-pho.ts`: đọc và ghi khu phố trong giao dịch, khóa theo phiên bản, giới hạn số công trình mỗi ngày (câu D8).
3. API `/v1/thanh-pho/*`: xem khu phố của đơn vị mình, đặt công trình, lịch sử; cán bộ quản lý gỡ công trình.
4. Web: trang `/tro-choi/thanh-pho` dùng M9; thẻ ở trang Trò chơi.
5. Soạn bản đồ 5 giai đoạn demo.

**File sửa**
- `apps/api/src/app.ts` (gắn route), `apps/web/app/routes.ts`
- `packages/dao-tao/src/mua-giai.ts`: chỉ **tách** hàm tính điểm theo quân số ra dùng chung nếu D2 chọn dừng Mùa giải; **hỏi trước** khi sửa
- `packages/dao-tao/src/tro-choi/dang-ky.ts` (một dòng, trò không có lượt chơi)

**File tạo**
- `packages/dao-tao/src/thanh-pho.ts`, `packages/dao-tao/tests/thanh-pho.test.ts`
- `packages/db/src/thanh-pho.ts`
- `apps/api/src/routes/thanh-pho.ts`, `apps/api/src/thanh-pho.test.ts`
- `apps/web/app/routes/tro-choi.thanh-pho.tsx`, `apps/web/app/components/tro-choi/ThanhPho.tsx`
- `data/tro-choi/thanh-pho.json`
- `scripts/e2e/thanh-pho.ts`

**Migration**
- `0042_thanh_pho.sql`: `unit_cities(unit_id PK, stage, version, state jsonb, points_spent, updated_at)`, `unit_city_builds(id, unit_id, account_id, item, cell, points, removed_by, created_at)`; `INSERT INTO games`: `thanh_pho_an_toan`, `offline_ok = false`, `enabled = false`.

**Kiểm tra đã xong**
- [ ] Unit test điểm xây dựng: chia theo quân số; trần mỗi người mỗi tuần; đơn vị dưới 3 người vẫn có khu phố nhưng không vào so sánh giữa đơn vị.
- [ ] Unit test luật đặt và chỉ số: công trình đúng chỗ giảm chỉ số đúng mức; sai chỗ không giảm và có giải thích; đủ ngưỡng thì mở giai đoạn sau.
- [ ] API test: người đơn vị khác không đặt được (403); không đủ điểm 409; hai lệnh cùng ô gửi đồng thời chỉ một lệnh được nhận; máy khách gửi chỉ số hay điểm thì bị bỏ qua; quá số công trình trong ngày 429.
- [ ] API test: XP từ lượt offline đồng bộ muộn vào điểm xây dựng đúng đơn vị lúc nhận XP.
- [ ] E2E 360px: hai tài khoản cùng đơn vị thấy cùng khu phố; đặt một công trình, tài khoản kia tải lại thấy.
- [ ] **Đủ nội dung đã duyệt:** giai đoạn 1–2 có điểm nóng và công trình đã được đơn vị chuyên môn xác nhận.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục; mục chơi thử thay bằng đặt công trình ở 360px).

---

## GĐ-T8 — Điều tiết giao lộ

**Mục tiêu**
- Người chơi vuốt để ra hiệu lệnh điều khiển luồng xe tại ngã tư.
- Mở rộng M5: giao lộ, xe rẽ, xung đột, xe ưu tiên, người đi bộ.

**Thiết kế** (GAME_DESIGN §5.8)
- Ý nghĩa hiệu lệnh lấy nguyên từ văn bản, lưu ở `hand_signals`; cử chỉ vuốt là quy ước của trò, ghi ở màn hướng dẫn.
- Máy chủ chạy lại từ seed và nhật ký hiệu lệnh. Điểm: xe qua an toàn +1, xung đột −5, va chạm −15, xe ưu tiên chờ quá 3 giây −10, hàng chờ quá 12 xe −1 mỗi giây.
- Giảm chuyển động: mỗi hiệu lệnh chạy 2 giây rồi dừng.

**Việc làm**
1. Tra kho văn bản: hiệu lệnh của người điều khiển giao thông, quyền ưu tiên. Ghi URN và phần chưa có vào GAME_DESIGN §5.8.
2. `hand_signals` và tab "Hiệu lệnh" ở `/quan-tri/du-lieu-tra-cuu`; `data/tro-choi/hieu-lenh.json` (demo, chưa duyệt).
3. M5: giao lộ, xe rẽ, phát hiện xung đột, xe ưu tiên, người đi bộ.
4. Trò `dieu-tiet-giao-lo.ts`; giao diện dùng M2 vuốt và M6.

**File sửa**
- `packages/dao-tao/src/mo-phong/*` (phần mở rộng đã ghi trong kế hoạch)
- `packages/db/src/du-lieu-tra-cuu.ts`, `apps/api/src/routes/du-lieu-tra-cuu.ts`, `apps/web/app/routes/quan-tri.du-lieu-tra-cuu.tsx` (tab mới)
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx` (mỗi tệp một dòng)

**File tạo**
- `packages/dao-tao/src/mo-phong/giao-lo.ts`, `packages/dao-tao/src/tro-choi/dieu-tiet-giao-lo.ts`
- `packages/dao-tao/tests/giao-lo.test.ts`, `dieu-tiet-giao-lo.test.ts`
- `apps/api/src/dieu-tiet-giao-lo.test.ts`
- `apps/web/app/components/tro-choi/DieuTietGiaoLo.tsx`
- `data/tro-choi/hieu-lenh.json`, `data/tro-choi/dieu-tiet-giao-lo.json`
- `scripts/e2e/dieu-tiet-giao-lo.ts`

**Migration**
- `0043_dieu_tiet_giao_lo.sql`: `hand_signals` (vòng đời duyệt); `content_reviews.kind` nhận `hand_signal`; `INSERT INTO games`: `dieu_tiet_giao_lo`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [ ] Unit test giao lộ: hiệu lệnh cho hai hướng đối diện đi thẳng không sinh xung đột; cho hai hướng vuông góc cùng đi sinh xung đột; xe ưu tiên được tính chờ đúng.
- [ ] Unit test chấm: các mức trừ điểm; vuốt không ứng với tư thế nào không trừ; cùng nhật ký cùng kết quả. Test của trò 3, 5 vẫn đạt.
- [ ] Unit test nhận dạng vuốt: 8 hướng, vuốt ngắn dưới ngưỡng không tính, vuốt chéo lệch 20° vẫn đúng hướng.
- [ ] API test: hiệu lệnh gửi ngoài thời gian lượt bị bỏ qua; chạy lại dưới 200 ms.
- [ ] E2E 360px: chơi hết màn 1–2 bằng vuốt; giảm chuyển động chạy theo bước.
- [ ] Hiệu năng: giờ cao điểm (≥ 30 xe) ≥ 50 khung hình/giây trên CPU chậm 4×.
- [ ] **Đủ nội dung đã duyệt:** mọi tư thế hiệu lệnh dùng trong trò đã đối chiếu văn bản.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục).

---

## GĐ-T9 — Tự lái qua phố

**Mục tiêu**
- Người chơi lái xe nhìn từ trên xuống từ A tới B; game ghi lỗi và xuất biên bản cuối lượt.
- Mở rộng M5: xe do người chơi điều khiển, phát hiện lỗi lái.

**Thiết kế** (GAME_DESIGN §5.9)
- Nhật ký điều khiển theo nhịp; máy chủ chạy lại M5. Đây là trò đòi hỏi tất định cao nhất.
- Bắt đầu 100 điểm, trừ theo nhóm lỗi; tới đích +10 (không vượt 100); không tới đích tối đa 50.
- Ánh xạ sự kiện → mã mức phạt theo loại xe, có duyệt; biên bản dùng M4 (câu D9).
- Nghiêng máy tắt mặc định (câu D13). Giảm chuyển động: khung cố định theo đoạn, không lắc.

**Việc làm**
1. M5: xe người lái (ga, phanh, lái theo hướng rời rạc, xi nhan), phát hiện lỗi (`vuot_den_do`, `qua_toc_do`, `sai_lan`, `khong_nhuong_nguoi_di_bo`, `re_khong_xi_nhan`, `vao_duong_cam`, `va_cham`); ngưỡng tránh bắt nhầm (đèn vàng, chạm vạch).
2. Bảng ánh xạ sự kiện → mức phạt trong cấu hình trò, soạn và duyệt ở `/quan-tri/noi-dung-tro-choi`.
3. Trò `tu-lai.ts`; giao diện nút lái lớn, bản đồ kết quả có chấm lỗi, phát lại 3 giây trước lỗi.
4. Soạn 5 khu phố demo trên M9.

**File sửa**
- `packages/dao-tao/src/mo-phong/*` (phần mở rộng đã ghi trong kế hoạch)
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx` (mỗi tệp một dòng)

**File tạo**
- `packages/dao-tao/src/mo-phong/xe-nguoi-lai.ts`, `packages/dao-tao/src/tro-choi/tu-lai.ts`
- `packages/dao-tao/tests/xe-nguoi-lai.test.ts`, `tu-lai.test.ts`
- `apps/api/src/tu-lai.test.ts`
- `apps/web/app/components/tro-choi/TuLai.tsx`, `NutLai.tsx`
- `data/tro-choi/tu-lai.json`
- `scripts/e2e/tu-lai.ts`

**Migration**
- `0044_tu_lai.sql`: `INSERT INTO games`: `tu_lai`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test phát hiện lỗi: qua vạch dừng khi đèn đỏ bắt lỗi; khi đèn vàng đã qua vạch không bắt; quá tốc độ theo biển chỉ bắt khi vượt liên tục quá 1 giây; rẽ không xi nhan bắt đúng.
  - `packages/dao-tao/tests/tu-lai.test.ts`, 34 test. Kiểm thêm: xi nhan sai bên, rẽ nơi cấm rẽ, đi ngược chiều đường một chiều, đi sai phần đường, quay đầu, không nhường người đi bộ (có và không), va chạm, không nhường đường ở nơi giao nhau không đèn, ngã ba chưa chọn hướng.
  - Kiểm cả xe tự chạy không vào nơi giao nhau khi đèn đỏ và không va chạm nhau trên 3 khu phố mẫu trong 5 phút.
- [x] Unit test tất định: 20 nhật ký lái mẫu cho cùng băm trạng thái ở máy chủ và trong trình duyệt (E2E). Test của trò 3, 5, 8 vẫn đạt.
  - 20 nhật ký ngẫu nhiên theo seed, chạy lại hai lần và chạy từng thao tác như điện thoại: cùng băm.
  - E2E so băm máy chủ với băm điện thoại ở cả hai lượt.
  - Test trò 3, 5 vẫn đạt; trò 8 chưa làm.
- [x] Unit test chấm và biên bản: điểm không vượt 100, không dưới 0; sự kiện chưa có mức phạt đã duyệt ghi "Chưa có mức phạt đã duyệt".
- [x] API test: nhật ký có nhịp không tăng dần hoặc vượt thời lượng lượt bị chấm 0; chạy lại một lượt 5 phút dưới 200 ms.
  - `apps/api/src/tu-lai.test.ts`, 9 test. Nhịp lùi và thiếu chọn xe kiểm ở unit test (0 điểm).
  - Chạy lại 5 phút đo sau một lần làm nóng: 130–170 ms trên máy dev. Lần chạy nguội đầu tiên chừng 280 ms.
- [x] E2E 360px: lái từ A tới B bằng nút; giảm chuyển động không lắc khung.
  - `bun run e2e tu-lai` đạt (19 giây).
  - Màn 1: giữ nút Ga bằng con trỏ, 100 điểm, biên bản trắng, một dòng XP.
  - Màn 2 (giảm chuyển động): chỉ bàn phím, rẽ không xi nhan, biên bản có lỗi; xem lại là ảnh tĩnh, khung vẽ không tự chạy.
  - Khung nhìn giảm chuyển động đứng yên theo nửa khung; chưa có phép đo tự động riêng cho "không lắc".
- [ ] Hiệu năng: khu phố đầy đủ ≥ 50 khung hình/giây trên CPU chậm 4×.
  - E2E đo 58,7–59,1 khung/giây trên CPU chậm 4×, nhưng trên khu phố thử không có xe khác.
  - Chưa đo trên KP-03 (34 xe).
- [ ] **Đủ nội dung đã duyệt:** bảng ánh xạ sự kiện → mức phạt đã duyệt cho ô tô con và xe mô tô; ít nhất 3 khu phố.
  - Có 3 khu phố và bảng lỗi, nhưng là dữ liệu demo chưa duyệt.
  - Kho chưa có Luật số 36/2024/QH15 và Nghị định số 168/2024/NĐ-CP; 7/9 loại lỗi chưa có dòng mức phạt.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục). Đạt 6/8:
  - Đã đạt: test chấm và gian lận; bảo mật (người chơi lấy từ đăng nhập, 403, đề không có khóa cấm); cổng chung; chơi thử 360×740 hai chế độ (qua E2E, soát ảnh chụp); dữ liệu demo cùng hai bảng ở GAME_DESIGN §5.9; DEMO.md mục 7g.
  - Chưa đạt: mã riêng của trò chừng 21 KB gzip (cộng từng tệp; `tu-lai-pho.ts` 11 KB, trong đó bộ kiểm bản đồ nhiều chữ), vượt mức 12 KB; `bun run e2e` toàn bộ chưa chạy.

**Trạng thái (27/9/2026):** đã làm xong phần mã; trò tắt (`games.enabled = false`) cho tới khi có khu phố và bảng lỗi đã duyệt.
- **Cổng chung:**
  - `bun run typecheck` đạt mọi gói.
  - `bun test`: 1.407 đạt, 5 hỏng, cả 5 ở `packages/config/src/ports.test.ts` (hỏng từ trước).
  - `bun run e2e tu-lai` đạt; Biome sạch trên các tệp của trò.
  - `scripts/demo-tro-choi.ts` bước 8 chạy được trên CSDL demo: duyệt 3 khu phố và bảng lỗi.
- **Khác kế hoạch:**
  - 3 màn và 3 khu phố thay cho 5 màn và 5 khu phố (theo yêu cầu 3 bản đồ); mỗi màn gộp hai hàng của bảng màn §5.9.
  - Lưới ô khu phố nằm ở `tro-choi/tu-lai-pho.ts` (tệp mới), vì M9 thuộc GĐ-T6 chưa có.
  - Xe khác dùng M5 như đã có, **không sửa tệp nào của M5**: trò điều khiển xe từ bên ngoài qua trần tốc độ `v_max`. Lúc làm, GĐ-T5 đang sửa M5 song song.
  - Đèn tính ở trò (`mauDenPho`), chưa dùng `mo-phong/den.ts` của T5.
  - Bộ vẽ khu phố là tệp mới `lib/ve-canh/ve-pho.ts` (M6 mở rộng), không sửa tệp M6 cũ.
  - Không làm điều khiển nghiêng máy (D13): nút trái/phải là quyết định rời rạc (rẽ, chuyển làn, quay đầu).
  - Thêm một tên nguồn `tu_lai_ban_do` vào `NguonNoiDung` ở `khung.ts` (một dòng, như T3 và T5), và một dòng export ở `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts`.
- **Chưa làm:**
  - Trình soạn khu phố riêng và nút "Chơi thử" ở `/quan-tri/noi-dung-tro-choi`: khu phố soạn bằng ô JSON. Khu phố sai định dạng không vào lượt; lỗi chỉ hiện khi nạp bằng script.
  - Đo khung hình trên khu phố đầy đủ.
  - Giảm dung lượng mã (tách bộ kiểm bản đồ khỏi gói điện thoại).

---

## GĐ-T10 — Tái dựng hiện trường

**Mục tiêu**
- Người chơi dựng lại vị trí, hướng, tốc độ của các xe theo dấu vết, chạy mô phỏng kiểm chứng, kết luận lỗi.
- Mở rộng M5: va chạm, vết phanh, vị trí cuối.

**Thiết kế** (GAME_DESIGN §5.10)
- Dấu vết trên sơ đồ do M5 tính từ dựng cảnh gốc, không vẽ tay.
- Chấm: độ khớp dấu vết tối đa 50, kết luận đúng 40, số lần mô phỏng tối đa 10.
- Ghi rõ "Mô phỏng minh họa để học cách đọc dấu vết, không phải phương pháp giám định".
- Căn cứ về xử lý tai nạn chờ khách hàng (câu D10); trong lúc chờ chỉ có kịch bản demo đơn giản.

**Việc làm**
1. M5: va chạm theo hộp bao, vết phanh theo tốc độ và mặt đường (bảng tra cố định), vị trí cuối.
2. Trò `tai-dung.ts`: đo độ khớp dấu vết, chấm kết luận.
3. Giao diện kéo thả xe, xoay theo hướng rời rạc, chọn mức tốc độ, phủ kết quả lên dấu vết; trình soạn dựng cảnh gốc.
4. Soạn 5 kịch bản demo.

**File sửa**
- `packages/dao-tao/src/mo-phong/*` (phần mở rộng đã ghi trong kế hoạch)
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx` (mỗi tệp một dòng)

**File tạo**
- `packages/dao-tao/src/mo-phong/va-cham.ts`, `packages/dao-tao/src/tro-choi/tai-dung.ts`
- `packages/dao-tao/tests/va-cham.test.ts`, `tai-dung.test.ts`
- `apps/api/src/tai-dung.test.ts`
- `apps/web/app/components/tro-choi/TaiDung.tsx`, `apps/web/app/components/quan-tri/tro-choi/SoanDungCanh.tsx`
- `data/tro-choi/tai-dung.json`
- `scripts/e2e/tai-dung.ts`

**Migration**
- `0045_tai_dung.sql`: `INSERT INTO games`: `tai_dung_hien_truong`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test va chạm: dựng cảnh gốc chạy lại luôn ra đúng dấu vết đã lưu; tốc độ cao hơn thì vết phanh dài hơn; hai xe không chạm thì không có va chạm.
  - `packages/dao-tao/tests/va-cham.test.ts`, 11 ca. Kiểm thêm: mặt đường trơn hơn vết dài hơn, độ dài gần v²/(2a); đâm đuôi một va chạm, hai xe trượt rồi dừng, không xoay; đâm ngang xoay đúng chiều; chạm vật cố định dừng ngay, chậm một mức thì không chạm; rẽ, chuyển làn; chạy từng nhịp (như điện thoại) và chạy một lần (như máy chủ) cùng băm.
- [x] Unit test chấm: dựng đúng cảnh gốc được đủ 50 điểm khớp; lệch vị trí cuối tăng dần thì điểm giảm đơn điệu; số lần mô phỏng tính đúng. Test của trò 3, 5, 8, 9 vẫn đạt.
  - `packages/dao-tao/tests/tai-dung.test.ts`, 17 ca: cả 5 vụ mẫu dựng đúng được 100/100; lệch từng 1 m điểm giảm ngặt tới 10 m rồi bằng 0; 0, 3, 5, 20 lần mô phỏng cho 90, 100, 95, 90 điểm; kết luận (đúng xe sai lỗi, sai xe, hai lỗi, thẻ sai); ca gian lận (điểm máy khách gửi, đặt xe ngoài sơ đồ, quá 3 thẻ, xe lạ, gỡ thẻ chưa gắn, mốc thời gian sai); chấm dưới 200 ms.
  - Test M5 của trò 3, 5, 9, 15 vẫn đạt (toàn bộ `bun test`). Trò 8 chưa làm.
- [x] Unit test kiểm kịch bản: dựng cảnh gốc không sinh va chạm, hoặc lỗi đúng không có mã mức phạt, bị báo lỗi.
  - Kiểm thêm: xe chồng nhau lúc đầu, xe chạy ra khỏi sơ đồ, thiếu vị trí, lỗi trỏ xe không có (báo đúng phần tử); đặc trưng màn 1, 3, 5.
- [x] API test: đề không có dựng cảnh gốc; mô phỏng thứ 21 trong một lượt bị từ chối (chống dò).
  - `apps/api/src/tai-dung.test.ts`, 7 ca: trò tắt sẵn trong migration; đề không có khóa cấm (`dung_canh`, `loi`, `ma_muc_phat`, `hanh_dong`, `noi_dung`…); vụ chờ duyệt không vào lượt; người khác đọc lượt nhận 403; điểm máy khách gửi bị bỏ qua, băm máy chủ khớp máy khách, biên bản có mức phạt đã duyệt, XP một lần; nhật ký 21 lần mô phỏng nhận 400, 20 lần vẫn chấm; nhật ký sai dạng 400, mốc thời gian sai 0 điểm; sửa dòng mức phạt thì vụ rút khỏi trò; đồng bộ offline chấm lại, gửi lại không sinh lượt mới.
- [x] E2E 360px: kéo xe, xoay, chọn tốc độ, mô phỏng, kết luận; giảm chuyển động thì kết quả mô phỏng hiện ngay vị trí cuối.
  - `bun run e2e tai-dung` đạt hai lần liền (khoảng 10 giây). Màn 1 chế độ thường: chạm đặt xe, kéo xe trên sơ đồ, nút mũi tên, xoay, tốc độ, hành động; mô phỏng với CPU chậm 4× đạt 58–59 khung/giây (p95 16,8 ms); kéo thẻ lỗi; 100 điểm, băm khớp, một dòng XP, chi tiết chỉ trong "Xem chi tiết".
  - Màn 2 giảm chuyển động: phím mũi tên, kết quả mô phỏng hiện ngay, không có hoạt cảnh, khung vẽ đứng yên; gắn thẻ chạm-chạm.
- [ ] **Đủ nội dung đã duyệt:** căn cứ đã được khách hàng cung cấp; ít nhất 4 kịch bản. **Mốc M5:** đủ 10 trò bật trên máy demo.
  - Có 5 vụ, nhưng là dữ liệu demo chưa duyệt. Căn cứ về xử lý tai nạn chưa có (câu D10); tra kho ngày 30/9/2026 không có kết quả. 3 dòng mức phạt mới là số minh họa.
  - Mốc M5 chưa đạt: trò 2, 6, 7, 8 chưa làm.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục). Đạt 7/8:
  - Đã đạt: test chấm và gian lận; bảo mật (người chơi lấy từ đăng nhập, 403, đề không có khóa cấm, `phan-quyen.test.ts` vẫn đạt); cổng chung; chơi thử 360×740 hai chế độ (qua E2E, soát ảnh chụp); dữ liệu demo và hai bảng ở GAME_DESIGN §5.10; DEMO.md mục 7p; tóm tắt để commit.
  - Chưa đạt: mã riêng của trò 14,4 KB gzip (giao diện `TaiDung.tsx` 6,8 KB, bộ vẽ 1,3 KB, luật `tai-dung.ts` 6,4 KB, trong đó bộ kiểm vụ nhiều chữ), vượt mức 12 KB; phần M5 mới `va-cham.ts` 2,1 KB không tính. Khung hình đạt (58–59 khung/giây trên CPU chậm 4×).

**Trạng thái (30/9/2026):** đã làm xong phần mã; trò tắt (`games.enabled = false`) cho tới khi có căn cứ do khách hàng cung cấp và vụ đã duyệt.
- **Cổng chung:**
  - `bun run typecheck` đạt mọi gói.
  - `bun test`: 1.784 đạt, 7 bỏ qua, 5 hỏng, cả 5 ở `packages/config/src/ports.test.ts` (hỏng từ trước trên Windows).
  - `bun run build:web` đạt (trong bước build của E2E); `bun run e2e tai-dung` đạt; Biome sạch trên các tệp của giai đoạn.
  - `scripts/demo-tro-choi.ts` bước 15 chạy được trên CSDL demo: duyệt 3 dòng mức phạt và 5 vụ, bật trò.
- **Câu D10:** áp dụng như kế hoạch (câu này không có phương án khác): làm phần mã với kịch bản demo, ghi rõ "mô phỏng minh họa" trên màn hình và ở màn kết quả.
- **Khác kế hoạch:**
  - M5 mở rộng bằng tệp mới `mo-phong/va-cham.ts` (một dòng export ở `mo-phong/index.ts`), không sửa vòng bước cũ của `mo-phong.ts`: xe của trò này đặt tự do theo tâm, không đi theo làn. Lúc làm, phiên GĐ-T17 đang chạy song song và dùng M5.
  - Số lần mô phỏng: không mô phỏng lần nào được 0 điểm phần này (thiết kế ghi "≤ 3 lần +10"), để không cho điểm khi chưa kiểm chứng; nút "Chốt kết luận" cần ít nhất một lần mô phỏng. Chống dò: nhật ký có lần mô phỏng thứ 21 bị từ chối (400).
  - Khớp dấu vết chia 25 vị trí cuối, 15 vết bánh, 10 hướng cuối; ngưỡng 10 m, 8 m; kết luận tối đa 3 thẻ, thẻ sai −10 (GAME_DESIGN §5.10, "Đã làm").
  - Sơ đồ soạn theo mẫu (đoạn thẳng, ngã tư), không vẽ tự do; đèn và biển chỉ để đọc, không vào mô phỏng.
  - Thêm 3 dòng mức phạt nháp (khoảng cách, chuyển làn, nhường đường, số tiền minh họa) vào `data/tra-cuu/muc-phat.json`, vì lỗi đúng bắt buộc có mã mức phạt; như GĐ-T13, T14 đã làm.
  - Trình soạn gắn vào `routes/quan-tri.noi-dung-tro-choi.sua.tsx` (một nhánh, như T3, T5).
  - Trường lời kể tên `ke`, không dùng `noi_dung` (trùng khóa cấm chung của test API).
- **Tệp đã làm:**
  - Migration `0045_tai_dung.sql`.
  - `packages/dao-tao`: `mo-phong/va-cham.ts`, `tro-choi/tai-dung.ts`; sửa `mo-phong/index.ts`, `tro-choi/khung.ts` (tên nguồn `tai_dung_vu`), `tro-choi/dang-ky.ts`, `index.ts`.
  - `packages/db`: `tai-dung.ts`; sửa `nguon-tro-choi.ts`, `index.ts`, `seed-tro-choi.ts`.
  - Web: `components/tro-choi/TaiDung.tsx`, `components/quan-tri/tro-choi/SoanDungCanh.tsx`, `lib/tai-dung.ts`, `lib/ve-canh/ve-tai-dung.ts`; sửa `components/tro-choi/giao-dien.tsx`, `routes/quan-tri.noi-dung-tro-choi.sua.tsx`.
  - Dữ liệu: `data/tro-choi/tai-dung.json` (5 vụ demo); sửa `data/tra-cuu/muc-phat.json` (3 dòng).
  - Script: `scripts/e2e/tai-dung.ts`; sửa `scripts/demo-tro-choi.ts` (bước 15).
  - Test: `packages/dao-tao/tests/va-cham.test.ts`, `tai-dung.test.ts`; `apps/api/src/tai-dung.test.ts`.
- **Chưa làm:** huy hiệu "Đọc dấu vết" (§6, không có trong việc làm của giai đoạn); giảm dung lượng mã (tách bộ kiểm vụ khỏi gói điện thoại).

---

*Các giai đoạn GĐ-T11 đến GĐ-T20 thêm ngày 28/9/2026 cho 10 trò ở PRD mục V.5. Mỗi giai đoạn làm trong một phiên riêng theo prompt ở [PROMPT_TRO_CHOI_MOI.md](PROMPT_TRO_CHOI_MOI.md) mục 3, sau khi đã trả lời các câu D15 đến D32 (GAME_DESIGN §8). Mọi giai đoạn dưới đây đều sửa một dòng ở `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx`, một tên nguồn ở `NguonNoiDung` của `khung.ts` (như T3, T5, T9 đã làm), một dòng export ở `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts`, và phần nạp mẫu ở `packages/db/src/seed-tro-choi.ts`, `scripts/demo-tro-choi.ts`, `DEMO.md`. Các tệp này không nhắc lại ở từng giai đoạn.*

---

## GĐ-T11 — Duyệt hồ sơ phạt nguội

**Mục tiêu**
- Người chơi thẩm định hồ sơ vi phạm do camera ghi lại: vuốt trái để gửi thông báo, vuốt phải để trả lại và chạm đúng chỗ thiếu.

**Thiết kế** (GAME_DESIGN §5.11; câu D15, D16, D32 đã trả lời theo đề xuất ngày 28/9/2026)
- Mỗi hồ sơ là một bước. Hồ sơ đủ căn cứ tối đa 10 điểm; hồ sơ không đủ căn cứ 10 + 5 mỗi chỗ thiếu; chạm nhầm −2 trong phần chỉ chỗ thiếu; điểm bước không âm (D15).
- Đáp án suy ra từ luật kiểm hồ sơ đã duyệt ở `document_rules` nhóm `ho_so_phat_nguoi` (D16). Hồ sơ mà luật cho kết quả khác dự kiến không vào lượt.
- Biển số làm nhiễu ở máy chủ; đề không có trường nào cho biết hồ sơ đủ hay không đủ căn cứ.
- Thông báo vi phạm dựng bằng M4 (`BienBan` với tiêu đề riêng, không sửa M4).

**Việc làm**
1. Tra kho văn bản: sử dụng dữ liệu thu từ thiết bị kỹ thuật nghiệp vụ để phát hiện vi phạm, thủ tục gửi thông báo, yêu cầu kiểm định thiết bị. Ghi URN tìm được và phần chưa có vào bảng cần kiểm ở GAME_DESIGN §5.11.
2. Luật kiểm hồ sơ theo D16: sửa bộ kiểm luật của M1 (đã hỏi, người dùng đồng ý); soạn `data/tra-cuu/luat-ho-so-phat-nguoi.json` (demo, chưa duyệt), nạp ở `cho_duyet`.
3. Logic thuần `tro-choi/duyet-phat-nguoi.ts`: kiểm hồ sơ theo luật, dựng đề (biển số nhiễu), chấm.
4. Dữ liệu: nguồn nội dung và nạp mẫu ở `packages/db/src/duyet-phat-nguoi.ts`; 30 hồ sơ demo ở `data/tro-choi/phat-nguoi.json`.
5. Web: thẻ hồ sơ, ảnh vi phạm dựng từ tham số, vuốt bằng `Vuot` (M2), màn kết quả có thông báo vi phạm.

**File sửa**
- `packages/dao-tao/src/tro-choi/chung/giay-to.ts` (M1: nhóm luật, bộ kiểu kiểm của nhóm hồ sơ phạt nguội; đã hỏi)
- `packages/dao-tao/src/tro-choi/khung.ts` (một tên nguồn `phat_nguoi_ho_so`), `dang-ky.ts` (một dòng), `packages/dao-tao/src/index.ts`
- `packages/db/src/kiem-tra-giay-to.ts` (nạp luật theo nhóm, đọc luật giấy tờ chỉ nhóm `giay_to_nguoi_lai`), `packages/db/src/du-lieu-tra-cuu.ts`, `nguon-tro-choi.ts` (một dòng), `seed-tro-choi.ts` (một dòng), `packages/db/src/index.ts`
- `apps/api/src/routes/du-lieu-tra-cuu.ts`, `apps/web/app/routes/quan-tri.du-lieu-tra-cuu.tsx` (lọc luật theo nhóm)
- `apps/web/app/components/tro-choi/giao-dien.tsx` (một mục)
- `scripts/tra-cuu-nhanh.ts` (nạp luật hồ sơ), `scripts/check-citations.ts` (chú thích), `scripts/demo-tro-choi.ts` (bước 9)

**File tạo**
- `packages/dao-tao/src/tro-choi/duyet-phat-nguoi.ts`, `duyet-phat-nguoi-kiem.ts` (bộ kiểm dạng hồ sơ, chỉ máy chủ dùng), `packages/dao-tao/tests/duyet-phat-nguoi.test.ts`
- `packages/db/src/duyet-phat-nguoi.ts`
- `apps/api/src/duyet-phat-nguoi.test.ts`
- `apps/web/app/components/tro-choi/DuyetPhatNguoi.tsx`, `apps/web/app/lib/duyet-phat-nguoi.ts`
- `data/tra-cuu/luat-ho-so-phat-nguoi.json`, `data/tro-choi/phat-nguoi.json`
- `scripts/e2e/duyet-phat-nguoi.ts`

**Migration**
- `0046_phat_nguoi.sql`: `document_rules` thêm `nhom text NOT NULL DEFAULT 'giay_to_nguoi_lai'` (CHECK `document_rules_nhom_check`), nới CHECK `check_kind`, `doc_kind` cho nhóm `ho_so_phat_nguoi`, index `(nhom, status, effective_from)`; `INSERT INTO games`: `duyet_phat_nguoi`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test chấm: cùng hồ sơ cùng đáp án ở máy khách và máy chủ; hồ sơ không đủ căn cứ chỉ đúng 1 và 2 chỗ; chạm nhầm −2 không làm điểm bước âm; gửi nhầm mất nhiều điểm hơn trả nhầm.
  - `packages/dao-tao/tests/duyet-phat-nguoi.test.ts`, 19 ca, chạy trên chính 6 luật và 30 hồ sơ mẫu. "Máy khách và máy chủ": ảnh chụp lượt qua JSON (như gói offline), chấm lại cho kết quả và đề giống hệt.
- [x] Unit test luật: mỗi kiểu kiểm phát hiện đúng lỗi của nó; luật chưa duyệt thì hồ sơ cần luật đó không vào lượt; ký tự dễ nhầm (8/B, 0/D) và thời điểm ngoài khung giờ cấm được kiểm đúng.
  - Có thêm: biên khung giờ (đúng giờ bắt đầu là trong giờ, đúng giờ kết thúc là ngoài giờ); hết hạn kiểm định đúng ngày ghi hình vẫn còn hạn; ảnh không rõ thì không báo thêm "hành vi không khớp"; luật sai cặp kiểu kiểm và phần bị M1 báo lỗi.
- [x] API test: vuốt phải kèm cờ `dung: true` từ máy khách thì cờ bị bỏ qua; trả lại mà không chỉ chỗ thiếu nhận 400; đề không có khóa cấm và không có trường độ rõ biển số, `loi_du_kien`, mã luật.
  - `apps/api/src/duyet-phat-nguoi.test.ts`, 7 ca. Có thêm: chỉ màn 1 mở; hồ sơ chờ duyệt không vào lượt; người khác đọc lượt nhận 403; thông báo vi phạm lấy mức phạt từ dòng mức phạt đã duyệt; XP một lần; tab luật lọc theo nhóm (nhóm lạ nhận 400); sửa luật `pn-thay-hanh-vi` thì hồ sơ rút khỏi trò, pháp chế duyệt lại thì chơi được.
- [x] API test offline: đồng bộ một ca hai lần chỉ sinh một lượt; máy chủ chấm lại.
- [x] `bun run e2e duyet-phat-nguoi`: chơi màn 1–2 ở 360×740, một màn bằng vuốt, một màn bằng nút thay thế ở chế độ giảm chuyển động.
  - Đạt (khoảng 30 giây). Màn 1 bằng chuột kéo trên ô vuốt: vuốt trái khi chưa chạm chỗ thiếu chỉ hiện lời nhắc; hồ sơ gửi đúng có "Thông báo vi phạm (mô phỏng)". Màn 2 bằng nút ở chế độ giảm chuyển động: nút "Trả lại" khóa khi chưa chạm, thẻ chỉ hiện dần.
- [ ] **Đủ nội dung đã duyệt:** luật hồ sơ đã được đơn vị xác nhận; ít nhất 20 hồ sơ phủ 6 loại chỗ thiếu; mã mức phạt của hành vi đề xuất đã duyệt.
  - **Chưa làm được:** 6 luật và 30 hồ sơ là dữ liệu demo, chưa duyệt (30 hồ sơ đã phủ đủ 6 loại chỗ thiếu). Kho văn bản chưa có văn bản nào về dữ liệu từ thiết bị kỹ thuật nghiệp vụ, thông báo vi phạm, kiểm định thiết bị; URN trong luật là dự kiến. Đi sai làn, đi vào đường cấm theo giờ chưa có dòng mức phạt. Danh sách cần kiểm ở GAME_DESIGN §5.11. Trò đang tắt.
- Mục kiểm tra chung GĐ-T:
  - [x] Test chấm điểm: như trên.
  - [x] API test bảo mật: điểm và cờ đúng máy khách gửi bị bỏ qua; người khác đọc lượt nhận 403; phản hồi trước khi chấm không có khóa cấm (`loi`, `luat`, `bien_ban`, `loi_du_kien`, `dap_an`, `giai_thich`, `can_cu`, `answer`, `noi_dung`, `ky_tu_mo`, `cho_thieu`, `thong_bao`, `ma_muc_phat`, `muc`); `phan-quyen.test.ts` vẫn đạt.
  - [x] Cổng chung: `bun run typecheck` đạt; `bun test` 1433 đạt, 5 hỏng (cả 5 ở `ports.test.ts`, lỗi môi trường Windows có từ trước); `bun run build:web` qua; Biome qua với các tệp của giai đoạn. E2E `duyet-phat-nguoi`, `kiem-tra-giay-to`, `dung-xe`, `soi-camera`, `tro-choi-khung`, `offline` đạt.
    - Một lần chạy `bun test` trước đó có thêm ca "Tự lái: tất định > 20 nhật ký mẫu" hỏng vì quá giờ 5 giây khi máy tải nặng (5,2 giây); chạy riêng và chạy lại toàn bộ đều đạt. Tệp của trò 9 không bị sửa.
  - [x] Chơi thử một lượt đầy đủ ở 360×740, chế độ thường (màn 1, vuốt) và giảm chuyển động (màn 2, nút), qua E2E và soát ảnh chụp.
  - [ ] Hiệu năng CPU chậm 4×; mã riêng ≤ 8 KB gzip.
    - **Chưa đo** CPU chậm 4×. Trò không có hoạt cảnh liên tục: ảnh là SVG tĩnh, chỉ thẻ nghiêng theo ngón tay và bay ra (`transform`, `opacity`).
    - **Chưa đạt ngân sách:** mã riêng khoảng 8,8 KB gzip (giao diện 4,3 KB, logic 4,5 KB, đo bằng `bun build --minify`, không tính mô-đun dùng chung), vượt 0,8 KB. Đã tách bộ kiểm dạng hồ sơ sang `duyet-phat-nguoi-kiem.ts` (chỉ máy chủ dùng) để giảm từ khoảng 10 KB.
  - [x] Dữ liệu mẫu đánh dấu "demo, chưa duyệt"; bảng cần kiểm tra và hình cần bổ sung ở GAME_DESIGN §5.11 cập nhật theo thực tế.
  - [x] DEMO.md có dòng màn hình và cách chơi thử (mục 7h).
  - [x] Có bản tóm tắt thay đổi để người dùng commit.

**Trạng thái (28/9/2026):** đã làm xong phần mã. Còn ba mục chưa đạt: nội dung đã duyệt (chờ văn bản và đơn vị chuyên môn), đo hiệu năng CPU chậm 4×, ngân sách mã riêng (8,8/8 KB gzip).
- Quyết định của người dùng khi làm giai đoạn này:
  - D15: điểm tối đa không đều, không sửa khung.
  - D16: dùng lại `document_rules`, **đồng ý sửa M1** (`giay-to.ts`): thêm `NHOM_LUAT`, `KIEU_KIEM_PHAT_NGUOI`, `PHAN_HO_SO_PHAT_NGUOI`, `CHO_THIEU_PHAT_NGUOI`, `choThieuCuaLuat`, kiểu `LuatHoSoPhatNguoi`; `kiemTraLuatGiayTo` chọn bộ kiểm theo `nhom`. Luật nhóm cũ giữ nguyên hành vi; test M1, T1, T4 vẫn đạt.
  - D32: chấp nhận cách tách trùng lặp ở §5.21.
- Thay đổi so với dự kiến:
  - Sửa thêm hai tệp dữ liệu của T1 vì cột `nhom`: `packages/db/src/kiem-tra-giay-to.ts` (`napLuatGiayTo` nhận nhóm và chỉ chuyển sang ngừng luật cùng nhóm; `luatGiayToDaDuyet` chỉ đọc nhóm giấy tờ người lái) và câu đếm luật ở `scripts/demo-tro-choi.ts`. Không sửa thì script nạp tra cứu sẽ chuyển luật của nhóm kia sang ngừng.
  - `Vuot` không sửa: thẻ nghiêng theo ngón tay đọc độ dời từ sự kiện con trỏ nổi lên từ ô vuốt.
  - Ảnh vi phạm vẽ bằng SVG tĩnh trong `DuyetPhatNguoi.tsx`, không dùng `lib/ve-canh/ve-camera.ts` (Canvas, cần phép chiếu M5).
  - Hệ thống đọc sai ký tự (8/B, 0/D) xếp chung vào "biển số không đọc được" (bảng cần kiểm, dòng 5). Ví dụ "đèn vàng" của màn 3 đổi thành "đèn xanh" (bảng cần kiểm, dòng 8).
  - Màn 2 không tính giờ, màn 3–4 4 phút, màn 5 4 phút 30 giây, như đề xuất. XP cơ bản 10, 12, 14, 16, 18.
  - Chưa có trình soạn hồ sơ riêng: soạn bằng trình soạn JSON mặc định ở `/quan-tri/noi-dung-tro-choi`. Hồ sơ mẫu soạn bằng script tạm, tự kiểm bằng bộ luật trước khi ghi tệp; không để script trong repo.
  - Biome sắp lại thứ tự dòng `export` ở `packages/dao-tao/src/index.ts`, `packages/db/src/index.ts` (dòng `soi-camera`, `moPhong` đổi chỗ, không đổi nội dung).
- Tệp đã làm: xem "File sửa", "File tạo", "Migration" ở trên.

---

## GĐ-T12 — Trạm cân tải trọng

**Mục tiêu**
- Người chơi ghim cặp số làm căn cứ, ước phần trăm vượt, đóng một trong ba dấu cho từng xe tải.
- Mở rộng M1 (giấy chứng nhận kiểm định, phiếu cân, giấy phép lưu hành xe quá tải) và M2 (đóng dấu nhận danh sách lựa chọn).

**Thiết kế** (GAME_DESIGN §5.12; câu D15, D17, D18 đã trả lời theo đề xuất ngày 28/9/2026)
- Mỗi xe là một bước, tối đa 18 điểm: dấu đúng 10, ghim đúng cặp số quyết định 5, phần trăm ước trong ±2 điểm phần trăm 3.
- Ngưỡng ở `load_limits`, khung phần trăm ở `violations` (D17); không đặt hằng số trong mã. Máy chủ tính lại phần trăm từ số trong đề.
- Đúng bằng ngưỡng tính không vượt (đề xuất, đưa vào bảng cần kiểm). Hiện hiệu số kg sau khi ghim (D18a). "Hạ tải" cho xe vượt chưa tới khung bị xử phạt, "Lập biên bản" gồm cả buộc hạ tải, đánh dấu demo (D18b).

**Việc làm**
1. Tra kho văn bản: tải trọng trục, tổng trọng lượng theo loại xe, giấy phép lưu hành xe quá tải, xử phạt chở hàng vượt khối lượng cho phép theo khung phần trăm. Ghi vào bảng cần kiểm ở GAME_DESIGN §5.12.
2. `load_limits` và tab "Tải trọng" ở `/quan-tri/du-lieu-tra-cuu`; `data/tra-cuu/tai-trong.json` (demo, chưa duyệt); thêm dòng mức phạt quá tải có khung phần trăm vào `data/tra-cuu/muc-phat.json` (demo).
3. M1 (đã hỏi, người dùng đồng ý): ba loại giấy mới. M2 (đã hỏi, người dùng đồng ý): `NutDongDau` nhận danh sách lựa chọn và nhãn; T1 giữ nguyên hai dấu.
4. Logic thuần `tro-choi/tram-can.ts`: tính phần trăm theo cặp số, tìm cặp quyết định, suy dấu đúng, chấm.
5. Web: hình xe có trục, phiếu và giấy (M1), ghim số, thanh trượt, ba dấu; 30 xe demo.

**File sửa**
- `packages/dao-tao/src/tro-choi/chung/giay-to.ts` (M1), `apps/web/app/components/tro-choi/chung/GiayTo.tsx`, `giay-to.css` (M1), `apps/web/app/components/tro-choi/chung/tuong-tac/DongDau.tsx` (M2)
- `packages/dao-tao/src/tra-cuu-nhanh.ts` (khung quá tải trong dòng mức phạt, kiểm chồng khung), `packages/db/src/tra-cuu-nhanh.ts` (ghi bốn cột quá tải như `speed_over_min/max`), `data/tra-cuu/muc-phat.json` (thêm 8 dòng, không đổi dòng cũ)
- `packages/db/src/du-lieu-tra-cuu.ts` (loại `tai-trong`), `apps/api/src/routes/du-lieu-tra-cuu.ts`, `apps/web/app/routes/quan-tri.du-lieu-tra-cuu.tsx` (tab mới)
- `packages/dao-tao/src/tro-choi/khung.ts` (một tên nguồn `tram_can_xe`), `dang-ky.ts`, `packages/dao-tao/src/index.ts`, `packages/db/src/nguon-tro-choi.ts`, `seed-tro-choi.ts`, `packages/db/src/index.ts`, `apps/web/app/components/tro-choi/giao-dien.tsx` (mỗi tệp một dòng hoặc một mục)
- `scripts/tra-cuu-nhanh.ts`, `scripts/check-citations.ts`, `scripts/demo-tro-choi.ts` (bước 10)

**File tạo**
- `packages/dao-tao/src/tro-choi/tram-can.ts`, `tram-can-kiem.ts` (bộ kiểm dạng xe và tệp tải trọng, chỉ máy chủ dùng), `packages/dao-tao/tests/tram-can.test.ts`
- `packages/db/src/tram-can.ts`
- `apps/api/src/tram-can.test.ts`
- `apps/web/app/components/tro-choi/TramCan.tsx`, `apps/web/app/lib/tram-can.ts`
- `data/tra-cuu/tai-trong.json`, `data/tro-choi/tram-can.json`
- `scripts/e2e/tram-can.ts`

**Migration**
- `0047_tram_can.sql`: `load_limits` (vòng đời duyệt như `speed_limits`, `citation_urn`, hiệu lực; CHECK loại, loại xe, cụm trục); `violations` thêm `qua_tai_loai`, `qua_tai_tu`, `qua_tai_den`, `qua_tai_bien` (CHECK `violations_qua_tai_check`); `content_reviews.kind` nhận `load_limit` (CHECK liệt kê đủ giá trị đã có); `INSERT INTO games`: `tram_can`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test chấm: ca biên đúng bằng ngưỡng; vượt 0,1 điểm phần trăm; phần trăm ước lệch 2 và 2,1 điểm phần trăm; xe không vượt cho đi đủ 18 điểm.
  - `packages/dao-tao/tests/tram-can.test.ts`, 17 ca, chạy trên chính tệp tải trọng, 8 dòng mức phạt quá tải và 30 xe mẫu. Ca biên: đúng bằng giới hạn (0%) cho đi; vượt đúng 10% hạ tải; vượt 10,1% lập biên bản. Có thêm: cặp đúng loại nhưng không phải cặp quyết định được 0 điểm cặp; cặp với bảng tại trạm khi có giấy phép hợp lệ không được tính; điểm bước không âm.
- [x] Unit test dữ liệu: ngưỡng đổi sau khi duyệt lại thì đáp án đổi theo; ngưỡng chưa duyệt thì xe cần ngưỡng đó không vào lượt; khung phần trăm chọn đúng dòng `violations`.
  - Có thêm: xe có hai cặp vào hai khung (cầu đường và giấy kiểm định) thì biên bản có hai dòng; chưa có khung nào của loại quá tải đang xét thì xe không vào lượt; giấy phép hết hạn, sai tuyến thì áp bảng tại trạm.
- [x] Unit test M1 mở rộng: test cũ của trò 1 và trò 4 vẫn đạt.
  - `giay-to.test.ts`, `kiem-tra-giay-to.test.ts`, `dung-xe.test.ts`, `duyet-phat-nguoi.test.ts` đạt; ca mới kiểm `kiemTraGiayToXeTai`.
- [x] API test: máy khách gửi phần trăm tự tính thì máy chủ vẫn tính lại; đề không có ngưỡng, khung, dấu đúng.
  - `apps/api/src/tram-can.test.ts`, 7 ca. Có thêm: không có cặp số căn cứ hoặc ước ngoài 0–200 nhận 400; người khác đọc lượt nhận 403; trả lời đúng được 18 điểm mỗi xe, xe lập biên bản có biên bản; XP một lần; tab "Tải trọng": sửa giới hạn về chờ duyệt, xe cần nó không vào lượt ở màn 3 (vẫn chơi được ở màn 2), biên tập nhận 403 khi duyệt, pháp chế duyệt thì đáp án đổi (lập biên bản thành cho đi); lịch sử duyệt loại `load_limit`.
  - "Đề không có ngưỡng": khung phần trăm, dấu, cặp quyết định không có trong đề. Bảng tải trọng tại trạm (các dòng `load_limits`) có trong đề từ màn 3: khác thiết kế ban đầu, xem GAME_DESIGN §5.12.
- [x] `bun run e2e tram-can`: màn 1–2 ở 360×740, ghim bằng chạm và bằng bàn phím, thanh trượt dùng được bằng phím mũi tên. E2E của trò 1 vẫn đạt (M2 đóng dấu).
  - Đạt (khoảng 18 giây). Màn 1: ghim bằng chạm, ước bằng nút "+"; dấu khóa khi chưa ghim; xe lập biên bản có biên bản. Màn 2 ở chế độ giảm chuyển động: ghim bằng Enter trên dòng số, ước bằng phím mũi tên trên thanh trượt. E2E `kiem-tra-giay-to`, `dung-xe`, `duyet-phat-nguoi` vẫn đạt.
- [ ] **Đủ nội dung đã duyệt:** `load_limits` cho xe 2, 3, 4 trục và đầu kéo; khung phần trăm quá tải đã duyệt; ít nhất 20 xe.
  - **Chưa làm được:** 10 giới hạn, 8 khung phần trăm và 30 xe là dữ liệu demo, chưa duyệt; con số, khung, số tiền là số minh họa. Kho văn bản chưa có văn bản về tải trọng, giấy phép lưu hành, xử phạt quá tải. Danh sách cần kiểm ở GAME_DESIGN §5.12. Trò đang tắt.
- Mục kiểm tra chung GĐ-T:
  - [x] Test chấm điểm: như trên.
  - [x] API test bảo mật: điểm, phần trăm, cờ đúng máy khách gửi bị bỏ qua; người khác đọc lượt nhận 403; phản hồi trước khi chấm không có khóa cấm (`answer`, `dap_an`, `giai_thich`, `can_cu`, `noi_dung`, `khung`, `khung_ma`, `dau`, `quyet`, `cap`, `bien_ban`, `muc_phat`, `phan_tram`, `muc`); `phan-quyen.test.ts` vẫn đạt.
  - [x] Cổng chung: `bun run typecheck` đạt; `bun test` 1457 đạt, 5 hỏng (cả 5 ở `ports.test.ts`, lỗi môi trường Windows có từ trước); `bun run build:web` qua; Biome qua với các tệp của giai đoạn; E2E `tram-can`, `kiem-tra-giay-to`, `dung-xe`, `duyet-phat-nguoi` đạt.
  - [x] Chơi thử một lượt đầy đủ ở 360×740, chế độ thường (màn 1) và giảm chuyển động (màn 2), qua E2E và soát ảnh chụp.
  - [ ] Hiệu năng CPU chậm 4×; mã riêng ≤ 8 KB gzip.
    - **Chưa đo** CPU chậm 4×. Trò không có hoạt cảnh liên tục: hình xe SVG tĩnh, chỉ có hiện dần và đập dấu.
    - Mã riêng khoảng 7,9 KB gzip (giao diện 3,9 KB, logic 4,0 KB, đo bằng `bun build --minify`, không tính M1, M2 dùng chung): **trong ngân sách**.
  - [x] Dữ liệu mẫu đánh dấu "demo, chưa duyệt"; bảng cần kiểm tra và hình cần bổ sung ở GAME_DESIGN §5.12 cập nhật theo thực tế.
  - [x] DEMO.md có dòng màn hình và cách chơi thử (mục 7i).
  - [x] Có bản tóm tắt thay đổi để người dùng commit.

**Trạng thái (28/9/2026):** đã làm xong phần mã. Còn hai mục chưa đạt: nội dung đã duyệt (chờ văn bản và đơn vị chuyên môn) và đo hiệu năng CPU chậm 4×.
- Quyết định của người dùng khi làm giai đoạn này:
  - D17: bảng mới `load_limits`, khung phần trăm ở `violations`.
  - D18: (a) hiện hiệu số kg, không hiện phần trăm; (b) giữ ba dấu, ý nghĩa demo như trên.
  - **Đồng ý sửa M1** (ba loại giấy xe tải, thẻ dùng chung, không đưa vào `LoaiGiayTo` của trò 1) và **M2** (`NutDongDau`, `DauMoc` nhận dấu và nhãn do trò truyền; không truyền thì giữ hai dấu của trò 1).
- Thay đổi so với dự kiến:
  - **Gửi bảng tải trọng tại trạm xuống điện thoại từ màn 3** (các dòng `load_limits` áp cho loại xe). Thiết kế cũ ghi không gửi ngưỡng; không có bảng thì không có số giới hạn nào để ghim khi so tải trọng trục. Bảng gửi mọi dòng cụm trục nên chọn đúng dòng theo khoảng cách trục vẫn là kỹ năng.
  - `violations` thêm bốn cột thay vì hai: thêm `qua_tai_loai` (khung thuộc loại quá tải nào) và `qua_tai_bien` (cận có gồm biên không).
  - Sửa `packages/dao-tao/src/tra-cuu-nhanh.ts` (bộ kiểm tệp mức phạt nhận khung quá tải, kiểm chồng khung), ngoài danh sách "File sửa" ban đầu.
  - Dòng mức phạt quá tải ghi căn cứ `…#dieu-chua-xac-dinh`: bộ kiểm tệp mức phạt bắt buộc URN trỏ tới điều, mà điều chưa xác định được; không đoán số điều.
  - Không lưu đáp án trong `game_content` (khác T1, T11): yêu cầu "ngưỡng đổi thì đáp án đổi theo" nên đáp án chỉ tính lúc tạo lượt; ý đồ của từng xe ghi ở phần giải thích cho biên tập viên.
  - Số xe mỗi ca 6, 6, 7, 8, 8 như đề xuất; màn 3–4 4 phút, màn 5 3 phút 30 giây. XP cơ bản 10, 12, 14, 16, 18.
  - Chưa có trình soạn xe riêng: soạn bằng trình soạn JSON mặc định ở `/quan-tri/noi-dung-tro-choi`. Xe mẫu soạn bằng script tạm (không để trong repo), tự kiểm dạng và in đáp án theo ngưỡng trong tệp.
- Tệp đã làm: xem "File sửa", "File tạo", "Migration" ở trên.

---

## GĐ-T13 — Lên xe khách

**Mục tiêu**
- Người chơi đếm người trên sơ đồ khoang xe, soi giấy tờ vận tải và dữ liệu giám sát hành trình, đóng dấu, sắp lỗi vào biên bản.
- Mở rộng M1: lệnh vận chuyển, phù hiệu, dữ liệu giám sát hành trình.

**Thiết kế** (GAME_DESIGN §5.13; câu D19, D20 đã trả lời theo đề xuất ngày 28/9/2026)
- Mỗi xe là một bước: số người vượt đúng 10; mỗi lỗi chỉ đúng 5; chạm nhầm −2; dấu đúng 5; thứ tự lỗi đúng 5.
- Số người vượt tính từ tập id người đã chạm và quy tắc tính số người đã duyệt; chạm hai lần cùng một người tính một lần.
- Luật vận tải ở `document_rules` nhóm `van_tai_khach` (câu D16), ngưỡng thời gian lái là tham số của luật. Cách tính trẻ em ghi riêng ở bảng cần kiểm.
- Không kiểm giấy tờ của trò 1 (câu D20). Thứ tự nặng nhẹ theo mức phạt tối đa (câu D19).

**Việc làm**
1. Tra kho văn bản: chở quá số người, kinh doanh vận tải hành khách (lệnh vận chuyển, phù hiệu, thiết bị giám sát hành trình, thời gian lái xe liên tục và trong ngày). Ghi vào bảng cần kiểm ở GAME_DESIGN §5.13.
2. `data/tra-cuu/luat-van-tai-khach.json` (demo, chưa duyệt), nạp vào `document_rules` nhóm `van_tai_khach`.
3. M1 (**hỏi trước**): ba loại giấy và bộ kiểm luật mới.
4. Logic thuần `tro-choi/len-xe-khach.ts`: đếm, kiểm luật, suy thứ tự nặng nhẹ, chấm.
5. Web: `SoDoKhoangXe.tsx` (SVG), ba thẻ Khoang xe · Giấy tờ · Giám sát, bước sắp lỗi bằng `KeoTha`; 20 xe demo.

**File sửa**
- `packages/dao-tao/src/tro-choi/chung/giay-to.ts` (M1; đã hỏi). `GiayTo.tsx` không phải sửa: giấy tờ dùng `TheGiayToChung` của T12.
- `packages/db/src/kiem-tra-giay-to.ts` (kiểu dòng tệp `DongLuatVanTaiTep`, `napLuatGiayTo` nhận nhóm mới), `apps/web/app/routes/quan-tri.du-lieu-tra-cuu.tsx` (nhóm "Vận tải hành khách", hiện tham số ngưỡng), `apps/api/src/routes/du-lieu-tra-cuu.ts` (chú thích). `packages/db/src/du-lieu-tra-cuu.ts` không phải sửa: lọc nhóm đọc `NHOM_LUAT` của M1.
- `data/tra-cuu/muc-phat.json` (4 dòng `oto-khach-*`, số minh họa)
- `scripts/tra-cuu-nhanh.ts` (nạp luật vận tải), `scripts/check-citations.ts` (chú thích), `scripts/demo-tro-choi.ts` (bước 11)

**File tạo**
- `packages/dao-tao/src/tro-choi/len-xe-khach.ts`, `len-xe-khach-kiem.ts` (bộ kiểm dạng xe, chỉ máy chủ dùng), `packages/dao-tao/tests/len-xe-khach.test.ts`
- `packages/db/src/len-xe-khach.ts`
- `apps/api/src/len-xe-khach.test.ts`
- `apps/web/app/components/tro-choi/LenXeKhach.tsx`, `SoDoKhoangXe.tsx`, `apps/web/app/lib/len-xe-khach.ts`
- `data/tra-cuu/luat-van-tai-khach.json`, `data/tro-choi/xe-khach.json`
- `scripts/e2e/len-xe-khach.ts`

**Migration**
- `0048_len_xe_khach.sql`: nới CHECK `document_rules.check_kind`, `doc_kind` và CHECK `document_rules_nhom_check` (có từ `0046`) cho nhóm `van_tai_khach` (liệt kê đủ giá trị của `0036` và `0046`); `INSERT INTO games`: `len_xe_khach`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test đếm: đếm dư (chạm vật dễ nhầm), đếm thiếu, chạm hai lần cùng một người không tính hai lần; xe có trẻ em khi chưa có luật tính trẻ em đã duyệt thì không vào lượt.
  - `packages/dao-tao/tests/len-xe-khach.test.ts`, 33 ca, chạy trên chính 10 luật, 4 dòng mức phạt và 20 xe mẫu. Có thêm: đếm đúng người mà báo sai số vượt thì không có điểm đếm; chạm vật mà vẫn báo đúng số vượt cũng không có điểm đếm; đúng bằng số chỗ là không vượt; xe có trẻ em đếm đúng theo một luật trẻ em chỉ dùng trong test.
- [x] Unit test luật: thời gian lái đúng bằng ngưỡng; hơn ngưỡng một phút; lệnh vận chuyển sai ngày, sai lái xe; phù hiệu hết hạn.
  - Có thêm: tổng thời gian lái trong ngày đúng bằng ngưỡng; dừng ngắn hơn thời gian nghỉ tối thiểu không ngắt lái liên tục, dừng đủ thì ngắt; phù hiệu hết hạn đúng ngày kiểm tra vẫn còn giá trị; luật chưa duyệt thì xe không vào màn cần luật đó; ngưỡng đổi thì đáp án đổi theo; luật sai cặp kiểu kiểm và phần, thiếu ngưỡng, luật trẻ em sai tham số bị báo lỗi.
- [x] Unit test thứ tự: hai lỗi cùng mức phạt tối đa, thứ tự nào cũng đúng; lỗi chưa có mức phạt đã duyệt không vào bước sắp.
  - Có thêm: sai một cặp liền kề 2 điểm, còn lại 0; ba lỗi có hai lỗi cùng mức; mục trùng, mục chạm nhầm bị bỏ khỏi thứ tự; biên bản theo thứ tự nặng đến nhẹ.
- [x] Unit test M1 mở rộng: test của trò 1, 4, 12 vẫn đạt.
  - Cùng với trò 11: toàn bộ `bun test` đạt trừ 5 ca `ports.test.ts` (lỗi môi trường Windows có từ trước).
- [x] API test: đề không có số chỗ quy đổi, số người vượt, lỗi; id người sinh theo lượt.
  - `apps/api/src/len-xe-khach.test.ts`, 9 ca. Có thêm: chỉ màn 1 mở; người khác đọc lượt nhận 403; câu trả lời sai dạng nhận 400; điểm, cờ đúng, số vượt đúng máy khách gửi bị bỏ qua; XP một lần; tab luật lọc nhóm `van_tai_khach` (nhóm lạ nhận 400); xe có trẻ em không vào lượt; nạp lại ngưỡng mới thì luật về chờ duyệt, xe cần nó rời màn 4 (màn 3 vẫn chơi được), pháp chế duyệt thì đáp án đổi theo; đồng bộ offline hai lần chỉ sinh một lượt.
- [x] `bun run e2e len-xe-khach`: màn 1–2 ở 360×740, đếm bằng chạm và bàn phím; giảm chuyển động.
  - Đạt (khoảng 22 giây). Màn 1 bằng chạm, cố ý đếm dư ở xe thứ 3; màn 2 bằng bàn phím ở chế độ giảm chuyển động (không có thẻ Giấy tờ, Giám sát). Có thêm màn 3: ba thẻ, chạm chỗ sai trên lệnh vận chuyển, phù hiệu, sắp lỗi vào biên bản bằng chạm-chạm rồi nộp.
- [ ] **Đủ nội dung đã duyệt:** luật vận tải hành khách, cách tính trẻ em đã được đơn vị xác nhận; ít nhất 12 xe.
  - **Chưa làm được:** 10 luật, 4 dòng mức phạt và 20 xe là dữ liệu demo, chưa duyệt. Kho văn bản chưa có văn bản nào về các nội dung này (tra ngày 28/9/2026: 0 kết quả); căn cứ luật ghi `vn:chua-co-trong-kho`. Chưa có luật cách tính trẻ em (không tự đặt). Ngưỡng thời gian lái, số tiền là số minh họa. Danh sách cần kiểm ở GAME_DESIGN §5.13. Trò đang tắt.
- Mục kiểm tra chung GĐ-T:
  - [x] Test chấm điểm: như trên.
  - [x] API test bảo mật: điểm, cờ đúng, số vượt đúng máy khách gửi bị bỏ qua; người khác đọc lượt nhận 403; phản hồi trước khi chấm không có khóa cấm (`answer`, `dap_an`, `giai_thich`, `can_cu`, `noi_dung`, `loi`, `luat`, `so_vuot`, `so_quy_doi`, `phat_toi_da`, `co_thu_tu`, `dau`, `bien_ban`, `muc_phat`, `muc`); `phan-quyen.test.ts` vẫn đạt.
  - [x] Cổng chung: `bun run typecheck` đạt; `bun test` 1499 đạt, 7 bỏ qua, 5 hỏng (cả 5 ở `ports.test.ts`, lỗi môi trường Windows có từ trước); `bun run build:web` qua; Biome qua với các tệp của giai đoạn. E2E `len-xe-khach`, `kiem-tra-giay-to`, `dung-xe`, `duyet-phat-nguoi`, `tram-can`, `tro-choi-khung`, `offline` đạt.
    - Lần chạy E2E đầu cả 7 kịch bản liền nhau có `kiem-tra-giay-to` (hết giờ chờ một lần bấm) và `offline` (phiên đồng bộ chưa kịp chốt) hỏng; chạy riêng từng kịch bản và chạy lại cả loạt đều đạt 7/7. Mã của hai kịch bản đó không bị sửa.
  - [x] Chơi thử một lượt đầy đủ ở 360×740, chế độ thường (màn 1, màn 3) và giảm chuyển động (màn 2), qua E2E và soát ảnh chụp.
  - [ ] Hiệu năng CPU chậm 4×; mã riêng ≤ 8 KB gzip.
    - **Chưa đo** CPU chậm 4×. Trò không có hoạt cảnh liên tục: sơ đồ là lưới nút tĩnh, chỉ có hiện dần và đập dấu.
    - **Chưa đạt ngân sách:** mã riêng khoảng 11,2 KB gzip (logic 5,6 KB, giao diện 4,1 KB, sơ đồ khoang 1,6 KB; đo bằng `bun build --minify`, không tính M1, M2, M4 dùng chung), vượt 3,2 KB. Logic phải tải xuống điện thoại vì chơi offline sinh lượt và chấm trên máy; bộ kiểm dạng xe đã tách sang `len-xe-khach-kiem.ts`.
  - [x] Dữ liệu mẫu đánh dấu "demo, chưa duyệt"; bảng cần kiểm tra và hình cần bổ sung ở GAME_DESIGN §5.13 cập nhật theo thực tế.
  - [x] DEMO.md có dòng màn hình và cách chơi thử (mục 7j).
  - [x] Có bản tóm tắt thay đổi để người dùng commit.

**Trạng thái (28/9/2026):** đã làm xong phần mã. Còn ba mục chưa đạt: nội dung đã duyệt (chờ văn bản, luật trẻ em và đơn vị chuyên môn), đo hiệu năng CPU chậm 4×, ngân sách mã riêng (11,2/8 KB gzip).
- Quyết định của người dùng khi làm giai đoạn này:
  - D19: "nặng" đo bằng mức phạt tối đa của dòng `violations` đã duyệt; bằng nhau thì thứ tự nào cũng đúng; lỗi chưa có mức phạt không vào bước sắp.
  - D20: không kiểm giấy phép lái xe, đăng ký, bảo hiểm.
  - **Đồng ý sửa M1** (`giay-to.ts`): ba loại giấy vận tải (`LOAI_GIAY_TO_VAN_TAI`, `LenhVanChuyen`, `PhuHieu`, `GiamSatHanhTrinh`, `kiemTraGiayToVanTai`), tách khỏi `LoaiGiayTo` của trò 1; nhóm luật `van_tai_khach` (`KIEU_KIEM_VAN_TAI`, `PHAN_VAN_TAI`, `LOI_VAN_TAI`, `loiVanTaiCuaLuat`, `laLuatTreEm`, kiểm tham số ngưỡng); `kiemTraLuatGiayTo` chọn bộ kiểm theo `nhom`. Luật nhóm cũ giữ nguyên hành vi.
- Thay đổi so với dự kiến:
  - Điểm đếm cần cả tập đã chạm đúng bằng tập người trên xe lẫn số vượt báo đúng. Bước sắp có điểm khi xe lập biên bản, có từ hai lỗi có mức phạt đã duyệt, và người chơi chỉ ra được từ hai lỗi đó. Thứ tự tính trên các lỗi thật: mục chạm nhầm, mục trùng một lỗi bị bỏ.
  - Số chỗ là số chỗ hành khách theo sơ đồ khoang, không kể chỗ người lái (xe 16 chỗ có 15 chỗ hành khách). Giấy nào ghi số chỗ để trong bảng cần kiểm.
  - Chỗ sai trên lệnh, phù hiệu chạm ở dòng của giấy, không chạm biển số gắn trên xe: một lần chạm không chỉ ra được cùng lúc hai lỗi biển số.
  - Màn giám sát: lỗi lái liên tục chạm vào đoạn chạy của lần lái quá giờ (người chơi tự cộng các đoạn, lần dừng ngắn không ngắt); lỗi trong ngày chạm dòng tổng thời gian lái do thiết bị tính. Tốc độ lớn nhất chỉ để đọc.
  - Chưa giữ bước đang làm khi thoát giữa chừng (IndexedDB): khung chung chưa có chỗ lưu câu trả lời dở của một bước, không trò nào tự làm. Xe đã nộp vẫn giữ.
  - Sơ đồ khoang là lưới nút HTML, mỗi phần tử có hình SVG 24×24, không phải một hình SVG liền: để mỗi người là một vùng chạm ≥ 48px, đi được bằng bàn phím.
  - Không có luật cách tính trẻ em trong tệp luật (không tự đặt). Xe mẫu có trẻ em được soạn sao cho có lỗi hay không không phụ thuộc cách tính (một trẻ không tính hơn một người). M1 chặn luật trẻ em có `bang_nguoi > so_tre`.
  - Căn cứ của luật ghi `vn:chua-co-trong-kho` thay cho URN dự kiến: kho không có văn bản, không viện dẫn theo trí nhớ.
  - Màn 3–4 3 phút mỗi xe, màn 5 3 phút 30 giây mỗi xe, như đề xuất. XP cơ bản 10, 12, 14, 16, 18.
  - Xe mẫu soạn bằng script tạm (không để trong repo), tự kiểm bằng bộ luật trước khi ghi tệp (xe có trẻ em kiểm với hai cách quy đổi cực trị).
  - Biome sắp lại một số dòng của các tệp đã sửa (không đổi nội dung).
- Tệp đã làm: xem "File sửa", "File tạo", "Migration" ở trên.

---

## GĐ-T14 — Soi xe cải tạo

**Mục tiêu**
- Người chơi khoanh chỗ xe khác giấy chứng nhận kiểm định, nối với dòng thông số, đo bằng thước khi cần.
- Mở rộng M1: trường thông số kỹ thuật của giấy chứng nhận kiểm định (T12 tạo loại giấy).

**Thiết kế** (GAME_DESIGN §5.14)
- Mỗi xe là một bước: mỗi chỗ sai khoanh đúng (IoU ≥ 0,5) 5, nối đúng dòng 3, khoanh nhầm −2, dấu đúng 5.
- Vùng khoanh lớn hơn 25% diện tích hình bị loại; tối đa 6 vùng mỗi hình; một vùng đáp án chỉ tính một lần.
- Vùng đáp án tính từ biến thể cải tạo và tham số hình, chỉ ở máy chủ. Hình gửi xuống dạng nét, không gắn tên bộ phận.

**Việc làm**
1. Tra kho văn bản: cải tạo phương tiện, tự ý thay đổi kết cấu, kích thước thùng, màu sơn, lắp thêm đèn và còi. Ghi vào bảng cần kiểm ở GAME_DESIGN §5.14.
2. Bộ dựng hình xe từ tham số (nhìn nghiêng, nhìn sau) và biến thể cải tạo: `tro-choi/hinh-xe-tham-so.ts`, hàm thuần dùng được ở máy chủ.
3. Danh mục biến thể `data/tro-choi/bien-the-cai-tao.json` (`game_content` loại `bien_the_cai_tao`, demo, chưa duyệt).
4. M1 (**hỏi trước**): thêm trường thông số vào `giay_kiem_dinh`.
5. Logic thuần `tro-choi/soi-xe-cai-tao.ts`: vùng đáp án, IoU, chấm.
6. Web: hai hình, `KhoanhVung` (M2, không sửa), nối cặp, thước đo `ThuocDo.tsx`, phóng to; 16 xe demo.

**File sửa**
- `packages/dao-tao/src/tro-choi/chung/giay-to.ts` (M1; đã hỏi). `GiayTo.tsx` không phải sửa: giấy dùng `TheGiayToChung` của T12.
- `data/tra-cuu/muc-phat.json` (4 dòng `oto-cai-tao-*`, số minh họa), `scripts/demo-tro-choi.ts` (bước 13)

**File tạo**
- `packages/dao-tao/src/tro-choi/soi-xe-cai-tao.ts`, `soi-xe-cai-tao-kiem.ts` (bộ kiểm dạng, chỉ máy chủ dùng), `tro-choi/hinh-xe-tham-so.ts`
- `packages/dao-tao/tests/soi-xe-cai-tao.test.ts`, `hinh-xe-tham-so.test.ts`
- `packages/db/src/soi-xe-cai-tao.ts`
- `apps/api/src/soi-xe-cai-tao.test.ts`
- `apps/web/app/components/tro-choi/SoiXeCaiTao.tsx`, `ThuocDo.tsx`, `apps/web/app/lib/soi-xe-cai-tao.ts`
- `data/tro-choi/bien-the-cai-tao.json`, `data/tro-choi/xe-cai-tao.json`
- `scripts/e2e/soi-xe-cai-tao.ts`

**Migration**
- `0049_soi_xe_cai_tao.sql`: `INSERT INTO games`: `soi_xe_cai_tao`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test IoU: 0,49 không có điểm, 0,5 có; khoanh trùng hai lần một chỗ chỉ tính một lần; khoanh cả hình bị chấm 0 phần khoanh (giới hạn diện tích).
  - `packages/dao-tao/tests/soi-xe-cai-tao.test.ts`, 14 ca, chạy trên chính danh mục, 4 dòng mức phạt và 16 xe mẫu. IoU kiểm cả hàm (0,49 và 0,5) lẫn trên xe thật (khung bằng nửa vùng đèn nóc có điểm, hụt 1 đơn vị thì không). Có thêm: khoanh nhầm −2 không làm phần khoanh âm; nối sai dòng mất 3 điểm; màu sơn tính khi khung nằm ít nhất một nửa trong phần sơn; trả lời đúng mọi xe đủ điểm tối đa; biến thể chưa duyệt thì xe không vào lượt.
- [x] Unit test bộ dựng hình: cùng tham số cùng nét; mỗi biến thể tạo đúng vùng đáp án; biến thể chỉ đo được bằng thước lệch dưới ngưỡng nhìn thấy nhưng trên dung sai khai trong nội dung.
  - `packages/dao-tao/tests/hinh-xe-tham-so.test.ts`, 5 ca. Thùng cơi nới 150 mm (dưới mức 250 mm thấy bằng mắt) chỉ có ở màn 5, vùng đáp án cao đúng 15 + 10 đơn vị, hình cao thêm đúng 15 đơn vị (150 mm theo thước). Có thêm: nét chỉ có đường vẽ và kiểu tô, sắp theo lớp rồi theo chuỗi (không lộ nét thêm vào); giấy ghi thông số xe gốc.
- [x] Unit test M1 mở rộng: test của trò 1, 4, 12, 13 vẫn đạt.
  - Cùng với trò 11, 15: toàn bộ `bun test` đạt trừ 5 ca `ports.test.ts` (xem cổng chung).
- [x] API test: đề không có danh sách biến thể, vùng đáp án, tên bộ phận.
  - `apps/api/src/soi-xe-cai-tao.test.ts`, 7 ca. Có thêm: chỉ màn 1 mở; người khác đọc lượt nhận 403; câu trả lời sai dạng nhận 400 (quá 6 khung một hình, hộp ngược, dòng lạ, dấu lạ); điểm, cờ đúng, vùng máy khách tự khai bị bỏ qua; khung cả hình bị loại; xe không đạt có biên bản với mức phạt đã duyệt; XP một lần; dòng mức phạt của biến thể về chờ duyệt thì xe dùng biến thể đó rời lượt; đồng bộ offline hai lần chỉ sinh một lượt.
- [x] `bun run e2e soi-xe-cai-tao`: màn 1–2 ở 360×740, khoanh bằng kéo khung và bằng chạm, thước đo dùng được bằng bàn phím.
  - Đạt (khoảng 15 giây). Màn 1: đèn nóc khoanh bằng kéo khung, màu sơn bằng chạm, cố ý đóng sai dấu ở xe thứ 3; thước đo dời đầu thước bằng Shift + mũi tên, số đo đổi đúng 100 mm. Màn 2 ở chế độ giảm chuyển động, toàn bằng bàn phím ("Thêm khung", mũi tên dời, Shift + mũi tên đổi cỡ, Enter trên dòng giấy và dấu).
- [ ] **Đủ nội dung đã duyệt:** danh mục biến thể có mã mức phạt đã duyệt; ít nhất 12 xe.
  - **Chưa làm được:** 7 biến thể, 4 dòng mức phạt, 16 xe là dữ liệu demo, chưa duyệt. **Chưa tra được kho văn bản:** máy chủ tra cứu `quydinhphapluat` mất kết nối suốt phiên (người dùng chọn làm phần mã trước); căn cứ của biến thể ghi `vn:chua-co-trong-kho`. Số tiền là số minh họa. Danh sách cần kiểm ở GAME_DESIGN §5.14. Trò đang tắt.
- Mục kiểm tra chung GĐ-T:
  - [x] Test chấm điểm: như trên.
  - [x] API test bảo mật: điểm, cờ đúng, vùng máy khách tự khai bị bỏ qua; người khác đọc lượt nhận 403; phản hồi trước khi chấm không có khóa cấm (`answer`, `dap_an`, `giai_thich`, `can_cu`, `noi_dung`, `bien_the`, `vung`, `cho_sai`, `than`, `dau`, `bien_ban`, `muc_phat`, `muc`); `phan-quyen.test.ts` vẫn đạt.
  - [x] Cổng chung: `bun run typecheck` đạt; `bun test` 1573 đạt, 7 bỏ qua, 5 hỏng ở `ports.test.ts` (lỗi môi trường Windows có từ trước); `bun run build:web` qua; Biome qua với các tệp của giai đoạn. E2E `soi-xe-cai-tao`, `tram-can`, `kiem-tra-giay-to`, `dung-xe`, `soi-camera`, `duyet-phat-nguoi`, `len-xe-khach`, `chot-dem`, `tro-choi-khung`, `offline` đạt (10/10).
    - Lần chạy `bun test` đầu có thêm ca "Lên xe khách: trò tắt sẵn trong migration" hỏng: trong CSDL test, `games.enabled` của `len_xe_khach` còn `true` từ một lần chạy E2E ngày 28/9 (không có nội dung đã duyệt nào). Đã đặt lại `false` như migration; chạy lại thì đạt 9/9. Sau loạt E2E lần này không trò nào bị bật sót.
  - [x] Chơi thử một lượt đầy đủ ở 360×740, chế độ thường (màn 1) và giảm chuyển động (màn 2), qua E2E và soát ảnh chụp.
  - [ ] Hiệu năng CPU chậm 4×; mã riêng ≤ 8 KB gzip.
    - **Chưa đo** CPU chậm 4×. Hình là SVG tĩnh; chỉ nét khoanh, thước đo động khi đang kéo.
    - **Chưa đạt ngân sách:** mã riêng khoảng 11,1 KB gzip (logic 3,6 KB, bộ dựng hình 2,6 KB, giao diện 4,0 KB, thước đo 0,9 KB; đo bằng `bun build --minify`, không tính M1, M2, M4). Nếu tính bộ dựng hình là phần dùng chung với T19 thì còn 8,5 KB, vẫn vượt 0,5 KB.
  - [x] Dữ liệu mẫu đánh dấu "demo, chưa duyệt"; bảng cần kiểm tra và hình cần bổ sung ở GAME_DESIGN §5.14 cập nhật theo thực tế.
  - [x] DEMO.md có dòng màn hình và cách chơi thử (mục 7l).
  - [x] Có bản tóm tắt thay đổi để người dùng commit.

**Trạng thái (29/9/2026):** đã làm xong phần mã. Còn ba mục chưa đạt: nội dung đã duyệt (chưa tra được kho vì máy chủ tra cứu mất kết nối; chờ đơn vị chuyên môn), đo hiệu năng CPU chậm 4×, ngân sách mã riêng (11,1/8 KB gzip).
- Quyết định của người dùng khi làm giai đoạn này:
  - D15, D32 đã trả lời từ GĐ-T11.
  - **Đồng ý sửa M1** (`giay-to.ts`): `GiayKiemDinh` thêm trường tùy chọn `thong_so` (`ThongSoKyThuat`: kích thước bao, thùng, cỡ lốp, số chỗ, màu sơn, đèn); `DONG_THONG_SO`, `TEN_DONG_THONG_SO`, `kiemTraThongSoKyThuat`. Phần khối lượng và `kiemTraGiayToXeTai` của T12 giữ nguyên.
  - Làm phần mã khi máy chủ tra cứu mất kết nối (phương án b): căn cứ ghi `vn:chua-co-trong-kho`, tra bổ sung khi nối lại.
- Thay đổi so với dự kiến:
  - Danh mục biến thể và xe cùng `game_content` của trò, phân biệt bằng `payload.kieu` (`bien_the`, `xe`) như Tự lái, thay cho "loại `bien_the_cai_tao`". Mục danh mục có `refs` trỏ tới dòng mức phạt: sửa dòng đó thì mục rút khỏi trò, xe dùng mục đó không vào lượt.
  - Màu sơn: vùng đáp án là cả phần sơn, lớn hơn 25% hình, nên không chấm bằng IoU mà bằng "khung nằm ít nhất một nửa trong phần sơn". Các biến thể khác chấm IoU ≥ 0,5.
  - Vùng đáp án của thùng cơi nới là phần cơi thêm cộng lề 10 đơn vị (không phải cả thùng, vì cả thùng vượt 25% hình). Ống xả độ nối với dòng "kích thước bao" (giấy không có dòng ống xả).
  - Giấy ghi thông số của xe gốc, suy từ tham số (`thongSoTuXe`), không soạn tay; hình là xe gốc cộng biến thể. Xe tải: kích thước bao = thùng + 2.050 mm dài, 100 mm rộng, 1.000 mm cao.
  - Khoanh bằng chạm: chạm nhẹ đặt khung 40 × 30 đơn vị, chỉnh bằng 8 nút dời, đổi cỡ (cũng là đường cho bàn phím: "Thêm khung", mũi tên, Shift + mũi tên). Khoanh trùng một chỗ không cộng, không trừ.
  - Thùng cơi nới dưới 250 mm (chỉ đo mới thấy) chỉ có ở màn 5 (`manToiThieu`). Đầu thước có bán kính tính theo tỷ lệ hiển thị để vùng chạm ≥ 48px.
  - Xe tải thùng cao hơn cabin: nhìn từ sau không thấy đèn trên nóc cabin, nên không vẽ và không có vùng đáp án ở góc đó.
  - Số xe mỗi lượt 5, 8, 8, 8, 8; màn 3–4 5 phút, màn 5 4 phút 30 giây cả lượt, như đề xuất. XP cơ bản 10, 12, 14, 16, 18.
  - Xe mẫu soạn bằng script tạm (không để trong repo), tự kiểm bằng bộ kiểm dạng và danh mục trước khi ghi tệp.
  - Biome sắp lại một số dòng của các tệp đã sửa (không đổi nội dung).
- Tệp đã làm: xem "File sửa", "File tạo", "Migration" ở trên.

---

## GĐ-T15 — Dựng chốt an toàn ban đêm

**Mục tiêu**
- Người chơi bố trí vật của chốt trên đoạn đường ban đêm, chạy thử mô phỏng, được chấm theo tiêu chí đo từ mô phỏng.
- Mở rộng M5: vật cản tạm, tầm nhìn đêm, vùng nguy hiểm quanh người, đo độ dài hàng chờ.

**Thiết kế** (GAME_DESIGN §5.15)
- Một màn là một bước; chạy thử tối đa 2 lần; máy chủ chạy bố trí lúc nộp để chấm (M7).
- Sáu tiêu chí, tổng 100 điểm; ngưỡng ở `game_content` loại `tieu_chi_chot`, không đặt trong mã. Khoảng cách tính bằng mét theo câu D21.
- Tầm nhìn đêm tính bằng bảng tra, không dùng hàm lượng giác (§2.3).

**Việc làm**
1. Tra kho văn bản: báo hiệu khi tổ chức kiểm soát trên đường, khoảng cách đặt biển tạm (QCVN 41:2024 nếu có trong kho). Vị trí đứng, tác phong của chiến sĩ ghi nguồn "tài liệu nghiệp vụ do đơn vị cung cấp", đánh dấu demo.
2. M5 (**hỏi trước**): `mo-phong/vat-can.ts` (cọc, xe đỗ chiếm làn), `mo-phong/tam-nhin.ts` (tầm nhìn theo đèn và độ cong), sự kiện `vao_vung_nguy_hiem`, đo hàng chờ.
3. Logic thuần `tro-choi/chot-dem.ts`: kiểm vị trí đặt hợp lệ, dựng bố trí từ nhật ký, chấm theo tiêu chí.
4. Web: túi đồ, kéo thả (`KeoTha`), xoay biển, chạy thử (M6 chế độ đêm, `lib/ve-canh/ve-chot.ts`), kết quả chạy thử; 10 đoạn đường demo.

**File sửa**
- `packages/dao-tao/src/mo-phong/*` (phần mở rộng đã ghi ở GAME_DESIGN §4.1)
- `apps/web/app/components/tro-choi/chung/CanhTrenXuong.tsx`, `apps/web/app/lib/ve-canh/*` (vật của chốt, đèn cảnh báo) (M6; **hỏi trước** nếu phải sửa tệp M6 đã có, như T9 đã tránh bằng tệp mới)

**File tạo**
- `packages/dao-tao/src/mo-phong/vat-can.ts`, `mo-phong/tam-nhin.ts`, `packages/dao-tao/src/tro-choi/chot-dem.ts`
- `packages/dao-tao/tests/vat-can.test.ts`, `chot-dem.test.ts`
- `packages/db/src/chot-dem.ts`
- `apps/api/src/chot-dem.test.ts`
- `apps/web/app/components/tro-choi/ChotDem.tsx`, `apps/web/app/lib/ve-canh/ve-chot.ts`, `apps/web/app/lib/chot-dem.ts`
- `data/tro-choi/chot-dem.json`, `data/tro-choi/tieu-chi-chot.json`
- `scripts/e2e/chot-dem.ts`

**Migration**
- `0050_chot_dem.sql`: `INSERT INTO games`: `chot_dem`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [x] Unit test M5 mở rộng: xe giảm tốc khi thấy đèn cảnh báo trong tầm nhìn; đoạn cong làm tầm nhìn ngắn lại; cọc chiếm làn làm xe chuyển làn hoặc dừng; test tất định và test của trò 3, 5, 9 vẫn đạt; quét mã không có `Math.sin`, `Math.cos`, `Math.random`, `Date.now` trong logic. (`packages/dao-tao/tests/vat-can.test.ts`, 17 test; `mo-phong.test.ts`, `cam-bien.test.ts`, `soi-camera.test.ts`, `tu-lai.test.ts`, `xe-nguoi-lai.test.ts` vẫn đạt.)
- [x] Unit test chấm: từng tiêu chí ở ca biên của ngưỡng; chạy thử lần thứ 3 thì bước 0 điểm. (`chot-dem.test.ts`, 23 test.)
- [x] API test: cùng bố trí cùng kết quả ở máy khách và máy chủ (so băm trạng thái cuối); đặt vật ngoài phần đường hợp lệ bị từ chối; nhật ký có mốc thời gian sai bị chấm 0; đề không có ngưỡng tiêu chí; chạy lại dưới 200 ms. (`apps/api/src/chot-dem.test.ts`, 9 test.)
- [x] `bun run e2e chot-dem`: màn 1–2 ở 360×740, kéo thả bằng chạm-chạm và bàn phím; giảm chuyển động thì chạy thử hiện ảnh tĩnh theo mốc.
- [ ] Hiệu năng: màn 5 (xe tải, xe quá tốc độ) ≥ 50 khung hình/giây trên CPU chậm 4×; mã riêng ≤ 12 KB gzip.
  - Mới đo màn 1 (e2e): 59,7 khung/giây, p95 16,8 ms với CPU chậm 4×. Màn 5 chưa đo trên trình duyệt (chấm lại màn 5 ở máy chủ dưới 200 ms).
  - Mã riêng 9,5 KB gzip (đóng gói có tree-shaking, không tính M5, M6 cũ, M7; cùng cách đo, trò 3 là 8,7 KB); phần mở rộng M5 thêm khoảng 1,5 KB. Đo từng tệp riêng lẻ (cách của GĐ-T11) thì `ChotDem.tsx` 5,1 KB, `ve-chot.ts` 1,8 KB, `chot-dem.ts` 7,3 KB (gồm bộ kiểm nội dung chỉ máy chủ dùng).
- [ ] **Đủ nội dung đã duyệt:** ngưỡng tiêu chí có căn cứ hoặc tài liệu nghiệp vụ đơn vị đã cung cấp; ít nhất 6 đoạn đường.
- [x] Các mục kiểm tra chung GĐ-T (8 mục, như GĐ-T11), trừ hiệu năng màn 5 ở trên.

**Trạng thái (29/9/2026):** đã làm xong phần mã; trò tắt (`games.enabled = false`) cho tới khi ngưỡng có căn cứ. Còn hai mục chưa đạt: nội dung đã duyệt (ngưỡng là số minh họa, chưa tra được văn bản) và đo hiệu năng màn 5 trên trình duyệt. Kết quả: `bun run typecheck` đạt; `bun test` 1547 đạt, 6 hỏng (5 ở `packages/config/src/ports.test.ts`, đã hỏng từ trước trên Windows; 1 ở `apps/api/src/len-xe-khach.test.ts` "trò tắt sẵn trong migration" vì CSDL test đang để `games.enabled = true` cho `len_xe_khach` từ một lần chạy trước bị ngắt, không liên quan GĐ-T15); `bun run build:web` đạt; `bun run e2e chot-dem` đạt.
- Quyết định của người dùng khi làm giai đoạn này:
  - D21: theo đề xuất, chấm khoảng cách bằng mét với ngưỡng demo, trò tắt tới khi có căn cứ.
  - **Đồng ý sửa M5** (`packages/dao-tao/src/mo-phong/`): tệp mới `vat-can.ts`, `tam-nhin.ts`; `mo-phong.ts` thêm các trường tùy chọn `vat_can`, `nguoi`, `dem` của cấu hình, sự kiện `chuyen_lan`, `vao_vung_nguy_hiem`, phanh gấp vì vật cản, vật cảnh báo; `xe.ts` thêm `s_vao` (tùy chọn). Cấu hình không có trường mới thì chạy y như cũ.
  - MCP `quydinhphapluat` không kết nối được: làm mã trước, căn cứ tra sau. Mọi nguồn trong `tieu-chi-chot.json` ghi "chưa tra được kho văn bản", không viện dẫn theo trí nhớ.
- Thay đổi so với dự kiến:
  - **Sửa một lỗi có sẵn của M5** (ngoài phần đã hỏi): hai xe chờ ở đầu cùng một làn có thể vào đường cùng một nhịp rồi chồng lên nhau (xe sau xét theo ảnh chụp nhịp trước). Nay xét thêm các xe đã xử lý trong nhịp. Chỉ đổi kết quả đúng trường hợp này; test của trò 3, 5, 9 vẫn đạt. Lỗi lộ ra vì hàng chờ của chốt kéo tới đầu làn.
  - Tầm nhìn không dùng hàm lượng giác: đoạn cong, đỉnh dốc là đoạn khuất theo quãng đường dọc làn (làn vẫn thẳng), tầm nhìn tra bảng theo mức khuất. Làn tránh phải song song, cùng quãng đường.
  - Bộ tiêu chí là `game_content` cùng trò, phân biệt bằng `payload.kieu` (như bảng lỗi của trò 9); đoạn đường trỏ tới bộ bằng `ma_tieu_chi`, không bằng `refs` (khung chưa cho `refs` trỏ `game_content`). Bộ tiêu chí thôi duyệt thì đoạn rút khỏi trò (có API test).
  - Gói offline mang cả bộ tiêu chí (như mọi trò offline mang đáp án); đề gửi người chơi không có ngưỡng.
  - Giao diện: vị trí đặt chạm theo ô 10 m × cột rồi chỉnh từng mét bằng nút hoặc phím mũi tên (ô 1 m quá nhỏ để chạm); bảng dính ở đáy chỉ hiện túi đồ hoặc khối chỉnh vật đang chọn, không hiện cả hai. Chạm-chạm dùng vật đang chọn của trò, kéo vẫn dùng `useKeoTha` (không sửa M2).
  - Màn kết quả hiện ảnh tĩnh lúc xe đầu tiên phanh gấp, chưa phát lại hoạt cảnh.
  - Chưa giữ bố trí đang làm khi thoát giữa chừng: khung chung chưa có chỗ lưu câu trả lời dở của một bước (như GĐ-T13).
  - Thêm tên nguồn `chot_dem_doan_duong` vào `NguonNoiDung` (`khung.ts`) và một dòng ở `nguon-tro-choi.ts`, như các giai đoạn trước.
  - Thứ tự trò trên trang Trò chơi: `ordinal = 18` (17 để cho T14).
  - Biome sắp lại một số dòng của các tệp đã sửa (không đổi nội dung).
- Tệp đã làm: xem "File sửa", "File tạo", "Migration" ở trên; thêm `data/tro-choi/tieu-chi-chot.json`, `apps/web/app/lib/chot-dem.ts`, `packages/dao-tao/tests/vat-can.test.ts`, bước 12 ở `scripts/demo-tro-choi.ts`. Không sửa `CanhTrenXuong.tsx` và các tệp M6 cũ.

---

## GĐ-T16 — Phân luồng khi có sự cố

**Mục tiêu**
- Người chơi đặt rào, biển hướng đi tạm, chiến sĩ điều tiết trên bản đồ khu phố, chạy mô phỏng lưu lượng và sửa trong lúc chạy.
- Mở rộng M5: lưu lượng theo giờ, đo ùn theo đoạn. Dùng M9; tạo M9 nếu GĐ-T6 chưa làm (câu D22).

**Thiết kế** (GAME_DESIGN §5.16)
- Một kịch bản là một bước, 5 phút mô phỏng; thay đổi trong lúc chạy ghi theo nhịp (M7); được chạy lại từ đầu một lần.
- Điểm theo mục tiêu: xe cứu thương 40, tổng trễ 30, không xe vào đoạn đóng 20, phương án gọn 10.
- Kịch bản phải có phương án mẫu đạt mọi mục tiêu; bộ kiểm chạy M5 khi lưu và khi duyệt.
- Tối đa 60 xe cùng lúc để chạy lại dưới 200 ms.

**Việc làm**
1. Kiểm M9: có rồi thì dùng; chưa có thì **dừng và hỏi** theo quy tắc 11 của Phần chung. *M9 đã tạo ở GĐ-T17 (30/9/2026).*
2. Tra kho văn bản: tổ chức giao thông, phân luồng khi có sự cố, quyền ưu tiên của xe cứu thương, cứu hỏa. Kịch bản phân luồng mẫu của đơn vị (nếu có) là tài liệu nội bộ, đánh dấu demo.
3. M5 (**hỏi trước**): `mo-phong/luu-luong.ts` (sinh xe theo lưu lượng từng lối vào, chọn đường theo M9, đổi đường khi gặp rào hoặc biển hướng tạm, đo ùn theo đoạn). Làn M5 dựng từ tuyến ô như trò 9.
4. Logic thuần `tro-choi/phan-luong.ts`: áp thay đổi theo nhịp, chấm mục tiêu, bộ kiểm "kịch bản có lời giải".
5. Web: bản đồ `BanDoO` (M9), đặt vật, chạy, tạm dừng, lớp màu ùn (`lib/ve-canh/ve-un.ts`); trình soạn kịch bản có nút "Kiểm lời giải"; 10 kịch bản demo.

**File sửa**
- `packages/dao-tao/src/mo-phong/*` (phần mở rộng đã ghi ở GAME_DESIGN §4.1)
- `packages/dao-tao/src/ban-do/*`, `apps/web/app/components/tro-choi/chung/BanDoO.tsx` (chỉ khi M9 đã có và cần thêm; **hỏi trước**)
- `apps/web/app/routes/quan-tri.noi-dung-tro-choi.sua.tsx` (gắn trình soạn kịch bản)

**File tạo**
- `packages/dao-tao/src/mo-phong/luu-luong.ts`, `packages/dao-tao/src/tro-choi/phan-luong.ts`
- `packages/dao-tao/tests/luu-luong.test.ts`, `phan-luong.test.ts`
- `packages/db/src/phan-luong.ts`
- `apps/api/src/phan-luong.test.ts`
- `apps/web/app/components/tro-choi/PhanLuong.tsx`, `apps/web/app/lib/ve-canh/ve-un.ts`, `apps/web/app/lib/phan-luong.ts`
- `apps/web/app/components/quan-tri/tro-choi/SoanPhanLuong.tsx`
- `data/tro-choi/phan-luong.json`
- `scripts/e2e/phan-luong.ts`
- Nếu tạo M9 ở giai đoạn này: các tệp M9 theo GĐ-T6 (`packages/dao-tao/src/ban-do/`, `packages/dao-tao/tests/ban-do.test.ts`, `components/tro-choi/chung/BanDoO.tsx`)

**Migration**
- `0051_phan_luong.sql`: `INSERT INTO games`: `phan_luong`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [ ] Unit test lưu lượng: cùng seed cùng dòng xe; xe đổi đường khi gặp rào; độ ùn theo đoạn tính đúng trên bản đồ thử; test tất định và test của trò 3, 5, 9 vẫn đạt.
- [ ] Unit test chấm: xe cứu thương tới đúng hạn và trễ 1 giây; xe vào đoạn đã đóng; số vật dùng thêm.
- [ ] Unit test bộ kiểm: kịch bản không có lời giải bị trình soạn từ chối, chỉ đúng mục tiêu không đạt.
- [ ] API test: máy chủ chạy lại nhật ký cho đúng số liệu ùn; đặt rào giữa lúc chạy được ghi đúng nhịp; đề không có phương án mẫu, ngưỡng; chạy lại dưới 200 ms.
- [ ] `bun run e2e phan-luong`: màn 1–2 ở 360×740; tạm dừng, đặt rào, chạy tiếp; giảm chuyển động chạy từng đoạn 10 giây.
- [ ] Hiệu năng: màn 5 (60 xe) ≥ 50 khung hình/giây trên CPU chậm 4×; mã riêng ≤ 12 KB gzip.
- [ ] **Đủ nội dung đã duyệt:** ít nhất 6 kịch bản có phương án mẫu; căn cứ về quyền ưu tiên có trong kho.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục, như GĐ-T11).

---

## GĐ-T17 — Truy vết xe bỏ trốn

**Mục tiêu**
- Người chơi đọc tin báo, chọn camera trên bản đồ, khóa đúng xe trong từng đoạn cảnh, đặt điểm chặn.

**Thiết kế** (GAME_DESIGN §5.17; câu D15, D22, D23, D24 đã trả lời ngày 30/9/2026)
- Lộ trình sinh tất định từ seed của vụ và biến thể của lượt, trên M9; máy khách chỉ nhận đoạn cảnh của camera đã mở (cấu hình M5 để điện thoại tự chạy), id xe sinh riêng từng đoạn.
- Một vụ là một bước. Đoạn cảnh theo camera người chơi chọn do **route riêng của trò** trả (D23), không sửa khung; route ghi thao tác vào ảnh chụp bước, bộ chấm online chỉ tin nhật ký đó.
- Điểm: khóa đúng 5, khóa nhầm −3, điểm chặn đúng 20, lượt xem còn dư 2 mỗi lượt (tối đa 10, chỉ khi chặn đúng); điểm bước không âm (D15).
- Có offline (D24): gói mang cả seed và lộ trình.
- Tạo M9 ngay trong giai đoạn này (D22; GĐ-T6, GĐ-T16 chưa làm).

**Việc làm**
1. Tra kho văn bản: hành vi bỏ chạy sau tai nạn, trách nhiệm của người điều khiển phương tiện liên quan tới vụ tai nạn.
2. M9 `ban-do/` (lưới ô, đặt vật, đường ngắn nhất) và `BanDoO.tsx`, theo đặc tả GAME_DESIGN §4.1.
3. Route riêng `POST /v1/truy-vet/luot/:id/camera` (D23); cầu nối `/api` cho đường này.
4. Logic thuần `tro-choi/truy-vet.ts`: sinh lộ trình, tính thời điểm theo quãng đường, dựng đoạn cảnh 10 giây, kiểm yêu cầu mở camera theo thời gian mô phỏng, chấm.
5. Web: tin báo (nút nghe dùng `/v1/giong-doc`), bản đồ camera (M9), đoạn cảnh (M6, khung camera của trò 5), chạm xe (`KhoanhVung`), đặt điểm chặn; 8 vụ demo.

**File sửa**
- `packages/dao-tao/src/tro-choi/khung.ts` (một tên nguồn `truy_vet_vu`), `dang-ky.ts` (một dòng), `packages/dao-tao/src/index.ts`
- `packages/db/src/nguon-tro-choi.ts` (một dòng), `seed-tro-choi.ts` (một dòng), `packages/db/src/index.ts`
- `apps/api/src/app.ts` (gắn route riêng), `apps/api/src/luot-choi.test.ts` (thêm khóa cấm `lo_trinh`, `xe_muc_tieu`, `diem_chan`, `seed_lo_trinh`)
- `apps/web/app/components/tro-choi/giao-dien.tsx` (một mục; prop tùy chọn `buocOffline` của `PropsBuoc`, đã hỏi), `apps/web/app/routes/tro-choi.offline.tsx` (truyền `buocOffline`, đã hỏi), `apps/web/app/routes/api.$.tsx` (một đường cho phép)
- `scripts/demo-tro-choi.ts` (bước 14), `docs/DEMO.md` (mục 7o)

**File tạo**
- M9: `packages/dao-tao/src/ban-do/` (`luoi.ts`, `duong-di.ts`, `index.ts`), `packages/dao-tao/tests/ban-do.test.ts`, `apps/web/app/components/tro-choi/chung/BanDoO.tsx`
- `packages/dao-tao/src/tro-choi/truy-vet.ts`, `packages/dao-tao/tests/truy-vet.test.ts`
- `packages/db/src/truy-vet.ts`
- `apps/api/src/routes/truy-vet.ts`, `apps/api/src/truy-vet.test.ts`
- `apps/web/app/components/tro-choi/TruyVet.tsx`, `apps/web/app/lib/truy-vet.ts`, `apps/web/app/lib/ve-canh/ve-truy-vet.ts`
- `data/tro-choi/truy-vet.json`
- `scripts/e2e/truy-vet.ts`

**Migration**
- `0052_truy_vet.sql`: `INSERT INTO games`: `truy_vet`, `offline_ok = true` (D24), `enabled = false`, `ordinal = 20`.

**Kiểm tra đã xong**
- [x] Unit test sinh lộ trình: cùng seed cùng lộ trình; lộ trình qua đủ số camera của màn; xe mồi không khớp hoàn toàn mô tả; có ít nhất một điểm chặn đúng.
  - `packages/dao-tao/tests/truy-vet.test.ts`, 20 ca, chạy trên chính 8 vụ mẫu và cả 3 biến thể: mỗi chặng là đường ngắn nhất; đổi biến thể thì đường khác; chơi đúng ở mọi vụ đều đặt được điểm chặn đúng. Có thêm: đoạn cảnh chạy M5 không va chạm; màn 1 không có xe khác cùng màu.
  - M9: `packages/dao-tao/tests/ban-do.test.ts`, 6 ca (bản đồ sai báo đúng dòng, cột; giao lộ; luật đặt vật; đường ngắn nhất tất định; không dùng lượng giác, `Math.random`, `Date.now`).
- [x] Unit test chấm: khóa nhầm −3 không làm điểm bước âm; điểm chặn đặt sau khi xe đã qua thì sai; lượt xem còn dư tính đúng.
  - Có thêm: chơi đúng đủ điểm tối đa ở cả 8 vụ; lượt online bỏ qua thao tác mở camera máy khách gửi; nhật ký offline mở camera khi chưa tới giờ mà không chờ thì cả bước 0 điểm; nhật ký thiếu hoặc thừa điểm chặn bị từ chối; đề không có lộ trình, seed, bí mật của lượt, biển số đầy đủ; ảnh chụp qua JSON cho cùng đề, cùng kết quả (so băm).
- [x] API test: không phản hồi nào trả lộ trình đầy đủ trước khi chấm (test quét khóa cấm thêm các khóa của lộ trình); mở camera chưa được phép theo thời gian mô phỏng bị từ chối; id xe khác nhau giữa hai đoạn cảnh.
  - `apps/api/src/truy-vet.test.ts`, 7 ca. Có thêm: bị từ chối thì không ghi gì, không mất lượt xem; người khác mở camera, đọc lượt nhận 403; chưa đăng nhập 401; vào lại lượt có sẵn đoạn cảnh đã mở; điểm, cờ đúng và thao tác mở camera giả của máy khách bị bỏ qua; bước đã chấm thì route nhận 409; XP một lần; đồng bộ offline chấm lại từ nhật ký, gửi lại không sinh lượt mới; lượt offline không mở camera qua route được; chấm lại dưới 200 ms.
- [x] ~~API test khung (nếu sửa khung theo D23)~~: không sửa khung (D23 chọn route riêng). `luot-choi.test.ts` (đã thêm khóa cấm) vẫn đạt.
- [x] `bun run e2e truy-vet`: màn 1–2 ở 360×740; giảm chuyển động hiện đoạn cảnh theo khung tĩnh.
  - Đạt (khoảng 20–27 giây). Màn 1 chế độ thường: hướng dẫn, chọn camera bằng danh sách, phát đoạn cảnh, tạm dừng lúc xe trong khung, chọn xe, đặt điểm chặn bằng chạm; đủ điểm; chi tiết của hộp kết quả đủ số đoạn cảnh, có dòng "Căn cứ đang được cập nhật"; một dòng XP. Màn 2 giảm chuyển động: bước từng giây bằng nút, khung vẽ không tự chạy, chọn xe bằng bàn phím, đặt điểm chặn bằng phím mũi tên và Enter.
- [ ] **Đủ nội dung đã duyệt:** ít nhất 5 vụ; đơn vị xác nhận trò không lộ phương pháp nghiệp vụ không được công bố.
  - **Chưa làm được:** 8 vụ là dữ liệu demo, chưa duyệt; lời tin báo do hệ thống soạn. Kho văn bản không có văn bản về bỏ chạy sau tai nạn (kho chỉ có 2 nghị định). Chưa có xác nhận của đơn vị. Trò đang tắt.
- Mục kiểm tra chung GĐ-T:
  - [x] Test chấm điểm: như trên.
  - [x] API test bảo mật: điểm và cờ đúng máy khách gửi bị bỏ qua; người khác đọc lượt, mở camera nhận 403; phản hồi trước khi chấm (đề, phản hồi mở camera, lượt khi vào lại) không có khóa cấm (`answer`, `dap_an`, `giai_thich`, `can_cu`, `explanation`, `noi_dung`, `lo_trinh`, `xe_muc_tieu`, `diem_chan`, `seed_lo_trinh`, `seed`, `bi_mat`, `xe_bo_chay`, `vai`); `phan-quyen.test.ts` vẫn đạt.
  - [x] Cổng chung: `bun test` 1749 đạt, 5 hỏng (cả 5 ở `ports.test.ts`, lỗi môi trường Windows có từ trước); `bun run build:web` qua; Biome qua với các tệp của giai đoạn (còn một cảnh báo `useOptionalChain` ở `docTraLoi`, giữ để TypeScript thu hẹp kiểu). E2E `truy-vet`, `offline`, `tro-choi-khung`, `soi-camera`, `chot-dem` đạt. `bun run typecheck` đạt với mọi tệp của giai đoạn; lần chạy cuối có một lỗi ở `packages/dao-tao/tests/tai-dung.test.ts` (tệp của phiên GĐ-T10 đang làm song song, không liên quan GĐ-T17).
  - [x] Chơi thử một lượt đầy đủ ở 360×740, chế độ thường (màn 1) và giảm chuyển động (màn 2), qua E2E và soát ảnh chụp.
  - [ ] Hiệu năng CPU chậm 4×; mã riêng ≤ 12 KB gzip.
    - Đạt khung hình: đoạn cảnh màn 1 trung bình 60 khung/giây, p95 16,8 ms với CPU chậm 4× (E2E). Màn 5 chưa đo trên trình duyệt.
    - **Chưa đạt ngân sách mã:** đo từng tệp riêng lẻ (cách của GĐ-T11, `bun build --minify`, không tính mô-đun dùng chung): `TruyVet.tsx` 7,3 KB, `ve-truy-vet.ts` 1,1 KB, `truy-vet.ts` 8,2 KB gzip, cộng khoảng 16,6 KB. Logic gồm cả phần sinh lộ trình và bộ kiểm vụ, điện thoại cần khi chơi offline.
  - [x] Dữ liệu mẫu đánh dấu "demo, chưa duyệt"; bảng cần kiểm tra và hình cần bổ sung ở GAME_DESIGN §5.17 cập nhật theo thực tế.
  - [x] DEMO.md có dòng màn hình và cách chơi thử (mục 7o).
  - [x] Có bản tóm tắt thay đổi để người dùng commit.

**Trạng thái (30/9/2026):** đã làm xong phần mã; trò tắt (`games.enabled = false`) cho tới khi có nội dung đã duyệt và đơn vị xác nhận. Còn hai mục chưa đạt: nội dung đã duyệt (căn cứ chưa có trong kho) và ngân sách mã riêng (16,6 KB so với 12 KB).
- Quyết định của người dùng khi làm giai đoạn này:
  - D22: tạo M9 ngay trong GĐ-T17 theo GAME_DESIGN §4.1 (GĐ-T6, GĐ-T16 chưa làm); hai giai đoạn đó dùng lại.
  - D23: route riêng của trò, không sửa khung. **Đồng ý** ghi nhật ký mở camera, khóa xe vào ảnh chụp bước (`game_runs.items[0].noi_dung.nhat_ky`), để máy chủ chấm online chỉ tin nhật ký này.
  - D24: có offline, gói mang seed và lộ trình. **Đồng ý** thêm prop tùy chọn `buocOffline` vào `PropsBuoc` và truyền ở trang offline.
  - D15: theo trả lời đã có (trừ trong phạm vi bước, sàn 0).
  - Kho văn bản (MCP `quydinhphapluat`) kết nối được nhưng không có kết quả; màn kết quả ghi "Căn cứ đang được cập nhật", không viện dẫn theo trí nhớ.
- Thay đổi so với dự kiến:
  - **Mở camera chưa được phép** hiểu là: đồng hồ trong trò chưa tới thời điểm đoạn cảnh + 5 giây (cảnh chưa ghi xong). Route từ chối (409, kèm số giây phải chờ) trừ khi người chơi chọn chờ; giao diện tự tính và hiện nút "Chờ … giây rồi xem".
  - Thưởng lượt xem dư chỉ tính khi chặn đúng (không thì mở 0 camera cũng được 10 điểm).
  - Sai hướng tính theo việc đoạn cảnh có xe bỏ chạy hay không; người chơi thấy đồng hồ nhảy thêm 30 giây nên biết camera đó sai (đánh đổi ghi ở GAME_DESIGN §5.17).
  - Mỗi vụ có 3 biến thể lộ trình (lượt chọn ngẫu nhiên) để chơi lại không thuộc đường; bộ kiểm chạy đủ 3 biến thể.
  - Cỡ ô bản đồ lớn (200–250 m), trần cạnh ô của M9 là 500 m: xe cần chạy thêm khoảng 80 giây sau camera cuối mới đặt được điểm chặn đúng, ô nhỏ thì bản đồ 16 ô không đủ dài.
  - Màn 1–3 dùng lưới giao lộ cách 3 ô; màn 4–5 lưới cách 2 ô, camera xen kẽ để có giao lộ không camera (đoạn khuất).
  - Mỗi camera phải có ít nhất 2 nhánh đường; bản đồ có ít nhất một camera ngoài đường xe chạy.
  - Chưa có trình soạn riêng: vụ soạn bằng JSON ở `/quan-tri/noi-dung-tro-choi`; bộ kiểm `kiemTraVu` chạy khi lấy nguồn.
  - Lượt offline chưa giữ tiến độ khi thoát giữa chừng (như GĐ-T13, GĐ-T15); lượt online giữ được (nhật ký ở máy chủ).
  - Phiên GĐ-T10 chạy song song, cùng sửa `khung.ts`, `dang-ky.ts`, `index.ts`, `nguon-tro-choi.ts`, `seed-tro-choi.ts` (mỗi phiên một dòng). Các dòng của GĐ-T17 vẫn đủ sau khi phiên kia sửa.

---

## GĐ-T18 — 10 phút đầu tại hiện trường

**Mục tiêu**
- Người chơi bảo vệ hiện trường, gọi cấp cứu, sơ cứu, đánh dấu dấu vết theo đúng thứ tự trên cảnh có đồng hồ trong trò.

**Thiết kế** (GAME_DESIGN §5.18)
- Kịch bản là đồ thị bước có điều kiện trước, hạn làm, hậu quả. Một kịch bản là một bước; máy chủ chạy lại nhật ký theo nhịp đồng hồ trong trò (M7).
- Điểm: bước quan trọng đúng hạn 10, hậu quả −10 (không âm), thời gian dư 1 mỗi 30 giây (tối đa 10).
- Bước nghiệp vụ trỏ tới `procedures` dạng mở rộng của T4 (câu D26). Sơ cứu theo câu D27. Không làm phần nối với trò 10 (câu D25).

**Việc làm**
1. Tra kho văn bản: trách nhiệm khi xảy ra tai nạn, bảo vệ hiện trường, cấp cứu người bị nạn. Kỹ thuật sơ cứu không có trong kho thì ghi "chưa có trong kho", đánh dấu demo, ghi "cần cán bộ y tế xác nhận".
2. Quy trình demo "Bảo vệ hiện trường, cấp cứu" trong `data/tra-cuu/quy-trinh.json` (theo D26), nguồn "tài liệu nghiệp vụ do đơn vị cung cấp".
3. Logic thuần `tro-choi/muoi-phut-dau.ts`: kiểm đồ thị (không chu trình, mọi bước tới được), máy trạng thái theo đồng hồ trong trò, hậu quả, chấm.
4. Web: cảnh SVG, kéo (`KeoTha`), giữ (`Giu`), đồng hồ trong trò, hậu quả trên cảnh; trình soạn đồ thị bước; 8 kịch bản demo.

**File sửa**
- `data/tra-cuu/quy-trinh.json` (thêm quy trình demo)
- `apps/web/app/routes/quan-tri.noi-dung-tro-choi.sua.tsx` (gắn trình soạn đồ thị bước)

**File tạo**
- `packages/dao-tao/src/tro-choi/muoi-phut-dau.ts`, `packages/dao-tao/tests/muoi-phut-dau.test.ts`
- `packages/db/src/muoi-phut-dau.ts`
- `apps/api/src/muoi-phut-dau.test.ts`
- `apps/web/app/components/tro-choi/MuoiPhutDau.tsx`, `apps/web/app/lib/muoi-phut-dau.ts`
- `apps/web/app/components/quan-tri/tro-choi/SoanDoThiBuoc.tsx`
- `data/tro-choi/muoi-phut-dau.json`
- `scripts/e2e/muoi-phut-dau.ts`

**Migration**
- `0053_muoi_phut_dau.sql`: `INSERT INTO games`: `muoi_phut_dau`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [ ] Unit test máy trạng thái: cùng nhật ký cùng hậu quả; làm bước khi chưa đủ điều kiện trước thì ghi đúng hậu quả của kịch bản; quá hạn thì hậu quả xảy ra đúng mốc.
- [ ] Unit test bộ kiểm đồ thị: chu trình, bước không tới được, bước không có hạn bị báo lỗi chỉ đúng bước.
- [ ] Unit test chấm: hậu quả −10 không làm điểm bước âm; thưởng thời gian dư tối đa 10.
- [ ] API test: đồng hồ trong trò không bị máy khách tua (nhật ký có nhịp lệch đồng hồ máy chủ quá mức cho phép thì bước 0 điểm); đề không có bước quan trọng, điểm, dòng thời gian mẫu.
- [ ] `bun run e2e muoi-phut-dau`: màn 1–2 ở 360×740, giữ bộ đàm bằng chạm và bằng bàn phím; giảm chuyển động hiện hậu quả bằng ảnh tĩnh.
- [ ] **Đủ nội dung đã duyệt:** thứ tự thao tác do đơn vị cung cấp; nội dung sơ cứu có cán bộ y tế xác nhận (hoặc đã bỏ theo D27); ít nhất 5 kịch bản.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục, như GĐ-T11).

---

## GĐ-T19 — Tạm giữ phương tiện

**Mục tiêu**
- Người chơi kiểm đếm, lập danh mục, niêm phong, chọn thời hạn và nơi giữ khi tạm giữ một xe.
- Mở rộng M4: loại biên bản tạm giữ.

**Thiết kế** (GAME_DESIGN §5.19)
- Một xe, 4 bước theo thứ tự của khung chung; bước 4 không mở khi chưa xong bước 3.
- Điểm: mỗi đồ vật hoặc vết ghi đúng 3, bỏ sót đồ giá trị −10 (không âm trong bước), mỗi thẻ danh mục đúng 2, niêm phong đúng 5 mỗi vị trí, thời hạn đúng 10, nơi giữ đúng 5.
- Hình gửi dạng nét, không kèm danh sách vật; máy chủ khớp tọa độ trong bán kính 24px.
- Thời hạn từ quy trình "Tạm giữ phương tiện" trong `procedures` (câu D26), tính theo ngày giờ Việt Nam; ngày nghỉ theo câu D28.
- Hình xe dùng lại bộ dựng hình của T14 (chuyển sang `tro-choi/chung/`, **hỏi trước**).

**Việc làm**
1. Tra kho văn bản: tạm giữ phương tiện, giấy tờ theo thủ tục hành chính (thời hạn, biên bản, bảo quản, trả lại). Ghi vào bảng cần kiểm ở GAME_DESIGN §5.19.
2. Quy trình demo "Tạm giữ phương tiện" trong `data/tra-cuu/quy-trinh.json`, tham số thời hạn ở bước tương ứng.
3. M4 (**hỏi trước**): loại biên bản tạm giữ trong `chung/bien-ban.ts` và `BienBan.tsx`.
4. Logic thuần `tro-choi/tam-giu.ts`: khớp tọa độ, chống ghi trùng, chấm 4 bước, tính thời hạn.
5. Web: hình xe nhiều phía, khay loại vật, thẻ danh mục, giữ để niêm phong (`Giu`), lịch; phần "Khiếu nại khi trả xe" ở màn kết quả; 12 xe demo.

**File sửa**
- `packages/dao-tao/src/tro-choi/chung/bien-ban.ts`, `apps/web/app/components/tro-choi/chung/BienBan.tsx` (M4)
- `packages/dao-tao/src/tro-choi/hinh-xe-tham-so.ts` (chuyển sang `tro-choi/chung/`, sửa import của T14; **hỏi trước**)
- `data/tra-cuu/quy-trinh.json`

**File tạo**
- `packages/dao-tao/src/tro-choi/tam-giu.ts`, `packages/dao-tao/tests/tam-giu.test.ts`
- `packages/db/src/tam-giu.ts`
- `apps/api/src/tam-giu.test.ts`
- `apps/web/app/components/tro-choi/TamGiu.tsx`, `apps/web/app/lib/tam-giu.ts`
- `data/tro-choi/tam-giu.json`
- `scripts/e2e/tam-giu.ts`

**Migration**
- `0054_tam_giu.sql`: `INSERT INTO games`: `tam_giu`, `offline_ok = true`, `enabled = false`.

**Kiểm tra đã xong**
- [ ] Unit test chấm: ghi trùng một đồ vật chỉ tính một lần; chạm ngoài bán kính không tính; bỏ sót đồ giá trị −10 không làm điểm bước âm.
- [ ] Unit test thời hạn: tính theo ngày giờ Việt Nam; ca biên qua nửa đêm; ca biên qua ngày nghỉ (nếu văn bản có quy định, theo D28).
- [ ] Unit test M4 mở rộng: biên bản của trò 1, 4, 5, 9 không đổi.
- [ ] API test: bước 4 không mở khi chưa xong bước 3 (409); đề không có danh sách vật, vết, vị trí niêm phong, thời hạn đúng.
- [ ] `bun run e2e tam-giu`: màn 1–2 ở 360×740, đủ 4 bước; giảm chuyển động. E2E của trò 14 vẫn đạt sau khi chuyển bộ dựng hình.
- [ ] **Đủ nội dung đã duyệt:** quy trình tạm giữ có căn cứ trong kho; ít nhất 8 xe.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục, như GĐ-T11).

---

## GĐ-T20 — Bản đồ điểm đen

**Mục tiêu**
- Người chơi đọc lớp dữ liệu tai nạn giả lập, khoanh điểm đen, đặt biện pháp trong ngân sách, xem kết quả 12 tháng.
- Mở rộng M9: lớp dữ liệu tai nạn, lớp nhiệt, mô hình số vụ 12 tháng.

**Thiết kế** (GAME_DESIGN §5.20)
- Một bản đồ là một bước; "Mô phỏng 12 tháng" là nộp bài, một lần.
- Điểm: khoanh đúng 10 mỗi điểm, khoanh điểm giả −5, mức giảm so với tối ưu tối đa 60, chi phí dư tối đa 10 (chỉ khi đạt từ 80% mức giảm tối ưu).
- Bảng hiệu quả biện pháp không gửi xuống điện thoại; mô hình chạy ở máy chủ, tất định; không offline.
- Phương án tối ưu tính sẵn khi duyệt bằng script. Không dùng M5 (câu D31). Không khóa theo XP (câu D29). Nối với trò 7 theo câu D30.

**Việc làm**
1. Kiểm M9: chưa có thì **dừng và hỏi** theo quy tắc 11 của Phần chung.
2. Tra kho văn bản: tiêu chí xác định điểm đen, trách nhiệm xử lý, quy định đặt gờ giảm tốc, biển báo, đèn tín hiệu (QCVN 41:2024 nếu có trong kho).
3. M9 (**hỏi trước**): `ban-do/tai-nan.ts` (lớp vụ tai nạn, lớp nhiệt, mô hình số vụ theo nguyên nhân và biện pháp).
4. Logic thuần `tro-choi/diem-den.ts`: kiểm ngân sách, khoanh, chấm. Script `scripts/tinh-phuong-an-toi-uu.ts` tính phương án tối ưu khi duyệt, ghi vào `answer`.
5. Web: lớp nhiệt (`lib/ve-canh/ve-lop-nhiet.ts`), bộ lọc giờ và loại xe, khoanh nhóm ô, kéo biện pháp, kết quả trước và sau; 8 bản đồ demo, bảng hiệu quả biện pháp demo ghi "mô phỏng minh họa".

**File sửa**
- `packages/dao-tao/src/ban-do/*`, `apps/web/app/components/tro-choi/chung/BanDoO.tsx` (M9)
- `packages/db/src/noi-dung-tro-choi.ts` hoặc script duyệt: gọi tính phương án tối ưu khi duyệt (**hỏi trước** nếu sửa khung duyệt)

**File tạo**
- `packages/dao-tao/src/ban-do/tai-nan.ts`, `packages/dao-tao/src/tro-choi/diem-den.ts`
- `packages/dao-tao/tests/tai-nan.test.ts`, `diem-den.test.ts`
- `packages/db/src/diem-den.ts`
- `apps/api/src/diem-den.test.ts`
- `apps/web/app/components/tro-choi/DiemDen.tsx`, `apps/web/app/lib/ve-canh/ve-lop-nhiet.ts`, `apps/web/app/lib/diem-den.ts`
- `data/tro-choi/diem-den.json`, `data/tro-choi/hieu-qua-bien-phap.json`
- `scripts/tinh-phuong-an-toi-uu.ts`
- `scripts/e2e/diem-den.ts`

**Migration**
- `0055_diem_den.sql`: `INSERT INTO games`: `diem_den`, `offline_ok = false`, `enabled = false`.

**Kiểm tra đã xong**
- [ ] Unit test mô hình: cùng phương án cùng kết quả; biện pháp không hợp nguyên nhân giảm ít hơn biện pháp hợp; không biện pháp thì không giảm.
- [ ] Unit test chấm: khoanh vùng hơn 9 ô không tính; điểm giả −5 không làm điểm bước âm; thưởng chi phí dư chỉ khi đạt 80% mức giảm tối ưu.
- [ ] Unit test script: phương án tối ưu đúng trên bản đồ thử nhỏ (so với duyệt hết bằng tay).
- [ ] API test: vượt ngân sách nhận 400; đề không có bảng hiệu quả, điểm đen đúng, phương án tối ưu; thời gian chấm ở máy chủ dưới 1 giây cho bản đồ lớn nhất.
- [ ] `bun run e2e diem-den`: màn 1–2 ở 360×740; giảm chuyển động hiện hai bản đồ tĩnh.
- [ ] **Đủ nội dung đã duyệt:** tiêu chí điểm đen có căn cứ trong kho; bảng hiệu quả biện pháp được đơn vị chấp nhận làm "mô phỏng minh họa"; ít nhất 5 bản đồ. **Mốc M6:** đủ 20 trò bật trên máy demo.
- [ ] Các mục kiểm tra chung GĐ-T (8 mục, như GĐ-T11).

---

## Phụ lục A — Việc không nằm trong kế hoạch này

Các việc sau chờ quyết định, xem GAP_ANALYSIS §4:

- Chuyển backend sang NestJS (xem giả định A1).
- Tách FE Admin thành ứng dụng riêng (A2).
- Gỡ hẳn các chức năng ngoài phạm vi PRD: nhân vật đồng hành, trường hợp ứng dụng, lĩnh vực đầu tư CNTT, MCP. Hiện chỉ ẩn theo A8.
- ~~Game đối kháng thời gian thực (PRD #13)~~ và ~~các game còn lại trong danh sách 20~~: danh sách 20 trò đã được thay bằng 10 trò ở PRD mục V (25/9/2026), rồi thay tiếp bằng 10 trò mô phỏng (27/9/2026); xem GĐ-G0 và GĐ-T1 đến GĐ-T10.
- Hoàn tất các giai đoạn trò chơi của danh sách cũ (GĐ-G1 đến GĐ-G10): dừng, xem [luu-tru/PLAN_TRO_CHOI_CU.md](luu-tru/PLAN_TRO_CHOI_CU.md) và GAME_DESIGN §8 câu D1, D2.
- AI soạn nội dung trò chơi vào hàng chờ duyệt: dùng lại bước sinh của GĐ8 khi cần (GAME_DESIGN §3).
- Chuyển các trò cũ từ `practice_sessions` sang `game_runs`: không làm, các trò cũ đã tắt.
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
| `0019_diem_thuong.sql` | 9 | XP, chuỗi ngày, huy hiệu, thử thách hằng ngày |
| `0020_tro_choi.sql` | 10 | Màn chơi, tiến độ, kỷ lục |
| `0021_bai_hoc_chu_de.sql` | 11 | Gắn bài học với chủ đề câu hỏi |
| `0022_bien_bao.sql` | 12 | Biển báo |
| `0023_offline.sql` | 13 | Đồng bộ offline chống trùng |
| `0024_sach_noi.sql` | 14 | Âm thanh bài giảng, vị trí nghe |
| `0025_thong_bao.sql` | 15 | Đăng ký nhận thông báo, cài đặt, chống gửi trùng |
| `0026_ask_logs_tai_khoan.sql` | 0 | Thay cho `0010` (xem trạng thái GĐ0) |
| `0027_tro_choi_nen.sql` | G0 | Đăng ký trò chơi, nội dung trò chơi, lịch sử duyệt chung, lượt chơi, bước, gói offline, hồ sơ chủ đề; vòng đời duyệt cho mức phạt, biển báo, quy trình; `xp_ledger.unit_id` |
| `0029_toc_do_toi_da.sql` | G2 (cũ) | Tốc độ tối đa theo loại xe và loại đường. Đã có |
| `0030_lap_bien_ban.sql` | G3 (cũ) | Đăng ký trò. Đã có |
| `0033_mua_giai.sql` | G6 (cũ) | Mùa giải, bảng hạng theo tuần. Đã có |
| `0035_bien_bao_phan_ung.sql` | G8 (cũ) | Phản ứng đúng với từng biển báo. Đã có |
| `0036_kiem_tra_giay_to.sql` | T1 | Luật giấy tờ, tiến độ màn chơi, đăng ký trò |
| `0037_phong_thoat_hiem.sql` | T2 | Đếm lần nhập mật mã, đăng ký trò |
| `0038_cam_bien.sql` | T3 | Đăng ký trò |
| `0039_dung_xe.sql` | T4 | Bước quy trình có thao tác, đăng ký trò |
| `0040_soi_camera.sql` | T5 | Đăng ký trò |
| `0041_dieu_phoi.sql` | T6 | Loại sự việc, đăng ký trò |
| `0042_thanh_pho.sql` | T7 | Khu phố của đơn vị, công trình đã đặt, đăng ký trò |
| `0043_dieu_tiet_giao_lo.sql` | T8 | Hiệu lệnh điều khiển giao thông, đăng ký trò |
| `0044_tu_lai.sql` | T9 | Đăng ký trò |
| `0045_tai_dung.sql` | T10 | Đăng ký trò. Đã viết |
| `0046_phat_nguoi.sql` | T11 | Cột `nhom` và nhóm luật hồ sơ phạt nguội trong `document_rules` (D16), đăng ký trò. Đã viết |
| `0047_tram_can.sql` | T12 | Ngưỡng tải trọng `load_limits`, bốn cột khung quá tải của `violations`, đăng ký trò. Đã viết |
| `0048_len_xe_khach.sql` | T13 | Nhóm luật vận tải hành khách trong `document_rules`, đăng ký trò. Đã viết |
| `0049_soi_xe_cai_tao.sql` | T14 | Đăng ký trò. Đã viết |
| `0050_chot_dem.sql` | T15 | Đăng ký trò |
| `0051_phan_luong.sql` | T16 | Đăng ký trò |
| `0052_truy_vet.sql` | T17 | Đăng ký trò (`offline_ok = true` theo D24; không bảng mới). Đã viết |
| `0053_muoi_phut_dau.sql` | T18 | Đăng ký trò |
| `0054_tam_giu.sql` | T19 | Đăng ký trò |
| `0055_diem_den.sql` | T20 | Đăng ký trò (không offline) |
| `0056_nhom_hoc_cung.sql` | 16a | Nhóm học cùng: nhóm, thành viên, mục chia sẻ, lượt cổ vũ; `practice_sessions.group_item_id` và nguồn `nhom` |
| `0057_nhom_hoc_ai.sql` | 16d | Kết quả AI của nhóm học cùng (`study_group_ai_notes`) |

`0056`, `0057` cho Nhóm học cùng (GĐ16a–16d). GĐ16c đo thấy không cần index nên không có migration; `0057` là của GĐ16d (đã tạo ngày 30/9/2026). Nếu sau này cần index cho báo cáo thì dùng số kế tiếp còn trống (Đ18 trả lời "Không" ngày 29/9/2026, PROMPT_NHOM_HOC_CUNG.md mục 2.9).

GĐ17a–17c (hộp kết quả đúng/sai trong trò chơi) chỉ sửa giao diện web, không có migration.

Số `0028`, `0031`, `0032`, `0034` giữ chỗ cho danh sách cũ, không dùng. `migrate.ts` sắp theo tên nên khoảng trống không ảnh hưởng.

T11–T20 đánh số từ `0046`: tệp lớn nhất đang có trong `packages/db/migrations` là `0044_tu_lai.sql`, còn `0045` đã giữ chỗ cho T10. `migrate.ts` áp mọi tệp chưa áp theo thứ tự tên, nên làm theo thứ tự T11 → T12 → T14 → T13 (tức `0046`, `0047`, `0049`, rồi `0048`) vẫn áp đủ.

**Migration nới CHECK:** `content_reviews.kind` (`0036`, `0041`, `0043`, `0047`), `document_rules.check_kind`, `doc_kind` (`0036`, `0046`, `0048`), `document_rules.nhom` (`0046`, `0048`) và `practice_sessions.source` (`0014`, `0020`, `0022`, `0024`, `0056`) được xóa rồi tạo lại ở nhiều migration. Vì các migration có thể được viết và áp không theo thứ tự số, mỗi migration nới CHECK phải liệt kê **mọi giá trị đã có trong mọi migration đã viết**, kể cả migration số lớn hơn. Ví dụ: viết `0041` sau khi đã có `0047` thì CHECK của `0041` phải có cả `load_limit`.

Mọi migration đều **chỉ thêm** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) và không xóa dữ liệu cũ. Nhờ vậy chạy lại được, và CSDL thật trên DigitalOcean nâng cấp an toàn qua job `migrate` có sẵn.
