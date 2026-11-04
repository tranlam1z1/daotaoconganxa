# Bàn giao đợt 3 — Tra cứu

Phạm vi: Công chức, Viên chức, Đảng viên.

- Tra cứu văn bản gom theo tài liệu, đếm và phân trang trên toàn bộ kết quả SQL; không dùng tập kết quả RAG giới hạn để tính tổng. Tìm không dấu, số ký hiệu và Điều kèm số văn bản.
- Bộ lọc nhóm văn bản, loại, tình trạng, lĩnh vực, cơ quan, phạm vi, địa phương và ngày tra cứu; sắp xếp và bỏ từng điều kiện. Danh mục bộ lọc phản ánh kho tại ngày tra, không phải số kết quả của truy vấn đang chọn.
- Thuộc tính, nguồn gốc, phiên bản, quan hệ và so sánh dùng dữ liệu thực. Liên kết điều khoản và sao chép trích dẫn giữ ngày tra cứu. Nguồn thiếu được ghi rõ; chỉ mở URL HTTP/HTTPS hợp lệ.
- Văn bản Đảng có nhóm riêng và trạng thái ghi nhận, không tự suy luận hiệu lực theo luật. Chưa nạp bộ văn bản Đảng đã đối chiếu nguồn. Bản nháp không xuất hiện công khai.
- Quy trình/biểu mẫu có tổng kết quả và phân trang thực; thêm loại hành chính, nghiệp vụ, công tác Đảng. Hiện chỉ lọc từ khóa/loại do chưa có metadata lĩnh vực/nhóm đầy đủ.
- Chuyển sang hỏi đáp chỉ giữ từ khóa và ngày; chưa chuyển toàn bộ bộ lọc sang RAG.

## Áp dụng dữ liệu

Migration 0083 thêm nhóm văn bản; 0084 chỉ phân loại VBQPPL đã có cờ is_normative; 0085 mở rộng loại quy trình và giữ tương thích loại cũ. Đã kiểm tra trên CSDL kiểm thử cục bộ, chưa áp dụng môi trường thật. Trước triển khai cần sao lưu, rà nhóm chưa phân loại và chạy migration trong cửa sổ bảo trì. Khi cần phục hồi, ưu tiên bản sao lưu hoặc migration tiến; không sửa/xóa migration đã chạy.

## Kiểm chứng

Lệnh bun run test:tra-cuu sử dụng CSDL localhost riêng quydinhphapluat_dot3_test, không xóa kho xem thử. Kết quả: 277 kiểm thử đạt trên 28 tệp. Kiểm tra giao diện 320/390/768/1024 px không tràn ngang; mở thuộc tính, phiên bản, so sánh và liên kết điều khoản có ngày.

Bản xem thử: http://localhost:4190/tim-kiem — API 4191 dùng CSDL test.
