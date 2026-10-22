/**
 * Khung trang văn bản: tên văn bản, trạng thái hiệu lực, và menu "Thông tin thêm" dẫn tới
 * Thuộc tính / Lược đồ / Phiên bản. Trước đây bốn mục này là bốn thẻ ngang hàng; nay nội dung
 * văn bản là việc chính, ba mục còn lại gom vào một menu (docs/PLAN.md GĐ1).
 * Các trang con dùng lại dữ liệu ở đây qua useRouteLoaderData("routes/document").
 */
import { Link, Outlet, useLocation, useRouteLoaderData } from "react-router";

import { StatusBadge } from "../components/ui/Badge";
import { Icon } from "../components/ui/Icon";
import { ApiKhongTimThay, getDocument, getDocumentUrnBySlug } from "../lib/api";
import { docTypeLabel, formatDate, isIsoDate } from "../lib/format";
import { pageMeta } from "../lib/site";
import { duongSuaVanBan } from "../lib/van-ban-quan-tri";
import type { loader as rootLoader } from "../root";
import type { Route } from "./+types/document";

export async function loader({ params, request }: Route.LoaderArgs) {
  const asOfRaw = new URL(request.url).searchParams.get("asOf");
  let urn: string;
  let detail: Awaited<ReturnType<typeof getDocument>>;
  try {
    urn = await getDocumentUrnBySlug(params.docType, params.slug);
    detail = await getDocument(urn);
  } catch (e) {
    // Văn bản chưa có trong kho (ví dụ căn cứ của dữ liệu tra cứu chưa nạp): báo 404, không báo lỗi tải.
    if (e instanceof ApiKhongTimThay) throw new Response("Không tìm thấy văn bản.", { status: 404 });
    throw e;
  }
  return {
    urn,
    asOf: isIsoDate(asOfRaw) ? asOfRaw : undefined,
    basePath: `/van-ban/${params.docType}/${params.slug}`,
    detail,
  };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return pageMeta("Văn bản");
  const m = data.detail.meta;
  return pageMeta(`${docTypeLabel(m.docType)} số ${m.soKyHieu}`, { description: m.title });
}

/** Vai trò được sửa văn bản trong quản trị (API kiểm lại quyền); chỉ để hiện lối tắt "Sửa văn bản". */
const VAI_TRO_SUA = new Set(["quan_ly", "quan_tri"]);

const THONG_TIN_THEM = [
  { to: "thuoc-tinh", label: "Thuộc tính văn bản" },
  { to: "luoc-do", label: "Văn bản liên quan" },
  { to: "phien-ban", label: "Các lần sửa đổi" },
];

export default function DocumentLayout({ loaderData }: Route.ComponentProps) {
  const { meta, status } = loaderData.detail;
  const { pathname } = useLocation();
  const vaiTro = useRouteLoaderData<typeof rootLoader>("root")?.nguoiDung?.vai_tro;
  // Giữ thời điểm đang xem khi chuyển mục.
  const search = loaderData.asOf ? `?asOf=${loaderData.asOf}` : "";
  const oTrangCon = pathname.replace(/\/+$/, "") !== loaderData.basePath;

  return (
    <div className="wrap max-w-3xl py-6">
      <header className="border-b border-line pb-4">
        {oTrangCon ? (
          <Link
            to={`${loaderData.basePath}${search}`}
            className="mb-2 hidden min-h-11 items-center gap-1.5 text-sm font-medium text-primary md:inline-flex"
          >
            <Icon name="arrowLeft" className="size-4" />
            Về nội dung văn bản
          </Link>
        ) : null}
        <p className="text-sm font-semibold text-ink-2">
          {docTypeLabel(meta.docType)} số {meta.soKyHieu}
        </p>
        <h1 className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">{meta.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
          <StatusBadge status={status} />
          <span>
            {meta.issuer}, ban hành ngày {formatDate(meta.issuedDate)}
          </span>
          {/* key theo đường dẫn: chọn một mục xong thì menu đóng lại, không đè lên nội dung thẻ vừa mở. */}
          <details key={pathname} className="relative ml-auto">
            <summary className="lun flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-2 font-medium text-ink-2 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              Thông tin thêm
              <Icon name="menu" className="size-4" />
            </summary>
            <ul className="absolute right-0 z-30 mt-1 w-60 rounded-lg border border-line bg-surface p-1 shadow-card">
              {THONG_TIN_THEM.map((m) => (
                <li key={m.to}>
                  <Link
                    to={`${loaderData.basePath}/${m.to}${search}`}
                    className="lun flex min-h-11 items-center rounded-md px-3 text-[15px] hover:bg-surface-2"
                  >
                    {m.label}
                  </Link>
                </li>
              ))}
              {loaderData.detail.coTepGoc ? (
                <li>
                  <a
                    href={`${loaderData.basePath}/tep-goc`}
                    target="_blank"
                    rel="noreferrer"
                    className="lun flex min-h-11 items-center rounded-md px-3 text-[15px] hover:bg-surface-2"
                  >
                    Tệp PDF gốc
                  </a>
                </li>
              ) : null}
              {vaiTro && VAI_TRO_SUA.has(vaiTro) ? (
                <li className="mt-1 border-t border-line pt-1">
                  <Link
                    to={duongSuaVanBan(loaderData.urn)}
                    className="lun flex min-h-11 items-center rounded-md px-3 text-[15px] text-primary hover:bg-surface-2"
                  >
                    Sửa văn bản
                  </Link>
                </li>
              ) : null}
            </ul>
          </details>
        </div>
      </header>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
