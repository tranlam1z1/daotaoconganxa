/**
 * Tài khoản cán bộ (docs/PLAN.md GĐ2): danh sách theo phạm vi đơn vị, tạo, sửa, nhập hàng loạt.
 *
 * Gói này không phụ thuộc @qdpl/auth (chiều phụ thuộc ngược lại), nên việc băm mật khẩu và
 * quy tắc tên đăng nhập do người gọi truyền vào dưới dạng hàm.
 */
import { sql } from "./client.ts";
import { LoiNghiepVu } from "./don-vi.ts";
import { type CotDoc, chuanHoaTieuDe, type DongExcel, taoTepExcel } from "./excel.ts";

export interface NguoiDungHang {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  role: string;
  nhom_doi_tuong: string[];
  enabled: boolean;
  unit_id: string | null;
  unit_code: string | null;
  unit_name: string | null;
  unit_path: string | null;
  rank_title: string | null;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  /** Xác minh cán bộ (migration 0064). */
  xac_minh: "cho_duyet" | "da_xac_minh" | "tu_choi";
  so_hieu: string | null;
  phone: string | null;
  self_registered: boolean;
  /** Đơn vị người dùng tự khai khi đăng ký; người duyệt đối chiếu rồi gắn đơn vị thật. */
  don_vi_khai: string | null;
  don_vi_khai_name: string | null;
  xac_minh_ly_do: string | null;
  xac_minh_boi: string | null;
  xac_minh_luc: string | null;
  /**
   * Đường dẫn dùng để xét phạm vi quản lý: đơn vị đang gắn, hoặc (khi chưa được xác minh và chưa
   * gắn đơn vị) đơn vị đã khai, để cán bộ quản lý của đơn vị đó thấy và duyệt được.
   */
  pham_vi_path: string | null;
}

/** Bảng nguồn: tài khoản, đơn vị đang gắn (u) và đơn vị đã khai (k). */
const TU = sql`accounts a LEFT JOIN units u ON u.id = a.unit_id LEFT JOIN units k ON k.id = a.don_vi_khai`;

const PHAM_VI = sql`COALESCE(u.path, CASE WHEN a.xac_minh <> 'da_xac_minh' THEN k.path END)`;

const COT = sql`
  a.id, a.username, a.email, a.name, a.role, a.nhom_doi_tuong, a.enabled, a.unit_id,
  u.code AS unit_code, u.name AS unit_name, u.path::text AS unit_path,
  a.rank_title, a.must_change_password, a.last_login_at, a.created_at,
  a.xac_minh, a.so_hieu, a.phone, a.self_registered, a.don_vi_khai, k.name AS don_vi_khai_name,
  a.xac_minh_ly_do, a.xac_minh_boi, a.xac_minh_luc, (${PHAM_VI})::text AS pham_vi_path`;

export interface LocNguoiDung {
  /** Đường dẫn ltree giới hạn phạm vi được xem; null là toàn bộ (chỉ quản trị). */
  phamVi: string | null;
  /** Lọc theo một đơn vị, gồm cả đơn vị con. */
  donViPath?: string | null;
  q?: string;
  /** Chỉ lấy tài khoản ở trạng thái xác minh này; "chua_xac_minh" gồm cả chờ duyệt và bị từ chối. */
  xacMinh?: "cho_duyet" | "tu_choi" | "chua_xac_minh";
  gioiHan?: number;
  trang?: number;
}

export async function danhSachNguoiDung(
  loc: LocNguoiDung,
): Promise<{ items: NguoiDungHang[]; total: number }> {
  const gioiHan = loc.gioiHan ?? 50;
  const boQua = ((loc.trang ?? 1) - 1) * gioiHan;
  const tuKhoa = loc.q?.trim() ? `%${loc.q.trim()}%` : null;
  const xacMinh = loc.xacMinh ?? null;
  // Tài khoản khách (chỉ nhập tên, tự dọn sau 30 ngày) không phải người dùng cần quản trị.
  const where = sql`
        NOT a.la_khach
    AND (${loc.phamVi ?? null}::ltree IS NULL OR ${PHAM_VI} <@ ${loc.phamVi ?? null}::ltree)
    AND (${loc.donViPath ?? null}::ltree IS NULL OR ${PHAM_VI} <@ ${loc.donViPath ?? null}::ltree)
    AND (${xacMinh}::text IS NULL
         OR a.xac_minh = ${xacMinh}::text
         OR (${xacMinh}::text = 'chua_xac_minh' AND a.xac_minh <> 'da_xac_minh'))
    AND (${tuKhoa}::text IS NULL OR a.username ILIKE ${tuKhoa} OR a.name ILIKE ${tuKhoa} OR a.email ILIKE ${tuKhoa}
         OR a.so_hieu ILIKE ${tuKhoa} OR a.phone ILIKE ${tuKhoa})`;
  // Hàng chờ xác minh: ai đăng ký trước được duyệt trước.
  const thuTu = xacMinh ? sql`a.created_at, a.id` : sql`u.path NULLS LAST, a.name NULLS LAST, a.username`;
  const [rows, [dem]] = await Promise.all([
    sql`SELECT ${COT} FROM ${TU} WHERE ${where} ORDER BY ${thuTu} LIMIT ${gioiHan} OFFSET ${boQua}`,
    sql`SELECT count(*)::int AS n FROM ${TU} WHERE ${where}`,
  ]);
  return { items: rows as unknown as NguoiDungHang[], total: Number((dem as any)?.n ?? 0) };
}

export async function layNguoiDung(id: string): Promise<NguoiDungHang | null> {
  const [row] = await sql`SELECT ${COT} FROM ${TU} WHERE a.id = ${id}`;
  return (row as unknown as NguoiDungHang) ?? null;
}

/** Số tài khoản đang chờ duyệt trong phạm vi (null là toàn bộ), cho nhãn đếm ở trang quản trị. */
export async function demChoXacMinh(phamVi: string | null): Promise<number> {
  const [r] = (await sql`
    SELECT count(*)::int AS n FROM ${TU}
    WHERE NOT a.la_khach AND a.xac_minh = 'cho_duyet'
      AND (${phamVi}::ltree IS NULL OR ${PHAM_VI} <@ ${phamVi}::ltree)`) as any[];
  return Number(r?.n ?? 0);
}

/**
 * Duyệt một tài khoản chưa xác minh: gắn đơn vị, vai trò `khach` lên `can_bo` (vai trò cao hơn đã
 * cấp thì giữ). Người gọi đã kiểm vai trò và phạm vi của người duyệt với cả tài khoản lẫn đơn vị.
 * Tài khoản đã được xác minh (kể cả do người khác vừa duyệt) thì báo xung đột.
 */
export async function duyetTaiKhoan(id: string, unitId: string, actor: string): Promise<NguoiDungHang> {
  const [row] = (await sql`
    UPDATE accounts SET
      xac_minh = 'da_xac_minh', unit_id = ${unitId},
      role = CASE WHEN role = 'khach' THEN 'can_bo' ELSE role END,
      xac_minh_ly_do = NULL, xac_minh_boi = ${actor}, xac_minh_luc = now()
    WHERE id = ${id} AND NOT la_khach AND xac_minh <> 'da_xac_minh'
    RETURNING COALESCE(username, email) AS ten, so_hieu`) as any[];
  if (!row) throw new LoiNghiepVu("Tài khoản không còn chờ xác minh.", "xung_dot");
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES (${actor}, 'nguoi_dung:xac_minh', ${row.ten},
                    ${sql.json({ unitId, so_hieu: row.so_hieu } as never)})`;
  return (await layNguoiDung(id)) as NguoiDungHang;
}

/** Từ chối xác minh, kèm lý do để người đăng ký sửa thông tin và gửi lại. Vẫn dùng được như khách. */
export async function tuChoiXacMinh(id: string, lyDo: string, actor: string): Promise<NguoiDungHang> {
  const [row] = (await sql`
    UPDATE accounts SET
      xac_minh = 'tu_choi', xac_minh_ly_do = ${lyDo}, xac_minh_boi = ${actor}, xac_minh_luc = now()
    WHERE id = ${id} AND NOT la_khach AND xac_minh <> 'da_xac_minh'
    RETURNING COALESCE(username, email) AS ten`) as any[];
  if (!row) throw new LoiNghiepVu("Tài khoản không còn chờ xác minh.", "xung_dot");
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES (${actor}, 'nguoi_dung:tu_choi_xac_minh', ${row.ten}, ${sql.json({ ly_do: lyDo } as never)})`;
  return (await layNguoiDung(id)) as NguoiDungHang;
}

export interface DuLieuNguoiDung {
  username: string;
  name: string;
  role: string;
  unitId: string | null;
  rankTitle?: string | null;
  email?: string | null;
  passwordHash: string;
  nhomDoiTuong?: string[];
}

/** Tạo tài khoản cán bộ; mật khẩu ban đầu luôn là mật khẩu tạm, bắt đổi ở lần đăng nhập đầu. */
export async function taoNguoiDung(d: DuLieuNguoiDung, actor: string): Promise<NguoiDungHang> {
  const [trung] = (await sql`
    SELECT username, email FROM accounts
    WHERE username = ${d.username} OR (${d.email ?? null}::text IS NOT NULL AND lower(email) = lower(${d.email ?? null}))`) as any[];
  if (trung) {
    throw new LoiNghiepVu(
      trung.username === d.username ? `Tên đăng nhập "${d.username}" đã có.` : `Email "${d.email}" đã có.`,
      "xung_dot",
    );
  }
  const [row] = (await sql`
    INSERT INTO accounts (username, name, role, unit_id, rank_title, email, password_hash, must_change_password, nhom_doi_tuong)
    VALUES (${d.username}, ${d.name}, ${d.role}, ${d.unitId}, ${d.rankTitle ?? null}, ${d.email ?? null},
            ${d.passwordHash}, true, ${d.nhomDoiTuong ?? []}::text[])
    RETURNING id`) as any[];
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES (${actor}, 'nguoi_dung:tao', ${d.username}, ${sql.json({ role: d.role, unitId: d.unitId, nhomDoiTuong: d.nhomDoiTuong ?? [] } as never)})`;
  return (await layNguoiDung(row.id)) as NguoiDungHang;
}

export interface SuaNguoiDung {
  nhomDoiTuong?: string[];
  name?: string;
  role?: string;
  /** null: bỏ gắn đơn vị. */
  unitId?: string | null;
  rankTitle?: string | null;
  enabled?: boolean;
}

/** Sửa tài khoản. Khóa tài khoản thì thu hồi luôn mọi phiên đang mở. */
export async function suaNguoiDung(id: string, s: SuaNguoiDung, actor: string): Promise<NguoiDungHang> {
  const [row] = (await sql`
    UPDATE accounts SET
      name = COALESCE(${s.name?.trim() || null}, name),
      role = COALESCE(${s.role ?? null}, role),
      nhom_doi_tuong = CASE WHEN ${s.nhomDoiTuong !== undefined} THEN ${s.nhomDoiTuong ?? []}::text[] ELSE nhom_doi_tuong END,
      unit_id = CASE WHEN ${s.unitId !== undefined} THEN ${s.unitId ?? null}::uuid ELSE unit_id END,
      rank_title = CASE WHEN ${s.rankTitle !== undefined} THEN ${s.rankTitle?.trim() || null} ELSE rank_title END,
      enabled = COALESCE(${s.enabled ?? null}, enabled)
    WHERE id = ${id}
    RETURNING COALESCE(username, email) AS ten`) as any[];
  if (!row) throw new LoiNghiepVu("Không tìm thấy tài khoản.", "khong_tim_thay");
  if (s.enabled === false) {
    await sql`UPDATE sessions SET revoked_at = now() WHERE account_id = ${id} AND revoked_at IS NULL`;
  }
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES (${actor}, 'nguoi_dung:sua', ${row.ten}, ${sql.json(s as never)})`;
  return (await layNguoiDung(id)) as NguoiDungHang;
}

/* ------------------------------------------------------------------ */
/* Nhập hàng loạt từ Excel                                              */
/* ------------------------------------------------------------------ */

export type KhoaNhapNguoiDung = "hoTen" | "tenDangNhap" | "maDonVi" | "vaiTro" | "capBac" | "email";

/** Cột của tệp mẫu nhập người dùng (data/mau/mau-nhap-nguoi-dung.xlsx). */
export const COT_NHAP_NGUOI_DUNG: CotDoc<KhoaNhapNguoiDung>[] = [
  { khoa: "hoTen", tieuDe: ["Họ và tên", "Họ tên"], batBuoc: true },
  { khoa: "tenDangNhap", tieuDe: ["Tên đăng nhập", "Tài khoản"], batBuoc: true },
  { khoa: "maDonVi", tieuDe: ["Mã đơn vị"], batBuoc: true },
  { khoa: "vaiTro", tieuDe: ["Vai trò"] },
  { khoa: "capBac", tieuDe: ["Cấp bậc, chức vụ", "Cấp bậc", "Chức vụ"] },
  { khoa: "email", tieuDe: ["Email", "Thư điện tử"] },
];

/**
 * Vai trò nhận khi nhập tệp: chỉ hai vai trò nghiệp vụ. Vai trò Admin quản lý, Admin quản trị
 * hệ thống cấp riêng từng người trên màn hình quản trị, không cấp hàng loạt qua tệp.
 */
const VAI_TRO_NHAP: Record<string, "can_bo" | "lanh_dao"> = {
  "": "can_bo",
  "can bo": "can_bo",
  "can bo chien si": "can_bo",
  "cong chuc": "can_bo",
  "can bo quan ly": "lanh_dao",
  "quan ly": "lanh_dao",
  "lanh dao": "lanh_dao",
  "lanh dao ubnd xa": "lanh_dao",
};

export interface TuyChonNhap {
  chayThu: boolean;
  actor: string;
  /** Chuẩn hóa tên đăng nhập (chữ thường, bỏ khoảng trắng). */
  chuanHoaTen: (s: string) => string;
  /** Trả thông báo lỗi hoặc null khi tên đăng nhập hợp lệ. */
  loiTen: (s: string) => string | null;
  taoMatKhau: () => string;
  bamMatKhau: (s: string) => Promise<string>;
}

export interface KetQuaNhap {
  chayThu: boolean;
  tongDong: number;
  /** Tài khoản đã tạo (hoặc sẽ tạo khi chạy thử). `matKhauTam` chỉ có khi tạo thật. */
  taoMoi: Array<{
    dong: number;
    username: string;
    name: string;
    role: string;
    donVi: string;
    matKhauTam?: string;
  }>;
  loi: Array<{ dong: number; loi: string }>;
}

/**
 * Kiểm từng dòng rồi tạo các dòng hợp lệ. Dòng lỗi không chặn dòng khác: kết quả nêu số dòng
 * và lý do để người nhập sửa tệp và nhập lại riêng các dòng đó. Chạy thử thì không ghi gì.
 */
export async function nhapNguoiDung(
  dong: DongExcel<KhoaNhapNguoiDung>[],
  opts: TuyChonNhap,
): Promise<KetQuaNhap> {
  const donVi = new Map(
    ((await sql`SELECT id, code, name FROM units WHERE enabled`) as any[]).map((u) => [
      String(u.code).toLowerCase(),
      u,
    ]),
  );
  const tenTrongTep = dong.map((d) => opts.chuanHoaTen(d.giaTri.tenDangNhap));
  const emailTrongTep = dong.map((d) => d.giaTri.email.trim().toLowerCase()).filter(Boolean);
  const daCo = (await sql`
    SELECT username, lower(email) AS email FROM accounts
    WHERE username = ANY(${tenTrongTep}) OR lower(email) = ANY(${emailTrongTep})`) as any[];
  const tenDaCo = new Set(daCo.map((r) => r.username).filter(Boolean));
  const emailDaCo = new Set(daCo.map((r) => r.email).filter(Boolean));

  const ketQua: KetQuaNhap = { chayThu: opts.chayThu, tongDong: dong.length, taoMoi: [], loi: [] };
  const hopLe: Array<{
    dong: number;
    username: string;
    name: string;
    role: string;
    unit: any;
    capBac: string;
    email: string | null;
  }> = [];
  const daGap = new Set<string>();

  for (const d of dong) {
    const g = d.giaTri;
    const loi: string[] = [];
    const username = opts.chuanHoaTen(g.tenDangNhap);
    const email = g.email.trim().toLowerCase() || null;

    if (!g.hoTen.trim()) loi.push("thiếu họ và tên");
    const loiTen = username ? opts.loiTen(username) : "thiếu tên đăng nhập";
    if (loiTen) loi.push(loiTen.charAt(0).toLowerCase() + loiTen.slice(1).replace(/\.$/, ""));
    else if (tenDaCo.has(username)) loi.push(`tên đăng nhập "${username}" đã có trong hệ thống`);
    else if (daGap.has(username)) loi.push(`tên đăng nhập "${username}" bị trùng với một dòng phía trên`);

    const unit = donVi.get(g.maDonVi.trim().toLowerCase());
    if (!g.maDonVi.trim()) loi.push("thiếu mã đơn vị");
    else if (!unit) loi.push(`không có đơn vị mã "${g.maDonVi.trim()}"`);

    const role = VAI_TRO_NHAP[chuanHoaTieuDe(g.vaiTro).replace(/_/g, " ")];
    if (!role) loi.push(`vai trò "${g.vaiTro}" không hợp lệ, chỉ nhận "Cán bộ" hoặc "Lãnh đạo UBND xã"`);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) loi.push(`email "${email}" không hợp lệ`);
    else if (email && emailDaCo.has(email)) loi.push(`email "${email}" đã có trong hệ thống`);

    if (username) daGap.add(username);
    if (loi.length) {
      ketQua.loi.push({ dong: d.dong, loi: `${loi.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()) });
      continue;
    }
    hopLe.push({
      dong: d.dong,
      username,
      name: g.hoTen.trim(),
      role: role as string,
      unit,
      capBac: g.capBac.trim(),
      email,
    });
  }

  if (opts.chayThu) {
    ketQua.taoMoi = hopLe.map((h) => ({
      dong: h.dong,
      username: h.username,
      name: h.name,
      role: h.role,
      donVi: h.unit.name,
    }));
    return ketQua;
  }

  // Băm trước khi mở giao dịch: argon2 chậm có chủ đích, không giữ khóa CSDL trong lúc băm.
  const coMatKhau = await Promise.all(
    hopLe.map(async (h) => {
      const matKhauTam = opts.taoMatKhau();
      return { ...h, matKhauTam, hash: await opts.bamMatKhau(matKhauTam) };
    }),
  );
  await sql.begin(async (tx) => {
    for (const h of coMatKhau) {
      await tx`
        INSERT INTO accounts (username, name, role, unit_id, rank_title, email, password_hash, must_change_password)
        VALUES (${h.username}, ${h.name}, ${h.role}, ${h.unit.id}, ${h.capBac || null}, ${h.email}, ${h.hash}, true)`;
    }
    await tx`INSERT INTO audit_log (actor, action, target, detail)
             VALUES (${opts.actor}, 'nguoi_dung:nhap_excel', ${`${coMatKhau.length} tài khoản`},
                     ${tx.json({ tao: coMatKhau.map((h) => h.username), soDongLoi: ketQua.loi.length } as never)})`;
  });
  ketQua.taoMoi = coMatKhau.map((h) => ({
    dong: h.dong,
    username: h.username,
    name: h.name,
    role: h.role,
    donVi: h.unit.name,
    matKhauTam: h.matKhauTam,
  }));
  return ketQua;
}

/**
 * Tệp mẫu nhập người dùng. Trang 1 chỉ có dòng tiêu đề (không có dòng ví dụ, để dòng ví dụ
 * không bị nhập nhầm); trang 2 là hướng dẫn và danh mục mã đơn vị hiện có.
 */
export async function taoMauNhapNguoiDung(): Promise<Uint8Array> {
  const donVi = (await sql`SELECT code, name FROM units WHERE enabled ORDER BY path`) as any[];
  return await taoTepExcel([
    {
      ten: "Người dùng",
      cot: [
        { tieuDe: "Họ và tên", khoa: "hoTen", rong: 28 },
        { tieuDe: "Tên đăng nhập", khoa: "tenDangNhap", rong: 20 },
        { tieuDe: "Mã đơn vị", khoa: "maDonVi", rong: 16 },
        { tieuDe: "Vai trò", khoa: "vaiTro", rong: 18 },
        { tieuDe: "Cấp bậc, chức vụ", khoa: "capBac", rong: 24 },
        { tieuDe: "Email", khoa: "email", rong: 28 },
      ],
      dong: [],
    },
    {
      ten: "Hướng dẫn",
      cot: [
        { tieuDe: "Mã đơn vị", khoa: "code", rong: 16 },
        { tieuDe: "Tên đơn vị", khoa: "name", rong: 40 },
      ],
      dong: donVi.map((d) => ({ code: d.code, name: d.name })),
      ghiChu: [
        'Điền danh sách vào trang "Người dùng", mỗi người một dòng, bắt đầu từ dòng 2.',
        "Bắt buộc: Họ và tên, Tên đăng nhập, Mã đơn vị. Mã đơn vị lấy ở bảng trên.",
        "Tên đăng nhập: 3 đến 50 ký tự, chữ không dấu, chữ số, dấu chấm, gạch ngang hoặc gạch dưới.",
        'Vai trò: "Cán bộ" hoặc "Lãnh đạo UBND xã". Để trống thì là Cán bộ.',
        "Hệ thống cấp mật khẩu tạm cho từng người; người dùng phải đổi mật khẩu ở lần đăng nhập đầu.",
      ],
    },
  ]);
}
