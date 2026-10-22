import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

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
  SITE_TAGLINE,
} from "../../lib/site";
import type { NguoiDung } from "../../lib/types";
import { AnhDaiDien } from "../ui/AnhDaiDien";
import { Icon } from "../ui/Icon";
import { LogoHocTap } from "../ui/LogoHocTap";
import { NganTienIch } from "./NganTienIch";

export function BrandMark() {
  // Điện thoại: tên được co lại (cắt bằng "…") khi chip điểm, chuông, ảnh đại diện hết chỗ.
  return (
    <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2.5 md:shrink-0">
      <LogoHocTap className="h-9 w-auto shrink-0 min-[400px]:h-10" />
      {/* 768–1023px: menu ngang, chip điểm và các nút hết chỗ, chỉ giữ logo (tên vẫn đọc được). */}
      <span className="flex min-w-0 flex-col py-1 md:max-lg:sr-only">
        <span className="truncate font-display text-[13px] font-bold uppercase leading-tight tracking-wide text-primary min-[400px]:text-[15px]">
          {SITE_NAME}
        </span>
        <span className="truncate text-[10px] uppercase leading-tight tracking-[0.14em] text-ink-2 min-[400px]:text-[11px]">
          {SITE_TAGLINE}
        </span>
      </span>
    </Link>
  );
}

function navClass(active: boolean) {
  return cn(
    "lun flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-[15px] font-medium",
    active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
  );
}

/** Mục điều hướng chứa trang hiện tại (để làm tiêu đề tạm và đích quay lại khi không có lịch sử). */
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
  const navigate = useNavigate();
  const cha = mucCha(pathname);
  const [tieuDe, setTieuDe] = useState(cha.label);

  // biome-ignore lint/correctness/useExhaustiveDependencies: đọc lại tiêu đề mỗi khi đổi trang
  useEffect(() => {
    const t = document.title;
    setTieuDe(t.endsWith(DUOI_TIEU_DE) ? t.slice(0, -DUOI_TIEU_DE.length) : t || cha.label);
  }, [pathname]);

  return (
    <div className="flex min-w-0 items-center gap-1 md:hidden">
      <Link
        // Đang ở chính trang mục (vd /tra-cuu) thì đích quay lại là trang chủ.
        to={cha.to === pathname ? "/" : cha.to}
        aria-label="Quay lại"
        onClick={(e) => {
          // Có trang trước trong ứng dụng thì lùi lại đúng trang đó, không thì về mục cha.
          if ((window.history.state?.idx ?? 0) > 0) {
            e.preventDefault();
            navigate(-1);
          }
        }}
        className="lun -ml-2 grid size-11 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <Icon name="arrowLeft" className="size-6" />
      </Link>
      <span className="truncate text-base font-semibold">{tieuDe}</span>
    </div>
  );
}

/**
 * Menu cán bộ gồm đúng 4 mục: Tra cứu · Luyện tập · Thi · Tôi (docs/PLAN.md §0.4).
 * Mục "Tôi" dẫn tới trang học tập của tôi (GĐ4, có liên kết sang tài khoản), hoặc tới trang đăng
 * nhập khi chưa đăng nhập.
 *
 * Dưới 768px menu nằm ở thanh dưới cùng (BottomNav, chỉ ở trang chủ); đầu trang chỉ còn tên trang web (trang chủ)
 * hoặc nút quay lại + tiêu đề (các trang khác), cùng chip điểm và chuông thông báo.
 */
export function SiteHeader({ nguoiDung }: { nguoiDung: NguoiDung | null }) {
  const { pathname } = useLocation();
  const goc = laTrangGoc(pathname);

  // Tài khoản chưa được xác minh không có trang Tôi: mục này dẫn thẳng tới trang Tài khoản.
  const toi: NavItem = nguoiDung
    ? { to: nguoiDung.cho_xac_minh ? "/tai-khoan" : "/toi", label: "Tôi", khop: ["/tai-khoan"] }
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
        className={navClass(active)}
      >
        {item === toi && nguoiDung ? (
          <>
            {/* Nền đặc: mục đang chọn có nền primary-soft, ảnh đại diện cùng màu sẽ chìm mất. */}
            <AnhDaiDien nguoiDung={nguoiDung} className="mr-2 size-7 shrink-0 text-[13px]" />
            {/* Tên và đơn vị thay cho chữ "Tôi"; tên dài thì cắt bằng "…", rê chuột xem đủ. */}
            <span className="flex min-w-0 max-w-36 flex-col leading-tight lg:max-w-48">
              <span className="truncate">{hoTen}</span>
              {nguoiDung.don_vi ? (
                <span className="truncate text-xs font-normal text-ink-2">{nguoiDung.don_vi.ten}</span>
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
    // Vạch màu dưới đầu trang lấy theo thứ tự màu trong logo: xanh dương → xanh lá → vàng.
    <header
      className={cn(
        "no-print sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md",
        anDauTrangDienThoai(pathname) && "max-md:hidden",
      )}
    >
      <div className="wrap flex h-16 items-center gap-3">
        {goc ? (
          <BrandMark />
        ) : (
          <>
            <DauTrangCon pathname={pathname} />
            <span className="hidden md:contents">
              <BrandMark />
            </span>
          </>
        )}

        <nav aria-label="Điều hướng chính" className="menu-chinh ml-auto hidden items-center gap-1 md:flex">
          {MAIN_NAV.map((item) => (
            <span key={item.to}>{lienKet(item)}</span>
          ))}
        </nav>

        {/* Thứ tự bên phải: mục "Tôi" (cuối cùng). */}
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-2">
          {/* Từ 768px: mục "Tôi" (hoặc "Đăng nhập") của menu, đứng sau các nút khác. */}
          <span className="hidden md:block">{lienKet(toi)}</span>
          {/* Ảnh đại diện dẫn tới trang cá nhân; từ 768px đã có trong mục "Tôi" ở trên. */}
          {nguoiDung ? (
            <Link
              to="/toi"
              aria-label="Trang cá nhân"
              className="grid size-11 shrink-0 place-items-center rounded-full md:hidden"
            >
              <AnhDaiDien nguoiDung={nguoiDung} className="size-8 text-sm" />
            </Link>
          ) : null}
          {/* Dưới 768px, chỉ ở trang chủ: nút ☰ mở ngăn tiện ích bên phải. */}
          {nguoiDung && pathname === "/" ? <NganTienIch nguoiDung={nguoiDung} /> : null}
        </div>
      </div>
      {/* Vạch màu thương hiệu ngay dưới thanh đầu trang. */}
      <div aria-hidden="true" className="h-[3px] bg-linear-to-r from-primary via-[#1E9E4A] to-[#FFC107]" />
    </header>
  );
}
