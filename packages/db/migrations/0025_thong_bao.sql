-- Nhắc học và thông báo đẩy (docs/PLAN.md GĐ15).
--
-- Web Push chuẩn (VAPID). Job lặp `qdpl-nhac-hoc` mỗi 15 phút quyết định ai cần nhận gì
-- (packages/dao-tao/src/lich-nhac.ts), rồi GHI `notifications_sent` TRƯỚC khi gửi: khóa UNIQUE
-- (account_id, kind, ref) bảo đảm một thông báo gửi nhiều nhất một lần, kể cả khi hai tiến trình
-- worker chạy cùng lúc.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_ok_at   timestamptz,
  failed_count int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS push_subscriptions_account_idx ON push_subscriptions(account_id);

-- Không có dòng thì dùng mặc định: chưa đặt giờ nhắc, các cảnh báo khác bật, yên lặng 22h–6h.
CREATE TABLE IF NOT EXISTS notification_prefs (
  account_id     uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  -- Giờ nhắc học hằng ngày theo giờ Việt Nam; NULL là không nhắc.
  remind_at      time,
  streak_warning boolean NOT NULL DEFAULT true,
  new_exam       boolean NOT NULL DEFAULT true,
  new_challenge  boolean NOT NULL DEFAULT true,
  quiet_from     time NOT NULL DEFAULT '22:00',
  quiet_to       time NOT NULL DEFAULT '06:00',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications_sent (
  id         bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- nhac_hoc | chuoi_ngay | thu_thach | de_thi_moi
  kind       text NOT NULL,
  -- Khóa chống trùng trong một loại: ngày (YYYY-MM-DD) hoặc id bài giao.
  ref        text NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  -- Số thiết bị nhận thành công; 0 là đã thử nhưng không thiết bị nào nhận.
  delivered  int NOT NULL DEFAULT 0,
  CONSTRAINT notifications_sent_mot_lan UNIQUE (account_id, kind, ref)
);

CREATE INDEX IF NOT EXISTS notifications_sent_time_idx ON notifications_sent(sent_at);
