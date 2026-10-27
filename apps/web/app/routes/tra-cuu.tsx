import { Link } from "react-router";
import { KhungTraCuu } from "../components/tra-cuu/KhungTraCuu";
import { TraCuuChung } from "../components/trang-chu/TraCuuChung";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/tra-cuu";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tra cứu", {
    description: "Tra cứu văn bản, quy trình và biểu mẫu cho công chức, viên chức, đảng viên.",
  });
}
export function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  return { lienKetCu: p.has("tab") || p.has("xe") || p.has("cd") || p.has("ma") };
}
export default function TraCuu({ loaderData }: Route.ComponentProps) {
  return (
    <KhungTraCuu title="Tra cứu" description="Văn bản, quy trình và biểu mẫu phục vụ học tập và công tác.">
      {loaderData.lienKetCu ? (
        <p role="status" className="mb-4 rounded-xl border border-line bg-surface-2 p-4 text-sm">
          Tra cứu biển báo và vi phạm giao thông đã ngừng cung cấp trên trang này. Bạn có thể tiếp tục tra cứu
          văn bản, quy trình và biểu mẫu bên dưới.
        </p>
      ) : null}
      <TraCuuChung />
      <nav aria-label="Danh mục tra cứu" className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          {
            to: "/tim-kiem",
            ten: "Tất cả văn bản",
            moTa: "Tìm trong kho văn bản hiện có và mở điều, khoản khớp từ khóa.",
          },
          {
            to: "/tra-cuu-nhanh/quy-trinh?loai=quy_trinh",
            ten: "Quy trình, thủ tục",
            moTa: "Tìm hướng dẫn thực hiện theo từng bước trong danh mục hiện có.",
          },
          {
            to: "/tra-cuu-nhanh/quy-trinh?loai=bieu_mau",
            ten: "Biểu mẫu",
            moTa: "Tìm biểu mẫu để xem hoặc tải về.",
          },
          {
            to: "/tra-cuu-nhanh/quy-trinh?loai=huong_dan",
            ten: "Tài liệu hướng dẫn",
            moTa: "Tìm tài liệu hướng dẫn nghiệp vụ đã xuất bản.",
          },
          {
            to: "/tim-kiem?family=dang",
            ten: "Văn bản Đảng",
            moTa: "Tìm các văn bản đã được phân loại là văn bản Đảng trong kho.",
          },
        ].map((muc) => (
          <Link key={muc.to} to={muc.to} className="rounded-xl border border-line bg-surface p-4 the-bam">
            <span className="block font-semibold text-primary">{muc.ten}</span>
            <span className="mt-2 block text-sm leading-relaxed text-ink-2">{muc.moTa}</span>
          </Link>
        ))}
      </nav>
      <Link to="/hoi-dap" className="mt-4 inline-flex min-h-11 items-center text-primary underline">
        Hỏi trợ lý AI kèm căn cứ
      </Link>
    </KhungTraCuu>
  );
}
