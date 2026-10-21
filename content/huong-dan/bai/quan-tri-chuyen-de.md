## Tạo chuyên đề từ tệp PDF

Cách nhanh nhất để có bài giảng từ một văn bản (luật, nghị định, thông tư):

1. Ở trang **Chuyên đề**, bấm **Tạo từ tệp PDF**.
2. Chọn tệp PDF của văn bản, chọn **Lĩnh vực**, rồi bấm **Tạo chuyên đề**. Bỏ chọn câu tự luận hoặc câu trắc nghiệm nếu chỉ cần nội dung bài học.
3. Trang chuyển sang chuyên đề vừa tạo. Khung **Tiến độ AI soạn** tự cập nhật tới khi các bài soạn xong.
4. Mở từng bài để xem hoặc sửa, rồi bấm **Xuất bản cả chuyên đề**.

Hệ thống tự lưu văn bản vào kho; văn bản đã có theo số ký hiệu thì được dùng lại, không ghi đè. Tên chuyên đề lấy theo tên văn bản.

| Tình huống | Việc cần làm |
|---|---|
| Tệp là bản quét | AI đọc từng trang nên mất vài phút và tốn chi phí AI hơn; soát lại văn bản ở mục **Văn bản** khi khung tiến độ báo có chỗ không đọc được |
| Hệ thống không đọc được số ký hiệu | Nhập số ký hiệu ở ô **Nhập tay số ký hiệu** rồi gửi lại; với bản quét, nhập ở khung tiến độ rồi bấm **Chạy tiếp** |
| Một phần soạn bị lỗi | Bấm **Chạy tiếp** ở khung tiến độ để soạn lại phần chưa xong |
| Bài chưa đạt bảng kiểm | Bài được giữ nguyên khi xuất bản cả chuyên đề; sửa lỗi của bài rồi xuất bản lại |

**Xuất bản cả chuyên đề** cần vai trò pháp chế trở lên. Biên tập viên thấy nút **Gửi pháp chế duyệt tất cả** thay cho nút đó. Câu trắc nghiệm do AI sinh nằm ở trạng thái chờ duyệt trong **Ngân hàng câu hỏi**.

Quản trị viên có thêm ô **Tạo luôn một đề thi từ văn bản này** kèm ba mẫu cấu trúc đề (15, 45, 90 phút). Chọn ô đó thì cùng tệp PDF tạo cả chuyên đề lẫn một đề thi nháp; trang chuyên đề hiện lối **Mở đề thi**. Ở trang đề, xem lướt các câu AI sinh, từ chối câu sai, rồi bấm **Duyệt … câu và xuất bản đề**. Chỉ cần đề thi thì vào **Đề thi**, bấm **Tạo từ tệp PDF**.

Muốn tự soạn từng bài thì bấm **Tạo thủ công**.

## Danh sách chuyên đề

![Danh sách chuyên đề](anh:quan-tri-chuyen-de-danh-sach)

Tiêu đề mục ghi tổng số chuyên đề. Chuyên đề được nhóm theo lĩnh vực pháp luật (1), trong mỗi lĩnh vực nhóm theo đối tượng (2): **Người trực tiếp áp dụng quy định** và **Người tư vấn và đào tạo lại**. Chuyên đề cụ thể hoá một chuyên đề khác được thụt vào so với chuyên đề đó.

Mỗi thẻ gồm tên chuyên đề (3), trạng thái, số bài và mốc **as_of** (4) là thời điểm khung pháp lý mà chuyên đề căn cứ. Dòng quan hệ (5) ghi chuyên đề này **nối tiếp** hoặc **cụ thể hoá** chuyên đề nào. Nhãn đỏ **căn cứ cần rà** xuất hiện khi chuyên đề có căn cứ cần kiểm tra lại.

| Trạng thái | Ý nghĩa |
|---|---|
| Bản nháp | Nội dung đang khởi tạo |
| AI vừa soạn | Nội dung do AI soạn, chưa biên tập |
| Đang biên tập | Biên tập viên đang sửa nội dung |
| Chờ pháp chế | Chờ bộ phận pháp chế duyệt |
| Đã xuất bản | Người học đang học được |
| Cần cập nhật | Đã xuất bản nhưng cần sửa theo khung pháp lý mới |
| Lưu trữ | Không còn sử dụng |

## Bảng kiểm trước xuất bản

![Bảng kiểm trước xuất bản của một chuyên đề](anh:quan-tri-chuyen-de-bang-kiem)

Bấm tên chuyên đề trong danh sách để mở bảng kiểm của chuyên đề đó ở cuối trang; thẻ đang chọn có viền màu nhấn. Khi mới mở trang, bảng kiểm của chuyên đề đầu tiên được hiển thị.

Khung kết quả (1) ghi **Đạt** khi mọi bài đang xuất bản đều qua bảng kiểm; bài chưa xuất bản vẫn có thể mang nhãn **Chưa đạt**. Khi kết quả là **Chưa đạt**, bên dưới liệt kê mục đang chặn xuất bản:

| Mục chặn | Việc cần làm |
|---|---|
| Bài chưa đạt | Sửa các lỗi của bài được nêu tên |
| Đồ thị kỹ năng có chu trình | Gỡ quan hệ tiên quyết vòng tròn giữa các kỹ năng |
| as_of đã cũ … ngày | Rà lại khung pháp lý và mốc as_of của chuyên đề |

Dòng đầu mỗi bài (2) ghi số thứ tự, tên, trạng thái, số khối nội dung, số bài tập, thời lượng ước tính và nhãn **Đạt** hoặc **Chưa đạt**. Các dòng bên dưới (4) bắt đầu bằng **Lỗi:** là lỗi chặn xuất bản; dòng bắt đầu bằng **Cảnh báo:** là nội dung nên sửa nhưng không chặn xuất bản.

## Chuyển trạng thái bài

1. Mở bảng kiểm của chuyên đề chứa bài.
2. Kiểm tra bài không còn dòng **Lỗi:** nếu định xuất bản.
3. Bấm nút trạng thái mới trong hàng nút (3). Nút của trạng thái hiện tại bị làm mờ.
4. Trang ghi **Đã cập nhật trạng thái.** khi chuyển thành công.

| Trạng thái hiện tại | Chuyển được sang |
|---|---|
| Bản nháp, AI vừa soạn | Đang biên tập |
| Đang biên tập | Chờ pháp chế |
| Chờ pháp chế | Đang biên tập, Đã xuất bản |
| Cần cập nhật | Đang biên tập, Đã xuất bản |
| Đã xuất bản | Không chuyển được bằng các nút trên trang này |

Chuyển sang **Đã xuất bản** cần vai trò pháp chế trở lên, và bài phải đạt bảng kiểm. Khi yêu cầu chuyển không hợp lệ, hệ thống từ chối, hiện thông báo lỗi và giữ nguyên trạng thái; anh/chị mở lại trang **Chuyên đề** từ cột điều hướng để tiếp tục.
