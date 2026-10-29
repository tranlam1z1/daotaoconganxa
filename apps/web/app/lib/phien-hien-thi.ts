import type { NguoiDung } from "./types";

export interface PhienHienThi {
  nguoiDung: NguoiDung | null;
  trangThaiPhien: "khach" | "hop_le" | "tam_loi";
}

/** Chỉ giữ danh tính để hiển thị; quyền truy cập luôn do loader/API xác nhận lại. */
export function nguoiDungDauTrang(truoc: NguoiDung | null, phien: PhienHienThi) {
  return phien.trangThaiPhien === "tam_loi" ? truoc : phien.nguoiDung;
}
