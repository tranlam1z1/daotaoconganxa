-- 0057: AI của nhóm học cùng (docs/PLAN.md GĐ16d, docs/PROMPT_NHOM_HOC_CUNG.md mục 2.2, 2.7).
--
-- Mỗi lần gọi mô hình THẬT ghi một dòng (kể cả khi hậu kiểm loại hoặc hết giờ), để đếm hạn mức
-- và chi phí. Lần trả từ bộ nhớ đệm (cùng input_hash, đã đạt) không ghi thêm và không tính hạn
-- mức (đề xuất Đ17).
--
-- Chỉ thêm, chạy lại được.

CREATE TABLE IF NOT EXISTS study_group_ai_notes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  requested_by  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  -- Phạm vi của quản lý lúc tóm tắt (AI-2); NULL với gợi ý thứ tự (AI-1) và với quản trị.
  scope_path    ltree,
  -- Băm dữ liệu đầu vào đã ẩn danh cùng tên và phiên bản prompt.
  input_hash    text NOT NULL,
  status        text NOT NULL,
  -- Kết quả đã qua hậu kiểm, còn ở dạng mã (TVn, Mn); máy chủ thay tên lúc trả về.
  content       jsonb,
  reject_reason text,
  model         text,
  tokens_in     int,
  tokens_out    int,
  cost_usd      numeric(10, 6),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_group_ai_notes_kind_check CHECK (kind IN ('thu_tu_hoc', 'tom_tat_tien_do')),
  CONSTRAINT study_group_ai_notes_status_check CHECK (status IN ('dat', 'bi_loai'))
);

-- Một kết quả đạt cho mỗi (nhóm, loại, phạm vi, dữ liệu vào). COALESCE vì hai scope_path NULL
-- không trùng nhau với UNIQUE thường (đề xuất Đ7). Kết quả bị loại không vào khóa này, để lần sau
-- gọi lại được và vẫn giữ lịch sử lý do loại.
CREATE UNIQUE INDEX IF NOT EXISTS study_group_ai_notes_mot_ket_qua
  ON study_group_ai_notes (group_id, kind, (COALESCE(scope_path::text, '')), input_hash)
  WHERE status = 'dat';
-- Đếm hạn mức trong ngày: AI-1 theo nhóm, AI-2 theo người yêu cầu.
CREATE INDEX IF NOT EXISTS study_group_ai_notes_nhom_idx ON study_group_ai_notes (group_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS study_group_ai_notes_nguoi_idx ON study_group_ai_notes (requested_by, kind, created_at DESC);
