---
course: dau-tu-cntt-nsnn
kind: bieu_mau
slug: thiet-ke-chi-tiet
title: Đề cương thiết kế chi tiết dự án đầu tư ứng dụng công nghệ thông tin
as_of: 2026-09-06
status: draft
review_state: cho_phap_che_duyet
---

# Đề cương thiết kế chi tiết

> **Căn cứ tại ngày:** 06/9/2026 · **Trạng thái:** bản nháp, chờ pháp chế duyệt.
>
> **CẢNH BÁO HIỆU LỰC.** Đề cương dựng theo Điều 14, Điều 15, Điều 19 và Điều 20 Nghị định số 45/2026/NĐ-CP — văn bản áp dụng cho **dự án chuyển tiếp**. Với dự án khởi động sau ngày 01/7/2026, các điều tương ứng là **Điều 47, Điều 48, Điều 52 và Điều 53 Nghị định số 224/2026/NĐ-CP**. **Thay đổi quan trọng nhất**: khoản 6 Điều 53 Nghị định số 224/2026/NĐ-CP quy định chủ đầu tư **không phải** thẩm định, phê duyệt thiết kế chi tiết do nhà thầu triển khai lập, khác với khoản 5 và khoản 6 Điều 20 Nghị định số 45/2026/NĐ-CP.

## Xác định luồng áp dụng trước khi dùng đề cương

```
Dự án đầu tư hệ thống
│
├─ KHÔNG có hạng mục phần mềm nội bộ  → Điều 19 Nghị định 45/2026/NĐ-CP
│     • Chủ đầu tư tổ chức lập thiết kế chi tiết KÈM DỰ TOÁN
│     • Chủ đầu tư tổ chức thẩm định (khoản 6 Điều 19)
│     • Chủ đầu tư phê duyệt thiết kế chi tiết và dự toán ĐỒNG THỜI,
│       không tách riêng (khoản 7 Điều 19)
│
└─ CÓ hạng mục phần mềm nội bộ        → Điều 20 Nghị định 45/2026/NĐ-CP
      • NHÀ THẦU TRIỂN KHAI lập thiết kế chi tiết và thực hiện triển khai
      • Chủ đầu tư thẩm định (khoản 5 Điều 20)
      • Chủ đầu tư phê duyệt thiết kế chi tiết (khoản 6 Điều 20)
      • Luồng này KHÔNG kèm dự toán như Điều 19
      • Gói thầu áp dụng loại gói thầu thiết kế và cung cấp hàng hóa,
        mẫu hồ sơ mời thầu dùng mẫu mua sắm hàng hóa (khoản 6 Điều 7)
```

Với **thiết kế 01 bước** (tổng mức đầu tư không quá 20 tỷ đồng, điểm a khoản 2 Điều 9), thiết kế chi tiết được lập ngay trong báo cáo kinh tế - kỹ thuật, không có bước thiết kế cơ sở trước đó.
Với **thiết kế 02 bước** (khoản 3 Điều 9), thiết kế chi tiết phải **phù hợp với thiết kế cơ sở** đã được phê duyệt về mô hình tổng thể, mô hình lô-gic và mô hình vật lý.

---

## Chương I. THÔNG TIN CHUNG

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 1.1 | Tên dự án, chủ đầu tư, quyết định đầu tư (số, ngày) | Nội dung nghiệp vụ |
| 1.2 | Đơn vị lập thiết kế chi tiết; nếu là nhà thầu triển khai thì ghi rõ số hợp đồng | Điều 19 hoặc Điều 20 Nghị định 45/2026/NĐ-CP |
| 1.3 | Luồng áp dụng: Điều 19 hay Điều 20; lý do | khoản 1, khoản 2 Điều 18 Nghị định 45/2026/NĐ-CP |
| 1.4 | Số bước thiết kế; nếu 02 bước thì nêu quyết định phê duyệt thiết kế cơ sở | khoản 2, khoản 3, khoản 4 Điều 9 Nghị định 45/2026/NĐ-CP |
| 1.5 | Căn cứ lập thiết kế chi tiết | khoản 2 Điều 19 Nghị định 45/2026/NĐ-CP |
| 1.6 | Danh sách tài liệu tham chiếu: báo cáo nghiên cứu khả thi, thiết kế cơ sở, kết quả khảo sát bổ sung | Nội dung nghiệp vụ |
| 1.7 | Bố trí giám sát tác giả: tổ chức, cá nhân thực hiện và phạm vi | khoản 5 Điều 9 Nghị định 45/2026/NĐ-CP |

## Chương II. YÊU CẦU CHUNG ĐỐI VỚI THIẾT KẾ CHI TIẾT

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 2.1 | Sự tuân thủ Khung kiến trúc tổng thể quốc gia số | Điều 4 và khoản 1 Điều 14 Nghị định 45/2026/NĐ-CP |
| 2.2 | Sự phù hợp với thiết kế cơ sở đã phê duyệt (nếu thiết kế 02 bước) | khoản 4 Điều 9 và khoản 1 Điều 14 Nghị định 45/2026/NĐ-CP |
| 2.3 | Sự tuân thủ tiêu chuẩn, quy chuẩn kỹ thuật; bảo đảm quản lý, kết nối, chia sẻ dữ liệu | khoản 1 Điều 14 Nghị định 45/2026/NĐ-CP |
| 2.4 | Bảo đảm xác định được khối lượng để lập dự toán (với luồng Điều 19) | khoản 1 Điều 14 và khoản 5 Điều 19 Nghị định 45/2026/NĐ-CP |

## Chương III. MÔ HÌNH HỆ THỐNG

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 3.1 | **Mô hình tổng thể**: các thành phần của hệ thống và quan hệ giữa chúng; ranh giới hệ thống; hệ thống bên ngoài có kết nối | khoản 8 Điều 3 và điểm a khoản 2 Điều 14 Nghị định 45/2026/NĐ-CP |
| 3.2 | **Mô hình lô-gic**: phân rã chức năng, luồng dữ liệu, lược đồ dữ liệu mức lô-gic, phân lớp ứng dụng | khoản 9 Điều 3 và điểm a khoản 2 Điều 14 Nghị định 45/2026/NĐ-CP |
| 3.3 | **Mô hình vật lý**: bố trí máy chủ, thiết bị mạng, phân vùng, phương án lưu trữ và sao lưu, sơ đồ đấu nối | khoản 10 Điều 3 và điểm a khoản 2 Điều 14 Nghị định 45/2026/NĐ-CP |
| 3.4 | **Yêu cầu về tính sẵn sàng với IPv6** hoặc giải pháp nâng cấp bảo đảm sẵn sàng với IPv6 | điểm a khoản 2 Điều 14 Nghị định 45/2026/NĐ-CP |
| 3.5 | Phương án tính toán năng lực hệ thống theo số người dùng đồng thời và khối lượng dữ liệu | Nội dung nghiệp vụ, làm cơ sở cho mục 3.3 |

## Chương IV. THIẾT KẾ PHẦN MỀM NỘI BỘ

Áp dụng khi dự án có hạng mục phần mềm nội bộ. Toàn bộ chương này bám Điều 15 Nghị định số 45/2026/NĐ-CP.

### IV.1 Thông số chủ yếu

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 4.1 | **Quy trình nghiệp vụ** được tin học hóa: sơ đồ từng quy trình, các bước, điểm quyết định, biểu mẫu đầu vào và đầu ra | điểm a khoản 1 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.2 | **Đối tượng tham gia và mối liên hệ**: danh sách tác nhân, vai trò, quyền hạn, ma trận phân quyền | điểm b khoản 1 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.3 | **Danh sách yêu cầu của người sử dụng**: liệt kê đầy đủ, đánh mã, phân nhóm chức năng, mức độ ưu tiên | điểm c khoản 1 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.4 | Bảng đối chiếu yêu cầu người sử dụng với trường hợp sử dụng | Nội dung nghiệp vụ; cần thiết để bảo đảm không bỏ sót yêu cầu và để lập kịch bản kiểm thử |

### IV.2 Đặc tả chức năng

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 4.5 | Đặc tả từng trường hợp sử dụng: tác nhân, tiền điều kiện, luồng chính, luồng thay thế, luồng ngoại lệ, hậu điều kiện | Chi tiết hóa điểm c khoản 1 Điều 15 |
| 4.6 | Đặc tả giao diện người dùng: danh sách màn hình, sơ đồ chuyển màn hình, mô tả trường dữ liệu và quy tắc kiểm tra | Chi tiết hóa điểm c khoản 1 Điều 15 |
| 4.7 | Đặc tả báo cáo và kết xuất: mẫu, tham số lọc, định dạng tệp | Chi tiết hóa điểm c khoản 1 Điều 15 |
| 4.8 | Đặc tả quy tắc nghiệp vụ và quy tắc tính toán | Chi tiết hóa điểm a khoản 1 Điều 15 |
| 4.9 | Đặc tả giao diện lập trình ứng dụng phục vụ kết nối, liên thông, chia sẻ dữ liệu | Điều 4 Nghị định 45/2026/NĐ-CP |

### IV.3 Yêu cầu phi chức năng

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 4.10 | Yêu cầu về **cơ sở dữ liệu**: lược đồ, từ điển dữ liệu, quy tắc toàn vẹn, chính sách lưu trữ và xóa | điểm a khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.11 | Yêu cầu về **an toàn, an ninh thông tin**: xác thực, phân quyền, mã hóa, nhật ký, phương án theo cấp độ an toàn hệ thống thông tin được phê duyệt | điểm b khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP; `[CẦN ĐỐI CHIẾU: nghị định về bảo đảm an toàn hệ thống thông tin theo cấp độ]` |
| 4.12 | Yêu cầu về **thời gian xử lý, độ phức tạp xử lý** | điểm c khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.13 | Yêu cầu về **cài đặt, hạ tầng, đường truyền, an toàn vận hành** | điểm d khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.14 | **Ràng buộc môi trường, phụ thuộc hệ thống nền tảng** | điểm đ khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.15 | **Tính sẵn sàng với IPv6** | điểm e khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.16 | Yêu cầu về **năng lực cán bộ tham gia thiết kế, xây dựng, phát triển, nâng cấp, mở rộng phần mềm** | điểm g khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP |
| 4.17 | Yêu cầu phi chức năng khác: khả năng mở rộng, khả năng tiếp cận, hỗ trợ thiết bị di động, ngôn ngữ và bảng mã | điểm h khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP |

> **Ghi chú cho dự án áp dụng Nghị định số 224/2026/NĐ-CP**: điểm d khoản 2 Điều 47 bổ sung yêu cầu về **mức độ chịu đựng sai hỏng** đối với lỗi cú pháp lập trình, lỗi lô-gic xử lý dữ liệu và lỗi kiểm soát tính đúng đắn của dữ liệu đầu vào. Đây là mục mới, phải bổ sung vào Chương IV. `[CẦN ĐỐI CHIẾU: nguyên văn điểm d khoản 2 Điều 47 Nghị định số 224/2026/NĐ-CP]`

## Chương V. THIẾT KẾ HẠ TẦNG VÀ THIẾT BỊ

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 5.1 | Danh mục thiết bị phần cứng kèm thông số kỹ thuật và số lượng | khoản 2 Điều 14 Nghị định 45/2026/NĐ-CP |
| 5.2 | Danh mục phần mềm thương mại, số lượng bản quyền, thời hạn, dịch vụ hỗ trợ đi kèm | khoản 2 Điều 14 Nghị định 45/2026/NĐ-CP |
| 5.3 | Thiết kế mạng, phụ kiện, sơ đồ đấu nối | khoản 2 Điều 14; điểm a khoản 2 Điều 16 Nghị định 45/2026/NĐ-CP |
| 5.4 | Phương án lắp đặt, cài đặt, kiểm tra và hiệu chỉnh | điểm a khoản 2 Điều 16 Nghị định 45/2026/NĐ-CP |

## Chương VI. THIẾT KẾ CƠ SỞ DỮ LIỆU VÀ CHUYỂN ĐỔI DỮ LIỆU

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 6.1 | Phương án xây dựng cơ sở dữ liệu | khoản 21 Điều 3 Nghị định 45/2026/NĐ-CP |
| 6.2 | Phương án tạo lập, chuẩn hóa, chuyển đổi và nhập dữ liệu từ nguồn hiện có; khối lượng dữ liệu theo từng nguồn | điểm a khoản 2 Điều 16 Nghị định 45/2026/NĐ-CP |
| 6.3 | Quy tắc làm sạch, đối sánh và xử lý dữ liệu trùng, dữ liệu thiếu | Nội dung nghiệp vụ |
| 6.4 | Phương án kết nối, liên thông, chia sẻ dữ liệu với hệ thống bên ngoài | Điều 4 Nghị định 45/2026/NĐ-CP |

## Chương VII. PHƯƠNG ÁN TRIỂN KHAI, KIỂM THỬ, ĐÀO TẠO

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 7.1 | Kế hoạch triển khai theo giai đoạn và theo địa điểm | Điều 22 Nghị định 45/2026/NĐ-CP |
| 7.2 | Phương án **giám sát công tác triển khai** đối với lắp đặt mạng, phần cứng, cài đặt phần mềm thương mại | điểm a khoản 3 Điều 22 Nghị định 45/2026/NĐ-CP |
| 7.3 | Phương án **kiểm thử** đối với hạng mục phần mềm nội bộ | điểm a khoản 3 Điều 22 Nghị định 45/2026/NĐ-CP; `[CẦN ĐỐI CHIẾU: nội dung chi tiết Thông tư số 41/2026/TT-BKHCN]` |
| 7.4 | Phương án **vận hành thử** và tiêu chí kết thúc vận hành thử | khoản 4 Điều 22 Nghị định 45/2026/NĐ-CP |
| 7.5 | Kế hoạch đào tạo, tập huấn hướng dẫn sử dụng; đào tạo quản trị, vận hành: đối tượng, số lượt, nội dung, tài liệu | điểm a khoản 2 Điều 16 Nghị định 45/2026/NĐ-CP |
| 7.6 | Danh mục tài liệu và sản phẩm phải bàn giao khi nghiệm thu, gồm **mã nguồn của chương trình** | điểm b khoản 1 Điều 24 Nghị định 45/2026/NĐ-CP |

## Chương VIII. DỰ TOÁN

**Chỉ áp dụng với luồng Điều 19** (dự án đầu tư hệ thống không có hạng mục phần mềm nội bộ). Với luồng Điều 20, dự toán không nằm trong hồ sơ thiết kế chi tiết do nhà thầu triển khai lập.

| Mục | Nội dung | Căn cứ |
|-----|----------|--------|
| 8.1 | Chi phí trang thiết bị | điểm a khoản 5 Điều 19 Nghị định 45/2026/NĐ-CP |
| 8.2 | Chi phí quản lý dự án | điểm a khoản 5 Điều 19 |
| 8.3 | Chi phí tư vấn đầu tư | điểm a khoản 5 Điều 19 |
| 8.4 | Chi phí khác | điểm a khoản 5 Điều 19 |
| 8.5 | Chi phí dự phòng | điểm a khoản 5 Điều 19 |
| 8.6 | Thuyết minh phương pháp xác định từng khoản mục, kèm hồ sơ chứng minh | điểm b khoản 5 Điều 19, dẫn chiếu khoản 4, 5, 6, 7 Điều 16 |
| 8.7 | Bảng so sánh dự toán với tổng mức đầu tư đã được phê duyệt | khoản 8 Điều 17 Nghị định 45/2026/NĐ-CP: chủ đầu tư được tự điều chỉnh khi không thay đổi mục tiêu, quy mô và không vượt tổng mức đầu tư |

## Phụ lục kèm theo hồ sơ thiết kế chi tiết

| # | Phụ lục |
|---|---------|
| I | Sơ đồ mô hình tổng thể, mô hình lô-gic, mô hình vật lý |
| II | Bảng kê trường hợp sử dụng và bảng đối chiếu với yêu cầu người sử dụng |
| III | Từ điển dữ liệu và lược đồ cơ sở dữ liệu |
| IV | Ma trận phân quyền |
| V | Danh mục thiết bị và phần mềm thương mại kèm thông số |
| VI | Bảng tính dự toán chi tiết (luồng Điều 19) |
| VII | Hồ sơ báo giá, chứng thư thẩm định giá, kết quả lựa chọn nhà thầu tương tự |
| VIII | Kết quả khảo sát bổ sung (nếu có) |

---

## Nội dung thẩm định hồ sơ thiết kế chi tiết và dự toán

Khoản 6 Điều 19 Nghị định số 45/2026/NĐ-CP quy định các nội dung thẩm định từ điểm a đến điểm k. Đơn vị lập thiết kế nên tự rà theo danh mục này trước khi trình, để rút ngắn thời gian thẩm định. `[CẦN ĐỐI CHIẾU: nguyên văn từng điểm a đến k khoản 6 Điều 19 Nghị định số 45/2026/NĐ-CP để lập danh mục tự kiểm tra đầy đủ]`

Thời hạn thẩm định thiết kế: **không quá 15 ngày làm việc** với dự án nhóm A; **không quá 10 ngày làm việc** với dự án nhóm B và nhóm C (khoản 5 Điều 17 Nghị định 45/2026/NĐ-CP).

## Danh mục tự kiểm tra trước khi trình phê duyệt

- [ ] Đã xác định đúng luồng Điều 19 hay Điều 20 và nêu rõ tại mục 1.3.
- [ ] Nếu thiết kế 02 bước: thiết kế chi tiết phù hợp thiết kế cơ sở về cả ba mô hình (khoản 4 Điều 9).
- [ ] Có đủ ba mô hình: tổng thể, lô-gic, vật lý (điểm a khoản 2 Điều 14).
- [ ] Có đủ ba thông số chủ yếu của phần mềm nội bộ: quy trình nghiệp vụ, đối tượng tham gia, danh sách yêu cầu người sử dụng (khoản 1 Điều 15).
- [ ] Có đủ các yêu cầu phi chức năng từ điểm a đến điểm h khoản 2 Điều 15, **đặc biệt là điểm e về IPv6**.
- [ ] Mỗi yêu cầu của người sử dụng đều truy được về ít nhất một trường hợp sử dụng (mục 4.4).
- [ ] Có nêu bố trí giám sát tác giả (khoản 5 Điều 9).
- [ ] Có danh mục sản phẩm bàn giao gồm **mã nguồn** (điểm b khoản 1 Điều 24).
- [ ] Với luồng Điều 19: dự toán được trình **đồng thời** với thiết kế chi tiết, không tách riêng (khoản 7 Điều 19).
- [ ] Dự toán không vượt tổng mức đầu tư đã phê duyệt; nếu vượt thì phải điều chỉnh dự án theo Điều 21.
- [ ] Mọi mục `[CẦN ĐỐI CHIẾU]` đã được thay bằng số hiệu và số điều thật.
