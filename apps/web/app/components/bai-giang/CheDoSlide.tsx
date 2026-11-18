/**
 * Chế độ slide của bài giảng (docs/PLAN.md GĐ11): mỗi khối một trang, cùng dữ liệu với chế độ
 * đọc cuộn. Mỗi trang là một tấm slide: băng tên bài ở đầu, nội dung căn giữa, chân ghi chuyên đề
 * và số trang; từ 768px tấm giữ tỷ lệ 16:9 và tự cao thêm khi nội dung dài. Chuyển trang bằng
 * vuốt ngang, phím mũi tên trái/phải, hoặc hai nút to ở cuối màn hình (cao 48px, bấm được bằng
 * ngón cái). Trang cuối là phần kết bài: hoàn thành và kiểm tra.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import type { KhoiBaiGiang } from "../../lib/bai-giang";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { ThanhDinhDay } from "../ui/ThanhDinhDay";
import { KhoiNoiDung } from "./KhoiNoiDung";

/** Vuốt ngang ít nhất chừng này (px) và ngang nhiều hơn dọc thì mới tính là chuyển trang. */
const NGUONG_VUOT = 50;

export function CheDoSlide({
  khoi,
  ketBai,
  tieuDe,
  chuyenDe,
}: {
  khoi: KhoiBaiGiang[];
  ketBai: ReactNode;
  tieuDe: string;
  chuyenDe: string;
}) {
  const tong = khoi.length + 1;
  const [trang, setTrang] = useState(0);
  // Hướng vừa đi (1: tới, -1: lui) để trang mới trượt vào đúng phía; 0 lúc mới mở thì không trượt.
  const [huong, setHuong] = useState<0 | 1 | -1>(0);
  const diemCham = useRef<{ x: number; y: number } | null>(null);
  const vungNoiDung = useRef<HTMLDivElement>(null);

  const buoc = useCallback(
    (d: 1 | -1) => {
      setHuong(d);
      setTrang((t) => Math.max(0, Math.min(tong - 1, t + d)));
    },
    [tong],
  );

  // Sang trang mới thì đưa đầu trang vào tầm nhìn và chuyển tiêu điểm cho trình đọc màn hình.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy khi đổi trang
  useEffect(() => {
    vungNoiDung.current?.focus({ preventScroll: true });
    vungNoiDung.current?.scrollIntoView({ block: "nearest" });
  }, [trang]);

  useEffect(() => {
    const phim = (e: KeyboardEvent) => {
      // Không cướp phím khi người học đang gõ trong ô nhập.
      const dich = e.target as HTMLElement | null;
      if (dich && ["INPUT", "TEXTAREA", "SELECT"].includes(dich.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        buoc(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        buoc(-1);
      }
    };
    window.addEventListener("keydown", phim);
    return () => window.removeEventListener("keydown", phim);
  }, [buoc]);

  const k = khoi[trang];
  return (
    <div>
      <section
        ref={vungNoiDung}
        tabIndex={-1}
        aria-roledescription="trang"
        aria-label={`Trang ${trang + 1} trên ${tong}`}
        className="flex touch-pan-y flex-col rounded-card border border-line bg-surface shadow-card outline-none max-md:min-h-[55vh] md:aspect-video"
        onTouchStart={(e) => {
          const t = e.touches[0];
          diemCham.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const dau = diemCham.current;
          const t = e.changedTouches[0];
          diemCham.current = null;
          if (!dau || !t) return;
          const dx = t.clientX - dau.x;
          const dy = t.clientY - dau.y;
          if (Math.abs(dx) < NGUONG_VUOT || Math.abs(dx) < Math.abs(dy)) return;
          buoc(dx < 0 ? 1 : -1);
        }}
      >
        {/* Tên bài đã có ở h1 đầu trang nên băng này ẩn với trình đọc màn hình. */}
        <p
          aria-hidden="true"
          className="truncate rounded-t-[calc(var(--radius-card)-1px)] border-b-[3px] border-vang bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary sm:px-6 md:px-10 md:py-3 md:text-base"
        >
          {tieuDe}
        </p>

        {/* key theo trang: trang mới dựng lại từ đầu nên thẻ đã lật, câu đã chọn không dính sang trang sau. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center overflow-x-clip p-3 sm:p-6 md:px-10 md:py-8">
          <div
            key={trang}
            className={cn(
              "mx-auto w-full max-w-3xl md:[&_.prose-bai]:text-lg",
              huong === 1 && "slide-vao-sau",
              huong === -1 && "slide-vao-truoc",
            )}
          >
            {k ? <KhoiNoiDung khoi={k} /> : ketBai}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-sm text-ink-2 sm:px-6 md:px-10">
          <span className="truncate">{chuyenDe}</span>
          <span aria-live="polite" className="shrink-0 tabular-nums">
            Trang {trang + 1}/{tong}
          </span>
        </div>
      </section>

      <div
        className="mt-3 flex gap-1"
        role="progressbar"
        aria-label="Tiến độ trong bài"
        aria-valuemin={1}
        aria-valuemax={tong}
        aria-valuenow={trang + 1}
      >
        {Array.from({ length: tong }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: mỗi vạch là một trang, thứ tự cố định
            key={i}
            className={cn("h-1.5 flex-1 rounded-full", i <= trang ? "bg-primary" : "bg-line-strong")}
          />
        ))}
      </div>
      <p className="mt-2 hidden text-center text-sm text-ink-2 sm:block">
        Vuốt ngang hoặc dùng phím mũi tên để chuyển trang
      </p>

      <ThanhDinhDay as="nav" aria-label="Chuyển trang" className="mt-4 flex gap-3 bg-canvas pt-3">
        <Button
          variant="secondary"
          className="min-h-12 flex-1 text-base"
          disabled={trang === 0}
          onClick={() => buoc(-1)}
        >
          Trang trước
        </Button>
        <Button className="min-h-12 flex-1 text-base" disabled={trang === tong - 1} onClick={() => buoc(1)}>
          {trang === tong - 2 ? "Kết bài" : "Trang tiếp"}
        </Button>
      </ThanhDinhDay>
    </div>
  );
}
