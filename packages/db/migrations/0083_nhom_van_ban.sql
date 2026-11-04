-- Chỉ DDL: không suy đoán nhóm của dữ liệu cũ từ tiêu đề/cơ quan.
BEGIN;
ALTER TABLE documents ADD COLUMN document_group text NOT NULL DEFAULT 'chua_phan_loai';
ALTER TABLE documents ADD CONSTRAINT documents_group_check CHECK(document_group IN ('phap_luat','dang','khac','chua_phan_loai'));
COMMIT;
