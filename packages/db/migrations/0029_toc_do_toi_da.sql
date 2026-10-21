-- 0029: Tốc độ tối đa theo loại xe và loại đường, và trò "Súng bắn tốc độ" (docs/PLAN.md GĐ-G2).
--
-- Dữ liệu gốc ở data/tra-cuu/toc-do-toi-da.json, nạp bằng `bun run tra-cuu:nap` vào chờ duyệt.
-- Dòng chưa có số liệu (chưa có văn bản gốc trong kho) không được nạp. Khi chưa có dòng nào đã
-- duyệt, trò chơi dùng số trên biển P.127 của từng tình huống.
--
-- Khung mức phạt theo tốc độ đã có ở violations.speed_over_min/max (GĐ5), không tạo bảng thứ hai.
-- Chỉ thêm, chạy lại được. Số 0028 để dành cho GĐ-G1 (docs/PLAN.md Phụ lục B).

CREATE TABLE IF NOT EXISTS speed_limits (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              text UNIQUE NOT NULL,
  -- Loại xe chi tiết theo văn bản quy định tốc độ.
  vehicle_class     text NOT NULL,
  -- Nhóm xe để khớp với bảng mức phạt.
  violation_vehicle text NOT NULL,
  road_type         text NOT NULL,
  road_type_name    text NOT NULL,
  -- Tên hiển thị trong màn hình duyệt: "loại xe — loại đường".
  name              text NOT NULL,
  max_speed         int  NOT NULL,
  citation_urn      text NOT NULL,
  effective_from    date NOT NULL,
  effective_to      date,
  topic_id          uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'nhap',
  version           int  NOT NULL DEFAULT 1,
  approved_by       text,
  approved_at       timestamptz,
  reject_reason     text,
  note              text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT speed_limits_vehicle_check CHECK (violation_vehicle IN ('o_to', 'mo_to')),
  CONSTRAINT speed_limits_max_speed_check CHECK (max_speed > 0 AND max_speed <= 200),
  CONSTRAINT speed_limits_citation_urn CHECK (citation_urn LIKE 'vn:%'),
  CONSTRAINT speed_limits_effective_range CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT speed_limits_status_check CHECK (status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'ngung')),
  CONSTRAINT speed_limits_loai_key UNIQUE (vehicle_class, road_type, effective_from)
);
CREATE INDEX IF NOT EXISTS speed_limits_tra_idx ON speed_limits(violation_vehicle, road_type, status, effective_from);

-- Trò "Súng bắn tốc độ": tắt cho tới khi có tình huống và mức phạt đã duyệt (docs/PLAN.md §0.5).
INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('sung_ban_toc_do', 'Súng bắn tốc độ',
   '10 xe đi qua chốt kèm biển hạn chế và tốc độ đo được. Xác định có bị phạt không, khung phạt nào, có trừ điểm không.',
   true, false, 2, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
