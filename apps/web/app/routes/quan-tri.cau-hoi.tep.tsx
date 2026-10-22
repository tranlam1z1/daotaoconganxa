/**
 * Tải tệp Excel của ngân hàng câu hỏi (resource route, không có giao diện): `mau` là tệp mẫu
 * nhập, `xuat` là danh sách câu theo bộ lọc đang chọn. Chuyển tiếp từ API vì API cần token
 * phiên, mà token nằm trong cookie HttpOnly chỉ máy chủ web đọc được.
 */
import { taiTepQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import type { Route } from "./+types/quan-tri.cau-hoi.tep";

const LOC = ["q", "chu_de", "muc_do", "loai", "trang_thai", "nguon"];

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  if (params.loai === "mau") return await taiTepQuanTri(token, "/v1/quan-tri/ngan-hang/mau");
  if (params.loai !== "xuat") throw new Response("Không có tệp này.", { status: 404 });
  const vao = new URL(request.url).searchParams;
  const qs = new URLSearchParams();
  for (const k of LOC) {
    const v = vao.get(k);
    if (v) qs.set(k, v);
  }
  return await taiTepQuanTri(token, `/v1/quan-tri/ngan-hang/xuat${qs.size ? `?${qs}` : ""}`);
}
