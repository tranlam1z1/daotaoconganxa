/** Kiểu dữ liệu dùng chung cho việc số hóa (ke-hoach/05). */

/** Tuyến xử lý một tệp đầu vào. */
export type TuyenSoHoa = "docx" | "html" | "markdown" | "pdf_text" | "pdf_anh";

export const NHAN_TUYEN: Record<TuyenSoHoa, string> = {
  docx: "DOCX — trích thẳng trong TypeScript",
  html: "HTML — chuyển thẳng trong TypeScript",
  markdown: "Markdown/văn bản thuần — dùng nguyên",
  pdf_text: "PDF có lớp văn bản — trích sẵn bản nháp, agent soát và nối đoạn",
  pdf_anh: "PDF ảnh quét — agent đọc ảnh trang và tái cấu trúc",
};

export interface KhoiText {
  /** [x0, y0, x1, y1] theo đơn vị điểm (72 dpi), gốc ở góc trên trái. */
  bbox: [number, number, number, number];
  text: string;
  /** "text" hoặc "image" theo phân loại của MuPDF. */
  loai: "text" | "image";
}

export interface TrangText {
  /** Số trang, đánh số từ 1. */
  trang: number;
  /** Toàn bộ chữ của trang, giữ nguyên ngắt dòng của bản in. */
  text: string;
  dong: string[];
  soKyTu: number;
  khoi: KhoiText[];
  rong: number;
  cao: number;
}

/** Một cụm trang để agent xử lý một lượt. */
export interface CuaSo {
  /** Số thứ tự cửa sổ, đánh số từ 1. */
  idx: number;
  tuTrang: number;
  denTrang: number;
  /** Trang chồng lấn với cửa sổ trước (nếu có). */
  trangChongLan?: number;
}

/** Trạng thái dang dở ở cuối một cửa sổ, để nối liền với cửa sổ sau (05 §4.1). */
export interface TrangThaiMo {
  /** Câu ở cuối cửa sổ chưa kết thúc. */
  sentence_open: boolean;
  last_node_path?: string | null;
  last_node_kind?: string | null;
  table_open: boolean;
  table_cols?: number | null;
  /** 80–160 ký tự cuối, để bộ ghép so khớp mờ. */
  last_text_tail?: string;
}

export const TRANG_THAI_MO_RONG: TrangThaiMo = {
  sentence_open: false,
  last_node_path: null,
  last_node_kind: null,
  table_open: false,
  table_cols: null,
  last_text_tail: "",
};

export interface BangKhaiBao {
  page?: number;
  node_path?: string;
  rows: number;
  cols: number;
  format?: "gfm" | "html";
  continued_from_previous?: boolean;
}

export interface SuaLoi {
  page?: number;
  before: string;
  after: string;
  reason: string;
}

export type LoaiCanhBao =
  | "gap"
  | "duplicate"
  | "orphan"
  | "table"
  | "formula"
  | "unreadable"
  | "layout"
  | "noise";

export interface CanhBao {
  kind: LoaiCanhBao | string;
  page?: number;
  message: string;
}

/** Kết quả agent nộp cho một cửa sổ (đúng lược đồ ở prompts/convert/page-window.md §9). */
export interface KetQuaCuaSo {
  markdown: string;
  open_state: TrangThaiMo;
  tables?: BangKhaiBao[];
  formulas?: Array<{ page?: number; node_path?: string; latex: string; has_alt?: boolean }>;
  figures?: Array<{ page?: number; node_path?: string; caption?: string }>;
  corrections?: SuaLoi[];
  warnings?: CanhBao[];
  unreadable_count?: number;
  page_range?: [number, number];
}
