/**
 * Kiểu dữ liệu và nhãn cho trang quản lý văn bản (/quan-tri/van-ban), khớp với
 * apps/api/src/routes/quan-tri-van-ban.ts.
 */
import type { DocStatus } from "./types";

export const API_VAN_BAN = "/v1/quan-tri/van-ban";

export interface VanBanQuanTri {
  documentGroup?: string;
  primarySource?: string | null;
  urn: string;
  docType: string;
  docTypeName: string;
  soKyHieu: string;
  title: string;
  shortTitle: string;
  issuer: string | null;
  signer: string | null;
  locality: string | null;
  issuedDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  fields: string[];
  status: DocStatus;
  summary: string | null;
}

export interface DongVanBan extends VanBanQuanTri {
  /** Trạng thái hiệu lực tính theo hôm nay; `status` là giá trị lưu sẵn để sửa trong biểu mẫu. */
  statusAsOf: DocStatus | null;
  updatedAt: string;
  primarySource: string | null;
  coNoiDung: boolean;
  /** Bản quét lưu kèm tệp PDF gốc: trang đọc hiện tệp này khi chưa có nội dung chữ. */
  coTepGoc: boolean;
  suaTrongQuanTri: boolean;
}

export interface ThamChieu {
  loai: string;
  nhan: string;
  so: number;
}

export interface ChiTietVanBan {
  document: VanBanQuanTri;
  markdown: string | null;
  phienBanGoc: {
    versionNo: number;
    validFrom: string | null;
    validTo: string | null;
    luuLuc: string;
    nguon: string | null;
    nguoiSua: string | null;
  } | null;
  soPhienBan: number;
  thamChieu: ThamChieu[];
  coTepGoc: boolean;
}

export interface MucLuc {
  kind: string;
  label: string;
  heading: string | null;
  depth: number;
  soKhoan: number;
}

export interface TomTatPhanTich {
  soNut: number;
  dem: Record<string, number>;
  canhBao: Array<{ kind: string; message: string; path: string | null }>;
  mucLuc: MucLuc[];
}

export interface DanhMucVanBan {
  items: Array<{ code: string; name: string; isNormative: boolean }>;
  trangThai: Array<{ value: DocStatus; label: string }>;
}

export type HangDoi = "da_xep" | "khong_co_redis" | "loi";

/** Câu báo sau khi lưu: phần nào có ngay, phần nào chờ worker. */
export function loiBaoHangDoi(h: HangDoi | null): string {
  if (h === "da_xep") return " Tìm kiếm theo ý nghĩa và quan hệ văn bản sẽ cập nhật khi worker xử lý xong.";
  if (h === "khong_co_redis" || h === "loi")
    return " Chưa xếp được việc cập nhật tìm kiếm theo ý nghĩa và quan hệ văn bản; tìm theo chữ vẫn dùng được ngay.";
  return "";
}

/** Nhãn đếm nút cấu trúc, theo thứ tự hiển thị. */
export const NHAN_DEM: Array<[string, string]> = [
  ["phan", "phần"],
  ["chuong", "chương"],
  ["muc", "mục"],
  ["dieu", "điều"],
  ["khoan", "khoản"],
  ["diem", "điểm"],
  ["phu_luc", "phụ lục"],
];

/** Đường dẫn trang sửa trong quản trị; URN có "/" nên đi qua query. */
export function duongSuaVanBan(urn: string): string {
  return `/quan-tri/van-ban/sua?urn=${encodeURIComponent(urn)}`;
}

/** Khớp PDF_TOI_DA ở apps/api/src/routes/quan-tri-van-ban.ts. */
export const PDF_TOI_DA_MB = 30;

/**
 * Kết quả nạp tệp PDF (POST /tu-pdf): thuộc tính đoán được để điền biểu mẫu, chưa lưu văn bản nào.
 * `tuyen = "pdf_anh"` là bản quét không có lớp chữ, không đoán được thuộc tính. `tepGoc` là tệp đã
 * cất vào kho; lưu văn bản kèm giá trị này thì trang đọc hiện tệp đó.
 */
export interface KetQuaTuPdf {
  soTrang: number;
  tuyen: "pdf_text" | "pdf_anh";
  lyDo: string;
  thuocTinh: {
    soKyHieu?: string;
    docType?: string;
    title?: string;
    issuer?: string;
    issuedDate?: string;
    effectiveFrom?: string;
    signer?: string;
  };
  /** Văn bản cùng số ký hiệu đã có trong kho. */
  daCo: { urn: string; soKyHieu: string } | null;
  tepGoc: string;
}

/**
 * Tiến độ việc đọc tệp gốc bản quét bằng AI (GET /:urn/doc-tep-goc). `state: null` khi chưa từng
 * đọc; `cho`, `dang_chay` là còn đang đọc.
 */
export interface TienDoDocTepGoc {
  state: "cho" | "dang_chay" | "xong" | "loi" | "huy" | null;
  error?: string | null;
  cumXong?: number;
  soCum?: number;
  soTrang?: number;
}
