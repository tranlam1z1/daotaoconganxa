-- Quy trình, biểu mẫu: trang /tra-cuu-nhanh/quy-trinh tra chung quy trình (các bước) và biểu mẫu,
-- hướng dẫn dạng tệp do biên tập viên tải lên ở trang quản trị.
--
--  - `form_templates`: mỗi dòng một tệp Word/PDF/Excel trong kho đối tượng (bieu-mau/<tep>), đi cùng
--    vòng đời duyệt với dữ liệu tra cứu khác (nhap → cho_duyet → da_duyet, ngung).
--  - Bốn cột dùng chung cho `procedures` và `form_templates`: phương tiện, loại vi phạm (để lọc),
--    ghim và lượt xem (để xếp mục "phổ biến": ghim trước, rồi theo lượt mở). Bốn cột này là phân loại,
--    không phải nội dung được duyệt: sửa không đổi trạng thái, không tăng phiên bản.

ALTER TABLE procedures ADD COLUMN IF NOT EXISTS vehicle text;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS group_name text;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;
ALTER TABLE procedures DROP CONSTRAINT IF EXISTS procedures_vehicle_check;
ALTER TABLE procedures ADD CONSTRAINT procedures_vehicle_check
  CHECK (vehicle IS NULL OR vehicle IN ('o_to', 'mo_to'));

CREATE TABLE IF NOT EXISTS form_templates (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          text UNIQUE NOT NULL,
  kind          text NOT NULL,
  title         text NOT NULL,
  summary       text,
  -- NULL: áp dụng cho mọi phương tiện.
  vehicle       text,
  -- Loại vi phạm, cùng danh sách với `violations.group_name` (CHU_DE_MUC_PHAT).
  group_name    text,
  -- URI trong kho đối tượng; tên tệp có hash nội dung nên thay tệp là đổi URI.
  file_uri      text NOT NULL,
  -- Tên tệp người soạn tải lên, dùng làm tên khi cán bộ tải về.
  file_name     text NOT NULL,
  file_ext      text NOT NULL,
  file_size     int  NOT NULL,
  pinned        boolean NOT NULL DEFAULT false,
  view_count    int  NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'nhap',
  version       int  NOT NULL DEFAULT 1,
  approved_by   text,
  approved_at   timestamptz,
  reject_reason text,
  topic_id      uuid REFERENCES question_topics(id) ON DELETE SET NULL,
  note          text,
  created_by    text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT form_templates_kind_check CHECK (kind IN ('bieu_mau', 'huong_dan')),
  CONSTRAINT form_templates_vehicle_check CHECK (vehicle IS NULL OR vehicle IN ('o_to', 'mo_to')),
  CONSTRAINT form_templates_ext_check CHECK (file_ext IN ('pdf', 'docx', 'doc', 'xlsx', 'xls')),
  CONSTRAINT form_templates_status_check
    CHECK (status IN ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'ngung'))
);
CREATE INDEX IF NOT EXISTS form_templates_status_idx ON form_templates(status, pinned, view_count);

-- Lịch sử duyệt nhận thêm loại `form_template`.
ALTER TABLE content_reviews DROP CONSTRAINT IF EXISTS content_reviews_kind_check;
ALTER TABLE content_reviews ADD CONSTRAINT content_reviews_kind_check
  CHECK (kind IN ('game_content', 'violation', 'traffic_sign', 'procedure', 'speed_limit', 'document_rule',
                  'load_limit', 'form_template'));
