import { useState } from "react";
import { Icon } from "../components/ui/Icon";
import { KhungNoiDung } from "../components/ui/KhungNoiDung";
import { CONG_DICH_VU, DICH_VU_CONG, type DichVuCong, timDichVuCong } from "../lib/dich-vu-cong";
import { pageMeta } from "../lib/site";

export function meta() {
  return pageMeta("Dịch vụ công trực tuyến", {
    description: "Tìm và mở thủ tục trên Cổng Dịch vụ công Bộ Công an.",
  });
}

const MAU = [
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-violet-50 text-violet-700",
  "bg-blue-50 text-blue-700",
];

function DanhSach({ items }: { items: DichVuCong[] }) {
  return (
    <ul className="mt-3 grid gap-3 md:grid-cols-2">
      {items.map((d, i) => (
        <li key={d.ma}>
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full min-h-24 items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card the-bam"
            aria-label={`${d.ten} (mở trong thẻ mới)`}
          >
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${MAU[i % MAU.length]}`}>
              <Icon name="file" kieu="net" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{d.ten}</span>
              <span className="mt-1 block text-sm text-ink-2">Lĩnh vực {d.linhVuc.toLowerCase()}</span>
            </span>
            <Icon name="chevronRight" className="size-5 shrink-0 text-ink-3" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function DichVuCongPage() {
  const [q, setQ] = useState("");
  const items = timDichVuCong(q);
  return (
    <KhungNoiDung
      title="Dịch vụ công trực tuyến"
      icon="file"
      description="Chọn thủ tục để mở trên Cổng Dịch vụ công Bộ Công an trong thẻ mới."
    >
      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-md">
            <label htmlFor="tim-dich-vu" className="mb-2 block text-sm font-medium">
              Tìm thủ tục
            </label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-3 size-5 text-ink-3" />
              <input
                id="tim-dich-vu"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ví dụ: tạm trú, đăng ký xe…"
                className="min-h-11 w-full rounded-xl border border-line bg-surface py-2 pl-10 pr-3 text-ink"
              />
            </div>
          </div>
          <a
            href={CONG_DICH_VU}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium the-bam"
          >
            Mở Cổng dịch vụ công
            <Icon name="arrowRight" className="size-4" />
            <span className="sr-only"> (thẻ mới)</span>
          </a>
        </div>
        {q.trim() ? (
          <section className="mt-6" aria-labelledby="ket-qua-dich-vu">
            <h2 id="ket-qua-dich-vu" className="text-sm font-semibold text-ink-2" role="status">
              {items.length} thủ tục phù hợp
            </h2>
            {items.length ? (
              <DanhSach items={items} />
            ) : (
              <div className="mt-3 rounded-2xl border border-line bg-surface p-6">
                <p>
                  Không tìm thấy thủ tục trong danh mục này. Bạn có thể đổi từ khóa hoặc tìm trên cổng Bộ Công
                  an.
                </p>
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="mt-3 min-h-11 text-primary underline"
                >
                  Xóa tìm kiếm
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="mt-6" aria-labelledby="dich-vu-pho-bien">
              <h2 id="dich-vu-pho-bien" className="text-sm font-semibold text-ink-2">
                Dịch vụ phổ biến
              </h2>
              <DanhSach items={DICH_VU_CONG.filter((d) => d.phoBien)} />
            </section>
            <section className="mt-7" aria-labelledby="danh-muc-dich-vu">
              <h2 id="danh-muc-dich-vu" className="text-sm font-semibold text-ink-2">
                Danh mục dịch vụ
              </h2>
              <DanhSach items={DICH_VU_CONG.filter((d) => !d.phoBien)} />
            </section>
          </>
        )}
        <p className="mt-6 text-sm text-ink-3">
          Danh mục chọn lọc từ Cổng Dịch vụ công Bộ Công an. Xem đầy đủ thủ tục và hướng dẫn tại cổng.
        </p>
      </div>
    </KhungNoiDung>
  );
}
