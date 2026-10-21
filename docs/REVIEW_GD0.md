# Review độc lập GĐ0 — Nền móng và vá bảo mật

Ngày review: 24/9/2026. Đối chiếu với `docs/PLAN.md` mục GĐ0 và mã trong cây làm việc hiện tại. Lượt review này không sửa code.

> **Cập nhật 25/9/2026:** các vấn đề Nghiêm trọng 1–3 và Nên sửa 4, 6, 7, 8 đã được sửa. S2–S5 đã làm, có test trong `phan-quyen.test.ts`, migration là `0026_ask_logs_tai_khoan.sql`; chi tiết ở dòng trạng thái GĐ0 trong `docs/PLAN.md`. Còn mở: mục 5 (MCP ghi người duyệt theo tham số), 9, 10, 11. Phần dưới đây giữ nguyên như lúc review.

## Tóm tắt

**Mới xong S1 trong 5 lỗ hổng.** Mã hiện tại vẫn còn mở S2, S3, S4, S5. Thăm dò trực tiếp bằng `createApp().request` cho thấy:

| Thăm dò | Kỳ vọng | Kết quả thực tế |
|---|---|---|
| `POST /v1/ask` không có token | 401 | **200**, gọi mô hình và ghi `ask_logs` |
| Cột `ask_logs.account_id` | có | **không có** |
| B gọi `GET /v1/dao-tao/ghi-danh/<id của A>/tien-do` | 403 | **200**, đọc được tiến độ của A |
| B gọi `GET /v1/dao-tao/ghi-danh/<id của A>/on-tap` | 403 | **200** |
| B gọi `PATCH /v1/dao-tao/ghi-danh/<id của A>` với `goalMinutesPerWeek: 999` | 403 | **200**, mục tiêu tuần của A thành 999 |
| B gọi `POST /v1/dao-tao/bai/:id/tien-do` với ghi danh của A | 403 | 403 (đã chặn) |
| `NODE_ENV=production`, `POST /v1/auth/demo` vai trò `quan_tri` | bị từ chối | **200**, cấp phiên quản trị |
| Preflight `OPTIONS` với `Access-Control-Request-Method: DELETE` | cho phép DELETE | 204 nhưng `allow-methods: GET,POST,OPTIONS`, **trình duyệt sẽ chặn** |

**Kết luận: GĐ0 chưa đủ điều kiện để coi là xong.** Các giai đoạn sau đã được làm tiếp trong khi S2–S5 còn mở, nên các lỗ hổng này đang có trong mã hiện tại.

Lượt thăm dò `POST /v1/ask` không token đã ghi thêm một dòng vào `ask_logs` của CSDL test (câu hỏi "Vượt đèn đỏ bị phạt bao nhiêu?", mô hình giả lập). Không có dữ liệu thật nào bị đổi.

## 1. Phạm vi thay đổi

- **Không tách được thay đổi riêng của GĐ0 bằng `git diff`.**
  - Kho chỉ có một commit (`87b65f0 khởi tạo dự án`). Mọi giai đoạn từ GĐ0 tới GĐ15 đều nằm chung trong cây làm việc chưa commit:
    - 97 tệp đã theo dõi bị sửa;
    - 54 tệp bị xóa, đã stage;
    - 127 tệp mới.
  - Việc làm số 1 của GĐ0 ("Chốt trạng thái giao diện đang dựng lại", commit thành một mốc riêng) **chưa làm**. Vì vậy không có "mốc trước GĐ0" nào khác ngoài HEAD.
  - Review này đối chiếu theo danh sách tệp của kế hoạch.
- **Đối chiếu danh sách "File sửa / File tạo" của GĐ0:**

| Tệp trong kế hoạch | Tình trạng |
|---|---|
| `apps/api/src/routes/editorial.ts` | Đã sửa cho S1, đúng phạm vi |
| `apps/api/src/routes/ask.ts` | **Không đổi so với HEAD**, S2 chưa làm |
| `apps/api/src/routes/dao-tao.ts` | Có sửa, nhưng thuộc GĐ9/GĐ11 (hoàn thành bài, XP). Riêng `POST /bai/:id/tien-do` có kiểm chủ sở hữu ghi chú "GĐ0, S3". Các route `:id` khác chưa kiểm |
| `apps/api/src/app.ts` | Có sửa, nhưng thuộc GĐ2 (nhật ký truy cập) và các route mới. CORS (S5) **không đổi** |
| `packages/auth/src/demo.ts`, `config.ts` | **Không đổi**, S4 chưa làm |
| `packages/db/src/dao-tao.ts`: `chuGhiDanh`, `chuTheOn` | **Không có** hai hàm này |
| `.env.example`: `ASK_QUOTA_PER_DAY`, `CORS_ORIGINS`, `AUTH_DEMO_ADMIN` | **Chưa thêm**. `.env.example` chỉ có thêm biến VAPID của GĐ15 |
| Migration `0010_ask_logs_tai_khoan.sql` | **Không tồn tại**. Dãy migration nhảy từ 0009 sang 0011 |
| `apps/api/src/phan-quyen.test.ts` (tạo mới) | Có, nhưng chỉ có khối S1 |

- **Tệp ngoài danh sách của GĐ0:** `apps/api/src/editorial.test.ts`. Người dùng đã đồng ý sửa khi làm S1. Thay đổi cần thiết: test cũ gọi duyệt không có token nên phải thêm token `phap_che`.
- **Chức năng mới hoặc refactor ngoài phạm vi trong phần S1:** không có. Diff của `editorial.ts` chỉ gồm:
  - kiểm quyền;
  - bỏ `reviewerId` khỏi body;
  - ghi nhật ký theo email.

## 2. Từng lỗ hổng

### S1 — API biên tập: **Đạt** (còn một đường vòng qua MCP, xem mục vấn đề)

- Xem hàng đợi cần `bien_tap`: `editorial.ts:43`.
- Xử lý mục hàng đợi cần `bien_tap`: `editorial.ts:78`.
- Duyệt và từ chối cùng đi qua `reviewAmendOp`, cần `phap_che`: `editorial.ts:106`. Cùng mức với công cụ MCP `duyet_lenh_sua_doi` (`packages/auth/src/rbac.ts:75`).
- `reviewer_id = ${nguoi.email}` (`editorial.ts:120`). `reviewSchema` không còn trường `reviewerId` nên body không đưa vào được.
- Nhật ký `audit_log` ghi email người thao tác thay vì chuỗi cố định `"api"`.
- Thứ tự kiểm tra an toàn:
  - quyền được kiểm trước khi đọc id, nên người không có quyền không dò được id nào tồn tại;
  - id sai định dạng trả 400;
  - id không tồn tại trả 404.
- Đường vòng:
  - **MCP `duyet_lenh_sua_doi`** được chặn đúng vai trò `phap_che`, nhưng vẫn lấy `reviewer_id` từ tham số `nguoi_duyet` do client gửi (`apps/mcp/src/tools/van-hanh.ts:348`). Nhật ký cũng ghi theo tham số đó.
  - Tương tự, `xu_ly_viec_bien_tap` ghi `assignee` theo tham số `nguoi_xu_ly`.
  - Nằm ngoài danh sách tệp của kế hoạch, nhưng là cùng chức năng.
- `POST /review-queue/:id/resolve` vẫn nhận `assignee` từ body (`editorial.ts:85`). Chấp nhận được: đây là giao việc cho người khác, không phải ghi danh tính người xử lý. Danh tính người xử lý đã ghi vào `audit_log` theo phiên.

### S2 — Hỏi đáp AI: **Chưa đạt**

- `ask.ts` giống hệt HEAD:
  - `ask.post("/")` (`ask.ts:139`) không gọi `batBuocDangNhap`;
  - không có hạn mức;
  - `INSERT INTO ask_logs` (`ask.ts:331`) không có `account_id`.
- Không có migration nào thêm `ask_logs.account_id`.
- Giờ Việt Nam và biến môi trường thiếu hoặc sai: **không áp dụng được**, vì chưa có mã hạn mức.
- `ASK_QUOTA_PER_DAY` không xuất hiện ở bất kỳ tệp nào.
- Giao diện `apps/web/app/routes/ask.tsx` đã viết sẵn nhánh xử lý 401 và 429 "(GĐ0 S2)", nhưng API không bao giờ trả hai mã này.
- Hệ quả: ai cũng gọi được mô hình AI có tính phí, không giới hạn, và không truy được ai đã hỏi.

### S3 — API học tập: **Chưa đạt**

Rà toàn bộ route nhận `:id` hoặc id ghi danh trong `apps/api/src/routes/dao-tao.ts`:

| Route | Kiểm chủ sở hữu | Ghi chú |
|---|---|---|
| `PATCH /ghi-danh/:id` (`:333`) | **Không** | Người khác đổi được chế độ học, mục tiêu tuần, mascot của A (đã thăm dò) |
| `POST /bai/:id/tien-do` (`:444`) | Có (`:458`) | Kiểm `ghiDanhId` thuộc người gọi. Chưa kiểm bài `:id` có thuộc chuyên đề của ghi danh đó không (nhẹ) |
| `POST /hoat-dong/:id/nop` (`:498`) | **Không** | `ghiDanhId` lấy từ body (`:503`) không được kiểm: ghi lượt làm, mức thành thạo, thẻ ôn vào ghi danh của người khác |
| `GET /ghi-danh/:id/on-tap` (`:611`) | **Không** | Đọc được thẻ ôn và đề bài của người khác (đã thăm dò) |
| `POST /the-on/:id/on` (`:641`) | **Không** | Ôn thay thẻ của người khác, làm lệch lịch ôn của họ |
| `GET /ghi-danh/:id/tien-do` (`:683`) | **Không** | Chính là ca trong "Kiểm tra đã xong"; B nhận 200 (đã thăm dò) |
| `POST /chuyen-de/:slug/ghi-danh`, `/hoan-thanh` | Không cần | Dùng `principal.accountId` |

- Hai hàm `chuGhiDanh(id)` và `chuTheOn(id)` mà kế hoạch yêu cầu chưa có.
- Ngoài `dao-tao.ts`, `POST /v1/mascot/phan-hoi` cũng nhận `ghiDanhId` từ body mà không kiểm chủ. Chỉ ghi sự kiện, mức độ thấp.

### S4 — Đăng nhập demo: **Chưa đạt**

- `demoEnabled()` (`packages/auth/src/demo.ts:20`) chỉ xét `AUTH_DEMO_PASSWORD`.
- `POST /v1/auth/demo` (`apps/api/src/routes/auth.ts:115`) không xét `NODE_ENV` hay `AUTH_DEMO_ADMIN`.
- Thăm dò với `NODE_ENV=production` cấp được phiên `quan_tri`.
- Hiện `.do/app.yaml` không đặt `AUTH_DEMO_PASSWORD`, nên bản chạy thật mặc định đang tắt demo. Nhưng chỉ cần ai đó đặt biến này để trình diễn là mở ngay quyền quản trị cho bất kỳ ai biết mật khẩu chung.

### S5 — CORS: **Chưa đạt**

- `allowMethods: ["GET", "POST", "OPTIONS"]` (`apps/api/src/app.ts:49`): thiếu `PATCH`, `PUT`, `DELETE`.
- `CORS_ORIGINS` đã được đọc từ trước GĐ0 (`app.ts:41`), nhưng **mặc định là `*`** khi thiếu biến, và không có trong `.env.example`.
- Ảnh hưởng thực tế hiện nhỏ, vì web gọi API từ máy chủ (SSR) chứ không từ trình duyệt. Nhưng các API quản trị mới (GĐ2, GĐ3, GĐ6) dùng `PATCH` và `DELETE` sẽ hỏng ngay khi có trình duyệt gọi thẳng.

## 3. Migration `0010_ask_logs_tai_khoan.sql`

- **Không tồn tại**, nên không đánh giá được việc chạy lại nhiều lần hay ảnh hưởng tới dữ liệu cũ.
- Nhận xét trên bản trong kế hoạch, khi được tạo:
  - `ADD COLUMN IF NOT EXISTS` và `CREATE INDEX IF NOT EXISTS` chạy lại được.
  - Cột mới cho phép NULL, nên dòng cũ giữ nguyên, `account_id = NULL`.
  - `ON DELETE SET NULL` giữ lại lịch sử hỏi khi xóa tài khoản.
  - Nên đặt số **0026** (hoặc số kế tiếp lúc tạo), không dùng 0010. Hệ thống migrate đã áp dụng tới 0025; một tệp 0010 mới có thể bị bỏ qua hoặc chạy lệch thứ tự, tùy cách `migrate.ts` so sánh. Cần kiểm lại trước khi đặt số.

## 4. Kiểm thử

### Kết quả chạy

- `bun test`: **976 đạt, 5 hỏng.**
  - Cả 5 ở `packages/config/src/ports.test.ts`, lỗi môi trường Windows, có từ trước và không liên quan GĐ0.
  - Riêng `phan-quyen.test.ts`, `editorial.test.ts`, `ask.test.ts`, `dao-tao.test.ts`, `auth.test.ts`: 54/54 đạt.
- `bun run build:web`: qua.

### Đối chiếu từng ô "Kiểm tra đã xong" với `phan-quyen.test.ts`

| Ô kiểm tra | Test | Đánh giá |
|---|---|---|
| `approve`: 401 không token, 403 với `bien_tap`, thành công với `phap_che`, `reviewer_id` là email | `phan-quyen.test.ts:94–132` | **Đạt, test mạnh.** Có assert mã HTTP và mã lỗi; đọc lại `reviewer_id` trong CSDL; cố tình gửi `reviewerId: "gia-mao"` để chứng minh body bị bỏ qua; kiểm cả `audit_log`. Test chạy qua `createApp().request` thật, không mock bước kiểm quyền. Thiếu nhỏ: chưa có ca `phap_che` từ chối thành công, chưa có ca id không tồn tại (404) |
| `POST /v1/ask` 401 và 429 | Không có | **Chưa đạt**: không có test, và mã không làm (thăm dò trả 200) |
| B gọi tiến độ của A nhận 403 | Không có | **Chưa đạt**: không có test, thăm dò trả 200 |
| `NODE_ENV=production` chặn demo `quan_tri` | Không có | **Chưa đạt**: không có test, thăm dò trả 200 |
| Preflight DELETE được chấp nhận | Không có | **Chưa đạt**: không có test; phản hồi không cho phép DELETE |
| Cổng chung qua, `build:web` qua | — | **Đạt** về mặt chạy được. Nhưng ô này mô tả mốc "các trang còn là PageStub"; mốc đó chưa từng được commit |

Không thấy test nào pass "giả". Các test S1 đều assert mã HTTP cụ thể và đối chiếu dữ liệu trong CSDL. Vấn đề là **thiếu hẳn** test cho S2–S5, chứ không phải test yếu.

## 5. Bảng tổng hợp

| Mục | Kết quả | Lý do |
|---|---|---|
| Việc 1: commit mốc giao diện | Chưa đạt | Kho chỉ có một commit; không có mốc riêng |
| S1 — API biên tập | **Đạt** | Đủ ba yêu cầu, có test mạnh; còn đường MCP lấy người duyệt từ tham số |
| S2 — Hỏi đáp AI | **Chưa đạt** | Không bắt đăng nhập, không hạn mức, không ghi `account_id`, không có migration |
| S3 — API học tập | **Chưa đạt** | 5 route còn lộ dữ liệu hoặc cho ghi vào ghi danh của người khác; chỉ 1 route đã chặn |
| S4 — Demo `quan_tri` | **Chưa đạt** | Không xét `NODE_ENV` hay `AUTH_DEMO_ADMIN` |
| S5 — CORS | **Chưa đạt** | Thiếu `PATCH`, `PUT`, `DELETE`; origin mặc định `*` |
| Migration 0010 | **Chưa đạt** | Không có tệp |
| `.env.example` | **Chưa đạt** | Thiếu `ASK_QUOTA_PER_DAY`, `CORS_ORIGINS`, `AUTH_DEMO_ADMIN` |
| Ô kiểm tra 1 (`approve`) | **Đạt** | `phan-quyen.test.ts:94–132` |
| Ô kiểm tra 2 (`ask` 401/429) | **Chưa đạt** | Không có mã, không có test |
| Ô kiểm tra 3 (tiến độ của người khác) | **Chưa đạt** | Thăm dò trả 200 |
| Ô kiểm tra 4 (demo production) | **Chưa đạt** | Thăm dò trả 200 |
| Ô kiểm tra 5 (preflight DELETE) | **Chưa đạt** | `allow-methods` không có DELETE |
| Ô kiểm tra 6 (cổng chung, `build:web`) | **Cần xem lại** | Chạy qua, nhưng mốc PageStub chưa được commit như kế hoạch mô tả |

## 6. Danh sách vấn đề

### Nghiêm trọng

1. **S3: lộ và sửa được dữ liệu học tập của người khác.**
   - Đọc được: `GET /ghi-danh/:id/tien-do`, `GET /ghi-danh/:id/on-tap`.
   - Ghi được: `PATCH /ghi-danh/:id`, `POST /hoat-dong/:id/nop` (qua `ghiDanhId` trong body), `POST /the-on/:id/on`.
   - Id là UUID nên khó đoán, nhưng id ghi danh có xuất hiện trong phản hồi và URL phía giao diện.
2. **S2: hỏi đáp AI mở cho khách, không giới hạn.**
   - Ai cũng đốt được chi phí mô hình.
   - `ask_logs` không truy được người hỏi.
3. **S4: đặt `AUTH_DEMO_PASSWORD` trên máy chủ thật là mở quyền `quan_tri`** cho bất kỳ ai biết mật khẩu chung. Hiện chưa đặt, nên rủi ro nằm ở cấu hình, nhưng không có hàng rào nào trong mã.

### Nên sửa

4. S5: thêm `PATCH`, `PUT`, `DELETE` vào `allowMethods`; bỏ mặc định `*` khi `NODE_ENV=production`; ghi `CORS_ORIGINS` vào `.env.example`.
5. MCP `duyet_lenh_sua_doi` và `xu_ly_viec_bien_tap` ghi người duyệt và người xử lý theo tham số client gửi, thay vì theo danh tính phiên MCP. Vai trò thì đã được chặn đúng.
6. Viết test cho S2–S5 trong `phan-quyen.test.ts` đúng như các ô "Kiểm tra đã xong", kèm ca `phap_che` từ chối lệnh và ca id không tồn tại cho S1.
7. `PLAN.md` mục GĐ0 chưa có dòng trạng thái, và các ô vẫn `[ ]`. Nên ghi rõ "mới xong S1" để các giai đoạn sau không mặc định rằng nền bảo mật đã có. Ví dụ giao diện hỏi đáp (GĐ1) đã viết sẵn nhánh 401/429 cho S2.
8. Đặt số migration cho `ask_logs.account_id` theo số kế tiếp hiện tại (0026 trở đi), không dùng 0010.

### Góp ý nhỏ

9. `POST /bai/:id/tien-do` kiểm ghi danh thuộc người gọi, nhưng chưa kiểm bài `:id` thuộc chuyên đề của ghi danh đó.
10. `POST /v1/mascot/phan-hoi` nhận `ghiDanhId` từ body không kiểm chủ; chỉ ghi sự kiện thống kê.
11. Việc số 1 của GĐ0 (commit mốc) chưa làm. Toàn bộ GĐ0 tới GĐ15 đang nằm chung một cây chưa commit, nên review theo giai đoạn chỉ dựa được vào danh sách tệp.

## 7. Kết luận

**GĐ0 chưa đạt.** Chỉ S1 làm đúng và có test tốt. S2, S3, S4, S5, migration và `.env.example` chưa làm. Vì các giai đoạn sau đã được xây trên nền này, các lỗ hổng đang có trong mã hiện tại, không chỉ ở mốc GĐ0.

Đề nghị làm tiếp S2 → S5 theo đúng kế hoạch trước khi coi GĐ1 trở đi là có nền an toàn. Nên ưu tiên S3 và S2, vì hai mục này lộ dữ liệu người dùng và tốn chi phí thật.
