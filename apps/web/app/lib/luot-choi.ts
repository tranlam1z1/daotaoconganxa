/**
 * Kiểu dữ liệu của khung lượt chơi (docs/PLAN.md GĐ-G0), dùng chung cho trang máy chủ và trang
 * chơi offline. Khớp phản hồi của /v1/luot-choi (apps/api/src/routes/luot-choi.ts).
 */

/** Một màn của trò có màn (GĐ-T1), kèm trạng thái mở và số sao tốt nhất của người chơi. */
export interface ManWeb {
  so: number;
  ten: string;
  mo_ta: string;
  giay_ca_luot: number | null;
  da_mo: boolean;
  sao: number;
}

export interface TroChoiTrenKhung {
  /** Các màn; null với trò không có màn. */
  man: ManWeb[] | null;
  ma: string;
  ten: string;
  mo_ta: string;
  offline: boolean;
  so_buoc: number;
  giay_moi_buoc: number | null;
  hom_nay: number;
  tot_nhat: number | null;
  sao_tot_nhat: number | null;
}

export interface LuotTomTat {
  id: string;
  game_code: string;
  ten_tro_choi: string;
  status: "dang_choi" | "xong" | "het_gio" | "bo_do";
  started_at: string;
  played_at: string;
  score: number | null;
  max_score: number | null;
  stars: number | null;
  xp: number | null;
  offline: boolean;
}

export interface TongQuanLuotChoi {
  tro_choi: TroChoiTrenKhung[];
  tro_choi_cu: string[];
  dang_choi: LuotTomTat | null;
  gan_day: LuotTomTat[];
}

/** Danh mục trò đang bật, đọc được khi chưa đăng nhập (GET /v1/luot-choi/danh-muc). */
export interface DanhMucTroChoi {
  /** `mo_ta` có thể thiếu khi API chưa cập nhật. */
  tro_choi: { ma: string; ten: string; mo_ta?: string; man: boolean }[];
  tro_choi_cu: string[];
}

/** Kết quả chấm một bước (chỉ có sau khi bước đã được chấm). `chi_tiet` là phần riêng của trò. */
export interface KetQuaBuocWeb {
  diem: number;
  thuong: number;
  diem_toi_da: number;
  dung: boolean | null;
  het_gio: boolean;
  thoi_gian_ms: number | null;
  giai_thich: string | null;
  can_cu: string[];
  chi_tiet: unknown;
}

export interface LuotChoiWeb {
  id: string;
  ma: string;
  ten: string;
  /** Màn của lượt (trò có màn). */
  man: { so: number; ten: string; mo_ta: string; so_man: number } | null;
  /** Giờ cả lượt (trò có giờ cả lượt), và thời gian còn lại khi đang chơi. */
  ca_luot_ms: number | null;
  con_lai_luot_ms: number | null;
  trang_thai: "dang_choi" | "xong" | "het_gio" | "bo_do";
  offline: boolean;
  bat_dau: string;
  ket_thuc: string | null;
  so_buoc: number;
  buoc_hien_tai: {
    thu_tu: number;
    de: unknown;
    thoi_gian_ms: number | null;
    con_lai_ms: number | null;
  } | null;
  da_choi: Array<{ thu_tu: number; de: unknown; tra_loi: unknown; ket_qua: KetQuaBuocWeb }>;
  tong_ket: {
    diem: number;
    thuong: number;
    diem_toi_da: number;
    ty_le: number;
    sao: number;
    so_dung: number;
    xp: number;
  } | null;
}

export const TEN_TRANG_THAI_LUOT: Record<LuotTomTat["status"], string> = {
  dang_choi: "Đang chơi",
  xong: "Đã xong",
  het_gio: "Hết giờ",
  bo_do: "Bỏ dở",
};

/** Điểm dạng "20/30" (thưởng nhanh ghi riêng). */
export function moTaDiem(diem: number, toiDa: number): string {
  const f = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  return `${f(diem)}/${f(toiDa)}`;
}

export interface HoSoChuDeWeb {
  manh: Array<{ topic_id: string; ten: string; attempts: number; correct: number; diem: number }>;
  yeu: Array<{ topic_id: string; ten: string; attempts: number; correct: number; diem: number }>;
  tong_luot: number;
}
