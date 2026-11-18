import { cn } from "../../lib/cn";

/**
 * Khung chờ (skeleton) cho danh sách đang tải: vài dòng xám nhấp nháy nhẹ đúng chỗ nội dung sẽ hiện,
 * để bố cục không nhảy khi dữ liệu về. `nhan` là câu trình đọc màn hình đọc lên (ví dụ "Đang tải danh
 * sách bài."). Giảm chuyển động: quy tắc chung ở app.css tắt nhấp nháy, chỉ còn dòng xám đứng yên.
 */
export function KhungCho({
  nhan,
  dong = 3,
  cao = "h-12",
  className,
}: {
  nhan: string;
  dong?: number;
  /** Chiều cao mỗi dòng (lớp Tailwind), gần với chiều cao một mục thật. */
  cao?: string;
  className?: string;
}) {
  return (
    <div role="status" className={cn("grid gap-2", className)}>
      <span className="sr-only">{nhan}</span>
      {Array.from({ length: dong }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: dòng giữ chỗ, không có dữ liệu riêng
          key={i}
          aria-hidden="true"
          className={cn(
            "block animate-pulse rounded-btn bg-surface-2",
            cao,
            i === dong - 1 && dong > 1 && "w-2/3",
          )}
        />
      ))}
    </div>
  );
}
