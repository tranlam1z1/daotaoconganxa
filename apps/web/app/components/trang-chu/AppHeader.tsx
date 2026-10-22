import { Link } from "react-router";

import type { NguoiDung } from "../../lib/types";
import { ButtonLink } from "../ui/Button";
import { LogoHocTap } from "../ui/LogoHocTap";

/**
 * Băng chào đầu trang chủ, ngay dưới thanh đầu trang (SiteHeader): nền theo giao diện sáng/tối
 * (lớp .bang-chao và token --chao-* trong app.css), lời chào và đoạn giới thiệu.
 */
export function AppHeader({ nguoiDung }: { nguoiDung: NguoiDung | null }) {
  const hoTen = nguoiDung ? (nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email) : null;
  return (
    <section className="bang-chao relative overflow-hidden rounded-2xl border border-line p-6 text-ink shadow-card sm:p-8">
      <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
            <span aria-hidden="true" className="size-2 rounded-full bg-ok" />
            Dành cho cán bộ cấp xã · Thanh Hóa
          </p>
          <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">
            {hoTen ? `Xin chào, ${hoTen}` : "Học vững pháp luật, nâng cao nghiệp vụ"}
          </h1>
          {nguoiDung?.cho_xac_minh ? (
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-2">
              Tài khoản chưa được xác minh cán bộ. Tra cứu và bộ công cụ dùng được ngay; học, luyện tập và thi
              mở sau khi được duyệt.{" "}
              <Link to="/tai-khoan" className="font-medium text-primary underline underline-offset-2">
                Xem trạng thái xác minh
              </Link>
            </p>
          ) : nguoiDung ? (
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-2">
              Chào mừng đồng chí quay trở lại. Hãy rèn luyện phản xạ xử lý tình huống và củng cố kiến thức
              pháp luật chuyên ngành hôm nay.
            </p>
          ) : (
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-2">
              Tra cứu pháp luật và sử dụng công cụ nghiệp vụ ngay. Đăng nhập bằng tài khoản cán bộ đã được xác
              minh để học, luyện tập và thi.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink
              to={nguoiDung?.cho_xac_minh ? "/tai-khoan" : nguoiDung ? "/luyen-tap" : "/dang-nhap"}
              icon="book"
            >
              {nguoiDung?.cho_xac_minh
                ? "Xem trạng thái tài khoản"
                : nguoiDung
                  ? "Tiếp tục học tập"
                  : "Đăng nhập để học tập"}
            </ButtonLink>
            <ButtonLink to="/tra-cuu" variant="secondary" icon="search">
              Tra cứu pháp luật
            </ButtonLink>
          </div>
        </div>
        <div
          className="hidden w-48 flex-col items-center gap-3 border-l border-line pl-8 md:flex lg:w-56"
          aria-hidden="true"
        >
          <LogoHocTap className="w-36 lg:w-40" />
          <span className="text-center text-xs font-semibold uppercase tracking-wider text-primary">
            Học tập pháp luật &amp;
            <br />
            bồi dưỡng nghiệp vụ
          </span>
        </div>
      </div>
    </section>
  );
}
