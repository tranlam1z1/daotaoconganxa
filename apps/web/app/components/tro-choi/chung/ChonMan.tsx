/**
 * Chọn màn (mô-đun M8, docs/GAME_DESIGN.md §2.4): danh sách màn của một trò, màn đang mở bấm được để
 * vào chơi ngay, màn chưa mở hiện khóa kèm lý do. Gửi form về action của trang Trò chơi với `ma` và
 * `man`; máy chủ vẫn tự kiểm màn đã mở.
 */
import { Form } from "react-router";

import { cn } from "../../../lib/cn";
import type { ManWeb } from "../../../lib/luot-choi";
import { Sao } from "../KhungGame";

export function ChonMan({ ma, man, busy }: { ma: string; man: readonly ManWeb[]; busy: boolean }) {
  return (
    <ol className="mt-3 grid gap-2" aria-label="Chọn màn">
      {man.map((m) => (
        <li key={m.so}>
          <Form method="post">
            <input type="hidden" name="ma" value={ma} />
            <input type="hidden" name="man" value={m.so} />
            <button
              type="submit"
              disabled={busy || !m.da_mo}
              className={cn(
                "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 py-2 text-left",
                m.da_mo ? "border-line bg-surface dong-bam" : "border-dashed border-line bg-surface-2",
              )}
            >
              <span className="min-w-0">
                <span className={cn("block text-base font-medium", !m.da_mo && "text-ink-2")}>{m.ten}</span>
                <span className="block text-sm text-ink-2">
                  {m.da_mo ? m.mo_ta : `Đạt từ 1 sao ở màn ${m.so - 1} để mở màn này.`}
                </span>
              </span>
              <span className="shrink-0">
                {m.da_mo ? (
                  m.sao ? (
                    <Sao so={m.sao} />
                  ) : (
                    <span className="text-sm font-semibold text-primary">Chơi</span>
                  )
                ) : (
                  <span className="text-sm text-ink-2">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="inline size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <span className="sr-only">Chưa mở</span>
                  </span>
                )}
              </span>
            </button>
          </Form>
        </li>
      ))}
    </ol>
  );
}
