/**
 * Bản đồ khu phố dạng ô (mô-đun M9, phần giao diện; docs/GAME_DESIGN.md §4.1, tạo ở GĐ-T17). Vẽ bằng SVG: mỗi ô
 * 10 đơn vị, màu theo loại ô (đường, nhà, trường học, chợ, cây xanh, đất trống) lấy từ token của hướng A. Trò
 * vẽ thêm vật thể (camera, tổ công tác…) trong `lop`, cùng hệ tọa độ ô × 10.
 *
 * Chạm một ô báo `onChamO`. Đường thay thế bằng bàn phím: Tab vào bản đồ, phím mũi tên di chuyển ô đang trỏ,
 * Enter hoặc Space để chọn. Ô nhỏ hơn vùng chạm 48px trên điện thoại, nên trò nên có thêm danh sách chọn
 * (ví dụ danh sách camera) và nút dịch chuyển từng ô.
 */
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";

import type { BanDoO as KieuBanDoO, ToaDoO } from "../../../../../../packages/dao-tao/src/ban-do/luoi.ts";
import { KY_HIEU_O, TEN_LOAI_O } from "../../../../../../packages/dao-tao/src/ban-do/luoi.ts";

export const DON_VI_O = 10;

const MAU_O: Record<string, string> = {
  duong: "var(--ink-2)",
  nha: "var(--surface-2, #e8e4da)",
  truong_hoc: "var(--primary-soft)",
  cho: "var(--warn-soft, #f6e3bf)",
  cay: "var(--ok-soft)",
  trong: "var(--canvas)",
};

export function BanDoO({
  banDo,
  nhan,
  onChamO,
  lop,
  oTro: oTroNgoai,
  className,
}: {
  banDo: KieuBanDoO;
  /** Nhãn cho trình đọc màn hình. */
  nhan: string;
  onChamO?: (o: ToaDoO) => void;
  /** Vật thể của trò, vẽ trên các ô (tọa độ ô × DON_VI_O). */
  lop?: ReactNode;
  /** Ô đang trỏ do trò điều khiển (nếu có). */
  oTro?: ToaDoO | null;
  className?: string;
}) {
  const [oTro, datOTro] = useState<ToaDoO | null>(null);
  const [coTieuDiem, datCoTieuDiem] = useState(false);
  const id = useId();
  const tro = oTroNgoai !== undefined && !coTieuDiem ? oTroNgoai : oTro;
  const W = banDo.rong * DON_VI_O;
  const H = banDo.cao * DON_VI_O;

  const oTu = (e: React.PointerEvent<SVGSVGElement>): ToaDoO | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * banDo.rong);
    const y = Math.floor(((e.clientY - r.top) / r.height) * banDo.cao);
    return x >= 0 && y >= 0 && x < banDo.rong && y < banDo.cao ? { x, y } : null;
  };

  const phim = (e: KeyboardEvent<SVGSVGElement>) => {
    const p = tro ?? { x: Math.floor(banDo.rong / 2), y: Math.floor(banDo.cao / 2) };
    const buoc: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const b = buoc[e.key];
    if (b) {
      e.preventDefault();
      datOTro({
        x: Math.max(0, Math.min(banDo.rong - 1, p.x + b[0])),
        y: Math.max(0, Math.min(banDo.cao - 1, p.y + b[1])),
      });
    } else if ((e.key === "Enter" || e.key === " ") && onChamO) {
      e.preventDefault();
      datOTro(p);
      onChamO(p);
    }
  };

  const loaiTro = tro ? KY_HIEU_O[banDo.o[tro.y]?.[tro.x] ?? "."] : undefined;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="application"
        aria-label={nhan}
        aria-describedby={`${id}-o`}
        tabIndex={onChamO ? 0 : -1}
        className="block w-full touch-manipulation select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        style={{ aspectRatio: `${banDo.rong} / ${banDo.cao}` }}
        onPointerUp={(e) => {
          const o = oTu(e);
          if (o && onChamO) {
            datOTro(o);
            onChamO(o);
          }
        }}
        onKeyDown={phim}
        onFocus={() => datCoTieuDiem(true)}
        onBlur={() => datCoTieuDiem(false)}
      >
        {banDo.o.map((dong, y) =>
          [...dong].map((k, x) => {
            const loai = KY_HIEU_O[k] ?? "trong";
            const duong = loai === "duong";
            return (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: ô lưới cố định theo tọa độ.
                key={`${x}-${y}`}
                x={x * DON_VI_O + (duong ? 0 : 0.6)}
                y={y * DON_VI_O + (duong ? 0 : 0.6)}
                width={DON_VI_O - (duong ? 0 : 1.2)}
                height={DON_VI_O - (duong ? 0 : 1.2)}
                rx={duong ? 0 : 1.2}
                fill={MAU_O[loai]}
              />
            );
          }),
        )}
        {banDo.o.map((dong, y) =>
          [...dong].map((k, x) =>
            k === "T" || k === "C" ? (
              <text
                // biome-ignore lint/suspicious/noArrayIndexKey: ô lưới cố định theo tọa độ.
                key={`c-${x}-${y}`}
                x={x * DON_VI_O + 5}
                y={y * DON_VI_O + 7}
                fontSize="6"
                textAnchor="middle"
                fill="var(--ink)"
              >
                {k === "T" ? "TH" : "CH"}
              </text>
            ) : null,
          ),
        )}
        {lop}
        {tro ? (
          <rect
            x={tro.x * DON_VI_O + 0.5}
            y={tro.y * DON_VI_O + 0.5}
            width={DON_VI_O - 1}
            height={DON_VI_O - 1}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.2"
            strokeDasharray="2 1.5"
            pointerEvents="none"
          />
        ) : null}
      </svg>
      <p id={`${id}-o`} className="sr-only" aria-live="polite">
        {tro ? `Ô cột ${tro.x + 1}, dòng ${tro.y + 1}: ${loaiTro ? TEN_LOAI_O[loaiTro] : ""}` : ""}
      </p>
    </div>
  );
}
