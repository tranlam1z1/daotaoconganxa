/** Nhóm nội dung học, độc lập với quyền quản lý và phạm vi đơn vị. */
export const NHOM_HOC_TAP = ["cong_an_cap_xa", "cong_chuc_cap_xa", "vien_chuc", "dang_vien"] as const;
export type NhomHocTap = (typeof NHOM_HOC_TAP)[number];
export const TEN_NHOM_HOC_TAP: Record<NhomHocTap, string> = {
  cong_an_cap_xa: "Công an cấp xã",
  cong_chuc_cap_xa: "Công chức cấp xã",
  vien_chuc: "Viên chức",
  dang_vien: "Đảng viên",
};

/** Nhóm hiện trên giao diện: hệ thống dành cho Công an xã. Nhóm khác vẫn hợp lệ trong CSDL
 * (dữ liệu cũ), nhưng không còn là lựa chọn mới. */
export const NHOM_HIEN_THI = ["cong_an_cap_xa", "dang_vien"] as const satisfies readonly NhomHocTap[];

/** Nhóm cho ô chọn trong form sửa: nhóm hiện trên giao diện, cộng nhóm cũ bản ghi đang gắn,
 * để lưu form không âm thầm gỡ nhóm cũ. */
export function nhomChoForm(dangGan: readonly string[] | null | undefined): NhomHocTap[] {
  return NHOM_HOC_TAP.filter(
    (ma) => (NHOM_HIEN_THI as readonly string[]).includes(ma) || dangGan?.includes(ma),
  );
}
