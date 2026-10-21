-- 0047: Trò "Trạm cân tải trọng" (docs/PLAN.md GĐ-T12, docs/GAME_DESIGN.md §5.12).
--
-- Ngưỡng tải trọng là dữ liệu nghiệp vụ có duyệt (câu D17): bảng mới `load_limits`, cùng vòng đời duyệt
-- với `speed_limits`. Mỗi dòng là một con số duyệt được: tổng trọng lượng theo loại xe, giới hạn trục
-- đơn, giới hạn cụm trục theo số trục và khoảng cách trục.
--
-- Khung phần trăm quá tải nằm ở `violations` (như khung tốc độ `speed_over_min/max`): `qua_tai_loai`
-- (theo giấy chứng nhận kiểm định, hay theo tải trọng cầu đường), `qua_tai_tu`, `qua_tai_den` (%),
-- `qua_tai_bien` (cách viết cận như khoảng Postgres; mặc định '(]': "trên a% đến b%").
--
-- Chỉ thêm, chạy lại được. Mỗi CHECK liệt kê mọi giá trị đã có ở mọi migration đã viết (PLAN Phụ lục B).

CREATE TABLE IF NOT EXISTS load_limits (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            text UNIQUE NOT NULL,
  -- tong: tổng trọng lượng theo loại xe; truc_don: trục đơn; cum_truc: cụm trục.
  kind            text NOT NULL,
  -- Loại xe (xe_tai_2_truc, xe_tai_3_truc, xe_tai_4_truc, dau_keo_so_mi); NULL là mọi loại (trục, cụm trục).
  vehicle_class   text,
  -- Cụm trục: số trục trong cụm và khoảng cách trục [từ, đến) theo cm; `spacing_to_cm` NULL là không cận trên.
  group_axles     smallint,
  spacing_from_cm int,
  spacing_to_cm   int,
  limit_kg        int  NOT NULL,
  name            text NOT NULL,
  citation_urn    text NOT NULL,
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
  CONSTRAINT load_limits_kind_check CHECK (kind IN ('tong', 'truc_don', 'cum_truc')),
  CONSTRAINT load_limits_vehicle_check CHECK (
    vehicle_class IS NULL OR vehicle_class IN ('xe_tai_2_truc', 'xe_tai_3_truc', 'xe_tai_4_truc', 'dau_keo_so_mi')),
  CONSTRAINT load_limits_tong_check CHECK (kind <> 'tong' OR vehicle_class IS NOT NULL),
  CONSTRAINT load_limits_cum_check CHECK (
    kind <> 'cum_truc' OR (group_axles IN (2, 3) AND spacing_from_cm IS NOT NULL AND spacing_from_cm >= 0
      AND (spacing_to_cm IS NULL OR spacing_to_cm > spacing_from_cm))),
  CONSTRAINT load_limits_limit_check CHECK (limit_kg > 0 AND limit_kg <= 200000),
  CONSTRAINT load_limits_citation_urn CHECK (citation_urn LIKE 'vn:%'),
  CONSTRAINT load_limits_effective_range CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT load_limits_status_check CHECK (status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'ngung'))
);
CREATE INDEX IF NOT EXISTS load_limits_tra_idx ON load_limits(status, effective_from);

-- Khung phần trăm quá tải của dòng mức phạt.
ALTER TABLE violations ADD COLUMN IF NOT EXISTS qua_tai_loai text;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS qua_tai_tu numeric;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS qua_tai_den numeric;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS qua_tai_bien text NOT NULL DEFAULT '(]';
ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_qua_tai_check;
ALTER TABLE violations ADD CONSTRAINT violations_qua_tai_check CHECK (
  qua_tai_bien IN ('[)', '[]', '(]', '()')
  AND (qua_tai_loai IS NULL OR qua_tai_loai IN ('kiem_dinh', 'cau_duong'))
  AND ((qua_tai_loai IS NULL AND qua_tai_tu IS NULL) OR (qua_tai_loai IS NOT NULL AND qua_tai_tu >= 0))
  AND (qua_tai_den IS NULL OR qua_tai_den > qua_tai_tu));

-- Lịch sử duyệt nhận thêm loại `load_limit`.
ALTER TABLE content_reviews DROP CONSTRAINT IF EXISTS content_reviews_kind_check;
ALTER TABLE content_reviews ADD CONSTRAINT content_reviews_kind_check
  CHECK (kind IN ('game_content', 'violation', 'traffic_sign', 'procedure', 'speed_limit', 'document_rule',
                  'load_limit'));

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('tram_can', 'Trạm cân tải trọng',
   'Xe tải vào trạm cân: ghim cặp số làm căn cứ, ước phần trăm vượt, đóng dấu Cho đi, Hạ tải hoặc Lập biên bản. 5 màn.',
   true, false, 15, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
