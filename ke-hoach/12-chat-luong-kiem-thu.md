# 12. Chất lượng, kiểm thử và đánh giá

## 1. Bộ dữ liệu vàng (evals/)
| Bộ | Kích thước | Nội dung | Dùng cho |
|----|-----------|----------|----------|
| `gold-ocr` | 300 trang | Đa dạng: text-layer, scan tốt, scan xấu, bảng qua trang, công thức, biểu mẫu, chữ ký/nơi nhận, phụ lục | CER/WER, TEDS bảng, đúng công thức, tỷ lệ nối đoạn đúng |
| `gold-structure` | 100 văn bản | Cây nút chuẩn (do biên tập tạo) | Precision/recall nút, đúng nhãn, đúng cấp |
| `gold-amend` | 50 văn bản sửa đổi + VBHN chính thức | ops chuẩn | Độ chính xác ops; khớp VBHN |
| `gold-retrieval` | 500 câu hỏi | Nút đúng (1–3/câu), gồm câu hỏi theo chuyên đề CNTT | Recall@10, MRR, nDCG |
| `gold-ask` | 150 câu hỏi | Câu trả lời chuẩn + citation chuẩn do pháp chế viết | Faithfulness, citation precision/recall, điểm chuyên gia |
| `gold-citation` | 1.000 chuỗi viện dẫn | URN đúng | Độ chính xác resolver |

## 2. Chỉ số và ngưỡng chấp nhận (giai đoạn 1)
| Chỉ số | Mục tiêu |
|--------|----------|
| CER thân văn bản (tuyến D) | ≤ 0,5% |
| TEDS bảng | ≥ 0,90 |
| Công thức parse được và đúng ngữ nghĩa (chuyên gia chấm) | ≥ 95% |
| Nối đoạn qua trang đúng | ≥ 99% |
| Nút cấu trúc: F1 | ≥ 0,99 (điều), ≥ 0,97 (khoản/điểm) |
| Amendment ops: precision/recall | ≥ 0,97 / ≥ 0,95 trước duyệt |
| Khớp hợp nhất tự động với VBHN chính thức | ≥ 99% ký tự |
| Retrieval Recall@10 (hybrid + rerank) | ≥ 0,90 |
| `/ask` faithfulness | ≥ 0,97; câu không có citation = 0 |
| Citation resolver | ≥ 0,98 |

## 3. Quy trình kiểm thử phần mềm
- Unit: parser, URN, citation, apply(ops), diff (Bun test; property-based với fast-check).
- Integration: pipeline end-to-end trên 20 văn bản mẫu trong CI (số hóa chạy với kết quả cụm trang đã ghi sẵn trong `sohoa_windows`, không gọi mô hình).
- Contract test crawler adapters (hằng ngày).
- E2E web (Playwright): đọc văn bản trên viewport mobile, nhảy điều, đổi `as_of`, copy viện dẫn, hỏi đáp có citation.
- Eval gate trong CI: khi thay prompt/model/parser, chạy eval tương ứng, chặn merge nếu giảm quá 1 điểm so với baseline.

## 4. Kiểm định pháp lý (con người)
- Mỗi tháng: pháp chế chấm ngẫu nhiên 50 câu trả lời `/ask` và 20 use case (thang 1–5, tiêu chí: đúng căn cứ, đúng hiệu lực, đủ ngoại lệ, diễn đạt).
- Mọi văn bản thuộc "nhóm hạ tầng pháp lý" và chuyên đề đang mở: duyệt 100% thủ công trước xuất bản.
- Kênh "báo sai" công khai; ticket có SLA (11 §7).

## 5. Theo dõi trôi dạt (drift)
- So sánh phân phối confidence OCR theo tuần; cảnh báo khi giảm.
- Khi Anthropic phát hành model mới: chạy toàn bộ eval trên staging, so sánh, quyết định nâng cấp; ghi model id vào provenance của mọi output.
