# PROMPT LÀM CHỨC NĂNG NHÓM HỌC CÙNG

*Soạn ngày 29/9/2026. Dùng cho phiên trợ lý lập trình (Claude Code) làm việc trong repo này.*

**Chức năng:** cán bộ lập nhóm học cùng, chia sẻ bài học và đề ôn tập vào nhóm để các thành viên khác cùng học. Mỗi thành viên có tiến độ theo phần trăm. Thành viên cổ vũ lẫn nhau. Cán bộ quản lý xem tiến độ học của mọi cán bộ trong đơn vị mình. Giao diện dùng hộp thoại (modal). Một số việc dùng mô hình AI.

---

## 0. Cách dùng

1. **Chạy Prompt 0 trước, một lần.** Prompt này đưa chức năng vào [PLAN.md](PLAN.md) thành GĐ16a đến GĐ16d và lập danh sách câu hỏi cần trả lời. Chưa viết mã.
2. **Trả lời các câu N1–N17 ở mục 2.8 và các đề xuất Đ1–Đ18 ở mục 2.9** (ghi vào cột "Trả lời"). Câu nào còn trống thì phiên làm mã sẽ dừng lại hỏi.
3. **Mỗi giai đoạn một phiên riêng.** Dán nguyên khối prompt của giai đoạn (mục 4) vào phiên mới. Mỗi prompt đã tự trỏ về Phần chung (mục 1) và Đặc tả (mục 2).
4. **Thứ tự bắt buộc:** GĐ16a → GĐ16b → GĐ16c → GĐ16d. GĐ16d (AI) làm sau cùng và bỏ được nếu N12 chọn không làm AI.
5. **Không chạy song song** với phiên khác đang sửa `packages/db/src/bao-cao.ts`, `packages/db/src/luyen-tap.ts`, `apps/web/app/lib/site.ts` hoặc thư mục `packages/db/migrations`.

| GĐ | Nội dung | Phụ thuộc | Migration |
|---|---|---|---|
| 16a | CSDL, cách tính tiến độ, cổ vũ, API cho người học | GĐ4, GĐ9, GĐ11 (đã xong) | `0056_nhom_hoc_cung.sql` |
| 16b | Giao diện người học, các hộp thoại | 16a | — |
| 16c | Quản lý: xem nhóm, báo cáo tiến độ học, xuất Excel/PDF | 16a | Không có: đo ngày 29/9/2026 thấy không cần index. Cần sau này thì `0057_nhom_hoc_bao_cao.sql` và 16d chuyển sang `0058` (Đ18) |
| 16d | AI: gợi ý thứ tự học, tóm tắt tiến độ cho quản lý | 16a, 16b, 16c | `0057_nhom_hoc_ai.sql` (nếu 16c không dùng `0057`) |

---

## 1. Phần chung (mọi prompt đều trỏ về đây)

> Mọi phiên làm GĐ16a–16d phải đọc và theo đúng phần này.

### 1.1. Người dùng

- **Người học** là cán bộ, chiến sĩ (vai trò `can_bo`), học trên điện thoại xen giữa ca trực. Mỗi lần mở nhóm chỉ vài phút: xem còn bài nào chưa học, học tiếp, cổ vũ đồng đội.
- **Cán bộ quản lý** (vai trò `quan_ly`) xem trên máy tính là chính, cần bảng, bộ lọc và xuất Excel như báo cáo GĐ7.
- Nhóm học cùng là **hoạt động tự nguyện**. Nó không thay việc giao bài, giao đề chính thức (`exam_assignments`).

### 1.2. Tài liệu phải đọc trước khi làm

- [PLAN.md](PLAN.md) §0 (nguyên tắc chung, cổng kiểm §0.2, bảng kiểm giao diện §0.4), giai đoạn GĐ16 đang làm, và GĐ7, GĐ9, GĐ11 làm mẫu (cách ghi "Trạng thái", "Quy tắc nghiệp vụ đã chốt").
- [QUY-TAC-HANH-VAN.md](../QUY-TAC-HANH-VAN.md) và [VISUAL_STYLE.md](VISUAL_STYLE.md).
- Mục 2 của tệp này (Đặc tả) và câu trả lời ở mục 2.8.

### 1.3. Hiện trạng mã (khảo sát và đối chiếu mã ngày 29/9/2026, kiểm lại trước khi dựa vào)

**API và quyền**
- Hono. Mỗi miền một tệp `apps/api/src/routes/<miền>.ts`, gắn vào `apps/api/src/app.ts` bằng `app.route("/v1/...")`.
  - Một tệp có thể export hai route: một cho người học, một cho quản trị.
  - Các route `/v1/quan-tri/<miền>` gắn trước dòng `app.route("/v1/quan-tri", quanTri)`.
- Kiểm đầu vào bằng zod qua `parseBody`, `parseQuery`. Lỗi dùng `badRequest`, `notFound`, `conflict`. Tất cả ở `apps/api/src/http.ts`.
  - `ApiError` chỉ có mã 400, 404, 409, 500, 501.
  - 403 ném bằng lớp `KhongDuQuyen`, `NgoaiPhamVi` ở `apps/api/src/auth.ts`. 429 và 503 trả thẳng bằng `c.json(..., mã)`, ví dụ `routes/ask.ts`.
- Vai trò ở `packages/auth/src/rbac.ts`, thứ tự từ thấp lên: `khach < can_bo < tra_cuu < quan_ly < bien_tap < phap_che < quan_tri`.
  - Không có vai trò "học viên": người học là `can_bo`.
  - Hàm `trongPhamVi(principal, unitPath)` kiểm theo cây đơn vị (ltree). Tài khoản chưa gắn đơn vị thì không nằm trong phạm vi của ai, trừ `quan_tri`.
- Hàm kiểm quyền trong `apps/api/src/auth.ts`: `batBuocDangNhap`, `batBuocVaiTro`, `phamViCua`, `batBuocPhamViDonVi`. Hàm `ghiNhatKy` cùng tệp ghi `audit_log`.
- Phía web: `yeuCauVaiTro`, `duVaiTro` ở `apps/web/app/lib/session.server.ts`.
- **Giới hạn tần suất (429):** không có hàm dùng chung.
  - Đăng nhập đếm lượt sai trong bảng `login_attempts` (5 lần trong 15 phút). Hỏi đáp đếm theo `ask_logs`.
  - Giọng đọc đếm trong bộ nhớ bằng `choPhepDoc` (`apps/api/src/giong-doc.ts`).
  - API chạy 1 instance (`.do/app.yaml`, `instance_count: 1`).

**CSDL**
- SQL thuần qua postgres.js (`packages/db/src/client.ts`). Không dùng drizzle: gói `drizzle-orm` có trong `package.json` nhưng không tệp nào import.
- Postgres 16 trên máy dev (`infra/docker-compose.yml`). Repo không ghi phiên bản Postgres của máy chủ DigitalOcean.
- Migration lớn nhất đang có là `0050_chot_dem.sql`. Nhóm học cùng bắt đầu từ `0056`, vì các số sau đã giữ chỗ (PLAN Phụ lục B):
  - `0051`–`0055` cho T16–T20;
  - `0037`, `0041`, `0042`, `0043`, `0045` cho T2, T6, T7, T8, T10, chưa có tệp.
- Bảng tên tiếng Anh, giá trị liệt kê tiếng Việt không dấu (ví dụ CHECK `exam_attempts.status IN ('dang_lam','da_nop')`).
- Đơn vị: `units.path` kiểu ltree; tài khoản gắn đơn vị qua `accounts.unit_id`. Khóa chính của `accounts`, `units` là uuid, mặc định `uuid_generate_v4()`.
- Tài khoản: họ tên ở `accounts.name`, cấp bậc ở `accounts.rank_title`, cùng `username`, `email`. Khóa tài khoản là đặt `enabled = false`; mã không xóa cứng tài khoản, chỉ test xóa khi dọn dữ liệu.

**Bài học, luyện tập, thi**
- **Bài học:** `courses`, `lessons` (`status`, `topic_id`, `estimated_minutes`), `lesson_blocks`.
  - Trang bài học chỉ mở khi **cả chuyên đề và bài** ở `xuat_ban`; thiếu một trong hai thì API bài học trả 404 (`apps/api/src/routes/dao-tao.ts`, `GET /chuyen-de/:slug/bai/:baiSlug`).
  - Ghi danh: `enrollments`, UNIQUE theo `(account_id, course_id)`.
  - Tiến độ: `lesson_progress`, khóa chính `(enrollment_id, lesson_id)`, có `last_block_ordinal`. Cột `state` nhận `chua_mo|dang_hoc|xong` theo chú thích, không có CHECK, mặc định `dang_hoc`.
- **Phần trăm một bài:** hàm nội bộ `phanTramBai()` ở `apps/api/src/routes/dao-tao.ts`, không export.
  - Bài xong là 100. Bài đang học tính bằng `last_block_ordinal / số khối`, làm tròn bằng `Math.round`, tối đa 99. Số khối lấy từ `soKhoiTheoBai(courseId)` ở `packages/db/src/dao-tao.ts`, đếm theo một chuyên đề.
  - Hàm `hoanThanhBaiHoc`, `ghiTienDo` ở `packages/db/src/dao-tao.ts`. `hoanThanhBaiHoc` tự ghi danh nếu chưa có.
  - **Trang web chưa gửi vị trí khối.** Không tệp nào trong `apps/web/app` gọi `POST /v1/dao-tao/bai/:id/tien-do`. Mở bài khi đã ghi danh chỉ ghi `dang_hoc` với khối 0; chưa ghi danh thì mở bài không ghi gì. Vì vậy phần trăm một bài hiện chỉ là 0 hoặc 100 (xem N14).
- **Luyện tập:** `practice_sessions`.
  - CHECK của cột `source` được tạo ở `0014` và nới lại ở `0020`, `0022`, `0024`, `0056`. Danh sách giá trị đầy đủ nằm trong các migration đó; khi nới CHECK phải liệt kê đủ mọi giá trị đã có.
  - Mỗi phiên lưu ảnh chụp câu ở `items`, số câu ở `total`, lúc kết thúc ở `finished_at`, số câu đúng ở `correct`. Câu trả lời ở `practice_answers`, UNIQUE `(session_id, question_id)`.
  - Kiểu `NguonPhien` ở `packages/db/src/luyen-tap.ts`. `POST /v1/luyen-tap/phien` chỉ nhận `chu_de`, `cau_sai`. Phiên offline luôn ghi `chu_de`.
- **Rút câu theo chủ đề:** `nguonTheoChuDe` (gồm chủ đề con) và `chuDeLuyenTap` (số câu đã duyệt gồm chủ đề con) ở `packages/db/src/luyen-tap.ts`; `rutCauLuyenTap({ soCau })` (chia đủ ba mức độ) ở `packages/dao-tao/src/luyen-tap.ts`.
- **Thi:** bảng `exams` (đề 30–40 câu, trạng thái `nhap|xuat_ban|dong`), `exam_assignments` (giao cho đơn vị hoặc cho một người), `exam_attempts` (`dang_lam|da_nop`), view `v_ket_qua_thi`.

**Báo cáo, thông báo**
- **Báo cáo GĐ7:** `apps/api/src/routes/bao-cao.ts` và `packages/db/src/bao-cao.ts`.
  - Có 4 báo cáo và `GET /bo-loc`. Xuất `?dinh_dang=xlsx|pdf`, mỗi lần xuất ghi `audit_log` với hành động `bao_cao.xuat`.
  - Hàm `chuanBi()` (quyền, phạm vi, 403 khi chưa gắn đơn vị) và `traVe()` (JSON, Excel, PDF, ghi nhật ký) trong `routes/bao-cao.ts` dùng lại được.
  - **Chưa có báo cáo tiến độ bài học.** Báo cáo luyện tập chỉ tính `source` trong hằng `NGUON_LUYEN_TAP = ['chu_de','cau_sai','nhom']` ở `packages/db/src/bao-cao.ts`. Báo cáo câu hỏi khó tính mọi câu trả lời luyện tập, không lọc `source`.
- **Thông báo:** chỉ có Web Push, không có hộp thư trong ứng dụng.
  - Bảng ở `0025_thong_bao.sql`, chống gửi trùng bằng UNIQUE `(account_id, kind, ref)`. `notifications_sent.kind` không có CHECK.
  - `notification_prefs` có cột bật/tắt `new_exam`; GĐ16a thêm cột `group_activity` cho nhóm học.
  - Kiểu `LoaiThongBao` và hàm `thongBaoCanGui` ở `packages/dao-tao/src/lich-nhac.ts`; `phatThongBao`, `chayNhacHoc` ở `packages/db/src/thong-bao.ts`.
  - **API không tự gửi được thông báo.** Thư viện `web-push` chỉ cài ở `apps/workers-ts`. `phatThongBao` nhận hàm gửi từ ngoài vào, và chỉ job `nhac-hoc` (15 phút một nhịp, `apps/workers-ts/src/bull/workers/nhac-hoc.ts`) gọi nó qua `chayNhacHoc`.

**Web**
- React Router 7; khai báo trang ở `apps/web/app/routes.ts`. Tailwind 4, không dùng thư viện component.
- Component dùng chung ở `apps/web/app/components/ui/`: `Button`, `Card`, `Badge`, `EmptyState`, `Field`, `Icon`, `PageHeader`. `Icon` đã có biểu tượng `copy`.
- `components/luyen-tap/ThanhTienDo.tsx` là thanh tiến độ của phiên luyện tập, hiện "Câu x/y" và "Đúng z". **Không dùng được cho nhóm**, vì lộ số câu đúng.
- Menu ở `apps/web/app/lib/site.ts`:
  - máy tính: `MAIN_NAV` (Tra cứu · Học & luyện tập · Thi) và mục "Tôi" dựng bằng hàm `mucToi`;
  - điện thoại (dưới 768px): thanh dưới `BOTTOM_NAV` (Trang chủ · Học · Thi) cộng mục "Tôi" và nút "Thêm"; ngăn "Thêm" lấy từ `MORE_NAV`;
  - mục "Học" của `BOTTOM_NAV` chép `khop` từ `MAIN_NAV[1]`, nên thêm `/nhom` vào `MAIN_NAV[1].khop` là đủ cho cả hai.
- Làm bài luyện tập ở `/luyen-tap/:phien` và `/luyen-tap/:phien/ket-qua`. Kiểu `nguon` ở `apps/web/app/lib/luyen-tap.server.ts` chỉ có `chu_de`, `cau_sai`, `nhom`.
- **Chưa có component hộp thoại dùng chung.** Hai chỗ dùng thẻ `<dialog>` gốc với `showModal()`: `components/thi/HopXacNhanNop.tsx` và ngăn "Thêm" trong `components/layout/BottomNav.tsx` (chạm nền mờ thì đóng).
  - Lớp `.sheet` (`styles/app.css`) biến hộp thoại thành tấm bám đáy màn hình, chỉ dưới 768px. Từ 768px mỗi hộp tự khai kiểu bằng tiền tố `md:`.
  - `.sheet` không có hiệu ứng chuyển động và không khóa cuộn nền.

**AI**
- Gói `packages/llm`:
  - `complete()`: gọi mô hình.
  - `getProvider()`: `LLM_PROVIDER=anthropic`, hoặc `auto` khi có `ANTHROPIC_API_KEY`, thì dùng Anthropic; còn lại dùng `MockProvider`. `isMock()` cho biết đang dùng mock.
  - `aiChuaCauHinh()` ở `apps/api/src/routes/ask.ts` nhận `LLM_PROVIDER=none` (bản demo không có khóa).
  - `modelFor(tier)`: bậc `light` là `claude-haiku-4-5`.
  - `loadPrompt`, `render`: tệp prompt Markdown có frontmatter và hai mục `## SYSTEM`, `## USER` trong thư mục `prompts/`.
- Kết quả giả lập tất định cho từng prompt viết ở `packages/llm/src/mock.ts`, rẽ nhánh theo `promptName`. GĐ8 là mẫu dùng AI có hậu kiểm tất định.
- Bộ kiểm hành văn `soatChu`, `coLoiChan` ở `packages/dao-tao/src/hanh-van.ts` đã bắt emoji, dấu chấm than, tiểu từ tình thái, khẩu ngữ.

**Kiểm thử**
- **API test:** `createApp().request(...)`, tạo phiên bằng `(await createSession(acc, "test")).token`. Dữ liệu gieo mang tiền tố `PREFIX` và xóa trong `afterAll`. Mẫu: `apps/api/src/bao-cao.test.ts`.
- **E2E:** mỗi kịch bản là một tệp `scripts/e2e/<tên>.ts`, chạy bằng `bun run e2e <tên>`. Ngữ cảnh `NguCanhE2E` (`scripts/e2e/chay.ts`) có sẵn `taoTaiKhoan`, `dangNhap`, `kiemKhongCuonNgang`, `donDep`.

**Chức năng xã hội:** chưa có (không có thích, bình luận, mã mời, nhóm học).

### 1.4. Quy tắc cứng

1. **Tiến độ tính trên máy chủ, lúc đọc, từ dữ liệu gốc** (`lesson_progress`, `practice_sessions`, `exam_attempts`). Không lưu cột phần trăm. Không có API nào nhận phần trăm do máy khách gửi.
2. **Quyền riêng tư.** Thành viên chỉ thấy của nhau: họ tên, phần trăm từng mục, phần trăm chung, số lượt được cổ vũ.
   - Không thấy điểm, số câu đúng, số lần làm, kết quả thi.
   - Điểm chỉ người học và quản lý có phạm vi xem, như quy tắc hiện có.
   - Phản hồi API cho thành viên phải qua test quét khóa cấm (mục 2.5).
3. **Phạm vi quản lý áp ở tầng truy vấn** (`phamViCua`, `trongPhamVi`), không chỉ ở giao diện.
   - `quan_ly` chỉ thấy thành viên thuộc cây đơn vị của mình. Thành viên ngoài phạm vi chỉ hiện số lượng.
   - `quan_tri` thấy tất cả.
4. **Chỉ chia sẻ nội dung đã xuất bản hoặc đã duyệt:** bài học `xuat_ban`, câu hỏi `da_duyet`.
   - Nội dung bị gỡ sau khi đã chia sẻ thì mục hiện "Nội dung không còn được xuất bản" và không tính vào tiến độ.
5. **Việc làm trong nhóm không tính vào tiến độ cá nhân.** Tiến độ nhóm tính bằng phần trăm bài học và đề ôn tập; cổ vũ không ảnh hưởng tiến độ (N8).
6. **Menu người học giữ tối đa 4 mục** (PLAN §0.4). Lối vào nhóm học theo N1, không thêm mục menu thứ năm.
7. **Giao diện điện thoại:**
   - khung 360×740, không cuộn ngang, chữ nội dung ≥ 16px, vùng chạm ≥ 48px;
   - mọi hộp thoại theo mục 2.6;
   - tôn trọng `prefers-reduced-motion`.
8. **Hành văn:**
   - chuỗi hiển thị của hệ thống theo QUY-TAC-HANH-VAN: không emoji, không dấu chấm than;
   - nút cổ vũ ghi nhãn "Cổ vũ", biểu tượng SVG thêm vào `Icon.tsx`, có `aria-label` và `aria-pressed`;
   - trên giao diện không dùng chữ "like", "thả tim".
9. **Nội dung do người dùng nhập** (tên nhóm, mô tả, tên đề ôn tập):
   - giới hạn độ dài, hiển thị dạng văn bản thuần;
   - không nhận HTML, không tự biến thành liên kết;
   - không đưa qua bộ kiểm hành văn.
10. **Đề ôn tập của nhóm chỉ làm online** trong GĐ16. Không đưa vào gói offline của GĐ13.
11. **Migration chỉ thêm và chạy lại được** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
    - Nới CHECK `practice_sessions.source` thì xóa rồi tạo lại, liệt kê **mọi giá trị đã có trong mọi migration**. Tìm các migration đã sửa CHECK này trước khi viết.
    - Cập nhật PLAN Phụ lục B.
12. **Phạm vi sửa:** chỉ sửa tệp ghi ở mục "File sửa" của giai đoạn đang làm, và chỉ phần được nêu.
    - Cần sửa tệp khác thì **hỏi trước**: sửa gì, vì sao, ảnh hưởng tới chức năng nào.
    - Không sửa `HopXacNhanNop.tsx` và các hộp thoại có sẵn.
13. **Câu hỏi quyết định:** đọc cột "Trả lời" ở mục 2.8 trước khi làm.
    - Câu liên quan còn trống thì dừng và hỏi, không tự chọn cột "Đề xuất".
    - Làm khác đặc tả theo câu trả lời thì sửa luôn mục 2 của tệp này và giai đoạn trong PLAN.md.
14. **Trang mới phải có bài hướng dẫn** hoặc khai miễn tạm ở `content/huong-dan/muc-luc.json`. Test `scripts/huong-dan/bao-ve.test.ts` bắt lỗi này.
15. **Không tự commit.** Cuối phiên đưa bản tóm tắt thay đổi để người dùng commit.

### 1.5. Xong một giai đoạn khi

- Qua cổng chung PLAN §0.2: `bun run db:migrate`, `typecheck`, `lint`, `bun test`, `build:web`, `smoke`.
- Qua mọi mục "Kiểm tra đã xong" của giai đoạn trong PLAN.md.
- Test của các giai đoạn đã xong trước đó vẫn đạt.
- PLAN.md được cập nhật: đánh `[x]`, ghi "Trạng thái", "Thay đổi so với dự kiến", "Quy tắc nghiệp vụ đã chốt" theo mẫu GĐ7.
- Test đã hỏng từ trước (ví dụ `packages/config/src/ports.test.ts` trên Windows) thì ghi rõ, không che.

---

## 2. Đặc tả

### 2.1. Vai trò và quyền

*N16 đã trả lời ngày 29/9/2026 (xem gạch đầu dòng cuối mục này). Đã áp câu N11 và đề xuất Đ11 ngày 29/9/2026 (hai gạch đầu dòng cuối).*

| Hành động | Thành viên | Trưởng nhóm | `quan_ly` (cây đơn vị của mình) | `quan_tri` |
|---|---|---|---|---|
| Tạo nhóm | `can_bo` trở lên, kể cả người chưa có nhóm | — | Có, với tư cách người học | Có |
| Tham gia bằng mã mời | Có (N3) | — | Có, với tư cách người học | Có |
| Chia sẻ mục vào nhóm | Có | Có | Chỉ khi là thành viên | Như cột trái |
| Gỡ mục | Mục do mình chia sẻ | Mọi mục | — | — |
| Sắp thứ tự, đặt hạn gợi ý | — | Có | — | — |
| Xem mã mời, liên kết mời | Có | Có | — | — |
| Đổi mã mời | — | Có | — | — |
| Mời ra khỏi nhóm, chuyển quyền trưởng nhóm | — | Có | — | — |
| Rời nhóm | Có | Sau khi chuyển quyền, hoặc khi là người cuối | — | — |
| Xem phần trăm của thành viên | Có | Có | Thành viên trong phạm vi | Tất cả |
| Xem điểm, kết quả | Của mình | Của mình | Thành viên trong phạm vi | Tất cả |
| Cổ vũ | Có | Có | Chỉ khi là thành viên, không cổ vũ từ trang quản trị | Như cột trái |
| Lưu trữ nhóm | — | Có | Nhóm có trưởng nhóm trong phạm vi (N11), ghi `audit_log` | Có |

- Người không phải thành viên gọi API người học của nhóm thì nhận **404**, để không lộ nhóm có tồn tại. Quản lý xem nhóm qua API quản trị riêng.
- Người cuối cùng rời nhóm thì nhóm tự chuyển sang `luu_tru`.
- Nhóm đã lưu trữ chỉ còn xem được, mọi thao tác ghi trả 409.
- Trưởng nhóm bị khóa tài khoản (N16): lần đọc hoặc ghi kế tiếp vào nhóm chuyển quyền cho thành viên đang ở trong nhóm có `joined_at` sớm nhất và tài khoản còn hoạt động. Không còn ai thì nhóm chuyển `luu_tru`.
- Quản lý (N11): xem, và lưu trữ nhóm có trưởng nhóm trong phạm vi, ghi `audit_log` `nhom.luu_tru`. Không sửa nội dung, không giao bài qua nhóm, không cổ vũ từ trang quản trị.
- Phạm vi (Đ11): thành viên chưa gắn đơn vị là "ngoài phạm vi" với mọi `quan_ly`, chỉ `quan_tri` thấy. `quan_ly` chưa gắn đơn vị gọi `/v1/quan-tri/nhom` nhận 403.

### 2.2. Mô hình dữ liệu (migration `0056_nhom_hoc_cung.sql`)

*Đã áp đề xuất Đ5, Đ6, Đ8 và câu N15, N17 ngày 29/9/2026. Đ18 trả lời "Không" ngày 29/9/2026: GĐ16c không cần index nên không có migration (xem bảng mục 0). Đã áp đề xuất Đ7 ngày 30/9/2026 (migration `0057`, GĐ16d).*

Theo Đ5, **không tạo** `study_groups.join_scope` (N3 chọn đề xuất), `study_group_members.show_progress` (N4 chọn đề xuất), `study_group_items.exam_id` và loại `de_thi` (N2 chọn đề xuất).

Tên cột theo quy ước repo: tiếng Anh cho tên, tiếng Việt không dấu cho giá trị. Con số giới hạn là đề xuất (N10), gom thành hằng số trong `packages/dao-tao/src/nhom-hoc.ts`, chỉ CHECK những gì chắc chắn không đổi.

**`study_groups`**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `uuid PK DEFAULT uuid_generate_v4()` | |
| `name` | `text NOT NULL` | CHECK `char_length` 3–80 |
| `description` | `text` | CHECK ≤ 500 ký tự |
| `owner_account_id` | `uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT` | Trưởng nhóm hiện tại; đồng bộ với dòng `truong_nhom` ở bảng thành viên trong cùng giao dịch |
| `unit_id` | `uuid REFERENCES units(id) ON DELETE SET NULL` | Đơn vị của người tạo lúc tạo. Chỉ để lọc. Phạm vi quản lý tính theo đơn vị **hiện tại** của từng thành viên |
| `invite_code` | `text NOT NULL UNIQUE` | 8 ký tự, sinh bằng `crypto`, bảng chữ bỏ ký tự dễ nhầm (0/O, 1/I/L) |
| `status` | `text NOT NULL DEFAULT 'hoat_dong'` | CHECK `IN ('hoat_dong','luu_tru')` |
| `archived_at`, `archived_by` | `timestamptz`, `uuid REFERENCES accounts(id) ON DELETE SET NULL` | |
| `created_at`, `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

Index: `(owner_account_id)`, `(unit_id)`, `(status, updated_at DESC)`.

**`study_group_members`**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `group_id` | `uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE` | |
| `account_id` | `uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE` | |
| `role` | `text NOT NULL DEFAULT 'thanh_vien'` | CHECK `IN ('truong_nhom','thanh_vien')` |
| `joined_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `left_at` | `timestamptz` | Rời hoặc bị mời ra thì đặt giá trị, **không xóa dòng**. Vào lại thì đặt `NULL`, cập nhật `joined_at` |
| `removed_by` | `uuid REFERENCES accounts(id) ON DELETE SET NULL` | Có giá trị khi bị trưởng nhóm mời ra |

- PK `(group_id, account_id)`.
- UNIQUE một phần: `(group_id) WHERE role = 'truong_nhom' AND left_at IS NULL`, để mỗi nhóm có đúng một trưởng nhóm.
- Index một phần `(account_id) WHERE left_at IS NULL`.

**`study_group_items`** (mục được chia sẻ)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `uuid PK DEFAULT uuid_generate_v4()` | |
| `group_id` | `uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE` | |
| `kind` | `text NOT NULL` | CHECK `IN ('bai_hoc','de_on_tap')` |
| `lesson_id` | `uuid REFERENCES lessons(id) ON DELETE CASCADE` | Khi `kind = 'bai_hoc'` |
| `topic_id` | `uuid REFERENCES question_topics(id) ON DELETE SET NULL` | Chủ đề nguồn của đề ôn tập, để hiển thị |
| `question_ids` | `uuid[]` | Đề ôn tập: 5–20 câu `da_duyet` chốt lúc chia sẻ |
| `title` | `text` | Tên đề ôn tập do người chia sẻ đặt, 3–80 ký tự, bắt buộc với đề ôn tập. Bài học để trống và đọc tên từ `lessons.title` lúc hiển thị (Đ6) |
| `shared_by` | `uuid REFERENCES accounts(id) ON DELETE SET NULL` | |
| `ordinal` | `int NOT NULL DEFAULT 0` | Thứ tự do trưởng nhóm sắp |
| `due_date` | `date` | Hạn gợi ý, không bắt buộc, không khóa việc học |
| `removed_at`, `removed_by` | `timestamptz`, `uuid` | Gỡ thì đặt giá trị, không xóa dòng |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

- CHECK theo `kind`, đúng một cột tham chiếu có giá trị:
  - `bai_hoc` có `lesson_id`, không có `question_ids`;
  - `de_on_tap` có `question_ids` với số phần tử 5–20 và có `title`.
- UNIQUE một phần: `(group_id, lesson_id) WHERE kind = 'bai_hoc' AND removed_at IS NULL`. Cùng một bài không chia sẻ hai lần vào một nhóm.
- Index `(group_id, ordinal) WHERE removed_at IS NULL`.

**`practice_sessions` (sửa bảng có sẵn)**
- Thêm cột `group_item_id uuid REFERENCES study_group_items(id) ON DELETE SET NULL`.
- Nới CHECK `source` thêm giá trị `'nhom'`, giữ đủ các giá trị đã có trong các migration trước.
- Thêm index một phần `(group_item_id, account_id) WHERE group_item_id IS NOT NULL`.
- Thêm UNIQUE một phần `(group_item_id, account_id) WHERE group_item_id IS NOT NULL AND finished_at IS NULL`: mỗi người một phiên đang làm cho mỗi đề, bấm "Làm đề" hai lần cùng lúc vẫn chỉ có một phiên.

**`study_group_join_attempts`** (lượt thử mã mời, Đ8): `id bigserial PK`, `account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`, `ok boolean NOT NULL`, `created_at`. Index `(account_id, created_at DESC)`. Đếm như `login_attempts`.

**`notification_prefs` (sửa bảng có sẵn, N15):** thêm `group_activity boolean NOT NULL DEFAULT true`.

**`study_group_cheers`** (lượt cổ vũ)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `bigserial PK` | |
| `group_id` | `uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE` | |
| `from_account_id` | `uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE` | |
| `to_account_id` | `uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE` | |
| `day` | `date NOT NULL` | Ngày giờ Việt Nam (`Asia/Ho_Chi_Minh`), tính như `daily_activity` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

- CHECK `from_account_id <> to_account_id`.
- UNIQUE `(group_id, from_account_id, to_account_id, day)`, theo N7.
- Index `(group_id, to_account_id)` và `(to_account_id, day)` (job thông báo đếm lượt cổ vũ trong ngày).

**`study_group_ai_notes`** (chỉ tạo ở GĐ16d, migration `0057`)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `uuid PK` | |
| `group_id` | `uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE` | |
| `kind` | `text NOT NULL` | CHECK `IN ('thu_tu_hoc','tom_tat_tien_do')` |
| `requested_by` | `uuid REFERENCES accounts(id) ON DELETE SET NULL` | |
| `scope_path` | `ltree` | Phạm vi của quản lý lúc tóm tắt. Mỗi phạm vi một bản tóm tắt riêng |
| `input_hash` | `text NOT NULL` | Băm dữ liệu đầu vào. Cùng dữ liệu thì dùng lại, không gọi mô hình |
| `status` | `text NOT NULL` | CHECK `IN ('dat','bi_loai')` |
| `content` | `jsonb` | Kết quả đã qua hậu kiểm |
| `reject_reason` | `text` | Lý do hậu kiểm loại |
| `model`, `tokens_in`, `tokens_out`, `cost_usd` | `text`, `int`, `int`, `numeric(10,6)` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Chống trùng (Đ7): index duy nhất một phần trên `(group_id, kind, COALESCE(scope_path::text, ''), input_hash) WHERE status = 'dat'`. Chỉ kết quả đạt chặn trùng; mỗi lần bị loại vẫn có dòng riêng để đếm hạn mức và soát lý do. Cột `id` có `DEFAULT uuid_generate_v4()`.

### 2.3. Cách tính tiến độ

*Đã áp đề xuất Đ1, Đ2, Đ3, Đ4 ngày 29/9/2026. Câu hỏi còn chờ: N14.*

Hàm thuần `tinhTienDoNhom(...)` đặt ở `packages/dao-tao/src/nhom-hoc.ts`, có unit test. Truy vấn gom dữ liệu đặt ở `packages/db/src/nhom-hoc.ts`, mỗi nhóm một lượt truy vấn, không truy vấn lặp theo từng người.

**Phần trăm một mục của một thành viên** (số nguyên 0–100):
- **Bài học:** dùng đúng công thức `phanTramBai()`: bài xong là 100; đang học là `last_block_ordinal / số khối`, làm tròn bằng `Math.round`, tối đa 99; chưa ghi danh hoặc chưa mở là 0.
  - `phanTramBai(state, lastBlockOrdinal, soKhoi)` là hàm thuần ở `packages/dao-tao`. `apps/api/src/routes/dao-tao.ts` gọi lại hàm đó, kết quả không đổi (Đ2).
  - Số khối đếm mọi khối của bài, như `soKhoiTheoBai`, trong cùng lượt truy vấn của nhóm.
  - Bài chỉ được tính khi **cả bài và chuyên đề** ở `xuat_ban` (Đ1).
  - Trang bài học hiện chưa gửi vị trí khối, nên trong thực tế bài học là 0 hoặc 100 (N14).
- **Đề ôn tập:** lấy phiên `source = 'nhom'` của mục đó, chọn phiên có phần trăm cao nhất:
  - phiên đã kết thúc là 100 (N6);
  - phiên đang làm tính bằng số câu đã trả lời (dòng `practice_answers`) chia `total` của chính phiên đó, làm tròn xuống, tối đa 99 (Đ4);
  - chưa làm là 0.
- **Dựng đề ôn tập** dùng lại mã có sẵn (Đ3):
  - lúc chia sẻ: `nguonTheoChuDe` (gồm chủ đề con) và `rutCauLuyenTap({ soCau })`, lưu `question_ids`;
  - lúc bắt đầu: `cauHoiDaDuyetTheoId`, `dungCauTheoId` (bỏ câu không còn duyệt, giữ thứ tự, đảo phương án theo seed), `taoPhienLuyenTap` với `groupItemId`;
  - `GET /nguon?loai=chu_de` dùng `chuDeLuyenTap`.
- Không có loại "đề thi" (N2 chọn đề xuất).

**Phần trăm chung của thành viên:** làm tròn xuống trung bình cộng phần trăm các mục được tính (N5). Không có mục nào thì trả `null`, giao diện hiện "Chưa có bài".

**Phần trăm trung bình của nhóm:** trung bình phần trăm chung của các thành viên đang ở trong nhóm, làm tròn xuống.

**Quy tắc biên:**
- Học trước khi vào nhóm vẫn tính. Bài đã xong từ trước là 100.
- Mục đã gỡ, hoặc nội dung không còn xuất bản, không tính.
- Câu hỏi trong đề ôn tập bị gỡ duyệt sau khi chia sẻ thì đề ngắn lại cho mọi người, không thay câu khác. Còn dưới 5 câu (đếm trên `question_ids` còn `da_duyet`, Đ4) thì mục hiện "Nội dung không còn đủ câu", không tính, và không bắt đầu phiên mới được (409).
- Tiến độ của thành viên đã rời nhóm không hiện với thành viên khác.

### 2.4. Cổ vũ

*Đã áp đề xuất Đ8, Đ9, Đ10 và câu N15 ngày 29/9/2026.*

- Mỗi thành viên có nút "Cổ vũ" kèm số lượt đã nhận trong nhóm này.
- Luật mặc định theo N7:
  - mỗi người cổ vũ một thành viên khác tối đa một lần mỗi ngày (giờ Việt Nam) trong mỗi nhóm;
  - bấm lại trong cùng ngày thì bỏ lượt của hôm nay;
  - không tự cổ vũ mình;
  - không cổ vũ người đã rời nhóm.
- API trả `{ da_co_vu, tong }` sau mỗi lần bấm (Đ10). Giao diện cập nhật ngay, lỗi thì trả về trạng thái cũ và báo lỗi.
- Giới hạn 60 lần bấm mỗi phút cho mỗi tài khoản, quá thì trả 429. Đếm trong bộ nhớ theo mẫu `choPhepDoc` (Đ8), vì API chạy 1 instance.
- Không ảnh hưởng tiến độ của người nhận (N8).
- **Thông báo (N9, N15, Đ9):**
  - loại `nhom_hoc` trong `LoaiThongBao`;
  - API không phát thông báo; job `nhac-hoc` (15 phút một nhịp) đếm lượt cổ vũ nhận trong ngày và bài người khác chia sẻ trong ngày, ở nhóm đang hoạt động mà người đó đang là thành viên;
  - mỗi người tối đa một thông báo mỗi ngày (`ref` là ngày giờ Việt Nam), không gửi trong giờ yên lặng, trễ tối đa 15 phút;
  - công tắc riêng `notification_prefs.group_activity`, đổi qua `PUT /v1/thong-bao/cai-dat`.

### 2.5. API

*Đã áp đề xuất Đ1, Đ3, Đ8, Đ10, Đ14 và câu N17 ngày 29/9/2026. Đã áp câu N11, N13 và đề xuất Đ11, Đ12 ngày 29/9/2026 (phần Quản lý, Báo cáo).*

Mọi đầu vào kiểm bằng zod với `.strict()`, để khóa lạ (ví dụ `phan_tram`) bị từ chối.

**Người học: `/v1/nhom`** (tệp `apps/api/src/routes/nhom.ts`, cần đăng nhập, `can_bo` trở lên)

| Phương thức, đường dẫn | Việc |
|---|---|
| `GET /` | Nhóm của tôi: tên, số thành viên, phần trăm của tôi, phần trăm trung bình nhóm |
| `POST /` | Tạo nhóm `{ ten, mo_ta? }`, trả kèm mã mời |
| `GET /:id` | Chi tiết: mục (kèm phần trăm của tôi), thành viên (họ tên, phần trăm chung, lượt cổ vũ, tôi đã cổ vũ hôm nay chưa) |
| `PATCH /:id` | Sửa tên, mô tả (trưởng nhóm) |
| `GET /ma/:ma` | Xem trước nhóm trước khi tham gia: tên, số thành viên, họ tên trưởng nhóm, trạng thái. Mã sai cũng tính vào lượt sai như `POST /tham-gia` |
| `POST /tham-gia` | `{ ma }`, không phân biệt hoa thường, bỏ khoảng trắng và gạch nối. Sai mã quá 10 lần trong 15 phút thì 429 (bảng `study_group_join_attempts`). Nhóm đầy hoặc đã lưu trữ thì 409. Đã ở trong nhóm thì trả nhóm đó |
| `POST /:id/ma-moi` | Đổi mã mời (trưởng nhóm). Mã cũ hết dùng ngay |
| `POST /:id/roi` | Rời nhóm |
| `POST /:id/thanh-vien/:accountId/moi-ra` | Trưởng nhóm mời một thành viên ra khỏi nhóm |
| `POST /:id/thanh-vien/:accountId/truong-nhom` | Chuyển quyền trưởng nhóm |
| `GET /:id/thanh-vien/:accountId/tien-do` | Phần trăm từng mục của một thành viên |
| `GET /nguon?loai=bai_hoc&q=` | Bài `xuat_ban` thuộc chuyên đề `xuat_ban` (Đ1) để chọn chia sẻ, tối đa 30 dòng |
| `GET /nguon?loai=chu_de&q=` | Chủ đề có từ 5 câu `da_duyet` trở lên |
| `POST /:id/muc` | Chia sẻ `{ loai: 'bai_hoc', lesson_id }` hoặc `{ loai: 'de_on_tap', topic_id, so_cau, ten }` |
| `DELETE /:id/muc/:itemId` | Gỡ mục |
| `PUT /:id/muc/thu-tu` | `{ item_ids }`, phải là hoán vị đúng của các mục đang có (trưởng nhóm) |
| `PATCH /:id/muc/:itemId` | Đặt hoặc bỏ hạn gợi ý (trưởng nhóm) |
| `POST /:id/muc/:itemId/bat-dau` | Bài học: trả đường dẫn `/hoc/...`; bài hoặc chuyên đề không còn xuất bản thì 409. Đề ôn tập: tạo phiên `source = 'nhom'` (201); đã có phiên đang làm thì trả phiên cũ (200); còn dưới 5 câu đã duyệt thì 409 |
| `POST /:id/co-vu/:accountId` | Cổ vũ hoặc bỏ cổ vũ hôm nay, trả `{ da_co_vu, tong }` |
| `POST /:id/luu-tru` | Lưu trữ nhóm (trưởng nhóm) |

- Phiên đề ôn tập làm và kết thúc bằng các route luyện tập có sẵn. `GET /v1/luyen-tap/phien/:id` trả thêm `nhom: { id, ten_de }` khi `source = 'nhom'` (Đ14).
- **Test quét khóa cấm:** phản hồi của `GET /v1/nhom/:id` và `GET /v1/nhom/:id/thanh-vien/:accountId/tien-do` không được chứa các khóa `score`, `diem`, `correct`, `so_cau_dung`, `passed`, `dat` ở bất kỳ độ sâu nào.

**Quản lý: `/v1/quan-tri/nhom`** (`quan_ly` trở lên, lọc theo `phamViCua`; `quan_ly` chưa gắn đơn vị nhận 403, Đ11)

| Phương thức, đường dẫn | Việc |
|---|---|
| `GET /?don_vi=&q=&trang_thai=` | Các nhóm có ít nhất một thành viên trong phạm vi |
| `GET /:id` | Thành viên trong phạm vi: phần trăm từng mục, điểm đề ôn tập, lần học gần nhất. Kèm số thành viên ngoài phạm vi. Nhóm không có ai trong phạm vi thì 404 |
| `POST /:id/luu-tru` | Theo N11, ghi `audit_log` `nhom.luu_tru`. Trưởng nhóm ngoài phạm vi thì 403 |

**Báo cáo: `GET /v1/bao-cao/tien-do-hoc`** (thêm vào `routes/bao-cao.ts`)
- Dùng lại `chuanBi()` và `traVe()` của `routes/bao-cao.ts` (Đ12): cùng cách lọc phạm vi, xuất tệp và ghi `audit_log` `bao_cao.xuat`.
- Tham số: `don_vi`, `tu`, `den`, `nhom`, `dinh_dang=xlsx|pdf`.
- Mỗi cán bộ trong phạm vi một dòng:
  - họ tên, đơn vị;
  - bài học đã xong trên số bài đã ghi danh, kèm phần trăm;
  - số phiên luyện tập và tỷ lệ đúng;
  - bài thi được giao, đã nộp, đạt;
  - số nhóm đang tham gia, phần trăm trung bình trong các nhóm;
  - lần học gần nhất.
- Cách đếm ba cột (Đ12):
  - "số bài đã ghi danh" là số bài `xuat_ban` thuộc chuyên đề `xuat_ban` người đó đã ghi danh;
  - "bài thi được giao" tính như cột "Được giao" của báo cáo tổng hợp đơn vị GĐ7;
  - "lần học gần nhất" là thời điểm lớn nhất trong `lesson_progress.updated_at`, `practice_answers.created_at`, `exam_attempts.submitted_at`.
- Lọc `nhom` thì chỉ lấy thành viên của nhóm đó trong phạm vi.
- Phạm vi theo N13: tiến độ chung của từng cán bộ trong cây đơn vị (bài học, luyện tập, thi, nhóm), không chỉ trong nhóm.

### 2.6. Giao diện và hộp thoại

*Đã áp câu N1 (chọn khác), N14, N15 và đề xuất Đ13, Đ14 ngày 29/9/2026.*

**Trang người học**
- `/nhom`: danh sách nhóm của tôi.
  - Hai nút chính: "Tạo nhóm" và "Nhập mã mời". Cả hai mở hộp thoại.
  - Chưa có nhóm thì hiện `EmptyState` kèm hai nút đó.
- `/nhom/:id`:
  - Đầu trang: tên nhóm, thanh tiến độ của tôi, phần trăm trung bình nhóm.
  - Phần "Bài trong nhóm": mỗi dòng có tên, loại, hạn gợi ý, phần trăm của tôi, nút "Học bài" hoặc "Làm đề".
  - Phần "Thành viên": họ tên, phần trăm chung, nút "Cổ vũ" kèm số lượt.
  - Chạm vào một thành viên thì mở hộp thoại tiến độ của người đó.
- `/nhom/tham-gia/:ma`: trang đích của liên kết mời. Chưa đăng nhập thì chuyển sang đăng nhập rồi quay lại.
- Lối vào theo N1 (chọn khác): thẻ "Nhóm học cùng" trên `/luyen-tap`, và dòng "Nhóm học cùng" trong ngăn "Thêm" (`MORE_NAV`) trên điện thoại. Không có dòng ở `/toi`.
  - `/nhom` nằm trong `khop` của mục "Học & luyện tập", nên mục đó (và mục "Học" trên điện thoại) sáng khi đang ở trang nhóm.
- Thanh phần trăm dùng `components/nhom/ThanhPhanTram.tsx` (Đ13), không dùng `ThanhTienDo`.
- Đề ôn tập làm trên trang `/luyen-tap/:phien` có sẵn; đầu trang hiện "Đề ôn tập của nhóm: <tên đề>", trang kết quả có nút chính "Về nhóm" (Đ14).
- Bài học hiện 0% hoặc 100% vì trang bài học chưa gửi vị trí khối (N14 chọn không sửa trang bài học).
- Công tắc "Báo khi có lượt cổ vũ hoặc bài mới trong nhóm học cùng" trong khối Nhắc học ở `/toi` (N15).

**Hộp thoại**
- Tạo component chung `apps/web/app/components/ui/HopThoai.tsx`, theo mẫu `HopXacNhanNop.tsx`:
  - dùng `<dialog>` và `showModal()`;
  - lớp `.sheet` để thành tấm trượt từ đáy trên điện thoại, hộp giữa màn hình từ 768px;
  - có `aria-labelledby`, đóng bằng Esc, trả tiêu điểm về nút đã mở;
  - khóa cuộn nền khi mở.
  - Props gợi ý: `{ mo, tieuDe, onDong, children, hanhDong }`.

| Hộp thoại | Nội dung |
|---|---|
| Tạo nhóm | Tên, mô tả. Tạo xong hiện mã mời và nút "Sao chép liên kết mời" |
| Tham gia nhóm | Nhập mã, xem trước tên nhóm và số thành viên. Có câu nêu rõ thành viên khác sẽ thấy họ tên và phần trăm tiến độ của bạn, không thấy điểm (N4). Nút "Tham gia nhóm" |
| Chia sẻ vào nhóm, mở từ trong nhóm | Chọn loại. Bài học: ô tìm bài. Đề ôn tập: chọn chủ đề, số câu (5–20), đặt tên |
| Chia sẻ vào nhóm, mở từ trang bài học | Nút "Chia sẻ vào nhóm" trên `/hoc/:course/:lesson` mở hộp thoại chọn một hoặc nhiều nhóm |
| Mời thành viên | Mã mời, liên kết, nút "Đổi mã mời" (trưởng nhóm, có bước xác nhận) |
| Tiến độ của thành viên | Phần trăm từng mục của một người. Trưởng nhóm có thêm "Chuyển quyền trưởng nhóm", "Mời ra khỏi nhóm" |
| Xác nhận | Rời nhóm, gỡ mục, mời ra khỏi nhóm, chuyển quyền trưởng nhóm, lưu trữ nhóm. Nêu rõ hậu quả |
| Tùy chọn mục (thêm ở GĐ16b) | Trưởng nhóm: "Chuyển lên", "Chuyển xuống", hạn gợi ý ("Lưu hạn", "Bỏ hạn"), "Gỡ khỏi nhóm". Người đã chia sẻ mục: "Gỡ khỏi nhóm" |
| Sửa tên và mô tả (thêm ở GĐ16b) | Trưởng nhóm sửa tên, mô tả nhóm |
| Gợi ý thứ tự học (GĐ16d) | Xem trước thứ tự mới. Hai nút "Áp dụng thứ tự này" và "Giữ thứ tự hiện tại" |

- **Hộp thoại có biểu mẫu:**
  - dùng `fetcher.Form` của React Router;
  - lỗi hiện ngay trong hộp thoại, không đóng hộp khi lỗi;
  - nút chính bị khóa khi đang gửi.
- Làm được bằng bàn phím và trình đọc màn hình. Không cần đọc màu mới hiểu được trạng thái: phần trăm luôn có số đi kèm.

**Trang quản lý**
- `/quan-tri/nhom`: bảng các nhóm (tên, trưởng nhóm, số thành viên trong và ngoài phạm vi, phần trăm trung bình, trạng thái), có bộ lọc.
- `/quan-tri/nhom/:id`: bảng thành viên trong phạm vi và tiến độ từng mục.
- Tab "Tiến độ học" trong `/quan-tri/bao-cao`, cùng bộ lọc, nút "Tải Excel" và "Tải PDF" như các tab có sẵn.

### 2.7. AI

*Đã áp câu N12 và đề xuất Đ15, Đ16, Đ17 ngày 30/9/2026 (GĐ16d). Những điểm làm khác hoặc chi tiết hơn đặc tả ban đầu ghi ngay trong mục này; danh sách đủ ở PLAN.md GĐ16d, "Thay đổi so với dự kiến".*

Theo N12 (trả lời 30/9/2026): làm hai việc sau. Cả hai gọi `complete()` của `packages/llm` với `modelFor("light")`.

| Việc | Người dùng | Đầu vào gửi cho mô hình | Đầu ra | Hậu kiểm tất định |
|---|---|---|---|---|
| **AI-1: gợi ý thứ tự học** | Trưởng nhóm | Danh sách mục theo thứ tự hiện tại, mã `M1…Mn`: tên, loại, chủ đề, số khối và số phút (bài học) hoặc số câu (đề ôn tập), số ngày tới hạn gợi ý | JSON `{ thu_tu: [mã mục], ghi_chu }`, `ghi_chu` ≤ 300 ký tự | `thu_tu` phải là hoán vị đúng các mã đầu vào. `ghi_chu` không có mẫu viện dẫn, không có lỗi chặn của `soatChu` (emoji, dấu chấm than, khẩu ngữ…), mọi mã `Mn` tồn tại, không chép tên mục |
| **AI-2: tóm tắt tiến độ** | Quản lý, trên `/quan-tri/nhom/:id` | Số liệu của thành viên **trong phạm vi**, ghi dạng `TV1…TVn`, mục ghi dạng `M1…Mn` (chỉ mục được tính tiến độ); phần trăm từng mục, số ngày tới hạn, số ngày từ lần học gần nhất; số tổng hợp tính sẵn: trung bình, số người xong và tỷ lệ xong từng mục, số người chưa bắt đầu (Đ15) | 3–5 câu nhận xét và tối đa 5 mã mục có tỷ lệ hoàn thành thấp | Mọi con số trong đầu ra phải có trong dữ liệu đầu vào, trừ chữ số trong mã. Mọi mã `TVn`, `Mn` phải tồn tại. Không có mẫu viện dẫn, không có lỗi chặn của `soatChu`, không chép tên mục. Máy chủ thay `TVn` bằng họ tên, `Mn` bằng tên mục **sau** khi hậu kiểm |

**Bảo vệ dữ liệu**
- Không gửi cho mô hình: họ tên, tên đăng nhập, email, đơn vị, cấp bậc, id.
- Chỉ gửi mã giả `TVn`, mã mục `Mn` kèm tên mục, tên chủ đề và số liệu. Bảng đối chiếu mã giả với người thật, với mục thật giữ ở máy chủ.

**Không có nội dung pháp lý**
- Prompt cấm nêu quy định, mức phạt, điều khoản.
- Hậu kiểm loại mọi đầu ra có mẫu viện dẫn: `Điều \d`, `khoản`, `Nghị định`, `Thông tư`, `Luật`, số hiệu dạng `/\d{4}/`, số tiền.

**Hậu kiểm hỏng**
- Không hiện kết quả. Ghi `study_group_ai_notes` với `status = 'bi_loai'` kèm lý do.
- Hiện câu cố định, không hiện chữ nào của mô hình; lý do loại chỉ ghi vào CSDL và nhật ký máy chủ:
  - AI-1: "Hệ thống chưa gợi ý được thứ tự cho nhóm này."
  - AI-2: không hiện phần tóm tắt. Khối vẫn còn (vì tóm tắt chỉ soạn khi quản lý bấm nút trong khối) và hiện câu "Hệ thống chưa tóm tắt được tiến độ của nhóm này. Số liệu trong bảng dưới đây vẫn đầy đủ." (làm khác đặc tả ban đầu "không hiện khối tóm tắt", 30/9/2026).
- Hết giờ hoặc lỗi gọi mô hình xử lý như hậu kiểm hỏng: ghi `bi_loai` kèm lý do, hiện cùng câu cố định.

**Khối tóm tắt AI-2** luôn có dòng: "Tóm tắt do AI soạn từ số liệu trong bảng dưới đây, cần đối chiếu với bảng."

**AI-1 không tự áp dụng.** Trưởng nhóm phải bấm "Áp dụng thứ tự này". Áp dụng thì gọi `PUT /v1/nhom/:id/muc/thu-tu`.

**Bộ nhớ đệm và hạn mức**
- Cùng `input_hash` thì trả kết quả đã đạt, không gọi mô hình. `input_hash` băm tên prompt, phiên bản prompt và dữ liệu vào đã ẩn danh; khóa dùng lại là (nhóm, loại, phạm vi, `input_hash`).
- AI-1: tối đa 5 lần mỗi nhóm mỗi ngày. AI-2: tối đa 20 lần mỗi quản lý mỗi ngày. Ngày theo giờ Việt Nam. Quá thì 429.
- Chỉ tính lần gọi mô hình thật (Đ17), kể cả lần bị loại và hết giờ. Lần dùng lại kết quả đã có không tính và trả được cả khi đã hết hạn mức.
- Ghi `model`, `tokens_in`, `tokens_out`, `cost_usd` mỗi lần gọi thật.

**Chưa bật khóa API**
- Khi provider là mock ngoài `NODE_ENV=test`: ẩn nút AI; API trả 503 với câu "Chức năng gợi ý bằng AI chưa được bật."
- Giao diện biết AI có bật không qua trường `ai_bat` của `GET /v1/nhom/:id` và `GET /v1/quan-tri/nhom/:id`. Biến `NHOM_AI_CHO_PHEP_MOCK=1` bật AI với provider mock, chỉ dùng cho kịch bản E2E.
- Không bao giờ hiện văn bản của mock cho người dùng thật.

**Cách gọi**
- Gọi đồng bộ, hết giờ sau 20 giây (đổi được bằng biến `NHOM_AI_HET_GIO_MS`, dùng trong test). Phần còn lại của trang không phụ thuộc AI.
- Tệp prompt: `prompts/nhom-hoc/goi-y-thu-tu.md`, `prompts/nhom-hoc/tom-tat-tien-do.md`. Cùng định dạng với `prompts/dao-tao/sinh-cau-hoi-ngan-hang.md`.
- Thêm nhánh kết quả tất định cho hai prompt này vào `packages/llm/src/mock.ts`.

### 2.8. Câu hỏi cần quyết định

Ghi trả lời vào cột cuối. Phiên làm mã đọc cột này.

| Mã | Câu hỏi | Đề xuất | Nếu chọn khác | Trả lời |
|---|---|---|---|---|
| N1 | Lối vào nhóm học khi menu chỉ được 4 mục? | Thẻ "Nhóm học cùng" trên trang `/luyen-tap` (mục "Học & luyện tập") và một dòng trong trang `/toi`. `/nhom` thuộc mục "Học & luyện tập" | Thêm vào ngăn "Thêm" (`MORE_NAV`) trên điện thoại | Chọn khác (29/9/2026): thêm "Nhóm học cùng" vào ngăn "Thêm" (`MORE_NAV`) trên điện thoại, giữ thẻ trên `/luyen-tap` |
| N2 | "Bài thi" chia sẻ vào nhóm là gì? | Đề ôn tập của nhóm: 5–20 câu đã duyệt theo chủ đề, chốt lúc chia sẻ, làm bằng phiên luyện tập. Đề thi sát hạch không chia sẻ được, vì chỉ quản lý giao | Cho chia sẻ đề sát hạch đang xuất bản, nhưng chỉ thành viên đã được giao đề đó thấy và được tính. Nhóm không mở quyền thi | Theo đề xuất (29/9/2026) |
| N3 | Ai được tham gia nhóm? | Mọi tài khoản `can_bo` trở lên có mã mời, không giới hạn đơn vị | Chỉ người cùng đơn vị cấp X với người tạo (cần nêu cấp) | Theo đề xuất (29/9/2026) |
| N4 | Thành viên thấy gì của nhau? | Họ tên, phần trăm, lượt cổ vũ. Không thấy điểm. Tham gia nhóm là đồng ý hiện phần trăm | Thêm tùy chọn "Ẩn tiến độ của tôi" (`show_progress`); người ẩn hiện "Đã ẩn" và không tính vào trung bình nhóm | Theo đề xuất (29/9/2026) |
| N5 | Phần trăm chung tính thế nào? | Trung bình cộng các mục, trọng số bằng nhau, làm tròn xuống | Trọng số theo thời lượng ước tính của bài và số câu của đề | Theo đề xuất (29/9/2026) |
| N6 | Đề ôn tập tính 100% khi nào? Báo cáo luyện tập GĐ7 có tính phiên `nhom` không? | Kết thúc một phiên là 100%, không đòi điểm tối thiểu. Báo cáo luyện tập có tính phiên `nhom` | Đòi tối thiểu 70% câu đúng; khi đó phần trăm lộ gián tiếp kết quả. Không tính phiên `nhom` vào báo cáo | Theo đề xuất (29/9/2026) |
| N7 | Luật cổ vũ? | Mỗi ngày tối đa một lượt cho mỗi người trong mỗi nhóm; bấm lại để bỏ; hiện tổng lượt nhận trong nhóm | Cổ vũ gắn với từng mục đã hoàn thành, mỗi người một lần mỗi mục | Theo đề xuất (29/9/2026) |
| N8 | Cổ vũ có làm thay đổi tiến độ học của người nhận không? | Không, cổ vũ chỉ ghi nhận lượt cổ vũ trong nhóm, không tính vào tiến độ | Có, cổ vũ tính thêm vào tiến độ của mục đã hoàn thành | Theo đề xuất (29/9/2026) |
| N9 | Có gửi thông báo khi được cổ vũ, khi có bài mới trong nhóm? | Có, Web Push loại `nhom_hoc`, gộp tối đa một thông báo mỗi ngày | Không gửi, chỉ hiện trong trang nhóm | Theo đề xuất (29/9/2026) |
| N10 | Giới hạn số lượng? | Tối đa 30 thành viên mỗi nhóm, 30 mục đang có mỗi nhóm. Mỗi người tạo tối đa 5 nhóm đang hoạt động, tham gia tối đa 10 nhóm | Nêu số khác | Theo đề xuất (29/9/2026) |
| N11 | Quản lý có quyền gì với nhóm? | Xem, và lưu trữ nhóm có trưởng nhóm trong phạm vi (ghi `audit_log`). Không sửa nội dung, không giao bài qua nhóm | Giao bài qua nhóm: thêm `exam_assignments.group_id`, liên quan câu hỏi mở ở GAP_ANALYSIS.md §4.3, câu 14 | Theo đề xuất (29/9/2026) |
| N12 | Làm những việc AI nào? | AI-1 (gợi ý thứ tự học) và AI-2 (tóm tắt tiến độ cho quản lý). AI-3 (soạn lời nhắc cho thành viên chậm) để sau | Chỉ AI-2; hoặc thêm AI-3; hoặc không làm GĐ16d | Theo đề xuất (30/9/2026) |
| N13 | "Quản lý xem tiến độ học của mọi học viên": phạm vi đến đâu? | Báo cáo tiến độ chung của từng cán bộ trong cây đơn vị (bài học, luyện tập, thi, nhóm), không chỉ trong nhóm | Chỉ tiến độ trong các nhóm học cùng | Theo đề xuất (29/9/2026) |
| N14 | Trang bài học chưa gửi vị trí khối đang đọc (mục 1.3), nên phần trăm một bài học hiện chỉ là 0 hoặc 100. Có sửa trang bài học trong GĐ16 không? | Không sửa. Hàm tính vẫn theo công thức `phanTramBai`, nên tự đúng khi trang bài học gửi vị trí khối sau này. Giao diện nhóm hiện bài học là 0% hoặc 100% | GĐ16b sửa `training.lesson.tsx`: mở bài từ nhóm thì ghi danh trước; đọc qua một khối thì gửi `lastBlockOrdinal` qua `POST /v1/dao-tao/bai/:id/tien-do`. Thêm tệp vào "File sửa" GĐ16b và ca kiểm vào `scripts/e2e/bai-giang.ts` | Theo đề xuất (29/9/2026) |
| N15 | Nếu N9 chọn có thông báo: người dùng tắt riêng thông báo nhóm bằng cách nào? | Thêm cột `notification_prefs.group_activity` (mặc định bật) trong `0056` và công tắc "Thông báo nhóm học" trong khối nhắc học ở `/toi`. Thông báo phát trong nhịp job `nhac-hoc`, trễ tối đa 15 phút, không gửi trong giờ yên lặng | Không có công tắc riêng; muốn tắt thì tắt toàn bộ thông báo trên thiết bị | Theo đề xuất (29/9/2026) |
| N16 | Trưởng nhóm bị khóa tài khoản (`enabled = false`) thì ai giữ quyền trưởng nhóm? | Khi đọc hoặc ghi vào nhóm, máy chủ thấy trưởng nhóm bị khóa thì chuyển quyền cho thành viên đang ở trong nhóm có `joined_at` sớm nhất. Không còn ai thì nhóm chuyển `luu_tru` | Giữ nguyên: nhóm không có trưởng nhóm hoạt động cho tới khi quản lý lưu trữ. Hoặc cho `quan_ly` chỉ định trưởng nhóm mới trong phạm vi, ghi `audit_log` | Theo đề xuất (29/9/2026) |
| N17 | Đề ôn tập có câu cố định. Làm lại nhiều lần thì phần trăm mục tính thế nào? | Được làm lại. Phần trăm mục lấy theo phiên có phần trăm cao nhất như mục 2.3 | Chỉ tính lần làm đầu tiên | Theo đề xuất (29/9/2026) |

**Soát bảng ngày 29/9/2026**

- Thêm N14–N17 sau khi đối chiếu mã. Không câu nào thừa: mỗi câu quyết định một phần migration, API hoặc giao diện.
- N6 gồm hai quyết định độc lập: điều kiện tính 100% và việc báo cáo luyện tập GĐ7 có tính phiên `nhom` hay không. Trả lời được riêng từng vế.
- Hệ quả rút từ mã, để cân nhắc khi chọn khác đề xuất:
  - N5: thời lượng bài lấy từ `lessons.estimated_minutes`, mặc định 15 phút cho bài chưa khai.
  - N9: API không tự gửi được Web Push (mục 1.3). Thông báo nhóm phải đi qua job `nhac-hoc` 15 phút một nhịp.

Câu cần trả lời trước từng giai đoạn:

| GĐ | Câu |
|---|---|
| 16a | N2, N3, N4, N5, N6, N7, N8, N9, N10, N15 (khi N9 chọn có), N16, N17 |
| 16b | N1, N14 (N4, N7 đã trả lời trước 16a) |
| 16c | N11, N13 |
| 16d | N12 |

### 2.9. Đề xuất sửa đặc tả sau khi đối chiếu mã

Đối chiếu mục 2 và mục 4 với mã ngày 29/9/2026. Mỗi dòng là một đề xuất, **chưa áp vào mục 2**. Ghi "Đồng ý" hoặc "Không" vào cột cuối. Đề xuất được đồng ý thì phiên làm giai đoạn sửa mục 2, mục 4 và PLAN.md theo, như quy tắc 13 mục 1.4. Trong PLAN.md, các chỗ phụ thuộc đề xuất ghi "đề xuất Đn".

| Mã | Chỗ trong đặc tả | Mã thật | Đề xuất | Trả lời |
|---|---|---|---|---|
| Đ1 | 1.4 quy tắc 4; 2.3 quy tắc biên; 2.5 `POST /:id/muc` | API bài học trả 404 khi chuyên đề chưa `xuat_ban`, dù bài đã `xuat_ban` | Bài học chia sẻ được và được tính khi **cả bài và chuyên đề** ở `xuat_ban`. Chuyên đề bị gỡ thì mục hiện "Nội dung không còn được xuất bản" | Đồng ý (29/9/2026) |
| Đ2 | 2.3 Bài học | `phanTramBai` là hàm nội bộ, làm tròn bằng `Math.round`; số khối đếm theo từng chuyên đề (`soKhoiTheoBai`) | Hàm thuần mới nhận `(state, lastBlockOrdinal, soKhoi)`, giữ `Math.round` và mức chặn 99 để kết quả cũ không đổi. Truy vấn nhóm đếm khối theo danh sách `lesson_id` của nhóm trong cùng lượt truy vấn. Phần trăm chung và trung bình nhóm vẫn làm tròn xuống | Đồng ý (29/9/2026) |
| Đ3 | 2.3, 2.5 đề ôn tập | Các hàm chọn câu, dựng phiên và đếm câu theo chủ đề đã có (mục 1.3, "Rút câu theo chủ đề"). Mục 4 GĐ16a việc 4 trước đây trỏ nhầm sang `packages/db/src/luyen-tap.ts`, đã sửa | Lúc chia sẻ: chọn câu bằng `nguonTheoChuDe` và `rutCauLuyenTap({ soCau })`, lưu `question_ids`. Lúc bắt đầu: `cauHoiDaDuyetTheoId`, rồi `dungCauTheoId`, rồi `taoPhienLuyenTap`. `GET /nguon?loai=chu_de` dùng `chuDeLuyenTap`. Không viết lại các hàm này | Đồng ý (29/9/2026) |
| Đ4 | 2.3 Đề ôn tập | Phiên lưu ảnh chụp câu ở `items`; `total` là số câu lúc bắt đầu; câu đã trả lời ở `practice_answers` | Phiên đang làm: số dòng `practice_answers` của phiên chia `total` của chính phiên đó. Ngưỡng "còn dưới 5 câu" tính trên số câu trong `question_ids` còn `da_duyet` | Đồng ý (29/9/2026) |
| Đ5 | 2.2 `join_scope`, `show_progress`, `exam_id`, giá trị `de_thi` | Các cột chỉ có nghĩa khi N3, N4, N2 chọn khác đề xuất | Chỉ tạo cột và giá trị CHECK khi câu tương ứng chọn phương án cần chúng. Cần sau thì thêm bằng `ADD COLUMN IF NOT EXISTS` | Đồng ý (29/9/2026) |
| Đ6 | 2.2 `study_group_items.title` | `lessons.title` sửa được qua `POST /v1/quan-tri/dao-tao/bai` (`luuBaiHoc`) | Bài học đọc tên từ `lessons.title` lúc hiển thị, để bài đổi tên thì nhóm thấy tên mới. `title` chỉ bắt buộc với đề ôn tập (CHECK theo `kind`) | Đồng ý (29/9/2026) |
| Đ7 | 2.2 `study_group_ai_notes` | Với AI-1, `scope_path` là NULL; UNIQUE thường coi hai NULL là khác nhau nên không chặn bản trùng | Thay UNIQUE bằng index duy nhất trên `(group_id, kind, COALESCE(scope_path::text, ''), input_hash)`, chạy được trên mọi phiên bản Postgres. Cột `id` có `DEFAULT uuid_generate_v4()` | Đồng ý (30/9/2026) |
| Đ8 | 2.4 giới hạn 60 lần/phút; 2.5 `POST /tham-gia` | Không có hàm giới hạn tần suất dùng chung (mục 1.3) | Mã mời sai: thêm bảng `study_group_join_attempts (id bigserial, account_id, ok boolean, created_at)` vào `0056`, đếm 15 phút như `login_attempts`, không mất khi khởi động lại. Nút cổ vũ: đếm trong bộ nhớ theo mẫu `choPhepDoc`. Trả 429 bằng `c.json(..., 429)` | Đồng ý (29/9/2026) |
| Đ9 | 2.4 thông báo; mục 4 GĐ16a việc 7 | API không gửi được Web Push; `phatThongBao` chỉ được job `nhac-hoc` gọi (mục 1.3) | API không phát thông báo. Thêm nhánh `nhom_hoc` vào `thongBaoCanGui` (`lich-nhac.ts`) và `chayNhacHoc` (`thong-bao.ts`): người có lượt cổ vũ mới hoặc mục mới trong ngày nhận một thông báo, `ref` là ngày. Không cần nới CHECK vì `notifications_sent.kind` không có CHECK. Công tắc theo N15 | Đồng ý (29/9/2026) |
| Đ10 | 2.4, 2.5 phản hồi cổ vũ | Các khóa khác của `/v1/nhom` và route luyện tập viết snake_case | Trả `{ da_co_vu, tong }` thay cho `{ daCoVu, tong }` | Đồng ý (29/9/2026) |
| Đ11 | 2.1, 2.5 quản lý | `trongPhamVi` trả false với tài khoản chưa gắn đơn vị; báo cáo GĐ7 trả 403 cho `quan_ly` chưa gắn đơn vị | Ghi rõ: thành viên chưa gắn đơn vị là "ngoài phạm vi" với mọi `quan_ly`, chỉ `quan_tri` thấy. `quan_ly` chưa gắn đơn vị gọi `/v1/quan-tri/nhom` nhận 403 | Đồng ý (29/9/2026) |
| Đ12 | 2.5 báo cáo tiến độ học | `chuanBi()`, `traVe()` trong `routes/bao-cao.ts` đã làm phạm vi, xuất tệp, `audit_log`. Đặc tả chưa định nghĩa ba cột | Dùng lại hai hàm đó. "Số bài đã ghi danh" là số bài `xuat_ban` thuộc chuyên đề `xuat_ban` người đó đã ghi danh. "Bài thi được giao" tính như cột "Được giao" của báo cáo tổng hợp đơn vị GĐ7. "Lần học gần nhất" là thời điểm lớn nhất trong `lesson_progress.updated_at`, `practice_answers.created_at`, `exam_attempts.submitted_at` | Đồng ý (29/9/2026) |
| Đ13 | 2.6 thanh tiến độ | `ThanhTienDo.tsx` hiện số câu đúng | Tạo `components/nhom/ThanhPhanTram.tsx` (`role="progressbar"`, `aria-valuenow`, luôn kèm số phần trăm), không dùng `ThanhTienDo` | Đồng ý (29/9/2026) |
| Đ14 | 2.5 "làm và kết thúc bằng các route luyện tập có sẵn"; mục 4 GĐ16b | Trang `/luyen-tap/:phien` đặt tiêu đề theo `nguon` và tên chủ đề; kiểu `nguon` ở `lib/luyen-tap.server.ts` có 3 giá trị | `GET /v1/luyen-tap/phien/:id` trả thêm `nhom: { id, ten_de }` khi `source = 'nhom'` (sửa `apps/api/src/routes/luyen-tap.ts`, chỉ phần này). GĐ16b thêm `'nhom'` vào kiểu `nguon`, hiện tên đề ôn tập, thêm nút "Về nhóm" ở trang kết quả (`luyen-tap.phien.tsx`, `luyen-tap.ket-qua.tsx`) | Đồng ý (29/9/2026) |
| Đ15 | 2.7 hậu kiểm | Tên bài thật có "Luật", "Nghị định số 168/2024/NĐ-CP", "Điều 56" (`packages/db/src/seed-dao-tao-gtdb.ts`). Hậu kiểm theo mẫu viện dẫn sẽ loại mọi đầu ra nhắc tên các bài này | Gửi mục kèm mã `M1…Mn`; đầu ra chỉ nhắc mục bằng mã; máy chủ thay mã bằng tên sau hậu kiểm, như `TVn`. Kiểm "số phải có trong đầu vào" bỏ qua mã `TVn`, `Mn`. AI-2 gửi sẵn số tổng hợp (trung bình nhóm, tỷ lệ hoàn thành từng mục, số người chưa bắt đầu) để mô hình không phải tự tính số mới | Đồng ý (30/9/2026) |
| Đ16 | 2.7 hậu kiểm | `soatChu`, `coLoiChan` (`packages/dao-tao/src/hanh-van.ts`) đã bắt emoji, dấu chấm than, khẩu ngữ | Dùng lại cho `ghi_chu` và câu tóm tắt; tệp hậu kiểm mới chỉ viết phần riêng (hoán vị, số, mã, mẫu viện dẫn) | Đồng ý (30/9/2026) |
| Đ17 | 2.7 hạn mức | — | Chỉ tính lần gọi mô hình thật. Lần trả từ bộ nhớ đệm (cùng `input_hash`) không tính vào hạn mức 5 lần mỗi nhóm và 20 lần mỗi quản lý mỗi ngày | Đồng ý (30/9/2026) |
| Đ18 | Mục 0 bảng giai đoạn; mục 4 GĐ16c việc 4 | Mục 0 ghi GĐ16c "có thể thêm index trong `0056` hoặc `0057`"; mục 4 ghi "migration mới, không sửa `0056` đã áp" | GĐ16c cần index thì dùng `0058_nhom_hoc_bao_cao.sql`; `0057` giữ cho GĐ16d. `migrate.ts` áp theo tên nên thứ tự áp khác thứ tự số vẫn đủ | Không (29/9/2026). GĐ16c cần index thì dùng `0057_nhom_hoc_bao_cao.sql` và GĐ16d chuyển sang `0058`. GĐ16c đo thấy không cần index nên không tạo migration; `0057` vẫn để GĐ16d |

---

## 3. Prompt 0: đưa chức năng vào kế hoạch

```text
Đọc docs/PROMPT_NHOM_HOC_CUNG.md (toàn bộ), docs/PLAN.md (§0, GĐ7, GĐ9, GĐ11, Phụ lục B) và QUY-TAC-HANH-VAN.md.

Việc cần làm: đưa chức năng "Nhóm học cùng" vào kế hoạch. Chưa viết mã.

1. Kiểm lại mục 1.3 "Hiện trạng mã" của PROMPT_NHOM_HOC_CUNG.md với mã thật: tên hàm, tên tệp, số migration lớn nhất, giá trị CHECK của practice_sessions.source (tìm mọi migration đã sửa CHECK này). Chỗ nào sai thì sửa mục 1.3 và nêu trong tóm tắt.
2. PLAN.md: thêm GĐ16a, GĐ16b, GĐ16c, GĐ16d sau GĐ15, theo đúng khuôn các GĐ trước:
   Mục tiêu, Thiết kế, Việc làm, File sửa, File tạo, Migration, Kiểm tra đã xong. Chưa ghi Trạng thái.
   Lấy nội dung từ mục 2 và mục 4 của PROMPT_NHOM_HOC_CUNG.md. Mục kiểm tra phải đo được (số ca, ngưỡng thời gian, dữ liệu gieo cụ thể).
3. PLAN.md §0.5: thêm các dòng GĐ16a–d vào bảng tổng quan. Phụ lục B: thêm 0056_nhom_hoc_cung.sql và 0057_nhom_hoc_ai.sql.
4. Rà mục 2 (Đặc tả) với mã thật. Chỗ đặc tả mâu thuẫn với mã, hoặc có cách dùng lại mã có sẵn tốt hơn, thì đề xuất sửa và đánh dấu "đề xuất". Không tự đổi quyết định trong bảng 2.8.
5. Soát bảng 2.8: câu nào thiếu, câu nào thừa. Thêm câu mới nếu cần, đánh số tiếp N14 trở đi.

Viết theo QUY-TAC-HANH-VAN.md. Cuối phiên liệt kê các câu N còn cần tôi trả lời trước GĐ16a, và tóm tắt thay đổi để tôi commit. Không tự commit.
```

---

## 4. Prompt cho từng giai đoạn

Mỗi khối dưới đây là **một prompt hoàn chỉnh**. Chép cả khối vào phiên mới.

### GĐ16a. CSDL, tiến độ, cổ vũ, API người học

```text
Làm GĐ16a "Nhóm học cùng: CSDL, tiến độ, cổ vũ, API người học" theo docs/PLAN.md.
Trước khi làm, đọc và theo docs/PROMPT_NHOM_HOC_CUNG.md mục 1 (Phần chung) và mục 2 (Đặc tả).
Câu hỏi quyết định liên quan: N2, N3, N4, N5, N6, N7, N8, N9, N10, N15, N16, N17; đề xuất Đ1, Đ2, Đ3, Đ4, Đ5, Đ6, Đ8, Đ9, Đ10, Đ14 (phần API). Đọc cột "Trả lời" ở mục 2.8 và 2.9; câu còn trống thì dừng và hỏi tôi.

Việc làm:
1. Migration 0056_nhom_hoc_cung.sql theo mục 2.2: study_groups, study_group_members, study_group_items, study_group_cheers; cột practice_sessions.group_item_id và giá trị source 'nhom' (liệt kê đủ mọi giá trị CHECK đã có). Chỉ thêm, chạy lại được.
2. packages/dao-tao/src/nhom-hoc.ts: hằng số giới hạn (N10), sinh mã mời, hàm thuần tinhTienDoNhom theo mục 2.3, luật cổ vũ theo ngày giờ Việt Nam (nhận tham số now). Chuyển phanTramBai từ apps/api/src/routes/dao-tao.ts sang đây; route cũ gọi lại hàm mới, kết quả không đổi.
3. packages/db/src/nhom-hoc.ts: truy vấn và giao dịch (tạo nhóm, tham gia, rời, chuyển quyền, chia sẻ, gỡ, sắp thứ tự, cổ vũ, lưu trữ). Tiến độ một nhóm gom bằng một lượt truy vấn, không truy vấn lặp theo người.
4. Đề ôn tập: chốt question_ids lúc chia sẻ (chỉ câu da_duyet, 5–20 câu), tạo phiên source = 'nhom' bằng các hàm có sẵn: cauHoiDaDuyetTheoId ở packages/db/src/luyen-tap.ts, dungCauTheoId ở packages/dao-tao/src/luyen-tap.ts, taoPhienLuyenTap ở packages/db/src/luyen-tap.ts. Kết thúc phiên dùng route luyện tập có sẵn.
5. apps/api/src/routes/nhom.ts: các route /v1/nhom ở mục 2.5, zod .strict(), 404 với người không phải thành viên, giới hạn thử mã mời (429).
6. N6: nếu báo cáo luyện tập tính phiên 'nhom' thì thêm 'nhom' vào bộ lọc source trong packages/db/src/bao-cao.ts, không đổi phần khác.
7. N9: thêm loại 'nhom_hoc' vào LoaiThongBao và nhánh gửi trong thongBaoCanGui (packages/dao-tao/src/lich-nhac.ts), đếm hoạt động nhóm trong tinhTrangNguoiNhan (packages/db/src/thong-bao.ts). Thông báo phát trong nhịp job nhac-hoc, không phát từ API (Đ9); tối đa một thông báo mỗi ngày mỗi người; công tắc group_activity theo N15.

File sửa: apps/api/src/app.ts (gắn route), apps/api/src/routes/dao-tao.ts (chỉ phần phanTramBai), apps/api/src/routes/luyen-tap.ts (chỉ trường nhom, Đ14), apps/api/src/routes/thong-bao.ts (công tắc group_activity, N15), packages/dao-tao/src/index.ts, packages/db/src/index.ts, packages/db/src/luyen-tap.ts (nguồn 'nhom'), packages/db/src/bao-cao.ts (chỉ bộ lọc source, nếu N6 chọn tính), packages/dao-tao/src/lich-nhac.ts và packages/db/src/thong-bao.ts (chỉ khi N9 chọn có), docs/PLAN.md.
File tạo: packages/db/migrations/0056_nhom_hoc_cung.sql, packages/dao-tao/src/nhom-hoc.ts, packages/dao-tao/tests/nhom-hoc.test.ts, packages/db/src/nhom-hoc.ts, apps/api/src/routes/nhom.ts, apps/api/src/nhom.test.ts.

Test bắt buộc:
- Unit (nhom-hoc.test.ts): phần trăm bài học khớp phanTramBai cũ; đề ôn tập đang làm tối đa 99; mục đã gỡ không tính; 0 mục trả null; làm tròn xuống; cổ vũ qua mốc 0h giờ Việt Nam (23:30 hôm trước, 0:30 hôm sau) được tính là hai ngày.
- API (nhom.test.ts), dữ liệu gieo 3 thành viên, 2 bài học, 1 đề ôn tập:
  - phần trăm từng người và trung bình nhóm khớp phép tính tay trong test; bài xong trước khi vào nhóm tính 100;
  - không phải thành viên gọi GET /v1/nhom/:id nhận 404; thành viên thường đổi mã mời nhận 403; quan_ly không là thành viên nhận 404;
  - sai mã 10 lần thì lần 11 nhận 429; mã cũ sau khi đổi nhận 404; nhóm đủ số thành viên nhận 409; nhóm lưu trữ nhận 409 với mọi thao tác ghi;
  - chia sẻ bài chưa xuất bản nhận 400; chủ đề dưới 5 câu đã duyệt nhận 400; chia sẻ trùng bài nhận 409; gửi kèm khóa phan_tram nhận 400;
  - quét khóa cấm (mục 2.5) trên phản hồi của thành viên đạt;
  - tự cổ vũ nhận 400; bấm hai lần trong ngày thì về 0; không cổ vũ được người đã rời; cổ vũ không làm thay đổi tiến độ của người nhận;
  - trưởng nhóm rời khi còn thành viên nhận 409; chuyển quyền rồi rời được; thành viên cuối rời thì nhóm thành luu_tru;
  - bắt đầu đề ôn tập hai lần trả cùng một phiên; kết thúc phiên thì phần trăm mục là 100.
- Hiệu năng: GET /v1/nhom/:id với 30 thành viên, 30 mục trả về dưới 300 ms trên máy dev.
- Migration áp sạch trên CSDL trống và trên CSDL đang có dữ liệu; chạy lại lần hai không lỗi.

Cuối phiên: cập nhật PLAN.md GĐ16a (Trạng thái, Thay đổi so với dự kiến, Quy tắc nghiệp vụ đã chốt) và đưa tóm tắt để tôi commit.
```

### GĐ16b. Giao diện người học và hộp thoại

```text
Làm GĐ16b "Nhóm học cùng: giao diện người học và hộp thoại" theo docs/PLAN.md.
Trước khi làm, đọc và theo docs/PROMPT_NHOM_HOC_CUNG.md mục 1 (Phần chung) và mục 2.6. API đã có từ GĐ16a (apps/api/src/routes/nhom.ts); không đổi API trừ khi thiếu, và nếu thiếu thì hỏi trước.
Câu hỏi quyết định liên quan: N1, N4, N7, N14, N15; đề xuất Đ13, Đ14 (phần web). Đọc cột "Trả lời" ở mục 2.8 và 2.9; câu còn trống thì dừng và hỏi tôi.

Việc làm:
1. components/ui/HopThoai.tsx: hộp thoại dùng chung theo mẫu components/thi/HopXacNhanNop.tsx (<dialog>, showModal, lớp .sheet, aria-labelledby, Esc, trả tiêu điểm, khóa cuộn nền). Không sửa HopXacNhanNop.
2. Trang /nhom, /nhom/:id, /nhom/tham-gia/:ma và các hộp thoại ở bảng mục 2.6 (trừ hộp gợi ý AI của GĐ16d). Biểu mẫu trong hộp thoại dùng fetcher.Form; lỗi hiện trong hộp thoại; nút chính khóa khi đang gửi.
3. Nút "Cổ vũ": biểu tượng SVG mới trong Icon.tsx, aria-label, aria-pressed, cập nhật ngay và trả lại trạng thái cũ khi lỗi. Không emoji, không dùng chữ "like", "thả tim".
4. Lối vào theo N1. Thêm /nhom vào khop của mục menu tương ứng trong lib/site.ts. Không thêm mục menu thứ năm.
5. Nút "Chia sẻ vào nhóm" trên trang bài học /hoc/:course/:lesson, mở hộp thoại chọn nhóm. Chỉ hiện khi đã đăng nhập và có ít nhất một nhóm.
6. Câu nêu quyền riêng tư trong hộp thoại tham gia theo N4.
7. Bài hướng dẫn cho các trang mới, hoặc khai miễn tạm trong content/huong-dan/muc-luc.json.

File sửa: apps/web/app/routes.ts, apps/web/app/lib/site.ts (chỉ khop và lối vào theo N1), apps/web/app/routes/luyen-tap._index.tsx (thẻ "Nhóm học cùng"), apps/web/app/routes/toi.tsx (một dòng lối vào), apps/web/app/routes/training.lesson.tsx (chỉ nút chia sẻ), apps/web/app/components/ui/Icon.tsx (thêm biểu tượng), content/huong-dan/muc-luc.json, docs/PLAN.md.
File tạo: apps/web/app/components/ui/HopThoai.tsx, apps/web/app/routes/nhom.tsx, nhom.chi-tiet.tsx, nhom.tham-gia.tsx, apps/web/app/components/nhom/ (HopTaoNhom, HopThamGia, HopChiaSe, HopMoiThanhVien, HopTienDoThanhVien, NutCoVu, DanhSachMuc, DanhSachThanhVien), apps/web/app/lib/nhom.ts, scripts/e2e/nhom-hoc.ts.
Kiểm lại tên tệp route thật trước khi sửa; tên khác với danh sách trên thì dùng tên thật và ghi vào "Thay đổi so với dự kiến".

Test bắt buộc (bun run e2e nhom-hoc, khung 360×740):
- Tài khoản A tạo nhóm, sao chép liên kết mời; tài khoản B mở liên kết, đăng nhập, tham gia.
- A chia sẻ một bài học và một đề ôn tập 5 câu. B học xong bài học. A thấy phần trăm chung của B là 50.
- A cổ vũ B; B thấy 1 lượt cổ vũ. A bấm lại thì về 0.
- Mọi trang và mọi hộp thoại không cuộn ngang; mọi nút cao ≥ 48px.
- Esc đóng hộp thoại và tiêu điểm trở về nút đã mở. Hộp thoại mở được và gửi được bằng bàn phím.
- Bật giảm chuyển động thì hộp thoại không có hiệu ứng trượt, chức năng giữ nguyên.
- Soát bảng kiểm PLAN §0.4 và QUY-TAC-HANH-VAN trên mọi chuỗi mới.

Cuối phiên: cập nhật PLAN.md GĐ16b, DEMO.md (luồng demo nhóm học cùng), và đưa tóm tắt để tôi commit.
```

### GĐ16c. Quản lý xem tiến độ học

```text
Làm GĐ16c "Nhóm học cùng: quản lý xem tiến độ học" theo docs/PLAN.md.
Trước khi làm, đọc và theo docs/PROMPT_NHOM_HOC_CUNG.md mục 1 (Phần chung), mục 2.1, 2.5 (phần Quản lý, Báo cáo) và 2.6 (Trang quản lý). Đọc thêm PLAN.md GĐ7: báo cáo này dùng lại toàn bộ cách lọc phạm vi, xuất Excel/PDF và ghi audit_log của GĐ7.
Câu hỏi quyết định liên quan: N11, N13; đề xuất Đ11, Đ12, Đ18. Đọc cột "Trả lời" ở mục 2.8 và 2.9; câu còn trống thì dừng và hỏi tôi.

Việc làm:
1. API /v1/quan-tri/nhom (danh sách, chi tiết, lưu trữ theo N11) trong apps/api/src/routes/nhom.ts, export route riêng và gắn trong app.ts. Lọc phạm vi bằng phamViCua ở tầng truy vấn. Thành viên ngoài phạm vi chỉ trả số lượng, không trả tên.
2. Báo cáo "Tiến độ học": hàm tienDoHocVien trong packages/db/src/bao-cao.ts, route GET /v1/bao-cao/tien-do-hoc trong routes/bao-cao.ts, cột theo mục 2.5, xuất xlsx và pdf bằng hàm có sẵn, ghi audit_log bao_cao.xuat. Phạm vi theo N13.
3. Trang /quan-tri/nhom, /quan-tri/nhom/:id; tab "Tiến độ học" trong /quan-tri/bao-cao. Thêm mục "Nhóm học cùng" vào menu quản trị, cạnh "Báo cáo".
4. Index cần cho báo cáo (nếu đo thấy cần) thêm bằng migration mới, không sửa 0056 đã áp.

File sửa: apps/api/src/app.ts, apps/api/src/routes/nhom.ts, apps/api/src/routes/bao-cao.ts, packages/db/src/bao-cao.ts (chỉ thêm hàm, không đổi hàm cũ), packages/db/src/nhom-hoc.ts, apps/web/app/routes.ts, apps/web/app/routes/quan-tri.tsx (mục menu), apps/web/app/routes/quan-tri.bao-cao.tsx (thêm tab), apps/web/app/lib/bao-cao.ts (thêm loại tien-do-hoc vào LOAI_BAO_CAO và bộ lọc nhom vào LOC_BAO_CAO; resource route tải tệp kiểm loại theo danh sách này), content/huong-dan/muc-luc.json, docs/PLAN.md.
File tạo: apps/web/app/routes/quan-tri.nhom.tsx, quan-tri.nhom.chi-tiet.tsx, apps/api/src/quan-tri-nhom.test.ts.

Test bắt buộc (dữ liệu gieo: đội A, đội B cùng một phòng; 10 cán bộ; 2 nhóm, trong đó một nhóm có thành viên cả hai đội):
- quan_ly đội A chỉ thấy người đội A; với nhóm lẫn hai đội, thấy thành viên đội A và số thành viên ngoài phạm vi, không thấy tên người đội B.
- quan_ly đội A lọc đội B nhận 403; quan_ly cấp phòng thấy cả hai đội; quan_tri thấy tất cả; can_bo gọi API quản trị nhận 403.
- Số liệu báo cáo tiến độ học khớp phép tính tay trong test (bài xong, phiên luyện tập, bài thi, phần trăm trong nhóm).
- File xlsx mở bằng docOExcelTho: đúng tiêu đề cột, đúng số dòng, cột số là kiểu số. PDF có chữ tiếng Việt đúng dấu. Mỗi lần xuất có dòng audit_log bao_cao.xuat.
- Lưu trữ nhóm từ trang quản trị ghi audit_log nhom.luu_tru; quan_ly không lưu trữ được nhóm có trưởng nhóm ngoài phạm vi (403).
- Báo cáo 1.000 cán bộ, 50 nhóm trả về dưới 2 giây trên máy dev.

Cuối phiên: cập nhật PLAN.md GĐ16c và đưa tóm tắt để tôi commit.
```

### GĐ16d. AI gợi ý thứ tự học và tóm tắt tiến độ

```text
Làm GĐ16d "Nhóm học cùng: AI gợi ý thứ tự học và tóm tắt tiến độ" theo docs/PLAN.md.
Trước khi làm, đọc và theo docs/PROMPT_NHOM_HOC_CUNG.md mục 1 (Phần chung) và mục 2.7. Đọc PLAN.md GĐ8 làm mẫu cho cách dùng packages/llm, prompt Markdown, mock tất định và hậu kiểm tất định.
Câu hỏi quyết định liên quan: N12; đề xuất Đ7, Đ15, Đ16, Đ17. Đọc cột "Trả lời" ở mục 2.8 và 2.9; nếu N12 chọn không làm GĐ16d thì dừng.

Việc làm:
1. Migration 0057_nhom_hoc_ai.sql: bảng study_group_ai_notes theo mục 2.2. Kiểm số migration lớn nhất trước khi đặt tên.
2. prompts/nhom-hoc/goi-y-thu-tu.md và prompts/nhom-hoc/tom-tat-tien-do.md, cùng định dạng prompts/dao-tao/sinh-cau-hoi-ngan-hang.md (frontmatter version, ## SYSTEM, ## USER). Prompt cấm nêu quy định, mức phạt, điều khoản; yêu cầu JSON đúng schema; viết theo QUY-TAC-HANH-VAN.
3. packages/dao-tao/src/hau-kiem-nhom-hoc.ts: hậu kiểm tất định theo bảng mục 2.7 (hoán vị đúng, số trong đầu ra phải có trong đầu vào, mã TVn phải tồn tại, không có mẫu viện dẫn, không emoji, không dấu chấm than, giới hạn độ dài). Không nhờ mô hình tự kiểm.
4. packages/db/src/nhom-hoc.ts: dựng đầu vào đã ẩn danh (TV1…TVn, không họ tên, tên đăng nhập, email, đơn vị, cấp bậc), tính input_hash, dùng lại kết quả cũ khi trùng hash, ghi study_group_ai_notes kèm model, token, chi phí. AI-2 chỉ dùng thành viên trong phạm vi của quản lý đang xem.
5. API: POST /v1/nhom/:id/ai/thu-tu (trưởng nhóm), POST /v1/quan-tri/nhom/:id/ai/tom-tat (quan_ly trở lên). Hạn mức theo mục 2.7 (429). Provider là mock ngoài NODE_ENV=test thì trả 503 và giao diện ẩn nút. Hết giờ sau 20 giây.
6. Giao diện: nút "Gợi ý thứ tự học" và hộp thoại xem trước trong /nhom/:id (trưởng nhóm); khối tóm tắt có dòng cảnh báo trong /quan-tri/nhom/:id. Máy chủ thay TVn bằng họ tên sau khi hậu kiểm.
7. packages/llm/src/mock.ts: thêm nhánh kết quả tất định cho hai prompt, dựng từ dữ liệu đầu vào, để chạy trọn luồng khi chưa có khóa API.

File sửa: packages/llm/src/mock.ts (chỉ thêm nhánh), packages/db/src/nhom-hoc.ts, apps/api/src/routes/nhom.ts, apps/web/app/routes/nhom.chi-tiet.tsx, apps/web/app/routes/quan-tri.nhom.chi-tiet.tsx, docs/PLAN.md.
File tạo: packages/db/migrations/0057_nhom_hoc_ai.sql, prompts/nhom-hoc/goi-y-thu-tu.md, prompts/nhom-hoc/tom-tat-tien-do.md, packages/dao-tao/src/hau-kiem-nhom-hoc.ts, packages/dao-tao/tests/hau-kiem-nhom-hoc.test.ts, apps/web/app/components/nhom/HopGoiYThuTu.tsx, apps/api/src/nhom-ai.test.ts.

Test bắt buộc:
- Unit hậu kiểm: thiếu hoặc thừa mã mục thì loại; lặp mã thì loại; số không có trong đầu vào thì loại; mã TV không tồn tại thì loại; có "Điều 5", "Nghị định", số tiền, emoji, dấu chấm than thì loại; đầu vào hợp lệ thì đạt.
- API với LLM_PROVIDER=mock: AI-1 trả hoán vị hợp lệ và không tự đổi thứ tự; áp dụng xong thì thứ tự đổi; AI-2 trả tóm tắt có họ tên thật sau khi thay mã.
- Dữ liệu gửi cho provider (bắt bằng mock) không chứa họ tên, tên đăng nhập, email, tên đơn vị của bất kỳ ai.
- AI-2 của quan_ly đội A không chứa số liệu của thành viên đội B.
- Gọi lại với cùng dữ liệu không gọi provider lần hai; quá hạn mức nhận 429; đầu ra bị loại được ghi bi_loai kèm lý do và không hiện cho người dùng.
- Mô phỏng provider mock ngoài NODE_ENV=test: API trả 503 và nút AI bị ẩn.
- Chạy thật với khóa API (nếu máy có ANTHROPIC_API_KEY) trên một nhóm demo: ghi vào PLAN.md tỷ lệ đầu ra qua hậu kiểm và chi phí mỗi lần gọi. Không có khóa thì ghi "Chưa làm" kèm cách chạy.

Cuối phiên: cập nhật PLAN.md GĐ16d và đưa tóm tắt để tôi commit.
```
