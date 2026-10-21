-- 0069: Số trang của tệp PDF gốc (migration 0068), ghi lúc lưu văn bản.
--
-- Trình duyệt điện thoại thường không hiện PDF trong khung, nên trang đọc hiện từng trang của tệp
-- gốc dưới dạng ảnh và cần biết có bao nhiêu trang mà không phải mở tệp ở mỗi lượt xem.
--
-- Chỉ thêm, chạy lại được.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_file_pages int;
