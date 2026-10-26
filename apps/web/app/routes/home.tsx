import { Link, useRouteLoaderData } from "react-router";
import { AppHeader } from "../components/trang-chu/AppHeader";
import { LuoiLoiTat } from "../components/trang-chu/LuoiLoiTat";
import { OTraCuuViPham } from "../components/trang-chu/OTraCuuViPham";
import { Icon } from "../components/ui/Icon";
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

      <Link
        to="/dich-vu-cong"
        className="loi-vao-dich-vu mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-4 shadow-card the-bam sm:gap-4 sm:px-5 sm:py-3"
      >
        <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger">
          <svg viewBox="0 0 24 24" className="size-8" fill="currentColor" aria-hidden="true">
            <path d="M12 2 2 7v2h20V7L12 2ZM4 10h3v9H4zm6.5 0h3v9h-3zm6.5 0h3v9h-3zM2 20h20v2H2z" />
          </svg>
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-base font-semibold leading-snug sm:text-lg">
            Dịch vụ công trực tuyến
          </span>
          <span className="mt-1 block text-[13px] leading-relaxed text-ink-2 sm:text-sm">
            Tìm thủ tục và mở dịch vụ trực tuyến trên Cổng Bộ Công an.
          </span>
        </span>
        <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-primary sm:size-9">
          <Icon name="chevronRight" className="size-5" />
        </span>
      </Link>

      <div className="mt-3">
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
