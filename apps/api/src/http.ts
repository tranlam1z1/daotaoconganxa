/**
 * Hạ tầng chung cho API: lỗi thống nhất, kiểm tra tham số bằng zod, tiện ích ngày tháng.
 * Mọi thông báo lỗi trả về người dùng đều bằng tiếng Việt.
 */
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

// Thông báo lỗi mặc định của zod bằng tiếng Việt (áp dụng cho toàn bộ API).
z.config(z.locales.vi());

/** Mã lỗi ổn định để client xử lý, kèm thông báo tiếng Việt. */
export type ErrorCode =
  | "tham_so_khong_hop_le"
  | "khong_tim_thay"
  | "xung_dot"
  | "loi_may_chu"
  | "chua_ho_tro"
  | "dich_vu_loi";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 500 | 501 | 503,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "tham_so_khong_hop_le", message, details);
export const notFound = (message: string) => new ApiError(404, "khong_tim_thay", message);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, "xung_dot", message, details);

/** Bộ xử lý lỗi thống nhất, gắn vào app.onError. */
export function handleError(err: Error, c: Context): Response {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    };
    return c.json(body, err.status);
  }
  if (err instanceof HTTPException) {
    const body: ApiErrorBody = { error: { code: "tham_so_khong_hop_le", message: err.message } };
    return c.json(body, err.status);
  }
  // Không nuốt lỗi: ghi log đầy đủ ở máy chủ, trả thông báo gọn cho client.
  console.error("[api] lỗi không lường trước:", err);
  const body: ApiErrorBody = {
    error: { code: "loi_may_chu", message: "Lỗi máy chủ nội bộ", details: err.message },
  };
  return c.json(body, 500);
}

/** Kiểm tra query string bằng zod; ném ApiError 400 nếu sai. */
export function parseQuery<S extends z.ZodType>(c: Context, schema: S): z.infer<S> {
  const raw: Record<string, string | string[]> = {};
  const url = new URL(c.req.url);
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    raw[key] = all.length > 1 ? all : all[0]!;
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    throw badRequest("Tham số truy vấn không hợp lệ", res.error.issues.map(issueOf));
  }
  return res.data;
}

/** Kiểm tra body JSON bằng zod; ném ApiError 400 nếu sai. */
export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw badRequest("Thân yêu cầu phải là JSON hợp lệ");
  }
  const res = schema.safeParse(json);
  if (!res.success) {
    throw badRequest("Dữ liệu gửi lên không hợp lệ", res.error.issues.map(issueOf));
  }
  return res.data;
}

function issueOf(i: z.core.$ZodIssue): { duong_dan: string; loi: string } {
  return { duong_dan: i.path.join("."), loi: i.message };
}

/** Ngày hôm nay dạng YYYY-MM-DD. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Chuẩn hóa giá trị date của postgres về YYYY-MM-DD. */
export function asDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** Tách chuỗi phân tách bằng dấu phẩy thành mảng đã lọc rỗng. */
export function csv(v: string | string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  const parts = (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

/** Giải mã tham số URN trên đường dẫn (đã encodeURIComponent phía client). */
export function decodeUrnParam(raw: string): string {
  let urn = raw;
  try {
    urn = decodeURIComponent(raw);
  } catch {
    throw badRequest("URN trên đường dẫn không giải mã được");
  }
  urn = urn.normalize("NFC").trim();
  if (!urn.startsWith("vn:")) throw badRequest(`URN không hợp lệ: ${urn}`);
  return urn;
}
