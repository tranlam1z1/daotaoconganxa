# Đánh giá lại dự án — 29/10/2026

Kết luận: nền tảng chức năng và cấu trúc kiểm thử tương đối đầy đủ; chưa đủ điều kiện xác nhận sẵn sàng triển khai rộng do kiểm thử và lint chưa đạt, cùng lỗi phân biệt người gọi ở giới hạn API.

## Kết quả thực chạy
- bun run typecheck: đạt toàn bộ workspace.
- bun run build: đạt cả client và SSR.
- bun test: 1450 đạt, 7 bỏ qua, 22 lỗi; 1479 ca trên 122 tệp, 129,32 giây.
- bun run lint: thất bại, 75 lỗi; các chẩn đoán đã xem chủ yếu là định dạng.
- Chạy riêng bài giảng: 4 đạt, 12 lỗi. Lỗi tái hiện độc lập với toàn bộ bộ kiểm thử.

## Phát hiện ưu tiên
1. [P1] Giới hạn API gộp người dùng vào khóa unknown. apps/api/src/routes/traffic.ts:13–18 lấy requestIP từ c.env nhưng apps/api/src/index.ts:20 chỉ gắn app.fetch, không truyền đối tượng Bun server qua env. Cấu hình triển khai trong kho không đặt TRAFFIC_TRUST_PROXY. Với cấu hình này mọi request /api/v1 dùng chung 120 lượt/phút (traffic-contract.ts:57). Cần tích hợp nguồn IP tin cậy và kiểm thử hai người dùng có hạn mức độc lập; cấu hình proxy phải chống giả mạo header. Đây là kết luận từ mã nguồn và cấu hình trong kho, chưa kiểm tra biến môi trường máy chủ thật.
2. [P2] Kiểm thử đào tạo chưa đồng bộ điều kiện nhóm học tập. API dao-tao.ts:449 từ chối chuyên đề không có nhóm; fixture bai-giang.test.ts tạo courses không gán nhom_hoc_tap, mặc định mảng rỗng. Liên quan kiểm tra cuối bài, tiến độ, tự luận và xuất bản AI. Cần cập nhật dữ liệu thử, bổ sung kiểm tra chuyên đề chưa phân nhóm bị chặn theo đúng chủ đích. Không coi 22 lỗi là 22 lỗi chức năng độc lập.
3. [P2] Ca tìm kiếm vector không tìm thấy hit có matchedBy=vector (packages/search/src/search.test.ts:105). Chưa xác định nguyên nhân từ cấu hình embedding, dữ liệu hay thuật toán; cần chạy riêng và kiểm tra chỉ mục trước khi kết luận tính năng hỏng.
4. [P2] Các cổng CI hiện chưa đạt: 75 lỗi lint và test thiếu hướng dẫn cho routes/dich-vu-cong.tsx (scripts/huong-dan/bao-ve.test.ts:112). Workflow CI có chạy cả lint và test, nên cần khắc phục trước khi xác nhận kiểm tra đạt.

## Điểm tích cực
Có tách ứng dụng web/API/worker/MCP và thư viện dùng chung; bộ kiểm thử bao quát phân quyền, phạm vi đơn vị, trích dẫn, quy trình duyệt, thi và báo cáo. Các ca đã xem về phạm vi báo cáo và hỏi đáp có kiểm chứng căn cứ đều đạt trong môi trường test. Bản dựng SSR và kiểm tra kiểu đều đạt.

## Thứ tự xử lý
Sửa cách định danh người gọi trong rate limiter; đồng bộ fixture đào tạo và xác minh tìm kiếm vector; làm sạch lint và bổ sung hướng dẫn; chạy lại kiểm thử và tiếp tục kiểm tra các hành trình bằng trình duyệt trước khi triển khai rộng.

## Giới hạn
Đây là đánh giá mã nguồn và kiểm tra tự động tại workspace, chưa kiểm thử giao diện trực tiếp, tải đồng thời, máy chủ production hoặc tính chính xác/cập nhật của toàn bộ dữ liệu pháp luật. Không thay đổi mã nghiệp vụ. RTK.md được tham chiếu trong chỉ dẫn nhưng không có tại gốc dự án; tìm danh sách tệp cũng chưa thấy tệp này.

Nhật ký: outputs/reassessment-typecheck.log, outputs/reassessment-build.log, outputs/reassessment-tests.log, outputs/reassessment-lint.log, outputs/reassessment-lesson-isolated.log.
