---
course: dau-tu-cntt-nsnn
slug: 07-thiet-ke-va-du-toan
ordinal: 7
title: "Thiết kế một bước, hai bước: thiết kế cơ sở, thiết kế chi tiết và dự toán"
as_of: 2026-09-06
status: draft
review_state: cho_phap_che_duyet
---

# Bài 07. Thiết kế một bước, hai bước: thiết kế cơ sở, thiết kế chi tiết và dự toán

> **Căn cứ tại ngày:** 06/9/2026
> **Trạng thái:** bản nháp, **nội dung chờ pháp chế duyệt**. Trước khi sử dụng để giảng dạy hoặc lập hồ sơ dự án, phải đối chiếu với toàn văn văn bản còn hiệu lực.
>
> **CẢNH BÁO HIỆU LỰC.** Nghị định số 45/2026/NĐ-CP **đã hết hiệu lực kể từ ngày 01/7/2026**, bị thay thế bởi Nghị định số 224/2026/NĐ-CP ngày 24/6/2026 của Chính phủ quy định chi tiết một số điều và biện pháp thi hành Luật Chuyển đổi số (điểm a khoản 2 Điều 90 Nghị định số 224/2026/NĐ-CP). Bài học này áp dụng trực tiếp cho **nhóm dự án chuyển tiếp**: dự án đã được quyết định đầu tư hoặc đã có báo cáo thẩm định trước ngày 01/7/2026 (Điều 91 Nghị định số 224/2026/NĐ-CP). Với dự án khởi động sau ngày 01/7/2026, phải đối chiếu sang Nghị định số 224/2026/NĐ-CP, Thông tư số 39/2026/TT-BKHCN và Thông tư số 41/2026/TT-BKHCN. Xem Bài 01 mục 6.

## Mục tiêu bài học

Sau khi hoàn thành bài học, học viên có thể:

- Xác định đúng số bước thiết kế của một dự án đầu tư hệ thống căn cứ ngưỡng tổng mức đầu tư 20 tỷ đồng và trường hợp xin phép thiết kế 01 bước.
- Phân biệt thiết kế cơ sở với thiết kế chi tiết theo đối tượng, thời điểm lập, chủ thể thẩm định và hệ quả đối với hồ sơ.
- Chọn đúng luồng lập thiết kế chi tiết giữa Điều 19 và Điều 20 Nghị định số 45/2026/NĐ-CP căn cứ việc dự án có hay không có hạng mục phần mềm nội bộ.
- Lập được đề cương thiết kế chi tiết cho một dự án cụ thể, trong đó có mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ và yêu cầu về tính sẵn sàng với IPv6.
- Dự báo được toàn bộ thay đổi về hồ sơ và trình tự khi tổng mức đầu tư của dự án vượt ngưỡng 20 tỷ đồng.

## Căn cứ pháp lý của bài học

| # | Căn cứ | Nội dung điều chỉnh |
|---|--------|---------------------|
| 1 | Điều 9 Nghị định số 45/2026/NĐ-CP ngày 26/01/2026 của Chính phủ quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước | Thiết kế dự án; ngưỡng thiết kế 01 bước; thiết kế 02 bước; nghĩa vụ giám sát tác giả |
| 2 | Khoản 6, khoản 8, khoản 9, khoản 10, khoản 17, khoản 18 Điều 3 Nghị định số 45/2026/NĐ-CP | Định nghĩa giám sát tác giả, mô hình tổng thể, mô hình lô-gic, mô hình vật lý, thiết kế cơ sở, thiết kế chi tiết |
| 3 | Điều 13 Nghị định số 45/2026/NĐ-CP | Nội dung thiết kế cơ sở; yêu cầu về tính sẵn sàng với IPv6 |
| 4 | Điều 14 Nghị định số 45/2026/NĐ-CP | Yêu cầu và nội dung chính của thiết kế chi tiết; yêu cầu về tính sẵn sàng với IPv6 |
| 5 | Điều 15 Nghị định số 45/2026/NĐ-CP | Mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ |
| 6 | Điều 18, Điều 19, Điều 20 Nghị định số 45/2026/NĐ-CP | Hai luồng lập, thẩm định, phê duyệt, điều chỉnh thiết kế chi tiết và hồ sơ thiết kế chi tiết |
| 7 | Khoản 4, khoản 5, khoản 6, khoản 7 Điều 16 Nghị định số 45/2026/NĐ-CP | Phương pháp xác định chi phí, được dẫn chiếu để lập dự toán theo điểm b khoản 5 Điều 19 |
| 8 | Khoản 8 Điều 17 Nghị định số 45/2026/NĐ-CP | Quyền tự tổ chức điều chỉnh, thẩm định, phê duyệt điều chỉnh thiết kế của chủ đầu tư |
| 9 | Điều 42, Điều 46, Điều 47, Điều 48, Điều 52 và **khoản 6 Điều 53** Nghị định số 224/2026/NĐ-CP ngày 24/6/2026 của Chính phủ quy định chi tiết một số điều và biện pháp thi hành Luật Chuyển đổi số | Các điều tương ứng áp dụng từ ngày 01/7/2026; thay đổi lớn về thẩm định, phê duyệt thiết kế chi tiết |

## Nội dung

### 1. Thiết kế chỉ có ở dự án đầu tư hệ thống

Khoản 1 Điều 9 Nghị định 45/2026/NĐ-CP xác định phạm vi của bước thiết kế: quy định về thiết kế **chỉ áp dụng đối với dự án đầu tư hệ thống**. Dự án mua sắm và dự án thuê dịch vụ công nghệ thông tin theo điểm b và điểm c khoản 1 Điều 7 không có bước này.

Đây là hệ quả trực tiếp của kết quả phân loại ở bài 02, và cũng là lý do vì sao phân loại phải làm trước. Một hoạt động bị xếp nhầm thành dự án mua sắm sẽ bỏ qua toàn bộ chương này: không có thiết kế cơ sở, không có thiết kế chi tiết, không có mô tả yêu cầu kỹ thuật phần mềm nội bộ, và do đó cũng không có căn cứ kỹ thuật để nghiệm thu về sau.

Cũng theo khoản 1 Điều 9, có hai hình thức: **thiết kế 01 bước là thiết kế chi tiết**; **thiết kế 02 bước gồm thiết kế cơ sở và thiết kế chi tiết**.

### 2. Ngưỡng 20 tỷ đồng và hai con đường

Khoản 2 Điều 9 quy định các trường hợp áp dụng thiết kế 01 bước, trong đó điểm a nêu:

> a) Dự án có tổng mức đầu tư không quá 20 tỷ đồng

Điểm b khoản 2 Điều 9 mở thêm một lối đi ít người dùng: dự án khác, nếu chủ đầu tư xét thấy có thể thiết kế 01 bước, thì **báo cáo cấp có thẩm quyền quyết định đầu tư cho phép**. Nghĩa là vượt 20 tỷ đồng không tự động khóa cửa thiết kế 01 bước, nhưng phải xin phép và phải có văn bản cho phép của cấp có thẩm quyền quyết định đầu tư — không phải quyền tự quyết của chủ đầu tư.

Khoản 3 Điều 9 quy định các dự án còn lại thực hiện thiết kế 02 bước. Khoản 4 Điều 9 quy định các nội dung phải thực hiện khi thiết kế 02 bước. `[CẦN ĐỐI CHIẾU: nguyên văn khoản 4 Điều 9 Nghị định 45/2026/NĐ-CP — quy định cụ thể áp dụng khi thiết kế 02 bước]`

Ba lưu ý khi vận dụng ngưỡng này.

**Thứ nhất**, so sánh với **tổng mức đầu tư**, không phải chi phí trang thiết bị hay giá trị phần mềm. Tổng mức đầu tư bao gồm cả chi phí quản lý dự án, chi phí tư vấn, chi phí khác và chi phí dự phòng theo khoản 2 Điều 16. Một dự án có chi phí trang thiết bị 18 tỷ đồng nhưng tổng mức đầu tư 21 tỷ đồng thì đã vượt ngưỡng.

**Thứ hai**, ngưỡng là "không quá 20 tỷ đồng", tức bao gồm cả mốc 20 tỷ đồng chẵn. Dự án đúng 20 tỷ đồng vẫn thuộc điểm a khoản 2 Điều 9.

**Thứ ba**, ngưỡng 20 tỷ đồng còn xuất hiện ở một điều khác với ý nghĩa hoàn toàn khác: khoản 2 Điều 28 cho phép dự án đầu tư hệ thống và dự án thuê dịch vụ công nghệ thông tin có tổng mức đầu tư **từ 20 tỷ đồng trở xuống** có thể không thành lập Ban quản lý dự án. Hai ngưỡng trùng con số nhưng khác đối tượng điều chỉnh; không được viện dẫn lẫn.

### 3. Thiết kế cơ sở và thiết kế chi tiết khác nhau ở đâu

Định nghĩa hai khái niệm nằm ở khoản 17 và khoản 18 Điều 3 Nghị định 45/2026/NĐ-CP. `[CẦN ĐỐI CHIẾU: nguyên văn khoản 17 và khoản 18 Điều 3 Nghị định 45/2026/NĐ-CP]`

Về mặt nghiệp vụ, ba khác biệt quyết định cách lập hồ sơ:

| Tiêu chí | Thiết kế cơ sở (Điều 13) | Thiết kế chi tiết (Điều 14, Điều 19, Điều 20) |
|----------|--------------------------|-----------------------------------------------|
| Chỉ có ở | Dự án thiết kế 02 bước | Cả thiết kế 01 bước và 02 bước |
| Thời điểm lập | Giai đoạn chuẩn bị đầu tư, thuyết minh trong báo cáo nghiên cứu khả thi (khoản 1 Điều 12) | Trong báo cáo nghiên cứu khả thi nếu thiết kế 01 bước; ở giai đoạn thực hiện đầu tư theo Điều 19 hoặc Điều 20 |
| Mức độ chi tiết | Đủ để xác định phương án và tổng mức đầu tư | Đủ để triển khai, kiểm thử và nghiệm thu |
| Sản phẩm gắn kèm | Không kèm dự toán | Dự toán là một nội dung thuộc hồ sơ thiết kế chi tiết theo luồng Điều 19 |

Yêu cầu và nội dung chính của thiết kế chi tiết được quy định tại khoản 1 Điều 14 (bốn yêu cầu tại các điểm a đến d) và khoản 2 Điều 14 (năm nhóm nội dung tại các điểm a đến e). `[CẦN ĐỐI CHIẾU: nguyên văn các điểm a, b, c, d khoản 1 Điều 14 và các điểm b, c, d, đ, e khoản 2 Điều 14 Nghị định 45/2026/NĐ-CP; riêng điểm a khoản 2 Điều 14 đã xác minh là nội dung về tính sẵn sàng với IPv6]`

Ba mô hình luôn phải có trong đề cương thiết kế là **mô hình tổng thể**, **mô hình lô-gic** và **mô hình vật lý**, được định nghĩa lần lượt tại khoản 8, khoản 9 và khoản 10 Điều 3. `[CẦN ĐỐI CHIẾU: nguyên văn khoản 8, khoản 9, khoản 10 Điều 3 Nghị định 45/2026/NĐ-CP]`

### 4. Mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ

Điều 15 Nghị định 45/2026/NĐ-CP quy định riêng một loại tài liệu mà nhiều chủ đầu tư bỏ sót: **mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ**. Đây không phải một phần của thiết kế chi tiết mà là một tài liệu độc lập, bắt buộc với mọi dự án có hạng mục phần mềm nội bộ.

Vai trò của tài liệu này rất thực dụng: nó là **cầu nối giữa hồ sơ dự án và hồ sơ mời thầu**. Vì việc xây dựng, phát triển, nâng cấp, mở rộng phần mềm nội bộ được xác định là hoạt động mua sắm trang thiết bị công nghệ thông tin (khoản 13 Điều 3), và vì mẫu hồ sơ mời thầu phần mềm nội bộ dùng mẫu mua sắm hàng hóa (khoản 6 Điều 7), nên phần "yêu cầu về kỹ thuật" của hồ sơ mời thầu phải lấy nguồn từ chính tài liệu mô tả yêu cầu kỹ thuật này. Viết mơ hồ ở Điều 15 thì không thể viết chặt ở hồ sơ mời thầu, và cũng không có căn cứ để bác sản phẩm khi nghiệm thu.

Điểm e khoản 2 Điều 15 quy định về yêu cầu phi chức năng:

> e) Yêu cầu về tính sẵn sàng với IPv6 hoặc giải pháp nâng cấp bảo đảm sẵn sàng với IPv6 nếu hoạt động trên môi trường Internet

`[CẦN ĐỐI CHIẾU: nguyên văn các điểm còn lại của khoản 1 và khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP]`

### 5. Hai luồng lập thiết kế chi tiết: Điều 19 và Điều 20

Đây là nội dung khó nhất của bài và cũng là chỗ hồ sơ hay sai nhất. Điều 18 đóng vai trò biển chỉ đường:

- **Khoản 1 Điều 18**: dự án đầu tư hệ thống **không có** hạng mục phần mềm nội bộ → thực hiện theo **Điều 19**.
- **Khoản 2 Điều 18**: dự án đầu tư hệ thống **có** hạng mục phần mềm nội bộ → thực hiện theo **Điều 20**.

Hai luồng khác nhau ở ba điểm căn bản:

| Tiêu chí | Luồng Điều 19 (không có phần mềm nội bộ) | Luồng Điều 20 (có phần mềm nội bộ) |
|----------|-------------------------------------------|-------------------------------------|
| Ai lập thiết kế chi tiết | Chủ đầu tư tổ chức lập, thường thuê tư vấn | **Nhà thầu triển khai** lập thiết kế chi tiết và triển khai |
| Có kèm dự toán không | **Có.** Dự toán là một nội dung thuộc hồ sơ thiết kế chi tiết (khoản 5 Điều 19) | **Không** theo cách của Điều 19; khoản 6 Điều 20 quy định chủ đầu tư phê duyệt thiết kế chi tiết |
| Thẩm định, phê duyệt | Thẩm định theo khoản 6 Điều 19; chủ đầu tư phê duyệt đồng thời thiết kế chi tiết và dự toán, **không tách riêng** (khoản 7 Điều 19) | Chủ đầu tư thẩm định theo khoản 5 Điều 20 và phê duyệt thiết kế chi tiết theo khoản 6 Điều 20 |

Hệ quả về trình tự rất lớn. Ở luồng Điều 19, thiết kế chi tiết và dự toán có **trước** khi lựa chọn nhà thầu triển khai, nên dự toán được duyệt trở thành cơ sở xác định giá gói thầu. Ở luồng Điều 20, thiết kế chi tiết chỉ có **sau** khi đã ký hợp đồng với nhà thầu triển khai, vì chính nhà thầu đó lập; đây cũng là lý do khoản 6 Điều 7 quy định gói thầu vừa lập thiết kế chi tiết vừa triển khai phần mềm nội bộ áp dụng loại **gói thầu thiết kế và cung cấp hàng hóa (EP)**.

Một điểm phải làm rõ trước khi lập kế hoạch tiến độ: với dự án thiết kế 01 bước, thiết kế chi tiết đã được thuyết minh trong báo cáo nghiên cứu khả thi theo khoản 1 Điều 12, trong khi Điều 18, Điều 19 và Điều 20 nằm ở Mục 3 Chương II về thực hiện đầu tư. `[CẦN ĐỐI CHIẾU: quan hệ giữa thiết kế chi tiết lập trong báo cáo nghiên cứu khả thi của dự án thiết kế 01 bước với hồ sơ thiết kế chi tiết lập ở giai đoạn thực hiện đầu tư theo Điều 19, Điều 20 Nghị định 45/2026/NĐ-CP]` Cho đến khi làm rõ, kế hoạch tiến độ nên giả định là hai tài liệu ở hai giai đoạn khác nhau và mức độ chi tiết khác nhau.

Khoản 8 Điều 19 quy định việc điều chỉnh thiết kế chi tiết và dự toán, và phải đọc cùng khoản 8 Điều 17: chủ đầu tư được tự tổ chức điều chỉnh, thẩm định, phê duyệt điều chỉnh thiết kế khi không thay đổi mục tiêu, quy mô và không vượt tổng mức đầu tư đã duyệt.

### 6. Dự toán là một nội dung thuộc hồ sơ thiết kế chi tiết

Khoản 5 Điều 19 Nghị định 45/2026/NĐ-CP quy định:

> Dự toán là một nội dung thuộc hồ sơ thiết kế chi tiết

Câu này quyết định cách tổ chức hồ sơ. Dự toán **không** phải một tập tài liệu độc lập trình duyệt riêng, mà là một chương của hồ sơ thiết kế chi tiết. Đúng theo tinh thần đó, khoản 7 Điều 19 quy định chủ đầu tư **phê duyệt đồng thời, không tách riêng** thiết kế chi tiết với dự toán. Ra hai quyết định phê duyệt vào hai thời điểm khác nhau là làm sai trình tự.

Điểm a khoản 5 Điều 19 xác định dự toán gồm chi phí trang thiết bị, chi phí quản lý dự án, chi phí tư vấn đầu tư, chi phí khác và chi phí dự phòng — cùng cơ cấu năm khoản mục với tổng mức đầu tư tại khoản 2 Điều 16. Điểm b khoản 5 Điều 19 xác định dự toán được lập theo các phương pháp quy định tại **khoản 4, khoản 5, khoản 6 và khoản 7 Điều 16**, tức báo giá, kết quả lựa chọn nhà thầu với hàng hóa dịch vụ tương tự, kết quả thẩm định giá, giá niêm yết, lập dự toán theo chuyên gia tư vấn, hoặc kết hợp các phương pháp.

Đây là điểm cần nhấn mạnh vì thói quen cũ: **phương pháp điểm trường hợp sử dụng không còn là phương pháp pháp định** để lập dự toán phần mềm nội bộ. Nghị định chỉ liệt kê các phương pháp nêu trên. Bảng kê chức năng theo trường hợp sử dụng vẫn hữu ích để mô tả khối lượng công việc và để so sánh báo giá, nhưng không được trình bày như công thức bắt buộc theo quy định.

Nội dung thẩm định thiết kế chi tiết và dự toán được quy định tại khoản 6 Điều 19 với các điểm từ a đến k. `[CẦN ĐỐI CHIẾU: nguyên văn các điểm a đến k khoản 6 Điều 19 Nghị định 45/2026/NĐ-CP]`

### 7. Giám sát tác giả, IPv6 và đối chiếu sang Nghị định số 224/2026/NĐ-CP

**Giám sát tác giả.** Khoản 5 Điều 9 quy định tổ chức, cá nhân thiết kế chi tiết phải thực hiện **giám sát tác giả** trong suốt quá trình triển khai và nghiệm thu. Khái niệm này được định nghĩa tại khoản 6 Điều 3. `[CẦN ĐỐI CHIẾU: nguyên văn khoản 6 Điều 3 Nghị định 45/2026/NĐ-CP]` Nghĩa vụ này kéo dài qua nhiều giai đoạn, nên phải được đưa vào phạm vi công việc và thời gian thực hiện của hợp đồng ngay từ khi lập kế hoạch lựa chọn nhà thầu — nội dung của bài 08.

**Yêu cầu về tính sẵn sàng với IPv6.** Nghị định đặt yêu cầu này ở cả ba nơi. Điểm a khoản 2 Điều 13 (thiết kế cơ sở) quy định:

> yêu cầu về tính sẵn sàng với IPv6 hoặc giải pháp nâng cấp hệ thống bảo đảm sẵn sàng với IPv6 nếu có các nội dung liên quan hoạt động trên môi trường Internet

Điểm a khoản 2 Điều 14 đặt cùng nội dung cho thiết kế chi tiết, và điểm e khoản 2 Điều 15 đặt cùng nội dung cho yêu cầu phi chức năng của phần mềm nội bộ. Hệ thống có bất kỳ cấu phần nào hoạt động trên môi trường Internet đều phải trả lời yêu cầu này ở cả ba tài liệu, và câu trả lời phải nhất quán.

**Đối chiếu sang Nghị định số 224/2026/NĐ-CP.** Bảng ánh xạ: Điều 9 → **Điều 42** (giữ nguyên ngưỡng 20 tỷ đồng tại điểm a khoản 2 Điều 42); Điều 13 → **Điều 46**; Điều 14 → **Điều 47**; Điều 15 → **Điều 48**; Điều 18 → **Điều 51**; Điều 19 → **Điều 52**; Điều 20 → **Điều 53**.

Trong đó có **một thay đổi lớn phải đọc lại kỹ**: **khoản 6 Điều 53 Nghị định số 224/2026/NĐ-CP quy định chủ đầu tư KHÔNG phải thẩm định, phê duyệt thiết kế chi tiết do nhà thầu triển khai lập.** So với khoản 5 và khoản 6 Điều 20 Nghị định 45/2026/NĐ-CP — vốn buộc chủ đầu tư thẩm định rồi phê duyệt thiết kế chi tiết — đây là sự đảo chiều về trách nhiệm. Hệ quả thực tiễn với dự án khởi động sau ngày 01/7/2026: quy trình rút ngắn đáng kể, nhưng trách nhiệm về chất lượng thiết kế dồn sang nhà thầu triển khai, và chủ đầu tư phải bù lại bằng cách siết khâu giám sát triển khai, kiểm thử và nghiệm thu thay vì khâu phê duyệt. Nói cách khác, cùng một khối lượng kiểm soát nhưng chuyển vị trí trên trục thời gian, từ trước khi triển khai sang trong và sau khi triển khai.

### 8. Những điểm dễ nhầm

**Nhầm thứ nhất: so ngưỡng 20 tỷ đồng với giá trị phần mềm hoặc chi phí trang thiết bị.** Điểm a khoản 2 Điều 9 so với **tổng mức đầu tư**, tức đã gồm cả chi phí quản lý dự án, tư vấn, chi phí khác và dự phòng theo khoản 2 Điều 16.

**Nhầm thứ hai: coi dự toán là hồ sơ độc lập, trình duyệt riêng.** Khoản 5 Điều 19 quy định dự toán là một nội dung thuộc hồ sơ thiết kế chi tiết, và khoản 7 Điều 19 buộc phê duyệt đồng thời, không tách riêng.

**Nhầm thứ ba: dùng luồng Điều 19 cho dự án có phần mềm nội bộ.** Khoản 2 Điều 18 chỉ rõ dự án có hạng mục phần mềm nội bộ đi theo Điều 20, ở đó nhà thầu triển khai mới là bên lập thiết kế chi tiết. Lập sẵn thiết kế chi tiết của phần mềm nội bộ rồi thuê nhà thầu triển khai theo đúng bản vẽ đó vừa sai luồng, vừa làm trùng lặp chi phí tư vấn với phạm vi gói thầu EP.

**Nhầm thứ tư: cho rằng vượt 20 tỷ đồng thì bắt buộc thiết kế 02 bước trong mọi trường hợp.** Điểm b khoản 2 Điều 9 cho phép dự án khác áp dụng thiết kế 01 bước nếu chủ đầu tư báo cáo và được cấp có thẩm quyền quyết định đầu tư cho phép. Đây là ngoại lệ có điều kiện, phải có văn bản cho phép, không phải quyền tự quyết của chủ đầu tư.

## Áp dụng cho dự án ví dụ

Dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh", chủ đầu tư Sở Khoa học và Công nghệ tỉnh T, tổng mức đầu tư 14,5 tỷ đồng, 08 nhóm chức năng, dự án đầu tư hệ thống có hạng mục phần mềm nội bộ, dự án nhóm C.

**Bước 1 — Xác định có bước thiết kế hay không.** Dự án là dự án đầu tư hệ thống theo điểm a khoản 1 Điều 7, nên có bước thiết kế theo khoản 1 Điều 9.

**Bước 2 — Xác định số bước thiết kế.** Tổng mức đầu tư 14,5 tỷ đồng, không quá 20 tỷ đồng, thuộc điểm a khoản 2 Điều 9 → **thiết kế 01 bước**, tức chỉ có thiết kế chi tiết. Không lập thiết kế cơ sở, không áp dụng khoản 3 và khoản 4 Điều 9.

**Bước 3 — Xác định luồng lập thiết kế chi tiết.** Dự án có hạng mục phần mềm nội bộ (08 nhóm chức năng), nên theo khoản 2 Điều 18 áp dụng **Điều 20**: nhà thầu triển khai lập thiết kế chi tiết, chủ đầu tư thẩm định theo khoản 5 Điều 20 và phê duyệt thiết kế chi tiết theo khoản 6 Điều 20.

**Bước 4 — Dựng đề cương thiết kế chi tiết.**

| Phần | Nội dung phải có | Căn cứ |
|------|------------------|--------|
| A. Căn cứ lập thiết kế | Quyết định đầu tư; báo cáo nghiên cứu khả thi; mô tả yêu cầu kỹ thuật phần mềm nội bộ | Điều 12, Điều 15 |
| B. Mô hình tổng thể | Phạm vi hệ thống; 13 tác nhân; ranh giới với hệ thống định danh và xác thực điện tử, cơ sở dữ liệu quốc gia về khoa học và công nghệ, hệ thống quản lý văn bản và điều hành của tỉnh | khoản 8 Điều 3 |
| C. Mô hình lô-gic | Phân rã 08 nhóm chức năng thành các thành phần xử lý; mô hình dữ liệu; ma trận phân quyền theo vai trò | khoản 9 Điều 3 |
| D. Mô hình vật lý | Bố trí máy chủ tại trung tâm dữ liệu của tỉnh; phân vùng mạng; phương án sao lưu; kiến trúc triển khai đáp ứng 300 người dùng đồng thời và 200 GB dữ liệu trong 5 năm | khoản 10 Điều 3 |
| E. Yêu cầu chức năng chi tiết | Đặc tả từng nhóm trong 08 nhóm chức năng, tới mức trường hợp sử dụng | khoản 2 Điều 14; Điều 15 |
| G. Yêu cầu phi chức năng | Hiệu năng; chịu tải cao điểm 1.500 hồ sơ trong 15 ngày; an toàn hệ thống thông tin cấp độ 3; nhật ký truy cập tối thiểu 12 tháng; bảo vệ dữ liệu cá nhân; ký số; **tính sẵn sàng với IPv6** | điểm a khoản 2 Điều 14; điểm e khoản 2 Điều 15 |
| H. Yêu cầu kết nối, liên thông | Tuân thủ Khung kiến trúc tổng thể quốc gia số; giao diện lập trình ứng dụng theo chuẩn | Điều 4 |
| I. Yêu cầu về kiểm thử và bàn giao | Kiểm thử hạng mục phần mềm nội bộ; danh mục sản phẩm bàn giao gồm **mã nguồn của chương trình**, bộ chương trình cài đặt, tài liệu thiết kế chi tiết từng giai đoạn, tài liệu hướng dẫn, tài liệu đào tạo, nội dung bảo trì | điểm a khoản 3 Điều 22; điểm b khoản 1 Điều 24 |
| K. Giám sát tác giả | Nghĩa vụ của bên lập thiết kế chi tiết trong suốt quá trình triển khai và nghiệm thu | khoản 5 Điều 9 |

**Bước 5 — Ghi chú về dự toán.** Vì dự án đi theo luồng Điều 20, việc lập dự toán kèm thiết kế chi tiết theo cách của khoản 5 Điều 19 không áp dụng trực tiếp. Cơ sở xác định giá gói thầu vẫn là tổng mức đầu tư 14,5 tỷ đồng đã được phê duyệt và các phương pháp xác định chi phí tại khoản 4 đến khoản 7 Điều 16. `[CẦN ĐỐI CHIẾU: cơ sở xác định giá gói thầu đối với dự án đi theo luồng Điều 20 Nghị định 45/2026/NĐ-CP khi thiết kế chi tiết do nhà thầu triển khai lập sau khi ký hợp đồng]`

**Phân tích độ nhạy — bắt buộc thực hiện: đổi tổng mức đầu tư từ 14,5 tỷ đồng thành 26 tỷ đồng.**

Giả định tỉnh T bổ sung hạng mục hạ tầng và mở rộng phạm vi triển khai xuống cấp xã, tổng mức đầu tư tăng lên **26 tỷ đồng**. Học viên tính lại toàn bộ hệ quả.

**Tính lại ngưỡng.** 26 tỷ đồng **vượt** 20 tỷ đồng, nên dự án không còn thuộc điểm a khoản 2 Điều 9. Theo khoản 3 Điều 9, dự án thực hiện **thiết kế 02 bước**: thiết kế cơ sở và thiết kế chi tiết. Ngoại lệ duy nhất là chủ đầu tư báo cáo và được cấp có thẩm quyền quyết định đầu tư cho phép thiết kế 01 bước theo điểm b khoản 2 Điều 9 — muốn dùng ngoại lệ này thì phải có văn bản cho phép, không được tự quyết.

| Tiêu chí | Tổng mức đầu tư 14,5 tỷ đồng | Tổng mức đầu tư 26 tỷ đồng | Căn cứ |
|----------|------------------------------|-----------------------------|--------|
| Số bước thiết kế | 01 bước | **02 bước** | điểm a khoản 2 Điều 9; khoản 3 Điều 9 |
| Có lập thiết kế cơ sở không | Không | **Có** | khoản 1 Điều 9; Điều 13 |
| Nội dung thiết kế phải thuyết minh trong báo cáo nghiên cứu khả thi | Thiết kế chi tiết theo Điều 14 | **Thiết kế cơ sở theo Điều 13** | khoản 1 Điều 12 |
| Đối tượng của luồng thẩm định thiết kế ở giai đoạn chuẩn bị đầu tư | Thiết kế chi tiết | **Thiết kế cơ sở** | khoản 3 Điều 17; Mẫu 02 Phụ lục |
| Yêu cầu IPv6 nêu ở đâu | điểm a khoản 2 Điều 14; điểm e khoản 2 Điều 15 | **Thêm điểm a khoản 2 Điều 13** | Điều 13, Điều 14, Điều 15 |
| Luồng lập thiết kế chi tiết | Điều 20 (có phần mềm nội bộ) | Điều 20, không đổi | khoản 2 Điều 18 |
| Nhóm dự án | Nhóm C | Nhóm C, **không đổi** vì vẫn dưới 90 tỷ đồng | khoản 4 Điều 11 Luật Đầu tư công |
| Thời hạn thẩm định dự án, thẩm định thiết kế, quyết định đầu tư | 20, 10 và 03 ngày làm việc | **Không đổi** | khoản 5, điểm b khoản 7 Điều 17 |
| Thời hạn và mức tiền bảo hành | 12 tháng, 05% giá trị sản phẩm | **Không đổi** | khoản 1, khoản 2 Điều 26 |
| Có thể không thành lập Ban quản lý dự án không | Có thể, vì từ 20 tỷ đồng trở xuống | **Không còn thuộc trường hợp này** | khoản 2 Điều 28 |
| Chi phí tư vấn đầu tư | Không lập thiết kế cơ sở | **Tăng**, do phát sinh công việc lập thiết kế cơ sở | điểm c khoản 2 Điều 16; khoản 5 Điều 16 |

**Bài học rút ra từ độ nhạy.** Ngưỡng 20 tỷ đồng là ngưỡng nhạy nhất trong toàn bộ nghị định đối với khối lượng hồ sơ, nhưng lại **không** làm đổi nhóm dự án, không đổi mốc thời hạn thẩm định và không đổi chế độ bảo hành. Ngược lại, nó lại kéo theo một thay đổi ở điều hoàn toàn khác là khoản 2 Điều 28 về Ban quản lý dự án. Vì vậy, khi tổng mức đầu tư dao động quanh mốc 20 tỷ đồng, chủ đầu tư phải rà đồng thời Điều 9 và Điều 28, chứ không chỉ Điều 9.

## Hoạt động thực hành

**Hoạt động 1. Dựng đề cương thiết kế chi tiết cho dự án ví dụ**

- *Sản phẩm cần tạo:* Đề cương thiết kế chi tiết có đủ các phần từ A đến K như bảng ở Bước 4, trong đó phần B, C, D được viết ở mức đề mục kèm mô tả 3 đến 5 dòng cho mỗi mô hình; phần G liệt kê đầy đủ yêu cầu phi chức năng lấy từ tài liệu ví dụ.
- *Thời lượng dự kiến:* 75 phút.
- *Hình thức:* nhóm 3 đến 5 người; mỗi nhóm nhận 02 trong 08 nhóm chức năng để đặc tả sâu ở phần E.
- *Các bước:*
  1. Xác định số bước thiết kế và luồng áp dụng: đối chiếu điểm a khoản 2 Điều 9 và khoản 2 Điều 18.
  2. Dựng mục lục đề cương theo bảng ở Bước 4, ghi căn cứ cho từng phần.
  3. Viết mô hình tổng thể: xác định ranh giới hệ thống và 03 giao tiếp máy - máy với hệ thống bên ngoài.
  4. Viết phần yêu cầu phi chức năng, bắt buộc có mục về tính sẵn sàng với IPv6 và trích nguyên văn điểm e khoản 2 Điều 15.
  5. Đối chiếu chéo: mỗi yêu cầu ở phần E và phần G phải kiểm thử được và phải xuất hiện lại trong danh mục sản phẩm bàn giao ở phần I.
- *Tiêu chí đánh giá:* xác định đúng thiết kế 01 bước và luồng Điều 20; có đủ ba mô hình tổng thể, lô-gic, vật lý; có mục IPv6 với trích dẫn đúng; có mục giám sát tác giả viện dẫn khoản 5 Điều 9; danh mục bàn giao có mã nguồn của chương trình theo điểm b khoản 1 Điều 24; đánh dấu `[CẦN ĐỐI CHIẾU]` ở mọi chỗ chưa xác minh được nội dung điều khoản.
- *Căn cứ cần dùng:* Điều 9, khoản 8, khoản 9, khoản 10 Điều 3, Điều 14, Điều 15, Điều 18, Điều 20, điểm a khoản 3 Điều 22, điểm b khoản 1 Điều 24 Nghị định 45/2026/NĐ-CP.

**Hoạt động 2. Tính lại toàn bộ hệ quả khi tổng mức đầu tư tăng lên 26 tỷ đồng**

- *Sản phẩm cần tạo:* Bảng so sánh hai phương án 14,5 tỷ đồng và 26 tỷ đồng, tối thiểu 10 dòng, mỗi dòng có cột căn cứ; kèm một đoạn kết luận 5 đến 8 dòng nêu những gì đổi và những gì không đổi.
- *Thời lượng dự kiến:* 40 phút.
- *Hình thức:* cá nhân làm bảng, sau đó ghép cặp rà soát chéo.
- *Các bước:*
  1. Đối chiếu 26 tỷ đồng với điểm a khoản 2 Điều 9, kết luận về số bước thiết kế.
  2. Xác định tài liệu mới phải lập và điều nào quy định nội dung của tài liệu đó.
  3. Xác định đối tượng của luồng thẩm định thiết kế thay đổi thế nào theo khoản 3 Điều 17.
  4. Kiểm tra bốn tiêu chí **không** đổi: nhóm dự án, thời hạn thẩm định, chế độ bảo hành, luồng lập thiết kế chi tiết.
  5. Kiểm tra tiêu chí đổi ở điều khác: khoản 2 Điều 28 về Ban quản lý dự án.
  6. Nêu phương án thay thế theo điểm b khoản 2 Điều 9 và điều kiện để dùng được phương án đó.
- *Tiêu chí đánh giá:* kết luận đúng là thiết kế 02 bước; nhận ra nhóm dự án và mốc thời hạn thẩm định **không** đổi; nhận ra khoản 2 Điều 28 bị ảnh hưởng; nêu đúng ngoại lệ tại điểm b khoản 2 Điều 9 kèm điều kiện phải có văn bản cho phép; mọi dòng đều có viện dẫn.
- *Căn cứ cần dùng:* Điều 9, khoản 1 Điều 12, Điều 13, khoản 3 và khoản 5 Điều 17, khoản 2 Điều 18, Điều 26, khoản 2 Điều 28 Nghị định 45/2026/NĐ-CP; Điều 10, Điều 11 Luật Đầu tư công số 58/2024/QH15.

## Câu hỏi kiểm tra

**Câu 1 (cơ bản).** Theo điểm a khoản 2 Điều 9 Nghị định số 45/2026/NĐ-CP, dự án đầu tư hệ thống được áp dụng thiết kế 01 bước khi tổng mức đầu tư ở mức nào?

- A. Không quá 15 tỷ đồng
- B. Không quá 20 tỷ đồng
- C. Không quá 45 tỷ đồng
- D. Không quá 90 tỷ đồng

**Đáp án: B.**
*Giải thích:* Điểm a khoản 2 Điều 9 quy định nguyên văn "Dự án có tổng mức đầu tư không quá 20 tỷ đồng". Phương án A và C không có căn cứ trong nghị định. Phương án D là mốc phân loại dự án nhóm C theo khoản 4 Điều 11 Luật Đầu tư công số 58/2024/QH15, phục vụ mục đích khác là phân nhóm dự án, không liên quan tới số bước thiết kế. Lưu ý mốc 20 tỷ đồng còn xuất hiện tại khoản 2 Điều 28 với ý nghĩa khác là điều kiện có thể không thành lập Ban quản lý dự án.

**Câu 2 (cơ bản).** Theo khoản 5 Điều 19 Nghị định số 45/2026/NĐ-CP, dự toán có vị trí nào trong hồ sơ?

- A. Là hồ sơ độc lập, trình phê duyệt trước thiết kế chi tiết
- B. Là một nội dung thuộc hồ sơ thiết kế chi tiết
- C. Là một phụ lục của quyết định đầu tư
- D. Là một nội dung thuộc hồ sơ mời thầu

**Đáp án: B.**
*Giải thích:* Khoản 5 Điều 19 quy định nguyên văn "Dự toán là một nội dung thuộc hồ sơ thiết kế chi tiết"; khoản 7 Điều 19 củng cố bằng quy định chủ đầu tư phê duyệt đồng thời, không tách riêng thiết kế chi tiết với dự toán. Phương án A trái trực tiếp khoản 7 Điều 19 vì tách riêng và đảo thứ tự. Phương án C nhầm dự toán với tổng mức đầu tư — tổng mức đầu tư mới là đại lượng gắn với quyết định đầu tư theo Điều 16. Phương án D nhầm dự toán được duyệt với giá gói thầu trong kế hoạch lựa chọn nhà thầu; đó là hai tài liệu ở hai bước khác nhau.

**Câu 3 (trung bình).** Một dự án đầu tư hệ thống **có** hạng mục phần mềm nội bộ. Theo Nghị định số 45/2026/NĐ-CP, ai lập thiết kế chi tiết của dự án này?

- A. Chủ đầu tư tự lập hoặc thuê tư vấn lập trước khi lựa chọn nhà thầu triển khai
- B. Nhà thầu triển khai lập
- C. Đơn vị thẩm định thiết kế lập
- D. Hội đồng thẩm định lập

**Đáp án: B.**
*Giải thích:* Khoản 2 Điều 18 chỉ dẫn dự án đầu tư hệ thống có hạng mục phần mềm nội bộ thực hiện theo Điều 20, và Điều 20 quy định nhà thầu triển khai lập thiết kế chi tiết và triển khai; chủ đầu tư thẩm định theo khoản 5 và phê duyệt theo khoản 6 Điều 20. Chính vì vậy khoản 6 Điều 7 quy định gói thầu vừa lập thiết kế chi tiết vừa triển khai phần mềm nội bộ áp dụng loại gói thầu thiết kế và cung cấp hàng hóa (EP). Phương án A là luồng của Điều 19, chỉ áp dụng cho dự án **không có** hạng mục phần mềm nội bộ theo khoản 1 Điều 18. Phương án C nhầm chức năng thẩm định với chức năng lập — đơn vị thẩm định thiết kế hoạt động theo khoản 3 Điều 17 và không lập thiết kế. Phương án D cũng nhầm như vậy; hội đồng thẩm định làm nhiệm vụ thẩm định theo Điều 39.

**Câu 4 (trung bình).** Dự án đầu tư hệ thống có tổng mức đầu tư 24 tỷ đồng. Chủ đầu tư xét thấy quy mô kỹ thuật đơn giản, muốn áp dụng thiết kế 01 bước. Điều này có được không?

- A. Không, vì vượt 20 tỷ đồng thì bắt buộc thiết kế 02 bước trong mọi trường hợp
- B. Được, chủ đầu tư tự quyết định và ghi vào báo cáo nghiên cứu khả thi
- C. Được, nếu chủ đầu tư báo cáo và cấp có thẩm quyền quyết định đầu tư cho phép
- D. Được, nếu đơn vị thẩm định thiết kế đồng ý bằng văn bản

**Đáp án: C.**
*Giải thích:* Điểm b khoản 2 Điều 9 quy định dự án khác, nếu chủ đầu tư xét thấy có thể thiết kế 01 bước, thì báo cáo cấp có thẩm quyền quyết định đầu tư cho phép. Phương án A sai vì bỏ qua ngoại lệ tại điểm b khoản 2 Điều 9; khoản 3 Điều 9 chỉ áp dụng cho các dự án còn lại sau khi đã loại trừ trường hợp khoản 2. Phương án B sai vì đây không phải quyền tự quyết của chủ đầu tư, phải có văn bản cho phép. Phương án D sai chủ thể: thẩm quyền cho phép thuộc cấp có thẩm quyền **quyết định đầu tư**, không thuộc đơn vị thẩm định thiết kế — đơn vị này chỉ thẩm định thiết kế theo khoản 3 Điều 17.

**Câu 5 (chuyên sâu, tình huống).** Sở Khoa học và Công nghệ tỉnh T đang chuẩn bị dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh". Sau khi rà soát, Sở bổ sung hạng mục hạ tầng và mở rộng phạm vi triển khai xuống cấp xã, làm tổng mức đầu tư tăng từ 14,5 tỷ đồng lên **26 tỷ đồng**. Giám đốc Sở hỏi: hồ sơ và trình tự phải thay đổi những gì, và có cách nào giữ nguyên cách làm cũ không? Ngoài ra, nếu dự án được khởi động lại sau ngày 01/7/2026 thì khác gì?

**Đáp án mẫu:**

*Thứ nhất, thay đổi quyết định nhất là số bước thiết kế.* Tổng mức đầu tư 26 tỷ đồng vượt ngưỡng "không quá 20 tỷ đồng" tại điểm a khoản 2 Điều 9 Nghị định số 45/2026/NĐ-CP, nên dự án chuyển sang **thiết kế 02 bước** theo khoản 3 Điều 9, gồm thiết kế cơ sở và thiết kế chi tiết. Sở phải lập thêm hồ sơ thiết kế cơ sở theo Điều 13, đồng thời khoản 4 Điều 9 quy định các nội dung phải thực hiện khi thiết kế 02 bước, cần đối chiếu toàn văn trước khi lập hồ sơ.

*Thứ hai, thay đổi kéo theo trong hồ sơ trình thẩm định.* Theo khoản 1 Điều 12, báo cáo nghiên cứu khả thi phải thuyết minh rõ thiết kế cơ sở theo Điều 13 thay vì thiết kế chi tiết theo Điều 14. Do đó, đối tượng của luồng thẩm định thiết kế tại khoản 3 Điều 17 cũng chuyển từ thiết kế chi tiết sang thiết kế cơ sở, và báo cáo thẩm định thiết kế lập theo Mẫu 02 Phụ lục sẽ ghi nhận đối tượng khác. Yêu cầu về tính sẵn sàng với IPv6 nay xuất hiện thêm ở điểm a khoản 2 Điều 13, bên cạnh điểm a khoản 2 Điều 14 và điểm e khoản 2 Điều 15.

*Thứ ba, những gì không đổi.* Dự án vẫn dưới 90 tỷ đồng nên vẫn là **dự án nhóm C** theo khoản 4 Điều 11 Luật Đầu tư công số 58/2024/QH15. Vì vậy toàn bộ mốc thời hạn giữ nguyên: thẩm định dự án không quá 20 ngày làm việc, thẩm định thiết kế không quá 10 ngày làm việc, quyết định đầu tư không quá 03 ngày làm việc (khoản 5 và điểm b khoản 7 Điều 17). Chế độ bảo hành cũng giữ nguyên 12 tháng và 05% giá trị sản phẩm (khoản 1, khoản 2 Điều 26). Vì dự án vẫn có hạng mục phần mềm nội bộ nên luồng lập thiết kế chi tiết vẫn là Điều 20 theo khoản 2 Điều 18.

*Thứ tư, một thay đổi ở điều khác dễ bị bỏ sót.* Khoản 2 Điều 28 chỉ cho phép không thành lập Ban quản lý dự án đối với dự án có tổng mức đầu tư từ 20 tỷ đồng trở xuống. Với 26 tỷ đồng, dự án không còn thuộc trường hợp này, nên Sở phải rà lại hình thức quản lý dự án theo Điều 28. `[CẦN ĐỐI CHIẾU: các hình thức quản lý dự án quy định tại khoản 1 và các khoản còn lại của Điều 28 Nghị định 45/2026/NĐ-CP]`

*Thứ năm, có cách giữ nguyên cách làm cũ không.* Có, nhưng có điều kiện. Điểm b khoản 2 Điều 9 cho phép dự án khác áp dụng thiết kế 01 bước nếu chủ đầu tư xét thấy có thể và **báo cáo cấp có thẩm quyền quyết định đầu tư cho phép**. Sở phải lập báo cáo thuyết minh vì sao quy mô kỹ thuật cho phép thiết kế 01 bước, trình người có thẩm quyền quyết định đầu tư và chỉ được thực hiện khi có văn bản cho phép. Không được tự quyết và ghi thẳng vào báo cáo nghiên cứu khả thi.

*Thứ sáu, nếu dự án khởi động lại sau ngày 01/7/2026.* Khi đó áp dụng Nghị định số 224/2026/NĐ-CP theo khoản 1 Điều 91 của nghị định này. Ngưỡng 20 tỷ đồng giữ nguyên tại điểm a khoản 2 Điều 42, nên kết luận thiết kế 02 bước không đổi. Nhưng có một thay đổi lớn về trách nhiệm: **khoản 6 Điều 53 Nghị định số 224/2026/NĐ-CP quy định chủ đầu tư không phải thẩm định, phê duyệt thiết kế chi tiết do nhà thầu triển khai lập**, khác hẳn khoản 5 và khoản 6 Điều 20 Nghị định số 45/2026/NĐ-CP. Sở sẽ rút ngắn được hai thủ tục, nhưng phải bù lại bằng việc siết yêu cầu kỹ thuật trong hồ sơ mời thầu, siết giám sát triển khai, kiểm thử và nghiệm thu, vì không còn cửa kiểm soát ở khâu phê duyệt thiết kế.

*Căn cứ:* Điều 9; khoản 1 Điều 12; Điều 13; Điều 14; điểm e khoản 2 Điều 15; khoản 2 Điều 18; Điều 20; khoản 3, khoản 5, điểm b khoản 7 Điều 17; Điều 26; khoản 2 Điều 28 Nghị định số 45/2026/NĐ-CP; khoản 4 Điều 11 Luật Đầu tư công số 58/2024/QH15; điểm a khoản 2 Điều 42, khoản 6 Điều 53 và khoản 1 Điều 91 Nghị định số 224/2026/NĐ-CP.

## Tóm tắt

- Bước thiết kế chỉ áp dụng với dự án đầu tư hệ thống; thiết kế 01 bước là thiết kế chi tiết, thiết kế 02 bước gồm thiết kế cơ sở và thiết kế chi tiết (khoản 1 Điều 9 Nghị định 45/2026/NĐ-CP).
- Ngưỡng thiết kế 01 bước là tổng mức đầu tư không quá 20 tỷ đồng, so với tổng mức đầu tư chứ không phải chi phí trang thiết bị (điểm a khoản 2 Điều 9).
- Vượt 20 tỷ đồng vẫn có thể thiết kế 01 bước nếu chủ đầu tư báo cáo và cấp có thẩm quyền quyết định đầu tư cho phép (điểm b khoản 2 Điều 9).
- Mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ là tài liệu độc lập và là nguồn của phần yêu cầu kỹ thuật trong hồ sơ mời thầu (Điều 15; khoản 6 Điều 7).
- Dự án không có phần mềm nội bộ đi theo Điều 19, dự án có phần mềm nội bộ đi theo Điều 20, ở đó nhà thầu triển khai lập thiết kế chi tiết (khoản 1, khoản 2 Điều 18).
- Dự toán là một nội dung thuộc hồ sơ thiết kế chi tiết và được phê duyệt đồng thời, không tách riêng (khoản 5, khoản 7 Điều 19); phương pháp xác định theo khoản 4 đến khoản 7 Điều 16.
- Tổ chức, cá nhân thiết kế chi tiết phải giám sát tác giả suốt quá trình triển khai và nghiệm thu; yêu cầu về tính sẵn sàng với IPv6 phải nhất quán ở cả ba tài liệu (khoản 5 Điều 9; điểm a khoản 2 Điều 13; điểm a khoản 2 Điều 14; điểm e khoản 2 Điều 15).
- Từ ngày 01/7/2026, ngưỡng 20 tỷ đồng giữ nguyên tại điểm a khoản 2 Điều 42, nhưng **khoản 6 Điều 53 Nghị định 224/2026/NĐ-CP quy định chủ đầu tư không phải thẩm định, phê duyệt thiết kế chi tiết do nhà thầu triển khai lập** — kiểm soát chuyển từ khâu phê duyệt sang khâu giám sát, kiểm thử và nghiệm thu.
