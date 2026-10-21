/**
 * Trò "Dừng xe đúng quy trình" (docs/PLAN.md GĐ-T4, docs/GAME_DESIGN.md §5.4).
 *
 * Một lượt là một lần dừng xe kiểm tra. Người chơi làm từng thao tác bằng cử chỉ, không chọn đáp án:
 *   vuốt lên để ra hiệu lệnh dừng xe; chạm vị trí dừng; chạm lời thoại (thông báo lý do, đề nghị
 *   xuất trình giấy tờ…); kéo từng giấy tờ vào khay "Đạt" / "Không đạt"; giữ nút máy đo nồng độ cồn;
 *   kéo thẻ kết quả vào hướng xử lý.
 * Điện thoại ghi nhật ký `{ ms, loai, ... }` và gửi cả nhật ký khi kéo thẻ kết quả (hoặc bấm kết thúc).
 *
 * Hai lớp, cùng chạy ở máy chủ và điện thoại:
 *  - `dienBien`: máy trạng thái của TÌNH HUỐNG. Chạy lại nhật ký, sinh diễn biến: xe chưa dừng thì
 *    người lái không nghe; đề nghị xuất trình trước khi nói lý do thì người lái bức xúc; tiếp xúc khi
 *    xe còn đỗ giữa làn thì nguy hiểm; thả tay sớm thì máy đo phải đo lại… Điện thoại chạy lớp này để
 *    hiện diễn biến ngay; máy chủ chạy thêm với phần kín (vị trí nào an toàn).
 *  - `chamDungXe`: so thứ tự các bước người chơi đã hoàn thành với QUY TRÌNH ĐÃ DUYỆT (bảng
 *    `procedures`, phần `tro_choi` của từng bước): bước nào áp dụng, bắt buộc, theo thứ tự nào.
 *    Mã chỉ biết cách chạy từng LOẠI bước; thứ tự và bước bắt buộc nằm trong dữ liệu.
 *
 * Chấm (GAME_DESIGN §5.4): mỗi bước bắt buộc áp dụng được 10 điểm khi làm đúng; làm sai thứ tự thì
 * được 7 (−3); thiếu thì 0 và ghi lỗi. Kiểm giấy tờ được điểm theo tỷ lệ giấy xếp đúng khay. Hướng xử lý
 * đúng được 10. Trừ vào tổng: mỗi thao tác không an toàn −10; thả tay sớm khi đo từ lần thứ hai −2;
 * màn 5 mỗi thao tác quá giờ −2. Điểm bước không âm.
 *
 * Kiểm gian lận như Cung đường biển báo: mốc không tăng dần, mốc sau lúc kết thúc, hoặc tổng thời
 * gian dài hơn đồng hồ máy chủ quá 10% (cộng dung sai mạng) thì cả bước 0 điểm. Thao tác sai dạng
 * hoặc không thuộc máy trạng thái bị bỏ qua, không làm hỏng cả nhật ký.
 *
 * Đánh đổi dữ kiện gửi xuống điện thoại (ghi ở GAME_DESIGN §5.4): phản ứng của người lái, giấy tờ
 * và số đo trên máy đo được gửi trước, vì điện thoại phải dựng diễn biến ngay. KHÔNG gửi: thứ tự quy
 * trình (trừ màn 1 có gợi ý), vị trí nào an toàn, giấy tờ nào sai, hướng xử lý đúng.
 *
 * Hàm thuần: không chạm CSDL, không đọc đồng hồ.
 */

import { tron } from "../de-thi.ts";
import type { BuocQuyTrinh, QuyTrinh } from "../tra-cuu-nhanh.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import {
  GIAY_TO_CUA_LOI,
  type HoSoGiayTo,
  kiemTraDuLieuHoSo,
  kiemTraHoSo,
  LOAI_GIAY_TO,
  type LoaiGiayTo,
  type LuatGiayTo,
  luatConThieu,
  MA_LOI_GIAY_TO,
  type MaLoiGiayTo,
  type PhanLoaiXe,
  TEN_GIAY_TO,
  TEN_LOI_GIAY_TO,
  TEN_PHAN_LOAI_XE,
} from "./chung/giay-to.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import { type BuocLuot, type DinhNghiaTroChoi, DUNG_SAI_BUOC_MS, type KetQuaChamBuoc } from "./khung.ts";

export const MA_DUNG_XE = "dung_xe";
/** Mã quy trình (bảng `procedures`) trò đọc. */
export const MA_QUY_TRINH_DUNG_XE = "dung-xe-kiem-tra";

export const DIEM_MOI_BUOC = 10;
export const TRU_SAI_THU_TU = 3;
export const TRU_KHONG_AN_TOAN = 10;
export const TRU_THA_SOM = 2;
export const TRU_QUA_GIO = 2;
/** Nhật ký tối đa (GAME_DESIGN §2.3). */
export const THAO_TAC_TOI_DA = 2_000;
/** Nhật ký dài hơn thời gian máy chủ đo quá tỷ lệ này (cộng dung sai mạng) thì không hợp lệ. */
const LECH_GIO_TOI_DA = 0.1;
/** Một tình huống dài tối đa 5 phút (GAME_DESIGN §2.3). */
export const TONG_MS_TOI_DA = 300_000;

/* ------------------------------------------------------------------ */
/* Loại bước, phản ứng, hướng xử lý                                    */
/* ------------------------------------------------------------------ */

export const KIEU_BUOC_DUNG_XE = [
  "hieu_lenh_dung",
  "vi_tri_dung",
  "thong_bao_ly_do",
  "yeu_cau_xuat_trinh",
  "kiem_giay_to",
  "do_nong_do_con",
  "tu_choi_de_nghi",
  "yeu_cau_chap_hanh_do",
  "xu_ly",
] as const;
export type KieuBuocDungXe = (typeof KIEU_BUOC_DUNG_XE)[number];

/** Cử chỉ của từng loại bước. Quy trình khai cử chỉ khác thì không dùng được cho trò. */
export const THAO_TAC_CUA_BUOC: Record<KieuBuocDungXe, "vuot" | "cham" | "keo" | "giu"> = {
  hieu_lenh_dung: "vuot",
  vi_tri_dung: "cham",
  thong_bao_ly_do: "cham",
  yeu_cau_xuat_trinh: "cham",
  kiem_giay_to: "keo",
  do_nong_do_con: "giu",
  tu_choi_de_nghi: "cham",
  yeu_cau_chap_hanh_do: "cham",
  xu_ly: "keo",
};

/** Nhãn ngắn trên màn chơi và màn kết quả. */
export const TEN_BUOC_DUNG_XE: Record<KieuBuocDungXe, string> = {
  hieu_lenh_dung: "Ra hiệu lệnh dừng xe",
  vi_tri_dung: "Hướng dẫn xe vào vị trí dừng",
  thong_bao_ly_do: "Chào, thông báo lý do dừng xe",
  yeu_cau_xuat_trinh: "Đề nghị xuất trình giấy tờ",
  kiem_giay_to: "Kiểm tra giấy tờ",
  do_nong_do_con: "Kiểm tra nồng độ cồn",
  tu_choi_de_nghi: "Từ chối đề nghị bỏ qua",
  yeu_cau_chap_hanh_do: "Yêu cầu chấp hành kiểm tra nồng độ cồn",
  xu_ly: "Quyết định hướng xử lý",
};

/**
 * Điều kiện áp dụng của bước (ghi ở `tro_choi.dieu_kien` trong quy trình):
 *  - `co_vi_tri`: tình huống có chọn vị trí dừng (màn 2 trở lên);
 *  - `co_do_con`: tình huống có kiểm tra nồng độ cồn;
 *  - các phản ứng của người lái: bước chỉ áp dụng khi người lái có phản ứng đó.
 */
export const DIEU_KIEN_BUOC = ["co_vi_tri", "co_do_con", "xin_bo_qua", "tu_choi_thoi"] as const;
export type DieuKienBuoc = (typeof DIEU_KIEN_BUOC)[number];

/**
 * Phản ứng của người lái không hợp tác:
 *  - `khong_dung_lan_dau`: không dừng ở hiệu lệnh đầu, phải ra hiệu lệnh lần nữa;
 *  - `doi_biet_ly_do`: không đưa giấy tờ khi chưa được thông báo lý do;
 *  - `xin_bo_qua`: sau khi đưa giấy tờ, xin bỏ qua;
 *  - `tu_choi_thoi`: lần đầu không chịu thổi vào máy đo.
 */
export const PHAN_UNG_NGUOI_LAI = [
  "khong_dung_lan_dau",
  "doi_biet_ly_do",
  "xin_bo_qua",
  "tu_choi_thoi",
] as const;
export type PhanUngNguoiLai = (typeof PHAN_UNG_NGUOI_LAI)[number];

export const HUONG_XU_LY = ["cho_di", "lap_bien_ban", "lap_bien_ban_tam_giu"] as const;
export type HuongXuLy = (typeof HUONG_XU_LY)[number];
export const TEN_HUONG_XU_LY: Record<HuongXuLy, string> = {
  cho_di: "Cho đi",
  lap_bien_ban: "Lập biên bản",
  lap_bien_ban_tam_giu: "Lập biên bản, tạm giữ phương tiện",
};

export const HUONG_VUOT = [
  "len",
  "xuong",
  "trai",
  "phai",
  "len_trai",
  "len_phai",
  "xuong_trai",
  "xuong_phai",
] as const;
export type HuongVuot = (typeof HUONG_VUOT)[number];
/** Quy ước trò chơi (ghi ở màn hướng dẫn): vuốt lên là giơ tay ra hiệu lệnh dừng xe. */
export const HUONG_HIEU_LENH: HuongVuot = "len";

/** Lời thoại chạm được, theo loại bước. */
export const LOI_THOAI: Partial<Record<KieuBuocDungXe, string>> = {
  thong_bao_ly_do: "Chào anh/chị. Tổ công tác dừng xe để kiểm tra, lý do là…",
  yeu_cau_xuat_trinh: "Đề nghị anh/chị xuất trình giấy tờ của người lái và của xe.",
  tu_choi_de_nghi: "Tôi không thể bỏ qua. Đề nghị anh/chị hợp tác để làm tiếp.",
  yeu_cau_chap_hanh_do: "Kiểm tra nồng độ cồn là yêu cầu bắt buộc. Đề nghị anh/chị chấp hành.",
};

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

export const MAN_DUNG_XE: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Dừng xe, kiểm giấy tờ",
    moTa: "Ra hiệu lệnh, tiếp xúc, kiểm giấy tờ, quyết định. Có mũi tên gợi ý thao tác tiếp theo. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Vị trí dừng an toàn",
    moTa: "Bỏ gợi ý. Chọn chỗ cho xe dừng: có chỗ nguy hiểm dễ chọn nhầm. 3 phút.",
    caLuotMs: 180_000,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Đo nồng độ cồn",
    moTa: "Thêm kiểm tra nồng độ cồn: giữ nút máy đo đủ thời gian. 3 phút.",
    caLuotMs: 180_000,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Kết quả dương tính",
    moTa: "Máy đo báo có nồng độ cồn: đọc kết quả và chọn hướng xử lý. 3 phút.",
    caLuotMs: 180_000,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Diễn biến bất ngờ",
    moTa: "Người lái không dừng, xin bỏ qua, không chịu thổi. Mỗi thao tác có 15 giây. 2 phút 30 giây.",
    caLuotMs: 150_000,
    xpCoBan: 18,
  },
];
export const SO_MAN_DUNG_XE = MAN_DUNG_XE.length;
/** Giờ cho mỗi thao tác theo màn (quy ước trò chơi); vắng là không giới hạn. */
export const GIOI_HAN_THAO_TAC_THEO_MAN: Readonly<Record<number, number>> = { 5: 15_000 };

const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_DUNG_XE, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

export interface ViTriDung {
  ma: string;
  ten: string;
  /** Mô tả nhìn thấy được (dữ kiện, không nói an toàn hay không). */
  mo_ta: string;
}

export interface MayDoCon {
  /** Số đo hiện trên máy. */
  ket_qua: number;
  /** Đơn vị hiện trên máy, ví dụ "mg/L khí thở". */
  don_vi: string;
  /** Phải giữ nút bao lâu thì máy có kết quả. Số của tình huống demo, chưa đối chiếu văn bản. */
  giu_ms: number;
}

/** game_content.payload của một tình huống: chỉ dữ kiện. */
export interface PayloadDungXe {
  muc: number;
  mo_ta: string;
  /** Lý do dừng xe trong tình huống (người chơi thông báo khi tiếp xúc). */
  ly_do_dung: string;
  ho_so: HoSoGiayTo;
  vi_tri: ViTriDung[];
  phan_ung: PhanUngNguoiLai[];
  do_con: MayDoCon | null;
}

/** Vi phạm ngoài giấy tờ (nồng độ cồn…), trỏ tới mức phạt bằng mã. */
export interface ViPhamKhac {
  hanh_vi: string;
  chi_tiet: string;
  ma_muc_phat: string | null;
}

/** game_content.answer của một tình huống. */
export interface DapAnDungXe {
  vi_tri_an_toan: string[];
  /** Lỗi giấy tờ người soạn dự kiến; phải khớp kết quả của luật giấy tờ đã duyệt. */
  loi_giay_to: MaLoiGiayTo[];
  vi_pham_khac: ViPhamKhac[];
  huong_xu_ly: HuongXuLy;
  ly_do_xu_ly: string;
}

/** Một nguồn của trò: tình huống đã duyệt kèm quy trình, luật giấy tờ và mức phạt đã duyệt. */
export interface NguonDungXe {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  tinh_huong: PayloadDungXe;
  dap_an: DapAnDungXe;
  /** Quy trình đã duyệt, kèm phiên bản (để ảnh chụp lượt ghi lại). */
  quy_trinh: QuyTrinh & { version: number };
  luat: LuatGiayTo[];
  muc_phat: Record<string, MucPhatDaDuyet>;
}

/** Một bước chuẩn của quy trình, gọn cho ảnh chụp lượt. */
export interface BuocChuan {
  kieu: KieuBuocDungXe;
  tieu_de: string;
  mo_ta: string;
  can_cu: string | null;
  bat_buoc: boolean;
  dieu_kien: DieuKienBuoc | null;
  nguon: string;
}

/** Nội dung một bước trong ảnh chụp lượt (có đáp án, chỉ máy chủ và gói offline giữ). */
export interface BuocDungXe {
  man: number;
  tinh_huong: PayloadDungXe;
  quy_trinh: { ma: string; version: number; buoc: BuocChuan[] };
  vi_tri_an_toan: string[];
  /** Kết quả đúng của từng giấy tờ, suy từ luật đã duyệt. */
  giay_to_dung: Record<LoaiGiayTo, "dat" | "khong_dat">;
  loi_giay_to: Array<{ ma_loi: MaLoiGiayTo; mo_ta: string; giai_thich: string; can_cu: string }>;
  huong_xu_ly: HuongXuLy;
  ly_do_xu_ly: string;
  bien_ban: DongBienBan[];
}

/** Phần tình huống điện thoại cần để chạy `dienBien` (công khai). */
export interface CanhCongKhai {
  vi_tri: ViTriDung[];
  phan_ung: PhanUngNguoiLai[];
  do_con: MayDoCon | null;
  giay_to_co: Record<LoaiGiayTo, boolean>;
  gioi_han_thao_tac_ms: number | null;
}

/** Phần đề gửi người chơi. */
export interface DeDungXe extends CanhCongKhai {
  man: number;
  mo_ta: string;
  ly_do_dung: string;
  loi_noi: string;
  xe: HoSoGiayTo["xe"] & { ten_phan_loai: string };
  ngay_kiem_tra: string;
  giay_to: HoSoGiayTo["giay_to"];
  /** Chỉ có ở màn 1: thứ tự các bước để hiện mũi tên gợi ý. */
  goi_y_thu_tu: KieuBuocDungXe[] | null;
  /** Các lời thoại chạm được (phần ứng với phản ứng của người lái chỉ hiện khi phản ứng xảy ra). */
  loi_thoai: Array<{ kieu: KieuBuocDungXe; loi: string }>;
}

export type ThaoTacDungXe =
  | { ms: number; loai: "vuot"; huong: HuongVuot }
  | { ms: number; loai: "cham"; muc_tieu: string }
  | { ms: number; loai: "keo"; muc_tieu: string; dich: string }
  | { ms: number; loai: "giu"; muc_tieu: "may_do"; tu_ms: number };

export interface TraLoiDungXe {
  nhat_ky: ThaoTacDungXe[];
  tong_ms: number;
}

/* ------------------------------------------------------------------ */
/* Kiểm dữ liệu                                                        */
/* ------------------------------------------------------------------ */

const coTrong = <T extends string>(ds: readonly T[], v: unknown): v is T =>
  (ds as readonly string[]).includes(v as string);

/** Các bước quy trình dùng cho trò. Trả danh sách lỗi; rỗng là dùng được. */
export function kiemTraQuyTrinhDungXe(q: Pick<QuyTrinh, "cac_buoc"> | null | undefined): string[] {
  if (!q || !Array.isArray(q.cac_buoc) || !q.cac_buoc.length) return ["Quy trình chưa có bước nào."];
  const loi: string[] = [];
  const gap = new Set<string>();
  for (const [i, b] of q.cac_buoc.entries()) {
    const t = b.tro_choi;
    if (!t) {
      loi.push(`Bước ${i + 1} chưa có phần thao tác.`);
      continue;
    }
    if (!coTrong(KIEU_BUOC_DUNG_XE, t.ma)) {
      loi.push(`Bước ${i + 1}: trò không có loại bước "${t.ma}".`);
      continue;
    }
    if (gap.has(t.ma)) loi.push(`Bước ${i + 1}: trùng loại bước "${t.ma}".`);
    gap.add(t.ma);
    if (t.thao_tac !== THAO_TAC_CUA_BUOC[t.ma])
      loi.push(`Bước ${i + 1}: "${TEN_BUOC_DUNG_XE[t.ma]}" phải dùng thao tác ${THAO_TAC_CUA_BUOC[t.ma]}.`);
    if (t.dieu_kien != null && !coTrong(DIEU_KIEN_BUOC, t.dieu_kien))
      loi.push(`Bước ${i + 1}: điều kiện "${t.dieu_kien}" không hợp lệ.`);
  }
  for (const k of ["hieu_lenh_dung", "xu_ly"] as const)
    if (!gap.has(k)) loi.push(`Thiếu bước "${TEN_BUOC_DUNG_XE[k]}".`);
  const cuoi = q.cac_buoc.at(-1)?.tro_choi?.ma;
  if (cuoi && cuoi !== "xu_ly") loi.push(`Bước cuối phải là "${TEN_BUOC_DUNG_XE.xu_ly}".`);
  return loi;
}

/** Kiểm dữ kiện và đáp án một tình huống. Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraTinhHuongDungXe(
  p: Partial<PayloadDungXe> | null | undefined,
  d: Partial<DapAnDungXe> | null | undefined,
): string[] {
  if (!p || typeof p !== "object") return ["Thiếu tình huống."];
  const loi = kiemTraDuLieuHoSo(p.ho_so).map((s) => `Hồ sơ giấy tờ: ${s}`);
  const muc = p.muc ?? 0;
  if (!Number.isInteger(muc) || muc < 1 || muc > SO_MAN_DUNG_XE)
    loi.push(`Màn (muc) phải từ 1 đến ${SO_MAN_DUNG_XE}.`);
  if (typeof p.mo_ta !== "string" || p.mo_ta.trim().length < 10) loi.push("Thiếu mô tả tình huống.");
  if (typeof p.ly_do_dung !== "string" || p.ly_do_dung.trim().length < 5) loi.push("Thiếu lý do dừng xe.");
  const viTri = Array.isArray(p.vi_tri) ? p.vi_tri : null;
  if (!viTri) loi.push("Vị trí dừng phải là danh sách (có thể rỗng).");
  else {
    if (viTri.length === 1) loi.push("Có chọn vị trí thì cần ít nhất 2 vị trí.");
    if (viTri.length && muc < 2) loi.push("Chọn vị trí dừng chỉ có từ màn 2.");
    const ma = viTri.map((v) => v?.ma);
    if (
      new Set(ma).size !== ma.length ||
      viTri.some((v) => !v || !/^[a-z0-9_-]{1,20}$/.test(v.ma ?? "") || !v.ten || !v.mo_ta)
    )
      loi.push("Mỗi vị trí cần mã (chữ thường, không trùng), tên và mô tả.");
  }
  if (!Array.isArray(p.phan_ung) || p.phan_ung.some((x) => !coTrong(PHAN_UNG_NGUOI_LAI, x)))
    loi.push("Phản ứng của người lái không hợp lệ.");
  const c = p.do_con;
  if (c != null) {
    if (muc < 3) loi.push("Đo nồng độ cồn chỉ có từ màn 3.");
    if (
      !(typeof c.ket_qua === "number" && c.ket_qua >= 0) ||
      typeof c.don_vi !== "string" ||
      !c.don_vi.trim()
    )
      loi.push("Máy đo cần kết quả (không âm) và đơn vị.");
    if (!Number.isInteger(c.giu_ms) || c.giu_ms < 1000 || c.giu_ms > 15_000)
      loi.push("Thời gian giữ máy đo phải từ 1 đến 15 giây.");
  }
  if (p.phan_ung?.includes("tu_choi_thoi") && !c)
    loi.push("Người lái không chịu thổi thì tình huống phải có máy đo.");
  if (!d || typeof d !== "object") return [...loi, "Thiếu đáp án."];
  if (!coTrong(HUONG_XU_LY, d.huong_xu_ly)) loi.push("Hướng xử lý không hợp lệ.");
  if (typeof d.ly_do_xu_ly !== "string" || d.ly_do_xu_ly.trim().length < 10)
    loi.push("Thiếu lý do của hướng xử lý.");
  if (
    !Array.isArray(d.vi_tri_an_toan) ||
    (viTri && d.vi_tri_an_toan.some((m) => !viTri.some((v) => v.ma === m)))
  )
    loi.push("Vị trí an toàn phải là mã có trong danh sách vị trí.");
  else if (viTri?.length && !d.vi_tri_an_toan.length) loi.push("Phải có ít nhất một vị trí an toàn.");
  else if (viTri?.length && d.vi_tri_an_toan.length === viTri.length)
    loi.push("Phải có ít nhất một vị trí nguy hiểm để chọn nhầm.");
  if (!Array.isArray(d.loi_giay_to) || d.loi_giay_to.some((l) => !coTrong(MA_LOI_GIAY_TO, l)))
    loi.push("Lỗi giấy tờ dự kiến có mã không hợp lệ.");
  if (!Array.isArray(d.vi_pham_khac) || d.vi_pham_khac.some((v) => !v?.hanh_vi || !v.chi_tiet))
    loi.push("Vi phạm khác cần hành vi và chi tiết.");
  const coViPham = (d.loi_giay_to?.length ?? 0) + (d.vi_pham_khac?.length ?? 0) > 0;
  if (coTrong(HUONG_XU_LY, d.huong_xu_ly) && coViPham === (d.huong_xu_ly === "cho_di"))
    loi.push(
      coViPham ? "Có vi phạm thì không thể cho đi." : "Không có vi phạm thì hướng xử lý phải là cho đi.",
    );
  return loi;
}

/** Bước chuẩn áp dụng cho tình huống, theo thứ tự quy trình. */
export function buocApDung(
  buoc: readonly BuocChuan[],
  t: Pick<PayloadDungXe, "vi_tri" | "phan_ung" | "do_con">,
): BuocChuan[] {
  const dat = (dk: DieuKienBuoc | null) =>
    dk === null ||
    (dk === "co_vi_tri" && t.vi_tri.length >= 2) ||
    (dk === "co_do_con" && t.do_con !== null) ||
    ((dk === "xin_bo_qua" || dk === "tu_choi_thoi") && t.phan_ung.includes(dk));
  return buoc.filter((b) => dat(b.dieu_kien));
}

export function buocChuanTuQuyTrinh(ds: readonly BuocQuyTrinh[]): BuocChuan[] {
  return ds
    .filter((b) => b.tro_choi && coTrong(KIEU_BUOC_DUNG_XE, b.tro_choi.ma))
    .map((b) => ({
      kieu: b.tro_choi!.ma as KieuBuocDungXe,
      tieu_de: b.tieu_de,
      mo_ta: b.mo_ta,
      can_cu: b.can_cu ?? null,
      bat_buoc: b.tro_choi!.bat_buoc,
      dieu_kien: (b.tro_choi!.dieu_kien ?? null) as DieuKienBuoc | null,
      nguon: b.tro_choi!.nguon,
    }));
}

const cungTap = (a: readonly string[], b: readonly string[]) => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Tình huống dùng được: dữ liệu hợp lệ, quy trình dùng được, đủ luật giấy tờ đã duyệt, và luật đã
 * duyệt cho đúng các lỗi giấy tờ người soạn dự kiến.
 */
export function dungDuocTinhHuong(n: NguonDungXe): boolean {
  if (kiemTraTinhHuongDungXe(n.tinh_huong, n.dap_an).length) return false;
  if (kiemTraQuyTrinhDungXe(n.quy_trinh).length) return false;
  const tatCa = new Set(MA_LOI_GIAY_TO);
  if (luatConThieu(n.tinh_huong.ho_so, n.luat, tatCa).length) return false;
  return cungTap(
    kiemTraHoSo(n.tinh_huong.ho_so, n.luat).map((l) => l.ma_loi),
    n.dap_an.loi_giay_to,
  );
}

/* ------------------------------------------------------------------ */
/* Máy trạng thái của tình huống                                       */
/* ------------------------------------------------------------------ */

export type MucSuKien = "tot" | "xau" | "nhac";

export interface SuKienDienBien {
  ms: number;
  muc: MucSuKien;
  noi_dung: string;
}

export interface TrangThaiDungXe {
  xe_dung: boolean;
  so_hieu_lenh: number;
  vi_tri: string | null;
  da_thong_bao: boolean;
  giay_to_da_giao: boolean;
  /** Giấy tờ người chơi đã kéo vào khay (giấy không xuất trình cũng có thẻ "không có"). */
  xep_giay_to: Partial<Record<LoaiGiayTo, "dat" | "khong_dat">>;
  xin_bo_qua: "chua" | "dang_xin" | "da_tu_choi";
  tu_choi_thoi: "chua" | "dang_tu_choi" | "da_chap_hanh";
  lan_tha_som: number;
  ket_qua_do: number | null;
  huong_xu_ly: HuongXuLy | null;
  ket_thuc: boolean;
  /** 0–3: người lái bức xúc dần khi thao tác sai. Chỉ để kể diễn biến, không vào điểm. */
  cang_thang: number;
  /** Thứ tự các bước đã hoàn thành (lần đầu), kèm số thứ tự thao tác làm xong. */
  hoan_thanh: Array<{ kieu: KieuBuocDungXe; ms: number; thao_tac: number }>;
  /** Loại bước người chơi làm khi xe chưa dừng (bị bỏ qua, tính sai thứ tự). */
  lam_khi_xe_chua_dung: KieuBuocDungXe[];
  khong_an_toan: Array<{ ms: number; noi_dung: string }>;
  qua_gio: number;
  bo_qua: number;
  su_kien: SuKienDienBien[];
}

/** Loại bước ứng với lời thoại chạm được. */
const KIEU_LOI_THOAI = new Set<KieuBuocDungXe>([
  "thong_bao_ly_do",
  "yeu_cau_xuat_trinh",
  "tu_choi_de_nghi",
  "yeu_cau_chap_hanh_do",
]);

/** Các giấy tờ có thẻ trên khay: luôn đủ ba loại (giấy không xuất trình là thẻ "không có"). */
export const GIAY_TO_KIEM: readonly LoaiGiayTo[] = LOAI_GIAY_TO;

/**
 * Chạy lại nhật ký trên tình huống. `an` là phần chỉ máy chủ biết (vị trí nào an toàn); vắng thì mọi
 * vị trí coi như chưa rõ (điện thoại). Thao tác không hợp lệ ở thời điểm đó bị bỏ qua, có ghi diễn biến.
 */
export function dienBien(
  c: CanhCongKhai,
  nhatKy: readonly ThaoTacDungXe[],
  an?: { vi_tri_an_toan: readonly string[] },
): TrangThaiDungXe {
  const s: TrangThaiDungXe = {
    xe_dung: false,
    so_hieu_lenh: 0,
    vi_tri: null,
    da_thong_bao: false,
    giay_to_da_giao: false,
    xep_giay_to: {},
    xin_bo_qua: "chua",
    tu_choi_thoi: "chua",
    lan_tha_som: 0,
    ket_qua_do: null,
    huong_xu_ly: null,
    ket_thuc: false,
    cang_thang: 0,
    hoan_thanh: [],
    lam_khi_xe_chua_dung: [],
    khong_an_toan: [],
    qua_gio: 0,
    bo_qua: 0,
    su_kien: [],
  };
  const coViTri = c.vi_tri.length >= 2;
  const daXong = (k: KieuBuocDungXe) => s.hoan_thanh.some((h) => h.kieu === k);
  let nguyHiemGiuaLan = false;
  let truocMs = 0;

  const ke = (ms: number, muc: MucSuKien, noi_dung: string) => s.su_kien.push({ ms, muc, noi_dung });
  const bucXuc = (ms: number, noi_dung: string) => {
    s.cang_thang = Math.min(3, s.cang_thang + 1);
    ke(ms, "xau", noi_dung);
    if (s.cang_thang === 3)
      ke(ms, "xau", "Người lái to tiếng, người đi đường dừng lại xem. Tình huống căng thẳng.");
  };
  const xong = (k: KieuBuocDungXe, ms: number, i: number) => {
    if (!daXong(k)) s.hoan_thanh.push({ kieu: k, ms, thao_tac: i });
  };
  /** Chạm người lái khi xe chưa dừng: người lái không nghe, thao tác không có tác dụng. */
  const canXeDung = (k: KieuBuocDungXe, ms: number): boolean => {
    if (s.xe_dung) return true;
    if (!s.lam_khi_xe_chua_dung.includes(k)) s.lam_khi_xe_chua_dung.push(k);
    ke(ms, "xau", "Xe vẫn đang chạy: người lái không nghe thấy, thao tác không có tác dụng.");
    return false;
  };
  /** Tiếp xúc khi xe đỗ giữa làn (màn có chọn vị trí mà chưa hướng dẫn xe vào chỗ). */
  const kiemGiuaLan = (ms: number) => {
    if (coViTri && s.vi_tri === null && !nguyHiemGiuaLan) {
      nguyHiemGiuaLan = true;
      const nd = "Xe còn đỗ giữa làn đường khi bạn tiếp xúc: xe phía sau phải lách qua, suýt va chạm.";
      s.khong_an_toan.push({ ms, noi_dung: nd });
      ke(ms, "xau", nd);
    }
  };
  /** Người lái đang xin bỏ qua mà người chơi làm việc khác: người lái tiếp tục nài nỉ. */
  const naiNi = (ms: number) => {
    if (s.xin_bo_qua === "dang_xin")
      bucXuc(ms, "Người lái vẫn nài nỉ xin bỏ qua, chưa được trả lời dứt khoát.");
  };

  nhatKy.forEach((t, i) => {
    if (s.ket_thuc) {
      s.bo_qua++;
      return;
    }
    if (c.gioi_han_thao_tac_ms && t.ms - truocMs > c.gioi_han_thao_tac_ms) {
      s.qua_gio++;
      ke(t.ms, "xau", "Chần chừ quá lâu giữa hai thao tác: người lái sốt ruột, xe phía sau ùn lại.");
    }
    truocMs = t.ms;

    if (t.loai === "vuot") {
      if (t.huong !== HUONG_HIEU_LENH) {
        ke(t.ms, "nhac", "Vuốt lên để giơ tay ra hiệu lệnh dừng xe.");
        return;
      }
      if (s.xe_dung) {
        ke(t.ms, "nhac", "Xe đã dừng, không cần ra hiệu lệnh nữa.");
        return;
      }
      s.so_hieu_lenh++;
      if (s.so_hieu_lenh === 1 && c.phan_ung.includes("khong_dung_lan_dau")) {
        ke(t.ms, "xau", "Người lái giả như không thấy hiệu lệnh, xe vẫn chạy tới.");
        return;
      }
      s.xe_dung = true;
      ke(
        t.ms,
        "tot",
        coViTri ? "Xe giảm tốc và dừng lại, đang đỗ ngay trên làn đường." : "Xe giảm tốc, dừng sát lề đường.",
      );
      xong("hieu_lenh_dung", t.ms, i);
      return;
    }

    if (t.loai === "cham" && t.muc_tieu.startsWith("vi_tri:")) {
      const ma = t.muc_tieu.slice(7);
      const v = c.vi_tri.find((x) => x.ma === ma);
      if (!v || !coViTri) {
        s.bo_qua++;
        return;
      }
      if (!canXeDung("vi_tri_dung", t.ms)) return;
      if (s.vi_tri === ma) return;
      s.vi_tri = ma;
      if (an && !an.vi_tri_an_toan.includes(ma)) {
        const nd = `Xe dừng ở "${v.ten}": ${v.mo_ta} Vị trí này nguy hiểm cho người và xe.`;
        s.khong_an_toan.push({ ms: t.ms, noi_dung: nd });
        ke(t.ms, "xau", nd);
        return;
      }
      ke(t.ms, "tot", `Xe vào "${v.ten}".`);
      xong("vi_tri_dung", t.ms, i);
      return;
    }

    if (t.loai === "cham" && t.muc_tieu.startsWith("loi:")) {
      const k = t.muc_tieu.slice(4) as KieuBuocDungXe;
      if (!KIEU_LOI_THOAI.has(k)) {
        s.bo_qua++;
        return;
      }
      if (!canXeDung(k, t.ms)) return;
      if (k === "thong_bao_ly_do") {
        if (s.da_thong_bao) return;
        kiemGiuaLan(t.ms);
        naiNi(t.ms);
        s.da_thong_bao = true;
        ke(t.ms, "tot", "Người lái nghe rõ lý do dừng xe.");
        xong(k, t.ms, i);
        if (!s.giay_to_da_giao && daXong("yeu_cau_xuat_trinh")) {
          s.giay_to_da_giao = true;
          ke(t.ms, "tot", "Biết lý do rồi, người lái đưa giấy tờ.");
          if (c.phan_ung.includes("xin_bo_qua")) {
            s.xin_bo_qua = "dang_xin";
            ke(t.ms, "xau", 'Người lái nói nhỏ: "Anh bỏ qua cho em lần này được không…"');
          }
        }
        return;
      }
      if (k === "yeu_cau_xuat_trinh") {
        if (s.giay_to_da_giao) return;
        kiemGiuaLan(t.ms);
        naiNi(t.ms);
        xong(k, t.ms, i);
        if (!s.da_thong_bao) {
          if (c.phan_ung.includes("doi_biet_ly_do")) {
            bucXuc(t.ms, 'Người lái không đưa giấy tờ: "Tôi sai gì mà phải đưa? Anh nói lý do đã."');
            return;
          }
          bucXuc(t.ms, "Người lái đưa giấy tờ nhưng khó chịu vì chưa được biết lý do dừng xe.");
        } else ke(t.ms, "tot", "Người lái đưa giấy tờ.");
        s.giay_to_da_giao = true;
        if (c.phan_ung.includes("xin_bo_qua")) {
          s.xin_bo_qua = "dang_xin";
          ke(t.ms, "xau", 'Người lái nói nhỏ: "Anh bỏ qua cho em lần này được không…"');
        }
        return;
      }
      if (k === "tu_choi_de_nghi") {
        if (s.xin_bo_qua !== "dang_xin") {
          s.bo_qua++;
          return;
        }
        s.xin_bo_qua = "da_tu_choi";
        ke(t.ms, "tot", "Người lái thôi nài nỉ, chấp hành tiếp.");
        xong(k, t.ms, i);
        return;
      }
      // yeu_cau_chap_hanh_do
      if (s.tu_choi_thoi !== "dang_tu_choi") {
        s.bo_qua++;
        return;
      }
      naiNi(t.ms);
      s.tu_choi_thoi = "da_chap_hanh";
      ke(t.ms, "tot", "Người lái đồng ý thổi vào máy đo.");
      xong(k, t.ms, i);
      return;
    }

    if (t.loai === "keo" && t.muc_tieu.startsWith("giay_to:")) {
      const g = t.muc_tieu.slice(8) as LoaiGiayTo;
      if (!coTrong(LOAI_GIAY_TO, g) || (t.dich !== "dat" && t.dich !== "khong_dat")) {
        s.bo_qua++;
        return;
      }
      if (!canXeDung("kiem_giay_to", t.ms)) return;
      if (!s.giay_to_da_giao) {
        ke(t.ms, "nhac", "Người lái chưa đưa giấy tờ.");
        return;
      }
      naiNi(t.ms);
      s.xep_giay_to[g] = t.dich;
      if (GIAY_TO_KIEM.every((x) => s.xep_giay_to[x])) xong("kiem_giay_to", t.ms, i);
      return;
    }

    if (t.loai === "giu") {
      if (!c.do_con) {
        s.bo_qua++;
        return;
      }
      if (!canXeDung("do_nong_do_con", t.ms)) return;
      if (s.ket_qua_do !== null) {
        ke(t.ms, "nhac", "Đã có kết quả đo.");
        return;
      }
      kiemGiuaLan(t.ms);
      naiNi(t.ms);
      if (c.phan_ung.includes("tu_choi_thoi") && s.tu_choi_thoi !== "da_chap_hanh") {
        if (s.tu_choi_thoi === "chua") s.tu_choi_thoi = "dang_tu_choi";
        bucXuc(t.ms, 'Người lái quay mặt đi: "Tôi không thổi." Máy không đo được.');
        return;
      }
      if (t.ms - t.tu_ms < c.do_con.giu_ms) {
        s.lan_tha_som++;
        ke(t.ms, s.lan_tha_som > 1 ? "xau" : "nhac", "Thả tay sớm: máy chưa đo xong, phải đo lại.");
        return;
      }
      s.ket_qua_do = c.do_con.ket_qua;
      ke(t.ms, "tot", `Máy đo báo ${c.do_con.ket_qua.toLocaleString("vi-VN")} ${c.do_con.don_vi}.`);
      xong("do_nong_do_con", t.ms, i);
      return;
    }

    if (t.loai === "keo" && t.muc_tieu === "ket_qua") {
      if (!coTrong(HUONG_XU_LY, t.dich)) {
        s.bo_qua++;
        return;
      }
      if (!canXeDung("xu_ly", t.ms)) return;
      s.huong_xu_ly = t.dich;
      s.ket_thuc = true;
      ke(t.ms, "nhac", `Bạn quyết định: ${TEN_HUONG_XU_LY[t.dich]}.`);
      // Kết luận khi còn bỏ bước: nói rõ hậu quả ngay trên diễn biến.
      if (!daXong("kiem_giay_to"))
        ke(t.ms, "xau", "Kết luận khi chưa kiểm giấy tờ: nếu giấy tờ có vấn đề, vi phạm bị bỏ lọt.");
      if (c.do_con && !daXong("do_nong_do_con"))
        ke(
          t.ms,
          "xau",
          "Kết luận khi chưa đo nồng độ cồn: người lái có thể đang có cồn mà vẫn lái xe đi tiếp.",
        );
      if (s.xin_bo_qua === "dang_xin")
        ke(t.ms, "xau", "Kết luận khi chưa trả lời dứt khoát lời xin bỏ qua: dễ bị hiểu là có thỏa thuận.");
      xong("xu_ly", t.ms, i);
      return;
    }

    s.bo_qua++;
  });
  return s;
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

export type KetBuocChuan = "dung" | "sai_thu_tu" | "thieu" | "chua_dung" | "khong_ap_dung";

export interface SoSanhBuoc {
  thu_tu: number;
  kieu: KieuBuocDungXe;
  tieu_de: string;
  mo_ta: string;
  can_cu: string | null;
  nguon: string;
  bat_buoc: boolean;
  /** Thứ tự người chơi hoàn thành bước này (1, 2…); null là không làm. */
  thu_tu_nguoi_choi: number | null;
  ket: KetBuocChuan;
  diem: number;
  ghi_chu: string;
}

export interface ChiTietDungXe {
  hop_le: boolean;
  ly_do: string | null;
  so_sanh: SoSanhBuoc[];
  su_kien: SuKienDienBien[];
  tru: Array<{ ly_do: string; diem: number }>;
  giay_to: Array<{
    loai: LoaiGiayTo;
    ten: string;
    nguoi_choi: "dat" | "khong_dat" | null;
    dung: "dat" | "khong_dat";
  }>;
  loi_giay_to: Array<{ ten: string; mo_ta: string; giai_thich: string; can_cu: string }>;
  huong_xu_ly: HuongXuLy | null;
  huong_xu_ly_dung: HuongXuLy;
  ly_do_xu_ly: string;
  ket_qua_do: number | null;
  bien_ban: DongBienBan[];
  cang_thang: number;
}

/** Kiểm mốc thời gian (GAME_DESIGN §1.2). Trả lý do không hợp lệ, hoặc null. */
export function kiemMocThoiGian(tl: TraLoiDungXe, thoiGianMs: number | null): string | null {
  let truoc = 0;
  for (const t of tl.nhat_ky) {
    if (t.ms < truoc) return "Nhật ký có mốc không theo thứ tự thời gian.";
    if (t.loai === "giu" && (t.tu_ms > t.ms || t.tu_ms < truoc))
      return "Nhật ký có lần giữ nút chồng lên thao tác khác.";
    truoc = t.ms;
  }
  if (truoc > tl.tong_ms) return "Nhật ký có mốc sau lúc kết thúc.";
  if (thoiGianMs !== null && tl.tong_ms > thoiGianMs * (1 + LECH_GIO_TOI_DA) + DUNG_SAI_BUOC_MS)
    return "Nhật ký không khớp đồng hồ máy chủ.";
  return null;
}

export function canhCongKhai(b: BuocDungXe): CanhCongKhai {
  const g = b.tinh_huong.ho_so.giay_to;
  return {
    vi_tri: b.tinh_huong.vi_tri,
    phan_ung: b.tinh_huong.phan_ung,
    do_con: b.tinh_huong.do_con,
    giay_to_co: { gplx: !!g.gplx, dang_ky: !!g.dang_ky, bao_hiem: !!g.bao_hiem },
    gioi_han_thao_tac_ms: GIOI_HAN_THAO_TAC_THEO_MAN[b.man] ?? null,
  };
}

const lamTron = (n: number) => Math.round(n * 10) / 10;

/** Chấm một tình huống từ nhật ký. `thoiGianMs`: đồng hồ máy chủ (null khi offline). */
export function chamDungXe(
  b: BuocDungXe,
  tl: TraLoiDungXe,
  thoiGianMs: number | null,
): { diem: number; diemToiDa: number; chiTiet: ChiTietDungXe } {
  const apDung = buocApDung(b.quy_trinh.buoc, b.tinh_huong);
  const diemToiDa = apDung.filter((x) => x.bat_buoc).length * DIEM_MOI_BUOC;
  const lyDo = kiemMocThoiGian(tl, thoiGianMs);
  const s = dienBien(canhCongKhai(b), lyDo ? [] : tl.nhat_ky, { vi_tri_an_toan: b.vi_tri_an_toan });

  const hoanThanh = new Map(s.hoan_thanh.map((h, i) => [h.kieu, { ...h, thu_tu: i + 1 }]));
  // Bước phản ứng (xin bỏ qua, không chịu thổi) không có chỗ cố định trong thứ tự: làm lúc phản ứng xảy ra.
  const phanUng = (k: BuocChuan) => k.dieu_kien === "xin_bo_qua" || k.dieu_kien === "tu_choi_thoi";
  const coDinh = apDung.filter((x) => !phanUng(x));
  const soSanh: SoSanhBuoc[] = apDung.map((x, i) => {
    const h = hoanThanh.get(x.kieu);
    const goc = {
      thu_tu: i + 1,
      kieu: x.kieu,
      tieu_de: x.tieu_de,
      mo_ta: x.mo_ta,
      can_cu: x.can_cu,
      nguon: x.nguon,
      bat_buoc: x.bat_buoc,
      thu_tu_nguoi_choi: h?.thu_tu ?? null,
    };
    if (!h) {
      return {
        ...goc,
        ket: x.bat_buoc ? "thieu" : "khong_ap_dung",
        diem: 0,
        ghi_chu: x.bat_buoc ? "Bạn đã bỏ bước này." : "Bước không bắt buộc, bạn không làm.",
      };
    }
    // Sai thứ tự: làm khi xe chưa dừng, hoặc lúc hoàn thành còn bước bắt buộc đứng trước chưa làm.
    const viTri = coDinh.indexOf(x);
    const truocChuaLam =
      viTri > 0 &&
      // Bước đứng trước bị bỏ hẳn thì đã tính "thiếu", không tính thêm sai thứ tự cho bước sau.
      coDinh.slice(0, viTri).some((y) => y.bat_buoc && (hoanThanh.get(y.kieu)?.thao_tac ?? -1) > h.thao_tac);
    const saiThuTu =
      s.lam_khi_xe_chua_dung.includes(x.kieu) || (!phanUng(x) && x.kieu !== "xu_ly" && truocChuaLam);
    let diem = x.bat_buoc ? DIEM_MOI_BUOC : 0;
    let ket: KetBuocChuan = "dung";
    let ghi_chu = "Đúng.";
    if (x.kieu === "kiem_giay_to") {
      const dung = GIAY_TO_KIEM.filter((g) => s.xep_giay_to[g] === b.giay_to_dung[g]).length;
      diem = lamTron((diem * dung) / GIAY_TO_KIEM.length);
      if (dung < GIAY_TO_KIEM.length) {
        ket = "chua_dung";
        ghi_chu = `Xếp đúng ${dung}/${GIAY_TO_KIEM.length} giấy tờ.`;
      }
    }
    if (x.kieu === "xu_ly" && s.huong_xu_ly !== b.huong_xu_ly) {
      diem = 0;
      ket = "chua_dung";
      ghi_chu = `Bạn chọn "${TEN_HUONG_XU_LY[s.huong_xu_ly!]}", đúng ra là "${TEN_HUONG_XU_LY[b.huong_xu_ly]}".`;
    }
    if (saiThuTu && diem > 0) {
      diem = Math.max(0, diem - TRU_SAI_THU_TU);
      if (ket === "dung") ket = "sai_thu_tu";
      ghi_chu = `${ket === "sai_thu_tu" ? "Làm" : `${ghi_chu} Làm`} sai thứ tự${
        s.lam_khi_xe_chua_dung.includes(x.kieu) ? " (có lúc làm khi xe chưa dừng)" : ""
      }: −${TRU_SAI_THU_TU} điểm.`;
    }
    return { ...goc, ket, diem, ghi_chu };
  });

  const tru: ChiTietDungXe["tru"] = [];
  for (const k of s.khong_an_toan) tru.push({ ly_do: k.noi_dung, diem: TRU_KHONG_AN_TOAN });
  if (s.lan_tha_som > 1)
    tru.push({
      ly_do: `Thả tay sớm khi đo nồng độ cồn ${s.lan_tha_som} lần (lần đầu không trừ).`,
      diem: (s.lan_tha_som - 1) * TRU_THA_SOM,
    });
  if (s.qua_gio) tru.push({ ly_do: `${s.qua_gio} thao tác quá giờ.`, diem: s.qua_gio * TRU_QUA_GIO });

  const cong = soSanh.reduce((a, x) => a + x.diem, 0);
  const diem = lyDo ? 0 : Math.max(0, lamTron(cong - tru.reduce((a, x) => a + x.diem, 0)));
  const ten = TEN_GIAY_TO;
  return {
    diem,
    diemToiDa,
    chiTiet: {
      hop_le: !lyDo,
      ly_do: lyDo,
      so_sanh: soSanh,
      su_kien: s.su_kien,
      tru: lyDo ? [] : tru,
      giay_to: GIAY_TO_KIEM.map((g) => ({
        loai: g,
        ten: ten[g],
        nguoi_choi: s.xep_giay_to[g] ?? null,
        dung: b.giay_to_dung[g],
      })),
      loi_giay_to: b.loi_giay_to.map((l) => ({
        ten: TEN_LOI_GIAY_TO[l.ma_loi],
        mo_ta: l.mo_ta,
        giai_thich: l.giai_thich,
        can_cu: l.can_cu,
      })),
      huong_xu_ly: s.huong_xu_ly,
      huong_xu_ly_dung: b.huong_xu_ly,
      ly_do_xu_ly: b.ly_do_xu_ly,
      ket_qua_do: s.ket_qua_do,
      bien_ban: b.bien_ban,
      cang_thang: s.cang_thang,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

function dungBuoc(n: NguonDungXe, man: number): BuocLuot<BuocDungXe> {
  const t = n.tinh_huong;
  const loi = kiemTraHoSo(t.ho_so, n.luat);
  const theoMa = new Map(n.luat.map((l) => [l.ma, l]));
  const giay_to_dung = Object.fromEntries(
    LOAI_GIAY_TO.map((g) => [g, loi.some((l) => GIAY_TO_CUA_LOI[l.ma_loi] === g) ? "khong_dat" : "dat"]),
  ) as BuocDungXe["giay_to_dung"];
  const buoc = buocChuanTuQuyTrinh(n.quy_trinh.cac_buoc);
  const apDung = buocApDung(buoc, t);
  return {
    thu_tu: 1,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: apDung.filter((x) => x.bat_buoc).length * DIEM_MOI_BUOC,
    noi_dung: {
      man,
      tinh_huong: t,
      quy_trinh: { ma: n.quy_trinh.ma, version: n.quy_trinh.version, buoc },
      vi_tri_an_toan: n.dap_an.vi_tri_an_toan,
      giay_to_dung,
      loi_giay_to: loi.map((l) => ({
        ma_loi: l.ma_loi,
        mo_ta: l.mo_ta,
        giai_thich: theoMa.get(l.luat_ma)?.giai_thich ?? "",
        can_cu: theoMa.get(l.luat_ma)?.can_cu ?? "",
      })),
      huong_xu_ly: n.dap_an.huong_xu_ly,
      ly_do_xu_ly: n.dap_an.ly_do_xu_ly,
      bien_ban: [
        ...loi.map((l) => {
          const lu = theoMa.get(l.luat_ma)!;
          return dongBienBan({
            hanhVi: TEN_LOI_GIAY_TO[l.ma_loi],
            chiTiet: l.mo_ta,
            canCu: [lu.can_cu],
            maMucPhat: lu.ma_muc_phat,
            mucPhat: n.muc_phat,
          });
        }),
        ...n.dap_an.vi_pham_khac.map((v) =>
          dongBienBan({
            hanhVi: v.hanh_vi,
            chiTiet: v.chi_tiet,
            canCu: [],
            maMucPhat: v.ma_muc_phat,
            mucPhat: n.muc_phat,
          }),
        ),
      ],
    },
  };
}

function docThaoTac(raw: unknown): ThaoTacDungXe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ms = r.ms;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0 || ms > TONG_MS_TOI_DA) return null;
  const chuoi = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 60;
  switch (r.loai) {
    case "vuot":
      return coTrong(HUONG_VUOT, r.huong) ? { ms, loai: "vuot", huong: r.huong } : null;
    case "cham":
      return chuoi(r.muc_tieu) ? { ms, loai: "cham", muc_tieu: r.muc_tieu as string } : null;
    case "keo":
      return chuoi(r.muc_tieu) && chuoi(r.dich)
        ? { ms, loai: "keo", muc_tieu: r.muc_tieu as string, dich: r.dich as string }
        : null;
    case "giu": {
      const tu = r.tu_ms;
      return r.muc_tieu === "may_do" && typeof tu === "number" && Number.isFinite(tu) && tu >= 0
        ? { ms, loai: "giu", muc_tieu: "may_do", tu_ms: tu }
        : null;
    }
  }
  return null;
}

export const TRO_CHOI_DUNG_XE: DinhNghiaTroChoi<BuocDungXe, DeDungXe, TraLoiDungXe> = {
  ma: MA_DUNG_XE,
  ten: "Dừng xe đúng quy trình",
  moTa: "Vuốt ra hiệu lệnh, chạm lời thoại, kéo giấy tờ, giữ máy đo, kéo kết quả vào hướng xử lý, đúng thứ tự quy trình.",
  offline: true,
  nguon: "dung_xe_tinh_huong",
  soBuoc: 1,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_DUNG_XE,

  locNguon(nguon) {
    return (nguon as NguonDungXe[]).filter(
      (n) => n?.tinh_huong && n.dap_an && n.quy_trinh && dungDuocTinhHuong(n),
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn, seed và màn.
    const dung = tron(
      (this.locNguon(nguon) as NguonDungXe[])
        .filter((n) => n.tinh_huong.muc <= m)
        .sort((a, b) => a.id.localeCompare(b.id)),
      rng,
    );
    const chon = dung.find((n) => n.tinh_huong.muc === m) ?? dung[0];
    return chon ? [dungBuoc(chon, m)] : [];
  },

  deChoNguoiChoi(buoc) {
    const b = buoc.noi_dung;
    const t = b.tinh_huong;
    const c = canhCongKhai(b);
    return {
      ...c,
      man: b.man,
      mo_ta: t.mo_ta,
      ly_do_dung: t.ly_do_dung,
      loi_noi: t.ho_so.nguoi_lai.loi_noi,
      xe: { ...t.ho_so.xe, ten_phan_loai: TEN_PHAN_LOAI_XE[t.ho_so.xe.phan_loai as PhanLoaiXe] },
      ngay_kiem_tra: t.ho_so.ngay_kiem_tra,
      giay_to: t.ho_so.giay_to,
      goi_y_thu_tu: b.man === 1 ? buocApDung(b.quy_trinh.buoc, t).map((x) => x.kieu) : null,
      loi_thoai: KIEU_BUOC_DUNG_XE.filter((k) => LOI_THOAI[k]).map((k) => ({ kieu: k, loi: LOI_THOAI[k]! })),
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const tong = r.tong_ms;
    if (typeof tong !== "number" || !Number.isFinite(tong) || tong < 0 || tong > TONG_MS_TOI_DA) return null;
    if (!Array.isArray(r.nhat_ky) || r.nhat_ky.length > THAO_TAC_TOI_DA) return null;
    // Thao tác sai dạng bị bỏ, không làm hỏng cả nhật ký.
    const nhat_ky = r.nhat_ky.map(docThaoTac).filter((t): t is ThaoTacDungXe => t !== null);
    return { nhat_ky, tong_ms: tong };
  },

  chamBuoc(buoc, tl, ngCanh): KetQuaChamBuoc {
    const b = buoc.noi_dung;
    const kq = chamDungXe(b, tl, ngCanh?.thoiGianMs ?? null);
    const ct = kq.chiTiet;
    const thieu = ct.so_sanh.filter((x) => x.ket === "thieu").length;
    const giaiThich = !ct.hop_le
      ? `Không chấm được: ${ct.ly_do}`
      : `Làm đúng ${ct.so_sanh.filter((x) => x.ket === "dung").length}/${ct.so_sanh.length} bước${
          thieu ? `, bỏ ${thieu} bước` : ""
        }. Hướng xử lý đúng: ${TEN_HUONG_XU_LY[b.huong_xu_ly]}.`;
    return {
      diem: kq.diem,
      diemToiDa: buoc.diem_toi_da,
      dung: ct.hop_le && kq.diem >= buoc.diem_toi_da,
      chiTiet: ct,
      giaiThich,
      canCu: [
        ...new Set([
          ...ct.so_sanh.map((x) => x.can_cu).filter((x): x is string => Boolean(x)),
          ...ct.loi_giay_to.map((l) => l.can_cu).filter(Boolean),
        ]),
      ],
    };
  },
};
