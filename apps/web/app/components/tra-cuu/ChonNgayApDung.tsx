import { Form, Link } from "react-router";

import { formatDate } from "../../lib/format";

/**
 * Ngày áp dụng mặc định là hôm nay, chỉ mở ra khi người dùng muốn "Xem theo ngày khác"
 * (docs/PLAN.md §0.4). `giu` là các tham số khác của trang cần giữ khi đổi ngày.
 */
export function ChonNgayApDung({
  action,
  ngay,
  homNay,
  giu,
}: {
  action: string;
  ngay: string;
  homNay: string;
  giu: Record<string, string>;
}) {
  const khacHomNay = ngay !== homNay;
  const veHomNay = new URLSearchParams(Object.entries(giu).filter(([, v]) => v));
  return (
    <details className="mt-4 rounded-btn border border-line bg-surface px-4" open={khacHomNay}>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink-2">
        {khacHomNay
          ? `Mức phạt áp dụng ngày ${formatDate(ngay)}`
          : "Mức phạt áp dụng hôm nay. Xem theo ngày khác"}
      </summary>
      <Form method="get" action={action} className="flex flex-wrap items-end gap-3 pb-4">
        {Object.entries(giu).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <div>
          <label htmlFor="tcn-ngay" className="mb-1.5 block text-sm font-medium text-ink-2">
            Ngày xảy ra vi phạm
          </label>
          <input
            id="tcn-ngay"
            name="ngay"
            type="date"
            defaultValue={ngay}
            className="min-h-11 rounded-btn border border-line-strong bg-surface px-3 text-base"
          />
        </div>
        <button
          type="submit"
          className="lun min-h-11 rounded-btn border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-2"
        >
          Áp dụng ngày này
        </button>
        {khacHomNay ? (
          <Link
            to={`${action}${veHomNay.size ? `?${veHomNay}` : ""}`}
            className="flex min-h-11 items-center text-sm underline"
          >
            Về hôm nay
          </Link>
        ) : null}
      </Form>
    </details>
  );
}
