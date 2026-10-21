-- Phiên luyện tập không chấm từng câu nữa: người học chọn đáp án, đi tới đi lui giữa các câu, sửa
-- được tới khi nộp, rồi mới chấm cả phiên (giống bài thi).
--
-- `draft_answers` giữ câu trả lời chưa chấm theo số thứ tự câu trong phiên:
--   { "<stt>": { "tra_loi": {...}, "giay": <số giây cộng dồn> } }
-- Khi kết thúc phiên, mỗi câu trong đây được chấm và ghi vào `practice_answers` như trước. Đua thời
-- gian (game:dua_thoi_gian) vẫn chấm ngay từng câu, không dùng cột này.

ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS draft_answers jsonb NOT NULL DEFAULT '{}'::jsonb;
