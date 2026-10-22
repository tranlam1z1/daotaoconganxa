/**
 * Kiểu dữ liệu của mô-đun đào tạo (ke-hoach/09-a).
 *
 * Đây là nơi DUY NHẤT định nghĩa thư viện khối nội dung và thư viện dạng bài tập. CSDL chỉ
 * lưu `kind` là chuỗi và `data`/`prompt`/`answer` là jsonb; hình dạng của chúng do tệp này
 * quy định, và `blocks.ts` / `grading.ts` là nơi kiểm tra.
 */

/* ------------------------------------------------------------------ */
/* Trạng thái nội dung                                                 */
/* ------------------------------------------------------------------ */

/** Vòng đời nội dung, 09-a §5. Chỉ vai trò `phap_che` trở lên mới chuyển sang `xuat_ban`. */
export const TRANG_THAI_NOI_DUNG = [
  "nhap",
  "ai_soan",
  "bien_tap",
  "cho_phap_che",
  "xuat_ban",
  "can_cap_nhat",
  "luu_tru",
] as const;
export type TrangThaiNoiDung = (typeof TRANG_THAI_NOI_DUNG)[number];

export const NHAN_TRANG_THAI_NOI_DUNG: Record<TrangThaiNoiDung, string> = {
  nhap: "Bản nháp",
  ai_soan: "AI vừa soạn",
  bien_tap: "Đang biên tập",
  cho_phap_che: "Chờ duyệt",
  xuat_ban: "Đã xuất bản",
  can_cap_nhat: "Cần cập nhật",
  luu_tru: "Lưu trữ",
};

/** Bước chuyển trạng thái hợp lệ. Không cho nhảy thẳng từ nháp lên xuất bản. */
export const CHUYEN_TRANG_THAI: Record<TrangThaiNoiDung, TrangThaiNoiDung[]> = {
  nhap: ["ai_soan", "bien_tap", "luu_tru"],
  ai_soan: ["bien_tap", "nhap", "luu_tru"],
  bien_tap: ["cho_phap_che", "nhap", "luu_tru"],
  cho_phap_che: ["xuat_ban", "bien_tap"],
  xuat_ban: ["can_cap_nhat", "luu_tru"],
  can_cap_nhat: ["bien_tap", "xuat_ban", "luu_tru"],
  luu_tru: ["nhap"],
};

export function chuyenDuoc(tu: TrangThaiNoiDung, den: TrangThaiNoiDung): boolean {
  return (CHUYEN_TRANG_THAI[tu] ?? []).includes(den);
}

/** Vai trò tối thiểu để đặt một trạng thái (đối chiếu ROLES của @qdpl/auth). */
export const VAI_TRO_DAT_TRANG_THAI: Record<TrangThaiNoiDung, "quan_ly" | "quan_tri"> = {
  nhap: "quan_ly",
  ai_soan: "quan_ly",
  bien_tap: "quan_ly",
  cho_phap_che: "quan_ly",
  xuat_ban: "quan_ly",
  can_cap_nhat: "quan_ly",
  luu_tru: "quan_ly",
};

/* ------------------------------------------------------------------ */
/* Lĩnh vực đào tạo và nhóm đối tượng                                  */
/* ------------------------------------------------------------------ */

/**
 * Nhóm đối tượng của một chuyên đề (ke-hoach/09 §1).
 *
 * Một lĩnh vực phục vụ hai nhóm người học khác nhau trên cùng khối quy định: người trực tiếp
 * áp dụng quy định vào hồ sơ của mình, và người đi tư vấn lại cho nhóm đó. Hai nhóm cần cùng
 * nền pháp lý nhưng khác sản phẩm đầu ra, nên tách thành hai nhánh chuyên đề chứ không trộn
 * vào một lộ trình.
 */
export const NHOM_DOI_TUONG = ["khach_hang", "tu_van"] as const;
export type NhomDoiTuong = (typeof NHOM_DOI_TUONG)[number];

export const NHAN_NHOM_DOI_TUONG: Record<NhomDoiTuong, string> = {
  khach_hang: "Người trực tiếp áp dụng quy định",
  tu_van: "Người tư vấn và đào tạo lại",
};

export const MO_TA_NHOM_DOI_TUONG: Record<NhomDoiTuong, string> = {
  khach_hang:
    "Cán bộ, công chức, viên chức và chuyên viên đang lập hoặc xử lý một hồ sơ thuộc phạm vi lĩnh vực.",
  tu_van:
    "Chuyên viên tư vấn hướng dẫn lại nhóm trên: học đủ nền pháp lý của các chuyên đề trong lĩnh vực, " +
    "cộng thêm phương pháp tư vấn và phương pháp sư phạm.",
};

/** Quan hệ giữa hai chuyên đề trong cùng lĩnh vực. */
export const QUAN_HE_CHUYEN_DE = ["noi_tiep", "cu_the_hoa"] as const;
export type QuanHeChuyenDe = (typeof QUAN_HE_CHUYEN_DE)[number];

export const NHAN_QUAN_HE_CHUYEN_DE: Record<QuanHeChuyenDe, string> = {
  noi_tiep: "Nối tiếp",
  cu_the_hoa: "Cụ thể hoá",
};

/* ------------------------------------------------------------------ */
/* Chế độ học                                                          */
/* ------------------------------------------------------------------ */

export const CHE_DO_HOC = ["day_du", "nhanh", "tra_cuu", "on_thi"] as const;
export type CheDoHoc = (typeof CHE_DO_HOC)[number];

export const NHAN_CHE_DO_HOC: Record<CheDoHoc, string> = {
  day_du: "Đầy đủ — học từ đầu",
  nhanh: "Nhanh — đã làm nghề",
  tra_cuu: "Tra cứu — đang xử lý việc thật",
  on_thi: "Ôn tập — trước kỳ đánh giá",
};

/* ------------------------------------------------------------------ */
/* Khối nội dung                                                       */
/* ------------------------------------------------------------------ */

export const LOAI_KHOI = [
  "giang",
  "can_cu",
  "so_do_trinh_tu",
  "dong_thoi_gian",
  "doi_chieu",
  "bang_tra",
  "cong_thuc",
  "diem_nong",
  "the_lat",
  "hoi_nhanh",
  "bieu_mau",
  "may_tinh",
  "cay_quyet_dinh",
  "ban_do_khai_niem",
  "ho_so",
  "kich_ban",
  "video",
  "canh_bao",
  "tom_tat",
] as const;
export type LoaiKhoi = (typeof LOAI_KHOI)[number];

export interface MoTaLoaiKhoi {
  kind: LoaiKhoi;
  ten: string;
  mo_ta: string;
  /** Khối này có tính là một lần tương tác không (dùng để kiểm nhịp bài, 09-a §2). */
  tuong_tac: boolean;
  /** Bắt buộc có ít nhất một viện dẫn. */
  can_can_cu: boolean;
}

export const THU_VIEN_KHOI: readonly MoTaLoaiKhoi[] = [
  {
    kind: "giang",
    ten: "Đoạn giảng",
    mo_ta: "Markdown ngắn, tối đa ~250 từ",
    tuong_tac: false,
    can_can_cu: false,
  },
  {
    kind: "can_cu",
    ten: "Thẻ căn cứ",
    mo_ta: "Trích nguyên văn nút văn bản kèm URN và trạng thái hiệu lực",
    tuong_tac: false,
    can_can_cu: true,
  },
  {
    kind: "so_do_trinh_tu",
    ten: "Sơ đồ trình tự",
    mo_ta: "Các bước, mũi tên, thời hạn và căn cứ từng bước",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "dong_thoi_gian",
    ten: "Dòng thời gian hiệu lực",
    mo_ta: "Ban hành, hiệu lực, sửa đổi, hết hiệu lực, chuyển tiếp",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "doi_chieu",
    ten: "Bảng đối chiếu trước/sau",
    mo_ta: "Hai cột cũ ↔ mới, tô khác biệt cấp từ",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "bang_tra",
    ten: "Bảng tra cứu",
    mo_ta: "Bảng có lọc và tìm trong bảng",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "cong_thuc",
    ten: "Công thức tương tác",
    mo_ta: "KaTeX kèm ô nhập biến và kết quả tính trực tiếp",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "diem_nong",
    ten: "Ảnh chú giải điểm nóng",
    mo_ta: "Ảnh biểu mẫu với các chấm bấm được",
    tuong_tac: true,
    can_can_cu: false,
  },
  {
    kind: "the_lat",
    ten: "Bộ thẻ lật",
    mo_ta: "Thuật ngữ ↔ định nghĩa; nạp vào lịch ôn giãn cách",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "hoi_nhanh",
    ten: "Hỏi nhanh giữa bài",
    mo_ta: "Một câu, phản hồi ngay, không tính điểm",
    tuong_tac: true,
    can_can_cu: false,
  },
  {
    kind: "bieu_mau",
    ten: "Mô phỏng biểu mẫu",
    mo_ta: "Biểu mẫu phụ lục điền được, xuất DOCX",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "may_tinh",
    ten: "Máy tính nhúng",
    mo_ta: "Nhúng công cụ tính chi phí hoặc định tuyến thủ tục",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "cay_quyet_dinh",
    ten: "Cây quyết định",
    mo_ta: "Chuỗi câu hỏi có/không dẫn tới kết luận có căn cứ",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "ban_do_khai_niem",
    ten: "Bản đồ khái niệm",
    mo_ta: "Đồ thị khái niệm và quan hệ",
    tuong_tac: true,
    can_can_cu: false,
  },
  {
    kind: "ho_so",
    ten: "Băng chuyền hồ sơ",
    mo_ta: "Danh mục tài liệu của một giai đoạn, kéo thả",
    tuong_tac: true,
    can_can_cu: true,
  },
  {
    kind: "kich_ban",
    ten: "Kịch bản tình huống",
    mo_ta: "Hội thoại dẫn vào bài tập",
    tuong_tac: false,
    can_can_cu: false,
  },
  {
    kind: "video",
    ten: "Video / hoạt hình",
    mo_ta: "Video có phụ đề, mốc chương và bản chép lời",
    tuong_tac: false,
    can_can_cu: false,
  },
  {
    kind: "canh_bao",
    ten: "Dải cảnh báo",
    mo_ta: "Cảnh báo hiệu lực hoặc sai sót thường gặp",
    tuong_tac: false,
    can_can_cu: false,
  },
  {
    kind: "tom_tat",
    ten: "Chốt lại",
    mo_ta: "3–5 gạch đầu dòng và danh mục căn cứ của bài",
    tuong_tac: false,
    can_can_cu: false,
  },
];

export const KHOI_THEO_KIND = new Map<string, MoTaLoaiKhoi>(THU_VIEN_KHOI.map((k) => [k.kind, k]));

export interface KhoiNoiDung {
  id: string;
  lessonId: string;
  ordinal: number;
  kind: LoaiKhoi;
  data: Record<string, unknown>;
  citations: string[];
  citationHealth: "ok" | "warning" | "broken";
  source: "nguoi" | "ai" | "ai_da_sua";
  status: TrangThaiNoiDung;
  /** Chế độ học mà khối xuất hiện; rỗng = mọi chế độ. */
  modes: CheDoHoc[];
  note?: string | null;
}

/* ------------------------------------------------------------------ */
/* Hoạt động (bài tập)                                                 */
/* ------------------------------------------------------------------ */

export const LOAI_BAI_TAP = [
  "trac_nghiem",
  "dung_sai",
  "dien_khuyet",
  "sap_xep",
  "ghep_cap",
  "keo_tha_so_do",
  "soi_loi",
  "tinh_toan",
  "dien_bieu_mau",
  "viet_co_can_cu",
  "truy_tim",
  "phan_nhanh",
  "dong_vai_hoi_dong",
  "phan_bien",
  "du_an_nho",
] as const;
export type LoaiBaiTap = (typeof LOAI_BAI_TAP)[number];

export type CachCham = "may" | "ai" | "nguoi" | "tu_danh_gia";

export interface MoTaLoaiBaiTap {
  kind: LoaiBaiTap;
  ten: string;
  mo_ta: string;
  /** Cách chấm mặc định; quản trị viên nội dung đổi được sang cách chặt hơn. */
  cham: CachCham;
  /** true khi cần rubric (mọi bài chấm bằng AI hoặc người). */
  can_rubric: boolean;
}

export const THU_VIEN_BAI_TAP: readonly MoTaLoaiBaiTap[] = [
  {
    kind: "trac_nghiem",
    ten: "Trắc nghiệm",
    mo_ta: "Một hoặc nhiều đáp án đúng",
    cham: "may",
    can_rubric: false,
  },
  {
    kind: "dung_sai",
    ten: "Đúng/sai kèm căn cứ",
    mo_ta: "Chọn đúng/sai và nêu căn cứ",
    cham: "ai",
    can_rubric: true,
  },
  {
    kind: "dien_khuyet",
    ten: "Điền chỗ trống",
    mo_ta: "Điền vào trích dẫn văn bản",
    cham: "may",
    can_rubric: false,
  },
  {
    kind: "sap_xep",
    ten: "Sắp xếp trình tự",
    mo_ta: "Xếp các bước theo đúng thứ tự",
    cham: "may",
    can_rubric: false,
  },
  { kind: "ghep_cap", ten: "Ghép cặp", mo_ta: "Ghép nội dung với căn cứ", cham: "may", can_rubric: false },
  {
    kind: "keo_tha_so_do",
    ten: "Kéo thả vào sơ đồ",
    mo_ta: "Đặt nhãn vào ô trống của sơ đồ",
    cham: "may",
    can_rubric: false,
  },
  {
    kind: "soi_loi",
    ten: "Soi lỗi",
    mo_ta: "Đánh dấu chỗ sai trong văn bản mẫu",
    cham: "ai",
    can_rubric: true,
  },
  {
    kind: "tinh_toan",
    ten: "Bài tính",
    mo_ta: "Tính toán số liệu, có sai số cho phép",
    cham: "may",
    can_rubric: false,
  },
  {
    kind: "dien_bieu_mau",
    ten: "Điền biểu mẫu",
    mo_ta: "Điền biểu mẫu thật theo tình huống",
    cham: "ai",
    can_rubric: true,
  },
  {
    kind: "viet_co_can_cu",
    ten: "Viết có căn cứ",
    mo_ta: "Viết đoạn nghị luận pháp lý, bắt buộc trích dẫn",
    cham: "ai",
    can_rubric: true,
  },
  {
    kind: "truy_tim",
    ten: "Truy tìm căn cứ",
    mo_ta: "Tìm đúng URN bằng công cụ tra cứu thật",
    cham: "may",
    can_rubric: false,
  },
  {
    kind: "phan_nhanh",
    ten: "Tình huống phân nhánh",
    mo_ta: "Nhiều bước, mỗi lựa chọn đổi trạng thái hồ sơ",
    cham: "may",
    can_rubric: false,
  },
  {
    kind: "dong_vai_hoi_dong",
    ten: "Đóng vai hội đồng",
    mo_ta: "Chấm một hồ sơ theo phiếu thẩm định",
    cham: "ai",
    can_rubric: true,
  },
  {
    kind: "phan_bien",
    ten: "Đối thoại phản biện",
    mo_ta: "AI đóng vai nhà thầu hoặc kiểm toán viên chất vấn",
    cham: "ai",
    can_rubric: true,
  },
  {
    kind: "du_an_nho",
    ten: "Bài lớn nộp tệp",
    mo_ta: "Nộp DOCX/XLSX cho một giai đoạn",
    cham: "nguoi",
    can_rubric: true,
  },
];

export const BAI_TAP_THEO_KIND = new Map<string, MoTaLoaiBaiTap>(THU_VIEN_BAI_TAP.map((b) => [b.kind, b]));

/** Một phương án của câu hỏi. `ma_loi` là thứ dẫn đường cho lộ trình cá nhân hoá. */
export interface PhuongAn {
  id: string;
  text: string;
  dung?: boolean;
  giai_thich?: string;
  ma_loi?: string;
  citations?: string[];
}

/** Phần đề bài gửi ra cho người học. Không bao giờ chứa đáp án. */
export interface DeBai {
  cau_hoi: string;
  huong_dan?: string;
  phuong_an?: Array<Omit<PhuongAn, "dung" | "giai_thich" | "ma_loi">>;
  /** Dữ liệu riêng của từng dạng bài: các ô trống, các bước cần xếp, biểu mẫu… */
  [key: string]: unknown;
}

export interface DapAn {
  /** Id phương án đúng (trac_nghiem, dung_sai). */
  dung?: string[];
  /** Thứ tự đúng (sap_xep, phan_nhanh). */
  thu_tu?: string[];
  /** Cặp đúng (ghep_cap, keo_tha_so_do): { traiId: phaiId }. */
  cap?: Record<string, string>;
  /** Đáp án chuỗi (dien_khuyet): mỗi ô có nhiều cách viết chấp nhận được. */
  o_trong?: Record<string, string[]>;
  /** Giá trị số (tinh_toan) và sai số tuyệt đối cho phép. */
  so?: number;
  sai_so?: number;
  /** URN đích (truy_tim). */
  urn?: string;
  /** Vùng phải đánh dấu (soi_loi): danh sách id vùng. */
  vung?: string[];
  /** Giải thích chung hiện sau khi chấm. */
  giai_thich?: string;
  /** Phương án đầy đủ kèm ma_loi, dùng để sinh phản hồi. */
  phuong_an?: PhuongAn[];
}

export interface MucRubric {
  diem: number;
  mo_ta: string;
}

export interface TieuChiRubric {
  ma: string;
  ten: string;
  trong_so: number;
  muc: MucRubric[];
}

export interface Rubric {
  tieu_chi: TieuChiRubric[];
  nguong_dat: number;
}

export interface HoatDong {
  id: string;
  lessonId: string | null;
  courseId: string;
  ordinal: number;
  kind: LoaiBaiTap;
  mode: CachCham;
  title?: string | null;
  prompt: DeBai;
  answer: DapAn;
  rubric: Rubric | Record<string, never>;
  skills: string[];
  errorTags: string[];
  citations: string[];
  difficulty: number;
  points: number;
  level: number;
  status: TrangThaiNoiDung;
  retired: boolean;
}

/* ------------------------------------------------------------------ */
/* Kết quả chấm                                                        */
/* ------------------------------------------------------------------ */

export interface DiemTieuChi {
  ma: string;
  ten: string;
  diem: number;
  diem_toi_da: number;
  nhan_xet?: string;
  bang_chung?: string;
}

export interface KetQuaCham {
  score: number;
  maxScore: number;
  passed: boolean;
  /** Mã lỗi khái niệm phát hiện được, đầu vào cho bài vá (09-a §6.3). */
  errorTags: string[];
  feedback: {
    tom_tat: string;
    tieu_chi?: DiemTieuChi[];
    can_cu?: string[];
    /** Chi tiết từng phần cho dạng bài nhiều phần. */
    chi_tiet?: Array<{ ma: string; dung: boolean; ghi_chu?: string }>;
  };
  gradedBy: CachCham;
  /** true khi dạng bài này phải chuyển cho mô hình hoặc người chấm tiếp. */
  canChamTiep: boolean;
}

/* ------------------------------------------------------------------ */
/* Sự kiện học                                                         */
/* ------------------------------------------------------------------ */

export const LOAI_SU_KIEN_HOC = [
  "vao_chuyen_de",
  "vao_bai",
  "roi_bai",
  "mo_khoi",
  "xong_khoi",
  "lam_bai",
  "xong_bai",
  "on_tap",
  "nop_san_pham",
  "hoi_tai_cho",
  "giang_lai",
  "doi_che_do",
  "phuc_khao",
] as const;
export type LoaiSuKienHoc = (typeof LOAI_SU_KIEN_HOC)[number];
