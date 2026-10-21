/**
 * Nhãn combo (docs/VISUAL_STYLE.md §3.2, hiệu ứng 4): từ 3 câu đúng liên tiếp hiện "Chuỗi N" và bật
 * ra theo đường cong nảy; mốc 5, 10… có thêm tia sáng. Âm thanh cao dần theo độ dài chuỗi.
 */
import { useEffect, useRef } from "react";

import { COMBO_TOI_THIEU, laMocCombo } from "../../../lib/hieu-ung";
import { phatAm } from "./am-thanh";

export function NhanCombo({ n, phatAmKhiTang = true }: { n: number; phatAmKhiTang?: boolean }) {
  const truoc = useRef(n);
  useEffect(() => {
    if (phatAmKhiTang && n > truoc.current && n >= COMBO_TOI_THIEU) phatAm("combo", n - COMBO_TOI_THIEU);
    truoc.current = n;
  }, [n, phatAmKhiTang]);

  if (n < COMBO_TOI_THIEU) return null;
  const moc = laMocCombo(n);
  return (
    <span
      key={n}
      role="status"
      className="g-a g-bat relative inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold"
      style={{ background: "var(--g-nhan)", color: "var(--g-tren-nhan)" }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" />
      </svg>
      <span className="g-so">Chuỗi {n}</span>
      <span className="sr-only"> câu đúng liên tiếp</span>
      {moc ? (
        <span
          aria-hidden="true"
          className="g-t g-loe pointer-events-none absolute -inset-1 rounded-full"
          style={{ boxShadow: "0 0 0 3px var(--g-nhan)" }}
        />
      ) : null}
    </span>
  );
}
