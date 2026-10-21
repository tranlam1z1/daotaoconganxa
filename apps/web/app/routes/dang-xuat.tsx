import { cookieDangXuat, layToken, thuHoiPhien } from "../lib/auth.server";
import type { Route } from "./+types/dang-xuat";

/** Đăng xuất chỉ qua POST: GET có thể bị trình duyệt tải trước hoặc trình thu thập gọi. */
export async function action({ request }: Route.ActionArgs) {
  const token = layToken(request);
  // Thu hồi ở API, không chỉ xóa cookie: token chưa thu hồi vẫn dùng được cho MCP.
  if (token) await thuHoiPhien(token);
  return new Response(null, {
    status: 302,
    headers: { location: "/", "set-cookie": cookieDangXuat(request) },
  });
}

export async function loader() {
  return new Response(null, { status: 302, headers: { location: "/" } });
}
