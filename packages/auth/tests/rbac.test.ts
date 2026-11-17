import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "@qdpl/db";
import {
  atLeast,
  canUseTool,
  listAccounts,
  type Principal,
  ROLES,
  type Role,
  setEnabled,
  setRole,
  TOOL_ROLE,
  upsertAccount,
  visibleTools,
  WRITE_TOOLS,
} from "../src/rbac.ts";
import {
  createSession,
  hashToken,
  principalFromToken,
  revokeAllForEmail,
  revokeSession,
} from "../src/session.ts";

const EMAIL = "test-rbac@vidu.vn";
const EMAIL2 = "test-rbac-2@vidu.vn";

// Tệp này kiểm tra đường đi bình thường (kho đã có tài khoản). Bước "người đầu tiên làm
// quản trị" có tệp riêng: bootstrap.test.ts.
const BOOTSTRAP_CU = process.env.AUTH_BOOTSTRAP_ADMIN;
beforeAll(() => {
  process.env.AUTH_BOOTSTRAP_ADMIN = "0";
});

afterAll(async () => {
  if (BOOTSTRAP_CU === undefined) delete process.env.AUTH_BOOTSTRAP_ADMIN;
  else process.env.AUTH_BOOTSTRAP_ADMIN = BOOTSTRAP_CU;
  await sql`DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email IN (${EMAIL}, ${EMAIL2}))`;
  await sql`DELETE FROM mcp_call_log WHERE email IN (${EMAIL}, ${EMAIL2})`;
  await sql`DELETE FROM accounts WHERE email IN (${EMAIL}, ${EMAIL2})`;
});

const who = (role: Role): Principal => ({ email: "x@vidu.vn", role, source: "google" });

describe("thứ bậc vai trò", () => {
  test("xếp theo mức tăng dần", () => {
    // Thang tổ chức 5 bậc (migration 0073): khách, cán bộ, lãnh đạo Công an xã, Admin quản lý,
    // Admin quản trị hệ thống.
    expect(ROLES).toEqual(["khach", "can_bo", "lanh_dao", "quan_ly", "quan_tri"]);
    expect(atLeast("quan_tri", "lanh_dao")).toBe(true);
    // Cán bộ trên khách, dưới lãnh đạo Công an xã.
    expect(atLeast("can_bo", "khach")).toBe(true);
    expect(atLeast("can_bo", "lanh_dao")).toBe(false);
    // Lãnh đạo Công an xã dưới Admin quản lý: Admin quản lý kế thừa quyền phê duyệt.
    expect(atLeast("lanh_dao", "quan_ly")).toBe(false);
    expect(atLeast("quan_ly", "lanh_dao")).toBe(true);
    expect(atLeast("khach", "khach")).toBe(true);
  });

  test("mọi công cụ đều khai báo vai trò tối thiểu hợp lệ", () => {
    for (const [tool, role] of Object.entries(TOOL_ROLE)) {
      expect(ROLES).toContain(role);
      expect(tool).toMatch(/^[a-z_]+$/);
    }
  });
});

describe("kiểm soát truy cập công cụ", () => {
  test("khách chỉ tra cứu được, không thấy công cụ vận hành", () => {
    const tools = visibleTools(who("khach"), true);
    expect(tools).toContain("tim_kiem_quy_dinh");
    expect(tools).toContain("kiem_tra_can_cu");
    expect(tools).not.toContain("hang_doi_bien_tap");
    expect(tools).not.toContain("duyet_lenh_sua_doi");
    expect(tools).not.toContain("quan_ly_tai_khoan");
  });

  test("cán bộ KHÔNG duyệt được lệnh sửa đổi", () => {
    const d = canUseTool(who("can_bo"), "duyet_lenh_sua_doi", true);
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("quan_ly");
  });

  test("lãnh đạo Công an xã KHÔNG duyệt được lệnh sửa đổi", () => {
    expect(canUseTool(who("lanh_dao"), "duyet_lenh_sua_doi", true).allowed).toBe(false);
  });

  test("Admin quản lý duyệt được nhưng không quản lý tài khoản", () => {
    expect(canUseTool(who("quan_ly"), "duyet_lenh_sua_doi", true).allowed).toBe(true);
    expect(canUseTool(who("quan_ly"), "quan_ly_tai_khoan", true).allowed).toBe(false);
  });

  test("quản trị dùng được tất cả", () => {
    for (const tool of Object.keys(TOOL_ROLE)) {
      expect(canUseTool(who("quan_tri"), tool, true).allowed).toBe(true);
    }
  });

  test("chế độ chỉ đọc chặn mọi công cụ ghi, kể cả với quản trị", () => {
    for (const tool of WRITE_TOOLS) {
      const d = canUseTool(who("quan_tri"), tool, false);
      expect(d.allowed).toBe(false);
      expect(d.reason).toContain("chỉ đọc");
    }
    // Công cụ đọc vẫn dùng được
    expect(canUseTool(who("quan_tri"), "tim_kiem_quy_dinh", false).allowed).toBe(true);
  });

  test("công cụ chưa khai báo quyền thì bị từ chối mặc định", () => {
    const d = canUseTool(who("quan_tri"), "cong_cu_la_hoac", true);
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("từ chối mặc định");
  });
});

describe("tài khoản và phiên", () => {
  test("tài khoản mới nhận vai trò mặc định thấp nhất, không tự cấp quyền cao", async () => {
    const acc = await upsertAccount({ email: EMAIL, sub: "sub-1", name: "Người thử" });
    expect(acc.email).toBe(EMAIL);
    expect(acc.role).toBe("khach");
    expect(acc.enabled).toBe(true);
  });

  test("đăng nhập lại không đổi vai trò đã cấp", async () => {
    await setRole(EMAIL, "lanh_dao", "quan-tri@vidu.vn");
    const again = await upsertAccount({ email: EMAIL, sub: "sub-1", name: "Người thử" });
    expect(again.role).toBe("lanh_dao");
  });

  test("token phiên chỉ lưu dạng băm, không lưu nguyên văn", async () => {
    const acc = await upsertAccount({ email: EMAIL, sub: "sub-1" });
    const s = await createSession(acc.id, "test");
    const [row] =
      (await sql`SELECT token_hash FROM sessions WHERE token_hash = ${hashToken(s.token)}`) as any[];
    expect(row).toBeDefined();
    const [leak] = (await sql`SELECT id FROM sessions WHERE token_hash = ${s.token}`) as any[];
    expect(leak).toBeUndefined();
  });

  test("token phiên tra ra đúng danh tính và vai trò", async () => {
    const acc = await upsertAccount({ email: EMAIL, sub: "sub-1" });
    const s = await createSession(acc.id, "test");
    const p = await principalFromToken(s.token);
    expect(p?.email).toBe(EMAIL);
    expect(p?.role).toBe("lanh_dao");
  });

  test("token sai hoặc đã thu hồi thì không tra ra danh tính", async () => {
    expect(await principalFromToken("qdpl_khong_ton_tai")).toBeUndefined();
    const acc = await upsertAccount({ email: EMAIL, sub: "sub-1" });
    const s = await createSession(acc.id, "test");
    expect(await revokeSession(s.token)).toBe(true);
    expect(await principalFromToken(s.token)).toBeUndefined();
  });

  test("token đã hết hạn không dùng được", async () => {
    const acc = await upsertAccount({ email: EMAIL, sub: "sub-1" });
    const s = await createSession(acc.id, "test");
    await sql`UPDATE sessions SET expires_at = now() - interval '1 hour' WHERE token_hash = ${hashToken(s.token)}`;
    expect(await principalFromToken(s.token)).toBeUndefined();
  });

  test("khóa tài khoản thì token đang có cũng mất hiệu lực", async () => {
    const acc = await upsertAccount({ email: EMAIL2, sub: "sub-2" });
    const s = await createSession(acc.id, "test");
    expect(await principalFromToken(s.token)).toBeDefined();
    await setEnabled(EMAIL2, false, "quan-tri@vidu.vn");
    expect(await principalFromToken(s.token)).toBeUndefined();
  });

  test("thu hồi toàn bộ phiên của một tài khoản", async () => {
    const acc = await upsertAccount({ email: EMAIL, sub: "sub-1" });
    await createSession(acc.id, "a");
    await createSession(acc.id, "b");
    const n = await revokeAllForEmail(EMAIL);
    expect(n).toBeGreaterThanOrEqual(2);
  });

  test("liệt kê tài khoản trả về vai trò hiện tại", async () => {
    const rows = await listAccounts();
    const mine = rows.find((r) => r.email === EMAIL);
    expect(mine?.role).toBe("lanh_dao");
  });
});
