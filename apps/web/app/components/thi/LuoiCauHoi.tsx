import { cn } from "../../lib/cn";

/**
 * Lưới số câu: bấm để nhảy tới câu. Câu đã trả lời tô nền, câu đang xem có viền đậm, câu tự
 * luận có nhãn "TL" ở góc. Mỗi ô 44px trở lên để bấm bằng ngón cái (bảng kiểm §0.4).
 */
export function LuoiCauHoi({
  soCau,
  daLam,
  dangXem,
  onChon,
  tuLuan,
}: {
  soCau: number;
  daLam: Set<number>;
  dangXem: number;
  onChon: (thuTu: number) => void;
  /** Số thứ tự các câu tự luận. */
  tuLuan?: Set<number>;
}) {
  return (
    <nav aria-label="Danh sách câu hỏi">
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
        {Array.from({ length: soCau }, (_, i) => i + 1).map((n) => {
          const lam = daLam.has(n);
          const tl = tuLuan?.has(n);
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => onChon(n)}
                aria-current={n === dangXem ? "step" : undefined}
                aria-label={`Câu ${n}${tl ? ", tự luận" : ""}${lam ? ", đã trả lời" : ", chưa trả lời"}`}
                className={cn(
                  "relative grid size-11 place-items-center rounded-lg border text-sm font-semibold tabular-nums",
                  lam
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line-strong bg-surface text-ink-2",
                  n === dangXem && "ring-2 ring-primary ring-offset-2 ring-offset-canvas",
                )}
              >
                {n}
                {tl ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-1 text-[10px] leading-none text-ink-3"
                  >
                    TL
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
