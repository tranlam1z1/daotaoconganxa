/**
 * Quy trình, Biểu mẫu. Một tệp phục vụ hai route:
 * - `/tra-cuu-nhanh/quy-trinh`: tra chung quy trình (các bước) và biểu mẫu, hướng dẫn dạng tệp. Trên
 *   cùng là hai tab nối với trang Tra cứu văn bản; khung tìm có từ khóa, loại tài liệu và phần nâng cao
 *   (phương tiện, loại vi phạm). Chưa tra thì hiện mục phổ biến: mục ghim trước, rồi theo lượt mở.
 * - `/tra-cuu-nhanh/quy-trinh/:ma`: các bước đánh số của một quy trình (docs/PLAN.md GĐ5).
 * Biểu mẫu mở ở `/tra-cuu-nhanh/bieu-mau/:ma` (tra-cuu-nhanh.bieu-mau.tsx).
 */
import { data, Link, useNavigation } from "react-router";

import { CacBuocQuyTrinh } from "../components/tra-cuu/CacBuocQuyTrinh";
import { OTimBieuMau } from "../components/tra-cuu/OTimBieuMau";
import { TabVanBanBieuMau } from "../components/tra-cuu/TabVanBanBieuMau";
import { TheTaiLieu } from "../components/tra-cuu/TheTaiLieu";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { cn } from "../lib/cn";
import { pageMeta } from "../lib/site";
import { laLoaiTaiLieu, timTaiLieu } from "../lib/tai-lieu";
import {
  CHU_DE_MUC_PHAT,
  KhongTimThay,
  laLoaiXe,
  layQuyTrinh,
  type QuyTrinhTomTat,
} from "../lib/tra-cuu-nhanh";
import type { Route } from "./+types/tra-cuu-nhanh.quy-trinh";

const TEN_LOAI: Record<QuyTrinhTomTat["loai"], string> = {
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
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  const loaiRaw = p.get("loai");
  const loai = laLoaiTaiLieu(loaiRaw) ? loaiRaw : "";
  const xeRaw = p.get("xe");
  const xe = laLoaiXe(xeRaw) ? xeRaw : "";
  const chuDe = CHU_DE_MUC_PHAT.find((c) => c.ma === p.get("nhom")) ?? null;
  const tatCa = p.get("tat_ca") === "1";
  // Bấm nút tra khi mọi ô còn trống (URL có `q=`) cũng tính là đã tra: hiện hết thay vì mục phổ biến.
  const daTra = p.has("q") || Boolean(loai || xe || chuDe) || tatCa;
  const items = await timTaiLieu({
    q: q || undefined,
    loai: loai || undefined,
    xe: xe || undefined,
    nhom: chuDe?.ten,
    gioiHan: daTra ? undefined : SO_PHO_BIEN,
  });
  return {
    chiTiet: null,
    tra: { q, loai, xe, nhom: chuDe?.ma ?? "", coLoc: Boolean(q || loai || xe || chuDe), daTra, items },
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
      <div className="wrap max-w-2xl py-8">
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
        <h1 className="mt-1 text-3xl font-semibold leading-tight">{chiTiet.tieuDe}</h1>
        {chiTiet.tomTat ? (
          <p className="mt-2 text-base leading-relaxed text-ink-2">{chiTiet.tomTat}</p>
        ) : null}
        <div className="mt-6">
          <CacBuocQuyTrinh ma={chiTiet.ma} cacBuoc={chiTiet.cacBuoc} />
        </div>
      </div>
    );
  }
  if (!tra) return null;

  const { q, loai, xe, nhom, coLoc, daTra, items } = tra;
  return (
    <div className="wrap max-w-3xl py-6 sm:py-10">
      <TabVanBanBieuMau chon="bieu-mau" />
      <div className="mt-4">
        <OTimBieuMau q={q} loai={loai} xe={xe} nhom={nhom} />
      </div>

      {/* Nút "Tra cứu biểu mẫu" vắt qua mép dưới khung tìm nên phần dưới lùi xuống thêm nửa nút. */}
      <section aria-labelledby="bm-danh-sach" className={cn("mt-12", busy && "opacity-60")} aria-busy={busy}>
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

        {items.length === 0 ? (
          coLoc ? (
            <EmptyState icon="search" title="Không có quy trình, biểu mẫu nào khớp" className="mt-3">
              <p>Thử từ khóa ngắn hơn, hoặc bỏ bớt loại tài liệu, phương tiện, loại vi phạm đang chọn.</p>
            </EmptyState>
          ) : (
            <EmptyState icon="file" title="Chưa có quy trình, biểu mẫu được duyệt" className="mt-3">
              <p>Quy trình và biểu mẫu hiện ở đây sau khi biên tập viên soạn và được duyệt.</p>
            </EmptyState>
          )
        ) : (
          <>
            {daTra ? (
              <p className="mt-1 text-base text-ink-2" aria-live="polite">
                Có{" "}
                <strong className="font-semibold text-primary">
                  {items.length.toLocaleString("vi-VN")} kết quả
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
      </section>
    </div>
  );
}
