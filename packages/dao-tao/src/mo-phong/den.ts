/**
 * Đèn tín hiệu của bộ mô phỏng (mô-đun M5, mở rộng ở GĐ-T5).
 *
 * Một đèn chạy theo chu kỳ xanh → vàng → đỏ tính bằng nhịp, lệch pha `lech` nhịp. Đèn điều khiển một
 * hay nhiều làn, mỗi làn có một vạch dừng (quãng đường trên làn, cm). Hàm thuần, số nguyên.
 */

export type MauDen = "xanh" | "vang" | "do";

export interface DenTinHieu {
  id: string;
  /** Độ dài từng pha, nhịp. */
  xanh: number;
  vang: number;
  do: number;
  /** Lệch pha, nhịp: ở nhịp 0 đèn đang ở vị trí `lech` của chu kỳ. */
  lech: number;
  vach: ReadonlyArray<{ lan: string; s: number }>;
}

/** Người lái mô phỏng để ý đèn từ khoảng cách này (cm) trước vạch dừng. */
export const TAM_NHIN_DEN_CM = 6000;
/** Dừng cách vạch chừng này (mm). */
export const LUI_VACH_MM = 300;

export function mauDen(d: Pick<DenTinHieu, "xanh" | "vang" | "do" | "lech">, nhip: number): MauDen {
  const chuKy = d.xanh + d.vang + d.do;
  if (chuKy <= 0) return "xanh";
  const t = (((nhip + d.lech) % chuKy) + chuKy) % chuKy;
  return t < d.xanh ? "xanh" : t < d.xanh + d.vang ? "vang" : "do";
}
