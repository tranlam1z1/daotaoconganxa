/**
 * Tài khoản khách (migration 0062) đã tắt: không tạo khách mới, phiên khách không còn là danh tính
 * (session.ts). Học và chơi cần tài khoản đã được xác minh cán bộ.
 *
 * Tệp này chỉ còn lối chuyển tiếp cho khách cũ: người từng học bằng tên khách đăng nhập hoặc đăng ký
 * trên cùng máy thì gopKhachVaoTaiKhoan chuyển tiến độ sang tài khoản thật rồi xóa tài khoản khách.
 * Khách không ai nhận lại được worker xóa sau KHACH_NGAY_KHONG_HOAT_DONG ngày (@qdpl/db).
 */
import { gopTienDoKhach, KHACH_NGAY_KHONG_HOAT_DONG, sql } from "@qdpl/db";
import { hashToken } from "./session.ts";

/**
 * Gộp tiến độ của khách giữ token `tokenKhach` vào tài khoản thật `thatId`, rồi xóa tài khoản khách
 * (phiên khách mất theo). Gọi ngay sau khi tài khoản thật đăng nhập hoặc đăng ký thành công.
 *
 * Token không phải phiên khách còn hiệu lực thì bỏ qua, trả false: đăng nhập vẫn thành công, chỉ
 * không có gì để gộp. Token chỉ đến từ cookie HttpOnly trên máy của chính người đăng nhập.
 */
export async function gopKhachVaoTaiKhoan(tokenKhach: string, thatId: string): Promise<boolean> {
  return (await sql.begin(async (tx) => {
    const [khach] = (await tx`
      SELECT a.id FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = ${hashToken(tokenKhach)}
        AND s.revoked_at IS NULL AND s.expires_at > now() AND a.la_khach
        AND COALESCE(s.last_used_at, s.created_at) > now() - (${KHACH_NGAY_KHONG_HOAT_DONG} * interval '1 day')
      LIMIT 1`) as any[];
    if (!khach || khach.id === thatId) return false;
    const [that] =
      (await tx`SELECT id FROM accounts WHERE id = ${thatId} AND NOT la_khach FOR UPDATE`) as any[];
    if (!that) return false;
    // Khóa dòng khách: hai lần đăng nhập cùng lúc từ một máy không gộp hai lần.
    const [conKhach] = (await tx`SELECT id FROM accounts WHERE id = ${khach.id} FOR UPDATE`) as any[];
    if (!conKhach) return false;

    await gopTienDoKhach(tx, khach.id, thatId);
    await tx`DELETE FROM accounts WHERE id = ${khach.id}`;
    await tx`
      INSERT INTO audit_log (actor, action, target, detail)
      VALUES ('he_thong', 'tai_khoan:gop_khach', ${thatId}, ${tx.json({ khach: khach.id } as any)})`;
    return true;
  })) as unknown as boolean;
}
