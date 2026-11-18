import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "../../lib/cn";
import { BOTTOM_NAV, dangOMuc } from "../../lib/site";
import { Icon } from "../ui/Icon";
import { LogoHocTap } from "../ui/LogoHocTap";

const O_NHAP =
  "input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=range]), textarea, select";

/**
 * Bàn phím ảo đang mở: ô nhập đang được chọn trên màn cảm ứng, hoặc visualViewport co lại rõ
 * rệt. Khi đó thanh dưới cùng ẩn để không đè lên ô nhập.
 */
function useBanPhimMo(): boolean {
  const [mo, setMo] = useState(false);
  useEffect(() => {
    const camUng = window.matchMedia("(pointer: coarse)");
    const vv = window.visualViewport;
    const capNhat = () => {
      const dangNhap = camUng.matches && Boolean(document.activeElement?.matches(O_NHAP));
      const coLai = vv ? window.innerHeight - vv.height > 150 : false;
      setMo(dangNhap || coLai);
    };
    // focusout xảy ra trước khi phần tử mới nhận focus: đợi một nhịp mới đọc activeElement.
    const sau = () => setTimeout(capNhat, 0);
    document.addEventListener("focusin", capNhat);
    document.addEventListener("focusout", sau);
    vv?.addEventListener("resize", capNhat);
    return () => {
      document.removeEventListener("focusin", capNhat);
      document.removeEventListener("focusout", sau);
      vv?.removeEventListener("resize", capNhat);
    };
  }, []);
  return mo;
}

/** Vuốt quá chừng này (px) theo một hướng mới ẩn hoặc hiện thanh, để tay rung nhẹ không làm thanh giật. */
const NGUONG_VUOT = 10;
/** Trong chừng này (px) ở đầu trang thanh luôn hiện. */
const VUNG_DAU_TRANG = 64;

/**
 * Ẩn thanh khi cuộn xuống (vuốt lên), hiện lại khi cuộn lên (vuốt xuống), ở gần đầu trang và khi chạm
 * cuối trang. Riêng PWA thì thanh luôn hiện. Lúc ẩn, thuộc tính data-an-thanh-duoi trên <html> hạ biến --thanh-duoi-noi về 0 để nút
 * nổi, toast và thanh nút dính đáy trượt xuống theo (app.css).
 */
function useAnKhiCuon(): [boolean, () => void] {
  const [an, setAn] = useState(false);
  useEffect(() => {
    // Ứng dụng cài trên máy (PWA): thanh luôn cố định ở đáy, không ẩn khi cuộn.
    const pwa =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (pwa) return;
    let truoc = window.scrollY;
    let donVuot = 0;
    let cho = 0;
    const capNhat = () => {
      cho = 0;
      const y = window.scrollY;
      const lech = y - truoc;
      truoc = y;
      const cuoiTrang = y + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (y < VUNG_DAU_TRANG || cuoiTrang) {
        donVuot = 0;
        setAn(false);
        return;
      }
      // Đổi hướng cuộn thì đếm lại từ đầu.
      donVuot = Math.sign(lech) === Math.sign(donVuot) ? donVuot + lech : lech;
      if (donVuot > NGUONG_VUOT) setAn(true);
      else if (donVuot < -NGUONG_VUOT) setAn(false);
    };
    const henCapNhat = () => {
      if (!cho) cho = requestAnimationFrame(capNhat);
    };
    window.addEventListener("scroll", henCapNhat, { passive: true });
    return () => {
      window.removeEventListener("scroll", henCapNhat);
      if (cho) cancelAnimationFrame(cho);
    };
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-an-thanh-duoi", an);
  }, [an]);
  useEffect(() => () => document.documentElement.removeAttribute("data-an-thanh-duoi"), []);

  return [an, () => setAn(false)];
}

const lopMuc = (active: boolean) =>
  cn(
    "group lun [--lun:0.92] relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-card pb-2 text-[clamp(11px,3vw,14px)] font-medium leading-tight tracking-tight whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    active ? "font-semibold text-primary" : "text-ink-2 hover:text-primary",
  );

/**
 * Thanh điều hướng dưới cùng, chỉ hiện dưới 768px. Nơi gọi quyết định trang nào có thanh.
 * Năm mục Tra cứu · Học · Trang chủ · Thi · Tôi; Trang chủ ở giữa là nút tròn có logo nổi lên trên
 * mép thanh. Các trang phụ (ngăn "Thêm" cũ) nằm ở ngăn tiện ích của trang chủ.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const banPhim = useBanPhimMo();
  const [anCuon, hienLai] = useAnKhiCuon();

  return (
    <>
      {/*
       * Lớp mờ sau thanh: từ đáy màn hình lên quá đỉnh thanh 1rem, nội dung cuộn bên dưới bị nhòe và nhạt
       * dần về đáy. Mặt nạ cho phần trên mờ dần để không có mép cứng. z-[5]: dưới thanh nút dính đáy (z-10).
       */}
      <div
        aria-hidden="true"
        className={cn(
          "menu-chinh no-print pointer-events-none fixed inset-x-0 bottom-0 z-[5] h-[calc(var(--thanh-duoi)+1rem)] bg-linear-to-t from-canvas via-canvas/70 to-transparent backdrop-blur-md transition-opacity duration-200 [mask-image:linear-gradient(to_top,black_55%,transparent)] motion-reduce:transition-none md:hidden",
          (banPhim || anCuon) && "opacity-0",
        )}
      />
      <nav
        aria-label="Điều hướng chính"
        className={cn(
          // Thanh lơ lửng: cách mép trái/phải 12px, đáy 9px (cộng thêm vùng thanh home của iPhone), bo góc, đổ bóng.
          "menu-chinh no-print fixed inset-x-3 bottom-[calc(9px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg transition-transform duration-200 motion-reduce:transition-none md:hidden",
          // Lúc ẩn trượt thêm 3rem để cả nút tròn nổi ở giữa cũng khuất hẳn.
          (banPhim || anCuon) && "translate-y-[calc(100%+3rem+env(safe-area-inset-bottom))]",
        )}
        aria-hidden={banPhim || undefined}
        // Đang ẩn do cuộn mà người dùng Tab tới thì hiện lại.
        onFocus={hienLai}
      >
        {/* Vẽ liền phần vòm giữa và thân thanh để không lộ đường nối. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 500 94"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 -top-6 h-[calc(100%+1.5rem)] w-full overflow-visible fill-surface stroke-primary/10 [filter:drop-shadow(0_8px_12px_color-mix(in_srgb,var(--primary)_15%,transparent))]"
        >
          <path d="M27 25H211C217 25 217 22 220 17C233-5 267-5 280 17C283 22 283 25 289 25H473C488 25 499 37 499 52V66C499 81 488 93 473 93H27C12 93 1 81 1 66V52C1 37 12 25 27 25Z" />
        </svg>
        <ul className="relative flex h-[4.25rem] items-stretch px-2">
          {BOTTOM_NAV.map((item) => {
            const active = dangOMuc(item, pathname);
            const giua = item.to === "/";
            return (
              <li key={item.to} className="flex min-w-0 flex-1">
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  tabIndex={banPhim ? -1 : undefined}
                  // Mục giữa dồn xuống đáy: chữ thẳng hàng với các mục khác, nút tròn tràn lên quá mép thanh.
                  className={cn(lopMuc(active), giua && "justify-end")}
                >
                  {giua ? (
                    <span
                      className={cn(
                        // Bản đảo (khiên kem) trên nền xanh chủ đạo.
                        "brand-home-button absolute bottom-7 grid size-[3.75rem] shrink-0 place-items-center rounded-full bg-primary shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_22%,transparent)] transition-opacity",
                        active ? "opacity-100" : "opacity-90",
                      )}
                    >
                      <LogoHocTap variant="trang" className="h-auto w-12" />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "grid size-8 place-items-center transition-colors group-active:text-primary",
                      )}
                    >
                      {item.icon === "user" ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-7"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <circle cx="12" cy="9" r="3" />
                          <path d="M5.5 18a7 7 0 0 1 13 0" />
                        </svg>
                      ) : (
                        <Icon name={item.icon} sac="trung" kieu="net" className="size-7 !text-current" />
                      )}
                    </span>
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
