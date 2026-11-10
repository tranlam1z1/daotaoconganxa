-- Loại đơn vị chuẩn, mã hành chính cho đơn vị cấp xã, và nơi sinh hoạt Đảng của tài khoản
-- (docs/superpowers/plans/2026-11-10-quan-ly-don-vi.md).
--
-- `level_label` (0011) là chữ gõ tự do nên báo cáo không lọc được "mọi UBND xã" hay "mọi trường".
-- `loai` thay nó bằng danh mục cố định. Cột `level_label` giữ lại cho dữ liệu cũ, giao diện không
-- còn ô nhập.
--
-- Một người có thể làm việc ở UBND xã và sinh hoạt Đảng ở Đảng ủy xã: hai nơi khác nhau. `unit_id`
-- vẫn là nơi công tác (quyết định phạm vi quản lý, như cũ); `party_unit_id` là nơi sinh hoạt Đảng,
-- chỉ để ghi nhận, không cấp quyền. Tầng ứng dụng kiểm nó trỏ tới đơn vị loại `to_chuc_dang`.

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS loai text NOT NULL DEFAULT 'khac',
  ADD COLUMN IF NOT EXISTS ma_hanh_chinh text;

ALTER TABLE units DROP CONSTRAINT IF EXISTS units_loai_check;
ALTER TABLE units ADD CONSTRAINT units_loai_check
  CHECK (loai IN ('xa', 'co_quan_hanh_chinh', 'don_vi_su_nghiep', 'to_chuc_dang', 'doan_the', 'khac'));

-- Mã xã, phường, đặc khu hiện hành: 5 chữ số, theo data/dia-gioi/dia-gioi.json.
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_ma_hanh_chinh_dang;
ALTER TABLE units ADD CONSTRAINT units_ma_hanh_chinh_dang CHECK (ma_hanh_chinh ~ '^\d{5}$');
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_ma_hanh_chinh_chi_cho_xa;
ALTER TABLE units ADD CONSTRAINT units_ma_hanh_chinh_chi_cho_xa
  CHECK (ma_hanh_chinh IS NULL OR loai = 'xa');
CREATE UNIQUE INDEX IF NOT EXISTS units_ma_hanh_chinh_key ON units(ma_hanh_chinh)
  WHERE ma_hanh_chinh IS NOT NULL;

-- Điền loại cho đơn vị đã có từ nhãn cấp cũ; nhãn khác giữ `khac`.
UPDATE units SET loai = CASE lower(trim(level_label))
    WHEN 'xã' THEN 'xa'
    WHEN 'cơ quan hành chính' THEN 'co_quan_hanh_chinh'
    WHEN 'đơn vị sự nghiệp' THEN 'don_vi_su_nghiep'
    WHEN 'tổ chức đảng' THEN 'to_chuc_dang'
    ELSE loai
  END
WHERE loai = 'khac' AND level_label IS NOT NULL;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS party_unit_id uuid REFERENCES units(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS accounts_party_unit_idx ON accounts(party_unit_id)
  WHERE party_unit_id IS NOT NULL;
