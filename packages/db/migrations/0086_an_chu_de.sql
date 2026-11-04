-- Ẩn chủ đề thay cho xoá: chủ đề ẩn không hiện trong ô chọn và danh sách luyện tập,
-- nhưng câu hỏi, bài học, dữ liệu trò chơi gắn với nó vẫn giữ nguyên.
ALTER TABLE question_topics ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
