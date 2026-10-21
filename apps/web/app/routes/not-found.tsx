import type { Route } from "./+types/not-found";

// Trang không có giao diện riêng: ném 404 để ErrorBoundary ở root hiển thị, và để công cụ tìm
// kiếm nhận đúng mã trạng thái. statusText phải là ASCII (ByteString).
export async function loader(_: Route.LoaderArgs) {
  throw new Response("Khong tim thay trang", { status: 404, statusText: "Not Found" });
}

export default function NotFound() {
  return null;
}
