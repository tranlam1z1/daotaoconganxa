/**
 * Báo cáo tài khoản trong CSDL: vai trò hiện tại theo thang mới (5 bậc), đơn vị, cấp bậc.
 *
 * Dùng để rà lại tài khoản sau khi đổi thang vai trò (migration 0073) và sau khi đổi tên
 * đăng nhập (migration 0074): tài khoản nào đã ở đúng bậc, tài khoản nào còn lệch.
 *
 * Chạy với CSDL demo:  DATABASE_URL=postgres://qdpl:qdpl_dev@127.0.0.1:5436/quydinhphapluat_demo bun run scripts/tmp-liet-ke-tai-khoan.ts
 * Chạy với CSDL thật: đặt DATABASE_URL trong .env rồi `bun run scripts/tmp-liet-ke-tai-khoan.ts`
 */
import { sql } from "../packages/db/src/index.ts";

const BANG_VAI_TRO = ["khach", "can_bo", "lanh_dao", "quan_ly", "quan_tri"] as const;

const rows = await sql`
  SELECT a.username, a.email, a.name, a.role, a.enabled, a.xac_minh, a.la_khach,
         a.self_registered, a.rank_title, a.last_login_at, u.code AS don_vi, u.name AS ten_don_vi
  FROM accounts a LEFT JOIN units u ON u.id = a.unit_id
  ORDER BY a.la_khach, a.role, a.username`;

const kem = rows.filter((r: any) => !r.la_khach);
const khach = rows.filter((r: any) => r.la_khach);

console.log(`TỔNG: ${rows.length} tài khoản (${kem.length} cán bộ/quản trị, ${khach.length} khách)`);
for (const r of kem) {
  const thuoc = (BANG_VAI_TRO as readonly string[]).includes(r.role);
  const nhan =
    r.username === "quantri"
      ? "quantri"
      : r.username === "quanly"
        ? "quanly"
        : r.username?.startsWith("lanhdao.")
          ? "lanhdao.*"
          : r.username?.startsWith("canbo.")
            ? "canbo.*"
            : "-";
  console.log(
    [
      (r.username ?? r.email ?? "?").padEnd(16),
      (r.role + (thuoc ? "" : "  ← SAI THANG")).padEnd(12),
      (r.name ?? "-").padEnd(24),
      (r.don_vi ?? "(không đơn vị)").padEnd(10),
      (r.rank_title ?? "-").padEnd(24),
      r.enabled ? "" : "ĐÃ KHÓA",
      nhan !== "-" ? `tên đăng nhập: ${nhan}` : "",
    ]
      .filter(Boolean)
      .join("  "),
  );
}
if (khach.length) console.log(`\nTài khoản khách (tự dọn sau 30 ngày): ${khach.length}`);

process.exit(0);
