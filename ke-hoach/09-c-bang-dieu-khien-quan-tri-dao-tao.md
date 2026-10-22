# 09-c. Bảng điều khiển quản trị mô-đun đào tạo

> Mở rộng của `09`, `09-a`, `09-b`. Tài liệu này đặc tả **giao diện quản trị** cho mô-đun đào
> tạo và bộ mascot: bản đồ màn hình, từng màn hình làm gì, phân quyền, và nhật ký.
> Đường dẫn gốc: `/quan-tri` (đã dự trù ở `ke-hoach/10 §2`).

## 1. Nguyên tắc

1. **Một màn hình, một quyết định.** Mỗi trang trả lời đúng một câu hỏi của người vận hành
   ("bài nào đang hỏng căn cứ?", "mascot nào đang bị người học tắt?"), không phải là một bảng
   dữ liệu vạn năng.
2. **Không có nút nào thay đổi nội dung pháp lý mà không ghi nhật ký.** Mọi hành động ghi vào
   `audit_log` kèm tài khoản, thời điểm, giá trị trước/sau.
3. **Xem trước đúng như người học thấy.** Mọi trang biên soạn có nút "Xem như người học", render
   bằng đúng thành phần giao diện của trang học, không phải bản mô phỏng.
4. **Quyền theo vai trò có sẵn** (`@qdpl/auth`): `khach` < `tra_cuu` < `bien_tap` < `phap_che`
   < `quan_tri`. Không thêm hệ quyền mới.
5. **Hỏng thì nói hỏng.** Không có dữ liệu thì hiện trạng thái rỗng kèm cách khắc phục, không
   hiện số 0 giả.

## 2. Bản đồ màn hình

```
/quan-tri                            Tổng quan: sức khỏe nội dung, hàng đợi, cảnh báo
├── /chuyen-de                       Danh sách chuyên đề
│   └── /chuyen-de/:slug             Biên soạn một chuyên đề: bài học, kỹ năng, mascot, xuất bản
│       └── /chuyen-de/:slug/bai/:id Biên soạn một bài: khối nội dung + bài tập
├── /soan-bai-ai                     Xưởng soạn bài bằng AI: tạo việc, theo dõi, duyệt kết quả
├── /ngan-hang-cau-hoi               Ngân hàng câu hỏi: độ khó, độ phân biệt, mã lỗi
├── /nguoi-hoc                       Người học, ghi danh, tiến độ, cấp/thu hồi chứng nhận
├── /cham-lai                        Hàng đợi đối chiếu bài AI đã chấm
├── /thong-ke                        Thống kê đào tạo (§5)
└── /mascot
    ├── /mascot                      Bộ nhân vật: danh sách, tạo, sửa, định tuyến (§6.1)
    ├── /mascot/hanh-dong            Quản lý hành động của mascot (§6.2)
    ├── /mascot/hinh-anh             Tạo sinh và duyệt ảnh mascot (§6.3)
    └── /mascot/tuong-tac            Kịch bản tương tác và số liệu hiệu quả (§6.4)
```

Layout `/quan-tri` là layout riêng: cột điều hướng trái (thu gọn được trên mobile), thanh trên
hiện tài khoản và vai trò, dải cảnh báo đỏ khi có bài đang xuất bản mà căn cứ đã hỏng.

## 3. Trang tổng quan `/quan-tri`

Sáu thẻ số liệu, mỗi thẻ bấm được và dẫn thẳng tới danh sách đã lọc sẵn:

| Thẻ | Nội dung | Màu cảnh báo khi |
|-----|----------|------------------|
| Căn cứ hỏng | Số bài đang xuất bản có `citation_health ≠ ok` | > 0 → đỏ |
| Chờ duyệt | Bài/bài tập ở `cho_phap_che` | > 10 hoặc có mục > 7 ngày → vàng |
| Việc AI đang chạy | `authoring_jobs` state `dang_chay` / `loi` | có `loi` → đỏ |
| Ảnh mascot chờ duyệt | `mascot_assets` state `cho_duyet` | — |
| Chấm lại | Bài AI chấm chờ đối chiếu | quá hạn 3 ngày → vàng |
| Chi phí AI tháng này | USD, so với hạn mức | > 80% hạn mức → vàng |

Dưới đó: **dòng thời gian hoạt động** 20 mục gần nhất từ `audit_log` (ai làm gì), và **bảng
văn bản vừa đổi hiệu lực** kèm danh sách bài học bị ảnh hưởng cùng nút "Đánh dấu cần cập nhật".

## 4. Các màn hình nội dung

### 4.1 `/quan-tri/chuyen-de/:slug` — biên soạn chuyên đề

Bốn tab:

- **Bài học** — bảng kéo thả đổi thứ tự; mỗi dòng hiện: số bài, tên, trạng thái, `as_of`,
  `citation_health`, số hoạt động, thời lượng ước tính, người sửa cuối. Nút thêm bài, nhân bản
  bài, ẩn bài.
- **Kỹ năng** — bản đồ năng lực (`skills`): thêm kỹ năng, đặt tiên quyết, gán bài học. Cảnh báo
  khi phát hiện **chu trình tiên quyết** hoặc kỹ năng không bài nào dạy.
- **Đồng hành** — chọn mascot mặc định của chuyên đề, khoá/không khoá quyền đổi của người học,
  chọn bộ trang phục dùng cho chuyên đề, xem trước hộp thoại chào.
- **Xuất bản** — bảng kiểm trước khi xuất bản, chặn nếu chưa đạt:
  `citation_health = ok` cho mọi bài · mọi bài có ≥ 1 khối `can_cu` · mọi hoạt động có phản hồi
  và `ma_loi` · mọi rubric có tiêu chí `can_cu` · `as_of` không cũ hơn 90 ngày · đã chạy
  `scripts/check-citations.ts`. Nút xuất bản chỉ mở cho vai trò `phap_che` trở lên.

### 4.2 `/quan-tri/chuyen-de/:slug/bai/:id` — biên soạn bài học

Ba cột trên màn hình rộng, xếp chồng trên mobile:

1. **Danh sách khối** — kéo thả đổi thứ tự, thêm khối theo 19 kiểu (`09-a §2`), nhân bản, xoá.
   Mỗi khối hiện nhãn nguồn: `nguoi` / `ai` / `ai_da_sua`.
2. **Trình soạn khối** — biểu mẫu theo schema của kiểu khối đang chọn; khối `can_cu` dùng
   **bộ chọn viện dẫn**: gõ "khoản 2 điều 15 nđ 224/2026" → gọi `/v1/citations/resolve` → chèn
   URN đã kiểm chứng kèm nguyên văn. Không cho gõ tay nguyên văn: nguyên văn luôn lấy từ kho.
3. **Xem trước** — render đúng bằng thành phần của trang học, đổi được giữa chế độ sáng/tối,
   khổ điện thoại/desktop, và giữa 4 chế độ học (`day_du`/`nhanh`/`tra_cuu`/`on_thi`).

Tab thứ hai của trang: **Hoạt động** — danh sách bài tập, mỗi bài mở trình soạn theo 15 dạng
(`09-a §3`), có ô rubric và bảng thống kê thực tế của từng câu (độ khó, độ phân biệt).

### 4.3 `/quan-tri/soan-bai-ai` — xưởng soạn bài

- **Tạo việc**: chọn chuyên đề/bài, chọn bước (7 bước ở `09-a §5`), chọn `tier` mô hình, bật
  `batch`, đặt trần chi phí. Trước khi chạy hiện **bảng ngữ cảnh sẽ gửi**: danh sách nút văn bản
  đưa vào prompt — người vận hành thấy rõ mô hình được đọc gì.
- **Theo dõi**: bảng việc với trạng thái `cho`/`dang_chay`/`xong`/`loi`, tiến độ, token, chi phí,
  thời gian; mở được prompt đã gửi và kết quả thô.
- **Duyệt kết quả**: so sánh cạnh nhau bản AI đề xuất ↔ bản hiện tại, chọn từng khối để nhận,
  sửa tại chỗ rồi nhận. Nhận xong khối mang nhãn `ai_da_sua`.
- **Báo cáo kiểm căn cứ** của bước 6 hiện ngay trong trang: URN nào không tồn tại, hết hiệu lực,
  hoặc trích sai nguyên văn — kèm nút mở văn bản.

### 4.4 `/quan-tri/ngan-hang-cau-hoi`

Bảng mọi hoạt động toàn hệ thống, lọc theo chuyên đề, kỹ năng, `ma_loi`, dạng bài. Cột số liệu:
lượt làm, % đúng lần đầu, độ phân biệt, thời gian trung bình, tỷ lệ bỏ trống. Ba hành động hàng
loạt: gỡ khỏi đề (`đã nghỉ`), gắn lại `ma_loi`, gửi soạn lại bằng AI.

### 4.5 `/quan-tri/nguoi-hoc`

Danh sách ghi danh: người học, chuyên đề, chế độ, tiến độ, điểm, hoạt động gần nhất. Mở một
người học ra: bản đồ năng lực, lịch sử làm bài, sản phẩm đã nộp, chứng nhận. Hành động: ghi danh
hàng loạt theo danh sách email, gia hạn, cấp lại chứng nhận, **thu hồi chứng nhận** (chỉ
`quan_tri`, bắt buộc nhập lý do).

Dữ liệu người học là dữ liệu cá nhân: màn hình này chỉ mở cho `phap_che` trở lên, mọi lượt xem
chi tiết một người học đều ghi `audit_log`.

### 4.6 `/quan-tri/cham-lai`

Hàng đợi 10% bài AI chấm (và 100% bài mức 3). Mỗi mục hiện: bài làm, điểm AI theo từng tiêu chí
kèm trích đoạn làm bằng chứng, ô cho giảng viên chấm lại. Khi lệch ≥ 1 mức, hệ thống ghi vào
`evals/` và gắn cờ prompt cần hiệu chỉnh.

## 5. `/quan-tri/thong-ke`

Bốn nhóm biểu đồ (mọi biểu đồ đều có bảng số tương đương cho trình đọc màn hình):

1. **Sức khoẻ nội dung** — `citation_health` theo chuyên đề; số bài `can_cap_nhat`; tuổi `as_of`.
2. **Hành trình người học** — phễu: ghi danh → vào bài 1 → xong bài 1 → xong 50% → hoàn thành;
   điểm rơi theo khối; thời gian trung vị mỗi bài.
3. **Chất lượng đánh giá** — phân bố điểm, độ khó và độ phân biệt từng câu, lệch chấm AI ↔ người.
4. **Vận hành** — chi phí AI theo chuyên đề và theo bước, thời gian chạy job, tỷ lệ lỗi job.

Bộ lọc chung: khoảng thời gian, chuyên đề, đối tượng, mascot đang dùng. Xuất CSV.

## 6. Ba màn hình mascot

### 6.1 `/quan-tri/mascot` — bộ nhân vật và định tuyến

**Phần trên — lưới nhân vật.** Mỗi thẻ: bản dựng SVG trực tiếp, tên đầy đủ, tên gọi thân mật,
vai, đối tượng, chuyên đề đang dùng, công tắc bật/tắt. Nút **Tạo nhân vật mới**.

**Trình sửa nhân vật** (mở từ một thẻ):

| Nhóm trường | Nội dung |
|-------------|----------|
| Danh tính | `code`, tên đầy đủ, tên gọi, một câu mô tả vai, tiểu sử 3 câu |
| Giọng nói | xưng hô (tự xưng / gọi người học), độ dài câu tối đa, mức trang trọng, 3 từ nên dùng, 3 từ cấm |
| Đối tượng | `audiences[]` (chọn từ danh mục đối tượng), `topics[]` (thẻ chuyên đề) |
| Tạo hình | bảng màu 6 màu có **kiểm tra tương phản AA ngay tại chỗ**, hình dáng thân (`body`), phụ kiện đầu, đạo cụ mặc định, danh sách trang phục cho phép |
| Phiếu nhân vật | `character_sheet` — đoạn mô tả khoá cứng dùng cho sinh ảnh (`09-b §6.2`) |
| Xem thử | Lưới **12 trạng thái × trang phục đang chọn**, dựng SVG trực tiếp, đổi tư thế/đạo cụ/hiệu ứng bằng ô chọn; nút "Xem trong bài học thật" |

**Phần dưới — bảng định tuyến.** Một bảng cho biết **chuyên đề nào đang hiện nhân vật nào và vì
sao**: cột `chuyên đề | đối tượng | nhân vật đang dùng | lý do chọn | khoá đổi | thao tác`.
Cột "lý do" lấy thẳng `ly_do` do `routing.ts` trả về (`nguoi_hoc_chon`, `ban_giao_ngu_canh`,
`bai_chi_dinh`, `chuyen_de_chi_dinh`, `khop_doi_tuong`, `mac_dinh`) — nhìn là hiểu, không phải
đoán. Có ô **thử định tuyến**: nhập đối tượng + thẻ chuyên đề → xem hệ thống sẽ chọn ai.

Bên cạnh: bảng **bàn giao theo ngữ cảnh** (`mascot_handoffs`): ngữ cảnh (`bai_danh_gia`,
`may_tinh_chi_phi`, `tra_cuu_hieu_luc`, `thu_tuc_cong_dan`…) → nhân vật chiếm quyền → bật/tắt.

### 6.2 `/quan-tri/mascot/hanh-dong` — quản lý hành động

**Bảng hành động.** Cột: `code`, nhân vật (hoặc "mọi nhân vật"), kích hoạt, điều kiện rút gọn,
ưu tiên, nghỉ giữa hai lần, hạn mức phiên/ngày, trạng thái/tư thế/hiệu ứng, số biến thể lời
thoại, **tỷ lệ bấm CTA**, **tỷ lệ đóng**, công tắc bật/tắt. Lọc theo nhóm kích hoạt (`09-b §5.2`).

Dòng nào có tỷ lệ đóng > 30% hoặc tỷ lệ tắt mascot > 2% được tô cảnh báo, kèm nút *"tạm dừng
hành động này"*.

**Trình sửa hành động** — bốn phần:

1. **Khi nào**: chọn `trigger`; dựng điều kiện bằng bộ dựng luật (trường – toán tử – giá trị),
   các trường có sẵn: `so_lan_sai`, `ma_loi`, `thoi_gian_o_khoi`, `tien_do_bai`, `che_do_hoc`,
   `vai_tro`, `gio_trong_ngay`, `so_ngay_vang`, `citation_health`, `muc_danh_gia`.
2. **Hiện thế nào**: nhân vật (để trống = theo định tuyến), `anchor`, `state`, `pose`, `costume`,
   `prop`, `effect` — có **ô xem trước dựng SVG ngay** cạnh các ô chọn.
3. **Nói gì**: danh sách biến thể lời thoại; mỗi biến thể có ô đếm ký tự (≤ 140), chọn loại
   `loi_dan` / `loi_phap_ly`. Chọn `loi_phap_ly` thì **bắt buộc** gắn viện dẫn qua bộ chọn viện
   dẫn, và ô xem trước đổi sang dạng thẻ căn cứ. Nút **"Nhờ AI viết thêm 3 biến thể"** — gọi
   `prompts/mascot/loi-thoai.md` với `voice` của nhân vật; kết quả vào trạng thái `nhap`, phải
   duyệt mới dùng.
4. **Mời làm gì**: `cta` gồm nhãn và một trong 8 lệnh tương tác với bài học (`09-b §8`), kèm
   tham số. Có nút chạy thử lệnh trên một bài học mẫu.

**Chạy thử.** Nút "Diễn thử" mở một bài học thật trong khung xem trước và bắn sự kiện `trigger`
đã chọn, để người vận hành thấy đúng thứ người học sẽ thấy — kể cả phần bị hạn mức chặn.

### 6.3 `/quan-tri/mascot/hinh-anh` — tạo sinh và duyệt ảnh

**Thanh tạo sinh (trên cùng).** Đây là màn hình sinh ảnh hàng loạt, nên chọn theo **tổ hợp**
chứ không theo từng ảnh:

```
Nhân vật:  [Mực Thước ▾]        Loại ảnh: [sticker ▾]
Trạng thái: [☑ 12 trạng thái | chọn riêng ▾]
Trang phục: [☑ công sở ☐ áo the ☐ bảo hộ …]   (chỉ hiện bộ hợp lệ của nhân vật)
Tư thế: [▾]   Đạo cụ: [▾]   Hiệu ứng: [▾]
Số ảnh mỗi tổ hợp: [2]   Mô hình: [▾]   Seed: [ngẫu nhiên | cố định ___]
→ Sẽ sinh 24 ảnh · ước tính chi phí 0,48 USD      [ Xem prompt ] [ Bắt đầu ]
```

Nút **Xem prompt** mở đúng chuỗi prompt sẽ gửi, gồm phiếu nhân vật khoá cứng (`character_sheet`)
+ mô tả tổ hợp + ảnh tham chiếu là bản dựng SVG của chính tổ hợp đó. Không sinh mù.

**Bảng tiến độ lô.** Mỗi lô hiện: tổng, đã xong, lỗi, chi phí, người tạo; huỷ được giữa chừng.

**Thư viện ảnh.** Lưới ảnh lọc theo nhân vật / loại / trạng thái / trang phục / tình trạng
duyệt. Mỗi ảnh: xem lớn, xem cạnh bản dựng SVG cùng tổ hợp (để soi lệch nhận dạng nhân vật),
metadata (mô hình, seed, phiên bản prompt, chi phí, người tạo). Hành động:
**Duyệt** · **Từ chối** (bắt buộc lý do) · **Đặt làm ảnh chính** cho tổ hợp · **Sinh lại cùng
seed** · **Tải xuống** · **Gỡ bỏ**.

Ràng buộc hiển thị trong giao diện: mỗi tổ hợp (nhân vật, loại, trạng thái, trang phục) chỉ có
**một** ảnh `dung_chinh`; đặt ảnh mới làm chính thì ảnh cũ tự chuyển về `duyet`.

**Bảng biểu cảm.** Nút "Xuất bảng biểu cảm" ghép 12 trạng thái của một nhân vật thành một tấm
PNG dùng cho tài liệu và cho bộ nhận diện.

### 6.4 `/quan-tri/mascot/tuong-tac` — kịch bản và hiệu quả

- **Kịch bản** (`09-b §7.1`): danh sách 11 cảnh chính; mỗi cảnh mở ra chuỗi hành động sẽ chạy,
  sắp xếp được, bật/tắt từng cảnh theo chuyên đề.
- **Bản đồ tương tác với nội dung**: bảng 8 lệnh (`09-b §8`), mỗi lệnh cho biết đang được bao
  nhiêu hành động dùng và tỷ lệ hoàn tác của người học.
- **Hiệu quả** (`09-b §9`): 4 chỉ số theo hành động và theo nhân vật; **so sánh nhóm bật mascot
  ↔ nhóm tắt mascot** về tỷ lệ hoàn thành bài và điểm trung bình. Nếu chênh lệch ≤ 0, trang hiện
  cảnh báo thẳng: *"mascot hiện không giúp người học hoàn thành bài tốt hơn"*.
- **Cài đặt toàn cục**: mức xuất hiện mặc định, hạn mức tần suất, bật/tắt âm thanh, bật/tắt
  chuyển động, và **công tắc tắt toàn bộ mascot** trên toàn hệ thống (chỉ `quan_tri`).

## 7. Phân quyền

| Màn hình / hành động | Vai trò tối thiểu |
|----------------------|-------------------|
| Xem `/quan-tri`, thống kê nội dung | `bien_tap` |
| Soạn khối nội dung, bài tập, tạo việc AI | `bien_tap` |
| Duyệt kết quả AI vào bản nháp | `bien_tap` |
| Xuất bản bài / chuyên đề, đổi `as_of` | `phap_che` |
| Xem chi tiết người học, cấp chứng nhận | `phap_che` |
| Thu hồi chứng nhận, xoá chuyên đề | `quan_tri` |
| Sửa nhân vật, hành động, định tuyến mascot | `bien_tap` |
| Duyệt ảnh mascot, đặt ảnh chính | `bien_tap` |
| Tạo lô sinh ảnh (tốn tiền), đặt trần chi phí | `phap_che` |
| Tắt toàn bộ mascot, đổi hạn mức toàn cục | `quan_tri` |

Kiểm tra quyền thực hiện **ở tầng API** (`apps/api/src/routes/quan-tri.ts`) bằng
`atLeast(principal.role, ...)` của `@qdpl/auth`; giao diện chỉ ẩn nút cho gọn, không phải là
lớp bảo vệ.

## 8. Nhật ký

Mọi hành động ghi `audit_log(actor, action, target, before, after, created_at)` với `action`
dạng `dao_tao.bai.xuat_ban`, `mascot.hanh_dong.tat`, `mascot.anh.duyet`, `dao_tao.chung_nhan.thu_hoi`.
Trang `/quan-tri` hiện 20 mục gần nhất; lọc đầy đủ ở `/quan-tri/thong-ke` tab "Vận hành".

## 9. Việc phải làm

| # | Việc | Nơi |
|---|------|-----|
| 1 | API quản trị có kiểm tra vai trò | `apps/api/src/routes/quan-tri.ts` |
| 2 | Layout và điều hướng quản trị | `apps/web/app/routes/quan-tri.tsx` |
| 3 | 11 trang quản trị theo §2 | `apps/web/app/routes/quan-tri.*.tsx` |
| 4 | Bộ chọn viện dẫn dùng lại `/v1/citations/resolve` | `apps/web/app/components/quan-tri/` |
| 5 | Xem trước mascot dựng SVG trực tiếp | `apps/web/app/components/mascot/` |
| 6 | Đọc phiên từ cookie, gọi API bằng Bearer | `apps/web/app/lib/quan-tri.server.ts` |
