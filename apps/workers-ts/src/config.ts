/** Cấu hình chung của worker, đọc từ biến môi trường (.env được Bun nạp sẵn). */

const num = (v: string | undefined, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

export const config = {
  /** Thư mục gốc lưu file thô. Xem ke-hoach/04 §4. */
  storageDir: process.env.STORAGE_DIR?.trim() || "./data",
  /** User-Agent có thông tin liên hệ (bắt buộc theo ke-hoach/04 §3). */
  userAgent:
    process.env.CRAWLER_USER_AGENT?.trim() || "quydinhphapluat.vn-bot/0.1 (+https://quydinhphapluat.vn/bot)",
  /** Số request tối đa mỗi giây cho MỖI host. Mặc định 1 (lịch sự). */
  rps: num(process.env.CRAWLER_RPS, 1),
  timeoutMs: num(process.env.CRAWLER_TIMEOUT_MS, 30_000),
  maxRetries: num(process.env.CRAWLER_MAX_RETRIES, 3),
  /** Đặt CRAWLER_OBEY_ROBOTS=0 chỉ khi có thỏa thuận riêng với chủ nguồn. */
  obeyRobots: (process.env.CRAWLER_OBEY_ROBOTS ?? "1") !== "0",
  /** File PEM chứa CA bổ sung (khi nguồn dùng CA nội bộ). */
  caFile: process.env.CRAWLER_CA_FILE?.trim() || "",
  /** Queue mà service Python services/docproc lắng nghe. */
  docprocQueue: process.env.DOCPROC_QUEUE?.trim() || "docproc",
};

export type Config = typeof config;
