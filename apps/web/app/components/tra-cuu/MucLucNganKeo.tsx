/**
 * Mục lục trong ngăn kéo: một nút "Mục lục" mở danh sách Chương và Điều, có ô lọc nhanh.
 * Dùng chung cho mọi cỡ màn hình để trang đọc chỉ có một cột nội dung (docs/PLAN.md GĐ1).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { removeDiacritics } from "../../lib/citation";
import { cn } from "../../lib/cn";
import type { TocEntry } from "../../lib/tree";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

function DanhSach({
  muc,
  hrefDieu,
  dangDoc,
  onChon,
}: {
  muc: TocEntry[];
  hrefDieu: (path: string) => string;
  dangDoc?: string;
  onChon: () => void;
}) {
  const [loc, setLoc] = useState("");
  const hienThi = useMemo(() => {
    const kim = removeDiacritics(loc.trim());
    if (!kim) return muc;
    return muc.filter(
      (m) => m.kind === "dieu" && removeDiacritics(`${m.label} ${m.heading ?? ""}`).includes(kim),
    );
  }, [muc, loc]);

  return (
    <div className="flex min-h-0 flex-auto flex-col">
      <div className="border-b border-line p-3">
        <label htmlFor="loc-muc-luc" className="sr-only">
          Lọc điều theo số hoặc tên
        </label>
        <input
          id="loc-muc-luc"
          type="search"
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          placeholder="Lọc theo số hoặc tên điều"
          className="min-h-11 w-full rounded-btn border border-line-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none"
        />
      </div>
      <nav aria-label="Mục lục văn bản" className="min-h-0 flex-auto overflow-y-auto p-2">
        {hienThi.length === 0 ? (
          <p className="px-2 py-3 text-sm text-ink-3">Không có điều nào khớp.</p>
        ) : (
          <ul>
            {hienThi.map((m) =>
              m.kind === "dieu" ? (
                <li key={m.path}>
                  <Link
                    to={hrefDieu(m.path)}
                    onClick={onChon}
                    aria-current={m.path === dangDoc ? "page" : undefined}
                    className={cn(
                      "lun [--lun:0.985] flex min-h-11 items-center rounded-btn px-3 py-1 text-sm",
                      m.path === dangDoc
                        ? "bg-primary-soft font-semibold text-primary"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <span className="line-clamp-2">
                      {m.label}
                      {m.heading ? `. ${m.heading}` : ""}
                    </span>
                  </Link>
                </li>
              ) : (
                <li
                  key={m.path}
                  className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-3"
                >
                  {m.label}
                  {m.heading ? `. ${m.heading}` : ""}
                </li>
              ),
            )}
          </ul>
        )}
      </nav>
    </div>
  );
}

export function MucLucNganKeo({
  muc,
  hrefDieu,
  dangDoc,
}: {
  muc: TocEntry[];
  hrefDieu: (path: string) => string;
  /** Path Điều đang đọc, để đánh dấu trong danh sách. */
  dangDoc?: string;
}) {
  const [mo, setMo] = useState(false);
  const khung = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mo) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMo(false);
    }
    document.addEventListener("keydown", onKey);
    const cu = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    khung.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = cu;
    };
  }, [mo]);

  if (!muc.length) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setMo(true)} aria-haspopup="dialog">
        <Icon name="list" className="size-4" />
        Mục lục
      </Button>
      {mo ? (
        <div className="no-print fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Đóng mục lục"
            onClick={() => setMo(false)}
            className="absolute inset-0 size-full bg-black/40"
          />
          <div
            ref={khung}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Mục lục văn bản"
            // Điện thoại: bottom sheet; từ 768px: ngăn kéo bên trái.
            className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl outline-none md:inset-y-0 md:right-auto md:max-h-none md:w-[min(88vw,24rem)] md:rounded-none md:pb-0"
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <h2 className="font-sans text-base font-semibold">Mục lục</h2>
              <button
                type="button"
                onClick={() => setMo(false)}
                aria-label="Đóng mục lục"
                className="lun grid size-11 place-items-center rounded-btn text-ink-2 hover:bg-surface-2"
              >
                <Icon name="close" />
              </button>
            </div>
            <DanhSach muc={muc} hrefDieu={hrefDieu} dangDoc={dangDoc} onChon={() => setMo(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
