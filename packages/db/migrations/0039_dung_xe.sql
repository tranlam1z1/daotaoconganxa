-- 0039: Trò "Dừng xe đúng quy trình" (docs/PLAN.md GĐ-T4, docs/GAME_DESIGN.md §5.4).
--
--  - Bước quy trình có thao tác: không thêm cột. Phần trò chơi của một bước nằm trong `procedures.steps`
--    (jsonb), khóa `tro_choi` { ma, thao_tac, bat_buoc, dieu_kien, nguon }; kiểm bằng hàm thuần
--    `kiemTraQuyTrinh` (packages/dao-tao/src/tra-cuu-nhanh.ts) khi nạp và khi sửa. Quy trình cũ không có
--    khóa này và không đổi. Sửa bước thì phiên bản quy trình tăng như mọi dữ liệu tra cứu (GĐ-G0).
--  - Đăng ký trò `dung_xe`, tắt sẵn cho tới khi có quy trình và tình huống đã duyệt.
--
-- Chỉ thêm, chạy lại được. Số 0039 theo docs/GAME_DESIGN.md §7.

INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('dung_xe', 'Dừng xe đúng quy trình',
   'Vuốt ra hiệu lệnh, chạm lời thoại, kéo giấy tờ, giữ máy đo, kéo kết quả vào hướng xử lý, đúng thứ tự quy trình. 5 màn.',
   true, false, 11, 'luot_choi')
ON CONFLICT (code) DO NOTHING;
