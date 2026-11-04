-- Nhóm chuẩn dùng để lọc danh mục, không thay thế audience hoặc audience_group.
-- Mảng rỗng: hiển thị trong mọi nhóm (nội dung dùng chung hoặc chưa phân nhóm).
ALTER TABLE courses ADD COLUMN nhom_hoc_tap text[] NOT NULL DEFAULT '{}';
ALTER TABLE courses ADD CONSTRAINT courses_nhom_hoc_tap_check CHECK (
  nhom_hoc_tap <@ ARRAY['cong_an_cap_xa', 'cong_chuc_cap_xa', 'vien_chuc', 'dang_vien']::text[]
  AND array_position(nhom_hoc_tap, NULL) IS NULL
);
