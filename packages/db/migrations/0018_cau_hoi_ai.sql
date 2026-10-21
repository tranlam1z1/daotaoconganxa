-- 0018: AI sinh câu hỏi vào ngân hàng (docs/PLAN.md GĐ8).
--
-- Câu do AI sinh vẫn là một dòng `questions` bình thường với `source = 'ai'`, ở trạng thái
-- `cho_duyet`: không có đường nào đưa câu AI vào luyện tập, thi hay game khi chưa có người duyệt.
-- Hai cột mới chỉ để truy vết và để người duyệt thấy câu nào có thể trùng.
--
-- Chỉ thêm, chạy lại được.

-- Việc sinh (authoring_jobs) đã tạo ra câu này. Xóa việc thì giữ câu, chỉ mất liên kết.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS authoring_job_id uuid
  REFERENCES authoring_jobs(id) ON DELETE SET NULL;

-- Câu đã có trong ngân hàng mà câu này gần giống (so trigram trên `stem`, hậu kiểm tất định).
-- Chỉ là cờ cho người duyệt; không chặn việc duyệt.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS duplicate_of uuid
  REFERENCES questions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS questions_authoring_job_idx
  ON questions(authoring_job_id) WHERE authoring_job_id IS NOT NULL;

-- Tìm câu gần giống bằng pg_trgm (extension đã bật ở 0001).
CREATE INDEX IF NOT EXISTS questions_stem_trgm_idx
  ON questions USING gin (lower(stem) gin_trgm_ops);
