-- 0050: Trò "Dựng chốt an toàn ban đêm" (docs/PLAN.md GĐ-T15, docs/GAME_DESIGN.md §5.15).
--
-- Đoạn đường và bộ tiêu chí chấm là `game_content` (game_code = 'chot_dem'), phân biệt bằng payload.kieu:
-- "doan_duong" (đoạn đường, túi đồ, dòng xe) và "tieu_chi_chot" (ngưỡng sáu tiêu chí, nguồn). Không cần bảng
-- mới. Màn chơi dùng bảng tiến độ màn của 0036. Trò tắt sẵn cho tới khi có nội dung đã duyệt (ngưỡng có căn cứ
-- hoặc tài liệu nghiệp vụ của đơn vị, câu D21).
--
-- Chỉ thêm, chạy lại được. Số 0050 theo docs/PLAN.md Phụ lục B (0049 giữ cho T14).

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('chot_dem', 'Dựng chốt an toàn ban đêm',
   'Đặt biển, cọc, đèn, xe tuần tra và chiến sĩ trên đoạn đường ban đêm, rồi cho xe chạy thử. 5 màn.',
   true, false, 18, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
