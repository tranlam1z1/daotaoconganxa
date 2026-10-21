/**
 * Màn mở đầu của một lượt (docs/VISUAL_STYLE.md §3.2, hiệu ứng 1): dải tên trò trượt xuống, dòng
 * luật ngắn hiện dần, rồi thu lại sau 1,4 giây. KHÔNG chặn thao tác và không che câu hỏi: đồng hồ của
 * bước đầu đã chạy từ lúc máy chủ gửi đề, nên người chơi đọc câu hỏi được ngay.
 */
import { useEffect, useState } from "react";

import { phatAm } from "./am-thanh";

export function DauMan({ ten, moTa }: { ten: string; moTa: string }) {
  const [hien, datHien] = useState(true);
  useEffect(() => {
    phatAm("khoi_dong");
    const t = setTimeout(() => datHien(false), 1400);
    return () => clearTimeout(t);
  }, []);
  if (!hien) return null;
  return (
    <div
      role="status"
      className="g-a g-vao-xuong pointer-events-none mb-3 flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3"
      style={{ background: "var(--primary)", color: "var(--on-primary)" }}
    >
      <span
        className="g-a g-bat grid size-9 shrink-0 place-items-center rounded-full"
        style={
          {
            background: "var(--g-nhan)",
            color: "var(--g-tren-nhan)",
            "--tre": "120ms",
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
          <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="g-tieu-de block text-base font-semibold">Bắt đầu: {ten}</span>
        <span
          className="g-a g-hien block text-sm opacity-90"
          style={{ "--tre": "200ms" } as React.CSSProperties}
        >
          {moTa}
        </span>
      </span>
    </div>
  );
}
