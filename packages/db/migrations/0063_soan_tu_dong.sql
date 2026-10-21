-- 0063: Soạn tự động một chuyên đề từ văn bản (ke-hoach/09-c §4).
--
-- Một việc cha `soan_tu_dong` lập dàn ý từ văn bản, tạo các bài nháp, rồi giao cho mỗi bài các
-- việc con: soạn khối nội dung, sinh bài tập tự luận, sinh câu hỏi vào ngân hàng chung.
--
--  - `parent_id`: việc con trỏ về việc cha, để màn hình quản trị gom tiến độ theo lần soạn.
--  - `auto_apply`: việc con xong thì tự nhận kết quả (đã qua hậu kiểm) vào BẢN NHÁP của bài.
--    Bài vẫn chỉ tới người học khi pháp chế xuất bản; câu hỏi vẫn vào `cho_duyet`.
--
-- Chỉ thêm, chạy lại được.

ALTER TABLE authoring_jobs ADD COLUMN IF NOT EXISTS parent_id uuid
  REFERENCES authoring_jobs(id) ON DELETE CASCADE;
ALTER TABLE authoring_jobs ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS authoring_jobs_parent_idx
  ON authoring_jobs(parent_id) WHERE parent_id IS NOT NULL;
