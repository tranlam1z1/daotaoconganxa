/**
 * Kiểu dữ liệu dùng ở tầng giao diện.
 * Phản chiếu `packages/legal-model/src/types.ts` (ke-hoach/03) — khai báo lại tại đây
 * để `apps/web` build độc lập, không phụ thuộc tiến độ của package khác.
 */

export type NodeKind =
  | "van_ban"
  | "loi_noi_dau"
  | "can_cu"
  | "phan"
  | "chuong"
  | "muc"
  | "tieu_muc"
  | "dieu"
  | "khoan"
  | "diem"
  | "doan"
  | "bang"
  | "cong_thuc"
  | "hinh"
  | "phu_luc"
  | "chu_ky";

export type NodeStatus = "active" | "amended" | "repealed" | "suspended" | "added";

export type DocStatus =
  | "chua_hieu_luc"
  | "con_hieu_luc"
  | "het_hieu_luc_mot_phan"
  | "het_hieu_luc"
  | "ngung_hieu_luc"
  | "khong_xac_dinh";

export interface PageRef {
  file: string;
  page: number;
  bbox?: [number, number, number, number];
}

export interface LegalNode {
  /** Path rút gọn, ví dụ "dieu-15.khoan-2.diem-a". Rỗng với nút gốc. */
  path: string;
  /** Path đầy đủ có phần/chương/mục. */
  fullPath: string;
  kind: NodeKind;
  /** Nhãn hiển thị: "Điều 15", "2.", "a)". */
  label: string;
  heading?: string;
  /** Nội dung Markdown của riêng nút, không gồm nút con. */
  text: string;
  children: LegalNode[];
  status: NodeStatus;
  /** Chú thích hợp nhất theo NĐ 250/2026 (ke-hoach/03 §5). */
  note?: string;
  pageRefs?: PageRef[];
  implicit?: boolean;
  assetId?: string;
}

export interface DocumentMeta {
  urn: string;
  docType: string;
  rank: number;
  isNormative: boolean;
  soKyHieu: string;
  title: string;
  shortTitle: string;
  issuer: string;
  signer?: string;
  issuedDate: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  gazetteNo?: string;
  gazetteDate?: string;
  fields: string[];
  status: DocStatus;
  summary?: string;
  /** Các trường mở rộng phục vụ trang "thuộc tính" (ke-hoach/03 §3). */
  signedDate?: string;
  publishedDbDate?: string;
  keywords?: string[];
  scopeArea?: string;
  scopeSubjects?: string;
  transitionalNote?: string;
  draftHistory?: string;
  sourceFile?: string;
  sourcePages?: number;
  ocrQuality?: number;
  crawledAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type VersionKind =
  | "original"
  | "corrigendum"
  | "consolidated_official"
  | "consolidated_auto"
  | "reissue";

export interface DocumentVersion {
  versionNo: number;
  kind: VersionKind;
  validFrom: string;
  validTo?: string;
  /** Văn bản gây ra phiên bản này. */
  reason?: string;
  reasonUrn?: string;
  contentHash?: string;
}

export interface StatusEvent {
  date: string;
  status: DocStatus;
  note: string;
  sourceUrn?: string;
}

export interface DocumentDetail {
  meta: DocumentMeta;
  versions: DocumentVersion[];
  status: DocStatus;
  timeline?: StatusEvent[];
  /** Văn bản nạp từ bản quét, có tệp PDF gốc ở `<trang đọc>/tep-goc`. */
  coTepGoc: boolean;
  /** Số trang của tệp gốc; từng trang có ảnh ở `<trang đọc>/tep-goc/trang/<số>` cho điện thoại. */
  soTrangTepGoc: number;
}

export interface Footnote {
  /** Mã tham chiếu, ví dụ "3" cho [^3]. */
  id: string;
  /** Path nút mang chú thích. */
  path: string;
  text: string;
  sourceUrn?: string;
  effectiveFrom?: string;
}

export interface DocumentContent {
  root: LegalNode;
  footnotes: Footnote[];
  versionKind: VersionKind;
  /** Ngày hiệu lực mà nội dung này phản ánh. */
  asOf?: string;
}

export type RelationType =
  | "can_cu"
  | "la_can_cu_cua"
  | "huong_dan"
  | "duoc_huong_dan_boi"
  | "sua_doi"
  | "bi_sua_doi_boi"
  | "bai_bo"
  | "bi_bai_bo_boi"
  | "thay_the"
  | "bi_thay_the_boi"
  | "dinh_chinh"
  | "hop_nhat"
  | "dinh_chi"
  | "cong_bo_het_hieu_luc"
  | "dan_chieu"
  | "duoc_dan_chieu_boi"
  | "ap_dung_chuyen_tiep"
  | "cha"
  | "con";

export interface RelationItem {
  urn: string;
  shortTitle: string;
  title?: string;
  docType: string;
  soKyHieu: string;
  issuedDate?: string;
  status: DocStatus;
  /** Nút bị tác động, ví dụ "dieu-15.khoan-2". */
  targetPath?: string;
  targetLabel?: string;
  effectiveFrom?: string;
  note?: string;
}

export interface RelationGroup {
  type: RelationType;
  label: string;
  items: RelationItem[];
}

export interface SearchHit {
  urn: string;
  docTitle: string;
  /** Tên đầy đủ (trích yếu) của văn bản; `docTitle` ưu tiên tên ngắn. */
  docFullTitle?: string;
  /** Path nút, rỗng nếu khớp cấp văn bản. */
  path: string;
  label: string;
  /** Tên điều, ví dụ "Phạm vi điều chỉnh". */
  heading?: string;
  /** Ngữ cảnh cha: "Chương II > Mục 1 > Điều 15". */
  contextPath: string;
  snippet: string;
  score: number;
  status: DocStatus;
  docType?: string;
  soKyHieu?: string;
  issuedDate?: string;
  group?: "vien_dan" | "nut" | "van_ban" | "use_case" | "bai_hoc";
}

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface SearchFacets {
  docType: FacetValue[];
  issuer: FacetValue[];
  field: FacetValue[];
  status: FacetValue[];
  year: FacetValue[];
}

export interface SearchResponse {
  hits: SearchHit[];
  facets: SearchFacets;
  total: number;
  page: number;
  limit: number;
}

export interface DocumentListItem {
  urn: string;
  docType: string;
  soKyHieu: string;
  shortTitle: string;
  title: string;
  issuer: string;
  issuedDate: string;
  effectiveFrom?: string;
  status: DocStatus;
  fields: string[];
  summary?: string;
}

export interface DocumentListResponse {
  items: DocumentListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface Citation {
  urn: string;
  citedText: string;
  label: string;
  /** true khi căn cứ đã hết hiệu lực tại thời điểm hỏi. */
  expired?: boolean;
  status?: DocStatus;
  effectiveTo?: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  insufficientBasis: boolean;
  warnings: string[];
}

export type DiffKind = "equal" | "add" | "del";

export interface DiffToken {
  kind: DiffKind;
  text: string;
}

export interface DiffNode {
  path: string;
  label: string;
  heading?: string;
  changeKind: "added" | "removed" | "changed" | "unchanged";
  tokens: DiffToken[];
}

export interface DiffResponse {
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  nodes: DiffNode[];
  stats: { added: number; removed: number; changed: number };
}

export interface UseCaseItem {
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  citationHealth: "ok" | "warning" | "broken";
  updatedAt?: string;
}

export interface CourseItem {
  slug: string;
  title: string;
  summary: string;
  level: "co_ban" | "nang_cao" | "chuyen_sau";
  lessonCount: number;
  durationMinutes?: number;
  tags: string[];
}

export interface TopicItem {
  slug: string;
  title: string;
  description: string;
  docCount: number;
}

/**
 * Thông tin người dùng đã khai để được xác minh cán bộ, và kết quả xét duyệt (migration 0064).
 * Chỉ có khi tài khoản chưa được xác minh.
 */
export interface ThongTinXacMinh {
  trang_thai: "cho_duyet" | "da_xac_minh" | "tu_choi";
  so_hieu: string | null;
  don_vi: { id: string; ten: string } | null;
  cap_bac_chuc_vu: string | null;
  so_dien_thoai: string | null;
  ly_do_tu_choi: string | null;
}

/** Một đơn vị trong danh sách chọn khi đăng ký; `cap` là độ sâu tính từ gốc (gốc = 1). */
export interface DonViChon {
  id: string;
  ten: string;
  cap: number;
}

/**
 * Danh tính người đang đăng nhập. Khai ở đây (không phải trong auth.server.ts) để các
 * thành phần chạy trên trình duyệt dùng được kiểu mà không chạm vào mã chỉ có ở máy chủ.
 */
export interface NguoiDung {
  email: string;
  ten: string | null;
  vai_tro: string;
  mo_ta_vai_tro: string;
  mien: string | null;
  la_quan_tri: boolean;
  /** Tên tệp ảnh đại diện tự tải lên (xem ở /anh-dai-dien/:tep); null thì hiện chữ cái đầu tên. */
  anh_dai_dien?: string | null;
  /** Tài khoản cán bộ (đăng nhập bằng mật khẩu); null với tài khoản Google. */
  ten_dang_nhap?: string | null;
  don_vi?: { id: string; ma: string; ten: string } | null;
  /** true khi đang dùng mật khẩu tạm: mọi trang chuyển tới /doi-mat-khau. */
  phai_doi_mat_khau?: boolean;
  /**
   * Tài khoản chưa được xác minh cán bộ (chờ duyệt hoặc bị từ chối, migration 0064): chỉ dùng được
   * trang Tài khoản cho tới khi quản trị viên hoặc cán bộ quản lý đơn vị duyệt.
   */
  cho_xac_minh?: boolean;
  xac_minh?: ThongTinXacMinh | null;
}
