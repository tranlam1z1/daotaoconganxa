# 09. Mô-đun đào tạo theo chuyên đề

## 1. Mô hình đào tạo

Ba bậc, từ ngoài vào trong: **lĩnh vực → nhóm đối tượng → chuyên đề → bài học**.

- **Lĩnh vực đào tạo (field)** = một mảng pháp luật phục vụ một tập nhóm đối tượng, ví dụ "Đầu tư và tư vấn đầu tư dự án sử dụng ngân sách Nhà nước" hoặc "Pháp luật giao thông đường bộ". Người học chọn lĩnh vực trước, chọn chuyên đề sau.
- **Nhóm đối tượng** = vai của người học trong lĩnh vực đó. Hai nhóm dùng chung nền pháp lý nhưng khác sản phẩm đầu ra, nên tách thành hai nhánh chuyên đề chứ không trộn vào một lộ trình:
  - `khach_hang` — người trực tiếp áp dụng quy định vào hồ sơ của mình (chủ đầu tư, ban quản lý dự án, cán bộ chuyên môn; ở lĩnh vực giao thông là cảnh sát giao thông đường bộ);
  - `tu_van` — người tư vấn và đào tạo lại cho nhóm trên (chuyên viên của tổ chức tư vấn). Nhóm này học đủ nền pháp lý của các chuyên đề trong lĩnh vực, cộng thêm chuyên đề về phương pháp tư vấn và phương pháp sư phạm.
- **Chuyên đề (course)** = mục tiêu học tập + đối tượng + lộ trình bài học bám theo **trình tự pháp luật thực tế** + ví dụ xuyên suốt (running example) + bài tập/kiểm tra + bộ biểu mẫu.
- Giữa các chuyên đề trong một lĩnh vực có **hai quan hệ, không thay thế nhau**:
  - **nối tiếp** (`follows_id`) — chuyên đề sau tiếp tục công việc của chuyên đề trước trên cùng một hồ sơ (lập dự án → thực hiện dự án);
  - **cụ thể hoá** (`parent_id`) — chuyên đề con thu hẹp phạm vi của chuyên đề cha cho một loại hình cụ thể (dự án đầu tư công nghệ thông tin nằm trong dự án đầu tư nói chung). Đây là cạnh dựng nên cấu trúc hình cây của lĩnh vực.
- **Bài học (lesson)** = nội dung giảng giải (Markdown) + căn cứ (citation nút) + "làm thử" (điền mẫu, ra quyết định) + câu hỏi.
- Mọi nội dung giảng giải viện dẫn nút như use case (08), có `citation_health`; khi văn bản đổi, bài học tự đánh dấu "cần cập nhật" và hiển thị banner cho học viên.
- Nội dung sinh bằng AI phải qua pháp chế duyệt; bài học ghi rõ ngày căn cứ.

Danh mục công khai hiện cả chuyên đề **đang biên soạn** (trạng thái `bien_tap`, `cho_phap_che`, `can_cap_nhat`): người học cần thấy trọn lộ trình của lĩnh vực trước khi quyết định bắt đầu từ đâu. Chỉ chuyên đề `xuat_ban` mới mở được bài.

Schema: `fields(id, slug, name, summary, audience_note, ordinal, status)`, `courses(id, title, audience[], objectives[], taxonomy, as_of, status, field_id, parent_id, follows_id, audience_group, ordinal)`, `lessons(course_id, order, title, body_md, citations[], activities[], quiz_id)`, `quizzes`, `enrollments`, `progress`, `certificates` (tùy chọn).

## 2. Lĩnh vực số 1: đầu tư và tư vấn đầu tư dự án sử dụng ngân sách Nhà nước

Phạm vi ban đầu được viết thành **một chuyên đề 12 bài** mang tên "Đầu tư và tư vấn đầu tư đối với lập và thực hiện dự án đầu tư công nghệ thông tin sử dụng ngân sách Nhà nước". Một chuyên đề gộp cả bốn phạm vi ấy có hai chỗ hỏng: phần trình tự đầu tư công dùng chung cho mọi loại dự án bị khoá vào loại hình công nghệ thông tin, và nhóm tư vấn không có chỗ để học phần tư vấn, sư phạm. Vì vậy phạm vi được tách thành bốn chuyên đề trong cùng một lĩnh vực:

| # | Chuyên đề | Nhóm | Quan hệ | Phạm vi |
|---|-----------|------|---------|---------|
| 1 | Lập dự án đầu tư sử dụng ngân sách Nhà nước | `khach_hang` | gốc | Chuẩn bị đầu tư: văn bản áp dụng theo thời điểm, phân loại hoạt động và nguồn vốn, chủ trương đầu tư, báo cáo nghiên cứu khả thi, tổng mức đầu tư, thẩm định và quyết định đầu tư |
| 2 | Thực hiện dự án đầu tư sử dụng ngân sách Nhà nước | `khach_hang` | nối tiếp 1 | Thực hiện và kết thúc đầu tư: thiết kế và dự toán, lựa chọn nhà thầu, hợp đồng và thanh toán, giám sát triển khai, nghiệm thu, bàn giao, bảo hành, quyết toán, kiểm tra |
| 3 | Dự án đầu tư công nghệ thông tin sử dụng ngân sách Nhà nước | `khach_hang` | cụ thể hoá 2 | Phần riêng của loại hình công nghệ thông tin: khung pháp lý riêng và chuyển tiếp giữa các nghị định, phân loại đầu tư với mua sắm và thuê dịch vụ, nội dung hồ sơ, an toàn thông tin theo cấp độ, chi phí phần mềm nội bộ, thiết kế, gói thầu và nghiệm thu phần mềm |
| 4 | Tư vấn đầu tư và phương pháp sư phạm cho người đi tư vấn | `tu_van` | học sau 3 | Phạm vi, trách nhiệm và giới hạn của ý kiến tư vấn; điều kiện năng lực và chi phí tư vấn; khảo sát nhu cầu và chẩn đoán hồ sơ; viết ý kiến tư vấn có viện dẫn; phương pháp dạy người lớn đang làm nghề; thiết kế và điều hành một buổi đào tạo |

Chuyên đề số 3 giữ nguyên slug `dau-tu-cntt-ngan-sach-nha-nuoc`: slug là địa chỉ đã phát ra ngoài và là địa chỉ mà bộ kiểm thử API gọi tới. Bài 1 và bài 5 đã soạn của chuyên đề gốc nằm lại ở chuyên đề này, đúng nội dung của chúng (khung pháp lý riêng của dự án công nghệ thông tin, và chi phí phần mềm nội bộ).

Khung pháp lý dưới đây là khung của chuyên đề số 3.

### 2.1 Khung pháp lý (cập nhật 06/9/2026 sau khi tra cứu Công báo)

> **Cảnh báo hiệu lực — điểm mấu chốt của chuyên đề này.** Khung pháp lý về đầu tư ứng dụng
> CNTT bằng ngân sách nhà nước đã thay đổi **ba lần trong vòng 18 tháng**. Bản kế hoạch đầu
> tiên của tài liệu này dựng trên Nghị định 45/2026/NĐ-CP; tra cứu Công báo ngày 06/9/2026
> cho thấy nghị định đó **đã hết hiệu lực từ 01/7/2026**. Chuyên đề phải dạy trên khung hiện
> hành, đồng thời dạy luôn cách tra cứu hiệu lực — vì chính học viên sẽ gặp lại tình huống này.

**Chuỗi hiệu lực đã xác minh:**

```
NĐ 73/2019 + NĐ 82/2024   ──01/3/2026──>  NĐ 45/2026/NĐ-CP  ──01/7/2026──>  NĐ 224/2026/NĐ-CP
TT 04/2020 + TT 12/2020   ──14/02/2025─>  TT 18/2024/TT-BTTTT ──01/7/2026─>  TT 39/2026/TT-BKHCN
TT 23/2020 + TT 24/2020   ──14/02/2025─>  TT 16/2024/TT-BTTTT ──01/7/2026─>  TT 41/2026/TT-BKHCN
```

| Nhóm | Văn bản **hiện hành** (tại 06/9/2026) |
|------|----------------------------------------|
| Luật nền | **Luật Chuyển đổi số số 148/2025/QH15** — luật gốc mới của lĩnh vực; Luật Đầu tư công; Luật Đấu thầu 2023 (sửa đổi bởi Luật 57/2024/QH15 và Luật 90/2025/QH15); Luật Ngân sách nhà nước; Luật Dữ liệu 2024; Luật Bảo vệ dữ liệu cá nhân 2025; Luật Giao dịch điện tử 2023; Luật Khoa học, công nghệ và đổi mới sáng tạo 2025 |
| Nghị định | **Nghị định 224/2026/NĐ-CP** ngày 24/6/2026, hiệu lực 01/7/2026, quy định chi tiết và biện pháp thi hành Luật Chuyển đổi số. Điều 90 bãi bỏ NĐ 45/2026/NĐ-CP, NĐ 42/2022/NĐ-CP, NĐ 64/2007/NĐ-CP. Điều 91 quy định chuyển tiếp. Kèm theo: **Nghị định 225/2026/NĐ-CP** (đối chiếu nội dung khi biên soạn); nghị định hướng dẫn Luật Đầu tư công; NĐ 24/2024/NĐ-CP hướng dẫn Luật Đấu thầu |
| Thông tư | **TT 39/2026/TT-BKHCN** (01/7/2026) — lập và quản lý **chi phí** trong đầu tư, mua sắm, thuê dịch vụ cho chuyển đổi số dùng NSNN; thay thế TT 18/2024/TT-BTTTT.<br>**TT 41/2026/TT-BKHCN** (01/7/2026) — **phát triển thử nghiệm** và **quản lý chất lượng**; thay thế TT 16/2024/TT-BTTTT |
| Chuyển tiếp | **NĐ 45/2026/NĐ-CP** vẫn áp dụng cho dự án đã có quyết định đầu tư hoặc đã có báo cáo thẩm định trước 01/7/2026 (Điều 91 khoản 2 NĐ 224/2026), trừ khi cấp có thẩm quyền chọn chuyển sang NĐ 224/2026. TT 39 và TT 41 đều có điều khoản đưa các bước tiếp theo của dự án đang theo NĐ 45/2026 về thông tư mới (Điều 10.3 TT 39; Điều 20.3 TT 41) |
| Tiêu chuẩn | TCVN/ISO về phần mềm (ISO/IEC 25010, 12207), yêu cầu kết nối, IPv6, an toàn thông tin theo cấp độ |
| Địa phương | Nghị quyết HĐND / quyết định UBND tỉnh về phân cấp quyết định đầu tư và định mức chi (ví dụ Thanh Hóa) |

**Thay đổi quan trọng về phương pháp lập dự toán phần mềm nội bộ.**
Phương pháp **Use Case Point** theo Quyết định 671/QĐ-BTTTT ngày 26/4/2024 (công thức
`G = 1,4 × E × P × H`, chi phí chung 65%, thu nhập chịu thuế trước 6%) **không còn là phương pháp
pháp định**: căn cứ ban hành của nó (TT 04/2020) đã hết hiệu lực, văn bản kế thừa (TT 18/2024)
cũng đã hết hiệu lực, và TT 39/2026/TT-BKHCN không còn dẫn chiếu phương pháp này. TT 39/2026
quy định phần mềm nội bộ báo giá theo **công tháng / công ngày (man-month, man-day) và đơn giá
cụ thể**, tách theo hạng mục (nghiên cứu phát triển – phân tích – thiết kế; lập trình; thử nghiệm
kiểm thử nội bộ; cài đặt hiệu chỉnh; chi phí khác; chi phí chung; thu nhập chịu thuế tính trước;
thuế và phí), không ấn định tỷ lệ phần trăm. Chi phí **dịch vụ phần mềm** (thuê) tính bằng chi phí
nhân công phát triển chia đều cho 8 năm (96 tháng) theo thời gian khấu hao tối đa của tài sản cố
định là phần mềm. Tổng mức đầu tư: `G = G_TB/DV + G_QLDA + G_TV + G_K + G_DP`, dự phòng tối đa 10%.

Hệ quả cho bài 5 và cho công cụ tính chi phí: dạy phương pháp **công tháng/đơn giá theo TT 39/2026**
là chính; phương pháp Use Case Point chỉ trình bày như **kiến thức tham chiếu và dùng cho dự án
chuyển tiếp** áp dụng quy định tại thời điểm phê duyệt.

### 2.2 Lộ trình bài học của phạm vi gốc (12 bài, nay chia cho ba chuyên đề)

Bảng dưới là lộ trình đã biên soạn khi phạm vi còn là một chuyên đề. Sau khi tách: bài 1–6 thuộc chuyên đề "Lập dự án", bài 7–10 và 12 thuộc chuyên đề "Thực hiện dự án", bài 11 chuyển sang chuyên đề tư vấn; phần đặc thù công nghệ thông tin của các bài này gom về chuyên đề "Dự án đầu tư công nghệ thông tin".


| # | Bài | Trọng tâm | Căn cứ chính |
|---|-----|-----------|--------------|
| 1 | Tổng quan và thứ bậc văn bản áp dụng | Cách đọc hệ thống văn bản, nguyên tắc ưu tiên, dùng công cụ tra cứu theo thời điểm | Luật 64/2025; sơ đồ thứ bậc |
| 2 | Phân loại hoạt động: dự án đầu tư / mua sắm / thuê dịch vụ / chi thường xuyên | Xác định đúng "lối đi" pháp lý và đúng khung văn bản áp dụng theo thời điểm | NĐ 224/2026 phạm vi, giải thích từ ngữ; Điều 91 chuyển tiếp |
| 3 | Chủ trương đầu tư | Báo cáo đề xuất chủ trương, thẩm quyền, thẩm định, phê duyệt | Luật Đầu tư công; NĐ 224/2026 |
| 4 | Lập dự án (Báo cáo nghiên cứu khả thi) | Nội dung BCNCKT: hiện trạng, yêu cầu chức năng/phi chức năng, kiến trúc, an toàn thông tin theo cấp độ, tổng mức đầu tư | NĐ 224/2026; khung kiến trúc số |
| 5 | Xác định tổng mức đầu tư và chi phí phần mềm nội bộ | Phương pháp công tháng/đơn giá theo TT 39/2026; cấu trúc `G = G_TB/DV + G_QLDA + G_TV + G_K + G_DP`; dự phòng ≤ 10%; chi phí thuê dịch vụ chia 96 tháng. Use Case Point trình bày như tham chiếu và cho dự án chuyển tiếp | **TT 39/2026/TT-BKHCN**; QĐ 671/QĐ-BTTTT (tham chiếu) |
| 6 | Thẩm định, phê duyệt dự án | Hồ sơ, cơ quan chuyên môn, thời hạn | NĐ 224/2026 |
| 7 | Thiết kế (một bước / hai bước): thiết kế cơ sở, thiết kế chi tiết, dự toán | Nội dung thiết kế phần mềm, mô hình tổng thể/logic/vật lý; ngưỡng thiết kế một bước **cần đối chiếu lại theo NĐ 224/2026** (ngưỡng 20 tỷ là quy định của NĐ 45/2026 đã hết hiệu lực) | NĐ 224/2026 |
| 8 | Lựa chọn nhà thầu | Kế hoạch LCNT, hình thức, hồ sơ mời thầu cho phần mềm, hợp đồng | Luật Đấu thầu 2023 sđ; NĐ 24/2024 sđ |
| 9 | Triển khai, kiểm thử, vận hành thử, đào tạo | Quản lý chất lượng, kiểm thử phần mềm nội bộ (Phụ lục III TT 41/2026), tài liệu | **TT 41/2026/TT-BKHCN**; NĐ 224/2026; TCVN |
| 10 | Nghiệm thu, bàn giao, bảo hành, quyết toán | Danh mục hồ sơ hoàn thành (Phụ lục V TT 41/2026), thời hạn bảo hành, quyết toán | **TT 41/2026/TT-BKHCN**; Thông tư Bộ Tài chính |
| 11 | Vai trò tư vấn đầu tư: điều kiện năng lực, phạm vi, trách nhiệm, chi phí tư vấn | Chi phí tư vấn `G_TV` trong cấu trúc tổng mức đầu tư, hợp đồng tư vấn | NĐ 224/2026; **TT 39/2026/TT-BKHCN** |
| 12 | Sai sót thường gặp và kiểm tra, thanh tra, kiểm toán | Checklist tuân thủ | Kết luận kiểm toán/thanh tra công khai (không phải VBQPPL) |

### 2.3 Ví dụ xuyên suốt: dự án "Hệ thống quản lý nhiệm vụ khoa học và công nghệ cấp tỉnh" (tên minh họa)
- Chủ đầu tư: Sở KH&CN tỉnh T. Vốn: đầu tư công ngân sách tỉnh. Tổng mức đầu tư dự kiến: 14,5 tỷ đồng (→ thiết kế một bước theo ngưỡng 20 tỷ; bài 7 sẽ cho học viên đổi thành 26 tỷ để thấy chuyển sang hai bước).
- Chức năng/use case cụ thể (làm đầu vào cho bài 4, 5, 7, 9):
  1. Tiếp nhận đề xuất nhiệm vụ KH&CN trực tuyến (tổ chức/cá nhân nộp hồ sơ, ký số).
  2. Tổ chức hội đồng tư vấn xác định nhiệm vụ (lập hội đồng, chấm điểm, biên bản).
  3. Tuyển chọn/giao trực tiếp tổ chức chủ trì (hồ sơ, hội đồng tuyển chọn, thông báo kết quả).
  4. Quản lý hợp đồng và kinh phí (dự toán, cấp phát, điều chỉnh).
  5. Theo dõi tiến độ, báo cáo định kỳ, kiểm tra giữa kỳ.
  6. Đánh giá, nghiệm thu cấp tỉnh; lưu trữ kết quả, công bố ứng dụng.
  7. Tra cứu công khai và thống kê; kết nối CSDL quốc gia về KH&CN; đăng nhập qua VNeID.
  8. Quản trị hệ thống, phân quyền, nhật ký, sao lưu.
- Với mỗi bài, học viên tạo ra sản phẩm tương ứng cho dự án này: báo cáo đề xuất chủ trương; BCNCKT (mục lục chuẩn); bảng tính chi phí phần mềm theo use case (áp công thức phụ lục thông tư, hệ thống tính tự động); thiết kế chi tiết (mô hình chức năng, dữ liệu, kiến trúc, an toàn cấp độ 2/3); kế hoạch LCNT; kịch bản kiểm thử; biên bản nghiệm thu; hồ sơ quyết toán.
- Mỗi sản phẩm mẫu được hệ thống gắn "căn cứ pháp lý của từng mục" (ví dụ mục "Phân tích sự cần thiết" ↔ điều/khoản quy định nội dung BCNCKT).

### 2.4 Công cụ tương tác trong chuyên đề
- **Máy tính chi phí phần mềm nội bộ**: hai chế độ, chọn theo văn bản áp dụng.
  1. *Chế độ hiện hành (TT 39/2026)*: nhập hạng mục công việc, số công tháng/công ngày, đơn giá → ra bảng chi phí theo cấu trúc của thông tư; tính tổng mức đầu tư `G = G_TB/DV + G_QLDA + G_TV + G_K + G_DP` với dự phòng ≤ 10%; có chế độ tính chi phí thuê dịch vụ (chia 96 tháng).
  2. *Chế độ chuyển tiếp / tham chiếu (QĐ 671, Use Case Point)*: nhập tác nhân, use case (nhóm B/M/T với hệ số 1 / 1,2 / 1,5), 13 hệ số kỹ thuật, 8 hệ số môi trường → `UUCP = TAW + TBF`, `TCF = 0,6 + 0,01×TFW`, `EF = 1,4 − 0,03×EFW`, `AUCP = UUCP×TCF×EF`, `E = 10/6×AUCP`, `G = 1,4×E×P×H`. Giao diện phải hiển thị cảnh báo rằng phương pháp này không còn là phương pháp pháp định từ 01/7/2026.

  Cả hai chế độ lấy hệ số và công thức **trực tiếp từ nút `cong_thuc` và `bang` đã số hóa**; khi văn bản đổi thì công cụ đổi theo và ghi rõ phiên bản văn bản áp dụng.
- **Bộ định tuyến thủ tục**: trả lời 6–8 câu hỏi (loại vốn, tổng mức, loại hoạt động, cấp thẩm quyền) → sinh sơ đồ trình tự với căn cứ từng bước.
- **Checklist hồ sơ** theo từng giai đoạn, xuất DOCX.
- **Bài kiểm tra**: trắc nghiệm + tình huống; chấm tự động (trắc nghiệm) và AI chấm tình huống có căn cứ (pháp chế kiểm tra mẫu).

## 3. Lĩnh vực số 2: pháp luật giao thông đường bộ

Lĩnh vực thứ hai có mặt trong danh mục để giữ đúng mô hình ba bậc ngay từ đầu: một lĩnh vực khác, một nhóm đối tượng khác, dùng chung toàn bộ cơ chế của mô-đun đào tạo.

- **Đối tượng**: cảnh sát giao thông đường bộ.
- **Cây chuyên đề** (theo trình tự công tác, gieo bởi `packages/db/src/seed-dao-tao-gtdb.ts`):
  1. Hệ thống pháp luật về trật tự, an toàn giao thông đường bộ và cách xác định văn bản áp dụng — gốc;
  2. Quy tắc giao thông đường bộ — nối tiếp 1;
  3. Phương tiện và người điều khiển phương tiện — nối tiếp 2;
  4. Tuần tra, kiểm soát, chỉ huy và điều khiển giao thông — nối tiếp 3;
  5. Xử lý vi phạm hành chính về giao thông đường bộ — nối tiếp 4, có hai chuyên đề cụ thể hoá: *Trừ điểm, phục hồi điểm giấy phép lái xe* và *Vận tải đường bộ và kiểm soát tải trọng*;
  6. Điều tra, giải quyết tai nạn giao thông đường bộ — nối tiếp 5.
- **Trạng thái**: cả lĩnh vực đang ở `bien_tap`. Danh mục công khai hiện tên và phạm vi dự kiến, không mở được bài nào. Bản đồ pháp lý và lộ trình bài học phải qua đúng quy trình ở mục 4 trước khi xuất bản.
- Lĩnh vực này có seed riêng để hai lĩnh vực biên soạn độc lập. `seed-dao-tao.ts` chỉ khai báo lĩnh vực kèm khung tạm hai chuyên đề, và bỏ qua khung tạm khi lĩnh vực đã có chuyên đề trong kho, nên chạy seed nào trước cũng ra cùng một kết quả.

## 4. Quy trình sản xuất một chuyên đề (áp dụng cho các chuyên đề sau)
1. Chọn chuyên đề, xác định đối tượng, kết quả đầu ra.
2. Lập "bản đồ pháp lý": hệ thống liệt kê văn bản theo thứ bậc + trạng thái + VBHN; pháp chế chốt.
3. Sinh khung bài học bằng AI từ trình tự trong văn bản (mỗi bước = một hoặc nhiều nút), chuyên gia chỉnh.
4. Viết ví dụ xuyên suốt và sản phẩm mẫu; kiểm tra chéo với biểu mẫu trong phụ lục văn bản.
5. Pháp chế duyệt từng bài (citation 100% hợp lệ, `as_of` rõ).
6. Xuất bản; theo dõi `citation_health`; cập nhật khi văn bản đổi.

> **Bài học rút ra từ chính chuyên đề này**: giữa lúc soạn kế hoạch (06/9/2026), căn cứ nền đã đổi
> từ NĐ 45/2026 sang NĐ 224/2026 mà không ai chủ động thông báo. Đây chính là lý do tồn tại của
> cơ chế `citation_health` (ke-hoach/08 §4) và của việc mọi bài học đều phải ghi `as_of`. Trước khi
> xuất bản bất kỳ chuyên đề nào, **bắt buộc** chạy lại `scripts/check-citations.ts` và đối chiếu
> danh mục văn bản với Công báo.

Chuyên đề tiếp theo gợi ý (cùng nền dữ liệu): mua sắm tài sản CNTT bằng chi thường xuyên; thuê dịch vụ CNTT; an toàn hệ thống thông tin theo cấp độ; nhiệm vụ KH&CN sử dụng NSNN.
