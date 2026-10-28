import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";

/** Giữ độ rộng và khoảng cách riêng của trang, dùng chung bề mặt nội dung. */
export function KhungTrang({
  className = "",
  variant = "panel",
  children,
  ...props
}: ComponentProps<"div"> & { variant?: "panel" | "auth" | "reader" | "workspace" }) {
  const classes = className.split(/\s+/);
  const outside = classes.filter((c) => c === "wrap" || /(^|:)max-w-/.test(c));
  const inside = classes.filter((c) => !outside.includes(c) && !/(^|:)(py|pt)-/.test(c));
  return (
    <div className={cn("wrap py-4 sm:py-6", ...outside)}>
      <div
        {...props}
        className={cn(
          "khung-trang min-w-0",
          variant !== "auth" && "rounded-card border border-line bg-surface p-4 shadow-card sm:p-6",
          variant === "reader" && "sm:p-8",
          variant === "workspace" && "pb-28",
          ...inside,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DauTrangAnh({
  icon,
  tieuDe,
  children,
}: {
  icon: IconName;
  tieuDe: string;
  children: ReactNode;
}) {
  return (
    <header className="tieu-de-trang tieu-de-trang-banner relative isolate flex min-w-0 items-center gap-3">
      <span
        className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-secondary-soft text-secondary"
        aria-hidden="true"
      >
        <Icon name={icon} kieu="net" className="size-6" />
      </span>
      <div className="min-w-0 flex-1 sm:max-w-[60%]">
        <h1 className="text-2xl font-bold leading-tight">{tieuDe}</h1>
        <p className="mt-1 text-sm text-ink-2">{children}</p>
      </div>
    </header>
  );
}

/** Tiêu đề giữ nguyên id để các liên kết và aria-labelledby tiếp tục hoạt động. */
export function TieuDeTrang({
  as: Heading = "h1",
  icon = "layers",
  variant = "plain",
  className,
  children,
  ...props
}: ComponentProps<"h1"> & { as?: "h1" | "h2"; icon?: IconName; variant?: "plain" | "banner" | "status" }) {
  return (
    <div
      className={cn(
        "tieu-de-trang relative isolate flex min-w-0 gap-3",
        variant === "banner" && "tieu-de-trang-banner min-h-24 items-center",
        variant === "plain" && "items-start py-2",
        variant === "status" && "items-center justify-center text-center",
      )}
    >
      {variant !== "status" ? (
        <span
          className={cn(
            "relative grid shrink-0 place-items-center rounded-xl bg-secondary-soft text-secondary",
            variant === "banner" ? "size-12" : "size-10",
          )}
          aria-hidden="true"
        >
          <Icon name={icon} kieu="net" className="size-6" />
        </span>
      ) : null}
      <Heading
        {...props}
        className={cn("relative min-w-0 break-words text-page font-bold leading-tight", className)}
      >
        {children}
      </Heading>
    </div>
  );
}
