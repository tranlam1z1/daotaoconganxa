import { Link } from "react-router";

import type { Tone } from "../../lib/format";
import { Badge } from "../ui/Badge";
import { Icon, type IconName } from "../ui/Icon";

function tonePhanTram(phanTram: number): Tone {
  if (phanTram >= 100) return "ok";
  return phanTram > 0 ? "info" : "muted";
}

/**
 * Một thẻ trong lưới bài giảng, dùng cho bài ở `/hoc/:course` và chuyên đề ở `/hoc`: biểu tượng
 * bên trái cao bằng ba dòng bên phải (tiêu đề, mô tả, dòng phụ thời lượng và số bài), mỗi dòng cắt
 * còn một hàng, chữ đầy đủ hiện khi rê chuột. Badge phần trăm đã học nằm cạnh tiêu đề; `phanTram`
 * null (chưa đăng nhập, chưa ghi danh) thì không hiện badge, không hiện 0%.
 * Cả thẻ là một liên kết; thẻ cao bằng nhau trong một hàng, dòng phụ luôn nằm đáy thẻ.
 */
export function TheBaiHoc({
  to,
  icon,
  tieuDe,
  moTa,
  dongPhu,
  phanTram,
}: {
  to: string;
  icon: IconName;
  tieuDe: string;
  moTa: string | null;
  dongPhu: string;
  phanTram: number | null;
}) {
  return (
    <Link
      to={to}
      className="flex h-full min-h-28 items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card the-bam focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="grid size-20 shrink-0 place-items-center rounded-card bg-primary-soft text-primary">
        <Icon name={icon} className="size-10" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 self-stretch">
        <span className="flex items-start justify-between gap-2">
          {/* Tối đa hai dòng: màn điện thoại hẹp, cắt một dòng thì mất gần hết tên bài. */}
          <span title={tieuDe} className="line-clamp-2 min-w-0 break-words text-base font-semibold leading-6">
            {tieuDe}
          </span>
          {typeof phanTram === "number" ? (
            <span className="shrink-0">
              <Badge tone={tonePhanTram(phanTram)}>
                <span className="sr-only">Đã học </span>
                {phanTram}%
              </Badge>
            </span>
          ) : null}
        </span>
        {moTa ? (
          <span title={moTa} className="line-clamp-2 text-sm leading-6 text-ink-2">
            {moTa}
          </span>
        ) : null}
        <span className="mt-auto truncate text-sm leading-6 text-ink-3">{dongPhu}</span>
      </span>
    </Link>
  );
}
