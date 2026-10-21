/**
 * Luật thuần của lớp hiệu ứng trò chơi (docs/VISUAL_STYLE.md §3, §4). Không chạm DOM, để test được.
 * Chỉ quyết định HIỂN THỊ gì; không liên quan tới chấm điểm, XP hay đồng bộ (các phần đó ở máy chủ).
 */

/** Số câu đúng liên tiếp tính từ câu gần nhất trở về trước. `null` (bước không có đúng/sai) làm đứt chuỗi. */
export function chuoiDung(ketQua: ReadonlyArray<boolean | null | undefined>): number {
  let n = 0;
  for (let i = ketQua.length - 1; i >= 0; i--) {
    if (ketQua[i] !== true) break;
    n++;
  }
  return n;
}

/** Chuỗi bắt đầu hiện nhãn combo từ 3 câu đúng liên tiếp. */
export const COMBO_TOI_THIEU = 3;
/** Mốc combo có thêm tia sáng (§3.2 hiệu ứng 4). */
export function laMocCombo(n: number): boolean {
  return n === 5 || n === 10 || (n > 10 && n % 5 === 0);
}

/**
 * Lượt vừa xong có làm lên cấp không: trước khi cộng XP của lượt, tổng XP còn dưới ngưỡng của cấp
 * hiện tại. Chỉ để hiển thị lời chúc mừng; cấp do máy chủ tính.
 */
export function vuaLenCap(p: {
  xpTong: number;
  xpLuot: number;
  tuXpCapHienTai: number;
  cap: number;
}): boolean {
  return p.cap > 1 && p.xpLuot > 0 && p.xpTong - p.xpLuot < p.tuXpCapHienTai;
}

/**
 * Huy hiệu nhận trong lượt vừa xong: thời điểm nhận cách lúc kết thúc lượt không quá `giayLech` giây
 * (máy chủ trao huy hiệu trong cùng giao dịch kết thúc lượt).
 */
export function huyHieuTrongLuot<T extends { dat_luc: string | null }>(
  ds: readonly T[],
  ketThuc: string | null,
  giayLech = 10,
): T[] {
  if (!ketThuc) return [];
  const moc = Date.parse(ketThuc);
  return ds.filter((h) => h.dat_luc && Math.abs(Date.parse(h.dat_luc) - moc) <= giayLech * 1000);
}

/** Đường cong chạy số: nhanh lúc đầu, chậm dần về cuối (ease-out bậc ba). `t` từ 0 tới 1. */
export function giaTriSoChay(tu: number, den: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const e = 1 - (1 - k) ** 3;
  return tu + (den - tu) * e;
}

/* ------------------------------------------------------------------ */
/* Cài đặt âm thanh, rung, giảm hiệu ứng (§4.3, §6.3)                  */
/* ------------------------------------------------------------------ */

export interface CaiDatGame {
  amThanh: boolean;
  rung: boolean;
  giamHieuUng: boolean;
}

/** Mặc định: âm thanh tắt, rung bật, giảm hiệu ứng theo hệ điều hành (câu V3). */
export const CAI_DAT_MAC_DINH: CaiDatGame = { amThanh: false, rung: true, giamHieuUng: false };

export const KHOA_CAI_DAT = {
  amThanh: "qdpl.game.am-thanh",
  rung: "qdpl.game.rung",
  giamHieuUng: "qdpl.game.giam-hieu-ung",
} as const;

/** Đọc cài đặt từ các giá trị lưu ("1"/"0"); thiếu hoặc lạ thì dùng mặc định. */
export function docCaiDat(doc: (khoa: string) => string | null): CaiDatGame {
  const bool = (khoa: string, macDinh: boolean) => {
    const v = doc(khoa);
    return v === "1" ? true : v === "0" ? false : macDinh;
  };
  return {
    amThanh: bool(KHOA_CAI_DAT.amThanh, CAI_DAT_MAC_DINH.amThanh),
    rung: bool(KHOA_CAI_DAT.rung, CAI_DAT_MAC_DINH.rung),
    giamHieuUng: bool(KHOA_CAI_DAT.giamHieuUng, CAI_DAT_MAC_DINH.giamHieuUng),
  };
}

/** Mẫu rung (ms) cho từng sự kiện (§4.2). */
export const MAU_RUNG = {
  dung: [15],
  sai: [30, 40, 30],
  het_gio: [60],
  len_cap: [40, 60, 40],
} as const;
export type SuKienRung = keyof typeof MAU_RUNG;
