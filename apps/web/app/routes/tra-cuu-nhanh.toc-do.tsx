/**
 * Tra mức phạt theo tốc độ (docs/PLAN.md GĐ5): chọn loại xe, nhập tốc độ cho phép và tốc độ
 * đo được, ra một thẻ kết quả. Chọn khoảng tốc độ làm ở máy chủ.
 *
 * Khi đã có tốc độ tối đa theo loại đường được duyệt (GĐ-G2), có thêm ô chọn loại đường thay cho
 * nhập tốc độ cho phép. Chưa có dòng nào được duyệt thì ô này không hiện.
 */
import { Form, Link, useNavigation } from "react-router";
import { ChonNgayApDung } from "../components/tra-cuu/ChonNgayApDung";
import { KhungTraCuu } from "../components/tra-cuu/KhungTraCuu";
import { TheMucPhat } from "../components/tra-cuu/TheMucPhat";
import { Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { isIsoDate, todayIso } from "../lib/format";
import { pageMeta } from "../lib/site";
import { danhSachTocDoToiDa, LOAI_XE, type LoaiXe, laLoaiXe, traTocDo } from "../lib/tra-cuu-nhanh";
import type { Route } from "./+types/tra-cuu-nhanh.toc-do";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tra mức phạt theo tốc độ", { index: false });
}

/** Số km/h từ ô nhập; nhận cả dấu phẩy thập phân. Không hợp lệ thì null. */
function docSo(v: string | null): number | null {
  if (!v?.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const xeRaw = p.get("xe");
  const xe: LoaiXe = laLoaiXe(xeRaw) ? xeRaw : "mo_to";
  const choPhep = docSo(p.get("cho_phep"));
  const doDuoc = docSo(p.get("do_duoc"));
  const homNay = todayIso();
  const ngayRaw = p.get("ngay");
  const ngay = isIsoDate(ngayRaw) ? ngayRaw : homNay;
  const duong = p.get("duong")?.trim() || null;
  const form = { xe, choPhep: p.get("cho_phep") ?? "", doDuoc: p.get("do_duoc") ?? "", duong: duong ?? "" };
  // Lỗi khi lấy danh sách loại đường không làm hỏng trang: chỉ không hiện ô chọn loại đường.
  const loaiDuong = await danhSachTocDoToiDa(xe, ngay).catch(() => []);
  const chung = { form, ngay, homNay, loaiDuong };

  if (choPhep === null && doDuoc === null) return { ...chung, loi: null, kq: null };
  if ((choPhep === null && !duong) || doDuoc === null) {
    return {
      ...chung,
      loi: "Hãy nhập cả tốc độ cho phép (hoặc chọn loại đường) và tốc độ đo được.",
      kq: null,
    };
  }
  if ((choPhep !== null && (choPhep < 5 || choPhep > 200)) || doDuoc < 0 || doDuoc > 400) {
    return {
      ...chung,
      loi: "Tốc độ cho phép phải từ 5 đến 200 km/h; tốc độ đo được từ 0 đến 400 km/h.",
      kq: null,
    };
  }
  try {
    const kq = await traTocDo({
      xe,
      ...(choPhep !== null ? { choPhep } : { duong: duong! }),
      doDuoc,
      ngay,
    });
    return { ...chung, loi: null, kq };
  } catch (e) {
    return { ...chung, loi: e instanceof Error ? e.message : "Không tra được.", kq: null };
  }
}

const oSoClass =
  "min-h-12 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-4 text-lg focus:border-primary focus:outline-none";

export default function TocDoPage({ loaderData }: Route.ComponentProps) {
  const { form, ngay, homNay, loi, kq, loaiDuong } = loaderData;
  const busy = useNavigation().state !== "idle";

  return (
    <KhungTraCuu
      title="Tra mức phạt theo tốc độ"
      description="Chọn phương tiện và nhập tốc độ để tra cứu mức xử phạt."
    >
      <Form method="get" action="/tra-cuu-nhanh/toc-do" className="tra-cuu-form mt-5 grid gap-4">
        {ngay !== homNay ? <input type="hidden" name="ngay" value={ngay} /> : null}
        <fieldset>
          <legend className="mb-2 text-base font-medium">Loại xe</legend>
          <div className="grid grid-cols-2 gap-2">
            {LOAI_XE.map((l) => (
              <label
                key={l.value}
                className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-base font-medium has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary"
              >
                <input
                  type="radio"
                  name="xe"
                  value={l.value}
                  defaultChecked={form.xe === l.value}
                  className="size-5"
                />
                {l.label}
              </label>
            ))}
          </div>
        </fieldset>

        {loaiDuong.length ? (
          <div>
            <label htmlFor="td-duong" className="mb-1.5 block text-base font-medium">
              Loại đường (tùy chọn, thay cho tốc độ cho phép)
            </label>
            <select id="td-duong" name="duong" defaultValue={form.duong} className={oSoClass}>
              <option value="">Nhập tốc độ cho phép bên dưới</option>
              {loaiDuong.map((d) => (
                <option key={d.ma} value={d.loaiDuong}>
                  {d.tenLoaiDuong}: {d.tocDoToiDa} km/h
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="td-cho-phep" className="mb-1.5 block text-base font-medium">
              Tốc độ cho phép
            </label>
            <input
              id="td-cho-phep"
              name="cho_phep"
              inputMode="decimal"
              required={!loaiDuong.length}
              defaultValue={form.choPhep}
              placeholder="km/h"
              className={oSoClass}
            />
          </div>
          <div>
            <label htmlFor="td-do-duoc" className="mb-1.5 block text-base font-medium">
              Tốc độ đo được
            </label>
            <input
              id="td-do-duoc"
              name="do_duoc"
              inputMode="decimal"
              required
              defaultValue={form.doDuoc}
              placeholder="km/h"
              className={oSoClass}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="lun min-h-12 rounded-lg bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? "Đang tra…" : "Tra mức phạt"}
        </button>
      </Form>

      <ChonNgayApDung
        action="/tra-cuu-nhanh/toc-do"
        ngay={ngay}
        homNay={homNay}
        giu={{ xe: form.xe, cho_phep: form.choPhep, do_duoc: form.doDuoc, duong: form.duong }}
      />

      <div className={cn("mt-6", busy && "opacity-60")} aria-live="polite">
        {loi ? <Notice tone="danger">{loi}</Notice> : null}
        {kq ? (
          <>
            <p className="text-lg">
              {kq.tenXe}, cho phép {kq.choPhep} km/h
              {kq.tocDoTheoDuong ? ` (${kq.tocDoTheoDuong.tenLoaiDuong})` : ""}, đo được {kq.doDuoc} km/h:{" "}
              <strong>
                {kq.vuot > 0 ? `vượt ${kq.vuot.toLocaleString("vi-VN")} km/h` : "không vượt tốc độ"}
              </strong>
            </p>
            {kq.ketQua ? (
              <ul className="mt-3">
                <TheMucPhat muc={kq.ketQua} />
              </ul>
            ) : kq.vuot > 0 ? (
              <Notice className="mt-3">
                Dữ liệu tra cứu nhanh chưa có mức phạt khớp với trường hợp này.{" "}
                <Link
                  to={`/tim-kiem?q=${encodeURIComponent("quá tốc độ")}`}
                  className="inline-flex min-h-11 items-center underline"
                >
                  Tra trong văn bản
                </Link>
              </Notice>
            ) : null}
          </>
        ) : null}
      </div>
    </KhungTraCuu>
  );
}
