import { useState } from "react";
import { Link } from "react-router";

import type { NguoiDung } from "../../lib/types";
import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";

/** Hero trang chủ, giữ lời chào và CTA theo trạng thái tài khoản thực tế. */
export function AppHeader({ nguoiDung }: { nguoiDung: NguoiDung | null }) {
  const [loiAnh, setLoiAnh] = useState(false);
  const hoTen = nguoiDung ? (nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email) : null;
  return (
    <section className="home-hero">
      <span className="home-hero-lotus home-hero-lotus-left" aria-hidden="true" />
      <span className="home-hero-lotus home-hero-lotus-right" aria-hidden="true" />
      <div className="home-container home-hero-grid">
        <div className="relative min-w-0 py-8 sm:py-12">
          <div className="relative z-10">
            <p className="home-eyebrow">Dành cho công chức, viên chức, đảng viên</p>
            <h1 className="home-title">
              {hoTen ? (
                `Xin chào, ${hoTen}`
              ) : (
                <>
                  Học tập và tra cứu <span className="text-primary">phục vụ công tác</span>
                </>
              )}
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
        </div>
        <figure className="home-hero-visual">
          {loiAnh ? (
            <div className="home-building-placeholder">
              <Icon name="home" kieu="net" className="size-10" />
              <p>Không tải được hình minh họa trụ sở</p>
            </div>
          ) : (
            <div className="home-building-art">
              <svg
                viewBox="1010 15 705 510"
                role="img"
                aria-label="Hình minh họa tòa nhà hành chính từ bộ tài nguyên được cung cấp"
              >
                <image
                  href="/assets/vietnam-banner-resources.png"
                  width={1735}
                  height={906}
                  onError={() => setLoiAnh(true)}
                />
              </svg>
            </div>
          )}
          <figcaption>
            “Thượng tôn pháp luật
            <br />
            Vì nhân dân phục vụ”
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
