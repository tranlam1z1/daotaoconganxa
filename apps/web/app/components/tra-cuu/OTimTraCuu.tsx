/**
 * Ô tìm của trang Tra cứu: kính lúp bên trái, micro bên phải, nút "Tra cứu" rộng ngay dưới ô.
 * Kết quả chỉ hiện sau khi bấm nút (hoặc Enter). Nói xong thì chữ được điền vào ô để người dùng
 * xem lại, sửa dấu nếu nhận dạng sai, rồi tự bấm Tra cứu. Trình duyệt không có nhận dạng giọng
 * nói thì không có nút micro (xem useNhanDangGiong).
 * Dưới nút Tra cứu là nút "Lịch sử": mở ngăn kéo từ dưới lên chứa các lần tra gần đây (bấm để tra
 * lại, xóa từng mục hoặc xóa tất cả). Lịch sử chỉ lưu trên máy đang dùng, riêng cho từng tab.
 */
import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { cn } from "../../lib/cn";
import { useNhanDangGiong } from "../giong-noi/useNhanDangGiong";
import { Icon } from "../ui/Icon";
import { NganLichSu } from "../ui/NganLichSu";

const SO_LICH_SU = 8;
const khoa = (loai: string) => `lich-su-tra-cuu:${loai}`;

/** Một lần tra: từ khóa và lúc tra (ms). Bản lưu cũ chỉ có chuỗi nên `luc` = 0, không hiện giờ. */
interface MucLichSu {
  tu: string;
  luc: number;
}

/** Đọc lịch sử tra cứu. Bộ nhớ trình duyệt có thể bị chặn nên luôn bọc try/catch. */
function docLichSu(loai: string): MucLichSu[] {
  try {
    const raw = localStorage.getItem(khoa(loai));
    const v: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(v)) return [];
    return v
      .map((x): MucLichSu | null =>
        typeof x === "string"
          ? { tu: x, luc: 0 }
          : x && typeof x.tu === "string"
            ? { tu: x.tu, luc: typeof x.luc === "number" ? x.luc : 0 }
            : null,
      )
      .filter((x): x is MucLichSu => x !== null)
      .slice(0, SO_LICH_SU);
  } catch {
    return [];
  }
}

function ghiLichSu(loai: string, ds: MucLichSu[]) {
  try {
    if (ds.length) localStorage.setItem(khoa(loai), JSON.stringify(ds));
    else localStorage.removeItem(khoa(loai));
  } catch {
    // Không lưu được thì lịch sử chỉ giữ trong phiên hiện tại.
  }
}

export function OTimTraCuu({
  q,
  loai,
  nhan,
  placeholder,
  giu,
  onDoiTrong,
}: {
  q: string;
  /** Khóa tách lịch sử theo tab (biển báo, hành vi). */
  loai: string;
  /** Nhãn cho trình đọc màn hình. */
  nhan: string;
  placeholder: string;
  /** Tham số giữ nguyên khi gửi (tab, nhóm, loại xe). */
  giu: Record<string, string>;
  /** Báo ô đang trống hay có chữ ngay khi gõ, xóa hoặc nói (chưa cần bấm Tra cứu). */
  onDoiTrong?: (trong: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const g = useNhanDangGiong((text) => {
    if (!inputRef.current) return;
    inputRef.current.value = text;
    inputRef.current.focus();
    onDoiTrong?.(!text.trim());
  });
  const nav = useNavigation();
  const dangTra =
    nav.state !== "idle" &&
    nav.location?.pathname === "/tra-cuu" &&
    new URLSearchParams(nav.location.search).has("q");

  const [lichSu, setLichSu] = useState<MucLichSu[]>([]);
  // Đọc sau khi gắn vào trang để HTML dựng ở máy chủ khớp với lần vẽ đầu ở trình duyệt.
  // Có từ khóa thì đưa lên đầu kèm giờ tra mới, bỏ bản trùng (không phân biệt hoa thường).
  useEffect(() => {
    const cu = docLichSu(loai);
    if (!q) {
      setLichSu(cu);
      return;
    }
    const moi = [
      { tu: q, luc: Date.now() },
      ...cu.filter((x) => x.tu.toLowerCase() !== q.toLowerCase()),
    ].slice(0, SO_LICH_SU);
    ghiLichSu(loai, moi);
    setLichSu(moi);
  }, [q, loai]);

  const xoa = (tu: string | null) => {
    const moi = tu === null ? [] : lichSu.filter((x) => x.tu !== tu);
    ghiLichSu(loai, moi);
    setLichSu(moi);
  };

  const hrefTim = (tu: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(giu)) if (v) p.set(k, v);
    p.set("q", tu);
    return `/tra-cuu?${p}`;
  };

  return (
    <div>
      <Form method="get" action="/tra-cuu" role="search">
        {Object.entries(giu).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <label htmlFor="o-tra-cuu" className="sr-only">
          {nhan}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-3">
            <Icon name="search" sac="trung" className="size-6" />
          </span>
          <input
            ref={inputRef}
            key={q}
            id="o-tra-cuu"
            name="q"
            type="search"
            defaultValue={q}
            onChange={(e) => onDoiTrong?.(!e.currentTarget.value.trim())}
            placeholder={placeholder}
            autoComplete="off"
            enterKeyHint="search"
            className={cn(
              "min-h-14 w-full rounded-card border border-line-strong bg-surface pl-13 text-base text-ink shadow-card placeholder:text-ink-3 focus:border-primary focus:outline-none",
              g.hoTro ? "pr-14" : "pr-4",
            )}
          />
          {g.hoTro ? (
            <button
              type="button"
              aria-pressed={g.dangNghe}
              aria-label={g.dangNghe ? "Đang nghe, bấm để dừng" : "Tìm bằng giọng nói"}
              onClick={g.dangNghe ? g.dung : g.batDau}
              className={cn(
                "lun absolute inset-y-1.5 right-1.5 grid w-11 place-items-center rounded-card",
                g.dangNghe
                  ? "bg-danger-soft text-danger motion-safe:animate-pulse"
                  : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <Icon name="mic" sac="trung" className="size-6" />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={dangTra}
          className="lun mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-card bg-primary px-4 text-base font-semibold text-on-primary shadow-card hover:bg-primary-hover disabled:opacity-70"
        >
          <Icon name="search" kieu="net" className="size-5" />
          {dangTra ? "Đang tra…" : "Tra cứu"}
        </button>
      </Form>
      <div className="mt-1 flex items-start gap-2">
        <p aria-live="polite" className="min-w-0 flex-1 pt-2.5 text-sm text-ink-2">
          {g.loi ? (
            <span className="text-danger">{g.loi}</span>
          ) : g.tamThoi ? (
            `Đang nghe: ${g.tamThoi}`
          ) : null}
        </p>
        <NganLichSu
          muc={lichSu.map((m) => ({
            khoa: m.tu,
            nhan: m.tu,
            href: hrefTim(m.tu),
            luc: m.luc,
            dangXem: m.tu === q,
          }))}
          xoa={xoa}
        />
      </div>
    </div>
  );
}
