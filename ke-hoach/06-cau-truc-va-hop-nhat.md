# 06. Phân tích cấu trúc và engine hợp nhất

## 1. Parser cấu trúc (packages/legal-model)

Đầu vào: Markdown chuẩn nội bộ (có hoặc chưa có marker nút). Đầu ra: cây nút + `nodes` rows.

### 1.1 Bộ nhận dạng nhãn (regex, Unicode NFC)
| Loại | Mẫu | Ví dụ |
|------|-----|-------|
| Phần | `^Phần thứ (nhất|hai|ba|…|\d+)\b` | Phần thứ nhất |
| Chương | `^Chương ([IVXLC]+|\d+)\b` | Chương II |
| Mục | `^Mục (\d+)\b` | Mục 3 |
| Tiểu mục | `^Tiểu mục (\d+)\b` | |
| Điều | `^Điều (\d+[a-zđ]?)\.\s*(.*)$` | Điều 12a. Tên |
| Khoản | `^(\d+[a-zđ]?)\.\s+` | 2a. |
| Điểm | `^([a-zđ]\d?)\)\s+` | đ) , đ1) |
| Gạch đầu dòng | `^[-–•]\s+` | đoạn con |
| Phụ lục | `^PHỤ LỤC\s*([IVX]+|\d+)?` | |
| Căn cứ | `^Căn cứ ` liên tiếp trước "Chính phủ ban hành…"/"Quốc hội ban hành…" | |
| Chữ ký | Khối "Nơi nhận:" + chức danh in hoa | |

Máy trạng thái xây cây: đọc tuần tự, đẩy/bật ngăn xếp theo cấp; xử lý ngoại lệ: điều không có khoản đánh số (nội dung gán vào `dieu` trực tiếp, tạo `khoan-1` ẩn với `implicit=true`), khoản chỉ có điểm, đoạn văn tự do sau điểm cuối (gán `doan`), phụ lục có cấu trúc riêng (bảng, mẫu).

### 1.2 `stable_key`
`stable_key = {doc}:{dieu}[.{khoan}[.{diem}]]` theo nhãn gốc; khi văn bản đánh số lại toàn bộ (thay thế), phiên bản mới là văn bản mới, không cần map. Khi nút bị "bổ sung Điều 12a" → key mới `12a`. Khi văn bản sửa đổi "sửa đổi khoản 2 Điều 15" → cùng key, `node_status=amended`.

### 1.3 Nhận diện dẫn chiếu trong nội dung
Regex + LLM phân giải: "quy định tại khoản 2 Điều 15 của Nghị định này", "theo quy định của Luật Đầu tư công", "điểm a khoản 1 Điều 3 Nghị định số 45/2026/NĐ-CP". Sinh `relations.dan_chieu` cấp nút với `confidence`; chuỗi không phân giải được lưu để biên tập.

## 2. Trích lệnh sửa đổi (amendment ops)

### 2.1 Nhận diện văn bản sửa đổi
- Tên chứa "sửa đổi, bổ sung một số điều", "bãi bỏ", hoặc điều trong thân có dạng "Điều 1. Sửa đổi, bổ sung một số điều của …".
- Với luật "một luật sửa nhiều luật" (thường mỗi Điều sửa một luật) → mỗi Điều là một nhóm ops trỏ tới văn bản khác nhau.

### 2.2 Mẫu câu lệnh thường gặp → op
| Mẫu | op |
|-----|----|
| "Sửa đổi, bổ sung khoản 2 Điều 15 như sau: '2. …'" | `replace` target `15.2` payload text |
| "Bổ sung khoản 2a vào sau khoản 2 Điều 15 như sau:" | `insert_after` target `15.2`, new key `15.2a` |
| "Bổ sung Điều 12a vào sau Điều 12" | `insert_after` cấp điều |
| "Bãi bỏ điểm c khoản 1 Điều 7" | `repeal` (giữ nhãn, ghi "(được bãi bỏ)") |
| "Bãi bỏ Điều 20" / "Bãi bỏ Nghị định số …" | `repeal` cấp điều / cấp văn bản |
| "Thay thế cụm từ 'Bộ Thông tin và Truyền thông' bằng 'Bộ Khoa học và Công nghệ' tại các điều …" | `replace_phrase` áp dụng cho danh sách nút |
| "Sửa đổi tên Điều 5 thành …" | `rename` |
| "Ngưng hiệu lực khoản … từ ngày … đến ngày …" | `suspend` với khoảng thời gian |
| "Điều 3 … có hiệu lực từ ngày …" (hiệu lực riêng) | gán `effective_from` riêng cho ops |

### 2.3 Quy trình
1. Rule-based extractor xử lý mẫu rõ ràng (≥ 70% trường hợp).
2. LLM (`claude-opus-5`, structured output theo schema `amendment_ops`) xử lý toàn bộ Điều sửa đổi, đối chiếu với kết quả rule; khác biệt → `confidence` thấp.
3. Kiểm tra tồn tại: target `stable_key` phải có trong phiên bản hiện hành của văn bản đích tại ngày hiệu lực; không có → `needs_legal`.
4. Hàng đợi duyệt: biên tập viên xem song song "lệnh gốc" ↔ "op" ↔ "nút đích trước/sau". Duyệt xong mới hợp nhất. Với văn bản sửa đổi lớn (hàng trăm ops), cho phép duyệt theo lô và duyệt bằng so sánh với VBHN chính thức khi có.

## 3. Engine hợp nhất theo thời điểm (point-in-time)

```
render(document, as_of):
  base = version gốc (hoặc VBHN chính thức gần nhất ≤ as_of nếu được cấu hình ưu tiên)
  ops  = amendment_ops đã duyệt, target=document, effective_from ≤ as_of < effective_to, sắp xếp theo (effective_from, thứ tự trong văn bản sửa đổi)
  tree = apply(base.tree, ops)   // thuần hàm, có kiểm tra xung đột
  return tree + footnotes (theo NĐ 250/2026) + status per node
```

- Kết quả được **vật hóa** thành `document_versions(kind=consolidated_auto)` tại mỗi mốc ngày có ops có hiệu lực; truy vấn ngày bất kỳ chọn phiên bản gần nhất.
- Xung đột (hai ops cùng target cùng ngày, target đã bị bãi bỏ…) → chặn, tạo ticket.
- Ưu tiên VBHN chính thức: khi cơ quan ban hành VBHN, nạp làm `consolidated_official`, diff với `consolidated_auto` cùng thời điểm; sai khác báo biên tập (có thể chỉnh ops hoặc ghi nhận lỗi VBHN chính thức, kèm cảnh báo cho người dùng rằng văn bản được hợp nhất là căn cứ khi mâu thuẫn).

## 4. Trạng thái hiệu lực cấp nút và cấp văn bản
- Nút: `active` mặc định; `amended` khi có `replace/rename/replace_phrase`; `repealed`/`suspended` theo ops; `added` cho nút do ops chèn.
- Văn bản: `het_hieu_luc` nếu có op `repeal` cấp văn bản hoặc `effective_to` ≤ as_of; `het_hieu_luc_mot_phan` nếu tồn tại nút `repealed`/`amended`; `ngung_hieu_luc` nếu có `suspend` cấp văn bản; `chua_hieu_luc` nếu `effective_from` > as_of.
- Đặc thù: văn bản quy định chi tiết hết hiệu lực khi văn bản được quy định chi tiết hết hiệu lực, trừ khi có quy định chuyển tiếp/tiếp tục áp dụng → cần quan hệ `huong_dan` + quy tắc suy diễn, kết quả ở dạng "dự kiến hết hiệu lực" chờ biên tập xác nhận (không tự động chuyển trạng thái cứng).

## 5. So sánh phiên bản (diff)
- Diff cấp nút theo `stable_key`: thêm/xóa/sửa; trong nút sửa: diff từ (word-level) có tô màu.
- Hỗ trợ: (a) hai thời điểm của cùng văn bản; (b) văn bản bị thay thế ↔ văn bản thay thế (căn chỉnh theo tiêu đề điều bằng embedding similarity + LLM gợi ý map, biên tập xác nhận) để trả lời "quy định này ở luật mới nằm ở đâu".

## 6. Kiểm thử
- Bộ test: 50 văn bản sửa đổi tiêu biểu (luật, nghị định, thông tư, "một luật sửa nhiều luật", thay cụm từ hàng loạt) có VBHN chính thức tương ứng → tỷ lệ khớp `consolidated_auto` với VBHN chính thức ≥ 99% ký tự thân văn bản.
- Property test cho `apply()`: áp dụng rồi hoàn tác; tính giao hoán của ops độc lập.
