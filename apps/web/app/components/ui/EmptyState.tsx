import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon = "layers",
  title,
  children,
  gon = false,
  className,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  /** Bản gọn cho hộp thoại, mục nhỏ trong trang: ít khoảng trống hơn. */
  gon?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-line-strong text-center",
        gon ? "px-4 py-6" : "px-6 py-12",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink-3">
        <Icon name={icon} sac="trung" />
      </span>
      <p className={cn("max-w-full break-words font-semibold", gon ? "mt-3" : "mt-4")}>{title}</p>
      {children ? <div className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">{children}</div> : null}
    </div>
  );
}
