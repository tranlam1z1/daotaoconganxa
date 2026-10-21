import { Link } from "react-router";

import { Icon, type IconName } from "../ui/Icon";

/**
 * Khung lối tắt (Bộ công cụ nghiệp vụ, Nghiệp vụ nhanh) ở trang chủ và trang /cong-cu: tiêu đề có
 * biểu tượng, liên kết "Xem tất cả" tùy chọn, lưới hai cột; mỗi ô là biểu tượng tròn bên trái, tên
 * bên phải.
 */
export function LuoiLoiTat({
  id,
  tieuDe,
  icon,
  items,
  xemTatCa,
}: {
  id: string;
  tieuDe: string;
  icon: IconName;
  items: ReadonlyArray<{ to: string; ten: string; icon: IconName }>;
  xemTatCa?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-lg font-semibold text-primary">
          <Icon name={icon} kieu="net" className="size-6" />
          {tieuDe}
        </h2>
        {xemTatCa ? (
          <Link
            to={xemTatCa}
            className="group lun -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Xem tất cả
            <Icon
              name="chevronRight"
              kieu="net"
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        ) : null}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {items.map((o) => (
          <li key={o.to}>
            <Link
              to={o.to}
              className="flex h-full min-h-16 items-center gap-2.5 rounded-2xl border border-line bg-surface px-2.5 py-2 the-bam"
            >
              <span className="hinh-noi grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft">
                <Icon name={o.icon} className="size-6" />
              </span>
              <span className="min-w-0 text-sm leading-snug font-semibold">{o.ten}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
