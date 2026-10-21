-- 0044: Trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9, docs/GAME_DESIGN.md §5.9).
--
-- Khu phố và bảng lỗi → mức phạt là `game_content` (game_code = 'tu_lai'), phân biệt bằng payload.kieu
-- ("ban_do" | "anh_xa_loi"); refs trỏ tới biển trên bản đồ và dòng mức phạt. Không cần bảng mới. Màn
-- chơi dùng bảng tiến độ màn của 0036. Trò tắt sẵn cho tới khi có khu phố đã duyệt.
--
-- Chỉ thêm, chạy lại được. Số 0044 theo docs/GAME_DESIGN.md §7.

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('tu_lai', 'Tự lái qua phố',
   'Lái xe qua khu phố từ điểm xuất phát tới đích. Game âm thầm ghi lỗi và lập biên bản cuối lượt. 3 màn.',
   true, false, 11, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
