# Kế hoạch tra cứu và trang chủ cho ba nhóm

Ngày lập: 27/10/2026. Trạng thái: đã triển khai đợt 1 và nền tảng đợt 2 trong mã nguồn; chưa triển khai môi trường thật.

## 1. Phạm vi và nguyên tắc

- Phục vụ ba nhóm: Công chức, Viên chức, Đảng viên. Một người có thể thuộc nhiều nhóm.
- Loại nội dung, nhãn và lối vào dành riêng cho công an khỏi trải nghiệm sản phẩm này.
- Không tự động xóa tài khoản, lịch sử học, văn bản hoặc bảng dữ liệu cũ. Kiểm kê liên kết và dữ liệu trước khi ngừng các chức năng ngoài phạm vi.
- Phân nhóm để gợi ý nội dung, không thay thế quyền quản trị và phạm vi đơn vị.
- Nhóm quan tâm do người dùng chọn khác với nhóm tài khoản do quản trị xác nhận. Không cho lựa chọn sở thích thay đổi quyền truy cập.
- Tận dụng học chuyên đề, luyện tập, thi, tiến độ, thuộc tính, phiên bản và so sánh hiện có; kiểm tra khả năng thực tế trước khi nối lên giao diện mới.
- Chỉ hiển thị dữ liệu có thật. Chưa có bài đang học, hạn học hoặc bản tin thì dùng trạng thái trống phù hợp.
- Nội dung giao diện tuân thủ QUY-TAC-HANH-VAN.md. Nội dung quy định cần nguồn, căn cứ và thời điểm áp dụng.

## 2. Hiện trạng làm căn cứ

- Trang chủ ở apps/web/app/routes/home.tsx ưu tiên dịch vụ công Bộ Công an, tra vi phạm và công cụ giao thông.
- AppHeader còn giới thiệu đối tượng công an; nút “Tiếp tục học tập” hiện dẫn tới luyện tập, chưa xác định bài đang học.
- /tra-cuu hiện gồm biển báo và hành vi; /tim-kiem mới là tìm văn bản.
- Trang tìm văn bản đã có đoạn trích và liên kết điều khoản, nhưng chưa có bộ lọc trên giao diện. Tìm kiếm lấy tối đa 100 kết quả điều khoản rồi gộp thành văn bản; số văn bản sau gộp không phải tổng kết quả toàn kho.
- Đã có đường dẫn thuộc tính, lược đồ, phiên bản và so sánh; cần kiểm tra dữ liệu và hành vi khi sử dụng.
- docs/nhom-doi-tuong-hoc-tap.md ghi nhận bốn mã nhóm hiện có, trong đó công chức dùng mã cong_chuc_cap_xa. Không đổi tên hiển thị thành phạm vi công chức nói chung mà bỏ qua việc rà soát dữ liệu.
- /hoc đã hỗ trợ nhóm; /toi có lịch sử luyện tập, câu sai và hồ sơ chủ đề.
- RTK.md được tham chiếu trong chỉ dẫn đầu phiên nhưng chưa tìm thấy trong kho và các thư mục cha đã kiểm tra. Cần bổ sung khi có; không suy đoán nội dung chỉ dẫn.

## 3. Phần A — Đối tượng, danh mục và điều hướng

### A1. Kiểm kê trước khi sửa

- Rà header, footer, menu di động, trang chủ, tài khoản, đăng ký, quản trị người dùng, nhóm chuyên đề, hướng dẫn, metadata và hình ảnh nhận diện.
- Lập danh sách chức năng ngoài phạm vi: biển báo, hành vi giao thông, mức phạt, nồng độ cồn, tải trọng, giấy phép lái xe và dịch vụ công riêng Bộ Công an.
- Phân biệt công cụ dùng chung có thể giữ, như tính thời hạn và đối chiếu địa giới, với công cụ chuyên ngành cần gỡ khỏi menu.
- Kiểm tra tài khoản/chuyên đề đang gắn nhóm công an hoặc chưa gắn nhóm; nội dung dùng chung cần được biên tập lại nhóm, không chuyển hàng loạt thiếu đối chiếu.

### A2. Chuẩn hóa ba nhóm

- Nhãn chính thức: Công chức, Viên chức, Đảng viên.
- Quyết định và ghi lại cách mở rộng mã cong_chuc_cap_xa: giữ mã tương thích hoặc migration sang mã chung sau khi rà toàn bộ nơi sử dụng.
- Bỏ lựa chọn nhóm công an khỏi luồng tạo mới và gợi ý công khai; xử lý dữ liệu cũ bằng migration có kiểm tra và phương án khôi phục.
- Giữ nguyên phân quyền học/xác minh hiện hành trong lần thay đổi này; rà nhãn để phù hợp cả ba nhóm.

### A3. Điều hướng đích

- Menu chính: Trang chủ, Tra cứu, Học tập, Luyện tập, Cá nhân. Thi và nhóm học có lối vào trong Học tập/Luyện tập phù hợp chức năng đang có.
- /tra-cuu trở thành cửa vào chung. Giữ /tim-kiem cho kết quả văn bản trong đợt đầu để giảm thay đổi.
- Tra cứu gồm bốn loại: Văn bản pháp luật, Văn bản Đảng, Quy trình/thủ tục, Biểu mẫu.
- Tình huống công tác là cách khám phá nội dung ở giai đoạn sau, chưa thêm tab rỗng.
- URL giao thông cũ phải có cách xử lý rõ: trang thông báo chức năng đã ngừng trong sản phẩm hoặc chuyển tới nội dung tương đương thực sự; không chuyển mọi URL về trang chủ.

**Hoàn thành khi:** menu desktop/mobile và các nút chính chỉ phục vụ ba nhóm; không còn lối vào công an; dữ liệu lịch sử và quyền hiện có không bị mất hay mở rộng ngoài ý muốn.

## 4. Phần B — Tra cứu

### B1. Cửa vào và tìm kiếm cơ bản

- Dùng chung thành phần ô tìm cho trang chủ và trang Tra cứu; hỗ trợ bàn phím, giữ giá trị từ URL, trạng thái đang tải và lỗi.
- Gợi ý nhập: tên/số hiệu văn bản, điều khoản hoặc công việc cần tra.
- Chọn loại nội dung và giữ từ khóa khi chuyển loại. Mỗi loại có kết quả, bộ lọc và trạng thái trống riêng; không giả định một API đã tìm được mọi loại.
- Giữ khả năng mở thẳng điều, khoản và tô sáng đoạn trích hiện có.
- Chuẩn hóa số hiệu, khoảng trắng; đánh giá tìm không dấu và từ gần nghĩa trên bộ truy vấn thực tế trước khi bổ sung.

### B2. Bộ lọc và kết quả đầy đủ

- Pháp luật: lĩnh vực, loại văn bản, cơ quan ban hành, hiệu lực, phạm vi trung ương/địa phương, ngày áp dụng.
- Văn bản Đảng: loại, cơ quan ban hành, chủ đề, năm và trạng thái đã được kiểm chứng theo mô hình riêng.
- Quy trình/biểu mẫu: lĩnh vực, công việc, nhóm phù hợp và cơ quan/phạm vi áp dụng nếu có dữ liệu.
- Hiện bộ lọc thường dùng; bộ lọc còn lại nằm trong “Lọc nâng cao”. Có xóa từng lọc và xóa tất cả.
- Lưu bộ lọc, sắp xếp, phân trang trong URL; quay lại trình duyệt phải giữ trạng thái.
- Sửa API/phân trang để đếm văn bản chính xác sau khi tìm điều khoản; không phân trang một tập 100 kết quả đã bị cắt rồi gọi đó là toàn bộ kho.
- Nếu chưa làm được tổng chính xác, dùng nhãn giới hạn rõ ràng, không hiển thị tổng giả.
- Ưu tiên khớp số hiệu/tên khi người dùng tìm văn bản cụ thể; tìm nội dung ưu tiên mức phù hợp. Cho đổi sắp xếp khi có hỗ trợ.

### B3. Thẻ và trang chi tiết

- Thẻ gồm tên theo cách viết thông thường, số hiệu, cơ quan, ngày hiệu lực, trạng thái, đoạn trích và nguồn khi có.
- Chi tiết nối toàn văn, thuộc tính, bản gốc, quan hệ sửa đổi/thay thế, phiên bản và so sánh hiện có.
- Hiệu lực tại ngày tra khác với hiệu lực tại ngày xử lý vụ việc; chỉ cung cấp chọn ngày khi dữ liệu và API bảo đảm được cách xác định.
- Không suy ra hiệu lực từng điều từ trạng thái chung của văn bản. Thiếu dữ liệu phải thể hiện chưa xác định.
- Sao chép trích dẫn gồm văn bản, điều/khoản, URL và thông tin phiên bản/ngày áp dụng khi có.

### B4. Tra theo công việc và AI

- Biên soạn thử các chủ đề: đánh giá công chức; đánh giá viên chức; thể thức văn bản; sinh hoạt chi bộ; chuyển sinh hoạt Đảng.
- Một chủ đề liên kết căn cứ → trình tự → biểu mẫu → tình huống → bài học, chỉ hiển thị phần đã có.
- AI nhận từ khóa và bộ lọc liên quan; câu trả lời phải mở được căn cứ. Thiếu căn cứ thì thông báo giới hạn, không tự tạo biểu mẫu hay quy định như tài liệu chính thức.

**Hoàn thành khi:** tìm đúng số hiệu, mở được điều khoản, lọc và phân trang đúng; tìm không kết quả có hướng xử lý; nguồn và giới hạn hiệu lực thể hiện rõ. Kiểm thử thêm tập có trên 100 điều khoản khớp và nhiều điều thuộc cùng một văn bản.

## 5. Phần C — Trang chủ

### C1. Bố cục đầu tiên

1. Giới thiệu ngắn, ghi đúng ba nhóm; ô tra cứu chung là thao tác chính.
2. Lựa chọn nội dung Công chức / Viên chức / Đảng viên, hỗ trợ chọn nhiều nhóm quan tâm.
3. Học tập: chuyên đề phù hợp và lối vào danh mục.
4. Quy trình và biểu mẫu thường dùng, lấy từ danh mục đã biên tập.
5. Luyện tập và ôn câu sai, tận dụng chức năng hiện có.

Không đưa các khối công an/giao thông sang một vị trí khác trên trang chủ. Công cụ dùng chung chỉ giữ khi phù hợp mục tiêu mới.

### C2. Trạng thái theo người dùng

- Khách: xem chuyên đề nhập môn, chọn nhóm quan tâm và đăng nhập để lưu tiến độ.
- Đã đăng nhập, được học: hiển thị bài thực sự đang học và nút tiếp tục đến đúng bài; nếu chưa học thì gợi ý bắt đầu.
- Chưa được xác minh: trạng thái tài khoản và lối vào chức năng được phép; không hiện nhiệm vụ học không thể mở.
- Nhiều nhóm: hợp nhất gợi ý và loại trùng; chưa có nhóm: xem tất cả hoặc chọn nhóm quan tâm.
- Khối cá nhân cần API tổng hợp gọn, xử lý lỗi riêng để không làm hỏng toàn bộ trang chủ.

### C3. Các khối cần dữ liệu bổ sung

- “Việc học cần hoàn thành”: chỉ hiện nhiệm vụ, hạn và trạng thái từ hệ thống giao bài; kiểm tra API hiện có trước khi viết mới.
- “Quy định mới liên quan”: bản tin đã duyệt, gồm thay đổi, nhóm bị ảnh hưởng, ngày áp dụng và liên kết nguồn. Không lấy ngày ban hành mới làm bằng chứng có thay đổi liên quan.
- “Đã lưu và vừa tra cứu”: lưu điều khoản/văn bản, xóa lịch sử và đồng bộ theo tài khoản; kiểm tra chức năng sẵn có trước khi thiết kế bảng mới.
- Chỉ hiện 3–5 mục mỗi khối, có “Xem tất cả”; trên điện thoại ưu tiên tra cứu và tiếp tục học.

**Hoàn thành khi:** khách, tài khoản chưa xác minh, người mới và người đang học đều có hành động phù hợp; không dùng tiến độ hoặc hạn giả; giao diện điện thoại không tràn ngang và điều khiển được bằng bàn phím.

## 6. Phần D — Nội dung và quản trị

- Công chức: công vụ, thẩm quyền, thủ tục hành chính, văn thư, tiếp công dân, đánh giá và kỷ luật.
- Viên chức: hợp đồng làm việc, vị trí việc làm, chức danh nghề nghiệp, đánh giá, đạo đức và bồi dưỡng theo ngành.
- Đảng viên: Điều lệ, nghị quyết, sinh hoạt chi bộ, công tác đảng viên, kiểm tra, giám sát và kỷ luật Đảng.
- Mỗi mục có người biên tập, nguồn, ngày kiểm tra, nhóm, chủ đề và trạng thái xuất bản.
- Văn bản pháp luật và văn bản Đảng được phân loại độc lập; chỉ dẫn nghiệp vụ không được trình bày như văn bản chính thức.
- Ưu tiên bổ sung trường trong hệ thống quản trị hiện có; chỉ tạo mô-đun bản tin/quy trình mới sau khi xác định phần thiếu.
- Bản tin có luồng nháp → duyệt → xuất bản → cập nhật/thu hồi; khi căn cứ đổi phải rà liên kết tới bài học, biểu mẫu và câu hỏi.

**Hoàn thành khi:** mỗi nhóm có nội dung mẫu đã kiểm chứng để nghiệm thu luồng từ tra cứu đến học/luyện tập; nội dung chưa duyệt không lọt vào kết quả công khai.

## 7. Các đợt thực hiện và đầu ra

| Đợt | Công việc | Phụ thuộc | Đầu ra nghiệm thu |
|---|---|---|---|
| 1 | A1, A3 và C1: kiểm kê, đổi điều hướng, cửa vào tra cứu, trang chủ cơ bản | Đọc mã và kiểm tra luồng hiện có | Bản giao diện chạy được, chỉ phục vụ ba nhóm, ô tìm dùng kết quả văn bản hiện có |
| 2 | A2, D nền tảng: nhóm, danh mục, dữ liệu mẫu và tương thích dữ liệu cũ | Kiểm kê đợt 1 | Mô hình ba nhóm và dữ liệu đã rà, migration nếu cần |
| 3 | B1–B3: loại nội dung, API lọc, đếm/phân trang, thẻ và chi tiết | Danh mục và mô hình đợt 2 | Tra cứu hoàn chỉnh trên dữ liệu thật |
| 4 | C2, C3 phần tiến độ/nhiệm vụ/đã lưu | API và quyền hiện hành đã kiểm tra | Trang chủ cá nhân hóa, mở đúng bài và nhiệm vụ |
| 5 | B4, D bản tin, C3 phần cập nhật quy định | Nội dung được duyệt và quan hệ căn cứ | Tra theo công việc và cập nhật liên quan |

Trong đợt 1, các loại tra cứu chưa có dữ liệu chỉ xuất hiện khi nối được chức năng thật; không dựng tab hoạt động giả. Sau mỗi đợt cập nhật tài liệu và nghiệm thu trước khi mở rộng.

## 8. Kiểm chứng và bàn giao

- Kiểm thử nghiệp vụ cho API lọc, tổng kết quả, phân trang, ngày áp dụng và cách kết hợp nhóm; không chỉ kiểm tra giao diện có nút.
- Kiểm thử quyền: khách, chưa xác minh, tài khoản ba nhóm/nhiều nhóm, quản trị theo đơn vị.
- Kiểm tra luồng: trang chủ → tìm → lọc → văn bản → điều khoản → quay lại; trang chủ → tiếp tục học; lưu → mở lại.
- Kiểm tra URL cũ, nội dung lỗi/trống, di động, bàn phím và khả năng đọc nhãn bằng công nghệ hỗ trợ.
- Chạy typecheck/build và các kiểm thử liên quan theo script của dự án sau từng đợt có mã thay đổi.
- Bàn giao danh sách thay đổi, cách kiểm tra, dữ liệu/migration cần chạy và các giới hạn còn lại. Việc triển khai môi trường thật là bước riêng.

## 9. Điểm bắt đầu

Thực hiện đợt 1 trước: kiểm kê các lối vào → dựng /tra-cuu chung → thay nội dung trang chủ → sửa nhãn và menu → kiểm tra di động và URL cũ. Chưa mở rộng AI hoặc thông báo tự động ở đợt này.

## 10. Nguồn tham khảo thiết kế

- CSDL quốc gia về VBPL: https://vbpl.moj.gov.vn/huongdan/khaithac_vbpl.htm — thuộc tính, lịch sử, văn bản liên quan và lược đồ.
- Tư liệu – Văn kiện Đảng: https://tulieuvankien.dangcongsan.vn/ — tổ chức kho tư liệu và văn bản Đảng.
- Hội thi trực tuyến: https://pbgdpl.quangngai.gov.vn/danh-muc/hoi-thi-truc-tuyen — kết nối phổ biến pháp luật với kiểm tra kiến thức.

Các nguồn này là tham khảo cách tổ chức chức năng; nội dung triển khai phải được kiểm tra nguồn và quyền sử dụng riêng.

## 11. Bàn giao đợt 1 — 27/10/2026

- Trang chủ: ô tìm văn bản, ba lối vào học theo nhóm, học/luyện tập và tài liệu/tra cứu; không hiển thị tiến độ hoặc bản tin giả.
- /tra-cuu: cửa vào văn bản, quy trình, biểu mẫu và hướng dẫn. Chưa tạo nhánh Văn bản Đảng riêng vì chưa có bộ lọc tương ứng.
- Menu máy tính/điện thoại tách Học tập và Luyện tập; thi nằm trong khối luyện tập và ngăn tiện ích.
- Các URL công cụ công an/giao thông, dịch vụ Bộ Công an và tra cứu biển báo/mức phạt trả trang thông báo HTTP 410. /tra-cuu có tham số giao thông cũ hiện thông báo trên cửa vào mới; /tra-cuu-nhanh chuyển tới /tra-cuu.
- Công cụ dùng chung công khai giữ đối chiếu địa giới; loại bộ lọc phương tiện/vi phạm khỏi biểu mẫu. Không đổi nhóm tài khoản, phân quyền hoặc xóa dữ liệu.
- Nhóm Công chức tạm dùng danh mục công chức cấp xã đang có; mở rộng phạm vi và rà dữ liệu thuộc đợt 2. Lựa chọn công an không còn xuất hiện trong bộ lọc học công khai.
- Kiểm tra trình duyệt: trang chủ ở 320/390/768/1024 px và Tra cứu ở 390 px không tràn ngang; URL cũ trả thông báo đúng; khách mở nhóm học được dẫn tới đăng nhập kèm URL quay lại.
- Kiểm tra dữ liệu thật: tìm văn bản và hai loại quy trình/biểu mẫu trả HTTP 200 sau khi khởi chạy API cục bộ. Kho biểu mẫu/quy trình hiện chưa có kết quả phù hợp; tìm văn bản vẫn còn nội dung giao thông trong kho cũ. Cần rà danh mục và dữ liệu ở đợt 2, chưa tuyên bố kho đã chuyển hoàn toàn sang ba nhóm.
- Kiểm thử web đã qua 81 trường hợp, thêm 3 trường hợp render trang chủ cho khách/chờ xác minh/đã xác minh đều qua; typecheck web đã qua. Build sản xuất được kiểm tra sau thay đổi.

## 12. Bàn giao nền tảng đợt 2 — 27/10/2026

- Chuẩn hóa nhóm dùng chung thành cong_chuc/vien_chuc/dang_vien; giữ tương thích URL và yêu cầu cũ cong_chuc_cap_xa; từ chối nhóm công an ở API ghi mới.
- Migration 0078–0080 tách mở rộng schema, chuyển dữ liệu có snapshot và chốt ràng buộc. Không đổi quyền/đơn vị hoặc xóa lịch sử học; mục chỉ có nhóm công an trở thành chưa phân nhóm.
- Quản trị người dùng và chuyên đề có bộ lọc chưa phân nhóm để rà. Lựa chọn công an bị loại khỏi toàn bộ biểu mẫu dùng chung.
- Migration 0081 tạo ba lĩnh vực và ba khung chuyên đề nháp, không giả lập bài pháp lý đã duyệt. Biên soạn/đối chiếu nguồn mới là việc tiếp theo trước khi xuất bản.
- Migration 0082 lưu trữ riêng chuyên đề giao thông đã đối chiếu cả slug và tiêu đề, có nhật ký trạng thái trước đổi; không tự xử lý hàng loạt theo từ khóa.
- Công cụ kiểm kê: bun run nhom:kiem-ke. Báo cáo ở outputs/kiem-ke-ba-nhom-dot-2.json chỉ phản ánh CSDL kiểm thử đang cấu hình.
- Hướng dẫn áp dụng, sao lưu và phục hồi: docs/nhom-doi-tuong-hoc-tap.md. Chưa chạy migration hoặc triển khai lên môi trường thật.

Kiểm chứng đợt 2: 115 kiểm thử nhóm/người dùng/migration/web và 403 kiểm thử đào tạo/xác thực/thư viện đều đạt (518 tổng cộng); typecheck toàn workspace, build web và kiểm tra định dạng các tệp thay đổi đều qua. API thực tế trả 200 cho ba nhóm và mã công chức cũ, 400 cho nhóm công an. Bản xem thử đợt 2: http://localhost:4189/ (API kiểm tra 4188).
