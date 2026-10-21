/**
 * Gọi API ngân hàng câu hỏi cho các thao tác GHI (lưu, gửi duyệt, chấm thử).
 *
 * Khác `goiApiQuanTri` ở chỗ trả về cả danh sách lỗi chi tiết của API (`error.details`), vì
 * biểu mẫu câu hỏi cần báo từng lỗi hợp lệ (thiếu đáp án, ô trống chưa có đáp án…) thay cho
 * một câu chung. 401 và 403 xử lý như `goiApiQuanTri`.
 */
import { redirect } from "react-router";

import { apiBase } from "./api";

export type KetQuaGoi<T> = { ok: true; data: T } | { ok: false; loi: string; chiTiet: string[] };

export async function ghiNganHang<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<KetQuaGoi<T>> {
  const res = await fetch(`${apiBase()}/v1/quan-tri/ngan-hang${path}`, {
    method: init.method ?? "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => null)) as any;
  if (res.status === 401) throw redirect("/dang-nhap");
  if (res.status === 403)
    throw new Response(data?.error?.message ?? "Tài khoản không đủ quyền.", { status: 403 });
  if (!res.ok) {
    const chiTiet = Array.isArray(data?.error?.details)
      ? data.error.details.map((d: unknown) =>
          typeof d === "string"
            ? d
            : `${(d as { duong_dan?: string }).duong_dan ?? ""}: ${(d as { loi?: string }).loi ?? ""}`,
        )
      : [];
    return { ok: false, loi: data?.error?.message ?? `API trả về ${res.status}`, chiTiet };
  }
  return { ok: true, data: data as T };
}
