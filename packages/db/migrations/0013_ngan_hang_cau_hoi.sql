-- Ngân hàng câu hỏi (docs/PLAN.md GĐ3).
--
-- Tách khỏi `activities` vì `activities.course_id` là NOT NULL và mang nghĩa "bài tập của một
-- bài học". Câu hỏi ngân hàng không thuộc bài học nào: nó được phân loại theo chủ đề, mức độ,
-- loại, và là nguồn chung cho luyện tập (GĐ4), thi (GĐ6) và game (GĐ10).
--
-- Chỉ câu ở trạng thái `da_duyet` được rút ra cho người học. Sửa câu đã duyệt thì câu quay về
-- `cho_duyet` và tăng `version`; lượt làm cũ giữ (question_id, version) nên không bị đổi đề.

/* ------------------------------------------------------------------ */
/* Chủ đề câu hỏi: cây gắn với lĩnh vực                                */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS question_topics (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id   uuid REFERENCES fields(id) ON DELETE SET NULL,
  parent_id  uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  -- Mã ổn định, dùng trong tệp Excel nhập câu hỏi.
  code       text UNIQUE NOT NULL,
  name       text NOT NULL,
  ordinal    int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_topics_parent_khac_chinh_no CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS question_topics_field_idx  ON question_topics(field_id, ordinal);
CREATE INDEX IF NOT EXISTS question_topics_parent_idx ON question_topics(parent_id);

/* ------------------------------------------------------------------ */
/* Câu hỏi                                                             */
/* ------------------------------------------------------------------ */

CREATE SEQUENCE IF NOT EXISTS questions_code_seq;

CREATE TABLE IF NOT EXISTS questions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          text UNIQUE NOT NULL DEFAULT ('CH-' || lpad(nextval('questions_code_seq')::text, 5, '0')),
  topic_id      uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  level         text NOT NULL DEFAULT 'trung_binh',
  kind          text NOT NULL,
  stem          text NOT NULL,
  -- Phương án theo loại câu: { phuong_an } hoặc { trai, phai } (ghép cặp). Không chứa đáp án.
  options       jsonb NOT NULL DEFAULT '{}',
  -- Đáp án theo loại câu: { dung } | { thu_tu } | { cap } | { o_trong }. KHÔNG BAO GIỜ gửi cho người học.
  answer        jsonb NOT NULL DEFAULT '{}',
  explanation   text,
  citations     text[] NOT NULL DEFAULT '{}',
  image_uri     text,
  status        text NOT NULL DEFAULT 'nhap',
  source        text NOT NULL DEFAULT 'nguoi',
  version       int  NOT NULL DEFAULT 1,
  created_by    text,
  updated_by    text,
  approved_by   text,
  approved_at   timestamptz,
  reject_reason text,
  -- Được phép đưa vào gói luyện tập offline (GĐ13).
  offline_ok    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER SEQUENCE questions_code_seq OWNED BY questions.code;

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_level_check;
ALTER TABLE questions ADD CONSTRAINT questions_level_check CHECK (level IN ('de', 'trung_binh', 'kho'));
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_kind_check;
ALTER TABLE questions ADD CONSTRAINT questions_kind_check CHECK (
  kind IN ('mot_dap_an', 'nhieu_dap_an', 'dung_sai', 'dien_khuyet', 'sap_xep', 'ghep_cap')
);
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE questions ADD CONSTRAINT questions_status_check CHECK (
  status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'luu_tru')
);
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_source_check;
ALTER TABLE questions ADD CONSTRAINT questions_source_check CHECK (source IN ('nguoi', 'ai', 'nhap_excel'));

CREATE INDEX IF NOT EXISTS questions_topic_level_status_idx ON questions(topic_id, level, status);
CREATE INDEX IF NOT EXISTS questions_status_idx ON questions(status, updated_at DESC);

/* ------------------------------------------------------------------ */
/* Lịch sử duyệt                                                       */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS question_reviews (
  id          bigserial PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version     int  NOT NULL,
  -- tao | sua | gui_duyet | duyet | tu_choi | luu_tru | nhap_excel
  action      text NOT NULL,
  actor       text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_reviews_question_idx ON question_reviews(question_id, created_at);
