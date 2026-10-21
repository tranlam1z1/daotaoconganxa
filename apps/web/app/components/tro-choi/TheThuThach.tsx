import { Form, Link } from "react-router";

import type { TongQuanDiem } from "../../lib/diem-thuong";
import { Button, ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";

/**
 * Thẻ "Thử thách hôm nay" (docs/PLAN.md GĐ9): 5 câu giống nhau cho mọi người trong ngày. Nút bắt
 * đầu gửi biểu mẫu `intent=thu-thach` tới action của trang đang dùng thẻ.
 */
export function TheThuThach({
  thuThach,
  chuoi,
  busy = false,
}: {
  thuThach: TongQuanDiem["thu_thach"];
  chuoi: TongQuanDiem["chuoi"];
  busy?: boolean;
}) {
  return (
    <section
      aria-labelledby="thu-thach-tieu-de"
      className="rounded-xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id="thu-thach-tieu-de" className="font-sans text-lg font-semibold">
          Thử thách hôm nay
        </h3>
        <span className="flex items-center gap-1 text-sm font-semibold text-warn">
          <Icon name="flame" className="size-4" />
          {chuoi.hien_tai} ngày
        </span>
      </div>

      {thuThach.so_cau === 0 ? (
        <p className="mt-2 text-[15px] text-ink-2">
          Ngân hàng chưa có câu hỏi đã duyệt cho thử thách hôm nay.
        </p>
      ) : thuThach.da_xong ? (
        <>
          <p className="mt-2 text-[15px] text-ink-2">
            Đã hoàn thành: đúng <span className="font-semibold text-ink">{thuThach.dung}</span>/
            {thuThach.so_cau} câu. Thử thách mới mở lúc 0 giờ ngày mai.
          </p>
          {thuThach.phien_id ? (
            <Link
              to={`/luyen-tap/${thuThach.phien_id}/ket-qua`}
              className="mt-2 inline-flex min-h-11 items-center text-[15px] font-medium text-primary underline"
            >
              Xem lại bài làm
            </Link>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-ink-2">
            {thuThach.so_cau} câu, làm trong khoảng 2 phút.{" "}
            {chuoi.da_hoc_hom_nay ? "Hôm nay bạn đã học." : "Làm xong để giữ chuỗi ngày học."}
          </p>
          {thuThach.phien_id ? (
            <ButtonLink
              to={`/luyen-tap/${thuThach.phien_id}`}
              className="mt-4 min-h-12 w-full text-base sm:w-auto"
            >
              Làm tiếp thử thách
            </ButtonLink>
          ) : (
            <Form method="post" className="mt-4">
              <input type="hidden" name="intent" value="thu-thach" />
              <Button type="submit" disabled={busy} className="min-h-12 w-full text-base sm:w-auto">
                Làm thử thách
              </Button>
            </Form>
          )}
        </>
      )}
    </section>
  );
}
