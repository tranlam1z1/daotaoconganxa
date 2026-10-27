import { Link, useNavigation } from "react-router";
import { BoLocVanBan } from "../components/tra-cuu/BoLocVanBan";
import { KhungTraCuu } from "../components/tra-cuu/KhungTraCuu";
import { OTimVanBan } from "../components/tra-cuu/OTimVanBan";
import { TabVanBanBieuMau } from "../components/tra-cuu/TabVanBanBieuMau";
import { TheVanBan } from "../components/tra-cuu/TheVanBan";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { traVanBan } from "../lib/api";
import {
  type DanhMucLoc,
  docBoLoc,
  duongTraCuu,
  loiBoLoc,
  NHOM_VAN_BAN,
  ngayTra,
  voiNgay,
} from "../lib/bo-loc-van-ban";
import { cn } from "../lib/cn";
import { DOC_STATUS_LABEL, docTypeLabel, formatDate } from "../lib/format";
import { pageMeta } from "../lib/site";
import { tuKetQuaVanBan, type VanBanTraCuu } from "../lib/tra-cuu-van-ban";
import type { Route } from "./+types/search";

const MOI_TRANG = 20;
export function meta({ location }: Route.MetaArgs) {
  const q = new URLSearchParams(location.search).get("q")?.slice(0, 80);
  return pageMeta(q ? `Tra cứu: ${q}` : "Tra cứu văn bản", { index: false });
}
export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const loc = docBoLoc(p);
  if (!loc.sort) loc.sort = loc.q ? "phu_hop" : "moi_nhat";
  const page = Math.min(10000, Math.max(1, Math.floor(Number(p.get("page")) || 1)));
  const loi = loiBoLoc(loc);
  const asOf = ngayTra(loc);
  if (loi)
    return { loc, page: 1, loi, asOf, total: 0, vanBan: [] as VanBanTraCuu[], facets: {} as DanhMucLoc };
  const query = Object.fromEntries(Object.entries(loc).filter(([, v]) => v));
  const data = await traVanBan({
    ...query,
    asOf,
    page,
    limit: MOI_TRANG,
    sort: loc.sort || (loc.q ? "phu_hop" : "moi_nhat"),
  });
  return {
    loc,
    page,
    loi: null,
    asOf: data.asOf,
    total: data.total,
    vanBan: data.items.map((d) => tuKetQuaVanBan(d, data.asOf)),
    facets: data.facets,
  };
}
export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { loc, page, loi, asOf, total, vanBan, facets } = loaderData;
  const busy = useNavigation().state === "loading";
  const labels: Record<string, string> = {
    family: "Nhóm",
    docType: "Loại",
    status: "Trạng thái",
    field: "Lĩnh vực",
    issuer: "Cơ quan",
    locality: "Địa phương",
    scope: "Phạm vi",
    asOf: "Ngày",
  };
  const active = Object.entries(loc).filter(([k, v]) => v && k in labels);
  const pages = Math.max(1, Math.ceil(total / MOI_TRANG));
  return (
    <KhungTraCuu
      title="Tra cứu văn bản"
      description="Tìm văn bản và điều khoản trong kho dữ liệu. Các kết quả được đếm theo văn bản."
    >
      <TabVanBanBieuMau chon="van-ban" />
      <div key={JSON.stringify(loc)} className="mt-4">
        <OTimVanBan q={loc.q.length <= 500 ? loc.q : ""}>
          <BoLocVanBan loc={loc} facets={facets} />
        </OTimVanBan>
      </div>
      {active.length ? (
        <nav aria-label="Bộ lọc đang chọn" className="mt-3 flex flex-wrap gap-2">
          {active.map(([k, v]) => (
            <Link
              key={k}
              to={duongTraCuu(loc, 1, k)}
              aria-label={`Bỏ bộ lọc ${labels[k]}`}
              className="inline-flex min-h-11 max-w-full items-center break-words rounded-lg border border-line px-3 text-sm"
            >
              {labels[k]}:{" "}
              {k === "family"
                ? NHOM_VAN_BAN[v]
                : k === "docType"
                  ? docTypeLabel(v)
                  : k === "status"
                    ? DOC_STATUS_LABEL[v as keyof typeof DOC_STATUS_LABEL]
                    : v}{" "}
              ×
            </Link>
          ))}
          <Link
            to={loc.q ? `/tim-kiem?q=${encodeURIComponent(loc.q)}` : "/tim-kiem"}
            className="inline-flex min-h-11 items-center px-2 text-sm text-primary underline"
          >
            Bỏ tất cả bộ lọc
          </Link>
        </nav>
      ) : null}
      <section
        aria-labelledby="tk-danh-sach"
        aria-busy={busy}
        className={cn("mt-6 border-t border-line pt-4", busy && "opacity-60")}
      >
        <h2 id="tk-danh-sach" className="text-xl font-semibold">
          Kết quả tra cứu
        </h2>
        {loi ? (
          <EmptyState icon="search" title="Cần kiểm tra lại thông tin" className="mt-3">
            <p>{loi}</p>
          </EmptyState>
        ) : (
          <>
            <p aria-live="polite" className="mt-2 text-sm text-ink-2">
              {total.toLocaleString("vi-VN")} văn bản{loc.q ? ` khớp với “${loc.q}”` : ""} · Ngày tra:{" "}
              {formatDate(asOf)}
            </p>
            {loc.family === "dang" ? (
              <p className="mt-2 text-sm text-ink-2">
                Trạng thái văn bản Đảng do kho ghi nhận; cần đối chiếu bản gốc và văn bản thay thế.
              </p>
            ) : null}
            {!vanBan.length ? (
              <EmptyState
                icon="search"
                title={total ? "Trang này không có kết quả" : "Không tìm thấy văn bản phù hợp"}
                className="mt-3"
              >
                <p>
                  {total
                    ? "Chọn lại trang kết quả."
                    : "Thử từ khóa ngắn hơn hoặc bỏ bớt bộ lọc. Kho có thể chưa có tài liệu cần tìm."}
                </p>
                <ButtonLink to={duongTraCuu({ ...loc, q: total ? loc.q : "" }, 1)} variant="secondary">
                  {total ? "Về trang đầu" : "Xem theo bộ lọc hiện tại"}
                </ButtonLink>
              </EmptyState>
            ) : (
              <ol className="mt-3 grid gap-3">
                {vanBan.map((vb, i) => (
                  <TheVanBan key={vb.urn} vb={vb} q={loc.q} stt={(page - 1) * MOI_TRANG + i + 1} />
                ))}
              </ol>
            )}
            {pages > 1 || page > 1 ? (
              <nav
                aria-label="Trang kết quả"
                className="mt-5 flex flex-wrap items-center justify-between gap-3"
              >
                {page > 1 ? (
                  <ButtonLink to={duongTraCuu(loc, page - 1)} variant="secondary">
                    Trang trước
                  </ButtonLink>
                ) : (
                  <span />
                )}
                <span className="text-sm">
                  Trang {page} / {pages}
                </span>
                {page < pages ? (
                  <ButtonLink to={duongTraCuu(loc, page + 1)} variant="secondary">
                    Trang sau
                  </ButtonLink>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
        {loc.q && !loi ? (
          <ButtonLink
            to={voiNgay(`/hoi-dap?q=${encodeURIComponent(loc.q)}`, asOf)}
            variant="secondary"
            className="mt-6"
          >
            Hỏi trợ lý AI về nội dung này
          </ButtonLink>
        ) : null}
      </section>
    </KhungTraCuu>
  );
}
