/**
 * Chế độ khách (migration 0062) đã tắt: không tạo được khách mới, phiên khách cũ không còn là danh
 * tính. Phần còn lại là lối chuyển tiếp cho khách cũ: gộp tiến độ khi đăng ký hoặc đăng nhập, và dọn
 * tài khoản khách bỏ không quá 30 ngày.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { donTaiKhoanKhach, GOP_TIEN_DO_BANG, sql, taoDonVi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const EMAIL = "test-khach-gop@vidu.vn";

const taoRa: string[] = [];

afterAll(async () => {
  if (taoRa.length) await sql`DELETE FROM accounts WHERE id IN ${sql(taoRa)}`;
  await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
  await sql`DELETE FROM units WHERE code = 'test-khach-gop-dv'`;
});

async function goi(method: string, path: string, body?: unknown, token?: string) {
  const res = await app.request(`http://test${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

/** Tài khoản khách còn sót từ trước khi tắt chế độ khách, kèm một phiên chưa hết hạn. */
async function taoKhachCu(ten = "Khách thử"): Promise<{ token: string; id: string }> {
  const [tk] = (await sql`
    INSERT INTO accounts (name, role, la_khach, note) VALUES (${ten}, 'khach', true, 'Tài khoản khách')
    RETURNING id`) as any[];
  taoRa.push(tk.id);
  return { token: (await createSession(tk.id, "test")).token, id: tk.id };
}

describe("chế độ khách đã tắt", () => {
  test("không còn endpoint tạo khách hay đổi tên khách", async () => {
    expect((await goi("POST", "/v1/auth/khach", { ten: "Nguyễn Văn An" })).status).toBe(404);
    const { token } = await taoKhachCu();
    expect((await goi("PATCH", "/v1/auth/khach", { ten: "Tên mới" }, token)).status).toBe(404);
  });

  test("phiên khách cũ không còn là danh tính ở bất kỳ nhóm API nào", async () => {
    const { token } = await taoKhachCu();
    for (const duong of ["/v1/auth/me", "/v1/toi/lich-su", "/v1/luyen-tap/chu-de", "/v1/thi", "/v1/nhom"]) {
      expect((await goi("GET", duong, undefined, token)).status).toBe(401);
    }
    expect((await goi("POST", "/v1/auth/mcp-token", {}, token)).status).toBe(401);
  });
});

describe("chuyển tiếp cho khách cũ", () => {
  test("đăng ký kèm token khách: tiến độ được gộp, tài khoản khách bị xóa", async () => {
    const khach = await taoKhachCu("Người học thử");
    // Hai ngày học của khách: hôm kia và hôm qua (giờ Việt Nam không quan trọng ở đây).
    await sql`
      INSERT INTO daily_activity (account_id, day, xp)
      VALUES (${khach.id}, current_date - 2, 30), (${khach.id}, current_date - 1, 20)`;

    await sql`DELETE FROM units WHERE code = 'test-khach-gop-dv'`;
    const donVi = await taoDonVi({ code: "test-khach-gop-dv", name: "Đội gộp khách thử" }, "test-khach-gop");
    const dk = await goi("POST", "/v1/auth/dang-ky", {
      ten: "Người học thử",
      email: EMAIL,
      so_dien_thoai: "0912345678",
      mat_khau: "matkhau123",
      so_hieu: "123456",
      don_vi_id: donVi.id,
      token_khach: khach.token,
    });
    expect(dk.status).toBe(200);
    expect(dk.body.da_gop_khach).toBe(true);

    const [that] = (await sql`SELECT id FROM accounts WHERE email = ${EMAIL}`) as any[];
    const [conKhach] = (await sql`SELECT id FROM accounts WHERE id = ${khach.id}`) as any[];
    expect(conKhach).toBeUndefined();

    const [ngay] = (await sql`
      SELECT count(*)::int AS n FROM daily_activity WHERE account_id = ${that.id}`) as any[];
    expect(ngay.n).toBe(2);
  });

  test("token không phải khách thì không gộp gì, đăng nhập vẫn thành công", async () => {
    const dn = await goi("POST", "/v1/auth/mat-khau", {
      ten_dang_nhap: EMAIL,
      mat_khau: "matkhau123",
      token_khach: "qdpl_khong-phai-token-that",
    });
    expect(dn.status).toBe(200);
    expect(dn.body.da_gop_khach).toBe(false);
  });

  test("tài khoản khách bỏ không quá 30 ngày bị dọn", async () => {
    const cu = await taoKhachCu("Khách cũ");
    const moi = await taoKhachCu("Khách mới");
    await sql`UPDATE accounts SET created_at = now() - interval '40 days' WHERE id IN (${cu.id}, ${moi.id})`;
    await sql`
      UPDATE sessions SET created_at = now() - interval '40 days', last_used_at = now() - interval '31 days'
      WHERE account_id = ${cu.id}`;

    await donTaiKhoanKhach();
    const con = (await sql`SELECT id FROM accounts WHERE id IN (${cu.id}, ${moi.id})`) as any[];
    expect(con.map((r) => r.id)).toEqual([moi.id]);
  });
});

/**
 * Bảng có khóa ngoại tới `accounts` mà khách không thể có dữ liệu (API từng chặn khách ở các nhóm này)
 * hoặc là nhật ký tự đặt NULL khi xóa tài khoản. Bảng mới có khóa ngoại tới `accounts` phải được
 * xếp vào đây hoặc vào GOP_TIEN_DO_BANG (packages/db/src/tai-khoan-khach.ts).
 */
const KHONG_GOP = [
  // Game đã rút khỏi luồng học hiện tại; dữ liệu cũ không thuộc tiến độ được chuyển tiếp.
  "account_badges",
  "game_level_progress",
  "game_packs",
  "game_progress",
  "game_runs",
  "game_scores",
  "streaks",
  "xp_ledger",
  // Phiên khách đã bị vô hiệu hóa trước khi thêm API lịch sử tra cứu theo tài khoản.
  "search_histories",
  "sessions",
  "mcp_call_log",
  "access_log",
  "ask_logs",
  "exam_assignments",
  "exam_attempts",
  "push_subscriptions",
  "notification_prefs",
  "notifications_sent",
  "study_groups",
  "study_group_members",
  "study_group_items",
  "study_group_cheers",
  "study_group_join_attempts",
  "study_group_ai_notes",
];

describe("gộp tiến độ khách phủ mọi bảng", () => {
  test("mọi bảng tham chiếu accounts đều được gộp hoặc được ghi rõ là không cần gộp", async () => {
    const rows = (await sql`
      SELECT DISTINCT cl.relname AS bang
      FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE c.contype = 'f' AND c.confrelid = 'accounts'::regclass`) as any[];
    const daXep = new Set<string>([...GOP_TIEN_DO_BANG, ...KHONG_GOP]);
    expect(rows.map((r) => r.bang).filter((b: string) => !daXep.has(b))).toEqual([]);
  });
});
