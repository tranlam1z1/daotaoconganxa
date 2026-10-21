import { useEffect, useState } from "react";

import { cn } from "../../lib/cn";

type LoaiThongBao = "thuong" | "loi";
interface ThongBao {
  noiDung: string;
  loai: LoaiThongBao;
  lan: number;
}

const SU_KIEN = "qdpl:thong-bao-nhanh";
const THOI_GIAN_MS = 3000;

/**
 * Hiện một thông báo ngắn (toast) ở đáy màn hình, tự tắt sau 3 giây. Thông báo mới thay thông báo cũ.
 * Gọi được ở bất kỳ đâu phía trình duyệt; vùng hiện là `VungThongBaoNhanh` gắn một lần ở root.tsx.
 */
export function baoNhanh(noiDung: string, loai: LoaiThongBao = "thuong") {
  window.dispatchEvent(new CustomEvent(SU_KIEN, { detail: { noiDung, loai } }));
}

/**
 * Vùng toast: dính đáy, nằm trên thanh điều hướng dưới cùng (--thanh-duoi-noi) và thanh nút dính đáy của
 * trang (--thanh-hanh-dong, do thanh đó khai) để không che nút chính; tôn trọng vùng thanh home.
 * Vùng role="status" luôn có trên trang để trình đọc màn hình đọc được thông báo.
 */
export function VungThongBaoNhanh() {
  const [tb, datTb] = useState<ThongBao | null>(null);

  useEffect(() => {
    let lan = 0;
    const nhan = (e: Event) => {
      const { noiDung, loai } = (e as CustomEvent<Omit<ThongBao, "lan">>).detail;
      lan += 1;
      datTb({ noiDung, loai, lan });
    };
    window.addEventListener(SU_KIEN, nhan);
    return () => window.removeEventListener(SU_KIEN, nhan);
  }, []);

  useEffect(() => {
    if (!tb) return;
    const t = window.setTimeout(() => datTb(null), THOI_GIAN_MS);
    return () => window.clearTimeout(t);
  }, [tb]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 transition-[bottom] duration-200 motion-reduce:transition-none"
      style={{
        bottom:
          "calc(max(var(--thanh-duoi-noi), env(safe-area-inset-bottom)) + var(--thanh-hanh-dong, 0px) + 1rem)",
      }}
    >
      {tb ? (
        <p
          key={tb.lan}
          className={cn(
            "hop-vao w-full max-w-sm rounded-xl px-4 py-3 text-center text-base shadow-lg",
            tb.loai === "loi" ? "bg-danger text-canvas" : "bg-ink text-canvas",
          )}
        >
          {tb.noiDung}
        </p>
      ) : null}
    </div>
  );
}
