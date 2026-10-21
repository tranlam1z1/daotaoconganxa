-- Mô-đun đào tạo trực quan (ke-hoach/09-a).
--
-- Bảng `courses` và `lessons` đã có từ 0001_init nhưng chỉ đủ cho bài học một khối Markdown.
-- Migration này mở rộng chúng và thêm phần còn thiếu: khối nội dung có kiểu, hoạt động có
-- cách chấm, ghi danh, tiến độ, mức thành thạo, lịch ôn giãn cách, sự kiện học và việc soạn
-- bài bằng AI.

/* ------------------------------------------------------------------ */
/* Mở rộng courses / lessons                                           */
/* ------------------------------------------------------------------ */

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS level            text NOT NULL DEFAULT 'co_ban',
  ADD COLUMN IF NOT EXISTS tags             text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duration_minutes int,
  ADD COLUMN IF NOT EXISTS hero_asset       text,
  -- Bản đồ pháp lý của chuyên đề: danh mục văn bản theo thứ bậc + trạng thái hiệu lực,
  -- do bước 1 của quy trình soạn bài sinh ra (09-a §5).
  ADD COLUMN IF NOT EXISTS legal_map        jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS citation_health  text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS default_mode     text NOT NULL DEFAULT 'day_du',
  ADD COLUMN IF NOT EXISTS published_at     timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- Trạng thái nội dung theo 09-a §5: nhap -> ai_soan -> bien_tap -> cho_phap_che
-- -> xuat_ban -> can_cap_nhat -> luu_tru.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE courses ADD CONSTRAINT courses_status_check CHECK (
  status IN ('nhap', 'ai_soan', 'bien_tap', 'cho_phap_che', 'xuat_ban', 'can_cap_nhat', 'luu_tru',
             'draft', 'published')
);
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_level_check;
ALTER TABLE courses ADD CONSTRAINT courses_level_check CHECK (level IN ('co_ban', 'nang_cao', 'chuyen_sau'));

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS as_of             date,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'nhap',
  ADD COLUMN IF NOT EXISTS estimated_minutes int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS skills            text[] NOT NULL DEFAULT '{}',
  -- nguoi | ai | ai_da_sua — để biết khối nào do mô hình dựng và đã có người chỉnh chưa.
  ADD COLUMN IF NOT EXISTS source            text NOT NULL DEFAULT 'nguoi',
  ADD COLUMN IF NOT EXISTS updated_by        text,
  ADD COLUMN IF NOT EXISTS published_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- Bài mới dựng từ khối (lesson_blocks) nên không còn phải nộp body_md.
ALTER TABLE lessons ALTER COLUMN body_md SET DEFAULT '';

CREATE INDEX IF NOT EXISTS lessons_course_ord_idx ON lessons(course_id, ordinal);

/* ------------------------------------------------------------------ */
/* Bản đồ năng lực                                                     */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS skills (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id     uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code          text NOT NULL,
  name          text NOT NULL,
  description   text,
  -- Mã kỹ năng tiên quyết trong cùng chuyên đề. Kiểm tra chu trình ở tầng ứng dụng.
  prerequisites text[] NOT NULL DEFAULT '{}',
  ordinal       int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, code)
);

/* ------------------------------------------------------------------ */
/* Khối nội dung bài học                                               */
/* ------------------------------------------------------------------ */

-- 19 kiểu khối ở 09-a §2. `kind` không ràng buộc CHECK trong CSDL: thư viện kiểu khối còn
-- mở rộng, và việc kiểm tra schema từng kiểu nằm ở packages/dao-tao (nơi biết cả hình dạng
-- của `data`), chứ không tách đôi ra hai nơi dễ lệch nhau.
CREATE TABLE IF NOT EXISTS lesson_blocks (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id  uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  ordinal    int  NOT NULL,
  kind       text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}',
  -- URN nút văn bản làm căn cứ cho khối này.
  citations  text[] NOT NULL DEFAULT '{}',
  citation_health text NOT NULL DEFAULT 'ok',
  -- nguoi | ai | ai_da_sua
  source     text NOT NULL DEFAULT 'nguoi',
  status     text NOT NULL DEFAULT 'nhap',
  -- Chế độ học mà khối này xuất hiện; rỗng = mọi chế độ (09-a §6.5).
  modes      text[] NOT NULL DEFAULT '{}',
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lesson_blocks_lesson_idx ON lesson_blocks(lesson_id, ordinal);
CREATE INDEX IF NOT EXISTS lesson_blocks_kind_idx   ON lesson_blocks(kind);

/* ------------------------------------------------------------------ */
/* Hoạt động (bài tập)                                                 */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS activities (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id   uuid REFERENCES lessons(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  ordinal     int  NOT NULL DEFAULT 0,
  -- 15 dạng bài ở 09-a §3.
  kind        text NOT NULL,
  -- may | ai | nguoi | tu_danh_gia
  mode        text NOT NULL DEFAULT 'may',
  title       text,
  -- Phần gửi ra cho người học: đề bài, phương án (không kèm đáp án).
  prompt      jsonb NOT NULL DEFAULT '{}',
  -- Đáp án và rubric KHÔNG BAO GIỜ ra API công khai; chấm chạy phía máy chủ.
  answer      jsonb NOT NULL DEFAULT '{}',
  rubric      jsonb NOT NULL DEFAULT '{}',
  -- Mã kỹ năng liên quan (khớp skills.code trong cùng chuyên đề).
  skills      text[] NOT NULL DEFAULT '{}',
  -- Mã lỗi khái niệm mà bài này bắt được (09-a §6.3).
  error_tags  text[] NOT NULL DEFAULT '{}',
  citations   text[] NOT NULL DEFAULT '{}',
  difficulty  numeric(3,2) NOT NULL DEFAULT 0.50,
  points      int  NOT NULL DEFAULT 1,
  -- Mức đánh giá: 0 hỏi nhanh, 1 sau bài, 2 sau cụm, 3 cuối chuyên đề.
  level       int  NOT NULL DEFAULT 1,
  source      text NOT NULL DEFAULT 'nguoi',
  status      text NOT NULL DEFAULT 'nhap',
  -- Câu đã gỡ khỏi đề nhưng giữ lại để đọc lịch sử làm bài.
  retired     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_lesson_idx ON activities(lesson_id, ordinal);
CREATE INDEX IF NOT EXISTS activities_course_idx ON activities(course_id, level) WHERE NOT retired;

-- Danh mục mã lỗi khái niệm dùng chung, để màn hình quản trị gợi ý thay vì gõ tự do.
CREATE TABLE IF NOT EXISTS error_tags (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  remedy      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

/* ------------------------------------------------------------------ */
/* Bài đánh giá                                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS assessments (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  level      int  NOT NULL,
  title      text NOT NULL,
  -- Bài mức 2 chấm sau một cụm bài; NULL = bài cuối chuyên đề.
  after_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  -- { so_cau, thoi_gian_phut, xao_cau, xao_phuong_an, rut_theo_ky_nang }
  config     jsonb NOT NULL DEFAULT '{}',
  pass_score int  NOT NULL DEFAULT 70,
  status     text NOT NULL DEFAULT 'nhap',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessments_course_idx ON assessments(course_id, level);

/* ------------------------------------------------------------------ */
/* Ghi danh và tiến độ                                                 */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS enrollments (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  -- day_du | nhanh | tra_cuu | on_thi (09-a §6.5)
  mode        text NOT NULL DEFAULT 'day_du',
  goal_minutes_per_week int NOT NULL DEFAULT 60,
  -- dang_hoc | tam_dung | hoan_thanh | bo_dở
  state       text NOT NULL DEFAULT 'dang_hoc',
  -- Người học chọn nhân vật đồng hành (09-b §3); NULL = để hệ thống định tuyến.
  -- Khóa ngoại đặt ở 0007 sau khi có bảng mascot_personas.
  mascot_id   uuid,
  -- day_du | it | yen_lang | tat
  mascot_level text NOT NULL DEFAULT 'day_du',
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_seen_at timestamptz,
  UNIQUE (account_id, course_id)
);
CREATE INDEX IF NOT EXISTS enrollments_course_idx ON enrollments(course_id, state);

CREATE TABLE IF NOT EXISTS lesson_progress (
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id     uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  -- chua_mo | dang_hoc | xong
  state         text NOT NULL DEFAULT 'dang_hoc',
  seconds_spent int  NOT NULL DEFAULT 0,
  last_block_ordinal int NOT NULL DEFAULT 0,
  score         numeric(5,2),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS attempts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  activity_id   uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
  attempt_no    int  NOT NULL DEFAULT 1,
  response      jsonb NOT NULL DEFAULT '{}',
  score         numeric(6,2) NOT NULL DEFAULT 0,
  max_score     numeric(6,2) NOT NULL DEFAULT 1,
  passed        boolean NOT NULL DEFAULT false,
  -- { tom_tat, tieu_chi: [...], can_cu: [...] }
  feedback      jsonb NOT NULL DEFAULT '{}',
  error_tags    text[] NOT NULL DEFAULT '{}',
  seconds_spent int  NOT NULL DEFAULT 0,
  -- may | ai | nguoi
  graded_by     text NOT NULL DEFAULT 'may',
  model         text,
  cost_usd      numeric(10,6) NOT NULL DEFAULT 0,
  -- Bài AI chấm được lấy mẫu cho người đối chiếu (09-a §4.3).
  review_state  text,
  reviewer      text,
  reviewed_at   timestamptz,
  reviewer_score numeric(6,2),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attempts_enrollment_idx ON attempts(enrollment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attempts_activity_idx   ON attempts(activity_id);
CREATE INDEX IF NOT EXISTS attempts_review_idx     ON attempts(review_state) WHERE review_state IS NOT NULL;

/* ------------------------------------------------------------------ */
/* Mức thành thạo và ôn tập giãn cách                                  */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS mastery (
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  skill_id      uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  -- P(biết) của mô hình BKT, 09-a §6.2.
  p_known       numeric(4,3) NOT NULL DEFAULT 0.100,
  attempts      int NOT NULL DEFAULT 0,
  correct       int NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, skill_id)
);

CREATE TABLE IF NOT EXISTS srs_cards (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  -- the_lat | activity
  ref_kind      text NOT NULL,
  ref_id        text NOT NULL,
  lesson_id     uuid REFERENCES lessons(id) ON DELETE CASCADE,
  due_on        date NOT NULL DEFAULT CURRENT_DATE,
  interval_days int  NOT NULL DEFAULT 0,
  ease          numeric(3,2) NOT NULL DEFAULT 2.50,
  reps          int  NOT NULL DEFAULT 0,
  lapses        int  NOT NULL DEFAULT 0,
  -- Tạm treo khi văn bản căn cứ của thẻ thay đổi (09-a §6.4). Không được ôn quy định đã đổi.
  suspended     boolean NOT NULL DEFAULT false,
  suspend_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, ref_kind, ref_id)
);
CREATE INDEX IF NOT EXISTS srs_due_idx ON srs_cards(enrollment_id, due_on) WHERE NOT suspended;

/* ------------------------------------------------------------------ */
/* Sự kiện học                                                         */
/* ------------------------------------------------------------------ */

-- Nguồn dữ liệu cho thống kê điểm rơi và cho bộ chọn hành động của mascot.
CREATE TABLE IF NOT EXISTS learning_events (
  id            bigserial PRIMARY KEY,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  lesson_id     uuid REFERENCES lessons(id) ON DELETE CASCADE,
  block_id      uuid REFERENCES lesson_blocks(id) ON DELETE SET NULL,
  activity_id   uuid REFERENCES activities(id) ON DELETE SET NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_events_enrollment_idx ON learning_events(enrollment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_events_kind_idx ON learning_events(kind, created_at DESC);

/* ------------------------------------------------------------------ */
/* Soạn bài bằng AI                                                    */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS authoring_jobs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   uuid REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id   uuid REFERENCES lessons(id) ON DELETE CASCADE,
  -- ban_do_phap_ly | dan_y | soan_bai | sinh_bai_tap | sinh_rubric | kiem_can_cu | soat_loi
  step        text NOT NULL,
  -- cho | dang_chay | xong | loi | huy
  state       text NOT NULL DEFAULT 'cho',
  input       jsonb NOT NULL DEFAULT '{}',
  output      jsonb NOT NULL DEFAULT '{}',
  -- Đã nhận kết quả vào bản nháp chưa (09-c §4.3).
  applied_at  timestamptz,
  applied_by  text,
  model       text,
  prompt_version text,
  tokens_in   int NOT NULL DEFAULT 0,
  tokens_out  int NOT NULL DEFAULT 0,
  cost_usd    numeric(10,6) NOT NULL DEFAULT 0,
  budget_usd  numeric(10,6),
  batch       boolean NOT NULL DEFAULT true,
  error       text,
  requested_by text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS authoring_jobs_state_idx ON authoring_jobs(state, created_at DESC);
CREATE INDEX IF NOT EXISTS authoring_jobs_course_idx ON authoring_jobs(course_id, created_at DESC);

/* ------------------------------------------------------------------ */
/* Chứng nhận                                                          */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS certificates (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  code          text UNIQUE NOT NULL,
  score         numeric(5,2) NOT NULL,
  -- Khung pháp lý mà chứng nhận này gắn vào; đổi văn bản thì mời học bù, không âm thầm để cũ.
  as_of         date NOT NULL,
  legal_basis   jsonb NOT NULL DEFAULT '[]',
  issued_at     timestamptz NOT NULL DEFAULT now(),
  issued_by     text,
  revoked_at    timestamptz,
  revoked_by    text,
  revoke_reason text
);
CREATE INDEX IF NOT EXISTS certificates_enrollment_idx ON certificates(enrollment_id);
