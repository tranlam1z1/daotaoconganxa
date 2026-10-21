/**
 * Phiên làm việc dùng chung cho web và MCP server.
 *
 * ID token của Google chỉ sống khoảng một giờ và không nên đưa thẳng vào cookie hay
 * cấu hình MCP client. Vì vậy hệ thống đổi ID token đã kiểm chứng lấy MỘT token phiên
 * riêng, có hạn dài hơn, thu hồi được, và chỉ lưu dạng băm trong CSDL.
 */
import { createHash } from "node:crypto";
import { sql } from "@qdpl/db";
import type { Principal, Role } from "./rbac.ts";

const DEFAULT_TTL_HOURS = Number(
  process.env.AUTH_SESSION_TTL_HOURS ?? process.env.MCP_SESSION_TTL_HOURS ?? 24 * 14,
);

// node:crypto thay cho Bun.CryptoHasher: gói này còn được nạp bởi máy chủ web chạy trên Node.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `qdpl_${b64}`;
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  accountId: string,
  client?: string,
  ttlHours: number = DEFAULT_TTL_HOURS,
): Promise<IssuedSession> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
  await sql`
    INSERT INTO sessions (account_id, token_hash, client, expires_at)
    VALUES (${accountId}, ${hashToken(token)}, ${client ?? null}, ${expiresAt})`;
  return { token, expiresAt };
}

/**
 * Tra token phiên -> danh tính. Trả undefined nếu token sai, hết hạn, bị thu hồi, hoặc tài khoản bị khóa.
 * Chế độ khách (chỉ nhập tên, migration 0062) đã tắt: phiên của tài khoản khách còn sót trong CSDL
 * không còn là danh tính. Tiến độ của khách vẫn gộp được khi người đó đăng nhập (khach.ts).
 */
export async function principalFromToken(token: string): Promise<Principal | undefined> {
  const [row] = (await sql`
    SELECT s.id AS session_id, a.id AS account_id, a.email, a.username, a.name, a.role, a.enabled,
           a.hosted_domain, a.unit_id, u.path::text AS unit_path, a.must_change_password, a.la_khach,
           a.xac_minh
    FROM sessions s
    JOIN accounts a ON a.id = s.account_id
    LEFT JOIN units u ON u.id = a.unit_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1`) as any[];
  if (!row?.enabled || row.la_khach) return undefined;
  await sql`UPDATE sessions SET last_used_at = now() WHERE id = ${row.session_id}`;
  return {
    accountId: row.account_id,
    // Tài khoản cán bộ có thể không có email: dùng tên đăng nhập làm định danh ghi nhật ký.
    email: row.email ?? row.username,
    name: row.name ?? undefined,
    role: row.role as Role,
    // Tài khoản Google không có tên đăng nhập; tài khoản cán bộ luôn có.
    source: row.username ? "mat_khau" : "google",
    hostedDomain: row.hosted_domain ?? undefined,
    ...(row.username ? { username: row.username } : {}),
    ...(row.unit_id ? { unitId: row.unit_id, unitPath: row.unit_path } : {}),
    mustChangePassword: Boolean(row.must_change_password),
    ...(row.xac_minh !== "da_xac_minh" ? { choXacMinh: true } : {}),
  };
}

export async function revokeSession(token: string): Promise<boolean> {
  const [row] = (await sql`
    UPDATE sessions SET revoked_at = now() WHERE token_hash = ${hashToken(token)} AND revoked_at IS NULL
    RETURNING id`) as any[];
  return Boolean(row);
}

export async function revokeAllForEmail(email: string): Promise<number> {
  const rows = (await sql`
    UPDATE sessions s SET revoked_at = now()
    FROM accounts a WHERE a.id = s.account_id AND a.email = ${email} AND s.revoked_at IS NULL
    RETURNING s.id`) as any[];
  return rows.length;
}

/** Xóa phiên đã hết hạn quá lâu, chạy định kỳ. */
export async function purgeExpiredSessions(olderThanDays = 30): Promise<number> {
  const rows = (await sql`
    DELETE FROM sessions WHERE expires_at < now() - (${olderThanDays} * interval '1 day') RETURNING id`) as any[];
  return rows.length;
}
