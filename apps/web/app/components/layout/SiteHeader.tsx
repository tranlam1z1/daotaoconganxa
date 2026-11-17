import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "../../lib/cn";
import {
  anDauTrangDienThoai,
  BOTTOM_NAV,
  dangOMuc,
  laTrangGoc,
  MAIN_NAV,
  MORE_NAV,
  type NavItem,
  SITE_NAME,
  SITE_NAME_SHORT,
} from "../../lib/site";
import type { NguoiDung } from "../../lib/types";
import { AnhDaiDien } from "../ui/AnhDaiDien";
import { BrandName } from "../ui/BrandName";
import { Icon } from "../ui/Icon";
import { LogoHocTap } from "../ui/LogoHocTap";
import { NganTienIch } from "./NganTienIch";

export function BrandMark() {
  // Tên hai dòng tự xuống hàng để nhường chỗ cho các nút tài khoản.
  return (
    <Link
      to="/"
      className="site-brand flex min-h-11 min-w-0 items-center font-sans xl:shrink-0"
    >
      <LogoHocTap className="shrink-0" />

      <BrandName />
    </Link>
  );
}

function navClass(active: boolean, compact = false) {
  return cn(
    "lun flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 font-medium",
    compact ? "text-[13px]" : "text-[15px]",
    active ? "bg-primary text-on-primary" : "text-secondary hover:bg-secondary-soft",
  );
}

/** Mục điều hướng chứa trang hiện tại, dùng làm tiêu đề tạm và đích quay lại. */
function mucCha(pathname: string): { to: string; label: string } {
  return (
    // MORE_NAV trước: /hoi-dap, /nhom lấy tên mục riêng thay vì Tra cứu, Học.
    [...MORE_NAV, ...BOTTOM_NAV].find((m) => m.to !== "/" && dangOMuc(m, pathname)) ?? {
      to: "/",
      label: SITE_NAME,
    }
  );
}

// pageMeta() gắn tiêu đề thẻ theo dạng "<tên trang> | <tên rút gọn>"; đầu trang con cắt đuôi này.
const DUOI_TIEU_DE = ` | ${SITE_NAME_SHORT}`;

/**
 * Đầu trang con trên điện thoại: nút quay lại + tiêu đề trang. Tiêu đề lấy từ thẻ <title> (hàm
 * meta của từng route) sau khi trang hiển thị; trước đó (và khi render phía máy chủ) dùng tên mục.
 */
function DauTrangCon({ pathname }: { pathname: string }) {
  const cha = mucCha(pathname);
  const [tieuDe, setTieuDe] = useState(cha.label);

  // biome-ignore lint/correctness/useExhaustiveDependencies: đọc lại tiêu đề mỗi khi đổi trang
  useEffect(() => {
    const t = document.title;
    setTieuDe(t.endsWith(DUOI_TIEU_DE) ? t.slice(0, -DUOI_TIEU_DE.length) : t || cha.label);
  }, [pathname]);

  return (
    <div className="flex min-w-0 items-center gap-1 xl:hidden">
      <Link
        // Đang ở chính trang mục (vd /tra-cuu) thì đích quay lại là trang chủ.
        to={cha.to === pathname ? "/" : cha.to}
        // Về mục cha trong một lần bấm; không thêm trang con vào lịch sử khi quay lại.
        replace
        aria-label="Quay lại"
        className="lun -ml-2 grid size-11 shrink-0 place-items-center rounded-lg text-secondary hover:bg-secondary-soft"
      >
        <Icon name="arrowLeft" className="size-6" />
      </Link>
      <span className="truncate text-base font-semibold">{tieuDe}</span>
    </div>
  );
}

/** Điều hướng chính trên máy tính; tài khoản theo trạng thái đăng nhập và xác minh. */
export function SiteHeader({
  nguoiDung,
  kiemTraPhienLoi = false,
}: {
  nguoiDung: NguoiDung | null;
  kiemTraPhienLoi?: boolean;
}) {
  const { pathname } = useLocation();
  const goc = laTrangGoc(pathname);
  const [moTaiKhoan, setMoTaiKhoan] = useState(false);
  const taiKhoanRef = useRef<HTMLDivElement>(null);
  const nutTaiKhoanRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moTaiKhoan) return;
    const dongBenNgoai = (event: PointerEvent) => {
      if (!taiKhoanRef.current?.contains(event.target as Node)) setMoTaiKhoan(false);
    };
    const dongBangPhim = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoTaiKhoan(false);
        nutTaiKhoanRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dongBenNgoai);
    document.addEventListener("keydown", dongBangPhim);
    return () => {
      document.removeEventListener("pointerdown", dongBenNgoai);
      document.removeEventListener("keydown", dongBangPhim);
    };
  }, [moTaiKhoan]);

  // Tài khoản chưa được xác minh không có trang Tôi: mục này dẫn thẳng tới trang Tài khoản.
  const toi: NavItem = nguoiDung
    ? { to: nguoiDung.cho_xac_minh ? "/tai-khoan" : "/toi", label: "Tôi", khop: ["/tai-khoan"] }
    : kiemTraPhienLoi
      ? { to: "/tai-khoan", label: "Tài khoản" }
      : { to: "/dang-nhap", label: "Đăng nhập" };
  const hoTen = nguoiDung ? (nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email) : "";
  const lienKet = (item: NavItem) => {
    const active = dangOMuc(item, pathname);
    return (
      <Link
        to={item.to}
        aria-current={active ? "page" : undefined}
        title={
          item === toi && nguoiDung ? [hoTen, nguoiDung.don_vi?.ten].filter(Boolean).join(" · ") : undefined
        }
        className={cn(navClass(active), item === toi && !nguoiDung && "site-login site-account-action")}
      >
        {item === toi && nguoiDung ? (
          <>
            {/* Nền đặc: mục đang chọn có nền primary-soft, ảnh đại diện cùng màu sẽ chìm mất. */}
            <AnhDaiDien nguoiDung={nguoiDung} className="mr-2 size-7 shrink-0 text-[13px]" />
            {/* Tên và đơn vị được xuống dòng để hiển thị đầy đủ. */}
            <span className="flex min-w-0 max-w-36 flex-col leading-tight lg:max-w-48">
              <span className="site-account-name">{hoTen}</span>
              {nguoiDung.don_vi ? (
                <span className="whitespace-normal break-words text-xs font-normal text-ink-2">
                  {nguoiDung.don_vi.ten}
                </span>
              ) : nguoiDung.cho_xac_minh ? (
                <span className="truncate text-xs font-normal text-ink-2">Chờ xác minh</span>
              ) : null}
            </span>
          </>
        ) : (
          item.label
        )}
      </Link>
    );
  };

  return (
    // Nhận diện đỏ đô trên nền trắng, điều hướng xanh công vụ.
    <header
      className={cn(
        "site-header no-print sticky top-0 z-40 border-b border-line",
        anDauTrangDienThoai(pathname) && "max-md:hidden",
      )}
    >
      <div className="site-header-inner wrap flex min-h-16 items-center gap-2 py-2 sm:min-h-20 sm:gap-3">
        {goc ? (
          <BrandMark />
        ) : (
          <>
            <DauTrangCon pathname={pathname} />
            <span className="hidden xl:contents">
              <BrandMark />
            </span>
          </>
        )}

        <nav aria-label="Điều hướng chính" className="menu-chinh ml-auto hidden items-center gap-1 xl:flex">
          {MAIN_NAV.map((item) => (
            <span key={item.to}>{lienKet(item)}</span>
          ))}
        </nav>

        {/* Thứ tự bên phải: mục "Tôi" (cuối cùng). */}
        <div className="site-account ml-auto flex shrink-0 items-center gap-1 xl:ml-2">
          <span className="site-notification-slot">
            {nguoiDung && !nguoiDung.cho_xac_minh ? (
              <Link
                to="/toi#nhac-hoc"
                aria-label="Nhắc học và thông báo"
                className="grid size-11 place-items-center rounded-lg text-secondary hover:bg-secondary-soft"
              >
                <Icon name="bell" kieu="net" className="size-5" />
              </Link>
            ) : null}
          </span>
          {/* Từ 768px: mục "Tôi" (hoặc "Đăng nhập") của menu, đứng sau các nút khác. */}
          <div className="relative hidden xl:block" ref={taiKhoanRef}>
            {nguoiDung ? (
              <>
                <button
                  ref={nutTaiKhoanRef}
                  type="button"
                  aria-expanded={moTaiKhoan}
                  aria-controls="menu-tai-khoan"
                  className={cn(navClass(dangOMuc(toi, pathname)), "site-account-action")}
                  onClick={() => setMoTaiKhoan((mo) => !mo)}
                >
                  <AnhDaiDien nguoiDung={nguoiDung} className="mr-2 size-7 shrink-0 text-[13px]" />
                  <span className="site-account-name">{hoTen}</span>
                  <Icon name="chevronDown" className="ml-2 size-4" />
                </button>
                {moTaiKhoan ? (
                  <div
                    id="menu-tai-khoan"
                    className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-card"
                  >
                    <Link
                      to={toi.to}
                      onClick={() => setMoTaiKhoan(false)}
                      className={navClass(pathname === toi.to, true)}
                    >
                      <Icon name="user" kieu="net" className="mr-2 size-4" /> Hồ sơ của tôi
                    </Link>
                    <Link
                      to="/tai-khoan"
                      onClick={() => setMoTaiKhoan(false)}
                      className={navClass(pathname === "/tai-khoan", true)}
                    >
                      <Icon name="lock" kieu="net" className="mr-2 size-4" /> Tài khoản và mật khẩu
                    </Link>
                  </div>
                ) : null}
              </>
            ) : (
              lienKet(toi)
            )}
          </div>
          {/* Ảnh đại diện dẫn tới trang cá nhân; từ 768px đã có trong mục "Tôi" ở trên. */}
          {nguoiDung ? (
            <Link
              to={toi.to}
              aria-label="Trang cá nhân"
              className="grid size-11 shrink-0 place-items-center rounded-full xl:hidden"
            >
              <AnhDaiDien nguoiDung={nguoiDung} className="size-8 text-sm" />
            </Link>
          ) : null}
          {/* Menu drawer cho màn hình chưa đủ chỗ đặt điều hướng ngang. */}
          <NganTienIch nguoiDung={nguoiDung} />
        </div>
      </div>
    </header>
  );
}
