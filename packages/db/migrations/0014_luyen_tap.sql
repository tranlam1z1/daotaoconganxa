-- Luyện tập theo chủ đề, câu sai, lịch sử (docs/PLAN.md GĐ4).
--
-- Mỗi phiên lưu ẢNH CHỤP từng câu vào `practice_sessions.items` (giống `exam_attempts.items`
-- của GĐ6): phần đề đã đảo phương án và nội dung đầy đủ kèm đáp án. Sửa câu trong ngân hàng
-- sau đó không đổi đề đang làm và không đổi kết quả đã chấm. Ảnh chụp chỉ đọc ở máy chủ; API
-- người học chỉ gửi phần đề.
--
-- Chấm trên máy chủ. Mỗi câu trả lời gửi lên ngay, nên mất mạng giữa chừng vẫn giữ được phần
-- đã làm. Một câu chỉ được trả lời một lần trong một phiên (UNIQUE session_id, question_id).

CREATE TABLE IF NOT EXISTS practice_sessions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  topic_id      uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  source        text NOT NULL DEFAULT 'chu_de',
  -- [{ question_id, version, topic_id, level, de, noi_dung }], theo thứ tự hiển thị.
  items         jsonb NOT NULL DEFAULT '[]',
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  correct       int,
  total         int NOT NULL DEFAULT 0,
  seconds_spent int,
  CONSTRAINT practice_sessions_source_check CHECK (source IN ('chu_de', 'cau_sai', 'thu_thach'))
);

CREATE INDEX IF NOT EXISTS practice_sessions_account_idx ON practice_sessions(account_id, started_at DESC);

CREATE TABLE IF NOT EXISTS practice_answers (
  id               bigserial PRIMARY KEY,
  session_id       uuid NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id      uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  question_version int  NOT NULL,
  response         jsonb NOT NULL DEFAULT '{}',
  correct          boolean NOT NULL,
  seconds          int,
  -- Mã do máy người học sinh ra, để đồng bộ offline không ghi trùng (GĐ13).
  client_id        text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_answers_mot_lan UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS practice_answers_question_idx ON practice_answers(question_id);

-- Danh sách "Câu sai của tôi". Câu rời danh sách khi làm đúng 2 lần liên tiếp (cleared_at có
-- giá trị); sai lại thì quay vào danh sách.
CREATE TABLE IF NOT EXISTS wrong_questions (
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  wrong_count    int  NOT NULL DEFAULT 0,
  correct_streak int  NOT NULL DEFAULT 0,
  last_wrong_at  timestamptz,
  cleared_at     timestamptz,
  PRIMARY KEY (account_id, question_id)
);

CREATE INDEX IF NOT EXISTS wrong_questions_con_idx ON wrong_questions(account_id) WHERE cleared_at IS NULL;
