# Nhóm đối tượng học tập — đợt 2

## Phạm vi đang triển khai

Ba nhóm chính thức: Công chức (`cong_chuc`), Viên chức (`vien_chuc`), Đảng viên (`dang_vien`). Một tài khoản hoặc chuyên đề có thể thuộc nhiều nhóm. Nhóm không cấp quyền quản trị, không đổi vai trò, phạm vi đơn vị hoặc yêu cầu xác minh.

`accounts.nhom_doi_tuong` và `courses.nhom_hoc_tap` chỉ lưu ba mã trên sau migration 0080. Bộ hằng số dùng chung ở packages/dao-tao/src/nhom-doi-tuong.ts điều khiển biểu mẫu tài khoản, chuyên đề và bộ lọc học.

## Tương thích và chuyển đổi

- Mã `cong_chuc_cap_xa` được chuyển thành `cong_chuc`. API đọc/ghi và URL học cũ tiếp tục nhận mã cũ nhưng lưu/trả mã mới; chọn cả mã cũ và mới chỉ tạo một nhóm.
- Mã `cong_an_cap_xa` không có nhóm thay thế. Migration bỏ mã khỏi mảng hiện hành và lưu mảng trước/sau trong `audience_group_migration_history`.
- Tài khoản hoặc chuyên đề chỉ có nhóm công an trở thành chưa phân nhóm. Không tự gán công chức và không xóa tài khoản, bài, ghi danh, điểm hoặc tiến độ.
- API từ chối nhập mới nhóm công an hoặc mã không hợp lệ. Nhóm tự khai không được dùng để nâng quyền.
- Khi sửa tài khoản/chuyên đề, bỏ trường nhóm thì giữ nguyên; gửi `[]` là xóa nhóm. Không xóa hết nhóm của chuyên đề đang xuất bản qua thao tác biên tập; cần đưa về biên tập trước.

## Danh mục người học

`nhom=tat_ca`, `nhom=cua_toi` hoặc một trong ba mã nhóm được hỗ trợ. `cua_toi` đọc nhóm từ phiên phía máy chủ và cần đăng nhập. Tài khoản chưa gắn nhóm nhận danh sách rỗng khi chủ động chọn bộ lọc này. Người chưa gắn nhóm mặc định xem tất cả. Chọn nhóm là lọc gợi ý, không giới hạn quyền đọc các nhóm khác.

Chuyên đề không có nhóm không hiện trong danh mục và không mở được bằng đường dẫn công khai. Khung nháp không được xuất bản tự động. Phân loại cũ `audience_group` (người áp dụng/người tư vấn) vẫn giữ riêng.

## Quản trị và kiểm kê

- Người dùng: bộ lọc “Chưa phân nhóm học tập” gửi `chua_phan_nhom=1`; tổng số và phân trang vẫn chịu giới hạn đơn vị của người gọi. Chỉ quản trị hệ thống được sửa nhóm tài khoản, thay đổi vẫn ghi nhật ký hiện có.
- Chuyên đề: lọc từng nhóm hoặc “Chưa phân nhóm — cần rà soát”; mỗi dòng hiển thị nhóm đã gắn. Quyền xem/sửa chuyên đề giữ nguyên.
- Chạy `bun run nhom:kiem-ke` để có báo cáo chỉ đọc, gồm số tài khoản theo nhóm, lĩnh vực, chuyên đề, số bài và lý do cần rà. Không in tên/email người dùng.
- Dấu hiệu từ tiêu đề chỉ là gợi ý rà soát. Script không tự sửa nhóm, lưu trữ hoặc xuất bản.

## Nền danh mục và nội dung mẫu

Migration 0081 thêm ba lĩnh vực và ba khung chuyên đề tương ứng:

| Nhóm | Lĩnh vực | Khung chuyên đề |
|---|---|---|
| Công chức | Công vụ và hành chính | Công vụ và xử lý công việc hành chính |
| Viên chức | Nghiệp vụ viên chức | Vị trí việc làm và đạo đức nghề nghiệp của viên chức |
| Đảng viên | Công tác Đảng | Sinh hoạt chi bộ và công tác đảng viên |

Tất cả ở trạng thái nháp, chưa có bài và chưa được duyệt căn cứ. Ngày 27/10/2026 trong khung là mốc chuẩn bị biên soạn, không phải chứng nhận hiệu lực. Chạy lại không ghi đè bản đã được biên tập. Trước khi xuất bản cần người biên tập, nguồn/bản gốc, ngày kiểm tra, căn cứ/thời điểm áp dụng và bài tập đã đối chiếu.

Migration 0082 chỉ lưu trữ chuyên đề Thông tư 13/2025/TT-BCA đã được xác định trong kiểm kê: đối chiếu chính xác cả slug và tiêu đề. Nhật ký `dao_tao.chuyen_de.ngung_pham_vi_dot_2` lưu trạng thái/nhóm trước đổi; giữ bài, điểm và tiến độ. Không tự xử lý chuyên đề khác theo từ khóa và không lưu trữ lại một mục đã được biên tập viên chủ động mở lại.

## Trình tự áp dụng

1. Sao lưu CSDL đích và chạy kiểm kê trước chuyển đổi. Xác nhận đúng cơ sở dữ liệu, số tài khoản/chuyên đề và các mục cần rà. Không dùng báo cáo CSDL test để suy ra dữ liệu môi trường thật.
2. Dừng các tiến trình có thể ghi nhóm theo phiên bản cũ. Đây là đợt triển khai có cửa sổ bảo trì, không tuyên bố không gián đoạn.
3. Chạy `bun run db:migrate`: 0078 mở rộng constraint và thêm bảng lịch sử; 0079 chuyển dữ liệu trong transaction; 0080 chốt ba mã; 0081 thêm khung nháp; 0082 lưu trữ mục đã đối chiếu nếu có.
4. Khởi chạy API, web, worker bằng cùng phiên bản mã mới. Mã mới ghi `cong_chuc`, nên không khởi chạy trước bước migration.
5. Kiểm kê lại; đối chiếu snapshot, số ghi danh/tiến độ, vai trò và đơn vị; kiểm tra URL cũ, lọc nhiều nhóm, tài khoản chưa gắn nhóm và chuyên đề chưa phân nhóm.
6. Rà nội dung, gắn nhóm và duyệt từng mục. Chỉ xuất bản nội dung đủ nguồn; không đưa các khung nháp lên trang người học để lấp danh mục.

0078–0082 đã chạy trên quydinhphapluat_test; chưa áp dụng môi trường thật. Kiểm thử migration dùng schema riêng và dữ liệu tình huống, chưa phải kiểm thử tải trên bản sao đầy đủ môi trường thật. Với kho lớn cần đo thời gian khóa/cập nhật trước khi triển khai.

## Khôi phục có kiểm soát

Migration đã triển khai là bất biến. Không xóa hàng trong schema_migrations để chạy lại hoặc sửa file cũ; khôi phục bằng migration tiến mới sau khi dừng ghi và sao lưu.

- Khôi phục nhóm cũ: mở rộng lại hai CHECK như 0078 (giữ bảng lịch sử), rồi đối chiếu từng `entity_id`. Chỉ cập nhật từ `groups_after` về `groups_before` khi giá trị hiện tại còn bằng `groups_after`; nếu đã được sửa thủ công thì dừng để xử lý riêng. Không đổi vai trò/đơn vị và không xóa snapshot. Cần bản ứng dụng hỗ trợ tập mã mở rộng; đây không phải thao tác hạ phiên bản tự động.
- Khôi phục chuyên đề bị lưu trữ: lấy trạng thái trước đổi từ audit_log của 0082; chỉ phục hồi khi mục vẫn ở `luu_tru` và chưa có sửa đổi biên tập sau nhật ký đó. Ghi nhật ký phục hồi. Nội dung có nhóm công an cũ không được công bố trở lại dưới API ba nhóm.
- Khung danh mục mới: ưu tiên giữ nháp/lưu trữ. Không xóa mục đã có bài, ghi danh hoặc chỉnh sửa chỉ để quay về giao diện trước.

## Phần biên soạn còn lại

Khung đã sẵn để bắt đầu nhập nội dung; chưa có bài pháp lý mới được xác minh và xuất bản cho ba nhóm. Nối câu hỏi/kỳ thi theo nhóm và phân quyền quản lý theo nhánh là công việc riêng, không phát sinh quyền mới từ thay đổi này.

Kiểm chứng đợt 2: 115 kiểm thử nhóm/người dùng/migration/web và 403 kiểm thử đào tạo/xác thực/thư viện đều đạt (518 tổng cộng); typecheck toàn workspace, build web và kiểm tra định dạng các tệp thay đổi đều qua. API thực tế trả 200 cho ba nhóm và mã công chức cũ, 400 cho nhóm công an. Bản xem thử đợt 2: http://localhost:4189/ (API kiểm tra 4188).
