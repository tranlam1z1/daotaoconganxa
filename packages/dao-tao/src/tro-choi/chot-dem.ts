/**
 * Trò "Dựng chốt an toàn ban đêm" (docs/PLAN.md GĐ-T15, docs/GAME_DESIGN.md §5.15).
 *
 * Một màn là một bước: một đoạn đường một chiều hai làn ban đêm (thẳng, lề hẹp, cong, đầu dốc, gần
 * giao lộ), một vị trí chốt và một túi đồ (biển báo tạm, cọc tiêu, đèn cảnh báo, xe tuần tra, 2–4
 * chiến sĩ). Người chơi đặt từng vật theo lưới 1 m dọc đường và theo cột ngang đường (lề trái, làn
 * trái, làn phải, lề phải), xoay biển theo 4 hướng, rồi "Chạy thử": M5 cho dòng xe chạy qua trong
 * 60 giây mô phỏng. Chạy thử tối đa 2 lần; sau đó vẫn sửa được; lúc nộp máy chủ dựng lại bố trí từ
 * nhật ký (M7), chạy M5 trên bố trí LÚC NỘP và chấm theo sáu tiêu chí đo từ mô phỏng. Nhật ký chạy
 * thử lần thứ 3, sai mốc thời gian, hoặc đặt vật ngoài phần đường hợp lệ: cả bước 0 điểm.
 *
 * Mọi ngưỡng chấm nằm ở nội dung có duyệt `tieu_chi_chot` (game_content cùng trò, `payload.kieu`),
 * không ở mã. Khoảng cách biển đầu tiên chấm bằng mét với ngưỡng demo (câu D21). Đề gửi người chơi
 * có đoạn đường và dòng xe để điện thoại tự chạy thử (như trò 3), không có ngưỡng.
 *
 * Tách khỏi trò 3 (GAME_DESIGN §5.21, D32): không có ô đặt cố định, không có biển nhiễu; chấm theo đo
 * đạc từ mô phỏng. Hàm thuần: không chạm CSDL, không đọc đồng hồ.
 */

import { taoRng, tron } from "../de-thi.ts";
import { TOC_DO_CHAM } from "../mo-phong/bien.ts";
import { lanThangDiLen, RONG_LAN_CM } from "../mo-phong/duong.ts";
import {
  buocMoPhong,
  type CauHinhMoPhong,
  dungMoPhong,
  NHIP_MS,
  type SuKien,
  type TrangThaiMoPhong,
  trangThaiDau,
  type VatCanhBao,
} from "../mo-phong/mo-phong.ts";
import {
  type CanhDem,
  type DoanKhuat,
  type LoaiKhuat,
  tamNhinGoc,
  tamNhinToi,
} from "../mo-phong/tam-nhin.ts";
import { doHangCho, type NguoiTrenDuong, type VatCan } from "../mo-phong/vat-can.ts";
import { PHANH_DU_KIEN, TOC_DO_THUONG, type XeKhoiTao } from "../mo-phong/xe.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import { bamTrangThai, chayLaiRoiCham, docNhatKy, LoiNhatKy, type NhatKy } from "./chung/nhat-ky.ts";
import type { DinhNghiaTroChoi, KetQuaChamBuoc } from "./khung.ts";

export const MA_CHOT_DEM = "chot_dem";
export const SO_LAN_CHAY_THU_CHOT = 2;
/** Một lần chạy: 60 giây mô phỏng. */
export const NHIP_CHAY_CHOT = (60 * 1000) / NHIP_MS;
/** Trần độ dài nhật ký: 30 phút. */
export const TONG_NHIP_TOI_DA_CHOT = (30 * 60_000) / NHIP_MS;
/** Đoạn chạy đà dưới mép đoạn đường, ngoài khung nhìn (cm). */
export const CHAY_DA_CHOT_CM = 8000;
/** Lề trái (phía dải phân cách) rộng cố định (cm). */
export const RONG_LE_TRAI_CM = 100;
/** Xe tuần tra dài 5 m: đầu xe ở vị trí đặt, thân xe lùi về phía xe tới. */
export const DAI_XE_TUAN_TRA_M = 5;
/** Không đặt vật trong phạm vi này (m) quanh tim giao lộ. */
export const NUA_GIAO_LO_M = 6;
/** Tốc độ tối đa của làn (mm/nhịp, ≈ 79 km/h), để xe chạy quá tốc độ có chỗ chạy. */
const TOC_DO_LAN = 1100;
const TOC_DO_QUA_TOC_DO = 1000;

/** Điểm tối đa của sáu tiêu chí (GAME_DESIGN §5.15). Ngưỡng ở nội dung `tieu_chi_chot`. */
export const DIEM_TIEU_CHI_CHOT = {
  bien_dau: 20,
  coc: 15,
  chien_si: 20,
  phanh_gap: 20,
  hang_cho: 15,
  bien_khuat: 10,
} as const;
export type MaTieuChiChot = keyof typeof DIEM_TIEU_CHI_CHOT;
export const DIEM_TOI_DA_CHOT = 100;

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

export const HINH_DOAN = ["thang", "le_hep", "cong", "doc", "giao_lo"] as const;
export type HinhDoan = (typeof HINH_DOAN)[number];

export const MAN_CHOT_DEM: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Đường thẳng",
    moTa: "Đường thẳng, ít xe con. 2 biển, 6 cọc, 1 đèn, 2 chiến sĩ. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 12,
  },
  {
    so: 2,
    ten: "Màn 2: Lề hẹp",
    moTa: "Đường thẳng lề hẹp, thêm xe máy. Đứng ở lề không còn an toàn.",
    caLuotMs: null,
    xpCoBan: 14,
  },
  {
    so: 3,
    ten: "Màn 3: Đường cong",
    moTa: "Chốt sau khúc cua, tầm nhìn ngắn. Biển phải đặt trước khúc cua.",
    caLuotMs: null,
    xpCoBan: 16,
  },
  {
    so: 4,
    ten: "Màn 4: Đầu dốc",
    moTa: "Chốt sau đỉnh dốc, có xe khách. Người lái chỉ thấy chốt khi đã qua đỉnh dốc.",
    caLuotMs: null,
    xpCoBan: 18,
  },
  {
    so: 5,
    ten: "Màn 5: Gần giao lộ",
    moTa: "Chốt gần giao lộ, có xe tải, xe rẽ vào từ đường ngang, xe chạy quá tốc độ.",
    caLuotMs: null,
    xpCoBan: 20,
  },
];
export const SO_MAN_CHOT_DEM = MAN_CHOT_DEM.length;
const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_CHOT_DEM, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Cột ngang đường, từ trái sang phải. Xe chạy từ dưới lên. */
export const COT_CHOT = ["le_trai", "lan_1", "lan_2", "le_phai"] as const;
export type CotChot = (typeof COT_CHOT)[number];
export type LanChot = Extract<CotChot, "lan_1" | "lan_2">;
export const laLan = (c: CotChot): c is LanChot => c === "lan_1" || c === "lan_2";

export const LOAI_VAT_CHOT = ["bien", "coc", "den", "xe", "cs"] as const;
export type LoaiVatChot = (typeof LOAI_VAT_CHOT)[number];
export const TEN_VAT_CHOT: Record<LoaiVatChot, string> = {
  bien: "Biển báo tạm",
  coc: "Cọc tiêu",
  den: "Đèn cảnh báo",
  xe: "Xe tuần tra",
  cs: "Chiến sĩ",
};

/** Loại xe hiện cho người chơi; xe khách chạy trong M5 như xe tải (cùng cỡ, cùng tốc độ). */
export type LoaiXeChot = "o_to" | "xe_may" | "xe_tai" | "xe_khach";
export const TEN_XE_CHOT: Record<LoaiXeChot, string> = {
  o_to: "Ô tô con",
  xe_may: "Xe máy",
  xe_tai: "Xe tải",
  xe_khach: "Xe khách",
};

export interface DongXe {
  /** Chuỗi seed: cùng seed, cùng dòng xe. */
  seed: string;
  so_xe: number;
  /** Khoảng cách trung bình giữa hai xe vào đoạn đường, nhịp. */
  nhip_giua: number;
  /** Tỷ lệ phần trăm theo loại xe, tổng 100. */
  ty_le: Record<LoaiXeChot, number>;
  /** Số xe chạy quá tốc độ. */
  qua_toc_do: number;
  /** Số xe từ đường ngang rẽ vào ngay sau giao lộ (chỉ khi có giao lộ). */
  tu_giao_lo: number;
}

export interface TuiDo {
  bien: number;
  coc: number;
  den: number;
  xe: number;
  cs: number;
}

export interface KhuatDoan {
  loai: LoaiKhuat;
  muc: 1 | 2;
  m_tu: number;
  m_den: number;
}

/** Đoạn đường, lưu ở game_content.payload (kieu = "doan_duong"). */
export interface PayloadDoanChot {
  kieu: "doan_duong";
  muc: number;
  hinh: HinhDoan;
  /** Độ dài đoạn nhìn thấy, m (bội của 10). m = 0 ở mép dưới, xe vào từ dưới. */
  dai_m: number;
  /** Bề rộng lề phải, cm. */
  rong_le_cm: number;
  /** Vị trí chốt, m. */
  chot_m: number;
  /** Làn cần thu hẹp để dựng chốt. */
  lan_dong: LanChot;
  khuat: KhuatDoan[];
  giao_lo: { m: number } | null;
  tui: TuiDo;
  luong_xe: DongXe;
  /** Mã bộ tiêu chí chấm (`tieu_chi_chot.ma`). */
  ma_tieu_chi: string;
}

export interface NguonTieuChi {
  tieu_chi: MaTieuChiChot;
  /** URN văn bản đã tra trong kho; null khi chưa có căn cứ. */
  urn: string | null;
  /** Mô tả nguồn: "chưa có trong kho", "tài liệu nghiệp vụ do đơn vị cung cấp"… */
  ghi_chu: string;
}

/** Bộ tiêu chí chấm, lưu ở game_content.payload (kieu = "tieu_chi_chot"). Không gửi người chơi. */
export interface PayloadTieuChiChot {
  kieu: "tieu_chi_chot";
  ma: string;
  ten: string;
  nguong: {
    /** Khoảng cách cho phép từ biển đầu tiên tới chốt, m. */
    bien_dau_m_tu: number;
    bien_dau_m_den: number;
    /** Số cọc tối thiểu trên làn thu hẹp; hai cọc cách nhau quá `coc_khoang_m` là một đoạn hở. */
    coc_toi_thieu: number;
    coc_khoang_m: number;
    tru_moi_doan_ho: number;
    tru_moi_xe_phanh_gap: number;
    /** Ngưỡng độ dài hàng chờ, m. */
    hang_cho_m: number;
    /** Biển thấy được từ gần hơn khoảng này (m) là bị khuất. */
    tam_nhin_bien_m: number;
    tru_moi_bien_khuat: number;
  };
  nguon: NguonTieuChi[];
}

export type NguongChot = PayloadTieuChiChot["nguong"];

/** Một nguồn của trò: đoạn đường đã duyệt kèm bộ tiêu chí đã duyệt nó trỏ tới. */
export interface NguonChotDem {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  doan: PayloadDoanChot;
  tieu_chi: PayloadTieuChiChot;
}

/** Nội dung một bước trong ảnh chụp lượt (có ngưỡng). */
export interface BuocChotDem {
  man: number;
  doan: PayloadDoanChot;
  tieu_chi: PayloadTieuChiChot;
}

export interface VatTrongTui {
  id: string;
  loai: LoaiVatChot;
}

/** Phần đề gửi người chơi: đoạn đường, dòng xe, túi đồ. Không có ngưỡng chấm. */
export interface DeChotDem {
  man: number;
  hinh: HinhDoan;
  dai_m: number;
  rong_le_cm: number;
  chot_m: number;
  lan_dong: LanChot;
  khuat: KhuatDoan[];
  giao_lo: { m: number } | null;
  tui: VatTrongTui[];
  luong_xe: DongXe;
  so_lan_chay: number;
}

export type DoanChot = Pick<
  DeChotDem,
  "dai_m" | "rong_le_cm" | "chot_m" | "lan_dong" | "khuat" | "giao_lo" | "luong_xe"
> & { tui: readonly VatTrongTui[] };

export interface ViTriVat {
  m: number;
  cot: CotChot;
  /** Biển: 0 quay về phía xe tới (đúng), 1 quay sang phải, 2 quay lưng, 3 quay sang trái. */
  huong: 0 | 1 | 2 | 3;
}

/** Bố trí: id vật → vị trí. Vật chưa đặt không có trong bố trí. */
export type BoTriChot = Record<string, ViTriVat>;

export const THAO_TAC_CHOT = ["dat", "xoay", "go", "chay_thu"] as const;
export type ThaoTacChot = (typeof THAO_TAC_CHOT)[number];
export type ThamSoChot = { vat: string; m?: number; cot?: CotChot } | null;
export type TraLoiChotDem = NhatKy<ThaoTacChot, ThamSoChot>;

/** Túi đồ thành danh sách vật có id: bien-1, bien-2, coc-1… */
export function vatTrongTui(tui: TuiDo): VatTrongTui[] {
  return LOAI_VAT_CHOT.flatMap((loai) =>
    Array.from({ length: tui[loai] }, (_, i) => ({ id: `${loai}-${i + 1}`, loai })),
  );
}

/* ------------------------------------------------------------------ */
/* Kiểm nội dung                                                       */
/* ------------------------------------------------------------------ */

const laSoNguyen = (v: unknown, tu: number, den: number): v is number =>
  Number.isInteger(v) && (v as number) >= tu && (v as number) <= den;
const laSo = (v: unknown, tu: number, den: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= tu && v <= den;
const laChuoi = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;

/** Giới hạn túi đồ theo loại vật. */
const TUI_TOI_DA: TuiDo = { bien: 6, coc: 20, den: 4, xe: 1, cs: 4 };

/** Kiểm một đoạn đường. Rỗng là hợp lệ. Chạy khi soạn, khi nạp dữ liệu mẫu và khi lấy nguồn. */
export function kiemTraDoanChot(p: Partial<PayloadDoanChot> | null | undefined): string[] {
  const loi: string[] = [];
  if (!p || typeof p !== "object") return ["Thiếu bố cục đoạn đường."];
  if (p.kieu !== "doan_duong") loi.push('Nội dung đoạn đường cần kieu = "doan_duong".');
  if (!laSoNguyen(p.muc, 1, SO_MAN_CHOT_DEM)) loi.push(`Màn (muc) phải từ 1 đến ${SO_MAN_CHOT_DEM}.`);
  if (!HINH_DOAN.includes(p.hinh as HinhDoan))
    loi.push(`Hình đoạn đường (hinh) phải là ${HINH_DOAN.join(", ")}.`);
  const daiHopLe = laSoNguyen(p.dai_m, 100, 300) && p.dai_m % 10 === 0;
  if (!daiHopLe) loi.push("Độ dài đoạn đường (dai_m) phải từ 100 đến 300 m, bội của 10.");
  const dai = daiHopLe ? (p.dai_m as number) : 300;
  if (!laSoNguyen(p.rong_le_cm, 60, 400)) loi.push("Bề rộng lề phải (rong_le_cm) phải từ 60 đến 400 cm.");
  if (!laSoNguyen(p.chot_m, Math.floor(dai / 2), dai - 10))
    loi.push(
      `Vị trí chốt (chot_m) phải nằm ở nửa trên đoạn đường, từ ${Math.floor(dai / 2)} đến ${dai - 10} m.`,
    );
  if (p.lan_dong !== "lan_1" && p.lan_dong !== "lan_2")
    loi.push('Làn thu hẹp (lan_dong) phải là "lan_1" hoặc "lan_2".');
  if (!Array.isArray(p.khuat)) loi.push("Danh sách đoạn khuất (khuat) phải là mảng.");
  else
    for (const k of p.khuat as Partial<KhuatDoan>[]) {
      if (k?.loai !== "cong" && k?.loai !== "doc") loi.push('Đoạn khuất: loai phải là "cong" hoặc "doc".');
      if (k?.muc !== 1 && k?.muc !== 2) loi.push("Đoạn khuất: muc phải là 1 hoặc 2.");
      if (!laSoNguyen(k?.m_tu, 0, dai) || !laSoNguyen(k?.m_den, 0, dai) || k.m_tu >= k.m_den)
        loi.push("Đoạn khuất: m_tu, m_den phải nằm trên đường và m_tu < m_den.");
    }
  if (p.giao_lo != null && !laSoNguyen(p.giao_lo?.m, NUA_GIAO_LO_M, dai - NUA_GIAO_LO_M))
    loi.push("Giao lộ (giao_lo.m) phải nằm trên đường.");
  const t = p.tui;
  if (!t || typeof t !== "object") loi.push("Thiếu túi đồ (tui).");
  else {
    for (const loai of LOAI_VAT_CHOT)
      if (!laSoNguyen(t[loai], 0, TUI_TOI_DA[loai]))
        loi.push(`Túi đồ: số ${TEN_VAT_CHOT[loai].toLowerCase()} phải từ 0 đến ${TUI_TOI_DA[loai]}.`);
    if (!laSoNguyen(t.cs, 2, 4)) loi.push("Túi đồ cần 2 đến 4 chiến sĩ.");
    if (!laSoNguyen(t.bien, 1, 6)) loi.push("Túi đồ cần ít nhất một biển.");
  }
  const x = p.luong_xe;
  if (!x || typeof x !== "object") loi.push("Thiếu dòng xe (luong_xe).");
  else {
    if (!laChuoi(x.seed, 40)) loi.push("Dòng xe: cần seed.");
    if (!laSoNguyen(x.so_xe, 1, 60)) loi.push("Dòng xe: số xe phải từ 1 đến 60.");
    if (!laSoNguyen(x.nhip_giua, 10, 200)) loi.push("Dòng xe: nhịp giữa hai xe phải từ 10 đến 200.");
    const tl = x.ty_le;
    const loaiXe = Object.keys(TEN_XE_CHOT) as LoaiXeChot[];
    if (
      !tl ||
      loaiXe.some((l) => !laSoNguyen(tl[l], 0, 100)) ||
      loaiXe.reduce((s, l) => s + tl[l], 0) !== 100
    )
      loi.push("Dòng xe: tỷ lệ loại xe phải là số nguyên, tổng 100.");
    if (!laSoNguyen(x.qua_toc_do, 0, x.so_xe ?? 0)) loi.push("Dòng xe: số xe quá tốc độ không hợp lệ.");
    if (!laSoNguyen(x.tu_giao_lo, 0, x.so_xe ?? 0)) loi.push("Dòng xe: số xe từ giao lộ không hợp lệ.");
    else if (x.tu_giao_lo > 0 && !p.giao_lo)
      loi.push("Dòng xe: có xe từ giao lộ nhưng đoạn đường không có giao lộ.");
  }
  if (!laChuoi(p.ma_tieu_chi, 40)) loi.push("Thiếu mã bộ tiêu chí (ma_tieu_chi).");
  // Đặc trưng của màn 3, 4, 5 (GAME_DESIGN §5.15).
  if (p.muc === 3 && !p.khuat?.some((k) => k.loai === "cong"))
    loi.push("Màn 3 cần một đoạn cong khuất tầm nhìn.");
  if (p.muc === 4 && !p.khuat?.some((k) => k.loai === "doc"))
    loi.push("Màn 4 cần một đỉnh dốc khuất tầm nhìn.");
  if (p.muc === 5 && (!p.giao_lo || !x || !(x.qua_toc_do > 0) || !(x.ty_le?.xe_tai > 0)))
    loi.push("Màn 5 cần giao lộ, xe tải và xe chạy quá tốc độ.");
  return loi;
}

/** Kiểm một bộ tiêu chí. Rỗng là hợp lệ. */
export function kiemTraTieuChiChot(p: Partial<PayloadTieuChiChot> | null | undefined): string[] {
  const loi: string[] = [];
  if (!p || typeof p !== "object") return ["Thiếu bộ tiêu chí."];
  if (p.kieu !== "tieu_chi_chot") loi.push('Bộ tiêu chí cần kieu = "tieu_chi_chot".');
  if (!laChuoi(p.ma, 40)) loi.push("Bộ tiêu chí thiếu mã (ma).");
  if (!laChuoi(p.ten, 200)) loi.push("Bộ tiêu chí thiếu tên (ten).");
  const n = p.nguong;
  if (!n || typeof n !== "object") return [...loi, "Thiếu ngưỡng (nguong)."];
  if (
    !laSo(n.bien_dau_m_tu, 1, 1000) ||
    !laSo(n.bien_dau_m_den, 1, 1000) ||
    n.bien_dau_m_tu >= n.bien_dau_m_den
  )
    loi.push("Khoảng cách biển đầu tiên: cần 0 < bien_dau_m_tu < bien_dau_m_den.");
  if (!laSoNguyen(n.coc_toi_thieu, 1, 20)) loi.push("Số cọc tối thiểu phải từ 1 đến 20.");
  if (!laSo(n.coc_khoang_m, 1, 50)) loi.push("Khoảng cách tối đa giữa hai cọc phải từ 1 đến 50 m.");
  if (!laSo(n.hang_cho_m, 1, 1000)) loi.push("Ngưỡng hàng chờ phải từ 1 đến 1000 m.");
  if (!laSo(n.tam_nhin_bien_m, 1, 200)) loi.push("Tầm nhìn tối thiểu tới biển phải từ 1 đến 200 m.");
  for (const k of ["tru_moi_doan_ho", "tru_moi_xe_phanh_gap", "tru_moi_bien_khuat"] as const)
    if (!laSo(n[k], 0, 20)) loi.push(`Mức trừ ${k} phải từ 0 đến 20 điểm.`);
  if (!Array.isArray(p.nguon)) loi.push("Thiếu nguồn của từng tiêu chí (nguon).");
  else
    for (const ma of Object.keys(DIEM_TIEU_CHI_CHOT))
      if (!p.nguon.some((g) => g?.tieu_chi === ma && laChuoi(g.ghi_chu, 500)))
        loi.push(`Tiêu chí ${ma} chưa ghi nguồn (văn bản, hoặc "tài liệu nghiệp vụ do đơn vị cung cấp").`);
  return loi;
}

/* ------------------------------------------------------------------ */
/* Hình học: vị trí đặt → bản đồ mô phỏng                              */
/* ------------------------------------------------------------------ */

/** Quãng đường dọc làn (cm) của vị trí `m`. */
export const sCuaM = (m: number) => CHAY_DA_CHOT_CM + m * 100;
/** Tọa độ y trên bản đồ (cm) của vị trí `m`: m = 0 ở mép dưới, y giảm khi đi lên. */
export const yCuaM = (d: Pick<DoanChot, "dai_m">, m: number) => (d.dai_m - m) * 100;
/** Tọa độ x trên bản đồ (cm) của tâm một cột. */
export function xCuaCot(d: Pick<DoanChot, "rong_le_cm">, cot: CotChot): number {
  switch (cot) {
    case "le_trai":
      return -RONG_LAN_CM - RONG_LE_TRAI_CM / 2;
    case "lan_1":
      return -RONG_LAN_CM / 2;
    case "lan_2":
      return RONG_LAN_CM / 2;
    case "le_phai":
      return RONG_LAN_CM + Math.floor(d.rong_le_cm / 2);
  }
}

/** Đoạn dọc đường (m) một vật chiếm: xe tuần tra dài 5 m, vật khác 1 m. */
const nhipDai = (loai: LoaiVatChot) => (loai === "xe" ? DAI_XE_TUAN_TRA_M : 1);

/**
 * Vị trí đặt có hợp lệ không. Trả lý do, hoặc null khi hợp lệ. Dùng chung cho điện thoại (chặn thao
 * tác) và máy chủ (chạy lại nhật ký).
 */
export function lyDoKhongDatDuoc(
  d: Pick<DoanChot, "dai_m" | "rong_le_cm" | "giao_lo" | "tui">,
  boTri: BoTriChot,
  vat: string,
  m: number,
  cot: CotChot,
): string | null {
  const v = d.tui.find((x) => x.id === vat);
  if (!v) return "Vật không có trong túi đồ.";
  if (!Number.isInteger(m) || m < 0 || m > d.dai_m) return "Vị trí nằm ngoài đoạn đường.";
  if (!COT_CHOT.includes(cot)) return "Vị trí nằm ngoài phần đường.";
  const dai = nhipDai(v.loai);
  if (m - dai + 1 < 0) return "Xe tuần tra không đủ chỗ ở mép dưới đoạn đường.";
  if (v.loai === "xe" && (cot === "le_trai" || (cot === "le_phai" && d.rong_le_cm < 250)))
    return "Lề quá hẹp để đỗ xe tuần tra.";
  if (d.giao_lo && m - dai + 1 <= d.giao_lo.m + NUA_GIAO_LO_M && m >= d.giao_lo.m - NUA_GIAO_LO_M)
    return "Không đặt vật trong giao lộ.";
  for (const [id, p] of Object.entries(boTri)) {
    if (id === vat || p.cot !== cot) continue;
    const khac = d.tui.find((x) => x.id === id);
    if (!khac) continue;
    // Hai đoạn [m - dài + 1, m] chồng nhau thì trùng chỗ.
    if (m - dai + 1 <= p.m && p.m - nhipDai(khac.loai) + 1 <= m) return "Chỗ này đã có vật khác.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Dựng lại bố trí từ nhật ký                                          */
/* ------------------------------------------------------------------ */

/**
 * Áp một thao tác đặt, xoay, gỡ lên bố trí (trả bố trí mới). Thao tác không hợp lệ thì ném LoiNhatKy.
 * Dùng chung cho máy chủ (chạy lại) và điện thoại.
 */
export function apThaoTacChot(
  d: Pick<DoanChot, "dai_m" | "rong_le_cm" | "giao_lo" | "tui">,
  boTri: BoTriChot,
  thaoTac: Exclude<ThaoTacChot, "chay_thu">,
  tham: NonNullable<ThamSoChot>,
): BoTriChot {
  const v = d.tui.find((x) => x.id === tham.vat);
  if (!v) throw new LoiNhatKy("Nhật ký có vật không có trong túi đồ.");
  const cu = boTri[tham.vat];
  if (thaoTac === "dat") {
    const lyDo = lyDoKhongDatDuoc(d, boTri, tham.vat, tham.m as number, tham.cot as CotChot);
    if (lyDo) throw new LoiNhatKy(`Nhật ký đặt vật ngoài phần đường hợp lệ: ${lyDo}`);
    return { ...boTri, [tham.vat]: { m: tham.m as number, cot: tham.cot as CotChot, huong: cu?.huong ?? 0 } };
  }
  if (!cu) throw new LoiNhatKy("Nhật ký xoay hoặc gỡ một vật chưa đặt.");
  if (thaoTac === "xoay") {
    if (v.loai !== "bien") throw new LoiNhatKy("Nhật ký xoay một vật không phải biển.");
    return { ...boTri, [tham.vat]: { ...cu, huong: ((cu.huong + 1) % 4) as ViTriVat["huong"] } };
  }
  const { [tham.vat]: _, ...con } = boTri;
  return con;
}

export interface BoTriChotDaDung {
  /** Bố trí lúc nộp (được chấm). */
  cham: BoTriChot;
  so_lan_chay: number;
}

/** Dựng lại bố trí lúc nộp từ nhật ký. Chạy thử quá 2 lần: ném LoiNhatKy (cả bước 0 điểm). */
export function dungLaiBoTriChot(
  d: Pick<DoanChot, "dai_m" | "rong_le_cm" | "giao_lo" | "tui">,
  nk: TraLoiChotDem,
): BoTriChotDaDung {
  let bt: BoTriChot = {};
  let soLan = 0;
  for (const t of nk.thao_tac) {
    if (t.thao_tac === "chay_thu") {
      soLan++;
      if (soLan > SO_LAN_CHAY_THU_CHOT)
        throw new LoiNhatKy(`Nhật ký chạy thử quá ${SO_LAN_CHAY_THU_CHOT} lần: cả bước 0 điểm.`);
      continue;
    }
    if (!t.tham_so) throw new LoiNhatKy("Nhật ký thiếu vật.");
    bt = apThaoTacChot(d, bt, t.thao_tac, t.tham_so);
  }
  return { cham: bt, so_lan_chay: soLan };
}

/* ------------------------------------------------------------------ */
/* Dòng xe và cấu hình mô phỏng                                        */
/* ------------------------------------------------------------------ */

export interface XeCuaDong {
  khoi_tao: XeKhoiTao;
  loai: LoaiXeChot;
  qua_toc_do: boolean;
}

/** Sinh dòng xe tất định từ seed. Xe vào sau 60 giây không có trong dòng. */
export function sinhDongXe(d: Pick<DoanChot, "luong_xe" | "giao_lo">): XeCuaDong[] {
  const x = d.luong_xe;
  const rng = taoRng(`chot:${x.seed}`);
  const so = (n: number) => Math.floor(rng() * n);
  const loaiXe = Object.keys(TEN_XE_CHOT) as LoaiXeChot[];
  const thuTu = tron(
    Array.from({ length: x.so_xe }, (_, i) => i),
    rng,
  );
  const quaTocDo = new Set(thuTu.slice(0, x.qua_toc_do));
  const tuGiaoLo = new Set(d.giao_lo ? thuTu.slice(x.qua_toc_do, x.qua_toc_do + x.tu_giao_lo) : []);
  const ds: XeCuaDong[] = [];
  let nhip = 0;
  for (let i = 0; i < x.so_xe; i++) {
    nhip += Math.floor(x.nhip_giua / 2) + so(x.nhip_giua + 1);
    // Chọn loại xe theo tỷ lệ: cộng dồn tỷ lệ tới khi vượt số ngẫu nhiên.
    const r = so(100);
    let tich = 0;
    const loai =
      loaiXe.find((l) => {
        tich += x.ty_le[l];
        return r < tich;
      }) ?? "o_to";
    const nhanh = quaTocDo.has(i) && loai !== "xe_tai" && loai !== "xe_khach";
    const lan: LanChot = so(100) < (loai === "xe_may" ? 75 : 50) ? "lan_2" : "lan_1";
    const coBan = loai === "o_to" ? TOC_DO_THUONG : 600;
    const giaoLo = tuGiaoLo.has(i) && d.giao_lo;
    if (nhip >= NHIP_CHAY_CHOT) break;
    ds.push({
      loai,
      qua_toc_do: nhanh,
      khoi_tao: {
        id: `xe-${String(i + 1).padStart(2, "0")}`,
        loai: loai === "xe_khach" ? "xe_tai" : loai,
        lan: giaoLo ? "lan_2" : lan,
        nhip_vao: nhip,
        v_max: nhanh ? TOC_DO_QUA_TOC_DO : coBan - 40 + so(81),
        ...(giaoLo ? { s_vao: sCuaM(giaoLo.m + NUA_GIAO_LO_M) } : {}),
      },
    });
  }
  return ds;
}

const vatCuaTui = (d: Pick<DoanChot, "tui">) => new Map(d.tui.map((v) => [v.id, v]));

/** Vùng chốt (m): từ vật đầu tiên đặt trong làn (hoặc 10 m trước chốt) tới 10 m sau vật cuối cùng. */
export function vungChotM(
  d: Pick<DoanChot, "chot_m" | "tui">,
  boTri: BoTriChot,
): { tu: number; den: number } {
  const theoId = vatCuaTui(d);
  const trongLan = Object.entries(boTri).filter(([id, p]) => laLan(p.cot) && theoId.get(id)?.loai !== "cs");
  const ms = trongLan.map(([id, p]) => p.m - nhipDai(theoId.get(id)!.loai) + 1);
  return {
    tu: Math.min(d.chot_m - 10, ...ms),
    den: Math.max(d.chot_m, ...trongLan.map(([, p]) => p.m)) + 10,
  };
}

/** Cảnh đêm cho tam-nhin.ts: nguồn sáng (đèn, xe tuần tra) và đoạn khuất, theo quãng đường cm. */
export function canhDemChot(d: Pick<DoanChot, "khuat" | "tui">, boTri: BoTriChot): CanhDem {
  const theoId = vatCuaTui(d);
  return {
    khuat: khuatTheoS(d),
    sang: Object.entries(boTri)
      .filter(([id]) => ["den", "xe"].includes(theoId.get(id)?.loai ?? ""))
      .map(([, p]) => ({ s: sCuaM(p.m) })),
  };
}

function khuatTheoS(d: Pick<DoanChot, "khuat">): DoanKhuat[] {
  return d.khuat.map((k, i) => ({
    id: `k${i + 1}`,
    loai: k.loai,
    muc: k.muc,
    s_tu: sCuaM(k.m_tu),
    s_den: sCuaM(k.m_den),
  }));
}

/** Cấu hình mô phỏng của một lần chạy (điện thoại chạy thử và máy chủ chấm dùng chung). */
export function cauHinhChot(d: DoanChot, boTri: BoTriChot): CauHinhMoPhong {
  const theoId = vatCuaTui(d);
  const soO = d.dai_m / 10;
  const lan = (["lan_1", "lan_2"] as const).map((id) =>
    lanThangDiLen(id, soO, TOC_DO_LAN, xCuaCot(d, id), CHAY_DA_CHOT_CM),
  );
  const vatCan: VatCan[] = [];
  const canhBao: VatCanhBao[] = [];
  const nguoi: NguoiTrenDuong[] = [];
  for (const [id, p] of Object.entries(boTri)) {
    const v = theoId.get(id);
    if (!v) continue;
    const s = sCuaM(p.m);
    if (v.loai === "cs") {
      nguoi.push({ id, x: xCuaCot(d, p.cot), y: yCuaM(d, p.m) });
      continue;
    }
    if (v.loai === "den" || v.loai === "xe" || (v.loai === "bien" && p.huong === 0))
      canhBao.push({ id, loai: v.loai, s });
    if (laLan(p.cot))
      vatCan.push({
        id,
        loai: v.loai === "xe" ? "xe_do" : v.loai,
        lan: p.cot,
        s_tu: v.loai === "xe" ? s - DAI_XE_TUAN_TRA_M * 100 : s - 25,
        s_den: v.loai === "xe" ? s : s + 25,
        lan_tranh: p.cot === "lan_1" ? "lan_2" : "lan_1",
      });
  }
  const vz = vungChotM(d, boTri);
  return {
    lan,
    dac_diem: [],
    bien: [],
    xe: sinhDongXe(d).map((x) => x.khoi_tao),
    vat_can: vatCan,
    nguoi,
    dem: { canh_bao: canhBao, khuat: khuatTheoS(d), vung_chot: { s_tu: sCuaM(vz.tu), s_den: sCuaM(vz.den) } },
  };
}

/* ------------------------------------------------------------------ */
/* Chạy và đo                                                          */
/* ------------------------------------------------------------------ */

/** Theo dõi trong lúc chạy: hàng chờ dài nhất và lúc xảy ra. */
export interface DoDacChay {
  hang_cho_cm: number;
  nhip_hang_cho: number;
}

export const doDacRong = (): DoDacChay => ({ hang_cho_cm: 0, nhip_hang_cho: 0 });

/** Cập nhật đo đạc sau một nhịp (điện thoại gọi mỗi nhịp khi chạy thử, máy chủ gọi trong `chayChot`). */
export function doSauNhip(dd: DoDacChay, tt: TrangThaiMoPhong): DoDacChay {
  const h = doHangCho(tt.xe);
  return h > dd.hang_cho_cm ? { hang_cho_cm: h, nhip_hang_cho: tt.nhip } : dd;
}

/** Chạy một bố trí tới hết 60 giây (hoặc tới khi mọi xe đã qua). */
export function chayChot(d: DoanChot, boTri: BoTriChot): { trang_thai: TrangThaiMoPhong; do_dac: DoDacChay } {
  const mp = dungMoPhong(cauHinhChot(d, boTri));
  let tt = trangThaiDau(mp);
  let dd = doDacRong();
  while (!tt.xong && tt.nhip < NHIP_CHAY_CHOT) {
    tt = buocMoPhong(mp, tt);
    dd = doSauNhip(dd, tt);
  }
  return { trang_thai: tt, do_dac: dd };
}

export interface XePhanhGap {
  xe: string;
  loai: LoaiXeChot;
  qua_toc_do: boolean;
  m: number;
  nhip: number;
}

export interface XeVaoVung extends XePhanhGap {
  chien_si: string;
}

export interface KetBienChot {
  vat: string;
  m: number;
  cot: CotChot;
  quay_sai: boolean;
  /** Người lái thấy biển từ xa nhất bao nhiêu mét. */
  tam_nhin_m: number;
  /** Tầm nhìn bị đoạn cong, dốc che bớt. */
  bi_che: boolean;
  /** Biển cách vùng chốt ngắn hơn quãng giảm tốc êm từ tốc độ thường: qua biển rồi không kịp giảm êm. */
  qua_gan: boolean;
  /** Biển nằm từ vùng chốt trở đi. */
  sau_chot: boolean;
}

/** Kết quả một lần chạy, hiện cho người chơi sau chạy thử và ở màn kết quả. Không dùng ngưỡng. */
export interface KetQuaChayChot {
  phanh_gap: XePhanhGap[];
  vao_vung: XeVaoVung[];
  hang_cho_m: number;
  nhip_hang_cho: number;
  bien: KetBienChot[];
  so_xe: number;
  so_xe_da_qua: number;
}

/** Quãng đường (cm) để giảm êm từ tốc độ thường về tốc độ qua chốt. */
export const QUANG_GIAM_TOC_CM = Math.ceil(
  (TOC_DO_THUONG * TOC_DO_THUONG - TOC_DO_CHAM * TOC_DO_CHAM) / (2 * PHANH_DU_KIEN) / 10,
);

const mCuaY = (d: Pick<DoanChot, "dai_m">, y: number) => Math.round(d.dai_m - y / 100);

export function ketQuaChay(
  d: DoanChot,
  boTri: BoTriChot,
  suKien: readonly SuKien[],
  xe: ReadonlyArray<{ id: string; trang_thai: string }>,
  dd: DoDacChay,
): KetQuaChayChot {
  const dong = new Map(sinhDongXe(d).map((x) => [x.khoi_tao.id, x]));
  const thongTin = (s: SuKien): XePhanhGap => ({
    xe: s.xe,
    loai: dong.get(s.xe)?.loai ?? "o_to",
    qua_toc_do: dong.get(s.xe)?.qua_toc_do ?? false,
    m: mCuaY(d, s.y),
    nhip: s.nhip,
  });
  const phanhGap = new Map<string, XePhanhGap>();
  const vaoVung: XeVaoVung[] = [];
  for (const s of suKien) {
    if (s.loai === "phanh_gap" && !phanhGap.has(s.xe)) phanhGap.set(s.xe, thongTin(s));
    if (s.loai === "vao_vung_nguy_hiem") vaoVung.push({ ...thongTin(s), chien_si: s.nguoi! });
  }
  const cd = canhDemChot(d, boTri);
  const theoId = vatCuaTui(d);
  const vz = vungChotM(d, boTri);
  const bien = Object.entries(boTri)
    .filter(([id]) => theoId.get(id)?.loai === "bien")
    .sort(([a, p], [b, q]) => p.m - q.m || a.localeCompare(b))
    .map(([vat, p]): KetBienChot => {
      const s = sCuaM(p.m);
      const tamNhin = p.huong === 0 ? tamNhinToi(cd, "bien", s) : 0;
      const sauChot = p.m >= vz.tu;
      return {
        vat,
        m: p.m,
        cot: p.cot,
        quay_sai: p.huong !== 0,
        tam_nhin_m: Math.floor(tamNhin / 100),
        bi_che: p.huong === 0 && tamNhin < tamNhinGoc(cd, "bien", s) - 100,
        qua_gan: !sauChot && p.huong === 0 && sCuaM(vz.tu) - s < QUANG_GIAM_TOC_CM,
        sau_chot: sauChot,
      };
    });
  return {
    phanh_gap: [...phanhGap.values()].sort((a, b) => a.nhip - b.nhip),
    vao_vung: vaoVung,
    hang_cho_m: Math.round(dd.hang_cho_cm / 100),
    nhip_hang_cho: dd.nhip_hang_cho,
    bien,
    so_xe: xe.length,
    so_xe_da_qua: xe.filter((x) => x.trang_thai === "da_qua").length,
  };
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

export interface KetTieuChi {
  ma: MaTieuChiChot;
  diem: number;
  toi_da: number;
  /** Đo được gì. */
  do_duoc: string;
  /** Ngưỡng áp dụng (hiện SAU khi chấm). */
  nguong: string;
  nguon: string;
}

export const TEN_TIEU_CHI_CHOT: Record<MaTieuChiChot, string> = {
  bien_dau: "Khoảng cách từ biển đầu tiên tới chốt",
  coc: "Cọc thu hẹp làn liền mạch, đủ số cọc",
  chien_si: "Chiến sĩ đứng ngoài vùng nguy hiểm",
  phanh_gap: "Số xe phanh gấp",
  hang_cho: "Độ dài hàng chờ",
  bien_khuat: "Biển không bị khuất tầm nhìn",
};

const lam1 = (x: number) => Math.round(x * 10) / 10;

/** Chấm một bố trí theo sáu tiêu chí. Điểm từng tiêu chí trong [0, tối đa]. */
export function chamChot(
  d: DoanChot,
  tc: PayloadTieuChiChot,
  boTri: BoTriChot,
  kq: KetQuaChayChot,
): { diem: number; tieu_chi: KetTieuChi[] } {
  const n = tc.nguong;
  const theoId = vatCuaTui(d);
  const nguon = (ma: MaTieuChiChot) => tc.nguon.find((g) => g.tieu_chi === ma)?.ghi_chu ?? "";
  const ds: KetTieuChi[] = [];
  const them = (ma: MaTieuChiChot, diem: number, do_duoc: string, nguong: string) =>
    ds.push({
      ma,
      diem: lam1(Math.max(0, Math.min(DIEM_TIEU_CHI_CHOT[ma], diem))),
      toi_da: DIEM_TIEU_CHI_CHOT[ma],
      do_duoc,
      nguong,
      nguon: nguon(ma),
    });
  const cua = (loai: LoaiVatChot) =>
    Object.entries(boTri).filter(([id]) => theoId.get(id)?.loai === loai) as Array<[string, ViTriVat]>;

  // 1. Biển đầu tiên (xa chốt nhất, quay về phía xe tới, trước chốt).
  const bienTruoc = cua("bien")
    .filter(([, p]) => p.huong === 0 && p.m < d.chot_m)
    .sort(([, p], [, q]) => p.m - q.m);
  const kc = bienTruoc.length ? d.chot_m - bienTruoc[0]![1].m : null;
  them(
    "bien_dau",
    kc !== null && kc >= n.bien_dau_m_tu && kc <= n.bien_dau_m_den ? DIEM_TIEU_CHI_CHOT.bien_dau : 0,
    kc === null ? "Không có biển quay về phía xe tới đặt trước chốt." : `Biển đầu tiên cách chốt ${kc} m.`,
    `Từ ${n.bien_dau_m_tu} đến ${n.bien_dau_m_den} m.`,
  );

  // 2. Cọc trên làn thu hẹp.
  const coc = cua("coc")
    .filter(([, p]) => p.cot === d.lan_dong)
    .map(([, p]) => p.m)
    .sort((a, b) => a - b);
  let ho = 0;
  for (let i = 1; i < coc.length; i++) if (coc[i]! - coc[i - 1]! > n.coc_khoang_m) ho++;
  const toiChot = coc.length > 0 && d.chot_m - coc.at(-1)! <= n.coc_khoang_m;
  if (coc.length && !toiChot) ho++;
  them(
    "coc",
    coc.length < n.coc_toi_thieu ? 0 : DIEM_TIEU_CHI_CHOT.coc - n.tru_moi_doan_ho * ho,
    `${coc.length} cọc trên làn thu hẹp, ${ho} đoạn hở${coc.length && !toiChot ? " (hàng cọc chưa tới chốt)" : ""}.`,
    `Ít nhất ${n.coc_toi_thieu} cọc; hai cọc cách nhau không quá ${n.coc_khoang_m} m; trừ ${n.tru_moi_doan_ho} điểm mỗi đoạn hở.`,
  );

  // 3. Chiến sĩ: đã đặt và không xe nào vào vùng nguy hiểm.
  const cs = d.tui.filter((v) => v.loai === "cs");
  const an = cs.filter((v) => boTri[v.id] && !kq.vao_vung.some((x) => x.chien_si === v.id)).length;
  them(
    "chien_si",
    cs.length ? (DIEM_TIEU_CHI_CHOT.chien_si * an) / cs.length : 0,
    `${an}/${cs.length} chiến sĩ an toàn.`,
    "Chia đều cho số chiến sĩ; chiến sĩ chưa đặt hoặc có xe đi vào vùng nguy hiểm không được điểm.",
  );

  // 4. Xe phanh gấp.
  them(
    "phanh_gap",
    DIEM_TIEU_CHI_CHOT.phanh_gap - n.tru_moi_xe_phanh_gap * kq.phanh_gap.length,
    `${kq.phanh_gap.length} xe phanh gấp.`,
    `Không xe nào: ${DIEM_TIEU_CHI_CHOT.phanh_gap} điểm; mỗi xe trừ ${n.tru_moi_xe_phanh_gap}.`,
  );

  // 5. Hàng chờ: dưới ngưỡng đủ điểm, gấp đôi ngưỡng 0 điểm, tuyến tính ở giữa.
  const L = kq.hang_cho_m;
  them(
    "hang_cho",
    L <= n.hang_cho_m
      ? DIEM_TIEU_CHI_CHOT.hang_cho
      : (DIEM_TIEU_CHI_CHOT.hang_cho * (2 * n.hang_cho_m - L)) / n.hang_cho_m,
    `Hàng chờ dài nhất ${L} m.`,
    `Không quá ${n.hang_cho_m} m: đủ điểm; từ ${2 * n.hang_cho_m} m: 0 điểm.`,
  );

  // 6. Biển bị khuất: quay sai hướng hoặc thấy được từ gần hơn ngưỡng. Không đặt biển nào: 0 điểm.
  const khuat = kq.bien.filter((b) => b.quay_sai || b.tam_nhin_m < n.tam_nhin_bien_m).length;
  them(
    "bien_khuat",
    kq.bien.length ? DIEM_TIEU_CHI_CHOT.bien_khuat - n.tru_moi_bien_khuat * khuat : 0,
    kq.bien.length ? `${khuat}/${kq.bien.length} biển bị khuất hoặc quay sai hướng.` : "Chưa đặt biển nào.",
    `Người lái phải thấy biển từ ít nhất ${n.tam_nhin_bien_m} m; trừ ${n.tru_moi_bien_khuat} điểm mỗi biển.`,
  );

  return { diem: lam1(ds.reduce((s, t) => s + t.diem, 0)), tieu_chi: ds };
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

export interface ChiTietChotDem {
  hop_le: boolean;
  ly_do: string | null;
  so_lan_chay: number;
  bo_tri: BoTriChot;
  chay: KetQuaChayChot;
  tieu_chi: KetTieuChi[];
  /** Băm trạng thái cuối của lần chạy lại (test máy chủ và điện thoại khớp nhau). */
  bam: string;
}

function deTuBuoc(b: BuocChotDem): DeChotDem {
  const p = b.doan;
  return {
    man: b.man,
    hinh: p.hinh,
    dai_m: p.dai_m,
    rong_le_cm: p.rong_le_cm,
    chot_m: p.chot_m,
    lan_dong: p.lan_dong,
    khuat: p.khuat.map((k) => ({ ...k })),
    giao_lo: p.giao_lo ? { m: p.giao_lo.m } : null,
    tui: vatTrongTui(p.tui),
    luong_xe: { ...p.luong_xe, ty_le: { ...p.luong_xe.ty_le } },
    so_lan_chay: SO_LAN_CHAY_THU_CHOT,
  };
}

const COT_HOP_LE = new Set<string>(COT_CHOT);

export const TRO_CHOI_CHOT_DEM: DinhNghiaTroChoi<BuocChotDem, DeChotDem, TraLoiChotDem> = {
  ma: MA_CHOT_DEM,
  ten: "Dựng chốt an toàn ban đêm",
  moTa: "Đặt biển, cọc, đèn, xe tuần tra và chiến sĩ trên đoạn đường ban đêm, rồi cho xe chạy thử.",
  offline: true,
  nguon: "chot_dem_doan_duong",
  soBuoc: 1,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 12,
  manChoi: MAN_CHOT_DEM,

  locNguon(nguon) {
    return (nguon as NguonChotDem[]).filter(
      (n) =>
        n?.doan &&
        n.tieu_chi &&
        n.doan.ma_tieu_chi === n.tieu_chi.ma &&
        kiemTraDoanChot(n.doan).length === 0 &&
        kiemTraTieuChiChot(n.tieu_chi).length === 0,
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const ds = (this.locNguon(nguon) as NguonChotDem[])
      .filter((n) => n.doan.muc === m)
      .sort((a, b) => a.id.localeCompare(b.id));
    const chon = tron(ds, rng)[0];
    if (!chon) return [];
    return [
      {
        thu_tu: 1,
        ref_kind: "game_content",
        ref_id: chon.id,
        ref_version: chon.version,
        topic_id: chon.topic_id,
        diem_toi_da: DIEM_TOI_DA_CHOT,
        noi_dung: { man: m, doan: chon.doan, tieu_chi: chon.tieu_chi },
      },
    ];
  },

  deChoNguoiChoi(buoc) {
    return deTuBuoc(buoc.noi_dung);
  },

  docTraLoi(raw) {
    return docNhatKy<ThaoTacChot, ThamSoChot>(
      raw,
      (thaoTac, thamSo) => {
        if (thaoTac === "chay_thu") return thamSo == null ? { thao_tac: "chay_thu", tham_so: null } : null;
        if (!THAO_TAC_CHOT.includes(thaoTac as ThaoTacChot) || !thamSo || typeof thamSo !== "object")
          return null;
        const { vat, m, cot } = thamSo as Record<string, unknown>;
        if (!laChuoi(vat, 20)) return null;
        if (thaoTac !== "dat") return { thao_tac: thaoTac as "xoay" | "go", tham_so: { vat } };
        if (!Number.isInteger(m) || Math.abs(m as number) > 10_000 || !COT_HOP_LE.has(cot as string))
          return null;
        return { thao_tac: "dat", tham_so: { vat, m: m as number, cot: cot as CotChot } };
      },
      { tongNhipToiDa: TONG_NHIP_TOI_DA_CHOT },
    );
  },

  chamBuoc(buoc, tl, ngCanh): KetQuaChamBuoc {
    const n = buoc.noi_dung;
    const d = deTuBuoc(n);
    const kq = chayLaiRoiCham(tl, ngCanh?.thoiGianMs ?? null, (nk) => dungLaiBoTriChot(d, nk));
    const boTri = kq.hop_le ? kq.ket_qua.cham : {};
    const chay = chayChot(d, boTri);
    const ketChay = ketQuaChay(d, boTri, chay.trang_thai.su_kien, chay.trang_thai.xe, chay.do_dac);
    const cham = chamChot(d, n.tieu_chi, boTri, ketChay);
    const diem = kq.hop_le ? cham.diem : 0;
    const chiTiet: ChiTietChotDem = {
      hop_le: kq.hop_le,
      ly_do: kq.hop_le ? null : kq.ly_do,
      so_lan_chay: kq.hop_le ? kq.ket_qua.so_lan_chay : 0,
      bo_tri: boTri,
      chay: ketChay,
      tieu_chi: kq.hop_le ? cham.tieu_chi : cham.tieu_chi.map((t) => ({ ...t, diem: 0 })),
      bam: bamTrangThai({
        xe: chay.trang_thai.xe,
        su_kien: chay.trang_thai.su_kien,
        nhip: chay.trang_thai.nhip,
      }),
    };
    const dat = cham.tieu_chi.filter((t) => t.diem >= t.toi_da).length;
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: kq.hop_le && diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich: kq.hop_le
        ? `Đạt trọn ${dat}/6 tiêu chí. ${ketChay.phanh_gap.length} xe phanh gấp, hàng chờ dài nhất ${ketChay.hang_cho_m} m.`
        : `Không chấm được bố trí: ${kq.ly_do}`,
      canCu: [...new Set(n.tieu_chi.nguon.map((g) => g.urn).filter((u): u is string => Boolean(u)))],
    };
  },
};
