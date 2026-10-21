/**
 * Log có cấu trúc (JSON dòng) ra stderr để Loki/Promtail thu thập được.
 * Đặt LOG_PRETTY=1 khi chạy tay cho dễ đọc.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? "info"] ?? 20;
const pretty = process.env.LOG_PRETTY === "1";

function emit(level: LogLevel, msg: string, fields: Record<string, unknown> = {}) {
  if (LEVELS[level] < minLevel) return;
  const rec = { ts: new Date().toISOString(), level, msg, ...fields };
  if (pretty) {
    const extra = Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : "";
    process.stderr.write(`${rec.ts} ${level.toUpperCase().padEnd(5)} ${msg}${extra}\n`);
  } else {
    process.stderr.write(`${JSON.stringify(rec)}\n`);
  }
}

export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => emit("debug", msg, f),
  info: (msg: string, f?: Record<string, unknown>) => emit("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit("error", msg, f),
  /** Log con có sẵn các trường cố định (ví dụ job id). */
  child(base: Record<string, unknown>) {
    return {
      debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, { ...base, ...f }),
      info: (m: string, f?: Record<string, unknown>) => emit("info", m, { ...base, ...f }),
      warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, { ...base, ...f }),
      error: (m: string, f?: Record<string, unknown>) => emit("error", m, { ...base, ...f }),
    };
  },
};

/** Rút gọn lỗi thành chuỗi có stack, không nuốt thông tin. */
export function errText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}\n${e.stack ?? ""}`.trim();
  return String(e);
}
