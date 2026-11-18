import { cn } from "../../lib/cn";

/** Từ số câu này trở lên, ô từng câu quá hẹp để bấm nhìn: chuyển về một thanh liền. */
const TOI_DA_O = 40;

/**
 * Thanh tiến độ "Câu 3/10" của phiên luyện tập, kèm số câu đã trả lời. Không nêu số câu đúng: phiên
 * chỉ chấm khi nộp bài.
 *
 * Hướng "Công văn" (docs/DESIGN_SYSTEM.md): khi biết những câu đã trả lời (`cacCauDaLam`) và phiên
 * không quá dài, thanh chia ô theo từng câu: đã làm tô lục, câu đang xem viền lục, chưa làm xám.
 */
export function ThanhTienDo({
  hienTai,
  tong,
  daLam,
  cacCauDaLam,
  chiThanh = false,
}: {
  hienTai: number;
  tong: number;
  daLam: number;
  /** Số thứ tự các câu đã trả lời; có thì vẽ thanh chia ô. */
  cacCauDaLam?: Set<number>;
  /** Chỉ vẽ thanh, bỏ dòng "Câu x / n · Đã làm" khi trang đã hiện số đó ở chỗ khác (thanh thi). */
  chiThanh?: boolean;
}) {
  const phanTram = tong ? Math.round((hienTai / tong) * 100) : 0;
  const chiaO = cacCauDaLam && tong > 0 && tong <= TOI_DA_O;
  return (
    <div>
      {chiThanh ? null : (
        <p className="mb-2 flex items-baseline justify-between text-sm tabular-nums">
          <span className="font-semibold uppercase tracking-[0.06em] text-ink-2">
            Câu {hienTai} / {tong}
          </span>
          <span className="text-ink-3">Đã làm {daLam}</span>
        </p>
      )}
      {chiaO ? (
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${tong}, minmax(0, 1fr))` }}
          role="progressbar"
          aria-label="Tiến độ làm bài"
          aria-valuemin={0}
          aria-valuemax={tong}
          aria-valuenow={hienTai}
          aria-valuetext={`Câu ${hienTai} trên ${tong}, đã làm ${daLam}`}
        >
          {Array.from({ length: tong }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 rounded-full",
                n === hienTai
                  ? "bg-primary outline-2 outline-offset-1 outline-primary-soft"
                  : cacCauDaLam.has(n)
                    ? "bg-primary/70"
                    : "bg-line",
              )}
            />
          ))}
        </div>
      ) : (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Tiến độ làm bài"
          aria-valuemin={0}
          aria-valuemax={tong}
          aria-valuenow={hienTai}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${phanTram}%` }} />
        </div>
      )}
    </div>
  );
}
