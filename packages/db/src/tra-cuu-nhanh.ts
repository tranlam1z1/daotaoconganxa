/**
 * Tầng dữ liệu của tra cứu nhanh (docs/PLAN.md GĐ5): mức phạt theo hành vi, theo tốc độ,
 * và quy trình xử lý. Nạp từ data/tra-cuu/*.json qua scripts/tra-cuu-nhanh.ts.
 *
 * Người học chỉ thấy dòng `da_duyet`. `gomBanNhap` chỉ bật ở môi trường phát triển để xem
 * trước dữ liệu đang biên tập, và mỗi dòng trả về đều mang trạng thái để giao diện ghi rõ.
 */
import {
  type BuocQuyTrinh,
  coSoLieuTocDo,
  type DongMucPhat,
  type DongTocDoToiDa,
  type KhoangTocDo,
  type LoaiXe,
  type QuyTrinh,
} from "@qdpl/dao-tao";
import { lookupNode } from "./citation-health.ts";
import { type Sql, sql, type Tx } from "./client.ts";

export interface MucPhatRow {
  ma: string;
  xe: LoaiXe;
  nhom: string | null;
  hanhVi: string;
  tuKhoa: string[];
  phatTu: number;
  phatDen: number;
  hinhThucBoSung: string[];
  truDiem: number | null;
  tocDoVuot: KhoangTocDo | null;
  canCu: string;
  hieuLucTu: string;
  hieuLucDen: string | null;
  trangThai: string;
}

export interface QuyTrinhRow {
  ma: string;
  loai: "vi_pham" | "tai_nan";
  tieuDe: string;
  tomTat: string | null;
  cacBuoc: BuocQuyTrinh[];
  trangThai: string;
}

const ngay = (v: unknown): string | null =>
  !v ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

function toMucPhat(r: any): MucPhatRow {
  return {
    ma: r.code,
    xe: r.vehicle,
    nhom: r.group_name,
    hanhVi: r.behavior,
    tuKhoa: r.keywords ?? [],
    phatTu: Number(r.fine_min),
    phatDen: Number(r.fine_max),
    hinhThucBoSung: r.extra_penalties ?? [],
    truDiem: r.point_deduction,
    tocDoVuot:
      r.speed_over_min === null
        ? null
        : {
            tu: Number(r.speed_over_min),
            den: r.speed_over_max === null ? null : Number(r.speed_over_max),
            bien: r.speed_bounds,
          },
    canCu: r.citation_urn,
    hieuLucTu: ngay(r.effective_from)!,
    hieuLucDen: ngay(r.effective_to),
    trangThai: r.status,
  };
}

function toQuyTrinh(r: any): QuyTrinhRow {
  return {
    ma: r.code,
    loai: r.kind,
    tieuDe: r.title,
    tomTat: r.summary,
    cacBuoc: r.steps ?? [],
    trangThai: r.status,
  };
}

export const trangThaiXem = (gomBanNhap: boolean) => (gomBanNhap ? ["da_duyet", "nhap"] : ["da_duyet"]);

/* ------------------------------------------------------------------ */
/* Đọc                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Tìm mức phạt theo từ khóa (không phân biệt dấu), lọc loại xe, áp dụng tại `ngay`.
 * Mọi từ trong truy vấn đều phải có trong hành vi hoặc từ khóa đồng nghĩa.
 */
export async function timMucPhat(opts: {
  q?: string;
  nhom?: string;
  xe?: LoaiXe;
  ngay: string;
  gomBanNhap?: boolean;
  limit?: number;
}): Promise<MucPhatRow[]> {
  const tu = (opts.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 12);
  const q = tu.join(" ");
  const rows = await sql`
    SELECT * FROM violations
    WHERE status = ANY(${trangThaiXem(!!opts.gomBanNhap)})
      AND deleted_at IS NULL
      ${opts.nhom ? sql`AND group_name = ${opts.nhom}` : sql``}
      AND effective_from <= ${opts.ngay} AND (effective_to IS NULL OR effective_to > ${opts.ngay})
      ${opts.xe ? sql`AND vehicle = ${opts.xe}` : sql``}
      ${tu.reduce((acc, t) => sql`${acc} AND search_text LIKE '%' || unaccent(lower(${t})) || '%'`, sql``)}
    ORDER BY ${q ? sql`word_similarity(unaccent(lower(${q})), search_text) DESC,` : sql``}
      group_name NULLS LAST, vehicle, fine_min, code
    LIMIT ${opts.limit ?? 50}`;
  return rows.map(toMucPhat);
}

/** Các dòng mức phạt theo tốc độ của một loại xe, áp dụng tại `ngay`. API chọn khoảng bằng logic thuần. */
export async function mucPhatTheoTocDo(opts: {
  xe: LoaiXe;
  ngay: string;
  gomBanNhap?: boolean;
}): Promise<MucPhatRow[]> {
  const rows = await sql`
    SELECT * FROM violations
    WHERE status = ANY(${trangThaiXem(!!opts.gomBanNhap)})
      AND vehicle = ${opts.xe} AND speed_over_min IS NOT NULL
      AND effective_from <= ${opts.ngay} AND (effective_to IS NULL OR effective_to > ${opts.ngay})
    ORDER BY speed_over_min`;
  return rows.map(toMucPhat);
}

export async function danhSachQuyTrinh(opts: { gomBanNhap?: boolean } = {}): Promise<QuyTrinhRow[]> {
  const rows = await sql`
    SELECT * FROM procedures WHERE status = ANY(${trangThaiXem(!!opts.gomBanNhap)})
    ORDER BY kind, ordinal, title`;
  return rows.map(toQuyTrinh);
}

export async function quyTrinhTheoMa(ma: string, opts: { gomBanNhap?: boolean } = {}) {
  const [r] = await sql`
    SELECT * FROM procedures WHERE code = ${ma} AND status = ANY(${trangThaiXem(!!opts.gomBanNhap)})`;
  return r ? toQuyTrinh(r) : undefined;
}

/* ------------------------------------------------------------------ */
/* Nạp                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Cách lấy trạng thái khi nạp (docs/PLAN.md GĐ-G0):
 *  - `theo_tep`: trạng thái ghi trong tệp (cách cũ; chỉ dùng cho CSDL phát triển và test);
 *  - `cho_duyet`: tệp chỉ là nguồn nhập. Dòng mới hoặc đổi nội dung vào `cho_duyet` (dòng tệp ghi
 *    `nhap` thì vào `nhap`), dòng đã duyệt mà đổi nội dung thì tăng phiên bản; dòng không đổi giữ
 *    nguyên trạng thái. Duyệt thật làm trong ứng dụng (/quan-tri/du-lieu-tra-cuu).
 */
export type CheDoNap = "theo_tep" | "cho_duyet";

/** Trạng thái ghi khi thêm dòng mới. */
export function trangThaiNap(trongTep: string, theoTep: boolean): string {
  if (theoTep) return trongTep;
  return trongTep === "nhap" ? "nhap" : "cho_duyet";
}

/**
 * Phần SET của status và version khi dòng đã có (ON CONFLICT). `doi` là biểu thức "nội dung khác đi".
 * Chế độ cho_duyet: giữ trạng thái khi nội dung không đổi (trừ dòng ngừng được đưa lại vào tệp và
 * dòng nháp mà tệp đã đánh dấu duyệt, hai trường hợp này vào chờ duyệt).
 */
export function giuTrangThai(tx: Tx, bang: string, theoTep: boolean, doi: unknown) {
  const b = tx(bang);
  if (theoTep) return tx`status = EXCLUDED.status`;
  return tx`
    status = CASE
      WHEN ${b}.status <> 'ngung' AND NOT (${doi})
           AND NOT (${b}.status = 'nhap' AND EXCLUDED.status = 'cho_duyet') THEN ${b}.status
      ELSE EXCLUDED.status END,
    version = CASE WHEN ${b}.status = 'da_duyet' AND (${doi}) THEN ${b}.version + 1 ELSE ${b}.version END`;
}

/**
 * Nạp lại toàn bộ dữ liệu tra cứu nhanh trong một giao dịch: thêm hoặc cập nhật theo mã.
 * Dòng có trong CSDL mà không còn trong tệp thì chuyển sang `ngung` (không xóa, để giữ dấu vết).
 *
 * `tienTo` giới hạn việc chuyển sang ngừng vào các mã có tiền tố đó. Test dùng tiền tố riêng
 * để không đụng dữ liệu thật khi CSDL test cũng là CSDL phát triển.
 */
export async function napTraCuuNhanh(
  mucPhat: DongMucPhat[],
  quyTrinh: QuyTrinh[],
  opts: { db?: Sql | Tx; tienTo?: string; cheDo?: CheDoNap } = {},
): Promise<{ mucPhat: number; quyTrinh: number; ngung: number }> {
  const db = opts.db ?? sql;
  const theoTep = (opts.cheDo ?? "theo_tep") === "theo_tep";
  const phamVi = `${(opts.tienTo ?? "").replace(/[\\%_]/g, "\\$&")}%`;
  const chay = async (tx: Tx) => {
    for (const d of mucPhat) {
      const k = d.toc_do_vuot ?? null;
      const q = d.qua_tai ?? null;
      const noi = [d.hanh_vi, ...(d.tu_khoa ?? []), d.nhom ?? ""].join(" ");
      await tx`
        INSERT INTO violations (code, vehicle, group_name, behavior, keywords, search_text,
          fine_min, fine_max, extra_penalties, point_deduction, speed_over_min, speed_over_max,
          speed_bounds, qua_tai_loai, qua_tai_tu, qua_tai_den, qua_tai_bien,
          citation_urn, effective_from, effective_to, status, note, updated_at)
        VALUES (${d.ma}, ${d.xe}, ${d.nhom ?? null}, ${d.hanh_vi}, ${d.tu_khoa ?? []},
          unaccent(lower(${noi})), ${d.phat_tu}, ${d.phat_den},
          ${tx.json((d.hinh_thuc_bo_sung ?? []) as never)}, ${d.tru_diem ?? null},
          ${k?.tu ?? null}, ${k?.den ?? null}, ${k?.bien ?? "[)"},
          ${q?.loai ?? null}, ${q?.tu ?? null}, ${q?.den ?? null}, ${q?.bien ?? "(]"}, ${d.can_cu},
          ${d.hieu_luc_tu}, ${d.hieu_luc_den ?? null}, ${trangThaiNap(d.trang_thai, theoTep)}, ${d.ghi_chu ?? null}, now())
        ON CONFLICT (code) DO UPDATE SET
          vehicle = EXCLUDED.vehicle, group_name = EXCLUDED.group_name, behavior = EXCLUDED.behavior,
          keywords = EXCLUDED.keywords, search_text = EXCLUDED.search_text,
          fine_min = EXCLUDED.fine_min, fine_max = EXCLUDED.fine_max,
          extra_penalties = EXCLUDED.extra_penalties, point_deduction = EXCLUDED.point_deduction,
          speed_over_min = EXCLUDED.speed_over_min, speed_over_max = EXCLUDED.speed_over_max,
          speed_bounds = EXCLUDED.speed_bounds, qua_tai_loai = EXCLUDED.qua_tai_loai,
          qua_tai_tu = EXCLUDED.qua_tai_tu, qua_tai_den = EXCLUDED.qua_tai_den, qua_tai_bien = EXCLUDED.qua_tai_bien,
          citation_urn = EXCLUDED.citation_urn,
          effective_from = EXCLUDED.effective_from, effective_to = EXCLUDED.effective_to,
          note = EXCLUDED.note, updated_at = now(),
          ${giuTrangThai(
            tx,
            "violations",
            theoTep,
            tx`(violations.vehicle, violations.group_name, violations.behavior,
            violations.keywords, violations.fine_min, violations.fine_max, violations.extra_penalties,
            violations.point_deduction, violations.speed_over_min, violations.speed_over_max, violations.speed_bounds,
            violations.qua_tai_loai, violations.qua_tai_tu, violations.qua_tai_den, violations.qua_tai_bien,
            violations.citation_urn, violations.effective_from, violations.effective_to)
            IS DISTINCT FROM (EXCLUDED.vehicle, EXCLUDED.group_name, EXCLUDED.behavior, EXCLUDED.keywords,
            EXCLUDED.fine_min, EXCLUDED.fine_max, EXCLUDED.extra_penalties, EXCLUDED.point_deduction,
            EXCLUDED.speed_over_min, EXCLUDED.speed_over_max, EXCLUDED.speed_bounds,
            EXCLUDED.qua_tai_loai, EXCLUDED.qua_tai_tu, EXCLUDED.qua_tai_den, EXCLUDED.qua_tai_bien,
            EXCLUDED.citation_urn, EXCLUDED.effective_from, EXCLUDED.effective_to)`,
          )}`;
    }
    for (const [i, q] of quyTrinh.entries()) {
      await tx`
        INSERT INTO procedures (code, kind, title, summary, steps, ordinal, status, note, updated_at)
        VALUES (${q.ma}, ${q.loai}, ${q.tieu_de}, ${q.tom_tat ?? null}, ${tx.json(q.cac_buoc as never)},
          ${i}, ${trangThaiNap(q.trang_thai, theoTep)}, ${q.ghi_chu ?? null}, now())
        ON CONFLICT (code) DO UPDATE SET
          kind = EXCLUDED.kind, title = EXCLUDED.title, summary = EXCLUDED.summary,
          steps = EXCLUDED.steps, ordinal = EXCLUDED.ordinal,
          note = EXCLUDED.note, updated_at = now(),
          ${giuTrangThai(
            tx,
            "procedures",
            theoTep,
            tx`(procedures.kind, procedures.title, procedures.summary, procedures.steps)
            IS DISTINCT FROM (EXCLUDED.kind, EXCLUDED.title, EXCLUDED.summary, EXCLUDED.steps)`,
          )}`;
    }
    const maMucPhat = mucPhat.map((d) => d.ma);
    const maQuyTrinh = quyTrinh.map((q) => q.ma);
    // Dòng soạn trong ứng dụng (created_by) không có trong tệp: không chuyển sang ngừng.
    const a = await tx`
      UPDATE violations SET status = 'ngung', updated_at = now()
      WHERE status <> 'ngung' AND created_by IS NULL AND code LIKE ${phamVi} AND NOT (code = ANY(${maMucPhat}))`;
    const b = await tx`
      UPDATE procedures SET status = 'ngung', updated_at = now()
      WHERE status <> 'ngung' AND created_by IS NULL AND code LIKE ${phamVi} AND NOT (code = ANY(${maQuyTrinh}))`;
    return { mucPhat: mucPhat.length, quyTrinh: quyTrinh.length, ngung: a.count + b.count };
  };
  // Đã ở trong giao dịch (test cuộn lại) thì chạy thẳng; không thì mở giao dịch mới.
  if ("begin" in db) return (await db.begin(chay)) as Awaited<ReturnType<typeof chay>>;
  return chay(db);
}

/* ------------------------------------------------------------------ */
/* Kiểm tra căn cứ                                                     */
/* ------------------------------------------------------------------ */

export interface CanCuHong {
  urn: string;
  lyDo: string;
}

/**
 * Kiểm từng URN có tồn tại và còn áp dụng tại `ngay` trong kho không. Dùng lại `lookupNode`
 * của rà soát sức khỏe viện dẫn, nên "hỏng" ở đây nghĩa giống hệt ở scripts/check-citations.ts.
 */
export async function kiemTraCanCuTraCuu(urns: string[], ngay: string): Promise<CanCuHong[]> {
  const hong: CanCuHong[] = [];
  for (const urn of urns) {
    const node = await lookupNode(urn, ngay);
    if (!node) hong.push({ urn, lyDo: "Không tìm thấy trong kho tại ngày kiểm tra" });
    else if (node.node_status === "repealed") hong.push({ urn, lyDo: `${node.label} đã bị bãi bỏ` });
    else if (node.node_status === "suspended")
      hong.push({ urn, lyDo: `${node.label} đang bị ngưng hiệu lực` });
  }
  return hong;
}

/** URN căn cứ của các dòng đã duyệt đang nằm trong CSDL (cho scripts/check-citations.ts). */
export async function canCuTraCuuDaDuyet(): Promise<string[]> {
  const rows = await sql`
    SELECT citation_urn AS urn FROM violations WHERE status = 'da_duyet'
    UNION
    SELECT s->>'can_cu' FROM procedures, jsonb_array_elements(steps) s
    WHERE status = 'da_duyet' AND s->>'can_cu' IS NOT NULL
    UNION
    SELECT citation_urn FROM speed_limits WHERE status = 'da_duyet'`;
  return rows.map((r: any) => r.urn as string);
}

/* ------------------------------------------------------------------ */
/* Tốc độ tối đa (docs/PLAN.md GĐ-G2)                                  */
/* ------------------------------------------------------------------ */

/**
 * Nạp tốc độ tối đa. Dòng chưa có số liệu (`toc_do_toi_da` hoặc `can_cu` là null) bị bỏ qua: đó là
 * khung chờ đơn vị chuyên môn điền. Trạng thái theo `cheDo` như mức phạt. Trả số dòng đã nạp và số
 * dòng bỏ qua.
 */
export async function napTocDoToiDa(
  ds: DongTocDoToiDa[],
  opts: { tienTo?: string; cheDo?: CheDoNap } = {},
): Promise<{ daNap: number; boQua: number }> {
  const theoTep = (opts.cheDo ?? "theo_tep") === "theo_tep";
  const coSo = ds.filter(coSoLieuTocDo);
  await sql.begin(async (tx) => {
    for (const d of coSo) {
      await tx`
        INSERT INTO speed_limits (code, vehicle_class, violation_vehicle, road_type, road_type_name, name,
          max_speed, citation_urn, effective_from, effective_to, status, note, updated_at)
        VALUES (${d.ma}, ${d.loai_xe_chi_tiet}, ${d.xe}, ${d.loai_duong}, ${d.ten_loai_duong},
          ${`${d.loai_xe_chi_tiet} — ${d.ten_loai_duong}`}, ${d.toc_do_toi_da}, ${d.can_cu}, ${d.hieu_luc_tu},
          ${d.hieu_luc_den ?? null}, ${trangThaiNap(d.trang_thai, theoTep)}, ${d.ghi_chu ?? null}, now())
        ON CONFLICT (code) DO UPDATE SET
          vehicle_class = EXCLUDED.vehicle_class, violation_vehicle = EXCLUDED.violation_vehicle,
          road_type = EXCLUDED.road_type, road_type_name = EXCLUDED.road_type_name, name = EXCLUDED.name,
          max_speed = EXCLUDED.max_speed, citation_urn = EXCLUDED.citation_urn,
          effective_from = EXCLUDED.effective_from, effective_to = EXCLUDED.effective_to,
          note = EXCLUDED.note, updated_at = now(),
          ${giuTrangThai(
            tx,
            "speed_limits",
            theoTep,
            tx`(speed_limits.vehicle_class, speed_limits.violation_vehicle,
            speed_limits.road_type, speed_limits.max_speed, speed_limits.citation_urn, speed_limits.effective_from,
            speed_limits.effective_to)
            IS DISTINCT FROM (EXCLUDED.vehicle_class, EXCLUDED.violation_vehicle, EXCLUDED.road_type,
            EXCLUDED.max_speed, EXCLUDED.citation_urn, EXCLUDED.effective_from, EXCLUDED.effective_to)`,
          )}`;
    }
    if (opts.tienTo !== undefined || coSo.length) {
      const phamVi = `${(opts.tienTo ?? "").replace(/[%_]/g, "$&")}%`;
      await tx`
        UPDATE speed_limits SET status = 'ngung', updated_at = now()
        WHERE status <> 'ngung' AND created_by IS NULL AND code LIKE ${phamVi}
          AND NOT (code = ANY(${coSo.map((d) => d.ma)}))`;
    }
  });
  return { daNap: coSo.length, boQua: ds.length - coSo.length };
}

export interface TocDoToiDaRow {
  ma: string;
  xe: LoaiXe;
  loaiXeChiTiet: string;
  loaiDuong: string;
  tenLoaiDuong: string;
  tocDoToiDa: number;
  canCu: string;
  trangThai: string;
}

/** Tốc độ tối đa đã duyệt (hoặc cả bản nháp khi xem trước) áp dụng tại `ngay`, lọc theo loại xe. */
export async function tocDoToiDa(opts: {
  xe?: LoaiXe;
  loaiDuong?: string;
  ngay: string;
  gomBanNhap?: boolean;
}): Promise<TocDoToiDaRow[]> {
  const rows = await sql`
    SELECT * FROM speed_limits
    WHERE status = ANY(${trangThaiXem(!!opts.gomBanNhap)})
      AND (${opts.xe ?? null}::text IS NULL OR violation_vehicle = ${opts.xe ?? null})
      AND (${opts.loaiDuong ?? null}::text IS NULL OR road_type = ${opts.loaiDuong ?? null})
      AND effective_from <= ${opts.ngay} AND (effective_to IS NULL OR effective_to > ${opts.ngay})
    ORDER BY violation_vehicle, road_type, vehicle_class`;
  return rows.map((r: any) => ({
    ma: r.code,
    xe: r.violation_vehicle,
    loaiXeChiTiet: r.vehicle_class,
    loaiDuong: r.road_type,
    tenLoaiDuong: r.road_type_name,
    tocDoToiDa: r.max_speed,
    canCu: r.citation_urn,
    trangThai: r.status,
  }));
}
