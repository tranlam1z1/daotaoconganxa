/**
 * Khối "Điểm mạnh, điểm yếu" ở trang Tôi (docs/PLAN.md GĐ-G0): tối đa 3 chủ đề mỗi phía, tính
 * từ mọi câu trả lời trong luyện tập, thi và trò chơi. Chủ đề chưa đủ 5 lượt chưa được xếp.
 *
 * Hai thẻ cùng cấu trúc, cùng chiều cao; thẻ trống hiện trạng thái trống ngay trong thẻ.
 */
import { Link } from "react-router";

import { cn } from "../../lib/cn";
import type { HoSoChuDeWeb } from "../../lib/luot-choi";
import { Icon, type IconName } from "../ui/Icon";

/** Màu theo ngưỡng: từ 70% tốt, 40–69% cần chú ý, dưới 40% yếu. */
function mauTheoDiem(pt: number): { chu: string; thanh: string } {
  if (pt >= 70) return { chu: "text-ok", thanh: "bg-ok" };
  if (pt >= 40) return { chu: "text-warn", thanh: "bg-warn" };
  return { chu: "text-danger", thanh: "bg-danger" };
}

function Dong({ c }: { c: HoSoChuDeWeb["manh"][number] }) {
  const pt = Math.round(c.diem * 100);
  const mau = mauTheoDiem(pt);
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 text-[15px] font-medium">{c.ten}</span>
        <span className={cn("shrink-0 text-sm font-semibold tabular-nums", mau.chu)}>{pt}%</span>
        <Link
          to="/luyen-tap"
          aria-label={`Luyện chủ đề ${c.ten}`}
          className="lun -my-2 inline-flex min-h-11 shrink-0 items-center rounded-btn px-2 text-sm font-semibold text-primary hover:bg-primary-soft"
        >
          Luyện
        </Link>
      </p>
      <span
        role="img"
        aria-label={`${pt}% gần đây, ${c.attempts} lượt`}
        className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <span
          className={cn("block h-full rounded-full transition-[width] duration-200", mau.thanh)}
          style={{ width: `${pt}%` }}
        />
      </span>
    </li>
  );
}

function TheChuDe({
  tieuDe,
  icon,
  mauIcon,
  ds,
  trong,
  goiY,
}: {
  tieuDe: string;
  icon: IconName;
  mauIcon: string;
  ds: HoSoChuDeWeb["manh"];
  trong: string;
  goiY: string;
}) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden="true" className={cn("grid size-8 place-items-center rounded-full", mauIcon)}>
          <Icon name={icon} className="size-4" />
        </span>
        {tieuDe}
      </h3>
      {ds.length ? (
        <ul className="mt-4 divide-y divide-line">
          {ds.map((c) => (
            <Dong key={c.topic_id} c={c} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-3"
          >
            <Icon name="layers" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">{trong}</p>
          <p className="mt-1 max-w-xs text-sm text-ink-2">{goiY}</p>
          <Link
            to="/luyen-tap"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Luyện tập theo chủ đề
          </Link>
        </div>
      )}
    </div>
  );
}

export function HoSoChuDe({ hoSo }: { hoSo: HoSoChuDeWeb }) {
  const coDuLieu = hoSo.manh.length > 0 || hoSo.yeu.length > 0;
  return (
    <section aria-labelledby="ho-so-chu-de">
      <h2 id="ho-so-chu-de" className="text-lg font-semibold">
        Điểm mạnh, điểm yếu
      </h2>
      {!coDuLieu ? (
        <p className="mt-1 text-[15px] text-ink-2">
          Chưa đủ dữ liệu. Mỗi chủ đề cần ít nhất 5 câu trả lời trong luyện tập, thi hoặc trò chơi.
        </p>
      ) : null}
      <div className="mt-3 grid gap-4 md:grid-cols-2 md:gap-6">
        <TheChuDe
          tieuDe="Cần luyện thêm"
          icon="gauge"
          mauIcon="bg-danger-soft text-danger"
          ds={hoSo.yeu}
          trong="Chưa có chủ đề nào dưới 70%"
          goiY={
            coDuLieu
              ? "Bạn đang làm tốt mọi chủ đề đã luyện."
              : "Luyện thêm để hệ thống nhận ra chủ đề còn yếu."
          }
        />
        <TheChuDe
          tieuDe="Đang làm tốt"
          icon="trophy"
          mauIcon="bg-ok-soft text-ok"
          ds={hoSo.manh}
          trong="Chưa có chủ đề nào đạt từ 70%"
          goiY="Luyện đều một chủ đề đến khi đúng từ 70% để ghi nhận ở đây."
        />
      </div>
    </section>
  );
}
