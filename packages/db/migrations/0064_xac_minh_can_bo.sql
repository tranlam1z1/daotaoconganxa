-- Xác minh cán bộ: tài khoản tự đăng ký (và tài khoản Google mới mang vai trò khách) chờ người có
-- thẩm quyền xác minh đúng người rồi mới thành cán bộ.
--
--  - Người đăng ký khai số hiệu CAND, đơn vị công tác (`don_vi_khai`), cấp bậc/chức vụ
--    (`rank_title` sẵn có). Chưa duyệt thì vai trò là `khach` và API đối xử như tài khoản khách
--    (apps/api/src/auth.ts): chỉ học và chơi, nhưng tiến độ được giữ trên tài khoản thật.
--  - Quản trị viên duyệt mọi tài khoản; cán bộ quản lý duyệt tài khoản khai đơn vị nằm trong cây
--    đơn vị của mình. Duyệt thì gắn đơn vị, nâng vai trò lên `can_bo`; từ chối thì ghi lý do,
--    người đăng ký sửa thông tin và gửi lại.
--  - Tài khoản do quản trị tạo hoặc nhập Excel đã được xác minh từ đầu (giá trị mặc định).

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS xac_minh       text NOT NULL DEFAULT 'da_xac_minh',
  ADD COLUMN IF NOT EXISTS so_hieu        text,
  ADD COLUMN IF NOT EXISTS don_vi_khai    uuid REFERENCES units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS xac_minh_ly_do text,
  ADD COLUMN IF NOT EXISTS xac_minh_boi   text,
  ADD COLUMN IF NOT EXISTS xac_minh_luc   timestamptz;

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_xac_minh_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_xac_minh_check
  CHECK (xac_minh IN ('cho_duyet', 'da_xac_minh', 'tu_choi'));

CREATE INDEX IF NOT EXISTS accounts_cho_xac_minh_idx
  ON accounts(don_vi_khai, created_at) WHERE xac_minh <> 'da_xac_minh';

-- Tài khoản Google đã có mà vẫn mang vai trò khách là người chưa ai xác nhận: đưa vào hàng chờ.
-- Tài khoản tự đăng ký trước bản này đã là cán bộ thì giữ nguyên, không hạ quyền người đang học.
-- Tài khoản demo học viên (packages/auth/src/demo.ts) cố ý mang vai trò khách, không phải người thật.
UPDATE accounts SET xac_minh = 'cho_duyet'
WHERE NOT la_khach AND role = 'khach' AND xac_minh = 'da_xac_minh'
  AND email NOT LIKE '%@demo.quydinhphapluat.vn';
