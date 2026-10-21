-- 0033: Mùa giải đơn vị (docs/PLAN.md GĐ-G6, docs/GAME_DESIGN.md §5.10).
--
-- - `seasons`: một mùa, mọi con số (số tuần, số hạng, cỡ nhóm, số lên/xuống, trần XP) nằm trong
--   `config`, đọc bởi packages/dao-tao/src/mua-giai.ts. Chỉ một mùa đang diễn ra tại một thời điểm.
-- - `season_standings`: một dòng cho mỗi (mùa, tuần, đơn vị).
--   * Tuần đang diễn ra chỉ có hạng và nhóm (điểm tính trực tiếp từ xp_ledger, không lưu).
--   * Khi chốt tuần (06:00 thứ Hai giờ Việt Nam) thì ghi điểm, thứ hạng, kết quả và `closed_at`,
--     đồng thời tạo dòng của tuần sau với hạng và nhóm mới. Chạy lại bước chốt không đổi gì.
-- - Huy hiệu `len_hang_mua_giai`: trao ở bước chốt tuần cho mọi thành viên có XP trong tuần đơn vị
--   lên hạng. Luật `chi_so` không có trong thống kê huy hiệu thường nên huyHieuDat() bỏ qua nó.
--
-- Chỉ thêm, chạy lại được.

CREATE TABLE IF NOT EXISTS seasons (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             text UNIQUE NOT NULL,
  name             text NOT NULL,
  starts_on        date NOT NULL,
  ends_on          date NOT NULL,
  -- Cấp đơn vị thi với nhau, so với units.level_label (ví dụ "Đội").
  unit_level_label text NOT NULL,
  config           jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'sap_dien_ra',
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasons_status_check CHECK (status IN ('sap_dien_ra', 'dang_dien_ra', 'ket_thuc')),
  CONSTRAINT seasons_bat_dau_thu_hai CHECK (EXTRACT(ISODOW FROM starts_on) = 1),
  CONSTRAINT seasons_khoang_ngay CHECK (ends_on > starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS seasons_mot_mua_dang_dien_ra ON seasons ((true)) WHERE status = 'dang_dien_ra';

CREATE TABLE IF NOT EXISTS season_standings (
  season_id      uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week_start     date NOT NULL,
  unit_id        uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tier           smallint NOT NULL,
  group_no       smallint NOT NULL,
  -- Các cột dưới chỉ có giá trị khi tuần đã chốt.
  -- Số thành viên có XP tính mùa giải trong tuần.
  members        int,
  -- Quân số: tài khoản đang hoạt động của đơn vị (gồm đơn vị con) lúc chốt.
  active_members int,
  xp_counted     int,
  score          numeric(10, 2),
  -- null: đơn vị không xếp hạng (quân số dưới mức tối thiểu) hoặc tuần chưa chốt.
  rank_in_group  int,
  outcome        text,
  closed_at      timestamptz,
  PRIMARY KEY (season_id, week_start, unit_id),
  CONSTRAINT season_standings_outcome_check CHECK (outcome IS NULL OR outcome IN ('len', 'giu', 'xuong')),
  CONSTRAINT season_standings_tuan_thu_hai CHECK (EXTRACT(ISODOW FROM week_start) = 1)
);
CREATE INDEX IF NOT EXISTS season_standings_nhom_idx ON season_standings(season_id, week_start, tier, group_no);
CREATE INDEX IF NOT EXISTS season_standings_don_vi_idx ON season_standings(unit_id, week_start DESC);

-- Tính XP tuần theo đơn vị lúc nhận và thời điểm ghi (mốc chốt).
CREATE INDEX IF NOT EXISTS xp_ledger_unit_day_created_idx ON xp_ledger(unit_id, day, created_at);

INSERT INTO badges (code, name, description, rule, ordinal) VALUES
  ('len_hang_mua_giai', 'Cùng đơn vị lên hạng',
   'Có XP trong tuần đơn vị lên hạng ở mùa giải đơn vị.',
   '{"chi_so": "len_hang_mua_giai", "nguong": 1}', 20)
ON CONFLICT (code) DO NOTHING;
