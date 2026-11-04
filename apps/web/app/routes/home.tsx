import { useEffect, useState } from "react";
import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import "../styles/home.css";
import { AppHeader } from "../components/trang-chu/AppHeader";
import { LuoiLoiTat } from "../components/trang-chu/LuoiLoiTat";
import { TraCuuChung } from "../components/trang-chu/TraCuuChung";
import { Icon } from "../components/ui/Icon";
import { docHref } from "../lib/citation";
import { CONG_CU } from "../lib/cong-cu";
import { formatDate, formatNgayGio } from "../lib/format";
import { pageMeta } from "../lib/site";
import { duLieuTrangChu } from "../lib/trang-chu.server";
import type { loader as rootLoader } from "../root";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Học tập và tra cứu", {
    description: "Việc học của tôi, văn bản mới có hiệu lực và công cụ nghiệp vụ.",
  });
}
export function loader({ request }: Route.LoaderArgs) {
  return duLieuTrangChu(request);
}

function DemNguoc({ moc, batDau, now }: { moc: string; batDau: boolean; now: number }) {
  const [hienTai, setHienTai] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setHienTai(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const giay = Math.max(0, Math.ceil((Date.parse(moc) - hienTai) / 1000));
  return (
    <span className="home-task-badge">
      {giay === 0
        ? batDau
          ? "Đã đến giờ mở bài"
          : "Đã đến hạn"
        : `${batDau ? "Mở sau" : "Còn"} ${Math.floor(giay / 86400)} ngày ${Math.floor((giay % 86400) / 3600)} giờ ${Math.floor((giay % 3600) / 60)} phút ${giay % 60} giây`}
    </span>
  );
}
export default function Home() {
  const loaderData = useLoaderData<typeof loader>();
  const nguoiDung = useRouteLoaderData<typeof rootLoader>("root")?.nguoiDung ?? null;
  const { caNhan, vanBan } = loaderData;
  const [now] = useState(loaderData.now);
  const hoc = nguoiDung?.cho_xac_minh ? "/tai-khoan" : nguoiDung ? "/hoc" : "/dang-nhap";
  const loi = "Chưa tải được dữ liệu. Vui lòng thử lại.";
  return (
    <div className="home-page">
      <AppHeader nguoiDung={nguoiDung} />
      <span aria-hidden="true" className="home-lotus home-lotus-left" />
      <span aria-hidden="true" className="home-lotus home-lotus-right" />
      <div className="home-container home-content">
        <div className="home-search-position">
          <TraCuuChung />
        </div>
        <div className="home-dashboard">
          <section className="home-panel" aria-labelledby="viec-cua-toi">
            <div className="home-section-heading">
              <h2 id="viec-cua-toi">
                <Icon name="calendar" className="size-6" />
                Việc của tôi
              </h2>
              {caNhan && (
                <Link className="home-all-link" to="/toi">
                  Tiến độ của tôi
                </Link>
              )}
            </div>
            <p className="home-panel-intro">
              {caNhan
                ? "Nội dung học theo nhóm trong tài khoản của bạn."
                : nguoiDung?.cho_xac_minh
                  ? "Xác minh tài khoản để xem việc học được giao."
                  : "Đăng nhập để xem tiến độ và nhiệm vụ học tập của bạn."}
            </p>
            <div className="home-tasks">
              <article className="home-task home-task-primary">
                <Icon name="book" className="size-6" />
                <h3>Tiếp tục bài đang học</h3>
                <p>
                  {!caNhan
                    ? "Bài học và tiến độ được lưu theo tài khoản."
                    : caNhan.hoc === undefined
                      ? loi
                      : (caNhan.hoc?.ten ?? "Bạn chưa có bài học đang dở.")}
                </p>
                {caNhan?.hoc && (
                  <span className="home-task-badge">Đã hoàn thành {caNhan.hoc.phanTram}% chuyên đề</span>
                )}
                <Link to={caNhan?.hoc?.to ?? hoc}>
                  {caNhan?.hoc ? "Tiếp tục học" : "Xem bài học"}
                  <span aria-hidden="true"> →</span>
                </Link>
              </article>
              <article className="home-task">
                <Icon name="calendar" className="size-6" />
                <h3>Kỳ kiểm tra sắp tới</h3>
                <p>
                  {!caNhan
                    ? "Lịch kiểm tra được giao sẽ hiện tại đây."
                    : caNhan.thi === undefined
                      ? loi
                      : (caNhan.thi?.exam_title ?? "Chưa có kỳ kiểm tra sắp tới.")}
                </p>
                {caNhan?.thi && (
                  <>
                    <DemNguoc
                      moc={caNhan.thi.trang_thai === "chua_mo" ? caNhan.thi.opens_at : caNhan.thi.due_at}
                      batDau={caNhan.thi.trang_thai === "chua_mo"}
                      now={now}
                    />
                    <small>Hạn làm bài: {formatNgayGio(caNhan.thi.due_at)}</small>
                  </>
                )}
                <Link to={caNhan ? "/thi" : hoc}>Xem lịch kiểm tra →</Link>
              </article>
              <article className="home-task">
                <Icon name="layers" className="size-6" />
                <h3>Chuyên đề được giao</h3>
                {!caNhan ? (
                  <p>Theo dõi nội dung và hạn hoàn thành của bạn.</p>
                ) : caNhan.giao === null ? (
                  <p>{loi}</p>
                ) : caNhan.giao.length ? (
                  <ul>
                    {caNhan.giao.slice(0, 3).map((g) => (
                      <li key={`${g.to}-${g.ten}`}>
                        <Link to={g.to}>{g.ten}</Link>
                        <small>
                          {g.han ? `Hạn hoàn thành: ${formatDate(g.han)}` : "Chưa đặt hạn hoàn thành"}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Chưa có chuyên đề được giao.</p>
                )}
                <Link to={caNhan ? "/nhom" : hoc}>Xem nội dung được giao →</Link>
              </article>
              <article className="home-task">
                <Icon name="chart" className="size-6" />
                <h3>Câu sai cần ôn</h3>
                <p>
                  {caNhan ? (
                    caNhan.sai === null ? (
                      loi
                    ) : (
                      <>
                        <strong className="home-wrong-count">{caNhan.sai}</strong> câu cần ôn lại
                      </>
                    )
                  ) : (
                    "Ôn lại câu trả lời sai để củng cố kiến thức."
                  )}
                </p>
                <Link to={caNhan ? "/toi" : hoc}>Ôn câu sai →</Link>
              </article>
            </div>
          </section>
          <section className="home-panel home-new-documents" aria-labelledby="van-ban-moi">
            <div className="home-section-heading">
              <h2 id="van-ban-moi">
                <Icon name="file" className="size-6" />
                Văn bản mới có hiệu lực
              </h2>
            </div>
            <p className="home-panel-intro">Cập nhật theo ngày bắt đầu hiệu lực.</p>
            {vanBan === null ? (
              <p role="status">{loi}</p>
            ) : vanBan.items.length ? (
              <ul>
                {vanBan.items.map((vb) => (
                  <li key={vb.urn}>
                    <Link to={docHref(vb.docType, vb.soKyHieu)}>
                      <span className="home-document-number">{vb.soKyHieu}</span>
                      <h3>{vb.shortTitle || vb.title}</h3>
                    </Link>
                    <p>
                      Có hiệu lực: {vb.effectiveFrom ? formatDate(vb.effectiveFrom) : "Chưa xác định ngày"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Chưa có văn bản để hiển thị.</p>
            )}
            <Link className="home-all-link" to="/tim-kiem?status=con_hieu_luc">
              Xem kho văn bản →
            </Link>
          </section>
        </div>
        <div className="home-resources">
          <LuoiLoiTat
            id="cong-cu-bieu-mau"
            tieuDe="Công cụ và biểu mẫu"
            icon="thuocDo"
            xemTatCa="/cong-cu"
            items={[
              {
                to: "/tra-cuu-nhanh/quy-trinh?loai=bieu_mau",
                ten: "Biểu mẫu nghiệp vụ",
                moTa: "Tải mẫu văn bản, hồ sơ",
                icon: "file",
              },
              ...CONG_CU.slice(0, 3).map((c) => ({
                to: `/cong-cu/${c.ma}`,
                ten: c.ten,
                moTa: c.moTa,
                icon: c.icon,
              })),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
