import { useEffect, useState } from "react";
import { Link } from "react-router";

import { dieuHrefFromUrn, nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import type { BuocQuyTrinh } from "../../lib/tra-cuu-nhanh";
import { Button } from "../ui/Button";

const khoa = (ma: string) => `quy-trinh:${ma}`;

/** Đọc danh sách bước đã đánh dấu. Bộ nhớ trình duyệt có thể bị chặn nên luôn bọc try/catch. */
function docDaLam(ma: string): number[] {
  try {
    const raw = localStorage.getItem(khoa(ma));
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}

function ghiDaLam(ma: string, daLam: number[]) {
  try {
    if (daLam.length) localStorage.setItem(khoa(ma), JSON.stringify(daLam));
    else localStorage.removeItem(khoa(ma));
  } catch {
    // Không lưu được thì vẫn đánh dấu trong phiên hiện tại.
  }
}

/**
 * Các bước của một quy trình, đánh số theo thứ tự. Mỗi bước đánh dấu được "đã làm"; dấu này
 * chỉ lưu trên máy đang dùng (docs/PLAN.md GĐ5), không gửi lên máy chủ.
 */
export function CacBuocQuyTrinh({ ma, cacBuoc }: { ma: string; cacBuoc: BuocQuyTrinh[] }) {
  const [daLam, setDaLam] = useState<number[]>([]);

  // Đọc sau khi gắn vào trang để HTML dựng ở máy chủ khớp với lần vẽ đầu ở trình duyệt.
  useEffect(() => setDaLam(docDaLam(ma)), [ma]);

  const doi = (i: number) => {
    const moi = daLam.includes(i) ? daLam.filter((x) => x !== i) : [...daLam, i].sort((a, b) => a - b);
    setDaLam(moi);
    ghiDaLam(ma, moi);
  };

  return (
    <div>
      <p className="text-base text-ink-2" aria-live="polite">
        Đã làm {daLam.length}/{cacBuoc.length} bước
      </p>
      <ol className="mt-3 grid gap-3">
        {cacBuoc.map((b, i) => {
          const xong = daLam.includes(i);
          const id = `buoc-${ma}-${i}`;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: thứ tự bước cố định, số thứ tự là danh tính của bước
              key={i}
              className={cn(
                "rounded-xl border bg-surface p-4",
                xong ? "border-ok bg-ok-soft" : "border-line shadow-card",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full text-base font-bold",
                    xong ? "bg-ok text-canvas" : "bg-primary-soft text-primary",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold leading-snug">
                    <span className="sr-only">Bước {i + 1}: </span>
                    {b.tieuDe}
                  </p>
                  {b.moTa ? <p className="mt-1 text-base leading-relaxed text-ink-2">{b.moTa}</p> : null}
                  {b.canCu ? (
                    <Link
                      to={dieuHrefFromUrn(b.canCu)}
                      className="mt-2 flex min-h-11 items-center text-sm text-primary underline"
                    >
                      Căn cứ: {nhanVienDan(b.canCu)}
                    </Link>
                  ) : null}
                  <label
                    htmlFor={id}
                    className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 text-base font-medium"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={xong}
                      onChange={() => doi(i)}
                      className="size-6 shrink-0"
                    />
                    Đã làm bước này
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {daLam.length ? (
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => {
            setDaLam([]);
            ghiDaLam(ma, []);
          }}
        >
          Bỏ đánh dấu, làm lại từ đầu
        </Button>
      ) : null}
    </div>
  );
}
