/**
 * Giữ nút có thanh tiến độ (mô-đun M2, phần giữ; docs/GAME_DESIGN.md §4, PLAN GĐ-T4).
 *
 * Giữ bằng ngón tay (Pointer Events) hoặc giữ phím Space / Enter. Thanh tiến độ chạy bằng
 * `transform: scaleX` (VISUAL_STYLE §6.2); giảm chuyển động thì vẫn có thanh và số phần trăm, vì đây
 * là thông tin chứ không phải trang trí. Nút chỉ báo lúc bắt đầu và lúc thả; trò tự tính đủ giờ hay
 * chưa (máy chủ chấm lại từ mốc thời gian).
 */
import { useEffect, useRef, useState } from "react";

import { cn } from "../../../../lib/cn";

export function Giu({
  giuMs,
  onBatDau,
  onTha,
  nhan,
  khoa = false,
  noiBat = false,
}: {
  giuMs: number;
  onBatDau: () => void;
  onTha: () => void;
  nhan: string;
  khoa?: boolean;
  noiBat?: boolean;
}) {
  const [dangGiu, datDangGiu] = useState(false);
  const [tiLe, datTiLe] = useState(0);
  const tu = useRef(0);
  const khung = useRef(0);

  useEffect(() => {
    if (!dangGiu) return;
    const chay = () => {
      datTiLe(Math.min(1, (performance.now() - tu.current) / giuMs));
      khung.current = requestAnimationFrame(chay);
    };
    khung.current = requestAnimationFrame(chay);
    return () => cancelAnimationFrame(khung.current);
  }, [dangGiu, giuMs]);

  const batDau = () => {
    if (khoa || dangGiu) return;
    tu.current = performance.now();
    datTiLe(0);
    datDangGiu(true);
    onBatDau();
  };
  const tha = () => {
    if (!dangGiu) return;
    datDangGiu(false);
    onTha();
  };

  return (
    <button
      type="button"
      disabled={khoa}
      aria-pressed={dangGiu}
      aria-label={`${nhan}. Giữ ${Math.round(giuMs / 1000)} giây; có thể giữ phím cách.`}
      className={cn(
        "g-nut relative min-h-16 w-full touch-none select-none overflow-hidden rounded-2xl border-2 text-lg font-bold",
      )}
      style={{ borderColor: noiBat ? "var(--primary)" : "var(--line-strong)", background: "var(--surface)" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        batDau();
      }}
      onPointerUp={tha}
      onPointerCancel={tha}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          batDau();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") tha();
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-full origin-left"
        style={{ background: "var(--primary-soft)", transform: `scaleX(${dangGiu ? tiLe : 0})` }}
      />
      <span className="relative">{dangGiu ? `Đang đo… ${Math.round(tiLe * 100)}%` : nhan}</span>
    </button>
  );
}
