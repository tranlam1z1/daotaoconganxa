# Ví dụ xuyên suốt: dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh"

> **Căn cứ tại ngày:** 06/9/2026
> **Trạng thái:** bản nháp do tổ biên soạn dựng, **nội dung chờ pháp chế duyệt**.
> **Lưu ý:** Đây là **ví dụ minh họa được xây dựng cho mục đích đào tạo**. Tên cơ quan, số liệu và tình huống là giả định; không phải hồ sơ của một dự án có thật. Mọi con số dùng trong ví dụ chỉ nhằm minh họa cách vận dụng quy định, không phải định mức hay đơn giá được cơ quan nhà nước công bố.

Tài liệu này là dữ kiện gốc dùng chung cho cả 12 bài học của chuyên đề. Mỗi bài học sẽ lấy một phần dữ kiện ở đây làm đầu vào và tạo ra một sản phẩm tương ứng cho dự án.

---

## 1. Thông tin chung của dự án

| Nội dung | Dữ kiện |
|----------|---------|
| Tên dự án | Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh |
| Chủ đầu tư | Sở Khoa học và Công nghệ tỉnh T |
| Cơ quan chủ quản | Ủy ban nhân dân tỉnh T |
| Người có thẩm quyền quyết định đầu tư | Xác định theo quy định phân cấp của tỉnh T (bài 03 và bài 06 sẽ tra cứu) |
| Nguồn vốn | Vốn đầu tư công, ngân sách tỉnh; tỷ lệ vốn ngân sách nhà nước 100% |
| Tổng mức đầu tư dự kiến | **14.500.000.000 đồng** (mười bốn tỷ năm trăm triệu đồng) |
| Thời gian thực hiện dự kiến | 18 tháng kể từ ngày hợp đồng thi công có hiệu lực |
| Địa điểm triển khai | Trung tâm dữ liệu của tỉnh T; người dùng phân tán tại Sở Khoa học và Công nghệ, các sở, ngành, đơn vị sự nghiệp và tổ chức, cá nhân trong tỉnh |
| Cấp độ an toàn hệ thống thông tin dự kiến | Cấp độ 3 (hồ sơ đề xuất cấp độ lập song song, xem bài 04) |
| Phân loại theo Nghị định 45/2026/NĐ-CP | **Dự án đầu tư hệ thống** (bài 02 sẽ chứng minh) |
| Số bước thiết kế | **Thiết kế 01 bước** do tổng mức đầu tư không quá 20 tỷ đồng (điểm a khoản 2 Điều 9 Nghị định 45/2026/NĐ-CP) |

### Biến thể dùng ở bài 07

Ở bài 07, học viên đổi tổng mức đầu tư từ 14,5 tỷ đồng thành **26.000.000.000 đồng** (do bổ sung hạng mục hạ tầng và mở rộng phạm vi triển khai xuống cấp xã) để quan sát dự án chuyển từ thiết kế 01 bước sang **thiết kế 02 bước**, kéo theo thay đổi về hồ sơ, thẩm quyền thẩm định và trình tự.

---

## 2. Sự cần thiết và hiện trạng

### 2.1 Hiện trạng nghiệp vụ

Sở Khoa học và Công nghệ tỉnh T đang quản lý mỗi năm khoảng 60 đến 80 nhiệm vụ khoa học và công nghệ cấp tỉnh, gồm đề tài, dự án sản xuất thử nghiệm và nhiệm vụ thường xuyên theo chức năng. Toàn bộ quy trình hiện thực hiện thủ công và bán thủ công:

- Tổ chức, cá nhân nộp hồ sơ đề xuất nhiệm vụ bằng bản giấy tại bộ phận một cửa; hồ sơ điện tử chỉ được gửi kèm qua thư điện tử, không có định dạng thống nhất.
- Việc lập hội đồng tư vấn, gửi tài liệu cho thành viên hội đồng, tổng hợp phiếu chấm điểm và lập biên bản đều làm trên tệp văn bản rời rạc.
- Theo dõi tiến độ, kinh phí và báo cáo định kỳ của tổ chức chủ trì thực hiện bằng bảng tính, mỗi chuyên viên giữ một bản.
- Kết quả nhiệm vụ sau nghiệm thu được lưu bản giấy tại kho lưu trữ; việc tra cứu, thống kê phải làm thủ công.
- Chưa kết nối với cơ sở dữ liệu quốc gia về khoa học và công nghệ; số liệu báo cáo về Bộ Khoa học và Công nghệ phải tổng hợp lại từ đầu mỗi kỳ.

### 2.2 Hạn chế cần khắc phục

1. Thời gian xử lý một hồ sơ đề xuất nhiệm vụ trung bình 25 ngày làm việc, phần lớn là thời gian luân chuyển hồ sơ giấy.
2. Không có số liệu tức thời về tiến độ và tình hình sử dụng kinh phí của các nhiệm vụ đang thực hiện.
3. Trùng lặp đề xuất giữa các năm không phát hiện được vì không tra cứu được kho kết quả cũ.
4. Không đáp ứng yêu cầu cung cấp dịch vụ công trực tuyến toàn trình đối với các thủ tục hành chính thuộc lĩnh vực khoa học và công nghệ của tỉnh.
5. Không có nhật ký hệ thống và phân quyền tập trung, rủi ro về an toàn thông tin và về trách nhiệm giải trình.

### 2.3 Mục tiêu của dự án

- Tin học hóa toàn trình vòng đời nhiệm vụ khoa học và công nghệ cấp tỉnh, từ tiếp nhận đề xuất đến lưu trữ và công bố kết quả.
- Rút thời gian xử lý hồ sơ đề xuất nhiệm vụ xuống không quá 10 ngày làm việc.
- Bảo đảm 100% hồ sơ đề xuất nhiệm vụ được nộp trực tuyến và ký số.
- Kết nối, chia sẻ dữ liệu với cơ sở dữ liệu quốc gia về khoa học và công nghệ và với hệ thống định danh, xác thực điện tử.
- Bảo đảm an toàn hệ thống thông tin theo cấp độ được phê duyệt.

---

## 3. Phạm vi và nhóm chức năng

Dự án gồm **08 nhóm chức năng** (tương ứng 08 nhóm trường hợp sử dụng). Đây là dữ kiện gốc cho bài 04 (nội dung báo cáo nghiên cứu khả thi), bài 05 (bảng tính chi phí phần mềm), bài 07 (thiết kế chi tiết) và bài 09 (kịch bản kiểm thử).

### Nhóm 1. Tiếp nhận đề xuất nhiệm vụ khoa học và công nghệ trực tuyến

Tổ chức, cá nhân đăng ký tài khoản, khai biểu mẫu đề xuất trực tuyến, đính kèm tài liệu, ký số và nộp hồ sơ. Hệ thống kiểm tra tính đầy đủ, cấp số tiếp nhận, gửi thông báo và cho phép theo dõi trạng thái hồ sơ.

**Trường hợp sử dụng chính:** đăng ký và xác thực tài khoản; khai và lưu nháp phiếu đề xuất; đính kèm và ký số hồ sơ; nộp hồ sơ và nhận số tiếp nhận; tra cứu trạng thái hồ sơ; yêu cầu bổ sung, hoàn thiện hồ sơ.

### Nhóm 2. Tổ chức hội đồng tư vấn xác định nhiệm vụ

Chuyên viên lập danh sách đề xuất theo lĩnh vực, đề xuất thành phần hội đồng, gửi tài liệu điện tử cho thành viên, thu phiếu nhận xét và phiếu chấm điểm, tổng hợp kết quả và kết xuất biên bản họp hội đồng.

**Trường hợp sử dụng chính:** lập danh mục đề xuất theo đợt; thành lập hội đồng và mời thành viên; gửi tài liệu và theo dõi phản hồi; nhập phiếu nhận xét, phiếu chấm điểm; tổng hợp điểm và xếp hạng; kết xuất biên bản và kết luận hội đồng.

### Nhóm 3. Tuyển chọn hoặc giao trực tiếp tổ chức chủ trì

Công bố danh mục nhiệm vụ đặt hàng, tiếp nhận hồ sơ đăng ký tuyển chọn, tổ chức hội đồng tuyển chọn, thông báo kết quả và hoàn thiện hồ sơ trúng tuyển.

**Trường hợp sử dụng chính:** công bố danh mục nhiệm vụ; tiếp nhận hồ sơ đăng ký tuyển chọn; mở và kiểm tra tính hợp lệ hồ sơ; tổ chức hội đồng tuyển chọn và chấm điểm; thông báo, công khai kết quả; xử lý kiến nghị của tổ chức đăng ký.

### Nhóm 4. Quản lý hợp đồng và kinh phí

Lập và ký hợp đồng thực hiện nhiệm vụ, quản lý dự toán chi tiết theo nội dung chi, theo dõi cấp phát kinh phí theo đợt, xử lý đề nghị điều chỉnh dự toán và điều chỉnh hợp đồng.

**Trường hợp sử dụng chính:** lập và phê duyệt dự toán chi tiết nhiệm vụ; soạn, ký và lưu hợp đồng; đề nghị và duyệt cấp phát kinh phí theo đợt; đề nghị và duyệt điều chỉnh dự toán; thanh lý hợp đồng; đối chiếu số liệu kinh phí với đơn vị tài chính.

### Nhóm 5. Theo dõi tiến độ, báo cáo định kỳ, kiểm tra giữa kỳ

Tổ chức chủ trì cập nhật tiến độ theo mốc, nộp báo cáo định kỳ; cơ quan quản lý lập kế hoạch kiểm tra, ghi nhận kết quả kiểm tra và ra kết luận xử lý.

**Trường hợp sử dụng chính:** khai báo mốc tiến độ và sản phẩm trung gian; nộp báo cáo định kỳ; nhắc việc và cảnh báo chậm tiến độ; lập kế hoạch và biên bản kiểm tra giữa kỳ; xử lý đề nghị gia hạn, điều chỉnh nội dung.

### Nhóm 6. Đánh giá, nghiệm thu cấp tỉnh; lưu trữ và công bố kết quả

Tiếp nhận hồ sơ đề nghị nghiệm thu, tổ chức hội đồng đánh giá nghiệm thu, ghi nhận kết quả xếp loại, lưu trữ hồ sơ và sản phẩm, công bố kết quả để ứng dụng.

**Trường hợp sử dụng chính:** tiếp nhận hồ sơ nghiệm thu; thành lập hội đồng nghiệm thu; nhập phiếu đánh giá và tổng hợp xếp loại; kết xuất biên bản nghiệm thu; lưu trữ hồ sơ và sản phẩm; công bố, chuyển giao kết quả để ứng dụng.

### Nhóm 7. Tra cứu công khai, thống kê và kết nối dữ liệu

Cổng tra cứu công khai danh mục nhiệm vụ và kết quả đã công bố; bộ báo cáo thống kê phục vụ quản lý; kết nối với cơ sở dữ liệu quốc gia về khoa học và công nghệ; đăng nhập bằng tài khoản định danh điện tử.

**Trường hợp sử dụng chính:** tra cứu công khai theo lĩnh vực, năm, tổ chức chủ trì; xem chi tiết kết quả đã công bố; kết xuất báo cáo thống kê định kỳ và theo yêu cầu; đồng bộ dữ liệu với cơ sở dữ liệu quốc gia về khoa học và công nghệ; đăng nhập bằng tài khoản định danh điện tử.

### Nhóm 8. Quản trị hệ thống, phân quyền, nhật ký, sao lưu

Quản trị người dùng và vai trò, cấu hình danh mục dùng chung, quản lý biểu mẫu, theo dõi nhật ký hệ thống, cấu hình và kiểm tra sao lưu, phục hồi.

**Trường hợp sử dụng chính:** quản lý người dùng và vai trò; cấu hình ma trận phân quyền; quản lý danh mục dùng chung; quản lý biểu mẫu và trường dữ liệu; tra cứu nhật ký hệ thống; cấu hình sao lưu và diễn tập phục hồi.

---

## 4. Tác nhân của hệ thống

| # | Tác nhân | Mô tả | Cách tương tác |
|---|----------|-------|----------------|
| 1 | Tổ chức, cá nhân đề xuất nhiệm vụ | Đề xuất nhiệm vụ, đăng ký tuyển chọn | Giao diện web công khai, ký số |
| 2 | Tổ chức chủ trì nhiệm vụ | Thực hiện nhiệm vụ đã được giao | Giao diện web, tài khoản cấp riêng |
| 3 | Chủ nhiệm nhiệm vụ | Cập nhật tiến độ, nộp báo cáo, hồ sơ nghiệm thu | Giao diện web |
| 4 | Chuyên viên quản lý nhiệm vụ (Sở Khoa học và Công nghệ) | Xử lý hồ sơ, tổ chức hội đồng, theo dõi tiến độ | Giao diện web nội bộ |
| 5 | Lãnh đạo phòng chuyên môn | Duyệt cấp phòng, phân công xử lý | Giao diện web nội bộ |
| 6 | Lãnh đạo Sở Khoa học và Công nghệ | Phê duyệt, ký ban hành | Giao diện web nội bộ, ký số |
| 7 | Thành viên hội đồng tư vấn, hội đồng tuyển chọn, hội đồng nghiệm thu | Nhận tài liệu, chấm điểm, nhận xét | Giao diện web, tài khoản tạm theo phiên họp |
| 8 | Chuyên viên tài chính - kế toán | Theo dõi dự toán, cấp phát, đối chiếu kinh phí | Giao diện web nội bộ |
| 9 | Quản trị hệ thống | Quản trị người dùng, cấu hình, nhật ký, sao lưu | Giao diện quản trị |
| 10 | Người dân, tổ chức tra cứu công khai | Tra cứu danh mục và kết quả đã công bố | Cổng công khai, không cần đăng nhập |
| 11 | Hệ thống định danh và xác thực điện tử | Xác thực người dùng | Giao tiếp máy - máy |
| 12 | Cơ sở dữ liệu quốc gia về khoa học và công nghệ | Nhận và đối soát dữ liệu nhiệm vụ | Giao tiếp máy - máy |
| 13 | Hệ thống quản lý văn bản và điều hành của tỉnh | Trao đổi văn bản đi, đến | Giao tiếp máy - máy |

---

## 5. Yêu cầu phi chức năng

| Nhóm | Yêu cầu |
|------|---------|
| Hiệu năng | Đáp ứng đồng thời 300 người dùng; thời gian phản hồi trung bình dưới 3 giây với thao tác thông thường; dưới 10 giây với báo cáo tổng hợp |
| Khả năng chịu tải cao điểm | Đợt nộp hồ sơ đề xuất tập trung có thể lên tới 1.500 hồ sơ trong 15 ngày |
| Dung lượng | Dự kiến 200 GB dữ liệu và tệp đính kèm trong 5 năm đầu |
| An toàn thông tin | Bảo đảm an toàn hệ thống thông tin theo cấp độ được phê duyệt; ghi nhật ký truy cập tối thiểu 12 tháng; sao lưu hằng ngày, diễn tập phục hồi định kỳ |
| Bảo vệ dữ liệu cá nhân | Thu thập tối thiểu; có cơ chế đồng ý và rút lại đồng ý; phân quyền theo vai trò |
| Kết nối, liên thông | Tuân thủ Khung kiến trúc tổng thể quốc gia số; cung cấp giao diện lập trình ứng dụng theo chuẩn để chia sẻ dữ liệu (Điều 4 Nghị định 45/2026/NĐ-CP) |
| Tính sẵn sàng với IPv6 | Hệ thống hoạt động trên môi trường Internet, phải bảo đảm tính sẵn sàng với IPv6 hoặc có giải pháp nâng cấp bảo đảm sẵn sàng với IPv6 (điểm a khoản 2 Điều 14 và điểm e khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP) |
| Ký số | Hỗ trợ ký số trên hồ sơ nộp vào và trên văn bản kết xuất |
| Khả năng truy cập | Giao diện đáp ứng trên thiết bị di động; tuân thủ yêu cầu về khả năng tiếp cận đối với cổng thông tin của cơ quan nhà nước |
| Ngôn ngữ | Tiếng Việt; bảng mã Unicode dựng sẵn |

---

## 6. Cơ cấu chi phí dự kiến (dữ kiện cho bài 05)

Các con số dưới đây là **giả định phục vụ đào tạo**, dùng để học viên thực hành cách sắp xếp khoản mục chi phí theo khoản 2 Điều 16 Nghị định 45/2026/NĐ-CP. Đây **không** phải định mức hay đơn giá do cơ quan nhà nước công bố.

| Khoản mục theo khoản 2 Điều 16 | Nội dung trong dự án ví dụ | Giá trị giả định (đồng) |
|-------------------------------|----------------------------|-------------------------|
| a) Chi phí trang thiết bị | Xây dựng, phát triển phần mềm nội bộ (08 nhóm chức năng) | 8.200.000.000 |
| a) Chi phí trang thiết bị | Phần mềm thương mại (hệ quản trị cơ sở dữ liệu, phần mềm nền tảng) và dịch vụ hỗ trợ đi kèm | 1.150.000.000 |
| a) Chi phí trang thiết bị | Thiết bị phần cứng bổ sung đặt tại trung tâm dữ liệu của tỉnh | 1.600.000.000 |
| a) Chi phí trang thiết bị | Tạo lập cơ sở dữ liệu, chuẩn hóa, chuyển đổi và nhập dữ liệu từ hồ sơ giấy và bảng tính | 850.000.000 |
| a) Chi phí trang thiết bị | Lắp đặt thiết bị, cài đặt phần mềm, kiểm tra và hiệu chỉnh | 180.000.000 |
| a) Chi phí trang thiết bị | Đào tạo, tập huấn hướng dẫn sử dụng và đào tạo quản trị, vận hành | 320.000.000 |
| a) Chi phí trang thiết bị | Triển khai, hỗ trợ, quản trị, vận hành sản phẩm trước khi nghiệm thu bàn giao toàn bộ | 250.000.000 |
| b) Chi phí quản lý dự án | Quản lý dự án của chủ đầu tư | 290.000.000 |
| c) Chi phí tư vấn đầu tư | Lập báo cáo nghiên cứu khả thi; lập thiết kế chi tiết và dự toán; lập hồ sơ mời thầu và đánh giá hồ sơ dự thầu; giám sát công tác triển khai; kiểm thử độc lập | 720.000.000 |
| d) Chi phí khác | Thẩm tra, thẩm định; kiểm toán; thẩm tra phê duyệt quyết toán; thẩm định giá; hồ sơ đề xuất cấp độ an toàn hệ thống thông tin | 240.000.000 |
| đ) Chi phí dự phòng | Dự phòng cho khối lượng phát sinh và cho yếu tố trượt giá | 700.000.000 |
| **Tổng mức đầu tư** | | **14.500.000.000** |

Bảng kê 08 nhóm chức năng phục vụ tính chi phí phần mềm nội bộ được trình bày ở biểu mẫu `bieu-mau/03-bang-tinh-chi-phi-phan-mem-theo-use-case.md`.

---

## 7. Các mốc thời gian giả định

| Mốc | Thời điểm | Bài học liên quan |
|-----|-----------|-------------------|
| Đề xuất chủ trương đầu tư | Tháng 4/2026 | Bài 03 |
| Quyết định chủ trương đầu tư | Tháng 6/2026 | Bài 03 |
| Lập báo cáo nghiên cứu khả thi | Tháng 7/2026 đến tháng 8/2026 | Bài 04, bài 05 |
| Thẩm định, quyết định đầu tư | Tháng 9/2026 | Bài 06 |
| Lập, thẩm định, phê duyệt thiết kế chi tiết và dự toán | Tháng 10/2026 | Bài 07 |
| Phê duyệt kế hoạch lựa chọn nhà thầu, tổ chức đấu thầu | Tháng 11/2026 đến tháng 01/2027 | Bài 08 |
| Triển khai, kiểm thử, vận hành thử, đào tạo | Tháng 02/2027 đến tháng 4/2028 | Bài 09 |
| Nghiệm thu, bàn giao, đưa vào sử dụng | Tháng 5/2028 | Bài 10 |
| Bảo hành | 12 tháng kể từ khi nghiệm thu bàn giao (dự án nhóm C) | Bài 10 |
| Quyết toán vốn đầu tư dự án hoàn thành | Sau khi hoàn thành, theo quy định của pháp luật về quyết toán | Bài 10 |

> **Lưu ý về phân nhóm dự án:** việc dự án thuộc nhóm A, nhóm B hay nhóm C được xác định theo tiêu chí phân loại của Luật Đầu tư công. Với tổng mức đầu tư 14,5 tỷ đồng, dự án ví dụ được giả định là **dự án nhóm C** để minh họa các mốc thời hạn của nhóm B, nhóm C. Học viên phải tự đối chiếu tiêu chí phân loại tại `[CẦN ĐỐI CHIẾU: điều quy định tiêu chí phân loại dự án nhóm A, B, C đối với dự án công nghệ thông tin trong Luật Đầu tư công số 58/2024/QH15]` trước khi áp dụng cho dự án thật.

---

## 8. Sản phẩm học viên tạo ra qua từng bài

| Bài | Sản phẩm |
|-----|----------|
| 01 | Bản đồ pháp lý của dự án: danh mục văn bản áp dụng theo thứ bậc, kèm trạng thái hiệu lực tại ngày lập |
| 02 | Phiếu xác định lối đi pháp lý: dự án đầu tư hệ thống, dự án mua sắm, dự án thuê dịch vụ hay nhiệm vụ chi thường xuyên |
| 03 | Báo cáo đề xuất chủ trương đầu tư (khung nội dung và phần sự cần thiết) |
| 04 | Mục lục báo cáo nghiên cứu khả thi và phần thuyết minh yêu cầu chức năng, phi chức năng |
| 05 | Bảng tính tổng mức đầu tư theo khoản mục và bảng kê chức năng phần mềm nội bộ |
| 06 | Tờ trình thẩm định, danh mục hồ sơ trình và bảng theo dõi thời hạn |
| 07 | Đề cương thiết kế chi tiết: mô hình tổng thể, mô hình lô-gic, mô hình vật lý |
| 08 | Kế hoạch lựa chọn nhà thầu: phân chia gói thầu, hình thức, phương thức, loại hợp đồng |
| 09 | Kịch bản kiểm thử cho một nhóm chức năng và kế hoạch vận hành thử |
| 10 | Biên bản nghiệm thu, danh mục hồ sơ hoàn thành và danh mục hồ sơ quyết toán |
| 11 | Đề cương nhiệm vụ tư vấn và dự toán chi phí tư vấn |
| 12 | Danh mục tự kiểm tra tuân thủ trước khi trình thẩm định và trước khi quyết toán |
