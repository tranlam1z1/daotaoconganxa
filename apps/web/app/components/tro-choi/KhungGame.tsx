import type { ReactNode } from "react";
import { Link } from "react-router";

import { NutCaiDatGame } from "./hieu-ung/NutCaiDatGame";
import { SaoTongKet } from "./hieu-ung/SaoTongKet";
import { VungTroChoi } from "./hieu-ung/VungTroChoi";

/**
 * Khung chung của mọi màn hình trò chơi (docs/PLAN.md GĐ10): nút quay lại, tên game, vùng điểm
 * hoặc đồng hồ ở góc phải, nội dung chơi ở giữa. Bề rộng tối đa như một điện thoại để chơi được
 * bằng một tay; mọi vùng bấm cao từ 44px.
 *
 * Khung cũng là "khu trò chơi" của phong cách hình ảnh (docs/VISUAL_STYLE.md, hướng A): thuộc tính
 * `data-khu="tro-choi"` đổi token màu cho mọi thứ bên trong, `data-giam-hieu-ung` bật giảm chuyển
 * động theo công tắc trong trò chơi. Hai nút âm thanh, rung nằm ở đầu khung.
 */
export function KhungGame({
  tieuDe,
  quayLai = "/tro-choi",
  nhanQuayLai = "Trò chơi",
  benPhai,
  children,
}: {
  tieuDe: string;
  quayLai?: string;
  nhanQuayLai?: string;
  benPhai?: ReactNode;
  children: ReactNode;
}) {
  return (
    <VungTroChoi>
      <div className="wrap g-dau-trang max-w-xl py-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            to={quayLai}
            className="hidden min-h-11 items-center text-sm text-ink-2 underline md:inline-flex"
          >
            {nhanQuayLai}
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {benPhai ? <div className="shrink-0">{benPhai}</div> : null}
            <NutCaiDatGame />
          </div>
        </div>
        <h1 className="g-a g-vao-xuong mt-1 text-2xl font-semibold">{tieuDe}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </VungTroChoi>
  );
}

/** Dãy sao 0–3, có nhãn chữ cho trình đọc màn hình. */
export function Sao({ so, lon = false }: { so: number; lon?: boolean }) {
  return <SaoTongKet so={so} lon={lon} hoatAnh={false} />;
}
