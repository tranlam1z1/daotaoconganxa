import type { ComponentProps } from "react";
import { Link } from "react-router";

import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";
type Size = "lg" | "md" | "sm";

interface ButtonStyle {
  variant?: Variant;
  size?: Size;
  className?: string;
  /** Biểu tượng đặt trước chữ (mặc định lấy màu chữ của nút). */
  icon?: IconName;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary:
    "border border-line-strong bg-surface text-secondary hover:border-secondary hover:bg-secondary-soft",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
};

// Chiều cao tối thiểu 44px cho vùng chạm trên điện thoại (WCAG 2.5.5).
const SIZE: Record<Size, string> = {
  // Nút hành động chính của trang.
  lg: "min-h-12 px-5 text-base",
  md: "min-h-11 px-4 text-sm",
  // Dưới 768px vùng chạm tối thiểu 44px, chữ 14px.
  sm: "min-h-11 px-3 text-sm md:min-h-9 md:text-[13px]",
};

export function buttonClass({ variant = "primary", size = "md", className }: ButtonStyle = {}): string {
  return cn(
    "max-w-full inline-flex items-center justify-center gap-2 rounded-btn font-semibold lun disabled:opacity-50",
    // cn chỉ nối lớp: để cả nowrap lẫn whitespace-normal thì nowrap thắng theo thứ tự CSS, nhãn dài tràn khung.
    !className?.includes("whitespace-normal") && "whitespace-nowrap",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

/** Biểu tượng đặt trước chữ nút; dùng chung kích thước cho mọi cỡ nút. */
function BieuTuongNut({ name }: { name: IconName }) {
  return <Icon name={name} kieu="net" className="size-5 shrink-0" />;
}

export function Button({
  variant,
  size,
  className,
  icon,
  type = "button",
  children,
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...props}>
      {icon ? <BieuTuongNut name={icon} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  icon,
  children,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props}>
      {icon ? <BieuTuongNut name={icon} /> : null}
      {children}
    </Link>
  );
}
