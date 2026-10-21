# 00. Tổng quan kế hoạch kỹ thuật và vận hành — quydinhphapluat.vn

> Phạm vi: kỹ thuật và vận hành. Không bao gồm kế hoạch kinh doanh (chủ đầu tư đã có riêng).
> Ngày lập: 06/09/2026. Các số hiệu văn bản dẫn trong bộ kế hoạch được lấy từ nguồn công khai tại thời điểm lập; trước khi dùng làm căn cứ chính thức cần đối chiếu lại toàn văn trên vbpl.vn / Công báo.
>
> **Ví dụ thực tế ngay trong quá trình lập kế hoạch**: bản nháp đầu tiên của [09-dao-tao-chuyen-de.md](09-dao-tao-chuyen-de.md)
> dựng trên Nghị định 45/2026/NĐ-CP; tra cứu Công báo cho thấy nghị định này **đã hết hiệu lực từ
> 01/7/2026**, bị thay thế bởi Nghị định 224/2026/NĐ-CP. Kế hoạch đã được sửa. Đây chính là vấn đề
> mà hệ thống sinh ra để giải quyết, và là lý do mọi nội dung biên tập đều phải gắn `as_of` cùng cơ
> chế theo dõi sức khỏe viện dẫn.

## 1. Mục tiêu sản phẩm (góc nhìn kỹ thuật)

Hệ thống dịch vụ **tra cứu – đối chiếu – vận dụng** quy định pháp luật Việt Nam, gồm 5 năng lực lõi:

| # | Năng lực | Mô tả ngắn | Kế hoạch chi tiết |
|---|----------|------------|-------------------|
| 1 | Kho văn bản có cấu trúc | Thu thập từ nguồn chính thống, agent số hóa về Markdown giữ bảng, công thức, hình; phân rã đến điều/khoản/điểm | 04, 05, 06 |
| 2 | Tham chiếu khoa học | Thứ bậc hiệu lực (Hiến pháp → Luật → dưới luật), phiên bản, trạng thái, quan hệ cha/con/ảnh hưởng, hợp nhất | 01, 03, 06 |
| 3 | Tìm kiếm & RAG | Hybrid BM25 + vector + rerank, trả lời có trích dẫn đến cấp khoản/điểm, tra cứu theo thời điểm hiệu lực | 07 |
| 4 | Trường hợp ứng dụng | Thư viện tình huống phân loại khoa học, viện dẫn đúng chuẩn, cảnh báo khi căn cứ thay đổi | 08 |
| 5 | Đào tạo chuyên đề | Lộ trình học theo chuyên đề, ví dụ mẫu end-to-end (dự án phần mềm cụ thể) | 09 |

## 2. Danh mục tài liệu kế hoạch

| File | Nội dung |
|------|----------|
| [00-tong-quan.md](00-tong-quan.md) | Tài liệu này: mục tiêu, quyết định kiến trúc chính, thuật ngữ |
| [01-nen-tang-phap-ly.md](01-nen-tang-phap-ly.md) | Nền tảng pháp lý mà hệ thống phải mô hình hóa: thứ bậc VBQPPL, hiệu lực, hợp nhất, pháp điển, nguồn chính thống |
| [02-kien-truc-he-thong.md](02-kien-truc-he-thong.md) | Kiến trúc tổng thể, tech stack, cấu trúc monorepo, luồng dữ liệu |
| [03-mo-hinh-du-lieu.md](03-mo-hinh-du-lieu.md) | Mô hình dữ liệu: văn bản, phiên bản, cây cấu trúc, quan hệ, trạng thái hiệu lực, định danh |
| [04-thu-thap-du-lieu.md](04-thu-thap-du-lieu.md) | Crawler: nguồn, lịch, phát hiện thay đổi, chuẩn hóa, khử trùng lặp, đạo đức/pháp lý |
| [05-ocr-va-chuyen-doi-ai.md](05-ocr-va-chuyen-doi-ai.md) | Số hóa bằng agent qua MCP: giữ bảng/công thức/hình, nối đoạn qua trang, ghép cụm và kiểm chứng bằng luật |
| [06-cau-truc-va-hop-nhat.md](06-cau-truc-va-hop-nhat.md) | Phân tích cấu trúc điều/khoản/điểm, engine hợp nhất tự động, so sánh phiên bản |
| [07-tim-kiem-rag.md](07-tim-kiem-rag.md) | Chỉ mục BM25/vector/đồ thị, embedding tiếng Việt, rerank, RAG có trích dẫn, tra cứu theo thời điểm |
| [08-truong-hop-ung-dung.md](08-truong-hop-ung-dung.md) | Thư viện trường hợp ứng dụng: phân loại, cấu trúc, chuẩn viện dẫn, quy trình biên tập |
| [09-dao-tao-chuyen-de.md](09-dao-tao-chuyen-de.md) | Mô-đun đào tạo; chuyên đề mẫu: đầu tư dự án CNTT dùng NSNN theo NĐ 45/2026 với ví dụ phần mềm cụ thể |
| [09-a-phuong-phap-dao-tao-truc-quan.md](09-a-phuong-phap-dao-tao-truc-quan.md) | Phương pháp đào tạo trực quan: 19 kiểu khối bài giảng, 15 dạng bài tập, hệ đánh giá, AI đồng soạn, lộ trình và thống kê |
| [09-b-mascot-dong-hanh.md](09-b-mascot-dong-hanh.md) | Bộ bảy nhân vật đồng hành: tạo hình tham số, trạng thái, trang phục, hành động, định tuyến theo đối tượng và chuyên đề, sinh ảnh bằng AI |
| [09-c-bang-dieu-khien-quan-tri-dao-tao.md](09-c-bang-dieu-khien-quan-tri-dao-tao.md) | Bảng điều khiển quản trị đào tạo và mascot: soạn bài, xưởng AI, ngân hàng câu hỏi, ba màn hình mascot, phân quyền |
| [10-frontend-ux.md](10-frontend-ux.md) | Web app: React Router v7 framework mode, Vite, Bun, mobile-first, trải nghiệm đọc văn bản |
| [11-van-hanh-devops.md](11-van-hanh-devops.md) | Hạ tầng, triển khai, giám sát, sao lưu, bảo mật, chi phí AI, quy trình biên tập & vận hành dữ liệu |
| [12-chat-luong-kiem-thu.md](12-chat-luong-kiem-thu.md) | Bộ dữ liệu vàng, chỉ số chất lượng OCR/cấu trúc/retrieval, quy trình kiểm định pháp lý |
| [13-lo-trinh-trien-khai.md](13-lo-trinh-trien-khai.md) | Lộ trình theo giai đoạn, cột mốc, nhân sự, rủi ro |
| [14-nguon-tham-khao.md](14-nguon-tham-khao.md) | Danh mục nguồn đã tra cứu khi lập kế hoạch |

## 3. Quyết định kiến trúc chính (ADR rút gọn)

| ID | Quyết định | Lý do | Thay thế đã cân nhắc |
|----|-----------|-------|----------------------|
| ADR-01 | Web: **React Router v7 framework mode** (SSR) + Vite + TypeScript + Bun | Đây là "Remix" hiện tại; Remix v2 đã EOL, Remix 3 còn beta và không dùng React. SSR cần cho SEO văn bản pháp luật | Next.js (nặng, khóa vendor), Remix 3 (chưa ổn định) |
| ADR-02 | Nguồn sự thật: **PostgreSQL 16+** (dữ liệu có cấu trúc, phiên bản, quan hệ) | Giao dịch, JSONB, `ltree` cho cây cấu trúc, pgvector cho vector, pg-boss cho hàng đợi | MongoDB (yếu về quan hệ/phiên bản) |
| ADR-03 | Tìm kiếm từ khóa: **OpenSearch** với analyzer tiếng Việt (ICU + tách từ) | BM25 chất lượng, highlight, facet; tsvector Postgres không có từ điển tiếng Việt | Meilisearch/Typesense (thiếu tách từ tiếng Việt tốt), pg_search |
| ADR-04 | Vector: **pgvector** (giai đoạn 1) → Qdrant khi >20 triệu chunk | Giảm số thành phần vận hành; HNSW đủ nhanh cho vài triệu chunk | Qdrant/Weaviate ngay từ đầu |
| ADR-05 | Định dạng nội dung chuẩn: **Markdown mở rộng** (GFM tables, LaTeX `$...$`, hình `![](asset://id)`) + **cây cấu trúc JSON** (kiểu Akoma Ntoso rút gọn) | Markdown dễ đọc, dễ diff, dễ nhúng RAG; cây JSON cho định danh điều/khoản/điểm và hợp nhất | Akoma Ntoso XML đầy đủ (quá nặng cho biên tập), HTML thuần |
| ADR-06 *(sửa 06/9/2026)* | Số hóa: **agent đọc thẳng trang PDF qua công cụ MCP**; TypeScript (MuPDF + pdf-lib) lo cắt cụm trang, trích lớp văn bản, ghép cụm và kiểm chứng bằng luật | Bước khó nhất là hiểu bố cục chứ không phải nhận dạng ký tự; bỏ được cả nhánh Python (Docling/Marker/PaddleOCR) mà vẫn giữ nguyên bộ quy tắc và bộ kiểm chứng | Pipeline phân tầng OCR + LLM (bản đầu, phải nuôi hai ngôn ngữ và một nút GPU); chỉ dùng OCR cổ điển (mất bảng/công thức) |
| ADR-07 | Mô hình LLM mặc định: `claude-opus-5` cho bước khó (tái cấu trúc, trích quy tắc sửa đổi, kiểm chứng), `claude-sonnet-5` cho bước khối lượng lớn, `claude-haiku-4-5` cho phân loại; dùng **Batch API** (giảm 50%) và **prompt caching** cho pipeline offline | Cân bằng chi phí/chất lượng; pipeline offline không cần độ trễ thấp | Mô hình mã nguồn mở tự host (chất lượng tiếng Việt và bảng còn kém hơn cho tác vụ tái cấu trúc) |
| ADR-08 *(sửa 06/9/2026)* | Hàng đợi: **BullMQ trên Redis** cho đường ống nạp kho; bảng `jobs` trong Postgres cho việc lẻ; việc số hóa nằm ở bảng `sohoa_tasks` để agent nhận qua MCP | Nạp kho chạy nhiều ngày, cần giới hạn tốc độ theo nguồn, thử lại có lùi thời gian và theo dõi trực tiếp | pg-boss (thiếu rate-limit theo nguồn); giữ worker Python (không còn cần) |
| ADR-09 *(sửa 06/9/2026)* | Lưu trữ file: **Cloudflare R2** (giao thức S3, qua `Bun.S3Client`), tự lùi về thư mục cục bộ khi chưa cấu hình. **Markdown đã chốt lấy Postgres làm nguồn sự thật**, R2 giữ bản sao ở `derived/` | Bản gốc phải giữ vĩnh viễn và không truy vấn; còn Markdown thì được parse, diff, hợp nhất nên phải cùng giao dịch với cây nút (05 §7) | MinIO tự host (thêm việc vận hành); để Markdown ở kho đối tượng (lệch trạng thái với `tree`) |
| ADR-10 | Hợp nhất: lưu **sửa đổi dưới dạng thao tác (operation)** trên nút cấu trúc, sinh phiên bản theo thời điểm; VBHN chính thức của cơ quan nhà nước là bản ưu tiên, bản hệ thống sinh ghi rõ "hợp nhất tự động – tham khảo" | Pháp lệnh hợp nhất và NĐ 250/2026 quy định giá trị/kỹ thuật trình bày VBHN; bản tự sinh phải tách bạch | Chỉ hiển thị VBHN chính thức (chậm, thiếu) |

## 4. Nguyên tắc xuyên suốt

1. **Nguồn gốc rõ ràng (provenance)**: mỗi đoạn văn bản hiển thị đều truy ngược được tới file gốc, trang gốc, bước xử lý, phiên bản mô hình đã dùng.
2. **Không bịa**: câu trả lời RAG chỉ được kết luận khi có trích dẫn nút cấu trúc; nếu không đủ căn cứ, nói rõ.
3. **Thời điểm hiệu lực là trục chính**: mọi truy vấn có tham số "tại ngày"; mặc định là hôm nay.
4. **Con người kiểm duyệt ở điểm rủi ro**: quy tắc sửa đổi (amendment ops), thay đổi trạng thái hiệu lực, nội dung trường hợp ứng dụng và bài đào tạo đều qua hàng đợi duyệt.
5. **Mobile-first**: đọc văn bản dài trên điện thoại phải tốt (mục lục nổi, nhảy điều, chữ co giãn, offline cache).
6. **Mở rộng được**: mọi định danh ổn định (URN), export được sang Akoma Ntoso/JSON để liên thông.

## 5. Thuật ngữ

| Thuật ngữ | Nghĩa trong hệ thống |
|-----------|----------------------|
| VBQPPL | Văn bản quy phạm pháp luật |
| VBHN | Văn bản hợp nhất |
| Nút cấu trúc (node) | Phần / Chương / Mục / Tiểu mục / Điều / Khoản / Điểm / Đoạn / Bảng / Công thức / Hình |
| Phiên bản (version) | Trạng thái nội dung của một văn bản tại một thời điểm (bản gốc, sau mỗi lần sửa đổi, đính chính) |
| Thao tác sửa đổi (amend-op) | Lệnh "sửa/thay/bổ sung/bãi bỏ" một nút, trích từ văn bản sửa đổi |
| Trường hợp ứng dụng (use case) | Tình huống thực tế + câu hỏi pháp lý + căn cứ + trình tự + mẫu |
| Chuyên đề (course) | Lộ trình đào tạo gồm nhiều bài, bám sát trình tự pháp luật, có ví dụ mẫu |
| URN | Định danh bền vững, ví dụ `vn:vbqppl:nd:45/2026/NĐ-CP` |

## 6. Đối chiếu năng lực với đối thủ (chỉ góc kỹ thuật)

| Năng lực | Thư viện pháp luật / LuatVietnam | Mục tiêu quydinhphapluat.vn |
|----------|----------------------------------|-----------------------------|
| Toàn văn, thuộc tính, lược đồ, VB liên quan | Có | Có, thêm lược đồ ở **cấp điều/khoản** (khoản nào bị sửa bởi văn bản nào) |
| So sánh văn bản cũ/mới | Có (cấp văn bản) | So sánh **cấp nút**, diff theo thời điểm bất kỳ |
| VBHN | Đăng VBHN chính thức | VBHN chính thức + hợp nhất tự động theo thời điểm, có chú thích nguồn sửa đổi theo NĐ 250/2026 |
| Tra cứu | Từ khóa | Hybrid + hỏi đáp có trích dẫn + lọc theo thứ bậc/hiệu lực/thời điểm |
| Bảng, công thức trong văn bản scan | Thường mất hoặc thành ảnh | Giữ bảng dạng bảng, công thức LaTeX, hình có chú thích |
| Trường hợp ứng dụng | Bài viết hỏi đáp | Thư viện có cấu trúc, viện dẫn nút, cảnh báo khi căn cứ thay đổi |
| Đào tạo chuyên đề | Không có/tách rời | Lộ trình + ví dụ dự án cụ thể + bài tập |
| API / dữ liệu mở | Hạn chế | API công khai có phiên bản, export Akoma Ntoso/JSON |
