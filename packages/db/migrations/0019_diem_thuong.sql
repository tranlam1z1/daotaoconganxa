-- Trò chơi hóa: điểm kinh nghiệm (XP), chuỗi ngày học, huy hiệu, thử thách hằng ngày
-- (docs/PLAN.md GĐ9).
--
-- Nguyên tắc:
--  - Sổ XP chỉ ghi thêm. Mỗi hành động được thưởng ghi đúng một dòng, khóa theo
--    (source_kind, source_id): kết thúc lại một phiên, nộp lại một bài thi không cộng hai lần.
--  - Ngày tính theo giờ Việt Nam (Asia/Ho_Chi_Minh), không theo UTC của máy chủ.
--  - Bảng xếp hạng đọc `daily_activity` (XP theo người, theo ngày) thay vì cộng lại cả sổ.

CREATE TABLE IF NOT EXISTS xp_ledger (
  id          bigserial PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- phien_luyen_tap | thu_thach | luot_thi | game:<mã trò chơi> …
  source_kind text NOT NULL,
  source_id   text NOT NULL,
  xp          int  NOT NULL CHECK (xp >= 0),
  -- Ngày giờ Việt Nam của hành động, để cộng vào đúng ngày trong daily_activity.
  day         date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xp_ledger_mot_lan UNIQUE (source_kind, source_id)
);
CREATE INDEX IF NOT EXISTS xp_ledger_account_idx ON xp_ledger(account_id, created_at);

CREATE TABLE IF NOT EXISTS daily_activity (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day        date NOT NULL,
  xp         int  NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, day)
);
CREATE INDEX IF NOT EXISTS daily_activity_day_idx ON daily_activity(day);

-- Chuỗi ngày học liên tiếp. Mỗi tuần (thứ Hai–Chủ nhật, giờ Việt Nam) có 1 lượt "đóng băng":
-- bỏ một ngày mà còn lượt thì chuỗi không đứt. `freeze_week` là tuần đã cấp lượt gần nhất.
CREATE TABLE IF NOT EXISTS streaks (
  account_id   uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  current      int  NOT NULL DEFAULT 0,
  best         int  NOT NULL DEFAULT 0,
  last_day     date,
  freezes_left int  NOT NULL DEFAULT 1,
  freeze_week  text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS badges (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL,
  -- Điều kiện đạt, đọc bởi packages/dao-tao/src/diem-thuong.ts: { "chi_so": "...", "nguong": n }.
  rule        jsonb NOT NULL,
  ordinal     int  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS account_badges (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES badges(code) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, badge_code)
);

-- Thử thách hằng ngày: 5 câu giống nhau cho mọi người trong ngày. Chốt danh sách ở lần hỏi đầu
-- tiên trong ngày, nên duyệt thêm câu vào ngân hàng giữa ngày không làm đổi thử thách.
CREATE TABLE IF NOT EXISTS daily_challenges (
  day          date PRIMARY KEY,
  question_ids uuid[] NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Huy hiệu cơ bản. Tên và ngưỡng là đề xuất, chờ khách hàng chốt (docs/GAP_ANALYSIS.md 4.4-19).
INSERT INTO badges (code, name, description, rule, ordinal) VALUES
  ('buoc-dau', 'Bước đầu', 'Hoàn thành phiên luyện tập đầu tiên.', '{"chi_so": "so_phien", "nguong": 1}', 1),
  ('chuoi-7', 'Bảy ngày liền', 'Học 7 ngày liên tiếp.', '{"chi_so": "chuoi_tot_nhat", "nguong": 7}', 2),
  ('chuoi-30', 'Ba mươi ngày liền', 'Học 30 ngày liên tiếp.', '{"chi_so": "chuoi_tot_nhat", "nguong": 30}', 3),
  ('tram-cau-dung', 'Một trăm câu đúng', 'Trả lời đúng 100 câu khi luyện tập.', '{"chi_so": "so_cau_dung", "nguong": 100}', 4),
  ('thu-thach-7', 'Bền bỉ', 'Hoàn thành 7 thử thách hằng ngày.', '{"chi_so": "so_thu_thach", "nguong": 7}', 5),
  ('dat-bai-thi', 'Đạt sát hạch', 'Đạt một bài thi sát hạch.', '{"chi_so": "so_bai_thi_dat", "nguong": 1}', 6)
ON CONFLICT (code) DO NOTHING;
