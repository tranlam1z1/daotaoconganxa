/** Kiểu dữ liệu của từng loại job. Đặt tên hàng đợi theo giai đoạn trong pipeline. */

/**
 * Tên hàng đợi. KHÔNG được chứa dấu hai chấm: BullMQ dùng ":" làm dấu phân cách khóa
 * Redis nên `new Queue("qdpl:discover")` ném lỗi "Queue name cannot contain :".
 */
export const QUEUES = {
  discover: "qdpl-discover",
  fetch: "qdpl-fetch",
  ingest: "qdpl-ingest",
  convert: "qdpl-convert",
  sohoa: "qdpl-sohoa",
  /** @deprecated Cầu nối sang services/docproc (Python) — đã ngưng dùng, thay bằng `sohoa`. */
  docproc: "qdpl-docproc",
  parse: "qdpl-parse",
  extractOps: "qdpl-extract-ops",
  consolidate: "qdpl-consolidate",
  relations: "qdpl-relations",
  index: "qdpl-index",
  reconcile: "qdpl-reconcile",
  /** Soạn bài học bằng AI (ke-hoach/09-a §5). */
  soanBai: "qdpl-soan-bai",
  /** Sinh ảnh nhân vật đồng hành theo lô (ke-hoach/09-b §6). */
  mascotAnh: "qdpl-mascot-anh",
  /** Tự nộp lượt thi quá hạn, chạy lặp mỗi phút (docs/PLAN.md GĐ6). */
  thiHetGio: "qdpl-thi-het-gio",
  /** Dựng sách nói: đọc trước từng khối bài giảng đã xuất bản (docs/PLAN.md GĐ14). */
  sachNoi: "qdpl-sach-noi",
  /** Nhắc học và thông báo đẩy, chạy lặp mỗi 15 phút (docs/PLAN.md GĐ15). */
  nhacHoc: "qdpl-nhac-hoc",
  /** Mùa giải đơn vị: bắt đầu mùa, chốt tuần lúc 06:00 thứ Hai; chạy lặp mỗi giờ (docs/PLAN.md GĐ-G6). */
  muaGiai: "qdpl-mua-giai",
  /** Dọn tài khoản khách bỏ không quá 30 ngày, cùng tiến độ; chạy lặp 6 giờ một lần (migration 0062). */
  donKhach: "qdpl-don-khach",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Thứ tự giai đoạn, dùng cho hiển thị tiến độ và đối soát. */
export const STAGES = [
  "phat_hien",
  "tai_ve",
  "chuyen_doi",
  "phan_tich",
  "trich_lenh",
  "hop_nhat",
  "quan_he",
  "chi_muc",
  "xong",
] as const;
export type Stage = (typeof STAGES)[number];

export interface RunRef {
  /** Đợt nạp mà job này thuộc về; dùng để cập nhật sổ cái và tiến độ. */
  runId?: string;
}

export interface DiscoverJob extends RunRef {
  nguon: string;
  /** Loại văn bản ở nguồn, ví dụ "nghi-dinh". */
  loai?: string;
  /** Chỉ lấy văn bản cập nhật từ ngày này. */
  since?: string;
  limit?: number;
  /** Trang bắt đầu, dùng khi cào theo lô lớn. */
  page?: number;
  /** Chỉ giữ mục có tiêu đề chứa ít nhất một từ khóa (ô khung theo lĩnh vực). */
  tuKhoa?: string[];
  /** Bỏ mục có tiêu đề chứa bất kỳ cụm nào ở đây. */
  loaiTru?: string[];
  /** Số trang tối đa tự đi tiếp; ô khung theo lĩnh vực cần quét hết danh mục. */
  toiDaTrang?: number;
}

export interface FetchJob extends RunRef {
  nguon: string;
  sourceId: string;
  url: string;
}

export interface IngestJob extends RunRef {
  nguon: string;
  sourceId: string;
}

export interface ConvertJob extends RunRef {
  documentUrn: string;
  sourceRecordId?: string;
}

/** Việc số hóa PDF do agent thực hiện qua MCP (ke-hoach/05). */
export interface SoHoaJob extends RunRef {
  documentUrn: string;
  /** URI tệp gốc trong kho đối tượng. */
  inputPath: string;
  sourceRecordId?: string;
  /** Số trang mỗi cụm và số trang chồng lấn; bỏ trống dùng mặc định 5/1. */
  windowSize?: number;
  overlap?: number;
}

/** @deprecated Payload của cầu nối Python cũ. Giữ để đọc được job tồn đọng. */
export interface DocprocJob extends RunRef {
  documentUrn: string;
  inputPath: string;
  outputDir: string;
  useLlm?: boolean;
}

export interface ParseJob extends RunRef {
  documentUrn: string;
  markdownPath?: string;
}

export interface SimpleDocJob extends RunRef {
  documentUrn: string;
}

export interface ReconcileJob {
  runId?: string;
  /** Chỉ đối soát các ô khung này; bỏ trống là toàn bộ. */
  targetMa?: string[];
}

/**
 * Việc soạn bài và việc sinh ảnh chỉ mang theo ID BẢN GHI, không mang theo nội dung.
 * Nội dung nằm ở `authoring_jobs` / `mascot_render_jobs`, nên job chạy lại được sau khi
 * Redis mất dữ liệu, và người vận hành sửa được đầu vào mà không phải xoá job.
 */
export interface SoanBaiJob extends RunRef {
  jobId: string;
}

export interface MascotAnhJob extends RunRef {
  jobId: string;
}

/** Job lặp không cần dữ liệu: mỗi lần chạy quét mọi lượt thi quá hạn. */
export type ThiHetGioJob = Record<string, never>;

/** Dựng sách nói cho một bài; bỏ trống `lessonId` thì quét mọi bài đã xuất bản (job lặp). */
export interface SachNoiJob {
  lessonId?: string;
}

/** Job lặp nhắc học: mỗi lần chạy tự tính ai cần nhận gì lúc đó, không cần dữ liệu. */
export type NhacHocJob = Record<string, never>;

/** Job lặp mùa giải: mỗi lần chạy tự xét mùa nào cần bắt đầu, tuần nào cần chốt. */
export type MuaGiaiJob = Record<string, never>;

/** Job lặp dọn tài khoản khách: mỗi lần chạy tự tìm khách quá hạn. */
export type DonKhachJob = Record<string, never>;

export interface JobPayloads {
  [QUEUES.discover]: DiscoverJob;
  [QUEUES.fetch]: FetchJob;
  [QUEUES.ingest]: IngestJob;
  [QUEUES.convert]: ConvertJob;
  [QUEUES.sohoa]: SoHoaJob;
  [QUEUES.docproc]: DocprocJob;
  [QUEUES.parse]: ParseJob;
  [QUEUES.extractOps]: SimpleDocJob;
  [QUEUES.consolidate]: SimpleDocJob;
  [QUEUES.relations]: SimpleDocJob;
  [QUEUES.index]: SimpleDocJob;
  [QUEUES.reconcile]: ReconcileJob;
  [QUEUES.soanBai]: SoanBaiJob;
  [QUEUES.mascotAnh]: MascotAnhJob;
  [QUEUES.thiHetGio]: ThiHetGioJob;
  [QUEUES.sachNoi]: SachNoiJob;
  [QUEUES.nhacHoc]: NhacHocJob;
  [QUEUES.muaGiai]: MuaGiaiJob;
  [QUEUES.donKhach]: DonKhachJob;
}

/** Giai đoạn tương ứng với mỗi hàng đợi, để ghi sổ cái. */
export const QUEUE_STAGE: Record<string, Stage> = {
  [QUEUES.discover]: "phat_hien",
  [QUEUES.fetch]: "tai_ve",
  [QUEUES.ingest]: "tai_ve",
  [QUEUES.convert]: "chuyen_doi",
  [QUEUES.sohoa]: "chuyen_doi",
  [QUEUES.docproc]: "chuyen_doi",
  [QUEUES.parse]: "phan_tich",
  [QUEUES.extractOps]: "trich_lenh",
  [QUEUES.consolidate]: "hop_nhat",
  [QUEUES.relations]: "quan_he",
  [QUEUES.index]: "chi_muc",
};
