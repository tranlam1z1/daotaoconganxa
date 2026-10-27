-- EXPAND: tương thích mã cũ trong cửa sổ chuyển đổi. Chỉ DDL.
-- Khôi phục bằng migration tiến mới; giữ bảng lịch sử để đối chiếu trước/sau.
BEGIN;
ALTER TABLE accounts DROP CONSTRAINT accounts_nhom_doi_tuong_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_nhom_doi_tuong_check CHECK (
 nhom_doi_tuong <@ ARRAY['cong_an_cap_xa','cong_chuc_cap_xa','cong_chuc','vien_chuc','dang_vien']::text[]
 AND array_position(nhom_doi_tuong,NULL) IS NULL
) NOT VALID;
ALTER TABLE accounts VALIDATE CONSTRAINT accounts_nhom_doi_tuong_check;
ALTER TABLE courses DROP CONSTRAINT courses_nhom_hoc_tap_check;
ALTER TABLE courses ADD CONSTRAINT courses_nhom_hoc_tap_check CHECK (
 nhom_hoc_tap <@ ARRAY['cong_an_cap_xa','cong_chuc_cap_xa','cong_chuc','vien_chuc','dang_vien']::text[]
 AND array_position(nhom_hoc_tap,NULL) IS NULL
) NOT VALID;
ALTER TABLE courses VALIDATE CONSTRAINT courses_nhom_hoc_tap_check;
CREATE TABLE audience_group_migration_history (
 entity_kind text NOT NULL CHECK(entity_kind IN ('account','course')),
 entity_id uuid NOT NULL,
 groups_before text[] NOT NULL,
 groups_after text[] NOT NULL,
 migrated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(entity_kind,entity_id)
);
COMMENT ON TABLE audience_group_migration_history IS 'Nhóm trước/sau đợt 2; không chứa tên, email, không cấp quyền truy cập.';
COMMIT;
