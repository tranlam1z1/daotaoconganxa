# Nhóm đối tượng học tập

Bước 1 đã bổ sung dữ liệu nhóm cho tài khoản và biểu mẫu tạo, sửa người dùng.
Quản trị viên có thể chọn đồng thời Công an cấp xã, Công chức cấp xã, Viên chức,
Đảng viên. Tài khoản cũ mặc định chưa gắn nhóm; không suy đoán từ vai trò hay đơn vị.

`accounts.nhom_doi_tuong` lưu các mã `cong_an_cap_xa`, `cong_chuc_cap_xa`,
`vien_chuc`, `dang_vien`. API tạo/sửa nhận `nhomDoiTuong`; khi sửa, bỏ trường
thì giữ nhóm hiện tại, gửi `[]` thì bỏ hết nhóm. Chỉ quản trị hệ thống được sửa,
theo quyền quản lý tài khoản hiện có. Thay đổi được ghi vào nhật ký.
Phiên đọc lại nhóm từ tài khoản ở mỗi yêu cầu; API danh tính trả `nhom_doi_tuong`.

Nhóm học tập không cấp quyền quản trị, không thay đổi phạm vi đơn vị và chưa
giới hạn quyền đọc chuyên đề. `courses.audience_group` (`khach_hang`, `tu_van`)
là phân loại có sẵn khác; không chuyển đổi trường đó thành nhóm tài khoản.

Bước 2 đã bổ sung `courses.nhom_hoc_tap` (migration 0077) và ô chọn nhiều nhóm
ở trang tạo/sửa chuyên đề. Trường `audience` cũ vẫn giữ nguyên. Khi cập nhật,
bỏ `nhomHocTap` thì giữ nhóm hiện tại; gửi `[]` thì bỏ phân nhóm chuyên đề.

Trang `/hoc` có bộ lọc theo từng nhóm, theo các nhóm của tài khoản hoặc tất cả.
Người đã được gắn nhóm mặc định xem theo nhóm của mình; người chưa gắn nhóm xem tất cả.
API danh mục nhận `nhom=cua_toi`, `tat_ca` hoặc một trong bốn mã nhóm.
`cua_toi` cần đăng nhập và đọc nhóm tài khoản từ máy chủ; tài khoản chưa có nhóm
không nhận chuyên đề khi chọn bộ lọc này.

Xuất bản bắt buộc chọn và lưu ít nhất một nhóm học tập. Quy tắc được kiểm ở API
xuất bản đơn lẻ và hàng loạt. Không thể xóa hết nhóm của chuyên đề đang xuất bản;
cần đưa về biên tập trước. Không bắt buộc lĩnh vực. Nội dung dùng chung cần chọn cả bốn nhóm.
Chuyên đề cũ có trạng thái xuất bản nhưng chưa gắn nhóm không hiện trong danh mục
và không đọc được qua các đường dẫn bài học công khai cho tới khi gắn nhóm.
Bộ lọc nhóm không giới hạn người học chỉ được đọc các nhóm của mình.

## Áp dụng

Chạy `bun run db:migrate` trên cơ sở dữ liệu đích trước khi chạy mã mới
(migration `0076_nhom_doi_tuong_tai_khoan.sql` và `0077_nhom_hoc_tap_chuyen_de.sql`). Sau đó mở Quản trị → Người dùng,
tạo hoặc sửa tài khoản, chọn nhóm và lưu. Migration đã được kiểm tra trên CSDL test;
việc triển khai lên môi trường dùng thật thực hiện riêng.

## Các bước tiếp theo

1. Rà soát, gắn nhóm cho nội dung cũ; mở trang riêng từng nhánh, nối câu hỏi và kỳ thi theo nhóm.
2. Cấp quyền quản lý theo nhánh và đơn vị; kiểm thử cách ly dữ liệu giữa các nhánh.
