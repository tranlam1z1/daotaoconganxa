/**
 * Giới hạn tải trọng (`load_limits`): loại xe tải, dòng giới hạn và kiểm tệp.
 *
 * Dùng cho dữ liệu tra cứu nhanh (`data/tra-cuu/tai-trong.json`): nạp vào CSDL, duyệt và
 * hiển thị trong trang quản trị dữ liệu tra cứu.
 */

import { laNgay } from "./ngay.ts";

export const LOAI_XE_TAI = ["xe_tai_2_truc", "xe_tai_3_truc", "xe_tai_4_truc", "dau_keo_so_mi"] as const;
export type LoaiXeTai = (typeof LOAI_XE_TAI)[number];

export const TEN_LOAI_XE_TAI: Record<LoaiXeTai, string> = {
  xe_tai_2_truc: "Xe tải 2 trục",
  xe_tai_3_truc: "Xe tải 3 trục",
  xe_tai_4_truc: "Xe tải 4 trục",
  dau_keo_so_mi: "Đầu kéo, sơ mi rơ moóc",
};

/** Một dòng `load_limits` đã duyệt. */
export interface GioiHanTaiTrong {
  ma: string;
  version: number;
  loai: "tong" | "truc_don" | "cum_truc";
  loai_xe: LoaiXeTai | null;
  so_truc_cum: number | null;
  cach_tu_cm: number | null;
  /** Khoảng cách trục [từ, đến); null là không cận trên. */
  cach_den_cm: number | null;
  gioi_han_kg: number;
  ten: string;
  can_cu: string;
}

/** Một dòng của data/tra-cuu/tai-trong.json. */
export interface DongTaiTrongTep {
  ma: string;
  loai: "tong" | "truc_don" | "cum_truc";
  loai_xe?: LoaiXeTai | null;
  so_truc_cum?: number | null;
  cach_tu_cm?: number | null;
  cach_den_cm?: number | null;
  gioi_han_kg: number;
  ten: string;
  can_cu: string;
  hieu_luc_tu: string;
  hieu_luc_den?: string | null;
  trang_thai: string;
  ghi_chu?: string | null;
}

const chuoi = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;

/** Kiểm tệp giới hạn tải trọng: từng dòng, mã không trùng, khoảng cách cụm trục không chồng nhau. */
export function kiemTraTaiTrong(ds: DongTaiTrongTep[]): Array<{ ma: string; loi: string }> {
  const kq: Array<{ ma: string; loi: string }> = [];
  const daCo = new Set<string>();
  for (const d of ds) {
    const bao = (loi: string) => kq.push({ ma: d.ma || "(không có mã)", loi });
    if (!chuoi(d.ma, 3)) bao("Thiếu mã.");
    else if (daCo.has(d.ma)) bao("Mã bị trùng.");
    daCo.add(d.ma);
    if (!["tong", "truc_don", "cum_truc"].includes(d.loai)) bao("Loại giới hạn không hợp lệ.");
    if (d.loai === "tong" && !(LOAI_XE_TAI as readonly string[]).includes(d.loai_xe ?? ""))
      bao("Giới hạn tổng trọng lượng phải ghi loại xe.");
    if (d.loai === "cum_truc") {
      if (d.so_truc_cum !== 2 && d.so_truc_cum !== 3) bao("Cụm trục phải có 2 hoặc 3 trục.");
      if (!Number.isInteger(d.cach_tu_cm) || (d.cach_tu_cm ?? -1) < 0)
        bao("Cụm trục cần khoảng cách từ (cm).");
      if (d.cach_den_cm != null && !(d.cach_den_cm > (d.cach_tu_cm ?? 0)))
        bao("Khoảng cách đến phải lớn hơn khoảng cách từ.");
    }
    if (!Number.isInteger(d.gioi_han_kg) || d.gioi_han_kg <= 0 || d.gioi_han_kg > 200_000)
      bao("Giới hạn phải là số nguyên kg, lớn hơn 0.");
    if (!chuoi(d.ten, 5)) bao("Thiếu tên.");
    if (!chuoi(d.can_cu) || !d.can_cu.startsWith("vn:")) bao("Căn cứ phải là URN dạng vn:...");
    if (!laNgay(d.hieu_luc_tu)) bao("Ngày hiệu lực phải có dạng YYYY-MM-DD.");
  }
  const cum = ds.filter((d) => d.loai === "cum_truc" && d.trang_thai !== "ngung");
  for (const [i, a] of cum.entries())
    for (const b of cum.slice(i + 1)) {
      if (a.so_truc_cum !== b.so_truc_cum) continue;
      const aDen = a.cach_den_cm ?? Number.POSITIVE_INFINITY;
      const bDen = b.cach_den_cm ?? Number.POSITIVE_INFINITY;
      if ((a.cach_tu_cm ?? 0) < bDen && (b.cach_tu_cm ?? 0) < aDen)
        kq.push({ ma: a.ma, loi: `Khoảng cách cụm trục chồng lên dòng ${b.ma}.` });
    }
  const truc = ds.filter((d) => d.loai === "truc_don" && d.trang_thai !== "ngung");
  if (truc.length > 1) kq.push({ ma: truc[1]!.ma, loi: "Chỉ có một dòng giới hạn trục đơn còn dùng." });
  return kq;
}
