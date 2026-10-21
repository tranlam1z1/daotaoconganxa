/**
 * Ảnh đại diện người dùng (resource route, không có giao diện): chuyển tiếp từ API. Tên tệp có
 * hash nội dung nên cho trình duyệt đệm vĩnh viễn; đổi ảnh là đổi tên tệp.
 */
import { apiBase } from "../lib/api";
import type { Route } from "./+types/anh-dai-dien";

export async function loader({ params }: Route.LoaderArgs) {
  if (!/^[0-9a-f-]{36}-[0-9a-f]{16}\.(png|jpg|webp)$/.test(params.tep))
    throw new Response("Không có ảnh này.", { status: 404 });
  const res = await fetch(`${apiBase()}/v1/toi/anh-dai-dien/${encodeURIComponent(params.tep)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return new Response("Không có ảnh này.", { status: res.status });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
