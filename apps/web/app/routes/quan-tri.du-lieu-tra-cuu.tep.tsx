/**
 * Tệp của một biểu mẫu ở mọi trạng thái (resource route, không có giao diện), để người soạn và người
 * duyệt xem trước khi duyệt. Chuyển tiếp từ API vì API cần token phiên nằm trong cookie HttpOnly.
 */
import { taiTepQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import type { Route } from "./+types/quan-tri.du-lieu-tra-cuu.tep";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  return await taiTepQuanTri(
    token,
    `/v1/quan-tri/du-lieu-tra-cuu/bieu-mau/${encodeURIComponent(params.ma)}/tep`,
  );
}
