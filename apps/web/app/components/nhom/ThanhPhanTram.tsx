/**
 * Thanh phần trăm của nhóm học cùng (docs/PLAN.md GĐ16b, đề xuất Đ13). Không dùng ThanhTienDo
 * của luyện tập vì thanh đó hiện số câu đúng. Phần trăm luôn có số đi kèm, không chỉ dựa vào màu.
 */
export function ThanhPhanTram({ giaTri, nhan }: { giaTri: number | null; nhan: string }) {
  if (giaTri === null) return <p className="text-sm text-ink-2">Chưa có bài</p>;
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={nhan}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={giaTri}
        aria-valuetext={`${giaTri}%`}
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${giaTri}%` }} />
      </div>
      <span className="w-11 shrink-0 text-right text-sm font-semibold tabular-nums">{giaTri}%</span>
    </div>
  );
}
