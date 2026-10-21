-- Soạn dữ liệu tra cứu trong ứng dụng (mức phạt, quy trình), không chỉ nạp từ data/tra-cuu/*.json.
--
-- `created_by` là email người soạn; NULL là dòng đến từ tệp nạp. Lệnh nạp (`bun run tra-cuu:nap`)
-- chuyển sang `ngung` các dòng không còn trong tệp, nên phải bỏ qua dòng soạn trong ứng dụng.

ALTER TABLE violations ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS created_by text;
