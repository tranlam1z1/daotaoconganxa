/**
 * Màn hướng dẫn chơi ngắn (mô-đun M3, docs/GAME_DESIGN.md §1.6): tối đa 3 thẻ, mỗi thẻ một thao tác.
 * Hiện trước lượt đầu tiên của một trò; lần sau không hiện lại (nhớ trên máy), mở lại được bằng nút
 * "Cách chơi". Có "Bỏ qua". Giảm chuyển động: thẻ đổi ngay, không trượt.
 *
 * Nhớ bằng localStorage vì đây chỉ là tiện ích trên máy; đọc ghi lỗi (trình duyệt chặn) thì coi như
 * chưa xem, không báo lỗi.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Button, buttonClass } from "../../ui/Button";
import { HopThoai } from "../../ui/HopThoai";
import { Icon } from "../../ui/Icon";

export interface BuocHuongDan {
  tieuDe: string;
  moTa: string;
  hinh?: ReactNode;
}

const khoa = (ma: string) => `qdpl-huong-dan:${ma}`;

function daXem(ma: string): boolean {
  try {
    return window.localStorage.getItem(khoa(ma)) === "1";
  } catch {
    return false;
  }
}

function ghiDaXem(ma: string) {
  try {
    window.localStorage.setItem(khoa(ma), "1");
  } catch {
    // Không ghi được thì lần sau hiện lại, không sao.
  }
}

/** Trạng thái hướng dẫn của một trò: tự mở ở lần đầu (sau khi trang đã dựng xong trên máy). */
export function useHuongDan(ma: string, tuMo: boolean) {
  const [mo, datMo] = useState(false);
  useEffect(() => {
    if (tuMo && !daXem(ma)) datMo(true);
  }, [ma, tuMo]);
  const dong = useCallback(() => {
    ghiDaXem(ma);
    datMo(false);
  }, [ma]);
  return { mo, moLai: () => datMo(true), dong };
}

export function HuongDan({
  tieuDe,
  buoc,
  dong,
}: {
  tieuDe: string;
  buoc: readonly BuocHuongDan[];
  dong: () => void;
}) {
  const [i, datI] = useState(0);
  const nut = useRef<HTMLButtonElement>(null);
  // Chạy sau effect của HopThoai (component con), tức sau showModal() đã đặt tiêu điểm vào nút X.
  useEffect(() => {
    nut.current?.focus();
  }, []);
  const b = buoc[i]!;
  const cuoi = i === buoc.length - 1;
  return (
    <HopThoai
      mo
      tieuDe={tieuDe}
      onDong={dong}
      hanhDong={
        <>
          <Button variant="secondary" className="min-h-12 text-base sm:flex-1" onClick={dong}>
            Bỏ qua
          </Button>
          <button
            type="button"
            ref={nut}
            className={buttonClass({ className: "g-nut min-h-12 text-base sm:flex-1" })}
            onClick={() => (cuoi ? dong() : datI(i + 1))}
          >
            {cuoi ? "Bắt đầu" : "Tiếp"}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-2">
        Cách chơi · {i + 1}/{buoc.length}
      </p>
      <div key={i} className="g-a g-truot-vao mt-3">
        {b.hinh ? <div className="mb-3 grid place-items-center">{b.hinh}</div> : null}
        <p className="text-lg font-semibold">{b.tieuDe}</p>
        <p className="mt-1 text-base leading-relaxed text-ink-2">{b.moTa}</p>
      </div>
    </HopThoai>
  );
}

/** Nút nhỏ (biểu tượng "?") mở lại hướng dẫn. */
export function NutCachChoi({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cách chơi"
      title="Cách chơi"
      className="lun grid size-11 shrink-0 place-items-center rounded-lg text-primary hover:bg-surface-2"
    >
      <Icon name="help" className="size-6" />
    </button>
  );
}
