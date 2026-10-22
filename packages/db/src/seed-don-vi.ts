/**
 * Gieo cây đơn vị mẫu và 11 tài khoản mẫu để trình diễn và thử nghiệm (docs/PLAN.md GĐ2).
 *
 * Cây: Phòng Cảnh sát giao thông (PC08) > Đội 1, Đội 2, Đội 3.
 * Tài khoản: 1 Admin quản trị hệ thống, 1 Admin quản lý, 2 lãnh đạo (phòng, đội 1),
 * 7 cán bộ.
 * Mật khẩu chung lấy từ SEED_MAT_KHAU (mặc định "Matkhau2026"); tài khoản mẫu KHÔNG bị bắt
 * đổi mật khẩu để người trình diễn đăng nhập được ngay. Không dùng cho môi trường thật.
 *
 * Chạy lại được nhiều lần: đơn vị và tài khoản đã có (theo mã, theo tên đăng nhập) thì bỏ qua.
 *
 * Chạy: bun run packages/db/src/seed-don-vi.ts
 */
import { sql } from "./client.ts";
import { layDonViTheoMa, taoDonVi } from "./don-vi.ts";

const ACTOR = "he_thong:seed-don-vi";
const MAT_KHAU = process.env.SEED_MAT_KHAU?.trim() || "Matkhau2026";

const DON_VI = [
  { code: "PC08", name: "Phòng Cảnh sát giao thông", levelLabel: "Phòng", cha: null, ordinal: 0 },
  { code: "PC08-D1", name: "Đội Tuần tra kiểm soát số 1", levelLabel: "Đội", cha: "PC08", ordinal: 1 },
  { code: "PC08-D2", name: "Đội Tuần tra kiểm soát số 2", levelLabel: "Đội", cha: "PC08", ordinal: 2 },
  { code: "PC08-D3", name: "Đội Điều tra giải quyết tai nạn", levelLabel: "Đội", cha: "PC08", ordinal: 3 },
] as const;

const TAI_KHOAN = [
  { username: "quantri", name: "Admin quản trị hệ thống", role: "quan_tri", donVi: null, capBac: null },
  { username: "quanly", name: "Admin quản lý", role: "quan_ly", donVi: null, capBac: null },
  // Tên đăng nhập đặt theo vai trò: `lanhdao.*` là lãnh đạo UBND xã (thang mới 5 bậc),
  // `quanly.*` là vai trò Cán bộ quản lý của thang cũ, đã bị gộp vào `lanh_dao`.
  {
    username: "lanhdao.phong",
    name: "Nguyễn Văn Hùng",
    role: "lanh_dao",
    donVi: "PC08",
    capBac: "Trung tá, Trưởng phòng",
  },
  {
    username: "lanhdao.doi1",
    name: "Trần Minh Đức",
    role: "lanh_dao",
    donVi: "PC08-D1",
    capBac: "Thiếu tá, Đội trưởng",
  },
  { username: "canbo.d1.01", name: "Lê Quang Huy", role: "can_bo", donVi: "PC08-D1", capBac: "Đại úy" },
  { username: "canbo.d1.02", name: "Phạm Thị Lan", role: "can_bo", donVi: "PC08-D1", capBac: "Thượng úy" },
  { username: "canbo.d1.03", name: "Hoàng Văn Nam", role: "can_bo", donVi: "PC08-D1", capBac: "Trung úy" },
  { username: "canbo.d2.01", name: "Vũ Đức Thắng", role: "can_bo", donVi: "PC08-D2", capBac: "Đại úy" },
  { username: "canbo.d2.02", name: "Đỗ Thị Hạnh", role: "can_bo", donVi: "PC08-D2", capBac: "Thiếu úy" },
  { username: "canbo.d3.01", name: "Bùi Văn Tuấn", role: "can_bo", donVi: "PC08-D3", capBac: "Thượng úy" },
  { username: "canbo.d3.02", name: "Ngô Thanh Tâm", role: "can_bo", donVi: "PC08-D3", capBac: "Trung úy" },
] as const;

const idTheoMa = new Map<string, string>();
for (const d of DON_VI) {
  const co = await layDonViTheoMa(d.code);
  if (co) {
    idTheoMa.set(d.code, co.id);
    continue;
  }
  const moi = await taoDonVi(
    {
      code: d.code,
      name: d.name,
      levelLabel: d.levelLabel,
      ordinal: d.ordinal,
      parentId: d.cha ? (idTheoMa.get(d.cha) ?? null) : null,
    },
    ACTOR,
  );
  idTheoMa.set(d.code, moi.id);
  console.log(`+ đơn vị ${d.code} — ${d.name}`);
}

const hash = await Bun.password.hash(MAT_KHAU, { algorithm: "argon2id" });
let taoMoi = 0;
for (const t of TAI_KHOAN) {
  const [row] = (await sql`
    INSERT INTO accounts (username, name, role, unit_id, rank_title, password_hash, must_change_password)
    VALUES (${t.username}, ${t.name}, ${t.role}, ${t.donVi ? (idTheoMa.get(t.donVi) ?? null) : null},
            ${t.capBac}, ${hash}, false)
    ON CONFLICT (username) WHERE username IS NOT NULL DO NOTHING
    RETURNING id`) as any[];
  if (row) {
    taoMoi++;
    console.log(`+ tài khoản ${t.username} (${t.role})`);
  }
}
if (taoMoi) {
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES (${ACTOR}, 'nguoi_dung:gieo_mau', ${`${taoMoi} tài khoản`}, ${sql.json({} as never)})`;
}

console.log(
  `\nĐã có ${DON_VI.length} đơn vị và ${TAI_KHOAN.length} tài khoản mẫu (tạo mới ${taoMoi}). ` +
    `Mật khẩu của tài khoản tạo mới: ${MAT_KHAU}`,
);
await sql.end();
