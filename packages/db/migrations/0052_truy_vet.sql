-- 0052: Trò "Truy vết xe bỏ trốn" (docs/PLAN.md GĐ-T17, docs/GAME_DESIGN.md §5.17).
--
-- Vụ truy vết là `game_content` (game_code = 'truy_vet'): bản đồ ô (M9), camera, xe bỏ chạy, tin báo, seed.
-- Lộ trình sinh từ seed, không lưu. Không cần bảng mới: route riêng của trò (câu D23) ghi nhật ký mở camera,
-- khóa xe vào ảnh chụp bước của lượt (`game_runs.items`). Có offline (câu D24): gói mang cả seed và lộ trình.
-- Màn chơi dùng bảng tiến độ màn của 0036. Trò tắt sẵn cho tới khi có nội dung đã duyệt.
--
-- Chỉ thêm, chạy lại được. Số 0052 theo docs/PLAN.md Phụ lục B (0051 giữ cho T16).

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('truy_vet', 'Truy vết xe bỏ trốn',
   'Đọc tin báo, lần theo xe gây tai nạn qua các camera trên bản đồ, khóa đúng xe và đặt điểm chặn. 5 màn.',
   true, false, 20, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
