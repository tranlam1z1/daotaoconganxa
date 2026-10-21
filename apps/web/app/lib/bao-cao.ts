/**
 * Kiểu dữ liệu và nhãn của màn hình báo cáo (docs/PLAN.md GĐ7; tab "Tiến độ học" thêm ở GĐ16c).
 *
 * Web chỉ gọi API (giả định A2); các kiểu ở đây chép theo packages/db/src/bao-cao.ts và phải
 * đổi cùng lúc khi bên đó đổi.
 */

import type { Tone } from "./format";

/** Các loại báo cáo; đường tải tệp (`quan-tri.bao-cao.tai.tsx`) chỉ nhận loại có trong danh sách này. */
export const LOAI_BAO_CAO = ["ket-qua-thi", "don-vi", "luyen-tap", "cau-hoi-kho", "tien-do-hoc"] as const;
export type LoaiBaoCao = (typeof LOAI_BAO_CAO)[number];

export const TEN_BAO_CAO: Record<LoaiBaoCao, string> = {
  "ket-qua-thi": "Kết quả đề thi",
  "don-vi": "Tổng hợp đơn vị",
  "luyen-tap": "Luyện tập",
  "cau-hoi-kho": "Câu hỏi khó",
  "tien-do-hoc": "Cán bộ",
};

/**
 * Màn hình báo cáo lấy cán bộ làm trung tâm: danh sách cán bộ (báo cáo tiến độ học) là tab mở đầu,
 * bấm tên để xem hồ sơ từng người. Bốn báo cáo còn lại nằm chung trong tab "Báo cáo tổng hợp".
 */
export const BAO_CAO_CAN_BO: LoaiBaoCao = "tien-do-hoc";
export const BAO_CAO_TONG_HOP = ["ket-qua-thi", "don-vi", "luyen-tap", "cau-hoi-kho"] as const;

/** Tham số lọc được chép từ trang sang API và sang đường tải tệp. */
export const LOC_BAO_CAO = ["de_thi", "don_vi", "tu", "den", "theo", "toi_thieu", "nhom", "q"] as const;

/** Đường tới hồ sơ một cán bộ, giữ khoảng ngày đang lọc. */
export function duongHoSoCanBo(id: string, loc: { tu?: string; den?: string } = {}): string {
  const qs = new URLSearchParams();
  if (loc.tu) qs.set("tu", loc.tu);
  if (loc.den) qs.set("den", loc.den);
  const s = qs.toString();
  return `/quan-tri/bao-cao/can-bo/${id}${s ? `?${s}` : ""}`;
}

/** Báo cáo nào bắt buộc chọn đề thi. */
export const CAN_DE_THI: Record<LoaiBaoCao, boolean> = {
  "ket-qua-thi": true,
  "don-vi": true,
  "luyen-tap": false,
  "cau-hoi-kho": false,
  "tien-do-hoc": false,
};

export const TEN_NHOM_LUYEN_TAP = { nguoi: "Người", don_vi: "Đơn vị", chu_de: "Chủ đề" } as const;
export type NhomLuyenTap = keyof typeof TEN_NHOM_LUYEN_TAP;

export interface DeThiBaoCao {
  id: string;
  code: string;
  title: string;
  pass_score: number;
  status: string;
}

export interface DonViBaoCao {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  path: string;
}

export interface BoLocBaoCao {
  de_thi: DeThiBaoCao[];
  don_vi: DonViBaoCao[];
}

export interface KetQuaDeThi {
  de: DeThiBaoCao;
  dong: Array<{
    xep_hang: number;
    ho_ten: string;
    cap_bac: string | null;
    don_vi: string | null;
    diem: number;
    dat: boolean;
    so_cau_dung: number | null;
    so_cau: number;
    thoi_gian_lam: string;
    so_lan: number;
    nop_luc: string;
  }>;
  tong_hop: { so_nguoi: number; diem_trung_binh: number | null; so_dat: number; ty_le_dat: number | null };
}

export interface TongHopDonVi {
  de: DeThiBaoCao;
  dong: Array<{
    xep_hang: number | null;
    don_vi_id: string;
    don_vi: string;
    so_duoc_giao: number;
    so_da_lam: number;
    ty_le_hoan_thanh: number | null;
    so_dat: number;
    ty_le_dat: number | null;
    diem_trung_binh: number | null;
  }>;
}

export interface BaoCaoLuyenTap {
  theo: NhomLuyenTap;
  dong: Array<{
    nhom: string;
    don_vi: string | null;
    so_phien: number;
    so_cau: number;
    so_dung: number;
    ty_le_dung: number | null;
  }>;
}

export interface BaoCaoCauHoiKho {
  toi_thieu: number;
  dong: Array<{
    cau_hoi_id: string;
    ma_cau: string;
    cau_hoi: string;
    chu_de: string | null;
    muc_do: string;
    so_luot: number;
    ty_le_sai: number;
    nhan_xet: string;
  }>;
}

/** Nhóm học cùng để chọn trong bộ lọc báo cáo tiến độ học (lấy từ /v1/quan-tri/nhom). */
export interface NhomBoLoc {
  id: string;
  ten: string;
  trang_thai: "hoat_dong" | "luu_tru";
}

export interface BaoCaoTienDoHoc {
  nhom: { id: string; ten: string } | null;
  dong: Array<{
    id: string;
    ho_ten: string;
    cap_bac: string | null;
    don_vi: string;
    bai_xong: number;
    bai_ghi_danh: number;
    phan_tram_bai_hoc: number | null;
    so_phien: number;
    so_cau: number;
    ty_le_dung: number | null;
    bai_thi_duoc_giao: number;
    bai_thi_da_nop: number;
    bai_thi_dat: number;
    so_nhom: number;
    phan_tram_nhom: number | null;
    lan_hoc_gan_nhat: string | null;
  }>;
}

/* ------------------------------------------------------------------ */
/* Hồ sơ một cán bộ (GET /v1/bao-cao/can-bo/:id)                       */
/* ------------------------------------------------------------------ */

export type TrangThaiBaiThi = "dat" | "khong_dat" | "cho_cham" | "dang_lam" | "qua_han" | "chua_lam";

export const TONE_TRANG_THAI_BAI_THI: Record<TrangThaiBaiThi, Tone> = {
  dat: "ok",
  khong_dat: "danger",
  cho_cham: "info",
  dang_lam: "info",
  qua_han: "warn",
  chua_lam: "muted",
};

export interface ChuDeManhYeu {
  ten: string;
  so_luot: number;
  so_dung: number;
  diem: number;
}

export interface HoSoCanBo {
  nguoi: {
    id: string;
    ho_ten: string;
    ten_dang_nhap: string | null;
    cap_bac: string | null;
    so_hieu: string | null;
    don_vi: string;
  };
  tong_quan: {
    bai_xong: number;
    bai_ghi_danh: number;
    phan_tram_bai_hoc: number | null;
    so_phien: number;
    so_cau: number;
    ty_le_dung: number | null;
    bai_thi_duoc_giao: number;
    bai_thi_da_nop: number;
    bai_thi_dat: number;
    lan_hoc_gan_nhat: string | null;
  };
  bai_thi: Array<{
    de_thi_id: string;
    ma_de: string;
    ten_de: string;
    nguong_dat: number;
    duoc_giao: boolean;
    han: string | null;
    trang_thai: TrangThaiBaiThi;
    ket_qua: string;
    diem: number | null;
    so_cau_dung: number | null;
    so_cau: number | null;
    diem_tu_luan: number | null;
    tu_luan_toi_da: number | null;
    so_lan: number;
    nop_luc: string | null;
  }>;
  bai_hoc: Array<{
    chuyen_de_id: string;
    chuyen_de: string;
    bai_xong: number;
    tong_bai: number;
    phan_tram: number | null;
    so_bai_tap: number;
    so_tu_luan: number;
    diem_bai_tap: number | null;
    ghi_danh_luc: string;
    lan_hoc_gan_nhat: string | null;
  }>;
  luyen_tap: {
    so_phien: number;
    so_cau: number;
    so_dung: number;
    ty_le_dung: number | null;
    chu_de: Array<{
      chu_de: string;
      so_phien: number;
      so_cau: number;
      so_dung: number;
      ty_le_dung: number | null;
    }>;
    manh: ChuDeManhYeu[];
    yeu: ChuDeManhYeu[];
  };
  tro_choi: {
    xp_tong: number;
    xp_tuan: number;
    cap: number;
    chuoi_hien_tai: number;
    chuoi_tot_nhat: number;
    hang_don_vi: number | null;
    so_nguoi_don_vi: number;
    huy_hieu: Array<{ ten: string; mo_ta: string; dat_luc: string }>;
    luot: Array<{
      ma: string;
      ten: string;
      so_luot: number;
      sao: number | null;
      diem: number | null;
      lan_choi: string | null;
    }>;
  };
}

/* ------------------------------------------------------------------ */
/* Tổng quan (GET /v1/bao-cao/tong-quan)                               */
/* ------------------------------------------------------------------ */

export interface NhomCanChuY {
  tong: number;
  dong: Array<{ id: string; ho_ten: string; cap_bac: string | null; don_vi: string; so: number | null }>;
}

export interface TongQuanCanBo {
  don_vi: string;
  so_can_bo: number;
  hoc_7_ngay: number;
  bai_thi: {
    duoc_giao: number;
    da_nop: number;
    dat: number;
    ty_le_hoan_thanh: number | null;
    ty_le_dat: number | null;
  };
  cho_xac_minh: number;
  can_chu_y: { chua_hoc: NhomCanChuY; chua_lam_bai: NhomCanChuY; khong_dat: NhomCanChuY };
}

/** Số theo kiểu Việt Nam; null thành gạch ngang. */
export function soVn(n: number | null | undefined, donVi = ""): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}${donVi}`;
}
