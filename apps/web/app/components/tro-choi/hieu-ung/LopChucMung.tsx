/**
 * Lớp chúc mừng sau lượt (docs/VISUAL_STYLE.md §3.2, hiệu ứng 5 và 6): lên cấp (huy hiệu cấp phóng
 * to, vòng sáng xoay một vòng, số cấp chạy, pháo hoa nhẹ) và huy hiệu mới (lật từ mặt sau, ánh sáng
 * quét qua). Không chặn thao tác: nút "Tiếp tục" đóng ngay.
 */
import { useEffect } from "react";

import { phatAm } from "./am-thanh";
import { PhaoHoa } from "./PhaoHoa";
import { rung } from "./rung";
import { SoChay } from "./SoChay";

export function HuyHieuLat({ ten, moTa, tre = 0 }: { ten: string; moTa?: string; tre?: number }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span
        className="g-a g-lat relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full"
        style={
          {
            background: "var(--g-nhan)",
            color: "var(--g-tren-nhan)",
            "--tre": `${tre}ms`,
          } as React.CSSProperties
        }
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7">
          <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" fill="currentColor" />
          <path
            d="m8.5 12 2.5 2.5 4.5-5"
            fill="none"
            stroke="var(--g-nhan)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span
          aria-hidden="true"
          className="g-t g-quet pointer-events-none absolute inset-y-0 left-0 w-1/3"
          style={{ background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.7), transparent)" }}
        />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{ten}</span>
        {moTa ? <span className="block text-sm text-ink-2">{moTa}</span> : null}
      </span>
    </div>
  );
}

export function LopChucMung({
  lenCap,
  huyHieu,
  dong,
}: {
  lenCap: { cap: number } | null;
  huyHieu: Array<{ code: string; name: string; description: string }>;
  dong: () => void;
}) {
  useEffect(() => {
    if (lenCap) {
      phatAm("len_cap");
      rung("len_cap");
    } else if (huyHieu.length) phatAm("hoan_thanh");
  }, [lenCap, huyHieu.length]);

  useEffect(() => {
    const phim = (e: KeyboardEvent) => e.key === "Escape" && dong();
    window.addEventListener("keydown", phim);
    return () => window.removeEventListener("keydown", phim);
  }, [dong]);

  return (
    // Hộp giữa màn hình (theo .hop-thoai trong app.css): chạm ra nền mờ hoặc Esc để đóng; nhiều huy
    // hiệu thì phần giữa cuộn bên trong, nút "Tiếp tục" luôn hiện.
    // biome-ignore lint/a11y/useKeyWithClickEvents: bàn phím đóng bằng Esc và nút "Tiếp tục"
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chuc-mung-tieu-de"
      className="nen-hien-dan fixed inset-0 z-40 grid place-items-center p-4"
      style={{ background: "rgb(0 0 0 / 0.45)" }}
      onClick={(e) => e.target === e.currentTarget && dong()}
    >
      {lenCap ? <PhaoHoa /> : null}
      <div className="g-a hop-vao g-the flex max-h-[85dvh] w-full max-w-sm flex-col text-center">
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pt-6">
          {lenCap ? (
            <>
              <div className="relative mx-auto grid size-28 place-items-center">
                <span
                  aria-hidden="true"
                  className="g-t g-xoay absolute inset-0 rounded-full"
                  style={{
                    background: "conic-gradient(from 0deg, var(--g-nhan), transparent 60%, var(--g-nhan))",
                    opacity: 0.55,
                  }}
                />
                <span
                  className="relative grid size-24 place-items-center rounded-full"
                  style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                >
                  <span className="text-xs font-semibold uppercase">Cấp</span>
                  <SoChay
                    den={lenCap.cap}
                    tu={Math.max(0, lenCap.cap - 1)}
                    ms={600}
                    treMs={200}
                    className="-mt-3 text-4xl font-bold"
                  />
                </span>
              </div>
              <h2 id="chuc-mung-tieu-de" className="g-tieu-de mt-4 text-2xl font-semibold">
                Lên cấp {lenCap.cap}
              </h2>
            </>
          ) : (
            <h2 id="chuc-mung-tieu-de" className="g-tieu-de text-2xl font-semibold">
              Huy hiệu mới
            </h2>
          )}
          {huyHieu.length ? (
            <div className="mt-5 grid gap-3">
              {lenCap ? <p className="text-sm font-semibold text-ink-2">Huy hiệu mới</p> : null}
              {huyHieu.map((h, i) => (
                <HuyHieuLat key={h.code} ten={h.name} moTa={h.description} tre={300 + i * 200} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 p-6 pt-5">
          <button
            type="button"
            onClick={dong}
            className="g-nut inline-flex w-full items-center justify-center bg-primary px-5 text-on-primary"
          >
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
