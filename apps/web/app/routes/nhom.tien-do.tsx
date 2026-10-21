/**
 * Tiến độ từng mục của một thành viên (docs/PLAN.md GĐ16b), cho hộp "Tiến độ của thành viên".
 * Route chỉ có loader, đọc qua fetcher.load. Chỉ có phần trăm, không có điểm.
 */
import { tienDoThanhVien } from "../lib/nhom.server";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import type { Route } from "./+types/nhom.tien-do";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    return await tienDoThanhVien(token, params.id, params.accountId);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}
