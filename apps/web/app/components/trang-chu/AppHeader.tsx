import { Link } from "react-router";

import type { NguoiDung } from "../../lib/types";

/**
 * Băng chào đầu trang chủ, ngay dưới thanh đầu trang (SiteHeader): nền theo giao diện sáng/tối
 * (lớp .bang-chao và token --chao-* trong app.css), lời chào và đoạn giới thiệu.
 * Cấp và XP xem ở trang /toi, không nhắc lại ở đây.
 */
export function AppHeader({ nguoiDung }: { nguoiDung: NguoiDung | null }) {
  const hoTen = nguoiDung ? (nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email) : null;
  return (
    <section className="bang-chao rounded-2xl border border-line p-6 text-ink shadow-card sm:p-8">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          Hệ thống học tập nghiệp vụ {new Date().getFullYear()}
        </p>
        <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">
          {hoTen ? `Xin chào, ${hoTen}` : "Xin chào"}
        </h1>
        {nguoiDung?.cho_xac_minh ? (
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-2">
            Tài khoản chưa được xác minh cán bộ. Tra cứu và bộ công cụ dùng được ngay; học, luyện tập, trò
            chơi và thi mở sau khi được duyệt.{" "}
            <Link to="/tai-khoan" className="font-medium text-primary underline underline-offset-2">
              Xem trạng thái xác minh
            </Link>
          </p>
        ) : nguoiDung ? (
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-2">
            Chào mừng đồng chí quay trở lại. Hãy rèn luyện phản xạ xử lý tình huống và củng cố kiến thức pháp
            luật chuyên ngành hôm nay.
          </p>
        ) : (
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-2">
            Tra cứu &amp; Học tập pháp luật dành cho cán bộ. Tra cứu và bộ công cụ không cần đăng nhập.{" "}
            <Link to="/dang-nhap" className="font-medium text-primary underline underline-offset-2">
              Đăng nhập
            </Link>{" "}
            bằng tài khoản cán bộ đã được xác minh để học, luyện tập và thi.
          </p>
        )}
      </div>
    </section>
  );
}
