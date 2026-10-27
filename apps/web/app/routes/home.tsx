import { Link, useRouteLoaderData } from "react-router";
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
    <div className="wrap max-w-3xl py-6 sm:py-10 lg:max-w-7xl">
      <AppHeader nguoiDung={nguoiDung} />
      <div className="mt-4">
        <TraCuuChung />
      </div>
      <section aria-labelledby="nhom-noi-dung" className="mt-6">
        <h2 id="nhom-noi-dung" className="text-xl font-semibold">
          Học tập theo nhóm
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Chọn nhóm để xem chuyên đề. Có thể lần lượt xem các nhóm phù hợp với công việc của bạn.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              ma: "cong_chuc_cap_xa",
              ten: "Công chức",
              moTa: "Chuyên đề dành cho công chức cấp xã trong danh mục hiện có.",
            },
            { ma: "vien_chuc", ten: "Viên chức", moTa: "Chuyên đề dành cho viên chức." },
            { ma: "dang_vien", ten: "Đảng viên", moTa: "Chuyên đề dành cho đảng viên." },
          ].map((nhom) => (
            <Link
              key={nhom.ma}
              to={choXacMinh ? hoc : `/hoc?nhom=${nhom.ma}`}
              className="rounded-2xl border border-line bg-surface p-4 shadow-card the-bam"
            >
              <span className="block text-lg font-semibold text-primary">{nhom.ten}</span>
              <span className="mt-2 block text-sm leading-relaxed text-ink-2">{nhom.moTa}</span>
            </Link>
          ))}
        </div>
      </section>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <LuoiLoiTat
          id="hoc-tap"
          tieuDe="Học tập và luyện tập"
          icon="cap"
          items={[
            { to: hoc, ten: "Danh mục bài học", icon: "book" },
            { to: choXacMinh ? hoc : "/luyen-tap", ten: "Luyện tập kiến thức", icon: "cap" },
            { to: choXacMinh ? hoc : "/thi", ten: "Thi và kiểm tra", icon: "steps" },
            { to: choXacMinh ? hoc : "/toi", ten: "Tiến độ và câu sai", icon: "user" },
          ]}
        />
        <LuoiLoiTat
          id="tai-lieu"
          tieuDe="Tài liệu và tra cứu"
          icon="file"
          items={[
            { to: "/tra-cuu-nhanh/quy-trinh?loai=quy_trinh", ten: "Quy trình, thủ tục", icon: "steps" },
            { to: "/tra-cuu-nhanh/quy-trinh?loai=bieu_mau", ten: "Biểu mẫu", icon: "file" },
            { to: "/cong-cu", ten: "Công cụ dùng chung", icon: "map" },
            { to: "/hoi-dap", ten: "Hỏi trợ lý AI", icon: "chat" },
          ]}
        />
      </div>
    </div>
  );
}
