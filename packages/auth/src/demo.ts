/**
 * Tài khoản demo: đăng nhập bằng một mật khẩu chung để trình diễn khi chưa dùng được Google.
 *
 * Chỉ bật khi đặt AUTH_DEMO_PASSWORD; không đặt thì API trả 404 và trang đăng nhập không hiện ô
 * demo. Tài khoản demo là bản ghi thật trong bảng `accounts` (email miền demo.quydinhphapluat.vn),
 * nên phân quyền, nhật ký và mọi trang chạy như với tài khoản Google, và quản trị khóa được như
 * mọi tài khoản khác. Đổi hoặc bỏ mật khẩu là cách chấm dứt đăng nhập demo.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "@qdpl/db";
import type { AccountRow, Role } from "./rbac.ts";

export const DEMO_ACCOUNTS = {
  hoc_vien: { email: "hoc-vien@demo.quydinhphapluat.vn", name: "Học viên demo", role: "khach" },
  quan_tri: { email: "quan-tri@demo.quydinhphapluat.vn", name: "Quản trị demo", role: "quan_tri" },
} as const satisfies Record<string, { email: string; name: string; role: Role }>;

export type DemoKind = keyof typeof DEMO_ACCOUNTS;

export function demoEnabled(): boolean {
  return Boolean(process.env.AUTH_DEMO_PASSWORD?.trim());
}

/**
 * Tài khoản demo `quan_tri` bị tắt khi NODE_ENV=production, trừ khi đặt rõ AUTH_DEMO_ADMIN=1
 * (docs/PLAN.md GĐ0 S4): một mật khẩu chung lọt ra ngoài không được mở quyền quản trị máy chủ thật.
 * Tài khoản demo học viên không bị ảnh hưởng.
 */
export function demoQuanTriDuocPhep(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.AUTH_DEMO_ADMIN?.trim() === "1";
}

/** So mật khẩu qua bản băm cùng độ dài bằng timingSafeEqual: thời gian trả lời không lộ mật khẩu. */
export function checkDemoPassword(input: string): boolean {
  const expected = process.env.AUTH_DEMO_PASSWORD?.trim();
  if (!expected) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Tìm hoặc tạo tài khoản demo.
 *
 * Vai trò do mã quyết định nên luôn đặt lại theo DEMO_ACCOUNTS. Trạng thái khóa thì giữ nguyên:
 * quản trị đã khóa tài khoản demo thì đăng nhập demo không tự mở lại. Tài khoản demo không phải
 * người thật nên không vào hàng chờ xác minh cán bộ, kể cả khi mang vai trò `khach`.
 */
export async function demoAccount(kind: DemoKind): Promise<AccountRow> {
  const demo = DEMO_ACCOUNTS[kind];
  const [row] = (await sql`
    INSERT INTO accounts (email, name, role, note, last_login_at)
    VALUES (${demo.email}, ${demo.name}, ${demo.role}, 'Tài khoản demo (AUTH_DEMO_PASSWORD)', now())
    ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, xac_minh = 'da_xac_minh', last_login_at = now()
    RETURNING id, email, role, enabled, name, hosted_domain, (xmax = 0) AS vua_tao`) as any[];
  if (row.vua_tao) {
    await sql`INSERT INTO audit_log (actor, action, target, detail)
              VALUES ('he_thong', 'account:demo_create', ${demo.email}, ${sql.json({ role: demo.role } as any)})`;
  }
  const { vua_tao: _, ...account } = row;
  return account as AccountRow;
}
