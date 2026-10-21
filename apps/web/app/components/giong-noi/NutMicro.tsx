/**
 * Nút micro (docs/PLAN.md GĐ14): bấm để nói, bấm lần nữa để dừng. Trình duyệt không có nhận dạng
 * giọng nói thì nút không hiện (kể cả lần vẽ ở máy chủ), để không ai bấm vào một nút không chạy.
 */
import { cn } from "../../lib/cn";
import { Icon } from "../ui/Icon";
import { useNhanDangGiong } from "./useNhanDangGiong";

export function NutMicro({
  onKetQua,
  nhan,
  nhanDangNghe = "Đang nghe, bấm để dừng",
  className,
  lon = false,
}: {
  onKetQua: (text: string) => void;
  /** Chữ trên nút, ví dụ "Nói câu hỏi". */
  nhan: string;
  nhanDangNghe?: string;
  className?: string;
  /** Nút to ở giữa màn hình (trò chơi). */
  lon?: boolean;
}) {
  const g = useNhanDangGiong(onKetQua);
  if (!g.hoTro) return null;

  return (
    <div className={className} data-nut-micro="">
      <button
        type="button"
        aria-pressed={g.dangNghe}
        onClick={g.dangNghe ? g.dung : g.batDau}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg border font-medium",
          lon ? "min-h-14 w-full px-5 text-lg" : "min-h-11 px-4 text-[15px]",
          g.dangNghe
            ? "border-danger bg-danger-soft text-danger motion-safe:animate-pulse"
            : "border-line-strong bg-surface text-ink dong-bam",
        )}
      >
        <Icon name="mic" className={lon ? "size-6" : "size-5"} />
        {g.dangNghe ? nhanDangNghe : nhan}
      </button>
      <p aria-live="polite" className="mt-1 min-h-5 text-sm text-ink-2">
        {g.loi ? <span className="text-danger">{g.loi}</span> : g.tamThoi ? `Đang nghe: ${g.tamThoi}` : null}
      </p>
    </div>
  );
}
