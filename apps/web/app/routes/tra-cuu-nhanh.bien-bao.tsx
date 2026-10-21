/**
 * Tra cứu biển báo (docs/PLAN.md GĐ12): lưới ảnh, chip lọc theo nhóm, ô tìm theo tên hoặc mã;
 * bấm một biển thì mở phần chi tiết (ý nghĩa, căn cứ) ngay trên trang (`?ma=`).
 *
 * Ảnh tải lười (loading="lazy") và có kích thước cố định để trang không nhảy khi ảnh về; mỗi ảnh
 * ≤ 20 KB (scripts/bien-bao.ts chặn ảnh quá cỡ), nên lưới tải nhanh trên mạng di động.
 */
import { Form, Link, useSearchParams } from "react-router";

import { CanCuBienBao } from "../components/tra-cuu/CanCuBienBao";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { type BienBao, laNhomBienBao, NHOM_BIEN_BAO, timBienBao } from "../lib/bien-bao";
import { cn } from "../lib/cn";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/tra-cuu-nhanh.bien-bao";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Biển báo đường bộ", {
    description: "Tra biển báo đường bộ theo nhóm, tên hoặc mã; xem ý nghĩa và căn cứ.",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  const nhomRaw = p.get("nhom");
  const nhom = laNhomBienBao(nhomRaw) ? nhomRaw : undefined;
  const { items, ban_nhap } = await timBienBao({ q: q || undefined, nhom });
  const ma = p.get("ma");
  return {
    q,
    nhom: nhom ?? "",
    items,
    xemBanNhap: ban_nhap,
    chon: ma ? (items.find((b) => b.ma === ma) ?? null) : null,
  };
}

const TEN_NHOM = Object.fromEntries(NHOM_BIEN_BAO.map((n) => [n.value, n.label]));

export default function BienBaoPage({ loaderData }: Route.ComponentProps) {
  const { q, nhom, items, xemBanNhap, chon } = loaderData;
  const [params] = useSearchParams();
  const hrefVoi = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="wrap max-w-3xl py-8">
      <p className="hidden text-sm md:block">
        <Link to="/tra-cuu-nhanh" className="inline-flex min-h-11 items-center text-ink-2 underline">
          Tra cứu nhanh
        </Link>
      </p>
      <h1 className="text-3xl font-semibold">Biển báo đường bộ</h1>

      {xemBanNhap ? (
        <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          Đang xem cả biển bản nháp, chưa được đối chiếu với QCVN 41:2024/BGTVT.
        </p>
      ) : null}

      <Form method="get" className="mt-4 flex gap-2" role="search">
        {nhom ? <input type="hidden" name="nhom" value={nhom} /> : null}
        <label htmlFor="tim-bien-bao" className="sr-only">
          Tên hoặc mã biển
        </label>
        <input
          id="tim-bien-bao"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Tên hoặc mã, ví dụ: cấm đỗ, P.102"
          className="min-h-12 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-base placeholder:text-ink-3 focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Tìm biển báo"
          className="grid min-h-12 min-w-12 place-items-center rounded-lg bg-primary text-on-primary"
        >
          <Icon name="search" />
        </button>
      </Form>

      <nav aria-label="Nhóm biển báo" className="-mx-4 mt-3 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          {[{ value: "", label: "Tất cả" }, ...NHOM_BIEN_BAO].map((n) => (
            <li key={n.value} className="shrink-0">
              <Link
                to={hrefVoi({ nhom: n.value || null, ma: null })}
                aria-current={nhom === n.value ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm",
                  nhom === n.value
                    ? "border-primary bg-primary text-on-primary"
                    : "border-line-strong bg-surface",
                )}
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {chon ? <ChiTiet b={chon} dong={hrefVoi({ ma: null })} /> : null}

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="search" title={q ? `Không có biển nào khớp "${q}"` : "Chưa có biển báo nào"}>
            {!q ? (
              <p>Biển báo hiện ra sau khi biên tập viên đối chiếu với QCVN 41:2024/BGTVT và duyệt.</p>
            ) : null}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((b) => (
            <li key={b.ma}>
              <Link
                to={hrefVoi({ ma: b.ma })}
                preventScrollReset
                aria-current={chon?.ma === b.ma ? "true" : undefined}
                className={cn(
                  "flex h-full flex-col items-center rounded-xl border bg-surface p-3 text-center the-bam",
                  chon?.ma === b.ma ? "border-primary ring-2 ring-primary" : "border-line",
                )}
              >
                <img
                  src={`/bien-bao/anh/${encodeURIComponent(b.anh)}`}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  className="size-20"
                />
                <span className="mt-2 text-xs font-semibold text-ink-3">{b.ma}</span>
                <span className="mt-0.5 text-sm leading-snug">{b.ten}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChiTiet({ b, dong }: { b: BienBao; dong: string }) {
  return (
    <section aria-labelledby="chi-tiet-bien" className="mt-4 rounded-xl border border-primary bg-surface p-4">
      <div className="flex gap-4">
        <img
          src={`/bien-bao/anh/${encodeURIComponent(b.anh)}`}
          alt={b.ten}
          width={112}
          height={112}
          className="size-28 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm text-ink-3">
            {b.ma} · {TEN_NHOM[b.nhom] ?? b.nhom}
          </p>
          <h2 id="chi-tiet-bien" className="mt-1 font-sans text-lg font-semibold">
            {b.ten}
          </h2>
          {b.ban_nhap ? <Badge tone="warn">Bản nháp</Badge> : null}
        </div>
      </div>
      <p className="mt-3 text-base leading-relaxed">{b.y_nghia}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <CanCuBienBao b={b} />
        <Link
          to={dong}
          preventScrollReset
          className="inline-flex min-h-11 items-center text-sm text-ink-2 underline"
        >
          Đóng
        </Link>
      </div>
    </section>
  );
}
