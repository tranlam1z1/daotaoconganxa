# 08. Thư viện trường hợp ứng dụng (use case) và chuẩn viện dẫn

## 1. Khái niệm
Một **trường hợp ứng dụng** là đơn vị tri thức "từ tình huống thực tế đến căn cứ và cách làm", được viết có cấu trúc, mọi khẳng định viện dẫn đến nút (khoản/điểm), gắn thời điểm hiệu lực, và được cảnh báo tự động khi căn cứ thay đổi.

## 2. Phân loại khoa học (taxonomy đa chiều)

| Chiều | Giá trị | Nguồn |
|-------|---------|-------|
| Lĩnh vực | 45 chủ đề / 271 đề mục của Bộ pháp điển (mã `PD.xx.yyy`) + nhánh nội bộ chi tiết hơn (ví dụ `CNTT > Đầu tư ứng dụng CNTT > Lập dự án`) | phapdien.moj.gov.vn |
| Chủ thể áp dụng | cơ quan nhà nước; đơn vị sự nghiệp; doanh nghiệp nhà nước; doanh nghiệp tư nhân; hộ kinh doanh; cá nhân; tổ chức tư vấn; nhà thầu | nội bộ |
| Loại việc | thủ tục hành chính; nghĩa vụ tuân thủ; quyền lợi; xử phạt/chế tài; hợp đồng; tranh chấp; lập kế hoạch/dự án; báo cáo định kỳ | nội bộ |
| Giai đoạn (nếu là quy trình) | chuẩn bị → thực hiện → kết thúc; hoặc các bước cụ thể của thủ tục | theo văn bản gốc |
| Phạm vi địa lý | toàn quốc / tỉnh | |
| Độ phức tạp | cơ bản / trung bình / chuyên sâu | biên tập |

Mỗi use case gắn ≥ 1 giá trị ở 3 chiều đầu.

## 3. Cấu trúc một use case (schema `use_cases`)

```yaml
id: uc-cntt-0001
title: Xác định dự án phần mềm nội bộ có phải lập thiết kế hai bước hay không
taxonomy: [PD.09.xxx, "CNTT/Đầu tư ứng dụng CNTT/Thiết kế", chủ thể: cơ quan nhà nước, loại việc: lập kế hoạch/dự án]
as_of: 2026-09-01                 # thời điểm căn cứ được xác nhận đúng
situation: |                      # tình huống (ẩn danh hóa)
  Sở X dự kiến đầu tư phần mềm quản lý nhiệm vụ KH&CN, tổng mức đầu tư 18 tỷ đồng từ vốn đầu tư công…
questions:                        # câu hỏi pháp lý
  - Dự án thuộc loại nào theo NĐ 45/2026?
  - Áp dụng thiết kế một bước hay hai bước?
analysis:                         # lập luận, mỗi bước có citation
  - claim: Dự án có tổng mức đầu tư ≤ 20 tỷ đồng được áp dụng thiết kế một bước
    citations: [vn:vbqppl:nd:45/2026/NĐ-CP#dieu-XX.khoan-Y@2026-03-01]
conclusion: ...
procedure:                        # trình tự nếu có
  - step: Lập, thẩm định, phê duyệt chủ trương đầu tư
    citations: [...]
    templates: [asset://mau-so-01]
    authority: Người có thẩm quyền quyết định đầu tư
    timeline: ...
risks_and_notes: [...]
related_use_cases: [...]
status: published | draft | needs_update
citation_health: ok | changed | repealed   # tự động
author, legal_reviewer, reviewed_at
```

## 4. Chuẩn viện dẫn trong use case
- Dạng hiển thị: theo 01 §6; dạng máy: URN có `@ngày`.
- Mỗi `citation` lưu **hash nội dung nút** tại thời điểm viện dẫn. Job `citation_watch` chạy sau mỗi lần hợp nhất: nếu hash đổi → `citation_health=changed`, tạo ticket "cập nhật use case"; nếu nút `repealed` → `repealed`, hiển thị cảnh báo công khai "căn cứ đã bị bãi bỏ, nội dung đang được rà soát".
- Trình soạn thảo có "citation picker": gõ `#` → tìm nút → chèn; hiển thị inline nội dung nút để người viết đối chiếu.

## 5. Quy trình biên tập
1. Nguồn ý tưởng: câu hỏi người dùng từ `/ask` (gom cụm bằng embedding, ưu tiên cụm lớn), yêu cầu từ chuyên đề đào tạo, văn bản mới ban hành (AI đề xuất danh sách tình huống tác động).
2. AI dựng bản nháp (`claude-opus-5`, chỉ được dùng nút do retrieval cung cấp, structured output theo schema) → biên tập viên chỉnh → pháp chế duyệt → xuất bản.
3. Tái duyệt định kỳ 6 tháng hoặc khi `citation_health != ok`.

## 6. Tính năng cho người dùng
- Duyệt theo taxonomy, lọc theo chủ thể/loại việc; tìm kiếm chung với văn bản (chunk use case cũng vào chỉ mục, tag `kind=use_case`).
- Trang use case: tình huống → kết luận → căn cứ (mở rộng tại chỗ) → trình tự (timeline) → biểu mẫu → use case liên quan → "tạo phiên bản cho tình huống của tôi" (người dùng nhập tham số, ví dụ tổng mức đầu tư, loại vốn → hệ thống chạy lại lập luận có điều kiện với citation).
- Xuất PDF/DOCX "phiếu căn cứ pháp lý" có danh mục viện dẫn đầy đủ.
