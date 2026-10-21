-- 0024: Giọng nói và sách nói (docs/PLAN.md GĐ14).
--
-- lesson_audio: tệp âm thanh đọc sẵn của từng khối bài giảng, do worker `qdpl-sach-noi` dựng.
--   Tệp nằm trong kho đối tượng (R2) dưới tiền tố `audio/sach-noi/`; `text_hash` là băm của lời
--   đọc cùng giọng đọc, lời không đổi thì lần dựng sau không gọi lại Vbee.
-- audio_positions: vị trí nghe dở của mỗi người trong mỗi bài, để mở lại nghe tiếp.
--
-- Thêm nguồn phiên `game:hoi_nhanh_giong_noi` và mã điểm `hoi_nhanh_giong_noi`, giữ đủ các giá trị
-- đã có tới 0022. Chỉ thêm, chạy lại được.

CREATE TABLE IF NOT EXISTS lesson_audio (
  lesson_id  uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  block_id   uuid NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
  uri        text NOT NULL,
  seconds    numeric(8, 2) NOT NULL DEFAULT 0,
  text_hash  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, block_id)
);
CREATE INDEX IF NOT EXISTS lesson_audio_text_hash_idx ON lesson_audio(text_hash);

CREATE TABLE IF NOT EXISTS audio_positions (
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lesson_id      uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  block_id       uuid REFERENCES lesson_blocks(id) ON DELETE SET NULL,
  offset_seconds numeric(8, 2) NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, lesson_id)
);

ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_source_check;
ALTER TABLE practice_sessions ADD CONSTRAINT practice_sessions_source_check CHECK (
  source IN ('chu_de', 'cau_sai', 'thu_thach', 'game:vuot_man', 'game:dua_thoi_gian', 'game:ghep_cap',
             'game:doan_bien_bao', 'game:hoi_nhanh_giong_noi')
);

ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS game_scores_game_code_check;
ALTER TABLE game_scores ADD CONSTRAINT game_scores_game_code_check
  CHECK (game_code IN ('dua_thoi_gian', 'ghep_cap', 'doan_bien_bao', 'hoi_nhanh_giong_noi'));
