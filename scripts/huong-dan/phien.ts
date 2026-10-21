/**
 * Phiên đăng nhập để chụp hình các trang cần đăng nhập (tài khoản, quản trị).
 *
 * Dùng một tài khoản minh hoạ riêng, không mượn tài khoản của người thật. Tài khoản này không đăng nhập
 * được bằng Google (không có google_sub, email thuộc miền .invalid) và bị khoá ngoài lúc chụp: mở khoá,
 * cấp phiên hạn 2 giờ, chụp xong thì thu hồi phiên và khoá lại. Mỗi lần mở khoá đều ghi audit_log.
 */
export const TAI_KHOAN_MINH_HOA = {
  email: "minh-hoa.huong-dan@quydinhphapluat.invalid",
  ten: "Tài khoản minh hoạ",
  vaiTro: "quan_tri",
} as const;

export interface Phien {
  token: string;
  thuHoi: () => Promise<void>;
}

export async function layPhien(): Promise<Phien> {
  if (process.env.HUONG_DAN_TOKEN) return { token: process.env.HUONG_DAN_TOKEN, thuHoi: async () => {} };

  const { sql } = await import("@qdpl/db");
  const { createSession, hashToken, revokeSession } = await import("@qdpl/auth");
  const tk = TAI_KHOAN_MINH_HOA;
  const [row] = (await sql`
    INSERT INTO accounts (email, name, role, enabled, note)
    VALUES (${tk.email}, ${tk.ten}, ${tk.vaiTro}, true,
            ${"Tài khoản thử nghiệm để chụp hình hướng dẫn sử dụng; bị khoá ngoài lúc chụp."})
    ON CONFLICT (email) DO UPDATE SET enabled = true, role = EXCLUDED.role, name = EXCLUDED.name
    RETURNING id, (xmax = 0) AS vua_tao`) as any[];
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES ('he_thong', ${row.vua_tao ? "account:huong_dan_tao" : "account:huong_dan_mo_khoa"},
                    ${tk.email}, ${sql.json({ ly_do: "chup hinh huong dan su dung" } as any)})`;

  const { token } = await createSession(row.id, "huong-dan");
  // Phiên chỉ sống đủ cho một lần chụp, kể cả khi tiến trình bị ngắt trước lúc thu hồi.
  await sql`UPDATE sessions SET expires_at = now() + interval '2 hours' WHERE token_hash = ${hashToken(token)}`;

  return {
    token,
    thuHoi: async () => {
      await revokeSession(token);
      // Có thể nhiều lần chụp chạy song song: chỉ khoá khi không còn phiên chụp nào khác đang dùng.
      await sql`
        UPDATE accounts SET enabled = false
        WHERE id = ${row.id}
          AND NOT EXISTS (SELECT 1 FROM sessions
                          WHERE account_id = ${row.id} AND revoked_at IS NULL AND expires_at > now())`;
      await sql.end({ timeout: 5 });
    },
  };
}
