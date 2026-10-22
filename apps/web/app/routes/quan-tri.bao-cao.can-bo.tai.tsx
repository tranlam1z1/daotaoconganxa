/**
 * Tải hồ sơ một cán bộ ra Excel/PDF (resource route, không có giao diện). Chuyển tiếp từ API như
 * `quan-tri.bao-cao.tai.tsx`; phạm vi đơn vị do API kiểm.
 */
import { taiTepQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import type { Route } from "./+types/quan-tri.bao-cao.can-bo.tai";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "lanh_dao");
  const vao = new URL(request.url).searchParams;
  const dinhDang = vao.get("dinh_dang");
  if (dinhDang !== "xlsx" && dinhDang !== "pdf") throw new Response("Chọn Excel hoặc PDF.", { status: 400 });
  const qs = new URLSearchParams({ dinh_dang: dinhDang });
  for (const k of ["tu", "den"]) {
    const v = vao.get(k);
    if (v) qs.set(k, v);
  }
  return await taiTepQuanTri(token, `/v1/bao-cao/can-bo/${encodeURIComponent(params.id)}?${qs}`);
}
