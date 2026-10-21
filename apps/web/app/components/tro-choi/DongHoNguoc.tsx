import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/cn";

/**
 * Đồng hồ đếm ngược của đua thời gian. Hạn chót tính theo thời lượng máy chủ cấp (`han - batDau`)
 * cộng với lúc trình duyệt nhận phiên, nên đồng hồ máy người chơi lệch giờ cũng không sao; máy
 * chủ vẫn là nơi quyết định câu nào còn được tính.
 */
export function DongHoNguoc({ thoiLuongMs, onHetGio }: { thoiLuongMs: number; onHetGio: () => void }) {
  const han = useRef(Date.now() + thoiLuongMs);
  const [conLai, datConLai] = useState(Math.ceil(thoiLuongMs / 1000));
  const daBao = useRef(false);
  const goiLai = useRef(onHetGio);
  goiLai.current = onHetGio;

  useEffect(() => {
    const nhip = window.setInterval(() => {
      const giay = Math.max(0, Math.ceil((han.current - Date.now()) / 1000));
      datConLai(giay);
      if (giay === 0 && !daBao.current) {
        daBao.current = true;
        window.clearInterval(nhip);
        goiLai.current();
      }
    }, 250);
    return () => window.clearInterval(nhip);
  }, []);

  return (
    <span
      role="timer"
      aria-live="off"
      aria-label={`Còn ${conLai} giây`}
      className={cn(
        "inline-flex min-h-11 min-w-16 items-center justify-center rounded-full px-3 text-lg font-semibold tabular-nums",
        conLai <= 10 ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary",
      )}
    >
      {conLai}s
    </span>
  );
}
