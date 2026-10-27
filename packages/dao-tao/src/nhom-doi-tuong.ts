/** Nhóm nội dung học, độc lập với quyền quản lý và phạm vi đơn vị. */
export const NHOM_HOC_TAP = ["cong_chuc", "vien_chuc", "dang_vien"] as const;
export type NhomHocTap = (typeof NHOM_HOC_TAP)[number];
export const TEN_NHOM_HOC_TAP: Record<NhomHocTap, string> = {
  cong_chuc: "Công chức",
  vien_chuc: "Viên chức",
  dang_vien: "Đảng viên",
};

/** Giữ tương thích URL và yêu cầu cũ; không suy đoán nhóm thay thế cho công an. */
export function chuanHoaMaNhom(ma: string): string {
  return ma === "cong_chuc_cap_xa" ? "cong_chuc" : ma;
}
export function laNhomHocTap(ma: string): ma is NhomHocTap {
  return (NHOM_HOC_TAP as readonly string[]).includes(ma);
}

/** Chỉ dùng khi đọc dữ liệu chuyển tiếp; dữ liệu nhập sai phải bị từ chối tại API. */
export function nhomHocTapHienHanh(nhom: readonly string[]): NhomHocTap[] {
  return [...new Set(nhom.map(chuanHoaMaNhom).filter(laNhomHocTap))];
}
