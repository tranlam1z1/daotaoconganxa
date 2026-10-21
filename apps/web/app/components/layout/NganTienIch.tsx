import { useEffect, useId, useRef } from "react";
import { Form, Link } from "react-router";

import { laQuanLy, MORE_NAV } from "../../lib/site";
import type { NguoiDung } from "../../lib/types";
import { AnhDaiDien } from "../ui/AnhDaiDien";
import { Icon } from "../ui/Icon";

const LOP_DONG =
  "lun [--lun:0.985] flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-base hover:bg-surface-2";

/**
 * Ngăn tiện ích trượt từ bên phải, chỉ có ở trang chủ dưới 768px (thanh dưới cùng không còn nút
 * "Thêm"): các trang phụ, giao diện sáng/tối và đăng xuất. Từ 768px các mục này đã
 * có trên đầu trang và trang Tài khoản.
 *
 * Dựng trên thẻ <dialog> mở bằng showModal() (lớp .ngan-ben trong app.css): trình duyệt giữ tiêu
 * điểm bên trong, Esc để đóng. Chạm nền mờ, nút X hoặc chọn một mục cũng đóng; khóa cuộn nền khi mở.
 */
export function NganTienIch({ nguoiDung }: { nguoiDung: NguoiDung }) {
  const ref = useRef<HTMLDialogElement>(null);
  const moTu = useRef<HTMLElement | null>(null);
  // Lần chạm bắt đầu trên nền mờ (chính thẻ dialog): kéo từ trong ngăn ra nền không đóng ngăn.
  const chamNen = useRef(false);
  const idTieuDe = useId();
  const muc = MORE_NAV.filter((m) => !m.quanLy || laQuanLy(nguoiDung.vai_tro));
  const hoTen = nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email;

  const dong = () => ref.current?.close();

  // Gỡ khóa cuộn khi ngăn bị gỡ khỏi trang lúc đang mở (đăng xuất, rời trang chủ).
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
        aria-label="Tiện ích"
        aria-haspopup="dialog"
        onClick={(e) => {
          moTu.current = e.currentTarget;
          ref.current?.showModal();
          document.documentElement.style.overflow = "hidden";
        }}
        className="lun grid size-11 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink md:hidden"
      >
        <Icon name="menu" className="size-6" />
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
        className="ngan-ben"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line py-2 pr-1 pl-4">
          <AnhDaiDien nguoiDung={nguoiDung} className="size-10 shrink-0 text-base" />
          <div className="min-w-0 flex-1 leading-tight">
            <h2 id={idTieuDe} className="font-sans text-xs font-medium text-ink-2">
              Tiện ích
            </h2>
            <p className="truncate text-base font-semibold">{hoTen}</p>
          </div>
          <button
            type="button"
            onClick={dong}
            aria-label="Đóng"
            className="lun grid size-12 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="close" />
          </button>
        </div>

        <ul className="flex flex-col p-2">
          {muc.map((m) => (
            <li key={m.to}>
              <Link to={m.to} onClick={dong} className={`${LOP_DONG} text-ink`}>
                <Icon name={m.icon} className="size-6 shrink-0 text-ink-2" />
                {m.label}
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-line pt-1">
            <Form method="post" action="/dang-xuat" onSubmit={dong}>
              <button type="submit" className={`${LOP_DONG} text-ink`}>
                <Icon name="logout" className="size-6 shrink-0 text-ink-2" />
                Đăng xuất
              </button>
            </Form>
          </li>
        </ul>
      </dialog>
    </>
  );
}
