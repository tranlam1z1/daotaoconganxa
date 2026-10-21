/**
 * Cụm nút lái của trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9): nút to, bấm được bằng một tay ở màn
 * 360 px. Ga và phanh là nút GIỮ (Pointer Events, giữ con trỏ để trượt ngón không nhả nhầm); trái,
 * phải là nút CHẠM, nhãn đổi theo tình huống (rẽ ở nơi giao nhau tới, chuyển làn, quay đầu); hai nút
 * xi nhan bật/tắt. Bàn phím: ← →, ↑ giữ ga, ↓ giữ phanh, Q và E bật xi nhan (TuLai.tsx gắn phím).
 */
import type { PointerEvent, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type HuongLaiNut = "trai" | "phai";

function NutGiu({
  nhan,
  dang,
  onDoi,
  khoa,
  mau,
  children,
}: {
  nhan: string;
  dang: boolean;
  onDoi: (bat: boolean) => void;
  khoa: boolean;
  mau: "chinh" | "nguy";
  children: ReactNode;
}) {
  const bat = (e: PointerEvent<HTMLButtonElement>) => {
    if (khoa) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onDoi(true);
  };
  const nha = () => onDoi(false);
  return (
    <button
      type="button"
      aria-label={nhan}
      aria-pressed={dang}
      disabled={khoa}
      onPointerDown={bat}
      onPointerUp={nha}
      onPointerCancel={nha}
      onLostPointerCapture={nha}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "grid min-h-16 select-none place-items-center rounded-2xl border-2 text-base font-bold [touch-action:none]",
        dang ? "text-white" : "bg-surface",
      )}
      style={{
        borderColor: mau === "chinh" ? "var(--ok)" : "var(--danger)",
        background: dang ? (mau === "chinh" ? "var(--ok)" : "var(--danger)") : undefined,
        color: dang ? "var(--surface)" : mau === "chinh" ? "var(--ok)" : "var(--danger)",
      }}
    >
      {children}
    </button>
  );
}

function NutCham({
  nhan,
  onCham,
  khoa,
  dang,
  children,
}: {
  nhan: string;
  onCham: () => void;
  khoa: boolean;
  dang?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={nhan}
      aria-pressed={dang}
      disabled={khoa}
      onClick={onCham}
      className={cn(
        "grid min-h-14 select-none place-items-center rounded-2xl border-2 px-1 text-sm leading-tight font-semibold [touch-action:manipulation] disabled:opacity-40",
        dang ? "bg-primary-soft" : "bg-surface",
      )}
      style={{ borderColor: dang ? "var(--warn)" : "var(--line-strong)" }}
    >
      {children}
    </button>
  );
}

export function NutLai({
  ga,
  phanh,
  xiNhan,
  yDinh,
  nhanTrai,
  nhanPhai,
  khoa,
  onGa,
  onPhanh,
  onLai,
  onXiNhan,
}: {
  ga: boolean;
  phanh: boolean;
  xiNhan: HuongLaiNut | null;
  yDinh: HuongLaiNut | null;
  nhanTrai: string;
  nhanPhai: string;
  khoa: boolean;
  onGa: (bat: boolean) => void;
  onPhanh: (bat: boolean) => void;
  onLai: (h: HuongLaiNut) => void;
  onXiNhan: (h: HuongLaiNut | null) => void;
}) {
  return (
    <fieldset className="grid min-w-0 grid-cols-3 gap-2">
      <legend className="sr-only">Nút lái</legend>
      <NutCham
        nhan={`Xi nhan trái${xiNhan === "trai" ? ", đang bật" : ""}`}
        dang={xiNhan === "trai"}
        khoa={khoa}
        onCham={() => onXiNhan(xiNhan === "trai" ? null : "trai")}
      >
        <span aria-hidden>⇦ Xi nhan</span>
      </NutCham>
      <NutGiu nhan="Phanh (giữ)" dang={phanh} onDoi={onPhanh} khoa={khoa} mau="nguy">
        Phanh
      </NutGiu>
      <NutCham
        nhan={`Xi nhan phải${xiNhan === "phai" ? ", đang bật" : ""}`}
        dang={xiNhan === "phai"}
        khoa={khoa}
        onCham={() => onXiNhan(xiNhan === "phai" ? null : "phai")}
      >
        <span aria-hidden>Xi nhan ⇨</span>
      </NutCham>
      <NutCham nhan={nhanTrai} dang={yDinh === "trai"} khoa={khoa} onCham={() => onLai("trai")}>
        <span>◀ {nhanTrai}</span>
      </NutCham>
      <NutGiu nhan="Ga (giữ)" dang={ga} onDoi={onGa} khoa={khoa} mau="chinh">
        Ga
      </NutGiu>
      <NutCham nhan={nhanPhai} dang={yDinh === "phai"} khoa={khoa} onCham={() => onLai("phai")}>
        <span>{nhanPhai} ▶</span>
      </NutCham>
    </fieldset>
  );
}
