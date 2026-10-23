/**
 * Khung bảng và ô số liệu dùng chung cho màn hình báo cáo, hồ sơ cán bộ và trang Tổng quan của khu
 * quản trị.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "../../lib/cn";
import { EmptyState } from "../ui/EmptyState";
import { Icon, type IconName } from "../ui/Icon";

export const TH = "py-2 pr-3 font-medium";
export const TD = "py-2 pr-3 align-top";
export const SO = "text-right tabular-nums";
/** Cột nhận diện đứng yên ở mép trái khi cuộn ngang (lớp .cot-dinh trong app.css). */
export const DINH = "cot-dinh min-w-32 pl-1";

export function KhungBang({ children, minRem }: { children: ReactNode; minRem: number }) {
  return (
    <div className="bang-cuon mt-3 rounded-xl border border-line p-3">
      <table className="w-full text-left text-sm" style={{ minWidth: `${minRem}rem` }}>
        {children}
      </table>
    </div>
  );
}

export function Trong({ title = "Không có dữ liệu khớp bộ lọc" }: { title?: string }) {
  return (
    <div className="mt-4">
      <EmptyState icon="list" title={title} />
    </div>
  );
}

export interface MucTomTat {
  icon?: IconName;
  nhan: string;
  giaTri: string;
  /** Dòng chữ nhỏ dưới con số. */
  phu?: string;
  /** Có thì cả ô là liên kết. */
  to?: string;
  /** Tô viền cảnh báo cho ô cần xử lý. */
  canhBao?: boolean;
}

/** Hàng ô số liệu: 2 cột trên điện thoại, 4 cột từ màn hình vừa. */
export function TomTat({ muc }: { muc: MucTomTat[] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {muc.map((m) => (
        <div
          key={m.nhan}
          className={cn(
            "relative rounded-xl border bg-surface p-3",
            m.canhBao ? "border-warn" : "border-line",
            m.to && "dong-bam",
          )}
        >
          {m.icon ? (
            <>
              <span className="tong-quan-icon">
                <Icon name={m.icon} className="size-7" />
              </span>
              <Icon name={m.icon === "book" ? "chart" : m.icon} className="tong-quan-watermark" />
            </>
          ) : null}
          <dt className="text-sm text-ink-2">
            {m.to ? (
              // Lớp phủ ::after cho cả ô bấm được, mà <dl> vẫn chỉ chứa <div>, <dt>, <dd>.
              <Link to={m.to} className="after:absolute after:inset-0 after:rounded-xl">
                {m.nhan}
              </Link>
            ) : (
              m.nhan
            )}
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{m.giaTri}</dd>
          {m.phu ? <dd className="mt-0.5 text-sm text-ink-3">{m.phu}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
