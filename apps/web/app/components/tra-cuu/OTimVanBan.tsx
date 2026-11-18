/**
 * Khung tìm của trang /tim-kiem: tiêu đề, ô nhập (kính lúp bên trái, micro bên phải) và nút
 * "Tra cứu văn bản" rộng hết khung, nằm dưới ô nhập. Nói xong thì chữ được điền vào ô để người dùng xem
 * lại rồi tự bấm tra. Trình duyệt không có nhận dạng giọng nói thì không có nút micro.
 * Ô mang id "o-tim-kiem" nên phím tắt "/" đưa con trỏ vào (root.tsx).
 */
import { type ReactNode, useRef } from "react";
import { Form, useNavigation } from "react-router";

import { cn } from "../../lib/cn";
import { TU_KHOA_TOI_DA } from "../../lib/tra-cuu-van-ban";
import { useNhanDangGiong } from "../giong-noi/useNhanDangGiong";
import { Icon } from "../ui/Icon";

export function OTimVanBan({ q, children }: { q: string; children?: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const g = useNhanDangGiong((text) => {
    if (!inputRef.current) return;
    inputRef.current.value = text;
    inputRef.current.focus();
  });
  const nav = useNavigation();
  const dangTra = nav.state !== "idle" && nav.location?.pathname === "/tim-kiem";

  return (
    <div className="tra-cuu-form">
      <Form method="get" action="/tim-kiem" role="search" className="mt-3">
        <label htmlFor="o-tim-kiem" className="sr-only">
          Từ khóa, số ký hiệu hoặc điều, khoản
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3">
            <Icon name="search" sac="trung" className="size-6" />
          </span>
          <input
            ref={inputRef}
            key={q}
            id="o-tim-kiem"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={TU_KHOA_TOI_DA}
            placeholder="Số hiệu, tên văn bản hoặc từ khóa"
            autoComplete="off"
            enterKeyHint="search"
            className={cn(
              // Lề gọn và chữ gợi ý nhỏ hơn một bậc để câu gợi ý hiện đủ trên điện thoại 390px.
              "min-h-14 w-full rounded-card border border-line-strong bg-surface pl-11 text-base text-ellipsis text-ink placeholder:text-sm placeholder:text-ink-3 focus:border-primary focus:outline-none",
              g.hoTro ? "pr-12" : "pr-3",
            )}
          />
          {g.hoTro ? (
            <button
              type="button"
              aria-pressed={g.dangNghe}
              aria-label={g.dangNghe ? "Đang nghe, bấm để dừng" : "Tìm bằng giọng nói"}
              onClick={g.dangNghe ? g.dung : g.batDau}
              className={cn(
                "lun absolute inset-y-1.5 right-1 grid w-11 place-items-center rounded-card",
                g.dangNghe
                  ? "bg-danger-soft text-danger motion-safe:animate-pulse"
                  : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <Icon name="mic" sac="trung" className="size-6" />
            </button>
          ) : null}
        </div>
        <p aria-live="polite" className="mt-1 text-sm text-ink-2">
          {g.loi ? (
            <span className="text-danger">{g.loi}</span>
          ) : g.tamThoi ? (
            `Đang nghe: ${g.tamThoi}`
          ) : null}
        </p>
        {children}
        <button
          type="submit"
          disabled={dangTra}
          className="lun mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-card bg-primary px-4 text-base font-semibold text-on-primary shadow-card hover:bg-primary-hover disabled:opacity-70"
        >
          <Icon name="search" kieu="net" className="size-5" />
          {dangTra ? "Đang tra…" : "Tra cứu văn bản"}
        </button>
      </Form>
    </div>
  );
}
