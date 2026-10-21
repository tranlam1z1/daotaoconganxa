-- Thi sát hạch: đề thi theo ma trận, giao bài, lượt thi tính giờ (docs/PLAN.md GĐ6).
--
-- Bảng `assessments` (0006) KHÔNG dùng cho thi sát hạch: bảng đó gắn với chuyên đề và mức đánh
-- giá trong lộ trình học, để dành cho bài kiểm tra trong chuyên đề. Không xóa.
--
-- Nguyên tắc:
--  - Mỗi lượt thi sinh một đề riêng từ ma trận và lưu ẢNH CHỤP nội dung từng câu (kể cả đáp án)
--    vào `exam_attempts.items`. Sửa câu trong ngân hàng sau đó không làm đổi đề đang thi hay
--    kết quả đã chấm. Ảnh chụp chỉ đọc ở máy chủ; API người thi chỉ gửi phần đề.
--  - Đồng hồ do máy chủ quyết định: `deadline_at` ghi lúc bắt đầu, câu trả lời gửi sau
--    `deadline_at` + 30 giây bị từ chối, lượt quá hạn được tự nộp.

/* ------------------------------------------------------------------ */
/* Đề thi                                                              */
/* ------------------------------------------------------------------ */

CREATE SEQUENCE IF NOT EXISTS exams_code_seq;

CREATE TABLE IF NOT EXISTS exams (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              text UNIQUE NOT NULL DEFAULT ('DT-' || lpad(nextval('exams_code_seq')::text, 4, '0')),
  title             text NOT NULL,
  description       text,
  field_id          uuid REFERENCES fields(id) ON DELETE SET NULL,
  -- Ma trận: [{ "topic_id": uuid, "level": "de|trung_binh|kho", "so_cau": n }]. Tổng số câu
  -- của ma trận phải bằng question_count (kiểm ở tầng ứng dụng, packages/dao-tao/src/de-thi.ts).
  matrix            jsonb NOT NULL DEFAULT '[]',
  -- 30–40 câu theo PRD §III.1.2. Cần đề ngắn hơn thì nới bằng migration sau.
  question_count    int  NOT NULL,
  duration_minutes  int  NOT NULL,
  -- Thang 100 (docs/PLAN.md A6).
  pass_score        int  NOT NULL DEFAULT 70,
  shuffle_questions boolean NOT NULL DEFAULT true,
  shuffle_options   boolean NOT NULL DEFAULT true,
  max_attempts      int  NOT NULL DEFAULT 1,
  -- Khi nào người thi được xem lại đáp án: không bao giờ, ngay sau khi nộp, hay sau hạn làm bài.
  show_answers      text NOT NULL DEFAULT 'sau_nop',
  status            text NOT NULL DEFAULT 'nhap',
  created_by        text,
  updated_by        text,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exams_question_count_check CHECK (question_count BETWEEN 30 AND 40),
  CONSTRAINT exams_duration_check CHECK (duration_minutes BETWEEN 5 AND 240),
  CONSTRAINT exams_pass_score_check CHECK (pass_score BETWEEN 0 AND 100),
  CONSTRAINT exams_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 10),
  CONSTRAINT exams_show_answers_check CHECK (show_answers IN ('khong', 'sau_nop', 'sau_han')),
  CONSTRAINT exams_status_check CHECK (status IN ('nhap', 'xuat_ban', 'dong'))
);
ALTER SEQUENCE exams_code_seq OWNED BY exams.code;
CREATE INDEX IF NOT EXISTS exams_status_idx ON exams(status, updated_at DESC);

/* ------------------------------------------------------------------ */
/* Giao bài                                                            */
/* ------------------------------------------------------------------ */

-- Giao cho MỘT đơn vị (kèm hoặc không kèm đơn vị cấp dưới) HOẶC cho MỘT người.
-- Người thuộc đơn vị được giao tính theo cây đơn vị lúc truy vấn: chuyển người sang đơn vị khác
-- thì bài giao của đơn vị mới hiện ra, bài của đơn vị cũ mất đi (trừ lượt đã làm).
CREATE TABLE IF NOT EXISTS exam_assignments (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id             uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  unit_id             uuid REFERENCES units(id) ON DELETE CASCADE,
  account_id          uuid REFERENCES accounts(id) ON DELETE CASCADE,
  include_subunits    boolean NOT NULL DEFAULT true,
  opens_at            timestamptz NOT NULL DEFAULT now(),
  due_at              timestamptz NOT NULL,
  assigned_by         text NOT NULL,
  assigned_by_account uuid REFERENCES accounts(id) ON DELETE SET NULL,
  note                text,
  cancelled_at        timestamptz,
  cancelled_by        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_assignments_mot_dich CHECK ((unit_id IS NULL) <> (account_id IS NULL)),
  CONSTRAINT exam_assignments_han CHECK (due_at > opens_at)
);
CREATE INDEX IF NOT EXISTS exam_assignments_exam_idx ON exam_assignments(exam_id);
CREATE INDEX IF NOT EXISTS exam_assignments_unit_idx ON exam_assignments(unit_id) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS exam_assignments_account_idx ON exam_assignments(account_id) WHERE cancelled_at IS NULL;

/* ------------------------------------------------------------------ */
/* Lượt thi                                                            */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS exam_attempts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id       uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES exam_assignments(id) ON DELETE CASCADE,
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  attempt_no    int  NOT NULL,
  -- Ảnh chụp đề: [{ question_id, version, topic_id, level, de, noi_dung }]. `de` là phần gửi
  -- người thi (phương án đã đảo), `noi_dung` là nội dung đầy đủ kèm đáp án, chỉ dùng để chấm.
  items         jsonb NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  deadline_at   timestamptz NOT NULL,
  submitted_at  timestamptz,
  submit_kind   text,
  correct       int,
  total         int  NOT NULL,
  score         numeric(5,2),
  passed        boolean,
  status        text NOT NULL DEFAULT 'dang_lam',
  CONSTRAINT exam_attempts_status_check CHECK (status IN ('dang_lam', 'da_nop')),
  CONSTRAINT exam_attempts_submit_kind_check CHECK (submit_kind IS NULL OR submit_kind IN ('nguoi_thi', 'het_gio')),
  CONSTRAINT exam_attempts_lan_thu UNIQUE (assignment_id, account_id, attempt_no)
);
-- Mỗi người chỉ có một lượt đang làm cho một bài giao: bấm "Bắt đầu" hai lần cùng lúc không
-- sinh hai lượt.
CREATE UNIQUE INDEX IF NOT EXISTS exam_attempts_mot_luot_dang_lam
  ON exam_attempts(assignment_id, account_id) WHERE status = 'dang_lam';
-- Worker tự nộp chỉ quét lượt đang làm.
CREATE INDEX IF NOT EXISTS exam_attempts_dang_lam_han_idx ON exam_attempts(deadline_at) WHERE status = 'dang_lam';
CREATE INDEX IF NOT EXISTS exam_attempts_account_idx ON exam_attempts(account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS exam_attempts_exam_idx ON exam_attempts(exam_id, submitted_at);

CREATE TABLE IF NOT EXISTS exam_answers (
  attempt_id       uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  -- Thứ tự câu trong đề của lượt này, bắt đầu từ 1.
  ordinal          int  NOT NULL,
  question_id      uuid NOT NULL,
  question_version int  NOT NULL,
  response         jsonb NOT NULL DEFAULT '{}',
  -- Chấm khi nộp; NULL trong lúc đang làm.
  correct          boolean,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, ordinal)
);
