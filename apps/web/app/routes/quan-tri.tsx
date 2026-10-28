/**
 * Khung bảng điều khiển quản trị (ke-hoach/09-c §2): cột điều hướng cố định sát mép trái trên màn
 * hình rộng (nội dung giãn hết phần còn lại), hàng cuộn ngang trên điện thoại. Loader chặn người
 * chưa đăng nhập hoặc thiếu quyền; các trang con nằm dưới nên không phải kiểm lại, nhưng mọi lời
 * gọi API vẫn được API kiểm quyền.
 */
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { Icon, type IconName } from "../components/ui/Icon";
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
  icon: IconName;
  vaiTro: VaiTro;
  items: Array<{ to: string; label: string; icon: IconName; end?: boolean }>;
}> = [
  {
    // Trang đầu và báo cáo lấy cán bộ làm trung tâm: tổng quan, danh sách cán bộ, hồ sơ từng người.
    label: "Thống kê",
    icon: "chart",
    vaiTro: "lanh_dao",
    items: [
      { to: "/quan-tri", label: "Tổng quan", icon: "luoi", end: true },
      { to: "/quan-tri/bao-cao", label: "Báo cáo", icon: "chart" },
    ],
  },
  {
    label: "Tổ chức",
    icon: "nhom",
    vaiTro: "lanh_dao",
    items: [
      { to: "/quan-tri/don-vi", label: "Đơn vị", icon: "donVi" },
      { to: "/quan-tri/nguoi-dung", label: "Người dùng", icon: "user" },
    ],
  },
  {
    // Lãnh đạo UBND xã xem đề đang mở và giao bài; tạo, sửa đề chỉ Admin quản trị (API kiểm quyền).
    // Nhóm học cùng (docs/PLAN.md GĐ16c): quản lý xem tiến độ nhóm trong phạm vi.
    label: "Thi",
    icon: "cap",
    vaiTro: "lanh_dao",
    items: [
      { to: "/quan-tri/de-thi", label: "Đề thi", icon: "steps" },
      { to: "/quan-tri/giao-bai", label: "Giao bài", icon: "chiaSe" },
      { to: "/quan-tri/nhom", label: "Nhóm học cùng", icon: "nhom" },
    ],
  },
  {
    // Thêm, sửa, xóa văn bản trong kho; xóa cần Admin quản trị (API kiểm quyền).
    label: "Kho văn bản",
    icon: "thuMuc",
    vaiTro: "quan_ly",
    items: [{ to: "/quan-tri/van-ban", label: "Văn bản", icon: "vanBan" }],
  },
  {
    label: "Đào tạo",
    icon: "book",
    vaiTro: "quan_ly",
    items: [
      { to: "/quan-tri/cau-hoi", label: "Ngân hàng câu hỏi", icon: "help" },
      { to: "/quan-tri/du-lieu-tra-cuu", label: "Duyệt dữ liệu tra cứu", icon: "search" },
      { to: "/quan-tri/chuyen-de", label: "Chuyên đề", icon: "book" },
      { to: "/quan-tri/cham-tu-luan", label: "Chấm tự luận", icon: "pencil" },
    ],
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { nguoiDung } = await yeuCauVaiTro(request, "lanh_dao");
  const nhom = GROUPS.filter((g) => duVaiTro(nguoiDung, g.vaiTro)).map(({ label, icon, items }) => ({
    label,
    icon,
    items,
  }));
  return { nguoiDung, nhom };
}

export default function QuanTriLayout({ loaderData }: Route.ComponentProps) {
  const { nguoiDung, nhom } = loaderData;
  const { pathname } = useLocation();
  // Nhóm chứa trang đang xem; trang không thuộc nhóm nào (vd /quan-tri/can-cu) thì giữ nhóm đang mở.
  const nhomHienTai = nhom.find((g) =>
    g.items.some((m) => pathname === m.to || (!m.end && pathname.startsWith(`${m.to}/`))),
  )?.label;
  const [mo, setMo] = useState(nhomHienTai);
  useEffect(() => {
    if (nhomHienTai) setMo(nhomHienTai);
  }, [nhomHienTai]);
  // Điện thoại: hàng cuộn ngang dài hơn màn hình, cuộn tới mục đang chọn kẻo nó khuất ngoài mép phải.
  const dai = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: chạy lại khi đổi trang để cuộn tới mục mới
  useEffect(() => {
    const d = dai.current;
    const a = d?.querySelector('[aria-current="page"]');
    if (d && a) d.scrollLeft += a.getBoundingClientRect().left - d.getBoundingClientRect().left - 16;
  }, [pathname]);
  return (
    <div className="lg:pl-[var(--cot-trai)]">
      {/* Từ 1024px: cột cố định sát mép trái, ngay dưới đầu trang (cao 5rem + viền 5px). Menu gập theo */}
      {/* nhóm, mỗi lúc mở một nhóm nên vừa chiều cao màn hình; cửa sổ quá thấp vẫn cuộn được, không hiện thanh cuộn. */}
      {/* Màu riêng của cột (nền trắng, viền phải): lớp .cot-quan-tri trong styles/app.css. */}
      <aside className="cot-quan-tri khong-thanh-cuon no-print px-4 pt-8 md:px-6 lg:fixed lg:bottom-0 lg:left-0 lg:top-[calc(5rem+5px)] lg:z-30 lg:w-[var(--cot-trai)] lg:overflow-y-auto lg:overscroll-contain lg:bg-canvas lg:px-3 lg:py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4 lg:block lg:px-3">
          <h1 className="text-2xl font-semibold lg:text-xl">
            <span className="flex items-center gap-3">
              <Icon name="caiDat" className="size-7" />
              Quản trị
            </span>
          </h1>
          <p className="text-sm text-ink-3 lg:mt-1 lg:break-words">
            {nguoiDung.ten ?? nguoiDung.email} · {nguoiDung.mo_ta_vai_tro}
          </p>
        </div>

        <nav aria-label="Điều hướng quản trị" className="mt-6 lg:mt-3">
          {/* Điện thoại, máy tính bảng: menu cuộn ngang, bóng mờ ở mép báo còn mục phía sau (lớp .bang-cuon). */}
          <div
            ref={dai}
            className="bang-cuon flex gap-6 pb-2 [--nen-cuon:var(--canvas)] lg:flex-col lg:gap-1 lg:overflow-visible lg:bg-none"
          >
            {nhom.map((g) => {
              const dangMo = mo === g.label;
              return (
                <div key={g.label} className="shrink-0">
                  <p className="mb-1 flex items-center gap-3 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3 lg:hidden">
                    <Icon name={g.icon} sac="chinh" className="size-5 shrink-0" />
                    {g.label}
                  </p>
                  {/* Từ 1024px tên nhóm là nút gập mở; dưới đó hàng cuộn ngang luôn hiện đủ mục. */}
                  <button
                    type="button"
                    aria-expanded={dangMo}
                    onClick={() => setMo(dangMo ? undefined : g.label)}
                    className="lun hidden min-h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-semibold text-ink hover:bg-surface-2 lg:flex"
                  >
                    <span className="flex items-center gap-3">
                      <Icon name={g.icon} sac="chinh" className="size-5 shrink-0" />
                      {g.label}
                    </span>
                    <Icon name="chevronDown" className={cn("size-4 text-ink-3", dangMo && "rotate-180")} />
                  </button>
                  {/* Mục con thụt vào sau đường kẻ dọc để tách bậc với tên nhóm. */}
                  <ul
                    className={cn(
                      "flex gap-1 lg:mb-2 lg:ml-5 lg:flex-col lg:border-l lg:border-line lg:pl-2",
                      !dangMo && "lg:hidden",
                    )}
                  >
                    {g.items.map((m) => (
                      <li key={m.to}>
                        <NavLink
                          to={m.to}
                          end={m.end}
                          className={({ isActive }) =>
                            cn(
                              "lun flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm lg:min-h-9",
                              isActive
                                ? "bg-primary-soft font-semibold text-primary"
                                : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                            )
                          }
                        >
                          <Icon name={m.icon} className="mr-3 size-5 shrink-0" />
                          {m.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
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
