-- Sửa thông tin tài khoản mẫu cho khớp thang vai trò mới (migration 0073).
--
-- Migration 0073 đổi thang vai trò từ 7 bậc sang 5 bậc và map tài khoản theo quy tắc
-- chung. Với tài khoản mẫu, quy tắc chung không đủ: tài khoản `quanly` (Admin quản lý)
-- và hai tài khoản `quanly.phong` / `quanly.doi1` đều mang vai trò `quan_ly` ở thang cũ,
-- nên cả ba cùng bị map thành `lanh_dao` — sai: `quanly` phải là Admin quản lý.
--
-- Migration này đặt lại đúng vai trò cho từng tài khoản mẫu và đổi tên đăng nhập cho
-- khớp vai trò: tiền tố `quanly.` là của vai trò "Cán bộ quản lý" đã bị gộp vào
-- `lanh_dao`, nên tài khoản lãnh đạo mang tên `lanhdao.*`.

UPDATE accounts SET role = 'quan_tri' WHERE username = 'quantri';
UPDATE accounts SET role = 'quan_ly' WHERE username = 'quanly';
UPDATE accounts SET role = 'lanh_dao' WHERE username IN ('quanly.phong', 'quanly.doi1');

-- Đổi tên đăng nhập. Chỉ đổi khi tên mới còn trống: nếu CSDL đã có sẵn `lanhdao.phong`
-- thì giữ nguyên cả hai tài khoản, không gộp làm mất tài khoản nào.
UPDATE accounts SET username = 'lanhdao.phong'
 WHERE username = 'quanly.phong'
   AND NOT EXISTS (SELECT 1 FROM accounts x WHERE x.username = 'lanhdao.phong');

UPDATE accounts SET username = 'lanhdao.doi1'
 WHERE username = 'quanly.doi1'
   AND NOT EXISTS (SELECT 1 FROM accounts x WHERE x.username = 'lanhdao.doi1');

-- Tên hiển thị cho khớp nhãn vai trò (ROLE_LABEL trong packages/auth/src/rbac.ts).
UPDATE accounts SET name = 'Admin quản trị hệ thống'
 WHERE username = 'quantri' AND (name IS NULL OR name = 'Quản trị hệ thống');
UPDATE accounts SET name = 'Admin quản lý'
 WHERE username = 'quanly' AND (name IS NULL OR name = 'Cán bộ quản lý');
