/**
 * Tính ngày xử lý vi phạm: nhập ngày lập biên bản, ra ngày hẹn người vi phạm lên làm việc
 * (lib/tinh-ngay-xu-ly.ts) và lịch đánh dấu hai ngày. Khai riêng trong routes.ts nên thắng route
 * chung cong-cu/:ma.
 */
import { Form, Link, useNavigation } from "react-router";

import { LichNgayHen } from "../components/cong-cu/LichNgayHen";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { formatDate, isIsoDate, todayIso } from "../lib/format";
import { pageMeta } from "../lib/site";
import { ngayDayDu, SO_NGAY_HEN, tinhNgayHen } from "../lib/tinh-ngay-xu-ly";
import type { Route } from "./+types/cong-cu.tinh-ngay-xu-ly";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tính ngày xử lý vi phạm", {
    description:
      "Tính ngày hẹn người vi phạm lên làm việc từ ngày lập biên bản, bỏ qua ngày nghỉ hằng tuần và ngày lễ, tết.",
  });
}

/** Chuỗi YYYY-MM-DD có thật trên lịch (loại 30/02...) và trong khoảng năm tính được. */
function laNgayHopLe(v: string): boolean {
  const d = new Date(`${v}T00:00:00Z`);
  const y = Number(v.slice(0, 4));
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) && y >= 1990 && y <= 2100;
}

export function loader({ request }: Route.LoaderArgs) {
  const raw = new URL(request.url).searchParams.get("ngay_lap")?.trim() ?? "";
  const homNay = todayIso();
  if (!raw) return { ngayLap: homNay, loi: null, kq: null };
  if (!isIsoDate(raw) || !laNgayHopLe(raw)) {
    return { ngayLap: homNay, loi: "Ngày lập biên bản không hợp lệ. Hãy chọn lại ngày.", kq: null };
  }
  return { ngayLap: raw, loi: null, kq: tinhNgayHen(raw) };
}

export default function TinhNgayXuLy({ loaderData }: Route.ComponentProps) {
  const { ngayLap, loi, kq } = loaderData;
  const busy = useNavigation().state !== "idle";

  return (
    <div className="wrap max-w-3xl py-6 sm:py-10">
      <p className="hidden md:block">
        <Link to="/cong-cu" className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline">
          <Icon name="arrowLeft" className="size-4" />
          Công cụ nghiệp vụ
        </Link>
      </p>
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Tính ngày xử lý vi phạm</h1>
      <p className="mt-2 text-base text-ink-2">
        Ngày hẹn lên làm việc là ngày làm việc thứ {SO_NGAY_HEN} kể từ ngày kế tiếp ngày lập biên bản.
      </p>

      <Form
        method="get"
        action="/cong-cu/tinh-ngay-xu-ly"
        replace
        className="mt-5 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="ngay-lap" className="mb-1.5 block text-base font-medium">
            Ngày lập biên bản
          </label>
          <input
            id="ngay-lap"
            name="ngay_lap"
            type="date"
            required
            min="1990-01-01"
            max="2100-12-31"
            defaultValue={ngayLap}
            className="min-h-12 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-4 text-lg focus:border-primary focus:outline-none"
          />
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          <Icon name="calendar" className="size-5" />
          Tra cứu kết quả
        </Button>
      </Form>

      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}

      {kq ? (
        <section aria-labelledby="ket-qua-tieu-de" className="mt-8">
          <h2 id="ket-qua-tieu-de" className="sr-only">
            Kết quả
          </h2>
          <Card className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-ink-2">Ngày lập biên bản</p>
              <p className="mt-1 text-lg font-semibold">{ngayDayDu(kq.ngayLap)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-2">Ngày hẹn lên làm việc</p>
              <p className="mt-1 text-xl font-bold text-primary">{ngayDayDu(kq.ngayHen)}</p>
            </div>
          </Card>

          <div className="mt-5">
            <LichNgayHen kq={kq} />
          </div>

          {kq.ngayLeBoQua.length ? (
            <div className="mt-5">
              <h3 className="text-base font-semibold">Ngày nghỉ lễ, tết đã bỏ qua</h3>
              <ul className="mt-2 grid gap-1 text-base">
                {kq.ngayLeBoQua.map((l) => (
                  <li key={l.ngay} className="flex gap-3">
                    <span className="w-24 shrink-0 tabular-nums text-ink-2">{formatDate(l.ngay)}</span>
                    {l.ten}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Notice className="mt-6">
            Ngày nghỉ lễ, tết tính theo Điều 112 Bộ luật Lao động số 45/2019/QH14 ngày 20/11/2019; lễ trùng
            thứ Bảy, Chủ nhật thì nghỉ bù vào ngày làm việc kế tiếp theo khoản 3 Điều 111 của Bộ luật này. Năm
            ngày Tết Âm lịch tính là ngày cuối năm âm lịch và mùng 1 đến mùng 4; ngày liền kề Quốc khánh tính
            là 01/9, hoặc 03/9 khi 01/9 trùng ngày nghỉ hằng tuần. Ngày nghỉ hoán đổi do Thủ tướng Chính phủ
            quyết định từng năm chưa được tính; hãy đối chiếu thông báo nghỉ lễ, tết của năm tương ứng.
          </Notice>
        </section>
      ) : null}
    </div>
  );
}
