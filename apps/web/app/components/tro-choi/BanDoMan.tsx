import { Form } from "react-router";

import { cn } from "../../lib/cn";
import type { ManTrenBanDo } from "../../lib/tro-choi.server";
import { Icon } from "../ui/Icon";
import { Sao } from "./KhungGame";

/**
 * Bản đồ màn của trò chơi vượt màn: các màn xếp dọc theo một đường zíc zắc, màn đã qua có sao,
 * màn chưa mở có khóa. Bấm màn đang mở là vào chơi ngay (một hành động chính).
 */
export function BanDoMan({ man, dangMo }: { man: ManTrenBanDo[]; dangMo: boolean }) {
  return (
    <ol className="relative mx-auto flex max-w-xs flex-col gap-4 py-2">
      {man.map((m, i) => {
        const lech = i % 2 === 0 ? "self-start" : "self-end";
        return (
          <li key={m.id} className={cn("flex w-40 flex-col items-center", lech)}>
            {m.mo ? (
              <Form method="post" className="contents">
                <input type="hidden" name="man" value={m.id} />
                <button
                  type="submit"
                  disabled={dangMo}
                  aria-label={`Chơi màn ${m.thu_tu}${m.qua ? `, đã qua với ${m.sao} sao` : ""}`}
                  className={cn(
                    "lun [--lun:0.92] grid size-20 place-items-center rounded-full border-4 text-2xl font-semibold shadow-card",
                    m.qua ? "border-ok bg-ok-soft text-ok" : "border-primary bg-primary text-on-primary",
                  )}
                >
                  {m.thu_tu}
                </button>
              </Form>
            ) : (
              <span
                role="img"
                aria-label={`Màn ${m.thu_tu} chưa mở`}
                className="grid size-20 place-items-center rounded-full border-4 border-line bg-surface-2 text-ink-3"
              >
                <Icon name="lock" />
              </span>
            )}
            <span className="mt-1 text-sm font-medium">Màn {m.thu_tu}</span>
            {m.mo ? <Sao so={m.sao} /> : <span className="text-sm text-ink-3">Chưa mở</span>}
          </li>
        );
      })}
    </ol>
  );
}
