-- Đơn vị, tài khoản cán bộ đăng nhập bằng tên/mật khẩu, và vai trò theo đơn vị
-- (docs/PLAN.md GĐ2).
--
-- 0010 để dành cho nhật ký hỏi đáp theo tài khoản (GĐ0 S2). migrate.ts áp dụng mọi tệp chưa
-- chạy theo thứ tự tên, nên 0010 thêm sau vẫn được áp dụng; hai tệp không phụ thuộc nhau.

/* ------------------------------------------------------------------ */
/* Đơn vị dạng cây                                                      */
/* ------------------------------------------------------------------ */

-- `path` là chuỗi nhãn ltree dựng từ id (chữ `u` + 32 ký tự hex), không dựng từ mã đơn vị:
-- đổi mã không làm đổi đường dẫn, và nhãn luôn hợp lệ với ltree. Truy vấn cây con dùng
-- `path <@ :cha`. Chuyển cha thì cập nhật `path` của cả nhánh (packages/db/src/don-vi.ts).
CREATE TABLE IF NOT EXISTS units (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  parent_id   uuid REFERENCES units(id) ON DELETE RESTRICT,
  path        ltree NOT NULL,
  -- Nhãn cấp tùy ý: "Phòng", "Đội", "Tổ"... chỉ để hiển thị.
  level_label text,
  ordinal     int NOT NULL DEFAULT 0,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT units_parent_khac_chinh_no CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX IF NOT EXISTS units_path_gist ON units USING GIST (path);
CREATE INDEX IF NOT EXISTS units_parent_idx ON units(parent_id, ordinal);

/* ------------------------------------------------------------------ */
/* Tài khoản cán bộ                                                     */
/* ------------------------------------------------------------------ */

-- Họ tên dùng lại cột `name` sẵn có (tài khoản Google cũng ghi tên vào đó), không thêm
-- cột full_name trùng nghĩa.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS username             text,
  ADD COLUMN IF NOT EXISTS password_hash        text,
  ADD COLUMN IF NOT EXISTS unit_id              uuid REFERENCES units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rank_title           text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_changed_at  timestamptz;

-- Tên đăng nhập lưu chữ thường; so khớp không phân biệt hoa thường nhờ chuẩn hóa ở tầng ứng dụng.
CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_key ON accounts(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS accounts_unit_idx ON accounts(unit_id);

ALTER TABLE accounts ALTER COLUMN email DROP NOT NULL;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_co_dinh_danh;
ALTER TABLE accounts ADD CONSTRAINT accounts_co_dinh_danh CHECK (email IS NOT NULL OR username IS NOT NULL);

-- Thang vai trò mới (A5): khach < can_bo < tra_cuu < quan_ly < bien_tap < phap_che < quan_tri.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_role_check
  CHECK (role IN ('khach', 'can_bo', 'tra_cuu', 'quan_ly', 'bien_tap', 'phap_che', 'quan_tri'));

/* ------------------------------------------------------------------ */
/* Lượt đăng nhập bằng mật khẩu, để khóa tạm khi dò mật khẩu            */
/* ------------------------------------------------------------------ */

-- Ghi cả tên đăng nhập không tồn tại: kẻ dò mật khẩu không biết tên nào có thật.
CREATE TABLE IF NOT EXISTS login_attempts (
  id         bigserial PRIMARY KEY,
  username   text NOT NULL,
  ok         boolean NOT NULL,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_user_time_idx ON login_attempts(username, created_at DESC);
