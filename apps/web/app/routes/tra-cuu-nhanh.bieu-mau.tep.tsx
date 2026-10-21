/**
 * Tệp của một biểu mẫu đã duyệt (resource route, không có giao diện): chuyển tiếp từ API. PDF mở ngay
 * trong trình duyệt, Word và Excel tải về; `?tai=1` luôn tải về. Tệp có thể bị thay hoặc ngừng dùng
 * nên chỉ đệm ngắn, theo tiêu đề API trả.
 */
import { apiBase } from "../lib/api";
import type { Route } from "./+types/tra-cuu-nhanh.bieu-mau.tep";

export async function loader({ params, request }: Route.LoaderArgs) {
  const taiVe = new URL(request.url).searchParams.get("tai") === "1";
  const res = await fetch(
    `${apiBase()}/v1/tra-cuu/bieu-mau/${encodeURIComponent(params.ma)}/tep${taiVe ? "?tai=1" : ""}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) return new Response("Không có tệp này.", { status: res.status });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": res.headers.get("content-disposition") ?? "attachment",
      "cache-control": res.headers.get("cache-control") ?? "private, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}
