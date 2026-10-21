-- 0017: Báo cáo kết quả thi và luyện tập (docs/PLAN.md GĐ7).
--
-- Chưa dùng materialized view: báo cáo đọc thẳng bảng gốc qua view dưới đây và các index hỗ
-- trợ. Chỉ chuyển sang materialized view khi đo thấy chậm.
--
-- Chỉ thêm, chạy lại được. Tệp được đánh số 0017 dù viết sau 0018: migrate.ts ghi nhận từng
-- tệp theo tên, nên CSDL đã có 0018 vẫn áp dụng 0017 bình thường.

/* ------------------------------------------------------------------ */
/* Kết quả thi: mỗi người mỗi đề một dòng                              */
/* ------------------------------------------------------------------ */

-- Lượt được tính là lượt ĐÃ NỘP có điểm cao nhất; bằng điểm thì lấy lượt nộp sớm hơn.
-- `so_lan` là số lượt đã nộp của người đó với đề đó. Đơn vị là đơn vị HIỆN TẠI của tài khoản,
-- để lọc theo cây đơn vị (phạm vi của cán bộ quản lý) ngay trong truy vấn.
-- KHÔNG đưa `exam_attempts.items` ra đây: cột đó là ảnh chụp đề kèm đáp án.
CREATE OR REPLACE VIEW v_ket_qua_thi AS
SELECT DISTINCT ON (t.exam_id, t.account_id)
  t.exam_id,
  t.account_id,
  t.id                AS attempt_id,
  t.assignment_id,
  t.score,
  t.passed,
  t.correct,
  t.total,
  t.started_at,
  t.submitted_at,
  t.submit_kind,
  GREATEST(0, EXTRACT(EPOCH FROM (t.submitted_at - t.started_at)))::int AS giay_lam,
  count(*) OVER (PARTITION BY t.exam_id, t.account_id)::int           AS so_lan,
  acc.unit_id,
  u.path              AS unit_path,
  u.name              AS unit_name,
  COALESCE(acc.name, acc.username, acc.email) AS ho_ten,
  acc.username,
  acc.rank_title
FROM exam_attempts t
JOIN accounts acc ON acc.id = t.account_id
LEFT JOIN units u ON u.id = acc.unit_id
WHERE t.status = 'da_nop'
ORDER BY t.exam_id, t.account_id, t.score DESC NULLS LAST, t.submitted_at ASC;

/* ------------------------------------------------------------------ */
/* Index                                                               */
/* ------------------------------------------------------------------ */

-- Lọc lượt đã nộp của một đề theo khoảng ngày; `exam_attempts_exam_idx (exam_id, submitted_at)`
-- đã có từ 0016. Index một phần này phục vụ DISTINCT ON của view (lượt tốt nhất mỗi người).
CREATE INDEX IF NOT EXISTS exam_attempts_da_nop_idx
  ON exam_attempts(exam_id, account_id, score DESC, submitted_at)
  WHERE status = 'da_nop';

-- Báo cáo luyện tập lọc phiên đã kết thúc theo người và khoảng ngày.
CREATE INDEX IF NOT EXISTS practice_sessions_account_finished_idx
  ON practice_sessions(account_id, finished_at)
  WHERE finished_at IS NOT NULL;

-- Thống kê câu hỏi khó gom câu trả lời thi theo câu hỏi.
CREATE INDEX IF NOT EXISTS exam_answers_question_idx ON exam_answers(question_id);
