import { useState } from "react";

import { cn } from "../../lib/cn";
import type { DeGhepCap } from "../../lib/tro-choi.server";

const NHAN_XE: Record<string, string> = { o_to: "Ô tô", mo_to: "Xe mô tô, xe gắn máy" };

/**
 * Bảng ghép cặp hành vi – mức phạt, chơi bằng chạm: chạm một hành vi rồi chạm một mức phạt để
 * ghép; chạm lại một cặp đã ghép để gỡ. Không cần kéo thả, dùng được bằng một tay và bằng bàn phím.
 * Cặp đã ghép cùng mang một số thứ tự ở hai cột để dễ dò.
 */
export function BangGhepCap({
  de,
  cap,
  onChange,
  khoa = false,
  dungSai,
}: {
  de: DeGhepCap;
  cap: Record<string, string>;
  onChange: (cap: Record<string, string>) => void;
  khoa?: boolean;
  /** Sau khi nộp: hành vi nào ghép đúng. */
  dungSai?: Record<string, boolean>;
}) {
  const [dangChon, datDangChon] = useState<string | null>(null);
  const soCua = new Map(de.trai.map((t, i) => [t.id, i + 1]));
  const traiCuaPhai = new Map(Object.entries(cap).map(([t, p]) => [p, t]));

  const chamTrai = (id: string) => {
    if (khoa) return;
    if (cap[id]) {
      const moi = { ...cap };
      delete moi[id];
      onChange(moi);
      datDangChon(id);
      return;
    }
    datDangChon(dangChon === id ? null : id);
  };

  const chamPhai = (id: string) => {
    if (khoa) return;
    const traiCu = traiCuaPhai.get(id);
    if (traiCu && !dangChon) {
      const moi = { ...cap };
      delete moi[traiCu];
      onChange(moi);
      return;
    }
    if (!dangChon) return;
    const moi = { ...cap };
    if (traiCu) delete moi[traiCu];
    moi[dangChon] = id;
    onChange(moi);
    datDangChon(null);
  };

  const oClass =
    "flex min-h-14 w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-[15px] leading-snug";

  return (
    <div>
      <p className="mb-3 text-sm text-ink-2">
        {khoa ? "Kết quả ghép." : "Chạm một hành vi, rồi chạm mức phạt tương ứng. Chạm lại một cặp để gỡ."}
      </p>
      <div className="grid gap-4">
        <section aria-label="Hành vi vi phạm">
          <h2 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-3">Hành vi</h2>
          <ul className="grid gap-2">
            {de.trai.map((t) => {
              const daGhep = Boolean(cap[t.id]);
              const ketQua = dungSai?.[t.id];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={dangChon === t.id}
                    disabled={khoa}
                    onClick={() => chamTrai(t.id)}
                    className={cn(
                      oClass,
                      "disabled:cursor-default",
                      ketQua === true
                        ? "border-ok bg-ok-soft"
                        : ketQua === false
                          ? "border-danger bg-danger-soft"
                          : dangChon === t.id
                            ? "border-primary bg-primary-soft ring-2 ring-primary"
                            : daGhep
                              ? "border-primary bg-surface"
                              : "border-line-strong bg-surface",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        daGhep ? "bg-primary text-on-primary" : "border border-line-strong",
                      )}
                    >
                      {daGhep ? soCua.get(t.id) : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      {t.text}
                      <span className="block text-xs text-ink-3">{NHAN_XE[t.loai_xe] ?? t.loai_xe}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-label="Mức phạt">
          <h2 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-3">
            Mức phạt
          </h2>
          <ul className="grid gap-2">
            {de.phai.map((p) => {
              const cuaTrai = traiCuaPhai.get(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={khoa || (!dangChon && !cuaTrai)}
                    onClick={() => chamPhai(p.id)}
                    aria-label={`${p.text}${cuaTrai ? `, đã ghép với hành vi số ${soCua.get(cuaTrai)}` : ""}`}
                    className={cn(
                      oClass,
                      "font-semibold disabled:cursor-default",
                      cuaTrai ? "border-primary bg-primary-soft" : "border-line-strong bg-surface",
                      dangChon && !khoa && !cuaTrai && "dong-bam",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                        cuaTrai ? "bg-primary text-on-primary" : "border border-line-strong",
                      )}
                    >
                      {cuaTrai ? soCua.get(cuaTrai) : ""}
                    </span>
                    <span className="min-w-0 flex-1">{p.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
