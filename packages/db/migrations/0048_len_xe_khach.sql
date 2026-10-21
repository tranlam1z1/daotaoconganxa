-- 0048: Trò "Lên xe khách" (docs/PLAN.md GĐ-T13, docs/GAME_DESIGN.md §5.13).
--
-- Luật vận tải hành khách dùng lại `document_rules` (câu D16), nhóm `van_tai_khach`: số người so với số chỗ,
-- cách tính trẻ em, lệnh vận chuyển, phù hiệu, thời gian lái liên tục và trong ngày (ngưỡng ở cột `params`).
-- Với nhóm này, `doc_kind` là phần được kiểm (khoang xe, lệnh vận chuyển, phù hiệu, giám sát hành trình).
-- Kiểu kiểm nào đi với nhóm nào do bộ kiểm M1 (chung/giay-to.ts) kiểm khi nạp và khi sửa.
--
-- Xe là `game_content` (game_code = 'len_xe_khach'). Trò tắt sẵn cho tới khi có nội dung đã duyệt.
--
-- Chỉ thêm, chạy lại được. Mỗi CHECK liệt kê mọi giá trị đã có ở mọi migration đã viết (0036, 0046, 0048;
-- PLAN Phụ lục B).

ALTER TABLE document_rules DROP CONSTRAINT IF EXISTS document_rules_nhom_check;
ALTER TABLE document_rules ADD CONSTRAINT document_rules_nhom_check
  CHECK (nhom IN ('giay_to_nguoi_lai', 'ho_so_phat_nguoi', 'van_tai_khach'));

ALTER TABLE document_rules DROP CONSTRAINT IF EXISTS document_rules_check_kind;
ALTER TABLE document_rules ADD CONSTRAINT document_rules_check_kind
  CHECK (check_kind IN ('phai_co', 'con_han', 'khop_xe', 'khop_nguoi', 'hang_gplx',
                        'doc_duoc', 'thay_hanh_vi', 'khop_hanh_vi', 'trong_khung_gio',
                        'so_nguoi', 'tre_em', 'khop_lai_xe', 'dung_ngay', 'lai_lien_tuc', 'lai_trong_ngay'));

ALTER TABLE document_rules DROP CONSTRAINT IF EXISTS document_rules_doc_kind;
ALTER TABLE document_rules ADD CONSTRAINT document_rules_doc_kind
  CHECK (doc_kind IS NULL OR doc_kind IN ('gplx', 'dang_ky', 'bao_hiem',
                                          'thoi_diem', 'bien_so', 'anh', 'hanh_vi', 'thiet_bi',
                                          'khoang_xe', 'lenh_van_chuyen', 'phu_hieu', 'giam_sat_hanh_trinh'));

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('len_xe_khach', 'Lên xe khách',
   'Đếm người trên sơ đồ khoang xe, soi lệnh vận chuyển, phù hiệu, dữ liệu giám sát hành trình, đóng dấu và sắp lỗi vào biên bản. 5 màn.',
   true, false, 16, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
