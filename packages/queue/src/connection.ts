/**
 * Kết nối Redis dùng chung cho BullMQ.
 *
 * Vì sao Redis thay vì hàng đợi trong Postgres: việc nạp kho chạy nhiều ngày, hàng trăm nghìn
 * job, cần giới hạn tốc độ theo từng nguồn, thử lại có lùi thời gian, ưu tiên, và theo dõi
 * trực tiếp. BullMQ làm sẵn những thứ đó; hàng đợi trong Postgres (bảng `jobs`) vẫn giữ cho
 * các việc nhẹ và cho cầu nối sang worker Python.
 */
import IORedis, { type RedisOptions } from "ioredis";

export const REDIS_URL_ENV = "REDIS_URL";

export function redisUrl(): string {
  const url = process.env[REDIS_URL_ENV];
  if (!url) {
    throw new Error(
      `Chưa đặt ${REDIS_URL_ENV}. Ví dụ: redis://127.0.0.1:6380 hoặc rediss://user:pass@host:6379/0. ` +
        "Xem .env.example và LENH.md.",
    );
  }
  return url;
}

/** true nếu đã cấu hình Redis (dùng để tự chọn chế độ chạy). */
export function hasRedis(): boolean {
  return Boolean(process.env[REDIS_URL_ENV]);
}

let shared: IORedis | undefined;

/**
 * BullMQ yêu cầu `maxRetriesPerRequest: null` cho kết nối của worker, nếu không
 * lệnh blocking sẽ bị ngắt giữa chừng khi Redis chậm.
 */
export function connectionOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
    // Cho phép dùng Redis có TLS (rediss://) và có mật khẩu ngay trong URL.
  };
}

export function getConnection(): IORedis {
  if (!shared) shared = new IORedis(redisUrl(), connectionOptions());
  return shared;
}

/** Kết nối riêng: BullMQ khuyến nghị mỗi Worker một kết nối. */
export function newConnection(): IORedis {
  return new IORedis(redisUrl(), connectionOptions());
}

export async function pingRedis(): Promise<{ ok: boolean; message: string }> {
  try {
    const c = new IORedis(redisUrl(), { ...connectionOptions(), lazyConnect: true, connectTimeout: 3000 });
    await c.connect();
    const pong = await c.ping();
    const info = await c.info("server");
    const version = /redis_version:([^\r\n]+)/.exec(info)?.[1] ?? "?";
    await c.quit();
    return { ok: pong === "PONG", message: `Redis ${version}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function closeConnection(): Promise<void> {
  await shared?.quit().catch(() => undefined);
  shared = undefined;
}
