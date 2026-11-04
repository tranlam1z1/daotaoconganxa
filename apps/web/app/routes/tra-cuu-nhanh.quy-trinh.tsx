/**
 * Quy trình, Biểu mẫu. Một tệp phục vụ hai route:
 * - `/tra-cuu-nhanh/quy-trinh`: tra chung quy trình (các bước) và biểu mẫu, hướng dẫn dạng tệp. Trên
 *   cùng là hai tab nối với trang Tra cứu văn bản; khung tìm có từ khóa và loại tài liệu. Chưa tra thì hiện mục phổ biến: mục ghim trước, rồi theo lượt mở.
 * - `/tra-cuu-nhanh/quy-trinh/:ma`: các bước đánh số của một quy trình (docs/PLAN.md GĐ5).
 * Biểu mẫu mở ở `/tra-cuu-nhanh/bieu-mau/:ma` (tra-cuu-nhanh.bieu-mau.tsx).
 */
import { data, Link, useNavigation } from "react-router";
import { CacBuocQuyTrinh } from "../components/tra-cuu/CacBuocQuyTrinh";
import { KhungTraCuu } from "../components/tra-cuu/KhungTraCuu";
import { OTimBieuMau } from "../components/tra-cuu/OTimBieuMau";
import { TabVanBanBieuMau } from "../components/tra-cuu/TabVanBanBieuMau";
import { TheTaiLieu } from "../components/tra-cuu/TheTaiLieu";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { cn } from "../lib/cn";
import { pageMeta } from "../lib/site";
import { laLoaiTaiLieu, timTaiLieuPage } from "../lib/tai-lieu";
import { KhongTimThay, layQuyTrinh, type QuyTrinhTomTat } from "../lib/tra-cuu-nhanh";
import type { Route } from "./+types/tra-cuu-nhanh.quy-trinh";

const TEN_LOAI: Record<QuyTrinhTomTat["loai"], string> = {
  hanh_chinh: "Thủ tục hành chính",
  nghiep_vu: "Quy trình nghiệp vụ",
  cong_tac_dang: "Công tác Đảng",
  vi_pham: "Xử lý vi phạm",
  tai_nan: "Xử lý tai nạn",
};

const DUONG_DAN = "/tra-cuu-nhanh/quy-trinh";
/** Số mục ở phần "phổ biến" khi chưa tra; bấm "Xem tất cả" để xem hết. */
const SO_PHO_BIEN = 6;

export async function loader({ params, request }: Route.LoaderArgs) {
  const ma = (params as { ma?: string }).ma;
  if (ma) {
    try {
      return { chiTiet: await layQuyTrinh(ma), tra: null };
    } catch (e) {
      if (e instanceof KhongTimThay) throw data("Không có quy trình này", { status: 404 });
      throw e;
    }
  }

  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  if (q.length > 200) throw new Response("Từ khóa tối đa 200 ký tự.", { status: 400 });
  const raw = p.get("loai");
  const loai = laLoaiTaiLieu(raw) ? raw : "";
  const page = Math.min(10000, Math.max(1, Math.floor(Number(p.get("page")) || 1)));
  const daTra = p.has("q") || Boolean(loai) || p.get("tat_ca") === "1" || page > 1;
  const size = daTra ? 20 : SO_PHO_BIEN;
  const { items, total, pages } = await timTaiLieuPage({
    q: q || undefined,
    loai: loai || undefined,
    gioiHan: size,
    page,
  });
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (loai) query.set("loai", loai);
  if (daTra) query.set("tat_ca", "1");
  return {
    chiTiet: null,
    tra: {
      q,
      loai,
      xe: "",
      nhom: "",
      coLoc: Boolean(q || loai),
      daTra,
      items,
      total,
      pages,
      page,
      query: query.toString(),
    },
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (loaderData?.chiTiet) return pageMeta(loaderData.chiTiet.tieuDe, { index: false });
  return pageMeta("Quy trình, Biểu mẫu", {
    description: "Tra quy trình xử lý theo từng bước và biểu mẫu, hướng dẫn nghiệp vụ để mở xem hoặc tải về.",
  });
}

export default function QuyTrinhPage({ loaderData }: Route.ComponentProps) {
  const { chiTiet, tra } = loaderData;
  const nav = useNavigation();
  const busy = nav.state === "loading" && nav.location?.pathname === DUONG_DAN;

  if (chiTiet) {
    return (
      <KhungTrang className="wrap max-w-2xl py-8">
        <p className="hidden md:block">
          <Link
            to={DUONG_DAN}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline"
          >
            <Icon name="arrowLeft" className="size-4" />
            Quy trình, biểu mẫu
          </Link>
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
          {TEN_LOAI[chiTiet.loai]}
          {chiTiet.banNhap ? <Badge tone="warn">Bản nháp, chưa đối chiếu văn bản</Badge> : null}
        </p>
        <TieuDeTrang icon="search" className="mt-1">
          {chiTiet.tieuDe}
        </TieuDeTrang>
        {chiTiet.tomTat ? (
          <p className="mt-2 text-base leading-relaxed text-ink-2">{chiTiet.tomTat}</p>
        ) : null}
        <div className="mt-6">
          <CacBuocQuyTrinh ma={chiTiet.ma} cacBuoc={chiTiet.cacBuoc} />
        </div>
      </KhungTrang>
    );
  }
  if (!tra) return null;

  const { q, loai, xe, nhom, coLoc, daTra, items, total, page, pages } = tra;
  const hrefTrang = (n: number) => {
    const p = new URLSearchParams(tra.query);
    if (n > 1) p.set("page", String(n));
    return `${DUONG_DAN}?${p}`;
  };
  return (
    <KhungTraCuu
      title="Tra cứu quy trình, biểu mẫu"
      description="Tìm quy trình, biểu mẫu và tài liệu hướng dẫn làm việc."
    >
      <TabVanBanBieuMau chon="bieu-mau" />
      <div className="mt-4">
        <OTimBieuMau q={q} loai={loai} xe={xe} nhom={nhom} />
      </div>

      <section
        aria-labelledby="bm-danh-sach"
        className={cn("mt-6 border-t border-line pt-4", busy && "opacity-60")}
        aria-busy={busy}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="bm-danh-sach" className="font-sans text-xl font-semibold">
            {coLoc ? "Kết quả tra cứu" : daTra ? "Tất cả quy trình, biểu mẫu" : "Biểu mẫu làm việc phổ biến"}
          </h2>
          {daTra ? (
            coLoc ? (
              <Link
                to={DUONG_DAN}
                className="inline-flex min-h-11 items-center text-base text-primary underline"
              >
                Bỏ bộ lọc
              </Link>
            ) : null
          ) : items.length ? (
            <Link
              to={`${DUONG_DAN}?tat_ca=1`}
              className="inline-flex min-h-11 items-center gap-1 text-base font-medium text-primary"
            >
              Xem tất cả
              <Icon name="chevronRight" kieu="net" className="size-4" />
            </Link>
          ) : null}
        </div>

        <p aria-live="polite" className="mt-2 text-sm text-ink-2">
          {total.toLocaleString("vi-VN")} tài liệu phù hợp
        </p>
        {items.length === 0 ? (
          coLoc ? (
            <EmptyState icon="search" title="Không có quy trình, biểu mẫu nào khớp" className="mt-3">
              <p>Thử từ khóa ngắn hơn hoặc chọn loại tài liệu khác.</p>
            </EmptyState>
          ) : (
            <EmptyState icon="file" title="Chưa có quy trình, biểu mẫu được duyệt" className="mt-3">
              <p>Quy trình và biểu mẫu hiện ở đây sau khi quản trị viên nội dung soạn và được duyệt.</p>
            </EmptyState>
          )
        ) : (
          <>
            {daTra ? (
              <p className="mt-1 text-base text-ink-2" aria-live="polite">
                Có{" "}
                <strong className="font-semibold text-primary">
                  {total.toLocaleString("vi-VN")} kết quả
                </strong>{" "}
                được tìm thấy
              </p>
            ) : null}
            <ul className="mt-3 grid gap-3">
              {items.map((t) => (
                <TheTaiLieu key={`${t.loai}-${t.ma}`} t={t} />
              ))}
            </ul>
          </>
        )}
        {daTra && (pages > 1 || page > 1) ? (
          <nav aria-label="Trang tài liệu" className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {page > 1 ? (
              <Link
                to={hrefTrang(page - 1)}
                className="inline-flex min-h-11 items-center text-primary underline"
              >
                Trang trước
              </Link>
            ) : (
              <span />
            )}
            <span>
              Trang {page} / {pages}
            </span>
            {page < pages ? (
              <Link
                to={hrefTrang(page + 1)}
                className="inline-flex min-h-11 items-center text-primary underline"
              >
                Trang sau
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </KhungTraCuu>
  );
}
