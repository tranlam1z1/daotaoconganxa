/**
 * Đường đi ngắn nhất trên lưới ô (mô-đun M9). Đi trên ô đường theo 4 hướng, mỗi bước một ô.
 *
 * Tất định: duyệt theo chiều rộng, láng giềng theo thứ tự HUONG_O; khi có nhiều đường cùng độ dài thì
 * luôn chọn cùng một đường (ưu tiên bắc, đông, nam, tây ở mỗi bước).
 */
import { chiSo, HUONG_O, keTheoHuong, type LuoiO, laDuong, type ToaDoO } from "./luoi.ts";

/** Số bước (ô) từ `tu` tới mọi ô đường; -1 là không tới được. `tu` không phải ô đường thì mọi ô -1. */
export function khoangCachTu(l: LuoiO, tu: ToaDoO): Int32Array {
  const d = new Int32Array(l.rong * l.cao).fill(-1);
  if (!laDuong(l, tu)) return d;
  const hang: ToaDoO[] = [tu];
  d[chiSo(l, tu)] = 0;
  for (let i = 0; i < hang.length; i++) {
    const p = hang[i]!;
    const dp = d[chiSo(l, p)]!;
    for (const h of HUONG_O) {
      const k = keTheoHuong(p, h);
      if (!laDuong(l, k) || d[chiSo(l, k)] !== -1) continue;
      d[chiSo(l, k)] = dp + 1;
      hang.push(k);
    }
  }
  return d;
}

/** Số bước ngắn nhất giữa hai ô đường; null khi không tới được. */
export function soBuocNganNhat(l: LuoiO, tu: ToaDoO, den: ToaDoO): number | null {
  if (!laDuong(l, den)) return null;
  const v = khoangCachTu(l, tu)[chiSo(l, den)]!;
  return v < 0 ? null : v;
}

/** Một đường ngắn nhất từ `tu` tới `den` (gồm cả hai đầu); null khi không tới được. */
export function duongNganNhat(l: LuoiO, tu: ToaDoO, den: ToaDoO): ToaDoO[] | null {
  const d = khoangCachTu(l, den);
  const n = laDuong(l, tu) ? d[chiSo(l, tu)]! : -1;
  if (n < 0) return null;
  const kq: ToaDoO[] = [tu];
  let p = tu;
  for (let buoc = n; buoc > 0; buoc--) {
    const tiep = HUONG_O.map((h) => keTheoHuong(p, h)).find(
      (k) => laDuong(l, k) && d[chiSo(l, k)] === buoc - 1,
    )!;
    kq.push(tiep);
    p = tiep;
  }
  return kq;
}
