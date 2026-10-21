-- Lĩnh vực đào tạo và cấu trúc hình cây của chuyên đề (ke-hoach/09 §1).
--
-- Trước migration này, `courses` là một danh sách phẳng. Thực tế biên soạn cần ba quan hệ mà
-- danh sách phẳng không diễn đạt được:
--
--  1. **Lĩnh vực** — nhóm chuyên đề phục vụ một mảng pháp luật và một tập nhóm đối tượng
--     (đầu tư công; pháp luật giao thông đường bộ…). Người học chọn lĩnh vực trước, chọn
--     chuyên đề sau.
--  2. **Nối tiếp** (`follows_id`) — chuyên đề B tiếp tục công việc của chuyên đề A trên cùng
--     một hồ sơ: lập dự án rồi mới tới thực hiện dự án.
--  3. **Cụ thể hoá** (`parent_id`) — chuyên đề con thu hẹp phạm vi của chuyên đề cha cho một
--     loại hình cụ thể: dự án đầu tư công nghệ thông tin nằm trong dự án đầu tư nói chung.
--
-- Hai quan hệ 2 và 3 khác nhau và không thay thế nhau, nên giữ thành hai cột.

CREATE TABLE IF NOT EXISTS fields (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  summary     text,
  -- Nhóm đối tượng chính của lĩnh vực, viết cho người đọc (ví dụ "cảnh sát giao thông đường bộ").
  audience_note text,
  ordinal     int  NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'nhap',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fields DROP CONSTRAINT IF EXISTS fields_status_check;
ALTER TABLE fields ADD CONSTRAINT fields_status_check CHECK (
  status IN ('nhap', 'ai_soan', 'bien_tap', 'cho_phap_che', 'xuat_ban', 'can_cap_nhat', 'luu_tru')
);

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS field_id       uuid REFERENCES fields(id) ON DELETE SET NULL,
  -- Chuyên đề cha: chuyên đề này cụ thể hoá phạm vi của chuyên đề cha.
  ADD COLUMN IF NOT EXISTS parent_id      uuid REFERENCES courses(id) ON DELETE SET NULL,
  -- Chuyên đề liền trước trong một chuỗi nối tiếp.
  ADD COLUMN IF NOT EXISTS follows_id     uuid REFERENCES courses(id) ON DELETE SET NULL,
  -- khach_hang: người trực tiếp áp dụng quy định.
  -- tu_van:     người tư vấn và đào tạo lại cho nhóm trên.
  ADD COLUMN IF NOT EXISTS audience_group text NOT NULL DEFAULT 'khach_hang',
  ADD COLUMN IF NOT EXISTS ordinal        int  NOT NULL DEFAULT 0;

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_audience_group_check;
ALTER TABLE courses ADD CONSTRAINT courses_audience_group_check
  CHECK (audience_group IN ('khach_hang', 'tu_van'));

-- Chặn tự tham chiếu ngay ở CSDL. Chu trình nhiều cấp kiểm ở tầng ứng dụng, nơi đọc được cả cây.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_parent_khac_chinh_no;
ALTER TABLE courses ADD CONSTRAINT courses_parent_khac_chinh_no CHECK (parent_id IS NULL OR parent_id <> id);
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_follows_khac_chinh_no;
ALTER TABLE courses ADD CONSTRAINT courses_follows_khac_chinh_no CHECK (follows_id IS NULL OR follows_id <> id);

CREATE INDEX IF NOT EXISTS courses_field_idx  ON courses(field_id, ordinal);
CREATE INDEX IF NOT EXISTS courses_parent_idx ON courses(parent_id);
