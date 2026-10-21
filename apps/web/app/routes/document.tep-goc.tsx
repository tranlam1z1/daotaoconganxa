/**
 * Tệp PDF gốc của văn bản nạp từ PDF (resource route, không có giao diện): chuyển tiếp từ API.
 *  - `/tep-goc`: cả tệp, mở ngay trong trình duyệt, `?tai=1` thì tải về. Trang đọc nhúng tệp này
 *    khi văn bản chưa có nội dung chữ.
 *  - `/tep-goc/trang/:trang`: ảnh một trang, cho điện thoại (không hiện được PDF trong khung).
 */
import { ApiKhongTimThay, apiBase, getDocumentUrnBySlug } from "../lib/api";
import type { Route } from "./+types/document.tep-goc";

export async function loader({ params, request }: Route.LoaderArgs) {
  const khongCo = () => new Response("Không có tệp này.", { status: 404 });
  let urn: string;
  try {
    urn = await getDocumentUrnBySlug(params.docType, params.slug);
  } catch (e) {
    if (e instanceof ApiKhongTimThay) return khongCo();
    throw e;
  }
  const taiVe = new URL(request.url).searchParams.get("tai") === "1";
  const duoi = params.trang ? `/trang/${encodeURIComponent(params.trang)}` : taiVe ? "?tai=1" : "";
  const res = await fetch(
    `${apiBase()}/v1/documents/${encodeURIComponent(urn)}/tep-goc${duoi}`,
    // Bản quét vài chục MB: chờ lâu hơn tệp biểu mẫu.
    { signal: AbortSignal.timeout(60_000) },
  );
  if (!res.ok) return khongCo();
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/pdf",
      "content-disposition": res.headers.get("content-disposition") ?? "inline",
      "cache-control": res.headers.get("cache-control") ?? "private, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}
