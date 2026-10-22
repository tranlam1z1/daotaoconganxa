# Dữ liệu mẫu để dán khi demo

Mỗi ô nhập trên màn hình có một khối giá trị bên dưới: sao chép khối, dán vào ô cùng tên. Ô chọn (select, radio, ô đánh dấu) ghi "chọn …". Ô không nhắc tới thì để mặc định.

Dữ liệu đã đối chiếu với ràng buộc của từng form (độ dài, định dạng mã, căn cứ phải có trong kho demo). Kịch bản trình bày ở [KICH-BAN-DEMO.md](KICH-BAN-DEMO.md).

| | |
|---|---|
| Mật khẩu chung các tài khoản mẫu | `Matkhau2026` |
| Tài khoản quản trị | `quantri` |
| Dựng lại dữ liệu sạch sau khi diễn tập | `bun run demo --lam-lai` |

Mọi mã, tên trong tệp này chỉ dùng được **một lần** sau mỗi lần dựng lại dữ liệu (lần sau báo "đã có"). Diễn tập xong thì dựng lại.

**Thứ tự nên làm** (mục sau dùng dữ liệu của mục trước): 1 Đơn vị → 2 Người dùng → 4 Câu hỏi → 5 Đề thi → 6 Giao bài. Các mục còn lại làm theo thứ tự nào cũng được.

---

## Phần A. Người học (tài khoản `canbo.d1.01`)

### A1. Tìm kiếm văn bản (ô tìm kiếm đầu trang, `/tim-kiem`)

Các từ khóa sau có kết quả cả khi máy demo không nối kho văn bản thật:

```
nồng độ cồn
```
```
giấy phép lái xe
```
```
thiết bị an toàn cho trẻ em
```
```
niên hạn sử dụng
```
```
36/2024/QH15
```

### A2. Hỏi trợ lý AI (`/hoi-dap`, chỉ chạy khi máy có key AI)

```
Người điều khiển xe ô tô có nồng độ cồn trong hơi thở bị xử phạt thế nào?
```
```
Những hành vi nào bị nghiêm cấm khi tham gia giao thông đường bộ theo Luật Trật tự, an toàn giao thông đường bộ?
```
```
Khi tham gia giao thông, trẻ em dưới 10 tuổi ngồi trên xe ô tô phải đáp ứng điều kiện gì?
```

Không có key AI thì trang báo "Hỏi đáp AI chưa được cấu hình…". Đó là hành vi đúng, không phải lỗi.

### A3. Tra cứu nhanh

**Tốc độ** (`/tra-cuu-nhanh/toc-do`)

| Loại xe | Tốc độ cho phép | Tốc độ đo được | Kết quả |
|---|---|---|---|
| Ô tô | `60` | `75` | Vượt 15 km/h, khung 10–20 km/h (ví dụ của kịch bản) |
| Ô tô | `80` | `120` | Vượt 40 km/h, khung trên 35 km/h |
| Xe máy | `50` | `58` | Vượt 8 km/h, khung 5–10 km/h |
| Xe máy | `40` | `65` | Vượt 25 km/h, khung trên 20 km/h |
| Ô tô | `60` | `63` | Vượt 3 km/h: "chưa có mức phạt khớp" (dùng để nói về ngưỡng 5 km/h) |

**Mức phạt** (`/tra-cuu-nhanh/muc-phat`), các từ khóa có kết quả:

```
quá tốc độ
```
```
vượt đèn đỏ
```
```
mũ bảo hiểm
```
```
quá tải
```
```
chở quá số người
```
```
cơi nới thùng
```
```
chuyển làn
```

> Đừng bấm gợi ý **"nồng độ cồn"** và **"điện thoại"** trên trang này: các dòng đó còn là bản nháp nên không ra kết quả. Tìm "nồng độ cồn" thì dùng ô tìm kiếm văn bản (A1).

**Biển báo** (`/tra-cuu-nhanh/bien-bao`):

```
P.127
```
```
cấm đỗ
```
```
trẻ em
```
```
đường sắt
```
```
vòng xuyến
```

Nhóm "Biển phụ" đang trống. Trang Quy trình (`/tra-cuu-nhanh/quy-trinh`) cũng trống cho tới khi làm mục C3 ở phần quản trị.

### A4. Nhóm học cùng (Học → Nhóm học cùng → "Tạo nhóm")

**Tên nhóm**
```
Ôn thi tháng 10, Đội 1
```
**Mô tả**
```
Nhóm ôn luật giao thông đường bộ trước đợt kiểm tra tháng 10. Mỗi ngày làm ít nhất 10 câu luyện tập và một bài học.
```

Trong nhóm vừa tạo: "Chia sẻ vào nhóm" → "Đề ôn tập", chọn chủ đề **Giấy phép lái xe**, số câu `5`.

**Tên đề**
```
Đề ôn giấy phép lái xe
```

Mã mời sinh ngẫu nhiên (8 ký tự), không có mã cố định: bấm "Sao chép liên kết mời", dán sang tài khoản `canbo.d2.01`.

### A5. Đổi mật khẩu (`/doi-mat-khau`)

Không đổi mật khẩu các tài khoản mẫu: mật khẩu chung sẽ hỏng. Dùng tài khoản vừa nhập từ Excel (mục B2), đăng nhập bằng mật khẩu tạm, hệ thống buộc đổi.

**Mật khẩu mới** (8–200 ký tự, có chữ và số)
```
Demo2026moi
```

---

## Phần B. Quản trị người dùng, đơn vị (tài khoản `quantri`)

### B1. Thêm đơn vị (`/quan-tri/don-vi` → "Thêm đơn vị")

**Tên đơn vị**
```
Đội Cảnh sát giao thông trật tự
```
**Mã đơn vị**
```
PC08-D5
```
**Tên cấp**
```
Đội
```

- Đơn vị cấp trên: chọn **Phòng Cảnh sát giao thông (PC08)**
- Thứ tự: `5`

> Không dùng mã `PC08-D4`: tệp Excel người dùng cố ý có dòng lỗi "không có đơn vị PC08-D4". Tạo đơn vị đó thì dòng lỗi thành hợp lệ.

### B2. Nhập người dùng từ Excel

Dùng tệp có sẵn [demo/demo-nhap-nguoi-dung.xlsx](demo/demo-nhap-nguoi-dung.xlsx). Kết quả mong đợi ở [KICH-BAN-DEMO.md](KICH-BAN-DEMO.md) mục 2.3: 4 dòng hợp lệ, 3 dòng lỗi cố ý.

### B3. Thêm một người dùng (`/quan-tri/nguoi-dung` → "Thêm một người dùng")

**Họ và tên**
```
Trịnh Văn Phúc
```
**Tên đăng nhập**
```
canbo.d5.01
```
**Cấp bậc, chức vụ**
```
Thượng úy, Cán bộ Đội 5
```
**Email**
```
canbo.d5.01@demo.local
```

- Đơn vị: chọn **Đội Cảnh sát giao thông trật tự (PC08-D5)** (vừa tạo ở B1; chưa tạo thì chọn Đội Tuần tra kiểm soát số 1)
- Vai trò: chọn **Cán bộ**

Mật khẩu tạm hiện **một lần** sau khi lưu: chép lại ngay để đăng nhập thử.

---

## Phần C. Dữ liệu tra cứu (tài khoản `quantri`)

### C1. Thêm mức phạt (`/quan-tri/du-lieu-tra-cuu/moi`, loại Mức phạt)

**Mã**
```
mt-khong-mang-gplx-demo
```
**Nhóm**
```
Giấy tờ
```
**Hành vi vi phạm**
```
[Demo] Người điều khiển xe mô tô, xe gắn máy không mang theo giấy phép lái xe
```
**Từ khóa tìm kiếm**
```
không mang bằng lái, quên bằng lái, không mang giấy phép lái xe, giấy phép lái xe
```
**Phạt từ (đồng)**
```
200000
```
**Phạt đến (đồng)**
```
300000
```
**Căn cứ** (tìm văn bản rồi chọn điều khoản, hoặc bấm "Nhập URN thủ công" và dán)
```
vn:vbqppl:nd:168/2024/NĐ-CP#dieu-18
```
**Hiệu lực từ ngày**: `01/01/2025`

**Ghi chú biên tập**
```
Dòng thử trong buổi demo. Mức tiền là số minh họa, chưa đối chiếu Nghị định số 168/2024/NĐ-CP.
```

- Loại xe: chọn **Mô tô, xe gắn máy**
- Trừ điểm GPLX, vượt tốc độ, hình thức bổ sung: để trống
- Bấm **"Lưu và gửi duyệt"**, mở dòng vừa tạo, bấm **"Duyệt"**.

Kiểm tra: tài khoản cán bộ vào `/tra-cuu-nhanh/muc-phat`, tìm `quên bằng lái` → ra đúng dòng này.

### C2. Sửa một biển báo (`/quan-tri/du-lieu-tra-cuu`, tab Biển báo, chọn `P.127`)

Chỉ để trình bày luồng "sửa thì dòng về chờ duyệt". **Ghi chú**
```
Sửa thử trong buổi demo: bổ sung ghi chú, không đổi nội dung biển.
```
Lưu → dòng chuyển sang chờ duyệt → bấm "Duyệt" ngay để biển P.127 hiện lại cho cán bộ.

### C3. Thêm quy trình (`/quan-tri/du-lieu-tra-cuu/moi`, loại Quy trình)

**Mã**
```
tiep-nhan-tin-bao-tai-nan-demo
```
**Tên quy trình**
```
[Demo] Tiếp nhận tin báo tai nạn giao thông đường bộ
```
**Tóm tắt**
```
Các bước cán bộ trực ban làm khi nhận tin báo tai nạn giao thông, từ ghi nhận thông tin tới bàn giao hiện trường cho tổ điều tra.
```
Loại quy trình: chọn **Xử lý tai nạn**. Thêm 4 bước:

| Bước | Việc cần làm | Mô tả |
|---|---|---|
| 1 | `Ghi nhận tin báo` | `Ghi thời gian, địa điểm, số người bị thương, loại phương tiện và số điện thoại người báo tin.` |
| 2 | `Báo cáo trực ban chỉ huy` | `Báo ngay cho trực ban chỉ huy để điều tổ công tác và lực lượng y tế tới hiện trường.` |
| 3 | `Bảo vệ hiện trường` | `Tổ công tác tới nơi thì cấp cứu người bị nạn, đặt biển cảnh báo, giữ nguyên dấu vết và phương tiện liên quan.` |
| 4 | `Bàn giao cho tổ điều tra` | `Lập biên bản bàn giao hiện trường, danh sách người làm chứng và giấy tờ đã tạm giữ cho tổ điều tra.` |

Căn cứ từng bước: để trống. "Lưu và gửi duyệt" → "Duyệt". Trang `/tra-cuu-nhanh/quy-trinh` sẽ có quy trình đầu tiên.

---

## Phần D. Câu hỏi, đề thi, giao bài (tài khoản `quantri`)

### D2. Soạn câu hỏi bằng tay (`/quan-tri/cau-hoi/moi`)

Chủ đề **Nồng độ cồn và hành vi bị cấm** hiện chưa có câu nào nên đang ẩn ở trang Luyện tập. Duyệt xong hai câu dưới đây thì chủ đề hiện ra: dùng để chứng minh "chỉ câu đã duyệt mới tới người học".

**Câu 1**: Loại câu **Một đáp án**, Mức độ **Dễ**, Chủ đề **Nồng độ cồn và hành vi bị cấm**

Câu hỏi
```
Theo Luật Trật tự, an toàn giao thông đường bộ năm 2024, hành vi nào sau đây bị nghiêm cấm?
```
Phương án (đánh dấu **phương án 2** là đúng)
```
Điều khiển xe ô tô khi đã nghỉ ngơi đủ 8 tiếng
```
```
Điều khiển phương tiện mà trong máu hoặc hơi thở có nồng độ cồn
```
```
Điều khiển xe mô tô có đội mũ bảo hiểm cài quai đúng quy cách
```
Giải thích
```
Khoản 2 Điều 9 Luật số 36/2024/QH15 nghiêm cấm điều khiển phương tiện tham gia giao thông đường bộ mà trong máu hoặc hơi thở có nồng độ cồn, không phân biệt mức nồng độ.
```
Căn cứ
```
vn:vbqppl:l:36/2024/QH15#dieu-9.khoan-2
```

**Câu 2**: Loại câu **Đúng/sai**, Mức độ **Trung bình**, Chủ đề **Nồng độ cồn và hành vi bị cấm**, đáp án chọn **Sai**

Câu hỏi
```
Người điều khiển xe mô tô có nồng độ cồn trong hơi thở dưới mức thấp nhất của khung phạt thì không bị coi là vi phạm điều cấm của Luật Trật tự, an toàn giao thông đường bộ.
```
Giải thích
```
Sai. Khoản 2 Điều 9 Luật số 36/2024/QH15 cấm điều khiển phương tiện mà trong máu hoặc hơi thở có nồng độ cồn, không đặt ngưỡng tối thiểu.
```
Căn cứ
```
vn:vbqppl:l:36/2024/QH15#dieu-9.khoan-2
```

**Câu 3** (tùy chọn): Loại câu **Điền chỗ trống**, Mức độ **Dễ**, Chủ đề **Hệ thống pháp luật giao thông đường bộ**

Câu hỏi
```
Luật Trật tự, an toàn giao thông đường bộ có số hiệu Luật số ___/2024/QH15.
```
Đáp án chỗ trống 1
```
36 | số 36
```
Giải thích
```
Luật Trật tự, an toàn giao thông đường bộ là Luật số 36/2024/QH15, có hiệu lực từ ngày 01/01/2025.
```
Căn cứ
```
vn:vbqppl:l:36/2024/QH15
```

Mỗi câu: "Lưu nháp" → "Gửi duyệt" → "Duyệt". **Phải có giải thích** cả khi chỉ lưu nháp, thiếu là không lưu được.

**Sinh câu hỏi bằng AI** (chỉ khi có key AI và Redis). Ô "Điều khoản làm căn cứ":
```
vn:vbqppl:l:36/2024/QH15#dieu-9
vn:vbqppl:l:36/2024/QH15#dieu-10
```
Chủ đề **Nồng độ cồn và hành vi bị cấm**, số câu `5`, bấm "Ước tính chi phí" trước.

### D3. Soạn đề thi (`/quan-tri/de-thi/moi`)

**Tên đề thi**
```
Đề kiểm tra nhận thức pháp luật giao thông quý IV/2026
```
**Mô tả**
```
Đề kiểm tra định kỳ cho cán bộ các đội tuần tra kiểm soát. 30 câu, 30 phút, đạt từ 70 điểm.
```

| Ô | Giá trị |
|---|---|
| Thời gian làm bài (phút) | `30` |
| Điểm đạt | `70` |
| Số lần làm tối đa | `2` |
| Cho xem đáp án | Ngay sau khi nộp bài |
| Trộn câu, đảo phương án | Để đánh dấu |

**Ma trận đề** (tổng 30 câu; ngân hàng chỉ còn câu chuyển từ bài giảng, nên xem số câu đã duyệt của từng ô trước khi điền):

| Chủ đề | Dễ | Trung bình | Khó |
|---|---|---|---|
| Hệ thống pháp luật giao thông đường bộ | `5` | `6` | `2` |
| Giấy phép lái xe | `3` | `4` | `3` |
| Kiểm định, niên hạn sử dụng | `1` | `2` | `1` |
| Trừ điểm, phục hồi điểm giấy phép lái xe | `1` | `2` | `0` |
| Các chủ đề khác | `0` | `0` | `0` |

Lưu → "Xem trước một đề sinh thử" → "Xuất bản đề thi". Tổng ma trận phải từ 30 đến 40, ngoài khoảng này không lưu được.

### D4. Giao bài (`/quan-tri/giao-bai`, có thể dùng tài khoản `quanly.phong`)

- Đề thi: chọn **Đề kiểm tra nhận thức pháp luật giao thông quý IV/2026** (vừa xuất bản ở D3)
- Giao cho: **Một đơn vị** → **Đội Tuần tra kiểm soát số 2**, để đánh dấu "Kèm các đơn vị cấp dưới"
- Mở bài lúc: để trống (mở ngay)
- Hạn làm bài: để mặc định (7 ngày sau, 17:00)

**Ghi chú cho người làm bài**
```
Đề kiểm tra định kỳ quý IV. Làm trong 30 phút, được làm 2 lần, lấy điểm cao nhất. Ôn lại chủ đề Giấy phép lái xe trước khi làm.
```

Kiểm tra: đăng nhập `canbo.d2.02`, vào `/thi` → thấy đề vừa giao.

---

## Phần E. Học tập (tài khoản `quantri`)

### E1. Chuyên đề mới (`/quan-tri/chuyen-de/moi`)

**Tên chuyên đề**
```
[Demo] Phòng ngừa vi phạm nồng độ cồn
```
Đường dẫn tự điền từ tên; không sửa.

**Tóm tắt**
```
Chuyên đề ngắn giúp cán bộ nắm điều cấm về nồng độ cồn theo Luật Trật tự, an toàn giao thông đường bộ và cách giải thích cho người vi phạm.
```

- Lĩnh vực: chọn **Giao thông đường bộ** (để trống thì chuyên đề không hiện ở trang Học)
- Nhóm người học: **Người trực tiếp áp dụng quy định**; Cấp độ: **Cơ bản**
- Quy định tính đến ngày: để mặc định (hôm nay)

### E2. Bài giảng trong chuyên đề (nút "Thêm bài")

**Tên bài**
```
Điều cấm về nồng độ cồn khi điều khiển phương tiện
```
**Tóm tắt**
```
Nội dung khoản 2 Điều 9 Luật số 36/2024/QH15 và các lưu ý khi giải thích cho người vi phạm.
```
- Thời lượng dự kiến: `10`
- Kiểm tra cuối bài: chọn **Hệ thống pháp luật giao thông đường bộ** (chủ đề có đủ câu đã duyệt)

Thêm 5 khối theo thứ tự (nút "Thêm khối vào cuối bài"). Mỗi khối có ô **Viện dẫn**: dán URN ghi ở khối đó.

**Khối 1: Đoạn giảng**
```
Luật Trật tự, an toàn giao thông đường bộ năm 2024 cấm **mọi mức** nồng độ cồn khi điều khiển phương tiện tham gia giao thông đường bộ.

Điều cấm áp dụng cho người điều khiển mọi loại phương tiện: ô tô, mô tô, xe gắn máy, cả xe đạp. Mức phạt cụ thể theo từng ngưỡng nồng độ quy định ở nghị định xử phạt, nhưng hành vi đã bị cấm từ ngưỡng thấp nhất.
```
Viện dẫn
```
vn:vbqppl:l:36/2024/QH15#dieu-9.khoan-2
```

**Khối 2: Thẻ căn cứ**

URN
```
vn:vbqppl:l:36/2024/QH15#dieu-9.khoan-2
```
Nhãn
```
Khoản 2 Điều 9 Luật số 36/2024/QH15
```
Nguyên văn (giữ đúng từng chữ)
```
Điều khiển phương tiện tham gia giao thông đường bộ mà trong máu hoặc hơi thở có nồng độ cồn.
```
Viện dẫn
```
vn:vbqppl:l:36/2024/QH15#dieu-9.khoan-2
```

**Khối 3: Hỏi nhanh**

Câu hỏi
```
Người lái xe có nồng độ cồn rất thấp, dưới ngưỡng phạt thấp nhất, có vi phạm điều cấm của Luật không?
```
Phương án A (đáp án đúng)
```
Có, Luật cấm mọi mức nồng độ cồn
```
Phương án B
```
Không, chỉ vi phạm khi vượt ngưỡng phạt
```
Giải thích
```
Khoản 2 Điều 9 Luật số 36/2024/QH15 không đặt ngưỡng tối thiểu: có nồng độ cồn là vi phạm điều cấm.
```

**Khối 4: Lưu ý** (loại **Sai sót thường gặp**)
```
Người vi phạm thường nói "tôi chỉ uống một lon". Cán bộ giải thích: Luật cấm có nồng độ cồn, không tính theo số lượng đã uống.
```

**Khối 5: Ghi nhớ** (mỗi ý một dòng)
```
Luật cấm mọi mức nồng độ cồn khi điều khiển phương tiện.
```
```
Áp dụng cho mọi loại phương tiện, kể cả xe đạp.
```
```
Mức phạt cụ thể theo nghị định xử phạt.
```

Bấm kiểm tra trước khi xuất bản: bài phải có ít nhất một khối Thẻ căn cứ (khối 2) và mọi viện dẫn phải trỏ tới điều có trong kho; dữ liệu trên đã đáp ứng.

---

## Phần F. Văn bản mới (`/quan-tri/van-ban/moi`, tài khoản `quantri`)

Văn bản thử, tên ghi rõ "[Demo]", không phải văn bản thật. Xóa sau buổi demo hoặc dựng lại dữ liệu.

- Loại văn bản: chọn **Thông tư** (`tt`)
- Trạng thái hiệu lực: để "Tự tính theo ngày hiệu lực"

**Số ký hiệu**
```
99/2026/TT-BCA
```
**Tên văn bản (trích yếu)**
```
[Demo] Thông tư thử nghiệm quy định về sổ tay tuần tra điện tử của lực lượng Cảnh sát giao thông
```
**Cơ quan ban hành**
```
Bộ Công an
```
**Người ký**
```
Văn bản thử nghiệm
```
- Ngày ban hành: `15/09/2026`
- Ngày có hiệu lực: `01/10/2026`

**Tóm tắt**
```
Văn bản thử nghiệm dùng trong buổi demo để trình bày luồng nhập văn bản, tách cấu trúc chương, điều, khoản, điểm và tra cứu. Không có giá trị pháp lý.
```
**Mã lĩnh vực**
```
giao-thong-duong-bo
```
**Nội dung (Markdown)**: bấm "Xem trước cấu trúc" trước khi lưu, phải ra 2 chương, 5 điều.
```text
Chương I
QUY ĐỊNH CHUNG

Điều 1. Phạm vi điều chỉnh
Thông tư này quy định việc lập, sử dụng và quản lý sổ tay tuần tra điện tử của lực lượng Cảnh sát giao thông.

Điều 2. Đối tượng áp dụng
1. Cán bộ, chiến sĩ Cảnh sát giao thông làm nhiệm vụ tuần tra, kiểm soát.
2. Cơ quan, đơn vị quản lý cán bộ, chiến sĩ quy định tại khoản 1 Điều này.

Điều 3. Giải thích từ ngữ
Trong Thông tư này, các từ ngữ dưới đây được hiểu như sau:
1. Sổ tay tuần tra điện tử là ứng dụng ghi nhận ca tuần tra, vi phạm phát hiện và kết quả xử lý.
2. Ca tuần tra là khoảng thời gian tổ công tác thực hiện nhiệm vụ trên tuyến được phân công.

Chương II
SỬ DỤNG SỔ TAY TUẦN TRA ĐIỆN TỬ

Điều 4. Ghi nhận ca tuần tra
1. Đầu ca, tổ trưởng ghi nhận các nội dung sau:
a) Thành phần tổ công tác;
b) Tuyến, địa bàn tuần tra;
c) Phương tiện, thiết bị được cấp.
2. Cuối ca, tổ trưởng ghi nhận kết quả tuần tra và ký xác nhận điện tử.

Điều 5. Hiệu lực thi hành
Thông tư này có hiệu lực thi hành từ ngày 01 tháng 10 năm 2026.
```

Kiểm tra: tìm `sổ tay tuần tra điện tử` ở ô tìm kiếm → ra văn bản vừa nhập, mở được Điều 4 tới từng điểm.

---

## Trang không mở khi demo

Các trang sau còn là trang khung ("Trang đang được dựng lại trên giao diện mới"), không có ô nhập: `/quan-tri` (trang đầu), `/so-sanh`, `/ung-dung`, `/huong-dan`, thuộc tính, lược đồ, phiên bản văn bản.
