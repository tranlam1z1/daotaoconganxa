# Bộ đánh giá (evals)

Thư mục này chứa **bộ dữ liệu vàng** và **script chạy đánh giá** cho các thành phần của quydinhphapluat.vn. Xem đặc tả tại `ke-hoach/12-chat-luong-kiem-thu.md`.

Nguyên tắc: **bộ dữ liệu vàng gán nhãn theo cách hiểu pháp lý đúng, không theo hành vi hiện tại của mã nguồn.** Vì vậy một bộ dữ liệu vàng tốt luôn có một số ca mà hệ thống chưa xử lý được. Những ca đó là danh sách việc phải làm, không phải lỗi của bộ dữ liệu.

---

## 1. Các bộ dữ liệu hiện có

| Thư mục | Nội dung | Quy mô hiện tại | Quy mô mục tiêu (ke-hoach/12 §1) | Dùng để đo |
|---------|----------|-----------------|----------------------------------|------------|
| `gold-structure/` | Văn bản mẫu kèm cây nút chuẩn | 5 văn bản | 100 văn bản | Precision/recall nút, đúng nhãn, đúng cấp |
| `gold-retrieval/` | Câu hỏi có nhãn nút đúng | 76 câu | 500 câu | Recall@10, MRR, nDCG |
| `gold-citation/` | Chuỗi viện dẫn kèm URN đúng | 80 chuỗi | 1.000 chuỗi | Độ chính xác bộ phân giải viện dẫn |
| `gold-ocr/` | Trang scan kèm bản Markdown chuẩn | *chưa có* | 300 trang | CER/WER, TEDS bảng, tỷ lệ nối đoạn đúng |
| `gold-amend/` | Văn bản sửa đổi kèm ops chuẩn | *chưa có* (mầm mống ở `gold-structure/02-*.tree.json`) | 50 văn bản | Độ chính xác amendment ops |
| `gold-ask/` | Câu hỏi kèm câu trả lời và citation chuẩn do pháp chế viết | *chưa có* | 150 câu | Faithfulness, citation precision/recall |

---

## 2. Ngưỡng chấp nhận giai đoạn 1

Trích từ `ke-hoach/12-chat-luong-kiem-thu.md` §2. Cột "Trạng thái" ghi kết quả đo thực tế gần nhất.

| Chỉ số | Mục tiêu | Bộ dữ liệu | Trạng thái |
|--------|----------|------------|------------|
| CER thân văn bản (tuyến D) | ≤ 0,5% | `gold-ocr` | Chưa đo — chưa có bộ dữ liệu |
| TEDS bảng | ≥ 0,90 | `gold-ocr` | Chưa đo |
| Công thức parse được và đúng ngữ nghĩa | ≥ 95% | `gold-ocr` | Chưa đo |
| Nối đoạn qua trang đúng | ≥ 99% | `gold-ocr` | Chưa đo |
| Nút cấu trúc F1 — điều | ≥ 0,99 | `gold-structure` | Chưa có script đo tự động |
| Nút cấu trúc F1 — khoản, điểm | ≥ 0,97 | `gold-structure` | Chưa có script đo tự động |
| Amendment ops precision / recall | ≥ 0,97 / ≥ 0,95 | `gold-amend` | Chưa đo |
| Khớp hợp nhất tự động với văn bản hợp nhất chính thức | ≥ 99% ký tự | `gold-amend` | Chưa đo |
| Retrieval Recall@10 (hybrid và rerank) | ≥ 0,90 | `gold-retrieval` | Chưa đo — cần chỉ mục đã nạp dữ liệu |
| `/ask` faithfulness | ≥ 0,97; câu không có citation = 0 | `gold-ask` | Chưa đo |
| **Bộ phân giải viện dẫn** | **≥ 0,98** | `gold-citation` | **F1 = 0,9112 — CHƯA ĐẠT** (xem `gold-citation/failures.md`) |

---

## 3. Cách chạy

Mọi lệnh chạy **từ thư mục gốc của repo** để Bun phân giải được các alias `@qdpl/*` khai báo trong `tsconfig.base.json`.

### 3.1 Bộ phân giải viện dẫn (`gold-citation`)

```bash
bun run evals/run-citation-eval.ts                      # chạy và in bảng kết quả
bun run evals/run-citation-eval.ts --verbose             # in chi tiết từng ca sai ra màn hình
bun run evals/run-citation-eval.ts --write-failures      # luôn ghi gold-citation/failures.md
bun run evals/run-citation-eval.ts --threshold 0.95      # đặt ngưỡng khác cho lần chạy này
```

Script in ba bảng: theo nhóm ca, theo độ khó và tổng hợp. Chỉ số đo ở **cấp URN**, micro-average trên toàn bộ URN của mọi ca:

- **TP** — URN dự đoán đúng;
- **FP** — URN dự đoán thừa;
- **FN** — URN kỳ vọng nhưng bị bỏ sót;
- **Khớp hết** — tỷ lệ ca không có FP và không có FN.

Ca âm tính (`expected` rỗng) không đóng góp TP hay FN, chỉ có thể sinh FP. Đây là cách đo đúng: một chuỗi không phải viện dẫn thì kết quả đúng là không trả về gì.

Script **thoát với mã khác 0** khi F1 dưới ngưỡng, để dùng trực tiếp làm eval gate trong CI. Khi F1 dưới ngưỡng, script tự ghi `gold-citation/failures.md` liệt kê từng ca sai kèm chuỗi đầu vào, tập kỳ vọng, tập trả về, phần thiếu và phần thừa.

### 3.2 Cây nút chuẩn (`gold-structure`)

Chưa có script đo tự động. Cách kiểm tra thủ công hiện nay:

```bash
bun test packages/legal-model     # unit test của parser, dùng chung fixture 01
```

Khi xây script đo, so sánh cây do `parseDocument()` sinh ra với tệp `*.tree.json` tương ứng theo bộ ba `(path, kind, label)`, tính precision/recall/F1 riêng cho từng cấp `dieu`, `khoan`, `diem`.

### 3.3 Truy xuất (`gold-retrieval`)

Chưa có script đo tự động vì cần chỉ mục đã nạp dữ liệu thật. Khi có, đo Recall@10, MRR và nDCG cho từng tầng: BM25, dense, hybrid, hybrid kèm rerank.

---

## 4. Cấu trúc dữ liệu

### 4.1 `gold-citation/cases.jsonl`

Mỗi dòng là một đối tượng JSON:

```json
{
  "id": "cit-001-daydu",
  "text": "Việc thẩm định thiết kế thực hiện theo quy định tại điểm a khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP.",
  "self_doc_urn": "vn:vbqppl:nd:45/2026/NĐ-CP",
  "expected": ["vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2.diem-a"],
  "category": "day_du",
  "difficulty": "de",
  "note": "Giải thích cách gán nhãn khi cần."
}
```

| Trường | Bắt buộc | Ý nghĩa |
|--------|----------|---------|
| `id` | có | Định danh duy nhất |
| `text` | có | Chuỗi đầu vào |
| `self_doc_urn` | không | URN văn bản chứa viện dẫn; cần cho viện dẫn nội bộ kiểu "Nghị định này", "Điều 5" đứng một mình |
| `expected` | có | Tập URN đúng, **so sánh theo tập hợp, không xét thứ tự**; mảng rỗng nghĩa là không có viện dẫn nào phân giải được thành URN |
| `category` | có | Nhóm ca, dùng để phân tích điểm yếu theo nhóm |
| `difficulty` | có | `de`, `trung_binh`, `kho` |
| `note` | không | Ghi chú của người gán nhãn |

Các nhóm ca hiện có: `day_du` (20), `noi_bo` (10), `nhieu_vien_dan` (10), `nhan_bo_sung` (8), `cap_van_ban` (8), `am_tinh` (8), `dia_phuong` (6), `ten_khong_so` (5), `viet_tat` (2), `trat_tu_nguoc` (1), `khoang_dieu` (1), `liet_ke_khoan` (1).

Hai nhóm quan trọng dễ bị hiểu nhầm:

- **`am_tinh`** — chuỗi **không phải** viện dẫn: số điện thoại, số fax, mã số thuế, số hợp đồng kinh tế, ngày tháng, số tiền, số phòng. `expected` là mảng rỗng. Nhóm này bảo vệ precision.
- **`ten_khong_so`** — viện dẫn **có tên văn bản nhưng không có số ký hiệu** ("theo quy định của Luật Đầu tư công"). `expected` là mảng rỗng vì không đủ dữ kiện dựng URN. Bộ phân giải vẫn phải nhận diện được `docName`, nhưng ở cấp URN thì kết quả đúng là không trả về gì. Việc ánh xạ tên văn bản sang URN thuộc về từ điển tên văn bản, đo bằng bộ dữ liệu khác.

### 4.2 `gold-retrieval/questions.jsonl`

```json
{
  "id": "ret-027",
  "question": "Dự án có tổng mức đầu tư bao nhiêu thì được áp dụng thiết kế một bước?",
  "expected_urns": ["vn:vbqppl:nd:45/2026/NĐ-CP#dieu-9.khoan-2"],
  "fields": ["cong-nghe-thong-tin", "dau-tu-cong"],
  "intent": "dieu_kien",
  "difficulty": "de",
  "as_of": "2026-06-01",
  "note": "Ghi chú về hiệu lực hoặc cách gán nhãn."
}
```

Mỗi câu có 1 đến 3 nút đúng. Trường `as_of` **bắt buộc** vì nhiều câu chỉ đúng tại một thời điểm nhất định: xem mục 5 về tình huống hiệu lực.

`intent` khớp bảng ý định của `prompts/ask/analyze-question.md`: `tra_cuu`, `thu_tuc`, `tham_quyen`, `thoi_han`, `dieu_kien`, `so_sanh`, `hieu_luc`, `muc_phat`, `chi_phi`, `bieu_mau`, `ap_dung`, `nghia_vu`.

### 4.3 `gold-structure/*.tree.json`

Mỗi văn bản mẫu `NN-ten.md` đi kèm một tệp `NN-ten.tree.json`:

```json
{
  "doc": "01-nd-mau-goc.md",
  "urn": "vn:vbqppl:nd:100/2026/NĐ-CP",
  "title": "…",
  "note": "Bài kiểm thử này bao phủ những gì",
  "source": "Văn bản mẫu do tổ biên soạn tạo cho mục đích kiểm thử; không phải văn bản quy phạm pháp luật có thật.",
  "counts": { "chuong": 2, "dieu": 6, "khoan": 9, "diem": 6 },
  "expected_warnings": [],
  "tree": [ { "path": "…", "fullPath": "…", "kind": "…", "label": "…", "heading": "…", "children": [] } ]
}
```

Năm văn bản mẫu và phạm vi bao phủ:

| Tệp | Bao phủ |
|-----|---------|
| `01-nd-mau-goc.md` | Bố cục cơ bản: chương, mục, điều, khoản, điểm; nối dòng trong cùng đoạn; công thức khối kèm khối "Trong đó"; bảng GFM; khối "Nơi nhận" và chữ ký. Giống hệt `data/fixtures/nd-mau-goc.md` để dùng chung với unit test của parser. |
| `02-nd-mau-sua-doi.md` | Văn bản sửa đổi: mỗi khoản của Điều 1 là một lệnh sửa đổi, nội dung mới nằm trong dấu ngoặc kép và tự nó mang nhãn khoản hoặc nhãn điều. Kèm `expected_amend_ops` làm mầm mống cho bộ `gold-amend`. |
| `03-tt-phu-luc-cong-thuc.md` | Điều không đánh số khoản; dãy điểm đầy đủ tới `đ`; phụ lục đứng **sau** khối chữ ký; công thức và bảng nằm trong phụ lục. |
| `04-luat-co-phan-chuong-muc.md` | Đủ năm cấp: Phần, Chương, Mục, Tiểu mục, Điều; điều đánh số liên tục xuyên phần và chương; mục có tiểu mục xen kẽ mục không có tiểu mục. |
| `05-qd-ubnd-co-nut-bo-sung.md` | Văn bản của chính quyền cấp tỉnh; dãy điểm `a b c d đ e` (không có `f`); điểm bổ sung `đ1`; khoản bổ sung `2a`; điều bổ sung `3a`. |

Toàn bộ năm văn bản là **văn bản mẫu do tổ biên soạn tạo ra**, không phải văn bản quy phạm pháp luật có thật. Số ký hiệu được chọn để không trùng với văn bản thật đang có hiệu lực.

Tệp `02-nd-mau-sua-doi.tree.json` có thêm trường `known_limitation` mô tả giới hạn đã biết của parser hiện tại: parser tách nhãn nằm trong ngoặc kép thành nút riêng, sinh 07 khoản cho Điều 1 thay vì 05. Cây trong `tree` là cây **đúng**, không phải cây parser đang sinh ra.

---

## 5. Lưu ý quan trọng về hiệu lực văn bản trong bộ dữ liệu

Bộ dữ liệu này được lập ngày **06/9/2026**. Tình hình hiệu lực của lĩnh vực đầu tư ứng dụng công nghệ thông tin biến động rất nhanh trong năm 2026:

```
Nghị định 73/2019/NĐ-CP + Nghị định 82/2024/NĐ-CP
        │  (bị thay thế từ 01/3/2026)
        ▼
Nghị định 45/2026/NĐ-CP        — hiệu lực 01/3/2026 đến 30/6/2026
        │  (bị thay thế từ 01/7/2026 theo điểm a khoản 2 Điều 90 Nghị định 224/2026/NĐ-CP)
        ▼
Nghị định 224/2026/NĐ-CP       — hiệu lực từ 01/7/2026, quy định chi tiết Luật Chuyển đổi số số 148/2025/QH15
```

Hệ quả cho bộ dữ liệu:

1. Phần lớn câu hỏi trong `gold-retrieval` gán nhãn với `as_of = "2026-06-01"` và trỏ tới nút của Nghị định 45/2026/NĐ-CP. Tại thời điểm đó nghị định này **đang có hiệu lực**, nên nhãn là đúng.
2. Một nhóm câu gán nhãn với `as_of = "2026-09-06"` trỏ tới Nghị định 224/2026/NĐ-CP và các thông tư hiện hành. Nhóm này dùng để kiểm tra hệ thống có **đổi câu trả lời theo thời điểm** hay không — đây là năng lực cốt lõi của sản phẩm.
3. Khi chấm bài, **bắt buộc truyền `as_of` của từng câu vào bộ truy xuất**. Chấm toàn bộ ở một thời điểm duy nhất sẽ cho kết quả sai lệch.
4. Với `gold-citation`, chuỗi viện dẫn tới Nghị định 45/2026/NĐ-CP vẫn hợp lệ và vẫn phải phân giải đúng thành URN: bộ phân giải làm việc ở mức cú pháp, không phụ thuộc hiệu lực. Việc cảnh báo "nút đã hết hiệu lực" thuộc tầng trên.

---

## 6. Kết quả đo gần nhất

Chạy ngày 06/9/2026, `bun run evals/run-citation-eval.ts`:

| Chỉ số | Giá trị |
|--------|---------|
| Số ca | 80 |
| TP / FP / FN | 77 / 2 / 13 |
| Precision | 0,9747 |
| Recall | 0,8556 |
| **F1** | **0,9112** |
| Ca khớp hoàn toàn | 70/80 (87,50%) |
| Ngưỡng ≥ 0,98 | **KHÔNG ĐẠT** |

Điểm theo độ khó: `de` F1 = 1,0000 (34 ca); `trung_binh` F1 = 0,9867 (29 ca); `kho` F1 = 0,6111 (17 ca).

Toàn bộ 10 ca sai nằm ở các nhóm khó, chi tiết trong `gold-citation/failures.md`. Bốn nhóm nguyên nhân:

1. **Liệt kê nhiều nút dùng chung một điều** — "các khoản 1, 2 và 3 Điều 16" chỉ ra một nút thay vì ba.
2. **Viện dẫn theo khoảng** — "từ Điều 5 đến Điều 8" chỉ ra hai nút đầu và cuối, không mở rộng thành bốn nút.
3. **Trật tự viết ngược và viết tắt phi chuẩn** — "Điều 9 khoản 2 điểm a Nghị định 45/2026/NĐ-CP", "k.2 Đ.9 NĐ 45/2026", "khoản 2 điều 15 nđ 45/2026". Nhóm này quan trọng vì đó chính là cách người dùng gõ vào ô tìm kiếm.
4. **Một văn bản được nhắc nhiều lần trong một câu với các điều khác nhau** — biểu thức khớp bỏ sót nút đứng trước liên từ "và".

Precision 0,9747 đã gần ngưỡng; recall 0,8556 là điểm yếu chính. Không có ca âm tính nào bị nhận nhầm, nghĩa là bộ phân giải **không sinh viện dẫn giả** — đặc tính quan trọng nhất đối với hệ thống pháp lý.

Việc sửa `packages/citation` nằm ngoài phạm vi của bộ dữ liệu này. `failures.md` là đầu vào cho công việc đó.

---

## 7. Quy ước khi mở rộng bộ dữ liệu

1. **Gán nhãn theo pháp luật, không theo mã nguồn.** Không sửa nhãn cho khớp kết quả hệ thống.
2. **Mọi ca phải truy được về văn bản thật**, trừ các văn bản mẫu trong `gold-structure` vốn được đánh dấu rõ là văn bản mẫu.
3. **Không bịa số điều, số khoản.** Nếu chưa xác minh được, không đưa ca đó vào bộ dữ liệu; ghi vào phần tồn đọng thay vì đoán.
4. **Giữ tỷ lệ ca khó khoảng 20% đến 25%.** Bộ dữ liệu toàn ca dễ không phát hiện được hồi quy.
5. **Nhóm âm tính tối thiểu 10%.** Không có nhóm âm tính thì không đo được precision một cách trung thực.
6. **Mỗi ca chỉ kiểm một hiện tượng.** Ca kiểm nhiều hiện tượng cùng lúc làm mất khả năng chẩn đoán khi nó sai.
7. **`id` không được đổi** sau khi đã dùng để so sánh giữa các lần chạy.
8. Sau khi mở rộng, chạy lại script và cập nhật mục 6 của tệp này bằng số liệu mới.
