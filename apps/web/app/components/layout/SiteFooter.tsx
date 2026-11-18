import { Link } from "react-router";

import { MAIN_NAV } from "../../lib/site";
import { BrandName } from "../ui/BrandName";
import { LogoHocTap } from "../ui/LogoHocTap";

export function SiteFooter() {
  return (
    // Dùng chung trên desktop, mobile và các trạng thái lỗi.
    // Khu quản trị: lùi vào bằng bề rộng cột điều hướng cố định (--cot-trai, styles/app.css).
    <footer className="site-footer no-print w-full shrink-0 pl-[var(--cot-trai)]">
      <div className="wrap grid items-center gap-x-8 gap-y-4 py-4 text-xs leading-[1.5] text-white/90 md:grid-cols-[1fr_1.2fr] xl:grid-cols-[1.05fr_1.25fr_1fr] xl:gap-x-12">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <LogoHocTap variant="trang" className="h-14 w-auto shrink-0" />
          <BrandName inverse />
        </Link>
        <p className="max-w-md">
          Nội dung do hệ thống tạo (bản hợp nhất tự động, câu trả lời, bài học) là thông tin tham khảo. Căn cứ
          chính thức để viện dẫn và áp dụng là văn bản hợp nhất do cơ quan nhà nước ban hành hoặc chính các
          văn bản được hợp nhất.
        </p>
        <nav
          aria-label="Liên kết cuối trang"
          className="md:col-span-2 md:border-t md:border-white/25 md:pt-3 xl:col-span-1 xl:border-t-0 xl:border-l xl:pl-12 xl:pt-0"
        >
          <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            {MAIN_NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="inline-flex items-center underline-offset-4 hover:text-white hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/huong-dan"
                className="inline-flex items-center underline-offset-4 hover:text-white hover:underline"
              >
                Hướng dẫn sử dụng
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
