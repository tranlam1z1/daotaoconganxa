import type { ComponentProps } from "react";

import { cn } from "../../lib/cn";

export const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-secondary focus-visible:outline-2 focus-visible:outline-secondary focus-visible:outline-offset-2 aria-invalid:border-danger disabled:bg-surface-2";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor do nơi gọi truyền vào qua props
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink-2", className)} {...props} />;
}

/** Hộp thông báo ngay trong trang (lỗi biểu mẫu, lưu ý). */
export function Notice({
  tone = "info",
  className,
  ...props
}: ComponentProps<"div"> & { tone?: "info" | "danger" }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed",
        tone === "danger" ? "border-danger bg-danger-soft text-danger" : "border-info bg-info-soft text-info",
        className,
      )}
      {...props}
    />
  );
}
