/**
 * "Đoán biển báo" (GĐ12) đã thành phần khởi động của "Cung đường biển báo" (docs/PLAN.md GĐ-G8,
 * GAME_DESIGN §7 Q2). Đường dẫn cũ chuyển hướng về trò mới; API ván cũ vẫn giữ.
 */
import { redirect } from "react-router";

export function loader() {
  return redirect("/tro-choi/cung-duong-bien-bao", 301);
}
