-- 0067: Soạn mới trong ứng dụng cho mọi loại dữ liệu tra cứu (tốc độ tối đa, tải trọng, luật giấy tờ,
-- biển báo), không chỉ mức phạt và quy trình (migration 0059).
--
-- `created_by` là email người soạn; NULL là dòng đến từ tệp nạp. Lệnh nạp chuyển sang `ngung` các dòng
-- không còn trong tệp, nên phải bỏ qua dòng soạn trong ứng dụng.
--
-- Chỉ thêm, chạy lại được.

ALTER TABLE speed_limits ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE load_limits ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE document_rules ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE traffic_signs ADD COLUMN IF NOT EXISTS created_by text;
