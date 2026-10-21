# 07. Tìm kiếm, chỉ mục và RAG có trích dẫn

## 1. Các loại chỉ mục

| Chỉ mục | Công nghệ | Đơn vị | Dùng cho |
|---------|-----------|--------|----------|
| Từ khóa (BM25) | OpenSearch | nút (điều/khoản/điểm) + văn bản (metadata) | Tra cứu chính xác số ký hiệu, thuật ngữ, cụm từ; facet theo loại/cơ quan/lĩnh vực/trạng thái/năm |
| Ngữ nghĩa (vector) | pgvector, `bge-m3` dense 1024d (+ sparse lexical weights của bge-m3 lưu trong OpenSearch dạng `rank_features`) | chunk ≤ 512 token, theo ranh giới nút | Câu hỏi tự nhiên, đồng nghĩa, diễn đạt khác |
| Đồ thị quan hệ | bảng `relations` (Postgres) + truy vấn đệ quy | văn bản/nút | Mở rộng ngữ cảnh: văn bản hướng dẫn, sửa đổi, dẫn chiếu; cây cha/con |
| Viện dẫn | `citation` resolver (regex + từ điển tên văn bản) | chuỗi → URN | Nhận diện khi người dùng gõ "khoản 2 điều 15 nđ 45/2026" |
| Thời gian | cột `valid_from/valid_to`, `effective_*` | | Lọc "hiệu lực tại ngày" |
| Gợi ý (autocomplete) | OpenSearch completion + pg_trgm | tên/số ký hiệu | Ô tìm kiếm |

## 2. Chunking cho vector
- Đơn vị cơ sở: **khoản** (kèm tiêu đề điều, chương, tên văn bản làm tiền tố ngữ cảnh: "Nghị định 45/2026/NĐ-CP > Chương II > Điều 15. Thẩm định thiết kế > khoản 2"). Điểm ngắn gộp vào khoản; khoản dài (> 512 token) tách theo điểm/đoạn với overlap 10–15%.
- Bảng: mỗi bảng một chunk gồm caption + header + tối đa N hàng; bảng lớn tách theo nhóm hàng, lặp header; thêm "diễn giải bằng lời" do AI sinh (05 §4.3).
- Công thức: chunk gồm LaTeX + diễn giải + giải thích ký hiệu.
- Metadata mỗi chunk: `urn`, `stable_key`, `doc_type`, `rank`, `issuer`, `fields[]`, `valid_from`, `valid_to`, `node_status`, `version_kind`.
- Chỉ index phiên bản **đang hiệu lực** làm mặc định; phiên bản lịch sử index trong không gian riêng (`historical=true`) để tra cứu theo thời điểm.

## 3. Tiếng Việt cho BM25
- Analyzer: lowercase → NFC → ICU folding (tùy chọn giữ dấu ở trường chính, thêm trường không dấu `text.folded` để bắt truy vấn không dấu) → tách từ.
- Tách từ: PoC 2 phương án — (a) plugin `analysis-vietnamese` cho OpenSearch; (b) tiền xử lý bằng `underthesea`/`pyvi` ghép từ bằng `_` ("đầu_tư_công") rồi index bằng whitespace analyzer, truy vấn cũng tách tương tự. Chọn theo kết quả eval (12).
- Từ điển đồng nghĩa pháp lý (synonym filter): "NĐ" ↔ "Nghị định", "TT" ↔ "Thông tư", "NSNN" ↔ "ngân sách nhà nước", tên bộ cũ ↔ mới.
- Trường boost: `so_ky_hieu^10`, `title^5`, `heading^3`, `text`.

## 4. Hybrid retrieval và rerank
1. Chạy song song BM25 (top 100), dense (top 100), sparse bge-m3 (top 100), citation match (nếu phát hiện viện dẫn thì đưa thẳng nút đó lên đầu).
2. Hợp nhất bằng **Reciprocal Rank Fusion** → top 60.
3. Lọc/ưu tiên: `as_of` mặc định hôm nay; `node_status != repealed` trừ khi người dùng bật "gồm hết hiệu lực"; boost theo `rank` (Luật > Nghị định > Thông tư) khi điểm gần nhau; boost văn bản mới hơn cùng cơ quan.
4. Rerank cross-encoder (`bge-reranker-v2-m3` hoặc ViRanker) → top 10–20.
5. Mở rộng ngữ cảnh bằng đồ thị: với mỗi nút top-k, kéo thêm nút cha (điều), nút hướng dẫn chi tiết (thông tư hướng dẫn điều này), nút sửa đổi gần nhất, tối đa +10 nút.

## 5. RAG hỏi đáp có trích dẫn (`POST /ask`)

Nguyên tắc: **trả lời từ căn cứ, mọi khẳng định có trích dẫn URN, có ngày hiệu lực**.

Luồng:
1. Phân tích câu hỏi (`claude-sonnet-5`, structured output): ý định (tra cứu / so sánh / thủ tục / thời hạn / thẩm quyền / mức phạt), thực thể (văn bản, cơ quan, lĩnh vực), thời điểm quan tâm, có cần tra nhiều văn bản không; sinh 2–4 truy vấn con.
2. Retrieval như §4 cho từng truy vấn con; gộp, khử trùng, giới hạn 16–32k token ngữ cảnh.
3. Sinh câu trả lời bằng `claude-opus-5` (adaptive thinking, effort high): mỗi chunk đưa vào dưới dạng `document` block với `citations: {enabled: true}` để API trả `cited_text` + `document_index` → ánh xạ ngược sang URN. Prompt yêu cầu: cấu trúc "Kết luận ngắn → Căn cứ (trích nguyên văn, viện dẫn chuẩn 01 §6) → Lưu ý hiệu lực/chuyển tiếp → Điều kiện/ngoại lệ → Không đủ căn cứ (nếu có)".
4. Hậu kiểm: (a) mỗi câu khẳng định pháp lý có ít nhất 1 citation; (b) URN trích dẫn phải tồn tại và có hiệu lực tại `as_of`; (c) nếu trích dẫn nút `repealed` → cảnh báo đỏ; (d) kiểm tra mâu thuẫn thứ bậc (dẫn thông tư trái luật → nêu nguyên tắc ưu tiên).
5. Hiển thị: câu trả lời + thẻ căn cứ có thể bấm mở đúng khoản, kèm "hiệu lực tại ngày…", nút "xem bản gốc", nút "báo sai".
6. Chế độ "đối chiếu": người dùng chọn 2+ văn bản/nút → mô hình lập bảng so sánh có trích dẫn từng ô.

Ràng buộc an toàn: tuyên bố rõ "thông tin tham khảo, không thay thế tư vấn pháp lý"; không trả lời khi không có căn cứ; log toàn bộ câu hỏi/câu trả lời/citation để đánh giá (12).

Prompt caching: system prompt + hướng dẫn định dạng cố định (cache); ngữ cảnh truy xuất đặt sau. Cân nhắc cache theo phiên cho hội thoại nhiều lượt.

## 6. Tra cứu theo thời điểm và theo thứ bậc (UI/API)
- Tham số `as_of` xuyên suốt search/doc/ask.
- Bộ lọc thứ bậc: chọn "chỉ Luật trở lên", "đến Nghị định", "đến Thông tư", "gồm địa phương (tỉnh …)".
- Chế độ "xem quy định về X theo cây thứ bậc": nhóm kết quả theo `rank` → hiển thị Luật (điều liên quan) → Nghị định hướng dẫn điều đó → Thông tư hướng dẫn → văn bản địa phương, dựa trên `relations.huong_dan` và `dan_chieu`.

## 7. Đánh giá (chi tiết 12)
- Bộ 500 câu hỏi có nhãn (nút đúng) từ Zalo Legal Text Retrieval + tự xây theo chuyên đề; đo Recall@10, MRR, nDCG cho từng tầng (BM25, dense, hybrid, +rerank).
- Với `/ask`: faithfulness (mọi câu có căn cứ), citation precision, đánh giá của pháp chế (thang 1–5) trên 100 câu mẫu mỗi tháng.
