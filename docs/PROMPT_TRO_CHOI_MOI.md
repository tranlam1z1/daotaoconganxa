# PROMPT LÀM 10 TRÒ CHƠI MỚI (T11–T20)

*Soạn ngày 28/9/2026. Dùng cho phiên trợ lý lập trình (Claude Code) làm việc trong repo này. Mười trò ở đây bổ sung cho 10 trò ở [PRD.md](PRD.md) mục V.2, không thay thế.*

---

## 0. Cách dùng

1. **Chạy Prompt 0 trước, một lần.** Prompt này đưa 10 trò vào PRD.md, GAME_DESIGN.md và PLAN.md thành các giai đoạn GĐ-T11 đến GĐ-T20. Chưa viết mã. *Đã chạy ngày 28/9/2026; các prompt ở mục 3 đã được sửa cho khớp với thiết kế sau Prompt 0.*
2. **Đọc và sửa tài liệu thiết kế sau Prompt 0**, nhất là bảng câu hỏi cần quyết định. Trả lời xong mới làm trò.
3. **Mỗi trò một phiên riêng.** Dán nguyên prompt của trò đó (mục 3) vào một phiên mới. Mỗi prompt đã tự trỏ về Phần chung (mục 1), không cần dán kèm.
4. **Thứ tự nên làm:** T11 → T12 → T14 → T13 → T19 → T18 → T15 → T16 → T17 → T20. Các trò đầu chỉ dùng mô-đun đã có (M1, M2, M3, M4, M8). Các trò sau cần M5, M6 hoặc M9.
5. **Không chạy hai phiên song song trên cùng mô-đun dùng chung.** GĐ-T1 đã từng gặp lỗi typecheck do phiên GĐ-T4 chạy cùng lúc.

### Bảng tóm tắt

| Mã | Trò | Thao tác chính | Mô-đun dùng lại | Mô-đun cần mở rộng | Offline |
|---|---|---|---|---|---|
| T11 | Duyệt hồ sơ phạt nguội | Vuốt, chạm chỗ thiếu | M2, M3, M4, M8 | M1 (bộ kiểm luật nhận nhóm hồ sơ phạt nguội, nếu D16 chọn dùng lại `document_rules`) | Có |
| T12 | Trạm cân tải trọng | Đọc số, kéo thanh, đóng dấu | M1, M2, M3, M4, M8 | M1 (giấy kiểm định, phiếu cân, giấy phép lưu hành), M2 (đóng dấu nhận danh sách lựa chọn) | Có |
| T13 | Lên xe khách | Chạm đếm, soi giấy tờ, đóng dấu | M1, M2, M3, M4, M8 | M1 (lệnh vận chuyển, phù hiệu, dữ liệu giám sát hành trình) | Có |
| T14 | Soi xe cải tạo | Khoanh vùng trên hình xe | M1, M2, M3, M4, M8 | M1 (thông số kỹ thuật trên giấy kiểm định do T12 tạo) | Có |
| T15 | Dựng chốt an toàn ban đêm | Kéo thả vật, chạy mô phỏng | M2, M3, M5, M6, M7, M8 | M5 (vật cản tạm, tầm nhìn đêm) | Có |
| T16 | Phân luồng khi có sự cố | Đặt rào, hướng đi tạm, chạy mô phỏng | M2, M3, M5, M6, M7, M8, M9 | M5 (lưu lượng, đo ùn) | Có |
| T17 | Truy vết xe bỏ trốn | Chọn camera trên bản đồ, chạm xe | M2, M3, M5, M6, M7, M8, M9 | Khung chung (đề bước sau theo lựa chọn, D23) | Có (D24) |
| T18 | 10 phút đầu tại hiện trường | Kéo, giữ, sắp thứ tự | M2, M3, M7, M8 | — | Có |
| T19 | Tạm giữ phương tiện | Kiểm đếm, kéo vào danh mục, niêm phong | M1, M2, M3, M4, M8 | M4 (biên bản tạm giữ) | Có |
| T20 | Bản đồ điểm đen | Khoanh vùng, đặt biện pháp trong ngân sách | M2, M3, M7, M8, M9 | M9 (lớp dữ liệu tai nạn, lớp nhiệt, mô hình 12 tháng; không dùng M5, D31) | Không (dữ liệu theo địa bàn) |

Mã D15 đến D32 là các câu hỏi cần quyết định ở [GAME_DESIGN.md](GAME_DESIGN.md) §8. Thiết kế chi tiết và đối chiếu trùng lặp ở GAME_DESIGN §5.11 đến §5.21.

---

## 1. Phần chung (mọi prompt đều trỏ về đây)

> Mọi phiên làm trò T11–T20 phải đọc và theo đúng phần này.

**Người dùng.** Cán bộ, chiến sĩ CSGT, 24–45 tuổi, chơi trên điện thoại xen giữa ca trực. Do đó:
- Mỗi lượt 2–5 phút, **dừng giữa chừng được** (thoát ra thì lượt tự lưu, vào lại chơi tiếp hoặc chốt lượt).
- Chơi một tay được. Giọng điệu nghiêm túc, sát việc thật, không kiểu hoạt hình trẻ con.
- Kết quả cá nhân chỉ người chơi và cán bộ quản lý của đơn vị xem được. Bảng xếp hạng công khai tính theo đơn vị.
- Màn 1–2 cho người mới vào nghề. Màn 4–5 phải đủ khó cho người đã có 10 năm kinh nghiệm.

**Tài liệu phải đọc trước khi làm:**
- [PRD.md](PRD.md) mục V (nguyên tắc chung).
- [GAME_DESIGN.md](GAME_DESIGN.md) §1 (quy tắc chung), §2 (kiến trúc), §3 (duyệt nội dung), §4 (mô-đun dùng chung) và mục thiết kế của trò đang làm.
- [PLAN.md](PLAN.md): "Mục kiểm tra chung cho mọi giai đoạn GĐ-T" và giai đoạn của trò đang làm. Đọc thêm GĐ-T1 làm mẫu cho cách ghi trạng thái.
- [VISUAL_STYLE.md](VISUAL_STYLE.md) và [QUY-TAC-HANH-VAN.md](../QUY-TAC-HANH-VAN.md).
- Mã của trò đã xong có mô-đun gần nhất: `packages/dao-tao/src/tro-choi/kiem-tra-giay-to.ts` (M1, M4, M8), `cam-bien.ts` và `soi-camera.ts` (M5, M6, M7), `tu-lai-pho.ts` (xe người lái).

**Quy tắc cứng (tóm tắt GAME_DESIGN §1, bản gốc được ưu tiên nếu có chỗ khác):**
1. **Chạy trên khung chung GĐ-G0.** Không tự viết đồng hồ, XP, đồng bộ offline, màn tổng kết.
2. **Không dùng trắc nghiệm làm lối chơi chính.**
3. **Chấm trên máy chủ.** Trò mô phỏng thì máy chủ chạy lại nhật ký thao tác (M7). Máy chủ bỏ qua mọi điểm, cờ đúng/sai do máy khách gửi. Không gửi đáp án trước khi chấm. Test quét khóa cấm phải đạt.
4. **Căn cứ pháp lý lấy từ kho văn bản.** Tra bằng công cụ tìm kiếm quy định, đọc nguyên văn, kiểm còn hiệu lực tại ngày chơi rồi mới gắn URN. Mức phạt lấy từ bảng mức phạt đã duyệt, không chép số tiền vào nội dung trò. Văn bản chưa có trong kho thì ghi "chưa có trong kho", **không viện dẫn theo trí nhớ**. Nếu MCP `quydinhphapluat` không kết nối được thì dừng bước tra cứu và báo người dùng, không đoán.
5. **Quy trình nội bộ** (tác phong, thứ tự thao tác nghiệp vụ không có trong văn bản công khai) ghi nguồn là "tài liệu nghiệp vụ do đơn vị cung cấp" và đánh dấu demo cho tới khi có tài liệu.
6. **Dữ liệu mẫu** có tiền tố `[Demo]`, nạp ở trạng thái chờ duyệt. Chỉ duyệt tự động trên CSDL tên kết thúc bằng `_demo`.
7. **Trò mới đăng ký với `games.enabled = false`** cho tới khi đủ nội dung đã duyệt.
8. **Điện thoại:** 360×740, vùng chạm ≥ 48px, kéo thả có đường thay thế bằng chạm và bàn phím, có chế độ giảm chuyển động chấm giống hệt chế độ thường. Mã riêng mỗi trò ≤ 8 KB gzip (≤ 12 KB nếu dùng bộ mô phỏng).
9. **Hình ảnh:** tự vẽ vector đơn giản. Không dùng quân hiệu, cấp hiệu, logo lực lượng, ảnh người thật. Giấy tờ giản lược, có chữ "MẪU TRÒ CHƠI".
10. **Phạm vi sửa:** chỉ sửa file của trò đang làm và file ghi ở mục "File sửa" của giai đoạn. Cần sửa khung chung hoặc mô-đun đã có thì **hỏi trước**, nêu rõ sửa gì, vì sao, ảnh hưởng tới trò nào.
11. **Mô-đun chưa có** (ví dụ M9 khi GĐ-T6 chưa làm): dừng lại và hỏi người dùng nên (a) chờ giai đoạn tạo mô-đun đó, hay (b) tạo mô-đun ngay trong giai đoạn này theo đúng đặc tả ở GAME_DESIGN §4.1.
12. **Không tự commit.** Cuối phiên đưa bản tóm tắt thay đổi để người dùng commit.
13. **Câu hỏi quyết định.** Mỗi prompt ở mục 3 ghi các câu D liên quan. Đọc câu trả lời ở GAME_DESIGN §8 trước khi làm. Câu chưa có trả lời thì dừng và hỏi người dùng, không tự chọn cột "Đề xuất". Làm khác thiết kế theo câu trả lời thì sửa luôn mục của trò ở GAME_DESIGN §5 và giai đoạn ở PLAN.md.

**Xong một trò khi** đạt toàn bộ mục ở PLAN.md "Mục kiểm tra chung cho mọi giai đoạn GĐ-T" cộng mục riêng của giai đoạn. Cụ thể: `bun run typecheck`, `bun test`, `bun run build:web`, `bun run e2e <mã-trò>` đạt, và test của mọi trò đã xong trước đó vẫn đạt. Cập nhật PLAN.md (đánh `[x]`, ghi "Trạng thái" theo mẫu GĐ-T1), DEMO.md và bảng "Cần đơn vị chuyên môn kiểm tra", "Hình cần bổ sung" của trò trong GAME_DESIGN.md. Hỏng test có sẵn từ trước (ví dụ `ports.test.ts` trên Windows) thì ghi rõ, không che.

---

## 2. Prompt 0: đưa 10 trò vào tài liệu thiết kế

```text
Đọc docs/PROMPT_TRO_CHOI_MOI.md (mục 1 và mục 3), docs/PRD.md mục V, docs/GAME_DESIGN.md và docs/PLAN.md.

Việc cần làm: đưa 10 trò T11–T20 vào tài liệu thiết kế. Chưa viết mã.

1. PRD.md: thêm mục V.5 "Trò chơi bổ sung (28/9/2026)", bảng giống V.2 (tên trò, người chơi làm gì, offline), mỗi trò một dòng.
2. GAME_DESIGN.md: thêm §5.11 đến §5.20, mỗi trò một mục, cùng cấu trúc với các mục §5 hiện có. Mỗi mục gồm:
   - lối chơi và vòng đời một lượt;
   - 5 màn, độ khó tăng dần;
   - cách chấm và bảng điểm cụ thể;
   - dữ liệu cần có, bảng mới hoặc bảng dùng lại;
   - mô-đun dùng lại, phần mở rộng mô-đun nếu có;
   - phần dữ kiện buộc phải gửi xuống máy khách trước khi chấm (nếu có) và đánh đổi;
   - chế độ giảm chuyển động;
   - bảng "Cần đơn vị chuyên môn kiểm tra" và bảng "Hình cần bổ sung".
   Lấy nội dung từ mô tả của từng trò ở mục 3 của PROMPT_TRO_CHOI_MOI.md. Chỗ mô tả chưa đủ thì đề xuất và đánh dấu "đề xuất".
3. GAME_DESIGN.md §4.1: cập nhật cột "Dùng cho trò" và "Mở rộng ở" của các mô-đun theo bảng tóm tắt ở mục 0. Không tạo mô-đun mới nếu một mô-đun có sẵn làm được.
4. GAME_DESIGN.md §8: thêm các câu hỏi cần quyết định của T11–T20, đánh số tiếp (D15 trở đi), mỗi câu có cột "Đề xuất" và "Nếu chọn khác".
5. PLAN.md: thêm GĐ-T11 đến GĐ-T20 theo đúng khuôn GĐ-T1: Mục tiêu, Thiết kế, Việc làm, File sửa, File tạo, Migration (đánh số tiếp theo migration lớn nhất trong packages/db/migrations), Kiểm tra đã xong. Chưa ghi Trạng thái. Cập nhật Phụ lục B (migration dự kiến).
6. Kiểm tra trùng lặp: so từng trò mới với 10 trò hiện có và các trò trong docs/luu-tru/GAME_DESIGN_cu.md. Chỗ nào trùng lối chơi thì nêu rõ và đề xuất cách tách.

Viết theo QUY-TAC-HANH-VAN.md. Cuối phiên liệt kê các câu hỏi cần tôi trả lời trước khi làm trò đầu tiên, và tóm tắt thay đổi để tôi commit.
```

---

## 3. Prompt cho từng trò

Mỗi khối dưới đây là **một prompt hoàn chỉnh**. Chép cả khối vào phiên mới.

### T11. Duyệt hồ sơ phạt nguội

```text
Làm GĐ-T11 "Duyệt hồ sơ phạt nguội" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.11.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Người chơi là cán bộ xử lý hình ảnh vi phạm do camera ghi lại. Mỗi lượt có 10–15 hồ sơ, hiện dạng thẻ.
- Mỗi thẻ gồm: ảnh vi phạm vẽ giản lược, dải thông tin (thời điểm, vị trí, loại camera, hành vi hệ thống đề xuất), ảnh phóng to biển số.
- Thao tác:
  - vuốt phải: đủ căn cứ, gửi thông báo;
  - vuốt trái: trả lại;
  - trả lại thì phải chạm vào đúng chỗ thiếu trên thẻ (biển số không đọc được, thiếu thời điểm, ảnh không thấy rõ hành vi, hành vi đề xuất sai với ảnh, thiết bị hết hạn kiểm định).
  - Có nút thay thế cho vuốt.
- Màn 1: một lỗi rõ ràng mỗi hồ sơ, không giới hạn giờ. Màn 5: lỗi tinh vi (biển số dễ nhầm 8/B, 0/D; thời điểm ngoài giờ cấm; hai xe chồng nhau), có giờ cả ca.
- Điểm: quyết định đúng +10; chỉ đúng chỗ thiếu +5 mỗi chỗ; chạm nhầm −2 trong phần chỉ chỗ thiếu. Khung không cho điểm bước âm, nên "gửi nhầm nặng hơn trả nhầm" làm bằng điểm tối đa không đều: hồ sơ không đủ căn cứ 15–20 điểm, hồ sơ đủ căn cứ 10 điểm (D15).
- Hồ sơ gửi đúng thì màn kết quả hiện "thông báo vi phạm" dựng bằng M4.

Dữ liệu và căn cứ:
- Tra kho văn bản: quy định về sử dụng dữ liệu thu từ phương tiện, thiết bị kỹ thuật nghiệp vụ để phát hiện vi phạm, thủ tục gửi thông báo, yêu cầu với thiết bị. Ghi URN tìm được và phần chưa có vào bảng cần kiểm.
- Soạn 30 hồ sơ demo có đáp án suy ra từ bộ luật kiểm hồ sơ, không ghi đáp án cứng trong hồ sơ. Luật để ở đâu theo D16 (đề xuất: `document_rules`, nhóm `ho_so_phat_nguoi`).
- Đề gửi xuống máy khách không được có trường nào lộ hồ sơ đủ hay không đủ căn cứ. Biển số làm nhiễu ở máy chủ; không gửi tham số độ rõ biển số.

Mô-đun:
- M2: `Vuot` (8 hướng) đã có, dùng hướng trái và phải; nút thay thế có sẵn. Thẻ bay theo ngón tay là hiệu ứng riêng của trò. Cần sửa `Vuot` thì hỏi trước.
- M4: `BienBan` đã nhận `tieuDe`, dùng tiêu đề "Thông báo vi phạm (mô phỏng)", không sửa M4.
- M1: nếu D16 chọn dùng lại `document_rules`, bộ kiểm luật của M1 (`KIEU_KIEM`, `kiemTraLuatGiayTo` ở `chung/giay-to.ts`) phải nhận nhóm và kiểu kiểm mới. Đó là sửa M1: hỏi trước.
- M3, M8.
Câu hỏi quyết định liên quan: D15, D16, D32.
Test riêng: cùng hồ sơ cùng đáp án ở máy khách và máy chủ; vuốt phải mà máy khách gửi kèm cờ "đúng" thì bị bỏ qua; trả lại mà không chỉ chỗ thiếu thì 400; gửi nhầm mất nhiều điểm hơn trả nhầm.
```

### T12. Trạm cân tải trọng

```text
Làm GĐ-T12 "Trạm cân tải trọng" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.12.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Xe tải lần lượt vào trạm cân. Mỗi xe có: phiếu cân (tổng trọng lượng, tải trọng từng trục hoặc cụm trục), giấy chứng nhận kiểm định (khối lượng hàng chuyên chở cho phép, khối lượng toàn bộ cho phép), giấy phép lưu hành xe quá tải nếu có, hình xe và loại trục.
- Thao tác:
  1. chạm vào số trên phiếu và trên giấy để "ghim" hai số cần so;
  2. kéo thanh trượt để ước phần trăm vượt (bước 1%). Sau khi ghim một cặp, trò hiện hiệu số kg của cặp đó, không hiện phần trăm (D18);
  3. đóng dấu một trong ba: Cho đi, Hạ tải, Lập biên bản. Ý nghĩa "Hạ tải" so với "Lập biên bản" theo D18.
  - Không có ô chọn đáp án. Người chơi phải tự chỉ ra con số làm căn cứ.
- Màn 1: xe hai trục, chỉ so tổng trọng lượng. Màn 2: thêm khối lượng hàng chuyên chở theo giấy kiểm định. Màn 3: thêm tải trọng trục. Màn 4: thêm giấy phép lưu hành (còn hạn, hết hạn, sai tuyến). Màn 5: xe đầu kéo sơ mi rơ moóc, có giờ cả ca.
- Điểm: dấu đúng +10; ghim đúng cặp số quyết định +5; ước phần trăm trong ±2 điểm phần trăm +3; tối đa 18 mỗi xe. Đúng bằng ngưỡng tính không vượt (đề xuất, đưa vào bảng cần kiểm).
- Màn kết quả: biên bản M4 theo đúng khung phần trăm quá tải.

Dữ liệu và căn cứ:
- Tra kho: quy định tải trọng trục, tổng trọng lượng theo loại xe, giấy phép lưu hành xe quá tải, xử phạt chở hàng vượt khối lượng cho phép theo các khung phần trăm. Bảng ngưỡng là nội dung có duyệt, không đặt hằng số trong mã. Để ở đâu theo D17 (đề xuất: bảng mới `load_limits`, thêm cột `qua_tai_tu`, `qua_tai_den` vào `violations`).
- 30 xe demo. Đáp án suy ra từ bảng ngưỡng đã duyệt tại ngày chơi.

Mô-đun:
- M1 mở rộng thêm "giấy chứng nhận kiểm định", "phiếu cân", "giấy phép lưu hành xe quá tải" (hỏi trước khi sửa M1).
- M2 mở rộng: `NutDongDau` hiện chỉ có hai dấu cố định "Cho qua / Giữ lại"; cho nhận danh sách lựa chọn và nhãn do trò truyền, trò 1 giữ nguyên hai dấu (hỏi trước). T13, T14 dùng lại phần này.
- Thanh trượt dùng `input type="range"` có nhãn, không phải cử chỉ mới.
- M3, M4, M8.
Câu hỏi quyết định liên quan: D15, D17, D18.
Test riêng: ca biên đúng bằng ngưỡng; ngưỡng đổi sau khi duyệt lại thì đáp án đổi theo; máy khách gửi phần trăm tự tính thì máy chủ vẫn tính lại; test và E2E của trò 1 vẫn đạt sau khi mở rộng đóng dấu.
```

### T13. Lên xe khách

```text
Làm GĐ-T13 "Lên xe khách" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.13.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Người chơi dừng một xe khách và kiểm tra trong một màn hình chia ba phần: sơ đồ khoang xe nhìn từ trên (ghế, giường, lối đi, người), tập giấy tờ của xe và lái xe, màn hình thiết bị giám sát hành trình (thời gian lái liên tục, tổng thời gian lái trong ngày, tốc độ).
- Thao tác:
  - chạm vào từng người để đếm (người đứng lối đi, trẻ em, hành khách trên sàn); chạm lại thì bỏ đếm. Sơ đồ có vật dễ nhầm với người (hành lý, áo treo, túi); chạm vào đó là đếm dư;
  - chỉnh ô "số người vượt" bằng nút − và + (đề xuất);
  - chạm vào chỗ sai trên giấy tờ và trên màn hình giám sát;
  - đóng dấu Cho đi hoặc Lập biên bản.
- Ở bề rộng 360px, ba phần là ba thẻ chuyển qua lại (đề xuất).
- Sau khi đóng dấu Lập biên bản, người chơi kéo các lỗi đã phát hiện vào biên bản theo thứ tự nặng đến nhẹ. Đây là bước tổng hợp, không phải trắc nghiệm. "Nặng" đo bằng mức phạt tối đa của dòng `violations` đã duyệt; bằng nhau thì thứ tự nào cũng đúng (D19).
- Không kiểm giấy phép lái xe, đăng ký, bảo hiểm (lỗi của trò 1), để không trùng trò 1 (D20).
- Màn 1: xe 16 chỗ, chỉ đếm khách. Màn 3: thêm lệnh vận chuyển, phù hiệu. Màn 4: thêm dữ liệu giám sát hành trình. Màn 5: xe giường nằm ban đêm, nhiều lỗi chồng nhau, có giờ.
- Điểm: số người vượt đúng +10; mỗi lỗi giấy tờ hoặc giám sát chỉ đúng +5; chạm nhầm −2, không âm; dấu đúng +5; thứ tự lỗi đúng +5 (sai một cặp liền kề +2).

Dữ liệu và căn cứ:
- Tra kho: quy định chở quá số người, kinh doanh vận tải hành khách (lệnh vận chuyển, phù hiệu, thiết bị giám sát hành trình, thời gian lái xe liên tục và trong ngày).
- Luật vận tải để ở đâu theo D16 (đề xuất: `document_rules`, nhóm `van_tai_khach`). Ngưỡng thời gian lái là tham số của luật có duyệt, không đặt trong mã.
- Cách đếm trẻ em là quy tắc dễ sai: ghi riêng vào bảng cần kiểm, không tự đặt. Chưa có luật đã duyệt thì xe có trẻ em không vào lượt.
- 20 xe demo. Id người trên sơ đồ sinh ngẫu nhiên theo lượt, không lộ loại.

Mô-đun: M1 mở rộng thêm "lệnh vận chuyển", "phù hiệu", "dữ liệu giám sát hành trình" và bộ kiểm luật nhóm `van_tai_khach` (hỏi trước). M2 (chạm, đóng dấu dùng phần mở rộng nhãn của T12, `KeoTha` cho bước sắp lỗi), M3, M4, M8. Sơ đồ khoang xe là phần riêng của trò, vẽ bằng SVG.
Câu hỏi quyết định liên quan: D15, D16, D19, D20.
Test riêng: đếm dư, đếm thiếu, chạm hai lần cùng một người không tính hai lần; lỗi thời gian lái đúng bằng ngưỡng; hai lỗi cùng mức phạt tối đa thì thứ tự nào cũng đúng; test của trò 1, 4, 12 vẫn đạt sau khi mở rộng M1.
```

### T14. Soi xe cải tạo

```text
Làm GĐ-T14 "Soi xe cải tạo" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.14.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Mỗi lượt 8 xe. Mỗi xe có hình vẽ vector nhìn nghiêng và nhìn sau, cạnh đó là giấy chứng nhận kiểm định giản lược ghi thông số (kích thước bao, kích thước thùng, cỡ lốp, số chỗ, màu sơn, đèn).
- Thao tác:
  - khoanh vùng trên hình xe chỗ không khớp với giấy (thùng cơi nới, đèn gắn thêm, ống xả độ, lốp khác cỡ, đổi màu sơn, thêm ghế);
  - mỗi vùng khoanh xong, chạm vào dòng tương ứng trên giấy để nối cặp;
  - hết xe thì đóng dấu Đạt hoặc Không đạt (đề xuất nhãn).
- Có nút phóng to (2×) và thước đo kéo được hai đầu để đo kích thước thùng trên hình (số đo theo tỷ lệ hình, mm).
- Màn 1: một chỗ sai rõ. Màn 5: 2–3 chỗ sai, một chỗ phải đo bằng thước mới thấy, có giờ.
- Điểm: mỗi chỗ sai khoanh đúng vùng (IoU ≥ 0,5 với vùng đáp án) +5; nối đúng dòng trên giấy +3; khoanh nhầm −2, không âm; dấu đúng +5 (đề xuất).
- Giới hạn: vùng khoanh lớn hơn 25% diện tích hình bị loại và tính là khoanh nhầm; tối đa 6 vùng mỗi hình (đề xuất).

Dữ liệu và căn cứ:
- Tra kho: quy định cải tạo phương tiện, tự ý thay đổi kết cấu, kích thước thùng, màu sơn, lắp thêm đèn và còi.
- Hình xe dựng từ tham số (loại xe, kích thước, các "biến thể cải tạo") để sinh nhiều xe từ ít hình gốc. Đặt bộ dựng hình ở `tro-choi/hinh-xe-tham-so.ts`: T19 sẽ dùng lại.
- Danh mục biến thể cải tạo là nội dung có duyệt (`game_content` loại `bien_the_cai_tao`, có mã `violations`).
- Vùng đáp án không soạn tay: hàm thuần tính từ biến thể và tham số hình, chỉ chạy ở máy chủ. Hình gửi xuống dạng nét (path SVG), không gắn tên bộ phận.

Mô-đun:
- M1 mở rộng thêm trường thông số kỹ thuật vào loại giấy "giấy chứng nhận kiểm định" do T12 tạo, không tạo loại giấy thứ hai (hỏi trước).
- M2: `KhoanhVung` đã được tách thành mô-đun ở GĐ-T5 (`components/tro-choi/chung/tuong-tac/KhoanhVung.tsx`), dùng lại, không sửa. Đóng dấu dùng phần mở rộng nhãn của T12.
- IoU là hàm mới trong tệp của trò; `mo-phong/camera.ts` có `tyLePhu` (tỷ lệ phủ), khác IoU, không sửa tệp đó.
- M3, M4, M8.
Câu hỏi quyết định liên quan: D15, D32.
Test riêng: khoanh trùng hai lần một chỗ chỉ tính một lần; khoanh cả hình để "trúng" mọi chỗ thì bị chấm 0 (giới hạn diện tích vùng); IoU 0,49 không có điểm, 0,5 có; đề không có danh sách biến thể, vùng đáp án, tên bộ phận.
```

### T15. Dựng chốt an toàn ban đêm

```text
Làm GĐ-T15 "Dựng chốt an toàn ban đêm" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.15.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Người chơi được giao một đoạn đường (thẳng, cong, dốc, gần giao lộ) vào ban đêm, và một túi đồ gồm cọc tiêu, biển báo tạm, đèn cảnh báo, xe tuần tra, 2–4 chiến sĩ.
- Thao tác: kéo từng vật vào vị trí trên đoạn đường, xoay hướng biển, đặt vị trí đứng cho từng chiến sĩ. Bấm "Chạy thử": M5 cho dòng xe chạy qua trong 60 giây mô phỏng.
- Kết quả hiện:
  - xe nào phanh gấp;
  - xe nào đi vào vùng nguy hiểm của chiến sĩ;
  - ùn tắc dài bao nhiêu;
  - biển nào đặt quá gần hoặc bị khuất tầm nhìn.
- Mỗi màn được chạy thử tối đa 2 lần. Sau lần chạy thử thứ hai vẫn sửa được; bấm "Nộp" thì máy chủ chạy bố trí lúc nộp để chấm (đề xuất; khác trò 3, nơi chấm bố trí lúc chạy thử cuối). Chạy thử lần thứ 3 thì cả bước 0 điểm.
- Vị trí đặt theo lưới 1 m dọc đường và theo làn, lề ngang đường (đề xuất).
- Màn 1: đường thẳng, ít xe. Màn 3: đường cong, tầm nhìn ngắn. Màn 5: gần giao lộ, có xe tải, có xe chạy quá tốc độ.
- Điểm: sáu tiêu chí, tổng 100 (khoảng cách biển đầu tiên 20, cọc liền mạch 15, chiến sĩ ngoài vùng nguy hiểm 20, số xe phanh gấp 20, độ dài ùn 15, biển không bị khuất 10). Mọi ngưỡng nằm trong nội dung có duyệt (`game_content` loại `tieu_chi_chot`), không đặt trong mã. Chấm khoảng cách bằng mét hay chỉ chấm thứ tự và phía đặt theo D21.
- Tách khỏi trò 3 (Cắm biển): không có ô đặt cố định, không có biển nhiễu, chỉ có vật của chốt; chấm theo tiêu chí đo từ mô phỏng (GAME_DESIGN §5.21, D32).

Dữ liệu và căn cứ:
- Tra kho: quy định về báo hiệu khi tổ chức kiểm soát trên đường, khoảng cách đặt biển tạm (QCVN 41:2024 nếu có trong kho). Vị trí đứng, tác phong của chiến sĩ là "tài liệu nghiệp vụ do đơn vị cung cấp": dùng quy tắc chung dễ kiểm và đánh dấu demo.
- 10 đoạn đường demo.

Mô-đun: M5 mở rộng thêm vật cản tạm (cọc, xe đỗ), tầm nhìn đêm theo đèn và độ cong (bảng tra, không dùng hàm lượng giác), vùng nguy hiểm quanh người (sự kiện `vao_vung_nguy_hiem`), đo độ dài hàng chờ (hỏi trước). M2 (`KeoTha`), M3, M6 (chế độ đêm của trò 5; vẽ vật của chốt ở tệp mới `lib/ve-canh/ve-chot.ts`, sửa tệp M6 cũ thì hỏi trước), M7 (máy chủ chạy lại mô phỏng từ nhật ký đặt vật), M8.
Câu hỏi quyết định liên quan: D21, D32.
Test riêng: cùng cách đặt cùng kết quả ở máy khách và máy chủ (so băm trạng thái cuối); đặt vật ngoài phần đường hợp lệ bị từ chối; nhật ký có mốc thời gian sai bị chấm 0; test tất định và test của trò 3, 5, 9 vẫn đạt sau khi mở rộng M5.
```

### T16. Phân luồng khi có sự cố

```text
Làm GĐ-T16 "Phân luồng khi có sự cố" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.16.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Bản đồ khu phố dạng ô có một sự cố: tai nạn chắn 2 làn, sự kiện đông người, ngập nước, sửa đường.
- Người chơi có 5 phút thời gian mô phỏng và một số rào chắn, biển hướng đi tạm, chiến sĩ điều tiết.
- Thao tác:
  - đặt rào đóng đoạn đường;
  - đặt biển chỉ hướng đi tạm;
  - đặt chiến sĩ tại giao lộ để ưu tiên một hướng.
- Bấm "Chạy": M5 mô phỏng lưu lượng. Bản đồ tô màu độ ùn theo đoạn đường. Người chơi được sửa trong lúc chạy (có tạm dừng).
- Mục tiêu từng màn:
  - xe cứu thương vào được hiện trường trong X giây;
  - tổng thời gian trễ của các xe dưới ngưỡng;
  - không có xe đi vào đoạn đã đóng.
- Màn 1: một sự cố, lưới 6×6. Màn 5: hai sự cố cùng lúc, giờ cao điểm, có đường một chiều.
- Điểm: xe cứu thương tới trong hạn 40; tổng trễ dưới ngưỡng 30 (tuyến tính tới 0 ở mức gấp đôi ngưỡng); không xe vào đoạn đã đóng 20 (trừ 5 mỗi xe); phương án gọn 10 (trừ 2 mỗi vật dùng thêm so với phương án mẫu).
- Một kịch bản là một bước; được chạy lại từ đầu một lần (đề xuất).
- Mỗi kịch bản có phương án mẫu (chỉ máy chủ giữ). Bộ kiểm chạy M5 với phương án mẫu khi lưu và khi duyệt; không đạt mọi mục tiêu thì từ chối.

Dữ liệu và căn cứ:
- Tra kho: quy định về tổ chức giao thông, phân luồng khi có sự cố, quyền ưu tiên của xe cứu thương, cứu hỏa. Kịch bản phân luồng mẫu của đơn vị (nếu có) là tài liệu nội bộ, đánh dấu demo.
- 10 kịch bản demo.
- Không dùng lại `incident_types` của trò 6 cho sự cố của trò này, để hai trò không lẫn luật ưu tiên (GAME_DESIGN §5.21).

Mô-đun: M9 (bản đồ ô). GĐ-T6 chưa tạo M9 thì dừng và hỏi theo quy tắc 11 ở Phần chung (D22: đề xuất làm GĐ-T6 trước). M5 mở rộng thêm lưu lượng theo giờ, xe chọn đường theo M9 và đổi đường khi gặp rào hoặc biển hướng tạm, đo độ ùn theo đoạn (hỏi trước); làn M5 dựng từ tuyến ô như trò 9; tối đa 60 xe cùng lúc để chạy lại dưới 200 ms. M2, M3, M6, M7, M8.
Câu hỏi quyết định liên quan: D22.
Test riêng: máy chủ chạy lại nhật ký cho đúng số liệu ùn; đặt rào giữa lúc chạy được ghi đúng nhịp; kịch bản không có lời giải (kiểm khi duyệt nội dung, không phải lúc chơi) bị trình soạn từ chối; test của trò 3, 5, 9, 15 vẫn đạt sau khi mở rộng M5.
```

### T17. Truy vết xe bỏ trốn

```text
Làm GĐ-T17 "Truy vết xe bỏ trốn" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.17.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Lượt mở đầu bằng một tin báo dạng chữ (có nút nghe bằng giọng đọc sẵn có): xe gây tai nạn bỏ chạy, kèm mô tả một phần (loại xe, màu, 2–3 ký tự biển số, hướng chạy, thời điểm).
- Bản đồ khu phố có các điểm camera. Mỗi lần người chơi chạm một camera thì xem đoạn cảnh 10 giây quanh thời điểm đã tính theo quãng đường.
- Thao tác:
  - chạm đúng xe khớp mô tả trong dòng xe để "khóa" xe;
  - chọn camera kế tiếp theo hướng xe đi;
  - tới camera cuối thì đặt điểm chặn trên bản đồ.
- Có "ngân sách lượt xem camera": mở camera sai hướng thì tốn lượt và thời gian.
- Màn 1: 3 camera, xe duy nhất cùng màu. Màn 5: 8 camera, có xe mồi giống mô tả, có đoạn khuất camera phải suy ra.
- Điểm (đề xuất): khóa đúng xe ở mỗi camera +5; khóa nhầm −3, không âm; đặt điểm chặn đúng +20; thưởng theo lượt xem còn dư.

Dữ liệu và căn cứ:
- Trò thiên về kỹ năng quan sát và suy luận. Phần căn cứ ở màn kết quả: quy định về hành vi bỏ chạy sau tai nạn, trách nhiệm của người điều khiển liên quan tới vụ tai nạn (tra kho). Đưa vào bảng cần kiểm: nội dung trò có lộ phương pháp nghiệp vụ không được công bố không.
- Lộ trình xe và thời điểm sinh tất định từ seed trên M9 và M5. Máy khách chỉ nhận đoạn cảnh của camera đã mở, không nhận cả lộ trình. Id xe sinh riêng cho từng đoạn cảnh, để không lần theo id từ đoạn này sang đoạn khác.
- Thời điểm đoạn cảnh = lần khóa trước + quãng đường ngắn nhất chia tốc độ trung bình của loại xe (đề xuất). Mở camera sai hướng tốn một lượt xem và 30 giây trong trò (đề xuất). Điểm chặn đúng khi nằm trên lộ trình phía trước và xe tới đó muộn hơn lúc đặt ít nhất 60 giây trong trò (đề xuất).
- 8 vụ demo (đề xuất).

Khung chung (bắt buộc hỏi trước khi làm): khung hiện sinh mọi đề lúc tạo lượt, nên không trả được đoạn cảnh theo camera người chơi chọn. Theo D23, đề xuất thêm móc "đề bước sau dựng từ trả lời các bước trước", mỗi lần mở camera là một bước. Cách khác: route riêng của trò. Chưa có trả lời D23 thì không bắt đầu phần mã.
Offline theo D24: gói offline buộc phải mang seed và lộ trình.

Mô-đun: M5, M6 (phát lại đoạn cảnh, khung camera của trò 5), M7, M9, M3, M8. Chạm xe: `KhoanhVung` (M2, `onCham`), như trò Soi camera. Nút nghe tin báo dùng `/v1/giong-doc` (cần mạng; offline chỉ hiện chữ).
Câu hỏi quyết định liên quan: D15, D22, D23, D24.
Test riêng: API không trả lộ trình đầy đủ trước khi chấm (test quét khóa cấm thêm `lo_trinh`, `xe_muc_tieu`, `diem_chan`, `seed_lo_trinh`); mở camera chưa được phép theo thời gian mô phỏng bị từ chối; cùng seed cùng lộ trình; id xe khác nhau giữa hai đoạn cảnh; nếu sửa khung thì mọi test của `luot-choi.test.ts` và các trò đã xong vẫn đạt.
```

### T18. 10 phút đầu tại hiện trường

```text
Làm GĐ-T18 "10 phút đầu tại hiện trường" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.18.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Người chơi đến hiện trường một vụ tai nạn (vẽ từ trên xuống, tĩnh hoặc động nhẹ). Có đồng hồ "10 phút" chạy nhanh: 1 giây thật bằng 10 giây trong trò. Mỗi thao tác tốn một khoảng thời gian trong trò.
- Thao tác thật trên cảnh:
  - kéo xe tuần tra và cọc tiêu để bảo vệ hiện trường;
  - giữ nút bộ đàm để gọi cấp cứu, cứu hỏa;
  - chạm từng nạn nhân để đánh giá (tỉnh, bất tỉnh, chảy máu) rồi kéo thao tác sơ cứu vào (đặt tư thế nằm nghiêng an toàn, ép cầm máu, không dời người nghi chấn thương cột sống);
  - đánh dấu vị trí xe và vết trước khi cho dời xe.
- Thứ tự sai có hậu quả hiện ngay trên cảnh (xe khác lao vào vì chưa có cảnh báo, vết phanh mất vì dời xe trước khi đánh dấu). Không có danh sách để chọn.
- Màn 1: một xe, một nạn nhân tỉnh. Màn 5: nhiều xe, có cháy nổ, đêm mưa.
- Màn 1 đồng hồ chạy chậm hơn (1 giây thật = 5 giây trò, đề xuất).
- Điểm: mỗi bước quan trọng làm đúng và đúng hạn +10; mỗi hậu quả xảy ra −10, không âm; thời gian dư +1 mỗi 30 giây trò, tối đa 10.
- Nối với trò 10 (Tái dựng hiện trường): không làm ở giai đoạn này (D25: đề xuất làm sau khi GĐ-T10 xong).
- Giảm chuyển động: đồng hồ vẫn chạy (là luật chơi); hậu quả hiện bằng ảnh tĩnh kèm chữ; không có mưa, lửa động.

Dữ liệu và căn cứ:
- Tra kho: trách nhiệm khi xảy ra tai nạn, bảo vệ hiện trường, cấp cứu người bị nạn. Kỹ thuật sơ cứu cần nguồn y tế: không có trong kho thì ghi "chưa có trong kho", đánh dấu demo và đưa vào bảng cần kiểm với ghi chú "cần cán bộ y tế xác nhận". Giữ hay bỏ thao tác sơ cứu theo D27.
- Thứ tự thao tác nghiệp vụ tại hiện trường là "tài liệu nghiệp vụ do đơn vị cung cấp". Đề xuất để các bước nghiệp vụ ở `procedures` dạng mở rộng của T4 (quy trình demo trong `data/tra-cuu/quy-trinh.json`); kịch bản và hậu quả ở `game_content` (D26). Không viết máy trạng thái thứ hai khác cách mô tả bước của T4.
- 8 kịch bản demo. Mỗi kịch bản là đồ thị bước có điều kiện trước, hạn làm và hậu quả, không phải danh sách cứng. Bộ kiểm đồ thị: không chu trình, mọi bước tới được.
- Không dùng lại định dạng cây chọn nhánh của trò Hiện trường cũ (GAME_DESIGN §5.21).

Mô-đun: M2 (`KeoTha`, `Giu`), M3, M7 (máy chủ chạy lại nhật ký trên đồng hồ trong trò), M8. Cảnh vẽ tĩnh bằng SVG; dùng M6 nếu kịch bản cần dòng xe chạy liên tục.
Câu hỏi quyết định liên quan: D15, D25, D26, D27.
Test riêng: cùng nhật ký cùng hậu quả; làm bước khi chưa đủ điều kiện trước thì ghi hậu quả đúng; đồng hồ trong trò không bị máy khách tua; đồ thị có chu trình hoặc bước không tới được bị trình soạn báo lỗi.
```

### T19. Tạm giữ phương tiện

```text
Làm GĐ-T19 "Tạm giữ phương tiện" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.19.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Người chơi phải tạm giữ một xe (mô tô hoặc ô tô) sau khi đã có quyết định. Trò có 4 bước liên tiếp trong một lượt:
  1. Kiểm đếm: hình xe nhìn từ nhiều phía, có đồ vật trên xe (mũ bảo hiểm, túi, giấy tờ, đồ giá trị, hàng hóa), vết trầy, xước, móp. Chạm để ghi từng thứ.
  2. Lập danh mục: kéo các thứ đã ghi vào biên bản tạm giữ, chọn tình trạng (số lượng, mô tả) bằng thao tác trên thẻ, không phải trắc nghiệm.
  3. Niêm phong: giữ để dán niêm phong đúng vị trí (cốp, khoang hàng).
  4. Thời hạn và bàn giao: kéo mốc thời hạn trên lịch, chọn nơi giữ.
- Bỏ sót đồ giá trị hoặc vết hư hỏng thì màn kết quả mô phỏng "khiếu nại khi trả xe".
- Màn 1: xe máy, 3 đồ vật. Màn 5: ô tô chở hàng, 10+ đồ vật, có vết hư hỏng khó thấy.
- Điểm: mỗi đồ vật hoặc vết ghi đúng +3; bỏ sót đồ giá trị −10, không âm trong bước; mỗi thẻ danh mục đúng số lượng và tình trạng +2; mỗi vị trí niêm phong đúng +5; thời hạn đúng +10; nơi giữ đúng +5 (đề xuất).
- Kiểm đếm: chạm vào một chỗ trên hình rồi chọn loại vật trong khay. Máy chủ khớp tọa độ với vật trong bán kính 24px (đề xuất). Hình gửi xuống dạng nét, không kèm danh sách vật, để không lộ số lượng và loại vật.

Dữ liệu và căn cứ:
- Tra kho: quy định tạm giữ phương tiện, giấy tờ theo thủ tục hành chính (thời hạn, biên bản, bảo quản, trả lại).
- Thời hạn, nơi giữ, các bước thủ tục: đề xuất quy trình demo "Tạm giữ phương tiện" trong `procedures` dạng mở rộng của T4, tham số thời hạn ở bước tương ứng (D26). Không đặt thời hạn trong mã. Lịch ngày nghỉ, lễ theo D28.
- Mẫu biên bản dùng hình giản lược, có chữ "MẪU TRÒ CHƠI", không theo đúng mẫu phôi thật.
- 12 xe demo.

Mô-đun: M1 (giấy tờ xe), M2 (chạm, `KeoTha`, `Giu`), M3, M4 mở rộng thêm loại "biên bản tạm giữ" (hỏi trước khi sửa M4), M8. Hình xe nhiều phía dùng lại bộ dựng hình từ tham số của T14 (`tro-nchoi/hinh-xe-tham-so.ts`); chuyển tệp đó sang `tro-choi/chung/` và sửa import của T14 thì hỏi trước.
Câu hỏi quyết định liên quan: D15, D26, D28.
Test riêng: ghi trùng một đồ vật chỉ tính một lần; thời hạn tính theo ngày giờ Việt Nam, ca biên qua ngày nghỉ (nếu văn bản có quy định); bước 4 không mở khi chưa xong bước 3; biên bản của trò 1, 4, 5, 9 không đổi sau khi mở rộng M4; E2E của trò 14 vẫn đạt sau khi chuyển bộ dựng hình.
```

### T20. Bản đồ điểm đen

```text
Làm GĐ-T20 "Bản đồ điểm đen" theo docs/PLAN.md và docs/GAME_DESIGN.md §5.20.
Trước khi làm, đọc và theo docs/PROMPT_TRO_CHOI_MOI.md mục 1 (Phần chung).

Mô tả trò:
- Trò dành cho cán bộ quản lý và người có kinh nghiệm. Khóa theo cấp độ (XP) trái GAME_DESIGN §2.4 "không có màn nào khóa vì thiếu XP"; theo D29, đề xuất không khóa, thẻ trò ghi "Dành cho cán bộ quản lý và người có kinh nghiệm".
- Bản đồ khu phố dạng ô có lớp nhiệt tai nạn 12 tháng giả lập: điểm, giờ, loại va chạm, loại xe.
- Thao tác:
  1. khoanh các điểm đen trên bản đồ;
  2. với mỗi điểm, kéo biện pháp từ bảng vào (camera, gờ giảm tốc, biển hạn chế tốc độ, đèn tín hiệu, tăng tuần tra theo khung giờ, sơn vạch), mỗi biện pháp có chi phí;
  3. trong giới hạn ngân sách, bấm "Mô phỏng 12 tháng".
- "Mô phỏng 12 tháng" là nộp bài, chỉ một lần (đề xuất). Bảng hiệu quả không gửi xuống điện thoại; cho mô phỏng nhiều lần thì người chơi dò dần được bảng này qua máy chủ.
- Mô hình thống kê tất định ở máy chủ tính lại số vụ với biện pháp mới và so trước, sau: số vụ kỳ vọng mỗi ô theo nguyên nhân nhân hệ số giảm của biện pháp. Mỗi biện pháp có hiệu quả theo loại nguyên nhân: đặt gờ giảm tốc ở nơi tai nạn do vượt đèn đỏ thì ít tác dụng.
- Màn 1: 2 điểm đen rõ. Màn 5: 6 điểm, có điểm "giả" do dữ liệu ít, ngân sách chặt.
- Điểm: khoanh đúng điểm đen +10 mỗi điểm (vùng chứa ô trung tâm, không quá 9 ô); khoanh điểm giả −5, không âm; mức giảm so với phương án tối ưu tối đa 60; chi phí dư +1 mỗi 5% ngân sách, tối đa 10, chỉ khi đạt từ 80% mức giảm tối ưu.
- Nối với trò 7 (Thành phố an toàn): theo D30, đề xuất không cộng thêm điểm xây dựng (XP của trò này đã vào trò 7 qua `xp_ledger`).
- Tách khỏi trò 7: trò 7 hiện sẵn điểm nóng; trò này không hiện điểm đen, người chơi phải đọc dữ liệu để tìm (GAME_DESIGN §5.21).

Dữ liệu và căn cứ:
- Tra kho: tiêu chí xác định điểm đen, trách nhiệm xử lý điểm đen, quy định đặt gờ giảm tốc, biển báo, đèn (QCVN 41:2024 nếu có trong kho). Bảng "hiệu quả biện pháp theo nguyên nhân" là giả định mô phỏng: ghi rõ "mô phỏng minh họa", đưa vào bảng cần kiểm. Đề xuất để ở `game_content` loại `hieu_qua_bien_phap`, dùng chung với trò 7 (D30).
- 8 bản đồ demo, mỗi bản đồ có phương án tối ưu tính sẵn khi duyệt nội dung (script `scripts/tinh-phuong-an-toi-uu.ts`), không tính lúc chơi.
- Offline: không, vì dữ liệu gắn với địa bàn, bảng hiệu quả không gửi xuống điện thoại và mô hình chạy ở máy chủ. Lý do đã ghi ở GAME_DESIGN §5.20.

Mô-đun: M9 mở rộng thêm lớp dữ liệu tai nạn, lớp nhiệt và mô hình số vụ 12 tháng (hỏi trước; M9 chưa có thì theo quy tắc 11 ở Phần chung). **Không dùng M5** (D31): M5 mô phỏng từng xe theo nhịp 50 ms, không có mô hình thống kê. M2 (`KeoTha`), M3, M7 (kiểm mốc thời gian), M8.
Câu hỏi quyết định liên quan: D15, D22, D29, D30, D31, D32.
Test riêng: vượt ngân sách bị từ chối (400); cùng phương án cùng kết quả mô phỏng; thời gian chấm ở máy chủ dưới 1 giây cho bản đồ lớn nhất; đề không có bảng hiệu quả, điểm đen đúng, phương án tối ưu; script tính phương án tối ưu đúng trên bản đồ thử nhỏ.
```

---

## 4. Prompt kiểm tra sau khi làm xong một trò

Dùng trong phiên mới, sau khi phiên làm trò báo xong.

```text
Đọc docs/PROMPT_TRO_CHOI_MOI.md mục 1 và giai đoạn GĐ-T<số> trong docs/PLAN.md.

Kiểm tra độc lập giai đoạn này, không sửa mã:
1. Chạy bun run typecheck, bun test, bun run build:web, bun run e2e <mã-trò>. Báo đúng kết quả, kể cả test hỏng từ trước.
2. So từng mục "Kiểm tra đã xong" được đánh [x] với mã và test thật. Mục nào đánh [x] mà không có bằng chứng thì liệt kê.
3. Tìm chỗ vi phạm Phần chung:
   - đáp án lộ trước khi chấm;
   - máy chủ tin điểm do máy khách gửi;
   - căn cứ viện dẫn không có trong kho;
   - số tiền phạt viết cứng trong mã;
   - sửa khung chung hoặc mô-đun mà không ghi đã hỏi;
   - dữ liệu mẫu thiếu nhãn [Demo];
   - trò bật (enabled = true) khi chưa đủ nội dung đã duyệt.
4. Chơi thử ở 360×740, chế độ thường và giảm chuyển động. Chụp ảnh màn hướng dẫn, một bước chơi, màn kết quả.
5. Đo kích thước gzip mã riêng của trò so với ngân sách.

Báo cáo: danh sách vấn đề xếp theo mức nghiêm trọng, mỗi vấn đề có tệp:dòng và cách tái hiện.
```
