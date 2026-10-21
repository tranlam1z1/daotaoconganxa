/**
 * Bộ kiểm dạng dữ liệu của trò "Trạm cân tải trọng" (docs/PLAN.md GĐ-T12): xe (game_content) và tệp
 * giới hạn tải trọng (data/tra-cuu/tai-trong.json). Chỉ máy chủ và script nạp dùng; tách khỏi
 * tram-can.ts để mã tải xuống điện thoại gọn.
 */

import { kiemTraGiayToXeTai, laNgay } from "./chung/giay-to.ts";
import {
  LOAI_XE_TAI,
  type LoaiXeTai,
  type PayloadTramCan,
  SO_MAN_TRAM_CAN,
  soTrucCuaNhom,
} from "./tram-can.ts";

const chuoi = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;

/** Số trục của từng loại xe; đầu kéo sơ mi rơ moóc từ 5 trục. */
const SO_TRUC: Record<LoaiXeTai, (n: number) => boolean> = {
  xe_tai_2_truc: (n) => n === 2,
  xe_tai_3_truc: (n) => n === 3,
  xe_tai_4_truc: (n) => n === 4,
  dau_keo_so_mi: (n) => n >= 5,
};

/** Kiểm dạng một xe. Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraXeTramCan(p: Partial<PayloadTramCan> | null | undefined): string[] {
  if (!p || typeof p !== "object") return ["Thiếu dữ kiện xe."];
  const loi: string[] = [];
  const muc = p.muc ?? 0;
  if (!Number.isInteger(muc) || muc < 1 || muc > SO_MAN_TRAM_CAN)
    loi.push(`Màn của xe (muc) phải từ 1 đến ${SO_MAN_TRAM_CAN}.`);
  if (!(LOAI_XE_TAI as readonly string[]).includes(p.loai_xe as string))
    return [...loi, "Loại xe không hợp lệ."];
  if (!chuoi(p.bien_so, 5) || !chuoi(p.tuyen_dang_di, 3)) loi.push("Xe cần biển số và tuyến đang đi.");
  const nhom = p.nhom_truc;
  if (
    !Array.isArray(nhom) ||
    nhom.length < 2 ||
    nhom[0]?.loai !== "don" ||
    nhom.some(
      (n) =>
        !(
          n?.loai === "don" ||
          (n?.loai === "cum" &&
            (n.so_truc === 2 || n.so_truc === 3) &&
            Number.isInteger(n.khoang_cach_cm) &&
            n.khoang_cach_cm > 0)
        ),
    )
  )
    return [
      ...loi,
      "Cấu hình trục cần ít nhất hai nhóm, nhóm đầu là trục đơn, cụm trục có 2 hoặc 3 trục và khoảng cách (cm).",
    ];
  const soTruc = nhom.reduce((s, n) => s + soTrucCuaNhom(n), 0);
  if (!SO_TRUC[p.loai_xe!](soTruc)) loi.push(`Số trục (${soTruc}) không hợp với loại xe.`);
  loi.push(
    ...kiemTraGiayToXeTai(
      { phieu_can: p.phieu_can, giay_kiem_dinh: p.giay_kiem_dinh, giay_phep_luu_hanh: p.giay_phep_luu_hanh },
      nhom.length,
    ),
  );
  const pc = p.phieu_can;
  if (pc && Array.isArray(pc.truc_kg) && pc.truc_kg.reduce((s, x) => s + x, 0) !== pc.tong_kg)
    loi.push("Tổng tải trọng các nhóm trục phải bằng tổng trọng lượng trên phiếu cân.");
  const kd = p.giay_kiem_dinh;
  if (kd && pc && typeof kd.tu_trong_kg === "number" && pc.tong_kg < kd.tu_trong_kg)
    loi.push("Tổng trọng lượng không được nhỏ hơn tự trọng của xe.");
  if (kd && chuoi(kd.bien_so) && chuoi(p.bien_so) && kd.bien_so !== p.bien_so)
    loi.push("Biển số trên giấy kiểm định phải là biển số của xe.");
  if (muc === 1 && p.loai_xe !== "xe_tai_2_truc") loi.push("Màn 1 chỉ có xe tải hai trục.");
  if (p.loai_xe === "dau_keo_so_mi" && muc < 5) loi.push("Xe đầu kéo sơ mi rơ moóc chỉ có từ màn 5.");
  if (p.giay_phep_luu_hanh && muc < 4) loi.push("Giấy phép lưu hành chỉ có từ màn 4.");
  return loi;
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
