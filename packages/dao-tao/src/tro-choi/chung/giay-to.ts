/**
 * Bộ giấy tờ dùng chung (mô-đun M1, docs/GAME_DESIGN.md §4): kiểu dữ liệu của một hồ sơ người lái,
 * bộ kiểm giấy tờ theo luật ĐÃ DUYỆT (`document_rules`), và hàm sinh hồ sơ ngẫu nhiên có lỗi cố ý.
 * Dùng cho "Kiểm tra giấy tờ" (GĐ-T1) và "Dừng xe đúng quy trình" (GĐ-T4).
 *
 * Luật không nằm trong mã: mỗi dòng `document_rules` là một phép kiểm (phải có giấy tờ nào, giấy tờ
 * nào có hạn, trường nào phải khớp với xe, hạng giấy phép nào dùng được cho loại xe nào) kèm căn cứ.
 * Mã này chỉ biết cách chạy từng KIỂU phép kiểm. Thiếu luật đã duyệt cho một phép kiểm thì hồ sơ cần
 * phép kiểm đó không dùng được (`luatConThieu`), không đoán.
 *
 * Hàm thuần: ngày là chuỗi YYYY-MM-DD, không đọc đồng hồ; số ngẫu nhiên lấy từ `rng` truyền vào.
 */

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                        */
/* ------------------------------------------------------------------ */

export const LOAI_GIAY_TO = ["gplx", "dang_ky", "bao_hiem"] as const;
export type LoaiGiayTo = (typeof LOAI_GIAY_TO)[number];

export const TEN_GIAY_TO: Record<LoaiGiayTo, string> = {
  gplx: "Giấy phép lái xe",
  dang_ky: "Giấy chứng nhận đăng ký xe",
  bao_hiem: "Giấy chứng nhận bảo hiểm bắt buộc trách nhiệm dân sự",
};

export const TEN_NGAN_GIAY_TO: Record<LoaiGiayTo, string> = {
  gplx: "giấy phép lái xe",
  dang_ky: "giấy đăng ký xe",
  bao_hiem: "giấy bảo hiểm",
};

/** Phân loại xe dùng trong trò. Ranh giới theo văn bản do luật `hang_gplx` đã duyệt quyết định. */
export const PHAN_LOAI_XE = ["mo_to_nho", "mo_to_lon", "o_to_con"] as const;
export type PhanLoaiXe = (typeof PHAN_LOAI_XE)[number];

export const TEN_PHAN_LOAI_XE: Record<PhanLoaiXe, string> = {
  mo_to_nho: "Xe mô tô hai bánh, dung tích xi-lanh đến 125 cm³",
  mo_to_lon: "Xe mô tô hai bánh, dung tích xi-lanh trên 125 cm³",
  o_to_con: "Xe ô tô chở người đến 8 chỗ (không kể chỗ người lái)",
};

export const laMoTo = (p: PhanLoaiXe) => p === "mo_to_nho" || p === "mo_to_lon";

export interface NguoiLai {
  ho_ten: string;
  /** YYYY-MM-DD */
  ngay_sinh: string;
  /** Câu người lái nói khi đưa giấy tờ (có họ tên và ngày sinh tự khai). */
  loi_noi: string;
}

export interface XeKiemTra {
  phan_loai: PhanLoaiXe;
  bien_so: string;
  /** Nhãn hiệu và số loại, ví dụ "Honda Vision". */
  nhan_hieu: string;
  mau: string;
  /** Dung tích xi-lanh (cm³), với xe mô tô. */
  dung_tich: number | null;
  /** Số chỗ ngồi, với xe ô tô. */
  so_cho: number | null;
}

export interface GiayPhepLaiXe {
  so: string;
  ho_ten: string;
  ngay_sinh: string;
  hang: string[];
  /** Ngày hết giá trị (YYYY-MM-DD); null: không thời hạn. */
  co_gia_tri_den: string | null;
}

export interface DangKyXe {
  so: string;
  chu_xe: string;
  bien_so: string;
  nhan_hieu: string;
  mau: string;
  dung_tich: number | null;
  so_cho: number | null;
}

export interface BaoHiemXe {
  so: string;
  chu_xe: string;
  bien_so: string;
  tu_ngay: string;
  den_ngay: string;
}

export interface BoGiayTo {
  gplx?: GiayPhepLaiXe | null;
  dang_ky?: DangKyXe | null;
  bao_hiem?: BaoHiemXe | null;
}

/** Một hồ sơ: người lái, xe, giấy tờ đưa ra, ngày kiểm tra. Chỉ có DỮ KIỆN, không có đáp án. */
export interface HoSoGiayTo {
  ngay_kiem_tra: string;
  nguoi_lai: NguoiLai;
  xe: XeKiemTra;
  giay_to: BoGiayTo;
}

/* ------------------------------------------------------------------ */
/* Luật                                                                */
/* ------------------------------------------------------------------ */

/**
 * Kiểu phép kiểm:
 *  - `phai_co`: người lái phải xuất trình giấy tờ `giay_to`;
 *  - `con_han`: giấy tờ `giay_to` phải còn giá trị tại ngày kiểm tra;
 *  - `khop_xe`: trường `tham_so.truong` của giấy tờ phải khớp với xe;
 *  - `khop_nguoi`: giấy phép lái xe phải đúng người lái (họ tên và ngày sinh);
 *  - `hang_gplx`: giấy phép lái xe phải có một trong các hạng `tham_so.hang` cho loại xe `phan_loai`.
 */
export const KIEU_KIEM = ["phai_co", "con_han", "khop_xe", "khop_nguoi", "hang_gplx"] as const;
export type KieuKiem = (typeof KIEU_KIEM)[number];

export const TRUONG_KHOP_XE = ["bien_so", "nhan_hieu"] as const;
export type TruongKhopXe = (typeof TRUONG_KHOP_XE)[number];

/**
 * Nhóm luật trong `document_rules` (GĐ-T11, câu D16). Vắng `nhom` là nhóm giấy tờ người lái (trò 1, 4).
 * Mỗi nhóm có bộ kiểu kiểm và phần được kiểm riêng; bộ kiểm dạng `kiemTraLuatGiayTo` chọn theo nhóm.
 */
export const NHOM_LUAT = ["giay_to_nguoi_lai", "ho_so_phat_nguoi", "van_tai_khach"] as const;
export type NhomLuat = (typeof NHOM_LUAT)[number];
export const NHOM_LUAT_MAC_DINH: NhomLuat = "giay_to_nguoi_lai";

/** Một luật giấy tờ đã duyệt (dòng `document_rules`, nhóm giấy tờ người lái). */
export interface LuatGiayTo {
  ma: string;
  version: number;
  nhom?: "giay_to_nguoi_lai";
  kiem: KieuKiem;
  giay_to: LoaiGiayTo | null;
  /** Loại xe áp dụng; rỗng là mọi loại. */
  phan_loai: PhanLoaiXe[];
  tham_so: { truong?: TruongKhopXe; hang?: string[] };
  ten: string;
  giai_thich: string;
  can_cu: string;
  /** Mã dòng mức phạt (violations) của lỗi này; null khi chưa có mức phạt đã duyệt. */
  ma_muc_phat: string | null;
}

export const MA_LOI_GIAY_TO = [
  "thieu_gplx",
  "gplx_ngoai_han",
  "thieu_dang_ky",
  "dang_ky_sai_bien_so",
  "dang_ky_sai_nhan_hieu",
  "thieu_bao_hiem",
  "bao_hiem_ngoai_han",
  "bao_hiem_sai_bien_so",
  "gplx_sai_hang",
  "gplx_nguoi_khac",
] as const;
export type MaLoiGiayTo = (typeof MA_LOI_GIAY_TO)[number];

export const TEN_LOI_GIAY_TO: Record<MaLoiGiayTo, string> = {
  thieu_gplx: "Không xuất trình giấy phép lái xe",
  gplx_ngoai_han: "Giấy phép lái xe hết giá trị sử dụng",
  thieu_dang_ky: "Không xuất trình giấy đăng ký xe",
  dang_ky_sai_bien_so: "Biển số trên giấy đăng ký không khớp với xe",
  dang_ky_sai_nhan_hieu: "Nhãn hiệu trên giấy đăng ký không khớp với xe",
  thieu_bao_hiem: "Không xuất trình giấy chứng nhận bảo hiểm bắt buộc",
  bao_hiem_ngoai_han: "Bảo hiểm không có hiệu lực tại ngày kiểm tra",
  bao_hiem_sai_bien_so: "Biển số trên giấy bảo hiểm không khớp với xe",
  gplx_sai_hang: "Hạng giấy phép lái xe không phù hợp với loại xe",
  gplx_nguoi_khac: "Giấy phép lái xe không phải của người đang lái",
};

/** Mã lỗi mà một luật phát hiện. Luật sai dạng trả null. */
export function maLoiCuaLuat(l: Pick<LuatGiayTo, "kiem" | "giay_to" | "tham_so">): MaLoiGiayTo | null {
  const gt = l.giay_to;
  switch (l.kiem) {
    case "phai_co":
      return gt ? (`thieu_${gt}` as MaLoiGiayTo) : null;
    case "con_han":
      return gt === "gplx" || gt === "bao_hiem" ? `${gt}_ngoai_han` : null;
    case "khop_xe":
      if (gt === "dang_ky" && l.tham_so.truong === "bien_so") return "dang_ky_sai_bien_so";
      if (gt === "dang_ky" && l.tham_so.truong === "nhan_hieu") return "dang_ky_sai_nhan_hieu";
      if (gt === "bao_hiem" && l.tham_so.truong === "bien_so") return "bao_hiem_sai_bien_so";
      return null;
    case "khop_nguoi":
      return gt === "gplx" ? "gplx_nguoi_khac" : null;
    case "hang_gplx":
      return gt === "gplx" && (l.tham_so.hang?.length ?? 0) > 0 ? "gplx_sai_hang" : null;
  }
  return null;
}

const apDung = (l: LuatGiayTo, p: PhanLoaiXe) => !l.phan_loai.length || l.phan_loai.includes(p);

/* ------------------------------------------------------------------ */
/* Nhóm hồ sơ phạt nguội (GĐ-T11)                                      */
/* ------------------------------------------------------------------ */

/** Kiểu kiểm của nhóm hồ sơ phạt nguội. Bộ chạy luật ở tro-choi/duyet-phat-nguoi.ts. */
export const KIEU_KIEM_PHAT_NGUOI = [
  "phai_co",
  "doc_duoc",
  "thay_hanh_vi",
  "khop_hanh_vi",
  "con_han",
  "trong_khung_gio",
] as const;
export type KieuKiemPhatNguoi = (typeof KIEU_KIEM_PHAT_NGUOI)[number];

/** Phần hồ sơ được kiểm (cột `doc_kind` của nhóm này). */
export const PHAN_HO_SO_PHAT_NGUOI = ["thoi_diem", "bien_so", "anh", "hanh_vi", "thiet_bi"] as const;
export type PhanHoSoPhatNguoi = (typeof PHAN_HO_SO_PHAT_NGUOI)[number];

/** Chỗ thiếu mà một luật phát hiện, theo thứ tự kiểm (ảnh trước hành vi: ảnh không rõ thì không so hành vi). */
export const CHO_THIEU_PHAT_NGUOI = [
  "thieu_thoi_diem",
  "bien_so_khong_doc_duoc",
  "anh_khong_ro_hanh_vi",
  "hanh_vi_khong_khop",
  "thiet_bi_het_han_kiem_dinh",
  "ngoai_khung_gio",
] as const;
export type ChoThieuPhatNguoi = (typeof CHO_THIEU_PHAT_NGUOI)[number];

const CHO_THIEU_THEO_KIEU: Readonly<Record<string, ChoThieuPhatNguoi>> = {
  "phai_co/thoi_diem": "thieu_thoi_diem",
  "doc_duoc/bien_so": "bien_so_khong_doc_duoc",
  "thay_hanh_vi/anh": "anh_khong_ro_hanh_vi",
  "khop_hanh_vi/hanh_vi": "hanh_vi_khong_khop",
  "con_han/thiet_bi": "thiet_bi_het_han_kiem_dinh",
  "trong_khung_gio/thoi_diem": "ngoai_khung_gio",
};

/** Một luật kiểm hồ sơ phạt nguội đã duyệt (dòng `document_rules`, nhóm `ho_so_phat_nguoi`). */
export interface LuatHoSoPhatNguoi {
  ma: string;
  version: number;
  nhom: "ho_so_phat_nguoi";
  kiem: KieuKiemPhatNguoi;
  phan: PhanHoSoPhatNguoi;
  /** `do_mo_toi_da` (0–3) cho `thay_hanh_vi`: ảnh mờ hơn mức này thì không thấy rõ hành vi. */
  tham_so: { do_mo_toi_da?: number };
  ten: string;
  giai_thich: string;
  can_cu: string;
  ma_muc_phat: string | null;
}

/** Chỗ thiếu mà một luật phạt nguội phát hiện. Cặp kiểu kiểm và phần không hợp lệ trả null. */
export function choThieuCuaLuat(l: Pick<LuatHoSoPhatNguoi, "kiem" | "phan">): ChoThieuPhatNguoi | null {
  return CHO_THIEU_THEO_KIEU[`${l.kiem}/${l.phan}`] ?? null;
}

function kiemTruongChung(l: { ten?: unknown; giai_thich?: unknown; can_cu?: unknown }, loi: string[]) {
  if (typeof l.ten !== "string" || l.ten.trim().length < 5) loi.push("Thiếu tên luật.");
  if (typeof l.giai_thich !== "string" || l.giai_thich.trim().length < 10) loi.push("Thiếu giải thích.");
  if (typeof l.can_cu !== "string" || !l.can_cu.startsWith("vn:")) loi.push("Căn cứ phải là URN dạng vn:...");
}

function kiemTraLuatPhatNguoi(l: Partial<LuatHoSoPhatNguoi>): string[] {
  const loi: string[] = [];
  if (!(KIEU_KIEM_PHAT_NGUOI as readonly string[]).includes(l.kiem as string))
    loi.push("Kiểu kiểm không hợp lệ với nhóm hồ sơ phạt nguội.");
  if (!(PHAN_HO_SO_PHAT_NGUOI as readonly string[]).includes(l.phan as string))
    loi.push("Phần hồ sơ được kiểm không hợp lệ.");
  if (!l.tham_so || typeof l.tham_so !== "object") loi.push("Thiếu tham số.");
  else if (l.kiem && l.phan && choThieuCuaLuat(l as LuatHoSoPhatNguoi) === null)
    loi.push("Luật không ứng với chỗ thiếu nào: kiểm lại kiểu kiểm và phần hồ sơ.");
  if (l.kiem === "thay_hanh_vi") {
    const m = l.tham_so?.do_mo_toi_da;
    if (!Number.isInteger(m) || (m as number) < 0 || (m as number) > 3)
      loi.push("Luật ảnh phải có độ mờ tối đa chấp nhận (do_mo_toi_da) từ 0 đến 3.");
  }
  kiemTruongChung(l, loi);
  return loi;
}

/**
 * Kiểm dạng một luật (khi nạp tệp và khi sửa trong quản trị). Trả danh sách lỗi. Luật có
 * `nhom = "ho_so_phat_nguoi"` hoặc `"van_tai_khach"` kiểm theo bộ kiểu kiểm của nhóm đó; vắng `nhom`
 * là giấy tờ người lái.
 */
export function kiemTraLuatGiayTo(
  l: Partial<LuatGiayTo> | Partial<LuatHoSoPhatNguoi> | Partial<LuatVanTaiKhach> | null | undefined,
): string[] {
  if (!l || typeof l !== "object") return ["Thiếu luật."];
  const nhom = (l as { nhom?: unknown }).nhom ?? NHOM_LUAT_MAC_DINH;
  if (!(NHOM_LUAT as readonly unknown[]).includes(nhom)) return ["Nhóm luật không hợp lệ."];
  if (nhom === "ho_so_phat_nguoi") return kiemTraLuatPhatNguoi(l as Partial<LuatHoSoPhatNguoi>);
  if (nhom === "van_tai_khach") return kiemTraLuatVanTai(l as Partial<LuatVanTaiKhach>);
  return kiemTraLuatNguoiLai(l as Partial<LuatGiayTo>);
}

function kiemTraLuatNguoiLai(l: Partial<LuatGiayTo>): string[] {
  const loi: string[] = [];
  if (!(KIEU_KIEM as readonly string[]).includes(l.kiem as string)) loi.push("Kiểu kiểm không hợp lệ.");
  if (l.giay_to !== null && !(LOAI_GIAY_TO as readonly string[]).includes(l.giay_to as string))
    loi.push("Loại giấy tờ không hợp lệ.");
  if (
    !Array.isArray(l.phan_loai) ||
    l.phan_loai.some((p) => !(PHAN_LOAI_XE as readonly string[]).includes(p))
  )
    loi.push("Loại xe áp dụng không hợp lệ.");
  if (!l.tham_so || typeof l.tham_so !== "object") loi.push("Thiếu tham số.");
  else if (l.kiem && maLoiCuaLuat(l as LuatGiayTo) === null)
    loi.push("Luật không ứng với lỗi nào: kiểm lại giấy tờ, trường khớp hoặc danh sách hạng.");
  if (l.kiem === "hang_gplx" && (!Array.isArray(l.phan_loai) || l.phan_loai.length === 0))
    loi.push("Luật hạng giấy phép phải ghi loại xe áp dụng.");
  kiemTruongChung(l, loi);
  return loi;
}

/* ------------------------------------------------------------------ */
/* Dấu hiệu: các chi tiết người chơi chạm để chỉ ra lỗi                */
/* ------------------------------------------------------------------ */

export const DAU_HIEU = [
  "thieu.gplx",
  "thieu.dang_ky",
  "thieu.bao_hiem",
  "xe.bien_so",
  "xe.nhan_hieu",
  "nguoi_lai.loi_noi",
  "gplx.so",
  "gplx.ho_ten",
  "gplx.ngay_sinh",
  "gplx.hang",
  "gplx.co_gia_tri_den",
  "dang_ky.so",
  "dang_ky.chu_xe",
  "dang_ky.bien_so",
  "dang_ky.nhan_hieu",
  "dang_ky.mau",
  "dang_ky.dung_tich",
  "bao_hiem.so",
  "bao_hiem.chu_xe",
  "bao_hiem.bien_so",
  "bao_hiem.thoi_han",
] as const;
export type DauHieu = (typeof DAU_HIEU)[number];

export const TEN_DAU_HIEU: Record<DauHieu, string> = {
  "thieu.gplx": "Không có giấy phép lái xe",
  "thieu.dang_ky": "Không có giấy đăng ký xe",
  "thieu.bao_hiem": "Không có giấy bảo hiểm",
  "xe.bien_so": "Biển số gắn trên xe",
  "xe.nhan_hieu": "Nhãn hiệu của xe",
  "nguoi_lai.loi_noi": "Lời tự giới thiệu của người lái",
  "gplx.so": "Số giấy phép lái xe",
  "gplx.ho_ten": "Họ tên trên giấy phép lái xe",
  "gplx.ngay_sinh": "Ngày sinh trên giấy phép lái xe",
  "gplx.hang": "Hạng giấy phép lái xe",
  "gplx.co_gia_tri_den": "Thời hạn của giấy phép lái xe",
  "dang_ky.so": "Số giấy đăng ký",
  "dang_ky.chu_xe": "Chủ xe trên giấy đăng ký",
  "dang_ky.bien_so": "Biển số trên giấy đăng ký",
  "dang_ky.nhan_hieu": "Nhãn hiệu trên giấy đăng ký",
  "dang_ky.mau": "Màu sơn trên giấy đăng ký",
  "dang_ky.dung_tich": "Dung tích, số chỗ trên giấy đăng ký",
  "bao_hiem.so": "Số giấy bảo hiểm",
  "bao_hiem.chu_xe": "Chủ xe trên giấy bảo hiểm",
  "bao_hiem.bien_so": "Biển số trên giấy bảo hiểm",
  "bao_hiem.thoi_han": "Thời hạn bảo hiểm",
};

/** Dấu hiệu nào chỉ ra được lỗi nào (chạm vào một trong các chi tiết này là đã chỉ ra lỗi). */
export const DAU_HIEU_CUA_LOI: Record<MaLoiGiayTo, readonly DauHieu[]> = {
  thieu_gplx: ["thieu.gplx"],
  gplx_ngoai_han: ["gplx.co_gia_tri_den"],
  thieu_dang_ky: ["thieu.dang_ky"],
  dang_ky_sai_bien_so: ["dang_ky.bien_so", "xe.bien_so"],
  dang_ky_sai_nhan_hieu: ["dang_ky.nhan_hieu", "xe.nhan_hieu"],
  thieu_bao_hiem: ["thieu.bao_hiem"],
  bao_hiem_ngoai_han: ["bao_hiem.thoi_han"],
  bao_hiem_sai_bien_so: ["bao_hiem.bien_so", "xe.bien_so"],
  gplx_sai_hang: ["gplx.hang"],
  gplx_nguoi_khac: ["gplx.ho_ten", "gplx.ngay_sinh", "nguoi_lai.loi_noi"],
};

/** Giấy tờ mà một lỗi liên quan (để lọc lỗi theo giấy tờ đang được kiểm). */
export const GIAY_TO_CUA_LOI: Record<MaLoiGiayTo, LoaiGiayTo> = {
  thieu_gplx: "gplx",
  gplx_ngoai_han: "gplx",
  thieu_dang_ky: "dang_ky",
  dang_ky_sai_bien_so: "dang_ky",
  dang_ky_sai_nhan_hieu: "dang_ky",
  thieu_bao_hiem: "bao_hiem",
  bao_hiem_ngoai_han: "bao_hiem",
  bao_hiem_sai_bien_so: "bao_hiem",
  gplx_sai_hang: "gplx",
  gplx_nguoi_khac: "gplx",
};

/* ------------------------------------------------------------------ */
/* Ngày                                                                */
/* ------------------------------------------------------------------ */

const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function laNgay(s: unknown): s is string {
  if (typeof s !== "string" || !NGAY_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function congNgayLich(ngay: string, soNgay: number): string {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

/** "2026-09-15" → "15/09/2026". */
export function ngayVn(ngay: string): string {
  const [y, m, d] = ngay.split("-");
  return `${d}/${m}/${y}`;
}

/* ------------------------------------------------------------------ */
/* Kiểm dữ kiện hồ sơ                                                  */
/* ------------------------------------------------------------------ */

const chuoi = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;

/** Kiểm dạng dữ kiện một hồ sơ (không kiểm luật). Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraDuLieuHoSo(h: Partial<HoSoGiayTo> | null | undefined): string[] {
  if (!h || typeof h !== "object") return ["Thiếu hồ sơ."];
  const loi: string[] = [];
  if (!laNgay(h.ngay_kiem_tra)) loi.push("Ngày kiểm tra phải có dạng YYYY-MM-DD.");
  const n = h.nguoi_lai;
  if (!n || !chuoi(n.ho_ten, 3) || !laNgay(n.ngay_sinh) || !chuoi(n.loi_noi, 3))
    loi.push("Người lái cần họ tên, ngày sinh (YYYY-MM-DD) và lời nói.");
  const x = h.xe;
  if (!x || !(PHAN_LOAI_XE as readonly string[]).includes(x.phan_loai)) loi.push("Loại xe không hợp lệ.");
  else {
    if (!chuoi(x.bien_so, 5) || !chuoi(x.nhan_hieu, 2) || !chuoi(x.mau, 2))
      loi.push("Xe cần biển số, nhãn hiệu, màu sơn.");
    if (laMoTo(x.phan_loai) && !(Number.isInteger(x.dung_tich) && (x.dung_tich ?? 0) > 0))
      loi.push("Xe mô tô cần dung tích xi-lanh.");
    if (x.phan_loai === "o_to_con" && !(Number.isInteger(x.so_cho) && (x.so_cho ?? 0) > 0))
      loi.push("Xe ô tô cần số chỗ.");
  }
  const g = h.giay_to;
  if (!g || typeof g !== "object") return [...loi, "Thiếu bộ giấy tờ."];
  if (g.gplx) {
    const p = g.gplx;
    if (!chuoi(p.so, 6) || !chuoi(p.ho_ten, 3) || !laNgay(p.ngay_sinh))
      loi.push("Giấy phép lái xe thiếu số, họ tên hoặc ngày sinh.");
    if (!Array.isArray(p.hang) || !p.hang.length || p.hang.some((x) => !chuoi(x, 1)))
      loi.push("Giấy phép lái xe cần ít nhất một hạng.");
    if (p.co_gia_tri_den !== null && !laNgay(p.co_gia_tri_den))
      loi.push("Thời hạn giấy phép lái xe phải là ngày YYYY-MM-DD hoặc null (không thời hạn).");
  }
  if (g.dang_ky) {
    const d = g.dang_ky;
    if (
      !chuoi(d.so, 3) ||
      !chuoi(d.chu_xe, 3) ||
      !chuoi(d.bien_so, 5) ||
      !chuoi(d.nhan_hieu, 2) ||
      !chuoi(d.mau, 2)
    )
      loi.push("Giấy đăng ký xe thiếu thông tin.");
  }
  if (g.bao_hiem) {
    const b = g.bao_hiem;
    if (!chuoi(b.so, 3) || !chuoi(b.chu_xe, 3) || !chuoi(b.bien_so, 5))
      loi.push("Giấy bảo hiểm thiếu thông tin.");
    if (!laNgay(b.tu_ngay) || !laNgay(b.den_ngay) || b.tu_ngay > b.den_ngay)
      loi.push("Thời hạn bảo hiểm phải là hai ngày YYYY-MM-DD, từ ngày không sau đến ngày.");
  }
  return loi;
}

/* ------------------------------------------------------------------ */
/* Bộ kiểm                                                             */
/* ------------------------------------------------------------------ */

/** Một lỗi bộ kiểm phát hiện, kèm luật làm căn cứ và các chi tiết chỉ ra được lỗi. */
export interface LoiPhatHien {
  ma_loi: MaLoiGiayTo;
  luat_ma: string;
  giay_to: LoaiGiayTo;
  /** Mô tả cụ thể theo hồ sơ, ví dụ "Giấy phép lái xe có giá trị đến 12/09/2026, trước ngày kiểm tra 15/09/2026." */
  mo_ta: string;
  dau_hieu: readonly DauHieu[];
}

const chuanBien = (s: string) => s.toUpperCase().replace(/[\s.-]/g, "");
const chuanChu = (s: string) => s.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

/** Chạy một luật trên hồ sơ. Trả mô tả lỗi, hoặc null khi đạt (hoặc luật không áp dụng). */
function chayLuat(l: LuatGiayTo, h: HoSoGiayTo): string | null {
  const g = h.giay_to;
  const ngay = h.ngay_kiem_tra;
  switch (l.kiem) {
    case "phai_co":
      return l.giay_to && !g[l.giay_to] ? `Người lái không xuất trình ${TEN_NGAN_GIAY_TO[l.giay_to]}.` : null;
    case "con_han": {
      if (l.giay_to === "gplx" && g.gplx) {
        const den = g.gplx.co_gia_tri_den;
        return den && den < ngay
          ? `Giấy phép lái xe có giá trị đến ${ngayVn(den)}, trước ngày kiểm tra ${ngayVn(ngay)}.`
          : null;
      }
      if (l.giay_to === "bao_hiem" && g.bao_hiem) {
        const b = g.bao_hiem;
        if (b.den_ngay < ngay)
          return `Bảo hiểm hết hạn ngày ${ngayVn(b.den_ngay)}, trước ngày kiểm tra ${ngayVn(ngay)}.`;
        if (b.tu_ngay > ngay)
          return `Bảo hiểm bắt đầu có hiệu lực từ ${ngayVn(b.tu_ngay)}, sau ngày kiểm tra ${ngayVn(ngay)}.`;
      }
      return null;
    }
    case "khop_xe": {
      const gt = l.giay_to === "dang_ky" ? g.dang_ky : l.giay_to === "bao_hiem" ? g.bao_hiem : null;
      if (!gt) return null;
      if (l.tham_so.truong === "bien_so" && chuanBien(gt.bien_so) !== chuanBien(h.xe.bien_so))
        return `Biển số trên ${TEN_NGAN_GIAY_TO[l.giay_to!]} là ${gt.bien_so}, biển gắn trên xe là ${h.xe.bien_so}.`;
      if (
        l.tham_so.truong === "nhan_hieu" &&
        "nhan_hieu" in gt &&
        chuanChu(gt.nhan_hieu) !== chuanChu(h.xe.nhan_hieu)
      )
        return `Giấy đăng ký ghi nhãn hiệu ${gt.nhan_hieu}, xe thực tế là ${h.xe.nhan_hieu}.`;
      return null;
    }
    case "khop_nguoi": {
      const p = g.gplx;
      if (!p) return null;
      const n = h.nguoi_lai;
      if (chuanChu(p.ho_ten) !== chuanChu(n.ho_ten))
        return `Giấy phép lái xe mang tên ${p.ho_ten}, người lái tự giới thiệu là ${n.ho_ten}.`;
      if (p.ngay_sinh !== n.ngay_sinh)
        return `Giấy phép lái xe ghi ngày sinh ${ngayVn(p.ngay_sinh)}, người lái khai sinh ngày ${ngayVn(n.ngay_sinh)}.`;
      return null;
    }
    case "hang_gplx": {
      const p = g.gplx;
      if (!p) return null;
      const hop = l.tham_so.hang ?? [];
      return p.hang.some((x) => hop.includes(x))
        ? null
        : `Giấy phép hạng ${p.hang.join(", ")}; loại xe này cần hạng ${hop.join(" hoặc ")}.`;
    }
  }
  return null;
}

/**
 * Chạy các luật trên hồ sơ, chỉ với các lỗi trong `batLoi` (mặc định: mọi lỗi). Mỗi mã lỗi ghi
 * một lần (luật đầu tiên phát hiện). Giấy tờ không có thì không kiểm các lỗi khác của giấy tờ đó.
 */
export function kiemTraHoSo(
  h: HoSoGiayTo,
  luat: readonly LuatGiayTo[],
  batLoi: ReadonlySet<MaLoiGiayTo> = new Set(MA_LOI_GIAY_TO),
): LoiPhatHien[] {
  const kq: LoiPhatHien[] = [];
  const daCo = new Set<MaLoiGiayTo>();
  const sapXep = [...luat].sort(
    (a, b) => MA_LOI_GIAY_TO.indexOf(maLoiCuaLuat(a)!) - MA_LOI_GIAY_TO.indexOf(maLoiCuaLuat(b)!),
  );
  for (const l of sapXep) {
    const ma = maLoiCuaLuat(l);
    if (!ma || !batLoi.has(ma) || daCo.has(ma) || !apDung(l, h.xe.phan_loai)) continue;
    const moTa = chayLuat(l, h);
    if (!moTa) continue;
    daCo.add(ma);
    kq.push({
      ma_loi: ma,
      luat_ma: l.ma,
      giay_to: GIAY_TO_CUA_LOI[ma],
      mo_ta: moTa,
      dau_hieu: DAU_HIEU_CUA_LOI[ma],
    });
  }
  return kq;
}

/**
 * Các lỗi trong `batLoi` áp dụng cho loại xe của hồ sơ mà CHƯA có luật đã duyệt nào. Hồ sơ có lỗi
 * còn thiếu luật thì không chấm được, không dùng.
 */
export function luatConThieu(
  h: HoSoGiayTo,
  luat: readonly LuatGiayTo[],
  batLoi: ReadonlySet<MaLoiGiayTo>,
): MaLoiGiayTo[] {
  const co = new Set(luat.filter((l) => apDung(l, h.xe.phan_loai)).map(maLoiCuaLuat));
  return [...batLoi].filter((m) => !co.has(m));
}

/** Luật áp dụng cho một loại xe (để gói nguồn gọn). */
export function luatChoXe(luat: readonly LuatGiayTo[], p: PhanLoaiXe): LuatGiayTo[] {
  return luat.filter((l) => apDung(l, p) && maLoiCuaLuat(l) !== null);
}

/* ------------------------------------------------------------------ */
/* Sinh hồ sơ ngẫu nhiên                                               */
/* ------------------------------------------------------------------ */

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương", "Lý"];
const DEM_NAM = ["Văn", "Minh", "Đức", "Quốc", "Hữu", "Thành", "Công", "Gia"];
const DEM_NU = ["Thị", "Thu", "Ngọc", "Minh", "Thanh", "Bảo", "Kim", "Mai"];
const TEN_NAM = [
  "An",
  "Bình",
  "Cường",
  "Dũng",
  "Hải",
  "Hùng",
  "Khánh",
  "Long",
  "Nam",
  "Phong",
  "Quang",
  "Sơn",
  "Tuấn",
  "Việt",
];
const TEN_NU = [
  "Anh",
  "Chi",
  "Hà",
  "Hạnh",
  "Hương",
  "Lan",
  "Linh",
  "Ngân",
  "Phương",
  "Thảo",
  "Trang",
  "Vy",
  "Yến",
];
const MA_TINH = ["29", "30", "15", "18", "36", "43", "47", "51", "59", "65", "75", "92"];
const MAU = ["Đen", "Trắng", "Đỏ", "Xanh", "Bạc", "Xám", "Vàng"];

/** Mẫu xe cho từng loại (nhãn hiệu, dung tích hoặc số chỗ). Chỉ để hồ sơ trông thật. */
const MAU_XE: Record<
  PhanLoaiXe,
  Array<{ nhan_hieu: string; dung_tich: number | null; so_cho: number | null }>
> = {
  mo_to_nho: [
    { nhan_hieu: "Honda Wave Alpha", dung_tich: 110, so_cho: null },
    { nhan_hieu: "Honda Vision", dung_tich: 110, so_cho: null },
    { nhan_hieu: "Yamaha Sirius", dung_tich: 110, so_cho: null },
    { nhan_hieu: "Honda Air Blade", dung_tich: 125, so_cho: null },
    { nhan_hieu: "Yamaha Janus", dung_tich: 125, so_cho: null },
    { nhan_hieu: "Suzuki Raider", dung_tich: 115, so_cho: null },
  ],
  mo_to_lon: [
    { nhan_hieu: "Honda SH 160i", dung_tich: 156, so_cho: null },
    { nhan_hieu: "Yamaha Exciter", dung_tich: 155, so_cho: null },
    { nhan_hieu: "Honda Winner X", dung_tich: 150, so_cho: null },
    { nhan_hieu: "Yamaha NVX", dung_tich: 155, so_cho: null },
  ],
  o_to_con: [
    { nhan_hieu: "Toyota Vios", dung_tich: null, so_cho: 5 },
    { nhan_hieu: "Hyundai Accent", dung_tich: null, so_cho: 5 },
    { nhan_hieu: "Kia Morning", dung_tich: null, so_cho: 5 },
    { nhan_hieu: "Mitsubishi Xpander", dung_tich: null, so_cho: 7 },
    { nhan_hieu: "Honda City", dung_tich: null, so_cho: 5 },
    { nhan_hieu: "Mazda 3", dung_tich: null, so_cho: 5 },
  ],
};

const chon = <T>(ds: readonly T[], rng: () => number): T => ds[Math.floor(rng() * ds.length)]!;
const soNgauNhien = (tu: number, den: number, rng: () => number) => tu + Math.floor(rng() * (den - tu + 1));
const chuSo = (n: number, rng: () => number) =>
  Array.from({ length: n }, () => soNgauNhien(0, 9, rng)).join("");

function sinhBienSo(p: PhanLoaiXe, rng: () => number): string {
  const tinh = chon(MA_TINH, rng);
  const so = chuSo(5, rng);
  if (laMoTo(p)) {
    const seri = `${chon(["B", "C", "D", "E", "F", "G", "H", "K", "L", "M", "N", "P"], rng)}${soNgauNhien(1, 9, rng)}`;
    return `${tinh}-${seri} ${so.slice(0, 3)}.${so.slice(3)}`;
  }
  const seri = chon(["A", "C", "D", "E", "F", "G", "H", "K"], rng);
  return `${tinh}${seri}-${so.slice(0, 3)}.${so.slice(3)}`;
}

/** Đổi đúng một chữ số của biển (lỗi tinh vi). */
function doiMotSo(bien: string, rng: () => number): string {
  const viTri = [...bien].map((c, i) => (/\d/.test(c) && i > 3 ? i : -1)).filter((i) => i >= 0);
  const i = chon(viTri, rng);
  const cu = Number(bien[i]);
  const moi = (cu + soNgauNhien(1, 8, rng)) % 10;
  return bien.slice(0, i) + String(moi) + bien.slice(i + 1);
}

function sinhNguoi(rng: () => number, ngayKiemTra: string): { ho_ten: string; ngay_sinh: string } {
  const nu = rng() < 0.4;
  const ho_ten = `${chon(HO, rng)} ${chon(nu ? DEM_NU : DEM_NAM, rng)} ${chon(nu ? TEN_NU : TEN_NAM, rng)}`;
  const nam = Number(ngayKiemTra.slice(0, 4)) - soNgauNhien(20, 58, rng);
  const ngay_sinh = `${nam}-${String(soNgauNhien(1, 12, rng)).padStart(2, "0")}-${String(soNgauNhien(1, 28, rng)).padStart(2, "0")}`;
  return { ho_ten, ngay_sinh };
}

function loiNoi(ho_ten: string, ngay_sinh: string, rng: () => number): string {
  const mo = chon(
    ["Chào anh, giấy tờ của tôi đây.", "Dạ, tôi gửi giấy tờ ạ.", "Anh kiểm tra giúp tôi."],
    rng,
  );
  return `${mo} Tôi là ${ho_ten}, sinh ngày ${ngayVn(ngay_sinh)}.`;
}

export interface TuyChonSinhHoSo {
  /** Các lỗi hồ sơ phải có (đúng các lỗi này, không thêm). Rỗng: hồ sơ hợp lệ. */
  loi: readonly MaLoiGiayTo[];
  ngayKiemTra: string;
  /** Luật đã duyệt dùng để chọn hạng hợp lệ và để tự kiểm hồ sơ vừa sinh. */
  luat: readonly LuatGiayTo[];
  /** Ép loại xe; bỏ trống thì chọn loại hợp với các lỗi. */
  phanLoai?: PhanLoaiXe;
  /**
   * Lỗi tinh vi: hết hạn đúng một ngày, biển lệch một chữ số, giấy phép của người trùng tên khác
   * ngày sinh; hồ sơ hợp lệ thì có chi tiết "sát biên" (hết hạn đúng ngày kiểm tra).
   */
  tinhVi?: boolean;
}

/** Hạng dùng được và hạng không dùng được cho một loại xe, theo luật `hang_gplx` đã duyệt. */
function hangTheoLuat(luat: readonly LuatGiayTo[], p: PhanLoaiXe): { dung: string[]; sai: string[] } | null {
  const l = luat.find((x) => x.kiem === "hang_gplx" && apDung(x, p) && x.phan_loai.length > 0);
  if (!l?.tham_so.hang?.length) return null;
  const moi = new Set(luat.filter((x) => x.kiem === "hang_gplx").flatMap((x) => x.tham_so.hang ?? []));
  return { dung: l.tham_so.hang, sai: [...moi].filter((h) => !l.tham_so.hang!.includes(h)) };
}

/** Loại xe hợp với các lỗi yêu cầu. */
function chonPhanLoai(o: TuyChonSinhHoSo, rng: () => number): PhanLoaiXe {
  if (o.phanLoai) return o.phanLoai;
  // Giấy phép có thời hạn chỉ ở ô tô trong bộ mẫu (xe mô tô: giấy phép không thời hạn).
  if (o.loi.includes("gplx_ngoai_han")) return "o_to_con";
  if (o.loi.includes("gplx_sai_hang"))
    return o.tinhVi ? "mo_to_lon" : chon(["o_to_con", "mo_to_lon"] as const, rng);
  return chon(PHAN_LOAI_XE, rng);
}

function sinhMotLan(o: TuyChonSinhHoSo, rng: () => number): HoSoGiayTo {
  const ngay = o.ngayKiemTra;
  const co = (m: MaLoiGiayTo) => o.loi.includes(m);
  const p = chonPhanLoai(o, rng);
  const mau = chon(MAU_XE[p], rng);
  const nguoi = sinhNguoi(rng, ngay);
  const xe: XeKiemTra = {
    phan_loai: p,
    bien_so: sinhBienSo(p, rng),
    nhan_hieu: mau.nhan_hieu,
    mau: chon(MAU, rng),
    dung_tich: mau.dung_tich,
    so_cho: mau.so_cho,
  };

  // Giấy phép lái xe.
  const hang = hangTheoLuat(o.luat, p);
  const hangDung = hang?.dung.length ? [hang.dung[0]!] : [laMoTo(p) ? "A" : "B"];
  let hangGp = hangDung;
  if (co("gplx_sai_hang")) {
    // Tinh vi: mô tô lớn mà giấy phép chỉ hạng cho mô tô nhỏ; phải đọc dung tích trên đăng ký.
    const sai = hang?.sai ?? [];
    const uuTien = sai.filter((h) => h.startsWith("A"));
    hangGp = [chon(uuTien.length ? uuTien : sai.length ? sai : ["A1"], rng)];
  }
  const coThoiHan = !laMoTo(p);
  let den: string | null = coThoiHan ? congNgayLich(ngay, soNgauNhien(60, 3000, rng)) : null;
  if (co("gplx_ngoai_han")) den = congNgayLich(ngay, o.tinhVi ? -1 : -soNgauNhien(20, 900, rng));
  else if (o.tinhVi && coThoiHan && rng() < 0.6) den = ngay; // hết hạn đúng hôm nay: vẫn còn giá trị
  let gpNguoi = { ...nguoi };
  if (co("gplx_nguoi_khac")) {
    gpNguoi = o.tinhVi
      ? { ho_ten: nguoi.ho_ten, ngay_sinh: congNgayLich(nguoi.ngay_sinh, soNgauNhien(400, 3000, rng)) }
      : sinhNguoi(rng, ngay);
    if (gpNguoi.ho_ten === nguoi.ho_ten && gpNguoi.ngay_sinh === nguoi.ngay_sinh)
      gpNguoi.ngay_sinh = congNgayLich(nguoi.ngay_sinh, 731);
  }
  const gplx: GiayPhepLaiXe = {
    so: chuSo(12, rng),
    ho_ten: gpNguoi.ho_ten,
    ngay_sinh: gpNguoi.ngay_sinh,
    hang: hangGp,
    co_gia_tri_den: den,
  };

  // Đăng ký xe. Chủ xe luôn là người lái: trò không dạy tình huống xe của người khác (chưa có căn cứ).
  const bienDk = co("dang_ky_sai_bien_so")
    ? o.tinhVi
      ? doiMotSo(xe.bien_so, rng)
      : sinhBienSo(p, rng)
    : xe.bien_so;
  const nhanDk = co("dang_ky_sai_nhan_hieu")
    ? chon(
        MAU_XE[p].filter((m) => m.nhan_hieu !== xe.nhan_hieu),
        rng,
      ).nhan_hieu
    : xe.nhan_hieu;
  const dang_ky: DangKyXe = {
    so: chuSo(6, rng),
    chu_xe: nguoi.ho_ten,
    bien_so: bienDk,
    nhan_hieu: nhanDk,
    mau: xe.mau,
    dung_tich: xe.dung_tich,
    so_cho: xe.so_cho,
  };

  // Bảo hiểm: một năm.
  let tu = congNgayLich(ngay, -soNgauNhien(10, 300, rng));
  if (co("bao_hiem_ngoai_han")) {
    if (o.tinhVi && rng() < 0.5)
      tu = congNgayLich(ngay, 1); // chưa tới ngày có hiệu lực
    else tu = congNgayLich(ngay, -(365 + (o.tinhVi ? 1 : soNgauNhien(5, 200, rng))));
  } else if (o.tinhVi && rng() < 0.4) tu = congNgayLich(ngay, -364); // hết hạn đúng hôm nay: vẫn còn hiệu lực
  const bienBh = co("bao_hiem_sai_bien_so")
    ? o.tinhVi
      ? doiMotSo(xe.bien_so, rng)
      : sinhBienSo(p, rng)
    : xe.bien_so;
  const bao_hiem: BaoHiemXe = {
    so: `BH${chuSo(8, rng)}`,
    chu_xe: nguoi.ho_ten,
    bien_so: bienBh,
    tu_ngay: tu,
    den_ngay: congNgayLich(tu, 364),
  };

  return {
    ngay_kiem_tra: ngay,
    nguoi_lai: { ...nguoi, loi_noi: loiNoi(nguoi.ho_ten, nguoi.ngay_sinh, rng) },
    xe,
    giay_to: {
      gplx: co("thieu_gplx") ? null : gplx,
      dang_ky: co("thieu_dang_ky") ? null : dang_ky,
      bao_hiem: co("thieu_bao_hiem") ? null : bao_hiem,
    },
  };
}

/**
 * Sinh một hồ sơ có ĐÚNG các lỗi yêu cầu (tự kiểm bằng `kiemTraHoSo` với `luat`). Dùng để soạn hồ
 * sơ mẫu (scripts/sinh-ho-so-giay-to.ts) và cho các trò khác cần người lái có giấy tờ.
 * Không sinh được sau nhiều lần thử (thiếu luật cho lỗi yêu cầu) thì ném lỗi.
 */
export function sinhHoSo(o: TuyChonSinhHoSo, rng: () => number): HoSoGiayTo {
  const muon = [...new Set(o.loi)].sort();
  for (let lan = 0; lan < 50; lan++) {
    const h = sinhMotLan(o, rng);
    const co = kiemTraHoSo(h, o.luat)
      .map((l) => l.ma_loi)
      .sort();
    if (co.length === muon.length && co.every((m, i) => m === muon[i])) return h;
  }
  throw new Error(
    `Không sinh được hồ sơ có đúng các lỗi: ${muon.join(", ") || "(hợp lệ)"}. Kiểm lại luật đã duyệt.`,
  );
}

/* ------------------------------------------------------------------ */
/* Giấy tờ xe tải (GĐ-T12; T14 dùng lại giấy chứng nhận kiểm định)     */
/* ------------------------------------------------------------------ */

/**
 * Phiếu cân, giấy chứng nhận kiểm định, giấy phép lưu hành xe quá tải trọng. Tách khỏi `LoaiGiayTo`
 * (giấy tờ người lái của trò 1, 4) để bộ kiểm và thẻ giấy tờ của trò 1 không đổi.
 */
export const LOAI_GIAY_TO_XE_TAI = ["phieu_can", "giay_kiem_dinh", "giay_phep_luu_hanh"] as const;
export type LoaiGiayToXeTai = (typeof LOAI_GIAY_TO_XE_TAI)[number];

export const TEN_GIAY_TO_XE_TAI: Record<LoaiGiayToXeTai, string> = {
  phieu_can: "Phiếu cân",
  giay_kiem_dinh: "Giấy chứng nhận kiểm định",
  giay_phep_luu_hanh: "Giấy phép lưu hành xe quá tải trọng",
};

/** Phiếu cân: tổng trọng lượng và tải trọng từng nhóm trục (trục đơn hoặc cụm trục), từ trước ra sau. */
export interface PhieuCan {
  so: string;
  ngay_can: string;
  tong_kg: number;
  truc_kg: number[];
}

/** Giấy chứng nhận kiểm định (phần khối lượng; phần thông số kỹ thuật từ GĐ-T14). */
export interface GiayKiemDinh {
  so: string;
  bien_so: string;
  tu_trong_kg: number;
  hang_cho_phep_kg: number;
  toan_bo_cho_phep_kg: number;
  co_gia_tri_den: string;
  /** Thông số kỹ thuật (GĐ-T14). Trạm cân không dùng. */
  thong_so?: ThongSoKyThuat;
}

/** Kích thước dài × rộng × cao (mm). */
export interface KichThuocMm {
  dai_mm: number;
  rong_mm: number;
  cao_mm: number;
}

/**
 * Thông số kỹ thuật ghi trên giấy chứng nhận kiểm định (GĐ-T14, trò Soi xe cải tạo): kích thước bao,
 * kích thước thùng (xe có thùng), cỡ lốp, số chỗ, màu sơn, đèn.
 */
export interface ThongSoKyThuat {
  kich_thuoc_bao: KichThuocMm;
  kich_thuoc_thung: KichThuocMm | null;
  co_lop: string;
  so_cho: number;
  mau_son: string;
  den: string;
}

/** Dòng thông số trên giấy, theo thứ tự in (mã dòng dùng để nối cặp với vùng khoanh). */
export const DONG_THONG_SO = [
  "kich_thuoc_bao",
  "kich_thuoc_thung",
  "co_lop",
  "so_cho",
  "mau_son",
  "den",
] as const;
export type DongThongSo = (typeof DONG_THONG_SO)[number];
export const TEN_DONG_THONG_SO: Record<DongThongSo, string> = {
  kich_thuoc_bao: "Kích thước bao (D × R × C)",
  kich_thuoc_thung: "Kích thước lòng thùng (D × R × C)",
  co_lop: "Cỡ lốp",
  so_cho: "Số người cho phép chở",
  mau_son: "Màu sơn",
  den: "Đèn chiếu sáng, tín hiệu",
};

const kichThuocHopLe = (k: Partial<KichThuocMm> | null | undefined) =>
  !!k &&
  [k.dai_mm, k.rong_mm, k.cao_mm].every(
    (v) => Number.isInteger(v) && (v as number) >= 300 && (v as number) <= 20_000,
  );

/** Kiểm dạng phần thông số kỹ thuật. Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraThongSoKyThuat(t: Partial<ThongSoKyThuat> | null | undefined): string[] {
  if (!t || typeof t !== "object") return ["Thiếu thông số kỹ thuật."];
  const loi: string[] = [];
  if (!kichThuocHopLe(t.kich_thuoc_bao)) loi.push("Kích thước bao cần dài, rộng, cao (mm, 300 đến 20.000).");
  if (t.kich_thuoc_thung !== null && !kichThuocHopLe(t.kich_thuoc_thung))
    loi.push("Kích thước thùng cần dài, rộng, cao (mm), hoặc null với xe không có thùng.");
  if (!chuoi(t.co_lop, 5)) loi.push("Thiếu cỡ lốp.");
  if (!Number.isInteger(t.so_cho) || (t.so_cho as number) < 1 || (t.so_cho as number) > 60)
    loi.push("Số người cho phép chở phải từ 1 đến 60.");
  if (!chuoi(t.mau_son, 2) || !chuoi(t.den, 3)) loi.push("Thiếu màu sơn hoặc mô tả đèn.");
  return loi;
}

/** Giấy phép lưu hành xe quá tải trọng: tuyến, thời hạn, tải trọng được phép. */
export interface GiayPhepLuuHanh {
  so: string;
  bien_so: string;
  tuyen: string;
  tu_ngay: string;
  den_ngay: string;
  tong_cho_phep_kg: number;
  truc_don_cho_phep_kg: number;
  cum_truc_cho_phep_kg: number;
}

const soKg = (v: unknown) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 200_000;

/** Kiểm dạng bộ giấy tờ xe tải. `soNhomTruc`: số nhóm trục của xe (phiếu cân phải có đủ). */
export function kiemTraGiayToXeTai(
  g: {
    phieu_can?: Partial<PhieuCan>;
    giay_kiem_dinh?: Partial<GiayKiemDinh>;
    giay_phep_luu_hanh?: Partial<GiayPhepLuuHanh> | null;
  },
  soNhomTruc: number,
): string[] {
  const loi: string[] = [];
  const p = g.phieu_can;
  if (!p || !chuoi(p.so, 3) || !laNgay(p.ngay_can) || !soKg(p.tong_kg))
    loi.push("Phiếu cân cần số phiếu, ngày cân (YYYY-MM-DD), tổng trọng lượng (kg).");
  else if (!Array.isArray(p.truc_kg) || p.truc_kg.length !== soNhomTruc || !p.truc_kg.every(soKg))
    loi.push(`Phiếu cân cần tải trọng của đủ ${soNhomTruc} nhóm trục (kg).`);
  const k = g.giay_kiem_dinh;
  if (
    !k ||
    !chuoi(k.so, 3) ||
    !chuoi(k.bien_so, 5) ||
    !laNgay(k.co_gia_tri_den) ||
    ![k.tu_trong_kg, k.hang_cho_phep_kg, k.toan_bo_cho_phep_kg].every(soKg)
  )
    loi.push("Giấy kiểm định cần số, biển số, thời hạn và ba khối lượng (tự trọng, hàng, toàn bộ).");
  else if (k.tu_trong_kg! + k.hang_cho_phep_kg! > k.toan_bo_cho_phep_kg!)
    loi.push("Giấy kiểm định: tự trọng cộng hàng cho phép không được lớn hơn khối lượng toàn bộ cho phép.");
  const l = g.giay_phep_luu_hanh;
  if (l) {
    if (!chuoi(l.so, 3) || !chuoi(l.bien_so, 5) || !chuoi(l.tuyen, 3))
      loi.push("Giấy phép lưu hành cần số, biển số, tuyến.");
    if (!laNgay(l.tu_ngay) || !laNgay(l.den_ngay) || l.tu_ngay! > l.den_ngay!)
      loi.push("Giấy phép lưu hành cần thời hạn: từ ngày không sau đến ngày.");
    if (![l.tong_cho_phep_kg, l.truc_don_cho_phep_kg, l.cum_truc_cho_phep_kg].every(soKg))
      loi.push("Giấy phép lưu hành cần tổng trọng lượng, trục đơn, cụm trục được phép (kg).");
  }
  return loi;
}

/* ------------------------------------------------------------------ */
/* Giấy tờ vận tải hành khách, nhóm luật `van_tai_khach` (GĐ-T13)       */
/* ------------------------------------------------------------------ */

/**
 * Lệnh vận chuyển, phù hiệu, dữ liệu thiết bị giám sát hành trình. Tách khỏi `LoaiGiayTo` (giấy tờ người
 * lái của trò 1, 4) như giấy tờ xe tải. Trò Lên xe khách không kiểm giấy phép lái xe, đăng ký, bảo hiểm
 * (câu D20).
 */
export const LOAI_GIAY_TO_VAN_TAI = ["lenh_van_chuyen", "phu_hieu", "giam_sat_hanh_trinh"] as const;
export type LoaiGiayToVanTai = (typeof LOAI_GIAY_TO_VAN_TAI)[number];

export const TEN_GIAY_TO_VAN_TAI: Record<LoaiGiayToVanTai, string> = {
  lenh_van_chuyen: "Lệnh vận chuyển",
  phu_hieu: "Phù hiệu",
  giam_sat_hanh_trinh: "Thiết bị giám sát hành trình",
};

export interface LenhVanChuyen {
  so: string;
  don_vi: string;
  bien_so: string;
  lai_xe: string;
  /** Ngày thực hiện chuyến (YYYY-MM-DD). */
  ngay: string;
  tuyen: string;
}

export interface PhuHieu {
  so: string;
  /** Loại phù hiệu ghi trên phù hiệu, ví dụ "Xe tuyến cố định". Chỉ để đọc, không kiểm. */
  loai: string;
  bien_so: string;
  co_gia_tri_den: string;
}

/** Một đoạn trên thiết bị giám sát: xe chạy hoặc dừng từ `tu` tới `den` ("HH:mm", trong một ngày). */
export interface DoanHanhTrinh {
  tu: string;
  den: string;
  chay: boolean;
}

export interface GiamSatHanhTrinh {
  thiet_bi: string;
  ngay: string;
  /** Các đoạn liền nhau, theo thứ tự thời gian. */
  doan: DoanHanhTrinh[];
  /** Tốc độ lớn nhất thiết bị ghi được. Chỉ để đọc: chưa có căn cứ dùng làm lỗi (GAME_DESIGN §5.13). */
  toc_do_toi_da_kmh: number;
}

const GIO_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const laGio = (s: unknown): s is string => typeof s === "string" && GIO_RE.test(s);
/** "07:45" → 465. */
export const phutCuaGio = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** Kiểm dạng bộ giấy tờ vận tải hành khách. Lệnh và phù hiệu có thể vắng (null): đó là lỗi "không có". */
export function kiemTraGiayToVanTai(g: {
  lenh_van_chuyen?: Partial<LenhVanChuyen> | null;
  phu_hieu?: Partial<PhuHieu> | null;
  giam_sat_hanh_trinh?: Partial<GiamSatHanhTrinh>;
}): string[] {
  const loi: string[] = [];
  const l = g.lenh_van_chuyen;
  if (l && (![l.so, l.don_vi, l.tuyen, l.lai_xe].every((v) => chuoi(v, 3)) || !chuoi(l.bien_so, 5)))
    loi.push("Lệnh vận chuyển cần số, đơn vị, biển số, tên lái xe, tuyến.");
  if (l && !laNgay(l.ngay)) loi.push("Lệnh vận chuyển cần ngày thực hiện (YYYY-MM-DD).");
  const p = g.phu_hieu;
  if (p && (!chuoi(p.so, 3) || !chuoi(p.loai, 3) || !chuoi(p.bien_so, 5) || !laNgay(p.co_gia_tri_den)))
    loi.push("Phù hiệu cần số, loại, biển số, thời hạn (YYYY-MM-DD).");
  const s = g.giam_sat_hanh_trinh;
  if (!s || !chuoi(s.thiet_bi, 3) || !laNgay(s.ngay))
    return [...loi, "Dữ liệu giám sát cần mã thiết bị và ngày."];
  const tocDo = s.toc_do_toi_da_kmh;
  if (!Number.isInteger(tocDo) || (tocDo as number) < 0 || (tocDo as number) > 200)
    loi.push("Tốc độ lớn nhất phải là số nguyên từ 0 đến 200 km/h.");
  const d = s.doan;
  if (!Array.isArray(d) || !d.length || d.length > 40) return [...loi, "Dữ liệu giám sát cần 1 đến 40 đoạn."];
  for (const [i, x] of d.entries()) {
    if (
      !x ||
      !laGio(x.tu) ||
      !laGio(x.den) ||
      typeof x.chay !== "boolean" ||
      phutCuaGio(x.tu) >= phutCuaGio(x.den)
    ) {
      loi.push(`Đoạn ${i + 1} cần giờ bắt đầu trước giờ kết thúc (HH:mm) và trạng thái chạy hoặc dừng.`);
      break;
    }
    if (i > 0 && d[i - 1]!.den !== x.tu) {
      loi.push(`Đoạn ${i + 1} phải bắt đầu đúng lúc đoạn trước kết thúc.`);
      break;
    }
  }
  return loi;
}

/**
 * Kiểu kiểm của nhóm `van_tai_khach`. Bộ chạy luật ở tro-choi/len-xe-khach.ts.
 *  - `so_nguoi` (khoang_xe): số người trên xe không vượt số chỗ hành khách;
 *  - `tre_em` (khoang_xe): cách quy đổi trẻ em khi tính số người (`so_tre` trẻ tính bằng `bang_nguoi`
 *    người, làm tròn `lam_tron`). Không phải lỗi; chưa có luật này đã duyệt thì xe có trẻ em không vào lượt;
 *  - `phai_co`, `khop_xe` (biển số), `khop_lai_xe`, `dung_ngay` (lệnh vận chuyển), `con_han` (phù hiệu);
 *  - `lai_lien_tuc`, `lai_trong_ngay` (giám sát): ngưỡng `toi_da_phut`; lần dừng ngắn hơn
 *    `nghi_toi_thieu_phut` không ngắt thời gian lái liên tục. Đúng bằng ngưỡng là không vượt.
 */
export const KIEU_KIEM_VAN_TAI = [
  "so_nguoi",
  "tre_em",
  "phai_co",
  "khop_xe",
  "khop_lai_xe",
  "dung_ngay",
  "con_han",
  "lai_lien_tuc",
  "lai_trong_ngay",
] as const;
export type KieuKiemVanTai = (typeof KIEU_KIEM_VAN_TAI)[number];

/** Phần được kiểm (cột `doc_kind` của nhóm này). */
export const PHAN_VAN_TAI = ["khoang_xe", ...LOAI_GIAY_TO_VAN_TAI] as const;
export type PhanVanTai = (typeof PHAN_VAN_TAI)[number];

/** Lỗi mà luật nhóm `van_tai_khach` phát hiện, theo thứ tự kiểm. */
export const LOI_VAN_TAI = [
  "cho_qua_nguoi",
  "thieu_lenh_van_chuyen",
  "lenh_sai_xe",
  "lenh_sai_lai_xe",
  "lenh_sai_ngay",
  "thieu_phu_hieu",
  "phu_hieu_het_han",
  "phu_hieu_sai_xe",
  "lai_lien_tuc_qua_gio",
  "lai_trong_ngay_qua_gio",
] as const;
export type MaLoiVanTai = (typeof LOI_VAN_TAI)[number];

const LOI_THEO_KIEU_VAN_TAI: Readonly<Record<string, MaLoiVanTai>> = {
  "so_nguoi/khoang_xe": "cho_qua_nguoi",
  "phai_co/lenh_van_chuyen": "thieu_lenh_van_chuyen",
  "khop_xe/lenh_van_chuyen": "lenh_sai_xe",
  "khop_lai_xe/lenh_van_chuyen": "lenh_sai_lai_xe",
  "dung_ngay/lenh_van_chuyen": "lenh_sai_ngay",
  "phai_co/phu_hieu": "thieu_phu_hieu",
  "con_han/phu_hieu": "phu_hieu_het_han",
  "khop_xe/phu_hieu": "phu_hieu_sai_xe",
  "lai_lien_tuc/giam_sat_hanh_trinh": "lai_lien_tuc_qua_gio",
  "lai_trong_ngay/giam_sat_hanh_trinh": "lai_trong_ngay_qua_gio",
};

export interface ThamSoVanTai {
  toi_da_phut?: number;
  nghi_toi_thieu_phut?: number;
  so_tre?: number;
  bang_nguoi?: number;
  lam_tron?: "len" | "xuong";
}

/** Một luật vận tải hành khách đã duyệt (dòng `document_rules`, nhóm `van_tai_khach`). */
export interface LuatVanTaiKhach {
  ma: string;
  version: number;
  nhom: "van_tai_khach";
  kiem: KieuKiemVanTai;
  phan: PhanVanTai;
  tham_so: ThamSoVanTai;
  ten: string;
  giai_thich: string;
  can_cu: string;
  ma_muc_phat: string | null;
}

/** Lỗi mà một luật vận tải phát hiện; luật cách tính trẻ em và cặp không hợp lệ trả null. */
export function loiVanTaiCuaLuat(l: Pick<LuatVanTaiKhach, "kiem" | "phan">): MaLoiVanTai | null {
  return LOI_THEO_KIEU_VAN_TAI[`${l.kiem}/${l.phan}`] ?? null;
}

export const laLuatTreEm = (l: Pick<LuatVanTaiKhach, "kiem" | "phan">) =>
  l.kiem === "tre_em" && l.phan === "khoang_xe";

const soNguyenTrong = (v: unknown, tu: number, den: number) =>
  Number.isInteger(v) && (v as number) >= tu && (v as number) <= den;

function kiemTraLuatVanTai(l: Partial<LuatVanTaiKhach>): string[] {
  const loi: string[] = [];
  if (!(KIEU_KIEM_VAN_TAI as readonly string[]).includes(l.kiem as string))
    loi.push("Kiểu kiểm không hợp lệ với nhóm vận tải hành khách.");
  if (!(PHAN_VAN_TAI as readonly string[]).includes(l.phan as string))
    loi.push("Phần được kiểm không hợp lệ.");
  const t = l.tham_so;
  if (!t || typeof t !== "object") loi.push("Thiếu tham số.");
  else if (l.kiem && l.phan && !laLuatTreEm(l as LuatVanTaiKhach) && !loiVanTaiCuaLuat(l as LuatVanTaiKhach))
    loi.push("Luật không ứng với lỗi nào: kiểm lại kiểu kiểm và phần được kiểm.");
  else if (l.kiem === "lai_lien_tuc" || l.kiem === "lai_trong_ngay") {
    if (!soNguyenTrong(t.toi_da_phut, 1, 1440))
      loi.push("Luật thời gian lái cần ngưỡng toi_da_phut (số phút, 1 đến 1440).");
    if (l.kiem === "lai_lien_tuc" && !soNguyenTrong(t.nghi_toi_thieu_phut, 0, 600))
      loi.push("Luật lái liên tục cần thời gian nghỉ tối thiểu nghi_toi_thieu_phut (0 đến 600 phút).");
  } else if (l.kiem === "tre_em") {
    if (!soNguyenTrong(t.so_tre, 1, 10) || !soNguyenTrong(t.bang_nguoi, 1, 10))
      loi.push("Luật trẻ em cần so_tre và bang_nguoi (số nguyên 1 đến 10).");
    // Giới hạn của tham số, không phải cách tính: một trẻ em không tính hơn một người.
    else if ((t.bang_nguoi as number) > (t.so_tre as number))
      loi.push("Luật trẻ em: bang_nguoi không được lớn hơn so_tre.");
    if (t.lam_tron !== "len" && t.lam_tron !== "xuong")
      loi.push("Luật trẻ em cần cách làm tròn (len, xuong).");
  }
  kiemTruongChung(l, loi);
  return loi;
}
