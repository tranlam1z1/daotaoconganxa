import { type ReactNode, useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

import { cn } from "../../lib/cn";
import { chiaTrang, type TheDanhMuc } from "../../lib/trang-chu";
import { BieuTuongTro } from "../tro-choi/chung/BieuTuongTro";
import { Icon, type IconName } from "../ui/Icon";

/** Số thẻ mỗi trang: lưới 2 × 2, từ 1024px một hàng 4. */
const THE_MOI_TRANG_KHUNG = 4;

/**
 * Carousel trò chơi trong khung thẻ giống khung lối tắt (LuoiLoiTat): tiêu đề màu chính có biểu
 * tượng, "Xem tất cả" bên phải, ô cùng kiểu (xem LOP_THE). Mỗi trang THE_MOI_TRANG_KHUNG thẻ, vuốt
 * ngang để sang trang (CSS scroll-snap, không dùng thư viện). Chấm chỉ báo tính theo số trang; mũi
 * tên chỉ hiện từ 768px. Chưa chạy JavaScript thì vẫn vuốt được, chỉ chưa có chấm và mũi tên hoạt động.
 *
 * Thẻ có `to` là liên kết; thẻ `to: null` là nút vào chơi ngay, gửi mã trò tới action của
 * /tro-choi (cùng đường với nút "Chơi ngay"). Không có thẻ nào thì hiện `children`.
 */
export function CategoryCarousel({
  id,
  tieuDe,
  icon,
  xemTatCa,
  items,
  busy = false,
  children,
}: {
  id: string;
  tieuDe: string;
  icon: IconName;
  xemTatCa?: { to: string; nhan: string };
  items: TheDanhMuc[];
  busy?: boolean;
  children?: ReactNode;
}) {
  const trang = chiaTrang(items, THE_MOI_TRANG_KHUNG);
  const ref = useRef<HTMLDivElement>(null);
  const [hienTai, setHienTai] = useState(0);
  const coThe = items.length > 0;

  // Trang hiện tại theo vị trí cuộn (vuốt, bấm chấm, hay Tab tới thẻ ở trang khác đều cập nhật).
  // Vùng cuộn chỉ có khi có thẻ, nên gắn lại khi danh sách chuyển từ rỗng sang có.
  useEffect(() => {
    const el = ref.current;
    if (!el || !coThe) return;
    const capNhat = () => setHienTai(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener("scroll", capNhat, { passive: true });
    return () => el.removeEventListener("scroll", capNhat);
  }, [coThe]);

  const toiTrang = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: giamChuyenDong ? "auto" : "smooth" });
  };

  const nhieuTrang = trang.length > 1;

  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-lg font-semibold text-primary">
          <Icon name={icon} kieu="net" className="size-6" />
          {tieuDe}
        </h2>
        {xemTatCa ? (
          <Link
            to={xemTatCa.to}
            className="group lun -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {xemTatCa.nhan}
            <Icon
              name="chevronRight"
              kieu="net"
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        ) : null}
      </div>

      {trang.length === 0 ? (
        <div className="mt-3">{children}</div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            {nhieuTrang ? (
              <NutMuiTen huong="truoc" disabled={hienTai === 0} onClick={() => toiTrang(hienTai - 1)} />
            ) : null}
            <div
              ref={ref}
              className="khong-thanh-cuon flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
            >
              {trang.map((the, i) => (
                <ul
                  // biome-ignore lint/suspicious/noArrayIndexKey: trang chỉ xác định bằng thứ tự
                  key={i}
                  aria-label={nhieuTrang ? `Trang ${i + 1}/${trang.length}` : undefined}
                  className="grid w-full shrink-0 snap-start grid-cols-2 content-start gap-2 p-1 lg:grid-cols-4"
                >
                  {the.map((t) => (
                    <li key={t.khoa}>
                      <TheO the={t} busy={busy} />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
            {nhieuTrang ? (
              <NutMuiTen
                huong="sau"
                disabled={hienTai >= trang.length - 1}
                onClick={() => toiTrang(hienTai + 1)}
              />
            ) : null}
          </div>
          {nhieuTrang ? (
            <div className="mt-1 flex justify-center">
              {trang.map((_, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: chấm ứng với thứ tự trang
                  key={i}
                  type="button"
                  aria-label={`Tới trang ${i + 1}`}
                  aria-current={i === hienTai ? "true" : undefined}
                  onClick={() => toiTrang(i)}
                  className="group grid size-11 place-items-center"
                >
                  <span
                    className={cn(
                      "block size-2.5 rounded-full transition-colors",
                      i === hienTai ? "bg-primary" : "bg-line-strong group-hover:bg-ink-3",
                    )}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Cùng kiểu ô của LuoiLoiTat (Nghiệp vụ nhanh): biểu tượng trò bên trái, tên bên phải. */
const LOP_THE =
  "flex h-full min-h-16 w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-2.5 py-2 text-left the-bam disabled:opacity-60";

function TheO({ the, busy }: { the: TheDanhMuc; busy: boolean }) {
  const noiDung = (
    <>
      <BieuTuongTro ma={the.khoa} co={44} />
      <span className="min-w-0 text-sm leading-snug font-semibold">{the.nhan}</span>
    </>
  );
  if (the.to) {
    return (
      <Link to={the.to} className={LOP_THE}>
        {noiDung}
      </Link>
    );
  }
  return (
    <Form method="post" action="/tro-choi?index" className="flex h-full w-full">
      <input type="hidden" name="ma" value={the.khoa} />
      <button type="submit" disabled={busy} className={LOP_THE}>
        {noiDung}
      </button>
    </Form>
  );
}

/** Mũi tên chuyển trang, chỉ từ 768px; điện thoại vuốt ngang. */
function NutMuiTen({
  huong,
  disabled,
  onClick,
}: {
  huong: "truoc" | "sau";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={huong === "truoc" ? "Trang trước" : "Trang sau"}
      disabled={disabled}
      onClick={onClick}
      className="lun [--lun:0.92] hidden size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink-2 hover:border-primary hover:text-primary hover:shadow-card disabled:opacity-40 md:grid"
    >
      <Icon name={huong === "truoc" ? "arrowLeft" : "arrowRight"} className="size-6" />
    </button>
  );
}
