-- Nhật ký truy cập API (docs/PLAN.md GĐ2; PRD §IV "ghi nhật ký truy cập và thao tác").
--
-- Mỗi request một dòng: phương thức, đường dẫn MẪU của route (ví dụ /v1/documents/:urn, không
-- ghi giá trị tham số), tài khoản, mã trạng thái, thời gian xử lý. KHÔNG ghi body, query hay
-- header: nhật ký không được thành nơi chứa dữ liệu cá nhân hay token.
--
-- Thời hạn lưu chưa chốt (docs/GAP_ANALYSIS.md câu hỏi 4.6-31). Bảng có index theo thời gian
-- để khi chốt thì xóa định kỳ bằng một câu DELETE ... WHERE created_at < now() - interval.
CREATE TABLE IF NOT EXISTS access_log (
  id         bigserial PRIMARY KEY,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  method     text NOT NULL,
  route      text NOT NULL,
  status     int  NOT NULL,
  ms         int  NOT NULL,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_log_time_idx ON access_log(created_at);
CREATE INDEX IF NOT EXISTS access_log_account_idx ON access_log(account_id, created_at DESC);
