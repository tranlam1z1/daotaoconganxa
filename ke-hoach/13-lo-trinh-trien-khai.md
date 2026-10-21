# 13. Lộ trình triển khai

## Giai đoạn 0 — Chuẩn bị và PoC (tuần 1–6)
Mục tiêu: chứng minh được 3 điểm rủi ro nhất — OCR/AI giữ bảng-công thức-nối đoạn; hợp nhất tự động khớp VBHN; tìm kiếm tiếng Việt.
- Dựng monorepo, Docker Compose, schema Postgres v0, S3.
- Crawler cho Công báo + vbpl.vn (adapter tối thiểu), nạp 300 văn bản nhóm "hạ tầng pháp lý" và chuyên đề CNTT.
- Pipeline chuyển đổi tuyến A/C/D trên 1.000 trang; đo CER/TEDS; chốt prompt v1; đo chi phí thực.
- Parser cấu trúc + ops cho 10 văn bản sửa đổi; so với VBHN chính thức.
- PoC OpenSearch 2 phương án tách từ; hybrid + rerank trên 100 câu hỏi.
- Kết quả: báo cáo PoC, quyết định go/no-go và điều chỉnh kế hoạch chi phí.

## Giai đoạn 1 — MVP nội bộ (tuần 7–18)
- Console biên tập (duyệt OCR, ops), engine hợp nhất theo thời điểm, trạng thái hiệu lực cấp nút.
- Web đọc văn bản (mobile-first), tìm kiếm hybrid, trang thuộc tính/lược đồ/phiên bản/so sánh.
- Backfill: Hiến pháp, toàn bộ luật/pháp lệnh còn hiệu lực, nghị định/thông tư lĩnh vực đầu tư công, đấu thầu, ngân sách, CNTT, KH&CN; VBHN chính thức tương ứng.
- Bộ eval đầy đủ (12) và CI eval gate.
- `/ask` bản alpha (nội bộ).

## Giai đoạn 2 — Ra mắt công khai bản beta (tuần 19–30)
- Backfill toàn bộ VBQPPL TW còn hiệu lực + lịch sử từ 2005; cập nhật hằng ngày.
- `/ask` công khai có giới hạn; thư viện use case ≥ 100 (ưu tiên CNTT/đầu tư công); chuyên đề mẫu số 1 hoàn chỉnh (12 bài, ví dụ xuyên suốt, máy tính chi phí, bộ định tuyến thủ tục).
- API công khai v1, export Akoma Ntoso/JSON.
- Giám sát, sao lưu, bảo mật (11) đạt chuẩn; pentest.

## Giai đoạn 3 — Mở rộng (tuần 31+)
- Văn bản địa phương (Thanh Hóa trước), án lệ, TCVN/QCVN, dự thảo với cảnh báo sớm.
- Chuyên đề 2–4; use case theo cụm câu hỏi thực tế.
- Cá nhân hóa: theo dõi văn bản/điều, cảnh báo thay đổi; tổ chức nhiều người dùng.
- Tối ưu chi phí: tinh chỉnh định tuyến mô hình, cân nhắc fine-tune reranker/embedding trên dữ liệu nhấp chuột.

## Nhân sự (giai đoạn 0–2)
| Vai trò | Số lượng |
|---------|----------|
| Kỹ sư full-stack (RR7/Hono/Drizzle) | 1–2 |
| Kỹ sư dữ liệu/pipeline (crawler, ops, hợp nhất) | 1 |
| Kỹ sư đường ống số hóa (TypeScript, prompt, đánh giá chất lượng) | 1 |
| Trưởng nhóm pháp chế + biên tập viên | 1 + 2 |
| Chuyên gia chuyên đề CNTT/đầu tư công | 1 (bán thời gian) |
| DevOps (kiêm nhiệm) | 0,5 |

## Rủi ro chính và ứng phó
| Rủi ro | Ứng phó |
|--------|---------|
| vbpl.vn/Công báo đổi cấu trúc trang, chặn bot | Adapter tách biệt, contract test hằng ngày, tốc độ lịch sự, nhiều nguồn dự phòng, liên hệ Cục CNTT Bộ Tư pháp về kênh dữ liệu chính thức |
| Chi phí LLM vượt ngân sách | Định tuyến theo confidence, batch, cache; đo sau PoC; hạn mức ngày |
| Sai sót hợp nhất gây hiểu sai pháp luật | Nhãn "tham khảo", duyệt ops, đối chiếu VBHN chính thức, kênh báo sai, tuyên bố miễn trừ |
| Tách từ tiếng Việt/embedding chưa tốt cho thuật ngữ pháp lý | Eval sớm; từ điển đồng nghĩa; cân nhắc fine-tune bge-m3 trên cặp câu hỏi–điều |
| Thay đổi pháp luật nhanh (2025–2026 sáp nhập bộ, chính quyền 2 cấp, luật mới) | Bảng alias cơ quan có thời gian; trạng thái do pháp chế xác nhận; ưu tiên nạp văn bản nền |
| Phụ thuộc một nhà cung cấp LLM | Lớp `packages/llm` trừu tượng hóa; giữ prompt/eval để chuyển đổi khi cần |
