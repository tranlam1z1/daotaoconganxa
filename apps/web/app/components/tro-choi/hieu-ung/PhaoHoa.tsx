/**
 * Pháo hoa nhẹ (docs/VISUAL_STYLE.md §3.3): tối đa 40 hạt, sống tối đa 1,2 giây, vẽ trên một canvas
 * phủ không bắt sự kiện chạm. Hạt là mảnh chữ nhật và chấm tròn, màu lấy từ token (màu chính, màu
 * nhấn, trắng). Giảm chuyển động thì không có canvas. Độ phân giải canvas giới hạn ở 2×.
 */
import { useEffect, useRef } from "react";

import { dangGiamChuyenDong, useGiamChuyenDong } from "./cai-dat";

const SO_HAT = 40;
const SONG_MS = 1200;

interface Hat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  xoay: number;
  vXoay: number;
  mau: string;
  tron: boolean;
  co: number;
}

export function PhaoHoa({ lan = 0 }: { lan?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const giam = useGiamChuyenDong();

  // biome-ignore lint/correctness/useExhaustiveDependencies: `lan` đổi thì bắn lại
  useEffect(() => {
    const cv = ref.current;
    if (!cv || dangGiamChuyenDong()) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width: w, height: h } = cv.getBoundingClientRect();
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    g.scale(dpr, dpr);
    const kieu = getComputedStyle(cv);
    const mau = [kieu.getPropertyValue("--primary"), kieu.getPropertyValue("--g-nhan"), "#ffffff"].map(
      (m) => m.trim() || "#f4c20d",
    );
    const hat: Hat[] = Array.from({ length: SO_HAT }, (_, i) => {
      const goc = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const tocDo = 6 + Math.random() * 6;
      return {
        x: w / 2 + (Math.random() - 0.5) * 40,
        y: h * 0.45,
        vx: Math.cos(goc) * tocDo,
        vy: Math.sin(goc) * tocDo,
        xoay: Math.random() * Math.PI,
        vXoay: (Math.random() - 0.5) * 0.3,
        mau: mau[i % mau.length]!,
        tron: i % 3 === 0,
        co: 4 + Math.random() * 4,
      };
    });
    let raf = 0;
    const t0 = performance.now();
    let truoc = t0;
    const ve = (t: number) => {
      const dt = Math.min(2.5, (t - truoc) / 16.7);
      truoc = t;
      const k = (t - t0) / SONG_MS;
      g.clearRect(0, 0, w, h);
      if (k >= 1) return;
      g.globalAlpha = 1 - k * k;
      for (const p of hat) {
        p.vy += 0.28 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.xoay += p.vXoay * dt;
        g.fillStyle = p.mau;
        if (p.tron) {
          g.beginPath();
          g.arc(p.x, p.y, p.co / 2, 0, Math.PI * 2);
          g.fill();
        } else {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.xoay);
          g.fillRect(-p.co / 2, -p.co / 4, p.co, p.co / 2);
          g.restore();
        }
      }
      raf = requestAnimationFrame(ve);
    };
    raf = requestAnimationFrame(ve);
    return () => cancelAnimationFrame(raf);
  }, [lan, giam]);

  if (giam) return null;
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50 size-full" />;
}
