/**
 * Mô hình luật tài liệu (`document_rules`): luật giấy tờ người lái, hồ sơ phạt nguội và vận tải
 * hành khách.
 *
 * Ba nhóm luật dùng chung, mỗi nhóm có bộ kiểu kiểm và phần được kiểm riêng:
 *  - `giay_to_nguoi_lai` (mặc định): giấy phép lái xe, giấy đăng ký xe, giấy bảo hiểm;
 *  - `ho_so_phat_nguoi`: hồ sơ vi phạm bị phát nguội;
 *  - `van_tai_khach`: lệnh vận chuyển, phù hiệu, thiết bị giám sát hành trình.
 *
 * Luật được nạp từ `data/tra-cuu/*.json` và kiểm dạng trước khi nạp vào CSDL; một luật sửa nội
 * dung thì về chờ duyệt.
 */

/* ------------------------------------------------------------------ */
/* Giấy tờ người lái                                                    */
/* ------------------------------------------------------------------ */

export const LOAI_GIAY_TO = ["gplx", "dang_ky", "bao_hiem"] as const;
export type LoaiGiayTo = (typeof LOAI_GIAY_TO)[number];

export const TEN_GIAY_TO: Record<LoaiGiayTo, string> = {
  gplx: "Giấy phép lái xe",
  dang_ky: "Giấy đăng ký xe",
  bao_hiem: "Giấy chứng nhận bảo hiểm bắt buộc",
};

export const TEN_NGAN_GIAY_TO: Record<LoaiGiayTo, string> = {
  gplx: "Giấy phép lái xe",
  dang_ky: "Đăng ký xe",
  bao_hiem: "Bảo hiểm",
};

export const PHAN_LOAI_XE = ["mo_to_nho", "mo_to_lon", "o_to_con"] as const;
export type PhanLoaiXe = (typeof PHAN_LOAI_XE)[number];

export const TEN_PHAN_LOAI_XE: Record<PhanLoaiXe, string> = {
  mo_to_nho: "Xe máy nhỏ dưới 175 cm³",
  mo_to_lon: "Xe máy lớn từ 175 cm³ trở lên",
  o_to_con: "Ô tô con",
};

export const laMoTo = (p: PhanLoaiXe) => p === "mo_to_nho" || p === "mo_to_lon";

/**
 * Kiểu phép kiểm:
 *  - `phai_co`: người lái phải xuất trình giấy tờ `giay_to`;
 *  - `con_han`: giấy tờ `giay_to` phải còn giá trị tại ngày kiểm tra;
 *  - `khop_xe`: trường `tham_so.truong` của giấy tờ phải khớp với xe;
 *  - `khop_nguoi`: giấy phép lái xe phải đúng người lái;
 *  - `hang_gplx`: giấy phép lái xe phải có một trong các hạng `tham_so.hang` cho loại xe `phan_loai`.
 */
export const KIEU_KIEM = ["phai_co", "con_han", "khop_xe", "khop_nguoi", "hang_gplx"] as const;
export type KieuKiem = (typeof KIEU_KIEM)[number];

export const TRUONG_KHOP_XE = ["bien_so", "nhan_hieu"] as const;
export type TruongKhopXe = (typeof TRUONG_KHOP_XE)[number];

/** Nhóm luật trong `document_rules`. Vắng `nhom` là nhóm giấy tờ người lái. */
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

/* ------------------------------------------------------------------ */
/* Hồ sơ phạt nguội                                                     */
/* ------------------------------------------------------------------ */

/** Kiểu kiểm của nhóm hồ sơ phạt nguội. */
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

/** Chỗ thiếu mà một luật phát hiện, theo thứ tự kiểm. */
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

/* ------------------------------------------------------------------ */
/* Vận tải hành khách                                                  */
/* ------------------------------------------------------------------ */

/** Giấy tờ vận tải: lệnh vận chuyển, phù hiệu, thiết bị giám sát hành trình. */
export const LOAI_GIAY_TO_VAN_TAI = ["lenh_van_chuyen", "phu_hieu", "giam_sat_hanh_trinh"] as const;
export type LoaiGiayToVanTai = (typeof LOAI_GIAY_TO_VAN_TAI)[number];

export const TEN_GIAY_TO_VAN_TAI: Record<LoaiGiayToVanTai, string> = {
  lenh_van_chuyen: "Lệnh vận chuyển",
  phu_hieu: "Phù hiệu",
  giam_sat_hanh_trinh: "Thiết bị giám sát hành trình",
};

/**
 * Kiểu kiểm của nhóm `van_tai_khach`:
 *  - `so_nguoi` (khoang_xe): số người trên xe không vượt số chỗ hành khách;
 *  - `tre_em` (khoang_xe): cách quy đổi trẻ em khi tính số người;
 *  - `phai_co`, `khop_xe` (biển số), `khop_lai_xe`, `dung_ngay` (lệnh vận chuyển), `con_han` (phù hiệu);
 *  - `lai_lien_tuc`, `lai_trong_ngay` (giám sát): ngưỡng `toi_da_phut`.
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

/* ------------------------------------------------------------------ */
/* Kiểm dạng luật                                                       */
/* ------------------------------------------------------------------ */

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
  if (l.kiem === "hang_gplx" && (!Array.isArray(l.phan_loai) || l.phan_loai.length === 0))
    loi.push("Luật hạng giấy phép phải ghi loại xe áp dụng.");
  kiemTruongChung(l, loi);
  return loi;
}

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
