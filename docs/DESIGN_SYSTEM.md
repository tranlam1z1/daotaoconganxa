# Hệ giao diện công vụ

Áp dụng ngày 28/10/2026 theo yêu cầu chuẩn hóa UI/UX của người dùng. Yêu cầu mới thay thế bảng màu xanh và các hướng dẫn typography cũ trong `docs/brand` và `VISUAL_STYLE.md`. Logo hiện có được giữ nguyên hình và màu; không sử dụng biểu trưng cơ quan chính thức mới.

## Mục tiêu và cấu trúc

Người dùng là cán bộ, công chức, viên chức và đảng viên, chủ yếu 30–60 tuổi. Ưu tiên đọc, tra cứu, học và xử lý công việc. Giữ nguyên route, loader, action, API, dữ liệu, xác thực và phân quyền. Không thêm thư viện.

Tra cứu: tiêu đề → bộ lọc → kết quả → phân trang. Học và thi: nội dung → tiến độ → hành động. Quản trị: nhóm điều hướng → số liệu → nội dung cần xử lý → bảng và biểu mẫu. Header nhận diện đỏ đô trên nền trắng, điều hướng xanh công vụ. Nền đặc và bóng nhẹ; hạn chế họa tiết trên nội dung. Logo gốc là tài sản nhận diện được bảo tồn.

## Token

| Vai trò | Màu sáng |
|---|---|
| Primary | `#A61C30` |
| Secondary / liên kết điều hướng | `#17618B` |
| Accent | `#C9A227` |
| Nền trang | `#F5F7FA` |
| Bề mặt | `#FFFFFF` |
| Chữ chính | `#243447` |
| Chữ phụ | `#64748B` |
| Chữ phụ cần đậm hơn | `#526277` |
| Viền | `#E2E8F0` |
| Thành công | `#16805D` |
| Cảnh báo | `#B7791F` |
| Chữ cảnh báo | `#8A5B18` |
| Lỗi | `#C62828` |

Vàng đồng chỉ là điểm nhấn, không làm chữ nhỏ trên nền trắng. Chữ cảnh báo dùng sắc đậm hơn màu cảnh báo gốc để đạt tương phản. Trạng thái luôn giữ nhãn chữ và biểu tượng hiện có. Chế độ tối có token riêng; không áp màu sáng cứng lên bề mặt tối.

Font giao diện và tiêu đề: **Be Vietnam Pro**, dự phòng Roboto, Segoe UI, sans-serif. Font được lưu cục bộ. Thân bài 16px; chú thích 13–14px; tiêu đề trang 24–28px. Vùng đọc pháp lý giữ cỡ và khoảng dòng riêng để đọc dài. Khoảng cách theo thang 4/8/12/16/24/32px. Nút và ô nhập bo 8px, card và modal 12px. Nút chính đỏ đô; nút phụ xanh trên nền trắng. Vùng chạm dùng chung tối thiểu 44px, focus có viền và khoảng cách rõ ràng.

## Thành phần và trạng thái

Tái sử dụng Button, Field/Input/Label/Notice, Card, Badge, PageHeader, KhungTrang, KhungNoiDung, HopThoai, KhungCho và EmptyState. Không thêm bộ component cạnh tranh. Select, textarea, bảng, modal và menu hiện có kế thừa token. KhungBang nhận focus để cuộn ngang bằng bàn phím. Phân trang tra cứu xuống dòng và có vùng chạm 44px.

| Trạng thái | Trigger / phản hồi / thao tác tiếp |
|---|---|
| Đang tải | Chuyển trang hoặc tra cứu; thanh tải, skeleton và aria-busy hiện có; chờ kết quả |
| Rỗng | Bộ lọc không khớp; thông báo rỗng; sửa bộ lọc |
| Lỗi | Không tải được dữ liệu hoặc URL không tồn tại; lỗi có nội dung; thử lại hoặc về trang chủ |
| Một phần | Dữ liệu nguồn chỉ có một phần; giữ cách xử lý hiện có, chưa kiểm thử đầy đủ |
| Thành công | Lưu hoặc hoàn thành; giữ thông báo hiện có, chưa thực hiện thao tác ghi trong đợt rà soát UI |
| Quyền | Truy cập trang bảo vệ khi chưa đăng nhập; giữ chuyển hướng tới đăng nhập |

## Responsive và xác minh

Các kích thước mục tiêu: 375, 390, 768, 1366, 1440 và 1920px. Giữ bố cục desktop. Mobile giữ thanh điều hướng, biểu mẫu co một cột theo layout hiện có, bảng cuộn bên trong khung. Không thay đổi cách tính dữ liệu hoặc kiểm tra hợp lệ.

Chạy `UI_BASE_URL=<địa chỉ web> node scripts/kiem-tra-ui-cong-vu.cjs` với Chrome đã cài. Script chỉ mở trang, không tạo tài khoản hoặc gửi biểu mẫu. Ảnh và số đo lưu tại `outputs/ui-review`. Không coi kiểm tra chuyển hướng đăng nhập là đã kiểm tra nội dung quản trị sau đăng nhập.

## Tham khảo

Đã thử truy cập bốn URL người dùng cung cấp: dangcongsan.vn, sotaydangvien.dcs.vn, dichvucong.gov.vn, dichvucong.moha.gov.vn. Ba trang hết thời gian chờ; trang Sổ tay đảng viên trả tài liệu không có nội dung có thể phân tích bằng công cụ. Không có kết luận về màu, font hoặc bố cục thực tế của các trang đó. Triển khai dựa trên yêu cầu người dùng và bằng chứng mã nguồn hiện có.

`docs/PRD.md` là khung chưa chứa PRD đầy đủ. `RTK.md` được dẫn chiếu nhưng chưa tìm thấy; không suy đoán nội dung.
