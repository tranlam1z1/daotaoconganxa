/**
 * Ô 1 của biên bản (trò "Lập biên bản", docs/PLAN.md GĐ-G3): chọn hành vi vi phạm trong danh sách
 * mức phạt của loại xe, có ô tìm không dấu ("khong doi mu"). Tìm chạy ngay trên máy, cùng quy tắc
 * với tìm mức phạt GĐ5, nên dùng được cả khi offline.
 *
 * Đã chọn thì thu gọn thành một dòng kèm nút "Đổi"; vùng bấm cao từ 48px.
 */
import { useId, useState } from "react";

import { cn } from "../../lib/cn";
import { type LuaChonHanhVi, timHanhVi } from "../../lib/lap-bien-ban";
import { inputClass } from "../ui/Field";

export function ChonHanhVi({
  luaChon,
  chon,
  datChon,
  khoa,
  nhan,
}: {
  luaChon: LuaChonHanhVi[];
  chon: string | null;
  datChon: (id: string | null) => void;
  khoa: boolean;
  nhan: string;
}) {
  const id = useId();
  const [q, datQ] = useState("");
  const daChon = luaChon.find((o) => o.id === chon) ?? null;

  if (daChon) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-primary bg-primary-soft px-3 py-2.5">
        <p className="min-w-0 text-base font-semibold leading-snug">{daChon.text}</p>
        {khoa ? null : (
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-medium text-primary underline"
            onClick={() => datChon(null)}
            aria-label={`Đổi ${nhan.toLowerCase()}`}
          >
            Đổi
          </button>
        )}
      </div>
    );
  }

  const kq = timHanhVi(luaChon, q);
  return (
    <div>
      <label htmlFor={`${id}-tim`} className="sr-only">
        Tìm {nhan.toLowerCase()}
      </label>
      <input
        id={`${id}-tim`}
        type="search"
        value={q}
        onChange={(e) => datQ(e.target.value)}
        placeholder="Tìm hành vi, gõ không dấu được"
        className={cn(inputClass, "min-h-12 text-base")}
        disabled={khoa}
        autoComplete="off"
      />
      <div className="mt-2 grid gap-2">
        {kq.length ? (
          kq.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={khoa}
              onClick={() => {
                datChon(o.id);
                datQ("");
              }}
              className="dong-bam min-h-12 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-left text-[15px] leading-snug"
            >
              {o.nhom ? <span className="block text-xs font-medium text-ink-3">{o.nhom}</span> : null}
              {o.text}
            </button>
          ))
        ) : (
          <p className="text-sm text-ink-2">Không có hành vi khớp "{q}". Thử từ khác, ví dụ "mu bao hiem".</p>
        )}
      </div>
    </div>
  );
}
