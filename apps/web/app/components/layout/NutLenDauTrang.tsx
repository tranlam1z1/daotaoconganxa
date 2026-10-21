import { useEffect, useState } from "react";

import { cn } from "../../lib/cn";
import { Icon } from "../ui/Icon";

/** Trang dài hơn chừng này lần chiều cao màn hình mới đáng có nút. */
const TRANG_DAI = 2;
/** Cuộn quá chừng này lần chiều cao màn hình thì nút hiện. */
const DA_CUON = 1;

/**
 * Nút nổi đưa người đọc về đầu trang, chỉ hiện khi trang dài và đã cuộn xuống. Nằm trên thanh
 * điều hướng dưới cùng (biến --thanh-duoi-noi, về 0 khi thanh ẩn do cuộn) nếu trang có thanh đó, và
 * trên thanh nút dính đáy của trang (biến --thanh-hanh-dong, components/ui/ThanhDinhDay.tsx) để không
 * đè nút chính.
 */
export function NutLenDauTrang() {
  const [hien, setHien] = useState(false);

  useEffect(() => {
    let cho = 0;
    const capNhat = () => {
      cho = 0;
      const manHinh = window.innerHeight;
      const dai = document.documentElement.scrollHeight > manHinh * TRANG_DAI;
      setHien(dai && window.scrollY > manHinh * DA_CUON);
    };
    const henCapNhat = () => {
      if (!cho) cho = requestAnimationFrame(capNhat);
    };
    capNhat();
    window.addEventListener("scroll", henCapNhat, { passive: true });
    window.addEventListener("resize", henCapNhat);
    return () => {
      window.removeEventListener("scroll", henCapNhat);
      window.removeEventListener("resize", henCapNhat);
      if (cho) cancelAnimationFrame(cho);
    };
  }, []);

  function lenDau() {
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: giamChuyenDong ? "auto" : "smooth" });
    // Đưa tiêu điểm bàn phím về đầu nội dung, không để nó kẹt ở nút vừa ẩn.
    document.getElementById("noi-dung-chinh")?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      onClick={lenDau}
      aria-label="Lên đầu trang"
      title="Lên đầu trang"
      tabIndex={hien ? 0 : -1}
      aria-hidden={!hien}
      className={cn(
        "no-print fixed right-4 z-20 grid size-12 place-items-center rounded-full border border-line bg-canvas/95 text-ink shadow-lg backdrop-blur-md transition-[opacity,transform,bottom] duration-200 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:right-6",
        // Trên thanh điều hướng dưới cùng (hoặc vùng thanh home) và trên thanh nút dính đáy của trang.
        "bottom-[calc(max(var(--thanh-duoi-noi,0px),env(safe-area-inset-bottom))+var(--thanh-hanh-dong,0px)+1rem)]",
        "md:bottom-[calc(var(--thanh-hanh-dong,0px)+1.5rem)]",
        hien ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <Icon name="arrowUp" className="size-6" />
    </button>
  );
}
