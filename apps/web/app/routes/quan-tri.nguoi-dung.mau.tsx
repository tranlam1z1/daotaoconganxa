/**
 * Tải tệp mẫu nhập người dùng (resource route, không có giao diện). Chuyển tiếp từ API vì API
 * cần token phiên, mà token nằm trong cookie HttpOnly chỉ máy chủ web đọc được.
 */
import { taiTepQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import type { Route } from "./+types/quan-tri.nguoi-dung.mau";

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  return await taiTepQuanTri(token, "/v1/quan-tri/nguoi-dung/mau");
}
