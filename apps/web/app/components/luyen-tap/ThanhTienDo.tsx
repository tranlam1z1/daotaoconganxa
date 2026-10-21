/**
 * Thanh tiến độ "Câu 3/10" của phiên luyện tập, kèm số câu đã trả lời. Không nêu số câu đúng: phiên
 * chỉ chấm khi nộp bài.
 */
export function ThanhTienDo({ hienTai, tong, daLam }: { hienTai: number; tong: number; daLam: number }) {
  const phanTram = tong ? Math.round((hienTai / tong) * 100) : 0;
  return (
    <div>
      <p className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">
          Câu {hienTai}/{tong}
        </span>
        <span className="text-ink-2">Đã làm {daLam}</span>
      </p>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Tiến độ phiên luyện tập"
        aria-valuemin={0}
        aria-valuemax={tong}
        aria-valuenow={hienTai}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${phanTram}%` }}
        />
      </div>
    </div>
  );
}
