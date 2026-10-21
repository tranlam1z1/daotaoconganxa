/**
 * Chia dữ liệu /v1/bang-xep-hang thành các khối của trang Bảng xếp hạng (routes/bang-xep-hang.tsx):
 * bục ba hạng đầu, bảng từ dòng thứ tư, nhóm chưa có XP trong kỳ, vị trí của người xem, bảng cấp.
 *
 * Số hạng luôn lấy nguyên `hang` API trả về (đồng điểm thì đồng hạng: 1, 2, 2, 4, do `xepHang` ở
 * packages/db tính). Trang không tự đánh số, chỉ bỏ số hạng của người chưa có XP.
 */
import type { BangXepHang } from "./diem-thuong";

export type DongXepHang = BangXepHang["items"][number];

/** Điểm dùng để xếp: XP trong kỳ (bảng cá nhân) hoặc XP trung bình mỗi người (bảng đơn vị). */
export function diemXep(bang: Pick<BangXepHang, "pham_vi">, d: DongXepHang): number {
  return (bang.pham_vi === "don_vi" ? d.xp : d.xp_trung_binh) ?? 0;
}

/** Khóa React của một dòng: id đơn vị hoặc id tài khoản. */
export const khoaDong = (d: DongXepHang) => d.unit_id ?? d.account_id ?? `${d.hang}-${d.ten}`;

/** Dòng của chính người xem (bảng cá nhân) hoặc của đơn vị người xem (bảng đơn vị). */
export function laCuaToi(bang: Pick<BangXepHang, "pham_vi">, d: DongXepHang): boolean {
  return Boolean(bang.pham_vi === "don_vi" ? d.la_toi : d.la_cua_toi);
}

export interface BoCucXepHang {
  /** Mọi dòng có điểm > 0, đúng thứ tự API. Bục và bảng là hai phần liền nhau của danh sách này. */
  coDiem: DongXepHang[];
  /** Tối đa ba dòng đầu của `coDiem`. */
  buc: DongXepHang[];
  /** `coDiem` từ dòng thứ tư. */
  bang: DongXepHang[];
  /** Dòng có điểm 0: hiện riêng, không có số hạng. */
  chuaCoDiem: DongXepHang[];
}

export function chiaBoCuc(bang: Pick<BangXepHang, "pham_vi" | "items">): BoCucXepHang {
  const coDiem = bang.items.filter((d) => diemXep(bang, d) > 0);
  return {
    coDiem,
    buc: coDiem.slice(0, 3),
    bang: coDiem.slice(3),
    chuaCoDiem: bang.items.filter((d) => diemXep(bang, d) <= 0),
  };
}

/** Dòng `i` có cùng số hạng với dòng ngay trước hoặc ngay sau trong danh sách đã xếp. */
export function laDongHang(ds: DongXepHang[], i: number): boolean {
  const hang = ds[i]?.hang;
  return hang !== undefined && (ds[i - 1]?.hang === hang || ds[i + 1]?.hang === hang);
}

export interface ViTriCuaToi {
  dong: DongXepHang;
  hang: number;
  dongHang: boolean;
  /** Số dòng có điểm > 0 (mẫu số của "hạng X trên Y"). */
  tren: number;
  diem: number;
  /**
   * XP còn thiếu để vượt người gần nhất có XP cao hơn, và hạng sẽ đạt khi vượt (bằng hạng của người
   * đó). Không đồng hạng thì đó là hạng X − 1. null khi đang hạng 1, và luôn null ở bảng đơn vị
   * (XP trung bình là số lẻ, không cộng 1 được).
   */
  lenHang: { con: number; hang: number } | null;
}

/** Vị trí của người xem (hoặc đơn vị của người xem). null khi chưa có điểm trong kỳ. */
export function viTriCuaToi(bang: Pick<BangXepHang, "pham_vi" | "items">): ViTriCuaToi | null {
  const { coDiem } = chiaBoCuc(bang);
  const i = coDiem.findIndex((d) => laCuaToi(bang, d));
  if (i < 0) return null;
  const dong = coDiem[i]!;
  const diem = diemXep(bang, dong);
  const tren = coDiem
    .slice(0, i)
    .reverse()
    .find((d) => diemXep(bang, d) > diem);
  return {
    dong,
    hang: dong.hang,
    dongHang: laDongHang(coDiem, i),
    tren: coDiem.length,
    diem,
    lenHang:
      bang.pham_vi === "don_vi" && tren && dong.hang > 1
        ? { con: diemXep(bang, tren) - diem + 1, hang: tren.hang }
        : null,
  };
}

export interface MucCap {
  cap: number;
  tuXp: number;
  /** XP cao nhất vẫn còn ở cấp này; null ở cấp cao nhất. */
  denXp: number | null;
}

/** Bảng cấp từ ngưỡng: phần tử i của `nguong` là tổng XP tối thiểu của cấp i + 1. */
export function bangCap(nguong: readonly number[]): MucCap[] {
  return nguong.map((tuXp, i) => ({
    cap: i + 1,
    tuXp,
    denXp: nguong[i + 1] === undefined ? null : nguong[i + 1]! - 1,
  }));
}
