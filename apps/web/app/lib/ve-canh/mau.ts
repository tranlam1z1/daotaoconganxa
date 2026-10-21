/**
 * Bảng màu của cảnh vẽ bằng Canvas (mô-đun M6), đọc từ token CSS của hướng A "Cảnh phục"
 * (docs/VISUAL_STYLE.md) để cảnh đổi theo giao diện sáng/tối như mọi thứ khác.
 */

export interface BangMau {
  nen: string;
  co: string;
  duong: string;
  vach: string;
  chu: string;
  chuPhu: string;
  chinh: string;
  chinhNhat: string;
  nguy: string;
  canhBao: string;
  dat: string;
  mat: string;
}

const MAC_DINH: BangMau = {
  nen: "#f4f1ea",
  co: "#dfe8d6",
  duong: "#4a4f57",
  vach: "#ffffff",
  chu: "#1c2430",
  chuPhu: "#5b6572",
  chinh: "#1f4e8c",
  chinhNhat: "#dbe6f5",
  nguy: "#b3261e",
  canhBao: "#b26a00",
  dat: "#2e7d32",
  mat: "#ffffff",
};

/** Đọc bảng màu hiện tại; ngoài trình duyệt thì trả màu mặc định. */
export function docBangMau(el?: Element | null): BangMau {
  if (typeof window === "undefined") return MAC_DINH;
  const s = getComputedStyle(el ?? document.documentElement);
  const v = (ten: string, du: string) => s.getPropertyValue(ten).trim() || du;
  return {
    nen: v("--canvas", MAC_DINH.nen),
    co: v("--ok-soft", MAC_DINH.co),
    duong: v("--ink-2", MAC_DINH.duong),
    vach: v("--surface", MAC_DINH.vach),
    chu: v("--ink", MAC_DINH.chu),
    chuPhu: v("--ink-2", MAC_DINH.chuPhu),
    chinh: v("--primary", MAC_DINH.chinh),
    chinhNhat: v("--primary-soft", MAC_DINH.chinhNhat),
    nguy: v("--danger", MAC_DINH.nguy),
    canhBao: v("--warn", MAC_DINH.canhBao),
    dat: v("--ok", MAC_DINH.dat),
    mat: v("--surface", MAC_DINH.mat),
  };
}
