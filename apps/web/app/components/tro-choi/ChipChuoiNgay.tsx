import { useEffect, useState } from "react";
import { Link } from "react-router";

import { cn } from "../../lib/cn";
import { Icon } from "../ui/Icon";

const KHOA_CAP = "qdpl-cap-da-thay";

/**
 * Chip ở thanh đầu trang: chuỗi ngày học và XP, bấm để mở trang "Tôi" (docs/PLAN.md GĐ9).
 *
 * Lên cấp: so cấp hiện tại với cấp đã thấy lần trước (lưu trên máy), cao hơn thì hiện một thông
 * báo nhỏ vài giây. Hiệu ứng chỉ chạy khi người dùng không bật "giảm chuyển động" của hệ điều
 * hành (lớp `motion-safe:` của Tailwind); bật thì thông báo vẫn hiện, chỉ đứng yên.
 */
export function ChipChuoiNgay({
  chuoi,
  xp,
  cap,
  daHocHomNay,
}: {
  chuoi: number;
  xp: number;
  cap: number;
  daHocHomNay: boolean;
}) {
  const [lenCap, setLenCap] = useState<number | null>(null);

  useEffect(() => {
    try {
      const truoc = Number(window.localStorage.getItem(KHOA_CAP) ?? "0");
      if (truoc && cap > truoc) setLenCap(cap);
      window.localStorage.setItem(KHOA_CAP, String(cap));
    } catch {
      // Trình duyệt chặn bộ nhớ cục bộ: bỏ qua thông báo lên cấp, chip vẫn hiện bình thường.
    }
  }, [cap]);

  useEffect(() => {
    if (lenCap === null) return;
    const t = window.setTimeout(() => setLenCap(null), 4500);
    return () => window.clearTimeout(t);
  }, [lenCap]);

  return (
    <span className="relative">
      <Link
        to="/toi"
        title={`Chuỗi ${chuoi} ngày học liên tiếp · ${xp.toLocaleString("vi-VN")} XP · cấp ${cap}`}
        className="lun flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold tabular-nums hover:bg-surface-2"
      >
        <span className={cn("flex items-center gap-0.5", daHocHomNay ? "text-warn" : "text-ink-3")}>
          <Icon name="flame" className={cn("size-4", daHocHomNay && chuoi > 0 && "ic-lay")} />
          {chuoi}
          <span className="sr-only"> ngày học liên tiếp{daHocHomNay ? "" : ", hôm nay chưa học"}</span>
        </span>
        <span className="hidden items-center gap-0.5 text-primary sm:flex">
          <Icon name="star" className={cn("size-4", lenCap !== null && "motion-safe:animate-bounce")} />
          {xp.toLocaleString("vi-VN")}
          <span className="sr-only"> XP</span>
        </span>
      </Link>
      <span role="status" aria-live="polite" className="sr-only">
        {lenCap !== null ? `Đã lên cấp ${lenCap}.` : ""}
      </span>
      {lenCap !== null ? (
        <span
          aria-hidden="true"
          className="absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary shadow-card motion-safe:animate-pulse"
        >
          Lên cấp {lenCap}
        </span>
      ) : null}
    </span>
  );
}
