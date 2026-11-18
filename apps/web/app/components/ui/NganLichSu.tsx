import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import { cn } from "../../lib/cn";
import { formatNgayGio } from "../../lib/format";
import { Icon } from "./Icon";

/** Một mục lịch sử: `khoa` duy nhất trong danh sách, `phu` là dòng phụ (ghi trước giờ tra). */
export interface MucNganLichSu {
  khoa: string;
  nhan: string;
  phu?: string;
  href: string;
  /** Lúc tra (ms); 0 = không rõ, không hiện giờ. */
  luc: number;
  dangXem?: boolean;
}

/** "Vừa xong", "5 phút trước", "3 giờ trước", "Hôm qua", "4 ngày trước", rồi đến ngày giờ cụ thể. */
function thoiGianTra(luc: number, bayGio: number): string {
  if (!luc) return "";
  const phut = Math.floor((bayGio - luc) / 60_000);
  if (phut < 1) return "Vừa xong";
  if (phut < 60) return `${phut} phút trước`;
  const homNay = new Date(bayGio).setHours(0, 0, 0, 0);
  if (luc >= homNay) return `${Math.floor(phut / 60)} giờ trước`;
  const ngay = Math.ceil((homNay - luc) / 86_400_000);
  if (ngay === 1) return "Hôm qua";
  if (ngay < 7) return `${ngay} ngày trước`;
  return formatNgayGio(new Date(luc));
}

/**
 * Nút "Lịch sử" và ngăn kéo từ dưới lên (lớp .ngan-duoi trong app.css), dựng trên thẻ <dialog> mở
 * bằng showModal() như NganTienIch: Esc, chạm nền mờ, nút X hoặc chọn một mục để đóng; khóa cuộn
 * nền khi mở. "Xóa tất cả" hỏi lại ngay trong ngăn trước khi xóa.
 */
export function NganLichSu({
  muc,
  xoa,
  className,
}: {
  muc: MucNganLichSu[];
  /** Xóa một mục theo khóa; null = xóa tất cả. */
  xoa: (khoa: string | null) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const moTu = useRef<HTMLElement | null>(null);
  // Lần chạm bắt đầu trên nền mờ (chính thẻ dialog): kéo từ trong ngăn ra nền không đóng ngăn.
  const chamNen = useRef(false);
  const idTieuDe = useId();
  const [hoiXoaHet, setHoiXoaHet] = useState(false);
  // Mốc tính "x phút trước", lấy lúc mở ngăn (ngăn chỉ mở ở trình duyệt nên không lệch với máy chủ).
  const [bayGio, setBayGio] = useState(0);

  const dong = () => ref.current?.close();

  // Gỡ khóa cuộn khi ngăn bị gỡ khỏi trang lúc đang mở (chuyển trang).
  useEffect(
    () => () => {
      if (!document.querySelector("dialog[open]")) document.documentElement.style.overflow = "";
    },
    [],
  );

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => {
          moTu.current = e.currentTarget;
          setBayGio(Date.now());
          setHoiXoaHet(false);
          ref.current?.showModal();
          document.documentElement.style.overflow = "hidden";
        }}
        className={cn(
          "lun flex min-h-11 shrink-0 items-center gap-1.5 rounded-btn px-2 text-sm font-semibold text-primary hover:bg-surface-2",
          className,
        )}
      >
        <Icon name="timer" kieu="net" className="size-5" />
        Lịch sử
        {muc.length ? <span className="font-normal text-ink-2">({muc.length})</span> : null}
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: bàn phím đóng bằng Esc (hành vi gốc của dialog) và nút Đóng */}
      <dialog
        ref={ref}
        aria-labelledby={idTieuDe}
        onPointerDown={(e) => {
          chamNen.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (chamNen.current && e.target === e.currentTarget) dong();
          chamNen.current = false;
        }}
        onClose={() => {
          if (!document.querySelector("dialog[open]")) document.documentElement.style.overflow = "";
          moTu.current?.focus();
        }}
        className="ngan-duoi"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line py-1 pr-1 pl-4">
          <h2 id={idTieuDe} className="font-sans text-lg font-semibold">
            Lịch sử tra cứu
          </h2>
          <button
            type="button"
            onClick={dong}
            aria-label="Đóng"
            className="lun grid size-12 shrink-0 place-items-center rounded-btn text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="close" />
          </button>
        </div>

        {muc.length === 0 ? (
          <p className="px-4 py-8 text-center text-base text-ink-2">Chưa có lần tra cứu nào trên máy này.</p>
        ) : (
          <>
            <ul className="min-h-0 flex-auto overflow-y-auto overscroll-contain p-2">
              {muc.map((m) => {
                const phu = [m.phu, thoiGianTra(m.luc, bayGio), m.dangXem ? "Đang xem" : ""]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={m.khoa} className="flex items-center rounded-btn hover:bg-surface-2">
                    <Link
                      to={m.href}
                      onClick={dong}
                      aria-current={m.dangXem ? "true" : undefined}
                      className="lun [--lun:0.985] flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-btn py-1.5 pr-1 pl-3"
                    >
                      <Icon
                        name="timer"
                        kieu="net"
                        className={cn("size-5 shrink-0", m.dangXem ? "text-primary" : "text-ink-3")}
                      />
                      <span className="min-w-0 leading-snug">
                        <span
                          className={cn(
                            "block truncate text-base",
                            m.dangXem ? "font-semibold text-primary" : "text-ink",
                          )}
                        >
                          {m.nhan}
                        </span>
                        {phu ? <span className="block truncate text-sm text-ink-3">{phu}</span> : null}
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Xóa “${m.nhan}” khỏi lịch sử`}
                      onClick={() => xoa(m.khoa)}
                      className="lun grid size-12 shrink-0 place-items-center rounded-btn text-ink-3 hover:text-ink"
                    >
                      <Icon name="close" sac="trung" className="size-5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="shrink-0 border-t border-line px-4 py-2">
              {hoiXoaHet ? (
                <fieldset className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  <legend className="sr-only">Xác nhận xóa</legend>
                  <p className="mr-auto text-base font-semibold">Xóa toàn bộ lịch sử?</p>
                  <button
                    type="button"
                    onClick={() => setHoiXoaHet(false)}
                    className="lun min-h-11 rounded-btn border border-line-strong px-4 text-base hover:bg-surface-2"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      xoa(null);
                      setHoiXoaHet(false);
                    }}
                    className="lun min-h-11 rounded-btn bg-danger px-4 text-base font-semibold text-canvas"
                  >
                    Xóa tất cả
                  </button>
                </fieldset>
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setHoiXoaHet(true)}
                    className="min-h-11 px-2 text-base text-danger underline"
                  >
                    Xóa tất cả
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
