/**
 * Mảnh biểu mẫu dùng chung của các công cụ nghiệp vụ: đầu trang (lối về, tiêu đề, lời dẫn), ô nhập
 * số và lớp CSS của ô, của lựa chọn radio.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "../../lib/cn";
import { Icon } from "../ui/Icon";

export const lopO =
  "min-h-12 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-4 text-lg tabular-nums focus:border-primary focus:outline-none";
export const lopLuaChon =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 text-base has-[:checked]:border-primary has-[:checked]:bg-primary-soft";

export function DauTrangCongCu({ tieuDe, children }: { tieuDe: string; children?: ReactNode }) {
  return (
    <>
      <p className="hidden md:block">
        <Link to="/cong-cu" className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline">
          <Icon name="arrowLeft" className="size-4" />
          Công cụ nghiệp vụ
        </Link>
      </p>
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{tieuDe}</h1>
      {children ? <p className="mt-2 text-base text-ink-2">{children}</p> : null}
    </>
  );
}

/** Ô nhập số dạng chữ (bàn phím số trên điện thoại); `name` cũng là tên tham số trên URL. */
export function ONhapSo({
  name,
  nhan,
  giaTri,
  required,
  goiY,
  soNguyen,
  className,
}: {
  name: string;
  nhan: string;
  giaTri: string;
  required?: boolean;
  /** Dòng chú thích nhỏ dưới ô. */
  goiY?: string;
  soNguyen?: boolean;
  className?: string;
}) {
  const id = `o-${name}`;
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-base font-medium">
        {nhan}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode={soNguyen ? "numeric" : "decimal"}
        required={required}
        defaultValue={giaTri}
        aria-describedby={goiY ? `${id}-goi-y` : undefined}
        className={lopO}
      />
      {goiY ? (
        <p id={`${id}-goi-y`} className="mt-1 text-sm text-ink-2">
          {goiY}
        </p>
      ) : null}
    </div>
  );
}
