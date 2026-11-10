/** Dữ liệu mẫu cho công chức, viên chức, đảng viên.
 * Chạy bình thường chỉ bổ sung dữ liệu thiếu.
 * --cap-nhat-mau chuyển bộ mẫu PC08 cũ, giữ ID, mật khẩu, phiên và lịch sử.
 * Chỉ dùng cho CSDL thử nghiệm/demo; mật khẩu tài khoản mới: SEED_MAT_KHAU.
 */
import { sql } from "./client.ts";

const capNhat = process.argv.includes("--cap-nhat-mau");
const donVi = [
  ["PC08", "XA-MH", "Xã Minh Hòa (mẫu)", "Xã", "xa"],
  ["PC08-D1", "UBND-MH", "UBND xã Minh Hòa (mẫu)", "Cơ quan hành chính", "co_quan_hanh_chinh"],
  ["PC08-D2", "TH-MH", "Trường Tiểu học Minh Hòa (mẫu)", "Đơn vị sự nghiệp", "don_vi_su_nghiep"],
  ["PC08-D3", "DU-MH", "Đảng ủy xã Minh Hòa (mẫu)", "Tổ chức Đảng", "to_chuc_dang"],
] as const;
const taiKhoan = [
  ["quantri", "quantri", "Quản trị hệ thống", "quan_tri", null, "Quản trị viên", []],
  ["quanly", "quanly", "Quản lý nội dung", "quan_ly", null, "Quản lý nội dung học tập", []],
  [
    "lanhdao.phong",
    "lanhdao.xa",
    "Nguyễn Văn Hùng",
    "lanh_dao",
    "XA-MH",
    "Lãnh đạo xã",
    ["cong_chuc_cap_xa", "dang_vien"],
  ],
  [
    "lanhdao.doi1",
    "lanhdao.ubnd",
    "Trần Minh Đức",
    "lanh_dao",
    "UBND-MH",
    "Lãnh đạo UBND xã",
    ["cong_chuc_cap_xa", "dang_vien"],
  ],
  [
    "canbo.d1.01",
    "congchuc.01",
    "Lê Quang Huy",
    "can_bo",
    "UBND-MH",
    "Chuyên viên",
    ["cong_chuc_cap_xa", "dang_vien"],
  ],
  ["canbo.d1.02", "congchuc.02", "Phạm Thị Lan", "can_bo", "UBND-MH", "Chuyên viên", ["cong_chuc_cap_xa"]],
  ["canbo.d1.03", "congchuc.03", "Hoàng Văn Nam", "can_bo", "UBND-MH", "Chuyên viên", ["cong_chuc_cap_xa"]],
  ["canbo.d2.01", "vienchuc.01", "Vũ Đức Thắng", "can_bo", "TH-MH", "Giáo viên", ["vien_chuc", "dang_vien"]],
  ["canbo.d2.02", "vienchuc.02", "Đỗ Thị Hạnh", "can_bo", "TH-MH", "Giáo viên", ["vien_chuc"]],
  ["canbo.d3.01", "dangvien.01", "Bùi Văn Tuấn", "can_bo", "DU-MH", "Đảng viên", ["dang_vien"]],
  ["canbo.d3.02", "dangvien.02", "Ngô Thanh Tâm", "can_bo", "DU-MH", "Đảng viên", ["dang_vien"]],
] as const;

try {
  const hash = await Bun.password.hash(process.env.SEED_MAT_KHAU?.trim() || "Matkhau2026", {
    algorithm: "argon2id",
  });
  await sql.begin(async (tx) => {
    const ids = new Map<string, string>();
    for (const [i, [cu, code, name, label, loai]] of donVi.entries()) {
      if (capNhat) {
        await tx`UPDATE units SET code = ${code}, name = ${name}, level_label = ${label}, loai = ${loai}, updated_at = now() WHERE code = ${cu}`;
      }
      let [unit] = await tx`SELECT id, path::text AS path FROM units WHERE code = ${code}`;
      if (!unit) {
        const id = crypto.randomUUID();
        const nhan = `u${id.replace(/-/g, "")}`;
        const parentId = i === 0 ? null : ids.get("XA-MH")!;
        const [parent] = parentId
          ? await tx`SELECT path::text AS path FROM units WHERE id = ${parentId}`
          : [];
        [unit] = await tx`INSERT INTO units (id, code, name, parent_id, path, level_label, ordinal, loai)
          VALUES (${id}, ${code}, ${name}, ${parentId}, ${parent ? `${parent.path}.${nhan}` : nhan}::ltree, ${label}, ${i}, ${loai}) RETURNING id`;
      }
      ids.set(code, unit!.id);
    }
    for (const [cu, username, name, role, code, title, groups] of taiKhoan) {
      const unitId = code ? ids.get(code)! : null;
      if (capNhat) {
        // Chỉ cập nhật các tên mẫu được liệt kê; xung đột tên sẽ rollback cả giao dịch.
        await tx`UPDATE accounts SET username = ${username}, name = ${name}, role = ${role},
          unit_id = ${unitId}, rank_title = ${title}, nhom_doi_tuong = ${[...groups]}::text[]
          WHERE username = ${cu} OR username = ${username}`;
      }
      await tx`INSERT INTO accounts (username, name, role, unit_id, rank_title, nhom_doi_tuong, password_hash, must_change_password, xac_minh)
        VALUES (${username}, ${name}, ${role}, ${unitId}, ${title}, ${[...groups]}::text[], ${hash}, false, 'da_xac_minh')
        ON CONFLICT (username) WHERE username IS NOT NULL DO NOTHING`;
    }
    await tx`INSERT INTO audit_log (actor, action, target, detail)
      VALUES ('he_thong:seed-don-vi', 'nguoi_dung:gieo_mau', 'cong_chuc_vien_chuc_dang_vien',
        ${tx.json({ capNhat, taiKhoan: taiKhoan.map(([cu, username]) => ({ cu, username })) })})`;
  });
  console.log(
    `Đã chuẩn bị ${donVi.length} đơn vị và ${taiKhoan.length} tài khoản mẫu. Giữ mật khẩu của tài khoản đã có.`,
  );
} finally {
  await sql.end();
}
