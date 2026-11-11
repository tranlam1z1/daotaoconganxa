/**
 * Đơn vị dạng cây (docs/PLAN.md GĐ2). `path` là ltree dựng từ id, nên truy vấn cây con chỉ
 * cần `path <@ :cha` và phạm vi của cán bộ quản lý so bằng tiền tố đường dẫn.
 */
import { sql, type Tx } from "./client.ts";

/** Lỗi nghiệp vụ có sẵn thông báo tiếng Việt; API đổi `loai` thành mã HTTP. */
export class LoiNghiepVu extends Error {
  constructor(
    message: string,
    readonly loai: "khong_tim_thay" | "xung_dot" | "khong_hop_le",
  ) {
    super(message);
  }
}

/** Loại đơn vị chuẩn (migration 0087); CHECK của bảng `units` là nguồn kiểm. */
export const LOAI_DON_VI = [
  "xa",
  "co_quan_hanh_chinh",
  "don_vi_su_nghiep",
  "to_chuc_dang",
  "doan_the",
  "khac",
] as const;
export type LoaiDonVi = (typeof LOAI_DON_VI)[number];

export interface DonVi {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  path: string;
  level_label: string | null;
  loai: LoaiDonVi;
  /** Mã xã, phường, đặc khu 5 số; chỉ có ở đơn vị loại `xa`. */
  ma_hanh_chinh: string | null;
  ordinal: number;
  enabled: boolean;
  /** Độ sâu tính từ gốc, gốc = 1. */
  cap: number;
  /** Số tài khoản gắn trực tiếp vào đơn vị (không tính đơn vị con). */
  so_nguoi: number;
}

/** Nhãn ltree của một đơn vị: "u" + 32 ký tự hex của id. */
export function nhanDonVi(id: string): string {
  return `u${id.replace(/-/g, "").toLowerCase()}`;
}

const COT = sql`
  u.id, u.code, u.name, u.parent_id, u.path::text AS path, u.level_label, u.loai, u.ma_hanh_chinh,
  u.ordinal, u.enabled,
  nlevel(u.path) AS cap,
  (SELECT count(*)::int FROM accounts a WHERE a.unit_id = u.id) AS so_nguoi`;

/**
 * Danh sách đơn vị theo thứ tự cây (cha đứng trước con). `phamVi` là đường dẫn ltree của đơn
 * vị gốc được xem; null là toàn bộ.
 */
export async function danhSachDonVi(phamVi: string | null = null): Promise<DonVi[]> {
  const rows = await sql`
    SELECT ${COT} FROM units u
    WHERE (${phamVi}::ltree IS NULL OR u.path <@ ${phamVi}::ltree)
    ORDER BY u.path`;
  // Sắp lại theo `ordinal` giữa các anh em: ORDER BY path chỉ đúng thứ tự cha–con.
  return sapTheoCay(rows as unknown as DonVi[]);
}

function sapTheoCay(ds: DonVi[]): DonVi[] {
  const con = new Map<string | null, DonVi[]>();
  const coTrongDs = new Set(ds.map((d) => d.id));
  for (const d of ds) {
    // Gốc của phạm vi đang xem có thể có cha nằm ngoài danh sách.
    const cha = d.parent_id && coTrongDs.has(d.parent_id) ? d.parent_id : null;
    con.set(cha, [...(con.get(cha) ?? []), d]);
  }
  const ketQua: DonVi[] = [];
  const duyet = (cha: string | null) => {
    const ds2 = (con.get(cha) ?? []).sort(
      (a, b) => a.ordinal - b.ordinal || a.name.localeCompare(b.name, "vi"),
    );
    for (const d of ds2) {
      ketQua.push(d);
      duyet(d.id);
    }
  };
  duyet(null);
  return ketQua;
}

export async function layDonVi(id: string): Promise<DonVi | null> {
  const [row] = await sql`SELECT ${COT} FROM units u WHERE u.id = ${id}`;
  return (row as unknown as DonVi) ?? null;
}

export async function layDonViTheoMa(code: string): Promise<DonVi | null> {
  const [row] = await sql`SELECT ${COT} FROM units u WHERE lower(u.code) = lower(${code})`;
  return (row as unknown as DonVi) ?? null;
}

async function ghiNhatKy(tx: Tx, actor: string, action: string, target: string, detail: unknown) {
  await tx`INSERT INTO audit_log (actor, action, target, detail)
           VALUES (${actor}, ${action}, ${target}, ${tx.json(detail as never)})`;
}

export interface DuLieuDonVi {
  code: string;
  name: string;
  parentId?: string | null;
  levelLabel?: string | null;
  ordinal?: number;
  loai?: LoaiDonVi;
  maHanhChinh?: string | null;
}

function kiemMa(code: string) {
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(code)) {
    throw new LoiNghiepVu(
      "Mã đơn vị gồm 1 đến 40 ký tự: chữ không dấu, chữ số, dấu chấm, gạch.",
      "khong_hop_le",
    );
  }
}

/** Mã hành chính chỉ cho đơn vị loại xã, đúng 5 chữ số. */
function kiemLoai(loai: LoaiDonVi, maHanhChinh: string | null) {
  if (maHanhChinh === null) return;
  if (loai !== "xa") {
    throw new LoiNghiepVu("Chỉ đơn vị loại xã, phường mới có mã hành chính.", "khong_hop_le");
  }
  if (!/^\d{5}$/.test(maHanhChinh)) throw new LoiNghiepVu("Mã xã gồm đúng 5 chữ số.", "khong_hop_le");
}

/** Mã xã đã gắn với đơn vị khác thì báo xung đột kèm tên đơn vị đó. */
async function kiemTrungMaHanhChinh(tx: Tx, ma: string | null, boQuaId: string | null) {
  if (ma === null) return;
  const [trung] = (await tx`
    SELECT name FROM units WHERE ma_hanh_chinh = ${ma} AND (${boQuaId}::uuid IS NULL OR id <> ${boQuaId})`) as any[];
  if (trung) throw new LoiNghiepVu(`Mã xã ${ma} đã gắn với đơn vị "${trung.name}".`, "xung_dot");
}

export async function taoDonVi(d: DuLieuDonVi, actor: string): Promise<DonVi> {
  kiemMa(d.code);
  const loai = d.loai ?? "khac";
  const maHanhChinh = d.maHanhChinh?.trim() || null;
  kiemLoai(loai, maHanhChinh);
  if (!d.name.trim()) throw new LoiNghiepVu("Nhập tên đơn vị.", "khong_hop_le");
  const id = crypto.randomUUID();
  await sql.begin(async (tx) => {
    let path = nhanDonVi(id);
    if (d.parentId) {
      const [cha] = (await tx`SELECT path::text AS path FROM units WHERE id = ${d.parentId}`) as any[];
      if (!cha) throw new LoiNghiepVu("Không tìm thấy đơn vị cấp trên.", "khong_tim_thay");
      path = `${cha.path}.${path}`;
    }
    const [trung] = (await tx`SELECT 1 FROM units WHERE lower(code) = lower(${d.code})`) as any[];
    if (trung) throw new LoiNghiepVu(`Mã đơn vị "${d.code}" đã có.`, "xung_dot");
    await kiemTrungMaHanhChinh(tx, maHanhChinh, null);
    await tx`
      INSERT INTO units (id, code, name, parent_id, path, level_label, ordinal, loai, ma_hanh_chinh)
      VALUES (${id}, ${d.code}, ${d.name.trim()}, ${d.parentId ?? null}, ${path}::ltree,
              ${d.levelLabel?.trim() || null}, ${d.ordinal ?? 0}, ${loai}, ${maHanhChinh})`;
    await ghiNhatKy(tx, actor, "don_vi:tao", d.code, {
      name: d.name,
      parentId: d.parentId ?? null,
      loai,
      maHanhChinh,
    });
  });
  return (await layDonVi(id)) as DonVi;
}

export interface SuaDonVi {
  code?: string;
  name?: string;
  levelLabel?: string | null;
  ordinal?: number;
  enabled?: boolean;
  /** undefined: giữ nguyên cha; null: chuyển thành đơn vị gốc. */
  parentId?: string | null;
  loai?: LoaiDonVi;
  /** undefined: giữ nguyên; null: xóa. Đổi loại khỏi `xa` thì mã luôn bị xóa. */
  maHanhChinh?: string | null;
}

/**
 * Sửa đơn vị. Chuyển sang cha mới thì cập nhật `path` của cả nhánh trong cùng giao dịch;
 * không cho chuyển vào chính nó hoặc vào đơn vị con cháu của nó (tạo vòng).
 */
export async function suaDonVi(id: string, s: SuaDonVi, actor: string): Promise<DonVi> {
  if (s.code !== undefined) kiemMa(s.code);
  await sql.begin(async (tx) => {
    const [cu] = (await tx`SELECT code, parent_id, path::text AS path, loai, ma_hanh_chinh
                FROM units WHERE id = ${id} FOR UPDATE`) as any[];
    if (!cu) throw new LoiNghiepVu("Không tìm thấy đơn vị.", "khong_tim_thay");

    const loai: LoaiDonVi = s.loai ?? cu.loai;
    const maYeuCau = s.maHanhChinh === undefined ? cu.ma_hanh_chinh : s.maHanhChinh?.trim() || null;
    // Đổi loại khỏi xã thì bỏ mã cũ; mã gửi kèm trong cùng yêu cầu vẫn được kiểm như thường.
    const maHanhChinh = loai !== "xa" && s.maHanhChinh === undefined ? null : maYeuCau;
    kiemLoai(loai, maHanhChinh);
    await kiemTrungMaHanhChinh(tx, maHanhChinh, id);
    if (cu.loai === "to_chuc_dang" && loai !== "to_chuc_dang") await kiemKhongConNguoiSinhHoat(tx, id);

    if (s.code !== undefined && s.code.toLowerCase() !== String(cu.code).toLowerCase()) {
      const [trung] =
        (await tx`SELECT 1 FROM units WHERE lower(code) = lower(${s.code}) AND id <> ${id}`) as any[];
      if (trung) throw new LoiNghiepVu(`Mã đơn vị "${s.code}" đã có.`, "xung_dot");
    }

    if (s.parentId !== undefined && s.parentId !== cu.parent_id) {
      let duongMoi = nhanDonVi(id);
      if (s.parentId) {
        const [cha] = (await tx`SELECT path::text AS path FROM units WHERE id = ${s.parentId}`) as any[];
        if (!cha) throw new LoiNghiepVu("Không tìm thấy đơn vị cấp trên.", "khong_tim_thay");
        if (cha.path === cu.path || String(cha.path).startsWith(`${cu.path}.`)) {
          throw new LoiNghiepVu(
            "Không chuyển được đơn vị vào chính nó hoặc vào đơn vị cấp dưới của nó.",
            "khong_hop_le",
          );
        }
        duongMoi = `${cha.path}.${duongMoi}`;
      }
      // subpath(path, nlevel(cũ)) báo lỗi với chính nút được chuyển (độ dời bằng độ dài), nên
      // nút đó gán thẳng đường dẫn mới; các nút con cháu nối phần đuôi vào sau.
      await tx`
        UPDATE units SET path = CASE
          WHEN path = ${cu.path}::ltree THEN ${duongMoi}::ltree
          ELSE ${duongMoi}::ltree || subpath(path, nlevel(${cu.path}::ltree))
        END
        WHERE path <@ ${cu.path}::ltree`;
      await tx`UPDATE units SET parent_id = ${s.parentId} WHERE id = ${id}`;
    }

    await tx`
      UPDATE units SET
        code = COALESCE(${s.code ?? null}, code),
        name = COALESCE(${s.name?.trim() || null}, name),
        level_label = CASE WHEN ${s.levelLabel !== undefined} THEN ${s.levelLabel?.trim() || null} ELSE level_label END,
        ordinal = COALESCE(${s.ordinal ?? null}, ordinal),
        enabled = COALESCE(${s.enabled ?? null}, enabled),
        loai = ${loai},
        ma_hanh_chinh = ${maHanhChinh},
        updated_at = now()
      WHERE id = ${id}`;
    await ghiNhatKy(tx, actor, "don_vi:sua", s.code ?? cu.code, s);
  });
  return (await layDonVi(id)) as DonVi;
}

/**
 * Đổi loại một tổ chức Đảng khi còn người ghi nó là nơi sinh hoạt Đảng thì `party_unit_id` của
 * họ trỏ tới đơn vị không còn là tổ chức Đảng: chặn, báo số người cần chuyển trước.
 */
async function kiemKhongConNguoiSinhHoat(tx: Tx, id: string) {
  const [r] = (await tx`SELECT count(*)::int AS n FROM accounts WHERE party_unit_id = ${id}`) as any[];
  if (r.n > 0) {
    throw new LoiNghiepVu(
      `Đơn vị đang là nơi sinh hoạt Đảng của ${r.n} người. Chuyển những người này sang tổ chức Đảng khác trước khi đổi loại.`,
      "xung_dot",
    );
  }
}

/** Nơi sinh hoạt Đảng phải là đơn vị loại `to_chuc_dang` đang hoạt động. Ném LoiNghiepVu. */
export async function kiemDonViDang(id: string): Promise<void> {
  const hopLe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? ((await sql`SELECT 1 FROM units WHERE id = ${id} AND loai = 'to_chuc_dang' AND enabled`) as any[])
    : [];
  if (!hopLe.length) {
    throw new LoiNghiepVu("Nơi sinh hoạt Đảng phải là tổ chức Đảng đang hoạt động.", "khong_hop_le");
  }
}
