import { type ReactNode, useEffect, useState } from "react";

import { cn } from "../../lib/cn";
import { applyTheme, readTheme, type ThemeChoice } from "../../lib/theme";
import { Icon, type IconName } from "../ui/Icon";

const NEXT: Record<ThemeChoice, ThemeChoice> = { sang: "toi", toi: "sang" };
const META: Record<ThemeChoice, { icon: IconName; label: string }> = {
  sang: { icon: "sun", label: "Giao diện sáng" },
  toi: { icon: "moon", label: "Giao diện tối" },
};

/**
 * Nút chuyển qua lại giữa sáng và tối. Có `children` thì nút thành cả một hàng (biểu tượng + chữ),
 * bấm vào chữ cũng đổi được; không có thì chỉ là ô biểu tượng.
 */
export function ThemeToggle({ children }: { children?: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>("sang");

  useEffect(() => setChoice(readTheme()), []);

  const { icon, label } = META[choice];
  const coChu = children != null;
  return (
    <button
      type="button"
      onClick={() => {
        const next = NEXT[choice];
        setChoice(next);
        applyTheme(next);
      }}
      title={`${label}. Bấm để đổi.`}
      aria-label={coChu ? undefined : `${label}. Bấm để đổi.`}
      className={cn(
        "lun rounded-btn hover:bg-surface-2",
        coChu
          ? "flex min-h-12 w-full items-center gap-3 px-3 text-left text-base text-ink"
          : "grid size-11 shrink-0 place-items-center text-ink-2 hover:text-ink",
      )}
    >
      <Icon name={icon} className={cn("size-6", coChu && "shrink-0 text-ink-2")} />
      {children}
    </button>
  );
}
