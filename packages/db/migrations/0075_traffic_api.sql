BEGIN;

-- Reuse the canonical legal corpus and its temporal versions rather than copying law.
CREATE VIEW legal_documents AS SELECT * FROM documents;
CREATE VIEW legal_provisions AS
 SELECT n.*, d.urn || '#' || n.path AS urn, d.primary_source,
 v.valid_from, v.valid_to, v.reviewed_at, v.reviewed_by
 FROM nodes n JOIN documents d ON d.id = n.document_id
 JOIN document_versions v ON v.id = n.version_id;
CREATE VIEW audit_logs AS SELECT * FROM audit_log;

CREATE TABLE sign_categories (code text PRIMARY KEY, name text NOT NULL);
INSERT INTO sign_categories VALUES ('cam','Biển cấm'), ('nguy_hiem','Nguy hiểm'),
 ('hieu_lenh','Hiệu lệnh'), ('chi_dan','Chỉ dẫn'), ('phu','Biển phụ');
CREATE TABLE violation_categories (code text PRIMARY KEY, name text NOT NULL);
INSERT INTO violation_categories SELECT DISTINCT group_name, group_name FROM violations
 WHERE group_name IS NOT NULL;

ALTER TABLE traffic_signs ADD COLUMN deleted_at timestamptz;
ALTER TABLE traffic_signs ADD COLUMN effective_from date;
ALTER TABLE traffic_signs ADD COLUMN effective_to date;
ALTER TABLE traffic_signs ADD CONSTRAINT sign_effective_range
 CHECK (effective_to IS NULL OR (effective_from IS NOT NULL AND effective_to > effective_from));
ALTER TABLE violations ADD COLUMN deleted_at timestamptz;

CREATE TABLE violation_penalties (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 violation_code text NOT NULL REFERENCES violations(code),
 conditions text[] NOT NULL DEFAULT '{}',
 required_facts text[] NOT NULL DEFAULT '{}',
 fine_min bigint NOT NULL CHECK (fine_min >= 0),
 fine_max bigint NOT NULL CHECK (fine_max >= fine_min),
 point_deduction int CHECK (point_deduction BETWEEN 0 AND 12),
 suspension_months_min int CHECK (suspension_months_min >= 0),
 suspension_months_max int CHECK (suspension_months_max >= suspension_months_min),
 additional_penalties text[] NOT NULL DEFAULT '{}',
 remedies text[] NOT NULL DEFAULT '{}',
 citation_urn text NOT NULL CHECK (citation_urn LIKE 'vn:%#%'),
 effective_from date NOT NULL,
 effective_to date CHECK (effective_to > effective_from),
 status text NOT NULL DEFAULT 'nhap' CHECK (status IN ('nhap','cho_duyet','da_duyet','ngung')),
 version int NOT NULL DEFAULT 1,
 created_by text NOT NULL,
 reviewed_by text,
 reviewed_at timestamptz,
 deleted_at timestamptz,
 CHECK ((suspension_months_min IS NULL) = (suspension_months_max IS NULL)),
 CHECK (status <> 'da_duyet' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX violation_penalties_lookup ON violation_penalties(violation_code, status, effective_from)
 WHERE deleted_at IS NULL;

CREATE TABLE traffic_sign_violations (
 sign_code text REFERENCES traffic_signs(code),
 violation_code text REFERENCES violations(code),
 citation_urn text NOT NULL CHECK (citation_urn LIKE 'vn:%#%'),
 reviewed_by text NOT NULL, reviewed_at timestamptz NOT NULL,
 PRIMARY KEY (sign_code, violation_code)
);

CREATE TABLE search_histories (
 id bigserial PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('signs','violations')), query text NOT NULL CHECK (length(query) <= 200),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX search_histories_account ON search_histories(account_id, created_at DESC);

CREATE TABLE import_jobs (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 source_url text NOT NULL, source_hash text NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'staging' CHECK (status IN ('staging','rejected','processed')),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_hash)
);

-- Append-only snapshots include old approved content, even when legacy import scripts update it.
CREATE TABLE traffic_revisions (
 id bigserial PRIMARY KEY, entity text NOT NULL, ref text NOT NULL,
 operation text NOT NULL, snapshot jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX traffic_revisions_ref ON traffic_revisions(entity, ref, id DESC);
CREATE FUNCTION traffic_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO traffic_revisions(entity,ref,operation,snapshot)
 VALUES (TG_TABLE_NAME, COALESCE(to_jsonb(OLD)->>'code', to_jsonb(OLD)->>'id'),TG_OP,to_jsonb(OLD));
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER signs_snapshot BEFORE UPDATE OR DELETE ON traffic_signs
 FOR EACH ROW EXECUTE FUNCTION traffic_snapshot();
CREATE TRIGGER violations_snapshot BEFORE UPDATE OR DELETE ON violations
 FOR EACH ROW EXECUTE FUNCTION traffic_snapshot();
CREATE TRIGGER penalties_snapshot BEFORE UPDATE OR DELETE ON violation_penalties
 FOR EACH ROW EXECUTE FUNCTION traffic_snapshot();

-- Keep search indexes synchronized for both existing CMS writes and imports.
CREATE FUNCTION traffic_search_text() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME = 'traffic_signs' THEN
 NEW.search_text := lower(unaccent(NEW.code || ' ' || NEW.name || ' ' || NEW.meaning));
 ELSE
 NEW.search_text := lower(unaccent(NEW.behavior || ' ' || coalesce(NEW.group_name,'') || ' ' || array_to_string(NEW.keywords,' ')));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER signs_search BEFORE INSERT OR UPDATE ON traffic_signs
 FOR EACH ROW EXECUTE FUNCTION traffic_search_text();
CREATE TRIGGER violations_search BEFORE INSERT OR UPDATE ON violations
 FOR EACH ROW EXECUTE FUNCTION traffic_search_text();
COMMIT;
