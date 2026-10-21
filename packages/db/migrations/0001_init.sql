-- Lược đồ CSDL quydinhphapluat.vn. Xem ke-hoach/03-mo-hinh-du-lieu.md
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cấu hình tìm kiếm toàn văn cho tiếng Việt: bỏ dấu + đơn giản hóa.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'vietnamese') THEN
    CREATE TEXT SEARCH CONFIGURATION vietnamese (COPY = simple);
    ALTER TEXT SEARCH CONFIGURATION vietnamese
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS agencies (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          text UNIQUE NOT NULL,
  name          text NOT NULL,
  kind          text NOT NULL,
  parent_code   text,
  valid_from    date,
  valid_to      date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agency_aliases (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_code text NOT NULL REFERENCES agencies(code) ON DELETE CASCADE,
  alias       text NOT NULL,
  valid_from  date,
  valid_to    date,
  UNIQUE (agency_code, alias)
);

CREATE TABLE IF NOT EXISTS documents (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  urn            text UNIQUE NOT NULL,
  doc_type       text NOT NULL,
  rank           int  NOT NULL,
  is_normative   boolean NOT NULL DEFAULT true,
  so_ky_hieu     text NOT NULL,
  locality       text,
  title          text NOT NULL,
  short_title    text NOT NULL,
  issuer_code    text,
  issuer_name    text,
  signer         text,
  issued_date    date,
  effective_from date,
  effective_to   date,
  gazette_no     text,
  gazette_date   date,
  fields         text[] NOT NULL DEFAULT '{}',
  keywords       text[] NOT NULL DEFAULT '{}',
  status         text NOT NULL DEFAULT 'khong_xac_dinh',
  status_as_of   timestamptz,
  is_draft       boolean NOT NULL DEFAULT false,
  summary        text,
  ai_summary     text,
  primary_source text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_type_idx    ON documents(doc_type);
CREATE INDEX IF NOT EXISTS documents_status_idx  ON documents(status);
CREATE INDEX IF NOT EXISTS documents_issued_idx  ON documents(issued_date DESC);
CREATE INDEX IF NOT EXISTS documents_sokyhieu_trgm ON documents USING gin (so_ky_hieu gin_trgm_ops);
CREATE INDEX IF NOT EXISTS documents_title_trgm ON documents USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS documents_fields_idx  ON documents USING gin (fields);

CREATE TABLE IF NOT EXISTS document_versions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no     int  NOT NULL,
  kind           text NOT NULL,          -- original|corrigendum|consolidated_official|consolidated_auto|reissue
  valid_from     date NOT NULL,
  valid_to       date,
  basis_version_id uuid REFERENCES document_versions(id),
  applied_ops    uuid[] NOT NULL DEFAULT '{}',
  markdown       text,
  markdown_uri   text,
  tree           jsonb,
  content_hash   text,
  quality        jsonb NOT NULL DEFAULT '{}',
  provenance     jsonb NOT NULL DEFAULT '{}',
  reviewed_by    text,
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no)
);
CREATE INDEX IF NOT EXISTS dv_doc_valid_idx ON document_versions(document_id, valid_from DESC);

CREATE TABLE IF NOT EXISTS nodes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id    uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  path          text NOT NULL,
  lpath         ltree,
  full_path     text NOT NULL,
  kind          text NOT NULL,
  label         text NOT NULL,
  heading       text,
  text_md       text NOT NULL DEFAULT '',
  text_plain    text NOT NULL DEFAULT '',
  context_path  text,
  ordinal       int  NOT NULL DEFAULT 0,
  depth         int  NOT NULL DEFAULT 0,
  node_status   text NOT NULL DEFAULT 'active',
  note          text,
  stable_key    text,
  page_refs     jsonb,
  asset_id      uuid,
  tsv           tsvector,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nodes_version_idx ON nodes(version_id);
CREATE INDEX IF NOT EXISTS nodes_doc_path_idx ON nodes(document_id, path);
CREATE INDEX IF NOT EXISTS nodes_lpath_idx ON nodes USING gist (lpath);
CREATE INDEX IF NOT EXISTS nodes_tsv_idx  ON nodes USING gin (tsv);
CREATE INDEX IF NOT EXISTS nodes_plain_trgm ON nodes USING gin (text_plain gin_trgm_ops);
CREATE INDEX IF NOT EXISTS nodes_kind_idx ON nodes(kind);

CREATE TABLE IF NOT EXISTS assets (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id     uuid REFERENCES nodes(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  kind        text NOT NULL,           -- table|image|formula
  md          text,
  alt         text,
  image_uri   text,
  caption     text,
  rows        int,
  cols        int,
  confidence  real,
  needs_review boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relations (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_urn       text NOT NULL,
  to_urn         text NOT NULL,
  type           text NOT NULL,
  effective_from date,
  effective_to   date,
  source         text NOT NULL DEFAULT 'parsed',
  confidence     real NOT NULL DEFAULT 1,
  evidence       jsonb,
  reviewed       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_urn, to_urn, type)
);
CREATE INDEX IF NOT EXISTS relations_from_idx ON relations(from_urn);
CREATE INDEX IF NOT EXISTS relations_to_idx   ON relations(to_urn);
CREATE INDEX IF NOT EXISTS relations_type_idx ON relations(type);

CREATE TABLE IF NOT EXISTS amendment_ops (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  amending_doc_urn   text NOT NULL,
  amending_label     text,
  amending_node_path text,
  target_doc_urn     text NOT NULL,
  target_path        text NOT NULL DEFAULT '',
  op                 text NOT NULL,
  payload            jsonb,
  effective_from     date NOT NULL,
  effective_to       date,
  ordinal            int NOT NULL DEFAULT 0,
  extraction         text NOT NULL DEFAULT 'llm',
  confidence         real NOT NULL DEFAULT 0,
  review_status      text NOT NULL DEFAULT 'pending',
  reviewer_id        text,
  reviewed_at        timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_target_idx ON amendment_ops(target_doc_urn, effective_from);
CREATE INDEX IF NOT EXISTS ops_review_idx ON amendment_ops(review_status);

CREATE TABLE IF NOT EXISTS embeddings (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id     uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_no    int NOT NULL DEFAULT 0,
  chunk_text  text NOT NULL,
  model       text NOT NULL,
  embedding   vector(1024),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS embeddings_node_idx ON embeddings(node_id);
CREATE INDEX IF NOT EXISTS embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS source_records (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source       text NOT NULL,
  source_id    text NOT NULL,
  url          text NOT NULL,
  document_id  uuid REFERENCES documents(id) ON DELETE SET NULL,
  file_uri     text,
  content_type text,
  file_hash    text,
  etag         text,
  last_modified text,
  metadata     jsonb NOT NULL DEFAULT '{}',
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  step        text NOT NULL,
  route       text,
  status      text NOT NULL DEFAULT 'running',
  model       text,
  prompt_version text,
  tokens_in   int,
  tokens_out  int,
  cost_usd    numeric(12,6),
  duration_ms int,
  warnings    jsonb,
  error       text,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS runs_doc_idx ON pipeline_runs(document_id, started_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id          bigserial PRIMARY KEY,
  queue       text NOT NULL,
  payload     jsonb NOT NULL,
  state       text NOT NULL DEFAULT 'pending',  -- pending|active|done|failed|dead
  priority    int NOT NULL DEFAULT 0,
  attempts    int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_error  text,
  run_after   timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_poll_idx ON jobs(queue, state, run_after, priority DESC);

CREATE TABLE IF NOT EXISTS taxonomy (
  code       text PRIMARY KEY,
  parent_code text REFERENCES taxonomy(code),
  name       text NOT NULL,
  kind       text NOT NULL DEFAULT 'de_muc',   -- chu_de|de_muc|nhanh_noi_bo
  ordinal    int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS use_cases (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          text UNIQUE NOT NULL,
  title         text NOT NULL,
  taxonomy_codes text[] NOT NULL DEFAULT '{}',
  actor_kinds   text[] NOT NULL DEFAULT '{}',
  work_kinds    text[] NOT NULL DEFAULT '{}',
  as_of         date NOT NULL,
  situation     text NOT NULL,
  questions     jsonb NOT NULL DEFAULT '[]',
  analysis      jsonb NOT NULL DEFAULT '[]',
  conclusion    text,
  procedure     jsonb NOT NULL DEFAULT '[]',
  risks         jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL DEFAULT 'draft',
  citation_health text NOT NULL DEFAULT 'ok',
  author        text,
  legal_reviewer text,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug       text UNIQUE NOT NULL,
  title      text NOT NULL,
  audience   text[] NOT NULL DEFAULT '{}',
  objectives jsonb NOT NULL DEFAULT '[]',
  taxonomy_codes text[] NOT NULL DEFAULT '{}',
  as_of      date NOT NULL,
  summary    text,
  status     text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessons (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug       text NOT NULL,
  ordinal    int NOT NULL,
  title      text NOT NULL,
  summary    text,
  body_md    text NOT NULL,
  activities jsonb NOT NULL DEFAULT '[]',
  quiz       jsonb NOT NULL DEFAULT '[]',
  citation_health text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

-- Viện dẫn từ nội dung biên tập (use case, bài học) tới nút văn bản.
CREATE TABLE IF NOT EXISTS citations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_kind  text NOT NULL,      -- use_case|lesson|answer
  owner_id    uuid NOT NULL,
  node_urn    text NOT NULL,
  as_of       date NOT NULL,
  content_hash text,
  health      text NOT NULL DEFAULT 'ok',  -- ok|changed|repealed|missing
  checked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citations_owner_idx ON citations(owner_kind, owner_id);
CREATE INDEX IF NOT EXISTS citations_node_idx  ON citations(node_urn);

CREATE TABLE IF NOT EXISTS review_queue (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind        text NOT NULL,     -- conversion|amend_op|status_change|citation|user_report
  ref_id      text NOT NULL,
  document_urn text,
  priority    int NOT NULL DEFAULT 0,
  payload     jsonb NOT NULL DEFAULT '{}',
  state       text NOT NULL DEFAULT 'open',
  assignee    text,
  resolution  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS review_state_idx ON review_queue(state, kind, priority DESC);

CREATE TABLE IF NOT EXISTS ask_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  question    text NOT NULL,
  as_of       date NOT NULL,
  answer      text,
  citations   jsonb NOT NULL DEFAULT '[]',
  retrieval   jsonb NOT NULL DEFAULT '[]',
  model       text,
  tokens_in   int,
  tokens_out  int,
  cost_usd    numeric(12,6),
  faithful    boolean,
  reported    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  actor      text NOT NULL,
  action     text NOT NULL,
  target     text,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
