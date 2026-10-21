-- 0026: Gắn câu hỏi AI với tài khoản (docs/PLAN.md GĐ0 S2).
--
-- Kế hoạch đặt tên tệp là 0010_ask_logs_tai_khoan.sql, nhưng khi làm thì dãy migration đã tới
-- 0025, nên lấy số kế tiếp để migrate.ts chạy đúng thứ tự.
--
-- Hỏi đáp AI bắt buộc đăng nhập và bị giới hạn số câu mỗi tài khoản mỗi ngày (theo ngày giờ Việt
-- Nam), đếm trên bảng này. Dòng cũ (trước khi bắt đăng nhập) giữ nguyên với account_id = NULL.
-- Xóa tài khoản thì giữ lại lịch sử hỏi, chỉ bỏ liên kết. Chạy lại được.

ALTER TABLE ask_logs ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ask_logs_account_day_idx ON ask_logs(account_id, created_at);
