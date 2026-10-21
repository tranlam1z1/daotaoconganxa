-- 0040: Trò "Soi camera" (docs/PLAN.md GĐ-T5, docs/GAME_DESIGN.md §5.5).
--
-- Kịch bản camera là `game_content` (game_code = 'soi_camera'): payload là kịch bản xe (dữ liệu, dựng
-- hoạt cảnh bằng bộ mô phỏng M5), answer là danh sách vi phạm kèm mã mức phạt, refs trỏ tới các dòng
-- `violations` đó. Không cần bảng mới. Trò tắt sẵn cho tới khi có kịch bản đã duyệt.
--
-- Chỉ thêm, chạy lại được. Số 0040 theo docs/PLAN.md Phụ lục B.

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('soi_camera', 'Soi camera',
   'Xem camera giao thông, dừng hình đúng lúc, khoanh xe vi phạm và gắn đúng lỗi. 5 màn.',
   true, false, 13, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
