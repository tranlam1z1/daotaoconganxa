/**
 * Tra mức phạt theo hành vi và loại xe (docs/PLAN.md GĐ5): một ô tìm, chip chọn loại xe,
 * danh sách thẻ mức phạt. Ngày áp dụng mặc định là hôm nay.
 */
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import { ChonNgayApDung } from "../components/tra-cuu/ChonNgayApDung";
import { KhungTraCuu } from "../components/tra-cuu/KhungTraCuu";
import { TheMucPhat } from "../components/tra-cuu/TheMucPhat";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { cn } from "../lib/cn";
import { isIsoDate, todayIso } from "../lib/format";
import { pageMeta } from "../lib/site";
import { LOAI_XE, laLoaiXe, timMucPhat } from "../lib/tra-cuu-nhanh";
import type { Route } from "./+types/tra-cuu-nhanh.muc-phat";

export function meta({ location }: Route.MetaArgs) {
  const q = new URLSearchParams(location.search).get("q")?.trim();
  return pageMeta(q ? `Mức phạt: ${q}` : "Tra mức phạt", { index: false });
}

/** Hành vi hay tra khi làm nhiệm vụ; bấm là tra luôn. */
const GOI_Y = ["nồng độ cồn", "vượt đèn đỏ", "quá tốc độ", "mũ bảo hiểm", "điện thoại"];

export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 200);
  const xeRaw = p.get("xe");
  const xe = laLoaiXe(xeRaw) ? xeRaw : "";
  const homNay = todayIso();
  const ngayRaw = p.get("ngay");
  const ngay = isIsoDate(ngayRaw) ? ngayRaw : homNay;

  // Chưa gõ gì và chưa chọn xe thì chỉ hiện gợi ý, không gọi API.
  if (!q && !xe) return { q, xe, ngay, homNay, items: [], daTra: false };
  const kq = await timMucPhat({ q: q || undefined, xe: xe || undefined, ngay });
  return { q, xe, ngay, homNay, items: kq.items, daTra: true };
}

export default function MucPhatPage({ loaderData }: Route.ComponentProps) {
  const { q, xe, ngay, homNay, items, daTra } = loaderData;
  const [params] = useSearchParams();
  const busy = useNavigation().state === "loading";

  const hrefVoi = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    return `/tra-cuu-nhanh/muc-phat${s ? `?${s}` : ""}`;
  };

  return (
    <KhungTraCuu title="Tra mức phạt" description="Tra cứu hành vi vi phạm, mức xử phạt và căn cứ pháp luật.">
      <Form
        method="get"
        action="/tra-cuu-nhanh/muc-phat"
        role="search"
        className="tra-cuu-form mt-4 grid gap-2"
      >
        {xe ? <input type="hidden" name="xe" value={xe} /> : null}
        {ngay !== homNay ? <input type="hidden" name="ngay" value={ngay} /> : null}
        <label htmlFor="mp-q" className="sr-only">
          Hành vi vi phạm
        </label>
        <input
          id="mp-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Ví dụ: nồng độ cồn"
          enterKeyHint="search"
          className="min-h-12 w-full min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-4 text-base placeholder:text-ink-3 focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="lun min-h-12 shrink-0 rounded-lg bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-hover"
        >
          <Icon name="search" kieu="net" className="size-5" /> Tra cứu
        </button>
      </Form>

      <nav aria-label="Chọn loại xe" className="mt-3">
        <ul className="flex flex-wrap gap-2">
          {[{ value: "", label: "Mọi loại xe" }, ...LOAI_XE].map((l) => {
            const chon = l.value === xe;
            return (
              <li key={l.label}>
                <Link
                  to={hrefVoi({ xe: l.value || null })}
                  aria-current={chon ? "true" : undefined}
                  className={cn(
                    "flex min-h-12 items-center rounded-full border px-4 text-base",
                    chon
                      ? "border-primary bg-primary text-on-primary"
                      : "border-line-strong bg-surface text-ink-2 dong-bam hover:text-primary",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <ChonNgayApDung action="/tra-cuu-nhanh/muc-phat" ngay={ngay} homNay={homNay} giu={{ q, xe }} />

      <div className={cn("mt-6", busy && "opacity-60")} aria-busy={busy}>
        {!daTra ? (
          <>
            <p className="text-sm text-ink-3">Hay tra:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {GOI_Y.map((g) => (
                <li key={g}>
                  <Link
                    to={hrefVoi({ q: g })}
                    className="flex min-h-12 items-center rounded-full border border-line-strong bg-surface px-4 text-base dong-bam hover:text-primary"
                  >
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : items.length === 0 ? (
          <EmptyState icon="search" title={q ? `Chưa có mức phạt khớp với “${q}”` : "Chưa có mức phạt"}>
            <p>Thử từ khóa ngắn hơn hoặc chọn “Mọi loại xe”. Bạn cũng có thể tra nguyên văn trong văn bản.</p>
            <Link
              to={`/tim-kiem${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className="mt-2 inline-flex min-h-11 items-center text-primary underline"
            >
              Tra cứu văn bản
            </Link>
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-3" aria-live="polite">
              {items.length.toLocaleString("vi-VN")} mức phạt
            </p>
            <ul className="grid gap-3">
              {items.map((m) => (
                <TheMucPhat key={m.ma} muc={m} hienXe={!xe} />
              ))}
            </ul>
          </>
        )}
      </div>
    </KhungTraCuu>
  );
}
