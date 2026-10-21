/**
 * Trò "Duyệt hồ sơ phạt nguội" (docs/PLAN.md GĐ-T11, docs/GAME_DESIGN.md §5.11).
 *
 * Người chơi là cán bộ xử lý hình ảnh vi phạm do camera ghi lại. Mỗi hồ sơ là một bước: ảnh vi phạm
 * dựng từ tham số, dải thông tin (thời điểm, vị trí, thiết bị và hạn kiểm định, hành vi hệ thống đề
 * xuất), ảnh phóng to biển số. Vuốt trái (hoặc nút "Gửi thông báo"): đủ căn cứ. Vuốt phải (hoặc nút
 * "Trả lại"): chạm trước vào các chỗ thiếu trên thẻ. Trả lại mà không chỉ chỗ nào thì không nhận.
 *
 * Chấm (câu D15: điểm bước không âm, "gửi nhầm nặng hơn trả nhầm" làm bằng điểm tối đa không đều):
 *   - hồ sơ đủ căn cứ: gửi 10/10, trả lại 0/10;
 *   - hồ sơ thiếu n chỗ (n = 1 hoặc 2): trả lại 10 + 5 cho mỗi chỗ thiếu chỉ đúng, trừ 2 cho mỗi chỗ
 *     chạm nhầm (phần chỉ chỗ thiếu không âm); gửi 0/(10 + 5n).
 *
 * Hồ sơ (game_content) chỉ có dữ kiện và danh sách chỗ thiếu người soạn dự kiến. Đáp án suy ra từ luật
 * kiểm hồ sơ ĐÃ DUYỆT (`document_rules`, nhóm `ho_so_phat_nguoi`, câu D16) bằng bộ chạy luật ở tệp này.
 * Hồ sơ mà luật đã duyệt cho kết quả khác dự kiến, hoặc còn thiếu luật của màn, thì không vào lượt.
 *
 * Đề gửi người chơi không có trường nào cho biết hồ sơ đủ hay thiếu: không gửi độ rõ biển số (ký tự
 * không đọc được thay bằng dấu mờ ngay ở máy chủ), không gửi chỗ thiếu, luật, mã mức phạt. Tham số ảnh
 * (đèn, vạch, làn, mũ bảo hiểm, độ mờ, che khuất) là chính bức ảnh nên phải gửi. Hàm thuần.
 */

import { tron } from "../de-thi.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import {
  CHO_THIEU_PHAT_NGUOI,
  type ChoThieuPhatNguoi,
  choThieuCuaLuat,
  type LuatHoSoPhatNguoi,
  ngayVn,
} from "./chung/giay-to.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import type { BuocLuot, DinhNghiaTroChoi } from "./khung.ts";

export const MA_DUYET_PHAT_NGUOI = "duyet_phat_nguoi";
export const DIEM_QUYET_DINH_PN = 10;
export const DIEM_MOI_CHO_THIEU = 5;
export const TRU_CHAM_NHAM_PN = 2;
export const CHO_THIEU_TOI_DA = 2;
/** Ký tự thay cho ký tự biển số không đọc được trong đề gửi người chơi. */
export const KY_TU_MO = "*";

/* ------------------------------------------------------------------ */
/* Từ vựng                                                             */
/* ------------------------------------------------------------------ */

export const HANH_VI_PHAT_NGUOI = [
  "vuot_den_do",
  "qua_toc_do",
  "sai_lan",
  "khong_mu_bao_hiem",
  "vao_duong_cam",
] as const;
export type HanhViPhatNguoi = (typeof HANH_VI_PHAT_NGUOI)[number];

/** Tên gọi trong trò; hành vi pháp lý đầy đủ lấy từ dòng mức phạt đã duyệt. */
export const TEN_HANH_VI_PHAT_NGUOI: Record<HanhViPhatNguoi, string> = {
  vuot_den_do: "Không chấp hành hiệu lệnh của đèn tín hiệu (vượt đèn đỏ)",
  qua_toc_do: "Chạy quá tốc độ quy định",
  sai_lan: "Đi không đúng làn đường quy định",
  khong_mu_bao_hiem: "Không đội mũ bảo hiểm khi đi mô tô, xe máy",
  vao_duong_cam: "Đi vào đường có biển cấm trong khung giờ cấm",
};

export const LOAI_THIET_BI = ["den_tin_hieu", "toc_do", "giam_sat"] as const;
export type LoaiThietBi = (typeof LOAI_THIET_BI)[number];
export const TEN_LOAI_THIET_BI: Record<LoaiThietBi, string> = {
  den_tin_hieu: "Camera giám sát đèn tín hiệu",
  toc_do: "Thiết bị đo tốc độ có ghi hình",
  giam_sat: "Camera giám sát giao thông",
};

/** Cảnh của ảnh vi phạm. */
export const CANH_ANH = ["giao_lo", "duong_lan", "duong_thang", "loi_vao_cam"] as const;
export type CanhAnh = (typeof CANH_ANH)[number];
export const CHE_ANH = ["khong", "xe_khac", "chong_xe"] as const;
export type CheAnh = (typeof CHE_ANH)[number];

/** Chỗ người chơi chạm được trên thẻ. */
export const CHO_CHAM = ["anh", "bien_so", "thoi_diem", "vi_tri", "thiet_bi", "hanh_vi"] as const;
export type ChoCham = (typeof CHO_CHAM)[number];
export const TEN_CHO_CHAM: Record<ChoCham, string> = {
  anh: "Ảnh vi phạm",
  bien_so: "Biển số",
  thoi_diem: "Thời điểm",
  vi_tri: "Vị trí",
  thiet_bi: "Thiết bị ghi hình",
  hanh_vi: "Hành vi đề xuất",
};

export const TEN_CHO_THIEU: Record<ChoThieuPhatNguoi, string> = {
  thieu_thoi_diem: "Thiếu thời điểm vi phạm",
  bien_so_khong_doc_duoc: "Biển số không đọc được hoặc đọc sai",
  anh_khong_ro_hanh_vi: "Ảnh không thấy rõ hành vi",
  hanh_vi_khong_khop: "Hành vi đề xuất không khớp với ảnh",
  thiet_bi_het_han_kiem_dinh: "Thiết bị hết hạn kiểm định",
  ngoai_khung_gio: "Thời điểm ngoài khung giờ cấm",
};

/** Chạm vào một trong các chỗ này là đã chỉ ra chỗ thiếu. */
export const CHO_CUA_THIEU: Record<ChoThieuPhatNguoi, readonly ChoCham[]> = {
  thieu_thoi_diem: ["thoi_diem"],
  bien_so_khong_doc_duoc: ["bien_so"],
  anh_khong_ro_hanh_vi: ["anh"],
  hanh_vi_khong_khop: ["hanh_vi"],
  thiet_bi_het_han_kiem_dinh: ["thiet_bi"],
  ngoai_khung_gio: ["thoi_diem", "hanh_vi"],
};

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

/** Chỗ thiếu mới xuất hiện ở từng màn. Màn sau gồm cả chỗ thiếu của các màn trước. */
export const CHO_THIEU_MOI_CUA_MAN: Readonly<Record<number, readonly ChoThieuPhatNguoi[]>> = {
  1: ["thieu_thoi_diem", "anh_khong_ro_hanh_vi"],
  2: ["bien_so_khong_doc_duoc", "thiet_bi_het_han_kiem_dinh"],
  3: ["hanh_vi_khong_khop"],
  4: [],
  5: ["ngoai_khung_gio"],
};

/** Số hồ sơ mỗi ca theo màn (GAME_DESIGN §5.11). */
export const SO_HO_SO_THEO_MAN: Readonly<Record<number, number>> = { 1: 10, 2: 12, 3: 12, 4: 14, 5: 15 };
/** Hồ sơ thiếu hai chỗ chỉ có từ màn này. */
export const MAN_HAI_CHO_THIEU = 4;

export const MAN_DUYET_PHAT_NGUOI: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Thời điểm và ảnh",
    moTa: "10 hồ sơ, mỗi hồ sơ nhiều nhất một chỗ thiếu rõ: không có thời điểm, ảnh mờ hẳn. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Biển số và thiết bị",
    moTa: "12 hồ sơ. Thêm biển số không đọc được, thiết bị hết hạn kiểm định. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Hành vi đề xuất",
    moTa: "12 hồ sơ. Thêm hành vi hệ thống đề xuất không khớp với ảnh. 4 phút cho cả ca.",
    caLuotMs: 240_000,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Hai chỗ thiếu",
    moTa: "14 hồ sơ. Có hồ sơ thiếu hai chỗ, có hồ sơ đủ căn cứ nhưng trông đáng ngờ. 4 phút cho cả ca.",
    caLuotMs: 240_000,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Lỗi khó thấy",
    moTa: "15 hồ sơ. Ký tự dễ nhầm, thời điểm ngoài giờ cấm, hai xe chồng nhau. 4 phút 30 giây cho cả ca.",
    caLuotMs: 270_000,
    xpCoBan: 18,
  },
];

export const SO_MAN_PHAT_NGUOI = MAN_DUYET_PHAT_NGUOI.length;

const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_PHAT_NGUOI, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/** Các chỗ thiếu được kiểm ở một màn (gồm của các màn trước). */
export function choThieuCuaMan(man: number): Set<ChoThieuPhatNguoi> {
  const m = ganMan(man);
  const kq = new Set<ChoThieuPhatNguoi>();
  for (let i = 1; i <= m; i++) for (const c of CHO_THIEU_MOI_CUA_MAN[i] ?? []) kq.add(c);
  return kq;
}

/** Màn đầu tiên có chỗ thiếu này. */
export function manCuaChoThieu(c: ChoThieuPhatNguoi): number {
  for (let i = 1; i <= SO_MAN_PHAT_NGUOI; i++) if (CHO_THIEU_MOI_CUA_MAN[i]?.includes(c)) return i;
  return SO_MAN_PHAT_NGUOI;
}

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Tham số dựng ảnh vi phạm. Đây là chính bức ảnh nên được gửi xuống điện thoại. */
export interface AnhViPham {
  canh: CanhAnh;
  /** Màu đèn tín hiệu lúc chụp (cảnh giao lộ). */
  den?: "do" | "vang" | "xanh";
  /** Xe đã qua vạch dừng (cảnh giao lộ). */
  qua_vach?: boolean;
  /** Làn xe đang đi (cảnh có làn riêng). */
  lan?: "o_to" | "xe_may";
  /** Người điều khiển mô tô có đội mũ bảo hiểm. */
  mu?: boolean;
  /** Xe đã đi vào đường cấm (cảnh lối vào). */
  vao_duong_cam?: boolean;
  /** Biển phụ khung giờ cấm, "HH:mm" (cảnh lối vào). */
  khung_gio?: { tu: string; den: string };
  /** 0 rõ, 3 mờ hẳn. */
  do_mo: number;
  /** Ảnh chụp trong điều kiện tối. */
  toi: boolean;
  che: CheAnh;
}

/** Dữ kiện một hồ sơ (game_content.payload, trừ `muc`). */
export interface HoSoPhatNguoi {
  loai_xe: "o_to" | "mo_to";
  /** Biển số thật trên xe (hiện ở ảnh phóng to, trừ các ký tự không đọc được). */
  bien_so: string;
  /** Vị trí (chỉ số ký tự trong `bien_so`) không đọc được trên ảnh. Chỉ máy chủ giữ. */
  ky_tu_mo: number[];
  /** Biển số hệ thống nhận dạng, ghi trên dải thông tin. */
  bien_so_he_thong: string;
  /** "YYYY-MM-DDTHH:mm:ss" giờ Việt Nam; null là hồ sơ không có thời điểm. */
  thoi_diem: string | null;
  vi_tri: string;
  thiet_bi: { loai: LoaiThietBi; ma: string; han_kiem_dinh: string };
  de_xuat: { hanh_vi: HanhViPhatNguoi; ma_muc_phat: string | null };
  /** Số đo của thiết bị đo tốc độ (km/h). */
  do_toc_do?: { do_duoc: number; gioi_han: number };
  anh: AnhViPham;
}

export interface PayloadPhatNguoi extends HoSoPhatNguoi {
  muc: number;
}

/** Nguồn của trò: hồ sơ đã duyệt kèm luật kiểm hồ sơ và mức phạt đã duyệt. */
export interface NguonPhatNguoi {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  muc: number;
  ho_so: HoSoPhatNguoi;
  /** Chỗ thiếu người soạn dự kiến (game_content.answer.cho_thieu). */
  cho_thieu_du_kien: ChoThieuPhatNguoi[];
  luat: LuatHoSoPhatNguoi[];
  muc_phat: Record<string, MucPhatDaDuyet>;
}

export interface ChoThieuPhatHien {
  ma: ChoThieuPhatNguoi;
  luat_ma: string;
  mo_ta: string;
}

/** Nội dung một bước trong ảnh chụp lượt (có đáp án; chỉ máy chủ và gói offline giữ). */
export interface BuocPhatNguoi {
  man: number;
  ho_so: HoSoPhatNguoi;
  cho_thieu: ChoThieuPhatHien[];
  luat: LuatHoSoPhatNguoi[];
  thong_bao: DongBienBan[];
}

/** Phần đề gửi người chơi. */
export interface DePhatNguoi {
  man: number;
  loai_xe: HoSoPhatNguoi["loai_xe"];
  /** Biển số trên ảnh phóng to; ký tự không đọc được đã thay bằng KY_TU_MO. */
  bien_so_anh: string;
  bien_so_he_thong: string;
  thoi_diem: string | null;
  vi_tri: string;
  thiet_bi: HoSoPhatNguoi["thiet_bi"] & { ten_loai: string };
  de_xuat: { hanh_vi: HanhViPhatNguoi; ten: string };
  do_toc_do: HoSoPhatNguoi["do_toc_do"] | null;
  anh: AnhViPham;
}

export type QuyetDinhPhatNguoi = "gui" | "tra_lai";

export interface TraLoiPhatNguoi {
  quyet_dinh: QuyetDinhPhatNguoi;
  cho: ChoCham[];
}

export interface ChiTietPhatNguoi {
  quyet_dinh: QuyetDinhPhatNguoi;
  quyet_dinh_dung: QuyetDinhPhatNguoi;
  diem_quyet_dinh: number;
  diem_chi_ra: number;
  diem_chi_ra_toi_da: number;
  cho_thieu: Array<{
    ma: ChoThieuPhatNguoi;
    ten: string;
    mo_ta: string;
    da_chi_ra: boolean;
    cho: ChoCham[];
    giai_thich: string;
    can_cu: string;
  }>;
  cho_nham: Array<{ ma: ChoCham; ten: string }>;
  /** Thông báo vi phạm (M4), chỉ khi hồ sơ đủ căn cứ. */
  thong_bao: DongBienBan[];
}

/* ------------------------------------------------------------------ */
/* Thời điểm                                                           */
/* ------------------------------------------------------------------ */

/** "2026-09-12T07:42:10" → "07:42:10 ngày 12/09/2026". */
export function thoiDiemVn(s: string): string {
  return `${s.slice(11, 19)} ngày ${ngayVn(s.slice(0, 10))}`;
}

const chuanBien = (s: string) => s.toUpperCase().replace(/[\s.-]/g, "");
/* ------------------------------------------------------------------ */
/* Bộ chạy luật                                                        */
/* ------------------------------------------------------------------ */

/** Hành vi mà ảnh (và số đo của thiết bị) cho thấy. */
export function hanhViTrenAnh(h: HoSoPhatNguoi): Set<HanhViPhatNguoi> {
  const a = h.anh;
  const kq = new Set<HanhViPhatNguoi>();
  if (a.canh === "giao_lo" && a.den === "do" && a.qua_vach) kq.add("vuot_den_do");
  if (a.canh === "duong_lan" && a.lan && a.lan !== (h.loai_xe === "o_to" ? "o_to" : "xe_may"))
    kq.add("sai_lan");
  if (h.loai_xe === "mo_to" && a.mu === false) kq.add("khong_mu_bao_hiem");
  if (a.canh === "loi_vao_cam" && a.vao_duong_cam) kq.add("vao_duong_cam");
  if (h.do_toc_do && h.do_toc_do.do_duoc > h.do_toc_do.gioi_han) kq.add("qua_toc_do");
  return kq;
}

function chayLuat(
  l: LuatHoSoPhatNguoi,
  h: HoSoPhatNguoi,
  daThay: ReadonlySet<ChoThieuPhatNguoi>,
): string | null {
  switch (choThieuCuaLuat(l)) {
    case "thieu_thoi_diem":
      return h.thoi_diem ? null : "Hồ sơ không có thời điểm vi phạm.";
    case "bien_so_khong_doc_duoc":
      if (h.ky_tu_mo.length) return `Ảnh phóng to biển số có ${h.ky_tu_mo.length} ký tự không đọc được.`;
      return chuanBien(h.bien_so_he_thong) === chuanBien(h.bien_so)
        ? null
        : `Hệ thống đọc biển số là ${h.bien_so_he_thong}, ảnh phóng to cho thấy ${h.bien_so}.`;
    case "anh_khong_ro_hanh_vi":
      if (h.anh.che === "chong_xe")
        return "Hai xe chồng lên nhau trên ảnh, không xác định được xe nào vi phạm.";
      if (h.anh.che === "xe_khac") return "Xe khác che khuất xe bị ghi hình, ảnh không thấy hành vi.";
      return h.anh.do_mo > (l.tham_so.do_mo_toi_da ?? 0) ? "Ảnh mờ, không thấy rõ hành vi." : null;
    case "hanh_vi_khong_khop": {
      // Ảnh không rõ thì không so được hành vi.
      if (daThay.has("anh_khong_ro_hanh_vi")) return null;
      const hv = h.de_xuat.hanh_vi;
      if (hanhViTrenAnh(h).has(hv)) return null;
      if (hv === "qua_toc_do" && h.do_toc_do)
        return `Hệ thống đề xuất chạy quá tốc độ, nhưng tốc độ đo được ${h.do_toc_do.do_duoc} km/h không vượt giới hạn ${h.do_toc_do.gioi_han} km/h.`;
      return `Hệ thống đề xuất "${TEN_HANH_VI_PHAT_NGUOI[hv].toLowerCase()}", nhưng ảnh không cho thấy hành vi này.`;
    }
    case "thiet_bi_het_han_kiem_dinh": {
      if (!h.thoi_diem) return null;
      const ngay = h.thoi_diem.slice(0, 10);
      return h.thiet_bi.han_kiem_dinh < ngay
        ? `Thiết bị hết hạn kiểm định ngày ${ngayVn(h.thiet_bi.han_kiem_dinh)}, trước ngày ghi hình ${ngayVn(ngay)}.`
        : null;
    }
    case "ngoai_khung_gio": {
      const k = h.anh.khung_gio;
      if (h.de_xuat.hanh_vi !== "vao_duong_cam" || !k || !h.thoi_diem) return null;
      const gio = h.thoi_diem.slice(11, 16);
      return gio >= k.tu && gio < k.den
        ? null
        : `Biển cấm trong khung giờ ${k.tu}–${k.den}; xe đi vào lúc ${gio}, ngoài giờ cấm.`;
    }
  }
  return null;
}

/**
 * Chạy các luật trên hồ sơ, chỉ với các chỗ thiếu trong `bat` (mặc định: mọi chỗ). Mỗi chỗ thiếu ghi
 * một lần (luật đầu tiên phát hiện), theo thứ tự `CHO_THIEU_PHAT_NGUOI`.
 */
export function kiemTraHoSoPN(
  h: HoSoPhatNguoi,
  luat: readonly LuatHoSoPhatNguoi[],
  bat: ReadonlySet<ChoThieuPhatNguoi> = new Set(CHO_THIEU_PHAT_NGUOI),
): ChoThieuPhatHien[] {
  const kq: ChoThieuPhatHien[] = [];
  const daThay = new Set<ChoThieuPhatNguoi>();
  const thuTu = (l: LuatHoSoPhatNguoi) => CHO_THIEU_PHAT_NGUOI.indexOf(choThieuCuaLuat(l)!);
  for (const l of [...luat].filter((x) => choThieuCuaLuat(x)).sort((a, b) => thuTu(a) - thuTu(b))) {
    const ma = choThieuCuaLuat(l)!;
    if (!bat.has(ma) || daThay.has(ma)) continue;
    const moTa = chayLuat(l, h, daThay);
    if (!moTa) continue;
    daThay.add(ma);
    kq.push({ ma, luat_ma: l.ma, mo_ta: moTa });
  }
  return kq;
}

/** Chỗ thiếu trong `bat` chưa có luật đã duyệt nào: hồ sơ không chấm được ở màn đó. */
export function luatPhatNguoiConThieu(
  luat: readonly LuatHoSoPhatNguoi[],
  bat: ReadonlySet<ChoThieuPhatNguoi>,
): ChoThieuPhatNguoi[] {
  const co = new Set(luat.map(choThieuCuaLuat));
  return [...bat].filter((c) => !co.has(c));
}

const cungTap = (a: readonly string[], b: readonly string[]) => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Hồ sơ dùng được ở một màn: màn của hồ sơ không cao hơn màn đang chơi, đủ luật đã duyệt cho mọi chỗ
 * thiếu của màn, và luật đã duyệt cho đúng các chỗ thiếu người soạn dự kiến.
 */
export function hoSoDungDuocOMan(n: NguonPhatNguoi, man: number): boolean {
  const bat = choThieuCuaMan(man);
  if (n.muc > ganMan(man)) return false;
  if (luatPhatNguoiConThieu(n.luat, bat).length) return false;
  return cungTap(
    kiemTraHoSoPN(n.ho_so, n.luat, bat).map((c) => c.ma),
    n.cho_thieu_du_kien,
  );
}

/** Biển số trên ảnh phóng to: ký tự không đọc được thay bằng KY_TU_MO (làm ở máy chủ). */
export function bienSoLamNhieu(h: Pick<HoSoPhatNguoi, "bien_so" | "ky_tu_mo">): string {
  const mo = new Set(h.ky_tu_mo);
  return [...h.bien_so].map((c, i) => (mo.has(i) ? KY_TU_MO : c)).join("");
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

function dungBuoc(n: NguonPhatNguoi, thuTu: number, man: number): BuocLuot<BuocPhatNguoi> {
  const cho = kiemTraHoSoPN(n.ho_so, n.luat, choThieuCuaMan(man));
  const theoMa = new Map(n.luat.map((l) => [l.ma, l]));
  const h = n.ho_so;
  return {
    thu_tu: thuTu,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: DIEM_QUYET_DINH_PN + DIEM_MOI_CHO_THIEU * cho.length,
    noi_dung: {
      man,
      ho_so: h,
      cho_thieu: cho,
      luat: cho.map((c) => theoMa.get(c.luat_ma)!),
      thong_bao: cho.length
        ? []
        : [
            dongBienBan({
              hanhVi: TEN_HANH_VI_PHAT_NGUOI[h.de_xuat.hanh_vi],
              chiTiet: `Phương tiện biển số ${h.bien_so}, lúc ${h.thoi_diem ? thoiDiemVn(h.thoi_diem) : "(không rõ thời điểm)"}, tại ${h.vi_tri}. Ghi hình bởi thiết bị ${h.thiet_bi.ma} (${TEN_LOAI_THIET_BI[h.thiet_bi.loai].toLowerCase()}).`,
              canCu: [],
              maMucPhat: h.de_xuat.ma_muc_phat,
              mucPhat: n.muc_phat,
            }),
          ],
    },
  };
}

function giaiThich(b: BuocPhatNguoi, tl: TraLoiPhatNguoi): string {
  if (!b.cho_thieu.length)
    return tl.quyet_dinh === "gui"
      ? "Hồ sơ đủ căn cứ: ảnh rõ hành vi, biển số đọc được, có thời điểm, thiết bị còn hạn kiểm định. Gửi thông báo là đúng."
      : "Hồ sơ đủ căn cứ. Trả lại hồ sơ đủ căn cứ là sai.";
  const ds = b.cho_thieu.map((c) => TEN_CHO_THIEU[c.ma].toLowerCase()).join("; ");
  const dau = `Hồ sơ thiếu căn cứ: ${ds}. Phải trả lại.`;
  return tl.quyet_dinh === "gui" ? `${dau} Gửi thông báo khi hồ sơ thiếu căn cứ là sai.` : dau;
}

export const TRO_CHOI_DUYET_PHAT_NGUOI: DinhNghiaTroChoi<BuocPhatNguoi, DePhatNguoi, TraLoiPhatNguoi> = {
  ma: MA_DUYET_PHAT_NGUOI,
  ten: "Duyệt hồ sơ phạt nguội",
  moTa: "Thẩm định hồ sơ vi phạm do camera ghi lại: đủ căn cứ thì gửi thông báo, thiếu thì trả lại và chỉ đúng chỗ thiếu.",
  offline: true,
  nguon: "phat_nguoi_ho_so",
  // Số hồ sơ tối thiểu để bắt đầu; số hồ sơ mỗi ca theo màn ở SO_HO_SO_THEO_MAN.
  soBuoc: SO_HO_SO_THEO_MAN[1]!,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_DUYET_PHAT_NGUOI,

  locNguon(nguon) {
    // Nguồn đã qua bộ kiểm dạng đầy đủ ở máy chủ (duyet-phat-nguoi-kiem.ts, khi nạp và khi lấy nguồn);
    // ở đây chỉ kiểm khung để gói offline không phải mang bộ kiểm đó.
    return (nguon as NguonPhatNguoi[]).filter(
      (n) =>
        n?.ho_so?.anh &&
        Array.isArray(n.luat) &&
        Array.isArray(n.cho_thieu_du_kien) &&
        Number.isInteger(n.muc),
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const soHoSo = SO_HO_SO_THEO_MAN[m] ?? this.soBuoc;
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn, seed và màn.
    const dung = tron(
      (this.locNguon(nguon) as NguonPhatNguoi[])
        .filter((n) => hoSoDungDuocOMan(n, m))
        .sort((a, b) => a.id.localeCompare(b.id)),
      rng,
    );
    const pool = [...dung.filter((n) => n.muc === m), ...dung.filter((n) => n.muc !== m)];
    const chon: NguonPhatNguoi[] = [];
    const lay = (dk: (n: NguonPhatNguoi) => boolean, soLuong: number) => {
      for (const n of pool) {
        if (soLuong <= 0 || chon.length >= soHoSo) return;
        if (!chon.includes(n) && dk(n)) {
          chon.push(n);
          soLuong--;
        }
      }
    };
    const thieu = (n: NguonPhatNguoi) => n.cho_thieu_du_kien.length > 0;
    // Ít nhất 30% hồ sơ đủ căn cứ và 40% hồ sơ thiếu (nếu đủ nguồn), ưu tiên hồ sơ đúng màn.
    const soThieu = Math.ceil(soHoSo * 0.4);
    lay((n) => !thieu(n), Math.ceil(soHoSo * 0.3));
    lay((n) => thieu(n) && n.muc === m, soThieu);
    lay(thieu, soThieu - chon.filter(thieu).length);
    lay((n) => n.muc === m, soHoSo);
    lay(() => true, soHoSo);
    return tron(chon, rng).map((n, i) => dungBuoc(n, i + 1, m));
  },

  deChoNguoiChoi(buoc) {
    const h = buoc.noi_dung.ho_so;
    return {
      man: buoc.noi_dung.man,
      loai_xe: h.loai_xe,
      bien_so_anh: bienSoLamNhieu(h),
      bien_so_he_thong: h.bien_so_he_thong,
      thoi_diem: h.thoi_diem,
      vi_tri: h.vi_tri,
      thiet_bi: { ...h.thiet_bi, ten_loai: TEN_LOAI_THIET_BI[h.thiet_bi.loai] },
      de_xuat: { hanh_vi: h.de_xuat.hanh_vi, ten: TEN_HANH_VI_PHAT_NGUOI[h.de_xuat.hanh_vi] },
      do_toc_do: h.do_toc_do ?? null,
      anh: { ...h.anh },
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (r.quyet_dinh !== "gui" && r.quyet_dinh !== "tra_lai") return null;
    const ds = r.cho ?? [];
    if (!Array.isArray(ds) || ds.length > CHO_CHAM.length) return null;
    if (ds.some((c) => !(CHO_CHAM as readonly string[]).includes(c as string))) return null;
    const cho = [...new Set(ds as ChoCham[])];
    // Trả lại phải chỉ ít nhất một chỗ thiếu; gửi thì bỏ các chỗ đã chạm. Mọi trường khác (điểm,
    // cờ đúng) bị bỏ qua.
    if (r.quyet_dinh === "tra_lai" && !cho.length) return null;
    return { quyet_dinh: r.quyet_dinh, cho: r.quyet_dinh === "tra_lai" ? cho : [] };
  },

  chamBuoc(buoc, tl) {
    const b = buoc.noi_dung;
    const du = b.cho_thieu.length === 0;
    const dungQd: QuyetDinhPhatNguoi = du ? "gui" : "tra_lai";
    const chon = new Set(tl.cho);
    const hopLe = new Set(b.cho_thieu.flatMap((c) => CHO_CUA_THIEU[c.ma]));
    const nham = tl.cho.filter((c) => !hopLe.has(c));
    const theoMa = new Map(b.luat.map((l) => [l.ma, l]));
    const choThieu = b.cho_thieu.map((c) => ({
      ma: c.ma,
      ten: TEN_CHO_THIEU[c.ma],
      mo_ta: c.mo_ta,
      da_chi_ra: tl.quyet_dinh === "tra_lai" && CHO_CUA_THIEU[c.ma].some((x) => chon.has(x)),
      cho: [...CHO_CUA_THIEU[c.ma]],
      giai_thich: theoMa.get(c.luat_ma)?.giai_thich ?? "",
      can_cu: theoMa.get(c.luat_ma)?.can_cu ?? "",
    }));
    const toiDaChiRa = DIEM_MOI_CHO_THIEU * choThieu.length;
    const diemQd = tl.quyet_dinh === dungQd ? DIEM_QUYET_DINH_PN : 0;
    const diemChiRa =
      tl.quyet_dinh === "tra_lai" && !du
        ? Math.max(
            0,
            Math.min(
              toiDaChiRa,
              DIEM_MOI_CHO_THIEU * choThieu.filter((c) => c.da_chi_ra).length -
                TRU_CHAM_NHAM_PN * nham.length,
            ),
          )
        : 0;
    const diem = diemQd + diemChiRa;
    const chiTiet: ChiTietPhatNguoi = {
      quyet_dinh: tl.quyet_dinh,
      quyet_dinh_dung: dungQd,
      diem_quyet_dinh: diemQd,
      diem_chi_ra: diemChiRa,
      diem_chi_ra_toi_da: toiDaChiRa,
      cho_thieu: choThieu,
      cho_nham: nham.map((c) => ({ ma: c, ten: TEN_CHO_CHAM[c] })),
      thong_bao: b.thong_bao,
    };
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich: giaiThich(b, tl),
      canCu: [
        ...new Set(
          [...choThieu.map((c) => c.can_cu), ...b.thong_bao.flatMap((t) => t.can_cu)].filter(Boolean),
        ),
      ],
    };
  },
};
