import type { ReactNode } from "react";
import { TieuDeTrang } from "./KhungTrang";

/** Đầu trang nội dung: nhãn nhóm, tiêu đề, mô tả và vùng nút thao tác. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">{eyebrow}</p>
        ) : null}
        <TieuDeTrang>{title}</TieuDeTrang>
        {description ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
