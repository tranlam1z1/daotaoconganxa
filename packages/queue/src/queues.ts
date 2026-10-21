/**
 * Định nghĩa hàng đợi và chính sách chạy.
 *
 * Ba điểm quan trọng cho việc nạp kho dài ngày:
 *  1. GIỚI HẠN TỐC ĐỘ theo nguồn — máy chủ nhà nước không chịu tải cào ồ ạt.
 *  2. THỬ LẠI CÓ LÙI THỜI GIAN — lỗi mạng là bình thường, không được mất văn bản.
 *  3. ĐỊNH DANH JOB TẤT ĐỊNH — chạy lại lệnh nạp không tạo job trùng.
 */
import { type JobsOptions, Queue, QueueEvents, type RateLimiterOptions } from "bullmq";
import { getConnection } from "./connection.ts";
import { type JobPayloads, QUEUES, type QueueName } from "./types.ts";

/** Chính sách mặc định: thử lại 5 lần, lùi thời gian theo cấp số nhân từ 5 giây. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5000 },
  // Giữ lại lịch sử vừa đủ để soi lỗi mà không phình Redis.
  removeOnComplete: { age: 24 * 3600, count: 5000 },
  removeOnFail: { age: 14 * 24 * 3600, count: 20_000 },
};

/**
 * Giới hạn tốc độ theo hàng đợi. Bộ giới hạn của BullMQ nằm trong Redis nên áp cho MỌI worker cùng
 * nghe một hàng đợi — đây là lớp bảo vệ CSDL dùng chung dù có bao nhiêu tiến trình worker.
 *
 *  - Cào và tải file: lịch sự với máy chủ nguồn.
 *  - Các bước ghi CSDL nặng (sau sự cố 08/9/2026): parse ghi hàng nghìn nút và cập nhật chỉ mục
 *    GIN/GiST; index chèn vector vào chỉ mục HNSW; relations/extract-ops/consolidate đọc ghi nhiều.
 *
 * Ghi đè bằng `BULL_RATE_<TEN>=<số job>/<mili giây>` (ví dụ BULL_RATE_INDEX=1/20000), hoặc
 * `BULL_RATE_<TEN>=0` để bỏ giới hạn của hàng đợi đó.
 */
const RATE_LIMITS_MAC_DINH: Partial<Record<QueueName, RateLimiterOptions>> = {
  [QUEUES.discover]: { max: 1, duration: 2000 },
  [QUEUES.fetch]: { max: 1, duration: 1000 },
  [QUEUES.ingest]: { max: 1, duration: 1000 },
  [QUEUES.convert]: { max: 1, duration: 2000 },
  [QUEUES.sohoa]: { max: 1, duration: 2000 },
  [QUEUES.parse]: { max: 1, duration: 5000 },
  [QUEUES.extractOps]: { max: 1, duration: 3000 },
  [QUEUES.consolidate]: { max: 1, duration: 5000 },
  [QUEUES.relations]: { max: 1, duration: 3000 },
  [QUEUES.index]: { max: 1, duration: 10_000 },
};

/** Khóa biến môi trường giới hạn tốc độ: qdpl-extract-ops -> BULL_RATE_EXTRACT_OPS. */
export function khoaEnvRate(name: QueueName): string {
  return `BULL_RATE_${name
    .replace(/^qdpl-/, "")
    .replace(/-/g, "_")
    .toUpperCase()}`;
}

/** Giới hạn tốc độ từng hàng đợi sau khi áp biến môi trường. */
export function docRateLimits(
  env: NodeJS.ProcessEnv = process.env,
): Partial<Record<QueueName, RateLimiterOptions>> {
  const ra: Partial<Record<QueueName, RateLimiterOptions>> = { ...RATE_LIMITS_MAC_DINH };
  for (const name of Object.values(QUEUES) as QueueName[]) {
    const v = env[khoaEnvRate(name)]?.trim();
    if (!v) continue;
    if (v === "0") {
      delete ra[name];
      continue;
    }
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(v);
    if (m && Number(m[1]) >= 1 && Number(m[2]) >= 1) ra[name] = { max: Number(m[1]), duration: Number(m[2]) };
  }
  return ra;
}

export const RATE_LIMITS: Partial<Record<QueueName, RateLimiterOptions>> = docRateLimits();

/**
 * Số job chạy song song cho mỗi hàng đợi (mặc định). Ghi đè bằng biến môi trường:
 * `BULL_CONCURRENCY` cho mọi hàng đợi, hoặc `BULL_CONCURRENCY_<TEN>` cho một hàng đợi
 * (tên viết hoa, gạch ngang thành gạch dưới, bỏ tiền tố qdpl-: BULL_CONCURRENCY_SOHOA=1).
 *
 * Mặc định đã HẠ sau sự cố 08/9/2026 (CPU cụm Postgres dùng chung trên DigitalOcean, 1 vCPU, lên 100%):
 * `convert` ghép PDF nhiều kỳ (pdf-lib) và `sohoa` đọc lớp văn bản từng trang (MuPDF) tốn CPU
 * theo số trang (tối đa 46–52 giây/job với PDF 200–300 trang); `index` sinh embedding và ghi
 * pgvector trung bình 31 giây/job. Ngoài concurrency từng hàng đợi, worker còn có bộ hãm toàn
 * tiến trình `BULL_MAX_ACTIVE` / `BULL_CPU_DUTY` (apps/workers-ts/src/bull/bo-ham.ts).
 */
const CONCURRENCY_MAC_DINH: Record<QueueName, number> = {
  [QUEUES.discover]: 1,
  [QUEUES.fetch]: 2,
  [QUEUES.ingest]: 2,
  [QUEUES.convert]: 1,
  // Số hóa TẠO việc cho agent nhưng phải đọc lớp văn bản của mọi trang PDF — nặng theo số trang.
  [QUEUES.sohoa]: 1,
  [QUEUES.docproc]: 1,
  [QUEUES.parse]: 2,
  [QUEUES.extractOps]: 2,
  [QUEUES.consolidate]: 1,
  [QUEUES.relations]: 2,
  [QUEUES.index]: 1,
  [QUEUES.reconcile]: 1,
  // Soạn bài gọi mô hình: chạy thưa để không đốt hạn mức và không vượt trần chi phí.
  [QUEUES.soanBai]: 2,
  [QUEUES.mascotAnh]: 1,
  [QUEUES.thiHetGio]: 1,
  // Sách nói gọi Vbee tuần tự từng khối: một job một lúc là đủ và không đốt hạn mức ký tự.
  [QUEUES.sachNoi]: 1,
  [QUEUES.nhacHoc]: 1,
  [QUEUES.muaGiai]: 1,
  [QUEUES.donKhach]: 1,
};

function docSoNguyenDuong(v: string | undefined): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

/** Khóa biến môi trường của một hàng đợi: qdpl-extract-ops -> BULL_CONCURRENCY_EXTRACT_OPS. */
export function khoaEnvConcurrency(name: QueueName): string {
  return `BULL_CONCURRENCY_${name
    .replace(/^qdpl-/, "")
    .replace(/-/g, "_")
    .toUpperCase()}`;
}

/** Concurrency từng hàng đợi sau khi áp biến môi trường. */
export function docConcurrency(env: NodeJS.ProcessEnv = process.env): Record<QueueName, number> {
  const chung = docSoNguyenDuong(env.BULL_CONCURRENCY);
  const ra = {} as Record<QueueName, number>;
  for (const [name, macDinh] of Object.entries(CONCURRENCY_MAC_DINH) as [QueueName, number][]) {
    ra[name] = docSoNguyenDuong(env[khoaEnvConcurrency(name)]) ?? chung ?? macDinh;
  }
  return ra;
}

export const CONCURRENCY: Record<QueueName, number> = docConcurrency();

const cache = new Map<string, Queue>();

export function getQueue<K extends QueueName>(name: K): Queue<JobPayloads[K]> {
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, { connection: getConnection(), defaultJobOptions: DEFAULT_JOB_OPTIONS });
    cache.set(name, q);
  }
  return q as Queue<JobPayloads[K]>;
}

export function allQueueNames(): QueueName[] {
  return Object.values(QUEUES);
}

/**
 * Định danh job tất định: cùng một việc thì luôn cùng jobId, nên chạy lại lệnh nạp
 * sẽ không tạo job trùng (BullMQ bỏ qua job có jobId đã tồn tại).
 */
export function jobId(name: QueueName, key: string): string {
  // Không dùng dấu hai chấm: một số phiên bản BullMQ từ chối dấu này trong jobId tự đặt.
  return `${name.replace(/^qdpl-/, "")}--${key.replace(/:/g, "-")}`;
}

export interface AddOptions extends JobsOptions {
  /** Khóa để sinh jobId tất định. Bỏ trống thì BullMQ tự sinh id ngẫu nhiên. */
  key?: string;
}

export async function add<K extends QueueName>(
  name: K,
  data: JobPayloads[K],
  opts: AddOptions = {},
): Promise<string | undefined> {
  const { key, ...rest } = opts;
  // BullMQ ràng buộc kiểu tên job theo payload; ở đây tên job trùng tên hàng đợi.
  const job = await (getQueue(name) as Queue).add(name, data as never, {
    ...rest,
    ...(key ? { jobId: jobId(name, key) } : {}),
  });
  return job.id;
}

/** Thêm nhiều job một lần — nhanh hơn hẳn khi nạp hàng nghìn văn bản. */
export async function addBulk<K extends QueueName>(
  name: K,
  items: Array<{ data: JobPayloads[K]; key?: string; opts?: JobsOptions }>,
): Promise<number> {
  if (!items.length) return 0;
  const jobs = await (getQueue(name) as Queue).addBulk(
    items.map((i) => ({
      name,
      data: i.data as never,
      opts: { ...i.opts, ...(i.key ? { jobId: jobId(name, i.key) } : {}) },
    })),
  );
  return jobs.length;
}

const eventsCache = new Map<string, QueueEvents>();

export function getQueueEvents(name: QueueName): QueueEvents {
  let e = eventsCache.get(name);
  if (!e) {
    e = new QueueEvents(name, { connection: getConnection() });
    eventsCache.set(name, e);
  }
  return e;
}

export async function closeQueues(): Promise<void> {
  for (const q of cache.values()) await q.close().catch(() => undefined);
  for (const e of eventsCache.values()) await e.close().catch(() => undefined);
  cache.clear();
  eventsCache.clear();
}

/** Tạm dừng / chạy lại toàn bộ hàng đợi — dùng khi cần hạ tải hoặc bảo trì. */
export async function pauseAll(): Promise<void> {
  for (const n of allQueueNames()) await getQueue(n).pause();
}
export async function resumeAll(): Promise<void> {
  for (const n of allQueueNames()) await getQueue(n).resume();
}

/** Xóa sạch mọi hàng đợi. Chỉ dùng khi phát triển. */
export async function drainAll(): Promise<void> {
  for (const n of allQueueNames()) {
    const q = getQueue(n);
    await q.drain(true);
    await q.clean(0, 100_000, "completed");
    await q.clean(0, 100_000, "failed");
  }
}
