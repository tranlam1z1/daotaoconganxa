-- 0045: Trò "Tái dựng hiện trường" (docs/PLAN.md GĐ-T10, docs/GAME_DESIGN.md §5.10).
--
-- Vụ va chạm là `game_content` (game_code = 'tai_dung_hien_truong'): payload là sơ đồ, xe, lời kể; answer là
-- dựng cảnh gốc và lỗi đúng; refs trỏ tới dòng mức phạt của lỗi đúng. Dấu vết không lưu: máy chủ chạy M5 từ
-- dựng cảnh gốc lúc tạo lượt. Không cần bảng mới. Màn chơi dùng bảng tiến độ màn của 0036. Trò tắt sẵn cho
-- tới khi có căn cứ về xử lý tai nạn do khách hàng cung cấp (câu D10) và ít nhất 4 vụ đã duyệt.
--
-- Chỉ thêm, chạy lại được. Số 0045 giữ chỗ cho T10 từ trước (docs/PLAN.md Phụ lục B).

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('tai_dung_hien_truong', 'Tái dựng hiện trường',
   'Đọc dấu vết trên sơ đồ hiện trường, dựng lại vị trí, hướng, tốc độ của các xe, mô phỏng kiểm chứng rồi kết luận lỗi. 5 màn.',
   true, false, 12, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
