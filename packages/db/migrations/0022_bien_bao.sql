-- Biển báo đường bộ và game "Đoán biển báo" (docs/PLAN.md GĐ12).
--
-- Dữ liệu gốc ở data/bien-bao/bien-bao.json, ảnh ở data/bien-bao/anh/; nạp bằng
-- `bun run bien-bao:nap`. Ảnh lưu trong kho đối tượng (packages/storage) dưới tiền tố
-- assets/bien-bao/, cột image_uri giữ URI tương đối đó.
--
-- Như mức phạt (GĐ5): chỉ biển `da_duyet` hiện cho người học. Tên và ý nghĩa là nội dung pháp lý
-- theo QCVN 41:2024/BGTVT, phải được biên tập viên đối chiếu với văn bản trước khi duyệt.

CREATE TABLE IF NOT EXISTS traffic_signs (
  code         text PRIMARY KEY,
  group_name   text NOT NULL,
  name         text NOT NULL,
  meaning      text NOT NULL,
  -- Tên và mã viết thường, bỏ dấu, để tìm không dấu. Script nạp tự điền.
  search_text  text NOT NULL DEFAULT '',
  image_uri    text NOT NULL,
  citation_urn text NOT NULL,
  ordinal      int  NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'nhap',
  note         text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT traffic_signs_citation_urn CHECK (citation_urn LIKE 'vn:%')
);

ALTER TABLE traffic_signs DROP CONSTRAINT IF EXISTS traffic_signs_group_check;
ALTER TABLE traffic_signs ADD CONSTRAINT traffic_signs_group_check
  CHECK (group_name IN ('cam', 'nguy_hiem', 'hieu_lenh', 'chi_dan', 'phu'));
ALTER TABLE traffic_signs DROP CONSTRAINT IF EXISTS traffic_signs_status_check;
ALTER TABLE traffic_signs ADD CONSTRAINT traffic_signs_status_check CHECK (status IN ('nhap', 'da_duyet', 'ngung'));

CREATE INDEX IF NOT EXISTS traffic_signs_name_trgm_idx ON traffic_signs USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS traffic_signs_search_trgm_idx ON traffic_signs USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS traffic_signs_group_idx ON traffic_signs(group_name, status, ordinal);

/* ------------------------------------------------------------------ */
/* Game đoán biển báo dùng khung game của GĐ10                         */
/* ------------------------------------------------------------------ */

-- Giữ đủ các nguồn đã có (0014, 0020) và thêm game:doan_bien_bao.
ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_source_check;
ALTER TABLE practice_sessions ADD CONSTRAINT practice_sessions_source_check CHECK (
  source IN ('chu_de', 'cau_sai', 'thu_thach', 'game:vuot_man', 'game:dua_thoi_gian', 'game:ghep_cap',
             'game:doan_bien_bao')
);

ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS game_scores_game_code_check;
ALTER TABLE game_scores ADD CONSTRAINT game_scores_game_code_check
  CHECK (game_code IN ('dua_thoi_gian', 'ghep_cap', 'doan_bien_bao'));
