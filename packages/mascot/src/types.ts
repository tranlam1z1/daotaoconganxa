/**
 * Kiểu dữ liệu của bộ nhân vật đồng hành (ke-hoach/09-b).
 *
 * Nhân vật là DỮ LIỆU: quản trị viên thêm nhân vật mới mà không cần triển khai lại. Tệp này
 * chỉ khai không gian giá trị hợp lệ (trạng thái, tư thế, trang phục, đạo cụ, hiệu ứng, bộ
 * kích hoạt) để renderer, bộ chọn hành động và màn hình quản trị không lệch nhau.
 */

/* ------------------------------------------------------------------ */
/* Không gian tạo hình                                                 */
/* ------------------------------------------------------------------ */

/** 12 trạng thái cảm xúc, 09-b §4.3. */
export const TRANG_THAI = [
  "binh_thuong",
  "vui",
  "hao_hung",
  "suy_nghi",
  "giai_thich",
  "canh_bao",
  "nghiem_tuc",
  "tiec",
  "khich_le",
  "an_mung",
  "ngu",
  "bo_tay",
] as const;
export type TrangThai = (typeof TRANG_THAI)[number];

export const NHAN_TRANG_THAI: Record<TrangThai, string> = {
  binh_thuong: "Bình thường",
  vui: "Vui",
  hao_hung: "Hào hứng",
  suy_nghi: "Đang nghĩ",
  giai_thich: "Đang giảng",
  canh_bao: "Cảnh báo",
  nghiem_tuc: "Nghiêm túc",
  tiec: "Tiếc",
  khich_le: "Khích lệ",
  an_mung: "Ăn mừng",
  ngu: "Ngủ",
  // Trạng thái quan trọng nhất về mặt sản phẩm: "không biết" phải có hình ảnh riêng,
  // để việc thiếu căn cứ là hành vi bình thường chứ không phải lỗi bị giấu đi.
  bo_tay: "Chưa đủ căn cứ",
};

export const TU_THE = [
  "dung",
  "chi_tay",
  "gio_bang",
  "cam_but",
  "khoanh_tay",
  "nhay",
  "ngoi",
  "vay_tay",
] as const;
export type TuThe = (typeof TU_THE)[number];

export const TRANG_PHUC = [
  "thuong_ngay",
  "cong_so",
  "ao_dai_khan_dong",
  "ao_dai_nu",
  "bao_ho_cong_truong",
  "hoi_dong_tham_dinh",
  "kiem_toan",
  "tot_nghiep",
  "tet",
  "tinh_nguyen",
] as const;
export type TrangPhuc = (typeof TRANG_PHUC)[number];

export const NHAN_TRANG_PHUC: Record<TrangPhuc, string> = {
  thuong_ngay: "Thường ngày",
  cong_so: "Công sở",
  ao_dai_khan_dong: "Áo the khăn xếp",
  ao_dai_nu: "Áo dài",
  bao_ho_cong_truong: "Bảo hộ công trường",
  hoi_dong_tham_dinh: "Hội đồng thẩm định",
  kiem_toan: "Kiểm toán",
  tot_nghiep: "Tốt nghiệp",
  tet: "Ngày Tết",
  tinh_nguyen: "Tình nguyện",
};

export const DAO_CU = [
  "khong",
  "thuoc_vang",
  "but_long",
  "so_can_cu",
  "kinh_lup",
  "can_dia",
  "ban_do_lo_trinh",
  "may_tinh_cam_tay",
  "xap_ho_so",
  "den_pin",
  "dong_ho_cat",
  "bia_da",
] as const;
export type DaoCu = (typeof DAO_CU)[number];

export const HIEU_UNG = [
  "khong",
  "bong_thoai",
  "tia_sang",
  "dau_hoi",
  "dau_cham_than",
  "phao_giay",
  "giot_mo_hoi",
  "vong_tron_nhip",
] as const;
export type HieuUng = (typeof HIEU_UNG)[number];

/** Hình dáng thân — quyết định phần `than` và `dau` của bản dựng SVG. */
export const DANG_THAN = ["thuoc", "giot_muc", "rua", "nguoi_can", "seu", "thuoc_day", "den_dau"] as const;
export type DangThan = (typeof DANG_THAN)[number];

/* ------------------------------------------------------------------ */
/* Nhân vật                                                            */
/* ------------------------------------------------------------------ */

export interface GiongNoi {
  /** Nhân vật tự xưng là gì. */
  tu_xung: string;
  /** Gọi người học là gì. */
  goi_nguoi_hoc: string;
  do_dai_cau_toi_da: number;
  muc_trang_trong: "than_mat" | "trung_tinh" | "trang_trong";
  tu_nen_dung: string[];
  tu_cam: string[];
}

export interface BangMau {
  chinh: string;
  phu: string;
  nhan: string;
  da: string;
  vien: string;
  mat: string;
}

export interface NhanVat {
  id: string;
  code: string;
  fullName: string;
  nickName: string;
  roleLine: string;
  bio?: string;
  audiences: string[];
  topics: string[];
  voice: GiongNoi;
  palette: BangMau;
  body: DangThan;
  headGear?: string | null;
  defaultProp: DaoCu;
  allowedCostumes: TrangPhuc[];
  characterSheet: string;
  enabled: boolean;
  isDefault: boolean;
  ordinal: number;
}

/* ------------------------------------------------------------------ */
/* Hành động                                                           */
/* ------------------------------------------------------------------ */

/** Bộ kích hoạt, 09-b §5.2. */
export const KICH_HOAT = [
  // Vào ra
  "vao_chuyen_de",
  "vao_bai",
  "roi_giua_bai",
  "vang_mat_tro_lai",
  // Đọc bài
  "mo_khoi",
  "dung_lau_o_khoi",
  "cuon_qua_nhanh",
  "mo_lai_khoi_cu",
  // Làm bài
  "tra_loi_dung",
  "tra_loi_sai",
  "sai_lap_lai",
  "bo_trong_cau",
  "nop_san_pham",
  // Đánh giá
  "bat_dau_danh_gia",
  "dat_bai_kiem_tra",
  "truot_bai_kiem_tra",
  "phuc_khao",
  // Pháp lý
  "can_cu_het_hieu_luc",
  "bai_can_cap_nhat",
  "khong_du_can_cu",
  // Duy trì
  "den_han_on_tap",
  "dat_muc_tieu_tuan",
  "hut_muc_tieu_tuan",
  "chao_theo_gio",
  // Công cụ
  "mo_may_tinh_chi_phi",
  "mo_dinh_tuyen_thu_tuc",
  "mo_bieu_mau",
  // Cột mốc
  "hoan_thanh_bai",
  "hoan_thanh_cum",
  "nhan_chung_nhan",
] as const;
export type KichHoat = (typeof KICH_HOAT)[number];

/**
 * Nhóm sự kiện bắt buộc phải báo kể cả khi người học đã bật chế độ yên lặng.
 * Căn cứ hết hiệu lực là thứ không được im (09-b §5.4).
 */
export const KICH_HOAT_PHAP_LY: readonly KichHoat[] = [
  "can_cu_het_hieu_luc",
  "bai_can_cap_nhat",
  "khong_du_can_cu",
];

/**
 * Sự kiện là **phản hồi trực tiếp** cho một thao tác của người học, không phải nhân vật tự
 * xuất hiện.
 *
 * Hạn mức "một lần xuất hiện chủ động mỗi ba phút" (09-b §5.4) chỉ áp cho lần nhân vật TỰ
 * lên tiếng. Người học vừa nộp bài mà nhân vật im lặng vì chưa đủ ba phút kể từ lời chào đầu
 * bài thì phản hồi mất hẳn ý nghĩa — đó là lúc người học đang chờ nghe.
 *
 * Hạn mức riêng của từng hành động (cooldown, số lần mỗi phiên, mỗi ngày) vẫn áp dụng.
 */
export const KICH_HOAT_PHAN_HOI: readonly KichHoat[] = [
  "tra_loi_dung",
  "tra_loi_sai",
  "sai_lap_lai",
  "bo_trong_cau",
  "nop_san_pham",
  "bat_dau_danh_gia",
  "dat_bai_kiem_tra",
  "truot_bai_kiem_tra",
  "phuc_khao",
  "hoan_thanh_bai",
  "hoan_thanh_cum",
  "nhan_chung_nhan",
  "mo_may_tinh_chi_phi",
  "mo_dinh_tuyen_thu_tuc",
  "mo_bieu_mau",
];

export const NEO = [
  "goc_phai_duoi",
  "canh_khoi",
  "tren_cau_hoi",
  "thanh_tien_do",
  "giua_man_hinh",
  "an",
] as const;
export type Neo = (typeof NEO)[number];

/** 8 lệnh mascot thao tác lên bài học, 09-b §8. */
export const LENH_BAI_HOC = [
  "tro_toi",
  "to_sang",
  "mo_can_cu",
  "so_sanh",
  "giang_lai",
  "mo_cong_cu",
  "chen_bai_va",
  "hoi_tai_cho",
] as const;
export type LenhBaiHoc = (typeof LENH_BAI_HOC)[number];

export const NHAN_LENH_BAI_HOC: Record<LenhBaiHoc, string> = {
  tro_toi: "Chỉ tới một khối",
  to_sang: "Tô sáng một đoạn",
  mo_can_cu: "Mở đúng khoản",
  so_sanh: "Mở bảng đối chiếu trước/sau",
  giang_lai: "Giảng lại ở mức khác",
  mo_cong_cu: "Mở công cụ tính",
  chen_bai_va: "Chèn bài vá lỗi",
  hoi_tai_cho: "Hỏi ngay tại chỗ",
};

export type ToanTuDieuKien = "bang" | "khac" | "lon_hon" | "nho_hon" | "chua" | "trong";

export interface DieuKien {
  truong: string;
  toan_tu: ToanTuDieuKien;
  gia_tri: string | number | boolean;
}

export interface LoiThoai {
  text: string;
  tone?: string;
  /**
   * `loi_dan` là lời của nhân vật. `loi_phap_ly` bắt buộc có `citations` và được giao diện
   * render thành THẺ CĂN CỨ chứ không phải bong bóng thoại — người học không bao giờ được
   * nhầm lời nhân vật với lời của pháp luật.
   */
  loai?: "loi_dan" | "loi_phap_ly";
  citations?: string[];
}

export interface LoiMoi {
  nhan: string;
  lenh?: LenhBaiHoc;
  tham_so?: Record<string, unknown>;
  duong_dan?: string;
}

export interface HanhDong {
  id: string;
  code: string;
  personaId: string | null;
  trigger: KichHoat;
  conditions: DieuKien[];
  priority: number;
  cooldownSeconds: number;
  maxPerSession: number;
  maxPerDay: number;
  anchor: Neo;
  state: TrangThai;
  pose: TuThe;
  costume?: TrangPhuc | null;
  prop?: DaoCu | null;
  effect: HieuUng;
  speech: LoiThoai[];
  cta?: LoiMoi | null;
  audiences: string[];
  courseIds: string[];
  enabled: boolean;
}

/* ------------------------------------------------------------------ */
/* Ngữ cảnh phiên học                                                  */
/* ------------------------------------------------------------------ */

export type MucXuatHien = "day_du" | "it" | "yen_lang" | "tat";

export interface NguCanhPhien {
  /** Giá trị các trường dùng cho điều kiện: so_lan_sai, ma_loi, tien_do_bai… */
  bien: Record<string, string | number | boolean>;
  audience?: string;
  courseId?: string;
  mucXuatHien: MucXuatHien;
  /** Số lần mascot đã xuất hiện trong phiên này. */
  soLanTrongPhien: number;
  /** Giây kể từ lần xuất hiện gần nhất. */
  giayTuLanTruoc: number;
  /** code hành động -> giây kể từ lần chạy gần nhất. */
  lanChayGanNhat: Record<string, number>;
  /** code hành động -> số lần đã chạy trong phiên. */
  soLanTrongPhienTheoCode: Record<string, number>;
  /** code hành động -> số lần đã chạy hôm nay. */
  soLanHomNayTheoCode: Record<string, number>;
  /** Hành động người học đã đóng, còn trong 24 giờ nghỉ. */
  daDong: string[];
  /** Người học đang gõ hoặc đang trong câu hỏi tính giờ: tuyệt đối không chen ngang. */
  dangNhapLieu: boolean;
  /**
   * Người học tự bấm gọi trợ giúp.
   *
   * Khi đó hạn mức tần suất KHÔNG áp dụng: hạn mức tồn tại để nhân vật không chen ngang,
   * không phải để từ chối một yêu cầu trực tiếp. Chế độ yên lặng cũng vậy — yên lặng nghĩa
   * là không tự nói, không phải là không trả lời khi được hỏi.
   */
  nguoiHocGoi?: boolean;
}
