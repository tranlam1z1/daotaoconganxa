import { Link } from "react-router";

import { Icon, type IconName, sacCua } from "../ui/Icon";

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
  items: ReadonlyArray<{ to: string; ten: string; icon: IconName; moTa?: string }>;
  xemTatCa?: string;
}) {
  return (
    // Hướng "Công văn": mục không đóng khung; tiêu đề viết hoa, kẻ mực đậm bên dưới.
    <section aria-labelledby={id}>
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink pb-2">
        <h2
          id={id}
          className="flex items-center gap-2 text-base font-bold uppercase tracking-[0.04em] text-ink"
        >
          <Icon name={icon} kieu="net" className="size-6 text-primary" />
          {tieuDe}
        </h2>
        {xemTatCa ? (
          <Link
            to={xemTatCa}
            className="group lun -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
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
          <li key={o.to} className="min-w-0">
            <Link
              to={o.to}
              className="group flex h-full min-h-20 items-center gap-2 rounded-card border border-line bg-surface px-2 py-3 hover:border-primary sm:gap-3 sm:px-3 the-bam"
            >
              <span
                data-sac={sacCua(o.icon)}
                className="shortcut-icon hinh-noi grid size-11 shrink-0 place-items-center rounded-card"
              >
                <Icon name={o.icon} className="size-7" />
              </span>
              <span className="min-w-0 text-sm leading-snug">
                <span className="block font-semibold">{o.ten}</span>
                {o.moTa ? (
                  <span className="resource-description mt-1 block text-xs font-normal text-ink-2">
                    {o.moTa}
                  </span>
                ) : null}
              </span>
              {o.moTa ? <Icon name="chevronRight" kieu="net" className="ml-auto size-4 shrink-0" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
