import { cn } from "../../lib/cn";
import type { TongQuanDiem } from "../../lib/diem-thuong";
import { formatNgayGio } from "../../lib/format";
import { Icon } from "../ui/Icon";

/**
 * Lưới huy hiệu (docs/PLAN.md GĐ9): huy hiệu đã đạt có màu và ngày đạt; chưa đạt thì nhạt, có ổ
 * khóa và điều kiện đạt (mô tả của huy hiệu).
 */
export function HuyHieu({ ds }: { ds: TongQuanDiem["huy_hieu"] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
      {ds.map((h) => {
        const dat = Boolean(h.dat_luc);
        return (
          <li
            key={h.code}
            className={cn(
              "flex flex-col rounded-card border p-4",
              dat ? "border-primary/40 bg-primary-soft" : "border-line bg-surface",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative grid size-10 place-items-center rounded-full",
                dat ? "bg-primary text-on-primary" : "bg-surface-2 text-ink-3",
              )}
            >
              <Icon
                name="trophy"
                kieu={dat ? "net" : "hai-lop"}
                className={cn("size-5", !dat && "opacity-50")}
              />
              {!dat ? (
                <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border border-line bg-surface text-ink-2">
                  <Icon name="lock" className="size-3" />
                </span>
              ) : null}
            </span>
            <p className={cn("mt-3 font-semibold leading-snug", !dat && "text-ink-2")}>{h.name}</p>
            <p className="mt-1 flex-1 text-sm leading-snug text-ink-2">{h.description}</p>
            <p className={cn("mt-2 text-sm font-medium", dat ? "text-primary" : "text-ink-2")}>
              {dat ? `Đạt ngày ${formatNgayGio(h.dat_luc).slice(0, 10)}` : "Chưa đạt"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
