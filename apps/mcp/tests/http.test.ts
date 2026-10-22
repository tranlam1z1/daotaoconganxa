/** Test tầng HTTP: xác thực, phân quyền, và điểm cuối MCP. Gọi handle() trực tiếp, không cần mở cổng. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { clearJwksCache, createSession, setRole, upsertAccount } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { installKeys, makeKey, signIdToken, type TestKey } from "../../../packages/auth/tests/helpers.ts";
import { type HttpConfig, handle } from "../src/http.ts";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const EMAIL = "test-http@vidu.vn";
const config: HttpConfig = {
  port: 0,
  googleClientId: CLIENT_ID,
  allowedDomains: [],
  publicUrl: "http://127.0.0.1:3002",
};

let key: TestKey;
const BOOTSTRAP_CU = process.env.AUTH_BOOTSTRAP_ADMIN;

beforeAll(async () => {
  clearJwksCache();
  key = await makeKey("http-k1");
  installKeys(key);
  // Tệp này kiểm tra luồng đăng nhập bình thường. Nếu để bật, tài khoản đầu tiên của CSDL
  // test lại thành quản trị và các khẳng định về vai trò mặc định sẽ sai.
  // Quy tắc "người đầu tiên làm quản trị" có tệp riêng: packages/auth/tests/bootstrap.test.ts.
  process.env.AUTH_BOOTSTRAP_ADMIN = "0";
});

afterAll(async () => {
  if (BOOTSTRAP_CU === undefined) delete process.env.AUTH_BOOTSTRAP_ADMIN;
  else process.env.AUTH_BOOTSTRAP_ADMIN = BOOTSTRAP_CU;
  await sql`DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email = ${EMAIL})`;
  await sql`DELETE FROM mcp_call_log WHERE email = ${EMAIL}`;
  await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  handle(
    new Request(`http://127.0.0.1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    config,
  );
const get = (path: string, headers: Record<string, string> = {}) =>
  handle(new Request(`http://127.0.0.1${path}`, { headers }), config);

describe("điểm cuối công khai", () => {
  test("trang đăng nhập trả về HTML có nút Google", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("accounts.google.com/gsi/client");
    expect(html).toContain(CLIENT_ID);
    expect(html).toContain("Vai trò và quyền");
  });

  test("health cho biết cấu hình xác thực", async () => {
    const res = await get("/health");
    const body = (await res.json()) as any;
    expect(body.db).toBe("ok");
    expect(body.xac_thuc).toBe("google");
  });

  test("metadata theo đặc tả MCP Authorization", async () => {
    const res = await get("/.well-known/oauth-protected-resource");
    const body = (await res.json()) as any;
    expect(body.resource).toContain("/mcp");
    expect(body.authorization_servers).toContain("https://accounts.google.com");
  });
});

describe("đăng nhập bằng Google", () => {
  test("ID token hợp lệ đổi được token phiên", async () => {
    const idToken = await signIdToken(key, { aud: CLIENT_ID, email: EMAIL, name: "Người thử HTTP" });
    const res = await post("/auth/google", { credential: idToken, client: "test" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.token).toStartWith("qdpl_");
    expect(body.email).toBe(EMAIL);
    expect(body.role).toBe("khach");
    expect(body.cong_cu_kha_dung).toContain("tim_kiem_quy_dinh");
    expect(body.cong_cu_kha_dung).not.toContain("duyet_lenh_sua_doi");
  });

  test("ID token giả bị từ chối 401", async () => {
    const wrong = await makeKey("http-k2");
    const forged = await signIdToken(
      { ...wrong, kid: "http-k1" },
      { aud: CLIENT_ID, email: "gia-mao@vidu.vn" },
    );
    const res = await post("/auth/google", { credential: forged });
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toBe("invalid_token");
    // Không được tạo tài khoản cho token giả
    const [row] = (await sql`SELECT id FROM accounts WHERE email = 'gia-mao@vidu.vn'`) as any[];
    expect(row).toBeUndefined();
  });

  test("thiếu credential thì báo 400", async () => {
    const res = await post("/auth/google", {});
    expect(res.status).toBe(400);
  });

  test("tài khoản bị khóa không đăng nhập được", async () => {
    await upsertAccount({ email: EMAIL, sub: "s1" });
    await sql`UPDATE accounts SET enabled = false WHERE email = ${EMAIL}`;
    const idToken = await signIdToken(key, { aud: CLIENT_ID, email: EMAIL });
    const res = await post("/auth/google", { credential: idToken });
    expect(res.status).toBe(403);
    await sql`UPDATE accounts SET enabled = true WHERE email = ${EMAIL}`;
  });
});

describe("bảo vệ điểm cuối MCP", () => {
  test("không có token thì 401 kèm chỉ dẫn đăng nhập", async () => {
    const res = await post("/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("oauth-protected-resource");
  });

  test("token bịa đặt thì 401", async () => {
    const res = await post(
      "/mcp",
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { authorization: "Bearer qdpl_bia_dat" },
    );
    expect(res.status).toBe(401);
  });

  test("/me trả đúng vai trò và danh sách công cụ", async () => {
    const acc = await upsertAccount({ email: EMAIL, sub: "s1" });
    await setRole(EMAIL, "quan_ly", "quan-tri@vidu.vn");
    const s = await createSession(acc.id, "test");
    const res = await get("/me", { authorization: `Bearer ${s.token}` });
    const body = (await res.json()) as any;
    expect(body.email).toBe(EMAIL);
    expect(body.vai_tro).toBe("quan_ly");
    expect(body.cong_cu_kha_dung).toContain("hang_doi_bien_tap");
    expect(body.cong_cu_kha_dung).not.toContain("duyet_lenh_sua_doi");
  });

  test("thu hồi phiên thì token hết dùng được ngay", async () => {
    const acc = await upsertAccount({ email: EMAIL, sub: "s1" });
    const s = await createSession(acc.id, "test");
    expect((await get("/me", { authorization: `Bearer ${s.token}` })).status).toBe(200);
    await post("/auth/logout", {}, { authorization: `Bearer ${s.token}` });
    expect((await get("/me", { authorization: `Bearer ${s.token}` })).status).toBe(401);
  });

  test("đường dẫn không tồn tại trả 404 có thông điệp tiếng Việt", async () => {
    const res = await get("/khong-co");
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).message).toContain("Không có đường dẫn");
  });
});
