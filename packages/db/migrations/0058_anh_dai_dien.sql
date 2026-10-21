-- Ảnh đại diện người dùng tự tải lên. Lưu URI trong kho đối tượng (avatars/<tep>), tên tệp
-- gồm id tài khoản và hash nội dung nên mỗi lần đổi ảnh là một URI mới, cho phép đệm lâu.
-- NULL: hiển thị chữ cái đầu của tên như trước.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_uri text;
