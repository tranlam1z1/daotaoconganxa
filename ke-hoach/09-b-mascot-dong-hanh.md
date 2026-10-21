# 09-b. Mascot đồng hành: bộ nhân vật, tạo hình, hành động

> Mở rộng của `ke-hoach/09-dao-tao-chuyen-de.md` và `09-a`. Tài liệu này định nghĩa **bộ nhân
> vật đồng hành** của mô-đun đào tạo: danh tính, tạo hình, trạng thái, trang phục, đạo cụ,
> hành động, quy tắc tương tác với người học và với nội dung bài học, và quy trình sinh ảnh
> bằng AI. Màn hình quản trị của tất cả những thứ này nằm ở `09-c`.

## 1. Vì sao cần mascot, và cần đúng bao nhiêu

Học pháp luật một mình trên màn hình là việc dễ bỏ dở. Người học không bỏ vì nội dung khó, mà
vì **không biết mình đang ở đâu, làm đúng hay sai, và bước kế tiếp là gì**. Mascot là lớp thể
hiện của ba cơ chế đồng hành ở `09-a §8`: chỉ đường, giải thích lại, hỏi tại chỗ.

Ba giới hạn đặt ra ngay từ đầu:

- Mascot **không sinh ra tri thức pháp lý**. Nó dẫn tới khối `can_cu`, hoặc nói "chưa đủ căn cứ".
  Mọi câu nó nói mà có nội dung pháp lý đều phải kèm `citations[]` và được render dưới dạng thẻ
  căn cứ, không phải bong bóng thoại.
- Mascot **tắt được hoàn toàn**, một lần, trong cài đặt. Tắt rồi thì mọi chức năng vẫn dùng
  được — không có chức năng nào chỉ đi qua mascot.
- Mascot **không gây áp lực**. Không đếm ngược, không "bạn sắp mất chuỗi", không mặt buồn khi
  người học nghỉ vài hôm.

## 2. Bộ nhân vật (mascot cast)

Một nhân vật không phục vụ được cả cán bộ thẩm định lẫn người dân đi làm thủ tục. Hệ thống có
**một bộ nhân vật**, mỗi nhân vật một vai và một nhóm đối tượng; chuyên đề chọn nhân vật phù
hợp (§3). Tên đều **thuần Việt**, đều là một từ láy hoặc từ ghép có nghĩa. Tên hiển thị trên
giao diện là tên đầy đủ; không dùng biệt danh kiểu "bé", "bác", "cô" (QUY-TAC-HANH-VAN.md §4).

| # | Tên đầy đủ | Tên hiển thị | Hình tượng | Vai | Đối tượng chính | Chuyên đề hợp |
|---|-----------|--------------|-----------|-----|------------------|----------------|
| 1 | **Mực Thước** | Mực Thước | Người-thước: thân là cây thước gỗ có vạch chia dọc sườn, đầu tròn, đội khăn xếp cách điệu | Cố vấn trưởng, **nhân vật mặc định** | Cán bộ chuyên môn | Mọi chuyên đề; đầu tư CNTT, pháp chế |
| 2 | **Hỏi Han** | Hỏi Han | Giọt mực tròn, tóc xoáy hình dấu hỏi, mắt to | Người đặt câu hỏi — nêu thay người học những câu hỏi cơ bản | Cán bộ mới vào nghề | Chuyên đề cơ bản, nhập môn |
| 3 | **Rùa Đá** | Rùa Đá | Rùa đội tấm bia đá kiểu bia tiến sĩ Văn Miếu, bia là mặt hiển thị mốc thời gian | Người giữ sổ: hiệu lực, phiên bản, hợp nhất | Cán bộ tra cứu, lưu trữ, pháp chế | Tra cứu, hiệu lực, hợp nhất văn bản |
| 4 | **Cân Nhắc** | Cân Nhắc | Người cầm cân đĩa; hai đĩa cân là hai bàn tay | Người chủ trì đánh giá — nêu tiêu chí và kết quả đối chiếu | Thanh tra, kiểm toán, hội đồng | Kiểm tra – thanh tra – kiểm toán; mọi bài đánh giá |
| 5 | **Sếu Đầu Đỏ** | Sếu Đầu Đỏ | Sếu đầu đỏ Tràm Chim, cổ vươn cao, cánh mở như mở bản đồ | Người vạch lộ trình — trình bày theo mốc và bước | Lãnh đạo, người quản lý dự án | Chủ trương đầu tư, lập kế hoạch, lộ trình |
| 6 | **Đắn Đo** | Đắn Đo | Người-thước dây: thân là cuộn thước dây, tay cầm máy tính cầm tay | Người kiểm số liệu — soát đơn vị tính và căn cứ định mức | Kế toán, tài chính, lập dự toán | Tổng mức đầu tư, định mức, chi phí |
| 7 | **Sáng Tỏ** | Sáng Tỏ | Chiếc đèn dầu kiểu cũ đã thành nhân vật, ngọn lửa là chỏm tóc | Người diễn giải thuật ngữ — chuyển từ Hán Việt sang tiếng thường | Người dân, doanh nghiệp | Thủ tục hành chính, hướng dẫn công dân |

**Chuyện tên.** "Mực thước" là từ Việt chỉ sự khuôn phép, đồng thời là hai dụng cụ của người
đi học ngày trước — nghiên mực và cây thước. "Cân nhắc" vừa là hành vi của người xét xử vừa là
cái cân. "Đắn đo" là sự cẩn trọng và có tiếng "đo" của người tính toán. Tên nào cũng đọc lên là
biết nhân vật làm gì; không cần chú thích.

**Tính cách và giọng nói.** Mỗi nhân vật có `voice` gồm: xưng hô, độ dài câu tối đa, mức trang
trọng, ba từ nên dùng, ba từ cấm dùng.

| Nhân vật | Xưng hô | Giọng | Cấm |
|----------|---------|-------|-----|
| Mực Thước | "tôi" – "bạn" | Điềm đạm, câu ngắn, luôn dẫn tới điều khoản | Nói chắc khi chưa tra; dùng "chắc là", "khoảng" |
| Hỏi Han | "tôi" – "bạn" | Hỏi ngược để làm rõ, không kết luận pháp lý | Tự trả lời câu hỏi pháp lý |
| Rùa Đá | "tôi" – "bạn" | Chậm rãi, hay kể mốc thời gian | Vội; bỏ qua ngày hiệu lực |
| Cân Nhắc | "tôi" – "anh/chị" | Trung tính, không khen không chê, chỉ nêu tiêu chí | Bình luận về người học; dùng từ cảm thán |
| Sếu Đầu Đỏ | "tôi" – "anh/chị" | Gọn, hướng kết quả, nói bằng mốc và bước | Sa đà chi tiết kỹ thuật |
| Đắn Đo | "tôi" – "anh/chị" | Cẩn thận, luôn hỏi lại đơn vị và căn cứ định mức | Làm tròn số mà không nói |
| Sáng Tỏ | "tôi" – "bạn" | Tiếng thường, ví dụ đời sống, không thuật ngữ | Dùng từ Hán Việt không giải thích |

**Ràng buộc chung, không nhân vật nào được vượt:** không tự xưng là luật sư hay chuyên gia
pháp lý được cấp phép; không hứa kết quả thủ tục; không nói "theo tôi thì" về một vấn đề pháp
lý; khi thiếu căn cứ thì nói thẳng là thiếu.

## 3. Chọn nhân vật cho mỗi chuyên đề

Việc chọn do `packages/mascot/src/routing.ts` quyết định, theo thứ tự ưu tiên **giảm dần**:

1. **Người học đã chọn** (`enrollments.mascot_id`) — nếu chuyên đề cho phép đổi
   (`courses.mascot_locked = false`). Người học luôn được quyền tắt hẳn.
2. **Ngữ cảnh chiếm quyền tạm thời** (`mascot_handoffs`): trong bài đánh giá mức 2–3 thì
   **Cân Nhắc** vào vai, xong bài trả lại nhân vật cũ. Trong khối `may_tinh` chi phí thì
   **Đắn Đo** xuất hiện ở lề. Bàn giao có hoạt cảnh "đổi ca" ngắn, không cắt ngang thao tác.
3. **Bài học chỉ định** (`lessons.mascot_id`) — dùng khi một bài lệch chủ đề so với cả chuyên đề.
4. **Chuyên đề chỉ định** (`courses.mascot_id`).
5. **Chấm điểm phù hợp**: cộng điểm theo giao của `courses.audience[]` với
   `mascot_personas.audiences[]`, cộng theo giao của `courses.taxonomy`/`tags[]` với
   `mascot_personas.topics[]`, trừ điểm nếu nhân vật đang `enabled = false`. Lấy điểm cao nhất.
6. **Mặc định**: Mực Thước.

Hàm chọn trả về cả **lý do** (`ly_do`) để màn hình quản trị `09-c §6.1` giải thích được vì sao
một chuyên đề đang hiện nhân vật đó — thứ không thể suy ra bằng mắt khi có 7 nhân vật và 6 tầng
ưu tiên.

Quản trị viên tạo thêm nhân vật mới bất cứ lúc nào: `mascot_personas` là dữ liệu, không phải mã.
Bảy nhân vật trên là dữ liệu gieo sẵn (`packages/db/src/seed-dao-tao.ts`).

## 4. Hệ tạo hình

### 4.1 Bộ khung dựng hình (rig)

Mọi nhân vật vẽ trong cùng một khung SVG `viewBox="0 0 200 240"`, chia lớp cố định để trạng
thái và trang phục ghép được với nhau mà không phải vẽ lại:

```
<g id="hieu-ung-sau">   tia sáng, vòng tròn nền
<g id="bong">           bóng đổ dưới chân
<g id="than">           thân + chân          ← đổi theo persona
<g id="trang-phuc">     áo/khăn/mũ           ← đổi theo costume
<g id="tay-trai">       cánh tay trái        ← đổi theo pose
<g id="tay-phai">       cánh tay phải        ← đổi theo pose
<g id="dao-cu">         vật cầm tay          ← đổi theo prop
<g id="dau">            đầu + tóc/mào
<g id="mat">            mắt + lông mày       ← đổi theo state
<g id="mieng">          miệng                ← đổi theo state
<g id="phu-kien-dau">   mũ, kính, khăn xếp   ← đổi theo costume
<g id="hieu-ung-truoc"> bong bóng, dấu hỏi, pháo giấy ← đổi theo effect
```

Renderer là `packages/mascot/src/svg.ts`: `veMascot({ persona, state, pose, costume, prop,
effect, size })` trả về chuỗi SVG. Không phụ thuộc thư viện ngoài, chạy được cả trên máy chủ
(SSR, sinh ảnh mở đầu) lẫn trong trình duyệt.

### 4.2 Bảng màu

Mỗi nhân vật có 6 màu, khai báo trong `mascot_personas.palette`, và **mọi cặp màu chữ/nền phải
đạt tương phản AA**. Bảng màu bám hệ màu chung của giao diện (`app.css`, xanh mực `#1d3a97`):

| Nhân vật | `chinh` | `phu` | `nhan` | Ghi chú |
|----------|---------|-------|--------|---------|
| Mực Thước | `#1d3a97` | `#e8ecf7` | `#e0a13a` | Xanh mực + vàng thước |
| Hỏi Han | `#2f6f5e` | `#e6f2ee` | `#f2a33c` | Xanh lá trầm, thân thiện |
| Rùa Đá | `#5c5346` | `#efeae0` | `#8fa37a` | Nâu đá, rêu |
| Cân Nhắc | `#4a4f63` | `#eceef4` | `#b08b57` | Xám trung tính, đồng |
| Sếu Đầu Đỏ | `#e4e7ec` | `#ffffff` | `#c0392b` | Trắng sếu, đỏ đầu |
| Đắn Đo | `#7a4a8c` | `#f2eaf6` | `#e0a13a` | Tím, vàng thước dây |
| Sáng Tỏ | `#c9772b` | `#fdf1e3` | `#f5c542` | Cam đèn dầu, vàng lửa |

Chế độ tối: `chinh` và `phu` hoán đổi vai trò nền/nét, `nhan` giữ nguyên. Nhân vật không bao
giờ là khối màu đặc trên nền — luôn có nét viền `vien` để tách khỏi nền ở cả hai chế độ.

### 4.3 Trạng thái cảm xúc

12 trạng thái, mỗi trạng thái quy định mắt, lông mày, miệng và một chuyển động rất nhỏ
(≤ 4px, tắt khi `prefers-reduced-motion`):

| `state` | Nghĩa | Khi nào dùng |
|---------|-------|--------------|
| `binh_thuong` | Trung tính, chớp mắt | Mặc định |
| `vui` | Cười nhẹ | Người học trả lời đúng |
| `hao_hung` | Cười rộng, mắt cong | Hoàn thành bài, đạt mục tiêu tuần |
| `suy_nghi` | Mắt liếc lên, tay chống cằm | Đang chờ hệ thống chấm / truy vấn |
| `giai_thich` | Miệng mở, tay chỉ | Đang dẫn tới một khối nội dung |
| `canh_bao` | Lông mày nhíu, dấu chấm than | Căn cứ hết hiệu lực, bài cần cập nhật |
| `nghiem_tuc` | Mắt thẳng, miệng phẳng | Vào bài đánh giá |
| `tiec` | Mắt cụp nhẹ, không buồn thảm | Trả lời sai (kèm ngay hướng sửa) |
| `khich_le` | Nắm tay, mắt sáng | Sau khi sai, trước lần thử lại |
| `an_mung` | Nhảy, pháo giấy | Nhận chứng nhận |
| `ngu` | Mắt nhắm, bong bóng "z" | Chế độ yên lặng, không có hoạt động |
| `bo_tay` | Nhún vai, hai tay mở | **Chưa đủ căn cứ để trả lời** |

`bo_tay` là trạng thái quan trọng nhất về mặt sản phẩm: nó làm cho việc "không biết" trở thành
một hành vi bình thường, có hình ảnh riêng, thay vì là một lỗi bị giấu đi.

### 4.4 Tư thế và đạo cụ

Tư thế (`pose`): `dung`, `chi_tay`, `gio_bang`, `cam_but`, `khoanh_tay`, `nhay`, `ngoi`, `vay_tay`.

Đạo cụ (`prop`): `khong`, `thuoc_vang`, `but_long`, `so_can_cu`, `kinh_lup`, `can_dia`,
`ban_do_lo_trinh`, `may_tinh_cam_tay`, `xap_ho_so`, `den_pin`, `dong_ho_cat`, `bia_da`.

Mỗi nhân vật có đạo cụ mặc định (`mascot_personas.default_prop`) và danh sách đạo cụ hợp lệ —
Sếu Đầu Đỏ không cầm bút lông, nó mở bản đồ lộ trình.

### 4.5 Trang phục

Trang phục đổi theo chuyên đề, theo mùa và theo ngữ cảnh nghi thức. 10 bộ gieo sẵn:

| `costume` | Mô tả | Dùng khi |
|-----------|-------|----------|
| `thuong_ngay` | Áo thun, quần vải | Mặc định |
| `cong_so` | Sơ mi, thẻ công chức | Chuyên đề nghiệp vụ hành chính |
| `ao_dai_khan_dong` | Áo the, khăn xếp | Bài về lịch sử văn bản, ngày lễ |
| `ao_dai_nu` | Áo dài nữ | Nhân vật nữ trong nghi thức |
| `bao_ho_cong_truong` | Mũ bảo hộ, áo phản quang | Chuyên đề đầu tư xây dựng, triển khai |
| `hoi_dong_tham_dinh` | Vest, bảng tên hội đồng | Bài đóng vai hội đồng |
| `kiem_toan` | Áo khoác tối màu, cặp hồ sơ | Bài thanh tra, kiểm toán |
| `tot_nghiep` | Áo cử nhân, mũ tua | Trao chứng nhận |
| `tet` | Áo dài đỏ, cành mai/đào | Dịp Tết |
| `tinh_nguyen` | Áo xanh tình nguyện | Chiến dịch hướng dẫn cộng đồng |

Ràng buộc: mỗi nhân vật khai `allowed_costumes[]`; hệ thống không bao giờ ghép một bộ ngoài
danh sách (Rùa Đá không mặc áo bảo hộ công trường). Ghép sai bị chặn ở cả tầng API lẫn tầng
renderer, và màn hình quản trị chỉ hiển thị ô ghép hợp lệ.

### 4.6 Hiệu ứng

`effect`: `khong`, `bong_thoai`, `tia_sang`, `dau_hoi`, `dau_cham_than`, `phao_giay`,
`giot_mo_hoi`, `vong_tron_nhip` (vòng tròn tiến độ chạy quanh nhân vật khi đang chấm bài).

### 4.7 Số biến thể

7 nhân vật × 12 trạng thái × 10 trang phục = **840 biến thể nền**, chưa nhân với 8 tư thế,
12 đạo cụ và 8 hiệu ứng. Vì vậy **không vẽ tay từng biến thể**: SVG dựng theo tham số phủ toàn
bộ không gian này; ảnh sinh bằng AI (§6) chỉ dùng cho những chỗ cần chất liệu hơn — ảnh bìa
chuyên đề, bộ sticker, ảnh chia sẻ mạng xã hội, ảnh in tài liệu.

## 5. Hành động của mascot

### 5.1 Mô hình

Một **hành động** (`mascot_actions`) là một luật:

```
KHI  <trigger>  MÀ  <conditions>  THÌ  hiện <persona nếu chỉ định> ở <anchor>
     với <state, pose, costume, prop, effect>
     nói <một trong các biến thể speech>
     và mời làm <cta>
```

Trường dữ liệu: `code`, `persona_id` (rỗng = áp cho mọi nhân vật), `trigger`, `conditions`
(jsonb), `priority` (0–100), `cooldown_seconds`, `max_per_session`, `max_per_day`,
`state/pose/costume/prop/effect`, `speech` (mảng biến thể, chọn ngẫu nhiên không lặp lại),
`cta` (nhãn + đường dẫn hoặc lệnh trong trang), `anchor`, `enabled`, `audiences[]`, `courses[]`.

Bộ chọn hành động (`packages/mascot/src/actions.ts`) nhận một **sự kiện** và **ngữ cảnh phiên
học**, trả về nhiều nhất **một** hành động: lọc theo điều kiện → loại hành động còn trong thời
gian nghỉ (`cooldown`) hoặc đã chạm hạn mức → sắp theo `priority` → chọn cao nhất, hoà thì lấy
cái lâu chưa dùng nhất. Một hành động cũng có thể **không** được chọn: im lặng là kết quả hợp lệ
và là kết quả mặc định.

### 5.2 Bộ kích hoạt (trigger)

| Nhóm | `trigger` | Ý nghĩa |
|------|-----------|---------|
| Vào ra | `vao_chuyen_de` / `vao_bai` / `roi_giua_bai` / `vang_mat_tro_lai` | Mở đầu, quay lại sau ≥ 7 ngày |
| Đọc bài | `mo_khoi` / `dung_lau_o_khoi` / `cuon_qua_nhanh` / `mo_lai_khoi_cu` | Nhịp đọc |
| Làm bài | `tra_loi_dung` / `tra_loi_sai` / `sai_lap_lai` / `bo_trong_cau` / `nop_san_pham` | Kết quả từng câu |
| Đánh giá | `bat_dau_danh_gia` / `dat_bai_kiem_tra` / `truot_bai_kiem_tra` / `phuc_khao` | Mức 1–3 |
| Pháp lý | `can_cu_het_hieu_luc` / `bai_can_cap_nhat` / `khong_du_can_cu` | Sự kiện hiệu lực |
| Duy trì | `den_han_on_tap` / `dat_muc_tieu_tuan` / `hut_muc_tieu_tuan` / `chao_theo_gio` | Thói quen |
| Công cụ | `mo_may_tinh_chi_phi` / `mo_dinh_tuyen_thu_tuc` / `mo_bieu_mau` | Vào khối công cụ |
| Cột mốc | `hoan_thanh_bai` / `hoan_thanh_cum` / `nhan_chung_nhan` | Ghi nhận |

### 5.2b Chế độ gia sư dẫn dắt

Ngoài việc phản ứng theo sự kiện, nhân vật còn có **chế độ dẫn dắt**: đi cùng người học lần
lượt qua từng khối của bài, từ đầu đến hết.

- **Khung nổi, kéo thả được.** Nhân vật đặt trên nội dung chứ không nằm trong cột lề, kéo tới
  vị trí bất kỳ và nhớ vị trí đó cho lần sau. Kéo thả luôn có đường thay thế bằng bàn phím
  (phím mũi tên khi con trỏ đang ở thanh kéo), theo đúng ràng buộc ở `09-a §9`.
- **Ba chế độ**: `gioi_thieu` (tự giới thiệu, có nút *Bắt đầu*), `dan_dat` (đi từng bước),
  `thuong` (im lặng, chỉ phản ứng theo sự kiện và chờ được gọi).
- **Mỗi bước** cuộn tới đúng khối, tô sáng khối đó, nêu khối là gì và việc cần làm với nó.
- **Lời dẫn là lời điều hướng, không phải nội dung pháp lý.** Nhân vật nói "đây là nguyên văn
  quy định, mọi kết luận trong bài dựa vào khối này"; nó không tóm tắt và không diễn giải
  chính quy định đó. Diễn giải là việc của khối nội dung đã qua pháp chế duyệt.
- Trong lúc dẫn dắt, sự kiện thường không chen ngang lời gia sư. Ngoại lệ vẫn là nhóm sự kiện
  pháp lý — căn cứ hết hiệu lực phải báo ngay, kể cả khi đang dẫn.

Lộ trình dựng bằng `lapLoTrinhDanDat()` (`packages/mascot/src/dan-dat.ts`) và phục vụ qua
`GET /v1/mascot/dan-dat`.

### 5.3 Neo hiển thị (anchor)

`goc_phai_duoi` (mặc định, không che nội dung), `canh_khoi` (nép bên khối đang đọc),
`tren_cau_hoi`, `thanh_tien_do`, `giua_man_hinh` (chỉ cho `nhan_chung_nhan` — dạng hộp thoại
đóng được), `an` (chạy hành động nhưng không hiện nhân vật, ví dụ chỉ tô sáng một khối).

### 5.4 Hạn mức tôn trọng người học

Ràng buộc cứng, kiểm tra ở tầng máy chủ chứ không chỉ ở giao diện:

- Tối đa **1 lần xuất hiện chủ động / 3 phút**, tối đa **8 lần / phiên học**.
- Không bao giờ chen ngang khi người học đang gõ hoặc đang trong câu hỏi tính giờ.
- Đóng một hành động thì hành động đó nghỉ 24 giờ; đóng 3 lần liên tiếp thì hệ thống **tự hỏi**
  "để mình yên lặng nhé?" và chuyển sang chế độ `yen_lang` nếu người học đồng ý.
- Chế độ `yen_lang`: mascot chỉ hiện khi người học tự bấm gọi, và khi có sự kiện thuộc nhóm
  **Pháp lý** (căn cứ hết hiệu lực là thứ phải báo, không được im).

### 5.5 Lời thoại

`speech` lưu **nhiều biến thể** cho mỗi hành động để không lặp lại nhàm chán, mỗi biến thể có
`text` (≤ 140 ký tự), `tone`, và tuỳ chọn `citations[]`. Hai loại lời:

- `loi_dan` — lời dẫn dắt, thuộc về mascot ("Chỗ này nhiều người nhầm, thử lại nhé").
- `loi_phap_ly` — chỉ được phép khi có `citations[]` hợp lệ tại `as_of` hiện hành; giao diện
  render thành **thẻ căn cứ** đặt cạnh mascot, không đặt trong bong bóng thoại, để người học
  không bao giờ nhầm lời nhân vật với lời của pháp luật.

Lời thoại soạn sẵn trong CSDL. Khi cần sinh mới (ví dụ giảng lại mức `de`), gọi mô hình với
`prompts/mascot/loi-thoai.md`, kèm `voice` của nhân vật, và **kết quả phải qua duyệt** trước
khi vào bộ lời thoại dùng chung — không sinh lời trực tiếp ra màn hình người học.

## 6. Sinh ảnh mascot bằng AI

### 6.1 Hai đường tạo hình

| Đường | Công nghệ | Dùng cho | Chi phí |
|-------|-----------|----------|---------|
| **SVG tham số** | `packages/mascot/src/svg.ts` | Toàn bộ tương tác trong bài học, mọi trạng thái | 0 |
| **Ảnh AI** | Mô hình sinh ảnh, qua hàng đợi `qdpl-mascot-anh` | Ảnh bìa chuyên đề, sticker, ảnh chia sẻ, ảnh in, khung hoạt hoạ | Theo lượt |

Đường SVG là đường chính và luôn có sẵn — hệ thống không bao giờ phụ thuộc vào việc ảnh AI đã
sinh xong hay chưa.

### 6.2 Giữ nhân vật không biến dạng

Vấn đề lớn nhất của sinh ảnh nhân vật là **cùng một nhân vật ra bảy khuôn mặt khác nhau**. Ba
biện pháp bắt buộc:

1. **Phiếu nhân vật (`character_sheet`)** — một đoạn mô tả khoá cứng trong
   `mascot_personas.character_sheet`, luôn ghép vào đầu mọi prompt, không được sửa khi sinh lẻ.
   Ví dụ cho Mực Thước: *"nhân vật hoạt hình vector, thân là cây thước gỗ đứng có vạch chia màu
   vàng dọc sườn phải, đầu tròn to bằng 2/3 thân, khăn xếp xanh mực, hai chấm mắt tròn đen,
   không có mũi, tay chân dạng ống bo tròn, nét viền dày đều 3px, không đổ bóng gradient"*.
2. **Ảnh tham chiếu** — mỗi lần sinh đều đính kèm bản dựng SVG của đúng biến thể đó làm ảnh
   tham chiếu bố cục và tỉ lệ.
3. **Khoá seed và phiên bản prompt** — `mascot_assets` lưu `seed`, `model`, `prompt_version`,
   `spec` để tái tạo lại đúng ảnh đó về sau.

### 6.3 Loại ảnh (`kind`)

`avatar` (256×256), `chan_dung` (512×512), `toan_than` (768×1024), `sticker` (nền trong suốt),
`bang_bieu_cam` (bảng 12 biểu cảm trên một tấm), `anh_bia` (1600×900 cho chuyên đề),
`khung_hoat_hoa` (dãy khung cho hoạt cảnh ngắn), `anh_in` (300 DPI cho tài liệu giấy).

### 6.4 Vòng đời một ảnh

```
tao_yeu_cau → dang_sinh → nhap → cho_duyet → duyet → dung_chinh
                              ↘ tu_choi        ↘ go_bo
```

- Sinh theo **lô**: một yêu cầu có thể là "Mực Thước × 12 trạng thái × trang phục `cong_so`",
  hệ thống nở thành 12 job con, chạy nền, hiện tiến độ trên màn hình quản trị.
- Chỉ ảnh trạng thái `duyet` mới được dùng ngoài trang công khai; mỗi tổ hợp
  (persona, kind, state, costume) có nhiều nhất **một** ảnh `dung_chinh`.
- Ảnh lưu trong kho đối tượng theo tiền tố `assets/mascot/<persona>/<kind>/<hash>.<ext>`
  (`packages/storage`), không lưu nhị phân trong CSDL.
- Ghi đầy đủ `model`, `cost_usd`, người yêu cầu, người duyệt vào `audit_log`.

### 6.5 Ranh giới khi sinh ảnh

- Không sinh hình người thật, không mô phỏng cán bộ có thật, không dùng logo cơ quan nhà nước
  trên trang phục nhân vật.
- Trang phục lấy cảm hứng từ trang phục truyền thống phải giữ đúng phom dáng; không biến áo dài,
  khăn xếp thành chi tiết trang trí kỳ dị.
- Không sinh ảnh nhân vật cầm văn bản có chữ giả — chữ trong ảnh phải là hình khối trừu tượng
  hoặc để trống, tránh tạo ra "văn bản pháp luật giả" nhìn như thật.

## 7. Tương tác với người học

### 7.1 Các cảnh chính

| Cảnh | Nhân vật làm gì |
|------|------------------|
| **Lần đầu vào chuyên đề** | Tự giới thiệu trong 2 câu, hỏi 3 câu chọn nhanh (vai trò, đã làm nghề bao lâu, mục tiêu tuần) → đặt chế độ học (§`09-a §6.5`) và mục tiêu. Có nút "bỏ qua". |
| **Mở một bài** | Nêu bài này cho ra sản phẩm gì và mất bao lâu. Không tóm tắt nội dung — tóm tắt là việc của khối `tom_tat`. |
| **Trả lời đúng** | Một câu ngắn, kèm *vì sao đúng* trỏ tới căn cứ. Không "giỏi quá!" rỗng. |
| **Trả lời sai** | Không tiết lộ đáp án. Nêu **loại lỗi** ("chỗ này là chuyện chuyển tiếp, không phải chuyện thẩm quyền"), mở đúng khối căn cứ, mời thử lại. |
| **Sai lặp lại cùng `ma_loi`** | Đề nghị chèn bài vá (`09-a §6.3`), nói rõ chỉ mất ~4 phút và không ảnh hưởng tiến độ. |
| **Dừng lâu ở một khối** | Sau 90 giây không thao tác: hỏi *"cần mình giảng lại kiểu dễ hơn không?"* → mở `giảng lại` mức `de`. Một lần duy nhất cho mỗi khối. |
| **Vào bài đánh giá** | Cân Nhắc vào vai, `nghiem_tuc`: nêu số câu, thời gian, ngưỡng đạt, quyền phúc khảo. Trong lúc làm bài, mascot **im lặng tuyệt đối**. |
| **Trượt bài đánh giá** | Không an ủi sáo. Đưa bản đồ 3 kỹ năng yếu nhất và đường ngắn nhất để thi lại. |
| **Căn cứ hết hiệu lực** | `canh_bao`, hiện ngay cả trong chế độ yên lặng, nêu văn bản thay thế và ngày, mời xem `doi_chieu`. |
| **Quay lại sau kỳ nghỉ** | Chào bình thường, tóm tắt đúng chỗ đang dở, đề nghị 5 phút ôn trước khi học tiếp. Không trách móc. |
| **Nhận chứng nhận** | `an_mung`, trang phục `tot_nghiep`, kèm nhắc rằng chứng nhận gắn với khung pháp lý tại `as_of` và sẽ có lời mời học bù khi văn bản đổi. |

### 7.2 Người học điều khiển được gì

Trong `/dao-tao/cai-dat`: chọn nhân vật (nếu chuyên đề cho phép), mức xuất hiện
(`day_du` / `it` / `yen_lang` / `tat`), bật/tắt chuyển động, bật/tắt âm thanh (mặc định tắt),
xoá toàn bộ lịch sử tương tác với mascot.

## 8. Tương tác với nội dung bài học

Mascot không chỉ nói — nó **thao tác lên bài học**. Tám lệnh, khai báo trong `cta.lenh`:

| Lệnh | Tác dụng |
|------|----------|
| `tro_toi(block)` | Cuộn tới khối, mũi tên chỉ vào, viền nhấp nháy một lần |
| `to_sang(block, range)` | Tô sáng một đoạn trong khối (ví dụ đúng cụm từ quyết định nghĩa) |
| `mo_can_cu(urn)` | Mở panel đọc đúng khoản tại `as_of` của bài |
| `so_sanh(urn, from, to)` | Mở khối `doi_chieu` trước/sau |
| `giang_lai(block, muc)` | Sinh lại lời giảng ở mức `de`/`chuan`/`sau` |
| `mo_cong_cu(ten, tham_so)` | Mở máy tính chi phí / định tuyến thủ tục với tham số điền sẵn từ bài |
| `chen_bai_va(ma_loi)` | Chèn bài vá vào lộ trình |
| `hoi_tai_cho(block)` | Mở ô hỏi đáp với ngữ cảnh là các nút căn cứ của khối |

Quy tắc: mọi lệnh đều **hoàn tác được** và không bao giờ tự chạy khi người học đang nhập liệu.
Lệnh chạm vào nội dung pháp lý (`mo_can_cu`, `so_sanh`) chỉ dùng URN có sẵn trong
`lesson_blocks.citations` — mascot không tự nghĩ ra viện dẫn mới.

## 9. Đo lường mascot

Ghi vào `mascot_events(enrollment_id, action_id, persona_id, trigger, shown_at, outcome)` với
`outcome ∈ {hien, bam_cta, dong, bo_qua, tat_mascot}`. Chỉ số theo dõi:

| Chỉ số | Ngưỡng |
|--------|--------|
| Tỷ lệ bấm CTA / lượt hiện | < 8% → hành động vô ích, xem lại lời thoại |
| Tỷ lệ đóng | > 30% → giảm `priority` hoặc tăng `cooldown` |
| Tỷ lệ tắt mascot sau khi gặp một hành động | > 2% → **tự động vô hiệu hoá hành động đó** và báo quản trị |
| Chênh lệch hoàn thành bài giữa nhóm bật/tắt mascot | Nếu ≤ 0 thì mascot đang gây hại, phải sửa |

Chỉ số cuối là chỉ số quyết định: mascot tồn tại để người học học xong, không phải để dễ thương.

## 10. Việc phải làm

| # | Việc | Nơi |
|---|------|-----|
| 1 | Bảng nhân vật, trang phục, hành động, ảnh, sự kiện | `packages/db/migrations/0007_mascot.sql` |
| 2 | Gói mascot: kiểu, bộ 7 nhân vật, renderer SVG, bộ chọn hành động, định tuyến | `packages/mascot/` |
| 3 | Truy vấn CSDL mascot | `packages/db/src/mascot.ts` |
| 4 | API mascot (chọn nhân vật, lấy hành động, ghi sự kiện) | `apps/api/src/routes/mascot.ts` |
| 5 | Hàng đợi sinh ảnh | `qdpl-mascot-anh` + `apps/workers-ts/src/bull/workers/mascot-anh.ts` |
| 6 | Prompt lời thoại và prompt ảnh | `prompts/mascot/` |
| 7 | Thành phần giao diện: nhân vật SVG, khung gia sư nổi kéo thả | `apps/web/app/components/mascot/MascotHinh.tsx`, `MascotGiaSu.tsx` |
| 8 | Ba màn hình quản trị mascot | `09-c §6` |
