/**
 * Bản đồ khu phố dạng ô (mô-đun M9, docs/GAME_DESIGN.md §4.1). Tạo ở GĐ-T17 (câu D22: GĐ-T6 và GĐ-T16
 * chưa làm); GĐ-T6, GĐ-T16, GĐ-T20 dùng lại, sửa ngoài phần mở rộng đã ghi trong kế hoạch thì hỏi trước.
 *
 * Bản đồ là lưới `rong` × `cao` ô vuông, mỗi ô `o_m` mét. Người soạn viết bản đồ bằng các dòng ký tự
 * (dễ đọc, dễ duyệt trong JSON): mỗi ký tự là một ô, xem KY_HIEU_O. Ô (0, 0) ở góc trên trái; x tăng
 * sang phải (đông), y tăng xuống dưới (nam). Xe đi trên ô đường theo 4 hướng của M5 (0, 2, 4, 6).
 *
 * Giao lộ không khai riêng: ô đường có từ 3 ô đường kề là giao lộ.
 *
 * Hàm thuần, số nguyên, chạy được ở máy chủ và trình duyệt.
 */
import { BUOC_HUONG, type Huong } from "../mo-phong/duong.ts";

export const LOAI_O = ["duong", "nha", "truong_hoc", "cho", "cay", "trong"] as const;
export type LoaiO = (typeof LOAI_O)[number];

/** Ký hiệu một ô trong dòng bản đồ. */
export const KY_HIEU_O: Readonly<Record<string, LoaiO>> = {
  "=": "duong",
  "#": "nha",
  T: "truong_hoc",
  C: "cho",
  "*": "cay",
  ".": "trong",
};

export const TEN_LOAI_O: Record<LoaiO, string> = {
  duong: "Đường",
  nha: "Nhà",
  truong_hoc: "Trường học",
  cho: "Chợ",
  cay: "Cây xanh",
  trong: "Đất trống",
};

/** Bốn hướng đi trên lưới, theo thứ tự cố định (bắc, đông, nam, tây) để mọi phép duyệt tất định. */
export const HUONG_O = [0, 2, 4, 6] as const satisfies readonly Huong[];
export type HuongO = (typeof HUONG_O)[number];

export const TEN_HUONG_O: Record<HuongO, string> = { 0: "Bắc", 2: "Đông", 4: "Nam", 6: "Tây" };

/** Bản đồ khai trong nội dung. */
export interface BanDoO {
  rong: number;
  cao: number;
  /** Cạnh một ô, mét. */
  o_m: number;
  /** `cao` dòng, mỗi dòng `rong` ký tự theo KY_HIEU_O. */
  o: readonly string[];
}

export interface ToaDoO {
  x: number;
  y: number;
}

export interface LuoiO {
  rong: number;
  cao: number;
  o_m: number;
  /** Loại từng ô, theo hàng (chỉ số y × rong + x). */
  loai: readonly LoaiO[];
}

export const RONG_TOI_DA = 40;
export const O_M_TOI_THIEU = 10;
export const O_M_TOI_DA = 500;

/** Kiểm bản đồ; rỗng là hợp lệ. Lỗi chỉ đúng dòng, cột. */
export function kiemTraBanDo(bd: Partial<BanDoO> | null | undefined): string[] {
  if (!bd || typeof bd !== "object") return ["Thiếu bản đồ."];
  const loi: string[] = [];
  const { rong, cao, o_m, o } = bd;
  if (!Number.isInteger(rong) || (rong as number) < 3 || (rong as number) > RONG_TOI_DA)
    loi.push(`Bề ngang bản đồ từ 3 đến ${RONG_TOI_DA} ô.`);
  if (!Number.isInteger(cao) || (cao as number) < 3 || (cao as number) > RONG_TOI_DA)
    loi.push(`Bề dọc bản đồ từ 3 đến ${RONG_TOI_DA} ô.`);
  if (!Number.isInteger(o_m) || (o_m as number) < O_M_TOI_THIEU || (o_m as number) > O_M_TOI_DA)
    loi.push(`Cạnh một ô từ ${O_M_TOI_THIEU} đến ${O_M_TOI_DA} mét (số nguyên).`);
  if (!Array.isArray(o)) return [...loi, "Thiếu các dòng của bản đồ."];
  if (loi.length) return loi;
  if (o.length !== cao) loi.push(`Bản đồ cần ${cao} dòng, đang có ${o.length}.`);
  o.forEach((dong, y) => {
    if (typeof dong !== "string" || dong.length !== rong) {
      loi.push(`Dòng ${y + 1} cần ${rong} ký tự.`);
      return;
    }
    for (let x = 0; x < dong.length; x++)
      if (!Object.hasOwn(KY_HIEU_O, dong[x]!))
        loi.push(`Dòng ${y + 1}, cột ${x + 1}: ký hiệu "${dong[x]}" lạ.`);
  });
  if (!loi.length && !o.some((d) => d.includes("="))) loi.push("Bản đồ chưa có ô đường nào.");
  return loi;
}

/** Dựng lưới từ bản đồ. Ném lỗi khi bản đồ không hợp lệ (nội dung đã qua bộ kiểm thì không gặp). */
export function dungLuoi(bd: BanDoO): LuoiO {
  const loi = kiemTraBanDo(bd);
  if (loi.length) throw new Error(`Bản đồ không hợp lệ: ${loi.join(" ")}`);
  const loai: LoaiO[] = [];
  for (const dong of bd.o) for (const k of dong) loai.push(KY_HIEU_O[k]!);
  return { rong: bd.rong, cao: bd.cao, o_m: bd.o_m, loai };
}

export const trongLuoi = (l: Pick<LuoiO, "rong" | "cao">, p: ToaDoO) =>
  Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < l.rong && p.y < l.cao;

export const chiSo = (l: Pick<LuoiO, "rong">, p: ToaDoO) => p.y * l.rong + p.x;

export function loaiTai(l: LuoiO, p: ToaDoO): LoaiO | null {
  return trongLuoi(l, p) ? l.loai[chiSo(l, p)]! : null;
}

export const laDuong = (l: LuoiO, p: ToaDoO) => loaiTai(l, p) === "duong";

/** Ô kề theo hướng (có thể ra ngoài lưới). */
export function keTheoHuong(p: ToaDoO, h: HuongO): ToaDoO {
  const [dx, dy] = BUOC_HUONG[h];
  return { x: p.x + dx, y: p.y + dy };
}

/** Các ô đường kề, theo thứ tự HUONG_O. */
export function keDuong(l: LuoiO, p: ToaDoO): Array<{ huong: HuongO; o: ToaDoO }> {
  const kq: Array<{ huong: HuongO; o: ToaDoO }> = [];
  for (const h of HUONG_O) {
    const o = keTheoHuong(p, h);
    if (laDuong(l, o)) kq.push({ huong: h, o });
  }
  return kq;
}

export const laGiaoLo = (l: LuoiO, p: ToaDoO) => laDuong(l, p) && keDuong(l, p).length >= 3;

/** Ô nằm ở mép bản đồ. */
export const oMep = (l: Pick<LuoiO, "rong" | "cao">, p: ToaDoO) =>
  p.x === 0 || p.y === 0 || p.x === l.rong - 1 || p.y === l.cao - 1;

/** Hướng từ ô a sang ô kề b; null khi hai ô không kề nhau theo 4 hướng. */
export function huongGiua(a: ToaDoO, b: ToaDoO): HuongO | null {
  for (const h of HUONG_O) {
    const k = keTheoHuong(a, h);
    if (k.x === b.x && k.y === b.y) return h;
  }
  return null;
}

export const quayLai = (h: HuongO): HuongO => ((h + 4) % 8) as HuongO;

export const cungO = (a: ToaDoO, b: ToaDoO) => a.x === b.x && a.y === b.y;

/* ------------------------------------------------------------------ */
/* Đặt vật thể vào ô                                                   */
/* ------------------------------------------------------------------ */

/** Một vật đặt trên bản đồ (camera, tổ công tác, công trình…). */
export interface VatTrenO {
  id: string;
  loai: string;
  x: number;
  y: number;
}

/** Luật đặt một loại vật. */
export interface LuatDatVat {
  /** Loại ô được đặt. */
  loai_o: readonly LoaiO[];
  /** Hai vật cùng loại cách nhau ít nhất số ô này (khoảng cách Chebyshev); vắng là không giới hạn. */
  cach_toi_thieu?: number;
  /** Chỉ đặt ở giao lộ. */
  chi_giao_lo?: boolean;
}

/** Kiểm các vật trên bản đồ theo luật của từng loại. Mỗi vật tối đa một ô, hai vật không chung ô. */
export function kiemTraDatVat(
  l: LuoiO,
  vat: readonly VatTrenO[],
  luat: Readonly<Record<string, LuatDatVat>>,
): Array<{ vat: string; loi: string }> {
  const loi: Array<{ vat: string; loi: string }> = [];
  const daDat = new Map<number, string>();
  const ids = new Set<string>();
  for (const v of vat) {
    if (ids.has(v.id)) loi.push({ vat: v.id, loi: `Mã ${v.id} bị trùng.` });
    ids.add(v.id);
    const lu = Object.hasOwn(luat, v.loai) ? luat[v.loai] : undefined;
    if (!lu) {
      loi.push({ vat: v.id, loi: `Loại vật "${v.loai}" không đặt được trên bản đồ này.` });
      continue;
    }
    const o = { x: v.x, y: v.y };
    const lo = loaiTai(l, o);
    if (lo === null) {
      loi.push({ vat: v.id, loi: `${v.id} nằm ngoài bản đồ.` });
      continue;
    }
    if (!lu.loai_o.includes(lo))
      loi.push({ vat: v.id, loi: `${v.id} không đặt được trên ô ${TEN_LOAI_O[lo]}.` });
    if (lu.chi_giao_lo && !laGiaoLo(l, o)) loi.push({ vat: v.id, loi: `${v.id} phải đặt ở giao lộ.` });
    const i = chiSo(l, o);
    const co = daDat.get(i);
    if (co) loi.push({ vat: v.id, loi: `${v.id} chung ô với ${co}.` });
    else daDat.set(i, v.id);
    if (lu.cach_toi_thieu)
      for (const k of vat) {
        if (k === v || k.loai !== v.loai || k.id >= v.id) continue;
        if (Math.max(Math.abs(k.x - v.x), Math.abs(k.y - v.y)) < lu.cach_toi_thieu)
          loi.push({ vat: v.id, loi: `${v.id} và ${k.id} cách nhau chưa đủ ${lu.cach_toi_thieu} ô.` });
      }
  }
  return loi;
}
