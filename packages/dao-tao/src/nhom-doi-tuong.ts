/** Nhóm nội dung học, độc lập với quyền quản lý và phạm vi đơn vị. */
export const NHOM_HOC_TAP = ["cong_an_cap_xa", "cong_chuc_cap_xa", "vien_chuc", "dang_vien"] as const;
export type NhomHocTap = (typeof NHOM_HOC_TAP)[number];
export const TEN_NHOM_HOC_TAP: Record<NhomHocTap, string> = {
  cong_an_cap_xa: "Công an cấp xã",
  cong_chuc_cap_xa: "Công chức cấp xã",
  vien_chuc: "Viên chức",
  dang_vien: "Đảng viên",
};
