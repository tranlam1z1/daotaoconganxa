import { Link } from "react-router";

import { ngayCongVan } from "../../lib/format";
import type { NguoiDung } from "../../lib/types";
import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";

/**
 * Đầu trang chủ theo hướng "Công văn" (docs/DESIGN_SYSTEM.md), mượn bố cục phần đầu một công văn:
 * hàng trên là "tên cơ quan" (đơn vị của người dùng, gạch đỏ son bên dưới) bên trái và khẩu hiệu
 * (nét vàng bên dưới) cùng dòng ngày tháng in nghiêng bên phải; hàng dưới là lời chào, mô tả và hai
 * nút. Chỉ có chữ trên nền giấy, không ảnh trang trí.
 */
export function AppHeader({ nguoiDung, now }: { nguoiDung: NguoiDung | null; now: number }) {
  const hoTen = nguoiDung ? (nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email) : null;
  const ngay = ngayCongVan(now);
  const nutChinh = nguoiDung?.cho_xac_minh
    ? { to: "/tai-khoan", nhan: "Xem trạng thái tài khoản" }
    : nguoiDung
      ? { to: "/hoc", nhan: "Xem bài học" }
      : { to: "/dang-nhap", nhan: "Đăng nhập để học tập" };
  const moTa = nguoiDung?.cho_xac_minh ? (
    <>
      Tài khoản chưa được xác minh cán bộ. Tra cứu và bộ công cụ dùng được ngay; học, luyện tập và thi mở
      sau khi được duyệt.{" "}
      <Link to="/tai-khoan" className="font-semibold underline underline-offset-2">
        Xem trạng thái xác minh
      </Link>
    </>
  ) : nguoiDung ? (
    "Học tập pháp luật, tra cứu nghiệp vụ và dùng công cụ phục vụ công tác hằng ngày."
  ) : (
    "Tra cứu pháp luật và dùng công cụ nghiệp vụ ngay. Đăng nhập bằng tài khoản cán bộ đã được xác minh để học, luyện tập và thi."
  );

  return (
    <section className="home-hero" aria-labelledby="loi-chao">
      <div className="home-container">
        <div className="home-hero-dau">
          <div className="home-hero-co-quan">
            <p className="home-hero-co-quan-tren">Dành cho cán bộ, chiến sĩ</p>
            <p className="home-hero-co-quan-ten">{nguoiDung?.don_vi?.ten ?? "Công an xã"}</p>
            <span className="home-ke-ngan" aria-hidden="true" />
          </div>
          <div className="home-hero-ben-phai">
            <p className="home-khau-hieu">
              Thượng tôn pháp luật
              <br />
              Vì nhân dân phục vụ
            </p>
            <span className="home-ke-vang" aria-hidden="true" />
            <p className="home-hero-ngay">
              <time dateTime={ngay.iso}>{ngay.chu}</time>
            </p>
          </div>
        </div>

        <div className="home-hero-chinh">
          <div className="min-w-0">
            <h1 id="loi-chao" className="home-title">
              {hoTen ? `Xin chào, ${hoTen}` : "Học tập và tra cứu phục vụ công tác"}
            </h1>
            <p className="home-hero-mo-ta">{moTa}</p>
          </div>
          <div className="home-hero-nut">
            <ButtonLink to={nutChinh.to} icon="book" className="home-hero-nut-chinh">
              {nutChinh.nhan}
              <Icon name="chevronRight" kieu="net" className="ml-2 size-4" />
            </ButtonLink>
            <ButtonLink to="/tra-cuu" variant="secondary" icon="search" className="home-hero-nut-phu">
              Tra cứu pháp luật
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
