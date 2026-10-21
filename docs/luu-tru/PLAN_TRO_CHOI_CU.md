# CÁC GIAI ĐOẠN TRÒ CHƠI THEO DANH SÁCH CŨ (LƯU TRỮ)

*Tách khỏi [../PLAN.md](../PLAN.md) ngày 27/9/2026, khi danh sách trò chơi được thay bằng 10 trò mới. GĐ-G0 vẫn ở PLAN.md. Các giai đoạn dưới đây dừng; trạng thái ghi ở từng mục là trạng thái lúc dừng.*

---

## GĐ-G1 — Lệnh trực hằng ngày

**Mục tiêu**
- Mỗi ngày mỗi người nhận 5 câu riêng, ưu tiên câu đến hạn ôn và câu hay sai; làm đủ thì giữ chuỗi ngày.
- Chơi được khi không có mạng.
- Thay thẻ "Thử thách hôm nay" ở trang chủ (GAME_DESIGN §7 Q3).

**Thiết kế** (GAME_DESIGN §5.8)
- Thứ tự ưu tiên: câu đến hạn trong `question_memory` → câu sai chưa đến hạn → câu chưa làm của chủ đề yếu nhất → câu chưa làm bất kỳ. Tối đa 3 câu từ hai nhóm đầu. Bỏ câu có thẻ bị treo.
- `duty_orders` chốt 5 câu ở lần mở đầu tiên trong ngày (giờ Việt Nam). `POST /v1/luot-choi/lenh_truc/bat-dau` gọi lại trong ngày trả đúng lượt đó.
- SM-2 dùng `onThe` của `srs.ts`, chất lượng: sai 1, đúng 4; ngày theo `ngayVietNam`.
- Chỉ một lượt Lệnh trực mỗi ngày tính XP.
- Offline: gói gồm lệnh trực hôm nay (nếu đã chốt) và kho dự phòng khoảng 40 câu; ngày không có mạng, điện thoại chọn 5 câu bằng cùng hàm chọn.

**Việc làm**
1. Logic thuần `tro-choi/lenh-truc.ts`: hàm chọn 5 câu (có seed), ánh xạ kết quả sang chất lượng SM-2, định nghĩa trò theo `khung.ts`.
2. `packages/db/src/lenh-truc.ts`: đọc nguồn chọn câu (đến hạn, câu sai, chủ đề yếu, câu chưa làm), chốt `duty_orders`, cập nhật `question_memory` khi ghi bước. Mọi bước có câu hỏi ngân hàng (ở mọi trò) cập nhật `question_memory`, không chỉ Lệnh trực.
3. Gói offline: thêm kho dự phòng; đồng bộ ghi `duty_orders` cho ngày chơi offline nếu ngày đó chưa có lệnh trực online.
4. Web: trang `/tro-choi/lenh-truc` (5 câu, mỗi câu một màn hình, dùng `HienThiCauHoi`), thẻ `TheLenhTruc` ở trang chủ thay `TheThuThach`. Thẻ ghi rõ "Đã hoàn thành hôm nay" khi xong.
5. Thông báo nhắc học 7h (GĐ15) đổi nội dung sang "Lệnh trực hôm nay".

**File sửa**
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/dao-tao/src/index.ts`
- `packages/db/src/luot-choi.ts` (cập nhật `question_memory`), `packages/db/src/index.ts`
- `apps/workers-ts/src/bull/workers/nhac-hoc.ts`, `packages/dao-tao/src/lich-nhac.ts` (nội dung thông báo)
- `apps/web/app/routes.ts`, `routes/home.tsx`
- `content/huong-dan/muc-luc.json`

**File tạo**
- `packages/dao-tao/src/tro-choi/lenh-truc.ts`, `packages/dao-tao/tests/lenh-truc.test.ts`
- `packages/db/src/lenh-truc.ts`
- `apps/api/src/lenh-truc.test.ts`
- `apps/web/app/routes/tro-choi.lenh-truc.tsx`
- `apps/web/app/components/tro-choi/TheLenhTruc.tsx`
- `scripts/e2e/lenh-truc.ts`

**Migration**
- `0028_lenh_truc.sql`:
  - `question_memory(account_id, question_id, ease numeric, interval_days int, reps int, lapses int, due_on date, last_seen_at, suspended boolean, PRIMARY KEY(account_id, question_id))`, index `(account_id, due_on) WHERE NOT suspended`
  - `duty_orders(account_id, day date, question_ids uuid[], run_id uuid REFERENCES game_runs(id), offline boolean, created_at, PRIMARY KEY(account_id, day))`
  - `INSERT INTO games`: `lenh_truc`, `offline_ok = true`

**Kiểm tra đã xong**
- [ ] Unit test chọn câu (`lenh-truc.test.ts`):
  - có 5 câu đến hạn và 5 câu sai thì chỉ lấy 3 câu từ hai nhóm này, 2 câu còn lại từ chủ đề yếu;
  - câu đến hạn lâu nhất đứng trước; câu có thẻ treo không bao giờ được chọn;
  - ngân hàng chỉ có 3 câu đã duyệt thì lệnh trực có 3 câu, không lỗi;
  - cùng seed và cùng đầu vào thì cùng 5 câu (máy chủ và điện thoại chọn giống nhau).
- [ ] Unit test SM-2 qua mốc 0h giờ Việt Nam: làm sai lúc 23:30 thì câu đến hạn ngày hôm sau theo giờ Việt Nam.
- [ ] API test: mở lệnh trực hai lần trong ngày ra cùng 5 câu; ngày mai khác; hai người khác nhau có thể khác câu. Làm đủ 5 câu thì chuỗi ngày tăng 1 và có đúng một dòng XP; chơi lại không thêm XP.
- [ ] `bun run e2e lenh-truc`: tải gói → mất mạng → làm lệnh trực → có mạng lại → `duty_orders` của hôm nay có `offline = true`, chuỗi ngày tăng.
- [ ] Trang chủ không còn thẻ "Thử thách hôm nay"; `/v1/luyen-tap/phien` nguồn `thu_thach` vẫn chạy (dữ liệu cũ không hỏng).
- [ ] Soát bảng kiểm §0.4 ở 360px.

---

## GĐ-G2 — Súng bắn tốc độ

**Mục tiêu**
- Mỗi lượt 10 xe; với từng xe, người chơi xác định có vi phạm tốc độ không, khung phạt nào, có hình thức bổ sung hay trừ điểm không.
- Đáp án **suy ra từ dữ liệu đã duyệt**, không soạn tay từng xe.

**Thiết kế** (GAME_DESIGN §5.2)
- Dữ liệu tốc độ tối đa mới ở `speed_limits` (loại xe × loại đường), có căn cứ và hiệu lực, duyệt qua `/quan-tri/du-lieu-tra-cuu` (thêm tab Tốc độ tối đa).
- Bộ sinh chọn loại xe, loại đường, biển hạn chế (có/không, lấy từ `traffic_signs`), tốc độ đo được; khung phạt, mức tiền, hình thức bổ sung lấy từ `violations` bằng hàm khớp khoảng có sẵn của GĐ5.
- Tổ hợp thiếu dữ liệu đã duyệt thì không sinh. Mức khó có ca sát biên (đúng 10 km/h, 20 km/h…).
- 12 giây mỗi xe; 3 + 4 + 3 điểm; sai câu 1 thì sang xe sau.

**Việc làm**
1. Biên soạn `data/tra-cuu/toc-do-toi-da.json` từ văn bản quy định tốc độ (GAME_DESIGN §7 Q6); nạp bằng `bun run tra-cuu:nap` vào `cho_duyet`.
2. Logic thuần: `tra-cuu-nhanh.ts` thêm kiểm hợp lệ và tra `speed_limits`; `tro-choi/sung-ban-toc-do.ts` gồm bộ sinh, suy đáp án, chấm 3 câu nhỏ.
3. API tra cứu tốc độ GĐ5 thêm tham số tùy chọn `duong=` để tự lấy tốc độ cho phép theo loại đường.
4. Web: trang `/tro-choi/sung-ban-toc-do` (thẻ xe với tốc độ số lớn, biển tròn nếu có, 3 câu nhỏ lần lượt); tab "Tốc độ tối đa" ở `/quan-tri/du-lieu-tra-cuu`.

**File sửa**
- `packages/dao-tao/src/tra-cuu-nhanh.ts`, `packages/dao-tao/src/tro-choi/dang-ky.ts`
- `packages/db/src/tra-cuu-nhanh.ts`, `packages/db/src/du-lieu-tra-cuu.ts`
- `scripts/tra-cuu-nhanh.ts`, `scripts/check-citations.ts`
- `apps/api/src/routes/tra-cuu-nhanh.ts`, `apps/api/src/routes/du-lieu-tra-cuu.ts`
- `apps/web/app/routes.ts`, `routes/quan-tri.du-lieu-tra-cuu.tsx`, `routes/tra-cuu-nhanh.toc-do.tsx` (chọn loại đường)

**File tạo**
- `data/tra-cuu/toc-do-toi-da.json`
- `packages/dao-tao/src/tro-choi/sung-ban-toc-do.ts`, `packages/dao-tao/tests/sung-ban-toc-do.test.ts`
- `apps/api/src/sung-ban-toc-do.test.ts`
- `apps/web/app/routes/tro-choi.sung-ban-toc-do.tsx`
- `apps/web/app/components/tro-choi/XeQuaChot.tsx`, `ChonKhungPhat.tsx`

**Migration**
- `0029_toc_do_toi_da.sql`:
  - `speed_limits(id, code UNIQUE, vehicle_class, violation_vehicle CHECK (o_to|mo_to), road_type, max_speed int CHECK (max_speed > 0), citation_urn CHECK LIKE 'vn:%', effective_from, effective_to, topic_id, status, version, approved_by, approved_at, reject_reason, note, updated_at)`
  - UNIQUE `(vehicle_class, road_type, effective_from)`; `content_reviews.kind` nhận `speed_limit`
  - `INSERT INTO games`: `sung_ban_toc_do`, `offline_ok = true`

**Kiểm tra đã xong**
- [x] Unit test trên **toàn bộ tệp dữ liệu thật**: với mọi tổ hợp loại xe × loại đường × (có/không biển) × tốc độ từ 0 đến 150 km/h bước 0,5, bộ suy đáp án trả **đúng một** kết quả; không tổ hợp nào có hai khung phạt.
  - Chưa có loại đường (câu Q6), nên quét loại xe × số trên biển (5–150 km/h, bước 5) × tốc độ đo (0–300 km/h, bước 0,5) trên 7 khung phạt thật của `muc-phat.json`: mọi tổ hợp ra đúng một đáp án, không có khoảng trống.
  - Tệp `packages/dao-tao/tests/sung-ban-toc-do.test.ts`.
- [x] Unit test biên: vượt dưới mức thấp nhất của khung phạt thì đáp án là "Không vi phạm"; tốc độ đúng bằng biên thuộc đúng khoảng theo `speed_bounds`; có biển thì dùng số trên biển thay tốc độ theo loại đường.
  - Kiểm 4,5 / 5 / 10 / 20 / 20,5 / 35 / 35,5 km/h. Số trên biển luôn là tốc độ tối đa (chưa có loại đường).
  - Thiếu khung ở giữa hoặc khung chồng nhau thì tình huống không dùng được.
- [x] Unit test bộ sinh: chỉ dùng dòng `da_duyet` còn hiệu lực tại ngày chơi; thiếu dữ liệu một loại đường thì không sinh xe cho loại đường đó; lượt 10 xe có ít nhất 2 xe không vi phạm.
  - Xe là tình huống soạn sẵn nên "thiếu dữ liệu" nghĩa là thiếu khung phạt đã duyệt của loại xe đó: tình huống bị bỏ (unit test).
  - Chỉ dữ liệu đã duyệt và còn hiệu lực: kiểm ở `apps/api/src/sung-ban-toc-do.test.ts` (tình huống chờ duyệt không vào lượt; khung phạt lấy theo ngày chơi; sửa một khung mô tô thì tình huống mô tô rút khỏi trò).
  - Lượt 10 xe có ít nhất 2 xe không bị xử phạt, tất định theo seed.
- [x] API test: trả lời xe sau 12 + 2 giây được 0 điểm và lượt đi tiếp; không phản hồi nào lộ tốc độ tối đa hay khung đúng trước khi chấm; XP một lần.
  - `apps/api/src/sung-ban-toc-do.test.ts`, 11 ca. Số trên biển là dữ kiện của đề (người chơi phải thấy), nên test quét các khóa `dap_an`, `khung_ma`, `phat_tu`, `phat_den`, `tru_diem`, `giai_thich`, `can_cu`.
  - Có thêm: gói offline dưới 20 KB; tra tốc độ theo loại đường; duyệt và sửa tốc độ tối đa.
- [ ] Soát 20 dòng `speed_limits` với văn bản gốc (biên bản soát lưu trong PR). **Đủ nội dung đã duyệt:** ít nhất ô tô và xe mô tô trên 4 loại đường.
  - **Chưa làm được:** kho văn bản chưa có văn bản quy định tốc độ theo loại đường, cũng chưa có Nghị định số 168/2024/NĐ-CP.
  - `toc-do-toi-da.json` là khung 8 dòng để trống; 7 khung phạt theo tốc độ và biển P.127 vẫn là bản nháp.
  - Danh sách cần đơn vị chuyên môn kiểm ở GAME_DESIGN §5.2. Trò đang tắt (`games.enabled = false`).
- [x] Soát bảng kiểm §0.4 ở 360px; số tốc độ đọc được ở cỡ chữ ≥ 32px.
  - `scripts/e2e/sung-ban-toc-do.ts` chơi trọn 10 xe ở 360×740: vào chơi một chạm từ trang Trò chơi, số tốc độ đo được cỡ 48px, không cuộn ngang, đúng một dòng XP. Ảnh chụp đã soát tay.

**Trạng thái (25/9/2026):** đã làm xong phần mã, đạt 5/6 mục kiểm tra. Mục soát dữ liệu tốc độ tối đa chờ văn bản và đơn vị chuyên môn.
- Cổng chung:
  - `bun run typecheck` qua; `bun run build:web` qua.
  - `bun test`: 1071 đạt, 5 hỏng. Cả 5 ở `packages/config/src/ports.test.ts`, lỗi môi trường Windows có từ trước.
  - Biome: các tệp của GĐ-G2 qua.
  - `bun run e2e sung-ban-toc-do` đạt.
  - `bun run tra-cuu:nap --kiem-tra` qua (10 URN bản nháp chưa có trong kho, chỉ cảnh báo, như trước).
  - Chưa chạy `bun run smoke`.
- Quyết định của người dùng khi làm giai đoạn này:
  - **Nguồn nội dung:** thêm bảng nguồn nội dung dùng chung `packages/db/src/nguon-tro-choi.ts`, thay cho nhánh cố định trong `apps/api/src/routes/luot-choi.ts`. Đây là thay đổi khung chung duy nhất, đã hỏi trước; `khung.ts` thêm tên nguồn `toc_do_tinh_huong`.
  - **Tốc độ tối đa:** chỉ lấy từ số trên biển P.127 (câu Q6).
  - **Nội dung:** 20 tình huống xe soạn sẵn, chờ duyệt, thay cho sinh xe ngẫu nhiên.
- Tệp đã làm:
  - Migration `0029_toc_do_toi_da.sql`: bảng `speed_limits` (thêm cột `road_type_name`, `name` để hiển thị); đăng ký trò `sung_ban_toc_do`, tắt sẵn.
  - `packages/dao-tao`: `tro-choi/sung-ban-toc-do.ts`; `tra-cuu-nhanh.ts` (kiểu và kiểm tốc độ tối đa).
  - `packages/db`: `sung-ban-toc-do.ts` (nguồn của trò), `nguon-tro-choi.ts`, `seed-tro-choi.ts`, `tra-cuu-nhanh.ts` (nạp và tra tốc độ tối đa), `du-lieu-tra-cuu.ts` (loại `toc-do-toi-da`).
  - API: `luot-choi.ts` (dùng bảng nguồn), `tra-cuu-nhanh.ts` (`duong=` và `GET /v1/tra-cuu/toc-do-toi-da`), `du-lieu-tra-cuu.ts`.
  - Web:
    - `components/tro-choi/XeQuaChot.tsx`, `ChonKhungPhat.tsx`;
    - một dòng trong `giao-dien.tsx`;
    - tab Tốc độ tối đa ở `quan-tri.du-lieu-tra-cuu.tsx`;
    - ô chọn loại đường ở `tra-cuu-nhanh.toc-do.tsx` và `lib/tra-cuu-nhanh.ts`.
  - Dữ liệu: `data/tra-cuu/toc-do-toi-da.json` (khung trống), `data/tro-choi/sung-ban-toc-do.json` (20 tình huống demo).
  - Script: `tra-cuu-nhanh.ts` (nạp tốc độ tối đa), `check-citations.ts` (kiểm căn cứ của `speed_limits` và `game_content` đã duyệt).
  - Test: `packages/dao-tao/tests/sung-ban-toc-do.test.ts` (15 ca), `apps/api/src/sung-ban-toc-do.test.ts` (11 ca), `scripts/e2e/sung-ban-toc-do.ts`.
- Thay đổi so với dự kiến:
  - Không tạo `routes/tro-choi.sung-ban-toc-do.tsx`: trò chạy trên trang chơi chung `/tro-choi/luot/:id`, vào bằng nút "Chơi" ở trang Trò chơi.
  - Seed chạy bằng `bun run packages/db/src/seed-tro-choi.ts`, chưa thêm script vào `package.json` (không nằm trong danh sách tệp).
  - Đồng bộ offline chỉ kiểm câu hỏi bị gỡ duyệt sau khi tải gói, chưa kiểm tình huống trò chơi bị gỡ duyệt. Muốn kiểm phải sửa `luot-choi.ts` (khung chung), để lại hỏi sau.
- Quy tắc đã chốt:
  - Ba câu 3 + 4 + 3 điểm. Sai câu 1 thì 0 điểm. Xe không bị xử phạt mà trả lời "Không" được 10 điểm.
  - Câu 3 gồm "Không có hình thức bổ sung, không trừ điểm" và mọi tổ hợp khác nhau của các khung cùng loại xe.
  - 12 giây mỗi xe, thưởng nhanh theo khung chung. XP cơ bản 20.
  - Tham chiếu của tình huống: mọi khung phạt theo tốc độ của loại xe và biển P.127.
- **Giao diện (25/9/2026), theo docs/VISUAL_STYLE.md hướng A "Cảnh phục":**
  - Áp dụng lớp hiệu ứng dùng chung cho khung trò chơi (GĐ-G0) và trò này: màn mở đầu, thẻ câu trượt vào, dấu đúng/sai, rung ngang khi sai, nhãn chuỗi đúng, vòng đếm ngược, lớp phủ hết giờ, tổng kết có sao và điểm chạy số, pháo hoa khi đạt 3 sao, lớp chúc mừng lên cấp/huy hiệu. Không sửa logic chấm điểm, XP, đồng bộ offline.
  - Hai hiệu ứng riêng đã duyệt: xe lao qua có vệt; số tốc độ chạy trên máy đo rồi khóa số. Tiếng "bíp" khi khóa số chỉ phát khi bật âm thanh.
  - Trang duyệt `/game-style-demo` (biên tập trở lên). Font tự lưu thay Google Fonts.
  - Kiểm: `scripts/e2e/tro-choi-muot.ts` (giảm chuyển động, tắt âm, CPU chậm 4×, trang demo) đạt; `tro-choi-khung`, `sung-ban-toc-do`, `offline`, `tro-choi` đạt. Số đo dung lượng và khung hình ở VISUAL_STYLE §9.
  - Sửa kèm lỗi có từ trước ở `root.tsx`: trang lỗi 403/404 render phía máy chủ luôn hiện "Cần có mạng" (Bun có `navigator` nhưng không có `onLine`), làm React phải dựng lại trang.

---

## GĐ-G3 — Lập biên bản

**Mục tiêu**
- Người chơi đọc tình huống, điền 4 ô (hành vi, điều khoản, mức phạt, hình thức bổ sung), được chấm từng ô.

**Thiết kế** (GAME_DESIGN §5.3)
- Tình huống ở `game_content` loại `lap_bien_ban`; `answer` là danh sách mã `violations`. Điều khoản, khung tiền, hình thức bổ sung lấy từ dòng `violations` được trỏ tới, không lưu lại.
- Mỗi ô 25 điểm. Mức phạt đúng khi trong khung (GAME_DESIGN §7 Q7). Hình thức bổ sung: đủ và không thừa được đủ điểm; thừa một mục được một nửa.
- Tình huống 2 hành vi: ghép dòng theo cách cho điểm cao nhất.
- Không tính giờ.

**Việc làm**
1. Logic thuần `tro-choi/lap-bien-ban.ts`: kiểm `payload`/`answer`, dựng danh sách điều khoản lựa chọn từ URN của các dòng cùng nhóm, chấm từng ô, ghép dòng.
2. Trình soạn tình huống cho biên tập viên: lời kể, chọn 1–2 mức phạt (tìm kiếm), xem trước biểu mẫu.
3. Web: trang `/tro-choi/lap-bien-ban`: lời kể ở trên, biểu mẫu 4 ô ở dưới; chọn hành vi có ô tìm không dấu (dùng lại API tìm mức phạt GĐ5); ô tiền có định dạng nghìn; sau khi "Ký biên bản", từng ô hiện đúng/sai và đáp án.
4. Seed 10 tình huống mẫu ở `cho_duyet` trỏ tới các mức phạt có sẵn.

**File sửa**
- `packages/dao-tao/src/tro-choi/dang-ky.ts`
- `apps/web/app/routes.ts`, `apps/web/app/components/quan-tri/tro-choi/index.ts`
- `package.json`: script `db:seed:tro-choi`

**File tạo**
- `packages/dao-tao/src/tro-choi/lap-bien-ban.ts`, `packages/dao-tao/tests/lap-bien-ban.test.ts`
- `packages/db/src/seed-tro-choi.ts` (dùng chung cho seed của các trò sau), `data/tro-choi/lap-bien-ban.json`
- `apps/api/src/lap-bien-ban.test.ts`
- `apps/web/app/routes/tro-choi.lap-bien-ban.tsx`
- `apps/web/app/components/tro-choi/MauBienBan.tsx`, `ChonHanhVi.tsx`, `ChonDieuKhoan.tsx`
- `apps/web/app/components/quan-tri/tro-choi/SuaLapBienBan.tsx`

**Migration**
- `0030_lap_bien_ban.sql`: `INSERT INTO games` `lap_bien_ban`, `offline_ok = true`

**Kiểm tra đã xong**
- [x] Unit test chấm (`lap-bien-ban.test.ts`): đúng cả 4 ô được 100; tiền ở biên dưới và biên trên của khung được đủ điểm, ngoài khung 1 đồng được 0; hình thức bổ sung thiếu một mục được 0, thừa một mục được 12,5; tình huống 2 hành vi điền đảo thứ tự vẫn được đủ điểm.
- [x] Unit test kiểm tình huống: trỏ tới mã mức phạt không tồn tại, hoặc 2 hành vi khác loại xe, thì báo lỗi rõ.
- [x] API test: tình huống trỏ tới mức phạt đang `cho_duyet` không xuất hiện trong lượt; biểu mẫu gửi cho người chơi không chứa mã mức phạt đúng.
- [x] E2E ở 360px: chọn hành vi bằng tìm kiếm không dấu ("khong doi mu"), điền đủ 4 ô, ký, thấy kết quả từng ô.
- [ ] **Đủ nội dung đã duyệt:** ít nhất 10 tình huống, phủ 3 nhóm hành vi.

**Kết quả (27/9/2026)** — phần mã xong; trò vẫn tắt (`games.enabled = false`) vì chưa có mức phạt và tình huống đã duyệt.
- Đã làm: luật thuần `tro-choi/lap-bien-ban.ts` (kiểm tình huống, dựng lựa chọn bằng id mờ nên phần đề không có mã mức phạt, chấm từng ô, ghép dòng theo cách cho điểm cao nhất, tìm hành vi không dấu chạy trên máy nên dùng được khi offline); nguồn `lap_bien_ban_tinh_huong` (`packages/db/src/lap-bien-ban.ts`); migration `0030`; trang `/tro-choi/lap-bien-ban`; `MauBienBan`, `ChonHanhVi`, `ChonDieuKhoan`; seed 20 tình huống demo ở `cho_duyet` (`bun run db:seed:tro-choi`), phủ 6 nhóm hành vi, 3 tình huống 2 hành vi.
- Mỗi lượt 3 biên bản (anh/chị chọn 27/9). Mỗi tình huống mang theo các dòng mức phạt cùng loại xe (không cả bảng) để gói offline gọn.
- Hiệu ứng riêng (đã duyệt 27/9): chữ ký tự vẽ, chấm từng ô lần lượt, con dấu "ĐẠT"/"CHƯA ĐẠT". Keyframe ở `components/tro-choi/lap-bien-ban.css`. E2E `scripts/e2e/lap-bien-ban.ts` (360×740, CPU chậm 4×): chế độ thường và giảm chuyển động đều đạt, khung >100 ms dưới 1,5%, không tạo AudioContext khi tắt âm.
- **Chưa làm:**
  - Việc 2 (trình soạn riêng): chưa được duyệt sửa `quan-tri.noi-dung-tro-choi.sua.tsx`, biên tập vẫn soạn JSON: `payload = { "loi_ke": "...", "hinh": null }`, `answer = { "vi_pham": ["mt-mu-bao-hiem"] }`, tham chiếu `violation:<mã>`.
  - Nút nộp vẫn là "Chốt đáp án" và màn mở đầu vẫn ghi "Trả lời càng nhanh càng được thêm điểm" (chữ của khung chung `tro-choi.luot.tsx`, chưa được duyệt sửa).
- **Chờ đơn vị chuyên môn:** căn cứ trong `data/tra-cuu/muc-phat.json` mới ghi tới mức Điều, nên ô "Điều khoản" hiện chỉ chấm tới Điều; kho văn bản chưa có Nghị định số 168/2024/NĐ-CP. Ghi chú kiểm tra từng tình huống ở trường `ghi_chu_kiem_tra` trong `data/tro-choi/lap-bien-ban.json`. Ảnh cần bổ sung: luu-tru/GAME_DESIGN_cu.md §5.3.

---

## GĐ-G4 — Người vi phạm nói gì?

**Mục tiêu**
- Người chơi chọn câu đáp đúng luật, đúng tác phong trước lời bào chữa của người vi phạm; thấy phản ứng của người vi phạm với câu đã chọn.
- Lời bào chữa là **câu hỏi ngân hàng có ngữ cảnh**, dùng được cả trong luyện tập và thi (GAME_DESIGN §7 Q5).

**Thiết kế** (GAME_DESIGN §5.4)
- `questions.context` = `{ nguoi_noi, loi_bao_chua, phan_ung: { <id phương án>: "…" } }`; chỉ nhận ở câu `mot_dap_an`.
- Sửa `context` của câu đã duyệt cũng đưa câu về `cho_duyet` (tính là sửa nội dung).
- `phan_ung` chỉ gửi **sau** khi chấm (như giải thích).
- Lượt 8 câu, 20 giây mỗi câu, rút theo chủ đề như luyện tập, lọc `context IS NOT NULL`.

**Việc làm**
1. `cau-hoi.ts`: kiểu và kiểm `context`; `deChoNguoiHoc` gửi `nguoi_noi`, `loi_bao_chua`, không gửi `phan_ung`.
2. Ngân hàng: form sửa câu thêm khối "Ngữ cảnh trò chơi" (người nói, lời bào chữa, phản ứng cho từng phương án); mẫu Excel thêm 3 cột; lọc "Có ngữ cảnh trò chơi".
3. `HienThiCauHoi` hiện lời bào chữa trong bong bóng thoại khi câu có ngữ cảnh (luyện tập, thi, trò chơi đều thấy).
4. Logic trò `tro-choi/nguoi-vi-pham-noi-gi.ts`; trang `/tro-choi/nguoi-vi-pham-noi-gi`.
5. Seed 24 câu mẫu ở `cho_duyet`, mỗi câu có 3 kiểu phương án sai (sai luật, sai tác phong, vượt thẩm quyền).

**File sửa**
- `packages/dao-tao/src/cau-hoi.ts`, `packages/dao-tao/tests/cau-hoi.test.ts`, `packages/dao-tao/src/tro-choi/dang-ky.ts`
- `packages/db/src/ngan-hang.ts`, `packages/db/src/luyen-tap.ts` (lọc theo ngữ cảnh), `packages/db/src/seed-ngan-hang.ts`
- `apps/api/src/routes/ngan-hang.ts`
- `apps/web/app/routes/quan-tri.cau-hoi.tsx`, `quan-tri.cau-hoi.sua.tsx`, `apps/web/app/components/cau-hoi/HienThiCauHoi.tsx`, `apps/web/app/lib/ngan-hang.ts`, `apps/web/app/routes.ts`
- `data/mau/mau-nhap-cau-hoi.xlsx`

**File tạo**
- `packages/dao-tao/src/tro-choi/nguoi-vi-pham-noi-gi.ts`, `packages/dao-tao/tests/nguoi-vi-pham-noi-gi.test.ts`
- `apps/api/src/nguoi-vi-pham-noi-gi.test.ts`
- `apps/web/app/routes/tro-choi.nguoi-vi-pham-noi-gi.tsx`
- `apps/web/app/components/tro-choi/BongThoai.tsx`

**Migration**
- `0031_cau_hoi_ngu_canh.sql`:
  - `questions ADD COLUMN IF NOT EXISTS context jsonb`
  - CHECK `context IS NULL OR kind = 'mot_dap_an'`
  - index một phần `questions(topic_id, status) WHERE context IS NOT NULL`
  - `INSERT INTO games` `nguoi_vi_pham_noi_gi`, `offline_ok = true`

**Kiểm tra đã xong**
- [ ] Unit test: `context` ở câu không phải `mot_dap_an` bị từ chối; `phan_ung` trỏ tới id phương án không tồn tại bị từ chối; `deChoNguoiHoc` không có `phan_ung`.
- [ ] API test: nhập Excel 10 câu có ngữ cảnh, 1 câu lỗi, báo đúng số dòng; sửa `context` của câu đã duyệt thì câu về `cho_duyet`, `version + 1`.
- [ ] API test: phản hồi trước khi chấm không có `phan_ung`, `answer`; sau khi chấm có phản ứng đúng với phương án đã chọn.
- [ ] Câu có ngữ cảnh xuất hiện đúng trong luyện tập (GĐ4) và trong đề thi sinh từ ma trận (GĐ6); test cũ của hai giai đoạn vẫn đạt.
- [ ] E2E 360px: lời bào chữa và 4 câu đáp đọc được mà không cuộn ngang; phản ứng hiện sau khi chọn.
- [ ] **Đủ nội dung đã duyệt:** ít nhất 24 câu, phủ 4 chủ đề. **Mốc M4:** 4 trò đợt 1 bật trên máy demo, một cán bộ mẫu chơi hết mỗi trò một lượt mà không cần hướng dẫn.

---

## GĐ-G5 — Hiện trường

**Mục tiêu**
- Người chơi xử lý một tình huống qua 4–8 bước quyết định; mỗi lựa chọn có hậu quả và dẫn tới diễn biến khác; cuối lượt có đánh giá từng quyết định kèm căn cứ.

**Thiết kế** (GAME_DESIGN §5.6)
- Kịch bản là một tài liệu JSON trong `game_content.payload` (cây nút), điểm và giải thích từng lựa chọn trong `answer`. Duyệt cả kịch bản như một đơn vị.
- Kiểm cây khi lưu và khi duyệt: một nút bắt đầu, mọi nút tới được, không chu trình, mọi đường tới nút kết thúc, tối đa 8 bước mỗi đường, mỗi lựa chọn có căn cứ (URN hoặc bước của `procedures`).
- Tỷ lệ = điểm đường đã đi / điểm đường tốt nhất (tính bằng duyệt cây).
- `buocTiep` của định nghĩa trò chọn nút tiếp theo theo lựa chọn; ảnh chụp lượt giữ cả cây.

**Việc làm**
1. Logic thuần `tro-choi/hien-truong.ts`: kiểm cây, điểm đường tốt nhất, chấm, dựng đánh giá cuối lượt.
2. Trình soạn cây cho biên tập viên: danh sách nút thụt lề (thêm, sửa, xóa nút và lựa chọn), sơ đồ xem trước chỉ đọc, báo lỗi cây ngay khi soạn, chọn căn cứ từ bước quy trình.
3. Web: trang `/tro-choi/hien-truong` (chọn kịch bản → từng bước một màn hình → hậu quả → đánh giá cuối lượt).
4. Seed 2 kịch bản xử lý vi phạm từ `data/tra-cuu/quy-trinh.json`, ở `cho_duyet`. Kịch bản tai nạn chờ GAME_DESIGN §7 Q15.

**File sửa**
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/dao-tao/src/tro-choi/khung.ts` (nếu cần mở rộng `buocTiep`)
- `packages/db/src/seed-tro-choi.ts`
- `apps/web/app/routes.ts`, `apps/web/app/components/quan-tri/tro-choi/index.ts`

**File tạo**
- `packages/dao-tao/src/tro-choi/hien-truong.ts`, `packages/dao-tao/tests/hien-truong.test.ts`
- `data/tro-choi/hien-truong.json`
- `apps/api/src/hien-truong.test.ts`
- `apps/web/app/routes/tro-choi.hien-truong.tsx`
- `apps/web/app/components/tro-choi/BuocHienTruong.tsx`, `DanhGiaCuoiLuot.tsx`
- `apps/web/app/components/quan-tri/tro-choi/SuaCayHienTruong.tsx`, `SoDoCay.tsx`

**Migration**
- `0032_hien_truong.sql`: `INSERT INTO games` `hien_truong`, `offline_ok = true`

**Kiểm tra đã xong**
- [ ] Unit test kiểm cây: phát hiện chu trình, nút không tới được, đường không kết thúc, đường dài quá 8 bước, lựa chọn thiếu căn cứ; mỗi lỗi có thông báo chỉ đúng nút.
- [ ] Unit test chấm: đi đúng đường tốt nhất được 100%; đường ngắn hơn nhưng toàn lựa chọn tốt vẫn so với đường tốt nhất; điểm âm không làm tổng lượt dưới 0.
- [ ] API test: gửi lựa chọn không thuộc nút hiện tại nhận 409; đề gửi đi chỉ có nút hiện tại, không có điểm, không có các nút chưa tới.
- [ ] API test offline: đồng bộ lượt đi qua một nhánh, máy chủ chấm lại ra cùng tỷ lệ.
- [ ] E2E 360px: đi hết một kịch bản, màn đánh giá liệt kê đủ các quyết định kèm nút "Xem điều khoản".
- [ ] **Đủ nội dung đã duyệt:** ít nhất 2 kịch bản xử lý vi phạm.

---

## GĐ-G6 — Mùa giải đơn vị

**Trạng thái (27/9/2026): xong phần mã.** Giữ lại dù danh sách trò đã đổi (anh/chị chọn giữ; câu D2 ở GAME_DESIGN §8 chờ chốt có chạy song song với trò 7 hay không).
- Test: `packages/dao-tao/tests/mua-giai.test.ts` (23 ca, gồm mô phỏng 3 hạng × 10 đơn vị × 4 tuần tính tay) và `apps/api/src/mua-giai.test.ts` (13 ca). Soát 360px bằng Chrome, CPU chậm 4×, cả chế độ giảm chuyển động.
- Hiệu ứng riêng đã duyệt: hàng đơn vị trượt trên thang hạng, dấu kết quả tuần, vạch lên hạng chạy. Kết quả tuần có sao (lên 3, giữ 2, xuống 1).
- Ngoài danh sách tệp đã nêu, có sửa thêm (đã hỏi): `packages/queue/src/queues.ts` (1 dòng số luồng), `scripts/demo.ts` (bước gieo `scripts/demo-mua-giai.ts`), `content/huong-dan/muc-luc.json` (tạm miễn bài hướng dẫn cho `/quan-tri/mua-giai`). Không sửa `workers/index.ts` (đó là giai đoạn lập chỉ mục, danh sách tệp ghi nhầm) và `packages/dao-tao/src/diem-thuong.ts` (huy hiệu trao ở bước chốt tuần; luật lạ được `huyHieuDat` bỏ qua).
- Luật thêm so với thiết kế: XP và quân số của đơn vị gồm cả đơn vị con; lượt ghi đúng 06:00 thứ Hai trở đi không tính; API chốt bù khi có tuần tới hạn mà worker chưa chạy (bản demo không có Redis).

**Mục tiêu**
- XP từ mọi hoạt động dồn về đơn vị; đơn vị cùng cấp xếp hạng theo tuần, chia hạng và nhóm, có lên hạng và xuống hạng.

**Thiết kế** (GAME_DESIGN §5.10)
- Điểm tuần = tổng XP tính mùa giải của thành viên / quân số đang hoạt động; XP mỗi người mỗi tuần có trần.
- XP theo `xp_ledger.unit_id` (đơn vị lúc nhận XP).
- Chốt tuần 06:00 thứ Hai giờ Việt Nam bằng job lặp; trong tuần tính trực tiếp, không lưu.
- Mọi con số (số hạng, cỡ nhóm, số lên/xuống, trần XP, độ dài mùa) nằm trong `seasons.config` (GAME_DESIGN §7 Q11).
- Đơn vị có dưới 3 thành viên đang hoạt động không xếp hạng (quá dễ đạt điểm trung bình cao).

**Việc làm**
1. Logic thuần `mua-giai.ts`: chia nhóm trong hạng (cân bằng theo điểm tuần trước), điểm tuần, lên/xuống hạng, đặt lại mềm đầu mùa, xếp hạng ban đầu của mùa đầu.
2. `packages/db/src/mua-giai.ts`: bảng hạng trực tiếp trong tuần, chốt tuần (idempotent: chạy lại không đổi kết quả), tạo mùa.
3. Worker `qdpl-mua-giai`: job lặp mỗi giờ, chỉ chốt khi đã qua 06:00 thứ Hai và tuần trước chưa chốt (nhịp bị lỡ vẫn chốt được).
4. API: `GET /v1/mua-giai` (hạng, nhóm, thứ hạng đơn vị tôi, số điểm cần để lên hạng), `/v1/quan-tri/mua-giai` (tạo, sửa cấu hình trước khi bắt đầu, kết thúc sớm).
5. Web: trang `/bang-xep-hang` thêm tab "Mùa giải" (nhóm của đơn vị tôi, vùng lên hạng và xuống hạng tô màu, kết quả tuần trước); quản trị `/quan-tri/mua-giai`.
6. Huy hiệu `len_hang_mua_giai` trao cho mọi thành viên có XP trong tuần đơn vị lên hạng.

**File sửa**
- `packages/dao-tao/src/index.ts`, `packages/dao-tao/src/diem-thuong.ts` (huy hiệu)
- `packages/db/src/index.ts`
- `apps/workers-ts/src/bull/workers/index.ts`, `apps/workers-ts/src/bull/registry.ts`, `apps/workers-ts/src/bull/runner.ts`
- `packages/queue/src/types.ts`, `.do/app.yaml` (`--queues` của worker)
- `apps/api/src/app.ts`
- `apps/web/app/routes.ts`, `routes/bang-xep-hang.tsx`, `routes/quan-tri.tsx`

**File tạo**
- `packages/dao-tao/src/mua-giai.ts`, `packages/dao-tao/tests/mua-giai.test.ts`
- `packages/db/src/mua-giai.ts`
- `apps/workers-ts/src/bull/workers/mua-giai.ts`
- `apps/api/src/routes/mua-giai.ts`, `apps/api/src/mua-giai.test.ts`
- `apps/web/app/routes/quan-tri.mua-giai.tsx`
- `apps/web/app/components/tro-choi/BangMuaGiai.tsx`

**Migration**
- `0033_mua_giai.sql`:
  - `seasons(id, code UNIQUE, name, starts_on date, ends_on date, unit_level_label, config jsonb, status CHECK (sap_dien_ra|dang_dien_ra|ket_thuc), created_by, created_at)`; CHECK `starts_on` là thứ Hai
  - `season_standings(season_id, week_start date, unit_id, tier smallint, group_no smallint, members int, active_members int, xp_counted int, score numeric, rank_in_group int, outcome CHECK (len|giu|xuong) NULL, closed_at, PRIMARY KEY(season_id, week_start, unit_id))`
  - chỉ một mùa `dang_dien_ra` tại một thời điểm (UNIQUE một phần)

**Kiểm tra đã xong**
- [x] Unit test (`mua-giai.test.ts`):
  - nhóm 10 đơn vị: 2 đầu lên, 2 cuối xuống; hạng 1 không lên, hạng 4 không xuống;
  - một người đạt 2.000 XP chỉ tính 700 (trần); đơn vị 5 người có 1 người chơi bị chia cho 5;
  - đơn vị dưới 3 thành viên hoạt động không xếp hạng;
  - bằng điểm thì đơn vị có tỷ lệ người tham gia cao hơn đứng trên.
- [x] Test thời gian (tham số `now`): XP lúc 23:59 Chủ nhật tính cho tuần đó; lượt offline đồng bộ lúc 05:59 thứ Hai được tính, 06:01 thì không tính vào mùa giải nhưng vẫn vào XP cá nhân.
- [x] API test: chốt tuần chạy hai lần cho cùng kết quả; người chuyển đơn vị giữa tuần có XP trước khi chuyển tính cho đơn vị cũ.
- [x] API test phạm vi: cán bộ chỉ thấy nhóm của đơn vị mình; quản trị thấy mọi nhóm.
- [x] Trên dữ liệu gieo 3 hạng × 10 đơn vị × 4 tuần, bảng hạng và kết quả lên/xuống khớp phép tính tay trong test.
- [x] Soát bảng kiểm §0.4 ở 360px.

---

## GĐ-G7 — Chốt tuần tra

**Mục tiêu**
- Người chơi xem cảnh đường phố, chạm vào xe vi phạm, chọn lỗi và mức phạt; bỏ sót hay dừng nhầm đều có phản hồi.

**Thiết kế** (GAME_DESIGN §5.1)
- Cảnh là dữ liệu trong `game_content.payload` (loại đường, đèn, biển, danh sách xe theo lưới làn × vị trí, trạng thái từng xe), dựng thành SVG từ **bộ hình vẽ** tĩnh. Không có ảnh riêng cho từng cảnh.
- `answer`: xe nào vi phạm, trỏ tới mã `violations`. Phương án nhiễu sinh từ `violations` cùng nhóm, cùng loại xe.
- Lượt 3 cảnh, 90 giây cả lượt; đúng lỗi +10, đúng mức phạt +5, dừng nhầm −5 (không dưới 0 mỗi cảnh).
- Bộ hình vẽ theo GAME_DESIGN §7 Q8.

**Việc làm**
1. Bộ hình vẽ SVG: đường (một chiều, hai chiều, ngã tư), vạch, đèn 3 màu, biển (dùng ảnh GĐ12), xe máy, ô tô con, xe tải, người lái, người ngồi sau, mũ bảo hiểm; mỗi tệp ≤ 8 KB.
2. Logic thuần `tro-choi/chot-tuan-tra.ts`: kiểm cảnh (xe không chồng ô lưới, trạng thái hợp với loại xe, mỗi xe vi phạm có mã mức phạt hợp loại xe), sinh phương án nhiễu, chấm.
3. Component `CanhDuongPho` dựng SVG từ dữ liệu, mỗi xe là một vùng chạm ≥ 44px, có nhãn cho trình đọc màn hình ("Xe máy làn phải, người lái không đội mũ").
4. Trình soạn cảnh: chọn nền, đặt xe vào ô lưới, chọn trạng thái, gắn mức phạt; xem trước bằng chính `CanhDuongPho`.
5. Trang `/tro-choi/chot-tuan-tra`; seed 6 cảnh ở `cho_duyet`.

**File sửa**
- `packages/dao-tao/src/tro-choi/dang-ky.ts`
- `packages/db/src/seed-tro-choi.ts`
- `apps/web/app/routes.ts`, `apps/web/app/components/quan-tri/tro-choi/index.ts`
- `apps/web/public/sw.js` (giữ bộ hình vẽ cho offline)

**File tạo**
- `apps/web/public/tro-choi/tuan-tra/*.svg`
- `packages/dao-tao/src/tro-choi/chot-tuan-tra.ts`, `packages/dao-tao/tests/chot-tuan-tra.test.ts`
- `data/tro-choi/chot-tuan-tra.json`
- `apps/api/src/chot-tuan-tra.test.ts`
- `apps/web/app/routes/tro-choi.chot-tuan-tra.tsx`
- `apps/web/app/components/tro-choi/CanhDuongPho.tsx`, `HopChonLoi.tsx`
- `apps/web/app/components/quan-tri/tro-choi/SuaCanhTuanTra.tsx`
- `scripts/e2e/chot-tuan-tra.ts`

**Migration**
- `0034_chot_tuan_tra.sql`: `INSERT INTO games` `chot_tuan_tra`, `offline_ok = true`

**Kiểm tra đã xong**
- [ ] Unit test kiểm cảnh: hai xe cùng ô, trạng thái "không đội mũ" trên ô tô, xe vi phạm thiếu mã mức phạt đều bị báo lỗi.
- [ ] Unit test chấm: dừng nhầm 3 xe trong cảnh chỉ có 1 xe vi phạm không làm điểm cảnh âm; bỏ sót được liệt kê trong tổng kết.
- [ ] API test: đề gửi đi không cho biết xe nào vi phạm (không có trường khác biệt giữa xe vi phạm và xe không vi phạm ngoài trạng thái nhìn thấy); hết 90 giây + dung sai thì chạm tiếp nhận 409 và lượt tự kết thúc.
- [ ] E2E 360px: chạm đúng xe, chọn lỗi, chọn mức phạt, sang cảnh sau; mọi xe chạm được bằng một ngón; không cuộn ngang.
- [ ] Hiệu năng: cảnh 8 xe dựng xong < 200 ms trên Chrome giả lập CPU chậm 4×; bộ hình vẽ tổng ≤ 150 KB.
- [ ] **Đủ nội dung đã duyệt:** ít nhất 6 cảnh, phủ 4 hành vi.

---

## GĐ-G8 — Cung đường biển báo

**Mục tiêu**
- Xe tự chạy; người chơi phản ứng đúng với từng biển báo QCVN 41 trong cửa sổ thời gian, có 3 mạng.
- Trò "Đoán biển báo" trở thành phần khởi động của trò này (GAME_DESIGN §7 Q2).

**Thiết kế** (GAME_DESIGN §5.5)
- `traffic_signs.reaction` (thao tác đúng) và `reaction_note`; sửa hai cột này là sửa nội dung biển, qua duyệt.
- Máy chủ sinh chuỗi biển và nhịp xuất hiện từ seed; điện thoại chạy hoạt cảnh và gửi nhật ký `[{ bien, thao_tac, ms }]`; máy chủ chấm lại, loại mốc không thể xảy ra (trước khi biển hiện; tổng thời gian lệch > 10% so với đồng hồ máy chủ).
- Biển không cần phản ứng mà người chơi giảm tốc hay dừng: 0 điểm, không mất mạng.
- Bật giảm chuyển động thì chuyển sang chế độ từng bước (biển hiện tĩnh, đếm 3 giây).

**Việc làm**
1. Chốt bộ thao tác (4 nút) theo dữ liệu biển báo; thêm `phan_ung`, `ghi_chu_phan_ung` vào `data/bien-bao/bien-bao.json`; mở rộng tệp tới ít nhất 30 biển (chờ QCVN 41 trong kho, xem GĐ12).
2. Logic thuần `tro-choi/cung-duong-bien-bao.ts`: sinh chuỗi, cửa sổ phản ứng theo cấp, chấm từ nhật ký, kiểm nhật ký hợp lệ.
3. Component `DuongChay`: SVG + `requestAnimationFrame`, tối đa 30 phần tử động, tạm dừng khi tab ẩn (tạm dừng tính là hết lượt nếu quá 10 giây).
4. Trang `/tro-choi/cung-duong-bien-bao`: 3 câu đoán biển khởi động (dùng `doan-bien-bao.ts`), rồi đường chạy. Route `/tro-choi/doan-bien-bao` chuyển hướng về đây.
5. Tab Biển báo ở `/quan-tri/du-lieu-tra-cuu` thêm hai trường phản ứng.

**File sửa**
- `packages/dao-tao/src/bien-bao.ts` (kiểm `reaction`), `packages/dao-tao/src/tro-choi/dang-ky.ts`
- `packages/db/src/bien-bao.ts`, `packages/db/src/du-lieu-tra-cuu.ts`
- `scripts/bien-bao.ts`, `data/bien-bao/bien-bao.json`
- `apps/web/app/routes.ts`, `routes/tro-choi.doan-bien-bao.tsx` (chuyển hướng), `routes/quan-tri.du-lieu-tra-cuu.tsx`

**File tạo**
- `packages/dao-tao/src/tro-choi/cung-duong-bien-bao.ts`, `packages/dao-tao/tests/cung-duong-bien-bao.test.ts`
- `apps/api/src/cung-duong-bien-bao.test.ts`
- `apps/web/app/routes/tro-choi.cung-duong-bien-bao.tsx`
- `apps/web/app/components/tro-choi/DuongChay.tsx`, `NutPhanUng.tsx`
- `scripts/e2e/cung-duong.ts`

**Migration**
- `0035_bien_bao_phan_ung.sql`:
  - `traffic_signs ADD COLUMN IF NOT EXISTS reaction text`, `reaction_note text`; CHECK `reaction` thuộc bộ thao tác đã chốt
  - `INSERT INTO games` `cung_duong_bien_bao`, `offline_ok = true`; `UPDATE games SET enabled = false WHERE code = 'doan_bien_bao'`

**Kiểm tra đã xong**
- [x] Unit test chấm từ nhật ký: phản ứng đúng trong cửa sổ +10 và thưởng nhanh; ngoài cửa sổ mất mạng; hết 3 mạng thì các biển sau không tính; mốc thời gian trước khi biển hiện bị loại.
  - `packages/dao-tao/tests/cung-duong-bien-bao.test.ts`; thêm: chỉ tính thao tác đầu tiên, biển "Đi tiếp" không phạt người thận trọng, đường chạy dừng giữa chừng, mốc sau lúc kết thúc.
- [x] Unit test sinh chuỗi: cùng seed cùng chuỗi; chỉ dùng biển `da_duyet` có `reaction`; không hai biển giống nhau liền nhau.
  - Lọc `da_duyet` ở truy vấn nguồn (`nguonBienBaoPhanUng`), kiểm ở API test; unit test kiểm lọc phản ứng hợp lệ và bỏ biển phụ.
- [x] API test: nhật ký có tổng thời gian lệch 20% so với đồng hồ máy chủ ~~bị từ chối~~ **bị chấm 0 điểm, không gửi lại được** (người dùng chọn 25/9/2026); lượt offline được chấm, không có thưởng nhanh.
  - `apps/api/src/cung-duong-bien-bao.test.ts`, 7 test đạt; thêm: sửa phản ứng của biển thì biển về chờ duyệt, rút khỏi trò.
- [x] E2E 360px: chơi hết một lượt bằng nút; bật `reducedMotion: reduce` thì trang ở chế độ từng bước, không có `animation`.
  - `scripts/e2e/cung-duong.ts`: 3 câu khởi động, 12 biển, cố ý sai biển 2 → máy chủ chấm 110/120, một dòng XP.
  - Giảm chuyển động: biển tĩnh có đếm giây, vạch kẻ đứng yên, `.g-a` chỉ còn `g-hien`, `.g-t` là `none`, không tạo AudioContext khi tắt âm; sai 3 biển đầu thì hết mạng. Ảnh chụp đã soát tay.
- [x] Hiệu năng: ≥ 50 khung hình/giây trên Chrome giả lập CPU chậm 4× (đo bằng DevTools Protocol trong E2E).
  - Đo cả đường chạy (63 giây): trung bình 58,4–59,0 khung/giây, p95 16,9 ms qua 3 lần chạy.
- [ ] **Đủ nội dung đã duyệt:** ít nhất 20 biển có phản ứng, phủ 5 nhóm biển.
  - Có 30 biển có phản ứng, phủ 4 nhóm (biển phụ không dùng trong trò vì không đứng một mình), **tất cả là dữ liệu demo, chưa duyệt**: chờ QCVN 41:2024/BGTVT trong kho và đơn vị chuyên môn kiểm (GAME_DESIGN §5.5). Trò đang tắt.

**Trạng thái (25/9/2026):** đã làm xong phần mã, đạt 5/6 mục kiểm tra. Mục nội dung đã duyệt chờ văn bản và đơn vị chuyên môn.
- Cổng chung:
  - `bun run typecheck` qua; build web qua (trong E2E).
  - `bun test`: 1104 đạt, 5 hỏng, cả 5 ở `packages/config/src/ports.test.ts` (lỗi môi trường Windows có từ trước).
  - Biome: các tệp của GĐ-G8 qua.
  - E2E đạt: `cung-duong`, `bien-bao`, `tro-choi`, `tro-choi-khung`, `sung-ban-toc-do`, `tro-choi-muot`, `offline`. `offline` có lúc hỏng khi chạy chung nhiều kịch bản: kiểm phiên luyện tập ngay khi đủ 10 câu, trước khi lệnh kết thúc phiên tới. Chạy riêng thì đạt. Tệp này không sửa ở giai đoạn này.
  - `bun run scripts/bien-bao.ts --kiem-tra` qua (URN QCVN 41:2024 chưa có trong kho, chỉ cảnh báo, như trước).
- Quyết định của người dùng khi làm giai đoạn này:
  - **Sửa khung chung** (đã hỏi trước, tương thích ngược, các trò cũ không đổi hành vi):
    - `chamBuoc` nhận thêm `{ thoiGianMs, offline }`;
    - `KetQuaChamBuoc.thuong` để trò tự tính thưởng nhanh, khung vẫn ép 0 khi offline hoặc hết giờ;
    - thêm nguồn `bien_bao_phan_ung`;
    - API xem lại lượt truyền cùng ngữ cảnh khi dựng lại kết quả.
  - Nhật ký lệch giờ: chấm 0, không từ chối.
  - Ba hiệu ứng riêng: đèn phanh và đường chậm lại, biển lướt về dải "biển đã qua", mạng hình vô lăng.
  - Soạn thêm 18 biển nháp để đủ 30 biển có phản ứng.
- Tệp đã làm ngoài danh sách ở trên:
  - khung chung: `packages/dao-tao/src/tro-choi/khung.ts`, `packages/db/src/nguon-tro-choi.ts`, `apps/api/src/routes/luot-choi.ts`;
  - `packages/dao-tao/src/index.ts`;
  - `apps/api/src/routes/du-lieu-tra-cuu.ts` (hai trường phản ứng);
  - `apps/web/app/components/tro-choi/giao-dien.tsx`, `CauKhoiDongBienBao.tsx`;
  - `apps/web/app/lib/cung-duong.ts`;
  - `content/huong-dan/muc-luc.json`;
  - `scripts/demo-tro-choi.ts`, `scripts/demo.ts` (bản demo tự duyệt biển có phản ứng và bật trò);
  - `scripts/e2e/bien-bao.ts` (phần game cũ đổi thành kiểm chuyển hướng);
  - 18 ảnh mới trong `data/bien-bao/anh/`.

---

## GĐ-G9 — Bộ đàm

**Mục tiêu**
- Hệ thống đọc câu hỏi như qua bộ đàm; người chơi giữ nút để nói câu trả lời.
- Thay trò "Hỏi nhanh bằng giọng nói" (GĐ14).

**Thiết kế** (GAME_DESIGN §5.7)
- Câu hỏi ngân hàng loại `mot_dap_an`, `dung_sai`, và `dien_khuyet` có đáp án là số.
- Khớp lời nói bằng `khop-loi-noi.ts`, thêm đọc số bằng chữ tiếng Việt ("tám trăm nghìn", "một triệu hai", "năm mươi ki lô mét"). Không chắc thì hỏi lại một lần.
- Không chấm AI câu trả lời tự do (GAME_DESIGN §7 Q9).
- 20 giây mỗi cuộc gọi, tính từ lúc đọc xong câu hỏi (điện thoại báo mốc đọc xong; máy chủ chỉ nhận mốc nằm trong khoảng thời lượng âm thanh ± 2 giây).
- Hiệu ứng bộ đàm dựng trên trình duyệt bằng Web Audio (lọc dải tần, tiếng rè ngắn), không tạo tệp âm thanh mới.

**Việc làm**
1. `khop-loi-noi.ts`: đọc số bằng chữ, đơn vị (đồng, nghìn, triệu, km/h, điểm), các cách nói tắt ("tám trăm", "tám lít" thì báo không chắc).
2. Logic trò `tro-choi/bo-dam.ts`; câu `dien_khuyet` chỉ nhận khi đáp án của mọi ô là số.
3. Component `NutBoDam` (giữ để nói, thả để gửi; có phương án bấm một lần để bắt đầu/kết thúc cho người dùng trình đọc màn hình), `useHieuUngBoDam`.
4. Trang `/tro-choi/bo-dam`; `/tro-choi/hoi-nhanh-giong-noi` chuyển hướng về đây. Trình duyệt không có `SpeechRecognition` thì trang báo không hỗ trợ và gợi ý trò khác.

**File sửa**
- `packages/dao-tao/src/khop-loi-noi.ts`, `packages/dao-tao/tests/khop-loi-noi.test.ts`, `packages/dao-tao/src/tro-choi/dang-ky.ts`
- `apps/web/app/routes.ts`, `routes/tro-choi.hoi-nhanh-giong-noi.tsx` (chuyển hướng), `routes/api.giong-doc.$.tsx` (nếu cần thêm đường dẫn)

**File tạo**
- `packages/dao-tao/src/tro-choi/bo-dam.ts`, `packages/dao-tao/tests/bo-dam.test.ts`
- `apps/api/src/bo-dam.test.ts`
- `apps/web/app/routes/tro-choi.bo-dam.tsx`
- `apps/web/app/components/tro-choi/NutBoDam.tsx`, `apps/web/app/components/giong-noi/useHieuUngBoDam.ts`
- `scripts/e2e/bo-dam.ts`

**Migration**
- `0036_bo_dam.sql`: `INSERT INTO games` `bo_dam`, `offline_ok = false`; `UPDATE games SET enabled = false WHERE code = 'hoi_nhanh_giong_noi'`

**Kiểm tra đã xong**
- [ ] Unit test đọc số: "tám trăm nghìn" = 800000; "một triệu hai" = 1200000; "năm mươi" = 50; "hai mươi lăm" = 25; "tám trăm" với đáp án 800000 trả "không chắc" (không đoán đơn vị).
- [ ] Unit test chấm: hỏi lại lần hai vẫn không rõ thì sai; mốc "đọc xong" ngoài khoảng thời lượng âm thanh ± 2 giây bị thay bằng mốc máy chủ.
- [ ] API test: bộ đàm chỉ rút câu thuộc 3 loại được phép; XP một lần mỗi lượt.
- [ ] E2E với nhận dạng giọng nói giả lập (như `scripts/e2e/giong-noi.ts`): giữ nút → kết quả "đáp án B" → được chấm đúng.
- [ ] Soát tay trên Chrome Android: nghe rõ câu hỏi qua hiệu ứng bộ đàm, nói "tám trăm nghìn" được nhận đúng.

---

## GĐ-G10 — Đối đầu 1–1

**Mục tiêu**
- Hai người trả lời cùng 7 câu theo thời gian thực; không có đối thủ trong 20 giây thì đấu với lượt đã ghi của người khác ("bóng").

**Thiết kế** (GAME_DESIGN §5.9)
- WebSocket trên API (`upgradeWebSocket` của Hono cho Bun). Trình duyệt xin **vé kết nối** dùng một lần, hạn 30 giây, qua resource route của web; API đổi vé lấy tài khoản.
- Máy chủ giữ đồng hồ, gửi câu, nhận đáp án, chấm, gửi kết quả từng câu cho cả hai. Mỗi người có một `game_runs` riêng với thời gian từng bước, nên lượt nào cũng dùng làm bóng được.
- Bóng: lượt đối đầu đã xong trong 30 ngày, của người khác, chênh ≤ 2 cấp, chưa gặp người này trong 7 ngày; bộ câu của trận lấy theo lượt bóng. Chưa có lượt nào thì dùng bóng máy từ thống kê câu hỏi, ghi rõ "Đối thủ mô phỏng" (GAME_DESIGN §7 Q10).
- API chạy 1 instance: hàng chờ và phòng giữ trong bộ nhớ, sau một giao diện `KhoPhongDau` để thay bằng Redis khi tăng instance.
- Rớt kết nối: 10 giây để nối lại; quá hạn thì tính rời trận.

**Việc làm**
1. Logic thuần `tro-choi/doi-dau.ts`: luật trận, điểm câu (10 + thưởng nhanh ≤ 5), thắng/thua/hòa, phát lại bóng, bóng máy.
2. `packages/db/src/doi-dau.ts`: tạo trận, chọn lượt bóng, ghi kết quả trận và hai `game_runs` trong một giao dịch.
3. `apps/api/src/ws/doi-dau.ts`: hàng chờ, phòng, giao thức tin nhắn (`tim`, `bat_dau`, `cau`, `tra_loi`, `ket_qua_cau`, `ket_thuc`, `noi_lai`), đồng hồ máy chủ; `index.ts` gắn `websocket` vào `Bun.serve`.
4. API REST: `POST /v1/doi-dau/ve` (cấp vé), `GET /v1/doi-dau/lich-su`.
5. Web: resource route cấp vé, trang `/tro-choi/doi-dau` (tìm đối thủ có đếm ngược, màn đấu hai thanh điểm, kết quả); biến `DOI_DAU_WS_URL` cho địa chỉ WebSocket công khai của API.
6. `.do/app.yaml`: API nhận đường dẫn WebSocket qua domain công khai; ghi chú giữ `instance_count: 1` cho tới khi có `KhoPhongDau` bằng Redis.

**File sửa**
- `packages/dao-tao/src/tro-choi/dang-ky.ts`, `packages/dao-tao/src/tro-choi/xp.ts` (thưởng thắng)
- `packages/db/src/index.ts`
- `apps/api/src/index.ts`, `apps/api/src/app.ts`
- `apps/web/app/routes.ts`
- `.do/app.yaml`, `.env.example` (`DOI_DAU_WS_URL`)

**File tạo**
- `packages/dao-tao/src/tro-choi/doi-dau.ts`, `packages/dao-tao/tests/doi-dau.test.ts`
- `packages/db/src/doi-dau.ts`
- `apps/api/src/ws/doi-dau.ts`, `apps/api/src/ws/kho-phong-dau.ts`
- `apps/api/src/routes/doi-dau.ts`, `apps/api/src/doi-dau.test.ts`
- `apps/web/app/routes/tro-choi.doi-dau.tsx`, `routes/doi-dau.ve.tsx`
- `apps/web/app/components/tro-choi/PhongDau.tsx`, `useKetNoiDoiDau.ts`
- `scripts/e2e/doi-dau.ts`

**Migration**
- `0037_doi_dau.sql`:
  - `duel_matches(id, mode CHECK (truc_tiep|bong|bong_may), seed, question_ids uuid[], status CHECK (cho|dang_dau|xong|huy), created_at, started_at, finished_at)`
  - `duel_players(match_id, account_id, run_id REFERENCES game_runs(id), is_ghost boolean, ghost_run_id uuid NULL, score numeric, result CHECK (thang|thua|hoa) NULL, PRIMARY KEY(match_id, account_id))`
  - `game_runs.match_id` thêm khóa ngoại tới `duel_matches`
  - index chọn bóng: `game_runs(game_code, finished_at) WHERE game_code = 'doi_dau' AND status = 'xong'`
  - `INSERT INTO games` `doi_dau`, `offline_ok = false`

**Kiểm tra đã xong**
- [ ] Unit test: điểm câu và thưởng nhanh; hòa khi bằng điểm; người rời trận thua, câu còn lại tính 0; phát lại bóng cho đúng đáp án và thời gian của lượt gốc.
- [ ] Unit test chọn bóng: không chọn lượt của chính mình, lượt quá 30 ngày, lượt chênh > 2 cấp, lượt đã gặp trong 7 ngày.
- [ ] API test WebSocket (hai client trong test): ghép cặp, cùng nhận 7 câu cùng thứ tự; trả lời sau 15 + 2 giây được 0 điểm; không tin nhắn nào có đáp án trước khi câu kết thúc; kết thúc trận ghi một `duel_matches`, hai `game_runs`, XP mỗi người một lần.
- [ ] API test: vé dùng lần hai hoặc quá 30 giây bị từ chối; không vé thì không mở được kết nối.
- [ ] API test nối lại: ngắt kết nối 5 giây rồi nối lại thì về đúng câu; ngắt 12 giây thì bị xử thua.
- [ ] Không có ai chờ: sau 20 giây được ghép với bóng; chưa có lượt nào thì ghép bóng máy, giao diện ghi "Đối thủ mô phỏng".
- [ ] `bun run e2e doi-dau`: hai trang trình duyệt ở 360×740 đấu hết một trận. **Mốc M5:** đủ 10 trò bật trên máy demo.

---

