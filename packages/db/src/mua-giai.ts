/**
 * Mùa giải đơn vị (docs/PLAN.md GĐ-G6, docs/GAME_DESIGN.md §5.10): tạo mùa, bảng hạng trực tiếp
 * trong tuần, chốt tuần. Luật (điểm, lên/xuống hạng, chia nhóm) ở packages/dao-tao/src/mua-giai.ts.
 *
 * - Đơn vị thi với nhau là các đơn vị có `level_label` bằng `seasons.unit_level_label`. XP và quân số
 *   của một đơn vị gồm cả đơn vị con của nó (theo `units.path`).
 * - XP theo `xp_ledger.unit_id` (đơn vị lúc nhận XP), nên người chuyển đơn vị giữa tuần để lại XP cũ
 *   cho đơn vị cũ.
 * - Tuần đang diễn ra: chỉ lưu hạng và nhóm; điểm tính trực tiếp, không lưu.
 * - Chốt tuần (`chayMuaGiai`) idempotent: tuần đã chốt thì bỏ qua, và mọi con số chỉ phụ thuộc mốc
 *   chốt cố định (06:00 thứ Hai), không phụ thuộc lúc chạy. Worker `qdpl-mua-giai` gọi mỗi giờ; API
 *   gọi bù khi có tuần tới hạn mà chưa chốt (máy không chạy worker, như bản demo).
 */
import {
  bacTuanSau,
  CAU_HINH_MUA_GIAI_MAC_DINH,
  type CauHinhMuaGiai,
  cacTuanCuaMua,
  canDeLenHang,
  chiaNhom,
  chotTuan,
  congNgayMuaGiai,
  type DonViDauVaoChot,
  datLaiMem,
  hanChotTuan,
  type KetQuaTuan,
  kiemCauHinhMuaGiai,
  laThuHai,
  ngayKetThucMua,
  ngayVietNam,
  phanNhomTuanSau,
  tuanCua,
  tuanThu,
  tuanToiHanChot,
  xepHangBanDau,
} from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";
import { LoiNghiepVu } from "./don-vi.ts";

export const HUY_HIEU_LEN_HANG = "len_hang_mua_giai";

/** Hàm đọc dùng được cả trong và ngoài giao dịch; union Sql | Tx không gọi được như tagged template. */
type Q = Tx;
const SQL = sql as unknown as Tx;

function chuoiNgay(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Mùa                                                                  */
/* ------------------------------------------------------------------ */

export type TrangThaiMua = "sap_dien_ra" | "dang_dien_ra" | "ket_thuc";

export interface MuaGiai {
  id: string;
  code: string;
  name: string;
  starts_on: string;
  ends_on: string;
  unit_level_label: string;
  config: CauHinhMuaGiai;
  status: TrangThaiMua;
  created_by: string | null;
  created_at: Date;
}

function docMua(r: any): MuaGiai {
  return {
    ...r,
    starts_on: chuoiNgay(r.starts_on),
    ends_on: chuoiNgay(r.ends_on),
    config: { ...CAU_HINH_MUA_GIAI_MAC_DINH, ...(r.config ?? {}) },
  };
}

export async function danhSachMuaGiai(): Promise<MuaGiai[]> {
  const rows = (await sql`SELECT * FROM seasons ORDER BY starts_on DESC, created_at DESC`) as any[];
  return rows.map(docMua);
}

export async function layMuaGiai(id: string, q: Q = SQL): Promise<MuaGiai | null> {
  const [r] = (await q`SELECT * FROM seasons WHERE id = ${id}`) as any[];
  return r ? docMua(r) : null;
}

/** Mùa đang diễn ra; không có thì mùa sắp diễn ra gần nhất; không có nữa thì mùa kết thúc gần nhất. */
export async function muaGiaiHienHanh(): Promise<MuaGiai | null> {
  const [r] = (await sql`
    SELECT * FROM seasons
    ORDER BY CASE status WHEN 'dang_dien_ra' THEN 0 WHEN 'sap_dien_ra' THEN 1 ELSE 2 END,
             CASE WHEN status = 'ket_thuc' THEN -extract(epoch FROM starts_on) ELSE extract(epoch FROM starts_on) END
    LIMIT 1`) as any[];
  return r ? docMua(r) : null;
}

export interface DuLieuMua {
  code: string;
  name: string;
  startsOn: string;
  unitLevelLabel: string;
  config?: Partial<CauHinhMuaGiai>;
}

function kiemDuLieuMua(d: { name: string; startsOn: string; unitLevelLabel: string }, cfg: CauHinhMuaGiai) {
  if (!d.name.trim()) throw new LoiNghiepVu("Nhập tên mùa giải.", "khong_hop_le");
  if (!d.unitLevelLabel.trim()) throw new LoiNghiepVu("Chọn cấp đơn vị thi đấu.", "khong_hop_le");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startsOn) || !laThuHai(d.startsOn)) {
    throw new LoiNghiepVu("Mùa giải phải bắt đầu vào thứ Hai.", "khong_hop_le");
  }
  const loi = kiemCauHinhMuaGiai(cfg);
  if (loi.length) throw new LoiNghiepVu(loi.join(" "), "khong_hop_le");
}

export async function taoMuaGiai(d: DuLieuMua, actor: string): Promise<MuaGiai> {
  const cfg = { ...CAU_HINH_MUA_GIAI_MAC_DINH, ...(d.config ?? {}) };
  kiemDuLieuMua(d, cfg);
  const [trung] = (await sql`SELECT 1 FROM seasons WHERE lower(code) = lower(${d.code})`) as any[];
  if (trung) throw new LoiNghiepVu(`Mã mùa giải "${d.code}" đã có.`, "xung_dot");
  const [r] = (await sql`
    INSERT INTO seasons (code, name, starts_on, ends_on, unit_level_label, config, created_by)
    VALUES (${d.code}, ${d.name.trim()}, ${d.startsOn}, ${ngayKetThucMua(d.startsOn, cfg.so_tuan)},
            ${d.unitLevelLabel.trim()}, ${sql.json(cfg as never)}, ${actor})
    RETURNING *`) as any[];
  await ghiNhatKy(SQL, actor, "mua_giai:tao", d.code, { ...d, config: cfg });
  return docMua(r);
}

/** Sửa tên, ngày bắt đầu, cấp đơn vị, cấu hình. Chỉ khi mùa chưa bắt đầu. */
export async function suaMuaGiai(
  id: string,
  d: Partial<Omit<DuLieuMua, "code">>,
  actor: string,
): Promise<MuaGiai> {
  return sql.begin(async (tx) => {
    const cu = await layMuaGiai(id, tx);
    if (!cu) throw new LoiNghiepVu("Không tìm thấy mùa giải.", "khong_tim_thay");
    if (cu.status !== "sap_dien_ra") {
      throw new LoiNghiepVu("Chỉ sửa được cấu hình khi mùa giải chưa bắt đầu.", "xung_dot");
    }
    const moi = {
      name: d.name ?? cu.name,
      startsOn: d.startsOn ?? cu.starts_on,
      unitLevelLabel: d.unitLevelLabel ?? cu.unit_level_label,
    };
    const cfg = { ...cu.config, ...(d.config ?? {}) };
    kiemDuLieuMua(moi, cfg);
    const [r] = (await tx`
      UPDATE seasons SET name = ${moi.name.trim()}, starts_on = ${moi.startsOn},
        ends_on = ${ngayKetThucMua(moi.startsOn, cfg.so_tuan)}, unit_level_label = ${moi.unitLevelLabel.trim()},
        config = ${tx.json(cfg as never)}
      WHERE id = ${id} RETURNING *`) as any[];
    await ghiNhatKy(tx, actor, "mua_giai:sua", cu.code, { ...moi, config: cfg });
    return docMua(r);
  }) as Promise<MuaGiai>;
}

/** Kết thúc sớm: không chốt thêm tuần nào. Các tuần đã chốt giữ nguyên. */
export async function ketThucMuaGiai(id: string, actor: string): Promise<MuaGiai> {
  const [r] = (await sql`
    UPDATE seasons SET status = 'ket_thuc' WHERE id = ${id} AND status <> 'ket_thuc' RETURNING *`) as any[];
  if (!r) {
    const cu = await layMuaGiai(id);
    if (!cu) throw new LoiNghiepVu("Không tìm thấy mùa giải.", "khong_tim_thay");
    return cu;
  }
  await ghiNhatKy(SQL, actor, "mua_giai:ket_thuc", r.code, {});
  return docMua(r);
}

async function ghiNhatKy(q: Q, actor: string, action: string, target: string, detail: unknown) {
  await q`INSERT INTO audit_log (actor, action, target, detail)
          VALUES (${actor}, ${action}, ${target}, ${sql.json(detail as never)})`;
}

/* ------------------------------------------------------------------ */
/* Dữ liệu một tuần                                                     */
/* ------------------------------------------------------------------ */

async function donViThiDau(q: Q, nhan: string): Promise<Array<{ id: string; name: string }>> {
  return (await q`
    SELECT id, name FROM units WHERE enabled AND lower(level_label) = lower(${nhan}) ORDER BY ordinal, name`) as any[];
}

/**
 * Đầu vào chốt tuần: hạng, nhóm, quân số và XP từng người của mọi đơn vị có dòng trong tuần. XP chỉ
 * gồm dòng có ngày trong tuần và ghi trước mốc chốt của tuần.
 */
async function duLieuTuan(q: Q, seasonId: string, tuan: string): Promise<DonViDauVaoChot[]> {
  const cuoi = congNgayMuaGiai(tuan, 6);
  const han = hanChotTuan(tuan);
  const [dong, quanSo, xp] = (await Promise.all([
    q`SELECT s.unit_id, u.name AS ten, s.tier, s.group_no
      FROM season_standings s JOIN units u ON u.id = s.unit_id
      WHERE s.season_id = ${seasonId} AND s.week_start = ${tuan}`,
    q`SELECT s.unit_id, count(a.id)::int AS n
      FROM season_standings s
      JOIN units u ON u.id = s.unit_id
      JOIN units con ON con.path <@ u.path
      JOIN accounts a ON a.unit_id = con.id AND a.enabled
      WHERE s.season_id = ${seasonId} AND s.week_start = ${tuan}
      GROUP BY s.unit_id`,
    q`SELECT s.unit_id, x.account_id, sum(x.xp)::int AS xp
      FROM season_standings s
      JOIN units u ON u.id = s.unit_id
      JOIN units con ON con.path <@ u.path
      JOIN xp_ledger x ON x.unit_id = con.id
      WHERE s.season_id = ${seasonId} AND s.week_start = ${tuan}
        AND x.day BETWEEN ${tuan} AND ${cuoi} AND x.created_at < ${han}
      GROUP BY s.unit_id, x.account_id`,
  ])) as any[][];
  const qs = new Map(quanSo!.map((r) => [r.unit_id, Number(r.n)]));
  const xpTheoDv = new Map<string, number[]>();
  for (const r of xp!) xpTheoDv.set(r.unit_id, [...(xpTheoDv.get(r.unit_id) ?? []), Number(r.xp)]);
  return dong!.map((r) => ({
    unit_id: r.unit_id,
    ten: r.ten,
    bac: Number(r.tier),
    nhom: Number(r.group_no),
    quan_so: qs.get(r.unit_id) ?? 0,
    xp_tung_nguoi: xpTheoDv.get(r.unit_id) ?? [],
  }));
}

/* ------------------------------------------------------------------ */
/* Bắt đầu mùa, chốt tuần                                               */
/* ------------------------------------------------------------------ */

/** Hạng ban đầu: đặt lại mềm từ mùa trước cùng cấp; không có mùa trước thì theo XP 4 tuần trước mùa. */
async function hangBanDau(
  tx: Tx,
  mua: MuaGiai,
  dvs: Array<{ id: string }>,
): Promise<Array<{ unit_id: string; bac: number; diem_truoc: number }>> {
  const cfg = mua.config;
  const [truoc] = (await tx`
    SELECT s.* FROM seasons s
    WHERE s.status = 'ket_thuc' AND s.id <> ${mua.id} AND lower(s.unit_level_label) = lower(${mua.unit_level_label})
      AND EXISTS (SELECT 1 FROM season_standings t WHERE t.season_id = s.id AND t.closed_at IS NOT NULL)
    ORDER BY s.starts_on DESC LIMIT 1`) as any[];
  if (truoc) {
    const cfgTruoc = docMua(truoc).config;
    const cuoi = (await tx`
      SELECT DISTINCT ON (unit_id) unit_id, tier, outcome, score
      FROM season_standings WHERE season_id = ${truoc.id} AND closed_at IS NOT NULL
      ORDER BY unit_id, week_start DESC`) as any[];
    const theoDv = new Map(cuoi.map((r) => [r.unit_id, r]));
    return dvs.map((d) => {
      const r = theoDv.get(d.id);
      if (!r) return { unit_id: d.id, bac: cfg.so_hang, diem_truoc: 0 };
      const bacCuoi = bacTuanSau(Number(r.tier), (r.outcome ?? "giu") as KetQuaTuan, cfgTruoc.so_hang);
      return {
        unit_id: d.id,
        bac: datLaiMem(Math.min(bacCuoi, cfg.so_hang), cfg.so_hang),
        diem_truoc: Number(r.score ?? 0),
      };
    });
  }
  const tu = congNgayMuaGiai(mua.starts_on, -28);
  const den = congNgayMuaGiai(mua.starts_on, -1);
  const ids = dvs.map((d) => d.id);
  const rows = (await tx`
    SELECT u.id AS unit_id,
      (SELECT count(a.id) FROM units con JOIN accounts a ON a.unit_id = con.id AND a.enabled
        WHERE con.path <@ u.path)::int AS quan_so,
      (SELECT COALESCE(sum(x.xp), 0) FROM units con JOIN xp_ledger x ON x.unit_id = con.id
        WHERE con.path <@ u.path AND x.day BETWEEN ${tu} AND ${den})::int AS xp
    FROM units u WHERE u.id = ANY(${ids}::uuid[])`) as any[];
  const tb = rows.map((r) => ({
    unit_id: r.unit_id as string,
    xp_trung_binh: r.quan_so ? Number(r.xp) / Number(r.quan_so) / 4 : 0,
  }));
  const bac = xepHangBanDau(tb, cfg.so_hang);
  return tb.map((r) => ({ unit_id: r.unit_id, bac: bac.get(r.unit_id)!, diem_truoc: r.xp_trung_binh }));
}

async function batDauMua(tx: Tx, mua: MuaGiai): Promise<boolean> {
  const [khac] =
    (await tx`SELECT code FROM seasons WHERE status = 'dang_dien_ra' AND id <> ${mua.id}`) as any[];
  if (khac) return false;
  const dvs = await donViThiDau(tx, mua.unit_level_label);
  const bd = await hangBanDau(tx, mua, dvs);
  const theoBac = new Map<number, typeof bd>();
  for (const d of bd) theoBac.set(d.bac, [...(theoBac.get(d.bac) ?? []), d]);
  for (const [bac, ds] of theoBac) {
    for (const [unitId, nhom] of chiaNhom(ds, mua.config.co_nhom)) {
      await tx`
        INSERT INTO season_standings (season_id, week_start, unit_id, tier, group_no)
        VALUES (${mua.id}, ${mua.starts_on}, ${unitId}, ${bac}, ${nhom})
        ON CONFLICT DO NOTHING`;
    }
  }
  await tx`UPDATE seasons SET status = 'dang_dien_ra' WHERE id = ${mua.id}`;
  return true;
}

/** Chốt một tuần. false nếu tuần đã chốt từ trước (chạy lại không đổi gì). */
async function chotMotTuan(tx: Tx, mua: MuaGiai, tuan: string): Promise<boolean> {
  const [da] = (await tx`
    SELECT 1 FROM season_standings
    WHERE season_id = ${mua.id} AND week_start = ${tuan} AND closed_at IS NOT NULL LIMIT 1`) as any[];
  if (da) return false;
  const cfg = mua.config;
  const han = hanChotTuan(tuan);
  const chot = chotTuan(await duLieuTuan(tx, mua.id, tuan), cfg);
  for (const d of chot) {
    await tx`
      UPDATE season_standings SET members = ${d.so_nguoi_choi}, active_members = ${d.quan_so},
        xp_counted = ${d.xp_tinh}, score = ${d.diem}, rank_in_group = ${d.hang}, outcome = ${d.ket_qua},
        closed_at = ${han}
      WHERE season_id = ${mua.id} AND week_start = ${tuan} AND unit_id = ${d.unit_id}`;
  }

  const tuanSau = congNgayMuaGiai(tuan, 7);
  if (tuanThu(mua.starts_on, tuanSau) <= cfg.so_tuan) {
    // Đơn vị bị tắt hoặc đổi cấp thì rời mùa; đơn vị mới đủ điều kiện vào hạng thấp nhất.
    const conDu = new Set((await donViThiDau(tx, mua.unit_level_label)).map((d) => d.id));
    const coRoi = new Set(chot.map((d) => d.unit_id));
    const moi = [...conDu].filter((id) => !coRoi.has(id));
    const phan = phanNhomTuanSau(
      chot.filter((d) => conDu.has(d.unit_id)),
      moi,
      cfg,
    );
    for (const p of phan) {
      await tx`
        INSERT INTO season_standings (season_id, week_start, unit_id, tier, group_no)
        VALUES (${mua.id}, ${tuanSau}, ${p.unit_id}, ${p.bac}, ${p.nhom})
        ON CONFLICT DO NOTHING`;
    }
  }

  const lenHang = chot.filter((d) => d.ket_qua === "len").map((d) => d.unit_id);
  if (lenHang.length) {
    await tx`
      INSERT INTO account_badges (account_id, badge_code, awarded_at)
      SELECT DISTINCT x.account_id, ${HUY_HIEU_LEN_HANG}, ${han}::timestamptz
      FROM units u
      JOIN units con ON con.path <@ u.path
      JOIN xp_ledger x ON x.unit_id = con.id
      WHERE u.id = ANY(${lenHang}::uuid[]) AND x.xp > 0
        AND x.day BETWEEN ${tuan} AND ${congNgayMuaGiai(tuan, 6)} AND x.created_at < ${han}
      ON CONFLICT DO NOTHING`;
  }
  return true;
}

export interface KetQuaChayMuaGiai {
  bat_dau: string[];
  tuan_da_chot: Array<{ mua: string; tuan: string }>;
  ket_thuc: string[];
}

/**
 * Việc định kỳ của mùa giải tại thời điểm `now`: bắt đầu mùa tới ngày, chốt mọi tuần đã qua mốc
 * 06:00 thứ Hai mà chưa chốt (kể cả tuần bị lỡ nhịp), kết thúc mùa khi chốt xong tuần cuối. Mỗi mùa
 * một giao dịch, khóa dòng `seasons` nên hai tiến trình chạy cùng lúc không chốt hai lần.
 */
export async function chayMuaGiai(now: Date = new Date()): Promise<KetQuaChayMuaGiai> {
  const kq: KetQuaChayMuaGiai = { bat_dau: [], tuan_da_chot: [], ket_thuc: [] };
  const ids = (await sql`
    SELECT id FROM seasons WHERE status IN ('sap_dien_ra', 'dang_dien_ra') ORDER BY starts_on`) as any[];
  for (const { id } of ids) {
    await sql.begin(async (tx) => {
      const [r] = (await tx`SELECT * FROM seasons WHERE id = ${id} FOR UPDATE`) as any[];
      if (!r) return;
      let mua = docMua(r);
      if (mua.status === "sap_dien_ra") {
        if (ngayVietNam(now) < mua.starts_on) return;
        if (!(await batDauMua(tx, mua))) return;
        kq.bat_dau.push(mua.code);
        mua = { ...mua, status: "dang_dien_ra" };
      }
      if (mua.status !== "dang_dien_ra") return;
      const toiHan = tuanToiHanChot(mua.starts_on, mua.config.so_tuan, now);
      for (const tuan of toiHan) {
        if (await chotMotTuan(tx, mua, tuan)) kq.tuan_da_chot.push({ mua: mua.code, tuan });
      }
      if (toiHan.length >= mua.config.so_tuan) {
        await tx`UPDATE seasons SET status = 'ket_thuc' WHERE id = ${mua.id}`;
        kq.ket_thuc.push(mua.code);
      }
    });
  }
  return kq;
}

/** Có việc chốt hay bắt đầu mùa nào đang tới hạn mà chưa làm không (kiểm nhanh trước khi gọi chayMuaGiai). */
export async function muaGiaiCanXuLy(now: Date = new Date()): Promise<boolean> {
  const rows = (await sql`
    SELECT s.id, s.status, s.starts_on, s.config,
      (SELECT max(week_start) FROM season_standings t WHERE t.season_id = s.id AND t.closed_at IS NOT NULL) AS da_chot
    FROM seasons s WHERE s.status IN ('sap_dien_ra', 'dang_dien_ra')`) as any[];
  return rows.some((r) => {
    const mua = docMua(r);
    if (mua.status === "sap_dien_ra") return ngayVietNam(now) >= mua.starts_on;
    const toiHan = tuanToiHanChot(mua.starts_on, mua.config.so_tuan, now);
    const cuoi = toiHan.at(-1);
    return Boolean(cuoi) && (!r.da_chot || chuoiNgay(r.da_chot) < cuoi!);
  });
}

/* ------------------------------------------------------------------ */
/* Xem bảng hạng                                                        */
/* ------------------------------------------------------------------ */

export interface DongBangMuaGiai {
  unit_id: string;
  ten: string;
  bac: number;
  nhom: number;
  quan_so: number;
  so_nguoi_choi: number;
  xp_tinh: number;
  diem: number;
  ty_le_tham_gia: number;
  xep_hang: boolean;
  hang: number | null;
  /** Nếu tuần chốt ngay bây giờ. */
  du_kien: KetQuaTuan | null;
  la_cua_toi: boolean;
}

export interface NhomMuaGiai {
  bac: number;
  nhom: number;
  items: DongBangMuaGiai[];
}

export interface KetQuaTuanTruoc {
  tuan: string;
  bac: number;
  bac_tuan_sau: number;
  ket_qua: KetQuaTuan | null;
  hang: number | null;
  so_don_vi_xep_hang: number;
  diem: number;
  xp_tinh: number;
  quan_so: number;
  so_nguoi_choi: number;
}

export interface XemMuaGiai {
  mua: (Omit<MuaGiai, "created_by" | "created_at"> & { tuan_thu: number }) | null;
  tuan: { bat_dau: string; ket_thuc: string; han_chot: string } | null;
  don_vi_cua_toi: { unit_id: string; ten: string } | null;
  nhom_cua_toi: NhomMuaGiai | null;
  can_de_len_hang: { diem_can: number; xp_can: number; diem_moc: number } | null;
  tuan_truoc: KetQuaTuanTruoc | null;
  /** Mọi nhóm (quản trị) hoặc các nhóm có đơn vị trong phạm vi (cán bộ quản lý). */
  cac_nhom?: NhomMuaGiai[];
  ghi_chu?: string;
}

/** Đơn vị thi đấu chứa đơn vị `unitPath` (chính nó hoặc cấp trên gần nhất có cấp đúng). */
async function donViThiDauCua(unitPath: string, nhan: string): Promise<{ id: string; name: string } | null> {
  const [r] = (await sql`
    SELECT id, name FROM units
    WHERE ${unitPath}::ltree <@ path AND lower(level_label) = lower(${nhan})
    ORDER BY nlevel(path) DESC LIMIT 1`) as any[];
  return r ?? null;
}

/**
 * Bảng mùa giải cho người xem.
 *  - `unitPath`: đơn vị của người xem (null nếu chưa gắn đơn vị).
 *  - `phamVi`: "tat_ca" (quản trị) thấy mọi nhóm; một đường dẫn ltree (cán bộ quản lý) thấy các nhóm
 *    có đơn vị trong cây đó; null chỉ thấy nhóm của đơn vị mình.
 */
export async function xemMuaGiai(p: {
  unitPath: string | null;
  phamVi: "tat_ca" | string | null;
  now?: Date;
  muaId?: string;
}): Promise<XemMuaGiai> {
  const now = p.now ?? new Date();
  const mua = p.muaId ? await layMuaGiai(p.muaId) : await muaGiaiHienHanh();
  const rong: XemMuaGiai = {
    mua: null,
    tuan: null,
    don_vi_cua_toi: null,
    nhom_cua_toi: null,
    can_de_len_hang: null,
    tuan_truoc: null,
  };
  if (!mua) return { ...rong, ghi_chu: "Chưa có mùa giải nào." };

  const cacTuan = cacTuanCuaMua(mua.starts_on, mua.config.so_tuan);
  // Tuần đang hiện: tuần hiện tại nếu nằm trong mùa; trước mùa là tuần đầu; sau mùa là tuần cuối có dữ liệu.
  const [cuoiCoDl] = (await sql`
    SELECT max(week_start) AS t FROM season_standings WHERE season_id = ${mua.id}`) as any[];
  const hienTai = tuanCua(now);
  let tuan = hienTai;
  if (hienTai < mua.starts_on) tuan = mua.starts_on;
  else if (!cacTuan.includes(hienTai) || mua.status === "ket_thuc") {
    tuan = cuoiCoDl?.t ? chuoiNgay(cuoiCoDl.t) : cacTuan.at(-1)!;
  }
  const { created_by: _a, created_at: _b, ...muaGon } = mua;
  const ra: XemMuaGiai = {
    ...rong,
    mua: { ...muaGon, tuan_thu: Math.max(0, Math.min(mua.config.so_tuan, tuanThu(mua.starts_on, tuan))) },
    tuan: { bat_dau: tuan, ket_thuc: congNgayMuaGiai(tuan, 6), han_chot: hanChotTuan(tuan).toISOString() },
  };

  const cua = p.unitPath ? await donViThiDauCua(p.unitPath, mua.unit_level_label) : null;
  ra.don_vi_cua_toi = cua ? { unit_id: cua.id, ten: cua.name } : null;

  // Tuần đã chốt thì đọc số đã lưu; tuần đang diễn ra thì tính trực tiếp.
  const daChot = (await sql`
    SELECT s.*, u.name AS ten FROM season_standings s JOIN units u ON u.id = s.unit_id
    WHERE s.season_id = ${mua.id} AND s.week_start = ${tuan} AND s.closed_at IS NOT NULL`) as any[];
  let bang: DongBangMuaGiai[];
  if (daChot.length) {
    bang = daChot.map((r) => ({
      unit_id: r.unit_id,
      ten: r.ten,
      bac: Number(r.tier),
      nhom: Number(r.group_no),
      quan_so: Number(r.active_members ?? 0),
      so_nguoi_choi: Number(r.members ?? 0),
      xp_tinh: Number(r.xp_counted ?? 0),
      diem: Number(r.score ?? 0),
      ty_le_tham_gia: r.active_members ? Number(r.members) / Number(r.active_members) : 0,
      xep_hang: r.rank_in_group !== null,
      hang: r.rank_in_group === null ? null : Number(r.rank_in_group),
      du_kien: r.outcome ?? null,
      la_cua_toi: r.unit_id === cua?.id,
    }));
  } else {
    bang = chotTuan(await duLieuTuan(SQL, mua.id, tuan), mua.config).map((d) => ({
      unit_id: d.unit_id,
      ten: d.ten,
      bac: d.bac,
      nhom: d.nhom,
      quan_so: d.quan_so,
      so_nguoi_choi: d.so_nguoi_choi,
      xp_tinh: d.xp_tinh,
      diem: d.diem,
      ty_le_tham_gia: d.ty_le_tham_gia,
      xep_hang: d.xep_hang,
      hang: d.hang,
      du_kien: d.ket_qua,
      la_cua_toi: d.unit_id === cua?.id,
    }));
  }
  const nhomCua = (bac: number, nhom: number): NhomMuaGiai => ({
    bac,
    nhom,
    items: bang
      .filter((d) => d.bac === bac && d.nhom === nhom)
      .sort(
        (a, b) => (a.hang ?? 1e9) - (b.hang ?? 1e9) || b.diem - a.diem || a.ten.localeCompare(b.ten, "vi"),
      ),
  });

  const toi = cua ? bang.find((d) => d.unit_id === cua.id) : undefined;
  if (toi) {
    ra.nhom_cua_toi = nhomCua(toi.bac, toi.nhom);
    ra.can_de_len_hang = canDeLenHang(ra.nhom_cua_toi.items, toi.unit_id, toi.bac, mua.config);
  } else if (mua.status === "sap_dien_ra") {
    ra.ghi_chu = `Mùa giải bắt đầu ngày ${mua.starts_on.split("-").reverse().join("/")}. Nhóm thi đấu được chia vào ngày đó.`;
  } else if (cua) {
    ra.ghi_chu =
      "Đơn vị của bạn chưa có trong mùa giải này. Đơn vị mới được xếp vào hạng thấp nhất từ tuần sau.";
  } else if (p.unitPath) {
    ra.ghi_chu = `Mùa giải này dành cho cấp ${mua.unit_level_label}; đơn vị của bạn không thuộc cấp đó.`;
  } else {
    ra.ghi_chu = "Tài khoản chưa gắn đơn vị nên chưa tham gia mùa giải.";
  }

  if (p.phamVi !== null) {
    let trongPhamVi: Set<string> | null = null;
    if (p.phamVi !== "tat_ca") {
      const ids = (await sql`
        SELECT id FROM units WHERE path <@ ${p.phamVi}::ltree OR ${p.phamVi}::ltree <@ path`) as any[];
      trongPhamVi = new Set(ids.map((r) => r.id));
    }
    const khoa = new Set<string>();
    for (const d of bang) if (!trongPhamVi || trongPhamVi.has(d.unit_id)) khoa.add(`${d.bac}:${d.nhom}`);
    ra.cac_nhom = [...khoa]
      .map((k) => k.split(":").map(Number) as [number, number])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([b, n]) => nhomCua(b, n));
  }

  if (cua) {
    const [tr] = (await sql`
      SELECT s.*, (SELECT count(*) FROM season_standings t
                   WHERE t.season_id = s.season_id AND t.week_start = s.week_start AND t.tier = s.tier
                     AND t.group_no = s.group_no AND t.rank_in_group IS NOT NULL)::int AS so_xep_hang
      FROM season_standings s
      WHERE s.season_id = ${mua.id} AND s.unit_id = ${cua.id} AND s.closed_at IS NOT NULL AND s.week_start < ${tuan}
      ORDER BY s.week_start DESC LIMIT 1`) as any[];
    if (tr) {
      const kq = (tr.outcome ?? null) as KetQuaTuan | null;
      ra.tuan_truoc = {
        tuan: chuoiNgay(tr.week_start),
        bac: Number(tr.tier),
        bac_tuan_sau: bacTuanSau(Number(tr.tier), kq ?? "giu", mua.config.so_hang),
        ket_qua: kq,
        hang: tr.rank_in_group === null ? null : Number(tr.rank_in_group),
        so_don_vi_xep_hang: Number(tr.so_xep_hang),
        diem: Number(tr.score ?? 0),
        xp_tinh: Number(tr.xp_counted ?? 0),
        quan_so: Number(tr.active_members ?? 0),
        so_nguoi_choi: Number(tr.members ?? 0),
      };
    }
  }
  return ra;
}
