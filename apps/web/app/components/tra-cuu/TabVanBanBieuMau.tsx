import { Link, useSearchParams } from "react-router";
import { cn } from "../../lib/cn";
export function TabVanBanBieuMau({ chon }: { chon: "van-ban" | "bieu-mau" }) {
  const [p] = useSearchParams();
  const q = p.get("q");
  const family = p.get("family");
  const loai = p.get("loai");
  const items = [
    { id: "all", path: "/tim-kiem", label: "Tất cả văn bản" },
    { id: "phap_luat", path: "/tim-kiem?family=phap_luat", label: "Pháp luật" },
    { id: "dang", path: "/tim-kiem?family=dang", label: "Văn bản Đảng" },
    { id: "quy_trinh", path: "/tra-cuu-nhanh/quy-trinh?loai=quy_trinh", label: "Quy trình" },
    { id: "bieu_mau", path: "/tra-cuu-nhanh/quy-trinh?loai=bieu_mau", label: "Biểu mẫu" },
  ];
  const active = chon === "van-ban" ? family || "all" : loai || "";
  return (
    <nav aria-label="Loại tra cứu" className="rounded-xl border border-line bg-surface p-1">
      <ul className="flex flex-wrap gap-1">
        {items.map((t) => {
          const url = new URL(t.path, "http://local");
          if (q) url.searchParams.set("q", q);
          return (
            <li key={t.id} className="min-w-0 flex-auto">
              <Link
                to={url.pathname + url.search}
                aria-current={active === t.id ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold",
                  active === t.id ? "bg-primary text-on-primary" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
