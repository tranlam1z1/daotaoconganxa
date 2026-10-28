import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Khung nội dung chung cho tra cứu, luyện tập và thi; co giãn theo màn hình. */
export function KhungNoiDung({
  title,
  description,
  children,
  icon = "search",
}: {
  title: string;
  description: string;
  children: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="wrap max-w-5xl py-4 sm:py-6">
      <div className="trang-tra-cuu relative min-w-0 overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <header className="tra-cuu-tieu-de relative mb-6 flex min-h-20 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary-soft text-secondary">
            <Icon name={icon} kieu="net" className="size-6" />
          </span>
          <div className="min-w-0 flex-1 sm:max-w-[60%]">
            <h1 className="text-page font-bold leading-tight">{title}</h1>
            <p className="mt-1 text-sm text-ink-2">{description}</p>
          </div>
        </header>
        <div className="tra-cuu-noi-dung relative min-w-0">{children}</div>
      </div>
    </div>
  );
}
