-- Trạng thái hiệu lực tính theo TỪNG PHIÊN BẢN.
-- Trước đây chỉ có documents.status là ảnh chụp trạng thái mới nhất, nên bộ lọc trạng thái
-- trong tìm kiếm không thể theo tham số asOf: một văn bản "hết hiệu lực một phần" hôm nay
-- vẫn "còn hiệu lực" nguyên vẹn ở thời điểm trước khi bị sửa đổi.
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'khong_xac_dinh';

CREATE INDEX IF NOT EXISTS dv_status_idx ON document_versions(status);
CREATE INDEX IF NOT EXISTS dv_valid_range_idx ON document_versions(document_id, valid_from, valid_to);
