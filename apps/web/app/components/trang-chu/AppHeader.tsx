import { Link } from "react-router";

import type { NguoiDung } from "../../lib/types";
import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { LogoHocTap } from "../ui/LogoHocTap";

/**
 * Băng chào đầu trang chủ, ngay dưới thanh đầu trang (SiteHeader): nền theo giao diện sáng/tối
 * (ảnh nền và lớp phủ .bang-chao trong app.css), lời chào và đoạn giới thiệu.
 */
export function AppHeader({ nguoiDung }: { nguoiDung: NguoiDung | null }) {
  const hoTen = nguoiDung ? (nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email) : null;
  return (
    <section className="bang-chao-khung overflow-hidden rounded-xl border border-line text-ink shadow-card">
      <div className="grid items-stretch md:grid-cols-[1fr_215px]">
        <div className="bang-chao relative min-w-0 px-5 py-5 sm:px-8">
          <div className="relative z-10 lg:max-w-[62%]">
            <p className="text-[11px] font-bold uppercase leading-4 text-primary">
              Dành cho công chức, viên chức, đảng viên
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-[28px]">
              {hoTen ? `Xin chào, ${hoTen}` : "Học tập và tra cứu phục vụ công tác"}
            </h1>
            {nguoiDung?.cho_xac_minh ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                Tài khoản chưa được xác minh cán bộ. Tra cứu và bộ công cụ dùng được ngay; học, luyện tập và
                thi mở sau khi được duyệt.{" "}
                <Link to="/tai-khoan" className="font-medium text-primary underline underline-offset-2">
                  Xem trạng thái xác minh
                </Link>
              </p>
            ) : nguoiDung ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                Cổng hỗ trợ học tập pháp luật, tra cứu nghiệp vụ và công cụ phục vụ công tác hằng ngày.
                <br />
                Nội dung học tập dành cho công chức, viên chức và đảng viên.
              </p>
            ) : (
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-2">
                Tra cứu pháp luật và sử dụng công cụ nghiệp vụ ngay. Đăng nhập bằng tài khoản cán bộ đã được
                xác minh để học, luyện tập và thi.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {" "}
              <ButtonLink
                to={nguoiDung?.cho_xac_minh ? "/tai-khoan" : nguoiDung ? "/hoc" : "/dang-nhap"}
                icon="book"
              >
                {nguoiDung?.cho_xac_minh
                  ? "Xem trạng thái tài khoản"
                  : nguoiDung
                    ? "Xem bài học"
                    : "Đăng nhập để học tập"}
                <Icon name="chevronRight" kieu="net" className="ml-2 size-4" />
              </ButtonLink>
              <ButtonLink to="/tra-cuu" variant="secondary" icon="search">
                Tra cứu pháp luật
              </ButtonLink>
            </div>
          </div>
          <div
            className="bang-chao-khau-hieu absolute right-5 top-12 hidden text-center lg:block"
            aria-hidden="true"
          >
            <p>
              “Thượng tôn pháp luật
              <br />
              Vì nhân dân phục vụ”
            </p>
            <span className="mx-auto mt-3 block h-0.5 w-16 bg-amber-400" />
          </div>
        </div>
        <div
          className="bang-chao-logo hidden flex-col items-center justify-center gap-2 border-l border-line px-4 py-5 md:flex"
          aria-hidden="true"
        >
          <LogoHocTap className="w-32" />
          <span className="text-center text-xs font-bold uppercase leading-tight text-primary">
            Học tập pháp luật &amp;
            <br />
            bồi dưỡng nghiệp vụ
            <span className="mt-1 block text-[9px] font-semibold tracking-widest">Cấp xã tỉnh Thanh Hóa</span>
          </span>
        </div>
      </div>
    </section>
  );
}
