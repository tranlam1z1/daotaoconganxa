-- 0070: Câu hỏi có nhiều ảnh minh họa (câu về biển báo: "Hình 1", "Hình 2"…).
--
-- Cột `image_uri` (một ảnh, migration 0013) chưa từng được giao diện ghi. Cột mới `image_uris` giữ danh
-- sách ảnh theo thứ tự hiển thị. Cột cũ giữ nguyên để bản mã đang chạy không lỗi trong lúc triển khai;
-- mã mới không đọc, không ghi cột cũ nữa.
--
-- Chỉ thêm, chạy lại được.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_uris text[] NOT NULL DEFAULT '{}';

UPDATE questions SET image_uris = ARRAY[image_uri] WHERE image_uri IS NOT NULL AND image_uris = '{}';
