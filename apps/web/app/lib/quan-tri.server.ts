/**
 * Gọi API quản trị thay người đang đăng nhập (token phiên lấy từ cookie HttpOnly, không bao
 * giờ tới trình duyệt). Dùng cho các trang /quan-tri/* dựng lại từ GĐ2.
 */
import { redirect } from "react-router";

import { apiBase } from "./api";

/** Lỗi nghiệp vụ API trả về (400, 404, 409): trang hiển thị thông báo tại chỗ. */
export class LoiApi extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /** Chi tiết kèm lỗi, ví dụ danh sách lỗi bảng kiểm khi xuất bản bài học. */
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Gọi API, trả JSON. 401 thì chuyển về trang đăng nhập; 403 ném Response 403 để ErrorBoundary
 * báo "Không đủ quyền"; lỗi khác ném LoiApi mang thông báo tiếng Việt của API.
 */
export async function goiApiQuanTri<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown; form?: FormData; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}` };
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: init.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
  });
  const data = (await res.json().catch(() => null)) as any;
  if (res.status === 401) throw redirect("/dang-nhap");
  if (res.status === 403) {
    throw new Response(data?.error?.message ?? "Tài khoản không đủ quyền.", { status: 403 });
  }
  if (!res.ok)
    throw new LoiApi(
      data?.error?.message ?? `API ${path} trả về ${res.status}`,
      res.status,
      data?.error?.code,
      data?.error?.details,
    );
  return data as T;
}

/**
 * Dùng ở loader trang chi tiết: `await goiApiQuanTri(...).catch(khongTimThay)`. Bản ghi không còn
 * (404) hoặc mã trên đường dẫn sai dạng (400) thì ném Response 404 để hiện "Không tìm thấy trang",
 * thay vì trang lỗi 500.
 */
export function khongTimThay(e: unknown): never {
  if (e instanceof LoiApi && (e.status === 404 || e.status === 400))
    throw new Response(e.message, { status: 404 });
  throw e;
}

/** Tải tệp nhị phân (Excel) từ API rồi chuyển nguyên cho trình duyệt. */
export async function taiTepQuanTri(token: string, path: string): Promise<Response> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return new Response("Không tải được tệp.", { status: res.status });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": res.headers.get("content-disposition") ?? "attachment",
    },
  });
}
