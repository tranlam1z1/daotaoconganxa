import { Link } from "react-router";

import { dungLuongTep, hrefTaiLieu, type TaiLieu, tenLoaiTaiLieu } from "../../lib/tai-lieu";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";

/** Dòng phụ dưới tên: loại tài liệu, rồi số bước (quy trình) hoặc định dạng và dung lượng tệp. */
export function moTaTaiLieu(t: TaiLieu): string {
  const phan: string[] = [tenLoaiTaiLieu(t.loai)];
  if (t.tep) phan.push(t.tep.duoi.toUpperCase(), dungLuongTep(t.tep.kichThuoc));
  else if (t.soBuoc) phan.push(`${t.soBuoc} bước`);
  return phan.join(" · ");
}

/**
 * Một mục trong danh sách Quy trình, Biểu mẫu: biểu tượng theo loại (các bước cho quy trình, tệp đỏ
 * cho biểu mẫu và hướng dẫn), tên, dòng phụ, mũi tên sang trang chi tiết.
 */
export function TheTaiLieu({ t }: { t: TaiLieu }) {
  return (
    <li>
      <Link
        to={hrefTaiLieu(t)}
        className="flex min-h-20 items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card the-bam sm:gap-4 sm:p-4"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-card border border-line bg-surface-2">
          {t.tep ? (
            <Icon name="file" sac="do" className="size-7" />
          ) : (
            <Icon name="steps" className="size-7" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base leading-snug font-semibold break-words">{t.tieuDe}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
            {moTaTaiLieu(t)}
            {t.banNhap ? <Badge tone="warn">Bản nháp</Badge> : null}
          </span>
        </span>
        <Icon name="chevronRight" sac="trung" className="size-5 shrink-0 text-ink-3" />
      </Link>
    </li>
  );
}
