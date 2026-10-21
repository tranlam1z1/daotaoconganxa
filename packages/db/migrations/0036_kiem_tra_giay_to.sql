-- 0036: Trò "Kiểm tra giấy tờ" và màn chơi dùng chung (docs/PLAN.md GĐ-T1, docs/GAME_DESIGN.md §5.1, §2.4).
--
--  - `document_rules`: luật giấy tờ (phải mang giấy tờ nào, giấy tờ nào có hạn, trường nào phải khớp
--    với xe, hạng giấy phép nào dùng cho loại xe nào), cùng vòng đời duyệt với mức phạt. Dữ liệu gốc ở
--    data/tra-cuu/luat-giay-to.json, nạp bằng `bun run tra-cuu:nap` vào chờ duyệt.
--  - `game_runs.level`: màn của lượt (trò có màn); NULL với trò không có màn.
--  - `game_level_progress`: tiến độ màn theo người và trò (mô-đun M8). Qua màn khi đạt từ 1 sao.
--    (Tên `game_levels` đã dùng cho màn của trò Vượt màn, migration 0020.)
--  - Đăng ký trò `kiem_tra_giay_to`, tắt sẵn cho tới khi có hồ sơ và luật đã duyệt.
--
-- Chỉ thêm, chạy lại được. Số 0036 theo docs/PLAN.md Phụ lục B.

CREATE TABLE IF NOT EXISTS document_rules (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            text UNIQUE NOT NULL,
  -- phai_co | con_han | khop_xe | khop_nguoi | hang_gplx (packages/dao-tao/src/tro-choi/chung/giay-to.ts)
  check_kind      text NOT NULL,
  -- gplx | dang_ky | bao_hiem
  doc_kind        text,
  -- Loại xe áp dụng; rỗng là mọi loại.
  vehicle_classes text[] NOT NULL DEFAULT '{}',
  -- { truong } cho khop_xe, { hang: [...] } cho hang_gplx.
  params          jsonb NOT NULL DEFAULT '{}',
  name            text NOT NULL,
  explanation     text NOT NULL,
  citation_urn    text NOT NULL,
  -- Mã dòng mức phạt (violations.code) của lỗi; NULL khi chưa có mức phạt đã duyệt.
  violation_code  text,
  effective_from  date NOT NULL,
  effective_to    date,
  topic_id        uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'nhap',
  version         int  NOT NULL DEFAULT 1,
  approved_by     text,
  approved_at     timestamptz,
  reject_reason   text,
  note            text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_rules_check_kind CHECK (check_kind IN ('phai_co', 'con_han', 'khop_xe', 'khop_nguoi', 'hang_gplx')),
  CONSTRAINT document_rules_doc_kind CHECK (doc_kind IS NULL OR doc_kind IN ('gplx', 'dang_ky', 'bao_hiem')),
  CONSTRAINT document_rules_citation_urn CHECK (citation_urn LIKE 'vn:%'),
  CONSTRAINT document_rules_effective_range CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT document_rules_status_check CHECK (status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'ngung'))
);
CREATE INDEX IF NOT EXISTS document_rules_tra_idx ON document_rules(status, effective_from);

-- Lịch sử duyệt nhận thêm loại `document_rule`.
ALTER TABLE content_reviews DROP CONSTRAINT IF EXISTS content_reviews_kind_check;
ALTER TABLE content_reviews ADD CONSTRAINT content_reviews_kind_check
  CHECK (kind IN ('game_content', 'violation', 'traffic_sign', 'procedure', 'speed_limit', 'document_rule'));

-- Màn của lượt.
ALTER TABLE game_runs ADD COLUMN IF NOT EXISTS level smallint;
ALTER TABLE game_runs DROP CONSTRAINT IF EXISTS game_runs_level_check;
ALTER TABLE game_runs ADD CONSTRAINT game_runs_level_check CHECK (level IS NULL OR level BETWEEN 1 AND 50);

-- Tiến độ màn.
CREATE TABLE IF NOT EXISTS game_level_progress (
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game_code   text NOT NULL REFERENCES games(code),
  level       smallint NOT NULL,
  best_stars  smallint NOT NULL DEFAULT 0,
  best_score  numeric NOT NULL DEFAULT 0,
  plays       int NOT NULL DEFAULT 0,
  -- Lần đầu đạt từ 1 sao.
  cleared_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, game_code, level),
  CONSTRAINT game_level_progress_level_check CHECK (level BETWEEN 1 AND 50),
  CONSTRAINT game_level_progress_stars_check CHECK (best_stars BETWEEN 0 AND 3)
);

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('kiem_tra_giay_to', 'Kiểm tra giấy tờ',
   'Soi giấy phép lái xe, đăng ký xe, bảo hiểm của từng người lái; đóng dấu cho qua hoặc giữ lại. 5 màn, lỗi tinh vi dần.',
   true, false, 10, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
