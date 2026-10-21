/**
 * Ba sao ở màn tổng kết (docs/VISUAL_STYLE.md §3.2, hiệu ứng 9): sao đạt được lần lượt bật vào,
 * cách nhau 250ms, mỗi sao một nốt. Giảm chuyển động: hiện ngay.
 */
import { useEffect } from "react";

import { cn } from "../../../lib/cn";
import { phatAm } from "./am-thanh";

export const TRE_MOI_SAO_MS = 250;

export function SaoTongKet({
  so,
  lon = true,
  hoatAnh = true,
}: {
  so: number;
  lon?: boolean;
  hoatAnh?: boolean;
}) {
  useEffect(() => {
    if (!hoatAnh) return;
    const hen = Array.from({ length: so }, (_, i) =>
      setTimeout(() => phatAm("sao", i * 2), 150 + i * TRE_MOI_SAO_MS),
    );
    return () => hen.forEach(clearTimeout);
  }, [so, hoatAnh]);

  return (
    <span role="img" aria-label={`${so} trên 3 sao`} className="inline-flex items-end gap-2">
      {[1, 2, 3].map((i) => {
        const dat = i <= so;
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn(lon ? (i === 2 ? "size-14" : "size-11") : "size-5", dat && hoatAnh && "g-a g-bat")}
            style={{ "--tre": `${150 + (i - 1) * TRE_MOI_SAO_MS}ms` } as React.CSSProperties}
          >
            <path
              d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5Z"
              fill={dat ? "var(--g-nhan)" : "none"}
              stroke={dat ? "var(--g-nhan)" : "var(--line-strong)"}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </span>
  );
}
