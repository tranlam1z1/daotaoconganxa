-- Bộ nhân vật đồng hành (ke-hoach/09-b).
--
-- Nhân vật là DỮ LIỆU, không phải mã: quản trị viên tạo thêm nhân vật, trang phục và hành
-- động mà không cần triển khai lại. Bảy nhân vật gieo sẵn nằm ở packages/db/src/seed-dao-tao.ts.

/* ------------------------------------------------------------------ */
/* Nhân vật                                                            */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS mascot_personas (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          text UNIQUE NOT NULL,
  full_name     text NOT NULL,
  nick_name     text NOT NULL,
  role_line     text NOT NULL,
  bio           text,
  -- Đối tượng và chủ đề mà nhân vật này hợp — đầu vào của bộ định tuyến (09-b §3).
  audiences     text[] NOT NULL DEFAULT '{}',
  topics        text[] NOT NULL DEFAULT '{}',
  -- { tu_xung, goi_nguoi_hoc, do_dai_cau_toi_da, muc_trang_trong, tu_nen_dung[], tu_cam[] }
  voice         jsonb NOT NULL DEFAULT '{}',
  -- { chinh, phu, nhan, da, vien, mat }
  palette       jsonb NOT NULL DEFAULT '{}',
  -- Hình dáng thân dùng cho renderer SVG: thuoc | giot_muc | rua | nguoi_can | seu | thuoc_day | den_dau
  body          text NOT NULL DEFAULT 'thuoc',
  head_gear     text,
  default_prop  text NOT NULL DEFAULT 'khong',
  allowed_costumes text[] NOT NULL DEFAULT '{}',
  -- Đoạn mô tả khóa cứng ghép vào mọi prompt sinh ảnh, giữ nhân vật không biến dạng (09-b §6.2).
  character_sheet text NOT NULL DEFAULT '',
  enabled       boolean NOT NULL DEFAULT true,
  -- Nhân vật dùng khi không luật nào khớp. Chỉ một nhân vật được đặt cờ này.
  is_default    boolean NOT NULL DEFAULT false,
  ordinal       int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mascot_personas_default_idx ON mascot_personas(is_default) WHERE is_default;

-- Nhân vật của chuyên đề và của bài học (09-b §3, mức ưu tiên 3 và 4).
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS mascot_id     uuid REFERENCES mascot_personas(id) ON DELETE SET NULL,
  -- true = người học không được đổi nhân vật (vẫn được tắt hẳn).
  ADD COLUMN IF NOT EXISTS mascot_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mascot_costume text;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS mascot_id uuid REFERENCES mascot_personas(id) ON DELETE SET NULL;

-- ADD CONSTRAINT không có IF NOT EXISTS; bọc trong DO để chạy lại được sau khi migration
-- hỏng giữa chừng.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_mascot_fk') THEN
    ALTER TABLE enrollments ADD CONSTRAINT enrollments_mascot_fk FOREIGN KEY (mascot_id)
      REFERENCES mascot_personas(id) ON DELETE SET NULL;
  END IF;
END$$;

/* ------------------------------------------------------------------ */
/* Bàn giao theo ngữ cảnh                                              */
/* ------------------------------------------------------------------ */

-- Trong bài đánh giá thì Cân Nhắc vào vai; trong máy tính chi phí thì Đắn Đo. Xong thì trả lại.
CREATE TABLE IF NOT EXISTS mascot_handoffs (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  context    text UNIQUE NOT NULL,
  persona_id uuid NOT NULL REFERENCES mascot_personas(id) ON DELETE CASCADE,
  note       text,
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

/* ------------------------------------------------------------------ */
/* Hành động                                                           */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS mascot_actions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          text UNIQUE NOT NULL,
  -- NULL = áp dụng cho mọi nhân vật, hiện theo nhân vật đang được định tuyến.
  persona_id    uuid REFERENCES mascot_personas(id) ON DELETE CASCADE,
  trigger       text NOT NULL,
  -- Danh sách điều kiện [{ truong, toan_tu, gia_tri }] — dựng bằng bộ dựng luật ở 09-c §6.2.
  conditions    jsonb NOT NULL DEFAULT '[]',
  priority      int  NOT NULL DEFAULT 50,
  cooldown_seconds int NOT NULL DEFAULT 180,
  max_per_session  int NOT NULL DEFAULT 3,
  max_per_day      int NOT NULL DEFAULT 10,
  anchor        text NOT NULL DEFAULT 'goc_phai_duoi',
  state         text NOT NULL DEFAULT 'binh_thuong',
  pose          text NOT NULL DEFAULT 'dung',
  costume       text,
  prop          text,
  effect        text NOT NULL DEFAULT 'khong',
  -- [{ text, tone, loai: 'loi_dan'|'loi_phap_ly', citations[] }]
  speech        jsonb NOT NULL DEFAULT '[]',
  -- { nhan, lenh, tham_so } — lenh thuộc 8 lệnh tương tác với bài học (09-b §8).
  cta           jsonb NOT NULL DEFAULT '{}',
  audiences     text[] NOT NULL DEFAULT '{}',
  course_ids    uuid[] NOT NULL DEFAULT '{}',
  enabled       boolean NOT NULL DEFAULT true,
  -- Tự tắt khi tỷ lệ người học tắt mascot sau hành động này vượt ngưỡng (09-b §9).
  auto_disabled_at timestamptz,
  auto_disabled_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mascot_actions_trigger_idx ON mascot_actions(trigger, priority DESC) WHERE enabled;

/* ------------------------------------------------------------------ */
/* Ảnh nhân vật                                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS mascot_assets (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_id    uuid NOT NULL REFERENCES mascot_personas(id) ON DELETE CASCADE,
  -- avatar | chan_dung | toan_than | sticker | bang_bieu_cam | anh_bia | khung_hoat_hoa | anh_in
  kind          text NOT NULL,
  state         text NOT NULL DEFAULT 'binh_thuong',
  costume       text NOT NULL DEFAULT 'thuong_ngay',
  pose          text NOT NULL DEFAULT 'dung',
  prop          text NOT NULL DEFAULT 'khong',
  effect        text NOT NULL DEFAULT 'khong',
  -- URI trong kho đối tượng: assets/mascot/<persona>/<kind>/<hash>.<ext>
  uri           text NOT NULL,
  format        text NOT NULL DEFAULT 'png',
  width         int,
  height        int,
  bytes         int,
  -- nhap | cho_duyet | duyet | dung_chinh | tu_choi | go_bo
  status        text NOT NULL DEFAULT 'nhap',
  model         text,
  seed          text,
  prompt_version text,
  prompt        text,
  spec          jsonb NOT NULL DEFAULT '{}',
  cost_usd      numeric(10,6) NOT NULL DEFAULT 0,
  job_id        uuid,
  created_by    text,
  approved_by   text,
  approved_at   timestamptz,
  reject_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mascot_assets_persona_idx ON mascot_assets(persona_id, kind, status);
-- Mỗi tổ hợp chỉ có duy nhất một ảnh chính.
CREATE UNIQUE INDEX IF NOT EXISTS mascot_assets_canonical_idx
  ON mascot_assets(persona_id, kind, state, costume) WHERE status = 'dung_chinh';

CREATE TABLE IF NOT EXISTS mascot_render_jobs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_id  uuid NOT NULL REFERENCES mascot_personas(id) ON DELETE CASCADE,
  -- Tổ hợp cần sinh: { kind, states[], costumes[], poses[], props[], effects[], so_anh, seed }
  spec        jsonb NOT NULL DEFAULT '{}',
  total       int  NOT NULL DEFAULT 0,
  done        int  NOT NULL DEFAULT 0,
  failed      int  NOT NULL DEFAULT 0,
  -- cho | dang_chay | xong | loi | huy
  state       text NOT NULL DEFAULT 'cho',
  model       text,
  cost_usd    numeric(10,6) NOT NULL DEFAULT 0,
  budget_usd  numeric(10,6),
  error       text,
  requested_by text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS mascot_render_jobs_state_idx ON mascot_render_jobs(state, created_at DESC);

/* ------------------------------------------------------------------ */
/* Sự kiện mascot                                                      */
/* ------------------------------------------------------------------ */

-- Đo xem mascot có giúp ích không (09-b §9). Không có bảng này thì không có cơ sở để tắt
-- một hành động gây phiền — và mọi tranh luận về mascot sẽ thành tranh luận về gu thẩm mỹ.
CREATE TABLE IF NOT EXISTS mascot_events (
  id            bigserial PRIMARY KEY,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE CASCADE,
  action_id     uuid REFERENCES mascot_actions(id) ON DELETE SET NULL,
  persona_id    uuid REFERENCES mascot_personas(id) ON DELETE SET NULL,
  trigger       text NOT NULL,
  lesson_id     uuid REFERENCES lessons(id) ON DELETE SET NULL,
  -- hien | bam_cta | dong | bo_qua | tat_mascot
  outcome       text NOT NULL DEFAULT 'hien',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mascot_events_action_idx ON mascot_events(action_id, outcome);
CREATE INDEX IF NOT EXISTS mascot_events_time_idx ON mascot_events(created_at DESC);

/* ------------------------------------------------------------------ */
/* Cài đặt toàn cục                                                    */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS mascot_settings (
  id             int PRIMARY KEY DEFAULT 1,
  enabled        boolean NOT NULL DEFAULT true,
  default_level  text NOT NULL DEFAULT 'day_du',
  max_per_session int NOT NULL DEFAULT 8,
  min_gap_seconds int NOT NULL DEFAULT 180,
  motion         boolean NOT NULL DEFAULT true,
  sound          boolean NOT NULL DEFAULT false,
  updated_by     text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mascot_settings_singleton CHECK (id = 1)
);
INSERT INTO mascot_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
