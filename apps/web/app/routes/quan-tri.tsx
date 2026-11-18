/**
 * Khung bảng điều khiển quản trị (ke-hoach/09-c §2): cột điều hướng cố định sát mép trái trên màn
 * hình rộng (nội dung giãn hết phần còn lại), hàng cuộn ngang trên điện thoại. Loader chặn người
 * chưa đăng nhập hoặc thiếu quyền; các trang con nằm dưới nên không phải kiểm lại, nhưng mọi lời
 * gọi API vẫn được API kiểm quyền.
 */
import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { cn } from "../lib/cn";
import { duVaiTro, type VaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Quản trị", { index: false });
}

/**
 * Từ GĐ2, cán bộ quản lý cũng vào được khu quản trị để xem đơn vị và người dùng của mình.
 * Mỗi nhóm menu khai vai trò tối thiểu; loader lọc sẵn để menu chỉ có mục dùng được.
 */
const GROUPS: Array<{
  label: string;
  vaiTro: VaiTro;
  items: Array<{ to: string; label: string; end?: boolean }>;
}> = [
  {
    // Trang đầu và báo cáo lấy cán bộ làm trung tâm: tổng quan, danh sách cán bộ, hồ sơ từng người.
    label: "Thống kê",
    vaiTro: "lanh_dao",
    items: [
      { to: "/quan-tri", label: "Tổng quan", end: true },
      { to: "/quan-tri/bao-cao", label: "Báo cáo" },
    ],
  },
  {
    label: "Tổ chức",
    vaiTro: "lanh_dao",
    items: [
      { to: "/quan-tri/don-vi", label: "Đơn vị" },
      { to: "/quan-tri/nguoi-dung", label: "Người dùng" },
    ],
  },
  {
    // Lãnh đạo Công an xã xem đề đang mở và giao bài; tạo, sửa đề chỉ Admin quản trị (API kiểm quyền).
    // Nhóm học cùng (docs/PLAN.md GĐ16c): quản lý xem tiến độ nhóm trong phạm vi.
    label: "Thi",
    vaiTro: "lanh_dao",
    items: [
      { to: "/quan-tri/de-thi", label: "Đề thi" },
      { to: "/quan-tri/giao-bai", label: "Giao bài" },
      { to: "/quan-tri/nhom", label: "Nhóm học cùng" },
    ],
  },
  {
    // Thêm, sửa, xóa văn bản trong kho; xóa cần Admin quản trị (API kiểm quyền).
    label: "Kho văn bản",
    vaiTro: "quan_ly",
    items: [{ to: "/quan-tri/van-ban", label: "Văn bản" }],
  },
  {
    label: "Đào tạo",
    vaiTro: "quan_ly",
    items: [
      { to: "/quan-tri/cau-hoi", label: "Ngân hàng câu hỏi" },
      { to: "/quan-tri/chu-de", label: "Chủ đề câu hỏi" },
      { to: "/quan-tri/du-lieu-tra-cuu", label: "Duyệt dữ liệu tra cứu" },
      { to: "/quan-tri/chuyen-de", label: "Chuyên đề" },
      { to: "/quan-tri/cham-tu-luan", label: "Chấm tự luận" },
    ],
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { nguoiDung } = await yeuCauVaiTro(request, "lanh_dao");
  const nhom = GROUPS.filter((g) => duVaiTro(nguoiDung, g.vaiTro)).map(({ label, items }) => ({
    label,
    items,
  }));
  return { nguoiDung, nhom };
}

export default function QuanTriLayout({ loaderData }: Route.ComponentProps) {
  const { nguoiDung, nhom } = loaderData;
  const { pathname } = useLocation();
  // Điện thoại: hàng cuộn ngang dài hơn màn hình, cuộn tới mục đang chọn kẻo nó khuất ngoài mép phải.
  const dai = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: chạy lại khi đổi trang để cuộn tới mục mới
  useEffect(() => {
    const d = dai.current;
    const a = d?.querySelector('[aria-current="page"]');
    if (d && a) d.scrollLeft += a.getBoundingClientRect().left - d.getBoundingClientRect().left - 16;
    // Từ 1024px cột dọc tự cuộn: cửa sổ thấp hơn danh sách thì kéo mục đang chọn vào tầm nhìn.
    if (a && window.matchMedia("(min-width: 64rem)").matches) a.scrollIntoView({ block: "nearest" });
  }, [pathname]);
  return (
    <div className="lg:pl-[var(--cot-trai)]">
      {/* Từ 1024px: cột cố định sát mép trái, ngay dưới đầu trang. Mọi nhóm luôn mở, hiện đủ mục; */}
      {/* cửa sổ thấp hơn danh sách thì cột cuộn được, không hiện thanh cuộn. */}
      {/* Màu riêng của cột (nền trắng, viền phải): lớp .cot-quan-tri trong styles/app.css. */}
      <aside className="cot-quan-tri khong-thanh-cuon no-print px-4 pt-8 md:px-6 lg:fixed lg:bottom-0 lg:left-0 lg:top-[calc(5rem+5px)] lg:z-30 lg:w-[var(--cot-trai)] lg:overflow-y-auto lg:overscroll-contain lg:bg-canvas lg:px-3 lg:py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4 lg:block lg:px-3 lg:pb-3">
          <h1 className="text-2xl font-semibold lg:text-xl">Quản trị</h1>
          {/* Từ 1024px chỉ một dòng họ tên để cột đủ chỗ cho mọi mục; vai trò đầy đủ ở title. */}
          <p className="text-sm text-ink-3 lg:mt-1 lg:truncate" title={nguoiDung.mo_ta_vai_tro}>
            {nguoiDung.ten ?? nguoiDung.email}
            <span className="lg:hidden"> · {nguoiDung.mo_ta_vai_tro}</span>
          </p>
        </div>

        <nav aria-label="Điều hướng quản trị" className="mt-6 lg:mt-3">
          {/* Điện thoại, máy tính bảng: menu cuộn ngang, bóng mờ ở mép báo còn mục phía sau (lớp .bang-cuon). */}
          <div
            ref={dai}
            className="bang-cuon flex gap-6 pb-2 [--nen-cuon:var(--surface)] lg:flex-col lg:gap-1 lg:overflow-visible lg:bg-none"
          >
            {/* Mọi nhóm luôn mở, hiện đủ mục: tên nhóm là tiêu đề tĩnh viết hoa, không gập. */}
            {nhom.map((g) => (
              <div
                key={g.label}
                className="shrink-0 lg:[&+&]:mt-2 lg:[&+&]:border-t lg:[&+&]:border-line lg:[&+&]:pt-2"
              >
                <p className="mb-1 px-3 text-xs font-bold uppercase tracking-[0.1em] text-ink-3">{g.label}</p>
                <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
                  {g.items.map((m) => (
                    <li key={m.to}>
                      <NavLink
                        to={m.to}
                        end={m.end}
                        className={({ isActive }) =>
                          cn(
                            "lun flex min-h-11 items-center whitespace-nowrap rounded-btn px-3 text-sm lg:min-h-9",
                            isActive
                              ? "bg-primary-soft font-semibold text-primary"
                              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                          )
                        }
                      >
                        {m.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      <div className="min-w-0 px-4 py-8 md:px-6 lg:p-8">
        <div
          className={
            ["/quan-tri/de-thi", "/quan-tri/giao-bai", "/quan-tri/nhom", "/quan-tri/chuyen-de"].includes(
              pathname,
            )
              ? "min-w-0"
              : "khung-trang min-w-0 rounded-card border border-line bg-surface p-4 shadow-card sm:p-6"
          }
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
