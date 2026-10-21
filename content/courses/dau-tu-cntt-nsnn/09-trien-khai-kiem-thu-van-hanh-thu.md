---
course: dau-tu-cntt-nsnn
slug: 09-trien-khai-kiem-thu-van-hanh-thu
ordinal: 9
title: "Triển khai, giám sát triển khai, kiểm thử, vận hành thử và đào tạo"
as_of: 2026-09-06
status: draft
review_state: cho_phap_che_duyet
---

# Bài 09. Triển khai, giám sát triển khai, kiểm thử, vận hành thử và đào tạo

> **Căn cứ tại ngày:** 06/9/2026
> **Trạng thái:** bản nháp, **nội dung chờ pháp chế duyệt**. Trước khi sử dụng để giảng dạy hoặc lập hồ sơ dự án, phải đối chiếu với toàn văn văn bản còn hiệu lực.
>
> **CẢNH BÁO HIỆU LỰC.** Nghị định số 45/2026/NĐ-CP **đã hết hiệu lực kể từ ngày 01/7/2026**, bị thay thế bởi Nghị định số 224/2026/NĐ-CP ngày 24/6/2026 của Chính phủ quy định chi tiết một số điều và biện pháp thi hành Luật Chuyển đổi số (điểm a khoản 2 Điều 90 Nghị định số 224/2026/NĐ-CP). Bài học này áp dụng trực tiếp cho **nhóm dự án chuyển tiếp**: dự án đã được quyết định đầu tư hoặc đã có báo cáo thẩm định trước ngày 01/7/2026 (Điều 91 Nghị định số 224/2026/NĐ-CP). Với dự án khởi động sau ngày 01/7/2026, phải đối chiếu sang Nghị định số 224/2026/NĐ-CP, Thông tư số 39/2026/TT-BKHCN và Thông tư số 41/2026/TT-BKHCN. Xem Bài 01 mục 6.

## Mục tiêu bài học

Sau khi hoàn thành bài học, học viên có thể:

- Phân biệt được bốn công tác riêng biệt trong giai đoạn thực hiện đầu tư: triển khai, giám sát công tác triển khai, kiểm thử và vận hành thử; chỉ ra căn cứ pháp lý của từng công tác.
- Xác định đúng hạng mục nào của dự án phải giám sát công tác triển khai và hạng mục nào bắt buộc phải kiểm thử theo điểm a khoản 3 Điều 22.
- Lập được kịch bản kiểm thử cho một nhóm chức năng của phần mềm nội bộ, có truy vết ngược về yêu cầu kỹ thuật đã được mô tả theo Điều 15.
- Lập được kế hoạch vận hành thử và xác định nội dung tối thiểu của báo cáo kết quả vận hành thử, kể cả trường hợp phải vận hành thử lại.
- Phân biệt cơ chế kiểm soát chất lượng của dự án đầu tư hệ thống với cơ chế giám sát chất lượng dịch vụ của dự án thuê dịch vụ công nghệ thông tin theo Điều 23.

## Căn cứ pháp lý của bài học

| # | Căn cứ | Nội dung điều chỉnh |
|---|--------|---------------------|
| 1 | Điều 22 Nghị định số 45/2026/NĐ-CP ngày 26/01/2026 của Chính phủ quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước | Công tác triển khai, giám sát công tác triển khai, kiểm thử và vận hành thử đối với dự án đầu tư hệ thống và dự án mua sắm |
| 2 | Điểm a khoản 3 Điều 22 Nghị định số 45/2026/NĐ-CP | Xác định hạng mục phải giám sát công tác triển khai và hạng mục phần mềm nội bộ phải thực hiện kiểm thử |
| 3 | Khoản 4 Điều 22 Nghị định số 45/2026/NĐ-CP | Vận hành thử trước nghiệm thu; lập báo cáo kết quả vận hành thử; vận hành thử lại sau khi nhà thầu hoàn thiện |
| 4 | Khoản 2 và khoản 3 Điều 23 Nghị định số 45/2026/NĐ-CP | Vận hành thử và giám sát chất lượng dịch vụ công nghệ thông tin đối với dự án thuê dịch vụ |
| 5 | Khoản 5 Điều 9 Nghị định số 45/2026/NĐ-CP; khoản 6 Điều 3 Nghị định số 45/2026/NĐ-CP | Nghĩa vụ giám sát tác giả của tổ chức, cá nhân lập thiết kế chi tiết; định nghĩa giám sát tác giả |
| 6 | Điều 15 Nghị định số 45/2026/NĐ-CP | Mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ — đầu vào bắt buộc của kịch bản kiểm thử |
| 7 | Điểm a khoản 2 Điều 16 Nghị định số 45/2026/NĐ-CP | Chi phí đào tạo, tập huấn hướng dẫn sử dụng, đào tạo cán bộ quản trị, vận hành là khoản mục của tổng mức đầu tư |
| 8 | Điểm b và điểm c khoản 3 Điều 37 Nghị định số 45/2026/NĐ-CP | Giao Bộ trưởng Bộ Khoa học và Công nghệ hướng dẫn chi tiết công tác triển khai, giám sát triển khai, kiểm thử, vận hành thử; xác định và giám sát chất lượng dịch vụ |
| 9 | Điều 40 Nghị định số 45/2026/NĐ-CP | Trách nhiệm của tổ chức, cá nhân tham gia hoạt động đầu tư |

## Nội dung

### 1. Vị trí của giai đoạn triển khai trong trình tự đầu tư

Điều 8 Nghị định số 45/2026/NĐ-CP chia trình tự đầu tư dự án thành ba giai đoạn: chuẩn bị đầu tư, thực hiện đầu tư và kết thúc đầu tư. Toàn bộ nội dung bài học này nằm trong **giai đoạn thực hiện đầu tư**, sau khi thiết kế chi tiết đã được xử lý theo Điều 19 hoặc Điều 20 và sau khi đã lựa chọn được nhà thầu. Bài học kế tiếp (Bài 10) xử lý phần cuối của giai đoạn thực hiện đầu tư và toàn bộ giai đoạn kết thúc đầu tư.

Điểm quan trọng về mặt quản lý: **giai đoạn này là nơi rủi ro chất lượng hiện ra, nhưng cũng là nơi hồ sơ thường mỏng nhất**. Hồ sơ chuẩn bị đầu tư luôn dày vì có nhiều bước thẩm định, phê duyệt. Đến giai đoạn triển khai, nhiều chủ đầu tư chỉ giữ lại biên bản nghiệm thu cuối cùng, trong khi nghị định đòi hỏi một chuỗi bằng chứng liên tục: hồ sơ giám sát công tác triển khai, hồ sơ kiểm thử, báo cáo kết quả vận hành thử. Thiếu chuỗi bằng chứng này thì việc nghiệm thu ở Bài 10 không có căn cứ, và hồ sơ hoàn thành theo Điều 25 sẽ bị đánh giá là không đầy đủ.

### 2. Bốn công tác khác nhau, không được gộp làm một

Điều 22 Nghị định số 45/2026/NĐ-CP điều chỉnh **dự án đầu tư hệ thống và dự án mua sắm** với tên gọi đầy đủ là "Công tác triển khai, giám sát công tác triển khai, kiểm thử và vận hành thử". Bốn công tác này có chủ thể, đối tượng và sản phẩm khác nhau:

| Công tác | Ai làm | Đối tượng | Sản phẩm |
|----------|--------|-----------|----------|
| Triển khai | Nhà thầu triển khai | Toàn bộ hạng mục theo hợp đồng | Sản phẩm, hạng mục công việc |
| Giám sát công tác triển khai | Chủ đầu tư hoặc tổ chức tư vấn giám sát do chủ đầu tư thuê | Lắp đặt mạng, phần cứng, cài đặt phần mềm thương mại (điểm a khoản 3 Điều 22) | Nhật ký giám sát, báo cáo giám sát |
| Kiểm thử | Theo tổ chức của chủ đầu tư; có thể thuê kiểm thử độc lập | **Hạng mục phần mềm nội bộ** (điểm a khoản 3 Điều 22) | Kịch bản kiểm thử, kết quả kiểm thử, hồ sơ lỗi |
| Vận hành thử | Chủ đầu tư chủ trì, nhà thầu phối hợp | Sản phẩm của dự án trước khi nghiệm thu (khoản 4 Điều 22) | **Báo cáo kết quả vận hành thử** |

Việc gộp bốn công tác thành một biên bản duy nhất là lỗi hồ sơ phổ biến nhất ở giai đoạn này. Mỗi công tác có mục đích kiểm soát riêng: giám sát triển khai kiểm soát **quá trình**; kiểm thử kiểm soát **sự phù hợp của phần mềm với yêu cầu đã mô tả**; vận hành thử kiểm soát **khả năng vận hành trong điều kiện gần với thực tế**.

### 3. Giám sát công tác triển khai — kiểm soát quá trình

Điểm a khoản 3 Điều 22 xác định rõ ranh giới: việc triển khai lắp đặt mạng, lắp đặt phần cứng, cài đặt phần mềm thương mại **phải được giám sát công tác triển khai**; còn hạng mục phần mềm nội bộ thì **phải thực hiện công tác kiểm thử**. Đây là hai cơ chế khác nhau chứ không phải hai tên gọi của cùng một việc.

Lý do của sự phân biệt nằm ở bản chất sản phẩm. Với thiết bị phần cứng và phần mềm thương mại, chất lượng sản phẩm đã được nhà sản xuất bảo đảm; rủi ro nằm ở **quá trình**: lắp đặt đúng vị trí, đúng cấu hình, đúng chủng loại, đúng số lượng, đúng xuất xứ so với hợp đồng và thiết kế chi tiết. Vì vậy công cụ kiểm soát là giám sát liên tục tại hiện trường, ghi nhật ký, đối chiếu chứng từ nhập khẩu, tem nhãn, số sê-ri.

Với phần mềm nội bộ, không có "nhà sản xuất" nào bảo đảm trước; sản phẩm được tạo ra riêng cho dự án này. Rủi ro nằm ở **sự phù hợp với yêu cầu**, và công cụ kiểm soát tương ứng là kiểm thử.

Trong thực tiễn, hồ sơ giám sát công tác triển khai gồm tối thiểu: đề cương và kế hoạch giám sát được chủ đầu tư chấp thuận; nhật ký giám sát theo ngày hoặc theo đợt; biên bản kiểm tra vật tư, thiết bị trước khi lắp đặt; biên bản nghiệm thu từng hạng mục hoặc từng giai đoạn; báo cáo giám sát định kỳ và báo cáo tổng hợp. Chi phí giám sát công tác triển khai là một nội dung của **chi phí tư vấn đầu tư** (điểm c khoản 2 Điều 16), sẽ được trình bày kỹ ở Bài 11.

### 4. Kiểm thử hạng mục phần mềm nội bộ

Kiểm thử là công tác bắt buộc, không phải tùy chọn, đối với mọi dự án có hạng mục phần mềm nội bộ (điểm a khoản 3 Điều 22). Ba nguyên tắc nghiệp vụ chi phối cách lập hồ sơ kiểm thử.

**Nguyên tắc thứ nhất: kiểm thử phải truy vết ngược về Điều 15.** Điều 15 Nghị định số 45/2026/NĐ-CP quy định nội dung mô tả yêu cầu kỹ thuật cần đáp ứng của phần mềm nội bộ, gồm cả yêu cầu chức năng và yêu cầu phi chức năng. Mỗi trường hợp kiểm thử phải chỉ ra nó kiểm chứng yêu cầu nào trong bản mô tả đó. Một bộ kịch bản kiểm thử không có cột "yêu cầu tương ứng" thì không chứng minh được phạm vi kiểm thử đã bao phủ hết yêu cầu, và do đó không dùng làm căn cứ nghiệm thu được.

**Nguyên tắc thứ hai: yêu cầu phi chức năng cũng phải kiểm thử.** Điểm e khoản 2 Điều 15 quy định:

> Yêu cầu về tính sẵn sàng với IPv6 hoặc giải pháp nâng cấp bảo đảm sẵn sàng với IPv6 nếu hoạt động trên môi trường Internet.

Đây là ví dụ điển hình của yêu cầu phi chức năng có thể kiểm chứng được bằng một kịch bản cụ thể. Tương tự với yêu cầu về hiệu năng, an toàn thông tin, ký số, nhật ký hệ thống, sao lưu và phục hồi. Bộ kịch bản chỉ kiểm thử chức năng nghiệp vụ là bộ kịch bản thiếu.

**Nguyên tắc thứ ba: kết quả kiểm thử phải quản lý được theo vòng đời lỗi.** Hồ sơ kiểm thử không chỉ gồm danh sách trường hợp "đạt" hay "không đạt", mà phải có sổ theo dõi lỗi với các trường: mã lỗi, mức độ nghiêm trọng, ngày phát hiện, người phát hiện, phiên bản phát hiện, trạng thái xử lý, phiên bản khắc phục, kết quả kiểm thử lại. Đây chính là bằng chứng cho việc "nhà thầu đã hoàn thiện" ở khoản 4 Điều 22.

Việc thuê tổ chức kiểm thử độc lập là một lựa chọn quản lý, không phải nghĩa vụ do nghị định áp đặt. Khi lựa chọn phương án này, chi phí kiểm thử độc lập nằm trong chi phí tư vấn đầu tư (điểm c khoản 2 Điều 16), và phải được dự kiến ngay từ khi lập tổng mức đầu tư.

`[CẦN ĐỐI CHIẾU: quy định chi tiết về trình tự, nội dung, cấp độ và hồ sơ kiểm thử — thuộc nội dung Bộ trưởng Bộ Khoa học và Công nghệ hướng dẫn theo điểm b khoản 3 Điều 37 Nghị định 45/2026/NĐ-CP; tính đến ngày 06/9/2026 chưa xác minh được có thông tư hướng dẫn Nghị định 45/2026/NĐ-CP hay không. Với dự án áp dụng Nghị định 224/2026/NĐ-CP, đối chiếu Thông tư số 41/2026/TT-BKHCN về quản lý chất lượng]`

### 5. Vận hành thử, báo cáo kết quả vận hành thử và vận hành thử lại

Khoản 4 Điều 22 đặt ra ba nghĩa vụ nối tiếp nhau:

- Sản phẩm của dự án **phải được vận hành thử trước khi nghiệm thu**;
- Kết quả vận hành thử phải được lập thành **báo cáo kết quả vận hành thử**;
- Sau khi nhà thầu hoàn thiện, **phải vận hành thử lại**.

Nghĩa vụ thứ nhất định nghĩa một điều kiện tiên quyết: không có vận hành thử thì không được nghiệm thu. Đây là điểm chốt của toàn bộ bài học, vì trong thực tế nhiều dự án chuyển thẳng từ kiểm thử sang nghiệm thu để kịp giải ngân cuối năm.

Nghĩa vụ thứ ba là điểm dễ bỏ sót nhất. Logic của quy định như sau: vận hành thử lần đầu phát hiện tồn tại; nhà thầu khắc phục; nếu chỉ căn cứ vào văn bản báo cáo đã khắc phục của nhà thầu để nghiệm thu thì chủ đầu tư không có bằng chứng độc lập. Vì vậy nghị định buộc phải vận hành thử lại. Trong hồ sơ, điều này thể hiện bằng **hai báo cáo kết quả vận hành thử** (hoặc một báo cáo có phần bổ sung ghi rõ kết quả vận hành thử lại), kèm bảng đối chiếu từng tồn tại đã nêu lần trước với kết quả xử lý.

Kế hoạch vận hành thử nên xác định rõ, tối thiểu: phạm vi hệ thống đưa vào vận hành thử; thời gian bắt đầu và kết thúc; môi trường vận hành thử; thành phần tham gia và vai trò; dữ liệu dùng để vận hành thử và cách xử lý dữ liệu đó khi kết thúc; các tiêu chí chấp nhận; cơ chế ghi nhận và phân loại sự cố; điều kiện dừng vận hành thử; và cách xử lý khi kết quả không đạt.

Một lưu ý về chi phí: điểm a khoản 2 Điều 16 xác định tổng mức đầu tư bao gồm **chi phí triển khai, hỗ trợ, quản trị, vận hành sản phẩm hoặc hạng mục công việc của dự án trước khi nghiệm thu bàn giao toàn bộ sản phẩm của dự án (nếu có)**. Chi phí duy trì hệ thống trong thời gian vận hành thử thuộc khoản mục này, tức là **chi phí đầu tư**, không phải chi thường xuyên. Sau khi nghiệm thu bàn giao, chi phí quản trị, vận hành, bảo trì chuyển sang nguồn kinh phí chi thường xuyên (khoản 3 Điều 27).

### 6. Dự án thuê dịch vụ: cơ chế kiểm soát khác hẳn

Với dự án thuê dịch vụ công nghệ thông tin, Điều 23 thay thế Điều 22. Hai khác biệt căn bản:

**Thứ nhất, có vận hành thử nhưng không có kiểm thử phần mềm nội bộ.** Khoản 2 Điều 23 quy định về vận hành thử đối với dự án thuê dịch vụ. Bên thuê không sở hữu phần mềm, không nhận bàn giao mã nguồn, nên cơ chế kiểm thử theo Điều 22 không áp dụng. Việc kiểm chứng tập trung vào khả năng đáp ứng yêu cầu chất lượng dịch vụ đã cam kết.

**Thứ hai, giám sát chất lượng dịch vụ thay cho giám sát công tác triển khai.** Khoản 3 Điều 23 quy định về giám sát chất lượng dịch vụ công nghệ thông tin. Đây là hoạt động **liên tục trong suốt thời gian thuê**, không kết thúc tại một mốc nghiệm thu như dự án đầu tư hệ thống. Yêu cầu chất lượng dịch vụ phải được xác định ngay từ báo cáo nghiên cứu khả thi (điểm b khoản 3 Điều 12), sau đó trở thành cơ sở để giám sát và để nghiệm thu kết quả cung cấp dịch vụ theo từng kỳ.

Việc xác định yêu cầu chất lượng dịch vụ, giám sát chất lượng dịch vụ và nghiệm thu kết quả cung cấp dịch vụ thuộc nội dung Bộ trưởng Bộ Khoa học và Công nghệ hướng dẫn chi tiết (điểm c khoản 3 Điều 37).

### 7. Giám sát tác giả, công tác đào tạo và điều tương ứng của nghị định thay thế

**Giám sát tác giả.** Khoản 5 Điều 9 quy định tổ chức, cá nhân thực hiện thiết kế chi tiết phải thực hiện giám sát tác giả trong suốt quá trình triển khai và nghiệm thu. Định nghĩa giám sát tác giả nằm tại khoản 6 Điều 3. Đây là nghĩa vụ **đi liền với người lập thiết kế**, không phải công việc của tư vấn giám sát. Trong dự án theo luồng Điều 20 — nhà thầu triển khai đồng thời lập thiết kế chi tiết — thì chính nhà thầu triển khai là chủ thể giám sát tác giả; chủ đầu tư phải đưa nghĩa vụ này thành điều khoản hợp đồng và yêu cầu sản phẩm cụ thể (biên bản giám sát tác giả, ý kiến xử lý sai khác giữa thực tế triển khai và thiết kế), nếu không sẽ không có bằng chứng thực hiện.

**Đào tạo.** Đào tạo không phải một thủ tục pháp lý riêng, nhưng là một khoản mục chi phí được nghị định gọi tên trực tiếp. Điểm a khoản 2 Điều 16 xếp vào chi phí trang thiết bị các khoản: đào tạo, tập huấn hướng dẫn sử dụng và **đào tạo cán bộ quản trị, vận hành**. Hai loại đào tạo này khác nhau về đối tượng, thời lượng và sản phẩm: đào tạo người dùng cuối hướng tới thao tác nghiệp vụ; đào tạo quản trị, vận hành hướng tới khả năng tiếp nhận hệ thống sau bàn giao. Hồ sơ đào tạo (tài liệu đào tạo, danh sách học viên, kết quả đánh giá) là một phần của danh mục bàn giao đối với hạng mục phần mềm nội bộ theo điểm b khoản 1 Điều 24, sẽ trình bày ở Bài 10.

Kinh nghiệm nghiệp vụ: nên bố trí đợt đào tạo quản trị, vận hành **trước hoặc trong thời gian vận hành thử**, để chính cán bộ sẽ tiếp nhận hệ thống là người tham gia vận hành thử. Đây là khuyến nghị nghiệp vụ, không phải quy định bắt buộc của nghị định.

**Đối chiếu sang Nghị định số 224/2026/NĐ-CP.** Với dự án khởi động sau ngày 01/7/2026, nội dung của Điều 22 chuyển sang **Điều 55 Nghị định số 224/2026/NĐ-CP** (triển khai, kiểm thử, vận hành thử) và nội dung của Điều 23 chuyển sang **Điều 56 Nghị định số 224/2026/NĐ-CP** (thuê dịch vụ). Định nghĩa "giám sát tác giả" chuyển từ khoản 6 Điều 3 sang **khoản 4 Điều 3**; định nghĩa "phần mềm nội bộ" chuyển từ khoản 13 Điều 3 sang **khoản 11 Điều 3**. Nội dung giao Bộ trưởng Bộ Khoa học và Công nghệ hướng dẫn chi tiết chuyển từ khoản 3 Điều 37 sang **khoản 7 Điều 81**. Một thay đổi có ảnh hưởng gián tiếp nhưng rất lớn tới giai đoạn này: khoản 6 Điều 53 Nghị định số 224/2026/NĐ-CP quy định chủ đầu tư **không phải** thẩm định, phê duyệt thiết kế chi tiết do nhà thầu triển khai lập; khi khâu phê duyệt được bỏ, trọng lượng kiểm soát dồn hết sang khâu giám sát, kiểm thử và vận hành thử của bài học này.

### 8. Những điểm dễ nhầm

**Nhầm thứ nhất: coi giám sát công tác triển khai và kiểm thử là một.** Điểm a khoản 3 Điều 22 phân định rõ: lắp đặt mạng, phần cứng, cài đặt phần mềm thương mại thì giám sát công tác triển khai; hạng mục phần mềm nội bộ thì kiểm thử. Dự án có cả hai loại hạng mục phải làm cả hai công tác, với hai bộ hồ sơ riêng.

**Nhầm thứ hai: bỏ bước vận hành thử lại.** Khoản 4 Điều 22 yêu cầu vận hành thử lại sau khi nhà thầu hoàn thiện. Nhiều hồ sơ chỉ có một báo cáo kết quả vận hành thử kèm công văn của nhà thầu xác nhận đã khắc phục tồn tại. Đó không phải vận hành thử lại và không đáp ứng khoản 4 Điều 22.

**Nhầm thứ ba: áp dụng cơ chế kiểm thử của Điều 22 cho dự án thuê dịch vụ.** Dự án thuê dịch vụ áp dụng Điều 23: vận hành thử theo khoản 2 và giám sát chất lượng dịch vụ theo khoản 3, giám sát liên tục trong suốt thời gian thuê. Nhầm lẫn này thường kéo theo một sai sót nữa là đưa điều khoản bảo hành vào hợp đồng thuê dịch vụ, trong khi khoản 4 Điều 26 quy định không áp dụng bảo hành đối với dự án thuê dịch vụ công nghệ thông tin.

**Nhầm thứ tư: bỏ quên nghĩa vụ giám sát tác giả.** Khoản 5 Điều 9 buộc tổ chức, cá nhân lập thiết kế chi tiết giám sát tác giả suốt quá trình triển khai và nghiệm thu. Khi thiết kế chi tiết do chính nhà thầu triển khai lập theo Điều 20, nghĩa vụ này vẫn tồn tại và phải được thể hiện bằng sản phẩm cụ thể trong hồ sơ.

## Áp dụng cho dự án ví dụ

Dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh" của Sở Khoa học và Công nghệ tỉnh T, tổng mức đầu tư 14,5 tỷ đồng, dự án nhóm C, dự án đầu tư hệ thống có hạng mục phần mềm nội bộ gồm 08 nhóm chức năng. Theo mốc thời gian giả định, giai đoạn triển khai, kiểm thử, vận hành thử và đào tạo kéo dài từ tháng 02/2027 đến tháng 4/2028.

**Bước 1 — Phân tách hạng mục để xác định cơ chế kiểm soát.**

| Hạng mục | Giá trị giả định (đồng) | Cơ chế bắt buộc | Căn cứ |
|----------|-------------------------|-----------------|--------|
| Phần mềm nội bộ, 08 nhóm chức năng | 8.200.000.000 | **Kiểm thử** | điểm a khoản 3 Điều 22 |
| Phần mềm thương mại (hệ quản trị cơ sở dữ liệu, phần mềm nền tảng) | 1.150.000.000 | **Giám sát công tác triển khai** (cài đặt) | điểm a khoản 3 Điều 22 |
| Thiết bị phần cứng bổ sung tại trung tâm dữ liệu | 1.600.000.000 | **Giám sát công tác triển khai** (lắp đặt) | điểm a khoản 3 Điều 22 |
| Tạo lập cơ sở dữ liệu, chuẩn hóa, chuyển đổi, nhập dữ liệu | 850.000.000 | Nghiệm thu khối lượng và chất lượng dữ liệu; đối chiếu với thiết kế chi tiết | Điều 14, Điều 22 |
| Lắp đặt thiết bị, cài đặt phần mềm, kiểm tra hiệu chỉnh | 180.000.000 | **Giám sát công tác triển khai** | điểm a khoản 3 Điều 22 |
| Đào tạo, tập huấn và đào tạo quản trị, vận hành | 320.000.000 | Hồ sơ đào tạo; là căn cứ bàn giao ở Bài 10 | điểm a khoản 2 Điều 16; điểm b khoản 1 Điều 24 |
| Triển khai, hỗ trợ, quản trị, vận hành trước nghiệm thu bàn giao toàn bộ | 250.000.000 | Nguồn bảo đảm cho giai đoạn vận hành thử | điểm a khoản 2 Điều 16 |

Kết luận: dự án phải thực hiện **đồng thời** cả giám sát công tác triển khai và kiểm thử, với hai bộ hồ sơ riêng biệt.

**Bước 2 — Xây dựng ma trận truy vết kiểm thử.** Với 08 nhóm chức năng đã mô tả tại tài liệu ví dụ dự án, mỗi nhóm chức năng được phân rã thành các trường hợp sử dụng chính, mỗi trường hợp sử dụng sinh ra ít nhất một trường hợp kiểm thử đường thuận (luồng chính thành công) và một trường hợp kiểm thử đường nghịch (dữ liệu không hợp lệ, thiếu quyền, gián đoạn giữa chừng).

| Nhóm chức năng | Số trường hợp sử dụng chính | Yêu cầu phi chức năng phải kiểm thử kèm |
|----------------|-----------------------------|------------------------------------------|
| 1. Tiếp nhận đề xuất nhiệm vụ trực tuyến | 06 | Ký số; chịu tải cao điểm 1.500 hồ sơ trong 15 ngày; sẵn sàng IPv6 |
| 2. Tổ chức hội đồng tư vấn xác định nhiệm vụ | 06 | Phân quyền theo vai trò; tài khoản tạm theo phiên họp |
| 3. Tuyển chọn hoặc giao trực tiếp tổ chức chủ trì | 06 | Công khai kết quả; nhật ký thao tác |
| 4. Quản lý hợp đồng và kinh phí | 06 | Toàn vẹn số liệu; đối chiếu với đơn vị tài chính |
| 5. Theo dõi tiến độ, báo cáo định kỳ, kiểm tra giữa kỳ | 05 | Nhắc việc, cảnh báo tự động |
| 6. Đánh giá, nghiệm thu; lưu trữ và công bố kết quả | 06 | Ký số văn bản kết xuất; lưu trữ tệp đính kèm |
| 7. Tra cứu công khai, thống kê và kết nối dữ liệu | 05 | Thời gian phản hồi dưới 3 giây; báo cáo tổng hợp dưới 10 giây; đồng bộ với cơ sở dữ liệu quốc gia; đăng nhập bằng tài khoản định danh điện tử |
| 8. Quản trị hệ thống, phân quyền, nhật ký, sao lưu | 06 | Nhật ký truy cập lưu tối thiểu 12 tháng; sao lưu hằng ngày; diễn tập phục hồi |

Mỗi dòng trong bộ kịch bản kiểm thử phải có cột viện dẫn tới mục tương ứng trong bản mô tả yêu cầu kỹ thuật lập theo Điều 15, để chứng minh phạm vi bao phủ.

**Bước 3 — Kế hoạch vận hành thử.** Sở Khoa học và Công nghệ tỉnh T lập kế hoạch vận hành thử với các nội dung: phạm vi gồm toàn bộ 08 nhóm chức năng trên môi trường của trung tâm dữ liệu tỉnh; thành phần tham gia gồm chuyên viên quản lý nhiệm vụ, chuyên viên tài chính - kế toán, quản trị hệ thống, đại diện tổ chức chủ trì nhiệm vụ và nhà thầu triển khai; dữ liệu vận hành thử là dữ liệu thật của một đợt tiếp nhận đề xuất, có biện pháp bảo vệ dữ liệu cá nhân theo yêu cầu phi chức năng đã đặt ra; tiêu chí chấp nhận là toàn bộ trường hợp kiểm thử mức nghiêm trọng cao đều đạt, không còn lỗi chặn nghiệp vụ.

**Bước 4 — Xử lý kết quả vận hành thử lần đầu.** Giả định vận hành thử lần đầu ghi nhận 12 tồn tại, trong đó 03 tồn tại mức chặn (đồng bộ với cơ sở dữ liệu quốc gia không thành công; báo cáo tổng hợp vượt 10 giây; nhật ký không ghi đủ trường thông tin). Chủ đầu tư lập báo cáo kết quả vận hành thử, yêu cầu nhà thầu hoàn thiện. Sau khi nhà thầu hoàn thiện, chủ đầu tư **tổ chức vận hành thử lại** theo khoản 4 Điều 22 và lập báo cáo kết quả vận hành thử lần hai, kèm bảng đối chiếu 12 tồn tại với trạng thái xử lý. Chỉ khi báo cáo lần hai kết luận đạt thì mới chuyển sang nghiệm thu theo Điều 24.

**Bước 5 — Đào tạo.** Trong khoản 320.000.000 đồng chi phí đào tạo, tách hai cấu phần: tập huấn hướng dẫn sử dụng cho chuyên viên các sở, ngành và tổ chức chủ trì; và đào tạo cán bộ quản trị, vận hành của Sở. Đợt đào tạo quản trị, vận hành bố trí trước khi bắt đầu vận hành thử để cán bộ tiếp nhận hệ thống trực tiếp tham gia vận hành thử.

**Phân tích độ nhạy.** Nếu tỉnh T chuyển phương án sang **thuê dịch vụ** nền tảng quản lý nhiệm vụ khoa học và công nghệ thay vì tự đầu tư, toàn bộ kết cấu bài học đổi: áp dụng Điều 23 thay cho Điều 22; không còn công tác kiểm thử hạng mục phần mềm nội bộ vì không có phần mềm nội bộ; vẫn có vận hành thử theo khoản 2 Điều 23; nhưng cơ chế kiểm soát chính chuyển thành **giám sát chất lượng dịch vụ** theo khoản 3 Điều 23, thực hiện liên tục trong suốt thời gian thuê thay vì kết thúc tại mốc nghiệm thu. Kéo theo đó, khoản mục chi phí kiểm thử độc lập trong chi phí tư vấn không còn, thay bằng chi phí giám sát chất lượng dịch vụ; và không áp dụng quy định bảo hành (khoản 4 Điều 26).

Một độ nhạy thứ hai: nếu dự án chỉ mua sắm thiết bị và phần mềm thương mại, không có hạng mục phần mềm nội bộ, thì chỉ phải giám sát công tác triển khai, không phải kiểm thử; nhưng nghĩa vụ vận hành thử và vận hành thử lại tại khoản 4 Điều 22 **vẫn giữ nguyên**, vì khoản này áp dụng cho sản phẩm của dự án nói chung.

## Hoạt động thực hành

**Hoạt động 1. Lập kịch bản kiểm thử cho một nhóm chức năng**

- *Sản phẩm cần tạo:* Bộ kịch bản kiểm thử cho **Nhóm chức năng 1 — Tiếp nhận đề xuất nhiệm vụ khoa học và công nghệ trực tuyến**, tối thiểu 12 trường hợp kiểm thử, trình bày dạng bảng với các cột: mã trường hợp, yêu cầu tương ứng theo Điều 15, tiền điều kiện, dữ liệu đầu vào, các bước thực hiện, kết quả mong đợi, mức độ nghiêm trọng, kết quả thực tế, trạng thái.
- *Thời lượng dự kiến:* 60 phút.
- *Hình thức:* nhóm 3 đến 5 người; mỗi nhóm nhận một tác nhân khác nhau trong bảng tác nhân của dự án ví dụ.
- *Các bước:*
  1. Liệt kê 06 trường hợp sử dụng chính của Nhóm chức năng 1 theo tài liệu ví dụ dự án.
  2. Với mỗi trường hợp sử dụng, viết ít nhất một trường hợp kiểm thử đường thuận và một trường hợp kiểm thử đường nghịch.
  3. Bổ sung tối thiểu 03 trường hợp kiểm thử cho yêu cầu phi chức năng: ký số, chịu tải cao điểm, tính sẵn sàng với IPv6 theo điểm e khoản 2 Điều 15.
  4. Điền cột "yêu cầu tương ứng" để tạo ma trận truy vết ngược về bản mô tả yêu cầu kỹ thuật lập theo Điều 15.
  5. Thiết kế mẫu sổ theo dõi lỗi kèm theo, có trường phiên bản phát hiện và phiên bản khắc phục.
- *Tiêu chí đánh giá:* mỗi trường hợp kiểm thử có kết quả mong đợi đo được, không dùng từ định tính chung chung; có đủ trường hợp đường nghịch; có ít nhất 03 trường hợp kiểm thử yêu cầu phi chức năng; 100% trường hợp kiểm thử có viện dẫn yêu cầu tương ứng; sổ theo dõi lỗi đủ trường để chứng minh việc kiểm thử lại.
- *Căn cứ cần dùng:* Điều 15; điểm a khoản 3 Điều 22 Nghị định 45/2026/NĐ-CP; mục 3 và mục 4 của tài liệu ví dụ dự án.

**Hoạt động 2. Lập kế hoạch vận hành thử và khung báo cáo kết quả vận hành thử**

- *Sản phẩm cần tạo:* Kế hoạch vận hành thử của dự án ví dụ và khung báo cáo kết quả vận hành thử, trong đó thể hiện rõ cơ chế vận hành thử lại.
- *Thời lượng dự kiến:* 45 phút.
- *Hình thức:* nhóm 3 đến 5 người, trình bày và phản biện chéo giữa hai nhóm.
- *Các bước:*
  1. Xác định phạm vi, thời gian, môi trường và thành phần tham gia vận hành thử.
  2. Xác định dữ liệu dùng cho vận hành thử và biện pháp bảo vệ dữ liệu cá nhân.
  3. Xây dựng tiêu chí chấp nhận và tiêu chí dừng vận hành thử.
  4. Thiết kế cấu trúc báo cáo kết quả vận hành thử, gồm phần kết luận và phụ lục danh mục tồn tại.
  5. Bổ sung quy trình xử lý sau khi nhà thầu hoàn thiện: điều kiện tổ chức vận hành thử lại, bảng đối chiếu tồn tại và kết quả xử lý, điều kiện chuyển sang nghiệm thu.
  6. Xác định khoản mục chi phí bảo đảm cho giai đoạn vận hành thử và viện dẫn căn cứ.
- *Tiêu chí đánh giá:* có đủ bước vận hành thử lại theo khoản 4 Điều 22; tiêu chí chấp nhận đo được; xác định đúng khoản mục chi phí theo điểm a khoản 2 Điều 16 và phân biệt được với chi thường xuyên theo khoản 3 Điều 27; không nhầm sang cơ chế giám sát chất lượng dịch vụ của Điều 23.
- *Căn cứ cần dùng:* khoản 4 Điều 22; điểm a khoản 2 Điều 16; khoản 3 Điều 27; Điều 23 Nghị định 45/2026/NĐ-CP.

## Câu hỏi kiểm tra

**Câu 1 (cơ bản).** Theo điểm a khoản 3 Điều 22 Nghị định số 45/2026/NĐ-CP, hạng mục nào của dự án **bắt buộc phải thực hiện công tác kiểm thử**?

- A. Lắp đặt thiết bị phần cứng
- B. Cài đặt phần mềm thương mại
- C. Hạng mục phần mềm nội bộ
- D. Toàn bộ các hạng mục của dự án

**Đáp án: C.**
*Giải thích:* Điểm a khoản 3 Điều 22 phân định rõ hai cơ chế: việc triển khai lắp đặt mạng, lắp đặt phần cứng và cài đặt phần mềm thương mại thì phải **giám sát công tác triển khai**, còn hạng mục **phần mềm nội bộ** thì phải thực hiện **công tác kiểm thử**. Phương án A và B sai vì đây là các hạng mục thuộc cơ chế giám sát công tác triển khai, không phải kiểm thử; lý do là chất lượng của thiết bị và phần mềm thương mại đã do nhà sản xuất bảo đảm, rủi ro nằm ở quá trình lắp đặt, cấu hình. Phương án D sai vì nghị định không đặt nghĩa vụ kiểm thử cho toàn bộ hạng mục mà phân định theo tính chất sản phẩm.

**Câu 2 (cơ bản).** Theo khoản 4 Điều 22 Nghị định số 45/2026/NĐ-CP, sau khi nhà thầu hoàn thiện các tồn tại phát hiện qua vận hành thử, chủ đầu tư phải làm gì?

- A. Nghiệm thu ngay vì nhà thầu đã có văn bản xác nhận hoàn thiện
- B. Tổ chức vận hành thử lại
- C. Chỉ cần bổ sung phụ lục vào báo cáo kết quả vận hành thử lần đầu, không cần vận hành thử lại
- D. Chuyển sang giám sát chất lượng dịch vụ theo Điều 23

**Đáp án: B.**
*Giải thích:* Khoản 4 Điều 22 quy định sản phẩm phải được vận hành thử trước khi nghiệm thu, phải lập báo cáo kết quả vận hành thử và **phải vận hành thử lại sau khi nhà thầu hoàn thiện**. Phương án A sai vì văn bản xác nhận của nhà thầu là tài liệu của bên được kiểm soát, không thay thế được bằng chứng kiểm chứng độc lập của chủ đầu tư. Phương án C sai vì việc bổ sung phụ lục chỉ là hình thức ghi chép, không phải hoạt động vận hành thử. Phương án D sai vì Điều 23 áp dụng cho dự án thuê dịch vụ công nghệ thông tin, không áp dụng cho dự án đầu tư hệ thống.

**Câu 3 (trung bình).** Một dự án đầu tư hệ thống chỉ mua sắm thiết bị phần cứng và phần mềm thương mại, **không có** hạng mục phần mềm nội bộ. Nhận định nào sau đây là đúng?

- A. Không phải giám sát công tác triển khai, cũng không phải kiểm thử và không phải vận hành thử
- B. Phải giám sát công tác triển khai; không phải kiểm thử hạng mục phần mềm nội bộ; vẫn phải vận hành thử và vận hành thử lại trước khi nghiệm thu
- C. Phải kiểm thử toàn bộ phần mềm thương mại như đối với phần mềm nội bộ
- D. Chỉ cần biên bản nghiệm thu của nhà thầu là đủ

**Đáp án: B.**
*Giải thích:* Điểm a khoản 3 Điều 22 buộc giám sát công tác triển khai đối với việc lắp đặt mạng, phần cứng và cài đặt phần mềm thương mại; nghĩa vụ kiểm thử chỉ đặt ra với hạng mục phần mềm nội bộ nên không phát sinh trong trường hợp này. Tuy nhiên khoản 4 Điều 22 quy định về vận hành thử đối với sản phẩm của dự án nói chung, không giới hạn ở dự án có phần mềm nội bộ, nên nghĩa vụ vận hành thử và vận hành thử lại vẫn giữ nguyên. Phương án A sai vì bỏ cả ba nghĩa vụ. Phương án C sai vì áp đặt nghĩa vụ kiểm thử cho hạng mục mà nghị định không quy định. Phương án D sai vì biên bản của nhà thầu không thay thế được các công tác do nghị định quy định cho chủ đầu tư.

**Câu 4 (trung bình).** Cơ chế kiểm soát chất lượng chính đối với **dự án thuê dịch vụ công nghệ thông tin** là gì?

- A. Kiểm thử hạng mục phần mềm nội bộ theo điểm a khoản 3 Điều 22
- B. Giám sát công tác triển khai theo điểm a khoản 3 Điều 22
- C. Giám sát chất lượng dịch vụ công nghệ thông tin theo khoản 3 Điều 23, thực hiện liên tục trong thời gian thuê
- D. Bảo hành sản phẩm theo Điều 26

**Đáp án: C.**
*Giải thích:* Khoản 3 Điều 23 quy định về giám sát chất lượng dịch vụ công nghệ thông tin đối với dự án thuê dịch vụ; khoản 2 Điều 23 quy định về vận hành thử. Đây là điều thay thế Điều 22 cho loại dự án này. Phương án A sai vì dự án thuê dịch vụ không hình thành phần mềm nội bộ thuộc sở hữu của bên thuê. Phương án B sai vì đây là cơ chế của Điều 22 dành cho dự án đầu tư hệ thống và dự án mua sắm. Phương án D sai vì khoản 4 Điều 26 quy định rõ chế định bảo hành **không áp dụng** đối với dự án thuê dịch vụ công nghệ thông tin.

**Câu 5 (chuyên sâu, tình huống).** Tháng 3/2028, dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh" hoàn thành kiểm thử. Chủ đầu tư tổ chức vận hành thử trong 30 ngày và ghi nhận 12 tồn tại, trong đó 03 tồn tại mức chặn. Nhà thầu khắc phục trong 20 ngày và gửi công văn kèm biên bản nội bộ khẳng định đã xử lý xong 12/12 tồn tại. Do sức ép giải ngân trước ngày 30/4/2028, Ban quản lý dự án đề xuất: căn cứ công văn của nhà thầu để lập biên bản nghiệm thu ngay, không tổ chức vận hành thử lại; đồng thời ghép biên bản giám sát công tác triển khai phần cứng và hồ sơ kiểm thử phần mềm nội bộ thành **một biên bản nghiệm thu kỹ thuật tổng hợp** cho gọn hồ sơ. Hãy phân tích đề xuất và nêu hướng xử lý.

**Đáp án mẫu:**

Đề xuất có hai nội dung, cả hai đều không phù hợp quy định.

*Thứ nhất, về việc bỏ vận hành thử lại.* Khoản 4 Điều 22 Nghị định số 45/2026/NĐ-CP quy định ba nghĩa vụ nối tiếp: vận hành thử trước khi nghiệm thu, lập báo cáo kết quả vận hành thử, và vận hành thử lại sau khi nhà thầu hoàn thiện. Nghĩa vụ thứ ba là bắt buộc, không phụ thuộc vào việc nhà thầu tự đánh giá đã khắc phục xong hay chưa. Công văn và biên bản nội bộ của nhà thầu là tài liệu của bên được kiểm soát; nếu chấp nhận thay thế cho hoạt động vận hành thử lại thì cơ chế kiểm soát của chủ đầu tư trở nên hình thức. Đặc biệt, 03 tồn tại mức chặn liên quan tới đồng bộ dữ liệu với cơ sở dữ liệu quốc gia, thời gian phản hồi của báo cáo tổng hợp và tính đầy đủ của nhật ký hệ thống đều là những nội dung chỉ kiểm chứng được bằng vận hành trên môi trường thực, không kiểm chứng được bằng văn bản.

*Thứ hai, về việc ghép hồ sơ.* Giám sát công tác triển khai và kiểm thử là hai công tác khác nhau, áp dụng cho hai nhóm hạng mục khác nhau theo điểm a khoản 3 Điều 22, với hai bộ bằng chứng khác nhau: nhật ký và báo cáo giám sát đối với hạng mục lắp đặt mạng, phần cứng, cài đặt phần mềm thương mại; kịch bản, kết quả kiểm thử và sổ theo dõi lỗi đối với hạng mục phần mềm nội bộ. Việc ghép thành một biên bản tổng hợp làm mất khả năng chứng minh từng công tác đã được thực hiện, và trực tiếp làm khiếm khuyết hồ sơ hoàn thành lập theo Điều 25. Khi kiểm tra theo Điều 36 hoặc khi thẩm tra phê duyệt quyết toán, chủ đầu tư sẽ không có căn cứ giải trình.

*Thứ ba, về trách nhiệm.* Điều 40 Nghị định số 45/2026/NĐ-CP quy định trách nhiệm của tổ chức, cá nhân tham gia hoạt động đầu tư. Bên cạnh đó, khoản 7 Điều 7 xác định chủ đầu tư chịu trách nhiệm trước pháp luật về tính chính xác, hợp pháp của các đơn giá, khối lượng và giá trị đề nghị thanh toán. Nghiệm thu và thanh toán cho khối lượng chưa được kiểm chứng đầy đủ là rủi ro pháp lý trực tiếp của chủ đầu tư, không phải của nhà thầu.

*Hướng xử lý được khuyến nghị.* Tổ chức vận hành thử lại với phạm vi tối thiểu bao trùm 03 tồn tại mức chặn và các chức năng có liên quan bị ảnh hưởng bởi việc sửa lỗi, kèm kiểm thử hồi quy các chức năng lân cận. Lập báo cáo kết quả vận hành thử lần hai, có bảng đối chiếu 12 tồn tại với trạng thái xử lý và kết luận đạt hay không đạt. Giữ nguyên hai bộ hồ sơ độc lập cho giám sát công tác triển khai và cho kiểm thử; biên bản nghiệm thu ở Bài 10 sẽ dẫn chiếu tới hai bộ hồ sơ này chứ không thay thế chúng. Về tiến độ giải ngân, nếu thời gian không đủ thì xử lý bằng thủ tục điều chỉnh kế hoạch vốn theo pháp luật về đầu tư công và ngân sách nhà nước, không xử lý bằng cách rút gọn công tác mà nghị định quy định bắt buộc. `[CẦN ĐỐI CHIẾU: trình tự điều chỉnh kế hoạch vốn đầu tư công hằng năm — thuộc pháp luật về đầu tư công, chưa đối chiếu số điều]`

*Căn cứ:* điểm a khoản 3 và khoản 4 Điều 22; Điều 25; khoản 7 Điều 7; Điều 36; Điều 40 Nghị định số 45/2026/NĐ-CP.

## Tóm tắt

- Điều 22 quy định bốn công tác khác nhau với bốn bộ hồ sơ khác nhau: triển khai, giám sát công tác triển khai, kiểm thử và vận hành thử; không được gộp làm một (Điều 22 Nghị định 45/2026/NĐ-CP).
- Lắp đặt mạng, phần cứng, cài đặt phần mềm thương mại thì **giám sát công tác triển khai**; hạng mục phần mềm nội bộ thì **bắt buộc kiểm thử** (điểm a khoản 3 Điều 22).
- Kịch bản kiểm thử phải truy vết ngược về bản mô tả yêu cầu kỹ thuật của phần mềm nội bộ, gồm cả yêu cầu phi chức năng như tính sẵn sàng với IPv6 (Điều 15; điểm e khoản 2 Điều 15).
- Sản phẩm phải vận hành thử trước khi nghiệm thu, phải có báo cáo kết quả vận hành thử, và **phải vận hành thử lại** sau khi nhà thầu hoàn thiện (khoản 4 Điều 22).
- Dự án thuê dịch vụ áp dụng Điều 23: vận hành thử theo khoản 2, giám sát chất lượng dịch vụ liên tục theo khoản 3; không áp dụng bảo hành (khoản 4 Điều 26).
- Tổ chức, cá nhân lập thiết kế chi tiết phải giám sát tác giả trong suốt quá trình triển khai và nghiệm thu (khoản 5 Điều 9; khoản 6 Điều 3).
- Chi phí đào tạo người dùng và đào tạo cán bộ quản trị, vận hành nằm trong chi phí trang thiết bị; chi phí duy trì hệ thống trước khi nghiệm thu bàn giao toàn bộ cũng thuộc tổng mức đầu tư (điểm a khoản 2 Điều 16), sau bàn giao mới chuyển sang chi thường xuyên (khoản 3 Điều 27).
- Với dự án sau ngày 01/7/2026, nội dung này chuyển sang Điều 55 và Điều 56 Nghị định 224/2026/NĐ-CP; khâu kiểm soát càng quan trọng hơn vì khoản 6 Điều 53 Nghị định 224/2026/NĐ-CP bỏ bước chủ đầu tư thẩm định, phê duyệt thiết kế chi tiết do nhà thầu triển khai lập.
