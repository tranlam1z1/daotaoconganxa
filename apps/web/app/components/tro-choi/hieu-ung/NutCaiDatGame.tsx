/**
 * Hai nút nhỏ ở đầu khu trò chơi: âm thanh (mặc định tắt) và rung (mặc định bật, ẩn khi trình duyệt
 * không hỗ trợ rung). Docs: VISUAL_STYLE.md §4.3.
 */
import { useEffect, useState } from "react";

import { cn } from "../../../lib/cn";
import { datCaiDatGame, useCaiDatGame } from "./cai-dat";
import { hoTroRung } from "./rung";

function Nut({
  bat,
  nhan,
  onClick,
  children,
}: {
  bat: boolean;
  nhan: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={bat}
      aria-label={nhan}
      title={nhan}
      onClick={onClick}
      className={cn(
        "grid size-11 place-items-center rounded-full border",
        bat ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-3",
      )}
    >
      {children}
    </button>
  );
}

export function NutCaiDatGame() {
  const cd = useCaiDatGame();
  // Chỉ biết có hỗ trợ rung sau khi chạy trong trình duyệt (tránh lệch khi hydrate).
  const [coRung, datCoRung] = useState(false);
  useEffect(() => datCoRung(hoTroRung()), []);

  return (
    <div data-cai-dat-game className="flex items-center gap-2">
      <Nut
        bat={cd.amThanh}
        nhan={cd.amThanh ? "Tắt âm thanh" : "Bật âm thanh"}
        onClick={() => datCaiDatGame("amThanh", !cd.amThanh)}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {cd.amThanh ? (
            <path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" />
          ) : (
            <path d="m17 9 5 6m0-6-5 6" />
          )}
        </svg>
      </Nut>
      {coRung ? (
        <Nut
          bat={cd.rung}
          nhan={cd.rung ? "Tắt rung" : "Bật rung"}
          onClick={() => datCaiDatGame("rung", !cd.rung)}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="8" y="3" width="8" height="18" rx="2" />
            {cd.rung ? <path d="M4 8v8M20 8v8" /> : <path d="m3 3 18 18" />}
          </svg>
        </Nut>
      ) : null}
    </div>
  );
}
