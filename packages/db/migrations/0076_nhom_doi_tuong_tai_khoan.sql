-- Không suy đoán nhóm đối tượng của tài khoản cũ.
ALTER TABLE accounts ADD COLUMN nhom_doi_tuong text[] NOT NULL DEFAULT '{}';
ALTER TABLE accounts ADD CONSTRAINT accounts_nhom_doi_tuong_check CHECK (
  nhom_doi_tuong <@ ARRAY['cong_an_cap_xa', 'cong_chuc_cap_xa', 'vien_chuc', 'dang_vien']::text[]
  AND array_position(nhom_doi_tuong, NULL) IS NULL
);
