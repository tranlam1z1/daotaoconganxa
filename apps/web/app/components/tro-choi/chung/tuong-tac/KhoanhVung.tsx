/**
 * Khoanh vùng (mô-đun M2, phần khoanh vùng; docs/GAME_DESIGN.md §4, GĐ-T5). Lớp phủ trên khung hình:
 * kéo một khung, hoặc vẽ một vòng quanh vật; cả hai quy về hộp bao của nét vẽ. Chạm nhẹ (không kéo)
 * báo `onCham` để trò tự khoanh vật ở chỗ chạm (đường thay thế cho người khó vẽ). Đường thay thế
 * bằng bàn phím do trò cung cấp (danh sách nút cho từng vật).
 *
 * Tọa độ trả về theo px, gốc ở góc trên trái của lớp phủ. Nét vẽ hiện bằng SVG, chỉ động khi đang vẽ.
 */
import { useRef, useState } from "react";

export type HopPx = [number, number, number, number];

const NGUONG_CHAM_PX = 10;

export function KhoanhVung({
  bat,
  onKhoanh,
  onCham,
  nhan,
}: {
  bat: boolean;
  onKhoanh: (h: HopPx) => void;
  onCham?: (x: number, y: number) => void;
  nhan: string;
}) {
  const [net, datNet] = useState<Array<[number, number]>>([]);
  const dang = useRef<Array<[number, number]> | null>(null);
  const hop = useRef<HTMLDivElement>(null);

  const diem = (e: React.PointerEvent): [number, number] => {
    const r = hop.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(r.width, e.clientX - r.left)),
      Math.max(0, Math.min(r.height, e.clientY - r.top)),
    ];
  };

  if (!bat) return null;
  const xs = net.map((p) => p[0]);
  const ys = net.map((p) => p[1]);
  const bao: HopPx | null =
    net.length > 1 ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;

  return (
    <div
      ref={hop}
      role="application"
      aria-label={nhan}
      className="absolute inset-0 touch-none select-none"
      style={{ cursor: "crosshair" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dang.current = [diem(e)];
        datNet(dang.current);
      }}
      onPointerMove={(e) => {
        if (!dang.current) return;
        dang.current = [...dang.current, diem(e)];
        datNet(dang.current);
      }}
      onPointerUp={(e) => {
        const ds = dang.current;
        dang.current = null;
        datNet([]);
        if (!ds?.length) return;
        const x = ds.map((p) => p[0]);
        const y = ds.map((p) => p[1]);
        const h: HopPx = [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)];
        const [cx, cy] = diem(e);
        if (h[2] - h[0] < NGUONG_CHAM_PX && h[3] - h[1] < NGUONG_CHAM_PX) onCham?.(cx, cy);
        else onKhoanh(h);
      }}
      onPointerCancel={() => {
        dang.current = null;
        datNet([]);
      }}
    >
      {net.length > 1 ? (
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          <polyline
            points={net.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="var(--warn)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {bao ? (
            <rect
              x={bao[0]}
              y={bao[1]}
              width={bao[2] - bao[0]}
              height={bao[3] - bao[1]}
              fill="none"
              stroke="var(--warn)"
              strokeDasharray="5 4"
              strokeWidth="1.5"
            />
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}
