## Mở trang quản trị

Tài khoản có quyền **Admin quản lý** trở lên mở **Duyệt dữ liệu tra cứu**, rồi chọn
**Nhập tài liệu, khung phạt**. Trang dùng chung đăng nhập và quyền kiểm duyệt của hệ thống.

## Đưa tài liệu vào vùng chờ

![Nhập tài liệu vào vùng chờ kiểm duyệt](anh:quan-tri-giao-thong-staging)

Người biên tập dùng công cụ nhập PDF/DOCX để tạo `manifest.json`, sau đó dán nội dung vào
ô **Nội dung manifest.json** và chọn **Đưa vào vùng chờ**. Mỗi lô tối đa 1.000 đoạn và 2 MB.
Tài liệu trùng được báo để tránh nhập lại. Dữ liệu trong vùng chờ chưa hiển thị cho người tra cứu.

Mở tài liệu trong danh sách để đọc các đoạn đã trích và những thông tin còn thiếu. Đối chiếu
nguyên bản, điều khoản, ngày áp dụng và các văn bản sửa đổi trước khi nhập bản ghi chuẩn hóa.
Ảnh trích từ tài liệu cần được ghép với đúng mã biển bằng kiểm tra thủ công.

## Soạn và duyệt khung phạt

Nhập bản ghi JSON đã biên tập vào **Bản ghi khung phạt JSON**, rồi chọn **Lưu bản nháp**.
Bản ghi phải có mã hành vi đã tồn tại, tình tiết, dữ kiện cần bổ sung, tiền phạt,
trừ điểm hoặc thời hạn tước GPLX nếu có, căn cứ và khoảng hiệu lực.

Chọn **Duyệt** sau khi đã đối chiếu đầy đủ. Hệ thống kiểm tra điều khoản và phiên bản văn bản
đã duyệt trong kho tại ngày bắt đầu hiệu lực. Thiếu căn cứ thì báo lỗi và giữ bản nháp.
**Ngừng công khai** đưa khung phạt khỏi kết quả tra cứu. Khi bản ghi vừa được người khác sửa,
tải lại trang để xem phiên bản mới trước khi duyệt.

## Quản lý nội dung và lịch sử

Liên kết **Quản lý biển báo, hành vi và lịch sử duyệt** mở CMS hiện có để soạn nội dung.
Thay đổi ngày áp dụng của biển báo cần được duyệt lại. Hệ thống giữ bản chụp trước khi sửa
hoặc xóa và lưu người thực hiện thao tác. Không coi các đoạn tự trích xuất là dữ liệu pháp luật
đã được xác minh; chưa đủ tình tiết thì ghi rõ thông tin cần bổ sung.
