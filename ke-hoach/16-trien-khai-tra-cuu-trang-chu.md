# Kế hoạch triển khai tra cứu và trang chủ

Ngày lập: 27/10/2026. Trạng thái: kế hoạch sẵn sàng thực hiện, chưa thay đổi chức năng.

Kế thừa kế hoạch 15 và bàn giao `docs/tra-cuu-dot-3.md`. Các kết quả kiểm thử trong tài liệu cũ là kết quả bàn giao trước đây, không phải kiểm thử lại trong lần lập kế hoạch này.

## 1. Mục tiêu và phạm vi

Phục vụ công chức, viên chức, đảng viên theo hai luồng:

1. Công việc cần xử lý → căn cứ → quy trình → biểu mẫu → bài học/luyện tập.
2. Mở trang chủ → tiếp tục học hoặc thực hiện nhiệm vụ → xem kết quả → ôn nội dung còn sai.

Một người có thể quan tâm nhiều nhóm. Nhóm quan tâm không thay đổi quyền tài khoản, trạng thái xác minh hoặc phạm vi quản lý đơn vị.

Phạm vi trước mắt là hoàn thiện chức năng và dữ liệu cục bộ có thể nghiệm thu. Triển khai môi trường thật là đợt riêng. Giữ phạm vi địa bàn hiện có cho tới khi cấu hình phạm vi được xác định rõ; không mặc nhiên đổi toàn bộ nhận diện thành cổng toàn quốc.

## 2. Điểm xuất phát đã đối chiếu

| Phần | Hiện trạng | Hướng xử lý |
|---|---|---|
| Trang chủ | Ô tìm văn bản, ba nhóm, các lối tắt; chưa lấy bài đang học/nhiệm vụ | Bổ sung API tổng hợp và các khối theo tài khoản |
| Tra cứu văn bản | Có lọc, ngày tra, phân trang, nhóm Đảng, thuộc tính/phiên bản/so sánh | Giữ; kiểm thử hồi quy khi nối tính năng mới |
| Ô tìm chung | Gửi đến tìm văn bản | Thêm chọn loại và giữ từ khóa khi chuyển loại |
| Quy trình/biểu mẫu | Có tìm từ khóa, loại và phân trang | Bổ sung metadata, bộ lọc và liên kết công việc |
| Nội dung ba nhóm | Có nền tảng nhóm và khung chuyên đề nháp | Biên soạn, đối chiếu nguồn, duyệt trước xuất bản |
| Văn bản Đảng | Có lối tra; bàn giao ghi chưa nạp bộ nguồn đã đối chiếu | Nạp dữ liệu có nguồn và trạng thái kiểm chứng |
| Học/luyện tập/thi | Có các route và nghiệp vụ hiện hữu | Dùng lại, rà dữ liệu tiến độ và giao bài trước khi thêm bảng |
| Hỏi đáp | Chưa mang toàn bộ bộ lọc từ tìm kiếm | Nối ngữ cảnh sau khi hoàn thành tra cứu cơ bản |

Lưu ý làm việc: workspace đang có nhiều thay đổi chưa commit của đợt 3. Đối chiếu diff trước khi sửa; không reset, ghi đè hay đưa thay đổi cũ vào phạm vi bàn giao mới. RTK.md được tham chiếu nhưng chưa tìm thấy; không suy đoán nội dung.

## 3. Các đợt triển khai

### Đợt 0 — Chốt dữ liệu và hợp đồng API

- [ ] Kiểm kê dữ liệu công khai theo nhóm: số văn bản đã phân loại, quy trình, mẫu có tệp tải, bài xuất bản, câu hỏi có căn cứ.
- [ ] Đối chiếu schema/API tiến độ, giao bài, câu sai, nhóm người dùng; ghi rõ phần dùng lại và phần cần bổ sung.
- [ ] Kiểm tra sự khác nhau giữa CSDL thử và môi trường thật; ghi danh sách migration còn chờ, không chạy trên môi trường thật trong đợt này.
- [ ] Định nghĩa dữ liệu trang chủ: nhóm quan tâm, bài có thể tiếp tục, nhiệm vụ và hạn, số câu sai. Trả trạng thái rỗng khi không có dữ liệu, phân biệt với lỗi dịch vụ.
- [ ] Chốt mô hình metadata quy trình/biểu mẫu: nhóm, lĩnh vực, công việc, phạm vi/cơ quan, nguồn, ngày rà soát, trạng thái duyệt.
- [ ] Lập danh sách 5 công việc mẫu; mỗi mục ghi nguồn cần lấy, phần đã có và phần cần biên tập.

Đầu ra: báo cáo kiểm kê trong `outputs/`, hợp đồng API và bảng thiếu dữ liệu trong `docs/`. Hoàn thành khi có thể xác định từng khối giao diện lấy dữ liệu từ đâu; chưa tạo bảng trùng chức năng.

### Đợt 1 — Cửa tra cứu và nội dung thí điểm

- [ ] Cho chọn Văn bản pháp luật / Văn bản Đảng / Quy trình / Biểu mẫu tại ô tìm chung. Giữ từ khóa và các bộ lọc tương thích; loại bỏ điều kiện không áp dụng cho loại mới.
- [ ] Bổ sung metadata quản trị và lọc quy trình/biểu mẫu theo nhóm, lĩnh vực, công việc; dùng dữ liệu đã xuất bản để tạo danh mục lọc.
- [ ] Hiển thị nguồn, ngày kiểm tra, phạm vi và trạng thái dữ liệu trên chi tiết; bổ sung cơ chế tiếp nhận phản hồi sai/thiếu nội dung có kiểm soát tần suất.
- [ ] Soạn và duyệt 5 hồ sơ: đánh giá công chức; thể thức văn bản; đánh giá viên chức; hợp đồng làm việc; chuyển sinh hoạt Đảng.
- [ ] Mỗi hồ sơ có căn cứ mở được, trình tự đã kiểm tra, ít nhất một biểu mẫu/tài liệu phù hợp và liên kết học tập nếu đã xuất bản. Nếu không có mẫu chính thức, ghi rõ loại tài liệu tham khảo, không gán thành mẫu do cơ quan ban hành.
- [ ] Rà nhãn hỏi đáp và hướng dẫn còn ví dụ giao thông không phù hợp; chỉ sửa nội dung nằm trong phạm vi ba nhóm.

Nghiệm thu: từ trang chủ tìm được cả bốn loại, quay lại giữ trạng thái; mẫu tải đúng tệp; nội dung nháp không xuất hiện; mỗi nhóm có ít nhất một hồ sơ dùng được. Phần chưa kiểm chứng giữ nháp, không chặn việc nghiệm thu kỹ thuật bằng dữ liệu giả.

### Đợt 2 — Trang chủ cá nhân hóa (tiếp nối đợt 4 của kế hoạch 15)

- [ ] Lưu nhiều nhóm quan tâm theo tài khoản; khách có thể dùng lựa chọn tạm. Không tự thay đổi nhóm đã xác minh.
- [ ] Tạo API tổng hợp gọn, xác thực phía máy chủ; lỗi từng nguồn không làm mất toàn bộ trang chủ. Dữ liệu cá nhân không được lưu vào cache dùng chung.
- [ ] Hiện “Tiếp tục học” đến đúng bài đang dở, chỉ tính từ tiến độ học thực. Nếu không có bài dở, gợi ý bắt đầu nội dung phù hợp.
- [ ] Hiện nhiệm vụ được giao, hạn và trạng thái từ nghiệp vụ giao bài; loại nhiệm vụ không còn quyền mở, đã thu hồi hoặc đã hoàn thành khỏi danh sách cần làm.
- [ ] Đưa số câu sai và thao tác ôn lại từ chức năng hiện có lên trang chủ.
- [ ] Thêm lưu văn bản/điều khoản theo tài khoản, giữ ngày tra và vị trí; bỏ lưu được. Chốt cách xử lý khi nội dung bị thu hồi hoặc mất quyền truy cập.
- [ ] Thêm lịch sử vừa tra cứu giới hạn 20 mục; người dùng có thể tắt ghi và xóa. Không ghi toàn văn câu hỏi nhạy cảm vào lịch sử mặc định.
- [ ] Hiện 3–5 mục mỗi khối; có nơi xem tất cả. Luồng khách/chưa xác minh không hiện hành động học bị khóa như thể có thể sử dụng.

Nghiệm thu: người mới, người có bài dở, người có nhiều nhóm, khách và người chờ xác minh đều có trạng thái phù hợp; không lộ dữ liệu giữa tài khoản/đơn vị; xóa lịch sử và bỏ lưu có hiệu lực sau tải lại trang.

### Đợt 3 — Tra theo công việc và cập nhật quy định (tiếp nối đợt 5)

- [ ] Làm danh mục công việc và trang chi tiết, sử dụng 5 hồ sơ đã duyệt ở đợt 1; liên kết tới các trang căn cứ/quy trình/mẫu/học sẵn có.
- [ ] Tạo bản tin có nhóm ảnh hưởng, thay đổi chính, thời điểm áp dụng, nguồn và người rà soát; luồng nháp → duyệt → xuất bản → cập nhật/thu hồi.
- [ ] Hiện “Quy định mới liên quan” theo nhóm/chủ đề quan tâm, chỉ lấy bản tin đã duyệt. Không suy ra mức liên quan chỉ từ ngày ban hành.
- [ ] Khi căn cứ đổi, lập danh sách bài học, câu hỏi, quy trình và mẫu cần rà soát; đưa vào hàng biên tập, không tự viết lại nội dung đã duyệt.
- [ ] Nối ngữ cảnh hỏi đáp: từ khóa, loại tài liệu, lĩnh vực, ngày tra và công việc nếu có. Áp dụng lại bộ lọc phía máy chủ, không chỉ đưa vào prompt.
- [ ] Câu trả lời mở được căn cứ; thiếu căn cứ hoặc nguồn ngoài phạm vi phải nêu giới hạn; phân biệt nội dung sinh với tài liệu chính thức.

Nghiệm thu: mở được luồng công việc xuyên suốt; thu hồi bản tin làm ngừng hiển thị công khai; AI không dẫn văn bản ngoài phạm vi lọc mà không giải thích; nguồn thay đổi tạo được mục cần rà soát.

### Đợt 4 — Nghiệm thu và triển khai

- [ ] Chạy typecheck/build và kiểm thử phù hợp phần thay đổi; giữ bộ kiểm thử tra cứu đợt 3.
- [ ] Kiểm tra 320/390/768/1024 px, bàn phím, nhãn điều khiển, tải chậm, API lỗi, danh sách trống và đăng nhập hết hạn.
- [ ] Kiểm tra quyền bằng ít nhất hai tài khoản khác đơn vị; nhóm quan tâm không mở rộng quyền; nháp không lọt vào tìm kiếm, bản tin, AI hoặc gợi ý.
- [ ] Kiểm tra nguồn, tệp tải, viện dẫn, thời điểm áp dụng và luồng thu hồi của toàn bộ 5 hồ sơ.
- [ ] Lập hướng dẫn áp dụng migration, sao lưu, kiểm tra sau triển khai và phục hồi dữ liệu. Không sửa migration đã chạy.
- [ ] Ghi kết quả nghiệm thu, giới hạn còn lại và cấu hình phạm vi địa bàn.
- [ ] Chỉ thực hiện triển khai khi có chỉ đạo triển khai môi trường thật; kiểm tra smoke sau triển khai và theo dõi lỗi.

## 4. Bố cục trang chủ đích

1. Giới thiệu ngắn và ô tra cứu có loại nội dung.
2. Tiếp tục học; nhiệm vụ cần hoàn thành cho người đủ quyền.
3. Nhóm quan tâm và chuyên đề phù hợp.
4. Quy trình, biểu mẫu/công việc thường dùng.
5. Đã lưu, vừa tra cứu và ôn câu sai.
6. Quy định mới liên quan, mở khi có bản tin đã duyệt.

Trên điện thoại ưu tiên ô tìm và tiếp tục học; không kéo dài băng chào. Khách thấy hướng dẫn bắt đầu, người chưa xác minh thấy trạng thái và lối vào chức năng được phép. Mỗi khối có trạng thái lỗi/rỗng riêng.

## 5. Các khu vực mã dự kiến thay đổi

| Khu vực | Phạm vi |
|---|---|
| `apps/web/app/routes/home.tsx`, `components/trang-chu/` | Ô tìm, bố cục, các khối cá nhân |
| `apps/web/app/routes/tra-cuu.tsx`, `components/tra-cuu/` | Chọn loại, lọc quy trình/mẫu, liên kết công việc |
| `apps/web/app/routes/quan-tri.du-lieu-tra-cuu*` | Metadata và nguồn quy trình/mẫu |
| `apps/api/src/routes/`, `apps/web/app/lib/` | API trang chủ, sở thích, lưu/lịch sử; dùng lại API học hiện có |
| `packages/db/src/`, `packages/db/migrations/` | Truy vấn và migration chỉ cho phần thực sự thiếu |
| `content/`, quản trị chuyên đề/câu hỏi | Hồ sơ công việc, bài học, nội dung đã duyệt |
| `apps/web/tests/`, kiểm thử API/DB | Kiểm thử luồng, quyền, phân trang và lưu dữ liệu |

Tên API/bảng mới được chốt sau đợt 0, chưa coi tên dự kiến là hợp đồng đã triển khai.

## 6. Thứ tự bắt đầu và điều kiện dừng mở rộng

Lượt triển khai đầu tiên: hoàn thành đợt 0, sau đó làm ô tìm chọn loại và metadata quy trình/biểu mẫu của đợt 1. Đây là gói đầu tiên để xem thử và nghiệm thu. Chưa mở rộng bản tin và AI trong gói này.

Sau đó nối trang chủ cá nhân bằng dữ liệu học đã có trong lúc tiếp tục biên tập 5 hồ sơ. Các màn hình có thể hoàn thiện trước khi nội dung được duyệt, nhưng không xuất bản nội dung chưa được kiểm chứng.

Mỗi gói bàn giao phải có: phần đã thay đổi, cách xem thử, kiểm thử đã chạy, migration/dữ liệu cần áp dụng và giới hạn còn lại. Không đưa thêm diễn đàn, bảng xếp hạng công khai hoặc ứng dụng di động riêng vào phạm vi này.

## 7. Nguồn tham khảo chức năng

- Thư Viện Pháp Luật: https://thuvienphapluat.vn/page/tim-van-ban.aspx — điều kiện tìm và bộ lọc.
- LuatVietnam: https://luatvietnam.vn/ — bản tin hiệu lực, phân nhóm nội dung và biểu mẫu.
- Tư liệu – Văn kiện Đảng: https://tulieuvankien.dangcongsan.vn/he-thong-van-ban/ — kho và thuộc tính văn bản Đảng.
- CSDL văn bản pháp luật: https://vbpl.moj.gov.vn/huongdan/khaithac_vbpl.htm — thuộc tính, lịch sử và bản gốc.

Các nguồn trên được tham khảo ở bước đánh giá trước. Khi biên soạn hồ sơ pháp lý phải kiểm tra lại văn bản và hiệu lực tại thời điểm áp dụng; không sao chép nội dung thương mại làm dữ liệu của hệ thống.
