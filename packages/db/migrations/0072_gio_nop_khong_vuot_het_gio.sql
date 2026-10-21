-- 0072: Giờ nộp của lượt thi không vượt mốc hết giờ.
--
-- Lượt bỏ dở quá giờ trước đây được ghi giờ nộp là lúc hệ thống quét thấy (có khi nhiều giờ sau), nên
-- trang kết quả và báo cáo ghi thời gian làm dài hơn thời lượng của đề (ví dụ đề 45 phút ghi 1048 phút).
-- nopLuot() (packages/db/src/de-thi.ts) đã ghi giờ nộp không vượt deadline_at cho lượt nộp mới; migration
-- này sửa các lượt đã lưu theo cùng quy tắc. Điểm và câu trả lời không đổi.
--
-- Chạy lại được: lần sau không còn dòng nào khớp.

UPDATE exam_attempts SET submitted_at = deadline_at WHERE submitted_at > deadline_at;
