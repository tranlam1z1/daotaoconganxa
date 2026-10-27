-- CONTRACT: dừng tiến trình phiên bản cũ trước khi áp dụng; triển khai mã mới sau migrate.
-- Chỉ DDL. Khôi phục cần mở rộng constraint bằng migration tiến mới trước khi đọc snapshot.
BEGIN;
ALTER TABLE accounts DROP CONSTRAINT accounts_nhom_doi_tuong_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_nhom_doi_tuong_check CHECK (
 nhom_doi_tuong <@ ARRAY['cong_chuc','vien_chuc','dang_vien']::text[]
 AND array_position(nhom_doi_tuong,NULL) IS NULL
) NOT VALID;
ALTER TABLE accounts VALIDATE CONSTRAINT accounts_nhom_doi_tuong_check;
ALTER TABLE courses DROP CONSTRAINT courses_nhom_hoc_tap_check;
ALTER TABLE courses ADD CONSTRAINT courses_nhom_hoc_tap_check CHECK (
 nhom_hoc_tap <@ ARRAY['cong_chuc','vien_chuc','dang_vien']::text[]
 AND array_position(nhom_hoc_tap,NULL) IS NULL
) NOT VALID;
ALTER TABLE courses VALIDATE CONSTRAINT courses_nhom_hoc_tap_check;
COMMIT;
