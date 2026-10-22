# 09-a. Phương pháp đào tạo trực quan: bài giảng, bài tập, bài đánh giá

> Mở rộng của `ke-hoach/09-dao-tao-chuyen-de.md`. Tài liệu 09 định nghĩa **chuyên đề học cái gì**;
> tài liệu này định nghĩa **dạy như thế nào**: thư viện khối nội dung, thư viện dạng bài tập,
> hệ đánh giá, quy trình để tác nhân AI đồng soạn, lộ trình cá nhân hoá, thống kê và cơ chế
> đồng hành. Mascot đồng hành tách sang `09-b`; bảng điều khiển quản trị tách sang `09-c`.

## 1. Nguyên tắc sư phạm

Năm nguyên tắc dưới đây ràng buộc mọi thiết kế phía sau. Nguyên tắc 1 và 5 là ràng buộc **cứng**:
vi phạm thì không được xuất bản.

1. **Không có căn cứ thì không dạy.** Mọi khẳng định pháp lý trong bài giảng, mọi đáp án đúng
   trong bài tập, mọi tiêu chí trong rubric chấm đều phải trỏ tới một nút văn bản (`citations[]`)
   còn hiệu lực tại `as_of` của bài. Câu nào không gắn được căn cứ thì phải gắn nhãn
   `kinh_nghiem` (kinh nghiệm thực hành) hoặc bị loại. Xem `08 §4` (`citation_health`).
2. **Học qua làm, không học qua đọc.** Mỗi bài học có ít nhất một hoạt động sinh ra **sản phẩm
   thật** cho ví dụ xuyên suốt (một mục BCNCKT, một dòng dự toán, một kế hoạch LCNT). Cuối
   chuyên đề, học viên có một bộ hồ sơ hoàn chỉnh chứ không phải một tấm chứng nhận.
3. **Vòng lặp ngắn.** Không để học viên đi quá 4–6 phút mà không có một tương tác có phản hồi.
   Phản hồi phải **giải thích tại sao**, kèm nút mở thẳng điều khoản liên quan.
4. **Sai là dữ liệu, không phải hình phạt.** Mọi lần sai được ghi lại theo *loại lỗi khái niệm*
   (xem §6.3) để hệ thống đưa lại đúng chỗ hổng, không phải để trừ điểm.
5. **Trực quan không được làm sai luật.** Sơ đồ, hoạt hình, ẩn dụ đều là **diễn giải**; mỗi khối
   trực quan bắt buộc có `nguyen_van` — nút văn bản gốc mở được ngay bên cạnh. Khi văn bản đổi,
   khối trực quan bị đánh dấu `can_cap_nhat` và hiển thị dải cảnh báo cho học viên.

## 2. Thư viện khối nội dung bài giảng (content blocks)

Bài học không phải một khối Markdown. Bài học là **một dãy khối có kiểu**, mỗi kiểu có schema
riêng, renderer riêng, và quy tắc kiểm tra căn cứ riêng. Nhờ vậy AI sinh được, người sửa được,
máy kiểm tra được, và giao diện đọc được trên điện thoại.

Kiểu khối được đặt tên bằng tiếng Việt không dấu, lưu trong cột `kind` của bảng `lesson_blocks`.

| # | `kind` | Tên hiển thị | Nội dung | Vì sao có mặt |
|---|--------|--------------|----------|----------------|
| 1 | `giang` | Đoạn giảng | Markdown, tối đa ~250 từ mỗi khối | Đơn vị đọc cơ bản; ngắn để mobile không mỏi |
| 2 | `can_cu` | Thẻ căn cứ | Trích nguyên văn nút + URN + trạng thái hiệu lực + nút "mở toàn văn" | Hiện thực hoá nguyên tắc 1; là khối duy nhất được coi là "lời của pháp luật" |
| 3 | `so_do_trinh_tu` | Sơ đồ trình tự | Các bước (node) + mũi tên + căn cứ từng bước + mốc thời hạn | Trình tự thủ tục là thứ khó nhất khi đọc văn bản thuần chữ |
| 4 | `dong_thoi_gian` | Dòng thời gian hiệu lực | Các mốc: ban hành → hiệu lực → sửa đổi → hết hiệu lực, có vạch chuyển tiếp | Bài học lớn nhất của chuyên đề 1 (xem 09 §2.1) |
| 5 | `doi_chieu` | Bảng đối chiếu trước/sau | Hai cột văn bản cũ ↔ mới, tô khác biệt cấp từ | Dạy đọc sửa đổi mà không phải mở hai tab |
| 6 | `bang_tra` | Bảng tra cứu | Bảng có lọc và tìm trong bảng; cuộn ngang trong khung | Thẩm quyền, hạn mức, định mức |
| 7 | `cong_thuc` | Công thức tương tác | KaTeX + các ô nhập biến + kết quả tính trực tiếp + căn cứ công thức | Học công thức bằng cách kéo tham số, không bằng cách nhìn |
| 8 | `diem_nong` | Ảnh chú giải điểm nóng | Ảnh (mẫu tờ trình, mẫu biểu) + các chấm bấm được, mỗi chấm mở một chú giải + căn cứ | Dạy biểu mẫu đúng cách người ta dùng biểu mẫu |
| 9 | `the_lat` | Bộ thẻ lật | Mặt trước: thuật ngữ/tình huống; mặt sau: định nghĩa + căn cứ | Ghi nhớ thuật ngữ; nạp thẳng vào lịch ôn giãn cách (§6.4) |
| 10 | `hoi_nhanh` | Hỏi nhanh giữa bài | 1 câu, 2–4 lựa chọn, phản hồi ngay, **không tính điểm** | Giữ nhịp chú ý; đo hiểu bài theo thời gian thực |
| 11 | `bieu_mau` | Mô phỏng biểu mẫu | Biểu mẫu thật của phụ lục thông tư, điền được, kiểm tra từng trường, xuất DOCX | Sản phẩm thật (nguyên tắc 2) |
| 12 | `may_tinh` | Máy tính nhúng | Nhúng công cụ của 09 §2.4 (chi phí phần mềm, định tuyến thủ tục) ngay trong bài | Không bắt học viên rời bài để đi dùng công cụ |
| 13 | `cay_quyet_dinh` | Cây quyết định | Chuỗi câu hỏi có/không → kết luận "lối đi pháp lý" + căn cứ từng nhánh | Phân loại dự án/mua sắm/thuê dịch vụ (bài 2) |
| 14 | `ban_do_khai_niem` | Bản đồ khái niệm | Đồ thị khái niệm và quan hệ, bấm vào mở nút văn bản | Cho người học thấy hệ thống, không chỉ thấy điều lẻ |
| 15 | `ho_so` | Băng chuyền hồ sơ | Danh mục tài liệu của một giai đoạn, kéo thả sắp xếp, đánh dấu bắt buộc/tuỳ chọn | Hồ sơ là thứ học viên bị trả lại nhiều nhất |
| 16 | `kich_ban` | Kịch bản tình huống | Đoạn hội thoại/tình huống có nhân vật, dẫn vào bài tập phân nhánh | Tạo bối cảnh; chỗ mascot vào vai (09-b §7) |
| 17 | `video` | Video / hoạt hình | Nguồn video + phụ đề + mốc chương + bản chép lời | Kênh thứ hai cho người học nghe tốt hơn đọc |
| 18 | `canh_bao` | Dải cảnh báo | Cảnh báo hiệu lực / sai sót thường gặp / mẹo thực hành | Tách bạch "luật nói" với "kinh nghiệm nói" |
| 19 | `tom_tat` | Chốt lại | 3–5 gạch đầu dòng + danh mục căn cứ của cả bài | Đóng vòng lặp trí nhớ cuối bài |

**Quy tắc dựng bài.** Một bài học chuẩn dài 12–20 phút, gồm 8–14 khối, theo nhịp:
`kich_ban` → `giang` → `can_cu` → (khối trực quan) → `hoi_nhanh` → `giang` → … → hoạt động sản
phẩm → `tom_tat`. Bộ kiểm tra tự động (`scripts/kiem-tra-bai-hoc.ts`) chặn xuất bản nếu:
không có khối `can_cu` nào, hai khối `giang` liên tiếp quá 500 từ, hoặc khoảng cách giữa hai
khối tương tác vượt 6 phút đọc ước tính.

## 3. Thư viện dạng bài tập (activities)

Bài tập lưu trong `activities`, chấm bằng `packages/dao-tao/src/grading.ts`. Cột `mode` cho biết
ai chấm: `may` (tất định), `ai` (mô hình chấm theo rubric), `nguoi` (giảng viên), `tu_danh_gia`.

| # | `kind` | Dạng bài | Cách chấm | Dùng cho |
|---|--------|----------|-----------|----------|
| 1 | `trac_nghiem` | Trắc nghiệm một/nhiều đáp án | `may` | Kiến thức nền, thẩm quyền, hạn mức |
| 2 | `dung_sai` | Đúng/sai kèm bắt buộc nêu căn cứ | `may` + `ai` (phần căn cứ) | Chống đoán mò |
| 3 | `dien_khuyet` | Điền chỗ trống trong trích dẫn văn bản | `may` (so khớp chuẩn hoá) | Thuộc con số, thời hạn |
| 4 | `sap_xep` | Sắp xếp đúng trình tự các bước | `may` (Kendall tau) | Trình tự thủ tục |
| 5 | `ghep_cap` | Ghép nội dung ↔ căn cứ | `may` | Kỹ năng "mục nào theo điều nào" |
| 6 | `keo_tha_so_do` | Kéo thả vào ô trống của sơ đồ | `may` | Sơ đồ trình tự, cơ cấu hồ sơ |
| 7 | `soi_loi` | Soi lỗi: đánh dấu chỗ sai trong một văn bản mẫu | `may` (vùng đánh dấu) + `ai` (lý do) | Bài 12 — sai sót thường gặp |
| 8 | `tinh_toan` | Bài tính có số liệu (dự toán, công tháng, dự phòng) | `may` (sai số cho phép) | Bài 5 |
| 9 | `dien_bieu_mau` | Điền biểu mẫu thật theo tình huống | `may` (trường bắt buộc) + `ai` (nội dung) | Sản phẩm thật |
| 10 | `viet_co_can_cu` | Viết đoạn nghị luận pháp lý, bắt buộc trích dẫn | `ai` theo rubric, `nguoi` chấm mẫu | Bài 3, 4, 11 |
| 11 | `truy_tim` | Truy tìm căn cứ có tính giờ (dùng công cụ tra cứu thật) | `may` (URN đích) | Bài 1 — kỹ năng tra cứu |
| 12 | `phan_nhanh` | Tình huống phân nhánh nhiều bước, mỗi lựa chọn đổi trạng thái hồ sơ | `may` (chấm đường đi) | Bài 2, 6, 8 |
| 13 | `dong_vai_hoi_dong` | Đóng vai thành viên hội đồng thẩm định, chấm một hồ sơ theo phiếu | `ai` (đối chiếu với phiếu mẫu) | Bài 6 |
| 14 | `phan_bien` | Đối thoại phản biện: AI đóng vai nhà thầu/kiểm toán viên chất vấn học viên | `ai` theo rubric hội thoại | Bài 11, 12 |
| 15 | `du_an_nho` | Bài lớn nộp tệp (DOCX/XLSX) cho một giai đoạn | `ai` sơ chấm + `nguoi` duyệt | Cuối mỗi cụm bài |

**Ba ràng buộc chung cho mọi dạng bài.**
- **Phản hồi có căn cứ**: mỗi phương án (kể cả phương án sai) mang trường `giai_thich` và
  `citations[]`. Học viên bấm là mở đúng khoản.
- **Nhãn lỗi khái niệm**: mỗi phương án sai gắn `ma_loi` (ví dụ `nham_chuyen_tiep`,
  `sai_tham_quyen`, `dung_van_ban_het_hieu_luc`). Đây là đầu vào của lộ trình cá nhân hoá.
- **Không rò đáp án**: đáp án và rubric không bao giờ đi ra API công khai; API học viên chỉ trả
  phần `de_bai`. Chấm luôn chạy phía máy chủ.

## 4. Hệ đánh giá

### 4.1 Bốn mức

| Mức | Tên | Khi nào | Cấu trúc | Tính điểm |
|-----|-----|---------|----------|-----------|
| 0 | Hỏi nhanh | Giữa bài | 1 câu | Không |
| 1 | Kiểm tra sau bài | Cuối mỗi bài | 3–5 câu, ≥1 câu tình huống | Có, ngưỡng đạt 70% |
| 2 | Kiểm tra cụm | Sau mỗi 3–4 bài | 8–12 câu + 1 bài sản phẩm | Có, ngưỡng 70% |
| 3 | Đánh giá cuối chuyên đề | Cuối | 20–30 câu + hồ sơ dự án + 1 phiên phản biện | Có, ngưỡng 80% |

### 4.2 Rubric

Mọi bài chấm bằng `ai` hoặc `nguoi` đều phải có rubric có cấu trúc, không chấm cảm tính:

```jsonc
{
  "tieu_chi": [
    { "ma": "can_cu",   "ten": "Viện dẫn đúng và còn hiệu lực", "trong_so": 40,
      "muc": [ {"diem": 0, "mo_ta": "Không viện dẫn hoặc viện dẫn văn bản đã hết hiệu lực"},
               {"diem": 2, "mo_ta": "Viện dẫn đúng văn bản nhưng sai điều/khoản"},
               {"diem": 4, "mo_ta": "Viện dẫn đúng tới khoản, đúng thời điểm áp dụng"} ] },
    { "ma": "day_du",   "ten": "Đủ nội dung bắt buộc",  "trong_so": 30, "muc": [] },
    { "ma": "lap_luan", "ten": "Lập luận chặt chẽ",      "trong_so": 20, "muc": [] },
    { "ma": "trinh_bay","ten": "Trình bày, thuật ngữ",   "trong_so": 10, "muc": [] }
  ],
  "nguong_dat": 70
}
```

Tiêu chí `can_cu` **luôn có trọng số lớn nhất** và luôn có mức 0 dành cho việc dùng văn bản đã
hết hiệu lực — đúng bài học cốt lõi của chuyên đề 1.

### 4.3 AI chấm nhưng người chịu trách nhiệm

- AI chấm trả về: điểm từng tiêu chí + trích đoạn bài làm làm bằng chứng + căn cứ pháp lý cho
  nhận xét. Không có bằng chứng thì không được cho điểm.
- **Lấy mẫu bắt buộc**: 10% bài chấm bằng AI (và 100% bài mức 3) được đẩy vào hàng đợi
  `cham-lai` cho giảng viên đối chiếu. Lệch quá 1 mức trên bất kỳ tiêu chí nào thì đánh dấu
  prompt cần hiệu chỉnh và ghi vào eval (`evals/`).
- Học viên có nút **"phúc khảo"**: gửi lại cho người chấm, không mất lượt.
- Điểm do AI chấm hiển thị nhãn *"chấm tự động — có thể phúc khảo"*, không giấu.

### 4.4 Liêm chính và chứng nhận

- Mức 3 xáo thứ tự câu và phương án, rút đề từ ngân hàng câu hỏi theo `ma_loi` để hai học viên
  không trùng đề.
- Không dùng biện pháp giám sát xâm phạm (không camera, không khoá màn hình). Thay vào đó dựa
  vào bài sản phẩm và phiên phản biện — thứ khó gian lận và cũng khó chán.
- Chứng nhận ghi: chuyên đề, ngày, `as_of` khung pháp lý đã học, danh mục văn bản căn cứ, mã
  tra cứu công khai. Chứng nhận **có hạn theo khung pháp lý**: khi một văn bản nền hết hiệu
  lực, hệ thống gửi lời mời học bù phần thay đổi (`bai_cap_nhat`) thay vì âm thầm để chứng
  nhận lạc hậu.

## 5. Tác nhân AI đồng soạn nội dung

Toàn bộ nội dung đều **có thể** do tác nhân AI dựng bản đầu; không nội dung nào được xuất bản
nếu chưa qua người. Quy trình 7 bước, mỗi bước là một job (`qdpl-soan-bai`), có thể chạy lại
độc lập.

| Bước | Tên job | Đầu vào | Đầu ra | Prompt |
|------|---------|---------|--------|--------|
| 1 | `ban_do_phap_ly` | Chủ đề, đối tượng, `as_of` | Danh mục văn bản theo thứ bậc + trạng thái hiệu lực | dùng công cụ tra cứu, không dùng trí nhớ |
| 2 | `dan_y` | Bản đồ pháp lý | Dàn ý chuyên đề: bài, mục tiêu, căn cứ chính | `prompts/dao-tao/dan-y-chuyen-de.md` |
| 3 | `soan_bai` | Một mục dàn ý + nguyên văn các nút | Dãy khối nội dung (§2) dạng JSON | `prompts/dao-tao/soan-bai-hoc.md` |
| 4 | `sinh_bai_tap` | Bài học đã soạn | Hoạt động (§3) + phương án sai có `ma_loi` | `prompts/dao-tao/sinh-bai-tap.md` |
| 5 | `sinh_rubric` | Bài tập tự luận | Rubric §4.2 | cùng prompt bước 4, chế độ rubric |
| 6 | `kiem_can_cu` | Bài + bài tập | Báo cáo `citation_health`: URN nào sai, hết hiệu lực, không tồn tại | không gọi mô hình — chạy `packages/citation` + CSDL |
| 7 | `soat_loi` | Toàn bộ | Danh sách nghi vấn: khẳng định không có căn cứ, số liệu lệch nguyên văn, thuật ngữ sai | `prompts/dao-tao/soat-bai.md` |

**Ràng buộc bắt buộc với mọi prompt soạn bài** (viết thẳng trong phần SYSTEM):

1. Chỉ được dùng **nguyên văn các nút được cung cấp trong ngữ cảnh**. Không được viện dẫn văn
   bản không có trong ngữ cảnh, kể cả khi "biết".
2. Mỗi khối `can_cu` phải trích đúng nguyên văn, không diễn đạt lại, và ghi `node_urn`.
3. Khi ngữ cảnh không đủ để khẳng định, phải xuất khối `canh_bao` với nội dung
   *"chưa đủ căn cứ trong kho — cần biên tập viên bổ sung"*, tuyệt đối không suy đoán.
4. Không sinh số liệu, thời hạn, hạn mức, tỷ lệ phần trăm nào không có trong ngữ cảnh.
5. Ngôn ngữ: tiếng Việt hành chính, ngắn, câu chủ động, không sáo ngữ.

**Trạng thái nội dung** (`status` của `courses` / `lessons` / `activities`):
`nhap` → `ai_soan` → `bien_tap` → `cho_phap_che` → `xuat_ban` → `can_cap_nhat` → `luu_tru`.
Chỉ tài khoản vai trò `phap_che` trở lên mới chuyển sang `xuat_ban`. Mọi chuyển trạng thái ghi
vào `audit_log` kèm người thực hiện và mô hình đã dùng (`model`, `prompt_version`, `cost_usd`).

**Giá thành.** Ước tính một bài học hoàn chỉnh: bước 3 ~25k token vào / 8k ra, bước 4 ~15k/6k
với `tier: "bulk"`. Toàn bộ 12 bài của chuyên đề 1 nằm dưới 5 USD nếu chạy qua Batch API
(`batch: true`), nên mặc định các job soạn bài chạy chế độ batch, trừ khi biên tập viên bấm
"soạn lại ngay".

## 6. Lộ trình học và cá nhân hoá

### 6.1 Bản đồ năng lực

Mỗi chuyên đề có một **bản đồ năng lực** (`skills`): danh sách kỹ năng có quan hệ tiên quyết,
ví dụ `tra_cuu_hieu_luc` → `phan_loai_hoat_dong` → `lap_tong_muc_dau_tu`. Mỗi bài học và mỗi
bài tập gắn với một hoặc nhiều kỹ năng. Đây là xương sống cho cả gợi ý bước kế tiếp lẫn thống kê.

### 6.2 Mức thành thạo

Mỗi cặp (học viên, kỹ năng) giữ một điểm `thanh_thao` từ 0 đến 1, cập nhật sau mỗi lần làm bài
theo công thức Bayes rút gọn (mô hình BKT — Bayesian Knowledge Tracing) trong
`packages/dao-tao/src/mastery.ts`:

```
P(biết | đúng) = P(biết)(1-slip) / [ P(biết)(1-slip) + (1-P(biết))·guess ]
P(biết | sai)  = P(biết)·slip    / [ P(biết)·slip    + (1-P(biết))(1-guess) ]
rồi   P(biết)' = P(biết|kq) + (1 - P(biết|kq))·learn
```
Tham số mặc định: `slip = 0,10`, `guess = 0,20` (câu trắc nghiệm 4 lựa chọn), `learn = 0,15`.
Đạt `thanh_thao ≥ 0,85` thì kỹ năng coi là **vững**; dưới `0,4` sau ít nhất 3 lần làm là **hổng**.

### 6.3 Lỗi khái niệm dẫn đường

Bảng `error_tags` gom các `ma_loi` của phương án sai. Khi một học viên mắc cùng một `ma_loi`
từ 2 lần trở lên, hệ thống chèn vào lộ trình một **bài vá** (`bai_va`): 1 khối `giang` ngắn +
1 khối `can_cu` + 2 câu hỏi cùng loại lỗi. Bài vá không tính vào tiến độ chuyên đề — nó là
đường tắt sửa hiểu sai, không phải hình phạt kéo dài lộ trình.

### 6.4 Ôn tập giãn cách

Thẻ lật (`the_lat`) và các câu trắc nghiệm đã làm sai được đưa vào lịch ôn theo SM-2 rút gọn
(`packages/dao-tao/src/srs.ts`): khoảng cách `1, 3, 7, 16, 35` ngày, nhân hệ số dễ
`EF ∈ [1,3; 2,5]`. Mỗi ngày người học có một **phiên ôn 5 phút** — đủ ngắn để giữ thói quen.

Ràng buộc riêng của lĩnh vực pháp lý: khi văn bản căn cứ của một thẻ thay đổi, thẻ bị **rút
khỏi lịch ôn ngay** và chỉ quay lại sau khi biên tập cập nhật. Không được để hệ thống ôn tập
nhồi vào đầu học viên một quy định đã hết hiệu lực.

### 6.5 Bốn chế độ học

Cùng một chuyên đề, học viên chọn chế độ, hệ thống đổi cách trình bày chứ không đổi nội dung:

| Chế độ | Cho ai | Khác biệt |
|--------|--------|-----------|
| `day_du` | Người mới | Toàn bộ khối, đủ hoạt động |
| `nhanh` | Người đã làm nghề | Bỏ khối `giang` nền, giữ `can_cu`, `doi_chieu`, bài tập; ~40% thời gian |
| `tra_cuu` | Đang xử lý việc thật | Vào thẳng sơ đồ trình tự và biểu mẫu, bài học thu thành chú giải |
| `on_thi` | Trước kỳ đánh giá | Chỉ thẻ lật, câu hỏi và bài vá theo `ma_loi` |

### 6.6 Mục tiêu và nhịp

Học viên đặt mục tiêu tuần (mặc định 60 phút/tuần, 3 buổi). Hệ thống chỉ nhắc theo mục tiêu
**người học tự đặt**, không tự tăng mục tiêu và không tạo áp lực thời gian.

## 7. Thống kê

### 7.1 Cho người học (`/dao-tao/:course/tien-do`)

- Vòng tiến độ chuyên đề: đã xong / đang học / chưa mở (kèm điều kiện tiên quyết còn thiếu).
- Bản đồ năng lực tô màu theo `thanh_thao`; bấm một kỹ năng ra danh sách bài và bài tập liên quan.
- Biểu đồ thời gian học 8 tuần gần nhất so với mục tiêu tuần.
- Ba lỗi khái niệm hay mắc nhất, kèm nút "vá ngay".
- Hồ sơ sản phẩm: các sản phẩm đã nộp cho ví dụ xuyên suốt, tải về được.
- Lịch ôn hôm nay và số thẻ đến hạn.
- Mục tiêu là học để làm được việc: cán bộ công chức học nghề, không cần cơ chế so sánh với nhau.

### 7.2 Cho quản trị và giảng viên

Chi tiết ở `09-c §5`. Chỉ số cốt lõi:

| Chỉ số | Ý nghĩa | Ngưỡng cảnh báo |
|--------|---------|------------------|
| Tỷ lệ hoàn thành bài | Vào bài / xong bài | < 60% |
| Điểm rơi (drop-off) theo khối | Khối nào người học rời đi | Một khối > 15% |
| Độ khó thực tế từng câu | % trả lời đúng lần đầu | < 30% (quá khó) hoặc > 95% (vô nghĩa) |
| Độ phân biệt (point-biserial) | Câu có phân loại được người giỏi/kém không | < 0,15 → gỡ câu |
| `citation_health` của bài | Căn cứ hỏng/hết hiệu lực | Bất kỳ > 0 → khoá xuất bản |
| Lệch chấm AI ↔ người | Chất lượng rubric | Lệch trung bình > 1 mức |
| Chi phí sinh nội dung | USD theo chuyên đề | Vượt hạn mức tháng |

## 8. Đồng hành người học

Bốn cơ chế, cả bốn đều **tắt được** trong cài đặt và không cơ chế nào chặn đường học:

1. **Chỉ đường**: luôn có một hành động kế tiếp rõ ràng ("Học tiếp bài 5", "Ôn 6 thẻ", "Vá lỗi
   nhầm chuyển tiếp"). Không bao giờ để màn hình trống với câu hỏi "học gì bây giờ".
2. **Giải thích lại ba mức**: mỗi khối `giang` có nút *"giảng lại"* với ba mức — `de` (ví dụ
   đời thường), `chuan` (như đang có), `sau` (thêm ngoại lệ, chuyển tiếp, án lệ hành chính).
   Sinh bằng AI theo yêu cầu, cache theo (khối, mức), vẫn phải kèm căn cứ.
3. **Hỏi ngay tại chỗ**: chọn một đoạn bất kỳ trong bài → hỏi. Câu hỏi đi vào đường RAG của
   `ke-hoach/07` với ngữ cảnh là các nút căn cứ của chính khối đó, nên trả lời bám bài.
4. **Mascot đồng hành**: xem `09-b`. Mascot là *lớp thể hiện* của ba cơ chế trên — nó không tự
   nghĩ ra nội dung pháp lý.

Nhắc lịch: tối đa **2 thông báo/tuần**, gửi vào khung giờ người học đã học nhiều nhất, tắt
được, và tự dừng sau 3 lần không mở.

## 9. Khả năng truy cập và hiệu năng

- Mọi khối tương tác phải dùng được **chỉ bằng bàn phím**. Kéo thả (`keo_tha_so_do`, `ho_so`)
  bắt buộc có đường thay thế bằng phím (chọn — di chuyển bằng mũi tên — thả bằng Enter).
- Sơ đồ, bản đồ khái niệm: có `alt` mô tả và **bảng tương đương** đọc được bằng trình đọc màn hình.
- Video có phụ đề tiếng Việt và bản chép lời; hoạt hình tôn trọng `prefers-reduced-motion`.
- Tương phản AA; không dùng riêng màu để truyền đạt đúng/sai (kèm biểu tượng và chữ).
- Bài học tải theo khối; ba khối đầu SSR để đọc được ngay trên 3G. Tài sản nặng (video, ảnh
  điểm nóng) tải lười.
- Toàn bộ bài học đã tải cache được để học offline (PWA, `ke-hoach/10 §1`); bài làm offline
  đưa vào hàng đợi và đồng bộ khi có mạng.

## 10. Mô hình dữ liệu (tóm tắt)

Chi tiết trong `packages/db/migrations/0006_dao_tao.sql`.

```
courses(id, slug, title, summary, audience[], level, objectives[], taxonomy, as_of,
        status, mascot_id, hero_asset, duration_minutes, tags[], legal_map, ...)
skills(id, course_id, code, name, description, prerequisites[])
lessons(id, course_id, ord, slug, title, summary, skills[], as_of, status,
        estimated_minutes, citation_health, ...)
lesson_blocks(id, lesson_id, ord, kind, data jsonb, citations[], status, source, ...)
activities(id, lesson_id, ord, kind, mode, prompt jsonb, answer jsonb, rubric jsonb,
           skills[], difficulty, citations[], points, ...)
assessments(id, course_id, level, title, config jsonb, pass_score)
enrollments(id, account_id, course_id, mode, goal_minutes_per_week, state, ...)
progress(enrollment_id, lesson_id, state, seconds_spent, last_block_ord, ...)
attempts(id, enrollment_id, activity_id, response jsonb, score, max_score, passed,
         feedback jsonb, error_tags[], graded_by, model, ...)
mastery(enrollment_id, skill_id, p_known, attempts, updated_at)
srs_cards(id, enrollment_id, ref_kind, ref_id, due_on, interval_days, ease, lapses, suspended)
learning_events(id, enrollment_id, kind, lesson_id, block_id, activity_id, payload, created_at)
authoring_jobs(id, course_id, lesson_id, step, state, input, output, model, cost_usd, ...)
certificates(id, enrollment_id, code, issued_at, as_of, legal_basis jsonb, revoked_at)
```

## 11. Việc phải làm

| # | Việc | Nơi |
|---|------|-----|
| 1 | Migration mô hình dữ liệu đào tạo | `packages/db/migrations/0006_dao_tao.sql` |
| 2 | Gói miền: kiểu khối, chấm bài, BKT, SRS, thống kê | `packages/dao-tao/` |
| 3 | Truy vấn CSDL đào tạo | `packages/db/src/dao-tao.ts` |
| 4 | API học viên và API quản trị | `apps/api/src/routes/dao-tao.ts`, `quan-tri.ts` |
| 5 | Hàng đợi soạn bài bằng AI | `qdpl-soan-bai` + `apps/workers-ts/src/bull/workers/soan-bai.ts` |
| 6 | Prompt soạn bài, sinh bài tập, chấm tự luận | `prompts/dao-tao/` |
| 7 | Trình đọc bài học và trình chạy bài tập | `apps/web/app/routes/training.*`, `components/dao-tao/` |
| 8 | Kiểm tra bài học trước xuất bản: cấu trúc, rubric và hành văn (`QUY-TAC-HANH-VAN.md`) | `scripts/kiem-tra-bai-hoc.ts`, `packages/dao-tao/src/hanh-van.ts` |
| 9 | Trang tiến độ, phiên ôn tập và bài vá lỗi của người học | `apps/web/app/routes/training.progress.tsx`, `training.review.tsx`, `training.patch.tsx` |
