/**
 * Trò "Lên xe khách" (docs/PLAN.md GĐ-T13, docs/GAME_DESIGN.md §5.13).
 *
 * Mỗi xe khách là một bước. Người chơi chạm từng người trên sơ đồ khoang xe để đếm (chạm lại thì bỏ),
 * chỉnh ô "số người vượt" bằng − và +, chạm chỗ sai trên lệnh vận chuyển, phù hiệu, màn giám sát hành
 * trình, rồi đóng dấu Cho đi hoặc Lập biên bản. Lập biên bản thì sắp các lỗi đã chỉ ra theo thứ tự nặng
 * đến nhẹ. Chấm (câu D15: điểm bước không âm):
 *   - đếm: 10 khi đếm đúng từng người (không sót, không chạm vật) và báo đúng số người vượt (không vượt: 0);
 *   - mỗi lỗi giấy tờ hoặc giám sát chỉ đúng: 5; chạm nhầm: −2, chỉ trừ trong phần lỗi, không âm;
 *   - dấu đúng: 5;
 *   - thứ tự lỗi (chỉ khi xe phải lập biên bản và có từ hai lỗi có mức phạt đã duyệt): 5 khi đúng, 2 khi
 *     sai đúng một cặp liền kề, còn lại 0.
 *
 * "Nặng" đo bằng mức phạt tối đa của dòng `violations` đã duyệt; bằng nhau thì thứ tự nào cũng đúng; lỗi
 * chưa có mức phạt đã duyệt không vào bước sắp (câu D19). Không kiểm giấy phép lái xe, đăng ký, bảo hiểm
 * (câu D20).
 *
 * Luật không nằm trong mã: số chỗ so với số người, cách tính trẻ em, lệnh vận chuyển, phù hiệu, ngưỡng thời
 * gian lái là dòng `document_rules` nhóm `van_tai_khach` ĐÃ DUYỆT (câu D16). Xe có trẻ em chỉ vào lượt khi có
 * luật cách tính trẻ em đã duyệt. Xe mà luật cho kết quả khác dự kiến thì không vào lượt.
 *
 * Đề gửi người chơi có loại hình của từng phần tử trên sơ đồ (thứ nhìn thấy được), id sinh ngẫu nhiên theo
 * lượt, không có số chỗ quy đổi, số người vượt, lỗi, thứ tự. Hàm thuần. Bộ kiểm dạng xe ở len-xe-khach-kiem.ts.
 */

import { tron } from "../de-thi.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import {
  type GiamSatHanhTrinh,
  type LenhVanChuyen,
  LOI_VAN_TAI,
  type LuatVanTaiKhach,
  laLuatTreEm,
  loiVanTaiCuaLuat,
  type MaLoiVanTai,
  ngayVn,
  type PhuHieu,
  phutCuaGio,
} from "./chung/giay-to.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import type { BuocLuot, DinhNghiaTroChoi } from "./khung.ts";

export const MA_LEN_XE_KHACH = "len_xe_khach";
export const DIEM_DEM_XK = 10;
export const DIEM_MOI_LOI_XK = 5;
export const TRU_CHAM_NHAM_XK = 2;
export const DIEM_DAU_XK = 5;
export const DIEM_THU_TU_XK = 5;
export const DIEM_THU_TU_GAN_XK = 2;
export const SO_VUOT_TOI_DA = 60;
/** Mục "chở quá số người" trong bước sắp lỗi. */
export const MUC_SO_NGUOI = "so_nguoi";

export const DAU_XE_KHACH = ["cho_di", "lap_bien_ban"] as const;
export type DauXeKhach = (typeof DAU_XE_KHACH)[number];
export const TEN_DAU_XE_KHACH: Record<DauXeKhach, string> = {
  cho_di: "Cho đi",
  lap_bien_ban: "Lập biên bản",
};

export const LOAI_XE_KHACH = ["xe_16_cho", "xe_29_cho", "xe_45_cho", "xe_giuong_nam"] as const;
export type LoaiXeKhach = (typeof LOAI_XE_KHACH)[number];
export const TEN_LOAI_XE_KHACH: Record<LoaiXeKhach, string> = {
  xe_16_cho: "Xe khách 16 chỗ",
  xe_29_cho: "Xe khách 29 chỗ",
  xe_45_cho: "Xe khách 45 chỗ",
  xe_giuong_nam: "Xe giường nằm",
};

/** Hình của một phần tử trên sơ đồ: người lớn, trẻ em, hoặc vật dễ nhầm với người. */
export const HINH_PHAN_TU = ["nguoi_lon", "tre_em", "hanh_ly", "ao_treo", "tui"] as const;
export type HinhPhanTu = (typeof HINH_PHAN_TU)[number];
export const laNguoi = (h: HinhPhanTu) => h === "nguoi_lon" || h === "tre_em";

export const TEN_LOI_XE_KHACH: Record<MaLoiVanTai, string> = {
  cho_qua_nguoi: "Chở quá số người quy định",
  thieu_lenh_van_chuyen: "Không có lệnh vận chuyển",
  lenh_sai_xe: "Lệnh vận chuyển ghi biển số khác xe",
  lenh_sai_lai_xe: "Lệnh vận chuyển ghi lái xe khác người đang lái",
  lenh_sai_ngay: "Lệnh vận chuyển không đúng ngày",
  thieu_phu_hieu: "Không có phù hiệu",
  phu_hieu_het_han: "Phù hiệu hết giá trị",
  phu_hieu_sai_xe: "Phù hiệu ghi biển số khác xe",
  lai_lien_tuc_qua_gio: "Lái xe liên tục quá thời gian quy định",
  lai_trong_ngay_qua_gio: "Tổng thời gian lái trong ngày quá quy định",
};

/* ------------------------------------------------------------------ */
/* Sơ đồ khoang                                                        */
/* ------------------------------------------------------------------ */

export type LoaiO = "ghe" | "giuong" | "loi_di" | "san";

/** Một ô trên sơ đồ (nhìn từ trên, đầu xe ở trên). `tang` 2 là tầng trên của xe giường nằm. */
export interface OKhoang {
  ma: string;
  loai: LoaiO;
  hang: number;
  cot: number;
  tang: 1 | 2;
}

export interface SoDoKhoang {
  so_cot: number;
  so_hang: number;
  so_tang: 1 | 2;
  o: OKhoang[];
  /** Số chỗ hành khách (ghế hoặc giường) trên sơ đồ, không kể chỗ người lái. */
  so_cho: number;
}

const BO_TRI: Record<LoaiXeKhach, { cot: number[]; loiDi: number; soHang: number; soTang: 1 | 2 }> = {
  // 2 ghế | lối đi | 1 ghế, 5 hàng: 15 chỗ hành khách.
  xe_16_cho: { cot: [0, 1, 3], loiDi: 2, soHang: 5, soTang: 1 },
  // 2 | lối đi | 2, 7 hàng: 28 chỗ.
  xe_29_cho: { cot: [0, 1, 3, 4], loiDi: 2, soHang: 7, soTang: 1 },
  // 2 | lối đi | 2, 11 hàng: 44 chỗ.
  xe_45_cho: { cot: [0, 1, 3, 4], loiDi: 2, soHang: 11, soTang: 1 },
  // 3 dãy giường, 2 lối đi, 6 hàng, 2 tầng: 36 giường. Người nằm sàn ở lối đi tầng dưới.
  xe_giuong_nam: { cot: [0, 2, 4], loiDi: -1, soHang: 6, soTang: 2 },
};

/** Sơ đồ khoang dựng từ loại xe. Máy chủ và điện thoại dùng chung: mã ô không mang thông tin đáp án. */
export function soDoKhoang(loai: LoaiXeKhach): SoDoKhoang {
  const b = BO_TRI[loai];
  const o: OKhoang[] = [];
  for (const tang of b.soTang === 2 ? ([1, 2] as const) : ([1] as const)) {
    for (let hang = 0; hang < b.soHang; hang++) {
      for (const cot of b.cot)
        o.push(
          loai === "xe_giuong_nam"
            ? { ma: `b${tang}-${hang}-${cot}`, loai: "giuong", hang, cot, tang }
            : { ma: `g${hang}-${cot}`, loai: "ghe", hang, cot, tang },
        );
      if (b.loiDi >= 0) o.push({ ma: `l${hang}`, loai: "loi_di", hang, cot: b.loiDi, tang });
      if (loai === "xe_giuong_nam" && tang === 1)
        for (const cot of [1, 3]) o.push({ ma: `s${hang}-${cot}`, loai: "san", hang, cot, tang });
    }
  }
  return {
    so_cot: loai === "xe_giuong_nam" ? 5 : Math.max(...b.cot) + 1,
    so_hang: b.soHang,
    so_tang: b.soTang,
    o,
    so_cho: o.filter((x) => x.loai === "ghe" || x.loai === "giuong").length,
  };
}

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

/** Lỗi mới được kiểm ở từng màn. Màn sau gồm lỗi của các màn trước. */
export const LOI_MOI_CUA_MAN_XK: Readonly<Record<number, readonly MaLoiVanTai[]>> = {
  1: ["cho_qua_nguoi"],
  2: [],
  3: [
    "thieu_lenh_van_chuyen",
    "lenh_sai_xe",
    "lenh_sai_lai_xe",
    "lenh_sai_ngay",
    "thieu_phu_hieu",
    "phu_hieu_het_han",
    "phu_hieu_sai_xe",
  ],
  4: ["lai_lien_tuc_qua_gio", "lai_trong_ngay_qua_gio"],
  5: [],
};

export const SO_XE_THEO_MAN_XK: Readonly<Record<number, number>> = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 2 };

export const MAN_LEN_XE_KHACH: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Xe 16 chỗ",
    moTa: "3 xe 16 chỗ. Chỉ đếm khách: chạm từng người, báo số người vượt. Không tính giờ.",
    moiBuocMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Người đứng lối đi",
    moTa: "3 xe. Xe 29 chỗ có người đứng lối đi, hành lý, áo treo dễ nhầm với người. Không tính giờ.",
    moiBuocMs: null,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Lệnh vận chuyển, phù hiệu",
    moTa: "3 xe. Thêm lệnh vận chuyển và phù hiệu. 3 phút mỗi xe.",
    moiBuocMs: 180_000,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Giám sát hành trình",
    moTa: "3 xe. Thêm màn thiết bị giám sát hành trình: thời gian lái liên tục, trong ngày. 3 phút mỗi xe.",
    moiBuocMs: 180_000,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Xe giường nằm ban đêm",
    moTa: "2 xe giường nằm chạy đêm, khách nằm sàn, nhiều lỗi chồng nhau. 3 phút 30 giây mỗi xe.",
    moiBuocMs: 210_000,
    xpCoBan: 18,
  },
];
export const SO_MAN_XE_KHACH = MAN_LEN_XE_KHACH.length;

const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_XE_KHACH, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/** Các lỗi được kiểm ở một màn (gồm của các màn trước). */
export function loiCuaManXK(man: number): Set<MaLoiVanTai> {
  const kq = new Set<MaLoiVanTai>();
  for (let i = 1; i <= ganMan(man); i++) for (const l of LOI_MOI_CUA_MAN_XK[i] ?? []) kq.add(l);
  return kq;
}

const coGiayTo = (man: number) => man >= 3;
const coGiamSat = (man: number) => man >= 4;

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Một phần tử trên sơ đồ: đặt ở ô `o` (mã ô của `soDoKhoang`). */
export interface PhanTuKhoang {
  o: string;
  hinh: HinhPhanTu;
}

/** Dữ kiện một xe (game_content.payload, trừ `muc`). */
export interface XeKhach {
  loai_xe: LoaiXeKhach;
  bien_so: string;
  ngay_kiem_tra: string;
  /** Giờ dừng xe kiểm tra, "HH:mm". */
  gio_kiem_tra: string;
  /** Họ tên người đang lái (tự giới thiệu). */
  lai_xe: string;
  phan_tu: PhanTuKhoang[];
  lenh_van_chuyen: LenhVanChuyen | null;
  phu_hieu: PhuHieu | null;
  giam_sat_hanh_trinh: GiamSatHanhTrinh;
}

export interface PayloadXeKhach extends XeKhach {
  muc: number;
}

export interface NguonXeKhach {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  muc: number;
  xe: XeKhach;
  /** Lỗi người soạn dự kiến (game_content.answer.loi). */
  loi_du_kien: MaLoiVanTai[];
  luat: LuatVanTaiKhach[];
  muc_phat: Record<string, MucPhatDaDuyet>;
}

/** Một lỗi luật phát hiện; `cho` là các chỗ chạm được chỉ ra lỗi này. */
export interface LoiXeKhach {
  ma: MaLoiVanTai;
  luat_ma: string;
  mo_ta: string;
  cho: string[];
}

export interface PhanTuCoId extends PhanTuKhoang {
  id: string;
}

/** Nội dung một bước (có đáp án; chỉ máy chủ và gói offline giữ). */
export interface BuocXeKhach {
  man: number;
  xe: XeKhach;
  /** Phần tử kèm id sinh theo lượt. */
  phan_tu: PhanTuCoId[];
  so_cho: number;
  so_quy_doi: number;
  so_vuot: number;
  loi: LoiXeKhach[];
  luat: LuatVanTaiKhach[];
  /** Mức phạt tối đa đã duyệt của từng lỗi; null khi chưa có (không vào bước sắp). */
  phat_toi_da: Partial<Record<MaLoiVanTai, number | null>>;
  dau: DauXeKhach;
  /** Có bước sắp lỗi được chấm (xe lập biên bản, từ hai lỗi có mức phạt đã duyệt). */
  co_thu_tu: boolean;
  bien_ban: DongBienBan[];
}

/** Phần đề gửi người chơi. */
export interface DeXeKhach {
  man: number;
  loai_xe: LoaiXeKhach;
  ten_loai_xe: string;
  bien_so: string;
  so_cho: number;
  ngay_kiem_tra: string;
  gio_kiem_tra: string;
  lai_xe: string | null;
  phan_tu: PhanTuCoId[];
  giay_to: { lenh_van_chuyen: LenhVanChuyen | null; phu_hieu: PhuHieu | null } | null;
  giam_sat: (GiamSatHanhTrinh & { tong_lai_phut: number }) | null;
}

export interface TraLoiXeKhach {
  /** Id các phần tử đã chạm để đếm. */
  dem: string[];
  so_vuot: number;
  /** Chỗ đã chạm trên giấy tờ và màn giám sát. */
  cham: string[];
  dau: DauXeKhach;
  /** Thứ tự nặng đến nhẹ: mã chỗ đã chạm hoặc MUC_SO_NGUOI. Rỗng khi Cho đi. */
  thu_tu: string[];
}

export interface ChiTietXeKhach {
  dau: DauXeKhach;
  dau_dung: DauXeKhach;
  diem_dem: number;
  diem_loi: number;
  diem_loi_toi_da: number;
  diem_dau: number;
  diem_thu_tu: number;
  diem_thu_tu_toi_da: number;
  so_vuot: number;
  so_vuot_dung: number;
  so_cho: number;
  so_quy_doi: number;
  /** Id người đếm đúng, id vật hoặc id lạ bị đếm (dư), id người bị sót. */
  dem_dung: string[];
  dem_du: string[];
  bo_sot: string[];
  loi: Array<{
    ma: MaLoiVanTai;
    ten: string;
    mo_ta: string;
    da_chi_ra: boolean;
    cho: string[];
    giai_thich: string;
    can_cu: string;
    phat_toi_da: number | null;
  }>;
  cho_nham: string[];
  /** Thứ tự người chơi sắp (chỉ các lỗi thật có mức phạt đã duyệt) và thứ tự đúng. */
  thu_tu_nguoi_choi: MaLoiVanTai[];
  thu_tu_dung: MaLoiVanTai[];
  bien_ban: DongBienBan[];
}

/* ------------------------------------------------------------------ */
/* Bộ chạy luật                                                        */
/* ------------------------------------------------------------------ */

const chuanBien = (s: string) => s.toUpperCase().replace(/[\s.-]/g, "");
const chuanChu = (s: string) => s.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const gioPhut = (p: number) => `${Math.floor(p / 60)} giờ ${String(p % 60).padStart(2, "0")} phút`;

/** Tổng số phút xe chạy trên thiết bị giám sát. */
export function tongLaiPhut(g: GiamSatHanhTrinh): number {
  return g.doan.reduce((s, d) => s + (d.chay ? phutCuaGio(d.den) - phutCuaGio(d.tu) : 0), 0);
}

/**
 * Các lần lái liên tục: chuỗi đoạn chạy, lần dừng ngắn hơn `nghiToiThieu` phút không ngắt chuỗi (và không
 * tính vào thời gian lái). Trả chỉ số các đoạn chạy và tổng phút lái của từng lần.
 */
export function cacLanLaiLienTuc(
  g: GiamSatHanhTrinh,
  nghiToiThieu: number,
): Array<{ doan: number[]; phut: number }> {
  const kq: Array<{ doan: number[]; phut: number }> = [];
  let hien: { doan: number[]; phut: number } | null = null;
  for (const [i, d] of g.doan.entries()) {
    const dai = phutCuaGio(d.den) - phutCuaGio(d.tu);
    if (d.chay) {
      hien ??= { doan: [], phut: 0 };
      hien.doan.push(i);
      hien.phut += dai;
    } else if (dai >= nghiToiThieu && hien) {
      kq.push(hien);
      hien = null;
    }
  }
  if (hien) kq.push(hien);
  return kq;
}

/** Luật cách tính trẻ em đã duyệt (nếu có). */
export const luatTreEm = (luat: readonly LuatVanTaiKhach[]) => luat.find(laLuatTreEm);

/** Số người quy đổi từ số người lớn và trẻ em; null khi có trẻ em mà chưa có luật cách tính trẻ em. */
export function soNguoiQuyDoi(
  nguoiLon: number,
  treEm: number,
  luat: readonly LuatVanTaiKhach[],
): number | null {
  if (!treEm) return nguoiLon;
  const t = luatTreEm(luat)?.tham_so;
  if (!t?.so_tre || !t.bang_nguoi) return null;
  const q = (treEm * t.bang_nguoi) / t.so_tre;
  return nguoiLon + (t.lam_tron === "len" ? Math.ceil(q - 1e-9) : Math.floor(q + 1e-9));
}

const demHinh = (ds: readonly PhanTuKhoang[], h: HinhPhanTu) => ds.filter((p) => p.hinh === h).length;

/** Số người quy đổi của cả xe; null khi không tính được (thiếu luật trẻ em). */
export function soNguoiCuaXe(xe: XeKhach, luat: readonly LuatVanTaiKhach[]): number | null {
  return soNguoiQuyDoi(demHinh(xe.phan_tu, "nguoi_lon"), demHinh(xe.phan_tu, "tre_em"), luat);
}

function chayLuat(
  l: LuatVanTaiKhach,
  xe: XeKhach,
  soCho: number,
  soNguoi: number,
): Omit<LoiXeKhach, "ma" | "luat_ma"> | null {
  const lenh = xe.lenh_van_chuyen;
  const ph = xe.phu_hieu;
  const g = xe.giam_sat_hanh_trinh;
  switch (loiVanTaiCuaLuat(l)) {
    case "cho_qua_nguoi":
      return soNguoi > soCho
        ? {
            mo_ta: `Trên xe có ${soNguoi} người (đã quy đổi), xe có ${soCho} chỗ hành khách: vượt ${soNguoi - soCho} người.`,
            cho: [MUC_SO_NGUOI],
          }
        : null;
    case "thieu_lenh_van_chuyen":
      return lenh
        ? null
        : { mo_ta: "Lái xe không xuất trình lệnh vận chuyển.", cho: ["thieu.lenh_van_chuyen"] };
    case "lenh_sai_xe":
      return lenh && chuanBien(lenh.bien_so) !== chuanBien(xe.bien_so)
        ? {
            mo_ta: `Lệnh vận chuyển ghi biển số ${lenh.bien_so}, xe mang biển ${xe.bien_so}.`,
            cho: ["lvc.bien_so"],
          }
        : null;
    case "lenh_sai_lai_xe":
      return lenh && chuanChu(lenh.lai_xe) !== chuanChu(xe.lai_xe)
        ? {
            mo_ta: `Lệnh vận chuyển giao cho lái xe ${lenh.lai_xe}, người đang lái là ${xe.lai_xe}.`,
            cho: ["lvc.lai_xe"],
          }
        : null;
    case "lenh_sai_ngay":
      return lenh && lenh.ngay !== xe.ngay_kiem_tra
        ? {
            mo_ta: `Lệnh vận chuyển cho ngày ${ngayVn(lenh.ngay)}, ngày kiểm tra ${ngayVn(xe.ngay_kiem_tra)}.`,
            cho: ["lvc.ngay"],
          }
        : null;
    case "thieu_phu_hieu":
      return ph ? null : { mo_ta: "Xe không có phù hiệu.", cho: ["thieu.phu_hieu"] };
    case "phu_hieu_het_han":
      return ph && ph.co_gia_tri_den < xe.ngay_kiem_tra
        ? {
            mo_ta: `Phù hiệu có giá trị đến ${ngayVn(ph.co_gia_tri_den)}, trước ngày kiểm tra ${ngayVn(xe.ngay_kiem_tra)}.`,
            cho: ["ph.co_gia_tri_den"],
          }
        : null;
    case "phu_hieu_sai_xe":
      return ph && chuanBien(ph.bien_so) !== chuanBien(xe.bien_so)
        ? { mo_ta: `Phù hiệu ghi biển số ${ph.bien_so}, xe mang biển ${xe.bien_so}.`, cho: ["ph.bien_so"] }
        : null;
    case "lai_lien_tuc_qua_gio": {
      const toiDa = l.tham_so.toi_da_phut ?? 0;
      const qua = cacLanLaiLienTuc(g, l.tham_so.nghi_toi_thieu_phut ?? 0).filter((x) => x.phut > toiDa);
      if (!qua.length) return null;
      const dai = qua.reduce((a, b) => (b.phut > a.phut ? b : a));
      const tu = g.doan[dai.doan[0]!]!.tu;
      const den = g.doan[dai.doan.at(-1)!]!.den;
      return {
        mo_ta: `Lái liên tục ${gioPhut(dai.phut)} (${tu}–${den}), quá ${gioPhut(toiDa)}.`,
        cho: qua.flatMap((x) => x.doan.map((i) => `gs.doan.${i}`)),
      };
    }
    case "lai_trong_ngay_qua_gio": {
      const toiDa = l.tham_so.toi_da_phut ?? 0;
      const tong = tongLaiPhut(g);
      return tong > toiDa
        ? {
            mo_ta: `Tổng thời gian lái trong ngày ${gioPhut(tong)}, quá ${gioPhut(toiDa)}.`,
            cho: ["gs.tong"],
          }
        : null;
    }
  }
  return null;
}

/**
 * Chạy các luật trên xe, chỉ với các lỗi trong `bat`. Mỗi lỗi ghi một lần (luật đầu tiên phát hiện), theo
 * thứ tự LOI_VAN_TAI. Trả null khi không tính được số người (xe có trẻ em, chưa có luật cách tính trẻ em).
 */
export function kiemTraXeKhach(
  xe: XeKhach,
  luat: readonly LuatVanTaiKhach[],
  bat: ReadonlySet<MaLoiVanTai> = new Set(LOI_VAN_TAI),
): LoiXeKhach[] | null {
  const soNguoi = soNguoiCuaXe(xe, luat);
  if (soNguoi === null) return null;
  const soCho = soDoKhoang(xe.loai_xe).so_cho;
  const kq: LoiXeKhach[] = [];
  const daCo = new Set<MaLoiVanTai>();
  const thuTu = (l: LuatVanTaiKhach) => LOI_VAN_TAI.indexOf(loiVanTaiCuaLuat(l)!);
  for (const l of luat.filter((x) => loiVanTaiCuaLuat(x)).sort((a, b) => thuTu(a) - thuTu(b))) {
    const ma = loiVanTaiCuaLuat(l)!;
    if (!bat.has(ma) || daCo.has(ma)) continue;
    const r = chayLuat(l, xe, soCho, soNguoi);
    if (!r) continue;
    daCo.add(ma);
    kq.push({ ma, luat_ma: l.ma, ...r });
  }
  return kq;
}

/** Lỗi trong `bat` chưa có luật đã duyệt nào: xe không chấm được ở màn đó. */
export function luatVanTaiConThieu(
  luat: readonly LuatVanTaiKhach[],
  bat: ReadonlySet<MaLoiVanTai>,
): MaLoiVanTai[] {
  const co = new Set(luat.map(loiVanTaiCuaLuat));
  return [...bat].filter((m) => !co.has(m));
}

const cungTap = (a: readonly string[], b: readonly string[]) => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Xe dùng được ở một màn: màn của xe không cao hơn màn đang chơi, đủ luật đã duyệt cho mọi lỗi của màn,
 * có luật cách tính trẻ em nếu xe có trẻ em, và luật cho đúng các lỗi người soạn dự kiến (trong phạm vi màn).
 */
export function xeKhachDungDuocOMan(n: NguonXeKhach, man: number): boolean {
  const bat = loiCuaManXK(man);
  if (n.muc > ganMan(man)) return false;
  if (luatVanTaiConThieu(n.luat, bat).length) return false;
  const loi = kiemTraXeKhach(n.xe, n.luat, bat);
  if (!loi) return false;
  return cungTap(
    loi.map((l) => l.ma),
    n.loi_du_kien.filter((m) => bat.has(m)),
  );
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

/** Dãy mức phạt tối đa không tăng (nặng đến nhẹ; bằng nhau thì thứ tự nào cũng đúng). */
const khongTang = (a: readonly number[]) => a.every((x, i) => i === 0 || a[i - 1]! >= x);

/** Điểm thứ tự: đúng 5; sai đúng một cặp liền kề (đổi chỗ một cặp là đúng) 2; còn lại 0. */
export function chamThuTuNangNhe(phat: readonly number[]): number {
  if (khongTang(phat)) return DIEM_THU_TU_XK;
  for (let i = 0; i + 1 < phat.length; i++) {
    const d = [...phat];
    [d[i], d[i + 1]] = [d[i + 1]!, d[i]!];
    if (khongTang(d)) return DIEM_THU_TU_GAN_XK;
  }
  return 0;
}

/**
 * Các lỗi thật trong thứ tự người chơi sắp: mỗi mục ứng với lỗi đầu tiên chưa dùng có chỗ đó; mục trùng
 * hoặc không ứng lỗi nào bị bỏ. MUC_SO_NGUOI ứng với lỗi chở quá số người khi người chơi báo có vượt.
 */
export function loiTheoThuTu(
  b: Pick<BuocXeKhach, "loi">,
  tl: Pick<TraLoiXeKhach, "thu_tu" | "so_vuot">,
): MaLoiVanTai[] {
  const kq: MaLoiVanTai[] = [];
  for (const muc of tl.thu_tu) {
    if (muc === MUC_SO_NGUOI && tl.so_vuot <= 0) continue;
    const l = b.loi.find((x) => x.cho.includes(muc) && !kq.includes(x.ma));
    if (l) kq.push(l.ma);
  }
  return kq;
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

const CHU_ID = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Id ngẫu nhiên theo lượt, không trùng, không mang thông tin loại. */
function sinhId(rng: () => number, daCo: Set<string>): string {
  for (;;) {
    const id = Array.from({ length: 8 }, () => CHU_ID[Math.floor(rng() * CHU_ID.length)]).join("");
    if (!daCo.has(id)) {
      daCo.add(id);
      return id;
    }
  }
}

/** Thứ tự đúng: mức phạt tối đa giảm dần, bằng nhau giữ thứ tự LOI_VAN_TAI. */
function sapNangNhe(loi: readonly LoiXeKhach[], phat: BuocXeKhach["phat_toi_da"]): LoiXeKhach[] {
  return [...loi].sort(
    (a, b) =>
      (phat[b.ma] ?? -1) - (phat[a.ma] ?? -1) || LOI_VAN_TAI.indexOf(a.ma) - LOI_VAN_TAI.indexOf(b.ma),
  );
}

function dungBuoc(n: NguonXeKhach, thuTu: number, man: number, rng: () => number): BuocLuot<BuocXeKhach> {
  const loi = kiemTraXeKhach(n.xe, n.luat, loiCuaManXK(man))!;
  const soCho = soDoKhoang(n.xe.loai_xe).so_cho;
  const soQuyDoi = soNguoiCuaXe(n.xe, n.luat)!;
  const theoMa = new Map(n.luat.map((l) => [l.ma, l]));
  const phat: BuocXeKhach["phat_toi_da"] = {};
  for (const l of loi) {
    const ma = theoMa.get(l.luat_ma)?.ma_muc_phat;
    phat[l.ma] = ma && n.muc_phat[ma] ? n.muc_phat[ma]!.phat_den : null;
  }
  const daCo = new Set<string>();
  const phanTu = n.xe.phan_tu.map((p) => ({ ...p, id: sinhId(rng, daCo) }));
  const coThuTu = loi.filter((l) => phat[l.ma] != null).length >= 2;
  const soLoiGiay = loi.filter((l) => l.ma !== "cho_qua_nguoi").length;
  return {
    thu_tu: thuTu,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: DIEM_DEM_XK + DIEM_MOI_LOI_XK * soLoiGiay + DIEM_DAU_XK + (coThuTu ? DIEM_THU_TU_XK : 0),
    noi_dung: {
      man,
      xe: n.xe,
      phan_tu: phanTu,
      so_cho: soCho,
      so_quy_doi: soQuyDoi,
      so_vuot: Math.max(0, soQuyDoi - soCho),
      loi,
      luat: [...new Set(loi.map((l) => l.luat_ma))].map((m) => theoMa.get(m)!),
      phat_toi_da: phat,
      dau: loi.length ? "lap_bien_ban" : "cho_di",
      co_thu_tu: coThuTu,
      bien_ban: sapNangNhe(loi, phat).map((l) =>
        dongBienBan({
          hanhVi: TEN_LOI_XE_KHACH[l.ma],
          chiTiet: `Xe ${n.xe.bien_so}: ${l.mo_ta}`,
          canCu: [theoMa.get(l.luat_ma)!.can_cu],
          maMucPhat: theoMa.get(l.luat_ma)!.ma_muc_phat,
          mucPhat: n.muc_phat,
        }),
      ),
    },
  };
}

function giaiThich(b: BuocXeKhach): string {
  const dem =
    b.so_vuot > 0
      ? `Trên xe có ${b.so_quy_doi} người (đã quy đổi) trên ${b.so_cho} chỗ: vượt ${b.so_vuot}.`
      : `Trên xe có ${b.so_quy_doi} người trên ${b.so_cho} chỗ: không vượt.`;
  if (!b.loi.length) return `${dem} Giấy tờ, dữ liệu giám sát không có lỗi. Cho đi.`;
  return `${dem} Có ${b.loi.length} lỗi: ${b.loi.map((l) => TEN_LOI_XE_KHACH[l.ma].toLowerCase()).join("; ")}. Lập biên bản.`;
}

const ID_RE = /^[a-z0-9]{4,16}$/;
const CHO_RE =
  /^(lvc\.(so|don_vi|bien_so|lai_xe|ngay|tuyen)|ph\.(so|loai|bien_so|co_gia_tri_den)|thieu\.(lenh_van_chuyen|phu_hieu)|gs\.tong|gs\.doan\.([0-9]|[1-3][0-9]))$/;
const MAX_DEM = 120;

export const TRO_CHOI_LEN_XE_KHACH: DinhNghiaTroChoi<BuocXeKhach, DeXeKhach, TraLoiXeKhach> = {
  ma: MA_LEN_XE_KHACH,
  ten: "Lên xe khách",
  moTa: "Đếm người trên sơ đồ khoang xe, soi lệnh vận chuyển, phù hiệu, dữ liệu giám sát hành trình, đóng dấu và sắp lỗi vào biên bản.",
  offline: true,
  nguon: "xe_khach_len_xe",
  // Số xe tối thiểu để bắt đầu; số xe mỗi lượt theo màn ở SO_XE_THEO_MAN_XK.
  soBuoc: SO_XE_THEO_MAN_XK[1]!,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_LEN_XE_KHACH,

  locNguon(nguon) {
    // Nguồn đã qua bộ kiểm dạng đầy đủ ở máy chủ (len-xe-khach-kiem.ts); ở đây chỉ kiểm khung.
    return (nguon as NguonXeKhach[]).filter(
      (n) =>
        Array.isArray(n?.xe?.phan_tu) &&
        n.xe.giam_sat_hanh_trinh &&
        Array.isArray(n.luat) &&
        Array.isArray(n.loi_du_kien) &&
        Number.isInteger(n.muc),
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    const soXe = SO_XE_THEO_MAN_XK[m] ?? this.soBuoc;
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn, seed và màn.
    const dung = tron(
      (this.locNguon(nguon) as NguonXeKhach[])
        .filter((n) => xeKhachDungDuocOMan(n, m))
        .sort((a, b) => a.id.localeCompare(b.id)),
      rng,
    );
    const pool = [...dung.filter((n) => n.muc === m), ...dung.filter((n) => n.muc !== m)];
    const coLoi = new Map(pool.map((n) => [n, kiemTraXeKhach(n.xe, n.luat, loiCuaManXK(m))!.length > 0]));
    const chon: NguonXeKhach[] = [];
    const lay = (dk: (n: NguonXeKhach) => boolean, soLuong: number) => {
      for (const n of pool) {
        if (soLuong <= 0 || chon.length >= soXe) return;
        if (!chon.includes(n) && dk(n)) {
          chon.push(n);
          soLuong--;
        }
      }
    };
    // Ít nhất một xe phải lập biên bản; ưu tiên xe đúng màn. Màn 3 trở đi có thêm một xe cho đi nếu đủ nguồn.
    lay((n) => coLoi.get(n)!, 1);
    if (m >= 3 && soXe >= 3) lay((n) => !coLoi.get(n), 1);
    lay(() => true, soXe);
    return tron(chon, rng).map((n, i) => dungBuoc(n, i + 1, m, rng));
  },

  deChoNguoiChoi(buoc) {
    const { man, xe, phan_tu, so_cho } = buoc.noi_dung;
    const g = xe.giam_sat_hanh_trinh;
    return {
      man,
      loai_xe: xe.loai_xe,
      ten_loai_xe: TEN_LOAI_XE_KHACH[xe.loai_xe],
      bien_so: xe.bien_so,
      so_cho,
      ngay_kiem_tra: xe.ngay_kiem_tra,
      gio_kiem_tra: xe.gio_kiem_tra,
      lai_xe: coGiayTo(man) ? xe.lai_xe : null,
      // Sắp theo id (ngẫu nhiên theo lượt): thứ tự mảng không lộ thứ tự người soạn.
      phan_tu: [...phan_tu]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(({ id, o, hinh }) => ({ id, o, hinh })),
      giay_to: coGiayTo(man) ? { lenh_van_chuyen: xe.lenh_van_chuyen, phu_hieu: xe.phu_hieu } : null,
      giam_sat: coGiamSat(man)
        ? { ...g, doan: g.doan.map((d) => ({ ...d })), tong_lai_phut: tongLaiPhut(g) }
        : null,
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (!(DAU_XE_KHACH as readonly unknown[]).includes(r.dau)) return null;
    if (!Number.isInteger(r.so_vuot) || (r.so_vuot as number) < 0 || (r.so_vuot as number) > SO_VUOT_TOI_DA)
      return null;
    const mang = (v: unknown, max: number, re: RegExp) =>
      v === undefined
        ? []
        : Array.isArray(v) && v.length <= max && v.every((x) => typeof x === "string" && re.test(x))
          ? (v as string[])
          : null;
    const dem = mang(r.dem, MAX_DEM, ID_RE);
    const cham = mang(r.cham, 60, CHO_RE);
    const thuTu = mang(r.thu_tu, 61, new RegExp(`^(${MUC_SO_NGUOI}|${CHO_RE.source.slice(1, -1)})$`));
    if (!dem || !cham || !thuTu) return null;
    const chamSet = [...new Set(cham)];
    // Thứ tự chỉ gồm các chỗ đã chạm và mục số người; Cho đi thì bỏ thứ tự. Điểm, cờ đúng máy khách gửi
    // kèm bị bỏ qua. Chạm hai lần cùng một người chỉ tính một lần.
    if (r.dau === "lap_bien_ban" && thuTu.some((m) => m !== MUC_SO_NGUOI && !chamSet.includes(m)))
      return null;
    return {
      dem: [...new Set(dem)],
      so_vuot: r.so_vuot as number,
      cham: chamSet,
      dau: r.dau as DauXeKhach,
      thu_tu: r.dau === "lap_bien_ban" ? [...new Set(thuTu)] : [],
    };
  },

  chamBuoc(buoc, tl) {
    const b = buoc.noi_dung;
    // Đếm: tập id đã chạm phải đúng là tập người trên xe; số báo phải đúng số vượt.
    const nguoi = new Set(b.phan_tu.filter((p) => laNguoi(p.hinh)).map((p) => p.id));
    const dem = new Set(tl.dem);
    const demDung = [...dem].filter((id) => nguoi.has(id));
    const demDu = [...dem].filter((id) => !nguoi.has(id));
    const boSot = [...nguoi].filter((id) => !dem.has(id));
    const diemDem = !demDu.length && !boSot.length && tl.so_vuot === b.so_vuot ? DIEM_DEM_XK : 0;
    // Lỗi giấy tờ, giám sát.
    const loiGiay = b.loi.filter((l) => l.ma !== "cho_qua_nguoi");
    const cham = new Set(tl.cham);
    const hopLe = new Set(loiGiay.flatMap((l) => l.cho));
    const nham = tl.cham.filter((c) => !hopLe.has(c));
    const daChiRa = (l: LoiXeKhach) =>
      l.ma === "cho_qua_nguoi" ? tl.so_vuot > 0 : l.cho.some((c) => cham.has(c));
    const toiDaLoi = DIEM_MOI_LOI_XK * loiGiay.length;
    const diemLoi = Math.max(
      0,
      Math.min(toiDaLoi, DIEM_MOI_LOI_XK * loiGiay.filter(daChiRa).length - TRU_CHAM_NHAM_XK * nham.length),
    );
    const diemDau = tl.dau === b.dau ? DIEM_DAU_XK : 0;
    // Thứ tự: chỉ các lỗi thật có mức phạt đã duyệt, từ hai lỗi trở lên.
    const thuTuNguoiChoi = loiTheoThuTu(b, tl).filter((m) => b.phat_toi_da[m] != null);
    const diemThuTu =
      b.co_thu_tu && tl.dau === "lap_bien_ban" && thuTuNguoiChoi.length >= 2
        ? chamThuTuNangNhe(thuTuNguoiChoi.map((m) => b.phat_toi_da[m]!))
        : 0;
    const diem = diemDem + diemLoi + diemDau + diemThuTu;
    const theoMa = new Map(b.luat.map((l) => [l.ma, l]));
    const chiTiet: ChiTietXeKhach = {
      dau: tl.dau,
      dau_dung: b.dau,
      diem_dem: diemDem,
      diem_loi: diemLoi,
      diem_loi_toi_da: toiDaLoi,
      diem_dau: diemDau,
      diem_thu_tu: diemThuTu,
      diem_thu_tu_toi_da: b.co_thu_tu ? DIEM_THU_TU_XK : 0,
      so_vuot: tl.so_vuot,
      so_vuot_dung: b.so_vuot,
      so_cho: b.so_cho,
      so_quy_doi: b.so_quy_doi,
      dem_dung: demDung,
      dem_du: demDu,
      bo_sot: boSot,
      loi: b.loi.map((l) => ({
        ma: l.ma,
        ten: TEN_LOI_XE_KHACH[l.ma],
        mo_ta: l.mo_ta,
        da_chi_ra: daChiRa(l),
        cho: l.cho,
        giai_thich: theoMa.get(l.luat_ma)?.giai_thich ?? "",
        can_cu: theoMa.get(l.luat_ma)?.can_cu ?? "",
        phat_toi_da: b.phat_toi_da[l.ma] ?? null,
      })),
      cho_nham: nham,
      thu_tu_nguoi_choi: thuTuNguoiChoi,
      thu_tu_dung: sapNangNhe(b.loi, b.phat_toi_da)
        .filter((l) => b.phat_toi_da[l.ma] != null)
        .map((l) => l.ma),
      bien_ban: b.bien_ban,
    };
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich: giaiThich(b),
      canCu: [
        ...new Set(
          [...chiTiet.loi.map((l) => l.can_cu), ...b.bien_ban.flatMap((d) => d.can_cu)].filter(Boolean),
        ),
      ],
    };
  },
};
