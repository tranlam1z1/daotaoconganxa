import { useRouteLoaderData } from "react-router";
import { AudienceGroups } from "../components/trang-chu/AudienceGroups";
import "../styles/home.css";
import { AppHeader } from "../components/trang-chu/AppHeader";
import { LuoiLoiTat } from "../components/trang-chu/LuoiLoiTat";
import { TraCuuChung } from "../components/trang-chu/TraCuuChung";
import { pageMeta } from "../lib/site";
import type { loader as rootLoader } from "../root";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Học tập và tra cứu", {
    description: "Học tập, tra cứu văn bản, quy trình và biểu mẫu dành cho công chức, viên chức, đảng viên.",
  });
}
export default function Home() {
  const nguoiDung = useRouteLoaderData<typeof rootLoader>("root")?.nguoiDung ?? null;
  const choXacMinh = nguoiDung?.cho_xac_minh;
  const hoc = choXacMinh ? "/tai-khoan" : "/hoc";
  return (
    <div className="home-page">
      <AppHeader nguoiDung={nguoiDung} />
      <span aria-hidden="true" className="home-lotus home-lotus-left" />
      <span aria-hidden="true" className="home-lotus home-lotus-right" />
      <div className="home-container home-content">
        <div className="home-search-position">
          <TraCuuChung />
        </div>
        <AudienceGroups choXacMinh={Boolean(choXacMinh)} />
        <div className="home-resources grid gap-3 lg:grid-cols-2">
          <LuoiLoiTat
            id="hoc-tap"
            tieuDe="Học tập và luyện tập"
            icon="book"
            items={[
              { to: hoc, ten: "Danh mục bài học", moTa: "Xem danh sách các chuyên đề", icon: "book" },
              {
                to: choXacMinh ? hoc : "/luyen-tap",
                ten: "Luyện tập kiến thức",
                moTa: "Trắc nghiệm theo chuyên đề",
                icon: "cap",
              },
              {
                to: choXacMinh ? hoc : "/thi",
                ten: "Thi và kiểm tra",
                moTa: "Làm bài kiểm tra, thi thử",
                icon: "steps",
              },
              {
                to: choXacMinh ? hoc : "/toi",
                ten: "Tiến độ và câu sai",
                moTa: "Theo dõi kết quả học tập",
                icon: "chart",
              },
            ]}
          />
          <LuoiLoiTat
            id="tai-lieu"
            tieuDe="Tài liệu và tra cứu"
            icon="file"
            items={[
              {
                to: "/tra-cuu-nhanh/quy-trinh?loai=quy_trinh",
                ten: "Quy trình, thủ tục",
                moTa: "Hướng dẫn, quy trình nghiệp vụ",
                icon: "steps",
              },
              {
                to: "/tra-cuu-nhanh/quy-trinh?loai=bieu_mau",
                ten: "Biểu mẫu",
                moTa: "Tải biểu mẫu, mẫu văn bản",
                icon: "file",
              },
              { to: "/cong-cu", ten: "Công cụ dùng chung", moTa: "Công cụ hỗ trợ tra cứu", icon: "thuocDo" },
              {
                to: "/dich-vu-cong",
                ten: "Dịch vụ công trực tuyến",
                moTa: "Liên kết, hướng dẫn sử dụng",
                icon: "congSo",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
