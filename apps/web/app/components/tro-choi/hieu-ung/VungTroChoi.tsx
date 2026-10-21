/**
 * Vùng "khu trò chơi" (docs/VISUAL_STYLE.md §0, §2.1): đặt `data-khu="tro-choi"` để đổi token màu
 * cho mọi thứ bên trong, `data-giam-hieu-ung` theo công tắc trong trò chơi, và nạp CSS của khu.
 * KhungGame dùng vùng này; trang không dùng KhungGame (chơi offline, trang duyệt hiệu ứng) bọc
 * trực tiếp.
 */
import type { ReactNode } from "react";

import "./tro-choi.css";
import { cn } from "../../../lib/cn";
import { useCaiDatGame } from "./cai-dat";

export function VungTroChoi({ children, className }: { children: ReactNode; className?: string }) {
  const { giamHieuUng } = useCaiDatGame();
  return (
    <div
      data-khu="tro-choi"
      data-giam-hieu-ung={giamHieuUng ? "1" : "0"}
      className={cn("min-h-[70vh]", className)}
    >
      {children}
    </div>
  );
}
