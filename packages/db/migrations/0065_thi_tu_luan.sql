-- Thi kết hợp trắc nghiệm + tự luận, sinh đề từ văn bản.
--
--  - Ngân hàng có thêm loại câu `tu_luan`: không có phương án/đáp án máy, chấm theo `rubric`
--    (cùng hình dạng rubric của bài tập trong bài học, packages/dao-tao/src/types.ts). Đáp án gợi ý
--    nằm ở `explanation`. Luyện tập, trò chơi, gói offline chỉ rút câu chấm máy.
--  - Ma trận đề có thêm dạng câu và điểm mỗi câu (jsonb, không cần đổi cột); đề từ 1 tới 60 câu.
--  - Lượt thi có trạng thái `cho_cham`: đã nộp, còn câu tự luận chưa có điểm (AI đang chấm hoặc
--    AI không chấm được và chờ giảng viên). Báo cáo (v_ket_qua_thi) chỉ tính lượt `da_nop`.
--  - Từng câu trả lời lưu điểm, điểm tối đa, nhận xét và trạng thái chấm, để chấm tự luận ngoài
--    giao dịch nộp bài và để giảng viên chấm tay / phúc khảo.
--
-- Chỉ thêm và nới ràng buộc, chạy lại được.

/* ------------------------------------------------------------------ */
/* Câu tự luận                                                         */
/* ------------------------------------------------------------------ */

ALTER TABLE questions ADD COLUMN IF NOT EXISTS rubric jsonb NOT NULL DEFAULT '{}';

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_kind_check;
ALTER TABLE questions ADD CONSTRAINT questions_kind_check CHECK (
  kind IN ('mot_dap_an', 'nhieu_dap_an', 'dung_sai', 'dien_khuyet', 'sap_xep', 'ghep_cap', 'tu_luan')
);

-- Câu tự luận cần mô hình hoặc người chấm: không bao giờ vào gói luyện tập offline.
UPDATE questions SET offline_ok = false WHERE kind = 'tu_luan' AND offline_ok;

/* ------------------------------------------------------------------ */
/* Đề thi                                                              */
/* ------------------------------------------------------------------ */

ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_question_count_check;
ALTER TABLE exams ADD CONSTRAINT exams_question_count_check CHECK (question_count BETWEEN 1 AND 60);

-- Việc AI sinh câu hỏi tạo ra cùng đề (sinh đề từ văn bản), để màn hình đề theo dõi tiến độ.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS authoring_job_ids uuid[] NOT NULL DEFAULT '{}';

/* ------------------------------------------------------------------ */
/* Lượt thi và câu trả lời                                             */
/* ------------------------------------------------------------------ */

ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check;
ALTER TABLE exam_attempts ADD CONSTRAINT exam_attempts_status_check
  CHECK (status IN ('dang_lam', 'cho_cham', 'da_nop'));

ALTER TABLE exam_answers
  ADD COLUMN IF NOT EXISTS points        numeric(6,2),
  ADD COLUMN IF NOT EXISTS max_points    numeric(6,2),
  ADD COLUMN IF NOT EXISTS feedback      jsonb,
  ADD COLUMN IF NOT EXISTS graded_by     text,
  -- xong: đã có điểm | cho_ai: chờ mô hình chấm | dang_ai: một tiến trình đã nhận chấm (lúc
  -- ai_claimed_at; quá 5 phút thì tiến trình khác nhận lại) | cho_nguoi: chờ giảng viên.
  ADD COLUMN IF NOT EXISTS grading_state text NOT NULL DEFAULT 'xong',
  ADD COLUMN IF NOT EXISTS ai_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS model         text,
  ADD COLUMN IF NOT EXISTS cost_usd      numeric(10,5),
  ADD COLUMN IF NOT EXISTS reviewer      text,
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz;

ALTER TABLE exam_answers DROP CONSTRAINT IF EXISTS exam_answers_graded_by_check;
ALTER TABLE exam_answers ADD CONSTRAINT exam_answers_graded_by_check
  CHECK (graded_by IS NULL OR graded_by IN ('may', 'ai', 'nguoi'));
ALTER TABLE exam_answers DROP CONSTRAINT IF EXISTS exam_answers_grading_state_check;
ALTER TABLE exam_answers ADD CONSTRAINT exam_answers_grading_state_check
  CHECK (grading_state IN ('xong', 'cho_ai', 'dang_ai', 'cho_nguoi'));

-- Worker và hàng chấm tay chỉ quét câu chưa xong.
CREATE INDEX IF NOT EXISTS exam_answers_cho_cham_idx
  ON exam_answers(grading_state, updated_at) WHERE grading_state <> 'xong';
