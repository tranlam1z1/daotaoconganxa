-- Tra cứu nhanh: mức phạt theo hành vi, mức phạt theo tốc độ, quy trình xử lý (docs/PLAN.md GĐ5).
--
-- Dữ liệu gốc nằm ở data/tra-cuu/*.json, được biên tập và duyệt như nội dung khác, rồi nạp
-- bằng `bun run tra-cuu:nap`. Mỗi dòng mức phạt BẮT BUỘC có `citation_urn` trỏ tới điểm,
-- khoản hoặc điều trong kho; script nạp và scripts/check-citations.ts kiểm URN còn hiệu lực.
--
-- Có cột hiệu lực vì mức phạt đổi theo văn bản sửa đổi (NĐ 168/2024 đã được sửa bởi NĐ 238/2026):
-- tra theo ngày nào thì lấy đúng dòng áp dụng ngày đó.

/* ------------------------------------------------------------------ */
/* Mức phạt theo hành vi                                               */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS violations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Mã ổn định trong tệp dữ liệu, dùng làm khóa khi nạp lại.
  code            text UNIQUE NOT NULL,
  vehicle         text NOT NULL,
  group_name      text,
  behavior        text NOT NULL,
  keywords        text[] NOT NULL DEFAULT '{}',
  -- Hành vi + từ khóa, hạ chữ thường và bỏ dấu, để tìm không dấu. Script nạp tự điền.
  search_text     text NOT NULL DEFAULT '',
  fine_min        bigint NOT NULL,
  fine_max        bigint NOT NULL,
  -- Hình thức xử phạt bổ sung và biện pháp khắc phục: danh sách câu ngắn.
  extra_penalties jsonb NOT NULL DEFAULT '[]',
  point_deduction int,
  -- Khoảng tốc độ vượt quá (km/h). NULL cả hai là hành vi không theo tốc độ.
  -- speed_bounds theo cách viết của khoảng Postgres: '[)' gồm cận dưới, không gồm cận trên.
  speed_over_min  numeric,
  speed_over_max  numeric,
  speed_bounds    text NOT NULL DEFAULT '[)',
  citation_urn    text NOT NULL,
  effective_from  date NOT NULL,
  effective_to    date,
  status          text NOT NULL DEFAULT 'nhap',
  note            text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT violations_fine_range CHECK (fine_min >= 0 AND fine_min <= fine_max),
  CONSTRAINT violations_effective_range CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT violations_citation_urn CHECK (citation_urn LIKE 'vn:%')
);

ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_vehicle_check;
ALTER TABLE violations ADD CONSTRAINT violations_vehicle_check CHECK (vehicle IN ('o_to', 'mo_to'));
ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_status_check;
ALTER TABLE violations ADD CONSTRAINT violations_status_check CHECK (status IN ('nhap', 'da_duyet', 'ngung'));
ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_speed_bounds_check;
ALTER TABLE violations ADD CONSTRAINT violations_speed_bounds_check CHECK (speed_bounds IN ('[)', '[]', '(]', '()'));

CREATE INDEX IF NOT EXISTS violations_search_trgm_idx ON violations USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS violations_behavior_trgm_idx ON violations USING gin (behavior gin_trgm_ops);
CREATE INDEX IF NOT EXISTS violations_keywords_idx ON violations USING gin (keywords);
CREATE INDEX IF NOT EXISTS violations_vehicle_idx ON violations(vehicle, status, effective_from);

/* ------------------------------------------------------------------ */
/* Quy trình xử lý vi phạm và tai nạn                                  */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS procedures (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       text UNIQUE NOT NULL,
  kind       text NOT NULL,
  title      text NOT NULL,
  summary    text,
  -- [{ tieu_de, mo_ta, can_cu }], theo đúng thứ tự thực hiện. can_cu là URN điều khoản.
  steps      jsonb NOT NULL DEFAULT '[]',
  ordinal    int  NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'nhap',
  note       text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE procedures DROP CONSTRAINT IF EXISTS procedures_kind_check;
ALTER TABLE procedures ADD CONSTRAINT procedures_kind_check CHECK (kind IN ('vi_pham', 'tai_nan'));
ALTER TABLE procedures DROP CONSTRAINT IF EXISTS procedures_status_check;
ALTER TABLE procedures ADD CONSTRAINT procedures_status_check CHECK (status IN ('nhap', 'da_duyet', 'ngung'));
