/**
 * Tải báo cáo Excel/PDF (resource route, không có giao diện). Chuyển tiếp từ API vì API cần
 * token phiên, mà token nằm trong cookie HttpOnly chỉ máy chủ web đọc được. Phạm vi đơn vị do
 * API kiểm; route này chỉ chép bộ lọc sang.
 */
import { LOAI_BAO_CAO, LOC_BAO_CAO } from "../lib/bao-cao";
import { taiTepQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import type { Route } from "./+types/quan-tri.bao-cao.tai";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "lanh_dao");
  if (!(LOAI_BAO_CAO as readonly string[]).includes(params.loai)) {
    throw new Response("Không có báo cáo này.", { status: 404 });
  }
  const vao = new URL(request.url).searchParams;
  const dinhDang = vao.get("dinh_dang");
  if (dinhDang !== "xlsx" && dinhDang !== "pdf") throw new Response("Chọn Excel hoặc PDF.", { status: 400 });
  const qs = new URLSearchParams({ dinh_dang: dinhDang });
  for (const k of LOC_BAO_CAO) {
    const v = vao.get(k);
    if (v) qs.set(k, v);
  }
  return await taiTepQuanTri(token, `/v1/bao-cao/${params.loai}?${qs}`);
}
