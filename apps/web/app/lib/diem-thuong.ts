/** Kiểu dữ liệu trò chơi hóa (docs/PLAN.md GĐ9), phản chiếu /v1/toi/tong-quan và /v1/bang-xep-hang. */

export interface TongQuanDiem {
  xp_tong: number;
  xp_tuan: number;
  cap: { cap: number; tuXp: number; denXp: number | null; tienDo: number };
  chuoi: { hien_tai: number; tot_nhat: number; da_hoc_hom_nay: boolean; con_dong_bang: number };
  huy_hieu: Array<{ code: string; name: string; description: string; dat_luc: string | null }>;
  thu_thach: { ngay: string; so_cau: number; phien_id: string | null; da_xong: boolean; dung: number | null };
}

export interface BangXepHang {
  pham_vi: "don_vi" | "cac_don_vi";
  ky: "tuan" | "thang";
  tu_ngay: string;
  don_vi: { id: string; ten: string } | null;
  ghi_chu?: string;
  /** Tổng XP tối thiểu của từng cấp (NGUONG_CAP): phần tử i là ngưỡng của cấp i + 1. */
  nguong_cap: number[];
  items: Array<{
    /** Hạng trong kỳ, đồng điểm thì đồng hạng (1, 2, 2, 4). */
    hang: number;
    ten: string;
    account_id?: string;
    /** XP trong kỳ, chỉ có ở bảng cá nhân. */
    xp?: number;
    /** Cấp theo tổng XP, chỉ có ở bảng cá nhân. */
    cap?: number;
    la_toi?: boolean;
    unit_id?: string;
    so_nguoi?: number;
    tong_xp?: number;
    xp_trung_binh?: number;
    la_cua_toi?: boolean;
  }>;
}
