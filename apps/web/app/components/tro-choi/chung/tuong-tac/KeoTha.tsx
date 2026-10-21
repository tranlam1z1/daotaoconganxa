/**
 * Kéo thả vào ô (mô-đun M2, phần kéo thả; docs/GAME_DESIGN.md §4). Tạo sớm ở GĐ-T4 vì trò Dừng xe cần
 * (kế hoạch ghi ở GĐ-T3); GĐ-T3 dùng lại và mở rộng.
 *
 * Ba cách làm cùng một việc:
 *  - kéo: nhấn giữ vật, kéo tới ô, nhấc tay (Pointer Events; vật đi theo ngón tay bằng transform);
 *  - chạm-chạm: chạm vật (vật được chọn), rồi chạm ô;
 *  - bàn phím: vật và ô đều là nút, Tab tới vật, Enter, Tab tới ô, Enter.
 * Ô nhận biết bằng thuộc tính `data-vung-tha` để tìm dưới điểm nhấc tay.
 */
import { useRef, useState } from "react";

import { cn } from "../../../../lib/cn";

export function useKeoTha(onTha: (vat: string, vung: string) => void) {
  const [chon, datChon] = useState<string | null>(null);
  const [keo, datKeo] = useState<{ vat: string; dx: number; dy: number } | null>(null);
  const dau = useRef<{ vat: string; x: number; y: number; da: boolean } | null>(null);

  const tha = (vat: string, vung: string) => {
    datChon(null);
    onTha(vat, vung);
  };

  const vat = (ma: string, khoa = false) => ({
    type: "button" as const,
    disabled: khoa,
    "aria-pressed": chon === ma,
    "data-dang-keo": keo?.vat === ma || undefined,
    style:
      keo?.vat === ma
        ? { transform: `translate(${keo.dx}px, ${keo.dy}px)`, zIndex: 20, position: "relative" as const }
        : undefined,
    className: "touch-none select-none",
    onClick: () => {
      if (dau.current?.da) return;
      datChon((c) => (c === ma ? null : ma));
    },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (khoa) return;
      dau.current = { vat: ma, x: e.clientX, y: e.clientY, da: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = dau.current;
      if (!d || d.vat !== ma) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.da && Math.hypot(dx, dy) < 8) return;
      d.da = true;
      datKeo({ vat: ma, dx, dy });
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const d = dau.current;
      datKeo(null);
      if (!d?.da) {
        dau.current = null;
        return;
      }
      // Giữ cờ `da` tới sau sự kiện click để click không chọn lại vật.
      setTimeout(() => {
        dau.current = null;
      }, 0);
      const duoi = document
        .elementsFromPoint(e.clientX, e.clientY)
        .find((el) => el instanceof HTMLElement && el.dataset.vungTha);
      const vung = (duoi as HTMLElement | undefined)?.dataset.vungTha;
      if (vung) tha(ma, vung);
    },
    onPointerCancel: () => {
      dau.current = null;
      datKeo(null);
    },
  });

  const vung = (ma: string, khoa = false) => ({
    type: "button" as const,
    disabled: khoa,
    "data-vung-tha": ma,
    "data-san-sang": (chon !== null || keo !== null) && !khoa ? true : undefined,
    onClick: () => {
      if (chon) tha(chon, ma);
    },
  });

  return { vat, vung, chon, dangKeo: keo?.vat ?? null };
}

/** Khung ô thả: viền đứt nét, sáng lên khi đang có vật được chọn hoặc đang kéo. */
export function lopVungTha(sanSang: boolean) {
  return cn(
    "min-h-14 rounded-2xl border-2 border-dashed p-2 text-[15px] font-semibold",
    sanSang && "ring-2 ring-offset-1",
  );
}
