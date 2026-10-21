-- Theo dõi việc nạp kho: đợt nạp, từng mục, và KHUNG CẤU TRÚC kho văn bản.
--
-- Khung cấu trúc trả lời câu hỏi "kho ĐÁNG LẼ phải có những gì": nhờ đó việc nạp
-- kiểm chứng được là đầy đủ hay còn thiếu, thay vì chỉ biết "đã nạp được bao nhiêu".

-- Một đợt nạp (backfill wave hoặc lần cào định kỳ).
CREATE TABLE IF NOT EXISTS ingest_runs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ten           text NOT NULL,
  nguon         text NOT NULL,              -- congbao | vbpl | vanban-chinhphu | file
  pham_vi       jsonb NOT NULL DEFAULT '{}',-- điều kiện lọc: loại văn bản, khoảng thời gian...
  trang_thai    text NOT NULL DEFAULT 'dang_chay', -- dang_chay|hoan_thanh|that_bai|da_dung
  tong_du_kien  int,
  da_phat_hien  int NOT NULL DEFAULT 0,
  da_nap        int NOT NULL DEFAULT 0,
  that_bai      int NOT NULL DEFAULT 0,
  bo_qua        int NOT NULL DEFAULT 0,
  ghi_chu       text,
  bat_dau       timestamptz NOT NULL DEFAULT now(),
  ket_thuc      timestamptz
);
CREATE INDEX IF NOT EXISTS ingest_runs_state_idx ON ingest_runs(trang_thai, bat_dau DESC);

-- Từng văn bản trong một đợt nạp. Là sổ cái để đối soát: mỗi mục nguồn công bố
-- phải có đúng một dòng ở đây, và trạng thái cuối cùng phải rõ ràng.
CREATE TABLE IF NOT EXISTS ingest_items (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id        uuid NOT NULL REFERENCES ingest_runs(id) ON DELETE CASCADE,
  nguon         text NOT NULL,
  source_id     text NOT NULL,
  url           text,
  so_ky_hieu    text,
  document_urn  text,
  giai_doan     text NOT NULL DEFAULT 'phat_hien',
    -- phat_hien -> tai_ve -> chuyen_doi -> phan_tich -> trich_lenh -> hop_nhat -> quan_he -> chi_muc -> xong
  trang_thai    text NOT NULL DEFAULT 'cho',  -- cho|dang_chay|xong|loi|bo_qua
  so_lan_thu    int NOT NULL DEFAULT 0,
  loi           text,
  job_id        text,
  bat_dau       timestamptz,
  ket_thuc      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, nguon, source_id)
);
CREATE INDEX IF NOT EXISTS ingest_items_run_idx ON ingest_items(run_id, trang_thai);
CREATE INDEX IF NOT EXISTS ingest_items_stage_idx ON ingest_items(giai_doan, trang_thai);
CREATE INDEX IF NOT EXISTS ingest_items_urn_idx ON ingest_items(document_urn);

-- KHUNG CẤU TRÚC KHO: kho cần có gì, bao nhiêu, từ nguồn nào.
-- Mỗi dòng là một "ô" trong khung, ví dụ: nghị định của Chính phủ năm 2026 còn hiệu lực.
CREATE TABLE IF NOT EXISTS corpus_targets (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ma            text UNIQUE NOT NULL,
  nhom          text NOT NULL,              -- nhóm ưu tiên: ha_tang_phap_ly, hien_phap, luat, nghi_dinh...
  uu_tien       int NOT NULL DEFAULT 100,
  doc_type      text,
  co_quan       text,
  nam_tu        int,
  nam_den       int,
  chi_con_hieu_luc boolean NOT NULL DEFAULT true,
  nguon         text NOT NULL DEFAULT 'congbao',
  -- Số lượng kỳ vọng: điền khi biết (ví dụ đếm được từ danh mục của nguồn).
  so_luong_ky_vong int,
  ghi_chu       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS corpus_targets_group_idx ON corpus_targets(nhom, uu_tien);

-- Ảnh chụp tiến độ theo từng ô của khung, cập nhật sau mỗi lần đối soát.
CREATE TABLE IF NOT EXISTS corpus_coverage (
  target_ma     text PRIMARY KEY REFERENCES corpus_targets(ma) ON DELETE CASCADE,
  so_luong_co   int NOT NULL DEFAULT 0,
  so_luong_ky_vong int,
  ty_le         real,
  thieu_mau     jsonb NOT NULL DEFAULT '[]',  -- vài ví dụ số ký hiệu còn thiếu
  cap_nhat_luc  timestamptz NOT NULL DEFAULT now()
);
