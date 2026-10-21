/**
 * Rung phản hồi (docs/VISUAL_STYLE.md §4.2). Chỉ Chrome Android hỗ trợ `navigator.vibrate`; Safari
 * trên iPhone thì không, nên ở đó không rung và nút rung được ẩn.
 */
import { MAU_RUNG, type SuKienRung } from "../../../lib/hieu-ung";
import { layCaiDatGame } from "./cai-dat";

export function hoTroRung(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function rung(suKien: SuKienRung): void {
  if (!hoTroRung() || !layCaiDatGame().rung) return;
  try {
    navigator.vibrate([...MAU_RUNG[suKien]]);
  } catch {
    // Một số trình duyệt chặn rung khi trang chưa có thao tác của người dùng.
  }
}
