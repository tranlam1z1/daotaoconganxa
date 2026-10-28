# Báo cáo chuẩn hóa UI/UX ngày 28/10/2026

## Phạm vi thực hiện

Đã rà cấu trúc monorepo, 106 module route web, cấu hình React Router/Tailwind, component dùng chung và tài liệu PRD/nhận diện. Danh mục kiểm kê: `outputs/ui-review/route-inventory.json`. PRD trong kho chưa đầy đủ. Không tìm thấy RTK.md được dẫn chiếu.

Áp dụng hệ token chung cho toàn bộ ứng dụng: trang chủ, tra cứu và đọc văn bản, công cụ nghiệp vụ, dịch vụ công, học, luyện tập, thi, nhóm, tài khoản, hướng dẫn, quản trị và trang lỗi. Các trang dùng token được cập nhật thông qua CSS và component chung; không có nghĩa tất cả luồng nghiệp vụ đã được kiểm thử đầu cuối.

Các vùng quản trị được chuẩn hóa CSS: tổng quan, báo cáo, hồ sơ cán bộ, người dùng, chuyên đề, duyệt dữ liệu tra cứu, đề thi, giao bài và menu quản trị. Giữ nguyên loader/action và phân quyền. Không thêm thư viện, thay API hoặc schema.

## Thành phần chỉnh sửa

SiteHeader, menu điều hướng chung, sidebar quản trị; Button/ButtonLink; Field/Input và token select/textarea; Card; Badge; PageHeader; KhungTrang/TieuDeTrang/DauTrangAnh; KhungNoiDung; LuoiLoiTat; KhungBang; phân trang TraCuuControls. Modal HopThoai, bảng, skeleton và thông báo hiện có kế thừa token, giữ hành vi gốc. Đồng bộ theme-color ở root, manifest và trang offline.

Màu chính: đỏ đô `#A61C30`, xanh công vụ `#17618B`, vàng đồng `#C9A227`, nền `#F5F7FA`, trắng `#FFFFFF`, chữ `#243447` / `#64748B`, viền `#E2E8F0`, thành công `#16805D`, cảnh báo `#B7791F`, lỗi `#C62828`. Chữ cảnh báo dùng `#8A5B18` để tăng tương phản. Font Be Vietnam Pro tự lưu, dự phòng Roboto/Segoe UI. Chi tiết tại [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Vấn đề đã xử lý

- Thay bảng màu xanh cũ bằng hệ màu công vụ, tách màu điều hướng khỏi hành động chính.
- Bỏ họa tiết toàn nền, gradient nhiều màu ở header, watermark dashboard và chuyển động nghiêng icon khi hover.
- Thay màu viết cứng tại các vùng dashboard/báo cáo bằng token để hỗ trợ cả chế độ tối.
- Tăng khả năng đọc, thống nhất bo góc, focus, biểu mẫu, ô nhập 16px và vùng chạm 44px.
- Phân trang tra cứu có vùng chạm rõ và tự xuống dòng; khung bảng báo cáo cuộn bằng bàn phím.
- Điều chỉnh vị trí sidebar theo chiều cao header mới; giới hạn hình ảnh và nội dung theo khung hiện có.
- Giữ logo gốc, nội dung, validation, route, endpoint, dữ liệu và phân quyền.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Production build | Đạt |
| Typecheck web | Đạt |
| Biome 13 tệp TSX đã sửa | Đạt |
| Git diff whitespace | Đạt |
| Kiểm thử web có sẵn | 89 đạt, 2 lỗi kỳ vọng điều hướng/trang chủ |
| 24 URL × 6 chiều rộng | 144/144 không tràn ngang, không có 5xx; đã chạy lại sau chỉnh bố cục |
| Contrast token sáng/tối | 14 cặp ≥ 4,5:1; thấp nhất 4,64:1 |
| Bàn phím trang đăng nhập | Skip link đưa tới main, focus hiển thị, label gắn ô nhập, ô nhập cao 44px |

Các chiều rộng: 375, 390, 768, 1366, 1440, 1920px; cao viewport 900px. Kết quả máy đọc được tại `outputs/ui-review/layout-results.json` và `accessibility-results.json`; ảnh chụp lưu cục bộ cùng thư mục, không commit ảnh.

Hai lỗi test có sẵn liên quan việc bổ sung liên kết `/dich-vu-cong` và bỏ liên kết `/hoi-dap` trong những thay đổi đã tồn tại trước khi triển khai UI. Các tệp đó không được sửa hoặc đưa vào commit UI. Không thay test hoặc nghiệp vụ để che lỗi.

## Giới hạn và kiểm tra thủ công còn cần

Chưa xác nhận toàn bộ nội dung sau đăng nhập, các vai trò quản trị, popup phụ thuộc dữ liệu, lưu/hủy/xóa, tải lên, chấm và nộp bài thi, đọc văn bản thực tế dài, trạng thái tải chậm/rỗng/một phần/thành công trên từng route, screen reader, zoom 400% và thiết bị thật. Kiểm tra `/quan-tri` khi chưa đăng nhập chỉ xác minh chuyển hướng, không xác minh dashboard. Bộ kiểm tra bằng chứng thiết kế đầy đủ còn báo chưa đạt vì những trạng thái chưa kiểm này; không tuyên bố đạt WCAG toàn ứng dụng.

Các trang tham khảo bên ngoài không cung cấp được nội dung đủ để phân tích trong phiên này. Không nhận là đã kiểm tra giao diện của chúng.

## Git và bảo vệ công việc hiện có

Nhánh triển khai: `codex/government-ui-standardization`, tách từ nhánh làm việc ban đầu `codex/traffic-signs-data`. Tám tệp sửa dở được giữ ngoài commit: SiteFooter.tsx; lib/cong-cu.ts; lib/dich-vu-cong.ts; lib/site.ts; routes/dich-vu-cong.tsx; routes/home.tsx; routes/search.tsx; routes/tra-cuu.tsx.

Commit triển khai dùng thông điệp `style(ui): standardize government design system and shared layouts`. Mã commit và kết quả push được ghi trong phản hồi bàn giao. Không tự merge khi vẫn còn giới hạn QA trên nội dung bảo vệ và các thay đổi riêng chưa commit.
