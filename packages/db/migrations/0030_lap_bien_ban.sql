-- 0030: Trò "Lập biên bản" (docs/PLAN.md GĐ-G3, docs/GAME_DESIGN.md §5.3).
--
-- Chỉ đăng ký trò. Tình huống nằm trong game_content (game_code = 'lap_bien_ban'): payload là lời
-- kể, answer là danh sách mã violations; điều khoản, khung tiền, hình thức bổ sung lấy từ dòng
-- mức phạt được trỏ tới, không lưu lại.
--
-- Tắt cho tới khi có tình huống và mức phạt đã duyệt (docs/PLAN.md §0.5). Chỉ thêm, chạy lại được.

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('lap_bien_ban', 'Lập biên bản',
   '3 tình huống. Đọc lời kể, điền biểu mẫu 4 ô: hành vi, điều khoản, mức phạt, hình thức bổ sung. Chấm từng ô, không tính giờ.',
   true, false, 3, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
