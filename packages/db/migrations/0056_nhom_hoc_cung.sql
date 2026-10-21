-- 0056: Nhóm học cùng (docs/PLAN.md GĐ16a, docs/PROMPT_NHOM_HOC_CUNG.md mục 2.2).
--
-- - Không lưu phần trăm tiến độ: tiến độ tính lúc đọc từ lesson_progress và practice_sessions.
-- - Rời nhóm, bị mời ra, gỡ mục: đặt mốc thời gian, không xóa dòng.
-- - Các cột chỉ cần khi chọn khác đề xuất (join_scope của N3, show_progress của N4, exam_id và
--   loại 'de_thi' của N2) KHÔNG tạo (đề xuất Đ5). Cần sau thì thêm bằng ADD COLUMN IF NOT EXISTS.
-- - Giới hạn số lượng (N10) nằm ở packages/dao-tao/src/nhom-hoc.ts; ở đây chỉ CHECK những gì
--   chắc chắn không đổi.
--
-- Chỉ thêm, chạy lại được.

CREATE TABLE IF NOT EXISTS study_groups (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             text NOT NULL,
  description      text,
  -- Trưởng nhóm hiện tại; đổi cùng giao dịch với dòng truong_nhom ở study_group_members.
  -- RESTRICT: mã không xóa cứng tài khoản; test dọn dữ liệu phải xóa nhóm trước tài khoản.
  owner_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  -- Đơn vị của người tạo lúc tạo, chỉ để lọc. Phạm vi quản lý tính theo đơn vị hiện tại của từng thành viên.
  unit_id          uuid REFERENCES units(id) ON DELETE SET NULL,
  invite_code      text NOT NULL UNIQUE,
  status           text NOT NULL DEFAULT 'hoat_dong',
  archived_at      timestamptz,
  -- NULL khi nhóm tự lưu trữ (người cuối rời, trưởng nhóm bị khóa mà không còn ai).
  archived_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_groups_name_check CHECK (char_length(name) BETWEEN 3 AND 80),
  CONSTRAINT study_groups_description_check CHECK (description IS NULL OR char_length(description) <= 500),
  CONSTRAINT study_groups_status_check CHECK (status IN ('hoat_dong', 'luu_tru'))
);
CREATE INDEX IF NOT EXISTS study_groups_owner_idx ON study_groups(owner_account_id);
CREATE INDEX IF NOT EXISTS study_groups_unit_idx ON study_groups(unit_id);
CREATE INDEX IF NOT EXISTS study_groups_status_idx ON study_groups(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS study_group_members (
  group_id   uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'thanh_vien',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  -- Rời hoặc bị mời ra thì đặt giá trị; vào lại thì đặt NULL và cập nhật joined_at.
  left_at    timestamptz,
  -- Có giá trị khi bị trưởng nhóm mời ra.
  removed_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, account_id),
  CONSTRAINT study_group_members_role_check CHECK (role IN ('truong_nhom', 'thanh_vien'))
);
-- Mỗi nhóm có đúng một trưởng nhóm đang ở trong nhóm.
CREATE UNIQUE INDEX IF NOT EXISTS study_group_members_mot_truong_nhom
  ON study_group_members(group_id) WHERE role = 'truong_nhom' AND left_at IS NULL;
CREATE INDEX IF NOT EXISTS study_group_members_account_idx
  ON study_group_members(account_id) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS study_group_items (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id     uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  lesson_id    uuid REFERENCES lessons(id) ON DELETE CASCADE,
  -- Chủ đề nguồn của đề ôn tập, để hiển thị.
  topic_id     uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  -- Đề ôn tập: câu đã duyệt chốt lúc chia sẻ, như daily_challenges. Câu bị gỡ duyệt sau đó thì
  -- đề ngắn lại cho mọi người, không thay câu khác.
  question_ids uuid[],
  -- Tên đề ôn tập do người chia sẻ đặt. Bài học đọc tên từ lessons.title lúc hiển thị (Đ6).
  title        text,
  shared_by    uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ordinal      int NOT NULL DEFAULT 0,
  -- Hạn gợi ý, không khóa việc học.
  due_date     date,
  removed_at   timestamptz,
  removed_by   uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_group_items_kind_check CHECK (kind IN ('bai_hoc', 'de_on_tap')),
  CONSTRAINT study_group_items_theo_loai CHECK (
    (kind = 'bai_hoc' AND lesson_id IS NOT NULL AND question_ids IS NULL)
    OR (kind = 'de_on_tap' AND lesson_id IS NULL AND question_ids IS NOT NULL
        AND cardinality(question_ids) BETWEEN 5 AND 20
        AND title IS NOT NULL AND char_length(title) BETWEEN 3 AND 80)
  )
);
-- Cùng một bài không chia sẻ hai lần vào một nhóm (trừ khi đã gỡ).
CREATE UNIQUE INDEX IF NOT EXISTS study_group_items_bai_mot_lan
  ON study_group_items(group_id, lesson_id) WHERE kind = 'bai_hoc' AND removed_at IS NULL;
CREATE INDEX IF NOT EXISTS study_group_items_group_idx
  ON study_group_items(group_id, ordinal) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS study_group_cheers (
  id              bigserial PRIMARY KEY,
  group_id        uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Ngày giờ Việt Nam (Asia/Ho_Chi_Minh), tính như daily_activity.
  day             date NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_group_cheers_khac_nguoi CHECK (from_account_id <> to_account_id),
  -- N7: mỗi người cổ vũ một thành viên tối đa một lần mỗi ngày trong mỗi nhóm.
  CONSTRAINT study_group_cheers_mot_lan_moi_ngay UNIQUE (group_id, from_account_id, to_account_id, day)
);
CREATE INDEX IF NOT EXISTS study_group_cheers_nhan_idx ON study_group_cheers(group_id, to_account_id);
CREATE INDEX IF NOT EXISTS study_group_cheers_ngay_idx ON study_group_cheers(to_account_id, day);

-- Lượt thử mã mời (Đ8), đếm như login_attempts: sai quá 10 lần trong 15 phút thì từ chối.
CREATE TABLE IF NOT EXISTS study_group_join_attempts (
  id         bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ok         boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_group_join_attempts_idx ON study_group_join_attempts(account_id, created_at DESC);

/* ------------------------------------------------------------------ */
/* Phiên đề ôn tập: dùng lại practice_sessions                         */
/* ------------------------------------------------------------------ */

ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS group_item_id uuid REFERENCES study_group_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS practice_sessions_group_item_idx
  ON practice_sessions(group_item_id, account_id) WHERE group_item_id IS NOT NULL;
-- Mỗi người chỉ có một phiên đang làm cho mỗi đề ôn tập: bấm "Làm đề" hai lần trả phiên cũ.
CREATE UNIQUE INDEX IF NOT EXISTS practice_sessions_nhom_dang_lam
  ON practice_sessions(group_item_id, account_id) WHERE group_item_id IS NOT NULL AND finished_at IS NULL;

-- Giữ đủ các nguồn đã có (0014, 0020, 0022, 0024) và thêm nhom.
ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_source_check;
ALTER TABLE practice_sessions ADD CONSTRAINT practice_sessions_source_check CHECK (
  source IN ('chu_de', 'cau_sai', 'thu_thach', 'game:vuot_man', 'game:dua_thoi_gian', 'game:ghep_cap',
             'game:doan_bien_bao', 'game:hoi_nhanh_giong_noi', 'nhom')
);

/* ------------------------------------------------------------------ */
/* Thông báo nhóm (N9, N15)                                            */
/* ------------------------------------------------------------------ */

-- Công tắc "Thông báo nhóm học". notifications_sent.kind không có CHECK nên không cần nới.
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS group_activity boolean NOT NULL DEFAULT true;
