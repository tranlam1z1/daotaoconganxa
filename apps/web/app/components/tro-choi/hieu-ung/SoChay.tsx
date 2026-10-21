/**
 * Số chạy từ `tu` tới `den` (docs/VISUAL_STYLE.md §3.2, hiệu ứng 9). Cập nhật bằng
 * requestAnimationFrame, chỉ ghi DOM khi con số hiển thị đổi (§6.2). Giảm chuyển động: hiện ngay số
 * cuối. Trình đọc màn hình chỉ đọc số cuối.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import { giaTriSoChay } from "../../../lib/hieu-ung";
import { dangGiamChuyenDong } from "./cai-dat";

// Chạy trước khi vẽ để khung hình đầu không lóe số cuối; trên máy chủ dùng useEffect cho khỏi cảnh báo.
const useTruocKhiVe = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SoChay({
  den,
  tu = 0,
  ms = 800,
  treMs = 0,
  thapPhan = 0,
  hauTo = "",
  className,
  onXong,
}: {
  den: number;
  tu?: number;
  ms?: number;
  treMs?: number;
  thapPhan?: number;
  hauTo?: string;
  className?: string;
  onXong?: () => void;
}) {
  const dinhDang = (v: number) =>
    v.toLocaleString("vi-VN", { maximumFractionDigits: thapPhan, minimumFractionDigits: 0 });
  const [hien, datHien] = useState(() => dinhDang(den));
  const xongRef = useRef(onXong);
  xongRef.current = onXong;

  useTruocKhiVe(() => {
    if (dangGiamChuyenDong() || ms <= 0) {
      datHien(dinhDang(den));
      xongRef.current?.();
      return;
    }
    let raf = 0;
    let cuoi = "";
    const batDau = performance.now() + treMs;
    const buoc = (t: number) => {
      const k = (t - batDau) / ms;
      const s = dinhDang(giaTriSoChay(tu, den, Math.max(0, k)));
      if (s !== cuoi) {
        cuoi = s;
        datHien(s);
      }
      if (k < 1) raf = requestAnimationFrame(buoc);
      else xongRef.current?.();
    };
    datHien(dinhDang(tu));
    raf = requestAnimationFrame(buoc);
    return () => cancelAnimationFrame(raf);
  }, [den, tu, ms, treMs]);

  return (
    <span className={cn("g-so", className)}>
      <span aria-hidden="true">
        {hien}
        {hauTo}
      </span>
      <span className="sr-only">
        {dinhDang(den)}
        {hauTo}
      </span>
    </span>
  );
}
