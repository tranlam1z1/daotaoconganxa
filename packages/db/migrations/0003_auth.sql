-- Tài khoản và phân quyền cho MCP server (và cho console biên tập sau này).
-- Danh tính do Google xác thực (GIS); hệ thống chỉ lưu email và vai trò.

CREATE TABLE IF NOT EXISTS accounts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         text UNIQUE NOT NULL,
  -- "sub" của Google, ổn định hơn email; điền khi đăng nhập lần đầu.
  google_sub    text UNIQUE,
  name          text,
  picture       text,
  -- Miền tổ chức (claim "hd" của Google) — dùng để cấp quyền theo cơ quan.
  hosted_domain text,
  role          text NOT NULL DEFAULT 'khach',
  enabled       boolean NOT NULL DEFAULT true,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT accounts_role_check
    CHECK (role IN ('khach', 'tra_cuu', 'bien_tap', 'phap_che', 'quan_tri'))
);
CREATE INDEX IF NOT EXISTS accounts_role_idx ON accounts(role);

-- Phiên làm việc: đổi ID token của Google lấy token phiên của hệ thống.
-- Lưu hash chứ không lưu token, để lộ CSDL cũng không dùng lại được.
CREATE TABLE IF NOT EXISTS sessions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash    text UNIQUE NOT NULL,
  client        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  last_used_at  timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions(account_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

-- Nhật ký gọi công cụ MCP: ai gọi gì, lúc nào, kết quả ra sao.
-- Bắt buộc với hệ thống có thể thay đổi nội dung pháp lý.
CREATE TABLE IF NOT EXISTS mcp_call_log (
  id          bigserial PRIMARY KEY,
  account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  email       text,
  role        text,
  tool        text NOT NULL,
  args        jsonb,
  allowed     boolean NOT NULL,
  deny_reason text,
  duration_ms int,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_call_log_time_idx ON mcp_call_log(created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_call_log_account_idx ON mcp_call_log(account_id, created_at DESC);
