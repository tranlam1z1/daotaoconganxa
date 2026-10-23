/** Tạo tài khoản theo vai trò trên DATABASE_URL; không sửa tài khoản đã tồn tại. */
import { randomBytes } from "node:crypto";
import type { Role } from "../packages/auth/src/rbac.ts";
import { sql } from "../packages/db/src/client.ts";

const TAI_KHOAN: Array<{ role: Role; username: string; name: string }> = [
  { role: "khach", username: "nguyenminhanh", name: "Nguyễn Minh Anh" },
  { role: "can_bo", username: "tranquanghuy", name: "Trần Quang Huy" },
  { role: "lanh_dao", username: "lethanhson", name: "Lê Thanh Sơn" },
  { role: "quan_ly", username: "phamthulan", name: "Phạm Thu Lan" },
  { role: "quan_tri", username: "nguyenducthang", name: "Nguyễn Đức Thắng" },
];

try {
  await sql.begin(async (tx) => {
    for (const { role, username, name } of TAI_KHOAN) {
      // Chuyển tài khoản đã cấp sang tên người, giữ nguyên mật khẩu và dữ liệu liên quan.
      const [renamed] = await tx`
        UPDATE accounts SET username = ${username}, name = ${name}
        WHERE username = ${`${role}.hethong`} AND role = ${role}
        RETURNING id`;
      if (renamed) {
        await tx`INSERT INTO audit_log (actor, action, target, detail)
          VALUES ('he_thong:tao-tai-khoan-vai-tro', 'nguoi_dung:doi_ten', ${username},
                  ${tx.json({ role, accountId: renamed.id, oldUsername: `${role}.hethong`, name })})`;
        console.log(`${username}: đã đổi tên thành ${name}, giữ nguyên mật khẩu.`);
        continue;
      }
      const password = `Cx!${randomBytes(12).toString("base64url")}9a`;
      const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
      const [account] = await tx`
        INSERT INTO accounts (username, name, role, password_hash, must_change_password, xac_minh)
        VALUES (${username}, ${name}, ${role}, ${hash}, true, 'da_xac_minh')
        ON CONFLICT (username) WHERE username IS NOT NULL DO NOTHING
        RETURNING id`;
      if (!account) {
        console.log(`${username}: đã tồn tại, giữ nguyên.`);
        continue;
      }
      await tx`INSERT INTO audit_log (actor, action, target, detail)
        VALUES ('he_thong:tao-tai-khoan-vai-tro', 'nguoi_dung:tao', ${username},
                ${tx.json({ role, accountId: account.id })})`;
      console.log(JSON.stringify({ username, role, password, phai_doi_mat_khau: true }));
    }
  });
  console.log("Đã lưu tài khoản vào CSDL chính.");
} finally {
  await sql.end();
}
