/**
 * Ô "Tra cứu vi phạm" ở trang chủ: chọn loại xe (chip), gõ hoặc nói hành vi, rồi Enter hoặc bấm
 * kính lúp để mở tab Tra cứu hành vi (`/tra-cuu?tab=hanh-vi&xe=…&q=…`). Chip loại xe là nút radio
 * nên chạy được cả khi chưa tải JavaScript; không chọn xe nào thì tra mọi loại xe. Nút "…" mở
 * thẳng tab hành vi (lưới chủ đề). Nói xong thì chữ được điền vào ô để người dùng xem lại rồi tự gửi.
 */
import { useRef } from "react";
import { Form, Link } from "react-router";

import { cn } from "../../lib/cn";
import { useNhanDangGiong } from "../giong-noi/useNhanDangGiong";
import { Icon, type IconName } from "../ui/Icon";

const CHIP_XE: Array<{ value: string; label: string; icon: IconName }> = [
  { value: "mo_to", label: "Xe máy", icon: "moto" },
  { value: "o_to", label: "Xe ô tô", icon: "car" },
];

export function OTraCuuViPham() {
  const inputRef = useRef<HTMLInputElement>(null);
  const g = useNhanDangGiong((text) => {
    if (!inputRef.current) return;
    inputRef.current.value = text;
    inputRef.current.focus();
  });

  return (
    <section
      aria-labelledby="tra-vi-pham-tieu-de"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <h2 id="tra-vi-pham-tieu-de" className="flex items-center gap-2 text-lg font-semibold text-primary">
        <Icon name="search" kieu="net" className="size-6" />
        Tra cứu vi phạm
      </h2>

      <Form method="get" action="/tra-cuu" role="search" className="mt-3">
        <input type="hidden" name="tab" value="hanh-vi" />
        <fieldset>
          <legend className="sr-only">Loại xe</legend>
          <div className="flex flex-wrap gap-2">
            {CHIP_XE.map((c) => (
              <label key={c.value} className="shrink-0">
                <input type="radio" name="xe" value={c.value} className="peer sr-only" />
                <span className="lun inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-line-strong bg-surface px-4 text-base text-ink-2 peer-checked:border-2 peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:font-semibold peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
                  <Icon name={c.icon} kieu="net" className="size-5" />
                  {c.label}
                </span>
              </label>
            ))}
            <Link
              to="/tra-cuu?tab=hanh-vi"
              aria-label="Tra cứu theo chủ đề"
              className="lun inline-flex min-h-11 shrink-0 items-center rounded-2xl border border-line-strong bg-surface px-4 text-ink-2 dong-bam"
            >
              <span aria-hidden="true" className="text-xl leading-none font-bold tracking-widest">
                •••
              </span>
            </Link>
          </div>
        </fieldset>

        <label htmlFor="o-tim-vi-pham" className="sr-only">
          Hành vi vi phạm
        </label>
        <div className="relative mt-3">
          <button
            type="submit"
            aria-label="Tra cứu"
            className="lun absolute inset-y-1.5 left-1.5 grid w-11 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
          >
            <Icon name="search" sac="trung" className="size-6" />
          </button>
          <input
            ref={inputRef}
            id="o-tim-vi-pham"
            name="q"
            type="search"
            placeholder="Tra cứu từ khóa vi phạm"
            autoComplete="off"
            enterKeyHint="search"
            className={cn(
              "min-h-14 w-full rounded-2xl border border-line-strong bg-surface pl-14 text-base text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none",
              g.hoTro ? "pr-14" : "pr-4",
            )}
          />
          {g.hoTro ? (
            <button
              type="button"
              aria-pressed={g.dangNghe}
              aria-label={g.dangNghe ? "Đang nghe, bấm để dừng" : "Tìm bằng giọng nói"}
              onClick={g.dangNghe ? g.dung : g.batDau}
              className={cn(
                "lun absolute inset-y-1.5 right-1.5 grid w-11 place-items-center rounded-xl",
                g.dangNghe
                  ? "bg-danger-soft text-danger motion-safe:animate-pulse"
                  : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <Icon name="mic" sac="trung" className="size-6" />
            </button>
          ) : null}
        </div>
      </Form>
      <p aria-live="polite" className="mt-1 text-sm text-ink-2 empty:hidden">
        {g.loi ? <span className="text-danger">{g.loi}</span> : g.tamThoi ? `Đang nghe: ${g.tamThoi}` : null}
      </p>
    </section>
  );
}
