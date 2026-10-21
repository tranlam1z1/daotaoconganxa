-- 0046: Trò "Duyệt hồ sơ phạt nguội" (docs/PLAN.md GĐ-T11, docs/GAME_DESIGN.md §5.11).
--
-- Luật kiểm hồ sơ phạt nguội dùng lại `document_rules` (câu D16): thêm cột `nhom` để tách luật giấy tờ
-- người lái (trò 1, 4) với luật hồ sơ phạt nguội, và nới CHECK `check_kind`, `doc_kind` cho các kiểu
-- kiểm mới. Với nhóm `ho_so_phat_nguoi`, `doc_kind` là phần hồ sơ được kiểm (thời điểm, biển số, ảnh,
-- hành vi đề xuất, thiết bị). Kiểu kiểm nào đi với nhóm nào do bộ kiểm M1 (chung/giay-to.ts) kiểm khi
-- nạp và khi sửa.
--
-- Hồ sơ là `game_content` (game_code = 'duyet_phat_nguoi'). Trò tắt sẵn cho tới khi có nội dung đã duyệt.
--
-- Chỉ thêm, chạy lại được. Mỗi CHECK liệt kê mọi giá trị đã có ở mọi migration đã viết (PLAN Phụ lục B).

ALTER TABLE document_rules ADD COLUMN IF NOT EXISTS nhom text NOT NULL DEFAULT 'giay_to_nguoi_lai';
ALTER TABLE document_rules DROP CONSTRAINT IF EXISTS document_rules_nhom_check;
ALTER TABLE document_rules ADD CONSTRAINT document_rules_nhom_check
  CHECK (nhom IN ('giay_to_nguoi_lai', 'ho_so_phat_nguoi'));

ALTER TABLE document_rules DROP CONSTRAINT IF EXISTS document_rules_check_kind;
ALTER TABLE document_rules ADD CONSTRAINT document_rules_check_kind
  CHECK (check_kind IN ('phai_co', 'con_han', 'khop_xe', 'khop_nguoi', 'hang_gplx',
                        'doc_duoc', 'thay_hanh_vi', 'khop_hanh_vi', 'trong_khung_gio'));

ALTER TABLE document_rules DROP CONSTRAINT IF EXISTS document_rules_doc_kind;
ALTER TABLE document_rules ADD CONSTRAINT document_rules_doc_kind
  CHECK (doc_kind IS NULL OR doc_kind IN ('gplx', 'dang_ky', 'bao_hiem',
                                          'thoi_diem', 'bien_so', 'anh', 'hanh_vi', 'thiet_bi'));

CREATE INDEX IF NOT EXISTS document_rules_nhom_idx ON document_rules(nhom, status, effective_from);

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('duyet_phat_nguoi', 'Duyệt hồ sơ phạt nguội',
   'Thẩm định hồ sơ vi phạm do camera ghi lại: đủ căn cứ thì gửi thông báo, thiếu thì trả lại và chỉ đúng chỗ thiếu. 5 màn.',
   true, false, 14, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
