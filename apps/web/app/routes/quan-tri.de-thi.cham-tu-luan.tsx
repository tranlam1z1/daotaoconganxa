/**
 * Đường cũ của hàng chấm tự luận đề thi, nay ở /quan-tri/cham-tu-luan/de-thi. Giữ lại để dấu trang
 * và liên kết đã gửi không rơi vào "de-thi/:id".
 */
import { redirect } from "react-router";
import { urlTrang } from "../lib/session.server";

export function loader({ request }: { request: Request }) {
  return redirect(`/quan-tri/cham-tu-luan/de-thi${urlTrang(request).search}`, 301);
}
