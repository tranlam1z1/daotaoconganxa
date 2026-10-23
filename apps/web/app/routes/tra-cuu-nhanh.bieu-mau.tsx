/**
 * Một biểu mẫu hoặc hướng dẫn dạng tệp (`/tra-cuu-nhanh/bieu-mau/:ma`): tên, tóm tắt, phân loại và
 * tệp để mở xem hoặc tải về. Tệp PDF xem được ngay trong trang trên màn hình rộng; điện thoại mở tệp
 * ở thẻ mới để dùng trình xem PDF của máy. Word, Excel chỉ có nút tải về.
 */
import { data, Link } from "react-router";
import { Badge } from "../components/ui/Badge";
import { buttonClass } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { pageMeta } from "../lib/site";
import { dungLuongTep, hrefTepBieuMau, layBieuMau, tenLoaiTaiLieu } from "../lib/tai-lieu";
import { KhongTimThay } from "../lib/tra-cuu-nhanh";
import type { Route } from "./+types/tra-cuu-nhanh.bieu-mau";

export async function loader({ params }: Route.LoaderArgs) {
  try {
    return { bieuMau: await layBieuMau(params.ma) };
  } catch (e) {
    if (e instanceof KhongTimThay) throw data("Không có biểu mẫu này", { status: 404 });
    throw e;
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return pageMeta(loaderData?.bieuMau.tieuDe ?? "Biểu mẫu", { index: false });
}

export default function BieuMauPage({ loaderData }: Route.ComponentProps) {
  const b = loaderData.bieuMau;
  const tep = b.tep;
  const laPdf = tep?.duoi === "pdf";

  return (
    <KhungTrang className="wrap max-w-3xl py-8">
      <p className="hidden md:block">
        <Link
          to="/tra-cuu-nhanh/quy-trinh"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline"
        >
          <Icon name="arrowLeft" className="size-4" />
          Quy trình, biểu mẫu
        </Link>
      </p>
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
        {tenLoaiTaiLieu(b.loai)}
        {b.banNhap ? <Badge tone="warn">Bản nháp, chưa được duyệt</Badge> : null}
      </p>
      <TieuDeTrang icon="search" className="mt-1 break-words">
        {b.tieuDe}
      </TieuDeTrang>
      {b.tomTat ? <p className="mt-2 text-base leading-relaxed text-ink-2">{b.tomTat}</p> : null}
      {b.tenXe || b.nhom ? (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-base">
          {b.tenXe ? (
            <div className="flex gap-2">
              <dt className="text-ink-3">Phương tiện:</dt>
              <dd>{b.tenXe}</dd>
            </div>
          ) : null}
          {b.nhom ? (
            <div className="flex gap-2">
              <dt className="text-ink-3">Loại vi phạm:</dt>
              <dd>{b.nhom}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {tep ? (
        <section
          aria-labelledby="bm-tep"
          className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <h2 id="bm-tep" className="sr-only">
            Tệp biểu mẫu
          </h2>
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
              <Icon name="file" sac="do" className="size-7" />
            </span>
            <p className="min-w-0 flex-1">
              <span className="block text-base font-semibold break-words">{tep.ten}</span>
              <span className="block text-sm text-ink-3">
                {tep.duoi.toUpperCase()} · {dungLuongTep(tep.kichThuoc)}
              </span>
            </p>
          </div>
          {/* Thẻ <a> thường: tệp do resource route trả, không phải trang của ứng dụng. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {laPdf ? (
              <a
                href={hrefTepBieuMau(b.ma)}
                target="_blank"
                rel="noreferrer"
                className={buttonClass({ size: "lg" })}
              >
                Mở tệp
              </a>
            ) : null}
            <a
              href={hrefTepBieuMau(b.ma, true)}
              className={buttonClass({ size: "lg", variant: laPdf ? "secondary" : "primary" })}
            >
              Tải về
            </a>
          </div>
          {laPdf ? null : (
            <p className="mt-3 text-sm text-ink-3">
              Tệp {tep.duoi === "xlsx" || tep.duoi === "xls" ? "Excel" : "Word"} mở bằng ứng dụng văn phòng
              trên máy sau khi tải về.
            </p>
          )}
        </section>
      ) : null}

      {laPdf ? (
        <iframe
          src={hrefTepBieuMau(b.ma)}
          title={`Xem trước: ${b.tieuDe}`}
          className="mt-4 hidden h-[80vh] w-full rounded-2xl border border-line bg-surface md:block"
        />
      ) : null}
    </KhungTrang>
  );
}
