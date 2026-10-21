/**
 * Bộ kiểm dạng dữ liệu của trò "Lên xe khách" (docs/PLAN.md GĐ-T13): xe (game_content). Chỉ máy chủ và
 * script nạp dùng; tách khỏi len-xe-khach.ts để mã tải xuống điện thoại gọn.
 */

import { kiemTraGiayToVanTai, LOI_VAN_TAI, laGio, laNgay, phutCuaGio } from "./chung/giay-to.ts";
import {
  HINH_PHAN_TU,
  LOAI_XE_KHACH,
  laNguoi,
  type PayloadXeKhach,
  SO_MAN_XE_KHACH,
  soDoKhoang,
} from "./len-xe-khach.ts";

const chuoi = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;

/** Kiểm dạng một xe và danh sách lỗi dự kiến. Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraXeKhachTroChoi(
  p: Partial<PayloadXeKhach> | null | undefined,
  loiDuKien: readonly unknown[] = [],
): string[] {
  if (!p || typeof p !== "object") return ["Thiếu dữ kiện xe."];
  const loi: string[] = [];
  const muc = p.muc ?? 0;
  if (!Number.isInteger(muc) || muc < 1 || muc > SO_MAN_XE_KHACH)
    loi.push(`Màn của xe (muc) phải từ 1 đến ${SO_MAN_XE_KHACH}.`);
  if (!(LOAI_XE_KHACH as readonly string[]).includes(p.loai_xe as string))
    return [...loi, "Loại xe không hợp lệ."];
  if (!chuoi(p.bien_so, 5) || !chuoi(p.lai_xe, 3)) loi.push("Xe cần biển số và họ tên người đang lái.");
  if (!laNgay(p.ngay_kiem_tra) || !laGio(p.gio_kiem_tra))
    loi.push("Xe cần ngày kiểm tra (YYYY-MM-DD) và giờ kiểm tra (HH:mm).");

  const soDo = soDoKhoang(p.loai_xe!);
  const theoMa = new Map(soDo.o.map((o) => [o.ma, o]));
  const pt = p.phan_tu;
  if (!Array.isArray(pt) || !pt.length || pt.length > 120) return [...loi, "Sơ đồ cần 1 đến 120 phần tử."];
  const daDung = new Set<string>();
  for (const [i, x] of pt.entries()) {
    const o = theoMa.get(x?.o);
    if (!o || !(HINH_PHAN_TU as readonly string[]).includes(x.hinh)) {
      loi.push(`Phần tử ${i + 1}: ô hoặc hình không hợp lệ.`);
      continue;
    }
    if (daDung.has(x.o)) loi.push(`Ô ${x.o} có hai phần tử.`);
    daDung.add(x.o);
    if (x.hinh === "ao_treo" && o.loai !== "ghe" && o.loai !== "giuong")
      loi.push(`Phần tử ${i + 1}: áo treo chỉ ở ghế hoặc giường.`);
  }
  if (!pt.some((x) => laNguoi(x.hinh))) loi.push("Xe cần ít nhất một người.");
  if (muc < 2 && pt.some((x) => x.hinh === "tre_em")) loi.push("Trẻ em chỉ có từ màn 2.");

  loi.push(
    ...kiemTraGiayToVanTai({
      lenh_van_chuyen: p.lenh_van_chuyen,
      phu_hieu: p.phu_hieu,
      giam_sat_hanh_trinh: p.giam_sat_hanh_trinh,
    }),
  );
  const g = p.giam_sat_hanh_trinh;
  if (g && laNgay(g.ngay) && g.ngay !== p.ngay_kiem_tra) loi.push("Dữ liệu giám sát phải của ngày kiểm tra.");
  const cuoi = Array.isArray(g?.doan) ? g.doan.at(-1) : undefined;
  if (cuoi && laGio(cuoi.den) && laGio(p.gio_kiem_tra) && phutCuaGio(cuoi.den) > phutCuaGio(p.gio_kiem_tra))
    loi.push("Dữ liệu giám sát không được kéo dài quá giờ kiểm tra.");

  if (muc === 1 && p.loai_xe !== "xe_16_cho") loi.push("Màn 1 chỉ có xe 16 chỗ.");
  if (p.loai_xe === "xe_giuong_nam" && muc < 5) loi.push("Xe giường nằm chỉ có từ màn 5.");
  if (
    !Array.isArray(loiDuKien) ||
    loiDuKien.some((m) => !(LOI_VAN_TAI as readonly unknown[]).includes(m)) ||
    new Set(loiDuKien).size !== loiDuKien.length
  )
    loi.push("Lỗi dự kiến phải là danh sách mã lỗi vận tải hợp lệ, không trùng.");
  return loi;
}
