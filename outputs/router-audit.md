# Rà soát điều hướng — 28/10/2026

## Phạm vi và kết quả

- Đối chiếu 116 khai báo route, tệp nguồn, menu và lối tắt; quét 203 biểu thức liên kết/chuyển hướng trong mã ứng dụng. Những biểu thức ghép query động được đối chiếu thủ công.
- Gửi yêu cầu HTTP tới 64 đường dẫn tĩnh bằng phiên khách: không có HTTP 404 hoặc 5xx. 33 đường dẫn chuyển tới đăng nhập theo phân quyền; 11 đường dẫn trả 410 có chủ đích.
- Kiểm tra trình duyệt thực ở desktop và mobile: menu chính; đích quay lại sau đăng nhập; mở văn bản có thật trong kho rồi sang Thuộc tính/Phiên bản và Back; điều hướng tiếp sau 404; drawer mobile với Back/Forward. Cả 5 luồng đạt, không ghi nhận lỗi JavaScript.
- 39 kiểm thử qua 6 tệp đạt; kiểm tra TypeScript và Biome đạt.

## Các lỗi đã sửa

1. Trang lỗi 400/403/404/503 mất thanh điều hướng: dùng lại SiteHeader và SiteFooter để người dùng vẫn mở được trang khác.
2. Dịch vụ kiểm tra phiên lỗi tạm thời làm trang bảo vệ chuyển nhầm về đăng nhập: trả 503 có thông báo, giữ nguyên yêu cầu xác minh/phân quyền. Không dùng danh tính lưu trên header để cấp quyền.
3. Chuyển hướng /dao-tao sang /hoc và đường chấm tự luận cũ mang theo _routes/index của yêu cầu Single Fetch: dùng URL đã chuẩn hóa, giữ bộ lọc thật. Áp dụng tương tự cho chuyển trang danh sách duyệt dữ liệu.
4. Drawer có thể còn mở khi Back/Forward hoặc chuyển URL ngoài drawer: đóng ngăn và khôi phục cuộn khi vị trí điều hướng thay đổi.
5. Cập nhật hai kiểm thử cũ còn yêu cầu loại Dịch vụ công khỏi menu/trang chủ, trong khi giao diện hiện tại đã có mục này theo yêu cầu.

## Những URL đã ngừng cung cấp, không phải lỗi router

- `/cong-cu/coi-noi-thanh-thung`
- `/cong-cu/do-dac-dien-tu`
- `/cong-cu/loai-gplx`
- `/cong-cu/nong-do-con`
- `/cong-cu/qua-kho-hang-hoa`
- `/cong-cu/tinh-ngay-xu-ly`
- `/cong-cu/tinh-qua-tai`
- `/cong-cu/xac-dinh-tuoi`
- `/tra-cuu-nhanh/bien-bao`
- `/tra-cuu-nhanh/muc-phat`
- `/tra-cuu-nhanh/toc-do`

Các URL này giữ trạng thái 410 và nút quay lại danh mục; không khôi phục chức năng đã bị ngừng.

## Giới hạn

- Phiên HTTP và trình duyệt dùng cho lần rà soát này là phiên khách. Đã kiểm tra chuyển hướng đăng nhập và unit test trạng thái phiên, nhưng chưa xác nhận toàn bộ nghiệp vụ học/thi/quản trị với từng tài khoản thực tế.
- Một số route vẫn dùng PageStub: Hướng dẫn, bài hướng dẫn, Trường hợp ứng dụng, tiến độ/ôn tập/vá lỗi đào tạo. Route tồn tại nhưng nội dung chức năng chưa được triển khai; không thay thế bằng dữ liệu giả.
- Kiểm tra đường động dùng văn bản có thật trong kho và các kiểm thử phân giải route đại diện; không thử mọi ID trong cơ sở dữ liệu hoặc thực hiện thao tác ghi/xóa.
- Không thay đổi đường dẫn công khai, database hoặc nội dung pháp luật.

Dữ liệu chi tiết: [HTTP](router-http-audit.json), [trình duyệt](router-browser-audit.json).
