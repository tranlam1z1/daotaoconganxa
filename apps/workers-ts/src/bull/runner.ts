/**
 * Khởi chạy tập worker BullMQ.
 *
 * Ba việc quan trọng của một tiến trình nạp kho chạy nhiều ngày:
 *  1. TẮT ÊM: SIGINT/SIGTERM -> ngừng nhận job mới, chờ job đang chạy xong, `worker.close()`.
 *     Job chưa xử lý xong quay lại trạng thái chờ, KHÔNG mất.
 *  2. TỰ DỪNG KHI MẤT REDIS quá lâu: chạy tiếp mà không có hàng đợi chỉ tạo lỗi rác,
 *     nên dừng hẳn để trình giám sát khởi động lại.
 *  3. GIỚI HẠN TỐC ĐỘ + SỐ CHẠY SONG SONG lấy từ @qdpl/queue, không tự đặt lại ở đây.
 */
import { CONCURRENCY, getQueue, newConnection, QUEUES, type QueueName, RATE_LIMITS } from "@qdpl/queue";
import { type Processor, Worker } from "bullmq";
import type IORedis from "ioredis";
import { errText, log } from "../log.ts";
import { BoHam } from "./bo-ham.ts";
import { bullName, snapshot } from "./queues.ts";
import { STAGE_BY_QUEUE, STAGES } from "./registry.ts";
import { wrapStage } from "./stage.ts";
import { LICH_DON_KHACH } from "./workers/don-khach.ts";
import { LICH_NHAC_HOC } from "./workers/nhac-hoc.ts";
import { LICH_SACH_NOI } from "./workers/sach-noi.ts";
import { LICH_THI_HET_GIO } from "./workers/thi-het-gio.ts";

export interface RunnerOptions {
  /** Hàng đợi cần chạy; bỏ trống là tất cả. */
  queues?: QueueName[];
  /** Ghi đè số job song song cho MỌI hàng đợi được chọn. */
  concurrency?: number;
  /** Mất Redis lâu hơn ngần này thì dừng hẳn (mặc định 60 giây). */
  redisDownMs?: number;
  /** Nhịp kiểm tra Redis. */
  healthIntervalMs?: number;
  /** Tự dừng khi mọi hàng đợi rỗng liên tục ngần này (dùng cho chạy một lượt). */
  untilIdleMs?: number;
  /** Số job chạy đồng thời tối đa của cả tiến trình (mặc định BULL_MAX_ACTIVE, rồi 2). */
  maxActive?: number;
  /** Tỷ lệ chiếm CPU 0 < x ≤ 1 (mặc định BULL_CPU_DUTY, rồi 1). */
  cpuDuty?: number;
}

export interface RunnerHandle {
  workers: Worker[];
  /** Hoàn tất khi runner đã dừng hẳn; giá trị là lý do dừng. */
  done: Promise<string>;
  /** Dừng chủ động (tắt êm). */
  close: (reason?: string) => Promise<void>;
}

const DEFAULT_REDIS_DOWN_MS = Number(process.env.BULL_REDIS_DOWN_MS ?? 60_000);
const DEFAULT_HEALTH_MS = Number(process.env.BULL_HEALTH_INTERVAL_MS ?? 5_000);

export function startWorkers(opts: RunnerOptions = {}): RunnerHandle {
  const queues: QueueName[] = opts.queues?.length ? opts.queues : STAGES.map((s) => s.queue);
  const workers: Worker[] = [];
  const ketNoiWorker: IORedis[] = [];
  let resolveDone: (reason: string) => void = () => undefined;
  const done = new Promise<string>((r) => {
    resolveDone = r;
  });
  let stopping = false;

  // Một bộ hãm dùng chung cho mọi hàng đợi: concurrency từng hàng đợi cộng lại có thể lên
  // hơn 20 job, nhưng cả tiến trình chỉ chạy tối đa `maxActive` job và nghỉ theo `cpuDuty`.
  const boHam = new BoHam({
    ...(opts.maxActive ? { toiDa: opts.maxActive } : {}),
    ...(opts.cpuDuty ? { duty: opts.cpuDuty } : {}),
  });

  for (const name of queues) {
    const stage = STAGE_BY_QUEUE.get(name);
    if (!stage) throw new Error(`Không có worker cho hàng đợi "${name}"`);
    const limiter = RATE_LIMITS[name];
    const xuLy = wrapStage(stage) as unknown as (job: unknown) => Promise<unknown>;
    const processor: Processor = (job) => boHam.chay(() => xuLy(job));
    // BullMQ không tự đóng kết nối được truyền vào dưới dạng đối tượng IORedis: phải giữ lại để
    // quit() khi tắt, nếu không tiến trình treo mãi sau "Đã dừng worker" (mỗi hàng đợi giữ 1 socket).
    const ketNoi = newConnection() as unknown as IORedis;
    ketNoiWorker.push(ketNoi);
    const w = new Worker(bullName(name), processor, {
      connection: ketNoi,
      concurrency: opts.concurrency ?? CONCURRENCY[name] ?? 1,
      ...(limiter ? { limiter } : {}),
    });
    w.on("failed", (job, err) => {
      log.warn("Job hỏng", {
        queue: name,
        jobId: String(job?.id ?? "?"),
        attempt: job?.attemptsMade ?? 0,
        maxAttempts: job?.opts?.attempts ?? 0,
        error: (err?.message ?? String(err)).split("\n")[0],
      });
    });
    w.on("error", (err) => {
      log.error("Lỗi worker", { queue: name, error: errText(err) });
    });
    workers.push(w);
  }
  // Hàng đợi chạy theo lịch: đăng ký lịch lặp khi có worker nhận. upsert nên khởi động lại
  // nhiều lần (hay nhiều tiến trình worker) vẫn chỉ có một lịch.
  if (queues.includes(QUEUES.thiHetGio)) {
    void getQueue(QUEUES.thiHetGio)
      .upsertJobScheduler(
        LICH_THI_HET_GIO.id,
        { every: LICH_THI_HET_GIO.everyMs },
        { name: QUEUES.thiHetGio, data: {} },
      )
      .catch((e) => log.error("Không đăng ký được lịch tự nộp bài thi", { error: errText(e) }));
  }
  if (queues.includes(QUEUES.nhacHoc)) {
    void getQueue(QUEUES.nhacHoc)
      .upsertJobScheduler(
        LICH_NHAC_HOC.id,
        { every: LICH_NHAC_HOC.everyMs },
        { name: QUEUES.nhacHoc, data: {} },
      )
      .catch((e) => log.error("Không đăng ký được lịch nhắc học", { error: errText(e) }));
  }
  if (queues.includes(QUEUES.sachNoi)) {
    void getQueue(QUEUES.sachNoi)
      .upsertJobScheduler(
        LICH_SACH_NOI.id,
        { every: LICH_SACH_NOI.everyMs },
        { name: QUEUES.sachNoi, data: {} },
      )
      .catch((e) => log.error("Không đăng ký được lịch dựng sách nói", { error: errText(e) }));
  }
  if (queues.includes(QUEUES.donKhach)) {
    void getQueue(QUEUES.donKhach)
      .upsertJobScheduler(
        LICH_DON_KHACH.id,
        { every: LICH_DON_KHACH.everyMs },
        { name: QUEUES.donKhach, data: {} },
      )
      .catch((e) => log.error("Không đăng ký được lịch dọn tài khoản khách", { error: errText(e) }));
  }

  log.info("Worker BullMQ khởi động", {
    queues: queues.map((q) => q.replace("qdpl:", "")),
    concurrency: queues.map((q) => opts.concurrency ?? CONCURRENCY[q] ?? 1),
    max_active: boHam.cauHinh.toiDa,
    cpu_duty: boHam.cauHinh.duty,
  });

  const close = async (reason = "yêu cầu dừng"): Promise<void> => {
    if (stopping) return;
    stopping = true;
    log.info("Đang tắt êm: ngừng nhận job mới, chờ job đang chạy xong", { reason });
    clearInterval(health);
    // close() không ép: BullMQ chờ job đang chạy kết thúc rồi mới đóng kết nối.
    await Promise.all(
      workers.map((w) => w.close().catch((e) => log.error("Đóng worker lỗi", { error: errText(e) }))),
    );
    await Promise.all(ketNoiWorker.map((k) => k.quit().catch(() => undefined)));
    await probe.quit().catch(() => undefined);
    log.info("Đã dừng worker BullMQ", { reason });
    resolveDone(reason);
  };

  const onSig = (sig: string) => () => {
    void close(`tín hiệu ${sig}`);
  };
  const onInt = onSig("SIGINT");
  const onTerm = onSig("SIGTERM");
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);
  void done.then(() => {
    process.off("SIGINT", onInt);
    process.off("SIGTERM", onTerm);
  });

  // Theo dõi sức khỏe Redis + (tùy chọn) tự dừng khi hết việc.
  const probe = newConnection() as unknown as IORedis;
  const redisDownMs = opts.redisDownMs ?? DEFAULT_REDIS_DOWN_MS;
  let mataTu: number | undefined; // thời điểm bắt đầu mất Redis
  let rongTu: number | undefined; // thời điểm bắt đầu rỗng việc
  const health = setInterval(() => {
    void (async () => {
      try {
        await probe.ping();
        if (mataTu) {
          log.info("Redis đã trở lại", { mat_giay: Math.round((Date.now() - mataTu) / 1000) });
          mataTu = undefined;
        }
      } catch (e) {
        mataTu ??= Date.now();
        const matMs = Date.now() - mataTu;
        log.warn("Không nói chuyện được với Redis", { matMs, error: errText(e).split("\n")[0] });
        if (matMs >= redisDownMs) {
          await close(`mất Redis quá ${Math.round(redisDownMs / 1000)}s`);
        }
        return;
      }
      if (!opts.untilIdleMs) return;
      const tong = await tongViecDangCho(queues);
      if (tong > 0) {
        rongTu = undefined;
        return;
      }
      rongTu ??= Date.now();
      if (Date.now() - rongTu >= opts.untilIdleMs) await close("hết việc");
    })();
  }, opts.healthIntervalMs ?? DEFAULT_HEALTH_MS);

  return { workers, done, close };
}

/** Tổng số job chờ / đang chạy / hẹn giờ của các hàng đợi worker đang phục vụ. */
async function tongViecDangCho(queues: QueueName[]): Promise<number> {
  let tong = 0;
  for (const q of queues) {
    const s = await snapshot(q);
    tong += s.cho + s.dang_chay + s.tri_hoan;
  }
  return tong;
}
