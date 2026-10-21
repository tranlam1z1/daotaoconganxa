/**
 * Kiểu dữ liệu cho tầng tìm kiếm lai (hybrid).
 * Xem ke-hoach/07-tim-kiem-rag.md §4.
 */

/** Tầng truy xuất đã tìm thấy một nút. */
export type MatchLane = "citation" | "bm25" | "trigram" | "vector" | "graph";

/** Bộ lọc dùng chung cho mọi truy vấn tìm kiếm. */
export interface SearchFilters {
  /** Ngày tra cứu (YYYY-MM-DD). Mặc định hôm nay. */
  asOf?: string;
  /** Mã loại văn bản: nd, tt, l… */
  docTypes?: string[];
  /** Chỉ lấy văn bản có thứ bậc <= rankMax (số nhỏ = hiệu lực cao). */
  rankMax?: number;
  /**
   * Trạng thái văn bản TẠI thời điểm asOf: con_hieu_luc, het_hieu_luc_mot_phan…
   * Lọc theo `document_versions.status` chứ không theo ảnh chụp `documents.status`.
   */
  status?: string[];
  /** Lĩnh vực (documents.fields). */
  fields?: string[];
  /** Tên/mã cơ quan ban hành (khớp không phân biệt hoa thường). */
  issuer?: string;
  /** Mã địa phương (documents.locality). */
  locality?: string;
  /** Gồm cả nút đã bị bãi bỏ. Mặc định false. */
  includeRepealed?: boolean;
  /** Loại nút cần lấy: dieu, khoan, diem, bang… */
  kinds?: string[];
}

export interface SearchOptions extends SearchFilters {
  q: string;
  /** Số kết quả trả về. Mặc định 20, tối đa 100. */
  limit?: number;
  /** Bỏ qua bao nhiêu kết quả đầu (phân trang). Mặc định 0. */
  offset?: number;
  /** Sinh đoạn trích có đánh dấu <mark>. Mặc định true. */
  highlight?: boolean;
  /**
   * Khi đã có nút khớp đủ mọi từ thì bỏ các nút chỉ khớp vài từ lẻ, mảnh chữ. Mặc định false: hỏi đáp
   * và MCP hỏi bằng câu tự nhiên, hiếm khi có đủ mọi từ, nên cần cả nhóm khớp lẻ làm ngữ cảnh.
   */
  dropLooseMatches?: boolean;
}

/** Một nút trong kết quả tìm kiếm. */
export interface SearchHit {
  /** URN đầy đủ của nút: vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3.khoan-1 */
  urn: string;
  nodeId: string;
  documentId: string;
  versionId: string;
  docUrn: string;
  docType: string;
  rank: number;
  soKyHieu: string;
  shortTitle: string;
  title: string;
  issuer: string | null;
  locality: string | null;
  fields: string[];
  /** Trạng thái mới nhất (cache ở documents.status). */
  docStatus: string;
  /** Trạng thái hiệu lực TẠI thời điểm asOf, tính từ document_versions.status. */
  docStatusAsOf: string;
  issuedDate: string | null;
  path: string;
  fullPath: string;
  kind: string;
  label: string;
  heading: string | null;
  /** Chuỗi ngữ cảnh cha: "Nghị định … > Chương II > Điều 3". */
  contextPath: string | null;
  nodeStatus: string;
  versionKind: string;
  validFrom: string | null;
  validTo: string | null;
  text: string;
  /** Đoạn trích có <mark> quanh vị trí khớp. */
  snippet: string;
  /** Điểm hợp nhất cuối cùng (đã cộng boost). */
  score: number;
  /** Điểm RRF thô, trước boost. */
  rrf: number;
  /** Các tầng đã tìm ra nút này. */
  matchedBy: MatchLane[];
  /** Thứ hạng trong từng tầng (bắt đầu từ 1). */
  ranks: Partial<Record<MatchLane, number>>;
}

export interface SearchResult {
  q: string;
  asOf: string;
  total: number;
  hits: SearchHit[];
  /** Viện dẫn nhận ra trong câu truy vấn (nếu có). */
  citations: Array<{ raw: string; urn: string; found: boolean }>;
  /** Thời gian chạy từng tầng, ms. */
  timings: Record<string, number>;
  /** Cảnh báo (ví dụ: chưa index embedding). */
  warnings: string[];
}

export interface RetrieveOptions extends SearchFilters {
  /** Câu hỏi gốc. */
  q: string;
  /** Các truy vấn con do bước phân tích câu hỏi sinh ra. */
  subQueries?: string[];
  /** Số nút hạt nhân trước khi mở rộng ngữ cảnh. Mặc định 12. */
  topK?: number;
  /** Số nút tối đa thêm vào bằng đồ thị quan hệ. Mặc định 10. */
  maxExpand?: number;
}

export interface RetrieveResult {
  asOf: string;
  /** Nút hạt nhân (đã xếp hạng) + nút mở rộng bằng đồ thị. */
  hits: SearchHit[];
  /** Số nút đến từ bước mở rộng đồ thị. */
  expanded: number;
  citations: Array<{ raw: string; urn: string; found: boolean }>;
  warnings: string[];
  timings: Record<string, number>;
}

export interface IndexResult {
  versionId: string;
  documentId: string;
  /** Số chunk đã ghi vào bảng embeddings. */
  chunks: number;
  /** Số nút đã sinh chunk. */
  nodes: number;
  model: string;
  dim: number;
}
