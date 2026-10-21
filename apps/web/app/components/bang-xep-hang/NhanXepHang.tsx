/** Nhãn dùng chung của trang Bảng xếp hạng (routes/bang-xep-hang.tsx và bục ba hạng đầu). */
import { cn } from "../../lib/cn";

/** Chip cấp: cùng một kiểu ở mọi chỗ trên trang, để cấp không lẫn với số hạng. */
export function ChipCap({ cap, className }: { cap: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2",
        className,
      )}
    >
      Cấp {cap}
    </span>
  );
}

/** Chữ đi kèm dòng của người xem: "(bạn)" hoặc "(đơn vị của bạn)". `className` đổi màu chữ khi cần. */
export function NhanCuaToi({ caNhan, className = "text-ink-2" }: { caNhan: boolean; className?: string }) {
  return (
    <span className={cn("block text-xs font-normal", className)}>({caNhan ? "bạn" : "đơn vị của bạn"})</span>
  );
}
