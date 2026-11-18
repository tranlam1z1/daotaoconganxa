/**
 * Soạn chuyên đề và bài giảng trong khu quản trị (/quan-tri/chuyen-de).
 *
 * Web không phụ thuộc @qdpl/dao-tao (giả định A2), nên vòng đời nội dung và thư viện khối dưới
 * đây chép theo packages/dao-tao/src/types.ts và blocks.ts; đổi bên đó thì đổi cả ở đây. API vẫn
 * là nơi kiểm bước chuyển trạng thái, quyền và bảng kiểm trước xuất bản.
 */
import type { Tone } from "./format";

export type TrangThaiNoiDung =
  | "nhap"
  | "ai_soan"
  | "bien_tap"
  | "cho_phap_che"
  | "xuat_ban"
  | "can_cap_nhat"
  | "luu_tru";

export const TEN_TRANG_THAI: Record<TrangThaiNoiDung, string> = {
  nhap: "Bản nháp",
  ai_soan: "AI vừa soạn",
  bien_tap: "Đang biên tập",
  cho_phap_che: "Chờ duyệt",
  xuat_ban: "Đã xuất bản",
  can_cap_nhat: "Cần cập nhật",
  luu_tru: "Lưu trữ",
};

export const TONE_TRANG_THAI: Record<TrangThaiNoiDung, Tone> = {
  nhap: "muted",
  ai_soan: "info",
  bien_tap: "info",
  cho_phap_che: "warn",
  xuat_ban: "ok",
  can_cap_nhat: "danger",
  luu_tru: "muted",
};

/** Bước chuyển hợp lệ, chép CHUYEN_TRANG_THAI. */
export const CHUYEN_TRANG_THAI: Record<TrangThaiNoiDung, TrangThaiNoiDung[]> = {
  nhap: ["ai_soan", "bien_tap", "luu_tru"],
  ai_soan: ["bien_tap", "nhap", "luu_tru"],
  bien_tap: ["cho_phap_che", "nhap", "luu_tru"],
  cho_phap_che: ["xuat_ban", "bien_tap"],
  xuat_ban: ["can_cap_nhat", "luu_tru"],
  can_cap_nhat: ["bien_tap", "xuat_ban", "luu_tru"],
  luu_tru: ["nhap"],
};

/** Vai trò tối thiểu để đặt một trạng thái, chép VAI_TRO_DAT_TRANG_THAI. */
export const VAI_TRO_DAT_TRANG_THAI: Record<TrangThaiNoiDung, "quan_ly"> = {
  nhap: "quan_ly",
  ai_soan: "quan_ly",
  bien_tap: "quan_ly",
  cho_phap_che: "quan_ly",
  xuat_ban: "quan_ly",
  can_cap_nhat: "quan_ly",
  luu_tru: "quan_ly",
};

/**
 * Trạng thái người dùng chuyển sang được từ trạng thái hiện tại. Bỏ "AI vừa soạn": trạng thái đó
 * do xưởng soạn bài đặt, không đặt tay. `du` kiểm vai trò (duVaiTro ở máy chủ).
 */
export function trangThaiDatDuoc(
  hienTai: TrangThaiNoiDung,
  du: (vaiTro: "quan_ly") => boolean,
): TrangThaiNoiDung[] {
  return (CHUYEN_TRANG_THAI[hienTai] ?? []).filter((t) => t !== "ai_soan" && du(VAI_TRO_DAT_TRANG_THAI[t]));
}

/** Nhãn nút chuyển sang từng trạng thái: nói việc sẽ làm, không nói tên trạng thái. */
export const NUT_CHUYEN: Record<TrangThaiNoiDung, string> = {
  nhap: "Đưa về bản nháp",
  ai_soan: "Đánh dấu AI soạn",
  bien_tap: "Chuyển sang biên tập",
  cho_phap_che: "Gửi duyệt",
  xuat_ban: "Xuất bản",
  can_cap_nhat: "Đánh dấu cần cập nhật",
  luu_tru: "Lưu trữ",
};

export const TEN_CAP_DO: Record<string, string> = {
  co_ban: "Cơ bản",
  nang_cao: "Nâng cao",
  chuyen_sau: "Chuyên sâu",
};

export const TEN_NHOM_DOI_TUONG: Record<string, string> = {
  khach_hang: "Người trực tiếp áp dụng quy định",
  tu_van: "Người tư vấn và đào tạo lại",
};

/* ------------------------------------------------------------------ */
/* Dữ liệu API quản trị                                                */
/* ------------------------------------------------------------------ */

export interface ChuyenDeQuanTri {
  id: string;
  slug: string;
  title: string;
  status: TrangThaiNoiDung;
  level: string;
  lessonCount: number;
  asOf: string;
  linhVuc: { slug: string; name: string } | null;
  nhomDoiTuong: string;
  updatedAt: string;
}

export interface ChiTietChuyenDe {
  chuyenDe: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    status: TrangThaiNoiDung;
    level: string;
    asOf: string;
    fieldId: string | null;
    audienceGroup: string;
    nhomHocTap: string[];
    ordinal: number;
    defaultMode: string;
  };
  bai: Array<{
    id: string;
    slug: string;
    ordinal: number;
    title: string;
    status: TrangThaiNoiDung;
    estimatedMinutes: number;
    soKhoi: number;
  }>;
}

export interface LinhVucQuanTri {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export interface LoiBangKiem {
  muc: "loi" | "canh_bao";
  ma: string;
  thong_diep: string;
  blockId?: string;
  ordinal?: number;
}

/** Phản hồi GET /v1/quan-tri/dao-tao/chuyen-de/:slug/kiem-tra. */
export interface BangKiemChuyenDe {
  dat: boolean;
  chanBoi: { baiHong: string[]; chuTrinhKyNang: string[]; asOfQuaCu: number | null };
  theoBai: Array<{
    id: string;
    slug: string;
    status: TrangThaiNoiDung;
    dat: boolean;
    phut: number;
    soKhoi: number;
    loi: LoiBangKiem[];
  }>;
}

export interface KhoiQuanTri {
  id: string;
  lesson_id: string;
  ordinal: number;
  kind: string;
  data: Record<string, unknown>;
  citations: string[];
  citation_health: string;
  source: string;
  status: string;
  modes: string[];
  note: string | null;
}

export interface BaiQuanTri {
  id: string;
  course_id: string;
  slug: string;
  ordinal: number;
  title: string;
  summary: string | null;
  asOf: string | null;
  status: TrangThaiNoiDung;
  estimated_minutes: number;
  topic_id: string | null;
}

export interface ChuDeNganHang {
  id: string;
  code: string;
  name: string;
  field_name: string | null;
  so_da_duyet: number;
  hidden: boolean;
}

/* ------------------------------------------------------------------ */
/* Thư viện khối                                                       */
/* ------------------------------------------------------------------ */

export interface MoTaKhoiSoan {
  kind: string;
  ten: string;
  goiY: string;
  /** API chặn xuất bản khi khối loại này không có viện dẫn nào. */
  canCanCu: boolean;
  /** Dữ liệu khởi đầu khi thêm khối mới. */
  macDinh: () => Record<string, unknown>;
}

/** Chín loại có biểu mẫu soạn riêng, theo thứ tự hay dùng khi soạn. KHOI_BAI_GIANG còn có "dong_thoi_gian": trang dựng được nhưng chưa có biểu mẫu soạn. */
export const KHOI_SOAN: readonly MoTaKhoiSoan[] = [
  {
    kind: "giang",
    ten: "Đoạn giảng",
    goiY: "Văn bản ngắn, tối đa khoảng 250 từ",
    canCanCu: false,
    macDinh: () => ({ md: "" }),
  },
  {
    kind: "can_cu",
    ten: "Thẻ căn cứ",
    goiY: "Trích nguyên văn điều khoản; mỗi bài phải có ít nhất một thẻ",
    canCanCu: true,
    macDinh: () => ({ urn: "", nhan: "", nguyen_van: "" }),
  },
  {
    kind: "hoi_nhanh",
    ten: "Hỏi nhanh",
    goiY: "Một câu tự kiểm tra, không tính điểm",
    canCanCu: false,
    macDinh: () => ({
      cau_hoi: "",
      phuong_an: [
        { id: "a", text: "" },
        { id: "b", text: "" },
      ],
      dap_an: "a",
      giai_thich: "",
    }),
  },
  {
    kind: "bang_tra",
    ten: "Bảng tra",
    goiY: "Bảng nhiều cột, cần viện dẫn",
    canCanCu: true,
    macDinh: () => ({ tieu_de: "", cot: ["", ""], dong: [["", ""]] }),
  },
  {
    kind: "so_do_trinh_tu",
    ten: "Sơ đồ trình tự",
    goiY: "Các bước theo thứ tự, cần viện dẫn",
    canCanCu: true,
    macDinh: () => ({ buoc: [{ ma: "b1", nhan: "", mo_ta: "" }] }),
  },
  {
    kind: "the_lat",
    ten: "Thẻ lật",
    goiY: "Thuật ngữ và định nghĩa, cần viện dẫn",
    canCanCu: true,
    macDinh: () => ({ the: [{ truoc: "", sau: "" }] }),
  },
  {
    kind: "kich_ban",
    ten: "Tình huống hội thoại",
    goiY: "Đoạn hội thoại dẫn vào bài",
    canCanCu: false,
    macDinh: () => ({ luot: [{ vai: "", loi: "" }] }),
  },
  {
    kind: "canh_bao",
    ten: "Lưu ý",
    goiY: "Cảnh báo hiệu lực hoặc sai sót thường gặp",
    canCanCu: false,
    macDinh: () => ({ loai: "sai_sot", md: "" }),
  },
  {
    kind: "tom_tat",
    ten: "Ghi nhớ",
    goiY: "3 đến 5 ý chốt cuối bài",
    canCanCu: false,
    macDinh: () => ({ y: [""] }),
  },
];

export const KHOI_SOAN_THEO_KIND = new Map(KHOI_SOAN.map((k) => [k.kind, k]));

/** Loại khối có trong CSDL nhưng trang bài giảng chưa dựng: chỉ sửa được dạng JSON. */
export const TEN_KHOI_KHAC: Record<string, string> = {
  dong_thoi_gian: "Dòng thời gian hiệu lực",
  doi_chieu: "Bảng đối chiếu",
  cong_thuc: "Công thức",
  diem_nong: "Ảnh chú giải",
  bieu_mau: "Mô phỏng biểu mẫu",
  may_tinh: "Máy tính nhúng",
  cay_quyet_dinh: "Cây quyết định",
  ban_do_khai_niem: "Bản đồ khái niệm",
  ho_so: "Băng chuyền hồ sơ",
  video: "Video",
};

export function tenKhoi(kind: string): string {
  return KHOI_SOAN_THEO_KIND.get(kind)?.ten ?? TEN_KHOI_KHAC[kind] ?? kind;
}

/** Giá trị `loai` của khối Lưu ý đang dùng trong dữ liệu; trang bài giảng chưa phân biệt cách hiện. */
export const LOAI_CANH_BAO: Record<string, string> = {
  sai_sot: "Sai sót thường gặp",
  hieu_luc: "Hiệu lực văn bản",
  thay_the: "Văn bản bị thay thế",
  phuong_phap: "Lưu ý phương pháp",
};

/** Ngày hôm nay dạng YYYY-MM-DD theo giờ Việt Nam, làm mặc định cho ô "dữ liệu tính đến". */
export function homNay(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** "Xử phạt vi phạm" → "xu-phat-vi-pham": gợi ý slug từ tiêu đề. */
export function taoSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Tiến độ AI soạn một chuyên đề (GET /v1/quan-tri/dao-tao/chuyen-de/:id/soan). `doc_pdf` chỉ có khi
 * chuyên đề tạo từ PDF bản quét; `soan` là lần soạn tự động gần nhất.
 */
export interface TienDoSoan {
  dang_chay: boolean;
  con_loi: boolean;
  doc_pdf: {
    state: string;
    error: string | null;
    cum_xong: number;
    so_cum: number;
    so_trang: number;
    so_cho_khong_doc: number;
  } | null;
  soan: {
    id: string;
    state: string;
    error: string | null;
    so_viec: number;
    xong: number;
    loi: number;
    loi_dau: string | null;
    chi_phi_usd: number;
  } | null;
}

/** Kết quả gửi duyệt hoặc xuất bản nhiều bài một lần (POST .../chuyen-de/:id/bai/trang-thai). */
export interface KetQuaChuyenNhieuBai {
  den: "cho_phap_che" | "xuat_ban";
  da_chuyen: Array<{ id: string; title: string }>;
  bo_qua: Array<{ id: string; title: string; ly_do: string[] }>;
}
