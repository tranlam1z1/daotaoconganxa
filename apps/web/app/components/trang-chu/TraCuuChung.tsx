import { Link } from "react-router";
import { OTimVanBan } from "../tra-cuu/OTimVanBan";
import { Icon } from "../ui/Icon";

/** Ô tìm dùng chung, gửi tới chức năng tìm văn bản hiện có. */
export function TraCuuChung() {
  return (
    <section
      aria-labelledby="tra-cuu-chung"
      className="home-search rounded-card border border-line bg-surface p-4 shadow-card sm:p-6"
    >
      <span className="home-search-icon">
        <Icon name="search" kieu="net" className="size-9" />
      </span>
      <div className="min-w-0">
        <h2 id="tra-cuu-chung" className="text-xl font-semibold">
          Tra cứu văn bản
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Nhập số hiệu, tên văn bản, điều khoản hoặc từ khóa công việc cần tra.
        </p>
        <OTimVanBan q="" />
      </div>
      <div className="home-keywords">
        <span>Gợi ý tra cứu:</span>
        {[
          "Luật Giao thông đường bộ",
          "Xử phạt vi phạm hành chính",
          "Công chức, viên chức",
          "Đất đai",
          "Xây dựng",
          "Khiếu nại, tố cáo",
          "Dân sự",
          "Hình sự",
        ].map((q) => (
          <Link key={q} to={`/tim-kiem?q=${encodeURIComponent(q)}`}>
            {q}
          </Link>
        ))}
      </div>
    </section>
  );
}
