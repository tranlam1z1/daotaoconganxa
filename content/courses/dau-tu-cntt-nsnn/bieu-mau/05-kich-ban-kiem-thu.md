---
course: dau-tu-cntt-nsnn
kind: bieu_mau
slug: kich-ban-kiem-thu
title: Kịch bản kiểm thử phần mềm nội bộ và kế hoạch vận hành thử
as_of: 2026-09-06
status: draft
review_state: cho_phap_che_duyet
---

# Kịch bản kiểm thử và kế hoạch vận hành thử

> **Căn cứ tại ngày:** 06/9/2026 · **Trạng thái:** bản nháp, chờ pháp chế duyệt.
>
> **CẢNH BÁO HIỆU LỰC.** Biểu mẫu dựng theo Điều 22 Nghị định số 45/2026/NĐ-CP — văn bản áp dụng cho **dự án chuyển tiếp**. Với dự án khởi động sau ngày 01/7/2026, điều tương ứng là **Điều 55 Nghị định số 224/2026/NĐ-CP**, và nội dung chi tiết về kiểm thử được quy định tại **Thông tư số 41/2026/TT-BKHCN**. `[CẦN ĐỐI CHIẾU: nội dung chi tiết Thông tư số 41/2026/TT-BKHCN về kiểm thử, vận hành thử, nghiệm thu]`

## 1. Phân biệt ba hoạt động dễ nhầm

Điều 22 Nghị định số 45/2026/NĐ-CP quy định ba hoạt động khác nhau, áp dụng cho đối tượng khác nhau. Nhầm lẫn giữa chúng là lỗi phổ biến nhất trong hồ sơ nghiệm thu.

| Hoạt động | Áp dụng cho | Tính chất | Căn cứ |
|-----------|-------------|-----------|--------|
| **Giám sát công tác triển khai** | Lắp đặt mạng, lắp đặt phần cứng, cài đặt phần mềm thương mại, kiểm tra hiệu chỉnh | Theo dõi quá trình thi công, xác nhận khối lượng và chất lượng lắp đặt | điểm a khoản 3 Điều 22 |
| **Kiểm thử** | **Bắt buộc** đối với hạng mục **phần mềm nội bộ** | Xác định phần mềm có đáp ứng yêu cầu đã đặt ra hay không; phát hiện lỗi | điểm a khoản 3 Điều 22 |
| **Vận hành thử** | **Toàn bộ sản phẩm của dự án**, trước khi nghiệm thu | Chạy thử trong điều kiện gần với thực tế; lập **báo cáo kết quả vận hành thử**; phải **vận hành thử lại** sau khi nhà thầu hoàn thiện | khoản 4 Điều 22 |

> **Khoản 4 Điều 22 Nghị định số 45/2026/NĐ-CP**: sản phẩm phải được vận hành thử trước khi nghiệm thu; kết quả lập thành báo cáo kết quả vận hành thử; phải vận hành thử lại sau khi nhà thầu hoàn thiện.

Với **dự án thuê dịch vụ công nghệ thông tin**, thay bằng: vận hành thử theo khoản 2 Điều 23, và **giám sát chất lượng dịch vụ công nghệ thông tin** trong suốt quá trình cung cấp theo khoản 3 Điều 23.

## 2. Kế hoạch kiểm thử tổng thể

| Mục | Nội dung | Ghi chú |
|-----|----------|---------|
| 2.1 | Phạm vi kiểm thử: các hạng mục phần mềm nội bộ thuộc phạm vi | điểm a khoản 3 Điều 22 |
| 2.2 | Đơn vị thực hiện kiểm thử và tính độc lập với đơn vị triển khai | Khuyến nghị nghiệp vụ; nên tách gói thầu để bảo đảm độc lập |
| 2.3 | Tài liệu đầu vào: mô tả yêu cầu kỹ thuật phần mềm nội bộ, thiết kế chi tiết, bảng kê trường hợp sử dụng | Điều 15 và Điều 14 Nghị định 45/2026/NĐ-CP |
| 2.4 | Các loại kiểm thử áp dụng | Xem mục 3 |
| 2.5 | Môi trường kiểm thử: cấu hình, dữ liệu mẫu, tài khoản theo từng vai trò | Nội dung nghiệp vụ |
| 2.6 | Tiêu chí bắt đầu và tiêu chí kết thúc kiểm thử | Nội dung nghiệp vụ; xem mục 6 |
| 2.7 | Quy trình ghi nhận, phân loại, xử lý và kiểm thử lại lỗi | Nội dung nghiệp vụ |
| 2.8 | Lịch kiểm thử theo từng nhóm chức năng | Nội dung nghiệp vụ |

## 3. Các loại kiểm thử

| Loại | Mục tiêu | Nguồn yêu cầu để lập ca kiểm thử |
|------|----------|----------------------------------|
| Kiểm thử chức năng | Từng trường hợp sử dụng chạy đúng luồng chính, luồng thay thế, luồng ngoại lệ | điểm c khoản 1 Điều 15: danh sách yêu cầu của người sử dụng |
| Kiểm thử quy trình nghiệp vụ đầu cuối | Toàn bộ quy trình nghiệp vụ chạy thông qua nhiều vai trò | điểm a khoản 1 Điều 15: quy trình nghiệp vụ |
| Kiểm thử phân quyền | Mỗi vai trò chỉ truy cập được đúng phạm vi được phép | điểm b khoản 1 Điều 15: đối tượng tham gia và mối liên hệ |
| Kiểm thử dữ liệu | Ràng buộc toàn vẹn, quy tắc kiểm tra dữ liệu đầu vào, kết quả chuyển đổi dữ liệu | điểm a khoản 2 Điều 15: yêu cầu về cơ sở dữ liệu |
| Kiểm thử an toàn thông tin | Xác thực, phân quyền, mã hóa, nhật ký, theo cấp độ an toàn được phê duyệt | điểm b khoản 2 Điều 15 |
| Kiểm thử hiệu năng | Thời gian phản hồi, số người dùng đồng thời, khối lượng dữ liệu | điểm c khoản 2 Điều 15 |
| Kiểm thử kết nối, liên thông | Trao đổi dữ liệu với hệ thống bên ngoài đúng chuẩn | Điều 4 Nghị định 45/2026/NĐ-CP |
| **Kiểm thử tính sẵn sàng với IPv6** | Hệ thống hoạt động được trên môi trường IPv6 hoặc có giải pháp nâng cấp | **điểm e khoản 2 Điều 15** |
| Kiểm thử cài đặt và khôi phục | Cài đặt từ đầu theo tài liệu; sao lưu và phục hồi thành công | điểm d khoản 2 Điều 15 |
| Kiểm thử tài liệu | Tài liệu hướng dẫn khớp với phần mềm thực tế | điểm b khoản 1 Điều 24 (danh mục tài liệu phải bàn giao) |

## 4. Biểu mẫu ca kiểm thử

| Trường | Nội dung |
|--------|----------|
| Mã ca kiểm thử | TC-<mã nhóm>-<số thứ tự>, ví dụ TC-N1-005 |
| Trường hợp sử dụng liên quan | Mã UC từ bảng kê chức năng |
| Yêu cầu người sử dụng liên quan | Mã YC từ danh sách yêu cầu |
| Loại kiểm thử | Theo mục 3 |
| Mức độ ưu tiên | Cao / Trung bình / Thấp |
| Vai trò thực hiện | Tác nhân từ danh sách tác nhân |
| Tiền điều kiện | Trạng thái hệ thống và dữ liệu trước khi thực hiện |
| Dữ liệu đầu vào | Cụ thể, có giá trị thật để chạy lại được |
| Các bước thực hiện | Đánh số từng bước, mô tả thao tác |
| Kết quả mong đợi | Cụ thể, kiểm chứng được, không mô tả chung chung |
| Kết quả thực tế | Điền khi chạy |
| Kết luận | Đạt / Không đạt / Không thực hiện được |
| Mã lỗi ghi nhận | Nếu không đạt |
| Người thực hiện, ngày | |

### Bảng ca kiểm thử

| Mã ca | UC | YC | Loại | Ưu tiên | Vai trò | Tiền điều kiện | Dữ liệu đầu vào | Các bước | Kết quả mong đợi | Kết quả thực tế | Kết luận | Mã lỗi |
|-------|----|----|------|---------|---------|----------------|-----------------|----------|------------------|-----------------|----------|--------|
| TC-N1-001 | | | | | | | | | | | | |

## 5. Biểu mẫu ghi nhận lỗi

| Trường | Nội dung |
|--------|----------|
| Mã lỗi | BUG-<số thứ tự> |
| Ca kiểm thử phát hiện | Mã TC |
| Mô tả lỗi | Ngắn gọn, một câu |
| Các bước tái hiện | Đánh số |
| Kết quả mong đợi và kết quả thực tế | |
| Mức nghiêm trọng | Nghiêm trọng / Nặng / Nhẹ / Góp ý |
| Ảnh hưởng nghiệp vụ | Mô tả hậu quả nếu lỗi tồn tại khi vận hành thật |
| Trạng thái | Mới / Đang xử lý / Đã sửa / Đã kiểm thử lại / Đóng / Không sửa |
| Người phát hiện, ngày | |
| Người xử lý, ngày sửa | |
| Kết quả kiểm thử lại | Đạt / Không đạt |

Quy ước mức nghiêm trọng:

| Mức | Định nghĩa |
|-----|------------|
| Nghiêm trọng | Hệ thống không dùng được, mất dữ liệu, sai kết quả tính toán, lộ dữ liệu, vượt quyền |
| Nặng | Một chức năng chính không dùng được nhưng có cách làm thay thế |
| Nhẹ | Ảnh hưởng trải nghiệm, sai chính tả trên giao diện, bố cục không thống nhất |
| Góp ý | Đề xuất cải tiến, không phải sai so với yêu cầu đã đặt ra |

## 6. Tiêu chí kết thúc kiểm thử

Đề xuất tiêu chí, chủ đầu tư quyết định và ghi vào hồ sơ mời thầu để ràng buộc nhà thầu:

- 100% ca kiểm thử mức ưu tiên Cao đã được thực hiện.
- Không còn lỗi mức **Nghiêm trọng** ở trạng thái mở.
- Không còn lỗi mức **Nặng** ở trạng thái mở, hoặc có phương án xử lý được chủ đầu tư chấp nhận bằng văn bản.
- 100% yêu cầu của người sử dụng được phủ bởi ít nhất một ca kiểm thử đã đạt.
- Đã kiểm thử tính sẵn sàng với IPv6 (điểm e khoản 2 Điều 15).
- Đã kiểm thử kết nối với từng hệ thống bên ngoài nêu trong thiết kế.
- Tài liệu hướng dẫn cài đặt, sử dụng, quản trị, vận hành khớp với phần mềm thực tế.

## 7. Kế hoạch vận hành thử

*Căn cứ: khoản 4 Điều 22 Nghị định số 45/2026/NĐ-CP.*

| Mục | Nội dung |
|-----|----------|
| 7.1 | Phạm vi vận hành thử: toàn bộ sản phẩm hay từng hạng mục |
| 7.2 | Thời gian vận hành thử và lý do chọn độ dài đó |
| 7.3 | Đơn vị và người dùng tham gia; số lượng theo từng vai trò |
| 7.4 | Dữ liệu sử dụng: dữ liệu thật, dữ liệu đã ẩn danh hóa hay dữ liệu mẫu |
| 7.5 | Kịch bản nghiệp vụ chạy trong thời gian vận hành thử |
| 7.6 | Cách ghi nhận sự cố và vướng mắc trong thời gian vận hành thử |
| 7.7 | Phương án chạy song song với quy trình thủ công (nếu có) |
| 7.8 | Tiêu chí kết thúc vận hành thử |
| 7.9 | **Kế hoạch vận hành thử lại** sau khi nhà thầu hoàn thiện |

### Biểu mẫu báo cáo kết quả vận hành thử

Khoản 4 Điều 22 Nghị định số 45/2026/NĐ-CP yêu cầu lập **báo cáo kết quả vận hành thử**. Cấu trúc đề xuất:

| Mục | Nội dung |
|-----|----------|
| I | Thông tin chung: tên dự án, hạng mục, thời gian vận hành thử, đơn vị tham gia |
| II | Phạm vi và kịch bản đã chạy |
| III | Thống kê khối lượng đã xử lý trong thời gian vận hành thử |
| IV | Danh sách sự cố, vướng mắc phát sinh và cách xử lý |
| V | Đánh giá theo từng tiêu chí kết thúc vận hành thử |
| VI | Kết luận: đạt hay chưa đạt |
| VII | Nếu chưa đạt: nội dung nhà thầu phải hoàn thiện và **kế hoạch vận hành thử lại** |
| VIII | Ký xác nhận của chủ đầu tư, nhà thầu, đơn vị sử dụng |

## 8. Ví dụ áp dụng — nhóm chức năng N1 của dự án ví dụ

Dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh", nhóm chức năng N1 "Tiếp nhận đề xuất nhiệm vụ khoa học và công nghệ trực tuyến", 6 trường hợp sử dụng.

| Mã ca | UC | Loại | Ưu tiên | Vai trò | Tiền điều kiện | Dữ liệu đầu vào | Kết quả mong đợi |
|-------|----|------|---------|---------|----------------|-----------------|------------------|
| TC-N1-001 | UC-01 Đăng ký tài khoản | Chức năng | Cao | Tổ chức đề xuất | Chưa có tài khoản | Thông tin tổ chức hợp lệ | Tài khoản được tạo, nhận thư kích hoạt |
| TC-N1-002 | UC-01 | Dữ liệu | Cao | Tổ chức đề xuất | Chưa có tài khoản | Mã số thuế đã tồn tại trong hệ thống | Hệ thống báo lỗi trùng, không tạo tài khoản |
| TC-N1-003 | UC-02 Khai phiếu đề xuất | Chức năng | Cao | Tổ chức đề xuất | Đã đăng nhập | Phiếu đề xuất đầy đủ trường bắt buộc | Lưu nháp thành công, hiển thị trong danh sách nháp |
| TC-N1-004 | UC-02 | Dữ liệu | Cao | Tổ chức đề xuất | Đã đăng nhập | Bỏ trống trường bắt buộc "Tên nhiệm vụ" | Hệ thống chặn lưu, chỉ rõ trường thiếu |
| TC-N1-005 | UC-03 Đính kèm và ký số | Chức năng | Cao | Tổ chức đề xuất | Có phiếu nháp hợp lệ, có chứng thư số | Tệp thuyết minh định dạng cho phép | Ký số thành công, chữ ký kiểm tra được |
| TC-N1-006 | UC-03 | An toàn thông tin | Cao | Tổ chức đề xuất | Có phiếu nháp | Chứng thư số đã hết hạn | Hệ thống từ chối ký, thông báo lý do |
| TC-N1-007 | UC-04 Nộp hồ sơ | Quy trình đầu cuối | Cao | Tổ chức đề xuất | Hồ sơ đã ký số | Nộp hồ sơ | Cấp số tiếp nhận, gửi thông báo, trạng thái chuyển sang Đã tiếp nhận |
| TC-N1-008 | UC-05 Tra cứu trạng thái | Chức năng | Trung bình | Tổ chức đề xuất | Đã nộp hồ sơ | Số tiếp nhận | Hiển thị đúng trạng thái và lịch sử xử lý |
| TC-N1-009 | UC-06 Yêu cầu bổ sung | Quy trình đầu cuối | Cao | Chuyên viên quản lý nhiệm vụ | Hồ sơ ở trạng thái Đã tiếp nhận | Nội dung yêu cầu bổ sung | Trạng thái chuyển sang Chờ bổ sung, tổ chức nhận được thông báo |
| TC-N1-010 | UC-01 đến UC-06 | Phân quyền | Cao | Tổ chức đề xuất | Đã đăng nhập | Truy cập hồ sơ của tổ chức khác | Hệ thống từ chối, ghi nhật ký truy cập trái phép |
| TC-N1-011 | UC-04 | Hiệu năng | Cao | 300 người dùng đồng thời | Hệ thống hoạt động bình thường | 300 phiên nộp hồ sơ đồng thời | Thời gian phản hồi trung bình dưới 3 giây |
| TC-N1-012 | UC-04 | IPv6 | Cao | Tổ chức đề xuất | Truy cập qua mạng IPv6 | Nộp hồ sơ | Hoàn thành nộp hồ sơ bình thường trên IPv6 |

Ca TC-N1-011 và TC-N1-012 lấy trực tiếp từ bảng yêu cầu phi chức năng của dự án ví dụ: đáp ứng đồng thời 300 người dùng với thời gian phản hồi dưới 3 giây; và yêu cầu về tính sẵn sàng với IPv6 theo điểm e khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP.

## 9. Danh mục tự kiểm tra

- [ ] Đã phân biệt đúng ba hoạt động: giám sát công tác triển khai, kiểm thử, vận hành thử (khoản 3, khoản 4 Điều 22).
- [ ] Hạng mục phần mềm nội bộ **có** kế hoạch kiểm thử (điểm a khoản 3 Điều 22).
- [ ] Mọi yêu cầu của người sử dụng đều có ít nhất một ca kiểm thử.
- [ ] Có ca kiểm thử cho từng yêu cầu phi chức năng tại khoản 2 Điều 15, **đặc biệt là IPv6**.
- [ ] Có ca kiểm thử phân quyền cho từng vai trò.
- [ ] Có ca kiểm thử kết nối cho từng hệ thống bên ngoài.
- [ ] Có tiêu chí kết thúc kiểm thử được chủ đầu tư phê duyệt.
- [ ] Có kế hoạch vận hành thử và **kế hoạch vận hành thử lại** (khoản 4 Điều 22).
- [ ] Đã lập **báo cáo kết quả vận hành thử** trước khi nghiệm thu (khoản 4 Điều 22).
