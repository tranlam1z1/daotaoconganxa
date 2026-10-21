-- 0038: Trò "Cắm biển cho tuyến đường" (docs/PLAN.md GĐ-T3, docs/GAME_DESIGN.md §5.3).
--
-- Đoạn đường của trò là `game_content` (game_code = 'cam_bien'): payload là bố cục theo lưới ô, answer
-- là biển đúng / chấp nhận được của từng vị trí, refs trỏ tới mọi biển trong khay. Không cần bảng mới.
-- Màn chơi dùng bảng tiến độ màn của 0036. Trò tắt sẵn cho tới khi có đoạn đường và biển đã duyệt.
--
-- Chỉ thêm, chạy lại được. Số 0038 theo docs/PLAN.md Phụ lục B.

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('cam_bien', 'Cắm biển cho tuyến đường',
   'Cắm biển báo vào đúng chỗ trên đoạn đường, rồi cho xe chạy thử xem xe phản ứng thế nào. 5 màn.',
   true, false, 11, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
