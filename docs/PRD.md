# PRD — Hệ thống học tập, sát hạch và tra cứu nghiệp vụ ứng dụng trí tuệ nhân tạo

> **Tệp này mới chứa mục V.** PRD gốc do khách hàng gửi dưới dạng nội dung dán trực tiếp (xem [GAP_ANALYSIS.md](GAP_ANALYSIS.md), bảng đầu tài liệu), chưa có trong repo. Các mục I–IV và VI trở đi cần được dán vào đúng vị trí bên dưới; mục V ở đây **thay** danh sách 20 trò chơi của bản gốc.

*Mục I — Mục đích và phạm vi: chưa đưa vào repo.*

*Mục II — Kiến trúc: chưa đưa vào repo.*

*Mục III — Chức năng: chưa đưa vào repo.*

*Mục IV — Yêu cầu phi chức năng: chưa đưa vào repo.*

---

## V. Trò chơi

*Cập nhật ngày 27/9/2026. Thay danh sách 10 trò chơi ngày 25/9/2026 (vốn đã thay danh sách 20 trò của bản gốc). Thiết kế chi tiết ở [GAME_DESIGN.md](GAME_DESIGN.md); kế hoạch làm ở [PLAN.md](PLAN.md), các giai đoạn GĐ-T1 đến GĐ-T10.*

### V.1. Nguyên tắc chung

1. **Trò chơi là một cách luyện nghiệp vụ bằng thao tác**, không dùng dạng trắc nghiệm. Người chơi soi, đóng dấu, kéo thả, vuốt, giữ, lái, khoanh vùng như khi làm việc thật.
2. **Luật, mức phạt, biển báo, quy trình trong trò chơi lấy từ văn bản và dữ liệu tra cứu trong hệ thống**, và dẫn về điều khoản gốc. Chỗ chưa có căn cứ thì ghi rõ, không tự đặt.
3. **Trò chơi chỉ dùng nội dung đã duyệt.** Nội dung riêng của trò chơi đi qua cùng quy trình duyệt như câu hỏi. Dữ liệu mẫu đánh dấu "demo, chưa duyệt".
4. **Mỗi trò có nhiều màn, độ khó tăng dần**; mỗi lượt khoảng 2–5 phút, chơi được trên điện thoại.
5. **Chấm điểm trên máy chủ.** Trò mô phỏng được máy chủ chạy lại từ nhật ký thao tác. Lượt chơi offline được chấm lại khi đồng bộ.
6. **Mỗi trò có màn hướng dẫn ngắn và màn kết quả** giải thích từng lỗi sai kèm điều khoản căn cứ.

### V.2. Danh sách trò chơi

| # | Trò chơi | Người chơi làm gì | Offline |
|---|---|---|---|
| 1 | **Kiểm tra giấy tờ** | Soi giấy phép lái xe, đăng ký xe, bảo hiểm của từng người lái; đánh dấu chỗ không khớp; đóng dấu cho qua hoặc giữ lại | Có |
| 2 | **Phòng thoát hiểm pháp luật** | Mở khóa từng phòng bằng mật mã tìm được qua công cụ tra cứu và thư viện văn bản của hệ thống | Không (bản đầu) |
| 3 | **Cắm biển cho tuyến đường** | Đặt đúng biển báo vào đúng vị trí trên đoạn đường, rồi cho xe mô phỏng chạy thử | Có |
| 4 | **Dừng xe đúng quy trình** | Thực hiện từng thao tác dừng xe, kiểm tra giấy tờ, đo nồng độ cồn bằng chạm, kéo, giữ | Có |
| 5 | **Soi camera** | Xem hoạt cảnh camera, dừng hình đúng lúc vi phạm, khoanh vùng xe vi phạm | Có |
| 6 | **Điều phối ca trực** | Điều các tổ công tác xử lý sự việc trên bản đồ theo mức độ ưu tiên | Có |
| 7 | **Thành phố an toàn** | Dùng điểm từ mọi trò để xây khu phố chung của đơn vị; chỉ số tai nạn giảm dần | Không (trạng thái chung của đơn vị) |
| 8 | **Điều tiết giao lộ** | Vuốt để ra hiệu lệnh điều khiển luồng xe tại ngã tư | Có |
| 9 | **Tự lái qua phố** | Lái xe nhìn từ trên xuống; game ghi lỗi và xuất "biên bản" cuối lượt | Có |
| 10 | **Tái dựng hiện trường** | Kéo thả xe vào sơ đồ theo dấu vết, xem mô phỏng kiểm chứng, kết luận lỗi | Có |

### V.3. Lớp trò chơi hóa dùng chung

Áp dụng cho mọi trò chơi ở V.2 và cho luyện tập, thi, bài giảng:

- **Điểm kinh nghiệm (XP):** mỗi hành động được thưởng ghi một lần, không cộng trùng; lượt chơi lặp trong ngày nhận XP giảm dần.
- **Cấp độ:** tính từ tổng XP theo bảng ngưỡng.
- **Huy hiệu:** theo mốc, mỗi trò 1–2 huy hiệu riêng.
- **Chuỗi ngày học:** tính theo ngày giờ Việt Nam.
- **Hồ sơ điểm mạnh, điểm yếu theo chủ đề:** tổng hợp từ luyện tập, thi và trò chơi.
- **Điểm của đơn vị:** XP của thành viên thành điểm xây dựng cho khu phố chung ở trò Thành phố an toàn, chia theo quân số.

Các con số (XP từng việc, ngưỡng cấp, ngưỡng huy hiệu, trần điểm đơn vị) là đề xuất, chờ khách hàng chốt.

### V.4. Thay đổi so với danh sách ngày 25/9/2026

- Danh sách 10 trò ngày 25/9/2026 (Chốt tuần tra, Súng bắn tốc độ, Lập biên bản, Người vi phạm nói gì?, Cung đường biển báo, Hiện trường, Bộ đàm, Lệnh trực hằng ngày, Đối đầu 1–1, Mùa giải đơn vị) **không còn là yêu cầu**. Thiết kế cũ lưu ở [luu-tru/GAME_DESIGN_cu.md](luu-tru/GAME_DESIGN_cu.md).
- Khung trò chơi chung đã làm (lượt chơi, chấm máy chủ, XP, duyệt nội dung, offline, hồ sơ chủ đề) giữ nguyên và dùng cho 10 trò mới.
- Các trò đã làm hoặc đang dở xử lý như sau (chờ khách hàng xác nhận, xem GAME_DESIGN §8 câu D1, D2):
  - *Trắc nghiệm nhanh*, *Súng bắn tốc độ*, *Cung đường biển báo*, *Hỏi nhanh bằng giọng nói*, *Đua thời gian*, *Ghép cặp lỗi – mức phạt*: ẩn khỏi trang Trò chơi, không xóa mã, không xóa dữ liệu.
  - *Vượt màn* chuyển sang mục Luyện tập, vì đáp ứng yêu cầu "chuỗi màn chơi, qua màn trước mới mở màn sau" ở mục III.
  - Phần chấm biên bản của *Lập biên bản* thành mô-đun "biên bản cuối lượt" dùng cho trò 1, 4, 5, 9, 10.
  - Luật tính điểm theo đơn vị của *Mùa giải đơn vị* dùng lại cho *Thành phố an toàn*.
  - Dữ liệu biển báo có phản ứng đúng (làm cho Cung đường biển báo) dùng lại cho trò 3 và 9.

### V.5. Trò chơi bổ sung (28/9/2026)

*Bổ sung cho 10 trò ở V.2, không thay thế. Áp dụng nguyên tắc V.1 và lớp trò chơi hóa V.3. Thiết kế chi tiết ở [GAME_DESIGN.md](GAME_DESIGN.md) §5.11 đến §5.21; kế hoạch làm ở [PLAN.md](PLAN.md), các giai đoạn GĐ-T11 đến GĐ-T20. Các điểm chờ quyết định ở GAME_DESIGN §8, câu D15 đến D32.*

| # | Trò chơi | Người chơi làm gì | Offline |
|---|---|---|---|
| 11 | **Duyệt hồ sơ phạt nguội** | Xem hồ sơ vi phạm do camera ghi lại; vuốt trái để gửi thông báo, vuốt phải để trả lại và chạm đúng chỗ hồ sơ còn thiếu | Có |
| 12 | **Trạm cân tải trọng** | Ghim số trên phiếu cân và trên giấy kiểm định, ước phần trăm vượt bằng thanh trượt, đóng dấu cho đi, hạ tải hoặc lập biên bản | Có |
| 13 | **Lên xe khách** | Chạm đếm người trên sơ đồ khoang xe, soi lệnh vận chuyển, phù hiệu, dữ liệu giám sát hành trình, đóng dấu, sắp các lỗi vào biên bản | Có |
| 14 | **Soi xe cải tạo** | Khoanh vùng chỗ xe khác giấy chứng nhận kiểm định trên hình xe, nối với dòng thông số, dùng thước đo khi cần | Có |
| 15 | **Dựng chốt an toàn ban đêm** | Kéo cọc tiêu, biển tạm, đèn, xe tuần tra, vị trí chiến sĩ lên đoạn đường; cho dòng xe mô phỏng chạy thử | Có |
| 16 | **Phân luồng khi có sự cố** | Đặt rào, biển hướng đi tạm, chiến sĩ điều tiết trên bản đồ khu phố; chạy mô phỏng lưu lượng và sửa trong lúc chạy | Có |
| 17 | **Truy vết xe bỏ trốn** | Chọn camera trên bản đồ, chạm đúng xe khớp mô tả trong từng đoạn cảnh, đặt điểm chặn | Có (chờ câu D24) |
| 18 | **10 phút đầu tại hiện trường** | Bảo vệ hiện trường, gọi cấp cứu, sơ cứu, đánh dấu dấu vết theo đúng thứ tự trên cảnh có đồng hồ | Có |
| 19 | **Tạm giữ phương tiện** | Kiểm đếm đồ vật và vết hư hỏng, lập danh mục, niêm phong, chọn thời hạn và nơi giữ | Có |
| 20 | **Bản đồ điểm đen** | Đọc lớp dữ liệu tai nạn giả lập, khoanh điểm đen, đặt biện pháp trong ngân sách, mô phỏng 12 tháng | Không (dữ liệu theo địa bàn, mô hình chạy ở máy chủ) |
