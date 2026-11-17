/** Đơn vị và tài khoản mẫu cho Công an xã: đơn vị Công an xã, chi bộ Công an xã, hai tài khoản quản trị
 * hệ thống và các tài khoản cán bộ, chiến sĩ.
 * Chạy lại chỉ bổ sung phần còn thiếu, không đổi mật khẩu tài khoản đã có.
 * Chỉ dùng cho CSDL thử nghiệm/demo; mật khẩu tài khoản mới: SEED_MAT_KHAU.
 */
import { sql } from "./client.ts";

type Loai = "xa" | "to_chuc_dang" | "khac";
// [mã, tên, nhãn cấp, loại, mã đơn vị cha]
const donVi: [string, string, string, Loai, string | null][] = [
  ["XA-MH", "Xã Minh Hòa (mẫu)", "Xã", "xa", null],
  ["CA-MH", "Công an xã Minh Hòa (mẫu)", "Công an xã", "khac", "XA-MH"],
  ["CB-CA-MH", "Chi bộ Công an xã Minh Hòa (mẫu)", "Tổ chức Đảng", "to_chuc_dang", "CA-MH"],
];
const CHI_BO = "CB-CA-MH";

type VaiTro = "quan_tri" | "quan_ly" | "lanh_dao" | "can_bo";
type Nhom = "cong_an_cap_xa" | "dang_vien";
// [tên đăng nhập, họ tên, vai trò, mã đơn vị công tác, chức vụ, nhóm đối tượng]
const taiKhoan: [string, string, VaiTro, string | null, string, Nhom[]][] = [
  ["quantri", "Quản trị hệ thống", "quan_tri", null, "Quản trị viên", []],
  ["quanly", "Quản lý nội dung", "quan_ly", null, "Quản lý nội dung học tập", []],
  [
    "truong.cax",
    "Nguyễn Đình Khánh",
    "lanh_dao",
    "CA-MH",
    "Trưởng Công an xã",
    ["cong_an_cap_xa", "dang_vien"],
  ],
  [
    "pho.cax.01",
    "Lê Văn Thành",
    "lanh_dao",
    "CA-MH",
    "Phó Trưởng Công an xã",
    ["cong_an_cap_xa", "dang_vien"],
  ],
  [
    "pho.cax.02",
    "Trịnh Thị Mai",
    "lanh_dao",
    "CA-MH",
    "Phó Trưởng Công an xã",
    ["cong_an_cap_xa", "dang_vien"],
  ],
  ["cax.01", "Phạm Văn Long", "can_bo", "CA-MH", "Cảnh sát khu vực", ["cong_an_cap_xa", "dang_vien"]],
  ["cax.02", "Hoàng Minh Tú", "can_bo", "CA-MH", "Cảnh sát khu vực", ["cong_an_cap_xa"]],
  ["cax.03", "Đặng Quốc Việt", "can_bo", "CA-MH", "Cán bộ an ninh", ["cong_an_cap_xa", "dang_vien"]],
  ["cax.04", "Lương Thị Hà", "can_bo", "CA-MH", "Cán bộ tổng hợp", ["cong_an_cap_xa"]],
  ["cax.05", "Mai Xuân Bách", "can_bo", "CA-MH", "Cán bộ cảnh sát trật tự", ["cong_an_cap_xa"]],
];

try {
  const hash = await Bun.password.hash(process.env.SEED_MAT_KHAU?.trim() || "Matkhau2026", {
    algorithm: "argon2id",
  });
  await sql.begin(async (tx) => {
    const ids = new Map<string, string>();
    for (const [code, name, label, loai, chaCode] of donVi) {
      let [unit] = await tx`SELECT id FROM units WHERE code = ${code}`;
      if (!unit) {
        const id = crypto.randomUUID();
        const nhan = `u${id.replace(/-/g, "")}`;
        const chaId = chaCode ? ids.get(chaCode)! : null;
        const [cha] = chaId ? await tx`SELECT path::text AS path FROM units WHERE id = ${chaId}` : [];
        const [{ ordinal }] = chaId
          ? await tx`SELECT coalesce(max(ordinal) + 1, 0)::int AS ordinal FROM units WHERE parent_id = ${chaId}`
          : await tx`SELECT coalesce(max(ordinal) + 1, 0)::int AS ordinal FROM units WHERE parent_id IS NULL`;
        [unit] = await tx`INSERT INTO units (id, code, name, parent_id, path, level_label, ordinal, loai)
          VALUES (${id}, ${code}, ${name}, ${chaId}, ${cha ? `${cha.path}.${nhan}` : nhan}::ltree,
            ${label}, ${ordinal}, ${loai})
          RETURNING id`;
      }
      ids.set(code, unit!.id);
    }

    for (const [username, name, role, code, title, groups] of taiKhoan) {
      const unitId = code ? ids.get(code)! : null;
      const chiBo = groups.includes("dang_vien") ? ids.get(CHI_BO)! : null;
      await tx`INSERT INTO accounts (username, name, role, unit_id, party_unit_id, rank_title, nhom_doi_tuong,
          password_hash, must_change_password, xac_minh)
        VALUES (${username}, ${name}, ${role}, ${unitId}, ${chiBo}, ${title}, ${groups}::text[],
          ${hash}, false, 'da_xac_minh')
        ON CONFLICT (username) WHERE username IS NOT NULL DO NOTHING`;
    }
    await tx`INSERT INTO audit_log (actor, action, target, detail)
      VALUES ('he_thong:seed-don-vi', 'nguoi_dung:gieo_mau', 'cong_an_xa',
        ${tx.json({ donVi: donVi.map(([code]) => code), taiKhoan: taiKhoan.map(([username]) => username) })})`;
  });
  console.log(
    `Đã chuẩn bị ${donVi.length} đơn vị và ${taiKhoan.length} tài khoản mẫu Công an xã. Giữ mật khẩu của tài khoản đã có.`,
  );
} finally {
  await sql.end();
}
