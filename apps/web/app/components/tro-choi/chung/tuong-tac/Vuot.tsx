/**
 * Vuốt theo 8 hướng (mô-đun M2, phần vuốt; docs/GAME_DESIGN.md §4, PLAN GĐ-T4).
 *
 * Một ô vuốt lớn, dùng bằng ngón cái. Nhận dạng trên Pointer Events: nhấc tay sau khi kéo đủ
 * NGUONG_PX thì báo hướng gần nhất trong 8 hướng. Đường thay thế:
 *  - bàn phím: phím mũi tên khi ô đang được chọn (lên, xuống, trái, phải);
 *  - chạm: nút "Không vuốt được?" gửi đúng hướng chính mà trò cần (`huongChinh`).
 * Góc chỉ dùng ở giao diện để đổi cử chỉ thành hướng; logic trò nhận hướng rời rạc.
 */
import { useRef } from "react";

import { cn } from "../../../../lib/cn";

export type Huong8 =
  | "len"
  | "xuong"
  | "trai"
  | "phai"
  | "len_trai"
  | "len_phai"
  | "xuong_trai"
  | "xuong_phai";

const NGUONG_PX = 36;
/** Thứ tự theo góc, bắt đầu từ phải, ngược chiều kim đồng hồ (trục y màn hình hướng xuống). */
const THEO_GOC: Huong8[] = [
  "phai",
  "len_phai",
  "len",
  "len_trai",
  "trai",
  "xuong_trai",
  "xuong",
  "xuong_phai",
];
const PHIM: Record<string, Huong8> = {
  ArrowUp: "len",
  ArrowDown: "xuong",
  ArrowLeft: "trai",
  ArrowRight: "phai",
};

export function huongTuDoDoi(dx: number, dy: number): Huong8 | null {
  if (Math.hypot(dx, dy) < NGUONG_PX) return null;
  const goc = Math.atan2(-dy, dx); // −π..π, 0 là sang phải
  const o = Math.round(goc / (Math.PI / 4));
  return THEO_GOC[(o + 8) % 8]!;
}

export function Vuot({
  onVuot,
  nhan,
  goiY,
  huongChinh,
  nhanThayThe,
  khoa = false,
  noiBat = false,
  anNhan = false,
  anThayThe = false,
}: {
  onVuot: (h: Huong8) => void;
  /** Nhãn đọc được của ô, ví dụ "Vuốt lên để ra hiệu lệnh dừng xe". */
  nhan: string;
  /** Hình gợi ý trong ô. */
  goiY?: React.ReactNode;
  huongChinh: Huong8;
  nhanThayThe: string;
  khoa?: boolean;
  noiBat?: boolean;
  /** Không in `nhan` dưới hình gợi ý (hình gợi ý đã tự ghi chữ); `nhan` vẫn là tên đọc được của ô. */
  anNhan?: boolean;
  /** Bỏ nút thay thế: trò tự đặt nút cho từng hướng. */
  anThayThe?: boolean;
}) {
  const dau = useRef<{ x: number; y: number; id: number } | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={khoa}
        aria-label={`${nhan}. Có thể dùng phím mũi tên.`}
        data-noi-bat={noiBat || undefined}
        className={cn(
          "g-the grid min-h-32 touch-none select-none place-items-center rounded-2xl border-2 border-dashed p-4 text-center",
          khoa && "opacity-50",
        )}
        style={{ borderColor: noiBat ? "var(--primary)" : "var(--line-strong)" }}
        onPointerDown={(e) => {
          if (khoa) return;
          dau.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const d = dau.current;
          dau.current = null;
          if (!d || d.id !== e.pointerId || khoa) return;
          const h = huongTuDoDoi(e.clientX - d.x, e.clientY - d.y);
          if (h) onVuot(h);
        }}
        onPointerCancel={() => {
          dau.current = null;
        }}
        onKeyDown={(e) => {
          const h = PHIM[e.key];
          if (!h || khoa) return;
          e.preventDefault();
          onVuot(h);
        }}
      >
        <span className="block w-full">
          {goiY}
          {anNhan ? null : <span className="mt-1 block text-[15px] font-semibold">{nhan}</span>}
        </span>
      </button>
      {anThayThe ? null : (
        <button
          type="button"
          disabled={khoa}
          onClick={() => onVuot(huongChinh)}
          className="min-h-12 w-full rounded-xl text-sm text-ink-2 underline underline-offset-4"
        >
          {nhanThayThe}
        </button>
      )}
    </div>
  );
}
