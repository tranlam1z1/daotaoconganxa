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
      className="tra-vi-pham-trang-chu relative overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card sm:px-5 sm:py-3"
    >
      <div className="relative flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon name="search" kieu="net" className="size-6" />
        </span>
        <div>
          <h2 id="tra-vi-pham-tieu-de" className="text-lg font-semibold">
            Tra cứu vi phạm
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">Tra cứu mức xử phạt theo hành vi và loại phương tiện.</p>
        </div>
      </div>

      <Form method="get" action="/tra-cuu" role="search" className="relative mt-3">
        <input type="hidden" name="tab" value="hanh-vi" />
        <fieldset>
          <legend className="sr-only">Loại xe</legend>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {CHIP_XE.map((c) => (
              <label key={c.value} className="min-w-0 sm:shrink-0">
                <input
                  type="radio"
                  name="xe"
                  value={c.value}
                  defaultChecked={c.value === "mo_to"}
                  className="peer sr-only"
                />
                <span className="lun flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent bg-surface-2 px-1.5 text-sm text-ink-2 peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary sm:px-4">
                  <Icon name={c.icon} kieu="net" className="size-4 shrink-0 sm:size-5" />
                  {c.label}
                </span>
              </label>
            ))}
            <Link
              to="/tra-cuu?tab=hanh-vi"
              aria-label="Tra cứu theo chủ đề"
              className="lun inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-surface-2 px-1.5 text-sm text-ink-2 dong-bam sm:shrink-0 sm:px-4"
            >
              <span aria-hidden="true" className="text-xl leading-none font-bold tracking-widest">
                •••
              </span>
              Khác
            </Link>
          </div>
        </fieldset>

        <label htmlFor="o-tim-vi-pham" className="sr-only">
          Hành vi vi phạm
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-0 sm:rounded-lg sm:border sm:border-line-strong sm:bg-surface sm:focus-within:border-primary">
          <div className="relative flex min-w-0 flex-1 items-center rounded-lg border border-line-strong bg-surface focus-within:border-primary sm:rounded-r-none sm:border-0 sm:bg-transparent">
            <Icon
              name="search"
              sac="trung"
              className="pointer-events-none absolute left-4 top-3.5 size-5 text-ink-2"
            />
            <input
              ref={inputRef}
              id="o-tim-vi-pham"
              name="q"
              type="search"
              placeholder="Tra cứu từ khóa vi phạm"
              autoComplete="off"
              enterKeyHint="search"
              className={cn(
                "min-h-12 w-full min-w-0 rounded-lg bg-transparent pl-11 pr-3 text-base text-ink placeholder:text-ink-3 focus:outline-none sm:rounded-r-none sm:text-sm",
              )}
            />
            {g.hoTro ? (
              <button
                type="button"
                aria-pressed={g.dangNghe}
                aria-label={g.dangNghe ? "Đang nghe, bấm để dừng" : "Tìm bằng giọng nói"}
                onClick={g.dangNghe ? g.dung : g.batDau}
                className={cn(
                  "lun mr-1 grid size-11 shrink-0 place-items-center rounded-lg",
                  g.dangNghe
                    ? "bg-danger-soft text-danger motion-safe:animate-pulse"
                    : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <Icon name="mic" sac="trung" className="size-6" />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="lun flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white sm:rounded-l-none sm:px-6"
          >
            <Icon name="search" kieu="net" className="size-5" />
            Tra cứu
          </button>
        </div>
      </Form>
      <p aria-live="polite" className="mt-1 text-sm text-ink-2 empty:hidden">
        {g.loi ? <span className="text-danger">{g.loi}</span> : g.tamThoi ? `Đang nghe: ${g.tamThoi}` : null}
      </p>
    </section>
  );
}
