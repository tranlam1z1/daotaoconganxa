-- 0068: Tệp PDF gốc của văn bản nạp từ bản quét (trang quản trị).
--
-- Bản quét không có lớp chữ nên không trích được Markdown. Văn bản vẫn lưu được với tệp gốc trong
-- kho đối tượng (`van-ban-goc/<hash>.pdf`); trang đọc hiện tệp này khi chưa có phiên bản nội dung.
--
-- Chỉ thêm, chạy lại được.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_file_uri text;
