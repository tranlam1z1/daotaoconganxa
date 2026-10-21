/**
 * Phép biến đổi từ bản đồ (cm) sang màn hình (px CSS) của bộ vẽ cảnh từ trên xuống (mô-đun M6).
 *
 * Tỷ lệ ngang và dọc tách riêng: đoạn đường dài hàng trăm mét mà màn điện thoại hẹp, nên cảnh là sơ
 * đồ, không đúng tỷ lệ; xe và biểu tượng vẽ theo cỡ px cố định.
 */

export interface KhungBanDo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BienDoi {
  /** px mỗi cm theo chiều ngang, chiều dọc. */
  tx: number;
  ty: number;
  x0: number;
  y0: number;
  /** Cỡ khung vẽ, px CSS. */
  rong: number;
  cao: number;
}

export function taoBienDoi(khung: KhungBanDo, rong: number, cao: number): BienDoi {
  return {
    tx: rong / Math.max(1, khung.x1 - khung.x0),
    ty: cao / Math.max(1, khung.y1 - khung.y0),
    x0: khung.x0,
    y0: khung.y0,
    rong,
    cao,
  };
}

export const raX = (bd: BienDoi, x: number) => (x - bd.x0) * bd.tx;
export const raY = (bd: BienDoi, y: number) => (y - bd.y0) * bd.ty;

/** Nội suy tuyến tính giữa hai nhịp (0 ≤ t ≤ 1). */
export const noiSuy = (a: number, b: number, t: number) => a + (b - a) * t;
