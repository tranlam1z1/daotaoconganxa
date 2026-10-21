/** Hợp đồng chung cho mọi adapter nguồn. Xem ke-hoach/04 §3. */

export type FileKind = "pdf" | "docx" | "doc" | "html" | "rtf" | "xlsx" | "other";

export interface SourceFile {
  kind: FileKind;
  url: string;
  fileName?: string;
  /** Nhãn hiển thị ở nguồn (thường là tên file gốc). */
  label?: string;
}

/** Thuộc tính thô của văn bản, đã chuẩn hóa ngày/số ký hiệu. */
export interface RawDocMeta {
  soKyHieu: string;
  /** Tên loại tiếng Việt do nguồn cung cấp ("Nghị định", "Thông tư"). */
  typeName?: string;
  title: string;
  /** Trích yếu. */
  summary?: string;
  issuer?: string;
  signer?: string;
  /** YYYY-MM-DD. */
  issuedDate?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  gazetteNo?: string;
  gazetteDate?: string;
  locality?: string;
  /** Trạng thái hiệu lực do nguồn công bố (chuỗi thô). */
  sourceStatus?: string;
  fields?: string[];
}

/**
 * Mã quan hệ theo ke-hoach/03 §2.6. `direction` cho biết văn bản đang xét
 * là đầu "from" (out) hay đầu "to" (in) của cạnh.
 */
export type RelationType =
  | "can_cu"
  | "huong_dan"
  | "sua_doi"
  | "bai_bo"
  | "thay_the"
  | "dinh_chinh"
  | "hop_nhat"
  | "dinh_chi"
  | "cong_bo_het_hieu_luc"
  | "dan_chieu"
  | "ap_dung_chuyen_tiep"
  | "cha_con";

export interface RawRelation {
  type: RelationType;
  direction: "out" | "in";
  /** Số ký hiệu của văn bản đầu kia (nếu đọc được). */
  otherSoKyHieu?: string;
  otherTitle?: string;
  otherUrl?: string;
  /** Nhãn nhóm quan hệ gốc ở nguồn, giữ lại để đối chiếu. */
  sourceLabel: string;
  confidence?: number;
}

export interface DiscoveredItem {
  /** Khóa ổn định trong nguồn (đi cùng `source` tạo UNIQUE của source_records). */
  sourceId: string;
  url: string;
  /** Thuộc tính đã đọc được ngay ở trang danh sách. */
  preview?: Partial<RawDocMeta>;
  files?: SourceFile[];
}

export interface SourceItem {
  source: string;
  sourceId: string;
  url: string;
  meta: RawDocMeta;
  files: SourceFile[];
  relations: RawRelation[];
  /** HTML thô của trang chi tiết, để lưu kho và kiểm chứng lại về sau. */
  rawHtml?: string;
  etag?: string;
  lastModified?: string;
  /** Ghi chú hạn chế của adapter (ví dụ: quan hệ không lấy được). */
  notes?: string[];
}

export interface DiscoverOptions {
  /** Slug loại văn bản riêng của từng nguồn ("nghi-dinh", "thong-tu"...). */
  type?: string;
  limit?: number;
  /** Trang bắt đầu (1-based). */
  page?: number;
  /** Chỉ lấy văn bản có lastmod/ngày đăng >= giá trị này (YYYY-MM-DD). */
  since?: string;
}

export interface SourceAdapter {
  readonly id: string;
  /** Tên hiển thị của nguồn. */
  readonly name: string;
  /** Thứ tự ưu tiên chọn primary_source (nhỏ hơn = ưu tiên hơn). */
  readonly priority: number;
  discover(opts: DiscoverOptions): Promise<DiscoveredItem[]>;
  /** `id` là sourceId hoặc URL đầy đủ của trang chi tiết. */
  fetchItem(id: string): Promise<SourceItem>;
}

/** Suy ra loại file từ URL / tên file. */
export function fileKindOf(nameOrUrl: string): FileKind {
  const s = nameOrUrl.toLowerCase();
  if (/\.pdf(\?|$|&)/.test(s) || s.includes(".pdf")) return "pdf";
  if (s.includes(".docx")) return "docx";
  if (s.includes(".doc")) return "doc";
  if (s.includes(".rtf")) return "rtf";
  if (s.includes(".xlsx") || s.includes(".xls")) return "xlsx";
  if (s.includes(".htm")) return "html";
  return "other";
}
