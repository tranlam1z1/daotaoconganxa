-- Người dùng tự đăng ký tài khoản ở /dang-ky (học viên, chưa gắn đơn vị).
--
-- Tài khoản tự đăng ký dùng email làm tên đăng nhập: `username` = email chữ thường, nên luồng
-- đăng nhập bằng mật khẩu, khóa tạm và đặt lại mật khẩu dùng chung với tài khoản cán bộ.
-- Tên đăng nhập do quản trị cấp không chứa "@", nên không trùng được với email.
--
-- Email tự đăng ký không được xác minh. `self_registered` đánh dấu điều đó: khi chủ thật của
-- email đăng nhập bằng Google, mật khẩu do người đăng ký đặt bị bỏ (xem @qdpl/auth rbac.ts).

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS self_registered boolean NOT NULL DEFAULT false;
