/** Chia văn bản thành cụm trang chồng lấn để agent xử lý (ke-hoach/05 §4.1). */
import type { CuaSo } from "./types.ts";

export interface TuyChonCuaSo {
  /** Số trang mỗi cụm. Mặc định 5 (khoảng 4–6 theo kế hoạch). */
  kichThuoc?: number;
  /** Số trang chồng lấn với cụm trước. Mặc định 1. */
  chongLan?: number;
}

export const KICH_THUOC_MAC_DINH = 5;
export const CHONG_LAN_MAC_DINH = 1;

/**
 * Cụm cuối chỉ còn 1 trang thì gộp vào cụm trước: một trang lẻ đứng riêng gần như
 * luôn rơi vào giữa chừng một khoản, ghép lại dễ sai.
 */
export function lapKeHoachCuaSo(soTrang: number, opts: TuyChonCuaSo = {}): CuaSo[] {
  const kichThuoc = Math.max(1, opts.kichThuoc ?? KICH_THUOC_MAC_DINH);
  const chongLan = Math.max(0, Math.min(opts.chongLan ?? CHONG_LAN_MAC_DINH, kichThuoc - 1));
  if (soTrang <= 0) return [];
  const buoc = kichThuoc - chongLan;
  const ra: CuaSo[] = [];
  let dau = 1;
  while (dau <= soTrang) {
    const cuoi = Math.min(dau + kichThuoc - 1, soTrang);
    ra.push({
      idx: ra.length + 1,
      tuTrang: dau,
      denTrang: cuoi,
      ...(ra.length ? { trangChongLan: dau } : {}),
    });
    if (cuoi >= soTrang) break;
    dau += buoc;
  }
  const cuoiCung = ra.at(-1);
  const truoc = ra.at(-2);
  if (cuoiCung && truoc && cuoiCung.denTrang - cuoiCung.tuTrang + 1 <= chongLan + 1 && ra.length > 1) {
    truoc.denTrang = cuoiCung.denTrang;
    ra.pop();
  }
  return ra;
}

/** Tổng số trang thật sự phải đọc (đã trừ phần chồng lấn) — dùng để ước lượng chi phí. */
export function soTrangPhaiDoc(kh: CuaSo[]): number {
  return kh.reduce((s, c) => s + (c.denTrang - c.tuTrang + 1), 0);
}
