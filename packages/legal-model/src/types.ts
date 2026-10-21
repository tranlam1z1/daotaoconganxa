/** Kiểu dữ liệu lõi của mô hình văn bản quy phạm pháp luật. Xem ke-hoach/03-mo-hinh-du-lieu.md */

/** Loại nút cấu trúc trong văn bản. */
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

/** Trạng thái của một nút tại một thời điểm. */
export type NodeStatus = "active" | "amended" | "repealed" | "suspended" | "added";

/** Trạng thái hiệu lực của cả văn bản. */
export type DocStatus =
  | "chua_hieu_luc"
  | "con_hieu_luc"
  | "het_hieu_luc_mot_phan"
  | "het_hieu_luc"
  | "ngung_hieu_luc"
  | "khong_xac_dinh";

export interface LegalNode {
  /** Path rút gọn, ví dụ "dieu-15.khoan-2.diem-a". Rỗng với nút gốc. */
  path: string;
  /** Path đầy đủ có phần/chương/mục, ví dụ "chuong-2.muc-1.dieu-15.khoan-2". */
  fullPath: string;
  kind: NodeKind;
  /** Nhãn hiển thị: "Điều 15", "2.", "a)". */
  label: string;
  /** Tiêu đề (điều, chương, mục). */
  heading?: string;
  /** Nội dung Markdown của riêng nút, không gồm nút con. */
  text: string;
  children: LegalNode[];
  status: NodeStatus;
  /** Ghi chú hợp nhất (footnote) khi nút bị sửa đổi/bãi bỏ/bổ sung. */
  note?: string;
  /** Nguồn trang của nội dung, phục vụ "xem bản gốc". */
  pageRefs?: PageRef[];
  /** Đánh dấu khoản ẩn (điều không đánh số khoản). */
  implicit?: boolean;
  /** Id tài sản (bảng/hình/công thức) gắn với nút. */
  assetId?: string;
}

export interface PageRef {
  file: string;
  page: number;
  bbox?: [number, number, number, number];
}

export type AmendOpKind =
  | "replace"
  | "insert_after"
  | "insert_before"
  | "append_child"
  | "delete"
  | "repeal"
  | "suspend"
  | "rename"
  | "replace_phrase";

export interface AmendOp {
  id: string;
  /** URN văn bản chứa lệnh sửa đổi. */
  amendingDocUrn: string;
  /** Nhãn khoản chứa lệnh, ví dụ "khoản 5 Điều 1". */
  amendingLabel?: string;
  /** URN văn bản bị sửa đổi. */
  targetDocUrn: string;
  /** Path nút đích trong văn bản bị sửa đổi. Rỗng nghĩa là cấp văn bản. */
  targetPath: string;
  op: AmendOpKind;
  payload?: {
    /** Nội dung mới (Markdown, gồm cả nhãn nếu là replace toàn nút). */
    text?: string;
    /** Nhãn của nút mới khi chèn. */
    newLabel?: string;
    /** Loại nút mới khi chèn. */
    newKind?: NodeKind;
    heading?: string;
    /** Cho replace_phrase. */
    find?: string;
    replace?: string;
    /** Phạm vi áp dụng replace_phrase: danh sách path; rỗng = toàn văn bản. */
    scopePaths?: string[];
  };
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string;
  /** Thứ tự trong văn bản sửa đổi, để áp dụng ổn định. */
  ordinal: number;
  extraction: "rule" | "llm" | "editor";
  confidence: number;
  reviewStatus: "pending" | "approved" | "rejected" | "needs_legal";
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
}

export interface DocumentTree {
  meta: DocumentMeta;
  root: LegalNode;
}
