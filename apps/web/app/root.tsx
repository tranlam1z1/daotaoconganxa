import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import "./styles/app.css";
import type { Route } from "./+types/root";
import { BottomNav } from "./components/layout/BottomNav";
import { NutLenDauTrang } from "./components/layout/NutLenDauTrang";
import { SiteFooter } from "./components/layout/SiteFooter";
import { SiteHeader } from "./components/layout/SiteHeader";
import { ThanhTaiTrang } from "./components/layout/ThanhTaiTrang";
import { TrangThaiMang } from "./components/layout/TrangThaiMang";
import { buttonClass } from "./components/ui/Button";
import { KhungTrang, TieuDeTrang } from "./components/ui/KhungTrang";
import { VungThongBaoNhanh } from "./components/ui/ThongBaoNhanh";
import { nguoiDungHienTai } from "./lib/auth.server";
import { cn } from "./lib/cn";
import { urlTrang } from "./lib/session.server";
import { coCotTrai, coThanhDuoi, SITE_NAME_SHORT } from "./lib/site";

// Font tự lưu trong styles/fonts.css (docs/VISUAL_STYLE.md §2.4): tệp nằm trong bản build nên
// service worker giữ được khi offline, không còn tải từ Google Fonts.
export const links: Route.LinksFunction = () => [];

/**
 * Danh tính người đang xem, cho thanh đầu trang. Không lấy được thì null: tra cứu là dịch vụ
 * công, trang không được hỏng theo phần đăng nhập.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const nguoiDung = await nguoiDungHienTai(request);
  // Tài khoản đang dùng mật khẩu tạm: mọi trang chuyển về trang đổi mật khẩu (API cũng chặn,
  // đây chỉ để người dùng không gặp lỗi 403 ở từng trang).
  const { pathname, search } = urlTrang(request);
  if (nguoiDung?.phai_doi_mat_khau && pathname !== "/doi-mat-khau" && pathname !== "/dang-xuat") {
    throw redirect(`/doi-mat-khau?tiep=${encodeURIComponent(pathname + search)}`);
  }
  return { nguoiDung };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="light">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0052CC" />
        {/* Cài lên màn hình chính (docs/PLAN.md GĐ13). */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/svg+xml" href="/logo.svg?v=4" />
        <link rel="icon" type="image/png" sizes="48x48" href="/icons/icon-48.png?v=4" />
        {/* Icon iPhone, iPad; "?v=" đổi mỗi lần sinh lại icon (scripts/pwa-icons.ts). */}
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120.png?v=4" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152.png?v=4" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167.png?v=4" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=4" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Học tập pháp luật" />
        <Meta />
        <Links />
      </head>
      <body>
        <a
          href="#noi-dung-chinh"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-on-primary"
        >
          Bỏ qua điều hướng, tới nội dung chính
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/** Phím tắt "/" đưa con trỏ vào ô tìm kiếm có id "o-tim-kiem" (nếu trang hiện tại có ô đó). */
function useSearchShortcut() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const box = document.getElementById("o-tim-kiem") as HTMLInputElement | null;
      if (!box) return;
      event.preventDefault();
      box.focus();
      box.select();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

export default function App({ loaderData }: Route.ComponentProps) {
  useSearchShortcut();
  const { pathname } = useLocation();
  const nguoiDung = loaderData?.nguoiDung ?? null;
  const thanhDuoi = coThanhDuoi(pathname);
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        thanhDuoi && "co-thanh-duoi",
        coCotTrai(pathname) && "co-cot-trai",
        // Đánh dấu trạng thái đăng nhập cho các thành phần giao diện.
        !nguoiDung && "chua-dang-nhap",
      )}
    >
      <ThanhTaiTrang />
      <SiteHeader nguoiDung={nguoiDung} />
      <TrangThaiMang daDangNhap={Boolean(loaderData?.nguoiDung && !loaderData.nguoiDung.cho_xac_minh)} />
      <main id="noi-dung-chinh" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      {/* Điện thoại: thanh điều hướng dưới cùng thay cho menu trên đầu trang. */}
      {thanhDuoi ? <BottomNav /> : null}
      <NutLenDauTrang />
      <VungThongBaoNhanh />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Không có dữ liệu mẫu thay thế: báo lỗi còn hơn để người đọc tưởng nội dung minh hoạ là quy
  // định pháp luật. Chỉ nói vấn đề, không lộ thông báo thô của máy chủ (trừ khi đang phát triển).
  let title = "Không tải được dữ liệu";
  let detail = "Vui lòng thử lại sau.";
  // Mất mạng giữa lúc chuyển trang (docs/PLAN.md GĐ13): nói rõ là cần mạng, không báo lỗi chung.
  // Chỉ xét ở trình duyệt: Bun cũng có `navigator` nhưng không có `onLine`, máy chủ sẽ tưởng mất mạng.
  const matMang = typeof window !== "undefined" && navigator.onLine === false;

  if (matMang) {
    return (
      <main id="noi-dung-chinh" tabIndex={-1} className="focus:outline-none">
        <KhungTrang className="wrap max-w-2xl py-8">
          <TieuDeTrang icon="alert">Cần có mạng</TieuDeTrang>
          <p className="mt-3 text-ink-2">
            Trang này cần kết nối mạng. Trong lúc chờ, bạn vẫn luyện tập được các chủ đề đã tải về máy.
          </p>
          {/* Liên kết HTML vẫn hoạt động khi router hoặc module phía client gặp lỗi. */}
          <a href="/luyen-tap/offline" className={buttonClass({ className: "mt-8 min-h-12" })}>
            Luyện tập không cần mạng
          </a>
        </KhungTrang>
      </main>
    );
  }

  if (isRouteErrorResponse(error) && error.status === 404) {
    title = "Không tìm thấy trang";
    detail = "Đường dẫn không tồn tại hoặc văn bản đã chuyển sang địa chỉ khác.";
  } else if (isRouteErrorResponse(error) && error.status === 403) {
    title = "Không đủ quyền";
    detail = typeof error.data === "string" ? error.data : "Tài khoản không đủ quyền xem trang này.";
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }

  return (
    <main id="noi-dung-chinh" tabIndex={-1} className="focus:outline-none">
      <KhungTrang className="wrap max-w-2xl py-8">
        {/* Trang lỗi không chạy meta() của route nên tự đặt tiêu đề; React đưa thẻ này lên <head>. */}
        <title>{`${title} | ${SITE_NAME_SHORT}`}</title>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-seal">
          {isRouteErrorResponse(error) ? `Mã ${error.status}` : "Lỗi"}
        </p>
        <TieuDeTrang icon="alert">{title}</TieuDeTrang>
        <p className="mt-3 text-ink-2">{detail}</p>
        <a href="/" className={buttonClass({ className: "mt-8" })}>
          Về trang chủ
        </a>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={buttonClass({ variant: "secondary", className: "mt-8 ml-3" })}
        >
          Tải lại trang
        </button>
      </KhungTrang>
    </main>
  );
}
