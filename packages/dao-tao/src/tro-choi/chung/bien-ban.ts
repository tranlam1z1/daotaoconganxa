/**
 * Biên bản cuối lượt (mô-đun M4, docs/GAME_DESIGN.md §4): từ các lỗi người chơi phát hiện, dựng các
 * dòng "biên bản" gồm hành vi, căn cứ và mức phạt lấy từ dòng mức phạt ĐÃ DUYỆT, còn hiệu lực tại
 * ngày chơi. Dùng cho trò 1, 4, 5, 9, 10.
 *
 * Không chép số tiền vào nội dung trò: mức phạt đi theo mã dòng `violations`. Lỗi chưa có mức phạt
 * đã duyệt thì dòng biên bản ghi rõ "Chưa có mức phạt đã duyệt", không để trống, không tự đặt số.
 */

/** Một dòng mức phạt đã duyệt, dạng gọn để đưa vào ảnh chụp lượt và gói offline. */
export interface MucPhatDaDuyet {
  ma: string;
  version: number;
  hanh_vi: string;
  phat_tu: number;
  phat_den: number;
  tru_diem: number | null;
  hinh_thuc_bo_sung: string[];
  can_cu: string;
}

export interface DongBienBan {
  /** Hành vi, ví dụ "Không xuất trình giấy phép lái xe". */
  hanh_vi: string;
  /** Mô tả cụ thể theo tình huống. */
  chi_tiet: string;
  /** Căn cứ (URN) của lỗi và của mức phạt, không trùng. */
  can_cu: string[];
  muc_phat: MucPhatDaDuyet | null;
}

export const CHUA_CO_MUC_PHAT = "Chưa có mức phạt đã duyệt";

const tien = (n: number) => `${n.toLocaleString("vi-VN")} đồng`;

/** "Phạt tiền từ 800.000 đồng đến 1.000.000 đồng; trừ 2 điểm giấy phép lái xe" hoặc CHUA_CO_MUC_PHAT. */
export function moTaMucPhatBienBan(m: MucPhatDaDuyet | null): string {
  if (!m) return CHUA_CO_MUC_PHAT;
  const phan = [
    m.phat_tu === m.phat_den
      ? `Phạt tiền ${tien(m.phat_tu)}`
      : `Phạt tiền từ ${tien(m.phat_tu)} đến ${tien(m.phat_den)}`,
    ...m.hinh_thuc_bo_sung.map((s) => s.trim()).filter(Boolean),
  ];
  if (m.tru_diem) phan.push(`trừ ${m.tru_diem} điểm giấy phép lái xe`);
  return phan.join("; ");
}

/**
 * Dựng một dòng biên bản. `mucPhat` là bảng mã → dòng mức phạt ĐÃ DUYỆT (người gọi đã lọc theo trạng
 * thái và ngày hiệu lực); mã không có trong bảng thì coi như chưa có mức phạt.
 */
export function dongBienBan(inp: {
  hanhVi: string;
  chiTiet: string;
  canCu: readonly string[];
  maMucPhat: string | null;
  mucPhat: Readonly<Record<string, MucPhatDaDuyet>>;
}): DongBienBan {
  const m = inp.maMucPhat && Object.hasOwn(inp.mucPhat, inp.maMucPhat) ? inp.mucPhat[inp.maMucPhat]! : null;
  return {
    hanh_vi: inp.hanhVi,
    chi_tiet: inp.chiTiet,
    can_cu: [...new Set([...inp.canCu, ...(m ? [m.can_cu] : [])])],
    muc_phat: m,
  };
}
