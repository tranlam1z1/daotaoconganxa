import type { ComponentProps } from "react";

import { cn } from "../../lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("ui-card min-w-0 rounded-card border border-line bg-surface p-5 shadow-card", className)}
      {...props}
    />
  );
}
