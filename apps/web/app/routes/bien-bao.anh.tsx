/**
 * Ảnh biển báo (resource route, không có giao diện): chuyển tiếp từ API, giữ bộ nhớ đệm một
 * ngày. Trình duyệt chỉ nói chuyện với máy chủ web, không cần biết địa chỉ API.
 */
import { apiBase } from "../lib/api";
import type { Route } from "./+types/bien-bao.anh";

export async function loader({ params }: Route.LoaderArgs) {
  if (!/^[\w.-]+\.(svg|png|webp)$/i.test(params.tep))
    throw new Response("Không có ảnh này.", { status: 404 });
  const res = await fetch(`${apiBase()}/v1/tra-cuu/bien-bao/anh/${encodeURIComponent(params.tep)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return new Response("Không có ảnh này.", { status: res.status });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "public, max-age=86400",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
