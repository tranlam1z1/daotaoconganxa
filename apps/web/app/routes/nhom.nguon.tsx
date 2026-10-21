/**
 * Nguồn để chia sẻ vào nhóm (docs/PLAN.md GĐ16b): bài đã xuất bản hoặc chủ đề đủ câu. Route chỉ
 * có loader, hộp "Chia sẻ vào nhóm" đọc qua fetcher.load. Token nằm trong cookie HttpOnly nên
 * trình duyệt không gọi thẳng API.
 */
import { nguonBaiHoc, nguonChuDe } from "../lib/nhom.server";
import { yeuCauDangNhap } from "../lib/session.server";
import type { Route } from "./+types/nhom.nguon";

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  return url.searchParams.get("loai") === "chu_de" ? await nguonChuDe(token, q) : await nguonBaiHoc(token, q);
}
