-- 0021: Gắn bài học với chủ đề ngân hàng câu hỏi (docs/PLAN.md GĐ11).
--
-- Cuối mỗi bài giảng có 3–5 câu kiểm tra nhanh, rút từ ngân hàng theo chủ đề của bài. Bài chưa
-- gắn chủ đề thì không có phần kiểm tra cuối bài; việc gắn do seed ngân hàng câu hỏi
-- (packages/db/src/seed-ngan-hang.ts) làm theo chuyên đề của bài.
--
-- Chỉ thêm, chạy lại được.

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS topic_id uuid
  REFERENCES question_topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lessons_topic_idx ON lessons(topic_id) WHERE topic_id IS NOT NULL;
