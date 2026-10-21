/**
 * Bốn nút phản ứng lớn ở đáy đường chạy "Cung đường biển báo" (docs/PLAN.md GĐ-G8): Giảm tốc,
 * Dừng lại, Không rẽ/không vào, Đi tiếp. Lưới 2×2, mỗi nút cao từ 56px để bấm bằng ngón cái.
 * Bàn phím: phím 1–4.
 */
import { useEffect } from "react";

import { TEN_THAO_TAC_BIEN_BAO, THAO_TAC_BIEN_BAO, type ThaoTacBienBao } from "../../lib/cung-duong";

const HINH: Record<ThaoTacBienBao, string> = {
  giam_toc: "M5 8h14M7 12h10M9 16h6",
  dung_lai: "M8 5h8l3 3v8l-3 3H8l-3-3V8Z",
  khong_vao: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M7 12h10",
  di_tiep: "M12 20V5m-5 5 5-5 5 5",
};

export function NutPhanUng({
  onBam,
  khoa,
}: {
  onBam: (t: ThaoTacBienBao) => void;
  /** Khóa khi chưa xuất phát hoặc đã về đích. */
  khoa: boolean;
}) {
  useEffect(() => {
    if (khoa) return;
    const nghe = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < THAO_TAC_BIEN_BAO.length) onBam(THAO_TAC_BIEN_BAO[i]!);
    };
    window.addEventListener("keydown", nghe);
    return () => window.removeEventListener("keydown", nghe);
  }, [khoa, onBam]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {THAO_TAC_BIEN_BAO.map((t, i) => (
        <button
          key={t}
          type="button"
          disabled={khoa}
          // Bấm bằng pointerdown để không trễ ~100ms của click trên điện thoại.
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            onBam(t);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onBam(t);
            }
          }}
          className="g-nut inline-flex min-h-14 items-center justify-center gap-2 border border-line bg-surface px-3 text-base text-ink"
          aria-keyshortcuts={String(i + 1)}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={HINH[t]} />
          </svg>
          {TEN_THAO_TAC_BIEN_BAO[t]}
        </button>
      ))}
    </div>
  );
}
