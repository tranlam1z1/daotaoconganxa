-- Chỉ DML: dùng cờ VBQPPL đã lưu, không phân loại nghị quyết của Đảng qua từ khóa.
-- Không ghi đè lựa chọn quản trị; khôi phục bằng migration tiến mới nếu cần.
UPDATE documents SET document_group='phap_luat'
WHERE document_group='chua_phan_loai' AND is_normative=true;
