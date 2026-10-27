-- Mở rộng nhóm quy trình; giữ mã cũ để không đổi hoặc làm mất dữ liệu lịch sử.
BEGIN;
ALTER TABLE procedures DROP CONSTRAINT procedures_kind_check;
ALTER TABLE procedures ADD CONSTRAINT procedures_kind_check CHECK(kind IN ('vi_pham','tai_nan','hanh_chinh','nghiep_vu','cong_tac_dang')) NOT VALID;
ALTER TABLE procedures VALIDATE CONSTRAINT procedures_kind_check;
COMMIT;
