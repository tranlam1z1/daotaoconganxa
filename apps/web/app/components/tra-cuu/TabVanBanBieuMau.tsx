import { Link } from "react-router";

import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../ui/Icon";

const TAB: Array<{ value: "van-ban" | "bieu-mau"; to: string; label: string; icon: IconName }> = [
  { value: "van-ban", to: "/tim-kiem", label: "Tra cứu văn bản", icon: "search" },
  { value: "bieu-mau", to: "/tra-cuu-nhanh/quy-trinh", label: "Quy trình, Biểu mẫu", icon: "file" },
];

/** Hai tab đầu trang nối trang Tra cứu văn bản (/tim-kiem) với trang Quy trình, Biểu mẫu. */
export function TabVanBanBieuMau({ chon }: { chon: "van-ban" | "bieu-mau" }) {
  return (
    <nav aria-label="Loại tra cứu" className="rounded-2xl border border-line bg-surface p-1 shadow-card">
      {/* Hai nhãn dài không đều: chia chỗ theo độ dài chữ; màn hình dưới 380px bỏ biểu tượng cho đủ chữ. */}
      <ul className="flex gap-1">
        {TAB.map((t) => (
          <li key={t.value} className="flex-auto">
            <Link
              to={t.to}
              aria-current={t.value === chon ? "page" : undefined}
              className={cn(
                "lun flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold whitespace-nowrap min-[380px]:text-[15px] sm:gap-2 sm:text-base",
                t.value === chon ? "bg-primary text-on-primary shadow-card" : "text-ink-2 hover:text-ink",
              )}
            >
              <Icon name={t.icon} kieu="net" className="hidden size-5 min-[380px]:block sm:size-6" />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
