-- 0027: Nền dùng chung cho trò chơi (docs/PLAN.md GĐ-G0, docs/GAME_DESIGN.md §2–§4).
--
--  - `games`: bảng đăng ký trò chơi. Thêm trò mới là thêm một dòng, không sửa CHECK nào.
--  - `game_content`: nội dung riêng của trò chơi ("tình huống"), cùng vòng đời duyệt với questions.
--    `refs` ghi mã và phiên bản của mục được trỏ tới lúc duyệt; mục đó đổi thì tình huống tự rút
--    khỏi trò chơi (packages/dao-tao/src/tham-chieu.ts).
--  - `content_reviews`: lịch sử duyệt của mọi loại nội dung trừ câu hỏi (câu hỏi giữ question_reviews).
--  - `game_runs` / `game_run_steps`: lượt chơi và từng bước, chấm trên máy chủ. `items` là ảnh chụp
--    các bước KÈM ĐÁP ÁN, chỉ máy chủ đọc.
--  - `game_packs`: gói offline đã cấp, để lượt đồng bộ chỉ dùng được nội dung đã cấp cho chính người đó.
--  - `topic_stats`: hồ sơ điểm mạnh, điểm yếu theo chủ đề.
--  - Mức phạt, biển báo, quy trình có thêm cột vòng đời duyệt để duyệt trong ứng dụng như câu hỏi.
--  - `xp_ledger.unit_id`: đơn vị lúc nhận XP, cho mùa giải đơn vị (GĐ-G6).
--
-- Chỉ thêm, chạy lại được.

/* ------------------------------------------------------------------ */
/* Đăng ký trò chơi                                                    */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS games (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  -- Có gói offline không (trò chơi được trên máy khi mất mạng).
  offline_ok  boolean NOT NULL DEFAULT false,
  -- Hiện cho người chơi không. Trò đủ mã mà chưa đủ nội dung đã duyệt thì để tắt.
  enabled     boolean NOT NULL DEFAULT false,
  ordinal     int NOT NULL DEFAULT 0,
  -- Ghi đè cấu hình mặc định trong mã (số bước, thời gian, XP cơ bản).
  config      jsonb NOT NULL DEFAULT '{}',
  -- luot_choi: bộ máy lượt chơi chung (game_runs). cu: trò GĐ10–GĐ14 chạy trên practice_sessions.
  engine      text NOT NULL DEFAULT 'luot_choi',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_code_check CHECK (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  CONSTRAINT games_engine_check CHECK (engine IN ('luot_choi', 'cu'))
);

-- Trò mẫu của khung, và 5 trò cũ để trang Trò chơi bật tắt được bằng dữ liệu.
-- Đua thời gian và ghép cặp ẩn khỏi trang Trò chơi theo PRD mục V.4 (route vẫn còn).
INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('thu_nghiem', 'Trắc nghiệm nhanh',
   '3 câu trắc nghiệm, mỗi câu 20 giây. Trò mẫu để kiểm tra khung trò chơi.', true, true, 1, 'luot_choi'),
  ('vuot_man', 'Vượt màn', 'Mỗi màn 10 câu, đúng từ 8 câu thì mở màn tiếp theo.', false, true, 50, 'cu'),
  ('doan_bien_bao', 'Đoán biển báo', 'Nhìn biển, chọn đúng tên trong 4 phương án.', false, true, 51, 'cu'),
  ('hoi_nhanh_giong_noi', 'Hỏi nhanh bằng giọng nói', 'Nghe câu hỏi, nói đáp án.', false, true, 52, 'cu'),
  ('dua_thoi_gian', 'Đua thời gian 60 giây', 'Trả lời đúng nhiều câu nhất trong 60 giây.', false, false, 53, 'cu'),
  ('ghep_cap', 'Ghép lỗi với mức phạt', 'Ghép 5 hành vi vi phạm với đúng mức tiền phạt.', false, false, 54, 'cu')
ON CONFLICT (code) DO NOTHING;

/* ------------------------------------------------------------------ */
/* Nội dung trò chơi                                                   */
/* ------------------------------------------------------------------ */

CREATE SEQUENCE IF NOT EXISTS game_content_code_seq;

CREATE TABLE IF NOT EXISTS game_content (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                text UNIQUE NOT NULL DEFAULT ('TC-' || lpad(nextval('game_content_code_seq')::text, 5, '0')),
  game_code           text NOT NULL REFERENCES games(code),
  topic_id            uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  level               text NOT NULL DEFAULT 'trung_binh',
  title               text NOT NULL,
  -- Phần người chơi được thấy; lược đồ theo từng trò, kiểm trong packages/dao-tao.
  payload             jsonb NOT NULL DEFAULT '{}',
  -- Đáp án. KHÔNG BAO GIỜ gửi cho người chơi trước khi bước được chấm.
  answer              jsonb NOT NULL DEFAULT '{}',
  explanation         text,
  citations           text[] NOT NULL DEFAULT '{}',
  -- [{ loai, ma, version }]: mục được trỏ tới, phiên bản ghi lúc duyệt.
  refs                jsonb NOT NULL DEFAULT '[]',
  asset_uris          text[] NOT NULL DEFAULT '{}',
  status              text NOT NULL DEFAULT 'nhap',
  source              text NOT NULL DEFAULT 'nguoi',
  version             int  NOT NULL DEFAULT 1,
  created_by          text,
  updated_by          text,
  approved_by         text,
  approved_at         timestamptz,
  reject_reason       text,
  -- Khác NULL khi một mục được trỏ tới đã đổi phiên bản hoặc rời trạng thái đã duyệt.
  needs_review_reason text,
  offline_ok          boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_content_level_check CHECK (level IN ('de', 'trung_binh', 'kho')),
  CONSTRAINT game_content_status_check CHECK (status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'luu_tru')),
  CONSTRAINT game_content_source_check CHECK (source IN ('nguoi', 'ai', 'nhap_excel')),
  CONSTRAINT game_content_refs_mang CHECK (jsonb_typeof(refs) = 'array')
);
ALTER SEQUENCE game_content_code_seq OWNED BY game_content.code;
CREATE INDEX IF NOT EXISTS game_content_loc_idx ON game_content(game_code, status, topic_id, level);
CREATE INDEX IF NOT EXISTS game_content_refs_idx ON game_content USING gin (refs jsonb_path_ops);

CREATE TABLE IF NOT EXISTS content_reviews (
  id         bigserial PRIMARY KEY,
  kind       text NOT NULL,
  ref        text NOT NULL,
  version    int  NOT NULL,
  -- tao | sua | gui_duyet | duyet | tu_choi | luu_tru | nap_du_lieu
  action     text NOT NULL,
  actor      text NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reviews_kind_check
    CHECK (kind IN ('game_content', 'violation', 'traffic_sign', 'procedure', 'speed_limit'))
);
CREATE INDEX IF NOT EXISTS content_reviews_ref_idx ON content_reviews(kind, ref, created_at);

/* ------------------------------------------------------------------ */
/* Gói offline, lượt chơi, bước                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS game_packs (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game_code  text NOT NULL REFERENCES games(code),
  -- Nội dung đã gửi, đúng thứ tự: máy chủ sinh lại lượt offline từ đây và seed của lượt.
  items      jsonb NOT NULL DEFAULT '[]',
  issued_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS game_packs_account_idx ON game_packs(account_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS game_runs (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_code      text NOT NULL REFERENCES games(code),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Đơn vị lúc chơi.
  unit_id        uuid REFERENCES units(id) ON DELETE SET NULL,
  seed           text NOT NULL,
  -- Ảnh chụp các bước kèm đáp án; chỉ máy chủ đọc.
  items          jsonb NOT NULL DEFAULT '[]',
  -- { "<thứ tự bước>": thời điểm đề của bước được gửi cho người chơi }.
  step_opened_at jsonb NOT NULL DEFAULT '{}',
  status         text NOT NULL DEFAULT 'dang_choi',
  started_at     timestamptz NOT NULL DEFAULT now(),
  deadline_at    timestamptz,
  finished_at    timestamptz,
  -- Thời điểm chơi thật: lượt offline mang giờ trên máy (không muộn hơn lúc đồng bộ).
  played_at      timestamptz NOT NULL DEFAULT now(),
  -- score = điểm cơ bản + thưởng nhanh; tỷ lệ và sao tính trên điểm cơ bản / max_score.
  score          numeric,
  bonus          numeric,
  max_score      numeric,
  stars          smallint,
  xp             int,
  offline        boolean NOT NULL DEFAULT false,
  client_id      uuid,
  pack_id        uuid REFERENCES game_packs(id) ON DELETE SET NULL,
  -- Trận đối đầu (GĐ-G10).
  match_id       uuid,
  CONSTRAINT game_runs_status_check CHECK (status IN ('dang_choi', 'xong', 'het_gio', 'bo_do')),
  CONSTRAINT game_runs_stars_check CHECK (stars IS NULL OR stars BETWEEN 0 AND 3)
);
CREATE INDEX IF NOT EXISTS game_runs_account_idx ON game_runs(account_id, game_code, started_at DESC);
CREATE INDEX IF NOT EXISTS game_runs_xong_idx ON game_runs(game_code, finished_at) WHERE status = 'xong';
CREATE UNIQUE INDEX IF NOT EXISTS game_runs_client_id_key ON game_runs(client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_run_steps (
  run_id      uuid NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
  ordinal     int  NOT NULL,
  ref_kind    text NOT NULL,
  ref_id      text,
  ref_version int,
  topic_id    uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  opened_at   timestamptz,
  answered_at timestamptz NOT NULL DEFAULT now(),
  elapsed_ms  int,
  response    jsonb NOT NULL DEFAULT '{}',
  correct     boolean,
  points      numeric NOT NULL DEFAULT 0,
  bonus       numeric NOT NULL DEFAULT 0,
  max_points  numeric NOT NULL DEFAULT 0,
  timed_out   boolean NOT NULL DEFAULT false,
  -- Mã do máy người chơi sinh, để đồng bộ offline không ghi trùng.
  client_id   uuid UNIQUE,
  PRIMARY KEY (run_id, ordinal),
  CONSTRAINT game_run_steps_ordinal_check CHECK (ordinal >= 1),
  CONSTRAINT game_run_steps_ref_kind_check CHECK (
    ref_kind IN ('question', 'game_content', 'violation', 'traffic_sign', 'speed_limit', 'procedure', 'sinh')
  )
);
CREATE INDEX IF NOT EXISTS game_run_steps_ref_idx ON game_run_steps(ref_kind, ref_id);

/* ------------------------------------------------------------------ */
/* Hồ sơ chủ đề                                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS topic_stats (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  topic_id   uuid NOT NULL REFERENCES question_topics(id) ON DELETE CASCADE,
  attempts   int  NOT NULL DEFAULT 0,
  correct    int  NOT NULL DEFAULT 0,
  -- Trung bình trượt của đúng (1) / sai (0), nghiêng về các lần gần đây.
  score_ema  numeric(6,5) NOT NULL DEFAULT 0,
  last_at    timestamptz,
  PRIMARY KEY (account_id, topic_id)
);

/* ------------------------------------------------------------------ */
/* Vòng đời duyệt cho dữ liệu tra cứu                                  */
/* ------------------------------------------------------------------ */

ALTER TABLE violations ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES question_topics(id) ON DELETE SET NULL;
ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_status_check;
ALTER TABLE violations ADD CONSTRAINT violations_status_check
  CHECK (status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'ngung'));

ALTER TABLE traffic_signs ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE traffic_signs ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE traffic_signs ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE traffic_signs ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE traffic_signs ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES question_topics(id) ON DELETE SET NULL;
ALTER TABLE traffic_signs DROP CONSTRAINT IF EXISTS traffic_signs_status_check;
ALTER TABLE traffic_signs ADD CONSTRAINT traffic_signs_status_check
  CHECK (status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'ngung'));

ALTER TABLE procedures ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES question_topics(id) ON DELETE SET NULL;
ALTER TABLE procedures DROP CONSTRAINT IF EXISTS procedures_status_check;
ALTER TABLE procedures ADD CONSTRAINT procedures_status_check
  CHECK (status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'ngung'));

-- Dòng đã duyệt qua tệp JSON trước đây giữ nguyên trạng thái, ghi người duyệt là bước nạp dữ liệu.
INSERT INTO content_reviews (kind, ref, version, action, actor, note, created_at)
SELECT 'violation', code, version, 'nap_du_lieu', 'nap-du-lieu', 'Đã duyệt qua tệp dữ liệu trước GĐ-G0.', updated_at
FROM violations WHERE status = 'da_duyet' AND approved_by IS NULL;
UPDATE violations SET approved_by = 'nap-du-lieu', approved_at = updated_at
WHERE status = 'da_duyet' AND approved_by IS NULL;

INSERT INTO content_reviews (kind, ref, version, action, actor, note, created_at)
SELECT 'traffic_sign', code, version, 'nap_du_lieu', 'nap-du-lieu', 'Đã duyệt qua tệp dữ liệu trước GĐ-G0.', updated_at
FROM traffic_signs WHERE status = 'da_duyet' AND approved_by IS NULL;
UPDATE traffic_signs SET approved_by = 'nap-du-lieu', approved_at = updated_at
WHERE status = 'da_duyet' AND approved_by IS NULL;

INSERT INTO content_reviews (kind, ref, version, action, actor, note, created_at)
SELECT 'procedure', code, version, 'nap_du_lieu', 'nap-du-lieu', 'Đã duyệt qua tệp dữ liệu trước GĐ-G0.', updated_at
FROM procedures WHERE status = 'da_duyet' AND approved_by IS NULL;
UPDATE procedures SET approved_by = 'nap-du-lieu', approved_at = updated_at
WHERE status = 'da_duyet' AND approved_by IS NULL;

/* ------------------------------------------------------------------ */
/* Đơn vị lúc nhận XP                                                  */
/* ------------------------------------------------------------------ */

ALTER TABLE xp_ledger ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id) ON DELETE SET NULL;
UPDATE xp_ledger x SET unit_id = a.unit_id
FROM accounts a WHERE a.id = x.account_id AND x.unit_id IS NULL AND a.unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS xp_ledger_unit_day_idx ON xp_ledger(unit_id, day);
