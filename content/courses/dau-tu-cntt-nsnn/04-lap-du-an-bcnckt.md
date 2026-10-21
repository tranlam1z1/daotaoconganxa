---
course: dau-tu-cntt-nsnn
slug: 04-lap-du-an-bcnckt
ordinal: 4
title: "Lập dự án: báo cáo nghiên cứu khả thi và báo cáo kinh tế - kỹ thuật"
as_of: 2026-09-06
status: draft
review_state: cho_phap_che_duyet
---

# Bài 04. Lập dự án: báo cáo nghiên cứu khả thi và báo cáo kinh tế - kỹ thuật

> **Căn cứ tại ngày:** 06/9/2026
> **Trạng thái:** bản nháp, **nội dung chờ pháp chế duyệt**. Trước khi sử dụng để giảng dạy hoặc lập hồ sơ dự án, phải đối chiếu với toàn văn văn bản còn hiệu lực.
>
> **CẢNH BÁO HIỆU LỰC.** Nghị định số 45/2026/NĐ-CP **đã hết hiệu lực kể từ ngày 01/7/2026**, bị thay thế bởi Nghị định số 224/2026/NĐ-CP ngày 24/6/2026 của Chính phủ quy định chi tiết một số điều và biện pháp thi hành Luật Chuyển đổi số (điểm a khoản 2 Điều 90 Nghị định số 224/2026/NĐ-CP). Bài học này áp dụng trực tiếp cho **nhóm dự án chuyển tiếp**: dự án đã được quyết định đầu tư hoặc đã có báo cáo thẩm định trước ngày 01/7/2026 (Điều 91 Nghị định số 224/2026/NĐ-CP). Với dự án khởi động sau ngày 01/7/2026, phải đối chiếu sang Nghị định số 224/2026/NĐ-CP, Thông tư số 39/2026/TT-BKHCN và Thông tư số 41/2026/TT-BKHCN. Xem Bài 01 mục 6.

## Mục tiêu bài học

Sau khi hoàn thành bài học, học viên có thể:

- Xác định đúng khung nội dung của báo cáo nghiên cứu khả thi tương ứng với từng loại dự án theo Điều 12 Nghị định số 45/2026/NĐ-CP.
- Chỉ ra được quan hệ giữa nội dung báo cáo nghiên cứu khả thi với số bước thiết kế: thuyết minh thiết kế cơ sở hay thuyết minh thiết kế chi tiết.
- Viết được phần thuyết minh yêu cầu chức năng và yêu cầu phi chức năng cho một hạng mục phần mềm nội bộ theo Điều 15.
- Đưa được các yêu cầu về tuân thủ Khung kiến trúc tổng thể quốc gia số, tính sẵn sàng với IPv6 và bảo đảm an toàn hệ thống thông tin theo cấp độ vào đúng chỗ trong hồ sơ.
- Lập được mục lục báo cáo nghiên cứu khả thi có ánh xạ từng mục tới điều, khoản, điểm làm căn cứ.

## Căn cứ pháp lý của bài học

| # | Căn cứ | Nội dung điều chỉnh |
|---|--------|---------------------|
| 1 | Điều 12 Nghị định số 45/2026/NĐ-CP ngày 26/01/2026 của Chính phủ quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước | Nội dung báo cáo nghiên cứu khả thi, báo cáo kinh tế - kỹ thuật cho ba loại dự án |
| 2 | Điều 9 Nghị định số 45/2026/NĐ-CP | Thiết kế dự án; điều kiện áp dụng thiết kế 01 bước và 02 bước |
| 3 | Điều 13 Nghị định số 45/2026/NĐ-CP | Thiết kế cơ sở |
| 4 | Điều 14 Nghị định số 45/2026/NĐ-CP | Thiết kế chi tiết |
| 5 | Điều 15 Nghị định số 45/2026/NĐ-CP | Mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ |
| 6 | Điều 4 Nghị định số 45/2026/NĐ-CP | Tuân thủ Khung kiến trúc tổng thể quốc gia số và bảo đảm khả năng kết nối, liên thông, chia sẻ dữ liệu |
| 7 | Điều 16 Nghị định số 45/2026/NĐ-CP | Tổng mức đầu tư — một nội dung bắt buộc của báo cáo nghiên cứu khả thi theo khoản 4 Điều 12 |
| 8 | Khoản 1 Điều 17 Nghị định số 45/2026/NĐ-CP | Thẩm tra báo cáo nghiên cứu khả thi |
| 9 | Khoản 2 Điều 47 Luật Đầu tư công số 58/2024/QH15 của Quốc hội ngày 29/11/2024, được sửa đổi, bổ sung bởi Luật số 90/2025/QH15 | Nội dung báo cáo nghiên cứu khả thi chương trình, dự án — khung chung mà Điều 12 dẫn chiếu tới |
| 10 | Điều 45 Nghị định số 224/2026/NĐ-CP ngày 24/6/2026 của Chính phủ quy định chi tiết một số điều và biện pháp thi hành Luật Chuyển đổi số | Điều tương ứng về nội dung báo cáo nghiên cứu khả thi áp dụng cho dự án khởi động từ ngày 01/7/2026 |

## Nội dung

### 1. Sản phẩm của bước lập dự án và vị trí của nó

Sau khi có quyết định chủ trương đầu tư, chủ đầu tư chuyển sang bước lập dự án. Sản phẩm của bước này là **báo cáo nghiên cứu khả thi** hoặc **báo cáo kinh tế - kỹ thuật**, kèm hồ sơ trình thẩm định. Đây là hồ sơ mà hội đồng thẩm định hoặc cơ quan chuyên môn thẩm định theo Điều 17 và là hồ sơ mà người có thẩm quyền căn cứ vào đó ra quyết định đầu tư theo Điều 11.

Đặc điểm quan trọng nhất của bước này trong lĩnh vực công nghệ thông tin: **báo cáo nghiên cứu khả thi không chỉ là tài liệu kinh tế, nó chứa cả thiết kế**. Điều 12 quy định báo cáo nghiên cứu khả thi của dự án đầu tư hệ thống phải thuyết minh rõ thiết kế cơ sở theo Điều 13 hoặc thiết kế chi tiết theo Điều 14, tùy theo dự án áp dụng thiết kế 02 bước hay 01 bước. Vì vậy, chất lượng của bước lập dự án phụ thuộc trực tiếp vào chất lượng khảo sát hiện trạng và mô tả yêu cầu, chứ không phụ thuộc vào cách trình bày.

### 2. Báo cáo nghiên cứu khả thi hay báo cáo kinh tế - kỹ thuật

Tên Điều 12 Nghị định số 45/2026/NĐ-CP là "Nội dung báo cáo nghiên cứu khả thi, báo cáo kinh tế - kỹ thuật", tức nghị định điều chỉnh cả hai loại hồ sơ và quy định nội dung chung cho cả hai. Việc **một dự án cụ thể thuộc trường hợp chỉ phải lập báo cáo kinh tế - kỹ thuật hay phải lập báo cáo nghiên cứu khả thi** không do Nghị định số 45/2026/NĐ-CP quyết định mà do pháp luật về đầu tư công quyết định.

`[CẦN ĐỐI CHIẾU: điều, khoản của Luật Đầu tư công số 58/2024/QH15 quy định trường hợp dự án chỉ phải lập báo cáo kinh tế - kỹ thuật và tiêu chí xác định trường hợp đó; tài liệu nguồn mới xác minh tên Điều 38, Điều 39, Điều 43, Điều 44, Điều 47, Điều 89 của luật này]`

Trong khi chưa tra cứu được, nguyên tắc làm việc an toàn là: lập **báo cáo nghiên cứu khả thi** đầy đủ theo Điều 12, và chỉ giản lược khi đã tra cứu và khẳng định được dự án thuộc trường hợp lập báo cáo kinh tế - kỹ thuật. Giản lược trước khi tra cứu là rủi ro; làm đủ rồi rút gọn thì không.

### 3. Khung nội dung theo Điều 12 — ba khung cho ba loại dự án

Điều 12 dẫn chiếu tới khoản 2 Điều 47 Luật Đầu tư công về khung nội dung chung, sau đó bổ sung nội dung đặc thù cho từng loại dự án đã phân loại theo khoản 1 Điều 7.

| Loại dự án | Nội dung đặc thù bắt buộc | Căn cứ |
|------------|---------------------------|--------|
| Dự án đầu tư hệ thống | Thuyết minh rõ thiết kế cơ sở theo Điều 13 (nếu thiết kế 02 bước) hoặc thiết kế chi tiết theo Điều 14 (nếu thiết kế 01 bước) | khoản 1 Điều 12 |
| Dự án mua sắm | a) Đánh giá việc tuân thủ Khung kiến trúc tổng thể quốc gia số theo Điều 4; b) Thống kê khối lượng, danh mục thiết bị, phần mềm thương mại; c) Khối lượng đào tạo, quản trị, vận hành | khoản 2 Điều 12 |
| Dự án thuê dịch vụ công nghệ thông tin | a) Tuân thủ Khung kiến trúc tổng thể quốc gia số; b) Yêu cầu chất lượng dịch vụ, kết nối, liên thông, chia sẻ dữ liệu; c) **Sở hữu thông tin, dữ liệu hình thành trong quá trình thuê và phương án chuyển giao cho bên thuê** | khoản 3 Điều 12 |
| Cả ba loại | Tổng mức đầu tư xác định theo Điều 16 | khoản 4 Điều 12 |

Điểm c khoản 3 Điều 12 là nội dung mà người soạn hồ sơ dự án thuê dịch vụ hay bỏ sót nhất, trong khi đó lại là nội dung quyết định việc cơ quan nhà nước có giữ được dữ liệu của mình khi chấm dứt hợp đồng thuê hay không. Nội dung này gắn với khoản 2 Điều 24: sau khi kết thúc thời gian thuê, nhà thầu phải bàn giao toàn bộ thông tin, dữ liệu hình thành trong quá trình thuê cho chủ đầu tư.

**Quan hệ với số bước thiết kế.** Với dự án đầu tư hệ thống, phải xác định số bước thiết kế trước khi viết báo cáo nghiên cứu khả thi, vì nó quyết định nội dung phải thuyết minh:

- Thiết kế **01 bước** = thiết kế chi tiết (khoản 1 Điều 9); áp dụng với dự án có tổng mức đầu tư **không quá 20 tỷ đồng** (điểm a khoản 2 Điều 9), hoặc với dự án khác nếu chủ đầu tư xét thấy có thể thiết kế 01 bước và báo cáo cấp có thẩm quyền quyết định đầu tư cho phép (điểm b khoản 2 Điều 9). Báo cáo nghiên cứu khả thi thuyết minh **thiết kế chi tiết** theo Điều 14.
- Thiết kế **02 bước** = thiết kế cơ sở và thiết kế chi tiết (khoản 1 Điều 9); áp dụng với các dự án còn lại (khoản 3 Điều 9). Báo cáo nghiên cứu khả thi thuyết minh **thiết kế cơ sở** theo Điều 13; thiết kế chi tiết lập ở giai đoạn thực hiện đầu tư.

### 4. Thuyết minh hiện trạng và sự cần thiết — phần quyết định chất lượng cả hồ sơ

Phần hiện trạng là phần duy nhất trong báo cáo nghiên cứu khả thi không thể sao chép từ dự án khác, và là phần mà hội đồng thẩm định dùng để kiểm tra tính xác thực của toàn bộ phần còn lại. Bốn nhóm nội dung phải có:

**Hiện trạng nghiệp vụ.** Mô tả quy trình đang vận hành, khối lượng công việc theo năm, thời gian xử lý trung bình, số người tham gia, điểm nghẽn. Số liệu phải là số đo được, không phải nhận định. Ví dụ, "thời gian xử lý một hồ sơ trung bình 25 ngày làm việc" là số đo được; "thủ tục còn rườm rà" là nhận định và không dùng làm căn cứ.

**Hiện trạng hệ thống thông tin và hạ tầng.** Các hệ thống đang có, công nghệ, tình trạng bản quyền, mức độ sử dụng, khả năng kết nối, hạ tầng đặt tại đâu, dung lượng còn lại. Phần này là căn cứ để phân biệt đầu tư mới với nâng cấp phần mềm (khoản 12 Điều 3) hay mở rộng phần mềm (khoản 11 Điều 3).

**Hiện trạng dữ liệu.** Khối lượng hồ sơ, tình trạng số hóa, chất lượng dữ liệu, mức độ chuẩn hóa. Đây là căn cứ trực tiếp cho khoản mục chi phí tạo lập cơ sở dữ liệu, chuẩn hóa, chuyển đổi và nhập dữ liệu tại điểm a khoản 2 Điều 16.

**Kết quả tra cứu danh mục phần mềm phổ biến.** Ghi rõ ngày tra cứu, phiên bản danh mục và kết luận; nếu một phần phạm vi đã có phần mềm phổ biến đáp ứng thì phần đó theo trình tự phần mềm thương mại (khoản 4 Điều 5) và phải được tách ra khỏi phạm vi phần mềm nội bộ.

Từ bốn nhóm hiện trạng này mới rút ra được sự cần thiết đầu tư, mục tiêu và phạm vi. Trình tự ngược lại — viết mục tiêu trước rồi bổ sung hiện trạng cho khớp — là nguyên nhân của phần lớn hồ sơ bị trả lại.

### 5. Yêu cầu chức năng, yêu cầu phi chức năng và Điều 15

Với dự án có hạng mục phần mềm nội bộ, Điều 15 Nghị định số 45/2026/NĐ-CP quy định về **mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ**. Đây là tài liệu chuyển tiếp giữa nghiệp vụ và kỹ thuật, đồng thời là căn cứ để xác định chi phí phần mềm nội bộ ở bài 05 và là căn cứ để xây dựng kịch bản kiểm thử ở bài 09.

**Yêu cầu chức năng** được mô tả theo nhóm chức năng và trường hợp sử dụng. Mỗi trường hợp sử dụng nên có: tên; tác nhân; điều kiện bắt đầu; luồng chính; luồng thay thế và luồng ngoại lệ; kết quả đầu ra; quy tắc nghiệp vụ áp dụng; dữ liệu vào và ra. Mức chi tiết phải đủ để một nhà thầu chưa biết nghiệp vụ có thể ước lượng được khối lượng công việc — đây là tiêu chí kiểm tra thực tế duy nhất có ý nghĩa.

**Yêu cầu phi chức năng** được quy định tại khoản 2 Điều 15, trong đó điểm e nêu rõ:

> Yêu cầu về tính sẵn sàng với IPv6 hoặc giải pháp nâng cấp bảo đảm sẵn sàng với IPv6 nếu hoạt động trên môi trường Internet

Yêu cầu IPv6 xuất hiện ở ba chỗ và phải nhất quán giữa ba chỗ đó: điểm a khoản 2 Điều 13 đối với thiết kế cơ sở, điểm a khoản 2 Điều 14 đối với thiết kế chi tiết, và điểm e khoản 2 Điều 15 đối với yêu cầu phi chức năng của phần mềm nội bộ. Nếu hệ thống hoạt động trên môi trường Internet mà hồ sơ không nêu yêu cầu này thì thiếu nội dung bắt buộc.

`[CẦN ĐỐI CHIẾU: nội dung đầy đủ các điểm còn lại của khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP về yêu cầu phi chức năng của phần mềm nội bộ; tài liệu nguồn mới xác minh nguyên văn điểm e]`

Ngoài các yêu cầu do nghị định quy định, hồ sơ thường bổ sung các nhóm yêu cầu phi chức năng theo thông lệ kỹ thuật: hiệu năng, khả năng chịu tải cao điểm, dung lượng, khả năng mở rộng, khả năng truy cập, ngôn ngữ và bảng mã, khả năng sao lưu và phục hồi. Các nhóm này nếu dựa trên tiêu chuẩn quốc gia thì đặt ở phần "căn cứ kỹ thuật", không đặt ở phần "căn cứ pháp lý".

### 6. Kiến trúc, Khung kiến trúc tổng thể quốc gia số và an toàn thông tin theo cấp độ

**Tuân thủ Khung kiến trúc tổng thể quốc gia số.** Điều 4 Nghị định số 45/2026/NĐ-CP đặt yêu cầu tuân thủ Khung kiến trúc tổng thể quốc gia số và bảo đảm khả năng kết nối, liên thông, chia sẻ dữ liệu. Với dự án mua sắm, khoản 2 Điều 12 yêu cầu báo cáo nghiên cứu khả thi phải có nội dung **đánh giá việc tuân thủ**; với dự án thuê dịch vụ, điểm a khoản 3 Điều 12 đặt yêu cầu tương tự. Trong thực tiễn, nội dung này được trình bày dưới dạng bảng đối chiếu: từng thành phần kiến trúc của dự án đối chiếu với thành phần tương ứng của khung kiến trúc, kèm kết luận phù hợp hoặc không phù hợp và lý do.

**Phần kiến trúc của báo cáo.** Với dự án đầu tư hệ thống, phần kiến trúc nằm trong nội dung thuyết minh thiết kế cơ sở (Điều 13) hoặc thiết kế chi tiết (Điều 14). Các khái niệm nền tảng được định nghĩa tại Điều 3: mô hình tổng thể (khoản 8), mô hình lô-gic (khoản 9), mô hình vật lý (khoản 10). Thứ tự trình bày hợp lý là: mô hình tổng thể trước, rồi mô hình lô-gic, rồi mô hình vật lý; kèm theo là phương án tích hợp, kết nối với hệ thống bên ngoài và phương án dữ liệu.

**An toàn hệ thống thông tin theo cấp độ.** Đây là nội dung bắt buộc đối với hệ thống thông tin của cơ quan nhà nước, nhưng được quy định ở một nghị định chuyên ngành khác, không nằm trong Nghị định số 45/2026/NĐ-CP.

`[CẦN ĐỐI CHIẾU: số hiệu, ngày ban hành và tình trạng hiệu lực của nghị định quy định về bảo đảm an toàn hệ thống thông tin theo cấp độ tại ngày 06/9/2026; tài liệu nguồn ghi rõ chưa xác minh được văn bản này]`

`[CẦN ĐỐI CHIẾU: tiêu chí xác định cấp độ an toàn hệ thống thông tin và thẩm quyền phê duyệt hồ sơ đề xuất cấp độ; nội dung này thuộc nghị định về an toàn hệ thống thông tin theo cấp độ chưa xác minh được số hiệu]`

Về mặt hồ sơ, hai việc phải làm song song: báo cáo nghiên cứu khả thi thuyết minh giải pháp bảo đảm an toàn thông tin tương ứng với cấp độ dự kiến; đồng thời lập hồ sơ đề xuất cấp độ theo pháp luật chuyên ngành. Chi phí lập hồ sơ đề xuất cấp độ được xếp vào **chi phí khác** trong tổng mức đầu tư (điểm d khoản 2 Điều 16).

### 7. Tổng mức đầu tư, thẩm tra và đối chiếu sang Nghị định số 224/2026/NĐ-CP

**Tổng mức đầu tư.** Khoản 4 Điều 12 quy định tổng mức đầu tư là một nội dung của báo cáo nghiên cứu khả thi và được xác định theo Điều 16. Cơ cấu khoản mục và các phương pháp xác định chi phí là nội dung của bài 05.

**Thẩm tra.** Khoản 1 Điều 17 cho phép thẩm tra báo cáo nghiên cứu khả thi và chủ đầu tư được thuê tổ chức, cá nhân thực hiện thẩm tra. Cần phân biệt rõ: **thẩm tra** là hoạt động do chủ đầu tư chủ động tổ chức để nâng chất lượng hồ sơ trước khi trình; **thẩm định** là hoạt động của cơ quan đầu mối thẩm định hoặc hội đồng thẩm định theo khoản 2 Điều 17. Chi phí thẩm tra thuộc chi phí khác, chi phí thuê tư vấn lập báo cáo nghiên cứu khả thi thuộc chi phí tư vấn đầu tư (điểm c, điểm d khoản 2 Điều 16).

**Đối chiếu sang Nghị định số 224/2026/NĐ-CP.**

| Nội dung | Nghị định 45/2026/NĐ-CP | Nghị định 224/2026/NĐ-CP |
|----------|-------------------------|--------------------------|
| Nội dung báo cáo nghiên cứu khả thi | Điều 12 | **Điều 45** |
| Thiết kế dự án, ngưỡng 01 bước 20 tỷ đồng | Điều 9, điểm a khoản 2 Điều 9 | Điều 42, điểm a khoản 2 Điều 42 |
| Thiết kế cơ sở | Điều 13 | Điều 46 |
| Thiết kế chi tiết | Điều 14 | Điều 47 |
| Mô tả yêu cầu kỹ thuật phần mềm nội bộ | Điều 15 | Điều 48 |
| Khung kiến trúc, kết nối, chia sẻ dữ liệu | Điều 4 | Điều 37, bổ sung yêu cầu về an ninh mạng |
| Tổng mức đầu tư | Điều 16 | Điều 49 |
| Thẩm tra, thẩm định | Điều 17 | Điều 50 |
| Đầu tư hệ thống thông tin, phần cứng, phần mềm, cơ sở dữ liệu | khoản 5 Điều 3 | **khoản 3 Điều 3** |
| Phần mềm nội bộ | khoản 13 Điều 3 | **khoản 11 Điều 3** |

Hai thay đổi thực chất ảnh hưởng trực tiếp tới nội dung báo cáo nghiên cứu khả thi: khoản 1 Điều 45 Nghị định số 224/2026/NĐ-CP bổ sung yêu cầu thuyết minh **sự phù hợp với Kế hoạch chuyển đổi số** (dự án không nằm trong kế hoạch chuyển đổi số phải thuyết minh riêng theo khoản 4 Điều 45); và Điều 47 bổ sung yêu cầu về **mức độ chịu đựng sai hỏng** của phần mềm trong thiết kế chi tiết.

`[CẦN ĐỐI CHIẾU: toàn văn Điều 45 và Điều 48 Nghị định số 224/2026/NĐ-CP; tài liệu nguồn mới xác minh tên điều và một số điểm thay đổi, chưa đối chiếu nội dung từng khoản]`

### 8. Những điểm dễ nhầm

**Nhầm thứ nhất: coi báo cáo nghiên cứu khả thi là tài liệu thuần kinh tế, tách rời thiết kế.** Khoản 1 Điều 12 buộc báo cáo nghiên cứu khả thi của dự án đầu tư hệ thống phải thuyết minh rõ thiết kế cơ sở theo Điều 13 hoặc thiết kế chi tiết theo Điều 14. Hồ sơ chỉ có phần kinh tế mà không có phần thiết kế tương ứng là thiếu nội dung bắt buộc.

**Nhầm thứ hai: dùng khung nội dung của loại dự án này cho loại dự án khác.** Điều 12 có ba khung khác nhau tại khoản 1, khoản 2 và khoản 3. Rõ nhất là hồ sơ dự án thuê dịch vụ mà thiếu nội dung về sở hữu thông tin, dữ liệu hình thành trong quá trình thuê và phương án chuyển giao cho bên thuê (điểm c khoản 3 Điều 12).

**Nhầm thứ ba: bỏ yêu cầu về tính sẵn sàng với IPv6 vì cho rằng hệ thống chạy trong mạng nội bộ.** Điều kiện áp dụng là hệ thống có nội dung liên quan hoạt động trên môi trường Internet. Một hệ thống có cổng tra cứu công khai, có tiếp nhận hồ sơ trực tuyến hoặc có kết nối ra cơ sở dữ liệu quốc gia qua Internet thì thuộc trường hợp phải nêu yêu cầu này (điểm a khoản 2 Điều 13, điểm a khoản 2 Điều 14, điểm e khoản 2 Điều 15).

**Nhầm thứ tư: nhầm thẩm tra với thẩm định.** Thẩm tra là hoạt động chủ đầu tư chủ động tổ chức, được thuê tổ chức, cá nhân thực hiện (khoản 1 Điều 17); thẩm định là hoạt động của đầu mối thẩm định hoặc hội đồng thẩm định (khoản 2 Điều 17). Kết quả thẩm tra không thay thế được báo cáo thẩm định, và ngược lại.

## Áp dụng cho dự án ví dụ

Dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh", chủ đầu tư Sở Khoa học và Công nghệ tỉnh T, tổng mức đầu tư 14,5 tỷ đồng, 08 nhóm chức năng, dự án nhóm C. Mốc lập báo cáo nghiên cứu khả thi là tháng 7/2026 đến tháng 8/2026.

**Bước 1 — Xác định khung nội dung phải áp dụng.**

| Câu hỏi | Kết luận | Căn cứ |
|---------|----------|--------|
| Loại dự án | Dự án đầu tư hệ thống, có hạng mục phần mềm nội bộ | điểm a khoản 1 Điều 7; khoản 5 Điều 3 |
| Khung nội dung báo cáo nghiên cứu khả thi | Khoản 1 Điều 12 | khoản 1 Điều 12 |
| Số bước thiết kế | 01 bước, do tổng mức đầu tư 14,5 tỷ đồng không quá 20 tỷ đồng | điểm a khoản 2 Điều 9 |
| Nội dung thiết kế phải thuyết minh trong báo cáo | **Thiết kế chi tiết** theo Điều 14, không phải thiết kế cơ sở | khoản 1 Điều 12; khoản 1 Điều 9 |
| Có phải mô tả yêu cầu kỹ thuật phần mềm nội bộ | Có | Điều 15 |
| Tổng mức đầu tư | Theo khoản 2 Điều 16 | khoản 4 Điều 12; khoản 2 Điều 16 |

**Bước 2 — Mục lục báo cáo nghiên cứu khả thi có ánh xạ căn cứ.**

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| Phần A | Căn cứ pháp lý và căn cứ kỹ thuật (tách riêng hai nhóm) | Bài 01 |
| I | Sự cần thiết đầu tư; hiện trạng nghiệp vụ, hệ thống, dữ liệu; kết quả tra cứu danh mục phần mềm phổ biến | khoản 2 Điều 47 Luật Đầu tư công; khoản 3, khoản 4 Điều 5 |
| II | Mục tiêu, phạm vi, quy mô; danh mục 08 nhóm chức năng | khoản 2 Điều 47 Luật Đầu tư công |
| III | Đánh giá tuân thủ Khung kiến trúc tổng thể quốc gia số; phương án kết nối, liên thông, chia sẻ dữ liệu | Điều 4 |
| IV | Thuyết minh **thiết kế chi tiết**: mô hình tổng thể, mô hình lô-gic, mô hình vật lý; phương án hạ tầng; phương án dữ liệu; yêu cầu về tính sẵn sàng với IPv6 | khoản 1 Điều 12; Điều 14; điểm a khoản 2 Điều 14; khoản 8, khoản 9, khoản 10 Điều 3 |
| V | Mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ: yêu cầu chức năng theo 08 nhóm và yêu cầu phi chức năng | Điều 15; điểm e khoản 2 Điều 15 |
| VI | Giải pháp bảo đảm an toàn hệ thống thông tin theo cấp độ dự kiến; kế hoạch lập hồ sơ đề xuất cấp độ | `[CẦN ĐỐI CHIẾU: nghị định về an toàn hệ thống thông tin theo cấp độ]` |
| VII | Phương án đào tạo, chuyển giao, quản trị, vận hành | điểm a khoản 2 Điều 16 |
| VIII | Tổng mức đầu tư theo khoản mục và phương pháp xác định | khoản 4 Điều 12; Điều 16 |
| IX | Phương án tổ chức quản lý dự án; tiến độ; phân kỳ | Điều 28; khoản 2 Điều 28 |
| X | Đánh giá hiệu quả; phân tích rủi ro | khoản 2 Điều 47 Luật Đầu tư công |
| Phụ lục | Bảng kê 08 nhóm chức năng và trường hợp sử dụng; bảng đối chiếu khung kiến trúc; hồ sơ báo giá và tài liệu xác định chi phí | Điều 15; Điều 16 |

**Bước 3 — Thuyết minh yêu cầu cho một nhóm chức năng.** Lấy Nhóm 1 "Tiếp nhận đề xuất nhiệm vụ khoa học và công nghệ trực tuyến" làm mẫu.

| Nội dung | Thuyết minh |
|----------|-------------|
| Tác nhân | Tổ chức, cá nhân đề xuất nhiệm vụ; chuyên viên quản lý nhiệm vụ; hệ thống định danh và xác thực điện tử |
| Trường hợp sử dụng | Đăng ký và xác thực tài khoản; khai và lưu nháp phiếu đề xuất; đính kèm và ký số hồ sơ; nộp hồ sơ và nhận số tiếp nhận; tra cứu trạng thái hồ sơ; yêu cầu bổ sung, hoàn thiện hồ sơ |
| Quy tắc nghiệp vụ | Hồ sơ phải được ký số trước khi nộp; hệ thống kiểm tra tính đầy đủ trước khi cấp số tiếp nhận; mọi thay đổi trạng thái phải ghi nhật ký |
| Dữ liệu | Phiếu đề xuất, tài liệu đính kèm, số tiếp nhận, trạng thái, lịch sử xử lý |
| Yêu cầu phi chức năng gắn với nhóm này | Chịu tải cao điểm 1.500 hồ sơ trong 15 ngày; thời gian phản hồi trung bình dưới 3 giây; ký số theo quy định về giao dịch điện tử; bảo vệ dữ liệu cá nhân theo nguyên tắc thu thập tối thiểu |
| Tính sẵn sàng với IPv6 | Bắt buộc, do nhóm chức năng này hoạt động trên môi trường Internet |

*Căn cứ của dòng cuối:* điểm a khoản 2 Điều 14 và điểm e khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP.

**Bước 4 — Ánh xạ yêu cầu phi chức năng chung của dự án vào hồ sơ.**

| Nhóm yêu cầu | Giá trị trong dự án ví dụ | Đặt ở đâu trong hồ sơ | Loại căn cứ |
|--------------|---------------------------|------------------------|-------------|
| Tính sẵn sàng với IPv6 | Bắt buộc | Mục V, và nhất quán với mục IV | Căn cứ pháp lý: điểm a khoản 2 Điều 14; điểm e khoản 2 Điều 15 |
| Kết nối, liên thông, chia sẻ dữ liệu | Giao diện lập trình ứng dụng theo chuẩn; kết nối cơ sở dữ liệu quốc gia về khoa học và công nghệ | Mục III và mục IV | Căn cứ pháp lý: Điều 4 |
| An toàn hệ thống thông tin theo cấp độ | Cấp độ 3 dự kiến | Mục VI, kèm kế hoạch lập hồ sơ đề xuất cấp độ | `[CẦN ĐỐI CHIẾU: nghị định về an toàn hệ thống thông tin theo cấp độ]` |
| Hiệu năng, chịu tải, dung lượng | 300 người dùng đồng thời; 1.500 hồ sơ trong 15 ngày cao điểm; 200 GB trong 5 năm | Mục V | Căn cứ kỹ thuật |
| Nhật ký và sao lưu | Nhật ký truy cập tối thiểu 12 tháng; sao lưu hằng ngày; diễn tập phục hồi định kỳ | Mục V và mục VI | Căn cứ kỹ thuật, gắn với yêu cầu an toàn theo cấp độ |
| Chất lượng phần mềm | TCVN ISO/IEC 25010 | Phần A, mục "căn cứ kỹ thuật" | **Không phải** căn cứ pháp lý |

**Phân tích độ nhạy.**

| Kịch bản | Nội dung báo cáo nghiên cứu khả thi thay đổi thế nào | Căn cứ |
|----------|------------------------------------------------------|--------|
| Cơ sở: 14,5 tỷ đồng, thiết kế 01 bước | Thuyết minh **thiết kế chi tiết** theo Điều 14 ngay trong báo cáo nghiên cứu khả thi | khoản 1 Điều 12; điểm a khoản 2 Điều 9 |
| Tổng mức đầu tư tăng lên 26 tỷ đồng | Chuyển sang thiết kế **02 bước**; báo cáo nghiên cứu khả thi chỉ thuyết minh **thiết kế cơ sở** theo Điều 13; thiết kế chi tiết chuyển sang giai đoạn thực hiện đầu tư; phát sinh thêm bước thẩm định thiết kế cơ sở | khoản 1, khoản 3, khoản 4 Điều 9; khoản 1 Điều 12; Điều 13 |
| Chuyển sang thuê dịch vụ công nghệ thông tin | Khung nội dung chuyển từ khoản 1 sang **khoản 3 Điều 12**; bắt buộc có nội dung về yêu cầu chất lượng dịch vụ và về **sở hữu thông tin, dữ liệu hình thành trong quá trình thuê và phương án chuyển giao**; cơ cấu tổng mức đầu tư chuyển sang khoản 3 Điều 16; không còn phần mô tả yêu cầu kỹ thuật phần mềm nội bộ theo Điều 15 | khoản 3 Điều 12; khoản 3 Điều 16; Điều 23; khoản 2 Điều 24 |
| Dự án khởi động sau ngày 01/7/2026 | Áp dụng Nghị định số 224/2026/NĐ-CP; nội dung báo cáo nghiên cứu khả thi tra tại **Điều 45**, bổ sung thuyết minh sự phù hợp với **Kế hoạch chuyển đổi số**; thiết kế chi tiết tra tại Điều 47, bổ sung yêu cầu về mức độ chịu đựng sai hỏng | khoản 1 Điều 91; khoản 1, khoản 4 Điều 45; Điều 47 Nghị định 224/2026/NĐ-CP |

Kịch bản thứ hai là kịch bản nhạy nhất: chỉ cần tổng mức đầu tư vượt 20 tỷ đồng thì toàn bộ nội dung mục IV của mục lục phải viết lại theo Điều 13 thay vì Điều 14, và tiến độ chuẩn bị đầu tư kéo dài thêm ít nhất một chu kỳ thẩm định thiết kế.

## Hoạt động thực hành

**Hoạt động 1. Lập mục lục báo cáo nghiên cứu khả thi có ánh xạ căn cứ**

- *Sản phẩm cần tạo:* Mục lục báo cáo nghiên cứu khả thi cho dự án ví dụ, mỗi mục ghi rõ điều, khoản, điểm làm căn cứ; các mục chưa tra được căn cứ thì đánh dấu `[CẦN ĐỐI CHIẾU]` kèm mô tả nội dung cần tra.
- *Thời lượng dự kiến:* 50 phút.
- *Hình thức:* nhóm 3 đến 5 người.
- *Các bước:*
  1. Xác định loại dự án theo khoản 1 Điều 7 và chọn khung nội dung tương ứng trong Điều 12.
  2. Xác định số bước thiết kế theo Điều 9, từ đó kết luận báo cáo phải thuyết minh thiết kế cơ sở hay thiết kế chi tiết.
  3. Dựng mục lục theo thứ tự: căn cứ, hiện trạng và sự cần thiết, mục tiêu và phạm vi, tuân thủ khung kiến trúc, thuyết minh thiết kế, yêu cầu kỹ thuật phần mềm nội bộ, an toàn thông tin, đào tạo và chuyển giao, tổng mức đầu tư, tổ chức quản lý dự án, hiệu quả và rủi ro, phụ lục.
  4. Ánh xạ từng mục tới điều, khoản, điểm; phân biệt căn cứ pháp lý với căn cứ kỹ thuật.
  5. Rà lại ba chỗ phải nêu yêu cầu về tính sẵn sàng với IPv6 và kiểm tra tính nhất quán.
- *Tiêu chí đánh giá:* chọn đúng khung nội dung theo loại dự án; kết luận đúng thuyết minh thiết kế chi tiết theo Điều 14; mỗi mục có căn cứ hoặc dấu `[CẦN ĐỐI CHIẾU]`; TCVN không bị đặt vào phần căn cứ pháp lý; có mục về an toàn hệ thống thông tin theo cấp độ kèm ghi chú chưa xác minh được số hiệu nghị định.
- *Căn cứ cần dùng:* Điều 4, khoản 1 Điều 7, Điều 9, Điều 12, Điều 13, Điều 14, Điều 15, Điều 16, khoản 1 Điều 17 Nghị định 45/2026/NĐ-CP; khoản 2 Điều 47 Luật Đầu tư công số 58/2024/QH15.

**Hoạt động 2. Viết phần thuyết minh yêu cầu cho một nhóm chức năng**

- *Sản phẩm cần tạo:* Phần thuyết minh yêu cầu chức năng và yêu cầu phi chức năng cho **một** trong 08 nhóm chức năng của dự án ví dụ, gồm bảng trường hợp sử dụng và bảng yêu cầu phi chức năng.
- *Thời lượng dự kiến:* 45 phút.
- *Hình thức:* nhóm 2 đến 3 người; mỗi nhóm bốc thăm một nhóm chức năng; đổi bài chấm chéo.
- *Các bước:*
  1. Đọc mô tả nhóm chức năng tương ứng trong tài liệu ví dụ dự án và danh sách tác nhân tại mục 4 của tài liệu đó.
  2. Lập bảng trường hợp sử dụng: tên, tác nhân, điều kiện bắt đầu, luồng chính, luồng ngoại lệ, kết quả, quy tắc nghiệp vụ, dữ liệu vào và ra.
  3. Lập bảng yêu cầu phi chức năng gắn với nhóm chức năng, trong đó nêu rõ yêu cầu về tính sẵn sàng với IPv6 nếu nhóm chức năng hoạt động trên môi trường Internet.
  4. Ghi rõ với mỗi yêu cầu: đây là căn cứ pháp lý hay căn cứ kỹ thuật.
  5. Kiểm tra tiêu chí thực tế: một nhà thầu chưa biết nghiệp vụ có ước lượng được khối lượng công việc từ mô tả này không.
- *Tiêu chí đánh giá:* mỗi trường hợp sử dụng có đủ tác nhân, luồng chính và ít nhất một luồng ngoại lệ; yêu cầu phi chức năng đo được, không dùng từ định tính; nêu đúng yêu cầu IPv6 kèm viện dẫn; phân biệt đúng căn cứ pháp lý và căn cứ kỹ thuật; nhóm chấm chéo nêu được ít nhất hai điểm chưa đủ chi tiết để ước lượng chi phí.
- *Căn cứ cần dùng:* Điều 15, đặc biệt điểm e khoản 2 Điều 15; điểm a khoản 2 Điều 14 Nghị định 45/2026/NĐ-CP; mục 3, mục 4 và mục 5 của tài liệu ví dụ dự án.

## Câu hỏi kiểm tra

**Câu 1 (cơ bản).** Theo khoản 1 Điều 12 Nghị định số 45/2026/NĐ-CP, báo cáo nghiên cứu khả thi của dự án đầu tư hệ thống phải thuyết minh rõ nội dung nào?

- A. Kế hoạch lựa chọn nhà thầu
- B. Thiết kế cơ sở theo Điều 13 hoặc thiết kế chi tiết theo Điều 14
- C. Hồ sơ hoàn thành dự án
- D. Báo cáo kết quả vận hành thử

**Đáp án: B.**
*Giải thích:* Khoản 1 Điều 12 quy định báo cáo nghiên cứu khả thi của dự án đầu tư hệ thống phải thuyết minh rõ thiết kế cơ sở theo Điều 13 hoặc thiết kế chi tiết theo Điều 14, tùy theo dự án áp dụng thiết kế 02 bước hay 01 bước theo Điều 9. Phương án A thuộc bước lựa chọn nhà thầu, sau khi đã có quyết định đầu tư. Phương án C thuộc giai đoạn kết thúc đầu tư, theo Điều 25 về lập và lưu trữ hồ sơ hoàn thành. Phương án D thuộc công tác vận hành thử theo khoản 4 Điều 22, ở giai đoạn thực hiện đầu tư.

**Câu 2 (cơ bản).** Nội dung nào sau đây là nội dung **bắt buộc riêng** của báo cáo nghiên cứu khả thi dự án thuê dịch vụ công nghệ thông tin theo khoản 3 Điều 12 Nghị định số 45/2026/NĐ-CP?

- A. Thống kê khối lượng, danh mục thiết bị, phần mềm thương mại
- B. Thuyết minh thiết kế chi tiết theo Điều 14
- C. Sở hữu thông tin, dữ liệu hình thành trong quá trình thuê và phương án chuyển giao cho bên thuê
- D. Mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ theo Điều 15

**Đáp án: C.**
*Giải thích:* Điểm c khoản 3 Điều 12 quy định nội dung về sở hữu thông tin, dữ liệu hình thành trong quá trình thuê và phương án chuyển giao cho bên thuê; nội dung này gắn với khoản 2 Điều 24 về bàn giao toàn bộ thông tin, dữ liệu sau khi kết thúc thời gian thuê. Phương án A thuộc khung của **dự án mua sắm** tại điểm b khoản 2 Điều 12. Phương án B thuộc khung của **dự án đầu tư hệ thống** tại khoản 1 Điều 12. Phương án D áp dụng cho dự án có hạng mục phần mềm nội bộ, không phải đặc trưng của dự án thuê dịch vụ.

**Câu 3 (trung bình).** Dự án đầu tư hệ thống có tổng mức đầu tư 14,5 tỷ đồng. Báo cáo nghiên cứu khả thi của dự án này phải thuyết minh nội dung thiết kế nào?

- A. Thiết kế cơ sở theo Điều 13, vì mọi báo cáo nghiên cứu khả thi đều thuyết minh thiết kế cơ sở
- B. Thiết kế chi tiết theo Điều 14, vì dự án có tổng mức đầu tư không quá 20 tỷ đồng nên áp dụng thiết kế 01 bước
- C. Cả thiết kế cơ sở và thiết kế chi tiết
- D. Không phải thuyết minh thiết kế, vì thiết kế thuộc giai đoạn thực hiện đầu tư

**Đáp án: B.**
*Giải thích:* Điểm a khoản 2 Điều 9 quy định thiết kế 01 bước áp dụng với dự án có tổng mức đầu tư không quá 20 tỷ đồng; khoản 1 Điều 9 xác định thiết kế 01 bước là thiết kế chi tiết. Kết hợp với khoản 1 Điều 12, báo cáo nghiên cứu khả thi phải thuyết minh rõ thiết kế chi tiết theo Điều 14. Phương án A sai vì thuyết minh thiết kế cơ sở chỉ áp dụng khi dự án thiết kế 02 bước theo khoản 3 Điều 9. Phương án C sai vì thiết kế 01 bước chỉ có một loại thiết kế. Phương án D sai vì khoản 1 Điều 12 buộc thuyết minh thiết kế ngay trong báo cáo nghiên cứu khả thi.

**Câu 4 (trung bình).** Hệ thống của một sở có cổng tra cứu công khai trên Internet và kết nối tới cơ sở dữ liệu quốc gia. Hồ sơ dự án không nêu yêu cầu về tính sẵn sàng với IPv6 vì tổ soạn thảo cho rằng "phần lớn người dùng là nội bộ". Nhận định nào đúng?

- A. Hồ sơ đúng, vì yêu cầu IPv6 chỉ áp dụng khi toàn bộ hệ thống chạy trên Internet
- B. Hồ sơ thiếu nội dung bắt buộc, vì điều kiện áp dụng là hệ thống có nội dung liên quan hoạt động trên môi trường Internet
- C. Hồ sơ đúng, vì yêu cầu IPv6 chỉ đặt ra ở bước nghiệm thu
- D. Hồ sơ đúng, vì IPv6 là tiêu chuẩn kỹ thuật tự nguyện áp dụng

**Đáp án: B.**
*Giải thích:* Điểm a khoản 2 Điều 13, điểm a khoản 2 Điều 14 và điểm e khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP đều đặt điều kiện áp dụng theo hướng: nếu có các nội dung liên quan hoạt động trên môi trường Internet thì phải nêu yêu cầu về tính sẵn sàng với IPv6 hoặc giải pháp nâng cấp bảo đảm sẵn sàng với IPv6. Cổng tra cứu công khai và kết nối ra ngoài đã thỏa mãn điều kiện này. Phương án A đặt thêm điều kiện "toàn bộ hệ thống" mà quy định không có. Phương án C sai vì đây là nội dung của hồ sơ thiết kế và yêu cầu kỹ thuật, phải có từ bước lập dự án. Phương án D sai vì đây là yêu cầu do nghị định đặt ra, không phải tiêu chuẩn tự nguyện áp dụng.

**Câu 5 (chuyên sâu, tình huống).** Sở Khoa học và Công nghệ tỉnh T thuê tư vấn lập báo cáo nghiên cứu khả thi dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh". Bản dự thảo tư vấn nộp có các đặc điểm: (i) phần hiện trạng dài 2 trang, chủ yếu là nhận định "quy trình thủ công, hiệu quả thấp", không có số liệu khối lượng hồ sơ và thời gian xử lý; (ii) phần yêu cầu chức năng chỉ liệt kê tên 08 nhóm chức năng, mỗi nhóm 3 đến 4 dòng, không có trường hợp sử dụng; (iii) phần thiết kế thuyết minh **thiết kế cơ sở** theo Điều 13; (iv) yêu cầu phi chức năng ghi "hệ thống phải nhanh, ổn định, an toàn"; (v) phần căn cứ pháp lý liệt kê TCVN ISO/IEC 25010 và một công văn hướng dẫn nghiệp vụ của một cục thuộc bộ; (vi) không có nội dung về an toàn hệ thống thông tin theo cấp độ. Hãy nhận xét và nêu hướng xử lý.

**Đáp án mẫu:**

Bản dự thảo không đủ điều kiện trình thẩm định. Có sáu nhóm vấn đề, xếp theo mức độ nghiêm trọng.

*Vấn đề nghiêm trọng nhất — thuyết minh sai loại thiết kế.* Dự án có tổng mức đầu tư 14,5 tỷ đồng, không quá 20 tỷ đồng, nên áp dụng thiết kế 01 bước theo điểm a khoản 2 Điều 9, tức thiết kế chi tiết theo khoản 1 Điều 9. Kết hợp khoản 1 Điều 12, báo cáo nghiên cứu khả thi phải thuyết minh rõ **thiết kế chi tiết theo Điều 14**, không phải thiết kế cơ sở theo Điều 13. Đây không phải lỗi hình thức: thiết kế cơ sở và thiết kế chi tiết khác nhau về mức độ chi tiết và về nội dung phải có, và với thiết kế 01 bước thì không có bước lập thiết kế cơ sở riêng. Phải viết lại toàn bộ phần này theo Điều 14, trong đó có yêu cầu tại điểm a khoản 2 Điều 14 về tính sẵn sàng với IPv6.

*Vấn đề thứ hai — phần hiện trạng không có số liệu.* Hiện trạng là căn cứ để chứng minh sự cần thiết đầu tư, để phân biệt đầu tư mới với nâng cấp hoặc mở rộng phần mềm (khoản 11, khoản 12 Điều 3), và là căn cứ trực tiếp cho khoản mục chi phí tạo lập cơ sở dữ liệu, chuẩn hóa, chuyển đổi, nhập dữ liệu tại điểm a khoản 2 Điều 16. Phải bổ sung: khối lượng nhiệm vụ quản lý theo năm, thời gian xử lý trung bình một hồ sơ, khối lượng hồ sơ giấy phải số hóa, hiện trạng hệ thống và hạ tầng đang có.

*Vấn đề thứ ba — yêu cầu chức năng không đủ chi tiết.* Liệt kê tên nhóm chức năng không phải là mô tả yêu cầu kỹ thuật theo Điều 15. Phải triển khai từng nhóm thành các trường hợp sử dụng có tác nhân, luồng chính, luồng ngoại lệ, quy tắc nghiệp vụ và dữ liệu. Tiêu chí kiểm tra: nhà thầu chưa biết nghiệp vụ phải ước lượng được khối lượng công việc từ mô tả. Nếu không đạt tiêu chí này thì bước xác định chi phí phần mềm nội bộ ở bài 05 và bước lập kịch bản kiểm thử ở bài 09 đều không có đầu vào.

*Vấn đề thứ tư — yêu cầu phi chức năng định tính.* "Nhanh, ổn định, an toàn" không kiểm tra được và không nghiệm thu được. Phải chuyển thành các chỉ tiêu đo được: số người dùng đồng thời, thời gian phản hồi, khối lượng cao điểm, dung lượng, thời gian lưu nhật ký, chu kỳ sao lưu. Đồng thời phải bổ sung yêu cầu về tính sẵn sàng với IPv6 theo điểm e khoản 2 Điều 15, vì hệ thống có cổng tra cứu công khai và kết nối ra cơ sở dữ liệu quốc gia.

*Vấn đề thứ năm — sai phân loại căn cứ.* TCVN ISO/IEC 25010 là tiêu chuẩn quốc gia, không phải văn bản quy phạm pháp luật; công văn hướng dẫn nghiệp vụ của một cục cũng không phải văn bản quy phạm pháp luật. Cả hai không được đặt trong phần "căn cứ pháp lý". Tiêu chuẩn chuyển sang phần "căn cứ kỹ thuật"; công văn nếu cần thì dẫn ở phần thuyết minh với tính chất tham khảo.

*Vấn đề thứ sáu — thiếu nội dung an toàn hệ thống thông tin theo cấp độ.* Phải bổ sung mục thuyết minh giải pháp bảo đảm an toàn tương ứng với cấp độ dự kiến và kế hoạch lập hồ sơ đề xuất cấp độ, thực hiện song song với bước lập dự án; chi phí lập hồ sơ đề xuất cấp độ xếp vào chi phí khác theo điểm d khoản 2 Điều 16. Số hiệu nghị định về an toàn hệ thống thông tin theo cấp độ phải được tra cứu, ghi `[CẦN ĐỐI CHIẾU]` cho đến khi xác minh được.

*Hướng xử lý về mặt thủ tục.* Chủ đầu tư yêu cầu tư vấn hoàn thiện theo hợp đồng trước khi trình. Sau khi hoàn thiện, nên tổ chức **thẩm tra** báo cáo nghiên cứu khả thi theo khoản 1 Điều 17, được thuê tổ chức, cá nhân thực hiện; kết quả thẩm tra là công cụ của chủ đầu tư để nâng chất lượng hồ sơ, không thay thế báo cáo thẩm định của đầu mối thẩm định theo khoản 2 Điều 17.

*Căn cứ:* khoản 11, khoản 12 Điều 3; Điều 4; khoản 1, điểm a khoản 2 Điều 9; khoản 1, khoản 4 Điều 12; Điều 13; Điều 14, điểm a khoản 2 Điều 14; Điều 15, điểm e khoản 2 Điều 15; điểm a, điểm d khoản 2 Điều 16; khoản 1, khoản 2 Điều 17 Nghị định số 45/2026/NĐ-CP.

## Tóm tắt

- Sản phẩm của bước lập dự án là báo cáo nghiên cứu khả thi hoặc báo cáo kinh tế - kỹ thuật; Điều 12 Nghị định 45/2026/NĐ-CP quy định nội dung cho cả hai loại hồ sơ.
- Điều 12 có ba khung khác nhau cho ba loại dự án: khoản 1 cho dự án đầu tư hệ thống, khoản 2 cho dự án mua sắm, khoản 3 cho dự án thuê dịch vụ; tổng mức đầu tư theo khoản 4 Điều 12 và Điều 16.
- Báo cáo nghiên cứu khả thi của dự án đầu tư hệ thống chứa cả thiết kế: thuyết minh thiết kế cơ sở theo Điều 13 nếu thiết kế 02 bước, thuyết minh thiết kế chi tiết theo Điều 14 nếu thiết kế 01 bước (khoản 1 Điều 12; Điều 9).
- Dự án có tổng mức đầu tư không quá 20 tỷ đồng áp dụng thiết kế 01 bước, tức thiết kế chi tiết (khoản 1 và điểm a khoản 2 Điều 9).
- Yêu cầu kỹ thuật của phần mềm nội bộ mô tả theo Điều 15; yêu cầu phi chức năng phải đo được và phải nêu tính sẵn sàng với IPv6 nếu hoạt động trên môi trường Internet (điểm e khoản 2 Điều 15).
- Yêu cầu về tính sẵn sàng với IPv6 xuất hiện ở ba chỗ và phải nhất quán (điểm a khoản 2 Điều 13; điểm a khoản 2 Điều 14; điểm e khoản 2 Điều 15).
- Hồ sơ dự án thuê dịch vụ bắt buộc có nội dung về sở hữu thông tin, dữ liệu hình thành trong quá trình thuê và phương án chuyển giao cho bên thuê (điểm c khoản 3 Điều 12; khoản 2 Điều 24).
- Với dự án khởi động từ ngày 01/7/2026, nội dung báo cáo nghiên cứu khả thi tra tại Điều 45 Nghị định 224/2026/NĐ-CP, bổ sung thuyết minh sự phù hợp với Kế hoạch chuyển đổi số (khoản 1, khoản 4 Điều 45).
