-- Trò chơi: vượt màn, đua thời gian, ghép cặp lỗi – mức phạt (docs/PLAN.md GĐ10).
--
-- Khung game dùng lại phiên luyện tập (`practice_sessions`) với `source = 'game:<mã>'`:
--  - game:vuot_man, game:dua_thoi_gian: items là ảnh chụp câu hỏi như luyện tập, câu trả lời
--    ghi vào practice_answers và chấm trên máy chủ.
--  - game:ghep_cap: items là ảnh chụp 5 dòng mức phạt (violations); cả ván nộp một lần qua API
--    trò chơi, không đi qua practice_answers.
-- Nhờ vậy game hưởng sẵn chấm trên máy chủ, ảnh chụp đề và danh sách câu sai của GĐ4.

ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_source_check;
ALTER TABLE practice_sessions ADD CONSTRAINT practice_sessions_source_check CHECK (
  source IN ('chu_de', 'cau_sai', 'thu_thach', 'game:vuot_man', 'game:dua_thoi_gian', 'game:ghep_cap')
);

/* ------------------------------------------------------------------ */
/* Vượt màn                                                            */
/* ------------------------------------------------------------------ */

-- Màn của từng chủ đề, sinh theo số câu đã duyệt (packages/dao-tao/src/tro-choi/vuot-man.ts).
CREATE TABLE IF NOT EXISTS game_levels (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id       uuid NOT NULL REFERENCES question_topics(id) ON DELETE CASCADE,
  ordinal        int  NOT NULL,
  question_count int  NOT NULL DEFAULT 10,
  pass_ratio     numeric(3,2) NOT NULL DEFAULT 0.80,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_levels_topic_ordinal_key UNIQUE (topic_id, ordinal),
  CONSTRAINT game_levels_ordinal_check CHECK (ordinal >= 1),
  CONSTRAINT game_levels_pass_ratio_check CHECK (pass_ratio > 0 AND pass_ratio <= 1)
);

-- Kết quả tốt nhất của mỗi người ở mỗi màn. completed_at có giá trị khi đã đạt ngưỡng qua màn.
CREATE TABLE IF NOT EXISTS game_progress (
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  level_id     uuid NOT NULL REFERENCES game_levels(id) ON DELETE CASCADE,
  best_ratio   numeric(4,3) NOT NULL DEFAULT 0,
  stars        int  NOT NULL DEFAULT 0,
  completed_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, level_id),
  CONSTRAINT game_progress_stars_check CHECK (stars BETWEEN 0 AND 3)
);

-- Phiên vượt màn gắn với màn đang chơi.
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS game_level_id uuid REFERENCES game_levels(id) ON DELETE SET NULL;

/* ------------------------------------------------------------------ */
/* Điểm từng ván (kỷ lục đua thời gian, ghép cặp)                      */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS game_scores (
  id         bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game_code  text NOT NULL,
  -- Phiên sinh ra điểm này; UNIQUE để một ván chỉ ghi điểm một lần.
  session_id uuid UNIQUE REFERENCES practice_sessions(id) ON DELETE CASCADE,
  score      int  NOT NULL,
  played_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_scores_game_code_check CHECK (game_code IN ('dua_thoi_gian', 'ghep_cap'))
);

CREATE INDEX IF NOT EXISTS game_scores_account_idx ON game_scores(account_id, game_code, score DESC);
