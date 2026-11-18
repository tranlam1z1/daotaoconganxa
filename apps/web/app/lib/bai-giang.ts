/**
 * Kiểu dữ liệu và nhãn của bài giảng phía web (docs/PLAN.md GĐ11).
 *
 * Web chỉ gọi API (giả định A2); các kiểu ở đây chép theo phản hồi của
 * apps/api/src/routes/dao-tao.ts và phải đổi cùng lúc khi bên đó đổi.
 */
import type { IconName } from "../components/ui/Icon";

/** Loại khối trang bài giảng dựng đầy đủ; khớp KHOI_BAI_GIANG của @qdpl/dao-tao. */
export const KHOI_BAI_GIANG = [
  "giang",
  "can_cu",
  "tom_tat",
  "canh_bao",
  "bang_tra",
  "so_do_trinh_tu",
  "the_lat",
  "hoi_nhanh",
  "kich_ban",
  "dong_thoi_gian",
] as const;

export type CheDoXem = "doc" | "slide";

export interface KhoiBaiGiang {
  id: string;
  ordinal: number;
  kind: string;
  data: Record<string, unknown>;
  citations: string[];
  citationHealth: string;
}

/** Nhận xét một tiêu chí rubric của bài tự luận (KetQuaCham.feedback.tieu_chi của @qdpl/dao-tao). */
export interface DiemTieuChiHoc {
  ma: string;
  ten: string;
  diem: number;
  diem_toi_da: number;
  nhan_xet?: string;
  bang_chung?: string;
}

export interface KetQuaBaiTap {
  attemptId?: string;
  score: number;
  maxScore: number;
  passed: boolean;
  feedback: {
    tom_tat?: string;
    tieu_chi?: DiemTieuChiHoc[];
    can_cu?: string[];
    phuc_khao?: { ly_do: string; luc: string };
    /** Nhận xét của giảng viên khi chấm lại; có thì hiện thay nhận xét của AI. */
    giang_vien?: { tom_tat?: string; tieu_chi?: DiemTieuChiHoc[] };
  };
  choCham?: boolean;
}

/** Bài tập trong bài: đề không kèm đáp án hay rubric; kèm lần nộp gần nhất của chính người học. */
export interface HoatDongHoc {
  id: string;
  kind: string;
  mode: string;
  title: string | null;
  prompt: { cau_hoi?: string; huong_dan?: string; phuong_an?: Array<{ id: string; text: string }> };
  citations: string[];
  points: number;
  luotGanNhat:
    | (KetQuaBaiTap & {
        attemptNo: number;
        traLoi: { bai_viet?: string; chon?: string[] };
        gradedBy: string;
        diemGiangVien: number | null;
        choGiangVien: boolean;
        createdAt: string;
      })
    | null;
}

/** Dạng bài trang học làm được ngay trong bài. Dạng khác hiện ở luyện tập. */
export const BAI_TAP_TRONG_BAI = ["viet_co_can_cu", "trac_nghiem"] as const;

/** Độ dài bài viết tự luận; khớp DO_DAI_BAI_VIET của @qdpl/dao-tao. */
export const DO_DAI_BAI_VIET = { toiThieu: 50, toiDa: 6000 } as const;

export interface BaiGiang {
  bai: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    asOf: string | null;
    estimatedMinutes: number;
  };
  khoi: KhoiBaiGiang[];
  hoatDong: HoatDongHoc[];
  ghiDanhId: string | null;
  trangThai: "chua_mo" | "dang_hoc" | "xong";
  kiemTraCuoiBai: { chuDe: string; tenChuDe: string; soCau: number } | null;
}

export interface ChuyenDeTomTat {
  slug: string;
  title: string;
  summary: string | null;
  lessonCount: number;
  durationMinutes: number | null;
  daXuatBan: boolean;
  /** Tỷ lệ bài đã xong; null khi chưa đăng nhập hoặc chưa ghi danh chuyên đề. */
  phanTram: number | null;
  /** Xong mọi bài và đạt kiểm tra cuối bài; null khi chưa đăng nhập. */
  daHoanThanh: boolean | null;
}

export interface LinhVucHoc {
  slug: string;
  name: string;
  summary: string | null;
  chuyenDe: ChuyenDeTomTat[];
}

export interface ChuyenDeHoc {
  chuyenDe: {
    slug: string;
    title: string;
    summary: string | null;
    lessonCount: number;
    durationMinutes: number;
    linhVuc: { slug: string; name: string } | null;
  };
  loTrinh: Array<{
    id: string;
    slug: string;
    soBai: number;
    title: string;
    summary: string | null;
    estimatedMinutes: number;
    trangThai: "chua_mo" | "dang_hoc" | "xong";
    /** Phần trăm đã học của bài; null khi chưa đăng nhập hoặc chưa ghi danh chuyên đề. */
    phanTram: number | null;
  }>;
}

/**
 * Từ khóa trong slug (hoặc tiêu đề) → biểu tượng của thẻ bài giảng. Bảng `lessons` không có cột
 * biểu tượng nên chọn theo nội dung. Khớp trọn từ giữa hai dấu gạch ("tai-nan" không khớp
 * "tai-nang"); từ khóa đứng trước được ưu tiên, nên cụm cụ thể phải đặt trên cụm chung.
 * Bảng lập theo slug thật trong packages/db/src/seed-dao-tao*.ts.
 */
const TU_KHOA_BIEU_TUONG: ReadonlyArray<readonly [string, IconName]> = [
  ["thong-ke", "chart"],
  ["bao-cao", "chart"],
  ["toc-do", "gauge"],
  ["cao-toc", "road"],
  ["bien-bao", "sign"],
  ["bao-hieu", "sign"],
  ["quy-tac", "sign"],
  ["chuyen-huong", "turn"],
  ["vuot", "turn"],
  ["dieu-khien", "trafficLight"],
  ["chi-huy", "trafficLight"],
  ["tai-nan", "alert"],
  ["nong-do-con", "ban"],
  ["bi-cam", "ban"],
  ["tham-quyen", "shield"],
  ["xu-ly-vi-pham", "banknote"],
  ["muc-phat", "banknote"],
  ["tien-phat", "banknote"],
  ["xu-phat", "banknote"],
  ["vi-pham", "ban"],
  ["van-tai", "truck"],
  ["tai-trong", "scale"],
  ["tinh-tiet", "scale"],
  ["phat-nguoi", "camera"],
  ["tam-giu", "lock"],
  ["an-toan-thong-tin", "lock"],
  ["giay-phep", "idCard"],
  ["gplx", "idCard"],
  ["giay-to", "list"],
  ["nguon-von", "banknote"],
  ["tong-muc-dau-tu", "banknote"],
  ["chi-phi", "banknote"],
  ["du-toan", "banknote"],
  ["thanh-toan", "banknote"],
  ["quyet-toan", "banknote"],
  ["boi-thuong", "banknote"],
  ["tham-dinh", "search"],
  ["kham-nghiem", "search"],
  ["khao-sat", "search"],
  ["bien-ban", "file"],
  ["vien-dan", "file"],
  ["quyet-dinh", "file"],
  ["ho-so", "file"],
  ["hop-dong", "file"],
  ["dang-ky", "file"],
  ["lap-du-an", "file"],
  ["bi-tru", "star"],
  ["tru-diem", "star"],
  ["phuc-hoi", "arrowUp"],
  ["quy-trinh", "steps"],
  ["trinh-tu", "steps"],
  ["nghiem-thu", "steps"],
  ["kiem-thu", "steps"],
  ["thuc-hien-du-an", "steps"],
  ["thoi-han", "calendar"],
  ["thoi-gian", "calendar"],
  ["hieu-luc", "calendar"],
  ["ngay", "calendar"],
  ["ke-hoach", "calendar"],
  ["giam-sat", "monitor"],
  ["cntt", "monitor"],
  ["phan-mem", "monitor"],
  ["ung-xu", "chat"],
  ["thiet-bi", "camera"],
  ["ghi-hinh", "camera"],
  ["thu-bac", "layers"],
  ["khung-van-ban", "layers"],
  ["xe-co-gioi", "car"],
  ["phuong-tien", "car"],
  ["kiem-dinh", "car"],
  ["tuan-tra", "shield"],
  ["kiem-soat", "shield"],
  ["nhiem-vu", "shield"],
  ["tiep-nhan", "bell"],
  ["nguyen-nhan", "help"],
  ["khieu-nai", "chat"],
  ["tu-van", "chat"],
  ["y-kien", "chat"],
  ["di-bo", "user"],
  ["dieu-hanh", "user"],
  ["su-pham", "cap"],
  ["dao-tao", "cap"],
  ["luat", "scale"],
];

/** "Tốc độ, khoảng cách" → "toc-do-khoang-cach": cùng dạng với slug để dò chung một bảng. */
function veDangSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Dò slug trước, không khớp mới dò tiêu đề: slug do người biên soạn đặt nên sát nội dung hơn. */
function timBieuTuong(slug: string, title: string): IconName | undefined {
  for (const nguon of [slug, veDangSlug(title)]) {
    const chuoi = `-${nguon}-`;
    const khop = TU_KHOA_BIEU_TUONG.find(([tu]) => chuoi.includes(`-${tu}-`));
    if (khop) return khop[1];
  }
  return undefined;
}

/** Biểu tượng của một bài theo từ khóa trong slug và tiêu đề; không khớp thì dùng hình quyển sách. */
export function iconChoBai(slug: string, title: string): IconName {
  return timBieuTuong(slug, title) ?? "book";
}

/** Biểu tượng của một chuyên đề, cùng bảng từ khóa với bài; không khớp thì dùng hình mũ tốt nghiệp. */
export function iconChoChuyenDe(slug: string, title: string): IconName {
  return timBieuTuong(slug, title) ?? "cap";
}

/** Chữ trong một khối, dùng cho khối chưa hỗ trợ: gom mọi chuỗi trong dữ liệu theo thứ tự. */
export function chuTrongDuLieu(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (typeof v === "number") return [String(v)];
  if (Array.isArray(v)) return v.flatMap(chuTrongDuLieu);
  if (v && typeof v === "object") return Object.values(v).flatMap(chuTrongDuLieu);
  return [];
}
