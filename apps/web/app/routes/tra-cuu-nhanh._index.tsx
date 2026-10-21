/**
 * Tra cứu nhanh (docs/PLAN.md GĐ5): ba ô lớn Mức phạt · Tốc độ · Quy trình.
 * Mỗi ô dẫn tới một màn hình có đúng một việc chính.
 */
import { Link } from "react-router";

import { LuoiTraCuuNhanh } from "../components/tra-cuu/LuoiTraCuuNhanh";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/tra-cuu-nhanh._index";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tra cứu nhanh", {
    description: "Tra mức xử phạt theo hành vi và loại xe, mức phạt theo tốc độ, và các bước xử lý vi phạm.",
  });
}

export default function TraCuuNhanh() {
  return (
    <div className="wrap max-w-3xl py-8 sm:py-12 lg:max-w-7xl">
      <h1 className="text-3xl font-semibold leading-tight lg:text-4xl">Tra cứu nhanh</h1>
      <p className="mt-2 text-base leading-relaxed text-ink-2">
        Mọi kết quả đều kèm điều khoản gốc để bạn mở ra đối chiếu.
      </p>
      <div className="mt-6">
        <LuoiTraCuuNhanh />
      </div>
      <p className="mt-8 text-base">
        Cần đọc nguyên văn quy định?{" "}
        <Link to="/tim-kiem" className="inline-flex min-h-11 items-center text-primary underline">
          Tra cứu văn bản
        </Link>
      </p>
    </div>
  );
}
