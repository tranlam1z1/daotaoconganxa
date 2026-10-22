import { useRouteLoaderData } from "react-router";

import { AppHeader } from "../components/trang-chu/AppHeader";
import { LuoiLoiTat } from "../components/trang-chu/LuoiLoiTat";
import { OTraCuuViPham } from "../components/trang-chu/OTraCuuViPham";
import { NGHIEP_VU_NHANH, O_CONG_CU } from "../lib/cong-cu";
import { pageMeta } from "../lib/site";
import type { loader as rootLoader } from "../root";
import type { Route } from "./+types/home";

/** Mỗi khung lối tắt ở trang chủ hiện tối đa bấy nhiêu ô; đủ danh sách xem ở /cong-cu (Xem tất cả). */
const SO_O_TRANG_CHU = 4;

export function meta(_: Route.MetaArgs) {
  return pageMeta("Học tập pháp luật & Bồi dưỡng nghiệp vụ", {
    description:
      "Tìm quy định đến từng điều, khoản; đọc nguyên văn điều khoản đang áp dụng; hỏi trợ lý AI và nhận câu trả lời kèm căn cứ.",
  });
}

/**
 * Trang chủ: lời chào, ô tra cứu vi phạm, bộ công cụ nghiệp vụ và nghiệp vụ nhanh.
 */
export default function Home() {
  const nguoiDung = useRouteLoaderData<typeof rootLoader>("root")?.nguoiDung ?? null;

  return (
    <div className="wrap max-w-3xl py-6 sm:py-10 lg:max-w-7xl">
      <AppHeader nguoiDung={nguoiDung} />

      <div className="mt-6">
        <OTraCuuViPham />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <LuoiLoiTat
          id="cong-cu-tieu-de"
          tieuDe="Bộ công cụ nghiệp vụ"
          icon="shield"
          items={O_CONG_CU.slice(0, SO_O_TRANG_CHU)}
          xemTatCa="/cong-cu"
        />
        <LuoiLoiTat
          id="nghiep-vu-nhanh-tieu-de"
          tieuDe="Nghiệp vụ nhanh"
          icon="bolt"
          items={NGHIEP_VU_NHANH.slice(0, SO_O_TRANG_CHU)}
          xemTatCa="/cong-cu"
        />
      </div>
    </div>
  );
}
