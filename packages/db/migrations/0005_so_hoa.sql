-- Số hóa văn bản bằng agent (ke-hoach/05). Thay cho hàng đợi `docproc` của service Python:
-- việc số hóa nằm ở đây, agent nhận việc qua MCP, nộp kết quả từng cụm trang.

CREATE TABLE IF NOT EXISTS sohoa_tasks (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  -- URI trong kho đối tượng (R2 khi đã cấu hình, thư mục data/ khi phát triển).
  file_uri       text NOT NULL,
  file_hash      text,
  route          text NOT NULL DEFAULT 'pdf_anh',   -- pdf_text | pdf_anh
  page_count     int,
  window_size    int  NOT NULL DEFAULT 5,
  overlap        int  NOT NULL DEFAULT 1,
  windows        jsonb NOT NULL DEFAULT '[]',       -- kế hoạch cụm trang
  -- cho | dang_lam | cho_duyet | xong | loi | bo_qua
  state          text NOT NULL DEFAULT 'cho',
  priority       int  NOT NULL DEFAULT 5,
  claimed_by     text,
  claimed_at     timestamptz,
  lease_until    timestamptz,
  prompt_version text NOT NULL DEFAULT 'v1',
  draft_uri      text,                              -- bản nháp trích từ lớp văn bản (tuyến pdf_text)
  markdown_uri   text,                              -- bản Markdown đã chốt (bản sao trên kho)
  version_id     uuid REFERENCES document_versions(id) ON DELETE SET NULL,
  quality        jsonb NOT NULL DEFAULT '{}',
  warnings       jsonb NOT NULL DEFAULT '[]',
  error          text,
  run_id         uuid,
  -- Đã đẩy được job `parse` chưa (MCP không luôn nối được tới Redis).
  parse_queued   boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  UNIQUE (document_id, file_uri)
);

CREATE INDEX IF NOT EXISTS sohoa_tasks_state_idx ON sohoa_tasks(state, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS sohoa_tasks_doc_idx ON sohoa_tasks(document_id);

-- Kết quả agent nộp cho từng cụm trang. Giữ nguyên vẹn để chạy lại bộ ghép khi sửa luật ghép.
CREATE TABLE IF NOT EXISTS sohoa_windows (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       uuid NOT NULL REFERENCES sohoa_tasks(id) ON DELETE CASCADE,
  idx           int  NOT NULL,
  page_from     int  NOT NULL,
  page_to       int  NOT NULL,
  markdown      text NOT NULL,
  open_state    jsonb NOT NULL DEFAULT '{}',
  tables        jsonb NOT NULL DEFAULT '[]',
  formulas      jsonb NOT NULL DEFAULT '[]',
  figures       jsonb NOT NULL DEFAULT '[]',
  corrections   jsonb NOT NULL DEFAULT '[]',
  warnings      jsonb NOT NULL DEFAULT '[]',
  unreadable_count int NOT NULL DEFAULT 0,
  submitted_by  text,
  model         text,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, idx)
);

CREATE INDEX IF NOT EXISTS sohoa_windows_task_idx ON sohoa_windows(task_id, idx);
