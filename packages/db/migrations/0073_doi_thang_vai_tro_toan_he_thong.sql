-- Đổi thang vai trò từ 7 bậc sang thang tổ chức 5 bậc.
--
-- Thang cũ trộn hai loại vai trò: vai trò tổ chức (can_bo, quan_ly, quan_tri) và vai trò
-- dòng công việc (tra_cuu, bien_tap, phap_che). Thang mới chỉ còn vai trò tổ chức:
--
--   khach < can_bo < lanh_dao < quan_ly < quan_tri
--   Khách  < Cán bộ  < Lãnh đạo  < Admin quản lý < Admin quản trị hệ thống
--
-- Ánh xạ tài khoản cũ sang vai trò mới:
--
--   tra_cuu -> can_bo    (người tra cứu gộp vào cán bộ; công cụ tra cứu vẫn dùng được)
--   quan_ly -> lanh_dao  (cán bộ quản lý của đơn vị thành lãnh đạo UBND xã)
--   bien_tap -> quan_ly  (biên tập viên thành Admin quản lý nội dung toàn hệ thống)
--   phap_che -> quan_ly  (pháp chế phê duyệt gộp vào Admin quản lý)
--
-- Hệ quả đã chấp nhận: vai trò soạn nội dung và vai trò phê duyệt là một, nên người soạn
-- cũng là người duyệt. Lãnh đạo UBND xã quản lý đơn vị mình, không duyệt nội dung.
--
-- Lưu ý: `can_bo` giữ nguyên, `quan_tri` giữ nguyên, `khach` giữ nguyên.
-- Tài khoản khách (la_khach) vẫn là role 'khach' nên ràng buộc ở migration 0062 còn hợp lệ.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_role_check;

UPDATE accounts
SET role = CASE role
    WHEN 'tra_cuu' THEN 'can_bo'
    WHEN 'quan_ly' THEN 'lanh_dao'
    WHEN 'bien_tap' THEN 'quan_ly'
    WHEN 'phap_che' THEN 'quan_ly'
    ELSE role
  END
WHERE role IN ('tra_cuu', 'quan_ly', 'bien_tap', 'phap_che');

ALTER TABLE accounts ADD CONSTRAINT accounts_role_check
  CHECK (role IN ('khach', 'can_bo', 'lanh_dao', 'quan_ly', 'quan_tri'));
