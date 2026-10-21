-- 0023: Luyện tập offline (docs/PLAN.md GĐ13).
--
-- Phiên luyện tập làm trên máy khi mất mạng được đồng bộ lên sau. Mỗi phiên và mỗi câu trả lời
-- mang `client_id` (UUID do máy sinh), để gửi lại nhiều lần không sinh bản trùng.
-- `practice_answers.client_id` đã có từ 0014 (UNIQUE, nên đã có index).
--
-- Chỉ thêm, chạy lại được.

ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS offline boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS practice_sessions_client_id_key
  ON practice_sessions(client_id) WHERE client_id IS NOT NULL;
