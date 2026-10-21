import { Link } from "react-router";

import { MAIN_NAV, SITE_NAME } from "../../lib/site";

export function SiteFooter() {
  return (
    // Dưới 768px ẩn: liên kết đã có ở thanh dưới cùng và ngăn tiện ích ở trang chủ.
    // Khu quản trị: lùi vào bằng bề rộng cột điều hướng cố định (--cot-trai, styles/app.css).
    <footer className="no-print mt-20 hidden border-t border-line pl-[var(--cot-trai)] md:block">
      <div className="wrap grid gap-8 py-10 text-sm text-ink-2 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-serif text-base font-semibold text-ink">{SITE_NAME}</p>
          <p className="mt-3 max-w-md leading-relaxed">
            Nội dung do hệ thống tạo (bản hợp nhất tự động, câu trả lời, bài học) là thông tin tham khảo. Căn
            cứ chính thức để viện dẫn và áp dụng là văn bản hợp nhất do cơ quan nhà nước ban hành hoặc chính
            các văn bản được hợp nhất.
          </p>
        </div>
        <nav aria-label="Liên kết cuối trang">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
            {MAIN_NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex min-h-9 items-center underline-offset-4 hover:text-ink hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/hoi-dap"
                className="flex min-h-9 items-center underline-offset-4 hover:text-ink hover:underline"
              >
                Hỏi trợ lý AI
              </Link>
            </li>
            <li>
              <Link
                to="/huong-dan"
                className="flex min-h-9 items-center underline-offset-4 hover:text-ink hover:underline"
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
