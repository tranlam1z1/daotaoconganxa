-- Tài khoản khách: học và chơi không cần đăng nhập, chỉ nhập tên.
--
-- Người chưa đăng nhập bấm vào luyện tập, trò chơi hay bài học thì nhập tên ở /bat-dau; hệ thống
-- tạo một tài khoản `la_khach` (vai trò `khach`, không email, không tên đăng nhập, không đơn vị)
-- và một phiên. Mọi bảng tiến độ dùng `account_id` như tài khoản thường.
--
--  - Khách chỉ gọi được các nhóm API học và chơi (apps/api/src/auth.ts, KHACH_DUOC_GOI).
--  - Đăng nhập hoặc đăng ký trên cùng máy thì tiến độ khách được gộp sang tài khoản thật rồi xóa
--    tài khoản khách (packages/auth/src/khach.ts).
--  - Khách không dùng phiên quá 30 ngày thì phiên hết tác dụng, và worker `qdpl-don-khach` xóa
--    tài khoản cùng tiến độ. Còn dùng thì phiên không hết hạn theo ngày tạo.

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS la_khach boolean NOT NULL DEFAULT false;

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_co_dinh_danh;
ALTER TABLE accounts ADD CONSTRAINT accounts_co_dinh_danh
  CHECK (email IS NOT NULL OR username IS NOT NULL OR la_khach);

-- Tài khoản khách luôn là vai trò thấp nhất và không gắn đơn vị.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_khach_hop_le;
ALTER TABLE accounts ADD CONSTRAINT accounts_khach_hop_le
  CHECK (NOT la_khach OR (role = 'khach' AND unit_id IS NULL AND email IS NULL AND username IS NULL));

CREATE INDEX IF NOT EXISTS accounts_khach_idx ON accounts(created_at) WHERE la_khach;
