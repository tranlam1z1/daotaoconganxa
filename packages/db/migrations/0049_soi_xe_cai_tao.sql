-- 0049: Trò "Soi xe cải tạo" (docs/PLAN.md GĐ-T14, docs/GAME_DESIGN.md §5.14).
--
-- Danh mục biến thể cải tạo và xe đều là `game_content` (game_code = 'soi_xe_cai_tao', phân biệt bằng
-- `payload.kieu` = 'bien_the' | 'xe'), cùng vòng đời duyệt với nội dung trò chơi khác. Không bảng mới.
-- Trò tắt sẵn cho tới khi có nội dung đã duyệt.
--
-- Chỉ thêm, chạy lại được.

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('soi_xe_cai_tao', 'Soi xe cải tạo',
   'Khoanh chỗ xe khác giấy chứng nhận kiểm định, nối với dòng thông số, đo bằng thước khi cần, đóng dấu Đạt hoặc Không đạt. 5 màn.',
   true, false, 17, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
