# Kịch bản demo

Kịch bản trình bày hệ thống học tập, sát hạch và tra cứu nghiệp vụ cho Phòng Cảnh sát giao thông, theo thứ tự từng bước, kèm dữ liệu chuẩn bị sẵn. Cách dựng máy demo, danh sách đầy đủ màn hình và ghi chú từng trò chơi ở [DEMO.md](DEMO.md); tài liệu này chỉ nêu **trình bày cái gì, theo thứ tự nào, bấm gì, nói gì**.

| | |
|---|---|
| Thời lượng | 45 phút trình bày, 15 phút hỏi đáp. Bản rút gọn 20 phút ở mục 6 |
| Người xem | Lãnh đạo phòng, cán bộ quản lý đội, cán bộ phụ trách đào tạo |
| Địa chỉ | http://localhost:3080 (máy trình chiếu), HTTPS đường hầm cho điện thoại |
| Mật khẩu chung | `Matkhau2026` |
| Dữ liệu nhập trong buổi demo | [demo/demo-nhap-nguoi-dung.xlsx](demo/demo-nhap-nguoi-dung.xlsx) |

---

## 1. Chuẩn bị

### 1.1. Trước buổi demo một ngày

1. Cập nhật mã nguồn, cài thư viện: `git pull`, `bun install`.
2. Tạo `.env.demo.local` ở thư mục gốc (không vào git):
   ```
   # Văn bản giao thông thật (Luật số 36/2024/QH15, Nghị định số 168/2024/NĐ-CP…): quyền chỉ đọc
   DEMO_NGUON_DATABASE_URL=postgresql://...
   # Tùy chọn: hỏi đáp AI thật
   ANTHROPIC_API_KEY=sk-ant-...
   LLM_PROVIDER=auto
   ```
   Không có `DEMO_NGUON_DATABASE_URL` thì tìm kiếm và đọc văn bản chỉ có hai văn bản thử (Nghị định số 100/2026/NĐ-CP và văn bản sửa đổi). Bước 1 của kịch bản có phương án cho trường hợp này.
3. Cài cloudflared nếu sẽ mở trên điện thoại: `winget install --id Cloudflare.cloudflared`.
4. Chạy `bun run demo --duong-ham`, rồi **diễn tập đủ kịch bản mục 3 một lượt**.
5. Diễn tập làm thay đổi dữ liệu (lượt thi, nhóm mới, tài khoản và câu hỏi nhập từ Excel). Diễn tập xong, dựng lại sạch:
   ```
   bun run demo --lam-lai --duong-ham
   ```
   Lịch sử học mẫu tính lùi 14 ngày từ lúc gieo, nên dựng lại càng gần buổi demo thì số liệu "tuần này" càng đầy. Nên chạy lại lệnh này sáng hôm demo.

### 1.2. Trước giờ demo 30 phút

| Việc | Kiểm tra |
|---|---|
| Docker Desktop đang chạy | Biểu tượng báo "Engine running" |
| `bun run demo --nhanh --khong-build --duong-ham` (nếu đã dựng sáng nay) | Màn hình in "BẢN DEMO ĐÃ CHẠY" và địa chỉ `https://….trycloudflare.com` |
| Mở http://localhost:3081/health | Trả về trạng thái tốt |
| Tắt thông báo Windows, Zalo, Teams; cắm sạc | |
| Phóng to trình duyệt 110–125% cho người ngồi xa | |
| Điện thoại: mở địa chỉ đường hầm, đăng nhập `canbo.d1.01`, cài PWA, tải trước một chủ đề luyện tập offline (mục 3, bước 8) | Biểu tượng ứng dụng có trên màn hình chính |

### 1.3. Bốn hồ sơ Chrome

Dùng bốn hồ sơ Chrome (Profile) để không phải đăng xuất, đăng nhập trong lúc trình bày. Đăng nhập sẵn, mở sẵn tab như bảng dưới.

| Hồ sơ | Tài khoản | Người | Vai | Tab mở sẵn |
|---|---|---|---|---|
| A | `canbo.d1.01` | Đại úy Lê Quang Huy, Đội 1 | Người học chính | `/`, `/tro-choi` |
| B | `canbo.d2.01` | Đại úy Vũ Đức Thắng, Đội 2 | Người học thứ hai: **chưa làm bài thi**, tham gia nhóm | `/thi` |
| C | `quanly.doi1` | Thiếu tá Trần Minh Đức, Đội trưởng Đội 1 | Cán bộ quản lý đội | `/quan-tri/bao-cao` |
| D | `quantri` | Quản trị hệ thống | Quản trị viên | `/quan-tri/nguoi-dung` |

Thiếu thời gian tạo hồ sơ thì dùng một cửa sổ thường (A) và một cửa sổ ẩn danh (lần lượt B, C, D).

`/quan-tri` (trang đầu quản trị) là trang Tổng quan: số cán bộ, người cần chú ý. Các trang con: `/quan-tri/bao-cao`, `/quan-tri/nguoi-dung`…

### 1.4. Không mở trong buổi demo

Các trang sau còn là trang khung ("Trang đang được dựng lại trên giao diện mới"): thuộc tính, lược đồ, phiên bản văn bản; `/so-sanh`; `/ung-dung`; `/huong-dan`; `/dao-tao/.../tien-do`, `/on-tap`; `/quan-tri` (trang đầu), `/quan-tri/chuyen-de`.

---

## 2. Dữ liệu chuẩn bị

### 2.1. Đơn vị và tài khoản có sẵn

| Mã | Đơn vị | Tài khoản |
|---|---|---|
| `PC08` | Phòng Cảnh sát giao thông | `quanly.phong` (Trung tá Nguyễn Văn Hùng, Trưởng phòng) |
| `PC08-D1` | Đội Tuần tra kiểm soát số 1 | `quanly.doi1` (Thiếu tá Trần Minh Đức); `canbo.d1.01` Lê Quang Huy, `canbo.d1.02` Phạm Thị Lan, `canbo.d1.03` Hoàng Văn Nam |
| `PC08-D2` | Đội Tuần tra kiểm soát số 2 | `canbo.d2.01` Vũ Đức Thắng, `canbo.d2.02` Đỗ Thị Hạnh |
| `PC08-D3` | Đội Điều tra giải quyết tai nạn | `canbo.d3.01` Bùi Văn Tuấn, `canbo.d3.02` Ngô Thanh Tâm |

Tài khoản `quantri` không thuộc đơn vị nào.

### 2.2. Dữ liệu mẫu có sẵn sau `bun run demo`

| Dữ liệu | Số lượng | Dùng ở bước |
|---|---|---|
| Câu hỏi đã duyệt | Chuyển từ bài tập của các bài giảng | 3 |
| Bài giảng đã xuất bản | 9 bài ở 5 chuyên đề | 2 |
| Trò chơi đã bật, có nội dung | 14 trò, nội dung "[Demo]" duyệt tự động | 4 |

`bun run demo` không gieo đề thi, lịch sử học, nhóm hay mùa giải. Trước buổi demo, soạn và giao một đề thi theo [DU-LIEU-MAU-DEMO.md](DU-LIEU-MAU-DEMO.md) mục D3, D4 để có bài cho bước 3.4–3.7, 6.4 và 7c.

### 2.3. Dữ liệu nhập trong buổi demo

**Tệp [demo/demo-nhap-nguoi-dung.xlsx](demo/demo-nhap-nguoi-dung.xlsx)** (bước 7a). Kết quả khi nhập:

| Dòng | Tên đăng nhập | Đơn vị | Vai trò | Kết quả |
|---|---|---|---|---|
| 2 | `canbo.d1.04` Đặng Văn Khoa | PC08-D1 | Cán bộ | Tạo được |
| 3 | `canbo.d2.03` Lý Thị Mai | PC08-D2 | Cán bộ | Tạo được |
| 4 | `canbo.d3.03` Phan Minh Tú | PC08-D3 | Cán bộ | Tạo được |
| 5 | `quanly.doi2` Trịnh Quốc Bảo | PC08-D2 | Cán bộ quản lý | Tạo được |
| 6 | `canbo.d1.01` Hồ Văn Lực | PC08-D1 | Cán bộ | Lỗi cố ý: tên đăng nhập đã có |
| 7 | `canbo.d4.01` Mai Thanh Sơn | PC08-D4 | Cán bộ | Lỗi cố ý: không có đơn vị mã PC08-D4 |
| 8 | `bientap.ngoc` Cao Thị Ngọc | PC08 | Biên tập viên | Lỗi cố ý: tệp chỉ nhận "Cán bộ" hoặc "Cán bộ quản lý" |

Tệp đã được đọc thử bằng đúng bộ đọc của API. Tệp chỉ nhập thật **một lần**: lần sau các dòng báo "đã có". Muốn nhập lại thì dựng lại bằng `bun run demo --lam-lai`.

### 2.4. Giá trị gõ tay

| Bước | Ô | Gõ |
|---|---|---|
| 1.1 | Tìm kiếm (có văn bản thật) | `nồng độ cồn` |
| 1.1 | Tìm kiếm (chỉ có văn bản thử) | `kế hoạch thử nghiệm` |
| 1.4 | Tra cứu nhanh, tốc độ (`/tra-cuu-nhanh/toc-do`) | Loại xe: Ô tô; tốc độ cho phép `60`; tốc độ đo được `75` (vượt 15 km/h) |
| 1.5 | Tra cứu nhanh, biển báo | `P.127` |
| 1.6 | Hỏi trợ lý AI (khi có key) | `Người điều khiển xe ô tô có nồng độ cồn trong hơi thở bị xử phạt thế nào?` |
| 5.3 | Tên nhóm mới | `Ôn thi tháng 10, Đội 1` |
| 5.5 | Đề ôn tập chia sẻ vào nhóm | Chủ đề "Giấy phép lái xe", 5 câu, tên `Đề ôn giấy phép lái xe` |

---

## 3. Kịch bản chính (45 phút)

Mỗi bước ghi: hồ sơ Chrome, thao tác, lời dẫn (gợi ý, nói theo cách của mình), điều người xem phải thấy.

### Bước 0. Mở đầu (2 phút) · Hồ sơ A

**Thao tác:** mở `/` của `canbo.d1.01`.

**Lời dẫn:**
> Hệ thống gồm bốn phần trên một ứng dụng web: tra cứu văn bản và quy định nghiệp vụ, học bài giảng, luyện tập và thi, trò chơi nghiệp vụ. Cán bộ dùng trên máy tính hoặc cài lên điện thoại. Cán bộ quản lý giao bài và xem báo cáo trên cùng ứng dụng.
>
> Dữ liệu hôm nay là dữ liệu mẫu chạy trên máy này. Tên người, đơn vị là giả định. Nội dung trò chơi và một phần câu hỏi được duyệt tự động để chạy thử, chưa qua đơn vị chuyên môn đối chiếu. Hệ thống thật chỉ hiện cho cán bộ những nội dung đã duyệt.

**Người xem thấy:** trang chủ với lối vào các phần, nút "Chơi ngay".

### Bước 1. Tra cứu (5 phút) · Hồ sơ A

| # | Thao tác | Lời dẫn | Người xem thấy |
|---|---|---|---|
| 1.1 | Ô tìm kiếm ở đầu trang, gõ `nồng độ cồn` (hoặc `kế hoạch thử nghiệm`) | Tìm trong toàn văn các văn bản có trong kho, trả về đến điều, khoản | Danh sách kết quả, mỗi kết quả trỏ tới điều cụ thể |
| 1.2 | Mở một kết quả | Văn bản đọc theo mục lục; mỗi điều có nút sao chép trích dẫn đúng chuẩn | Mục lục, nội dung điều, thời điểm áp dụng, nút sao chép trích dẫn |
| 1.3 | Bấm sao chép trích dẫn, dán vào Notepad | Trích dẫn ghi đủ điểm, khoản, điều, số hiệu văn bản, dùng thẳng trong biên bản | Chuỗi trích dẫn đầy đủ |
| 1.4 | Mở `/tra-cuu-nhanh`, chọn tốc độ. Loại xe Ô tô, tốc độ cho phép 60, tốc độ đo được 75 | Tra cứu nhanh dành cho tình huống ngoài đường: nhập số đo, ra khung phạt và căn cứ | Khung phạt và căn cứ của dòng tương ứng |
| 1.5 | Quay lại `/tra-cuu-nhanh`, chọn biển báo, tìm `P.127` | Biển báo có hình, ý nghĩa và cách xử lý đúng | Hình biển P.127 và giải thích |
| 1.6 | (Chỉ khi có key AI) mở `/hoi-dap`, hỏi câu ở mục 2.4 | Trợ lý chỉ trả lời từ văn bản trong kho và dẫn điều khoản; kho chưa có căn cứ thì trả lời là chưa có căn cứ, không suy đoán | Câu trả lời kèm thẻ căn cứ |

Không có key AI thì bỏ 1.6. Nếu người xem hỏi, mở `/hoi-dap`: trang báo "Hỏi đáp AI chưa được cấu hình trên máy chủ này", không đưa câu trả lời giả.

**Lưu ý khi nói:** mức phạt, biển báo trong bản demo là bản nháp duyệt tự động; trên hệ thống thật, pháp chế duyệt từng dòng (xem bước 7d).

### Bước 2. Học bài giảng (5 phút) · Hồ sơ A

| # | Thao tác | Lời dẫn | Người xem thấy |
|---|---|---|---|
| 2.1 | Mở `/hoc` | Bài giảng xếp theo chuyên đề: hệ thống pháp luật, phương tiện và người lái, tuần tra kiểm soát, xử lý vi phạm… | Danh mục chuyên đề |
| 2.2 | Mở chuyên đề "Phương tiện và người điều khiển phương tiện…", bài "Giấy tờ người lái xe phải mang theo và kiểm tra qua tài khoản định danh" | Mỗi bài nêu mục tiêu, nội dung và khối căn cứ trích nguyên văn | Bài học có khối căn cứ, nhân vật đồng hành |
| 2.3 | Chuyển sang chế độ slide | Cùng một bài dùng được cho buổi sinh hoạt chuyên đề tại đội | Bài ở dạng slide |
| 2.4 | Cuộn tới kiểm tra cuối bài, làm 1–2 câu | Học xong làm kiểm tra ngắn; kết quả vào tiến độ học | Phản hồi đúng sai, giải thích |

**Chuyển ý:** "Nội dung bài này cũng là nội dung của trò Kiểm tra giấy tờ ở bước 4."

### Bước 3. Luyện tập và thi (5 phút)

**Luyện tập · Hồ sơ A**

| # | Thao tác | Lời dẫn | Người xem thấy |
|---|---|---|---|
| 3.1 | Mở `/luyen-tap`, chọn chủ đề "Giấy phép lái xe" | Luyện tập theo chủ đề, không giới hạn số lần | Danh sách chủ đề, các thẻ luyện tập |
| 3.2 | Trả lời 2 câu, cố ý sai 1 câu | Mỗi câu có giải thích và căn cứ ngay sau khi trả lời | Phản hồi đúng sai kèm căn cứ |
| 3.3 | Chỉ nút "Nói đáp án" (Chrome) | Trả lời bằng giọng nói khi đang trực | Nút micro |

**Thi · Hồ sơ B (`canbo.d2.01`)**

| # | Thao tác | Lời dẫn | Người xem thấy |
|---|---|---|---|
| 3.4 | Mở `/thi`, mở đề đã giao trước buổi demo (mục 2.2), bắt đầu làm | Đề do quản trị soạn theo ma trận chủ đề, mức độ; giao cho đơn vị, có hạn, giới hạn số lượt | Đồng hồ 30 phút, lưới 30 câu |
| 3.5 | Làm 3–4 câu, chuyển câu bằng lưới | Mỗi câu lưu ngay khi chọn; tải lại trang hay mất mạng rồi mở lại vẫn thấy đúng câu đã chọn | Ô đã làm đổi màu trên lưới |
| 3.6 | Bấm "Nộp bài" | Nộp khi còn câu chưa làm thì hệ thống hỏi lại | Hộp xác nhận: "Còn … câu chưa trả lời; các câu này tính là sai." |
| 3.7 | Xác nhận nộp | Chấm trên máy chủ, ra kết quả ngay | Điểm, từng câu đúng sai |

`canbo.d2.01` còn 1 lượt sau bước này. Người xem muốn thử thì đưa tài khoản `canbo.d3.01`.

### Bước 4. Trò chơi nghiệp vụ (8 phút) · Hồ sơ A

**Lời dẫn chung:**
> Trò chơi không phải trắc nghiệm. Cán bộ soi giấy tờ, vuốt, đóng dấu, khoanh vùng, kéo thả như khi làm việc thật. Máy chủ chấm điểm; cuối lượt có giải thích từng lỗi kèm căn cứ. Mỗi trò có 5 màn, qua màn trước mới mở màn sau.

| # | Thao tác | Lời dẫn | Người xem thấy |
|---|---|---|---|
| 4.1 | Mở `/tro-choi` | 14 trò đang bật trong bản demo | Lưới biểu tượng trò chơi |
| 4.2 | Chạm **Kiểm tra giấy tờ** → "Màn 1". Với người lái đầu: chạm giấy tờ để phóng to, chạm dòng sai, "Xong", đóng dấu "Giữ lại". Người lái sau giấy tờ đúng: "Cho qua" | Đối chiếu giấy phép lái xe, đăng ký xe, bảo hiểm của từng người lái | Giấy tờ phóng to, dòng đánh dấu, dấu đóng |
| 4.3 | Chơi hết hoặc tới màn kết quả | Kết quả giải thích từng chỗ sai | Sao, danh sách lỗi, căn cứ |
| 4.4 | Quay lại, chạm **Duyệt hồ sơ phạt nguội** → "Màn 1". Hồ sơ đủ căn cứ: vuốt trái. Hồ sơ thiếu thời điểm (PN-05) hoặc ảnh mờ (PN-08): chạm chỗ thiếu rồi vuốt phải | Duyệt hồ sơ camera trước khi gửi thông báo vi phạm | Thẻ hồ sơ, vuốt trái phải |
| 4.5 | Chạm **Tái dựng hiện trường** → "Màn 1" (TD-01). Đọc dấu vết; tab "Dựng xe": đặt xe A ở x 12 m, y 64 m, hướng bắc, tốc độ "Rất nhanh", hành động "Phanh gấp"; bấm "Mô phỏng". Tab "Kết luận": kéo thẻ "Chạy quá tốc độ" vào xe A, "Chốt kết luận" | Kéo xe về vị trí ban đầu theo dấu vết, cho mô phỏng chạy để kiểm chứng, rồi kết luận lỗi | Vết mô phỏng phủ lên dấu vết thật, bảng so sánh lệch bao nhiêu mét |
| 4.6 | (Nói) Chọn "Nhanh" thay vì "Rất nhanh" thì xe dừng trước rào | Độ dài vết phanh cho biết tốc độ | |

Nếu thời gian còn, mở thêm một trong các trò (lời giải sẵn ở [DEMO.md](DEMO.md) mục 7):

| Trò | Tình huống nên chọn |
|---|---|
| Trạm cân tải trọng | Màn 1: xe đúng bằng giới hạn (TC-02, cho đi), vượt đúng 10% (TC-04, hạ tải), vượt 10,1% (TC-07, lập biên bản) |
| Dựng chốt an toàn ban đêm | CD-01 (chốt mét 160, làn phải), bố trí đủ 100 điểm: biển ở mét 60 và 110 lề phải; 6 cọc làn phải mét 130, 135 … 155; đèn lề phải mét 128; hai chiến sĩ làn phải mét 162, 166 |
| Soi camera | Màn 1: "Bắt đầu xem", thấy xe vi phạm thì "Dừng hình", khoanh xe, kéo thẻ lỗi |
| Lên xe khách | XK-04 (đúng bằng số chỗ, không vượt) rồi XK-06 (hành lý ở lối đi dễ đếm nhầm) |
| Tự lái qua phố | Màn 1: đi thẳng khi đèn đỏ trong 13 giây đầu, chạy quá 40 km/h; cuối lượt có biên bản, chạm lỗi để tua lại |

Thứ tự hồ sơ, xe trong một lượt có thể khác lần diễn tập. Không gặp đúng tình huống đã định thì nói theo tình huống đang hiện.

**Lưu ý khi nói:** nội dung trò chơi là dữ liệu demo; số tiền, ngưỡng tải trọng, thời gian lái là số minh họa. Danh sách điểm cần đơn vị chuyên môn đối chiếu ở [GAME_DESIGN.md](GAME_DESIGN.md) mục 5.

### Bước 5. Theo dõi cá nhân, thi đua, nhóm học cùng (5 phút)

| # | Hồ sơ | Thao tác | Lời dẫn | Người xem thấy |
|---|---|---|---|---|
| 5.1 | A | Mở `/toi` | Mỗi cán bộ thấy lịch sử, câu sai cần ôn, huy hiệu, điểm mạnh và điểm yếu theo chủ đề | Lịch sử, câu sai, huy hiệu, hồ sơ chủ đề |
| 5.2 | A | Mở `/bang-xep-hang`, rồi tab "Mùa giải" | Thi đua giữa các đội theo tuần, chia hạng, lên hạng xuống hạng. Số hạng, cỡ nhóm, số lên/xuống là đề xuất, chờ phòng chốt | Bảng xếp hạng; tab Mùa giải trống cho tới khi quản trị tạo mùa (7e) |
| 5.3 | A | Mở **Học → Nhóm học cùng**, "Tạo nhóm", tên `Ôn thi tháng 10, Đội 1`, "Sao chép liên kết mời" | Cán bộ tự lập nhóm ôn cùng nhau, kể cả khác đội | Mã mời, liên kết mời |
| 5.4 | B | Dán liên kết mời, "Tham gia nhóm" | Thành viên chỉ thấy họ tên và phần trăm hoàn thành của nhau, không thấy điểm | Trang tham gia nêu rõ phạm vi chia sẻ |
| 5.5 | A | Trong nhóm, "Chia sẻ vào nhóm" → "Đề ôn tập", chủ đề "Giấy phép lái xe", 5 câu, tên `Đề ôn giấy phép lái xe` | Trưởng nhóm chia sẻ bài học, đề ôn; đặt hạn gợi ý | Mục mới trong nhóm |
| 5.6 | A | Trong nhóm vừa tạo, bấm "Cổ vũ" ở dòng của B | Thành viên cổ vũ nhau; cổ vũ không cộng điểm kinh nghiệm | Số lượt cổ vũ |

### Bước 6. Cán bộ quản lý (3 phút) · Hồ sơ C (`quanly.doi1`)

| # | Thao tác | Lời dẫn | Người xem thấy |
|---|---|---|---|
| 6.1 | `/quan-tri/bao-cao`, tab "Cán bộ" (mở sẵn) | Đội trưởng thấy từng cán bộ trong đội: bài học, luyện tập, bài thi, lần học gần nhất; bấm tên mở hồ sơ chi tiết | Mỗi cán bộ Đội 1 một dòng |
| 6.2 | Bấm "Tải Excel", rồi "Tải PDF" | Xuất báo cáo nộp cấp trên | Hai tệp tải về |
| 6.3 | `/quan-tri/nhom`, mở nhóm vừa tạo ở bước 5 | Quản lý chỉ thấy cán bộ thuộc đơn vị mình: Đội trưởng Đội 1 thấy A, không thấy B (Đội 2) | 1 người trong phạm vi, 1 người ngoài phạm vi |
| 6.4 | `/quan-tri/giao-bai` | Giao đề thi, bài học cho đội, có hạn | Danh sách bài đã giao |

### Bước 7. Quản trị (8 phút) · Hồ sơ D (`quantri`)

**7a. Nhập người dùng từ Excel**

| # | Thao tác | Người xem thấy |
|---|---|---|
| 1 | `/quan-tri/nguoi-dung`, mục "Nhập danh sách từ Excel", chọn `docs/demo/demo-nhap-nguoi-dung.xlsx`, **để nguyên ô "Chạy thử"**, nhập | 4 dòng hợp lệ; dòng 6, 7, 8 báo lỗi kèm lý do (mục 2.3) |
| 2 | Bỏ chọn "Chạy thử", nhập lại | 4 tài khoản được tạo, mỗi người một mật khẩu tạm |
| 3 | (Nói) | Dòng lỗi không chặn dòng đúng. Người mới phải đổi mật khẩu tạm ở lần đăng nhập đầu. Vai trò biên tập, pháp chế, quản trị cấp riêng từng người, không cấp qua tệp |

**7b. Ngân hàng câu hỏi: nhập và duyệt**

| # | Thao tác | Người xem thấy |
|---|---|---|
| 1 | `/quan-tri/cau-hoi/moi`, soạn một câu theo [DU-LIEU-MAU-DEMO.md](DU-LIEU-MAU-DEMO.md) mục D2, "Lưu nháp" rồi "Gửi duyệt" | Câu vào trạng thái **chờ duyệt** |
| 2 | Lọc câu chờ duyệt, mở câu vừa soạn, bấm "Duyệt" | Câu chuyển sang đã duyệt; chỉ câu đã duyệt mới vào luyện tập, đề thi |
| 3 | (Nói) | Câu nhập từ tệp Excel cũng qua cùng luồng duyệt. Nút "Sinh bằng AI" cần key AI và Redis, bản demo không chạy |

**7c. Đề thi**

`/quan-tri/de-thi`, mở đề đã soạn trước buổi demo (mục 2.2): ma trận theo chủ đề và mức độ, thời gian, số lượt tối đa. Không sửa đề đang giao.

**7d. Nội dung trò chơi và dữ liệu tra cứu**

| # | Thao tác | Lời dẫn |
|---|---|---|
| 1 | `/quan-tri/noi-dung-tro-choi` | Mỗi tình huống của trò chơi đi qua cùng quy trình duyệt như câu hỏi: biên tập soạn, pháp chế duyệt, quản trị bật tắt trò |
| 2 | Mở `/quan-tri/noi-dung-tro-choi/moi`, chọn trò "Tái dựng hiện trường" hoặc "Cắm biển cho tuyến đường" | Biên tập viên soạn tình huống mới bằng trình soạn có nút "Chơi thử" |
| 3 | `/quan-tri/du-lieu-tra-cuu`, tab Mức phạt | Mức phạt, biển báo, quy trình, tải trọng được duyệt từng dòng; dòng nháp không hiện cho cán bộ |

**7e. Mùa giải (tùy thời gian)**

`/quan-tri/mua-giai`: cấu hình hạng, cỡ nhóm, số lên/xuống, trần XP; nút "Chốt ngay các tuần đã tới hạn".

### Bước 8. Điện thoại và offline (3 phút, tùy chọn)

Chiếu màn hình điện thoại (cáp hoặc ứng dụng chiếu), đã chuẩn bị ở mục 1.2.

1. Mở ứng dụng đã cài từ màn hình chính: giao diện điện thoại, thanh điều hướng dưới.
2. Mở **Luyện tập → Luyện tập không cần mạng**, chủ đề đã tải.
3. **Bật chế độ máy bay**, làm 2–3 câu.
4. Tắt chế độ máy bay: kết quả tự gửi lên máy chủ và được chấm lại.

**Lời dẫn:** "Cán bộ ở chốt, trên tuyến không có sóng vẫn học được; trò chơi cũng tải về chơi offline được."

### Bước 9. Kết (1 phút)

> Tóm tắt: tra cứu có căn cứ, học, luyện tập và thi có chấm tự động, trò chơi nghiệp vụ, báo cáo theo đơn vị. Các điểm cần phòng quyết định hoặc cung cấp: (1) đơn vị chuyên môn đối chiếu nội dung trò chơi và mức phạt; (2) các con số thi đua (điểm từng việc, ngưỡng cấp, huy hiệu); (3) tài liệu nghiệp vụ nội bộ cho các trò dừng xe, dựng chốt, xử lý tai nạn.

---

## 4. Câu hỏi thường gặp

| Câu hỏi | Trả lời |
|---|---|
| Mức phạt, biển báo lấy từ đâu, có đúng không? | Từ văn bản trong kho. Bản demo dùng bản nháp duyệt tự động để chạy thử. Hệ thống thật chỉ hiện dòng đã được pháp chế duyệt, kèm căn cứ tới điều, khoản. |
| Văn bản sửa đổi thì sao? | Văn bản lưu theo phiên bản và thời điểm áp dụng; dòng tra cứu, câu hỏi gắn căn cứ. Sửa một dòng dữ liệu thì dòng đó về chờ duyệt; ví dụ sửa một giới hạn tải trọng thì các xe dùng giới hạn đó rời trò Trạm cân cho tới khi duyệt lại. |
| AI có trả lời sai, bịa căn cứ không? | Trợ lý chỉ trả lời từ văn bản trong kho và kèm căn cứ. Kho không có căn cứ thì trả lời là chưa có căn cứ. Câu hỏi do AI sinh vẫn phải qua duyệt. |
| Không có mạng có dùng được không? | Cài ứng dụng lên điện thoại, tải chủ đề luyện tập, trò chơi về máy. Kết quả gửi lên và chấm lại khi có mạng. |
| Cán bộ có gian lận điểm được không? | Điểm chấm trên máy chủ; trò mô phỏng được máy chủ chạy lại từ nhật ký thao tác. Chơi lặp trong ngày nhận điểm giảm dần. |
| Ai thấy được dữ liệu của ai? | Cán bộ thấy dữ liệu của mình. Thành viên nhóm chỉ thấy họ tên, phần trăm, lượt cổ vũ. Quản lý thấy cán bộ trong đơn vị mình và đơn vị cấp dưới. |
| Thêm cán bộ hàng loạt thế nào? | Nhập Excel theo mẫu (bước 7a), có chạy thử trước. |
| Đăng nhập bằng tài khoản khác được không? | Hệ thống có đăng nhập bằng Google khi cấu hình `GOOGLE_CLIENT_ID`; bản demo không bật. |
| Trò chơi nào còn chờ? | Danh sách và các câu chờ quyết định ở [PRD.md](PRD.md) mục V và [GAME_DESIGN.md](GAME_DESIGN.md) mục 8. Dừng xe đúng quy trình và Lập biên bản đã có mã nhưng đang tắt trong bản demo. |

Câu nào chưa trả lời chắc chắn được thì ghi lại, hẹn trả lời bằng văn bản. Không hứa thời hạn ngay trong buổi demo.

---

## 5. Sự cố và phương án dự phòng

| Sự cố | Xử lý trong lúc trình bày |
|---|---|
| Web hoặc API dừng | Ctrl+C, chạy `bun run demo --nhanh --khong-build` (khoảng 30 giây). Trong lúc chờ, nói tiếp phần hỏi đáp |
| "Không bật được Postgres" | Mở Docker Desktop, chờ "Engine running", chạy lại lệnh trên |
| Đường hầm không lên, điện thoại không mở được | Bỏ bước 8, hoặc dùng địa chỉ `http://192.168.x.x:3080` cùng Wi-Fi (xem được giao diện, không thử offline) |
| Mất mạng Internet | Bản demo chạy trên máy, vẫn dùng được. Mất hỏi đáp AI và đường hầm |
| Một trò chơi lỗi hoặc tình huống khó | Chuyển sang trò khác trong bảng bước 4 |
| Lỡ làm hỏng dữ liệu | Sau buổi: `bun run demo --lam-lai`. Trong buổi: đổi sang tài khoản khác cùng vai |
| Máy trình chiếu hỏng hẳn | Mở [huong-dan-su-dung.pdf](../apps/web/public/tai-lieu/huong-dan-su-dung.pdf) và ảnh chụp màn hình ở `apps/web/public/tai-lieu/huong-dan/anh/` trên máy khác |

---

## 6. Bản rút gọn 20 phút

| Phút | Phần | Bước |
|---|---|---|
| 0–1 | Mở đầu | 0 |
| 1–4 | Tìm kiếm, đọc văn bản, tra cứu nhanh mức phạt | 1.1, 1.2, 1.4 |
| 4–6 | Một bài giảng | 2.2 |
| 6–9 | Thi: làm 3 câu, nộp, xem kết quả | 3.4–3.7 |
| 9–14 | Kiểm tra giấy tờ, Tái dựng hiện trường | 4.1–4.5 |
| 14–16 | Trang Tôi, mùa giải | 5.1, 5.2 |
| 16–19 | Báo cáo của quản lý; nhập người dùng Excel | 6.1, 7a |
| 19–20 | Kết | 9 |

---

## 7. Sau buổi demo

1. Ctrl+C tắt API, web và đường hầm. Người có đường dẫn đường hầm mở được bản demo cho tới khi tắt.
2. Ghi lại câu hỏi, góp ý của người xem.
3. Dựng lại dữ liệu sạch cho buổi sau: `bun run demo --lam-lai`.
4. Tắt Postgres nếu không dùng: `docker compose -f infra/docker-compose.yml stop`.
