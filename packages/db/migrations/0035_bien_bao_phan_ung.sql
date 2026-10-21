-- 0035: Phản ứng đúng với từng biển báo và trò "Cung đường biển báo" (docs/PLAN.md GĐ-G8).
--
-- `reaction` là thao tác đúng khi gặp biển trên đường (bộ 4 thao tác ở packages/dao-tao,
-- bien-bao.ts THAO_TAC_BIEN_BAO); `reaction_note` là giải thích ngắn hiện sau khi chấm. Hai cột là
-- nội dung của biển: sửa qua màn hình duyệt thì biển về chờ duyệt như sửa tên, ý nghĩa.
-- Chỉ thêm, chạy lại được.

ALTER TABLE traffic_signs ADD COLUMN IF NOT EXISTS reaction text;
ALTER TABLE traffic_signs ADD COLUMN IF NOT EXISTS reaction_note text;
ALTER TABLE traffic_signs DROP CONSTRAINT IF EXISTS traffic_signs_reaction_check;
ALTER TABLE traffic_signs ADD CONSTRAINT traffic_signs_reaction_check
  CHECK (reaction IS NULL OR reaction IN ('giam_toc', 'dung_lai', 'khong_vao', 'di_tiep'));

-- Trò mới: tắt cho tới khi có đủ biển đã duyệt có phản ứng (docs/PLAN.md §0.5).
INSERT INTO games (code, name, description, offline_ok, enabled, ordinal, engine) VALUES
  ('cung_duong_bien_bao', 'Cung đường biển báo',
   'Khởi động 3 câu đoán biển, rồi lái xe qua 12 biển: phản ứng đúng với từng biển trong vài giây, có 3 mạng.',
   true, false, 8, 'luot_choi')
ON CONFLICT (code) DO NOTHING;

-- "Đoán biển báo" (GĐ12) thành phần khởi động của Cung đường (GAME_DESIGN §7 Q2): ẩn khỏi danh sách,
-- giữ mã và dữ liệu cũ.
UPDATE games SET enabled = false, updated_at = now() WHERE code = 'doan_bien_bao';
