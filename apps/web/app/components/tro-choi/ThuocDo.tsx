/**
 * Thước đo trên hình xe (trò "Soi xe cải tạo", docs/PLAN.md GĐ-T14): đoạn thẳng có hai đầu kéo được, hiện
 * độ dài theo tỷ lệ hình (mm). Vẽ trong SVG của hình (đơn vị hình). Mỗi đầu là một nút: kéo bằng ngón tay,
 * hoặc Tab tới rồi dùng phím mũi tên (1 đơn vị; giữ Shift: 10 đơn vị).
 */
import { useRef } from "react";

export type DiemThuoc = [number, number];

export function ThuocDo({
  dau,
  datDau,
  rong,
  cao,
  tyLeMm,
  banKinh,
}: {
  dau: [DiemThuoc, DiemThuoc];
  datDau: (d: [DiemThuoc, DiemThuoc]) => void;
  rong: number;
  cao: number;
  tyLeMm: number;
  /** Bán kính đầu thước (đơn vị hình), trang tính sao cho vùng chạm ≥ 48px. */
  banKinh: number;
}) {
  const keo = useRef<number | null>(null);
  const svg = useRef<SVGGElement>(null);
  const [a, b] = dau;
  const dai = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * tyLeMm);
  const kep = (p: DiemThuoc): DiemThuoc => [
    Math.max(0, Math.min(rong, Math.round(p[0]))),
    Math.max(0, Math.min(cao, Math.round(p[1]))),
  ];
  const dat = (i: number, p: DiemThuoc) => datDau(i === 0 ? [kep(p), b] : [a, kep(p)]);
  const diem = (e: React.PointerEvent): DiemThuoc => {
    const m = svg.current!.ownerSVGElement!.getScreenCTM()!.inverse();
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [q.x, q.y];
  };
  const giua: DiemThuoc = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return (
    <g ref={svg}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--primary)" strokeWidth={1.5} />
      <text
        x={giua[0]}
        y={giua[1] - 4}
        fontSize={12}
        fontWeight={700}
        textAnchor="middle"
        fill="var(--primary)"
        stroke="var(--surface)"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {dai.toLocaleString("vi-VN")} mm
      </text>
      {[a, b].map((p, i) => (
        // biome-ignore lint/a11y/useSemanticElements: đầu thước là phần tử SVG, không đặt được <button>
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: hai đầu thước cố định
          key={i}
          role="button"
          tabIndex={0}
          aria-label={`Đầu thước ${i + 1}: đang đo ${dai} mm. Phím mũi tên để dời`}
          cx={p[0]}
          cy={p[1]}
          r={banKinh}
          fill="var(--primary)"
          fillOpacity={0.35}
          stroke="var(--primary)"
          strokeWidth={2}
          style={{ touchAction: "none", cursor: "grab" }}
          onPointerDown={(e) => {
            keo.current = i;
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (keo.current === i) dat(i, diem(e));
          }}
          onPointerUp={() => {
            keo.current = null;
          }}
          onKeyDown={(e) => {
            const buoc = e.shiftKey ? 10 : 1;
            const d: Record<string, DiemThuoc> = {
              ArrowLeft: [-buoc, 0],
              ArrowRight: [buoc, 0],
              ArrowUp: [0, -buoc],
              ArrowDown: [0, buoc],
            };
            const v = d[e.key];
            if (!v) return;
            e.preventDefault();
            dat(i, [p[0] + v[0], p[1] + v[1]]);
          }}
        />
      ))}
    </g>
  );
}
