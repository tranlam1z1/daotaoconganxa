/**
 * Trang Công cụ nghiệp vụ: đủ hai nhóm lối tắt của trang chủ (lib/cong-cu.ts). Nút "Xem tất cả"
 * của cả hai khung ở trang chủ dẫn về đây.
 */
import { LuoiLoiTat } from "../components/trang-chu/LuoiLoiTat";
import { NGHIEP_VU_NHANH, O_CONG_CU } from "../lib/cong-cu";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/cong-cu._index";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Công cụ nghiệp vụ", {
    description: "Bộ công cụ tính toán nghiệp vụ và lối tắt tra cứu văn bản, quy trình, biển báo, hỏi đáp.",
  });
}

export default function CongCuNghiepVu() {
  return (
    <div className="wrap max-w-3xl py-6 sm:py-10 lg:max-w-7xl">
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Công cụ nghiệp vụ</h1>
      <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
        <LuoiLoiTat id="cong-cu-tieu-de" tieuDe="Bộ công cụ nghiệp vụ" icon="shield" items={O_CONG_CU} />
        <LuoiLoiTat
          id="nghiep-vu-nhanh-tieu-de"
          tieuDe="Nghiệp vụ nhanh"
          icon="bolt"
          items={NGHIEP_VU_NHANH}
        />
      </div>
    </div>
  );
}
