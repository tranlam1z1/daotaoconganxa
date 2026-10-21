# THIẾT KẾ TRÒ CHƠI

*Cho 10 trò chơi ở [PRD.md](PRD.md) mục V.2 và 10 trò bổ sung ở mục V.5. Lập lại ngày 27/9/2026, thay bản ngày 25/9/2026 (lưu ở [luu-tru/GAME_DESIGN_cu.md](luu-tru/GAME_DESIGN_cu.md)). Thêm trò T11–T20 ngày 28/9/2026 (§5.11 đến §5.21), chưa làm trò nào trong nhóm này. Kế hoạch làm: [PLAN.md](PLAN.md), GĐ-T1 đến GĐ-T20. Phong cách hình ảnh: [VISUAL_STYLE.md](VISUAL_STYLE.md).*

---

## 0. Tóm tắt

1. **Danh sách mới gồm 10 trò mô phỏng thao tác nghiệp vụ, không có trò nào dạng trắc nghiệm.** Người chơi soi, đóng dấu, kéo thả, vuốt, giữ, lái, khoanh vùng. Không trò nào có màn "chọn 1 trong 4 phương án" làm lối chơi chính.
2. **Khung chung GĐ-G0 đã có và giữ nguyên:** lượt chơi, chấm trên máy chủ, XP, huy hiệu, hồ sơ chủ đề, duyệt nội dung, gói offline, đồng bộ. Mỗi trò chỉ viết phần riêng (§2).
3. **Hầu hết trò mới là trò mô phỏng, không phải trò hỏi đáp.** Vì vậy cần thêm một cách chấm: máy chủ **chạy lại nhật ký thao tác** trên cùng một bộ mô phỏng tất định (§2.3). Cung đường biển báo đã làm theo cách này nên có thể dùng làm mẫu.
4. **Nên làm 9 mô-đun dùng chung** (§4). Mô-đun lớn nhất là bộ mô phỏng giao thông, dùng cho trò 3, 5, 8, 9, 10. Mỗi mô-đun được tạo trong giai đoạn của trò đầu tiên cần nó.
5. **Dữ liệu là rủi ro lớn nhất, không phải mã.** Kho văn bản đang nối chỉ có 2 văn bản thử. Luật giấy tờ, quy trình dừng xe, đo nồng độ cồn, hiệu lệnh điều khiển giao thông, quy tắc đặt biển đều phải tra từ văn bản thật trước khi duyệt. Mọi dữ liệu mẫu soạn trong các giai đoạn này đều đánh dấu **"demo, chưa duyệt"**.
6. Các điểm cần anh/chị quyết định ở §8.
7. **10 trò bổ sung T11–T20 (28/9/2026)** dùng lại 9 mô-đun, không thêm mô-đun mới. Mở rộng mô-đun ở T12, T13, T14 (M1), T15, T16 (M5), T19 (M4), T20 (M9). Ba trò trùng lối chơi đáng kể với trò đã có: T15 với trò 3, T20 với trò 7, T11 với trò 1 và 5; cách tách ở §5.21. Câu hỏi D15 đến D32 ở §8.

---

## 1. Quy tắc chung khi làm trò chơi

Áp dụng cho mọi giai đoạn GĐ-T1 đến GĐ-T20. Giai đoạn nào không theo được một quy tắc thì ghi rõ lý do trong mục "Trạng thái" của giai đoạn đó ở PLAN.md.

### 1.1. Dùng khung chung, không tự viết lại

- Mọi trò chạy trên **khung trò chơi chung** của GĐ-G0: tính giờ, chấm điểm, XP, huy hiệu, lưu kết quả, đồng bộ offline. Cụ thể là `packages/dao-tao/src/tro-choi/khung.ts`, `dang-ky.ts`, `xp.ts`, `packages/db/src/luot-choi.ts`, API `/v1/luot-choi/*`, component `KhungGame`, `DongHoBuoc`, `PhanHoiBuoc`, `TongKetLuot`, hook `useLuotChoi`.
- Hình ảnh, màu, hoạt ảnh, âm thanh, rung theo **bộ phong cách ở [VISUAL_STYLE.md](VISUAL_STYLE.md)** (hướng A "Cảnh phục"): token màu và thời lượng, 10 hiệu ứng chuẩn, pháo hoa nhẹ, âm thanh Web Audio, rung, ngân sách dung lượng.
- Không viết đồng hồ, bộ tính XP, lớp đồng bộ, hiệu ứng đúng/sai hay màn tổng kết riêng cho từng trò.
- Phần riêng của một trò gồm: định nghĩa trò theo `DinhNghiaTroChoi`, hàm chấm, giao diện chơi đăng ký ở `components/tro-choi/giao-dien.tsx`, trình soạn nội dung (nếu có), dữ liệu mẫu.

### 1.2. Chấm điểm và bảo mật

- **Điểm số chấm lại ở máy chủ.** Máy khách có thể chấm trước để phản hồi ngay, nhưng máy chủ bỏ qua mọi điểm, cờ đúng/sai, kết quả do máy khách gửi lên, và chấm lại từ câu trả lời hoặc nhật ký thao tác (§2.3).
- **Người chơi lấy từ tài khoản đăng nhập**, không lấy từ body, query hay nhật ký gửi lên. Lượt của người A thì người B không đọc, không ghi được (403).
- **Giữ nguyên các chốt bảo mật GĐ0:** S1 (API biên tập kiểm vai trò, người duyệt lấy từ người đăng nhập), S2 (bắt buộc đăng nhập và hạn mức cho phần gọi AI), S3 (mọi route nhận `:id` kiểm bản ghi thuộc người gọi), S4 (tắt tài khoản demo quản trị ở production), S5 (CORS theo `CORS_ORIGINS`). Không trò nào được thêm route bỏ qua các kiểm tra này.
- **Không gửi đáp án trước khi chấm.** Test quét khóa cấm của GĐ-G0 (`answer`, `dap_an`, `giai_thich`, `can_cu`, `explanation`) áp dụng cho mọi trò. Trò mô phỏng buộc phải gửi một phần dữ kiện (ví dụ vị trí xe vi phạm trong hoạt cảnh camera): ghi rõ đánh đổi ở mục của trò đó, như Cung đường biển báo đã làm.
- Nhật ký thao tác có giới hạn độ dài và kiểm mốc thời gian như Cung đường biển báo: mốc trước lúc mở đề, sau lúc kết thúc, hoặc tổng thời gian lệch quá 10% so với đồng hồ máy chủ (cộng dung sai 2 giây) thì cả bước bị chấm 0 điểm, không cho gửi lại.

### 1.3. Nội dung và căn cứ pháp lý

- **Nội dung trò chơi đi qua quy trình duyệt như câu hỏi:** soạn → chờ duyệt → đã duyệt; sửa nội dung đã duyệt thì về chờ duyệt, tăng phiên bản. Trò chỉ rút nội dung qua `noiDungDungDuoc` (GĐ-G0), nên nội dung trỏ tới mức phạt, biển báo, quy trình vừa bị sửa sẽ tự rút khỏi trò.
- **Dữ liệu mẫu đánh dấu "demo, chưa duyệt"**, trong tiêu đề (tiền tố `[Demo]`) và trong ghi chú của từng mục. Dữ liệu mẫu nạp vào trạng thái chờ duyệt. Chỉ script demo được duyệt tự động, và chỉ trên CSDL có tên kết thúc bằng `_demo` (như `scripts/demo-tro-choi.ts`).
- **Luật, mức phạt, quy trình lấy từ văn bản trong hệ thống**: tra bằng tìm kiếm quy định, đọc nguyên văn điều khoản, kiểm căn cứ còn hiệu lực tại ngày áp dụng rồi mới gắn URN. Mức phạt lấy từ bảng mức phạt đã duyệt, không chép số tiền vào nội dung trò.
- **Chỗ không chắc thì ghi chú, không tự bịa.** Mỗi trò có bảng "Cần đơn vị chuyên môn kiểm tra" (như §5.2 của bản cũ) liệt kê từng quy tắc chưa đối chiếu được, ở đâu, vì sao. Văn bản chưa có trong kho thì ghi rõ "chưa có trong kho", không viện dẫn theo trí nhớ.
- Trò nào dựa trên quy tắc nghiệp vụ nội bộ, không có trong văn bản công khai (thứ tự ưu tiên sự việc, tác phong khi dừng xe…), thì ghi rõ nguồn là "tài liệu nghiệp vụ do đơn vị cung cấp", và chờ đơn vị đưa tài liệu.

### 1.4. Giao diện và hiệu năng

- **Giao diện tiếng Việt**, theo bộ kiểm hành văn (`QUY-TAC-HANH-VAN.md`) và bảng kiểm "cực kỳ đơn giản" PLAN §0.4. Không hiện URN, mã kỹ thuật, tên trường.
- **Tối ưu điện thoại:** chơi được ở 360×740, không cuộn ngang, vùng chạm ≥ 48px, thao tác chính bằng một tay. Kéo thả có đường thay thế bằng chạm (chạm vật, chạm chỗ đặt) và bằng bàn phím.
- **Mượt trên máy tầm trung** theo VISUAL_STYLE §6: 60 khung hình/giây mục tiêu, không khung hình nào quá 50 ms, đo trên Chrome giả lập CPU chậm 4×; chỉ động `transform`/`opacity`; cảnh động vẽ bằng Canvas 2D; mã riêng mỗi trò ≤ 8 KB gzip (trò có bộ mô phỏng ≤ 12 KB, chưa kể mô-đun dùng chung).
- **Tôn trọng chế độ giảm chuyển động** (`prefers-reduced-motion` hoặc công tắc "Giảm hiệu ứng" ở `/toi`): mỗi trò có **chế độ từng bước**, chấm giống hệt chế độ thường. Trò thời gian thực (5, 6, 8, 9, 15, 16, 17, 18) cho tạm dừng hoặc chạy chậm; đổi cách chơi thì ghi trong mục của trò.
- Âm thanh mặc định tắt, rung mặc định bật, theo VISUAL_STYLE §4. Âm thanh không bao giờ là tín hiệu duy nhất.

### 1.5. Hình ảnh

- **Hình chưa có thì dùng hình vector đơn giản** (SVG hoặc vẽ Canvas), tự vẽ theo VISUAL_STYLE. Không dùng quân hiệu, cấp hiệu, phù hiệu, logo của lực lượng Công an. Không dùng ảnh người thật.
- Giấy tờ trong trò (giấy phép lái xe, đăng ký xe, giấy chứng nhận bảo hiểm) là **hình giản lược có chữ "MẪU TRÒ CHƠI"**, không mô phỏng đúng mẫu phôi thật, để không thành bản mẫu làm giả.
- Mỗi trò có bảng **"Hình cần bổ sung"**: hình, hiện đang dùng gì, yêu cầu (định dạng, dung lượng, cỡ hiển thị).

### 1.6. Hướng dẫn và kết quả

- **Màn hướng dẫn chơi ngắn** trước lượt đầu: tối đa 3 thẻ, mỗi thẻ một thao tác, có hình động nhỏ (hình tĩnh khi giảm chuyển động). Có nút "Bỏ qua"; lần sau vào trò không hiện lại, mở lại được bằng nút "?" ở `KhungGame`.
- **Màn kết quả giải thích lỗi sai kèm điều khoản căn cứ:** dùng `TongKetLuot`, mỗi lỗi một dòng gồm người chơi đã làm gì, đúng ra phải làm gì, một câu giải thích, nút "Xem điều khoản" mở ngăn kéo căn cứ. Căn cứ chưa có trong kho thì ghi "Căn cứ đang được cập nhật", không để trống và không bịa.

### 1.7. Phạm vi sửa mã

- **Chỉ sửa file của trò đang làm.** File của trò gồm các file tạo mới trong giai đoạn đó và các file ghi ở mục "File sửa" của giai đoạn ở PLAN.md.
- **Cần sửa khung chung thì hỏi trước.** Khung chung gồm `khung.ts`, `dang-ky.ts` (ngoài dòng đăng ký trò), `xp.ts`, `luot-choi.ts` (cả `packages/db` và API), `nguon-tro-choi.ts` (ngoài dòng nguồn của trò), `KhungGame`, `TongKetLuot`, `PhanHoiBuoc`, `useLuotChoi`, lớp hiệu ứng `components/tro-choi/hieu-ung/`, `lib/offline/*`, `sw.js`, và các **mô-đun dùng chung ở §4 sau khi đã được tạo**.
- Việc tạo một mô-đun dùng chung **đã ghi trong kế hoạch** của một giai đoạn (§4.2) coi như đã được đồng ý. Sửa mô-đun đó ở giai đoạn sau thì phải hỏi.

### 1.8. Xong mỗi trò

1. Viết test phần chấm điểm: unit test hàm chấm (có ca biên, ca gian lận) và API test luồng lượt chơi.
2. Chạy test và build: `bun run typecheck`, `bun test`, `bun run build:web`, E2E của trò.
3. Chơi thử một lượt đầy đủ trên trình duyệt ở 360×740, cả chế độ thường và giảm chuyển động.
4. Đánh dấu `[x]` các mục "Kiểm tra đã xong" trong PLAN.md, ghi mục "Trạng thái".
5. Cập nhật DEMO.md: dòng màn hình của trò, cách chơi thử, dữ liệu demo.
6. Tóm tắt thay đổi để anh/chị commit (không tự commit).

---

## 2. Kiến trúc chung

### 2.1. Nền đã có (GĐ-G0) và phần giữ lại từ danh sách cũ

| Đã có | Ở đâu | Dùng cho trò mới |
|---|---|---|
| Bộ máy lượt chơi, ảnh chụp đề kèm đáp án, chấm máy chủ, tính giờ bước và cả lượt, sao, XP giảm dần khi chơi lặp | `tro-choi/khung.ts`, `xp.ts`, `packages/db/src/luot-choi.ts`, `/v1/luot-choi/*` | Mọi trò |
| Nội dung trò chơi có duyệt, tham chiếu có phiên bản, tab "Cần xem lại" | `game_content`, `noi-dung-tro-choi.ts`, `tham-chieu.ts`, `/quan-tri/noi-dung-tro-choi` | Mọi trò có nội dung soạn tay |
| Duyệt mức phạt, biển báo, quy trình, tốc độ tối đa trong ứng dụng | `du-lieu-tra-cuu.ts`, `/quan-tri/du-lieu-tra-cuu` | 1, 3, 4, 5, 8, 9, 10 |
| Bảng nguồn nội dung dùng chung | `packages/db/src/nguon-tro-choi.ts` | Mọi trò |
| Gói offline, chấm lại khi đồng bộ, chống trùng `client_id` | `game_packs`, `lib/offline/tro-choi.ts`, `tro-choi.offline.tsx` | Trò có cờ offline |
| Hồ sơ điểm mạnh/yếu theo chủ đề | `topic_stats`, `ho-so-chu-de.ts` | Mọi trò có `topic_id` |
| Lớp hiệu ứng, âm thanh, rung, pháo hoa theo hướng A | `components/tro-choi/hieu-ung/`, `lib/hieu-ung.ts` | Mọi trò |
| Chấm từ nhật ký thao tác, kiểm mốc thời gian, chế độ từng bước | `tro-choi/cung-duong-bien-bao.ts`, `DuongChay.tsx` | Mẫu cho §2.3 |
| Hình xe nhìn ngang | `XeQuaChot.tsx` | Trò 1, 4 |
| Chấm biểu mẫu: hành vi, khung tiền, hình thức bổ sung | `tro-choi/lap-bien-ban.ts` (dở dang) | "Biên bản" của trò 1, 4, 5, 9, 10 |
| XP theo đơn vị theo tuần, chốt tuần 06:00 thứ Hai; điểm theo quân số, trần mỗi người, đơn vị dưới 3 người không xếp hạng, lên/xuống hạng | `packages/dao-tao/src/mua-giai.ts` (luật thuần), `packages/db/src/mua-giai.ts`, `xp_ledger.unit_id`. Mùa giải đơn vị xong phần mã ngày 27/9/2026 (luu-tru/PLAN_TRO_CHOI_CU.md GĐ-G6) | Trò 7 |
| 31 biển báo demo có phản ứng đúng | `data/bien-bao/bien-bao.json` | Trò 3, 9 |

Các trò của danh sách cũ (Trắc nghiệm nhanh, Súng bắn tốc độ, Cung đường biển báo…) xử lý theo PRD §V.4 và câu D1 ở §8.

**Mùa giải đơn vị (danh sách cũ, đã xong phần mã):** giao diện ở tab "Mùa giải" của `/bang-xep-hang` (`components/tro-choi/BangMuaGiai.tsx`). **Hình cần bổ sung: không.** Thang hạng, vạch lên hạng và dấu "Lên hạng / Giữ hạng / Xuống hạng" dựng bằng CSS và token hướng A; huy hiệu `len_hang_mua_giai` dùng biểu tượng cúp chung như mọi huy hiệu. Nếu muốn: một biểu tượng huy hiệu riêng (SVG một màu, 24×24, theo bộ `Icon`).

### 2.2. Ba kiểu trò

| Kiểu | Trò | Người chơi gửi gì | Máy chủ chấm thế nào |
|---|---|---|---|
| **Quyết định theo bước** | 1, 2, 7, 11, 12, 13, 14, 19, 20 | Mỗi bước một quyết định có cấu trúc (đóng dấu + lý do; mật mã; lệnh xây; vùng khoanh; danh mục) | `chamBuoc` như GĐ-G0 |
| **Chuỗi thao tác** | 4, 10, 18 | Danh sách thao tác theo thứ tự, có thời gian (chạm, kéo, giữ) | Chạy lại chuỗi thao tác qua máy trạng thái của trò |
| **Mô phỏng thời gian thực** | 3 (lúc chạy thử), 5, 6, 8, 9, 15, 16, 17 | Nhật ký thao tác kèm mốc thời gian | Chạy lại bộ mô phỏng tất định với cùng seed và cùng nhật ký (§2.3) |

Trò 20 chấm bằng mô hình thống kê tất định (không có xe chạy), xếp vào kiểu "quyết định theo bước" (§5.20).

### 2.3. Chấm lại bằng cách chạy lại mô phỏng

Mở rộng cách Cung đường biển báo đã làm, thành quy tắc chung cho trò mô phỏng:

- **Bộ mô phỏng là mã TypeScript thuần** trong `packages/dao-tao`, chạy được ở máy chủ (Bun) và trình duyệt, không chạm DOM.
- **Tất định:** bước thời gian cố định (đề xuất 50 ms, tức 20 nhịp/giây cho logic; hình vẽ nội suy giữa các nhịp để vẫn mượt 60 khung hình/giây). Số ngẫu nhiên lấy từ bộ sinh có seed của khung. **Không dùng `Math.sin`, `Math.cos`, `Math.atan2`, `Math.random`, `Date.now()` trong logic**: các hàm lượng giác có thể lệch bit giữa các bộ máy JavaScript. Dùng bảng tra góc cố định hoặc hướng rời rạc (8 hoặc 16 hướng), tọa độ số nguyên đơn vị cm.
- **Nhật ký thao tác** ghi theo số nhịp, không theo mili giây: `{ nhip, thao_tac, tham_so }`. Mili giây thật chỉ dùng để kiểm gian lận (§1.2).
- **Máy chủ chạy lại** bộ mô phỏng từ ảnh chụp đề và nhật ký, tính điểm, bỏ qua mọi kết quả máy khách gửi. Test bắt buộc: cùng đề, cùng nhật ký thì máy chủ và máy khách ra cùng trạng thái cuối (so băm trạng thái).
- **Giới hạn:** nhật ký tối đa 2.000 thao tác mỗi bước; lượt tối đa 5 phút mô phỏng; chạy lại một lượt ở máy chủ dưới 200 ms.

### 2.4. Màn chơi và độ khó

- Mỗi trò có **màn chơi đánh số**. Màn 1 luôn là màn làm quen, không tính giờ hoặc tính giờ rộng. Qua màn (đạt từ 1 sao) thì mở màn sau. Không có màn nào khóa vì thiếu XP.
- Tiến độ màn lưu theo người và trò. Đề xuất tách thành bảng `game_level_progress(account_id, game_code, level, best_stars, best_score, plays, cleared_at)` trong mô-đun M8 (§4). Tên `game_levels` đã dùng cho màn của trò Vượt màn (GĐ10).
- Màn chơi và thông số độ khó (số xe, thời gian, loại lỗi xuất hiện) nằm ở `games.config`, sửa được mà không cần sửa mã.
- XP cơ bản tăng theo màn (đề xuất: màn 1 bằng 10, mỗi màn sau thêm 2), vẫn qua bậc giảm dần khi chơi lặp của `xp.ts`.

### 2.5. Dữ liệu mới dùng chung

Ngoài `game_content` đã có, các trò mới cần thêm các bảng **dữ liệu nghiệp vụ có duyệt** (cùng vòng đời như mức phạt, biển báo):

| Bảng | Nội dung | Dùng cho | Nguồn căn cứ phải tra |
|---|---|---|---|
| `document_rules` | Giấy tờ phải có theo loại xe; hạng giấy phép lái xe ứng với loại xe; thời hạn; các trường phải khớp | 1, 4 | Luật Trật tự, an toàn giao thông đường bộ và văn bản hướng dẫn về giấy phép lái xe, đăng ký xe; văn bản về bảo hiểm bắt buộc trách nhiệm dân sự của chủ xe cơ giới. **Chưa có trong kho đang nối** |
| `procedures` (mở rộng) | Thêm bước có **thao tác** (`thao_tac`: vuốt, chạm, kéo, giữ), điều kiện, bước bắt buộc | 4 | Văn bản quy định quy trình tuần tra, kiểm soát, xử lý vi phạm của Cảnh sát giao thông; văn bản về kiểm tra nồng độ cồn. **Chưa có trong kho đang nối** |
| `hand_signals` | Hiệu lệnh của người điều khiển giao thông: tư thế, ý nghĩa với từng hướng, cử chỉ vuốt tương ứng | 8 | Luật Trật tự, an toàn giao thông đường bộ; QCVN 41:2024/BGTVT. **Chưa có trong kho đang nối** |
| `incident_types` | Loại sự việc, mức ưu tiên, loại tổ công tác phù hợp, thời gian xử lý | 6 | Chủ yếu là **tài liệu nghiệp vụ do đơn vị cung cấp**, có thể không có trong văn bản công khai |
| `document_rules` (mở rộng; D16 đã chọn, nhóm `ho_so_phat_nguoi` đã làm ở GĐ-T11) | Thêm nhóm luật `ho_so_phat_nguoi` (điều kiện để hồ sơ camera đủ căn cứ) và `van_tai_khach` (lệnh vận chuyển, phù hiệu, thời gian lái, cách tính số người) cùng các kiểu kiểm mới | 11, 13 | Văn bản về sử dụng dữ liệu từ thiết bị kỹ thuật nghiệp vụ; văn bản về kinh doanh vận tải hành khách. **Chưa có trong kho đang nối** (câu D16) |
| `load_limits` (mới; D17 đã chọn, đã làm ở GĐ-T12) | Giới hạn tải trọng trục, cụm trục, tổng trọng lượng theo loại xe và số trục | 12 | Văn bản về tải trọng, khổ giới hạn của xe và giấy phép lưu hành xe quá tải. **Chưa có trong kho đang nối** (câu D17) |
| `violations` (thêm cột, đề xuất) | `qua_tai_tu`, `qua_tai_den` (%) cho khung phạt chở hàng vượt khối lượng, cùng cách `speed_over_min/max` | 12 | Nghị định xử phạt vi phạm hành chính về giao thông đường bộ. **Chưa có trong kho đang nối** |
| `procedures` (dùng lại dạng mở rộng của T4) | Quy trình "Bảo vệ hiện trường, cấp cứu" và "Tạm giữ phương tiện", bước có `tro_choi`, tham số thời hạn | 18, 19 | Văn bản về trách nhiệm khi xảy ra tai nạn, tạm giữ phương tiện theo thủ tục hành chính; phần thứ tự nghiệp vụ là tài liệu của đơn vị. **Chưa có trong kho đang nối** |

Không bảng nào chép mức phạt: nội dung trỏ tới `violations` bằng mã và qua `refs` có phiên bản.

---

## 3. Quy trình duyệt nội dung trò chơi

Giữ nguyên quy trình của GĐ-G0 (bản cũ §3), tóm tắt:

- Vòng đời `nhap → cho_duyet → da_duyet → luu_tru`, từ chối có lý do; sửa bản đã duyệt thì về `cho_duyet`, tăng phiên bản. Hàm chung ở `vong-doi-duyet.ts`.
- `bien_tap` soạn, gửi duyệt; vai trò duyệt đọc từ `NGAN_HANG_VAI_TRO_DUYET` (mặc định `phap_che`). Lịch sử ở `content_reviews`.
- Nội dung đã duyệt phải có ít nhất một URN; `scripts/check-citations.ts` kiểm URN của `game_content` và các bảng dữ liệu nghiệp vụ mới.
- Duyệt ghi lại mã và phiên bản của mọi mục được trỏ tới; mục đó đổi thì nội dung tự rút khỏi trò và hiện ở "Cần xem lại".
- Màn soạn có nút **"Chơi thử"** dựng đúng giao diện trò từ bản nháp, không ghi lượt chơi. Với trò mô phỏng, "Chơi thử" chạy được cả phần mô phỏng.
- **Trình soạn riêng cho từng trò** (thay trình soạn JSON mặc định) đăng ký theo mã trò. Trò có sơ đồ (3, 6, 10) soạn bằng lưới ô, không kéo thả tự do ở bản đầu.
- Bộ kiểm hợp lệ của từng trò là hàm thuần, chạy khi lưu và khi duyệt; báo lỗi chỉ đúng phần tử (ô, xe, bước).
- **AI không sinh nội dung trong lúc chơi.** Nếu sau này dùng AI soạn nháp thì kết quả vào `cho_duyet` như GĐ8.

---

## 4. Mô-đun dùng chung giữa các trò

### 4.1. Danh sách

| # | Mô-đun | Việc | Dùng cho trò | Tạo ở | Vị trí đề xuất |
|---|---|---|---|---|---|
| M1 | **Bộ giấy tờ** | Sinh giấy phép lái xe, đăng ký xe, giấy chứng nhận bảo hiểm từ seed với lỗi cố ý; bộ luật kiểm giấy tờ đọc từ `document_rules`; hiển thị giấy tờ dạng thẻ phóng to được | 1, 4, 12, 13, 14, 19 | T1; mở rộng ở T11 (bộ kiểm luật nhận nhóm `ho_so_phat_nguoi`: `NHOM_LUAT`, `KIEU_KIEM_PHAT_NGUOI`, `choThieuCuaLuat`; đã làm 28/9/2026), T12 (giấy chứng nhận kiểm định, phiếu cân, giấy phép lưu hành xe quá tải: kiểu `GiayKiemDinh`, `PhieuCan`, `GiayPhepLuuHanh`, `kiemTraGiayToXeTai`, thẻ dùng chung `TheGiayToChung`; tách khỏi `LoaiGiayTo` của trò 1; đã làm 28/9/2026), T13 (lệnh vận chuyển, phù hiệu, dữ liệu giám sát hành trình: `LenhVanChuyen`, `PhuHieu`, `GiamSatHanhTrinh`, `kiemTraGiayToVanTai`; nhóm luật `van_tai_khach`: `KIEU_KIEM_VAN_TAI`, `PHAN_VAN_TAI`, `LOI_VAN_TAI`, `loiVanTaiCuaLuat`, kiểm tham số ngưỡng; không sửa `GiayTo.tsx`; đã làm 28/9/2026), T14 (thông số kỹ thuật trên giấy chứng nhận kiểm định do T12 tạo: trường tùy chọn `thong_so` kiểu `ThongSoKyThuat`, `DONG_THONG_SO`, `kiemTraThongSoKyThuat`; không sửa `GiayTo.tsx`; đã làm 29/9/2026. Bộ dựng hình xe từ tham số `tro-choi/hinh-xe-tham-so.ts` T19 dùng lại) | `packages/dao-tao/src/tro-choi/chung/giay-to.ts`, `components/tro-choi/chung/GiayTo.tsx` |
| M2 | **Tương tác chạm, kéo, giữ, vuốt** | Hook nhận dạng cử chỉ trên Pointer Events: kéo thả vào ô (có đường thay thế chạm-chạm và bàn phím), giữ có vòng tiến độ, vuốt theo 8 hướng, đóng dấu. Ghi mỗi thao tác vào nhật ký theo định dạng §2.3 | 1, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 15, 16, 18, 19 | T1 (đóng dấu, chạm), mở rộng ở T3 (kéo thả), T4 (giữ, vuốt), T5 (khoanh vùng), T12 (đóng dấu nhận danh sách lựa chọn và nhãn do trò truyền vào: `NutDongDau` nhận `luaChon`, `nhac`; `DauMoc` nhận `nhan`, `mau`; không truyền thì giữ hai dấu của trò 1; đã làm 28/9/2026). Các cử chỉ khác đã có đủ (`KeoTha`, `Giu`, `Vuot`, `KhoanhVung`) | `components/tro-choi/chung/tuong-tac/` |
| M3 | **Màn hướng dẫn và kết quả có căn cứ** | Thẻ hướng dẫn 3 bước, nhớ đã xem; danh sách lỗi sai "đã làm / đúng ra / vì sao / căn cứ" nối vào `TongKetLuot` | Mọi trò | T1 | `components/tro-choi/chung/HuongDan.tsx`, `DanhSachLoi.tsx` |
| M4 | **Biên bản cuối lượt** | Từ danh sách mã lỗi phát hiện được, dựng "biên bản" gồm hành vi, căn cứ, khung tiền phạt, hình thức bổ sung lấy từ `violations` đã duyệt tại ngày chơi. Tách phần tra từ `lap-bien-ban.ts` | 1, 4, 5, 9, 10, 11, 12, 13, 14, 19 | T1; mở rộng ở T19 (loại "biên bản tạm giữ": danh mục đồ vật, tình trạng, niêm phong, thời hạn, nơi giữ) | `packages/dao-tao/src/tro-choi/chung/bien-ban.ts`, `components/tro-choi/chung/BienBan.tsx` |
| M5 | **Bộ mô phỏng giao thông** | Mạng đường dạng lưới làn (đoạn thẳng, giao lộ, vạch, đèn, biển, vị trí đặt biển), xe đi theo làn, bám xe trước, dừng đèn đỏ, phản ứng theo biển, người đi bộ, va chạm theo hộp bao; tất định theo §2.3; mỗi nhịp phát sự kiện (`vuot_den_do`, `qua_toc_do`, `va_cham`, `khong_nhuong_duong`…) | 3, 5, 8, 9, 10, 15, 16, 17, 20¹ (6 dùng phần bản đồ) | T3 (đoạn đường, biển, xe tự chạy; theo yêu cầu 27/9/2026 thêm luôn rẽ theo lộ trình qua nhiều làn, giảm tốc trước khúc ngoặt, va chạm theo hộp bao); mở rộng ở T5 (nhiều xe, sự kiện vi phạm), T8 (giao lộ, ưu tiên), T9 (xe người lái), T10 (tệp mới `va-cham.ts`: xe đặt tự do theo tâm, hành động đi thẳng, phanh, rẽ, chuyển làn; vết phanh theo bảng mặt đường; va chạm dính, xoay 45° khi đâm ngang, trượt, vị trí cuối; không sửa vòng bước cũ; đã làm 30/9/2026), T15 (vật cản tạm `vat-can.ts`: xe sang làn tránh khi đủ chỗ, không thì dừng chờ, sự kiện `chuyen_lan`; tầm nhìn đêm `tam-nhin.ts` theo đèn pha, đèn cảnh báo và đoạn khuất cong, dốc, tra bảng; vùng nguy hiểm quanh người, sự kiện `vao_vung_nguy_hiem`; `doHangCho`; xe vào giữa làn `s_vao`; sửa lỗi hai xe cùng làn vào đường cùng một nhịp; mọi phần tùy chọn, cấu hình cũ chạy y như cũ; đã làm 29/9/2026), T16 (lưu lượng theo giờ, đo ùn theo đoạn) | `packages/dao-tao/src/mo-phong/` |
| M6 | **Bộ vẽ cảnh từ trên xuống** | Vẽ trạng thái của M5 lên Canvas 2D: đường, vạch, xe, biển, đèn, camera; nội suy giữa các nhịp; giới hạn 2× điểm ảnh; tạm dừng khi tab ẩn; chế độ từng bước. Tách từ cách làm của `DuongChay.tsx` | 3, 5, 6, 8, 9, 10, 15, 16, 17 (18 nếu cần xe chạy) | T3; T15 thêm tệp mới `lib/ve-canh/ve-chot.ts` (đường đêm, vật của chốt), không sửa tệp M6 cũ; T10 thêm `lib/ve-canh/ve-tai-dung.ts` (sơ đồ hiện trường, dấu vết) | `components/tro-choi/chung/CanhTrenXuong.tsx`, `lib/ve-canh/` |
| M7 | **Nhật ký thao tác và chấm lại** | Định dạng nhật ký, bộ ghi phía máy khách, kiểm mốc thời gian phía máy chủ, hàm "chạy lại rồi chấm" dùng chung, băm trạng thái cuối để test | 3, 4, 5, 6, 8, 9, 10, 15, 16, 17, 18, 20 | T3 | `packages/dao-tao/src/tro-choi/chung/nhat-ky.ts` |
| M8 | **Màn chơi và độ khó** | Đọc màn từ `games.config`, mở màn sau khi đạt 1 sao, bảng `game_level_progress`, màn chọn màn | Mọi trò | T1 | `packages/dao-tao/src/tro-choi/chung/man-choi.ts`, `packages/db/src/man-choi.ts`, `components/tro-choi/chung/ChonMan.tsx` |
| M9 | **Bản đồ khu phố dạng ô** | Lưới ô (đường, nhà, trường học, chợ, giao lộ), đặt vật thể vào ô, kiểm luật đặt, đường đi ngắn nhất trên lưới | 6, 7, 16, 17, 20 (9 dùng làm bản đồ phố) | **T17** (câu D22, 30/9/2026: GĐ-T6, GĐ-T16 chưa làm nên tạo ngay ở GĐ-T17): bản đồ viết bằng dòng ký tự (`=` đường, `#` nhà, `T` trường học, `C` chợ, `*` cây, `.` đất trống), ô `o_m` mét (10–500), giao lộ suy từ số ô đường kề, `kiemTraDatVat` (loại ô, chỉ giao lộ, chung ô, khoảng cách tối thiểu), đường ngắn nhất 4 hướng tất định (`khoangCachTu`, `duongNganNhat`); `BanDoO.tsx` vẽ SVG, chạm ô, phím mũi tên và Enter. T6, T16 dùng lại; mở rộng ở T20 (lớp dữ liệu tai nạn, lớp nhiệt, mô hình số vụ 12 tháng) | `packages/dao-tao/src/ban-do/`, `components/tro-choi/chung/BanDoO.tsx` |

¹ Bảng tóm tắt ở `PROMPT_TRO_CHOI_MOI.md` ghi trò 20 dùng M5 để "chạy nhanh 12 tháng theo mẫu thống kê". M5 mô phỏng từng xe theo nhịp 50 ms, không có mô hình thống kê. Đề xuất đặt mô hình số vụ 12 tháng ở phần mở rộng M9 của T20 và không dùng M5 (câu D31).

Trò 2 không dùng mô-đun mô phỏng; phần riêng lớn nhất của trò 2 là liên kết sâu tới tra cứu và thư viện văn bản. Nếu sau này có trò khác cần mở văn bản ở đúng điều khoản thì tách phần này thành mô-đun.

### 4.2. Quy tắc làm mô-đun

- Mô-đun được tạo **ở giai đoạn của trò đầu tiên cần nó** (cột "Tạo ở"), chỉ với phần trò đó dùng. Các phần "mở rộng ở" được ghi sẵn trong kế hoạch của giai đoạn tương ứng, nên coi như đã được đồng ý. Mọi sửa đổi khác với mô-đun đã có thì hỏi trước (§1.7).
- Mô-đun logic (M1, M4, M5, M7, M8, M9) không phụ thuộc React hay CSDL, có unit test riêng, và có ít nhất một test "máy chủ và máy khách cho cùng kết quả".
- Mô-đun giao diện (M2, M3, M6) có trang trình diễn ở `/game-style-demo`, chạy cả chế độ giảm chuyển động.
- Mở rộng mô-đun không được làm hỏng trò đã xong: test của mọi trò trước phải vẫn đạt.

### 4.3. Hệ quả của thứ tự 1 → 10

- Bộ mô phỏng M5 xuất hiện ở trò 3 nhưng phải chịu được trò 9 và 10. Vì vậy ở T3 thiết kế đủ **kiểu dữ liệu** cho xe có hướng, tốc độ, làn và sự kiện, dù T3 chỉ dùng xe chạy thẳng theo làn.
- Trò 7 (Thành phố an toàn) đứng giữa danh sách nhưng lấy điểm từ **mọi trò**. Làm ở T7 thì mới có điểm từ trò 1–6; trò 8–10 tự vào sau vì trò 7 đọc `xp_ledger`, không đọc từng trò.

### 4.4. Hệ quả của thứ tự làm T11–T20

Thứ tự đề xuất ở `PROMPT_TRO_CHOI_MOI.md` mục 0: T11 → T12 → T14 → T13 → T19 → T18 → T15 → T16 → T17 → T20.

- **T12 trước T14:** T12 tạo loại giấy "giấy chứng nhận kiểm định" trong M1; T14 chỉ thêm trường thông số kỹ thuật vào cùng loại giấy, không tạo loại thứ hai.
- **T14 trước T19:** hình xe dựng từ tham số (nhìn nghiêng, nhìn sau) của T14 được T19 dùng lại cho bước kiểm đếm. Hình xe này là tệp của trò T14; T19 dùng lại thì chuyển sang `components/tro-choi/chung/` và hỏi trước (§1.7).
- **T16 là trò mới đầu tiên cần M9.** GĐ-T6 (tạo M9) chưa làm. Tới T16 mà T6 vẫn chưa làm thì theo quy tắc 11 của Phần chung (câu D22). *Thực tế: GĐ-T17 làm trước GĐ-T16 và đã tạo M9 (30/9/2026); GĐ-T6, GĐ-T16 dùng lại, sửa M9 thì hỏi trước.*
- **T13, T12, T19 cùng mở rộng M1 hoặc M4.** Không chạy hai phiên song song trên cùng mô-đun (GĐ-T1 đã gặp lỗi typecheck do phiên GĐ-T4 chạy cùng lúc).
- **T15, T16 cùng mở rộng M5.** Mọi test M5 của trò 3, 5, 9 (và 8, 10 nếu đã làm) phải vẫn đạt sau mỗi lần mở rộng.

---

## 5. Từng trò chơi

Độ khó triển khai: **Thấp** (dưới 1 tuần một người), **Trung bình** (1–2 tuần), **Cao** (trên 2 tuần hoặc có rủi ro kỹ thuật). Tính khi các mô-đun ở §4 đã có tới giai đoạn đó.

### 5.1. Kiểm tra giấy tờ

**Luật chơi**
- Người chơi đứng ở chốt. Từng người lái tới, đưa giấy tờ: giấy phép lái xe, giấy đăng ký xe, giấy chứng nhận bảo hiểm bắt buộc. Xe hiện ở cạnh, có biển số và loại xe.
- Người chơi mở từng giấy, phóng to, đối chiếu với nhau và với xe. Chạm vào **chỗ không khớp** để đánh dấu (ví dụ biển số trên đăng ký khác biển số trên xe).
- Đóng dấu **"Cho qua"** hoặc **"Giữ lại"**. Giữ lại thì phải có ít nhất một chỗ đã đánh dấu làm lý do.
- Một ca trực có giờ; hết giờ thì người lái còn lại trong hàng tính là chưa kiểm.

**Màn chơi và độ khó**

| Màn | Nội dung | Số người lái | Giờ ca |
|---|---|---|---|
| 1 | Chỉ giấy phép lái xe: có hay không, còn hạn không | 4 | Không tính giờ |
| 2 | Thêm đăng ký xe: biển số, loại xe khớp với xe | 6 | 120 giây |
| 3 | Thêm bảo hiểm: còn hạn, đúng xe | 7 | 120 giây |
| 4 | Hạng giấy phép lái xe phải phù hợp loại xe | 8 | 120 giây |
| 5 | Lỗi khó thấy: ngày hết hạn trùng hôm nay, tên chủ xe khác người lái (không phải lỗi), giấy tờ điện tử (nếu D4 cho phép) | 8 | 100 giây |

**Chấm điểm**
- Quyết định đúng: +10. Giữ lại đúng mà lý do đúng: thêm +5 cho mỗi chỗ không khớp đánh dấu đúng.
- Giữ lại người có giấy tờ hợp lệ: −10 (lỗi nặng hơn cho qua nhầm, để không khuyến khích giữ lại cho chắc). Cho qua người vi phạm: 0. Đánh dấu nhầm chỗ khớp: −2. Điểm ca không âm.
- Tỷ lệ = điểm / điểm tối đa của ca. Màn kết quả: từng người lái, giấy tờ nào sai, sai gì, căn cứ, và **biên bản** (M4) cho người bị giữ lại đúng.

**Dữ liệu cần**
- `document_rules` (§2.5), có duyệt: loại giấy tờ theo loại xe, hạng giấy phép theo loại xe, trường phải khớp, cách tính hạn. Người lái và giấy tờ **sinh từ seed** bằng M1, đáp án suy ra từ luật đã duyệt. Tổ hợp thiếu luật đã duyệt thì không sinh.
- Mã `violations` cho từng loại lỗi giấy tờ (để dựng biên bản). Chỉ dùng dòng đã duyệt, còn hiệu lực tại ngày chơi.
- Tên người, địa chỉ, biển số trong trò là **dữ liệu giả rõ ràng** (biển số theo mẫu nhưng dãy số trò chơi), không trùng người thật.

**Offline:** Có. Gói gồm hồ sơ, luật giấy tờ theo loại xe và mức phạt liên quan. Với 30 hồ sơ mẫu: khoảng 132 KB chưa nén, 7,6 KB sau gzip (luật lặp lại ở mỗi hồ sơ).

**Độ khó triển khai: Trung bình.** Phần tốn công là bộ sinh giấy tờ có lỗi cố ý mà vẫn hợp lý, và giao diện soi giấy tờ trên màn 360px.

**Đã làm (GĐ-T1, 27/9/2026).** Luật và số liệu đã chốt khi làm:
- **Chấm:** mỗi người lái 20 điểm.
  - Quyết định đúng: 10 điểm.
  - Người có lỗi, giữ lại: thêm tối đa 10 điểm theo tỷ lệ lỗi đã chỉ ra, trừ 2 điểm mỗi chi tiết đánh dấu nhầm; phần này không âm.
  - Người hợp lệ, cho qua: đủ 20 điểm. Giữ lại người hợp lệ: 0 điểm, không phải −10 như đề xuất ban đầu, vì khung chung không cho điểm bước âm (câu D5).
  - Một chi tiết có thể chỉ ra nhiều lỗi, ví dụ biển số trên xe chỉ ra được cả lỗi biển số của đăng ký và của bảo hiểm.
  - "Giữ lại" chỉ bấm được khi đã đánh dấu ít nhất một chi tiết; máy chủ cũng từ chối (400).
- **Màn:** mỗi màn 8 người lái, ít nhất 2 người hợp lệ và 3 người có lỗi, ưu tiên hồ sơ của đúng màn.
  - Giờ cả ca: màn 1 không tính giờ; màn 2, 3: 4 phút; màn 4: 3 phút 30 giây; màn 5: 3 phút.
  - XP cơ bản: 10, 12, 14, 16, 18.
  - Qua màn khi đạt từ 1 sao.
  - Giấy tờ được xem: màn 1 chỉ giấy phép lái xe; màn 2 thêm đăng ký xe; từ màn 3 đủ ba giấy.
- **Dữ liệu:**
  - Luật giấy tờ ở bảng `document_rules`, duyệt ở `/quan-tri/du-lieu-tra-cuu` (tab Luật giấy tờ). Mỗi luật là một phép kiểm thuộc 5 kiểu: phải có, còn hạn, khớp với xe, đúng người, hạng giấy phép.
  - Hồ sơ là nội dung soạn sẵn có duyệt (`game_content`): chỉ dữ kiện, kèm màn và danh sách lỗi người soạn dự kiến. Đáp án suy ra từ luật đã duyệt lúc chơi. Hồ sơ mà luật đã duyệt cho kết quả khác dự kiến, hoặc thiếu luật cho màn đang chơi, không vào lượt.
  - 30 hồ sơ mẫu sinh bằng hàm dùng chung `sinhHoSo` (`scripts/sinh-ho-so-giay-to.ts`), ở `data/tro-choi/kiem-tra-giay-to.json`. Tất định theo seed.
  - Chủ xe trong hồ sơ mẫu luôn là người lái: trò không dạy trường hợp lái xe của người khác vì chưa có căn cứ đã đối chiếu.
- **Giao diện:**
  - Thẻ giấy tờ giản lược, có chữ chìm "MẪU TRÒ CHƠI"; chạm để phóng to, chạm dòng để đánh dấu.
  - Đóng dấu là nộp: dấu đập xuống, giấy tờ trượt ra khỏi bàn rồi mới gửi. Sau khi chấm, giấy tờ trượt lại vào bàn để xem chỗ sai; dấu thu về góc.
  - Giảm chuyển động: không trượt, không đập dấu, gửi ngay.
- **Offline:** chơi được các màn đang mở lúc tải gói; máy chủ kiểm lại màn theo tiến độ hiện tại khi đồng bộ.

**Dữ liệu demo, chưa duyệt.** 12 luật ở `data/tra-cuu/luat-giay-to.json` và 30 hồ sơ.
- Luật soạn khi kho văn bản chưa có văn bản gốc; căn cứ mới ghi ở mức văn bản.
- Chưa luật nào có mã mức phạt, nên biên bản ghi "Chưa có mức phạt đã duyệt".

**Cần đơn vị chuyên môn kiểm tra trước khi duyệt dữ liệu của trò này:**

| # | Nội dung | Ở đâu | Vì sao cần kiểm |
|---|---|---|---|
| 1 | Danh mục giấy tờ người lái phải mang theo, với ô tô và xe mô tô. Ô tô còn giấy chứng nhận kiểm định, trò chưa đưa vào | Luật `gt-phai-co-*` | Soạn khi kho chưa có Luật số 36/2024/QH15; căn cứ mới ở mức văn bản |
| 2 | Hạng giấy phép theo loại xe: A1 cho mô tô đến 125 cm³, A cho mô tô trên 125 cm³, B cho ô tô chở người đến 8 chỗ; hạng cao hơn có được lái xe hạng B không | Luật `gt-hang-*` | Soạn theo hiểu biết của người soạn, chưa đối chiếu |
| 3 | Giấy phép hạng A1, A không thời hạn; giấy phép có thời hạn còn giá trị trong chính ngày ghi "có giá trị đến" | Luật `gt-gplx-con-han`, hồ sơ mẫu | Trò đang tính như vậy |
| 4 | Thời hạn bảo hiểm tính thế nào (ngày bắt đầu, ngày kết thúc); văn bản bảo hiểm bắt buộc đang hiệu lực (dự kiến Nghị định số 67/2023/NĐ-CP) | Luật `gt-bao-hiem-*` | Chưa có văn bản trong kho |
| 5 | Giấy tờ điện tử, bản sao có chứng thực thay giấy đăng ký (xe thế chấp) có được chấp nhận không | Luật `gt-phai-co-dang-ky`, `gt-phai-co-bao-hiem` | Trò chưa có trường hợp này (câu D4) |
| 6 | Đặc điểm xe khác giấy đăng ký (nhãn hiệu) xử lý thế nào | Luật `gt-dang-ky-khop-nhan-hieu` | Chưa có căn cứ |
| 7 | Cách đối chiếu nhân thân người lái với giấy phép (căn cước, ứng dụng định danh) | Luật `gt-gplx-dung-nguoi` | Trò dùng lời tự giới thiệu của người lái |
| 8 | Mức phạt của từng lỗi giấy tờ | Bảng mức phạt, trường `ma_muc_phat` của luật | Bảng mức phạt chưa có dòng nào cho lỗi giấy tờ |
| 9 | Mọi lời giải thích của luật (hiện cho người chơi sau khi chấm) | Trường `giai_thich` | Người soạn viết, chưa duyệt |

**Hình cần bổ sung** (hiện dùng hình tự vẽ trong `components/tro-choi/chung/GiayTo.tsx`, `KiemTraGiayTo.tsx`):

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Thẻ giấy phép lái xe, giấy đăng ký xe, giấy bảo hiểm | Thẻ bo góc, dải màu đầu thẻ, chữ chìm "MẪU TRÒ CHƠI" | Giản lược, không quốc huy, không hoa văn phôi thật; SVG nền ≤ 8 KB mỗi loại; đọc rõ chữ 16px ở bề rộng 360px |
| Ảnh chân dung trên giấy phép | Hình khối người chung | Hình khối trung tính, không mặt chi tiết; có thể thêm vài biến thể để phân biệt người |
| Người lái đứng cạnh xe | Không có; chỉ có bong bóng lời nói | Tùy chọn: bóng dáng nửa người, không mặt chi tiết |
| Xe mô tô, ô tô con nhìn ngang | Nét đơn giản (như Súng bắn tốc độ) | SVG ≤ 8 KB, có biến thể màu theo hồ sơ |
| Biển số gắn trên xe | Khung chữ viền đen | Tùy chọn: dáng biển số thật, không ghi dãy số thật |
| Con dấu "Cho qua", "Giữ lại" | Chữ in hoa trong viền đôi, xoay nghiêng | Tùy chọn: dấu tròn hoặc chữ nhật có vân mực; không dùng biểu tượng ngành |

### 5.2. Phòng thoát hiểm pháp luật

**Luật chơi**
- Một "khu" gồm 3–5 phòng. Mỗi phòng có một câu đố dẫn tới một **mật mã** (số hoặc chữ ngắn) và một ổ khóa.
- Mật mã tìm được bằng **công cụ tra cứu và thư viện văn bản của hệ thống**: nút "Mở tra cứu" mở tra cứu nhanh, tìm kiếm văn bản hoặc đọc văn bản trong một ngăn phủ, không rời trò. Ví dụ câu đố: "Mật mã là số Điều quy định về …" hoặc "Mật mã là mức phạt tối đa (triệu đồng) của hành vi … với xe mô tô".
- Nhập mật mã vào ổ khóa. Sai thì ổ khóa rung, được thử lại; mỗi phòng có 1 gợi ý mở dần (gợi ý 1: dùng công cụ nào; gợi ý 2: từ khóa nên tìm).
- Mở phòng cuối là thoát.

**Màn chơi và độ khó**

| Màn | Nội dung | Số phòng | Giờ khu |
|---|---|---|---|
| 1 | Mỗi câu đố chỉ rõ công cụ và từ khóa; mật mã là một con số trên màn kết quả tra cứu | 3 | Không tính giờ |
| 2 | Chỉ nói công cụ, không nói từ khóa | 3 | 10 phút |
| 3 | Phải đọc văn bản tới đúng khoản, điểm | 4 | 10 phút |
| 4 | Mật mã ghép từ hai lần tra (ví dụ số Điều + số khoản) | 4 | 12 phút |
| 5 | Câu đố về hiệu lực: tra tại một ngày trong quá khứ, hoặc văn bản đã được sửa đổi | 5 | 15 phút |

**Chấm điểm**
- Mở một phòng: +20. Mỗi gợi ý đã mở: −5. Mỗi lần nhập sai sau lần thứ 3 ở cùng phòng: −2 (tránh đoán mò). Điểm phòng không âm.
- Máy chủ so mật mã (đã chuẩn hóa: bỏ khoảng trắng, dấu chấm phân cách nghìn). Mật mã không bao giờ gửi xuống máy khách. **Giới hạn 10 lần nhập mỗi phòng**, chống dò.
- Màn kết quả: mỗi phòng có đường tra đúng (công cụ, từ khóa, điều khoản) và nút mở thẳng điều khoản.

**Dữ liệu cần**
- `game_content` loại `phong_thoat_hiem`: câu đố, gợi ý, công cụ, **URN của điều khoản chứa đáp án**, ngày tra (nếu có), mật mã.
- **Mật mã phải suy được từ dữ liệu trong hệ thống.** Khi duyệt, bộ kiểm mở URN tại ngày tra và kiểm con số có mặt trong nội dung điều khoản (hoặc trong dòng mức phạt đã duyệt được trỏ tới). Văn bản được sửa đổi làm đổi nội dung thì câu đố tự rút khỏi trò (tham chiếu có phiên bản, GĐ-G0).
- Câu đố dùng mức phạt thì trỏ tới `violations` bằng mã, không chép số tiền.

**Offline:** Không ở bản đầu. Thư viện văn bản và tìm kiếm cần mạng. Có thể làm sau: khu chỉ dùng tra cứu nhanh, kèm dữ liệu tra cứu trong gói (câu D6).

**Cần đơn vị chuyên môn kiểm tra:** từng câu đố có dạy đúng cách tra không; câu đố hiệu lực có đúng mốc không. Trò này **phụ thuộc hoàn toàn vào văn bản có trong kho**: với kho đang nối (2 văn bản thử), chỉ soạn được câu đố demo trên văn bản thử.

**Hình cần bổ sung:** cửa phòng, ổ khóa số, bảng câu đố, tủ hồ sơ (vector phẳng). Không cần hình động phức tạp.

**Độ khó triển khai: Trung bình.** Mã đơn giản; phần tốn công là mở tra cứu trong ngăn phủ mà vẫn giữ lượt chơi (và đồng hồ) khi chuyển qua lại, và bộ kiểm mật mã có trong điều khoản.

### 5.3. Cắm biển cho tuyến đường

**Luật chơi**
- Màn hình là một đoạn đường nhìn từ trên xuống, có các đặc điểm: trường học, đường cong, giao với đường sắt, cầu hẹp, khu dân cư… Dọc đường có các **vị trí cắm biển** (ô trống).
- Khay biển ở đáy màn có các biển được phép dùng (gồm cả biển nhiễu). Kéo biển vào vị trí (hoặc chạm biển rồi chạm vị trí).
- Bấm **"Cho xe chạy thử"**: xe mô phỏng (M5) chạy qua đoạn đường và phản ứng theo biển đã cắm. Chỗ thiếu biển hoặc sai biển thì xe gặp tình huống nguy hiểm (phanh gấp, suýt va chạm), có đánh dấu trên đường.
- Được chỉnh và chạy thử lại tối đa 3 lần; lần chạy cuối là lần chấm.

**Màn chơi và độ khó**

| Màn | Nội dung | Số vị trí | Biển trong khay |
|---|---|---|---|
| 1 | Một nguy hiểm, một vị trí, 3 biển | 1 | 3 |
| 2 | Đoạn thẳng có trường học và đường người đi bộ | 3 | 6 |
| 3 | Đường cong, dốc, cầu hẹp | 4 | 8 |
| 4 | Có giao lộ, thêm biển hiệu lệnh và biển cấm | 5 | 10 |
| 5 | Vị trí có thể đặt nhiều biển trên một cột; có vị trí nên để trống | 6 | 12 |

**Chấm điểm**
- Mỗi vị trí: biển đúng +10; biển "chấp nhận được" (người soạn khai báo) +5; để trống vị trí cần biển 0; biển sai −5. Vị trí nên để trống mà cắm biển: −3 (thừa biển cũng là lỗi).
- Số lần chạy thử không trừ điểm, nhưng chỉ lần chạy cuối được chấm.
- Máy chủ chấm từ **bố trí cuối cùng**, không từ hoạt cảnh; hoạt cảnh chỉ để minh họa và được máy chủ chạy lại để lấy danh sách "tình huống nguy hiểm" hiện ở màn kết quả.
- Màn kết quả: từng vị trí, biển đúng, lý do, căn cứ (QCVN 41).

**Dữ liệu cần**
- `game_content` loại `cam_bien`: bố cục đoạn đường theo lưới ô (M5), danh sách vị trí, với mỗi vị trí: biển đúng, biển chấp nhận được, hoặc "nên để trống"; biển trong khay; `refs` tới `traffic_signs`.
- Biển báo đã duyệt ở `traffic_signs` (dùng lại dữ liệu và ảnh của GĐ12, GĐ-G8).
- **Chỉ chấm "biển nào ở chỗ nào"**, không chấm khoảng cách đặt biển tính bằng mét, trừ khi đơn vị chuyên môn cung cấp quy tắc từ QCVN 41:2024.

**Offline:** Có. Ảnh biển do service worker giữ (như Cung đường biển báo).

**Đã làm (GĐ-T3, 27/9/2026)**
- Đề gửi kèm `phan_ung` của từng biển trong khay (đánh đổi theo §1.2): điện thoại chạy thử ngay bằng cùng bộ mô phỏng M5, không chờ máy chủ. Người chơi biết biển nào làm xe giảm tốc, dừng, hay không vào được, nhưng không biết biển nào đúng ở vị trí nào. Đề không có biển đúng, biển chấp nhận được, lý do.
- Người chơi gửi nhật ký (M7): đặt biển, gỡ biển, chạy thử, theo nhịp. Máy chủ dựng lại bố trí lúc chạy thử lần cuối (chưa chạy lần nào thì bố trí lúc nộp), chấm bố trí đó, rồi chạy lại mô phỏng để lấy tình huống nguy hiểm. Chạy thử quá 3 lần, đổi bố trí sau lần cuối, thao tác không hợp lệ, hoặc mốc thời gian sai: cả bước 0 điểm.
- Hoạt cảnh chạy thử chỉ minh họa: xe phản ứng theo `phan_ung` của biển; mỗi đặc điểm có một **tốc độ an toàn là thông số mô phỏng** (không phải tốc độ theo quy định). Không có biển báo trước thì xe chỉ thấy nguy hiểm khi còn 12 m nên phải phanh gấp. Vì vậy một biển sai nhưng cũng làm xe giảm tốc (ví dụ "Tốc độ tối đa" trước trường học) vẫn cho hoạt cảnh an toàn; điểm và màn kết quả vẫn báo đúng sai theo đáp án.
- Kéo thả dùng lại `useKeoTha` do GĐ-T4 tạo sớm (có chạm-chạm và bàn phím), không sửa.
- Tra kho văn bản ngày 27/9/2026: kho chỉ có 2 văn bản thử (Nghị định 100/2026/NĐ-CP, 150/2027/NĐ-CP); **QCVN 41:2024/BGTVT chưa có trong kho**. Biển dùng URN cả văn bản QCVN 41, không có điều khoản cụ thể.

**Cần đơn vị chuyên môn kiểm tra**

| Nội dung | Ở đâu | Vì sao |
|---|---|---|
| Biển đúng cho từng loại đặc điểm (trường học, người đi bộ sang đường, ngoặt trái, đường hẹp trái, đường sắt có/không rào chắn, công trường, nơi giao nhau với đường ưu tiên, vòng xuyến, bến xe buýt) | `data/tro-choi/cam-bien.json`, 6 đoạn CB-01 đến CB-06 | Hệ thống tự soạn, chưa đối chiếu QCVN 41:2024/BGTVT; QCVN 41 chưa có trong kho |
| Biển "chấp nhận được" (W.245a "Đi chậm" thay biển ngoặt, công trường; P.127 "Tốc độ tối đa" ở trường học) và vị trí nên để trống (CB-06 v2, v5) | Cùng tệp | Là phán đoán nghiệp vụ, không có trong văn bản đã tra |
| Hai biển trên một cột (CB-06 v1: W.225 và W.224) | Cùng tệp | Chưa rõ QCVN 41:2024 quy định thứ tự, số biển trên một cột thế nào |
| Chỗ đặt biển nguy hiểm so với chỗ nguy hiểm ("đặt trước", không tính mét); I.423b đặt tại chỗ sang đường, W.224 đặt trước | Lý do trong tệp; trò không chấm khoảng cách | Khoảng cách đặt biển theo QCVN 41 chưa đối chiếu |
| Mã, tên, ảnh, phản ứng của 30 biển | `data/bien-bao/bien-bao.json` | Bản demo theo QCVN 41:2019, chưa cập nhật bản 2024; phản ứng là dữ liệu demo của GĐ-G8 |
| Tốc độ an toàn của từng đặc điểm trong mô phỏng | `packages/dao-tao/src/mo-phong/duong.ts` `TOC_DO_AN_TOAN` | Thông số mô phỏng cho hoạt cảnh; nếu đơn vị muốn dùng tốc độ theo quy định thì cần căn cứ |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Mặt đường từ trên xuống, vạch giữa, lề cỏ | Vẽ Canvas: khối màu và vạch đứt | SVG hoặc bộ mảnh ghép lặp theo ô, ≤ 10 KB, rộng 360 px |
| Trường học, bến xe buýt | Vẽ Canvas: nhà mái dốc có cờ; khối chữ nhật | SVG một màu theo hướng A, 32×32 |
| Chỗ người đi bộ sang đường, đường sắt (có/không rào), công trường, vòng xuyến, nơi giao nhau, đường hẹp, chỗ ngoặt | Vẽ Canvas đơn giản (sọc, ray, nón, vòng tròn, mũi tên cong) | SVG theo ô 10 m, nhìn từ trên xuống, ≤ 4 KB mỗi hình |
| Xe con, xe tải, xe máy nhìn từ trên xuống | Chữ nhật bo góc có kính, đèn phanh | SVG 16×28 đến 20×40 px, không logo |
| Ảnh biển chính thức theo QCVN 41:2024 | Ảnh tự vẽ theo bản 2019 (GĐ12) | SVG ≤ 20 KB mỗi biển (bảng kiểm GĐ12) |

**Độ khó triển khai: Cao.** Đây là giai đoạn tạo M5, M6, M7 (phần đầu), và trình soạn đoạn đường theo lưới ô.

**Giải thích khi chạy thử (27/9/2026):** mỗi chỗ xe xử lý sai (phanh gấp, lao nhanh vào chỗ nguy hiểm, bị biển cấm chặn, dừng vô cớ) có một dòng "Vì sao": chưa có biển báo trước, biển đã cắm không báo giảm tốc (tên biển, vị trí), biển đặt sau chỗ nguy hiểm, biển cấm chặn đường, biển dừng lại ở chỗ không cần dừng. Chỉ dựa trên đặc điểm đường và biển người chơi đã cắm, không nói biển nào đúng; biển đúng và lý do chỉ hiện ở màn kết quả. Cần đơn vị chuyên môn xem lại câu chữ các lời giải thích này cùng lúc với bảng biển đúng.

### 5.4. Dừng xe đúng quy trình

**Luật chơi**
- Người chơi thực hiện lần lượt các thao tác của một lần dừng xe kiểm tra, mỗi thao tác là một cử chỉ:
  - **vuốt** để ra hiệu lệnh dừng xe;
  - **chạm** vị trí dừng an toàn cho xe;
  - **chạm** các lời thoại ngắn khi tiếp xúc (thông báo lý do, yêu cầu xuất trình);
  - **kéo** giấy tờ vào khay để kiểm (dùng M1, rút gọn);
  - **giữ** nút để thực hiện đo nồng độ cồn, đọc kết quả trên máy đo;
  - **kéo** kết quả vào đúng hướng xử lý (cho đi, lập biên bản, tạm giữ phương tiện…).
- Thứ tự thao tác do người chơi chọn; thao tác sai thứ tự hoặc thiếu thì bị ghi lỗi.
- Tình huống có diễn biến: người lái không dừng, người lái không hợp tác, máy đo báo có nồng độ cồn.

**Màn chơi và độ khó**

| Màn | Nội dung |
|---|---|
| 1 | Dừng xe và kiểm giấy tờ, có mũi tên gợi ý thao tác tiếp theo |
| 2 | Bỏ gợi ý; thêm vị trí dừng an toàn (có vị trí nguy hiểm để chọn nhầm) |
| 3 | Thêm đo nồng độ cồn, kết quả âm tính |
| 4 | Kết quả dương tính: phải xác định mức và hướng xử lý |
| 5 | Diễn biến bất ngờ (người lái xin bỏ qua, xe không dừng), có giờ cho mỗi thao tác |

**Chấm điểm**
- Máy chủ chạy lại chuỗi thao tác qua **máy trạng thái của quy trình** (đọc từ `procedures` mở rộng). Mỗi bước bắt buộc làm đúng +10; sai thứ tự −3; thiếu bước bắt buộc 0 và ghi lỗi; thao tác **không an toàn** (chọn vị trí dừng nguy hiểm, đứng giữa làn xe) −10.
- Đo nồng độ cồn: giữ đủ thời gian quy định thì mới có kết quả; thả sớm thì phải đo lại (không trừ điểm lần đầu, trừ −2 từ lần thứ hai).
- Hướng xử lý đúng: +10, kèm **biên bản** (M4) khi có vi phạm.

**Dữ liệu cần**
- `procedures` mở rộng (§2.5): các bước có thao tác, bước bắt buộc, điều kiện rẽ nhánh (kết quả đo, người lái hợp tác hay không). Nội dung **lấy từ văn bản quy trình đã có trong kho**; phần tác phong, lời thoại mà văn bản không ghi thì đánh dấu "tài liệu nghiệp vụ do đơn vị cung cấp".
- `game_content` loại `dung_xe`: tình huống (người lái, xe, diễn biến, giấy tờ sinh bằng M1, kết quả đo), trỏ tới quy trình và mức phạt.
- Thông số máy đo (thời gian thổi, ngưỡng, đơn vị đo) **không tự đặt**: lấy từ văn bản; chưa có thì màn 3–5 dùng số trong tình huống demo, ghi rõ "chưa đối chiếu".

**Offline:** Có.

**Đã làm (GĐ-T4, 27/9/2026):** quy trình "[Demo] Dừng xe kiểm tra" (`dung-xe-kiem-tra`) ở `data/tra-cuu/quy-trinh.json`, mỗi bước có phần `tro_choi` (loại bước, cử chỉ, bắt buộc, điều kiện, nguồn). Mã (`tro-choi/dung-xe.ts`) chỉ biết cách chạy 9 loại bước; thứ tự, bước bắt buộc, điều kiện nằm ở dữ liệu. 5 tình huống mẫu ở `data/tro-choi/dung-xe.json`, giấy tờ sinh bằng `sinhHoSo` của trò 1: hợp tác DX-01, DX-02, DX-04; không hợp tác DX-03 (đòi biết lý do mới đưa giấy tờ), DX-05 (không dừng ở hiệu lệnh đầu, xin bỏ qua, không chịu thổi).

**Diễn biến khi sai thứ tự hoặc bỏ bước** (quy ước trò chơi, không phải quy định): thao tác khi xe chưa dừng thì không có tác dụng; tiếp xúc khi xe còn đỗ giữa làn thì suýt va chạm (−10); đề nghị xuất trình trước khi nói lý do thì người lái bức xúc, người lái "đòi biết lý do" không đưa giấy tờ; không từ chối lời xin bỏ qua thì người lái nài nỉ ở mọi thao tác sau; kết luận khi chưa kiểm giấy tờ hoặc chưa đo cồn thì diễn biến nói rõ hậu quả. Mức căng thẳng 0–3 chỉ để kể, không vào điểm.

**Đánh đổi dữ kiện gửi xuống điện thoại:** điện thoại phải dựng diễn biến ngay nên nhận phản ứng của người lái, giấy tờ và số đo trên máy đo. Không gửi: thứ tự quy trình (trừ màn 1, có mũi tên gợi ý), vị trí nào an toàn (chọn chỗ nguy hiểm chỉ lộ ra ở màn kết quả), giấy tờ nào sai, hướng xử lý đúng. Gói offline mang cả đáp án như mọi trò offline khác.

**Cần đơn vị chuyên môn kiểm tra.** Tra kho ngày 27/9/2026 (kho chỉ có Nghị định số 100/2026/NĐ-CP và 150/2027/NĐ-CP, là văn bản thử): **không bước nào có căn cứ**. Mọi bước để `can_cu = null`, `nguon = chua_co_can_cu`; màn kết quả ghi "Căn cứ đang được cập nhật". Các văn bản đã thử tra mà chưa có trong kho: Luật số 36/2024/QH15, Thông tư số 32/2023/TT-BCA (và Thông tư số 73/2024/TT-BCA sửa đổi), Nghị định số 168/2024/NĐ-CP.

| # | Điểm cần trả lời | Đang dùng trong trò | Ở đâu |
|---|---|---|---|
| 1 | Ra hiệu lệnh dừng xe: cách ra hiệu lệnh, khi nào được dừng xe | Bước 1 "Ra hiệu lệnh dừng xe"; vuốt lên là quy ước trò chơi | `quy-trinh.json` bước 1 |
| 2 | Tiêu chí vị trí dừng an toàn (khúc cua, cầu hẹp, miệng ngã ba là không an toàn?) | Bước 2; mỗi tình huống khai vị trí an toàn | bước 2; `vi_tri_an_toan` DX-02…05 |
| 3 | Chào, thông báo lý do trước khi đề nghị xuất trình: có phải thứ tự bắt buộc? Lời nói, tác phong | Bước 3 trước bước 4; lời thoại soạn tạm | bước 3, 4; `LOI_THOAI` trong `dung-xe.ts` |
| 4 | Lý do dừng xe "theo kế hoạch" có đúng cách nói không | `ly_do_dung` của từng tình huống | `dung-xe.json` |
| 5 | Người lái xin bỏ qua (có lời lẽ mua chuộc): chỉ từ chối, hay phải lập biên bản riêng | Bước "Từ chối đề nghị bỏ qua", không biên bản riêng | bước 5; DX-05 |
| 6 | Người lái không dừng ở hiệu lệnh đầu: chỉ ra hiệu lệnh lại, hay ghi nhận hành vi không chấp hành hiệu lệnh | Chỉ ra hiệu lệnh lại, không tính vi phạm | DX-05 |
| 7 | Trình tự kiểm tra nồng độ cồn; thời gian thổi của máy đo; đơn vị hiển thị | Giữ nút 5 giây (số của tình huống demo), đơn vị mg/L khí thở | bước 8; `do_con.giu_ms` |
| 8 | Người lái lúc đầu không chịu thổi rồi chấp hành: có tính "không chấp hành yêu cầu kiểm tra" không | Không tính | bước 7; DX-05 |
| 9 | Thứ tự kiểm giấy tờ và đo cồn (trước/sau) | Kiểm giấy tờ trước, đo cồn sau | bước 6, 8 |
| 10 | Mức 0,30 và 0,45 mg/L khí thở thuộc khung nào | Trỏ `oto-con-muc-2`, `mt-con-muc-3` (bảng mức phạt còn là bản nháp) | DX-04, DX-05 |
| 11 | Khi nào tạm giữ phương tiện (nồng độ cồn, thiếu giấy đăng ký…) | DX-04, DX-05 "Lập biên bản, tạm giữ phương tiện"; DX-02 (bảo hiểm hết hạn) chỉ lập biên bản | `huong_xu_ly` |
| 12 | Kết quả đo 0 thì kết luận thế nào, có cần ghi nhận gì | Cho đi | DX-03 |
| 13 | Các lỗi giấy tờ và mức phạt | Dùng luật giấy tờ của trò 1 (bảng ở §5.1) | `luat-giay-to.json` |

Nếu thứ tự hoặc bước là tài liệu nghiệp vụ nội bộ, đổi `nguon` của bước sang `tai_lieu_nghiep_vu`; có điều khoản trong kho thì ghi `can_cu` và đổi `nguon` sang `van_ban` (bộ kiểm bắt buộc bước `van_ban` phải có căn cứ).

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Cảnh bên đường nhìn ngang (mặt đường, lề, vạch) | SVG khối đơn giản vẽ trong `DungXe.tsx` | SVG ≤ 8 KB, 320×120, hai chủ đề sáng/tối |
| Cán bộ nhìn từ sau lưng hoặc bóng dáng, cầm gậy chỉ huy | Bóng dáng khối 3 hình | SVG, không phù hiệu, cấp hiệu, quân hiệu |
| Xe mô tô, ô tô nhìn ngang | Biểu tượng emoji trên nền màu | Dùng lại hình xe của `XeQuaChot`, hoặc SVG ≤ 4 KB mỗi xe |
| Máy đo nồng độ cồn | Nút giữ có thanh tiến độ, không hình máy | SVG hình khối chung, không theo mẫu máy thật, ≤ 4 KB |
| Các vị trí dừng (khúc cua, cầu hẹp, bãi đất, ngã ba) | Chỉ có chữ | Biểu tượng SVG 48×48 mỗi loại |
| Hình động nhỏ cho 3 thẻ hướng dẫn | Chưa có (thẻ chỉ có chữ) | SVG/CSS ≤ 6 KB, có bản tĩnh khi giảm chuyển động |

**Độ khó triển khai: Trung bình.** Phần tốn công là máy trạng thái quy trình có rẽ nhánh, và cử chỉ giữ, vuốt dùng tốt bằng một tay (M2).

### 5.5. Soi camera

**Luật chơi**
- Màn hình là một camera giao thông nhìn chéo từ trên cao (vẽ bằng M6 từ M5). Hoạt cảnh 20–40 giây: nhiều xe đi qua giao lộ hoặc đoạn đường.
- Khi thấy vi phạm, bấm **"Dừng hình"**. Hình dừng lại, người chơi **khoanh vùng** xe vi phạm bằng ngón tay (vẽ vòng hoặc kéo khung), rồi **kéo thẻ lỗi** (vượt đèn đỏ, đi sai làn, không đội mũ bảo hiểm…) vào vùng đã khoanh.
- Bấm "Tiếp tục" để xem tiếp. Mỗi đoạn có 1–4 vi phạm. Có thanh tua lại 5 giây (tối đa 3 lần).

**Màn chơi và độ khó**

| Màn | Nội dung | Xe cùng lúc | Tốc độ phát |
|---|---|---|---|
| 1 | Một vi phạm rõ, ít xe | 3–4 | 0,75× |
| 2 | Hai vi phạm, đèn tín hiệu | 5–6 | 1× |
| 3 | Vi phạm làn đường, dừng đỗ sai | 8 | 1× |
| 4 | Xe che nhau, vi phạm chỉ thấy trong 1–2 giây | 10 | 1× |
| 5 | Ban đêm (tương phản thấp nhưng vẫn đạt 3:1), có tình huống giống vi phạm mà không phải | 12 | 1,25× |

**Chấm điểm**
- Máy chủ chạy lại hoạt cảnh từ seed và bố trí của đoạn phim, biết chính xác vị trí từng xe ở từng nhịp.
- Dừng hình **trong cửa sổ vi phạm** (từ lúc vi phạm bắt đầu tới 2 giây sau): +5. Vùng khoanh trùm xe vi phạm (tỷ lệ phủ hộp bao ≥ 50%, không trùm quá 2 xe khác): +5. Thẻ lỗi đúng: +10.
- Khoanh xe không vi phạm: −5. Bỏ sót vi phạm: 0, liệt kê ở màn kết quả với đoạn phát lại đúng lúc vi phạm.
- Màn kết quả: mỗi vi phạm có ảnh dừng hình đúng lúc, xe được tô, lỗi, căn cứ, và biên bản (M4).

**Dữ liệu cần**
- `game_content` loại `soi_camera`: bố cục đường (M5), kịch bản xe (điểm xuất phát, lộ trình, hành vi, nhịp bắt đầu vi phạm), mã `violations` của từng vi phạm.
- **Đánh đổi bảo mật:** máy khách phải có đủ kịch bản để vẽ hoạt cảnh, nên người biết lập trình đọc được xe nào vi phạm. Giảm bằng cách: kịch bản gửi dạng lộ trình, không có cờ "vi phạm"; nhãn lỗi và cửa sổ vi phạm chỉ có ở máy chủ. Điểm XP vẫn bị giới hạn theo số lượt trong ngày.

**Offline:** Có.

**Đã làm (GĐ-T5, 27/9/2026)**
- Hoạt cảnh không dùng video: điện thoại và máy chủ cùng chạy bộ mô phỏng M5 từ **kịch bản xe** (dữ liệu: loại xe, làn, giây vào, tốc độ, có đội mũ bảo hiểm không, có dừng theo đèn không, dừng lại ở đâu bao lâu). Đoạn đường cố định: 4 làn hai chiều (làn trong cho ô tô, làn ngoài cho xe máy), đèn tín hiệu ở chỗ người đi bộ sang đường, vùng cấm dừng khai theo mét.
- **Vi phạm lấy từ mô phỏng, không ghi trong kịch bản**: qua vạch lúc đèn đỏ, xe vào làn không dành cho loại xe đó, dừng trong vùng cấm dừng, xe máy không đội mũ bảo hiểm. Đáp án người soạn khai phải khớp đúng những gì mô phỏng thấy; trình soạn tự lấy danh sách này, người soạn chỉ chọn mã mức phạt và viết mô tả.
- Đánh đổi (§1.2): đề gửi kịch bản xe, gồm hành vi "không dừng theo đèn" và "không đội mũ" (điện thoại cần để dựng hoạt cảnh; mũ bảo hiểm là thứ nhìn thấy được). Đề không có loại lỗi, cửa sổ vi phạm, mã mức phạt, mô tả.
- Cửa sổ vi phạm: vượt đèn đỏ từ lúc qua vạch tới 2 giây sau; vi phạm kéo dài (sai làn, không mũ, dừng sai) từ lúc thấy được tới hết vi phạm cộng 2 giây, trong phạm vi xe còn hiện trên camera. Đây là cách hiểu của nhóm phát triển cho các vi phạm kéo dài; bản thiết kế chỉ nêu "từ lúc bắt đầu tới 2 giây sau".
- Khoanh vùng: kéo khung, vẽ vòng (quy về hộp bao), chạm vào xe, hoặc chọn xe bằng bàn phím. Chạm hay bàn phím cho khung vừa khít xe; đó là đường thay thế bắt buộc (§1.4), nên điểm khoanh không phân biệt được người khoanh khéo.
- Vùng khoanh trùm quá 2 xe khác: không tính cho vi phạm đó, không trừ. Vùng không trùm xe vi phạm nào: −5. Tua lại lần thứ 4 và vùng khoanh khi phim không dừng bị bỏ qua, không làm hỏng cả nhật ký.
- Hiệu ứng riêng: khung camera có chấm REC, dấu giờ chạy theo phim, nhiễu hạt nhẹ (giảm hiệu ứng: nhiễu đứng yên); tua lại chạy lùi nhanh có vạch quét; màn kết quả "Tua lại xem chậm" chạy lùi rồi phát chậm một nửa qua lúc vi phạm, xe được tô đỏ nhấp nháy.
- Màn 5 ban đêm: mặt đường tối, xe có viền sáng và quầng đèn pha; tương phản xe và vạch kẻ với mặt đường tính theo màu đều trên 3:1 (chưa đo bằng công cụ trên ảnh chụp).
- Hình xe (06/10/2026): ảnh WebP trong `apps/web/app/assets/tro-choi/soi-camera/` (ngày, đêm, đầu đèn tín hiệu), kéo vừa hình bao của xe nên khung tô và vùng chạm không đổi; xe đi ngược hướng ảnh thì xoay 180°; màu xe cố định theo ảnh. Xe ưu tiên chưa có ảnh, vẫn vẽ vector. Kịch bản khai thêm **kiểu xe** (`kieu`: ô tô con, ô tô lớn, taxi, bán tải thuộc `o_to`; xe tải nhỏ, xe tải, xe buýt, xe khách thuộc `xe_tai`) với kích thước thật; bộ mô phỏng nhận kích thước riêng qua `kich_thuoc` của xe (mở rộng M5, đã hỏi theo §1.7). Không khai kiểu thì dùng ô tô con, xe tải, đúng kích thước cũ.
- Tra kho văn bản ngày 27/9/2026 (vượt đèn đỏ, mũ bảo hiểm, làn đường, dừng đỗ): không có kết quả; **Nghị định số 168/2024/NĐ-CP chưa có trong kho**. Căn cứ chỉ lấy từ dòng mức phạt đã duyệt; vi phạm không có dòng mức phạt thì ghi "Căn cứ đang được cập nhật".

**Cần đơn vị chuyên môn kiểm tra**

| Nội dung | Ở đâu | Vì sao |
|---|---|---|
| Qua vạch dừng khi đèn đỏ là vi phạm; qua vạch khi đèn vàng mà không kịp dừng thì không (SC-08, xe x03) | `mo-phong.ts` (luật dừng đèn), `data/tro-choi/soi-camera.json` | Hành vi với đèn vàng là nghiệp vụ, chưa đối chiếu văn bản |
| Ô tô đi làn xe máy, xe máy đi làn ô tô là "đi sai làn" | SC-05, SC-06, SC-08 | Chưa có dòng mức phạt; chưa đối chiếu quy định về làn đường và vạch kẻ |
| Dừng trong đoạn vạch vàng cấm dừng là "dừng xe sai nơi quy định"; dừng ngoài đoạn đó thì không (SC-06 x5, SC-08 x03) | SC-05, SC-06, SC-08 | Chưa có dòng mức phạt; ký hiệu vùng cấm dừng là hình minh họa, không theo mẫu vạch thật |
| Mã mức phạt: `oto-den-do`, `mt-den-do`, `mt-mu-bao-hiem` | Đáp án các kịch bản | Bản nháp theo Nghị định 168/2024/NĐ-CP, chưa đối chiếu, văn bản chưa có trong kho |
| Cửa sổ vi phạm cho vi phạm kéo dài (xem trên) | `soi-camera.ts` `phatHienViPham` | Cách hiểu của nhóm phát triển |
| Tên bốn thẻ lỗi | `soi-camera.ts` `TEN_VI_PHAM` | Tên gọi trong trò; hành vi pháp lý đầy đủ lấy từ dòng mức phạt đã duyệt |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Xe nhìn từ trên cao, góc chéo (ô tô con, xe tải, xe máy có người lái đội / không đội mũ) | Vẽ Canvas: hình chữ nhật theo kích thước thật, đầu người lái là chấm tròn | SVG một màu theo hướng A, nhìn chéo đúng góc camera, ≤ 3 KB mỗi hình |
| Đèn tín hiệu, cột đèn | Vẽ Canvas: hộp đen ba bóng | SVG 12×34 px |
| Mặt đường 4 làn, vạch dừng, vạch người đi bộ, vạch vàng cấm dừng | Vẽ Canvas: khối màu và vạch | Theo ký hiệu vạch kẻ đường thật (cần đơn vị chuyên môn chỉ mẫu) |
| Khung camera (viền, dấu giờ, REC) | Viền CSS và chữ đơn cách | Không cần thêm |

**Độ khó triển khai: Cao.** Hoạt cảnh nhiều xe mượt trên máy tầm trung, cử chỉ khoanh vùng chính xác trên màn nhỏ, trình soạn kịch bản xe.

### 5.6. Điều phối ca trực

**Luật chơi**
- Bản đồ khu vực dạng ô (M9) có các tổ công tác (biểu tượng có số hiệu, loại tổ). Sự việc xuất hiện theo thời gian (tai nạn, ùn tắc, vi phạm, hỗ trợ người dân), mỗi sự việc có mức độ và đồng hồ chờ.
- Người chơi **kéo tổ công tác tới sự việc**. Tổ di chuyển theo đường trên lưới, tới nơi thì xử lý trong một khoảng thời gian rồi rảnh lại.
- Sự việc chờ quá hạn thì **leo thang** (ùn tắc lan rộng, mức độ tăng).
- Một ca 3–5 phút mô phỏng.

**Màn chơi và độ khó**

| Màn | Nội dung | Tổ | Sự việc |
|---|---|---|---|
| 1 | Một loại sự việc, không leo thang | 2 | 4 |
| 2 | Hai mức ưu tiên | 3 | 6 |
| 3 | Loại tổ phải phù hợp loại sự việc | 3 | 8 |
| 4 | Sự việc leo thang; hai sự việc cùng lúc | 4 | 10 |
| 5 | Giờ cao điểm: đường bị ùn làm tổ đi chậm | 4 | 12 |

**Chấm điểm**
- Máy chủ chạy lại ca trực từ seed và nhật ký lệnh điều (M7).
- Mỗi sự việc xử lý xong: điểm cơ bản theo mức ưu tiên × hệ số thời gian đáp ứng (tới trong hạn: 1; trễ: giảm tuyến tính tới 0,3). Tổ không phù hợp: điểm × 0,5 và ghi lỗi.
- Để sự việc mức cao chờ trong khi điều tổ tới sự việc mức thấp hơn ở gần tương đương: ghi lỗi "sai thứ tự ưu tiên", −5.
- Màn kết quả: dòng thời gian ca trực, mỗi quyết định sai có lý do và nguồn quy tắc.

**Dữ liệu cần**
- `incident_types` (§2.5): loại sự việc, mức ưu tiên, loại tổ phù hợp, thời gian xử lý, quy tắc leo thang.
- `game_content` loại `ca_truc`: bản đồ, tổ ban đầu, lịch xuất hiện sự việc (hoặc tham số để sinh từ seed).
- **Nguồn quy tắc ưu tiên:** phần lớn là quy định, hướng dẫn nghiệp vụ nội bộ, không phải văn bản công khai. Chưa có tài liệu thì trò chỉ dùng quy tắc chung dễ kiểm (sự việc có người bị thương trước), đánh dấu "demo, chưa duyệt", và chờ D7.

**Offline:** Có.

**Cần đơn vị chuyên môn kiểm tra:** danh mục loại sự việc, thứ tự ưu tiên, loại tổ công tác, thời gian chuẩn. Tài liệu có được đưa lên máy chủ Internet không (như GAP 4.5-25).

**Hình cần bổ sung:** ô bản đồ (đường, nhà, trụ sở), biểu tượng tổ công tác (xe tuần tra dạng khối, không logo), biểu tượng loại sự việc.

**Độ khó triển khai: Trung bình.** Mô phỏng ở mức lưới ô nên nhẹ hơn M5; phần tốn công là cân chỉnh độ khó và nguồn quy tắc.

### 5.7. Thành phố an toàn

**Luật chơi**
- Mỗi đơn vị có một **khu phố chung** (M9), bắt đầu với chỉ số tai nạn cao và nhiều "điểm nóng" (giao lộ không đèn, trường học không có vạch qua đường, đoạn đường tối…).
- Mọi XP người chơi nhận được (từ mọi trò, luyện tập, thi, bài giảng) đồng thời tạo **điểm xây dựng** cho đơn vị.
- Thành viên dùng điểm của đơn vị để **đặt công trình an toàn** vào ô: đèn tín hiệu, vạch cho người đi bộ, biển báo, dải phân cách, chiếu sáng, camera, gờ giảm tốc… Mỗi công trình đặt đúng chỗ làm **chỉ số tai nạn giảm**; đặt sai chỗ không giảm (có giải thích vì sao).
- Khu phố hiện cho mọi thành viên; mỗi công trình ghi người đặt.

**Màn chơi và độ khó**
- "Màn" là **giai đoạn phát triển khu phố**: mở rộng khu phố (thêm dãy phố, khu chợ, khu công nghiệp) khi chỉ số tai nạn xuống dưới ngưỡng. Khu mới có điểm nóng khó hơn (giao lộ nhiều nhánh, đường sắt).
- 5 giai đoạn; mỗi giai đoạn mở thêm loại công trình.

**Chấm điểm**
- Không có lượt chơi riêng và không cộng XP (tránh vòng lặp XP sinh XP).
- **Điểm xây dựng tính ở máy chủ từ `xp_ledger` theo `unit_id`** (cột có sẵn từ GĐ-G0), chia theo quân số như Mùa giải, có trần mỗi người mỗi tuần để một người không gánh cả đơn vị.
- Lệnh đặt công trình gửi lên máy chủ; máy chủ kiểm quyền, kiểm đủ điểm, kiểm luật đặt, rồi tính lại chỉ số tai nạn. Máy khách không gửi điểm hay chỉ số.
- Đồng thời: hai người cùng đặt vào một ô hoặc cùng tiêu một khoản điểm thì chỉ lệnh đầu tiên được nhận (khóa theo phiên bản khu phố).
- Chỉ số tai nạn là **chỉ số trò chơi**, ghi rõ trên màn hình "chỉ số mô phỏng, không phải số liệu tai nạn thật".

**Dữ liệu cần**
- `game_content` loại `thanh_pho`: bản đồ từng giai đoạn, điểm nóng, công trình phù hợp với từng điểm nóng và mức giảm chỉ số, giải thích, căn cứ (QCVN 41 cho biển, vạch, đèn; văn bản về kết cấu hạ tầng giao thông cho phần khác nếu có trong kho).
- Bảng mới `unit_cities(unit_id, stage, version, state jsonb, points_spent, updated_at)` và `unit_city_builds(id, unit_id, account_id, item, cell, points, created_at)`.
- Phần tính điểm theo đơn vị dùng lại luật đã viết ở `mua-giai.ts` (quân số, trần, đơn vị dưới 3 người) nếu D2 chọn giữ Mùa giải làm nền.

**Offline:** Không. Khu phố là trạng thái chung của đơn vị. XP kiếm được khi offline vào điểm xây dựng khi đồng bộ.

**Cần đơn vị chuyên môn kiểm tra:** công trình nào phù hợp với điểm nóng nào; lời giải thích; ai trong đơn vị được đặt công trình (D8).

**Hình cần bổ sung:** ô khu phố (nhà, trường, chợ, công viên), các công trình an toàn nhìn từ trên xuống, dấu điểm nóng.

**Độ khó triển khai: Trung bình.** Không có mô phỏng thời gian thực; phần cần cẩn thận là trạng thái chung nhiều người cùng sửa, luật công bằng giữa đơn vị, và cân chỉ số.

### 5.8. Điều tiết giao lộ

**Luật chơi**
- Người chơi đứng giữa ngã tư (nhìn từ trên xuống). Xe dồn tới từ bốn hướng, có hàng chờ và đồng hồ bực bội của từng hướng.
- **Vuốt** để ra hiệu lệnh: mỗi kiểu vuốt ứng với một tư thế hiệu lệnh (ví dụ vuốt lên: giơ tay thẳng đứng; vuốt ngang: dang tay ngang). Hiệu lệnh cho hướng nào đi, hướng nào dừng theo đúng ý nghĩa trong văn bản.
- Xe (M5) chấp hành hiệu lệnh; ra hiệu lệnh gây xung đột thì xe phanh gấp hoặc va chạm nhẹ.
- Xe ưu tiên (có còi, đèn) xuất hiện: phải cho đi trước.

**Màn chơi và độ khó**

| Màn | Nội dung | Thời gian |
|---|---|---|
| 1 | Hai hướng, chỉ đi thẳng, một kiểu vuốt | 60 giây |
| 2 | Bốn hướng, hai kiểu vuốt | 90 giây |
| 3 | Xe rẽ trái, rẽ phải | 90 giây |
| 4 | Người đi bộ sang đường, xe ưu tiên | 120 giây |
| 5 | Giờ cao điểm, lưu lượng lệch giữa các hướng | 120 giây |

**Chấm điểm**
- Máy chủ chạy lại từ seed và nhật ký hiệu lệnh.
- Mỗi xe qua giao lộ an toàn: +1. Xung đột (phanh gấp): −5. Va chạm: −15. Xe ưu tiên phải chờ quá 3 giây: −10. Hàng chờ một hướng quá 12 xe: −1 mỗi giây.
- Hiệu lệnh sai nghĩa (vuốt không ứng với tư thế nào): không tính, không trừ, có nhắc.
- Màn kết quả: các lúc xung đột phát lại được, tư thế đúng lẽ ra phải dùng, căn cứ.

**Dữ liệu cần**
- `hand_signals` (§2.5), có duyệt: tư thế, ý nghĩa với người tham gia giao thông ở từng hướng, cử chỉ vuốt tương ứng, căn cứ.
- **Ý nghĩa hiệu lệnh lấy nguyên từ văn bản**, không suy diễn; cử chỉ vuốt chỉ là cách nhập của trò, phải ghi rõ ở màn hướng dẫn rằng đó là quy ước trò chơi.
- `game_content` loại `giao_lo`: dạng giao lộ, lưu lượng mỗi hướng, lịch xe ưu tiên, người đi bộ.

**Offline:** Có.

**Chế độ giảm chuyển động:** xe di chuyển theo bước (mỗi lần ra hiệu lệnh thì chạy 2 giây rồi dừng), không cuộn liên tục.

**Cần đơn vị chuyên môn kiểm tra:** tư thế và ý nghĩa từng hiệu lệnh; thứ tự nhường đường với xe ưu tiên; cách vuốt có dễ gây hiểu nhầm về tư thế thật không.

**Hình cần bổ sung:** người điều khiển giao thông nhìn từ trên xuống ở từng tư thế (bóng dáng, không phù hiệu), giao lộ, vạch người đi bộ, xe ưu tiên có đèn.

**Độ khó triển khai: Cao.** Mở rộng M5 cho giao lộ, xe rẽ, xung đột; nhận dạng vuốt đáng tin khi chơi nhanh.

### 5.9. Tự lái qua phố

**Luật chơi**
- Người chơi lái một xe (ô tô con hoặc xe mô tô, chọn đầu lượt) nhìn từ trên xuống, từ điểm A tới điểm B qua khu phố có đèn, biển, vạch, người đi bộ, xe khác (M5).
- Điều khiển bằng nút lớn: trái, phải, ga, phanh; xi nhan trái/phải. Có thể đổi sang nghiêng máy (tùy chọn, tắt mặc định).
- Game **ghi lỗi** khi lái: vượt đèn đỏ, quá tốc độ theo biển, đi sai làn, không nhường người đi bộ, rẽ không xi nhan, đi vào đường cấm, va chạm.
- Tới đích (hoặc hết giờ) thì game xuất **"biên bản"** liệt kê lỗi, thời điểm, căn cứ, mức phạt.

**Màn chơi và độ khó**

| Màn | Nội dung |
|---|---|
| 1 | Đường thẳng, một đèn tín hiệu, không xe khác |
| 2 | Thêm biển tốc độ, biển cấm rẽ |
| 3 | Xe khác, người đi bộ, vạch làn |
| 4 | Giao lộ không đèn, nhường đường theo quy tắc |
| 5 | Giờ cao điểm, đường một chiều, có tình huống bất ngờ (người đi bộ bước ra) |

**Chấm điểm**
- Máy chủ chạy lại từ seed và nhật ký điều khiển theo nhịp (M7). Đây là trò đòi hỏi tính tất định cao nhất (§2.3).
- Bắt đầu 100 điểm; mỗi lỗi trừ theo nhóm (nhẹ −5, vừa −10, nặng −20, va chạm −30); tới đích trong giờ +10 (không vượt 100). Không tới đích: tối đa 50.
- Biên bản (M4) dùng mã `violations` đã duyệt ứng với từng loại sự kiện của M5 và loại xe. Sự kiện chưa có mã mức phạt đã duyệt thì vẫn ghi lỗi, dòng mức phạt ghi "Chưa có mức phạt đã duyệt".
- Màn kết quả: bản đồ đường đã đi, chấm đỏ tại chỗ mắc lỗi, chạm vào để xem lại 3 giây trước lỗi.

**Dữ liệu cần**
- `game_content` loại `tu_lai`: bản đồ (M9 làm nền ô, M5 làm làn xe), đèn, biển, xe khác, người đi bộ, điểm A, B.
- Bảng ánh xạ **sự kiện mô phỏng → mã mức phạt theo loại xe**, có duyệt (một phần của `game_content` hoặc cấu hình trò; câu D9).
- Biển báo đã duyệt ở `traffic_signs`.

**Offline:** Có.

**Chế độ giảm chuyển động:** camera không bám xe (khung cố định theo đoạn), không lắc khi va chạm; tốc độ tối đa giảm 30% và không tính giờ.

**Cần đơn vị chuyên môn kiểm tra:** ánh xạ từng sự kiện sang hành vi vi phạm và mức phạt; quy tắc nhường đường ở giao lộ không đèn; tốc độ tối đa mặc định khi không có biển (bản cũ Q6, chưa có văn bản).

**Hình cần bổ sung:** xe người chơi từ trên xuống (có đèn phanh, xi nhan tách lớp), khu phố, người đi bộ, vạch làn, mũi tên chỉ hướng.

**Độ khó triển khai: Cao.** Điều khiển dễ chịu trên màn cảm ứng, tất định khi chạy lại, luật phát hiện lỗi không bắt nhầm (ví dụ chạm vạch dừng khi đèn vàng).

**Đã làm (GĐ-T9, 27/9/2026)**
- **Bản đồ là dữ liệu:** lưới ký tự, mỗi ô 10 m (`-` `|` đường hai chiều, `+` nơi giao nhau, `<` `>` `^` `v` đường một chiều, `.` `T` `C` `V` nhà, trường, chợ, công viên), kèm danh sách đèn, biển, vạch người đi bộ, người đi bộ, luồng xe. Thêm khu phố là thêm một nội dung `game_content` (`payload.kieu = "ban_do"`), không sửa mã. Bộ kiểm `kiemTraBanDo` chỉ đúng ô, biển, luồng xe sai; kiểm cả: lối vào đoạn cấm phải có biển P.102/P.101, tuyến xe khác không đi ngược chiều, và có đường đi đúng luật tới đích.
- **M9 chưa có** (thuộc GĐ-T6), nên lưới ô nằm ở `tro-choi/tu-lai-pho.ts`; khi làm T6 có thể chuyển phần lưới sang M9.
- **Xe khác dùng M5 của trò 3, không sửa M5.** Mỗi luồng xe là một làn M5 dựng từ tuyến ô (góc rẽ vát 45°). Trước mỗi nhịp M5, trò đặt trần tốc độ (`v_max`) từng xe để xe: dừng đèn đỏ (xe không kịp dừng khi đèn vàng được đi tiếp), dừng trước vạch có người đang sang, dừng trước vật cản ở làn khác (xe người chơi, xe luồng khác), chờ lượt vào nơi giao nhau (mỗi nơi giao nhau một xe tự chạy một lúc; nhường xe người chơi đang tới trong 15 m). Xe va chạm đứng 2 giây rồi được kéo khỏi đường. Đèn tính ở `mauDenPho` của trò (hai trục thay nhau xanh, có đỏ chung); `mo-phong/den.ts` của T5 đang làm dở nên chưa dùng.
- **Điều khiển "bám làn":**
  - Xe người chơi (`mo-phong/xe-nguoi-lai.ts`, M5 mở rộng) đi theo mốc 8 hướng.
  - Nút Trái/Phải: khi nơi giao nhau ở trong 3 ô phía trước là chọn hướng rẽ (chạm lại để bỏ); giữa phố là chuyển làn; đứng yên trên đường hai chiều thì nút Trái là quay đầu.
  - Ngã ba, ngõ cụt chưa chọn hướng thì xe dừng trước chỗ hết đường.
  - Xi nhan tự tắt khi xong rẽ, chuyển làn, quay đầu.
  - **Không làm điều khiển nghiêng máy (D13):** trái/phải là quyết định rời rạc, nghiêng máy không có nghĩa.
- **Nhật ký:** thao tác đầu `bat_dau` (loại xe, giảm chuyển động) ở nhịp 0; sau đó `ga`, `phanh` (bật/tắt), `lai`, `xi_nhan`, ghi theo số nhịp mô phỏng. Thao tác ở nhịp n áp trước bước n → n+1 ở cả điện thoại và máy chủ. Áp thao tác không đổi vị trí xe, nên nhịp cuối không lệch.
- **Luật bắt lỗi (quy ước trò chơi, cần đơn vị kiểm):**
  - Vượt đèn đỏ: đầu xe qua mép nơi giao nhau quá 0,5 m khi đèn đỏ; qua lúc vàng không tính.
  - Quá tốc độ: từ 5 km/h so với biển P.127, liên tục hơn 1 giây; một lần quá tốc độ ghi một lỗi, lấy tốc độ cao nhất. Biển hết hiệu lực ở nơi giao nhau kế tiếp; đoạn không có biển thì không bắt.
  - Đi sai phần đường: đường hai chiều, đầu xe lệch sang trái tim đường quá 0,5 m.
  - Không nhường người đi bộ: đầu xe vào dải vạch khi có người đang ở trên mặt đường trong vạch.
  - Chuyển hướng không xi nhan: lúc bắt đầu rẽ, chuyển làn, quay đầu mà xi nhan tắt hoặc sai bên.
  - Đi vào đường cấm: vào ô một chiều theo chiều ngược, hoặc ô đường cấm; một lần mỗi đoạn.
  - Rẽ nơi cấm rẽ: biển P.123a, P.123b, P.136 ở chiều đi vào nơi giao nhau.
  - Không nhường đường: vào nơi giao nhau không đèn khi xe khác đang ở trong đó.
  - Va chạm: hộp bao chồng nhau, xe người chơi dừng lại chỗ trước khi chạm.
- **Chấm:** như đề xuất. Nhóm lỗi: nhẹ 5 (xi nhan); vừa 10 (sai phần đường, quá tốc độ, rẽ cấm, không nhường đường); nặng 20 (vượt đèn đỏ, không nhường người đi bộ, vào đường cấm); va chạm 30. Khung phản hồi ghi "Đúng" khi đủ 100 điểm.
- **Bảng lỗi → mức phạt (D9):** là một nội dung có duyệt riêng (`payload.kieu = "anh_xa_loi"`), `refs` trỏ tới các dòng mức phạt. Chỉ duyệt được khi các dòng đó đã duyệt; sửa một dòng thì bảng rút khỏi trò. Không có bảng đã duyệt thì trò vẫn chơi được: biên bản dùng tên mặc định, "Chưa có mức phạt đã duyệt", "Căn cứ đang được cập nhật".
- **Màn:** 3 màn, mỗi màn gộp hai hàng của bảng trên: màn 1 (hàng 1–2), màn 2 (hàng 3), màn 3 (hàng 4–5). Khác kế hoạch (5 màn, 5 khu phố) vì yêu cầu làm 3 khu phố. Thêm màn 4–5 phải sửa `MAN_TU_LAI` và `SO_MAN_TU_LAI`.
- **Màn kết quả:** tóm tắt, bản đồ đường đã đi có chấm lỗi đánh số, biên bản (hành vi, lúc nào, đúng ra, giải thích, mức phạt, căn cứ, điểm trừ). Chạm chấm hoặc "Xem lại lúc…" thì chạy lại nhật ký trên điện thoại, phát từ 3 giây trước lỗi tới 1 giây sau.
- **Giảm chuyển động:** khung nhìn đứng yên theo nửa khung, tốc độ tối đa 70%, không tính giờ; xem lại là ảnh tĩnh, lùi/tới từng giây.
- **Offline:** có, như mọi trò mô phỏng; gói mang cả bảng lỗi và mức phạt.
- **Tra kho ngày 27/9/2026:** kho chỉ có Nghị định số 100/2026/NĐ-CP và 150/2027/NĐ-CP (văn bản thử); tìm "hiệu lệnh đèn tín hiệu", "nhường đường người đi bộ", "đi vào đường cấm" không có kết quả. Mọi `can_cu` của bảng lỗi để null.

**Dữ liệu demo, chưa duyệt:** `data/tro-choi/tu-lai.json`, gồm 3 khu phố KP-01 (màn 1), KP-02 (màn 2, 26 xe, 5 người đi bộ), KP-03 (màn 3, 34 xe, người đi bộ bước ra khi xe cách 20 m, bẫy đi ngược chiều) và bảng lỗi BL-01.

**Cần đơn vị chuyên môn kiểm tra**

| # | Nội dung | Đang dùng trong trò | Ở đâu |
|---|---|---|---|
| 1 | Qua vạch lúc đèn vàng: khi nào được đi tiếp | Qua lúc vàng không tính lỗi | `tu-lai-pho.ts` bước 6 |
| 2 | Dung sai trước khi tính lỗi (0,5 m qua vạch; 0,5 m lấn tim đường; từ 5 km/h, hơn 1 giây quá tốc độ) | Như bên | Các hằng `DUNG_SAI_*`, `NGUONG_QUA_TOC_DO_KMH` |
| 3 | Phạm vi hiệu lực của biển tốc độ tối đa | Tới nơi giao nhau kế tiếp | `dungTheGioi`, vùng tốc độ |
| 4 | Tốc độ tối đa khi không có biển (bản cũ Q6) | Không bắt lỗi | Chưa có số liệu |
| 5 | Quy tắc nhường đường ở nơi giao nhau không đèn (bên phải, đường ưu tiên) | Xe đã ở trong nơi giao nhau được đi trước | `vaoGiao` |
| 6 | Nhường người đi bộ: phải chờ cả khi người đi bộ đang ở nửa đường bên kia? | Phải chờ khi người đi bộ ở bất kỳ đâu trên mặt đường trong vạch | Bước 9 |
| 7 | Rẽ phải khi đèn đỏ | Tính vượt đèn đỏ | Bước 6 |
| 8 | Tên hành vi, mã mức phạt từng lỗi theo loại xe; bậc quá tốc độ có km/h lẻ (ví dụ vượt 20,5 km/h) | BL-01; tốc độ làm tròn xuống km/h | `data/tro-choi/tu-lai.json` |
| 9 | Chuyển làn không xi nhan có cùng hành vi với rẽ không xi nhan | Gộp một lỗi | `LOI_MAC_DINH.re_khong_xi_nhan` |
| 10 | Vị trí biển, đèn, vạch trên 3 khu phố mẫu | Hệ thống tự soạn | `data/tro-choi/tu-lai.json` |

**Hình cần bổ sung** (hiện vẽ Canvas trong `lib/ve-canh/ve-pho.ts`)

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Xe người chơi (ô tô con, xe mô tô) từ trên xuống, đèn phanh và xi nhan tách lớp | Chữ nhật bo góc màu xanh, ô đèn đỏ, ô vàng nhấp nháy | SVG 16×36 và 8×18 px, lớp đèn riêng để bật/tắt |
| Nhà, trường, chợ, công viên nhìn từ trên xuống | Khối màu, chấm cây | Bộ mảnh ghép theo ô 10 m, ≤ 4 KB mỗi loại |
| Mặt đường, vạch giữa, vạch chia làn, mũi tên một chiều, vạch dừng, vạch người đi bộ | Vẽ Canvas | Theo QCVN 41 (vạch), khi có văn bản |
| Cột đèn tín hiệu | Ô tròn đổi màu ở góc nơi giao nhau | SVG 12×12, ba màu |
| Người đi bộ | Chấm tròn đỏ (đang sang) / xám (đang chờ) | Bóng dáng nhìn từ trên xuống, 12×12 px |
| Cờ đích, mũi tên chỉ hướng đích | Cờ vẽ Canvas, ký tự ▲ | SVG ≤ 2 KB |


### 5.10. Tái dựng hiện trường

**Luật chơi**
- Người chơi xem sơ đồ hiện trường sau vụ va chạm: vị trí cuối của các xe, vết phanh, mảnh vỡ, đèn và biển tại chỗ, lời kể ngắn của người liên quan.
- **Kéo thả xe** vào vị trí ban đầu trên sơ đồ, xoay hướng, chọn **mức tốc độ** (chậm, vừa, nhanh, rất nhanh) và **hành động** (đi thẳng, rẽ, chuyển làn, phanh).
- Bấm **"Mô phỏng"**: M5 chạy lại từ dữ kiện người chơi dựng. Kết quả (vị trí cuối, vết phanh) phủ lên dấu vết thật để so.
- Được mô phỏng nhiều lần. Khi thấy khớp, **kéo thẻ lỗi** vào xe có lỗi và bấm "Kết luận".

**Màn chơi và độ khó**

| Màn | Nội dung |
|---|---|
| 1 | Một xe tự gây tai nạn, chỉ cần đặt vị trí và tốc độ |
| 2 | Hai xe, đâm từ phía sau |
| 3 | Hai xe tại giao lộ có đèn |
| 4 | Có vết phanh và mảnh vỡ; hướng ban đầu không hiển nhiên |
| 5 | Lời kể của hai bên mâu thuẫn; dấu vết mới là căn cứ |

**Chấm điểm**
- Máy chủ chạy lại mô phỏng từ dựng cảnh cuối cùng của người chơi và so với **dựng cảnh gốc** do người soạn khai báo.
- Độ khớp dấu vết (khoảng cách vị trí cuối, độ dài vết phanh, hướng): tối đa 50 điểm. Kết luận đúng xe có lỗi và đúng lỗi: 40 điểm. Số lần mô phỏng: 1–3 lần +10, 4–6 lần +5, nhiều hơn +0; không mô phỏng lần nào (không kiểm chứng) +0 (đề xuất, làm ở GĐ-T10). Tối đa 20 lần mô phỏng mỗi lượt; nhật ký có lần thứ 21 bị từ chối (chống dò).
- Dấu vết trên sơ đồ **được M5 tính từ dựng cảnh gốc**, không vẽ tay, nên dấu vết luôn khớp với một lời giải.
- Màn kết quả: dựng cảnh gốc phát lại cạnh dựng cảnh của người chơi, lỗi và căn cứ, biên bản (M4).

**Dữ liệu cần**
- `game_content` loại `tai_dung`: sơ đồ (M5), dựng cảnh gốc (xe, vị trí, hướng, mức tốc độ, hành động), lời kể, lỗi đúng và mã `violations`.
- Ghi rõ trên màn hình: **"Mô phỏng minh họa để học cách đọc dấu vết, không phải phương pháp giám định."**

**Offline:** Có.

**Độ khó triển khai: Cao.** Va chạm và vết phanh trong M5 (vật lý đơn giản nhưng tất định), đo độ khớp dấu vết công bằng, trình soạn dựng cảnh gốc.

**Đã làm (GĐ-T10, 30/9/2026)**
- **M5 mở rộng bằng tệp mới `mo-phong/va-cham.ts`, không sửa vòng bước cũ** (trò 3, 5, 9, 15 chạy y như trước). Xe đặt tự do theo TÂM xe (cm), 8 hướng rời rạc, 4 mức tốc độ (20, 40, 60, 80 km/h), 6 hành động: đi thẳng; phanh gấp ngay tại chỗ đặt; rẽ trái, rẽ phải (thẳng 6 m, chéo 45° 5 m, rồi hướng mới); chuyển làn trái, phải (thẳng 3 m, chéo tới khi lệch một làn 3,5 m, rồi hướng cũ). Tốc độ giữ nguyên, trừ phanh.
- **Vết phanh** theo bảng giảm tốc cố định theo mặt đường (`GIAM_TOC_MAT_DUONG`: khô 6,8 m/s², ướt 4,8 m/s², sỏi 3,6 m/s²), dài gần v²/(2a).
- **Va chạm** theo hộp bao như `mo-phong.ts`. Hai xe: va chạm mềm (dính), vận tốc chung theo khối lượng tương đối (`KHOI_LUONG_XE`); xe bị đâm ngang (lệch 45°, 90°, 135°) xoay một bậc 45° theo chiều chuyển động của xe kia; sau đó trượt giảm tốc theo mặt đường, để lại vết trượt, tới khi dừng. Xe chạm vật cố định dừng ngay. Mỗi cặp va chạm một lần.
- **Dấu vết** = vị trí cuối (tâm, hướng), đoạn vết phanh, vết trượt, điểm va chạm (mảnh vỡ vẽ quanh điểm này). Máy chủ tính từ dựng cảnh gốc lúc tạo lượt; không lưu trong nội dung.
- **Sơ đồ theo mẫu, không vẽ tự do** (§3): `doan_thang` hoặc `nga_tu`, 1–2 làn mỗi chiều, mặt đường, biển tốc độ tối đa (chỉ để đọc), vật cố định (cột, rào, cây, tường), màu đèn lúc xảy ra theo từng hướng đi (chỉ để đọc, không vào mô phỏng). Người chơi đặt xe theo lưới 1 m.
- **Chấm:** khớp dấu vết 50 = vị trí cuối 25 (giảm tuyến tính, 0 điểm khi lệch từ 10 m) + vết bánh 15 (tổng độ dài vết phanh và vết trượt lệch, 0 điểm từ 8 m) + hướng cuối 10 (lệch 45° nửa điểm), chia đều cho các xe; xe chưa đặt 0 điểm. Kết luận 40: mỗi lỗi đúng chia đều, nửa cho đúng xe, nửa cho đúng lỗi; mỗi thẻ sai −10; tối đa 3 thẻ. Số lần mô phỏng 10 như trên. "Đúng" khi kết luận đủ 40 và khớp từ 40. Nhật ký có thao tác không hợp lệ (đặt xe ngoài sơ đồ, xe lạ, gỡ thẻ chưa gắn, quá 3 thẻ) hoặc sai mốc thời gian: cả bước 0 điểm.
- **Thẻ lỗi** (tên do hệ thống soạn, câu D10): chạy quá tốc độ; không giữ khoảng cách an toàn; vượt đèn đỏ; chuyển làn không an toàn; không nhường đường; đi sai phần đường. Lỗi đúng của vụ bắt buộc có mã mức phạt (bộ kiểm báo lỗi nếu thiếu); biên bản M4 lấy mức phạt đã duyệt.
- **Đánh đổi (§1.2):** đề có dấu vết, sơ đồ, lời kể; không có dựng cảnh gốc, lỗi đúng, mã mức phạt. Điện thoại có bộ mô phỏng nên về lý thuyết thử hết tổ hợp được, như mọi trò mô phỏng chơi offline; giới hạn 20 lần mô phỏng chỉ chặn ở nhật ký.
- **Giảm chuyển động:** mô phỏng tính xong ngay, hiện luôn vị trí cuối; màn kết quả không có nút "Phát lại". Chấm y hệt.
- **Trình soạn** `SoanDungCanh`: biểu mẫu sơ đồ, xe kèm dựng cảnh gốc, lời kể, lỗi đúng; ô xem trước vẽ dấu vết M5 tính; bộ kiểm báo lỗi cạnh xe, lỗi, sơ đồ; nút "Chơi thử".
- **Tra kho ngày 30/9/2026:** kho có 2 văn bản (Nghị định số 100/2026/NĐ-CP, 150/2027/NĐ-CP, văn bản thử); tìm "xử lý vụ tai nạn giao thông đường bộ", "khoảng cách an toàn giữa hai xe, tốc độ tối đa, chuyển làn" không có kết quả. Không vụ nào gắn căn cứ; màn kết quả ghi "Căn cứ về xử lý tai nạn đang được cập nhật".

**Dữ liệu demo, chưa duyệt:** `data/tro-choi/tai-dung.json`, 5 vụ TD-01 (màn 1, ô tô phanh trên đường ướt, đâm rào), TD-02 (màn 2, đâm đuôi), TD-03 (màn 3, ngã tư có đèn), TD-04 (màn 4, chuyển làn quẹt xe đang phanh, hai xe xoay), TD-05 (màn 5, rẽ trái và xe đi thẳng chạy nhanh, lời kể mâu thuẫn, hai lỗi). Thêm 3 dòng mức phạt nháp `oto-khoang-cach`, `oto-chuyen-lan`, `oto-nhuong-duong` vào `data/tra-cuu/muc-phat.json`, **số tiền là số minh họa** (như GĐ-T13, T14).

**Cần đơn vị chuyên môn kiểm tra**

| # | Nội dung | Đang dùng trong trò | Ở đâu |
|---|---|---|---|
| 1 | Văn bản làm căn cứ cho nội dung về xử lý tai nạn (bản cũ Q15, câu D10) | Chưa có; chờ khách hàng cung cấp | Mọi vụ |
| 2 | Hệ số phanh theo mặt đường | Khô 6,8; ướt 4,8; sỏi 3,6 m/s² | `GIAM_TOC_MAT_DUONG` |
| 3 | Mô hình sau va chạm: dính nhau, vận tốc chung theo khối lượng, xoay 45°, trượt với cùng hệ số phanh | Như bên, số minh họa | `va-cham.ts` bước 2 |
| 4 | Mức tốc độ người chơi chọn | 20, 40, 60, 80 km/h | `MUC_TOC_DO_KMH` |
| 5 | Dung sai chấm khớp | Vị trí 10 m, vết 8 m, hướng 45° nửa điểm | `NGUONG_VI_TRI_CM`, `NGUONG_VET_CM` |
| 6 | Cách xác định lỗi trong từng vụ (ví dụ TD-05 hai bên cùng lỗi) | Hệ thống soạn | `data/tro-choi/tai-dung.json` |
| 7 | Tên thẻ lỗi, mã và số tiền mức phạt của khoảng cách, chuyển làn, nhường đường | Tên do hệ thống soạn; số tiền minh họa | `TEN_LOI_TAI_DUNG`, `data/tra-cuu/muc-phat.json` |
| 8 | Trò có lộ nội dung nghiệp vụ không được công bố không | Chưa hỏi | Toàn trò |

**Hình cần bổ sung** (hiện vẽ Canvas trong `lib/ve-canh/ve-tai-dung.ts`)

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Ký hiệu xe trên sơ đồ hiện trường (ô tô, xe tải, xe máy) | Chữ nhật bo góc đặc (xe người chơi) hoặc viền đứt (vị trí cuối), tam giác chỉ đầu xe | Theo lối vẽ sơ đồ nghiệp vụ nếu đơn vị có mẫu; SVG một màu, vẽ theo tỷ lệ |
| Vết phanh, vết trượt | Hai vệt liền / hai vệt đứt cách tâm 70 cm | Như trên |
| Mảnh vỡ, điểm va chạm | 6 mẩu nhỏ xếp cố định quanh điểm | Ký hiệu điểm va chạm theo mẫu của đơn vị |
| Cột, rào chắn, cây, tường | Khối màu, hình tròn (cây) | SVG ≤ 2 KB mỗi loại |
| Đèn tín hiệu | Chấm tròn đổi màu ở góc giao lộ | Dùng chung hình đèn của trò 9 khi có |

---

**Các trò bổ sung T11–T20 (28/9/2026).** Nội dung lấy từ mô tả ở `PROMPT_TRO_CHOI_MOI.md` mục 3. Chỗ ghi **(đề xuất)** là phần mô tả gốc chưa có, chờ anh/chị xác nhận. Chưa trò nào được làm.

Tra kho văn bản ngày 28/9/2026: kho chỉ có Nghị định số 100/2026/NĐ-CP và Nghị định số 150/2027/NĐ-CP (văn bản thử). **Không trò nào trong T11–T20 có căn cứ trong kho.** Mỗi giai đoạn tra lại khi làm, theo quy tắc 4 của Phần chung.

Quy ước chung cho T11–T20:
- Mã trò, tên tệp, loại `game_content` ghi ở PLAN.md, giai đoạn tương ứng.
- **Điểm bước không âm** (khung chung, xem câu D5 và D15). Mọi dòng "−n" trong bảng điểm là trừ trong phạm vi một bước, điểm bước thấp nhất là 0.
- Mọi trò có màn hướng dẫn 3 thẻ (M3), chọn màn (M8), màn kết quả có căn cứ (M3). Không nhắc lại ở từng mục.

### 5.11. Duyệt hồ sơ phạt nguội

*Đã làm phần mã ngày 28/9/2026 (PLAN GĐ-T11). Trò tắt cho tới khi có luật và hồ sơ đã duyệt. Câu D15, D16, D32 đã trả lời theo đề xuất.*

**Luật chơi**
- Người chơi là cán bộ xử lý dữ liệu vi phạm do camera ghi lại. Một ca có 10–15 hồ sơ, hiện lần lượt dạng thẻ.
- Mỗi thẻ gồm: ảnh vi phạm vẽ giản lược, có dấu giờ và mã thiết bị in trên ảnh; ảnh phóng to biển số kèm biển số hệ thống đọc được; dải thông tin (thời điểm, vị trí, thiết bị và hạn kiểm định, hành vi hệ thống đề xuất, số đo tốc độ nếu có).
- **Vuốt trái:** đủ căn cứ, gửi thông báo. **Vuốt phải:** trả lại. Ô vuốt chia hai nửa theo đúng chiều (trái: "Gửi thông báo", xanh; phải: "Trả lại", đỏ), nửa đang kéo về sáng lên. Bên dưới có hai nút "← Gửi thông báo" và "Trả lại →" đặt cùng phía, và phím mũi tên trái, phải trên ô vuốt.
- Sáu chỗ chạm được: ảnh, biển số, thời điểm, vị trí, thiết bị, hành vi đề xuất. Trả lại thì phải chạm đúng chỗ thiếu trước khi vuốt: biển số không đọc được hoặc hệ thống đọc sai, thiếu thời điểm, ảnh không thấy rõ hành vi (mờ, bị che, hai xe chồng nhau), hành vi đề xuất không khớp với ảnh hoặc số đo, thiết bị hết hạn kiểm định, thời điểm ngoài khung giờ cấm của biển (màn 5; chạm thời điểm hoặc hành vi đều được). "Vị trí" không bao giờ là chỗ thiếu. Chạm lần hai thì bỏ đánh dấu. Chưa chạm chỗ nào thì nút "Trả lại" khóa, vuốt phải chỉ hiện lời nhắc; máy chủ cũng từ chối (400).

**Vòng đời một lượt**
1. Chọn màn. Máy chủ rút hồ sơ đã duyệt dùng được ở màn đó, tạo lượt; mỗi hồ sơ là một bước.
2. Mỗi bước: xem thẻ, chạm chỗ thiếu (nếu trả lại), vuốt. Máy chủ chấm; thẻ kế tiếp hiện.
3. Thoát giữa chừng: lượt giữ ở hồ sơ chưa xử lý. Màn có giờ cả ca thì giờ vẫn tính theo máy chủ.
4. Hết hồ sơ hoặc hết giờ: tổng kết. Hồ sơ còn lại khi hết giờ tính chưa xử lý.

**Màn chơi và độ khó** (khai trong mã, `MAN_DUYET_PHAT_NGUOI`)

| Màn | Nội dung | Số hồ sơ | Giờ ca |
|---|---|---|---|
| 1 | Mỗi hồ sơ nhiều nhất một chỗ thiếu rõ: không có thời điểm, ảnh mờ hẳn | 10 | Không tính giờ |
| 2 | Thêm biển số không đọc được, thiết bị hết hạn kiểm định | 12 | Không tính giờ |
| 3 | Thêm hành vi đề xuất không khớp: đề xuất vượt đèn đỏ mà ảnh đèn xanh, đề xuất quá tốc độ mà đo 58/60 km/h, đề xuất không đội mũ mà ảnh có mũ; thêm xe khác che khuất | 12 | 4 phút |
| 4 | Hồ sơ thiếu 2 chỗ; hồ sơ đủ căn cứ nhưng gây nghi ngờ (ảnh tối, hơi mờ mà vẫn rõ; đo 66/60 km/h) | 14 | 4 phút |
| 5 | Lỗi khó thấy: ký tự dễ nhầm (biển B1 hệ thống đọc 81, biển 51D đọc 510), thời điểm ngoài giờ cấm, hai xe chồng nhau; thiết bị hết hạn đúng ngày ghi hình (vẫn còn hạn) | 15 | 4 phút 30 giây |

Màn đang chơi thiếu hồ sơ thì ca ngắn hơn, tối thiểu 10 hồ sơ (`soBuoc`). Mỗi ca ít nhất 30% hồ sơ đủ căn cứ và 40% hồ sơ thiếu nếu đủ nguồn. Thay ví dụ "đèn vàng" của thiết kế ban đầu bằng "đèn xanh": trường hợp đèn vàng cần căn cứ đã đối chiếu (bảng cần kiểm, dòng 8).

**Chấm điểm** (câu D15)

| Tình huống | Điểm |
|---|---|
| Hồ sơ đủ căn cứ, gửi | 10 / 10 |
| Hồ sơ đủ căn cứ, trả lại | 0 / 10 |
| Hồ sơ không đủ căn cứ, trả lại | 10 cho quyết định, cộng 5 cho mỗi chỗ thiếu chỉ đúng; tối đa 10 + 5 × số chỗ thiếu (15 hoặc 20) |
| Hồ sơ không đủ căn cứ, gửi | 0 |
| Chạm vào chỗ không thiếu | −2 mỗi chỗ, chỉ trừ vào phần "chỉ chỗ thiếu" (phần này không âm) |

- "Gửi nhầm nặng hơn trả nhầm" làm bằng **điểm tối đa không đều**: gửi nhầm mất 15–20 điểm, trả nhầm mất 10.
- Máy chủ bỏ qua mọi điểm, cờ "đúng" máy khách gửi kèm; chỉ đọc quyết định (`gui`, `tra_lai`) và danh sách chỗ đã chạm.
- Màn kết quả của mỗi hồ sơ: quyết định đúng, điểm quyết định và điểm chỉ chỗ thiếu, danh sách chỗ thiếu (M3 `DanhSachLoi`: cụ thể theo hồ sơ, đã chỉ ra chưa, giải thích, căn cứ), chỗ chạm nhầm. Hồ sơ gửi đúng có **thông báo vi phạm** dựng bằng M4 (`dongBienBan`, `BienBan` với `tieuDe = "Thông báo vi phạm (mô phỏng)"`, không sửa M4): hành vi, biển số, thời điểm, vị trí, thiết bị, mức phạt từ dòng mức phạt đã duyệt.

**Dữ liệu**
- `game_content` loại `duyet_phat_nguoi`. `payload`: `muc`, `loai_xe`, `bien_so` (biển thật trên xe), `ky_tu_mo` (vị trí ký tự không đọc được), `bien_so_he_thong`, `thoi_diem` (`YYYY-MM-DDTHH:mm:ss` hoặc null), `vi_tri`, `thiet_bi` (loại, mã, hạn kiểm định), `de_xuat` (hành vi, `ma_muc_phat`), `do_toc_do` (thiết bị đo tốc độ), `anh` (cảnh `giao_lo`, `duong_lan`, `duong_thang`, `loi_vao_cam`; màu đèn, qua vạch, làn, mũ bảo hiểm, đã vào đường cấm, biển phụ khung giờ, độ mờ 0–3, tối, che khuất). `answer.cho_thieu`: chỗ thiếu người soạn dự kiến (nhiều nhất 2, hai chỗ chỉ từ màn 4). `refs`: dòng mức phạt của hành vi đề xuất.
- **Đáp án suy ra từ luật kiểm hồ sơ đã duyệt** (`document_rules`, `nhom = 'ho_so_phat_nguoi'`, câu D16), không ghi cứng trong hồ sơ. `doc_kind` của nhóm này là phần hồ sơ được kiểm. Sáu cặp kiểu kiểm và phần: `phai_co`/`thoi_diem`, `doc_duoc`/`bien_so`, `thay_hanh_vi`/`anh` (tham số `do_mo_toi_da`), `khop_hanh_vi`/`hanh_vi`, `con_han`/`thiet_bi`, `trong_khung_gio`/`thoi_diem`. Hành vi ảnh cho thấy suy ra từ tham số ảnh và số đo (`hanhViTrenAnh`); ảnh không rõ thì không so hành vi. Hồ sơ mà luật đã duyệt cho kết quả khác dự kiến, hoặc còn thiếu luật của màn, thì không vào lượt (`hoSoDungDuocOMan`, như `dungDuocOMan` của T1).
- Luật demo: 6 dòng ở `data/tra-cuu/luat-ho-so-phat-nguoi.json`, nạp bằng `bun run tra-cuu:nap` (nhóm riêng, không đụng luật giấy tờ). Hồ sơ demo: 30 hồ sơ `[Demo]` ở `data/tro-choi/phat-nguoi.json` (10 màn 1, 5 mỗi màn 2–5; 9 đủ căn cứ, 21 thiếu; mỗi chỗ thiếu có ít nhất một hồ sơ), nạp ở `cho_duyet`.
- Tab "Luật giấy tờ" ở `/quan-tri/du-lieu-tra-cuu` lọc theo nhóm ("Giấy tờ người lái", "Hồ sơ phạt nguội").

**Mô-đun**
- M1 (mở rộng, D16): `NHOM_LUAT`, `KIEU_KIEM_PHAT_NGUOI`, `PHAN_HO_SO_PHAT_NGUOI`, `CHO_THIEU_PHAT_NGUOI`, `choThieuCuaLuat`; `kiemTraLuatGiayTo` chọn bộ kiểm theo `nhom` (vắng là giấy tờ người lái, hành vi cũ giữ nguyên). Bộ chạy luật hồ sơ nằm ở tệp của trò (`tro-choi/duyet-phat-nguoi.ts`), không ở M1.
- M2: `Vuot` (8 hướng) dùng hướng trái và phải, với `anNhan` (hình gợi ý hai nửa tự ghi chữ) và `anThayThe` (trò tự đặt hai nút "← Gửi thông báo", "Trả lại →" thay cho nút "Không vuốt được?"). Thẻ nghiêng theo ngón tay đọc độ dời từ sự kiện con trỏ nổi lên từ ô vuốt, không cần `Vuot` báo độ dời.
- M3 (`HuongDan` qua `giao-dien.tsx`, `DanhSachLoi`), M4 (thông báo vi phạm), M8 (5 màn).

**Dữ kiện gửi xuống điện thoại và đánh đổi**
- Gửi: tham số ảnh (chính là bức ảnh: màu đèn, vạch, làn, mũ, độ mờ, tối, che khuất), biển số **đã làm nhiễu ở máy chủ** (ký tự không đọc được thay bằng `*`, điện thoại vẽ thành khối mờ; màn 5 gửi đúng ký tự như trên ảnh), biển số hệ thống đọc, dải thông tin, tên hành vi đề xuất.
- Không gửi: vị trí ký tự mờ (`ky_tu_mo`), màn của hồ sơ, chỗ thiếu, luật, mã mức phạt, thông báo. Test quét khóa cấm ở unit test và API test.
- Đánh đổi còn lại: tham số ảnh đọc được trong dữ liệu gửi xuống, ví dụ `do_mo: 3` hay `che: "chong_xe"`, tương đương nhìn ảnh; so hạn kiểm định với thời điểm, so hành vi với ảnh là kỹ năng của trò. Gói offline mang đáp án như mọi trò offline (§1.2).

**Offline:** Có. Bộ kiểm dạng hồ sơ đầy đủ (`duyet-phat-nguoi-kiem.ts`) chỉ chạy ở máy chủ khi nạp và khi lấy nguồn; gói offline chỉ kiểm khung, để mã tải xuống gọn.

**Chế độ giảm chuyển động:** thẻ không nghiêng theo ngón tay, không bay ra; vuốt hoặc bấm nút thì gửi ngay, thẻ sau hiện dần tại chỗ. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

Tra kho văn bản ngày 28/9/2026 (công cụ tìm kiếm quy định, hiệu lực tại 28/9/2026) với ba truy vấn: sử dụng dữ liệu thu từ phương tiện, thiết bị kỹ thuật nghiệp vụ để phát hiện vi phạm; gửi thông báo vi phạm cho chủ phương tiện; kiểm định, hiệu chuẩn thiết bị. Cả ba không có kết quả: kho đang nối chỉ có 2 văn bản (nghị định mẫu về hoạt động thử nghiệm). Luật demo ghi URN dự kiến ở mức văn bản (`vn:vbqppl:l:15/2012/QH13`, `vn:vbqppl:l:36/2024/QH15`), **chưa có trong kho, chưa kiểm**; script nạp báo hai URN này ở mục "bản nháp".

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Điều kiện để dữ liệu thu từ thiết bị kỹ thuật nghiệp vụ được dùng làm căn cứ xử phạt; điều, khoản cụ thể cho 6 luật | `data/tra-cuu/luat-ho-so-phat-nguoi.json` | Kho chưa có văn bản; URN dự kiến chưa kiểm |
| 2 | Yêu cầu kiểm định, hiệu chuẩn thiết bị; hồ sơ từ thiết bị hết hạn xử lý thế nào; hết hạn đúng ngày ghi hình có còn hạn không (trò đang coi là còn hạn) | Luật `pn-con-han-kiem-dinh` | Kho chưa có văn bản |
| 3 | Thủ tục, thời hạn gửi thông báo vi phạm; nội dung bắt buộc của thông báo | Màn kết quả (thông báo vi phạm) | Kho chưa có văn bản; thông báo hiện là mô phỏng |
| 4 | Tiêu chí "ảnh không thấy rõ hành vi" (ngưỡng `do_mo_toi_da = 1` trên thang 0–3), "biển số không đọc được" | Luật `pn-thay-hanh-vi`, `pn-doc-duoc-bien-so`; hồ sơ demo | Phán đoán nghiệp vụ |
| 5 | Hệ thống đọc sai một ký tự (8/B, 0/D) được xếp chung vào "biển số không đọc được" | Luật `pn-doc-duoc-bien-so` | Phán đoán nghiệp vụ |
| 6 | Biển có khung giờ (biển phụ thời gian); giờ bắt đầu tính là trong giờ cấm, giờ kết thúc là ngoài giờ cấm | Luật `pn-trong-khung-gio`, hồ sơ màn 5 | Quy chuẩn báo hiệu chưa có trong kho; `traffic_signs` chưa có biển phụ thời gian |
| 7 | Hai xe chồng nhau: trò đang coi là ảnh không rõ hành vi, phải trả lại | Hồ sơ PN-30 | Phán đoán nghiệp vụ |
| 8 | Đèn vàng: xe qua vạch khi đèn vàng có vi phạm không | Chưa dùng trong hồ sơ | Cần căn cứ đã đối chiếu |
| 9 | Mã mức phạt của hành vi đề xuất; đi sai làn, đi vào đường cấm theo giờ chưa có dòng mức phạt (`ma_muc_phat = null`, thông báo ghi "Chưa có mức phạt đã duyệt") | `data/tro-choi/phat-nguoi.json`, `violations` | Bảng mức phạt là bản nháp, Nghị định số 168/2024/NĐ-CP chưa có trong kho |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Ảnh vi phạm nhìn chéo từ camera | SVG tự vẽ trong `DuyetPhatNguoi.tsx` (đường phối cảnh, vạch dừng, cột đèn, làn có chữ, biển cấm và biển phụ giờ, biển tốc độ, xe ô tô, xe mô tô có hoặc không mũ, xe che, dấu giờ, chữ "MẪU TRÒ CHƠI"); độ mờ bằng `feGaussianBlur`, ảnh tối bằng lớp phủ. Không dùng `lib/ve-canh/ve-camera.ts` (Canvas, cần phép chiếu M5) vì ảnh là ảnh tĩnh | Nếu muốn thật hơn: bộ hình vector cùng góc camera trò 5, ≤ 360×220, giữ các tham số hiện có |
| Ảnh phóng to biển số | Chữ số in bằng CSS trong khung biển, ký tự mờ là khối xám làm nhòe | Dáng biển số trò chơi; đọc rõ ở 16px; bản ký tự dễ nhầm cùng phông với biển thật hơn |
| Thẻ hồ sơ | Lớp `.gt-the` của M1 | Không cần thêm |
| Thông báo vi phạm | `BienBan.tsx` | Không cần thêm |

**Độ khó triển khai: Trung bình.** Đã làm: bộ luật kiểm hồ sơ trên `document_rules`, ảnh vi phạm SVG từ tham số, biển số làm nhiễu ở máy chủ.

### 5.12. Trạm cân tải trọng

*Đã làm phần mã ngày 28/9/2026 (PLAN GĐ-T12). Trò tắt cho tới khi có ngưỡng, khung phần trăm và xe đã duyệt. Câu D15, D17, D18 đã trả lời theo đề xuất.*

**Luật chơi**
- Xe tải lần lượt vào trạm cân. Mỗi xe có: **phiếu cân** (tổng trọng lượng; khối lượng hàng từ màn 2, tính bằng tổng trừ tự trọng; tải trọng từng nhóm trục từ màn 3), **giấy chứng nhận kiểm định** (tự trọng, khối lượng hàng chuyên chở cho phép, khối lượng toàn bộ cho phép), **giấy phép lưu hành xe quá tải trọng** (màn 4 trở đi, nếu có: tuyến, thời hạn, tổng, trục đơn, cụm trục được phép), **bảng tải trọng cho phép tại trạm** (màn 3 trở đi), hình xe nhìn ngang có đánh số nhóm trục, tuyến xe đang đi.
- Thao tác:
  1. chạm một số trên phiếu cân và một số giới hạn (thứ tự nào cũng được) để **ghim** cặp số; mỗi cặp hiện **hiệu số kg**, không hiện phần trăm (D18a). Ghim được nhiều cặp; cặp đang chọn là căn cứ gửi đi;
  2. kéo **thanh trượt** (`input type="range"`, 0–200%, bước 1%; có nút −, + và phím mũi tên) ước phần trăm vượt của cặp căn cứ;
  3. đóng một trong ba dấu: **Cho đi**, **Hạ tải**, **Lập biên bản**. Chưa ghim cặp nào thì ba dấu khóa; máy chủ cũng từ chối (400).
- Không có ô chọn đáp án. Người chơi phải tự chỉ ra con số làm căn cứ.

**Vòng đời một lượt:** mỗi xe là một bước. Xe vào bàn cân, người chơi ghim, ước, đóng dấu; máy chủ chấm. Thoát giữa chừng thì lượt giữ ở xe chưa xử lý. Hết xe hoặc hết giờ thì tổng kết.

**Màn chơi và độ khó** (khai trong mã, `MAN_TRAM_CAN`)

| Màn | Cặp số phải so | Số xe | Giờ ca |
|---|---|---|---|
| 1 | Xe tải hai trục; tổng trọng lượng với khối lượng toàn bộ cho phép | 6 | Không tính giờ |
| 2 | Thêm khối lượng hàng với khối lượng hàng chuyên chở cho phép | 6 | Không tính giờ |
| 3 | Thêm tổng trọng lượng với giới hạn của loại xe, từng trục đơn, cụm trục với dòng giới hạn đúng khoảng cách trục (bảng tại trạm) | 7 | 4 phút |
| 4 | Thêm giấy phép lưu hành: còn hạn, đúng biển số, đúng tuyến thì giới hạn của giấy phép thay cho bảng tại trạm; hết hạn, sai tuyến thì không | 8 | 4 phút |
| 5 | Xe đầu kéo sơ mi rơ moóc, cụm 2 trục và cụm 3 trục | 8 | 3 phút 30 giây |

XP cơ bản 10, 12, 14, 16, 18. Mỗi ca có đủ ba loại dấu nếu đủ nguồn, ưu tiên xe đúng màn.

**Đáp án** (suy ra lúc tạo lượt từ ngưỡng đã duyệt tại ngày chơi)
- Phần trăm của một cặp = (số − giới hạn) / giới hạn × 100, làm tròn 0,1. **Đúng bằng giới hạn là không vượt** (cần đơn vị kiểm, dòng 7).
- Cặp quyết định: cặp có phần trăm cao nhất; xe không vượt thì cặp gần giới hạn nhất. Hai cặp bằng nhau thì cặp nào cũng được.
- Dấu đúng (D18b, demo): có cặp rơi vào một khung phần trăm bị xử phạt của loại quá tải tương ứng: **Lập biên bản** (gồm cả buộc hạ tải); có cặp vượt nhưng chưa tới khung bị xử phạt: **Hạ tải**; không cặp nào vượt: **Cho đi**. Hai loại quá tải: so với giấy chứng nhận kiểm định (tổng, hàng), so với tải trọng cầu, đường (bảng tại trạm hoặc giấy phép).
- Xe không chấm được (thiếu giới hạn đã duyệt cho loại xe hoặc nhóm trục, thiếu khung phần trăm của loại quá tải đang xét, hoặc phần trăm rơi vào khoảng trống giữa các khung) thì không vào lượt.

**Chấm điểm**

| Việc | Điểm |
|---|---|
| Dấu đúng | +10 |
| Cặp số căn cứ là cặp quyết định | +5 |
| Phần trăm ước lệch không quá 2 điểm phần trăm so với phần trăm vượt máy chủ tính (không vượt thì so với 0) | +3 |
| Tối đa mỗi xe | 18 |

- Máy chủ tính lại phần trăm từ số trong đề và ngưỡng đã duyệt; chỉ đọc dấu, cặp số và giá trị thanh trượt. Phần trăm, điểm, cờ đúng máy khách gửi kèm bị bỏ qua.
- Màn kết quả: dấu đúng, điểm từng phần, mọi cặp số phải so kèm phần trăm, cặp quyết định, cặp vào khung bị xử phạt. Xe lập biên bản có **biên bản M4**: mỗi dòng mức phạt (khung) một dòng, lấy cặp có phần trăm cao nhất trong khung đó.

**Dữ liệu** (D17)
- `load_limits` (migration `0047`): mỗi dòng một con số có vòng đời duyệt: `tong` (tổng trọng lượng theo loại xe), `truc_don`, `cum_truc` (số trục trong cụm, khoảng cách trục [từ, đến) cm). Tab "Tải trọng" ở `/quan-tri/du-lieu-tra-cuu` sửa con số và căn cứ; loại, loại xe, khoảng cách trục sửa qua tệp nạp. Lịch sử duyệt loại `load_limit`.
- `violations` thêm `qua_tai_loai` (`kiem_dinh`, `cau_duong`), `qua_tai_tu`, `qua_tai_den`, `qua_tai_bien` (cách viết cận như khung tốc độ, mặc định "trên a% đến b%"). Bộ kiểm tệp mức phạt báo khung chồng nhau theo loại xe và loại quá tải. Thêm cột `qua_tai_loai`, `qua_tai_bien` so với kế hoạch ban đầu (chỉ có `qua_tai_tu`, `qua_tai_den`): cần biết khung thuộc loại quá tải nào và cận có gồm biên không.
- Tệp demo: `data/tra-cuu/tai-trong.json` (10 dòng), 8 dòng mức phạt `oto-qua-tai-kd-*`, `oto-qua-tai-cd-*` trong `data/tra-cuu/muc-phat.json`. **Mọi con số, khung phần trăm, số tiền trong hai tệp này là số minh họa để chạy thử, không lấy từ văn bản.**
- `game_content` loại `tram_can`: chỉ dữ kiện (loại xe, biển số, tuyến đang đi, nhóm trục, phiếu cân, giấy kiểm định, giấy phép), `answer` rỗng. 30 xe `[Demo]` ở `data/tro-choi/tram-can.json` (7 màn 1, 6 mỗi màn 2–4, 5 màn 5), ý đồ ghi ở phần giải thích. Không lưu đáp án: ngưỡng đổi sau khi duyệt lại thì đáp án đổi theo; ngưỡng đang sửa thì rời nguồn và xe cần nó không vào lượt.

**Mô-đun**
- M1 (mở rộng, đã hỏi): kiểu `PhieuCan`, `GiayKiemDinh`, `GiayPhepLuuHanh`, `kiemTraGiayToXeTai` ở `giay-to.ts`; thẻ dùng chung `TheGiayToChung` ở `GiayTo.tsx` (dòng chạm được, kiểu chọn "ghim" tô màu chính). Tách khỏi `LoaiGiayTo` của trò 1 nên trò 1, 4 không đổi. T14 dùng lại giấy chứng nhận kiểm định.
- M2 (mở rộng, đã hỏi): `NutDongDau` nhận `luaChon` (mã, nhãn, màu, khóa riêng) và `nhac`; `DauMoc` nhận `nhan`, `mau`. Không truyền thì giữ hai dấu "Cho qua / Giữ lại" của trò 1. T13, T14 dùng lại.
- M3, M4, M8.

**Dữ kiện gửi xuống điện thoại và đánh đổi**
- Gửi: mọi số trên phiếu cân, giấy kiểm định, giấy phép (đó là đề); **bảng tải trọng tại trạm** (màn 3 trở đi): các dòng `load_limits` đã duyệt áp cho loại xe (tổng của loại xe, trục đơn, mọi dòng cụm trục).
- **Khác thiết kế ban đầu:** thiết kế cũ ghi không gửi ngưỡng từ `load_limits`. Không có bảng này thì người chơi không có số giới hạn nào để ghim khi so tải trọng trục, và phải nhớ số của văn bản (hiện chỉ là số minh họa). Bảng gửi cả các dòng cụm trục không áp cho xe, nên chọn đúng dòng theo khoảng cách trục vẫn là kỹ năng của trò.
- Không gửi: khung phần trăm, dấu đúng, cặp quyết định, phần trăm, căn cứ, màn của xe. Test quét khóa cấm ở unit test và API test.

**Offline:** Có. Gói mang giới hạn tải trọng, khung phần trăm và dòng mức phạt quá tải đã duyệt. Bộ kiểm dạng xe đầy đủ (`tram-can-kiem.ts`) chỉ chạy ở máy chủ.

**Chế độ giảm chuyển động:** xe hiện dần tại chỗ, không trượt; dấu hiện tĩnh, không đập; thanh trượt không có hoạt ảnh. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

Tra kho văn bản ngày 28/9/2026 (hiệu lực tại 28/9/2026) với ba truy vấn: tải trọng trục, tổng trọng lượng theo số trục; giấy phép lưu hành xe quá tải; xử phạt chở hàng vượt khối lượng cho phép theo giấy chứng nhận kiểm định. Cả ba không có kết quả: kho chỉ có 2 văn bản (nghị định mẫu). URN trong `tai-trong.json` là URN dự kiến ở mức văn bản (`vn:vbqppl:l:35/2024/QH15`); các dòng mức phạt quá tải ghi `vn:vbqppl:nd:168/2024/NĐ-CP#dieu-chua-xac-dinh` vì bộ kiểm tệp mức phạt bắt buộc trỏ tới điều mà điều chưa xác định được. Cả hai **chưa có trong kho, chưa kiểm**; script nạp báo ở mục "bản nháp".

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Giới hạn tải trọng trục đơn, cụm 2, 3 trục theo khoảng cách trục, tổng trọng lượng theo loại xe và số trục (hiện là số minh họa) | `data/tra-cuu/tai-trong.json` | Kho chưa có văn bản |
| 2 | So "khối lượng hàng chuyên chở" hay "khối lượng toàn bộ" theo giấy kiểm định; trò đang so cả hai, khối lượng hàng tính bằng tổng trừ tự trọng | Luật chấm màn 1–2 | Cách hiểu của nhóm phát triển |
| 3 | Các khung phần trăm quá tải, mức phạt, hình thức bổ sung (hiện là số minh họa); điều khoản của nghị định | Dòng `oto-qua-tai-*` trong `muc-phat.json` | Kho chưa có nghị định xử phạt |
| 4 | Sai số của cân có được trừ trước khi xét quá tải không | Hiệu số, phần trăm | Chưa có căn cứ; trò không trừ |
| 5 | Ý nghĩa ba dấu: "Hạ tải" cho xe vượt chưa tới khung bị xử phạt, "Lập biên bản" gồm cả buộc hạ tải | Đáp án từng xe | Phán đoán nghiệp vụ (D18, demo) |
| 6 | Điều kiện của giấy phép lưu hành (tuyến, thời hạn, biển số, tải trọng được phép); giấy phép thay giới hạn cầu đường nhưng không thay giới hạn theo giấy kiểm định | Luật màn 4 | Kho chưa có văn bản |
| 7 | Ca đúng bằng giới hạn, đúng bằng cận khung | Luật chấm | Trò tính là không vượt, khung "trên a%" |
| 8 | Xe đầu kéo: tổng trọng lượng theo số trục của tổ hợp (trò đang dùng một dòng cho mọi đầu kéo) | Dòng `tt-tong-dau-keo` | Kho chưa có văn bản |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Xe tải 2, 3, 4 trục; đầu kéo sơ mi rơ moóc nhìn ngang, đánh dấu trục và cụm trục | SVG tự vẽ trong `TramCan.tsx`: cabin, thùng, bánh theo nhóm trục, số nhóm trục | Nếu muốn: SVG ≤ 8 KB mỗi loại, một màu đổi được, không logo |
| Bàn cân, trạm cân | Dải nền dưới bánh xe | SVG ≤ 6 KB |
| Phiếu cân, giấy chứng nhận kiểm định, giấy phép lưu hành, bảng tại trạm | `TheGiayToChung` (M1): dải màu, dòng nhãn và giá trị, chữ chìm "MẪU TRÒ CHƠI" | Không cần thêm |
| Ba dấu "Cho đi", "Hạ tải", "Lập biên bản" | `DongDau.tsx` (chữ trong viền, màu theo dấu) | Tùy chọn: dấu vân mực, không biểu tượng ngành |

**Độ khó triển khai: Trung bình.** Đã làm: bảng ngưỡng có duyệt, khung phần trăm trong `violations`, đáp án tính lại theo ngưỡng tại ngày chơi. Rủi ro còn lại: số liệu thật của nhiều loại xe và cấu hình trục phải đối chiếu đúng văn bản.

### 5.13. Lên xe khách

**Luật chơi**
- Người chơi dừng một xe khách và kiểm tra trên một màn chia ba phần: **sơ đồ khoang xe** nhìn từ trên (ghế, giường, lối đi, người), **giấy tờ** của xe và lái xe, **màn hình giám sát hành trình** (thời gian lái liên tục, tổng thời gian lái trong ngày, tốc độ). Ở bề rộng 360px, ba phần là ba thẻ chuyển qua lại (đề xuất).
- Thao tác:
  - chạm từng người để đếm; người đã chạm hiện số thứ tự; chạm lại thì bỏ đếm. Trên sơ đồ có vật dễ nhầm với người (hành lý, áo treo, túi trên ghế); chạm vào vật đó là đếm dư;
  - chỉnh ô "số người vượt" bằng nút − và + (đề xuất; mô tả gốc chưa nói người chơi báo số vượt bằng cách nào);
  - chạm vào chỗ sai trên giấy tờ và trên màn giám sát;
  - đóng dấu **Cho đi** hoặc **Lập biên bản**.
- Sau khi đóng dấu **Lập biên bản**, người chơi kéo các lỗi đã phát hiện vào biên bản theo thứ tự **nặng đến nhẹ**. Đây là bước tổng hợp, không phải trắc nghiệm: chỉ sắp các lỗi chính người chơi đã chỉ ra.

**Vòng đời một lượt:** mỗi xe là một bước (màn 1–4: 3 xe; màn 5: 2 xe, đề xuất). Trong một bước: đếm, soi, đóng dấu, sắp lỗi, nộp. Thoát giữa chừng thì bước đang làm được giữ ở máy khách (IndexedDB), vào lại làm tiếp; máy chủ chỉ nhận khi nộp. *(GĐ-T13: chưa làm phần giữ bước đang làm. Khung chung chưa có chỗ lưu câu trả lời dở của một bước, và không trò nào tự làm. Thoát giữa chừng thì các xe đã nộp được giữ, xe đang làm bắt đầu lại. Nếu cần, làm ở khung cho mọi trò.)*

**Màn chơi và độ khó**

| Màn | Nội dung | Giờ |
|---|---|---|
| 1 | Xe 16 chỗ, chỉ đếm khách | Không tính giờ |
| 2 | Xe 29 chỗ, người đứng lối đi, trẻ em (đề xuất) | Không tính giờ |
| 3 | Thêm lệnh vận chuyển, phù hiệu | 3 phút mỗi xe (đề xuất) |
| 4 | Thêm màn giám sát hành trình: thời gian lái liên tục, trong ngày (đề xuất) | 3 phút mỗi xe |
| 5 | Xe giường nằm ban đêm, hành khách nằm sàn, nhiều lỗi chồng nhau | 3 phút 30 giây mỗi xe (đề xuất) |

**Chấm điểm** (đề xuất)

| Việc | Điểm |
|---|---|
| Số người vượt đúng (xe không vượt: báo 0) | +10 |
| Mỗi lỗi giấy tờ hoặc giám sát chỉ đúng | +5 |
| Chạm nhầm chỗ không sai | −2, chỉ trừ vào phần lỗi, không âm |
| Dấu đúng | +5 |
| Thứ tự lỗi đúng hoàn toàn | +5; sai một cặp liền kề +2; còn lại 0 |

- Số người vượt máy chủ tính từ tập người đã chạm (theo id, chạm hai lần cùng một người tính một lần) và quy tắc tính số người đã duyệt. Có điểm đếm khi tập đã chạm đúng bằng tập người trên xe (không chạm vật, không sót ai) **và** báo đúng số vượt. Người chơi đếm đúng từng người nhưng báo sai số vượt thì không có điểm đếm. *(Đã làm ở GĐ-T13.)*
- "Nặng đến nhẹ" đo bằng mức phạt tối đa của dòng `violations` đã duyệt; hai lỗi bằng nhau thì thứ tự nào cũng đúng (câu D19). Lỗi chưa có mức phạt đã duyệt không vào bước sắp. "Sai một cặp liền kề" là đổi chỗ đúng một cặp liền kề thì thành thứ tự đúng.
- *(Đã làm ở GĐ-T13.)* Bước sắp có điểm khi xe phải lập biên bản và có từ hai lỗi có mức phạt đã duyệt (kể cả chở quá số người); không thì điểm tối đa của xe không có 5 điểm thứ tự. Người chơi sắp các mục mình đã chỉ ra (chỗ đã chạm, mục "chở quá số người" khi báo có vượt); máy chủ bỏ mục chạm nhầm, mục trùng một lỗi, lỗi chưa có mức phạt, rồi chấm trên các lỗi thật còn lại (cần từ hai lỗi).
- Màn kết quả: sơ đồ khoang tô người đếm đúng, đếm dư, bỏ sót; từng lỗi, căn cứ; biên bản M4 theo thứ tự đúng.

**Dữ liệu cần**
- `game_content` loại `xe_khach`: sơ đồ khoang (lưới ghế, giường, lối đi; từng người: vị trí, người lớn hay trẻ em; vật dễ nhầm), giấy tờ (M1), dữ liệu giám sát (các đoạn lái, nghỉ, tốc độ). 20 xe demo `[Demo]`.
- Luật: đề xuất dùng lại `document_rules`, nhóm `van_tai_khach` (câu D16): phù hiệu còn hạn, đúng xe; lệnh vận chuyển đúng xe, đúng lái xe, đúng ngày; thời gian lái liên tục và trong ngày không vượt ngưỡng (ngưỡng là tham số của luật có duyệt, không đặt trong mã); quy tắc tính số người.
- **Cách tính trẻ em** là quy tắc dễ sai: ghi riêng ở bảng cần kiểm, không tự đặt. Chưa có luật đã duyệt thì xe có trẻ em không vào lượt.

**Mô-đun**
- M1 mở rộng thêm `lenh_van_chuyen`, `phu_hieu`, `giam_sat_hanh_trinh` (hỏi trước khi sửa M1). *(Đã làm ở GĐ-T13, người dùng đồng ý: `LOAI_GIAY_TO_VAN_TAI`, `kiemTraGiayToVanTai`, nhóm luật `van_tai_khach` với `KIEU_KIEM_VAN_TAI`, `PHAN_VAN_TAI`, `LOI_VAN_TAI`, `loiVanTaiCuaLuat`, kiểm tham số ngưỡng. Bộ chạy luật ở `len-xe-khach.ts`, như T11.)*
- M2: chạm, đóng dấu (dùng phần mở rộng nhãn của T12), `KeoTha` cho bước sắp lỗi. M3, M4, M8. *(Không sửa M2, M4.)*
- Sơ đồ khoang là phần riêng của trò, vẽ SVG. *(Đã làm: lưới ô dựng từ loại xe (`soDoKhoang`, dùng chung máy chủ và điện thoại), mỗi phần tử là một nút có hình SVG 24×24, để chạm được ≥ 48px và đi được bằng bàn phím.)*
- Giấy tờ dùng thẻ `TheGiayToChung` (T12). Màn giám sát cũng là một thẻ đó: mỗi đoạn chạy, dừng một dòng, thêm dòng tổng thời gian lái trong ngày do thiết bị tính; tốc độ lớn nhất chỉ để đọc.

**Dữ kiện gửi xuống điện thoại và đánh đổi:** sơ đồ phải vẽ được người lớn, trẻ em, vật dễ nhầm, nên loại hình của từng phần tử đi xuống điện thoại (thứ nhìn thấy được trên hình). Id phần tử sinh ngẫu nhiên theo lượt, không lộ loại. Không gửi: số chỗ đã quy đổi, số người vượt, lỗi, thứ tự nặng nhẹ. Người đọc mã đếm được số người: chấp nhận như trò 5. *(Đã làm: phần tử gửi đi sắp theo id; đề có số chỗ hành khách theo sơ đồ (thứ ghi trên xe), không có ngưỡng thời gian lái. Tổng thời gian lái trong ngày là số thiết bị hiển thị nên được gửi; lái liên tục người chơi tự cộng từ các đoạn.)*

**Offline:** Có.

**Chế độ giảm chuyển động:** chuyển ba thẻ không có hiệu ứng trượt; số thứ tự người hiện tĩnh; dấu không đập. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

Tra kho ngày 28/9/2026 (khi làm GĐ-T13): 0 kết quả cho chở quá số người, lệnh vận chuyển, phù hiệu, thiết bị giám sát hành trình, thời gian lái xe liên tục và trong ngày, trẻ em trên xe ô tô. Kho chỉ có 2 nghị định mẫu về quản lý hoạt động thử nghiệm. Mọi luật ở `data/tra-cuu/luat-van-tai-khach.json` ghi căn cứ `vn:chua-co-trong-kho`; 4 dòng mức phạt `oto-khach-*` ghi `…168/2024/NĐ-CP#dieu-chua-xac-dinh` như các dòng của T12, số tiền là số minh họa.

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Cách tính số người chở vượt; số chỗ lấy từ giấy nào | Luật `vt-so-nguoi` | Kho chưa có văn bản. Trò lấy số chỗ hành khách theo sơ đồ khoang, không kể chỗ người lái (xe 16 chỗ: 15; 29 chỗ: 28; 45 chỗ: 44; giường nằm: 36 giường) |
| 2 | **Cách tính trẻ em** khi xác định số người trên xe | Luật `tre_em` (chưa có) | Quy tắc dễ sai; không tự đặt. Tệp luật cố ý không có luật này, nên 3 xe có trẻ em (XK-07, XK-08, XK-20) không vào lượt. Luật có dạng `so_tre` trẻ tính bằng `bang_nguoi` người, làm tròn lên hoặc xuống; một trẻ không tính hơn một người |
| 3 | Nội dung bắt buộc của lệnh vận chuyển; khi nào coi là sai (đúng xe, đúng lái xe, đúng ngày; lệnh ghi nhiều lái xe, chuyến qua đêm) | Luật `vt-lenh-*` | Kho chưa có văn bản |
| 4 | Phù hiệu: loại, thời hạn, gắn đúng xe; hết hạn đúng ngày kiểm tra | Luật `vt-phu-hieu-*` | Kho chưa có văn bản; trò tính hết hạn đúng ngày kiểm tra là còn giá trị (đề xuất) |
| 5 | Ngưỡng thời gian lái liên tục, trong ngày; cách tính thời gian nghỉ xen giữa; ca đúng bằng ngưỡng; "trong ngày" là ngày lịch hay 24 giờ | Luật `vt-lai-lien-tuc`, `vt-lai-trong-ngay` | Kho chưa có văn bản. Ngưỡng demo 240, 600 phút, nghỉ tối thiểu 15 phút là **số minh họa**; lần dừng ngắn hơn không ngắt lái liên tục và không tính vào thời gian lái; đúng bằng ngưỡng là không vượt (đề xuất) |
| 6 | Tốc độ ghi trên thiết bị giám sát có dùng làm căn cứ xử phạt không | Màn 4–5 | Chưa có căn cứ. Trò hiện tốc độ lớn nhất, chỉ để đọc, không chạm được |
| 7 | Thứ tự nặng nhẹ khi lập biên bản nhiều lỗi | Bước sắp lỗi | Câu D19 (đã chọn theo mức phạt tối đa) |
| 8 | Quy định riêng của xe giường nằm, chở khách nằm sàn | Màn 5 | Kho chưa có văn bản; trò coi người nằm sàn như người đứng lối đi (chở vượt) |
| 9 | Mức phạt của 4 hành vi (chở quá số người, lệnh vận chuyển, phù hiệu, thời gian lái); chở quá số người có phạt theo từng người vượt không | `data/tra-cuu/muc-phat.json`, dòng `oto-khach-*` | Số tiền là số minh họa; lệnh và phù hiệu cố ý cùng mức tối đa để thử bước sắp |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Sơ đồ khoang xe 16, 29, 45 chỗ và xe giường nằm, nhìn từ trên | Lưới ô dựng từ loại xe (`SoDoKhoangXe.tsx`), ghế trống là ô viền, giường nằm hai tầng xếp trên dưới | Có thể thay bằng hình khoang xe vẽ tay; giữ lưới ô chạm được |
| Người nhìn từ trên: ngồi, đứng, nằm sàn; người lớn, trẻ em | Tự vẽ: đầu tròn, vai elip, trẻ em nhỏ hơn; nằm thì xoay ngang | Người đứng, người ngồi hiện cùng một hình (khác ở chỗ ô lối đi hay ô ghế); cần hình rõ hơn nếu đơn vị thấy khó phân biệt |
| Vật dễ nhầm: hành lý, áo treo, túi | Tự vẽ SVG 24×24 | Đạt yêu cầu tối thiểu |
| Màn giám sát hành trình | Thẻ giấy tờ chung (T12): đoạn chạy, dừng, tổng thời gian lái, tốc độ lớn nhất | Giao diện giản lược, không theo phần mềm thật; có thể vẽ thêm trục thời gian |
| Lệnh vận chuyển, phù hiệu | Thẻ giấy tờ chung (T12), chữ chìm "MẪU TRÒ CHƠI" | Không theo mẫu phôi thật |

**Độ khó triển khai: Trung bình.** Phần tốn công là bố cục ba phần trên màn 360px và bộ luật vận tải có tham số.

### 5.14. Soi xe cải tạo

**Luật chơi**
- Một lượt 8 xe (màn 1: 5 xe, đề xuất). Mỗi xe có hình vẽ vector **nhìn nghiêng** và **nhìn sau**, cạnh đó là giấy chứng nhận kiểm định giản lược ghi thông số: kích thước bao, kích thước thùng, cỡ lốp, số chỗ, màu sơn, đèn.
- Thao tác:
  - **khoanh vùng** trên hình chỗ không khớp với giấy (thùng cơi nới, đèn gắn thêm, ống xả độ, lốp khác cỡ, đổi màu sơn, thêm ghế); kéo khung hoặc vẽ vòng, quy về hộp bao;
  - khoanh xong một vùng thì **chạm dòng tương ứng trên giấy** để nối cặp;
  - hết chỗ sai thì đóng dấu **Đạt** hoặc **Không đạt** (đề xuất nhãn).
- Có nút phóng to (2×) và **thước đo** kéo được hai đầu để đo kích thước trên hình; thước hiện số đo theo tỷ lệ hình (mm).

**Vòng đời một lượt:** mỗi xe là một bước. Xem hai hình, khoanh, nối, đo nếu cần, đóng dấu; máy chủ chấm.

**Màn chơi và độ khó**

| Màn | Nội dung | Giờ |
|---|---|---|
| 1 | Một chỗ sai rõ (đổi màu sơn, đèn gắn thêm) | Không tính giờ |
| 2 | 1–2 chỗ sai; có xe không sai chỗ nào (đề xuất) | Không tính giờ |
| 3 | Thêm lốp khác cỡ, ống xả độ (đề xuất) | 5 phút cả lượt (đề xuất) |
| 4 | Thêm thùng cơi nới thấy bằng mắt, thêm ghế nhìn qua cửa sổ (đề xuất) | 5 phút |
| 5 | 2–3 chỗ sai, một chỗ phải đo bằng thước mới thấy | 4 phút 30 giây (đề xuất) |

**Chấm điểm**

| Việc | Điểm |
|---|---|
| Mỗi chỗ sai khoanh đúng vùng (IoU ≥ 0,5 với vùng đáp án) | +5 |
| Nối đúng dòng trên giấy cho vùng đó | +3 |
| Khoanh nhầm (vùng không khớp chỗ sai nào) | −2, không âm |
| Dấu đúng (đề xuất) | +5 |

- Một vùng đáp án chỉ tính cho một vùng khoanh (khoanh trùng hai lần chỉ tính một lần).
- **Giới hạn diện tích:** vùng khoanh lớn hơn 25% diện tích hình (đề xuất) bị loại và tính là khoanh nhầm; tối đa 6 vùng mỗi hình (đề xuất). Khoanh cả hình để "trúng" mọi chỗ thì 0 điểm phần khoanh.
- IoU là hàm mới trong tệp của trò. `mo-phong/camera.ts` đã có `tyLePhu` (tỷ lệ phủ hộp bao xe), khác IoU; không sửa tệp đó.
- Màn kết quả: hai hình có vùng đáp án tô màu cạnh vùng người chơi khoanh; dòng giấy tương ứng; căn cứ; biên bản M4 cho xe không đạt.
- *(Đã làm ở GĐ-T14.)* **Màu sơn** không chấm bằng IoU: vùng đáp án là cả phần sơn, lớn hơn 25% hình. Khung được tính khi nằm ít nhất một nửa trong phần sơn. Khoanh trùng một chỗ không cộng, không trừ. Vùng đáp án của thùng cơi nới là phần cơi thêm cộng lề 10 đơn vị. Ống xả độ nối với dòng "kích thước bao" (giấy không có dòng ống xả).

**Dữ liệu cần**
- `game_content` loại `xe_cai_tao`: xe gốc theo tham số (loại xe, kích thước, thùng, lốp, số chỗ, màu, đèn), danh sách biến thể cải tạo áp lên xe, giấy ghi thông số của xe gốc.
- `game_content` loại `bien_the_cai_tao` (danh mục có duyệt): tên biến thể, dòng giấy tương ứng, cách biến đổi tham số hình, mã `violations`, căn cứ.
- *(Đã làm ở GĐ-T14: cả hai loại là `game_content` của trò `soi_xe_cai_tao`, phân biệt bằng `payload.kieu` = `bien_the` hoặc `xe`, như Tự lái. Giấy không soạn tay: suy từ tham số xe gốc. Thùng cơi nới dưới 250 mm (chỉ đo mới thấy) chỉ có ở màn 5.)*
- **Vùng đáp án không soạn tay:** hàm thuần tính từ biến thể và tham số hình, chỉ chạy ở máy chủ. Hình xe dựng từ tham số để sinh nhiều xe từ ít hình gốc.
- 16 xe demo `[Demo]` (đề xuất; mô tả gốc chưa nêu số).

**Mô-đun**
- M1 mở rộng thêm trường thông số kỹ thuật vào `giay_kiem_dinh` do T12 tạo (hỏi trước).
- M2: `KhoanhVung` (đã tách thành mô-đun ở GĐ-T5, không phải tách lại), đóng dấu (nhãn của T12). Thước đo là phần riêng của trò.
- M3, M4, M8.

**Dữ kiện gửi xuống điện thoại và đánh đổi:** hình phải vẽ cả phần cải tạo. Đề xuất máy chủ dựng hình thành danh sách nét (path SVG) không gắn tên bộ phận, thay cho tham số ngữ nghĩa ("thùng dài 4.600 mm"). Không gửi: danh sách biến thể, vùng đáp án, dòng giấy đúng. Người đọc mã vẫn đo được nét hình và so với giấy: đó chính là việc người chơi làm bằng thước, chấp nhận.

**Offline:** Có.

**Chế độ giảm chuyển động:** phóng to không có hiệu ứng thu phóng; nét khoanh hiện ngay khi nhấc tay. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

Ngày 29/9/2026 (khi làm GĐ-T14), máy chủ tra cứu văn bản `quydinhphapluat` mất kết nối nên **chưa tra được kho**. Người dùng chọn làm phần mã trước: 7 biến thể ở `data/tro-choi/bien-the-cai-tao.json` ghi căn cứ `vn:chua-co-trong-kho`. 4 dòng mức phạt `oto-cai-tao-*` ghi `…168/2024/NĐ-CP#dieu-chua-xac-dinh` như các dòng của T12, T13; số tiền là số minh họa. Khi nối lại cần tra bổ sung.

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Danh mục hành vi cải tạo, tự ý thay đổi kết cấu, kích thước thùng | `bien_the_cai_tao` | Chưa tra được kho |
| 2 | Đổi màu sơn: khi nào là vi phạm, thủ tục cần làm | Biến thể `bt-doi-mau-son` | Chưa tra được kho |
| 3 | Lắp thêm đèn, còi | Biến thể `bt-den-noc` (chưa có biến thể còi: còi không vẽ được trên hình) | Chưa tra được kho |
| 4 | Lốp khác cỡ so với giấy: lệch bao nhiêu thì là vi phạm | Biến thể `bt-lop-lon` (xe mẫu lệch từ 60 mm đường kính) | Chưa tra được kho |
| 5 | Dung sai kích thước thùng trước khi coi là cơi nới | Màn 5 | Chưa có căn cứ. Trò coi mọi phần cơi thêm từ 100 mm là cơi nới; dưới 250 mm chỉ đo mới thấy (màn 5) |
| 6 | Mã mức phạt từng biến thể; ống xả, lốp, ghế dùng chung dòng "thay đổi kết cấu" | `violations`, dòng `oto-cai-tao-*` | Bản nháp, số minh họa |
| 7 | Ống xả nhô ra có tính là sai kích thước bao không | Biến thể `bt-ong-xa` (nối dòng "kích thước bao") | Đề xuất của trò; giấy không có dòng ống xả |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Ô tô con, xe tải thùng, xe khách, xe bán tải nhìn nghiêng và nhìn sau, dựng từ tham số | Tự vẽ giản lược từ tham số (`hinh-xe-tham-so.ts`): ô tô con, xe khách 16 chỗ, xe tải thùng kín; chưa có xe bán tải | Có thể vẽ chi tiết hơn; giữ dựng từ tham số và vùng đáp án tính từ cùng hình học |
| Bộ phận biến thể: thùng cơi nới, đèn phụ, ống xả, lốp, ghế thêm | Tự vẽ trong cùng bộ dựng hình (ghế thêm là đầu người qua cửa sổ cuối) | Đạt yêu cầu tối thiểu |
| Thước đo | `ThuocDo.tsx`: hai đầu kéo có bán kính tính theo tỷ lệ hiển thị (vùng chạm ≥ 48px), số đo 12 đơn vị hình | Số đo nên to hơn khi phóng to |
| Giấy chứng nhận kiểm định có thông số | Thẻ giấy tờ chung (T12), chữ chìm "MẪU TRÒ CHƠI" | Không theo mẫu phôi thật |

**Độ khó triển khai: Trung bình.** Phần tốn công là hình xe dựng từ tham số đủ rõ ở 360px, và hàm tính vùng đáp án từ biến thể.

### 5.15. Dựng chốt an toàn ban đêm

**Luật chơi**
- Người chơi được giao một đoạn đường vào ban đêm (thẳng, cong, dốc, gần giao lộ) và một **túi đồ**: cọc tiêu, biển báo tạm, đèn cảnh báo, xe tuần tra, 2–4 chiến sĩ. Số lượng từng thứ ghi trên túi.
- Kéo từng vật vào vị trí trên đoạn đường, xoay hướng biển (hướng rời rạc), đặt vị trí đứng cho từng chiến sĩ. Vị trí đặt theo lưới 1 m dọc đường và theo làn, lề ngang đường (đề xuất). Đặt ngoài phần đường hợp lệ bị từ chối.
- Bấm **"Chạy thử"**: M5 cho dòng xe chạy qua trong 60 giây mô phỏng. Kết quả hiện:
  - xe nào phanh gấp;
  - xe nào đi vào vùng nguy hiểm của chiến sĩ;
  - ùn tắc dài bao nhiêu mét;
  - biển nào đặt quá gần chốt hoặc bị khuất tầm nhìn.
- Mỗi màn được chạy thử tối đa 2 lần. Sau lần chạy thử thứ hai vẫn sửa được; bấm "Nộp" thì máy chủ chạy bố trí lúc nộp để chấm (đề xuất; khác trò 3 ở chỗ chấm bố trí lúc nộp, không phải lúc chạy thử cuối).

**Vòng đời một lượt:** một màn là một bước. Đặt vật, chạy thử (tối đa 2 lần), sửa, nộp; máy chủ dựng lại bố trí từ nhật ký (M7), chạy M5, chấm. Thoát giữa chừng thì nhật ký đặt vật lưu ở máy khách, vào lại dựng lại bố trí.

**Màn chơi và độ khó** (đề xuất trừ màn 1, 3, 5)

| Màn | Đoạn đường | Dòng xe | Túi đồ |
|---|---|---|---|
| 1 | Đường thẳng | Ít xe, ô tô con | 2 biển, 6 cọc, 1 đèn, 2 chiến sĩ |
| 2 | Đường thẳng có lề hẹp | Thêm xe máy | 2 biển, 8 cọc, 2 đèn, 2 chiến sĩ |
| 3 | Đường cong, tầm nhìn ngắn | Vừa | 3 biển, 10 cọc, 2 đèn, 3 chiến sĩ |
| 4 | Đầu dốc | Vừa, có xe khách | 3 biển, 10 cọc, 3 đèn, 1 xe tuần tra, 3 chiến sĩ |
| 5 | Gần giao lộ | Có xe tải, có xe chạy quá tốc độ, xe từ đường ngang rẽ vào ngay sau giao lộ | 4 biển, 12 cọc, 3 đèn, 1 xe tuần tra, 4 chiến sĩ |

Đã làm (GĐ-T15, 29/9/2026): màn 4–5 có thêm 1 xe tuần tra (túi đồ ở mô tả có xe tuần tra nhưng bảng cũ chưa ghi). Đoạn đường là một chiều hai làn; kiểm nội dung bắt màn 3 phải có đoạn cong, màn 4 đỉnh dốc, màn 5 giao lộ, xe tải và xe quá tốc độ. Xe khách chạy trong M5 như xe tải (cùng cỡ, cùng tốc độ), chỉ khác tên hiện ra.

**Chấm điểm** (đề xuất; mọi ngưỡng nằm trong nội dung có duyệt `tieu_chi_chot`, không đặt trong mã)

| Tiêu chí | Điểm tối đa | Cách tính |
|---|---|---|
| Khoảng cách từ biển đầu tiên tới chốt trong khoảng cho phép | 20 | Trong khoảng: 20; ngoài khoảng: 0 |
| Cọc thu hẹp làn liền mạch, đủ số cọc tối thiểu | 15 | Theo số đoạn hở |
| Chiến sĩ đứng ngoài vùng nguy hiểm | 20 | Chia đều cho số chiến sĩ |
| Số xe phanh gấp | 20 | 0 xe: 20; mỗi xe trừ 5 |
| Độ dài ùn tắc dưới ngưỡng | 15 | Dưới ngưỡng: 15; gấp đôi ngưỡng: 0; tuyến tính giữa hai mốc |
| Biển không bị khuất tầm nhìn | 10 | Trừ 5 mỗi biển bị khuất |

- Máy chủ chạy lại M5 từ ảnh chụp đề và nhật ký đặt vật; bỏ qua mọi kết quả máy khách gửi. Nhật ký có mốc thời gian sai (§1.2) thì cả bước 0 điểm. Chạy thử quá 2 lần thì cả bước 0 điểm (như trò 3).
- Màn kết quả: từng tiêu chí đạt hay không, phát lại lúc xe phanh gấp, căn cứ (hoặc "tài liệu nghiệp vụ do đơn vị cung cấp").
- Đã làm (GĐ-T15, 29/9/2026):
  - Khoảng cách biển đầu tiên chấm bằng mét với ngưỡng demo (câu D21); "biển đầu tiên" là biển xa chốt nhất, quay về phía xe tới, đặt trước chốt.
  - Cọc: chỉ tính cọc trên làn thu hẹp; hàng cọc chưa tới chốt (cọc cuối cách chốt quá ngưỡng) tính thêm một đoạn hở; ít hơn số cọc tối thiểu thì 0 điểm.
  - Chiến sĩ chưa đặt không được phần điểm của mình. Không đặt biển nào thì tiêu chí "biển không bị khuất" 0 điểm (tránh để trống mà vẫn đủ điểm). Biển quay sai hướng tính là bị khuất.
  - Kết quả chạy thử không dùng ngưỡng: "biển quá gần" là biển cách vùng chốt ngắn hơn quãng giảm tốc êm từ tốc độ thường (≈ 26 m); "biển bị khuất" là biển bị đoạn cong, dốc che bớt tầm nhìn (hiện tầm nhìn còn lại, tính bằng mét).
  - Màn kết quả hiện ảnh tĩnh lúc xe đầu tiên phanh gấp (dựng lại bằng cùng bộ mô phỏng), chưa phát lại thành hoạt cảnh.
  - Ngưỡng hàng chờ demo hạ xuống 20 m (đường thẳng), 30 m (cong, dốc), 40 m (giao lộ): dòng xe màn 1 thưa, chặn kín cả hai làn trong 60 giây cũng chỉ tạo hàng chờ khoảng 30 m.
  - Mô hình trong M5: xe thấy (hoặc đã qua) một vật cảnh báo (biển quay về phía xe tới, đèn, xe tuần tra) thì giảm dần về 30 km/h trước vùng chốt; chưa được cảnh báo thì chỉ giảm khi thấy vùng chốt ở gần, dễ phải phanh gấp. Vật đặt trong làn là vật cản: xe sang làn còn lại khi đủ chỗ, không thì dừng chờ (ùn). Vùng chốt: từ vật đầu tiên trong làn (hoặc 10 m trước chốt) tới 10 m sau vật cuối.

**Dữ liệu cần**
- `game_content` loại `chot_dem`: đoạn đường (M5), vị trí chốt, túi đồ, luồng xe (seed, lưu lượng, tỷ lệ loại xe, xe quá tốc độ), mã bộ tiêu chí.
- `game_content` loại `tieu_chi_chot`: ngưỡng từng tiêu chí, nguồn (văn bản hoặc tài liệu nghiệp vụ).
- 10 đoạn đường demo `[Demo]`.

**Mô-đun**
- M5 mở rộng (hỏi trước): **vật cản tạm** (cọc, xe đỗ chiếm làn); **tầm nhìn đêm** (khoảng tài xế thấy được theo đèn pha, đèn cảnh báo và độ cong, tính bằng bảng tra, không dùng hàm lượng giác); xe thấy biển tạm, đèn cảnh báo thì giảm tốc; **vùng nguy hiểm quanh người**, sự kiện `vao_vung_nguy_hiem`; đo **độ dài hàng chờ**.
- M2 (`KeoTha`, có chạm-chạm và bàn phím), M3, M6 (chế độ đêm đã có từ trò 5; thêm đèn cảnh báo), M7, M8.

**Dữ kiện gửi xuống điện thoại và đánh đổi:** chạy thử trên điện thoại cần đủ đoạn đường, luồng xe, phản ứng của xe (như trò 3). Không gửi ngưỡng tiêu chí. Người chơi dùng chạy thử để dò bố trí tốt: đó là chủ ý của trò, giới hạn bằng 2 lần chạy thử.

**Offline:** Có.

**Chế độ giảm chuyển động:** chạy thử hiện kết quả thành ảnh tĩnh ở các mốc 10 giây, có nút tới, lùi; đèn cảnh báo sáng tĩnh, không nhấp nháy. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Báo hiệu khi tổ chức kiểm soát trên đường; khoảng cách đặt biển tạm, cọc | `tieu_chi_chot` | QCVN 41:2024/BGTVT chưa có trong kho; trò 3 đã quyết định không chấm khoảng cách bằng mét khi chưa có căn cứ (câu D21) |
| 2 | Vị trí đứng, tác phong của chiến sĩ | Tiêu chí vùng nguy hiểm | Tài liệu nghiệp vụ do đơn vị cung cấp; đang dùng quy tắc chung, đánh dấu demo |
| 3 | Bán kính vùng nguy hiểm quanh người (đang dùng 1,5 m tính từ mép thân xe) | `BAN_KINH_VUNG_NGUY_HIEM_CM`, `mo-phong/vat-can.ts` | Thông số mô phỏng |
| 4 | Tầm nhìn ban đêm: biển phản quang 50 m, cọc 20 m, đèn cảnh báo và đèn nóc 200 m, vật trong 15 m quanh đèn 100 m (biển) hoặc 60 m (cọc); qua khúc cua thoải 40 m, gắt 20 m, đỉnh dốc 50 m và 25 m | Bảng tra `mo-phong/tam-nhin.ts` | Thông số mô phỏng |
| 5 | Ngưỡng ùn tắc chấp nhận được (demo 20, 30, 40 m) | `tieu_chi_chot` | Phán đoán nghiệp vụ |
| 6 | Mọi ngưỡng ở `data/tro-choi/tieu-chi-chot.json` (khoảng cách biển đầu 60–150 m hoặc 80–180 m, cọc cách nhau ≤ 5–6 m, tầm nhìn tới biển ≥ 35–40 m, các mức trừ) | `tieu_chi_chot` | Số minh họa. Ngày 29/9/2026 chưa tra được kho văn bản (MCP `quydinhphapluat` không kết nối được); cần tra lại quy định báo hiệu khi tổ chức kiểm soát trên đường |
| 7 | Chiến sĩ đứng trong làn đã thu hẹp, sau hàng cọc, có được coi là vị trí đúng không | Bố trí mẫu ở e2e và DEMO.md | Tài liệu nghiệp vụ do đơn vị cung cấp |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Đường ban đêm từ trên xuống (thẳng, cong, dốc, giao lộ) | Sơ đồ Canvas tự vẽ (`ve-chot.ts`): 4 cột bằng nhau, đoạn cong, dốc tô tối kèm nhãn, chưa vẽ đường uốn cong thật | Hình đường cong, dốc rõ hơn |
| Cọc tiêu, biển tạm, đèn cảnh báo | Hình vẽ Canvas đơn giản: tam giác cam, biển tam giác viền đỏ, chấm vàng có quầng | SVG 16×16 đến 24×24 px; biển theo QCVN 41 khi có |
| Xe tuần tra | Khối trắng có đèn nóc xanh, đỏ; không chữ, không logo | Giữ yêu cầu: không logo, không chữ ngành |
| Chiến sĩ nhìn từ trên | Vai áo phản quang và đầu; không phù hiệu, cấp hiệu | Bóng dáng rõ hơn |
| Vùng nguy hiểm, vệt phanh gấp | Hình elip bán trong suốt (đỏ khi có xe vào), tam giác đỏ ở chỗ phanh gấp | Kiểm tương phản ≥ 3:1 trên màn thật |

**Độ khó triển khai: Cao.** Mở rộng M5 (vật cản, tầm nhìn, vùng quanh người) mà không làm hỏng trò 3, 5, 9.

### 5.16. Phân luồng khi có sự cố

**Luật chơi**
- Bản đồ khu phố dạng ô (M9) có sự cố: tai nạn chắn 2 làn, sự kiện đông người, ngập nước, sửa đường.
- Người chơi có 5 phút thời gian mô phỏng và một số **rào chắn**, **biển hướng đi tạm**, **chiến sĩ điều tiết**.
- Thao tác: đặt rào đóng một đoạn giữa hai ô; đặt biển chỉ hướng đi tạm ở giao lộ; đặt chiến sĩ tại giao lộ để ưu tiên một hướng.
- Bấm **"Chạy"**: M5 mô phỏng lưu lượng, bản đồ tô màu độ ùn theo đoạn. Người chơi **sửa trong lúc chạy** (có nút tạm dừng); mỗi thay đổi ghi theo nhịp.
- Mục tiêu từng màn: xe cứu thương vào tới hiện trường trong X giây; tổng thời gian trễ của các xe dưới ngưỡng; không có xe đi vào đoạn đã đóng.

**Vòng đời một lượt:** một kịch bản là một bước. Đặt vật ban đầu, chạy 5 phút mô phỏng (sửa, tạm dừng khi cần), hết giờ mô phỏng thì nộp; máy chủ chạy lại M5 từ nhật ký. Được chạy lại từ đầu một lần (đề xuất). Thoát giữa chừng thì mô phỏng dừng, nhật ký lưu ở máy khách.

**Màn chơi và độ khó**

| Màn | Nội dung | Lưới | Giờ mô phỏng |
|---|---|---|---|
| 1 | Một sự cố, lưu lượng thấp | 6×6 | 5 phút |
| 2 | Một sự cố, lưu lượng vừa, có xe cứu thương (đề xuất) | 8×8 | 5 phút |
| 3 | Sự cố kéo dài (ngập, sửa đường), phải phân luồng cả khu (đề xuất) | 8×8 | 5 phút |
| 4 | Sự kiện đông người, giao lộ có đèn (đề xuất) | 10×10 | 5 phút |
| 5 | Hai sự cố cùng lúc, giờ cao điểm, có đường một chiều | 10×10 | 5 phút |

**Chấm điểm** (đề xuất)

| Mục tiêu | Điểm tối đa |
|---|---|
| Xe cứu thương tới hiện trường trong X giây (màn không có xe cứu thương: chia điểm cho hai mục dưới) | 40 |
| Tổng thời gian trễ dưới ngưỡng; tuyến tính tới 0 ở mức gấp đôi ngưỡng | 30 |
| Không xe nào đi vào đoạn đã đóng; trừ 5 mỗi xe | 20 |
| Phương án gọn: 10, trừ 2 mỗi vật dùng thêm so với phương án mẫu | 10 |

- X, ngưỡng trễ, phương án mẫu nằm trong kịch bản, chỉ máy chủ giữ.
- **Kịch bản không có lời giải bị trình soạn từ chối:** người soạn nộp một phương án mẫu; bộ kiểm chạy M5 với phương án đó, không đạt mọi mục tiêu thì không lưu được và không duyệt được. Kiểm khi duyệt, không kiểm lúc chơi.
- Màn kết quả: bản đồ độ ùn cuối, dòng thời gian thay đổi của người chơi, phương án mẫu, căn cứ.

**Dữ liệu cần**
- `game_content` loại `phan_luong`: bản đồ M9, sự cố (vị trí, loại, thời điểm), lưu lượng theo giờ (tham số), lộ trình xe cứu thương, mục tiêu và ngưỡng, số vật được phát, phương án mẫu (chỉ máy chủ).
- 10 kịch bản demo `[Demo]`.

**Mô-đun**
- M9 (bản đồ ô). GĐ-T6 chưa tạo M9: tới T16 mà T6 vẫn chưa làm thì dừng và hỏi (quy tắc 11 của Phần chung, câu D22).
- M5 mở rộng (hỏi trước): **lưu lượng theo giờ** (xe sinh theo tham số lưu lượng từng lối vào), xe chọn đường theo M9 và đổi đường khi gặp rào hoặc biển hướng tạm, **đo độ ùn theo đoạn**. Làn M5 dựng từ tuyến ô như trò 9 đã làm. Giới hạn 60 xe cùng lúc (đề xuất) để chạy lại dưới 200 ms.
- M2, M3, M6, M7, M8.

**Dữ kiện gửi xuống điện thoại và đánh đổi:** mô phỏng chạy trên điện thoại nên cần bản đồ, sự cố, tham số lưu lượng, seed. Không gửi phương án mẫu, mục tiêu X và ngưỡng (hiện mục tiêu bằng chữ "càng sớm càng tốt" ở màn 1–2 và con số ở màn 3–5, đề xuất). Người chơi thấy trước hậu quả khi chạy: đó là lối chơi.

**Offline:** Có.

**Chế độ giảm chuyển động:** mô phỏng chạy từng đoạn 10 giây rồi dừng; xe vẽ thành mật độ màu theo đoạn, không vẽ từng xe chạy; màu ùn đổi ngay, không chuyển dần. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Tổ chức giao thông, phân luồng khi có sự cố | Màn kết quả | Kho chưa có văn bản |
| 2 | Quyền ưu tiên của xe cứu thương, cứu hỏa | Mục tiêu xe cứu thương | Kho chưa có văn bản |
| 3 | Biển hướng đi tạm, rào chắn | Túi đồ | QCVN 41:2024/BGTVT chưa có trong kho |
| 4 | Kịch bản phân luồng mẫu của đơn vị | Phương án mẫu | Tài liệu nội bộ, đánh dấu demo |
| 5 | Mô hình lưu lượng, ngưỡng trễ | Thông số M5, kịch bản | Thông số mô phỏng |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Ô bản đồ (đường, nhà, giao lộ) | M9 (khi có); trò 9 đang vẽ ở `lib/ve-canh/ve-pho.ts` | Dùng lại |
| Rào chắn, biển hướng tạm, chiến sĩ điều tiết | Chưa có | SVG theo ô, ≤ 3 KB mỗi hình |
| Biểu tượng sự cố: tai nạn, ngập, sự kiện, sửa đường | Chưa có | SVG 24×24, một màu |
| Lớp màu ùn theo đoạn | Chưa có | Thang 3–4 bậc, phân biệt được khi mù màu (thêm độ dày nét) |
| Xe cứu thương | Chưa có | Từ trên xuống, có đèn, không logo |

**Độ khó triển khai: Cao.** Mô phỏng lưu lượng trên cả khu phố trong giới hạn chạy lại 200 ms, và bộ kiểm "kịch bản có lời giải".

### 5.17. Truy vết xe bỏ trốn

**Luật chơi**
- Lượt mở đầu bằng **tin báo** dạng chữ, có nút nghe (giọng đọc có sẵn, `/v1/giong-doc`, cần mạng): xe gây tai nạn bỏ chạy, kèm mô tả một phần (loại xe, màu, 2–3 ký tự biển số, hướng chạy, thời điểm).
- Bản đồ khu phố (M9) có các điểm camera. Chạm một camera thì xem **đoạn cảnh 10 giây** quanh thời điểm trò tính theo quãng đường từ lần khóa trước (quãng đường ngắn nhất chia tốc độ trung bình của loại xe, đề xuất).
- Thao tác:
  - chạm đúng xe khớp mô tả trong dòng xe để **khóa** xe (cách chạm xe của trò 5, `KhoanhVung` `onCham`);
  - chọn camera kế tiếp theo hướng xe đi;
  - tới camera cuối thì đặt **điểm chặn** trên bản đồ (chạm một giao lộ).
- **Ngân sách lượt xem camera:** mở camera sai hướng tốn một lượt và 30 giây thời gian trong trò (đề xuất); xe tiếp tục chạy trong lúc đó.
- Điểm chặn đúng khi nằm trên lộ trình phía trước của xe và xe tới đó muộn hơn lúc đặt ít nhất 60 giây trong trò (đề xuất).

**Vòng đời một lượt:** một vụ là một lượt. Mỗi lần mở camera là một bước; đặt điểm chặn là bước cuối. Khung chung hiện sinh mọi đề ngay khi tạo lượt, nên "đề của bước sau phụ thuộc camera người chơi chọn ở bước trước" cần sửa khung (câu D23). Thoát giữa chừng: đồng hồ trong trò dừng theo máy chủ (tính theo nhịp mô phỏng, không theo giờ thật).

**Màn chơi và độ khó**

| Màn | Camera | Xe mồi | Lượt xem |
|---|---|---|---|
| 1 | 3 | Không; xe mục tiêu là xe duy nhất cùng màu | 5 (đề xuất) |
| 2 | 4 | 1 xe cùng màu khác loại (đề xuất) | 6 |
| 3 | 5 | Xe cùng loại, cùng màu, khác ký tự biển số (đề xuất) | 7 |
| 4 | 6 | 2 xe mồi; xe rẽ vào ngõ giữa hai camera (đề xuất) | 8 |
| 5 | 8 | Xe mồi giống mô tả; có đoạn khuất camera phải suy ra | 10 |

Cột "Camera" là số camera trên đường xe chạy; bản đồ có thêm camera khác (ít nhất một) để người chơi phải chọn.

**Chấm điểm** (đề xuất)

| Việc | Điểm |
|---|---|
| Khóa đúng xe ở mỗi camera | +5 |
| Khóa nhầm | −3, không âm |
| Đặt điểm chặn đúng | +20 |
| Mỗi lượt xem còn dư | +2, tối đa 10 |

- Máy chủ sinh lại lộ trình từ seed, chấm từ nhật ký (camera đã mở, nhịp mở, xe đã khóa theo id của đoạn cảnh, điểm chặn).
- **Mở camera chưa được phép theo thời gian mô phỏng** (thời điểm yêu cầu sớm hơn lúc xe có thể tới) bị từ chối.
- Màn kết quả: lộ trình thật trên bản đồ, camera đã mở, lúc khóa nhầm, căn cứ về hành vi bỏ chạy sau tai nạn và trách nhiệm người điều khiển liên quan tới vụ tai nạn.

**Dữ liệu cần**
- `game_content` loại `truy_vet`: bản đồ M9, camera (ô, hướng nhìn), seed, xe mục tiêu (loại, màu, biển số), xe mồi, mật độ xe nền, tin báo, ngân sách lượt xem.
- **Lộ trình và thời điểm sinh tất định từ seed** trên M9 và M5, không soạn tay. Bộ kiểm khi duyệt: lộ trình qua ít nhất số camera của màn; xe mồi không khớp hoàn toàn mô tả; có ít nhất một điểm chặn đúng.
- 8 vụ demo `[Demo]` (đề xuất; mô tả gốc chưa nêu số).

**Mô-đun:** M5 (xe chạy trên tuyến ô), M6 (phát lại đoạn cảnh, khung camera của trò 5), M7, M9, M3, M8. Khoanh hoặc chạm xe dùng lại `KhoanhVung` (M2).

**Dữ kiện gửi xuống điện thoại và đánh đổi**
- Máy khách chỉ nhận đoạn cảnh của camera đã mở: vị trí các xe trong 10 giây theo nhịp. Id xe sinh riêng cho từng đoạn cảnh, để không lần theo id từ đoạn này sang đoạn khác.
- Không gửi lộ trình, id xe mục tiêu, điểm chặn đúng. Test quét khóa cấm thêm `lo_trinh`, `xe_muc_tieu`, `diem_chan`, `seed_lo_trinh`.
- **Offline mâu thuẫn với yêu cầu trên:** gói offline phải mang seed và lộ trình để điện thoại tự dựng đoạn cảnh (câu D24).

**Offline:** Có, nếu D24 chấp nhận gói mang cả lộ trình. Nút nghe tin báo cần mạng; offline chỉ hiện chữ.

**Chế độ giảm chuyển động:** đoạn cảnh hiện theo khung tĩnh mỗi giây, có nút tới, lùi; bản đồ không cuộn tự động. Chấm giống hệt.

**Đã làm (GĐ-T17, 30/9/2026; câu D22, D23, D24 ở §8)**
- **Không sửa khung (D23):** một vụ là một bước. Route riêng `POST /v1/truy-vet/luot/:id/camera` (qua cầu nối `/api`) nhận `{ camera, cho, khoa }`, kiểm bằng cùng hàm với bộ chấm (`apThaoTacTV`), ghi thao tác "khoa", "mo" vào `game_runs.items[0].noi_dung.nhat_ky` trong giao dịch khóa dòng lượt (cùng khóa với `ghiBuoc`), trả đoạn cảnh. Bước cuối (đặt điểm chặn) nộp qua `/v1/luot-choi` như mọi trò; khi chấm online máy chủ lấy lượt mở camera, khóa từ nhật ký của route, chỉ nhận thao tác "khoa" (đoạn cuối), "chan" của máy khách. Vào lại lượt thì đề có sẵn các đoạn cảnh đã mở.
- **Đồng hồ trong trò** (giây từ lúc xảy ra): bắt đầu ở lúc nhận tin báo. Thời điểm đoạn cảnh = mốc khóa gần nhất (camera và giờ; chưa khóa thì nơi xảy ra lúc 0) + số ô đường ngắn nhất × số giây mỗi ô của loại xe (ô tô con 8 m/s, xe máy 7 m/s, xe tải 6 m/s, làm tròn lên từng ô). Đoạn 10 giây quanh thời điểm đó, lệch ngẫu nhiên −2…2 giây để xe cần tìm không luôn ở giữa. **Mở camera khi đồng hồ chưa tới thời điểm + 5 giây bị từ chối** (409, kèm số giây phải chờ), trừ khi chọn chờ (đồng hồ nhảy tới). Mỗi lần xem tốn 15 giây và một lượt; camera không thấy xe tốn thêm 30 giây (người chơi thấy đồng hồ nhảy, nên biết đã mở sai). Khóa xe ở đoạn nào thì mốc chuyển sang camera đó, dù khóa đúng hay nhầm.
- **Lộ trình sinh từ seed** của vụ và một trong 3 biến thể (lượt chọn ngẫu nhiên): đường đi ngẫu nhiên trên M9, rẽ ở giao lộ có camera 50%, ở giao lộ không camera 15% (màn 4) hoặc 30% (màn 5), ít đi về phía sắp ra khỏi bản đồ khi chưa qua đủ camera. Nhận đường đầu tiên (tối đa 1.000 lần thử) thỏa: qua đúng số camera của màn; mỗi chặng giữa hai điểm quan sát là đường ngắn nhất (để thời điểm tính theo quãng đường khớp lúc xe tới thật); số chặng có rẽ ở giao lộ không camera nằm trong khoảng của màn (màn 1–3: 0; màn 4: 1; màn 5: 2–3); sau camera cuối xe không rẽ ở giao lộ nào; chơi đúng thì còn ít nhất 2 ô chặn đúng. Bộ kiểm chạy đủ 3 biến thể. Lộ trình lưu trong ảnh chụp bước, không gửi người chơi.
- **Đoạn cảnh**: ngã tư quanh ô camera (các nhánh theo ô đường kề), xe đi theo làn M5 (vào, qua ngã tư, ra), điện thoại tự chạy M5 và vẽ (tệp M6 mới `ve-truy-vet.ts`). Xe trong đoạn: xe bỏ chạy (khi lộ trình qua camera trong đoạn), xe mồi (cố định hình dáng trong lượt, sinh từ bí mật của lượt), xe nền. Hai xe qua tâm cách nhau ít nhất 2,5 giây (cùng nhánh vào hoặc ra: 4 giây); chạy M5 còn va chạm thì bỏ xe nền, rồi xe mồi. Id xe sinh riêng cho từng đoạn từ bí mật của lượt. Màn 4, 5 che bớt một chữ số biển của một nửa số xe.
- **Xe mồi theo màn**: màn 2 cùng màu khác loại; màn 3 cùng loại, cùng màu, biển không có ký tự người báo nhớ; màn 4 cả hai loại trên; màn 5 cùng loại, cùng màu, biển có một chữ số dễ nhầm (3/8, 1/7, 5/6…) thay trong nhóm ký tự người báo nhớ, cộng một xe khác biển. Xe nền không bao giờ khớp mô tả; màn 1 xe nền khác màu xe cần tìm.
- **Chấm** (D15): khóa đúng +5, khóa nhầm −3, điểm chặn đúng +20, lượt xem còn dư +2 mỗi lượt tối đa 10 **chỉ khi chặn đúng** (để không được thưởng khi không xem camera nào); điểm bước không âm. Điểm tối đa = 5 × số camera trên lộ trình + 20 + thưởng khi xem vừa đủ. Điểm chặn đúng khi ô nằm trên lộ trình và xe tới ô đó muộn hơn đồng hồ lúc đặt ít nhất 60 giây.
- **Giao diện**: tin báo có nút "Nghe tin báo" (`useDocThanhTieng`, ẩn khi máy chủ không có giọng đọc hoặc mất mạng); bản đồ SVG (M9 `BanDoO`), chạm gần camera thì chọn camera, có danh sách chọn camera thay thế; thẻ camera báo giờ đoạn cảnh và thời gian phải chờ; chạm xe trong khung (M2 `KhoanhVung` `onCham`) hoặc chọn trong danh sách xe đang hiện; thẻ xe: loại, màu, biển như thấy, nhánh vào, nhánh ra. Xe đang chọn được khóa khi mở camera kế tiếp hoặc khi chốt điểm chặn. Điểm chặn: chạm ô đường, nút Lên, Xuống, Trái, Phải dời sang ô đường kế tiếp, hoặc phím mũi tên và Enter trên bản đồ.
- **Offline (D24)**: trang offline truyền ảnh chụp bước (`buocOffline`), điện thoại mở camera, khóa bằng cùng hàm; nộp cả nhật ký, máy chủ chạy lại khi đồng bộ. Lượt offline chưa giữ được tiến độ khi thoát giữa chừng (như các trò offline khác).
- Tra kho văn bản ngày 30/9/2026 (bỏ chạy sau tai nạn, trách nhiệm người điều khiển liên quan tới vụ tai nạn, "tai nạn giao thông"): không có kết quả; kho chỉ có 2 nghị định. Màn kết quả ghi "Căn cứ đang được cập nhật", không viện dẫn theo trí nhớ.

**Cần đơn vị chuyên môn kiểm tra**

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Hành vi bỏ chạy sau tai nạn; trách nhiệm của người điều khiển phương tiện liên quan tới vụ tai nạn | Màn kết quả (`can_cu` của vụ, đang rỗng) | Kho chưa có văn bản (tra ngày 30/9/2026) |
| 2 | Nội dung trò có lộ phương pháp nghiệp vụ không được công bố không | Toàn trò | Trò chỉ dùng quan sát và suy luận chung; cần đơn vị xác nhận |
| 3 | Lời văn tin báo mẫu | `data/tro-choi/truy-vet.json` | Hệ thống soạn theo khuôn; cần người soạn viết lại |
| 4 | Tốc độ trung bình trong phố (ô tô con 8 m/s, xe máy 7 m/s, xe tải 6 m/s), 15 giây mỗi lần xem, 30 giây khi sai hướng, 60 giây trước điểm chặn | `truy-vet.ts` | Thông số trò chơi (đề xuất), không phải số liệu nghiệp vụ |
| 5 | Chữ số dễ nhầm khi đọc biển qua camera (3/8, 1/7, 5/6, 0/8…) | `truy-vet.ts` `NHAM` | Nhóm phát triển tự chọn |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Bản đồ ô | M9 `BanDoO`: ô màu theo token, "TH", "CH" cho trường học, chợ | Nếu muốn: biểu tượng trường học, chợ SVG 10×10 |
| Biểu tượng camera có hướng nhìn | Vẽ SVG: chấm tròn và hình quạt theo 4 hướng | SVG 24×24, hình quạt góc nhìn |
| Khung đoạn cảnh camera | Viền đen, chấm REC, tên camera, giờ (CSS), như trò 5 | Không cần thêm |
| Xe nhìn từ trên cao, nhiều màu, nhiều loại | Vẽ Canvas: hình chữ nhật bo góc theo màu thật, viền sáng hoặc tối, kính trước | SVG theo từng loại xe, ≤ 3 KB mỗi hình |
| Dấu khóa xe, điểm chặn | Vòng tròn đỏ (khóa), vòng nét đứt cam (đang chọn); hình thoi xanh (điểm chặn) | SVG 24×24 |

**Độ khó triển khai: Cao.** Đề phụ thuộc lựa chọn (làm bằng route riêng, D23), giữ lộ trình ở máy chủ, và sinh lộ trình có xe mồi hợp lý.

### 5.18. 10 phút đầu tại hiện trường

**Luật chơi**
- Người chơi đến hiện trường một vụ tai nạn vẽ từ trên xuống (tĩnh hoặc động nhẹ). **Đồng hồ "10 phút"** chạy nhanh: 1 giây thật bằng 10 giây trong trò. Mỗi thao tác tốn thêm một khoảng thời gian trong trò (khai trong kịch bản).
- Thao tác trên cảnh:
  - kéo xe tuần tra và cọc tiêu vào vị trí để bảo vệ hiện trường;
  - giữ nút bộ đàm để gọi cấp cứu, cứu hỏa;
  - chạm từng nạn nhân để đánh giá (tỉnh, bất tỉnh, chảy máu), rồi kéo thao tác sơ cứu vào nạn nhân (đặt tư thế nằm nghiêng an toàn, ép cầm máu, không dời người nghi chấn thương cột sống);
  - chạm vị trí xe và vết để đánh dấu trước khi bấm "Cho dời xe".
- Thứ tự sai có **hậu quả hiện ngay trên cảnh**: xe khác lao vào vì chưa có cảnh báo; vết phanh mất vì dời xe trước khi đánh dấu. Không có danh sách để chọn.

**Vòng đời một lượt:** một kịch bản là một bước. Đồng hồ chạy từ lúc tới hiện trường; hết 10 phút trong trò hoặc bấm "Bàn giao hiện trường" thì nộp nhật ký; máy chủ chạy lại nhật ký trên đồng hồ trong trò. Thoát giữa chừng: đồng hồ dừng; vào lại chơi tiếp từ mốc đã lưu, máy chủ kiểm tổng thời gian thật theo §1.2 (không tính thời gian đã thoát, đề xuất).

**Màn chơi và độ khó**

| Màn | Nội dung | Đồng hồ |
|---|---|---|
| 1 | Một xe, một nạn nhân tỉnh, ban ngày | Chạy chậm, 1 giây thật = 5 giây trò (đề xuất) |
| 2 | Thêm nạn nhân chảy máu (đề xuất) | 1:10 |
| 3 | Hai xe, vết phanh và mảnh vỡ phải đánh dấu (đề xuất) | 1:10 |
| 4 | Nạn nhân bất tỉnh, nghi chấn thương cột sống; dòng xe đông (đề xuất) | 1:10 |
| 5 | Nhiều xe, có cháy nổ, đêm mưa | 1:10 |

**Chấm điểm** (đề xuất)

| Việc | Điểm |
|---|---|
| Mỗi bước quan trọng làm đúng và đúng thời điểm (trước hạn khai trong kịch bản) | +10 |
| Mỗi hậu quả xảy ra | −10, không âm |
| Thời gian trong trò còn dư khi bàn giao, mỗi 30 giây | +1, tối đa 10 |

- **Kịch bản là đồ thị bước**: mỗi bước có điều kiện trước (bước khác đã xong, trạng thái cảnh), hạn làm, hậu quả khi quá hạn hoặc khi làm lúc chưa đủ điều kiện. Máy trạng thái chạy lại nhật ký, tính hậu quả theo đồng hồ trong trò.
- Làm bước khi chưa đủ điều kiện trước thì ghi đúng hậu quả của kịch bản (ví dụ dời xe trước khi đánh dấu thì mất vết).
- Đồng hồ trong trò không bị máy khách tua: nhật ký ghi theo nhịp (M7); mốc nhịp lệch đồng hồ máy chủ quá mức cho phép thì cả bước 0 điểm.
- Màn kết quả: dòng thời gian của người chơi cạnh dòng thời gian mẫu, hậu quả đã xảy ra, căn cứ hoặc nguồn nghiệp vụ.
- **Nối với trò 10 (Tái dựng hiện trường)**: dấu vết đánh dấu đủ thì mở kịch bản tương ứng ở trò 10. Đề xuất, không làm ở GĐ-T18 khi chưa được đồng ý (câu D25).

**Dữ liệu cần**
- `game_content` loại `muoi_phut_dau`: cảnh (xe, nạn nhân và tình trạng, vết, nguy cơ cháy), đồ thị bước, hậu quả, thời gian trong trò của từng thao tác.
- Các bước nghiệp vụ (bảo vệ hiện trường, báo tin) đề xuất trỏ tới một quy trình trong `procedures` dạng mở rộng của T4 (câu D26). Thứ tự thao tác tại hiện trường là "tài liệu nghiệp vụ do đơn vị cung cấp".
- Kỹ thuật sơ cứu cần nguồn y tế; không có trong kho thì ghi "chưa có trong kho", đánh dấu demo, ghi chú "cần cán bộ y tế xác nhận" (câu D27).
- 8 kịch bản demo `[Demo]`.

**Mô-đun:** M2 (`KeoTha`, `Giu`), M3, M7 (nhật ký theo nhịp đồng hồ trong trò), M8. Cảnh vẽ SVG tĩnh; xe lao vào (hậu quả) là hoạt ảnh CSS. Dùng M6 nếu kịch bản cần dòng xe chạy liên tục (màn 4–5, đề xuất).

**Dữ kiện gửi xuống điện thoại và đánh đổi:** hậu quả phải hiện ngay trên cảnh, nên điện thoại nhận đồ thị bước và hậu quả (như trò 4 nhận phản ứng của người lái). Tình trạng nạn nhân gửi xuống nhưng chỉ hiện sau khi người chơi chạm đánh giá. Không gửi: bước nào là "bước quan trọng", điểm từng bước, dòng thời gian mẫu, căn cứ.

**Offline:** Có.

**Chế độ giảm chuyển động:** đồng hồ vẫn chạy (là luật chơi, không phải hiệu ứng); hậu quả hiện bằng ảnh tĩnh kèm dòng chữ, không có xe lao vào; không có mưa, lửa động. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Trách nhiệm khi xảy ra tai nạn; bảo vệ hiện trường; cấp cứu người bị nạn | Đồ thị bước | Kho chưa có văn bản |
| 2 | Thứ tự thao tác tại hiện trường | Đồ thị bước | Tài liệu nghiệp vụ do đơn vị cung cấp |
| 3 | Kỹ thuật sơ cứu: tư thế nằm nghiêng an toàn, ép cầm máu, không dời người nghi chấn thương cột sống | Thao tác sơ cứu | **Cần cán bộ y tế xác nhận**; chưa có trong kho |
| 4 | Thời gian trong trò của từng thao tác, hạn của từng bước | Kịch bản | Thông số trò chơi |
| 5 | Mô tả hậu quả | Kịch bản | Người soạn viết |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Cảnh hiện trường từ trên xuống (đường, xe hư hỏng, mảnh vỡ, vết phanh) | Chưa có | SVG ≤ 20 KB mỗi cảnh; ký hiệu dùng chung với trò 10 |
| Nạn nhân | Chưa có | Bóng dáng trung tính, không vẽ vết thương chi tiết, không gây sốc |
| Xe tuần tra, cọc tiêu, cờ đánh dấu | Dùng lại hình của T15 | — |
| Bộ đàm | Chưa có | SVG 48×48, nút giữ có vòng tiến độ (`Giu`) |
| Lửa, khói, mưa đêm | Chưa có | Hình tĩnh đơn giản; bản động chỉ dùng CSS `opacity`, `transform` |

**Độ khó triển khai: Trung bình.** Phần tốn công là trình soạn đồ thị bước có điều kiện và hậu quả, và bộ kiểm đồ thị (không chu trình, mọi bước tới được).

### 5.19. Tạm giữ phương tiện

**Luật chơi**
- Người chơi tạm giữ một xe (mô tô hoặc ô tô) sau khi đã có quyết định. Một lượt có **4 bước liên tiếp**:
  1. **Kiểm đếm:** hình xe nhìn từ nhiều phía (trước, sau, trái, phải; ô tô thêm khoang hàng, cốp), có đồ vật trên xe (mũ bảo hiểm, túi, giấy tờ, đồ giá trị, hàng hóa) và vết trầy, xước, móp. Chạm vào một chỗ trên hình, rồi chạm loại vật trong khay để ghi.
  2. **Lập danh mục:** kéo các thứ đã ghi vào biên bản tạm giữ; trên từng thẻ chỉnh số lượng bằng nút − và +, chọn tình trạng bằng các nhãn trên thẻ (còn nguyên, trầy, móp, vỡ; đề xuất).
  3. **Niêm phong:** giữ để dán tem niêm phong vào đúng vị trí (cốp, khoang hàng).
  4. **Thời hạn và bàn giao:** kéo mốc thời hạn tạm giữ trên lịch, chọn nơi giữ.
- Bỏ sót đồ giá trị hoặc vết hư hỏng thì màn kết quả hiện phần "Khiếu nại khi trả xe": lời trình bày của chủ xe về thứ bị thiếu hoặc vết không có trong biên bản.

**Vòng đời một lượt:** một xe, 4 bước theo thứ tự của khung chung; **bước 4 không mở khi chưa xong bước 3**. Mỗi bước nộp riêng và được chấm riêng. Thoát giữa chừng thì lượt giữ ở bước chưa nộp.

**Màn chơi và độ khó**

| Màn | Xe | Đồ vật và vết |
|---|---|---|
| 1 | Xe máy | 3 đồ vật, không vết |
| 2 | Xe máy (đề xuất) | 5 đồ vật, 1 vết rõ |
| 3 | Ô tô con (đề xuất) | 7 đồ vật, 2 vết, có đồ giá trị trong cốp |
| 4 | Ô tô con (đề xuất) | 8 đồ vật, 3 vết, một vết nhỏ |
| 5 | Ô tô chở hàng | Trên 10 đồ vật, hàng hóa nhiều loại, vết hư hỏng khó thấy |

**Chấm điểm** (đề xuất)

| Bước | Việc | Điểm |
|---|---|---|
| 1 | Mỗi đồ vật hoặc vết ghi đúng (vị trí trong bán kính 24px của vật, loại đúng) | +3 |
| 1 | Bỏ sót đồ giá trị | −10, không âm trong bước |
| 2 | Mỗi thẻ có số lượng và tình trạng đúng | +2 |
| 3 | Mỗi vị trí niêm phong đúng | +5 |
| 4 | Thời hạn đúng | +10 |
| 4 | Nơi giữ đúng | +5 |

- Ghi trùng một đồ vật chỉ tính một lần.
- Thời hạn tính theo ngày giờ Việt Nam; ca biên qua ngày nghỉ tính theo quy định của văn bản (nếu văn bản có quy định; câu D28).
- Màn kết quả: hình xe có vật và vết bị bỏ sót được tô; biên bản tạm giữ đúng (M4); phần khiếu nại; căn cứ.

**Dữ liệu cần**
- `game_content` loại `tam_giu`: xe (giấy đăng ký dùng M1), hình theo phía, danh sách vật (loại, giá trị thường hay giá trị, số lượng, vị trí, tình trạng), vết (vị trí, độ khó thấy), vị trí niêm phong, ngày giờ lập biên bản.
- Thời hạn tạm giữ, nơi giữ, các bước thủ tục: đề xuất một quy trình "Tạm giữ phương tiện" trong `procedures` dạng mở rộng của T4, tham số thời hạn ở bước tương ứng. Không đặt thời hạn trong mã.
- Mẫu biên bản dùng hình giản lược, có chữ "MẪU TRÒ CHƠI", không theo mẫu phôi thật.
- 12 xe demo `[Demo]`.

**Mô-đun**
- M1 (giấy tờ xe, không mở rộng).
- M2 (chạm, `KeoTha`, `Giu`), M3, M8.
- M4 mở rộng thêm loại **biên bản tạm giữ** (danh mục đồ vật, tình trạng, niêm phong, thời hạn, nơi giữ) (hỏi trước khi sửa M4).
- Hình xe nhiều phía dùng lại bộ dựng hình từ tham số của T14 (§4.4).

**Dữ kiện gửi xuống điện thoại và đánh đổi:** hình vẽ gửi dạng nét, không kèm danh sách vật: người chơi chạm tọa độ và tự chọn loại; máy chủ khớp tọa độ với vật trong bán kính. Nhờ vậy số lượng và loại vật không lộ. Vết khó thấy vẽ bằng nét mờ. Không gửi: danh sách vật, vết, vị trí niêm phong, thời hạn đúng. Gói offline vẫn mang đáp án.

**Offline:** Có.

**Chế độ giảm chuyển động:** đổi phía xe không có hiệu ứng lật; tem niêm phong hiện ngay khi giữ đủ thời gian; lịch không trượt. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Thời hạn tạm giữ phương tiện, cách tính (ngày, giờ, qua ngày nghỉ) | Quy trình `tam-giu-phuong-tien` | Kho chưa có văn bản |
| 2 | Nội dung bắt buộc của biên bản tạm giữ; ghi đồ vật, tình trạng xe thế nào | M4 biên bản tạm giữ | Kho chưa có văn bản |
| 3 | Niêm phong: khi nào, ở đâu | Bước 3 | Tài liệu nghiệp vụ |
| 4 | Nơi giữ, bàn giao, bảo quản, trả lại | Bước 4 | Kho chưa có văn bản |
| 5 | Đồ giá trị: phân loại và ghi riêng không | Chấm bước 1 | Phán đoán nghiệp vụ |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Xe máy, ô tô con, ô tô chở hàng nhìn 4–5 phía | Bộ dựng hình của T14 | Thêm phía trước, trên, khoang hàng |
| Đồ vật: mũ bảo hiểm, túi, giấy tờ, đồ giá trị, hàng hóa | Chưa có | SVG 24×24, một màu |
| Vết trầy, xước, móp | Chưa có | Lớp SVG mờ dần theo độ khó thấy |
| Tem niêm phong | Chưa có | Không theo mẫu tem thật |
| Lịch chọn thời hạn | Chưa có | Dùng thành phần lịch có sẵn nếu có; vùng chạm ≥ 48px |
| Biên bản tạm giữ | `BienBan.tsx` mở rộng | Chữ "MẪU TRÒ CHƠI" |

**Độ khó triển khai: Trung bình.** Bốn bước giao diện khác nhau trong một lượt, và mở rộng M4.

### 5.20. Bản đồ điểm đen

**Luật chơi**
- Trò dành cho cán bộ quản lý và người có kinh nghiệm. Mô tả gốc đề xuất mở từ một cấp độ (XP) nhất định; điều này trái §2.4 "không có màn nào khóa vì thiếu XP" (câu D29).
- Bản đồ khu phố dạng ô (M9) có **lớp nhiệt tai nạn 12 tháng giả lập**. Chạm một ô xem các vụ: giờ, loại va chạm, loại xe. Có bộ lọc theo khung giờ và loại xe.
- Thao tác:
  1. **khoanh** các điểm đen (chọn nhóm ô, tối đa 3×3, đề xuất);
  2. với mỗi điểm, **kéo biện pháp** từ bảng vào: camera, gờ giảm tốc, biển hạn chế tốc độ, đèn tín hiệu, tăng tuần tra theo khung giờ, sơn vạch. Mỗi biện pháp có chi phí;
  3. trong giới hạn ngân sách, bấm **"Mô phỏng 12 tháng"**.
- Mô hình tính lại số vụ với biện pháp mới và so trước, sau. Mỗi biện pháp có hiệu quả theo loại nguyên nhân: đặt gờ giảm tốc ở nơi tai nạn do vượt đèn đỏ thì ít tác dụng.
- **"Mô phỏng 12 tháng" là nộp bài, một lần** (đề xuất). Lý do: bảng hiệu quả không gửi xuống điện thoại (xem dưới), nên cho mô phỏng nhiều lần thì mỗi lần là một lời gọi máy chủ và người chơi dò dần được bảng hiệu quả.

**Vòng đời một lượt:** một bản đồ là một bước. Đọc dữ liệu, khoanh, đặt biện pháp, nộp; máy chủ tính, trả kết quả trước và sau. Thoát giữa chừng thì bố trí lưu ở máy khách.

**Màn chơi và độ khó**

| Màn | Điểm đen | Ngân sách |
|---|---|---|
| 1 | 2 điểm rõ | Rộng |
| 2 | 3 điểm, một điểm tập trung theo khung giờ (đề xuất) | Rộng |
| 3 | 4 điểm, nguyên nhân khác nhau cần biện pháp khác nhau (đề xuất) | Vừa |
| 4 | 5 điểm, có điểm ít vụ nhưng nặng (đề xuất) | Vừa |
| 5 | 6 điểm, có điểm "giả" do dữ liệu ít | Chặt |

**Chấm điểm** (đề xuất)

| Việc | Điểm |
|---|---|
| Mỗi điểm đen khoanh đúng (vùng chứa ô trung tâm của điểm đen, không quá 9 ô) | +10 |
| Khoanh điểm giả | −5, không âm |
| Mức giảm tai nạn so với phương án tối ưu tính sẵn | 60 × (giảm của người chơi / giảm tối ưu), tối đa 60 |
| Chi phí dư, chỉ tính khi đạt từ 80% mức giảm tối ưu | +1 mỗi 5% ngân sách dư, tối đa 10 |

- Vượt ngân sách: máy chủ từ chối (400).
- Cùng phương án thì cùng kết quả: mô hình tất định, không có số ngẫu nhiên lúc chấm.
- Thời gian chấm ở máy chủ dưới 1 giây cho bản đồ lớn nhất.
- Màn kết quả: bản đồ trước, sau; điểm đen đúng; phương án tối ưu; căn cứ; dòng "Số liệu tai nạn là dữ liệu giả lập để luyện tập, không phải số liệu thật. Hiệu quả biện pháp là mô phỏng minh họa."
- **Nối với trò 7 (Thành phố an toàn)**: kết quả tốt cho thêm điểm xây dựng đơn vị. Đề xuất, hỏi trước (câu D30).

**Dữ liệu cần**
- `game_content` loại `diem_den`: bản đồ M9, danh sách vụ tai nạn giả lập 12 tháng (ô, giờ, loại va chạm, loại xe, nguyên nhân), biện pháp dùng được và chi phí, ngân sách, điểm đen đúng, phương án tối ưu (chỉ máy chủ).
- **Phương án tối ưu tính sẵn khi duyệt nội dung** bằng script (bài toán chọn biện pháp trong ngân sách, số tổ hợp nhỏ nên duyệt hết được), không tính lúc chơi.
- Bảng **hiệu quả biện pháp theo nguyên nhân**: `game_content` loại `hieu_qua_bien_phap`, có duyệt, ghi rõ "mô phỏng minh họa". Đề xuất dùng chung với trò 7 cho cặp "điểm nóng ↔ công trình phù hợp" (câu D30), để hai trò không có hai giả định khác nhau.
- 8 bản đồ demo `[Demo]`.

**Mô-đun**
- M9 mở rộng thêm **lớp dữ liệu tai nạn**, **lớp nhiệt**, và **mô hình số vụ 12 tháng** (số vụ kỳ vọng mỗi ô theo nguyên nhân nhân hệ số giảm của biện pháp) (hỏi trước; M9 chưa có thì theo quy tắc 11 của Phần chung).
- Mô tả gốc ghi dùng M5 để "chạy nhanh 12 tháng theo mẫu thống kê". M5 mô phỏng từng xe, không có mô hình thống kê; đề xuất không dùng M5 (câu D31).
- M2 (`KeoTha`), M3, M7 (kiểm mốc thời gian), M8.

**Dữ kiện gửi xuống điện thoại và đánh đổi:** gửi toàn bộ vụ tai nạn giả lập (đó là đề) và danh mục biện pháp kèm chi phí, mô tả. **Không gửi** bảng hiệu quả, điểm đen đúng, phương án tối ưu. Vì vậy mô hình chạy ở máy chủ và trò không chơi được offline.

**Offline:** Không. Dữ liệu gắn với địa bàn, bảng hiệu quả không gửi xuống điện thoại, mô hình chạy ở máy chủ.

**Chế độ giảm chuyển động:** lớp nhiệt tĩnh, không chuyển màu dần; kết quả trước, sau hiện hai bản đồ cạnh nhau (xếp dọc ở 360px) thay cho hoạt ảnh. Chấm giống hệt.

**Cần đơn vị chuyên môn kiểm tra**

| # | Nội dung | Ở đâu | Vì sao |
|---|---|---|---|
| 1 | Tiêu chí xác định điểm đen | Điểm đen đúng của từng bản đồ | Kho chưa có văn bản |
| 2 | Trách nhiệm xử lý điểm đen | Màn kết quả | Kho chưa có văn bản |
| 3 | Quy định đặt gờ giảm tốc, biển, đèn tín hiệu | Danh mục biện pháp | QCVN 41:2024/BGTVT chưa có trong kho |
| 4 | Bảng hiệu quả biện pháp theo nguyên nhân | `hieu_qua_bien_phap` | Giả định mô phỏng, ghi "mô phỏng minh họa" |
| 5 | Chi phí biện pháp | Danh mục biện pháp | Đơn vị chi phí giả định, không phải dự toán |

**Hình cần bổ sung**

| Hình | Hiện dùng | Yêu cầu |
|---|---|---|
| Lớp nhiệt trên bản đồ ô | Chưa có | Thang màu 4–5 bậc, đọc được khi mù màu (kèm số vụ trên ô khi phóng to) |
| Biểu tượng biện pháp: camera, gờ giảm tốc, biển, đèn, tuần tra, vạch | Chưa có; dùng chung với trò 7 | SVG 24×24, một màu |
| Khung khoanh điểm đen | Chưa có | Viền nét đứt, tương phản ≥ 3:1 |

**Độ khó triển khai: Trung bình.** Không có mô phỏng thời gian thực; phần tốn công là mô hình và script tính phương án tối ưu, và nội dung bảng hiệu quả.

### 5.21. Đối chiếu trùng lặp T11–T20

So từng trò mới với 10 trò ở §5.1–§5.10 và các trò trong [luu-tru/GAME_DESIGN_cu.md](luu-tru/GAME_DESIGN_cu.md). "Mức" là mức trùng lối chơi: **cao** (cùng thao tác chính, cùng kỹ năng), **vừa** (cùng thao tác, khác kỹ năng), **thấp** (chỉ dùng chung mô-đun).

| Trò mới | Trùng với | Mức | Chỗ trùng | Đề xuất tách |
|---|---|---|---|---|
| T11 Duyệt hồ sơ phạt nguội | Trò 1 Kiểm tra giấy tờ | Vừa | Chạm chỗ không khớp rồi quyết định hai hướng; "giữ lại phải có lý do" giống "trả lại phải chỉ chỗ thiếu" | T11 không có lỗi giấy tờ người lái. Danh mục chỗ thiếu của T11 (độ rõ ảnh, thiết bị, thời điểm, hành vi đề xuất) không trùng `DAU_HIEU` của M1. Thao tác chính là vuốt, không đóng dấu |
| T11 | Trò 5 Soi camera | Vừa | Cùng dữ liệu camera, cùng hình nhìn chéo | Trò 5 luyện **phát hiện** vi phạm trên hoạt cảnh; T11 luyện **thẩm định hồ sơ** đã có, ảnh tĩnh, không khoanh vùng, không chọn loại lỗi |
| T11 | Chốt tuần tra (cũ) | Thấp | Chạm xe vi phạm | Trò cũ đã bỏ; không cần tách |
| T12 Trạm cân tải trọng | Súng bắn tốc độ (cũ, đã ẩn) | Cao | So số đo với giới hạn rồi xác định khung phạt theo mức vượt | Súng bắn tốc độ chọn khung bằng trắc nghiệm và đã ẩn (D1). T12 bắt người chơi tự ghim cặp số làm căn cứ, có nhiều trục và giấy phép lưu hành. Dữ liệu dạng khung theo phần trăm dùng cùng cách `speed_over_min/max` để không có hai kiểu khung |
| T12 | Trò 1 | Thấp | Đóng dấu sau khi soi giấy | T12 không kiểm giấy tờ người lái |
| T13 Lên xe khách | Trò 1 | Vừa | Soi giấy tờ, chạm chỗ sai, đóng dấu | T13 chỉ kiểm giấy tờ kinh doanh vận tải (lệnh vận chuyển, phù hiệu, giám sát hành trình), không kiểm giấy phép lái xe, đăng ký, bảo hiểm (câu D20) |
| T13 | Lập biên bản (cũ, dở) | Vừa | Bước dựng biên bản | T13 chỉ sắp thứ tự các lỗi chính người chơi đã chỉ ra; không chọn hành vi, điều khoản, số tiền |
| T13 | Trò 4 Dừng xe | Thấp | Dừng xe kiểm tra | T13 bắt đầu sau khi xe đã dừng, không có bước quy trình dừng xe |
| T14 Soi xe cải tạo | Trò 5 | Vừa | Khoanh vùng xe | T14 là hình tĩnh, khoanh bộ phận trên một xe, không có thời gian, chấm bằng IoU với vùng bộ phận |
| T14 | Trò 1 | Thấp | Đối chiếu giấy với xe | T14 so thông số kỹ thuật, không so biển số, người lái |
| T15 Dựng chốt an toàn ban đêm | Trò 3 Cắm biển | **Cao** | Kéo biển lên đoạn đường, chạy thử M5, giới hạn số lần chạy thử, chấm bố trí | Trò 3 chấm "biển nào ở ô nào" trên vị trí cố định, không chấm mét. T15 **không có ô đặt cố định**, không có biển nhiễu; chỉ có vật của chốt (biển tạm, cọc, đèn, xe, người) và chấm theo **tiêu chí đo từ mô phỏng** (khoảng cách, phanh gấp, ùn, vùng nguy hiểm). Hai trò không dùng chung đoạn đường mẫu |
| T15 | Trò 4 | Thấp | Chọn vị trí dừng an toàn | T15 là dựng chốt trước khi dừng xe; trò 4 là quy trình với một xe |
| T16 Phân luồng khi có sự cố | Trò 6 Điều phối ca trực | Vừa | Bản đồ ô M9, sự cố xuất hiện trên bản đồ | Trò 6 điều **tổ công tác** tới sự việc; T16 điều **dòng xe** bằng vật đặt trên đường. Không dùng lại `incident_types` cho sự cố của T16 để hai trò không lẫn luật ưu tiên |
| T16 | Trò 8 Điều tiết giao lộ | Vừa | Điều khiển luồng xe, đo ùn | Trò 8 là một giao lộ, ra hiệu lệnh thời gian thực; T16 là cả khu phố, đặt vật, chiến sĩ chỉ là vật "ưu tiên một hướng", không có hiệu lệnh tay |
| T16 | Trò 7 Thành phố an toàn | Thấp | Đặt vật vào ô M9 | Trò 7 là công trình lâu dài của đơn vị; T16 là vật tạm trong một lượt |
| T17 Truy vết xe bỏ trốn | Trò 5 | Vừa | Xem đoạn cảnh camera, chạm xe | T17 không có vi phạm, không thẻ lỗi; kỹ năng là **nhận ra cùng một xe** qua nhiều camera và suy lộ trình |
| T17 | Trò 6 | Thấp | Bản đồ ô | Không cần tách |
| T18 10 phút đầu tại hiện trường | Hiện trường (cũ) | **Cao** về nội dung | Cùng chủ đề xử lý ban đầu tại vụ tai nạn, có hậu quả khi làm sai | Trò cũ là cây chọn nhánh (trắc nghiệm) và chưa làm. T18 thay hẳn: thao tác trên cảnh, có đồng hồ. Không dùng lại định dạng cây của trò cũ |
| T18 | Trò 4 | Vừa | Chuỗi thao tác theo quy trình, sai thứ tự có hậu quả | Dùng lại **cách mô tả bước** của `procedures` mở rộng (T4) cho phần nghiệp vụ (câu D26), không viết máy trạng thái thứ hai. Khác trò 4: nhiều đối tượng song song trên cảnh, đồng hồ trong trò |
| T18 | Trò 10 Tái dựng hiện trường | Thấp | Cùng hiện trường tai nạn, vết phanh | T18 là trước khi dời xe (bảo vệ, cấp cứu, đánh dấu); trò 10 là sau (dựng lại diễn biến). Hai trò dùng chung ký hiệu sơ đồ; nối hai trò ở câu D25 |
| T19 Tạm giữ phương tiện | Trò 4 | Thấp | Hướng xử lý "tạm giữ phương tiện" | Trò 4 dừng ở quyết định tạm giữ; T19 bắt đầu từ đó |
| T19 | T14 | Vừa | Tìm chi tiết trên hình xe nhiều phía | T14 khoanh chỗ **khác giấy**; T19 chạm ghi **mọi thứ có trên xe**. Dùng chung bộ dựng hình, không dùng chung đáp án |
| T19 | Lập biên bản (cũ) | Thấp | Điền biên bản | T19 là biên bản tạm giữ (danh mục, niêm phong, thời hạn), không có hành vi, mức phạt |
| T20 Bản đồ điểm đen | Trò 7 Thành phố an toàn | **Cao** | Đặt công trình an toàn (camera, gờ, biển, đèn) lên bản đồ ô để giảm chỉ số tai nạn | Trò 7 là trạng thái chung của đơn vị, tiêu điểm XP, **điểm nóng hiện sẵn**. T20 là lượt cá nhân có ngân sách, **không hiện điểm đen**: người chơi phải đọc dữ liệu tai nạn để tìm, và chọn biện pháp theo nguyên nhân. Dùng chung một bảng hiệu quả biện pháp (câu D30) |
| T20 | Trò 6 | Thấp | Bản đồ ô | Không cần tách |

Ngoài các dòng trên, không trò mới nào trùng Người vi phạm nói gì?, Bộ đàm, Lệnh trực, Đối đầu 1–1, Mùa giải đơn vị, Phòng thoát hiểm pháp luật, Tự lái qua phố.

---

## 6. Lớp trò chơi hóa dùng chung

Giữ nguyên phần GĐ9 và GĐ-G0:

- **XP** qua `congXp`, nguồn `game:<mã>`, khóa theo id lượt; giảm dần khi chơi lặp trong ngày; `xp_ledger.unit_id` ghi đơn vị lúc nhận XP. XP theo màn ở §2.4.
- **Cấp độ, chuỗi ngày:** không đổi.
- **Huy hiệu:** 1–2 huy hiệu mỗi trò, đề xuất: "Mắt tinh" (Kiểm tra giấy tờ: một ca không giữ nhầm ai), "Chìa khóa vạn năng" (Phòng thoát hiểm: thoát không dùng gợi ý), "Kỹ sư đường phố" (Cắm biển: 3 sao ở màn 5), "Đúng quy trình" (Dừng xe: không thiếu bước nào 5 lượt liền), "Không lọt một ai" (Soi camera: bắt đủ vi phạm), "Trực ban giỏi" (Điều phối: không để sự việc ưu tiên cao quá hạn), "Người xây phố" (Thành phố an toàn: đặt 10 công trình đúng), "Giao lộ thông suốt" (Điều tiết: không va chạm), "Biên bản trắng" (Tự lái: về đích không lỗi), "Đọc dấu vết" (Tái dựng: khớp trong 3 lần mô phỏng). Trò bổ sung (đề xuất): "Hồ sơ sạch" (Phạt nguội: một ca không gửi nhầm), "Cân đúng" (Trạm cân: ghim đúng cặp số cả ca), "Đếm đủ" (Xe khách: đếm đúng 5 xe liền), "Thước chuẩn" (Xe cải tạo: tìm đủ chỗ phải đo ở màn 5), "Chốt an toàn" (Chốt đêm: không xe nào phanh gấp), "Luồng thông" (Phân luồng: xe cứu thương tới trong hạn ở màn 5), "Không mất dấu" (Truy vết: không khóa nhầm), "Hiện trường nguyên vẹn" (10 phút đầu: không hậu quả nào), "Biên bản đủ" (Tạm giữ: không bỏ sót đồ giá trị), "Điểm đen đúng" (Điểm đen: khoanh đủ, không khoanh điểm giả).
- **Hồ sơ chủ đề:** mọi bước có `topic_id` cập nhật `topic_stats`. Với trò mô phỏng, mỗi lỗi ghi được (hoặc mỗi tình huống xử lý đúng) là một lượt trả lời của chủ đề gắn với mã mức phạt hoặc biển báo tương ứng.

---

## 7. Mô hình dữ liệu tóm tắt

| Migration | GĐ | Nội dung |
|---|---|---|
| `0036_kiem_tra_giay_to.sql` | T1 | `document_rules` (vòng đời duyệt); `game_level_progress`, `game_runs.level` (M8); `content_reviews.kind` nhận `document_rule`; đăng ký trò `kiem_tra_giay_to` |
| `0037_phong_thoat_hiem.sql` | T2 | Đăng ký trò `phong_thoat_hiem`; bảng đếm lần nhập mật mã `game_code_attempts(run_id, room, attempts)` |
| `0038_cam_bien.sql` | T3 | Đăng ký trò `cam_bien` |
| `0039_dung_xe.sql` | T4 | `procedures` thêm cột bước có thao tác (`steps` mở rộng, `version` tăng khi đổi); đăng ký trò `dung_xe` |
| `0040_soi_camera.sql` | T5 | Đăng ký trò `soi_camera` |
| `0041_dieu_phoi.sql` | T6 | `incident_types` (vòng đời duyệt); đăng ký trò `dieu_phoi` |
| `0042_thanh_pho.sql` | T7 | `unit_cities`, `unit_city_builds`; đăng ký trò `thanh_pho_an_toan` |
| `0043_dieu_tiet_giao_lo.sql` | T8 | `hand_signals` (vòng đời duyệt); đăng ký trò `dieu_tiet_giao_lo` |
| `0044_tu_lai.sql` | T9 | Đăng ký trò `tu_lai` |
| `0045_tai_dung.sql` | T10 | Đăng ký trò `tai_dung_hien_truong` (`offline_ok = true`, `enabled = false`). Đã viết |
| `0046_phat_nguoi.sql` | T11 | `document_rules` thêm cột `nhom` (mặc định `giay_to_nguoi_lai`), nới CHECK `check_kind`, `doc_kind` cho nhóm `ho_so_phat_nguoi` (D16), CHECK `nhom`; đăng ký trò `duyet_phat_nguoi`. Đã viết |
| `0047_tram_can.sql` | T12 | `load_limits` (vòng đời duyệt); `violations` thêm `qua_tai_loai`, `qua_tai_tu`, `qua_tai_den`, `qua_tai_bien`; `content_reviews.kind` nhận `load_limit`; đăng ký trò `tram_can`. Đã viết |
| `0048_len_xe_khach.sql` | T13 | Nới CHECK `document_rules` cho nhóm `van_tai_khach`; đăng ký trò `len_xe_khach` |
| `0049_soi_xe_cai_tao.sql` | T14 | Đăng ký trò `soi_xe_cai_tao` |
| `0050_chot_dem.sql` | T15 | Đăng ký trò `chot_dem` |
| `0051_phan_luong.sql` | T16 | Đăng ký trò `phan_luong` |
| `0052_truy_vet.sql` | T17 | Đăng ký trò `truy_vet` |
| `0053_muoi_phut_dau.sql` | T18 | Đăng ký trò `muoi_phut_dau` |
| `0054_tam_giu.sql` | T19 | Đăng ký trò `tam_giu` |
| `0055_diem_den.sql` | T20 | Đăng ký trò `diem_den` (`offline_ok = false`) |

Số bắt đầu từ `0046`: tệp lớn nhất đang có là `0044_tu_lai.sql`, còn `0045` đã giữ chỗ cho T10 (PLAN Phụ lục B). `migrate.ts` áp mọi tệp chưa áp theo thứ tự tên, nên làm T14 (`0049`) trước T13 (`0048`) vẫn áp được.

Mọi migration chỉ thêm (`IF NOT EXISTS`), không xóa dữ liệu. Nội dung riêng của từng trò nằm ở `game_content.payload` và `answer`, có lược đồ kiểm bằng hàm thuần trong `packages/dao-tao`.

---

## 8. Những điểm cần anh/chị quyết định

Kế hoạch đang làm theo cột "Đề xuất"; trả lời khác thì sửa theo cột cuối.

| # | Câu hỏi | Đề xuất | Nếu chọn khác |
|---|---|---|---|
| D1 | Các trò đã làm của danh sách cũ (Trắc nghiệm nhanh, Súng bắn tốc độ, Cung đường biển báo, Vượt màn, Hỏi nhanh giọng nói…) xử lý thế nào? | Tắt khỏi trang Trò chơi (`games.enabled = false`), **không xóa mã, không xóa dữ liệu**. Vượt màn chuyển sang Luyện tập. Mã dùng lại được thì tách vào mô-đun (§2.1) | Giữ thêm một mục "Luyện nhanh" chứa các trò cũ: thêm một thẻ ở trang Trò chơi |
| D2 | Hai giai đoạn đang dở (Lập biên bản, Mùa giải đơn vị) dừng hẳn, hay dùng lại? | Dừng. Tách phần chấm biên bản vào M4 (T1); luật tính điểm theo đơn vị của Mùa giải dùng lại cho Thành phố an toàn (T7) | Giữ Mùa giải song song với Thành phố an toàn: hai bảng xếp hạng đơn vị, dễ gây nhầm |
| D3 | Các trò chưa có văn bản căn cứ trong kho (1, 4, 8, 10 gần như hoàn toàn) có được làm phần mã trước với dữ liệu demo không? | Có, như Súng bắn tốc độ: làm mã, dữ liệu demo chờ duyệt, trò tắt với người học cho tới khi đủ nội dung đã duyệt | Chờ nạp văn bản trước: đổi thứ tự, làm trò 2, 3 trước |
| D4 | Kiểm tra giấy tờ có đưa **giấy tờ điện tử** (trên ứng dụng định danh) vào không? | Không ở bản đầu; thêm khi đơn vị xác nhận căn cứ | Có: thêm một loại giấy tờ trong M1 và luật tương ứng |
| D5 | Giữ lại người có giấy tờ hợp lệ trừ nặng hơn cho qua nhầm (§5.1) có hợp tinh thần đào tạo không? | Có: tránh thói quen "giữ lại cho chắc" | Trừ bằng nhau |
| D6 | Phòng thoát hiểm có cần chơi offline không? | Không ở bản đầu | Có: làm thêm khu chỉ dùng tra cứu nhanh, dữ liệu trong gói |
| D7 | Thứ tự ưu tiên sự việc (Điều phối ca trực) và quy trình dừng xe, tác phong (Dừng xe đúng quy trình) lấy từ tài liệu nào? Tài liệu nội bộ có được đưa lên máy chủ không? | Chờ đơn vị cung cấp. Trong lúc chờ, chỉ dùng quy tắc chung dễ kiểm, đánh dấu demo | — |
| D8 | Thành phố an toàn: ai trong đơn vị được đặt công trình? Có giới hạn số lần đặt mỗi ngày? | Mọi thành viên; mỗi người tối đa 3 công trình mỗi ngày; cán bộ quản lý gỡ được công trình đặt sai | Chỉ cán bộ quản lý đặt, theo đề xuất của thành viên |
| D9 | Tự lái qua phố xuất "biên bản" có mức phạt tiền không, hay chỉ ghi hành vi và căn cứ? | Có mức phạt, lấy từ bảng mức phạt đã duyệt; thiếu thì ghi "chưa có mức phạt đã duyệt" | Chỉ hành vi và căn cứ: đơn giản hơn, không phụ thuộc bảng mức phạt |
| D10 | Tái dựng hiện trường về tai nạn dựa trên văn bản nào? (bản cũ Q15, GAP 4.5-25) | **Áp dụng (30/9/2026, khi làm GĐ-T10) theo kế hoạch GĐ-T10, không có phương án khác; văn bản vẫn chờ khách hàng.** Chờ khách hàng cung cấp; trong lúc chờ chỉ làm kịch bản demo đơn giản, ghi rõ "mô phỏng minh họa" | — |
| D11 | Hình vẽ: đội dự án tự vẽ vector đơn giản, hay thuê họa sĩ? Ảnh biển báo chính thức lấy từ đâu? | Tự vẽ ở bản đầu, theo danh sách "Hình cần bổ sung" từng trò | Thuê vẽ: thêm thời gian chờ, mã không đổi |
| D12 | Âm thanh: trò mô phỏng (8, 9) có cần tiếng còi, tiếng động cơ không? | Không; giữ bộ âm Web Audio ngắn của VISUAL_STYLE, mặc định tắt | Có: thêm tệp âm thanh gộp khoảng 50 KB, service worker giữ |
| D13 | Tự lái qua phố có cho điều khiển bằng nghiêng máy không? | Có, tắt mặc định | Chỉ nút bấm |
| D14 | Thứ tự làm 1 → 10 đặt trò khó (3, 5, 8, 9, 10) xen kẽ; M5 được tạo ở trò 3. Giữ đúng thứ tự này? | Giữ, vì anh/chị đã chỉ định | Làm các trò không cần M5 trước (1, 2, 4, 6, 7): có trò chơi được sớm hơn |

**Câu hỏi của T11–T20 (28/9/2026).** Câu có dấu * cần trả lời trước khi làm T11. Câu đã trả lời ghi "**Đã chọn**" ở đầu cột "Đề xuất".

| # | Câu hỏi | Đề xuất | Nếu chọn khác |
|---|---|---|---|
| D15* | Mô tả của T11, T13, T14, T17, T18, T19 có điểm trừ (gửi nhầm trừ nặng, khóa nhầm −3, hậu quả −10). Khung không cho điểm bước âm (D5). Làm thế nào? | **Đã chọn (28/9/2026, khi làm GĐ-T11): theo đề xuất.** Không sửa khung. Trừ trong phạm vi một bước, điểm bước thấp nhất 0. "Lỗi nặng hơn" làm bằng điểm tối đa không đều (T11: hồ sơ không đủ căn cứ 15–20 điểm, hồ sơ đủ căn cứ 10 điểm) | Sửa `khung.ts` và `tongKetLuot` cho điểm bước âm, sàn 0 ở cả lượt. Giải luôn D5 cho trò 1; phải chạy lại test của mọi trò đã xong |
| D16* | Luật kiểm hồ sơ phạt nguội (T11) và luật vận tải hành khách (T13) để ở đâu? | **Đã chọn (28/9/2026, khi làm GĐ-T11): theo đề xuất, đồng ý sửa M1** (`KIEU_KIEM`, `kiemTraLuatGiayTo` nhận nhóm). Dùng lại `document_rules`: thêm cột `nhom`, nới CHECK `check_kind`, `doc_kind`; tab "Luật giấy tờ" lọc theo nhóm. Một vòng đời duyệt, một trình duyệt | Bảng mới `evidence_rules` và `transport_rules`: tách bạch hơn, thêm hai tab quản trị, hai loại `content_reviews.kind` |
| D17 | Ngưỡng tải trọng (T12) để ở đâu? | **Đã chọn (28/9/2026, khi làm GĐ-T12): theo đề xuất.** Bảng mới `load_limits` (số liệu theo loại xe, số trục, khoảng cách trục) và thêm cột `qua_tai_tu`, `qua_tai_den` vào `violations` | Mở rộng `document_rules` với tham số dạng JSON: không cần bảng mới, nhưng khó duyệt từng con số và khó tra ở tra cứu nhanh |
| D18 | Trạm cân: (a) sau khi ghim cặp số, trò có hiện hiệu số kg không; (b) dấu "Hạ tải" khác "Lập biên bản" thế nào? | **Đã chọn (28/9/2026, khi làm GĐ-T12): theo đề xuất cả (a) và (b).** (a) Hiện hiệu số kg, không hiện phần trăm. (b) Chờ đơn vị chuyên môn; trong lúc chờ, "Hạ tải" dùng cho xe vượt trong ngưỡng không xử phạt, "Lập biên bản" gồm cả buộc hạ tải, đánh dấu demo | (a) Không hiện gì: khó hơn, người chơi tự trừ. (b) Bỏ dấu "Hạ tải", còn hai dấu |
| D19 | Lên xe khách: "nặng đến nhẹ" đo bằng gì? | **Đã chọn (28/9/2026, khi làm GĐ-T13): theo đề xuất.** Mức phạt tối đa của dòng `violations` đã duyệt; bằng nhau thì thứ tự nào cũng đúng; lỗi chưa có mức phạt không vào bước sắp | Theo thứ tự đơn vị quy định khi lập biên bản (cần tài liệu); hoặc bỏ bước sắp |
| D20 | Lên xe khách có kiểm giấy phép lái xe, đăng ký, bảo hiểm (các lỗi của trò 1) không? | **Đã chọn (28/9/2026, khi làm GĐ-T13): theo đề xuất.** Không, để không trùng trò 1 (§5.21) | Có: dùng lại luật giấy tờ của trò 1; lượt dài hơn |
| D21 | Dựng chốt đêm cần chấm khoảng cách đặt biển tạm bằng mét; trò 3 đã quyết định không chấm mét khi chưa có QCVN 41:2024 | **Đã chọn (29/9/2026, khi làm GĐ-T15): theo đề xuất.** Làm phần mã với ngưỡng demo đánh dấu rõ; trò tắt tới khi có căn cứ hoặc tài liệu nghiệp vụ | Chỉ chấm thứ tự và phía đặt (biển trước chốt, cọc sau biển), không chấm mét |
| D22 | M9 chưa có (GĐ-T6 chưa làm). T16 là trò mới đầu tiên cần M9 | **Đã chọn (30/9/2026, khi làm GĐ-T17): theo cột "Nếu chọn khác", nhưng ở GĐ-T17** (GĐ-T16 chưa làm): tạo M9 ngay trong GĐ-T17 theo đặc tả §4.1; GĐ-T6, GĐ-T16 dùng lại. Đề xuất cũ: làm GĐ-T6 trước GĐ-T16 để M9 có đúng chủ | Tạo M9 ngay trong GĐ-T16 theo đặc tả §4.1; GĐ-T6 dùng lại (quy tắc 11, phương án b) |
| D23 | Truy vết: máy khách chỉ được nhận đoạn cảnh của camera đã mở, nhưng khung sinh mọi đề lúc tạo lượt | **Đã chọn (30/9/2026, khi làm GĐ-T17): route riêng của trò** (`POST /v1/truy-vet/luot/:id/camera`), không sửa khung. Một vụ là một bước; route ghi thao tác mở camera, khóa xe vào ảnh chụp bước (`game_runs.items[0].noi_dung.nhat_ky`, giao dịch khóa dòng lượt); khi chấm online máy chủ chỉ tin nhật ký đó, máy khách chỉ gửi thao tác khóa, chặn cuối (người dùng đồng ý ảnh chụp bước của trò này thay đổi trong lúc chơi). Đề xuất cũ: sửa khung: thêm móc "đề bước sau dựng từ trả lời các bước trước" (`deTheoTienDo`), mỗi lần mở camera là một bước. Hỏi trước khi sửa; ảnh hưởng mọi trò (không trò cũ nào dùng móc này) | Thêm một route riêng của trò trả đoạn cảnh theo camera (không sửa khung, nhưng thêm đường API ngoài `/v1/luot-choi`); hoặc gửi mọi đoạn cảnh lúc bắt đầu (lộ lộ trình, trái mô tả) |
| D24 | Truy vết offline: gói phải mang seed và lộ trình | **Đã chọn (30/9/2026, khi làm GĐ-T17): theo đề xuất.** Có offline, chấp nhận gói mang đáp án như mọi trò offline. Trang offline truyền ảnh chụp bước cho giao diện trò qua prop tùy chọn `buocOffline` của `PropsBuoc` (người dùng đồng ý) | Không offline |
| D25 | 10 phút đầu: dấu vết đánh dấu đủ thì mở kịch bản ở trò 10? | Không làm ở GĐ-T18; làm sau khi GĐ-T10 xong, trong một giai đoạn nhỏ riêng | Làm ngay: cần bảng mở khóa kịch bản theo người, sửa trò 10 |
| D26 | Thứ tự thao tác nghiệp vụ của T18 và thủ tục của T19 để ở đâu? | `procedures` dạng mở rộng của T4 (bước có `tro_choi`); kịch bản và hậu quả ở `game_content` | Toàn bộ trong `game_content`: đơn giản hơn, nhưng quy trình không hiện ở tra cứu nhanh và không duyệt riêng được |
| D27 | 10 phút đầu có thao tác sơ cứu; chưa có nguồn y tế | Giữ thao tác sơ cứu, đánh dấu demo, ghi "cần cán bộ y tế xác nhận"; trò tắt tới khi có xác nhận | Bỏ thao tác sơ cứu, chỉ giữ "gọi cấp cứu" và "không dời người bị nạn" |
| D28 | Tạm giữ: thời hạn tính qua ngày nghỉ, lễ thì lấy lịch ngày nghỉ ở đâu? | Chỉ tính ngày nghỉ nếu văn bản quy định; lịch ngày nghỉ, lễ là nội dung có duyệt trong `game_content` | Tính theo ngày lịch, không xét ngày nghỉ |
| D29 | Bản đồ điểm đen: mô tả gốc đề xuất mở từ một cấp độ XP; §2.4 quy định không khóa vì thiếu XP | Không khóa. Thẻ trò ghi "Dành cho cán bộ quản lý và người có kinh nghiệm"; màn 1–2 vẫn cho người mới | Khóa từ cấp N (anh/chị chọn N): sửa trang Trò chơi và API bắt đầu lượt (khung chung) |
| D30 | Điểm đen nối với Thành phố an toàn thế nào? | Không cộng thêm điểm xây dựng (XP của T20 đã vào trò 7 qua `xp_ledger`). Dùng chung một bảng hiệu quả biện pháp (`hieu_qua_bien_phap`) cho T7 và T20 | Kết quả tốt cho thêm điểm xây dựng: sửa trò 7, thêm nguồn điểm ngoài `xp_ledger` |
| D31 | Điểm đen: mô hình 12 tháng đặt ở đâu? | Phần mở rộng M9 (mô hình thống kê tất định), không dùng M5 | Dùng M5 chạy mẫu xe rút gọn: chậm, khó đạt chấm dưới 1 giây |
| D32 | Chấp nhận cách tách trùng lặp ở §5.21, nhất là T15 với trò 3 và T20 với trò 7? | **Đã chọn (28/9/2026, khi làm GĐ-T11): chấp nhận** | Gộp: T15 thành màn 6–7 của trò 3; T20 thành chế độ "quản lý" của trò 7 |

---

## 9. Rủi ro

| Rủi ro | Ảnh hưởng | Cách giảm |
|---|---|---|
| Kho văn bản chưa có Luật Trật tự, an toàn giao thông đường bộ, nghị định xử phạt, QCVN 41:2024, thông tư quy trình | Trò 1, 3, 4, 8, 9, 10 không có nội dung đã duyệt, dù mã xong | Nạp văn bản song song với mã (số hóa qua MCP); mỗi giai đoạn có mục "đủ nội dung đã duyệt" riêng; trò tắt tới khi đủ |
| Mô phỏng lệch giữa máy khách và máy chủ | Chấm sai, người chơi thấy điểm khác | Quy tắc tất định §2.3; test so băm trạng thái cuối trên mọi màn mẫu |
| Hoạt cảnh nhiều xe chậm trên máy cũ | Trò 5, 8, 9 khó chơi | Ngân sách phần tử, Canvas 2D một lớp, đo CPU chậm 4× trong E2E, chế độ từng bước |
| Trò dạy sai quy tắc do dữ liệu demo bị hiểu là thật | Cán bộ học sai | Dữ liệu demo chỉ duyệt tự động trên CSDL `_demo`; nhãn "[Demo]"; bảng cần kiểm tra ở từng trò |
| Giấy tờ trong trò bị dùng làm mẫu giả | Rủi ro pháp lý | Hình giản lược, chữ "MẪU TRÒ CHƠI", không theo mẫu phôi thật (§1.5) |
| Thành phố an toàn bị một người "cày" | Mất công bằng giữa đơn vị | Chia theo quân số, trần mỗi người mỗi tuần, giới hạn số công trình mỗi ngày |
| Phạm vi 10 trò mô phỏng lớn hơn nhiều so với 10 trò hỏi đáp | Kéo dài tiến độ | Mô-đun dùng chung §4; mỗi trò có màn 1–2 chơi được trước, màn 3–5 thêm sau nếu cần |
| T11–T20 thêm 10 trò khi T2, T6, T7, T8, T10 chưa làm | 20 trò dở dang cùng lúc; M9 chưa có | Làm theo thứ tự ở §4.4; mỗi giai đoạn xong phần mã thì trò vẫn tắt tới khi đủ nội dung |
| Nhiều phiên mở rộng cùng mô-đun (M1 ở T12, T13, T14; M5 ở T15, T16) | Lỗi typecheck, test trò cũ hỏng | Không chạy hai phiên song song trên cùng mô-đun; test của mọi trò đã xong phải đạt sau mỗi lần mở rộng |
| Nội dung ngoài lĩnh vực pháp luật (sơ cứu ở T18, hiệu quả biện pháp ở T20) | Dạy sai kỹ thuật y tế hoặc giả định hiệu quả bị hiểu là số liệu thật | Ghi "cần cán bộ y tế xác nhận", "mô phỏng minh họa" ngay trên màn hình; trò tắt tới khi được xác nhận |
| Trò T17 lộ lộ trình qua gói offline | Người biết lập trình đọc được đáp án | Như mọi trò offline: XP giới hạn theo số lượt trong ngày (câu D24) |
