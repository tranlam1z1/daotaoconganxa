/**
 * Xác định tuổi vi phạm: nhập ngày sinh (hoặc chỉ tháng, năm / chỉ năm), ra tuổi tính đến hôm nay,
 * tổng số ngày và kết luận theo nhóm tuổi (lib/xac-dinh-tuoi.ts). Khai riêng trong routes.ts nên
 * thắng route chung cong-cu/:ma.
 */
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { formatDate, todayIso } from "../lib/format";
import { pageMeta } from "../lib/site";
import { ngayDayDu } from "../lib/tinh-ngay-xu-ly";
import {
  CAN_CU,
  type KetLuan,
  type KieuNgaySinh,
  laNgayCoThat,
  ngaySinhTinh,
  xacDinhTuoi,
} from "../lib/xac-dinh-tuoi";
import type { Route } from "./+types/cong-cu.xac-dinh-tuoi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Xác định tuổi vi phạm", {
    description: "Tính tuổi của người vi phạm đến hôm nay và cho biết nhóm tuổi áp dụng khi xử lý vi phạm.",
  });
}

const KIEU: ReadonlyArray<{ ma: KieuNgaySinh; ten: string }> = [
  { ma: "ngay", ten: "Biết rõ ngày sinh" },
  { ma: "thang", ten: "Chỉ biết tháng, năm" },
  { ma: "nam", ten: "Chỉ biết năm" },
];

const NAM_MIN = 1900;

const lopO =
  "min-h-12 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-4 text-lg focus:border-primary focus:outline-none";
const lopLuaChon =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 text-base has-[:checked]:border-primary has-[:checked]:bg-primary-soft";

const so = (n: number) => n.toLocaleString("vi-VN");

/** Đọc ngày sinh từ query; trả ngày dùng để tính hoặc lời báo lỗi. */
function docNgaySinh(
  sp: URLSearchParams,
  kieu: KieuNgaySinh,
  homNay: string,
): { ngay: string } | { loi: string } {
  const namNay = Number(homNay.slice(0, 4));
  if (kieu === "ngay") {
    const v = sp.get("ngay_sinh")?.trim() ?? "";
    if (!laNgayCoThat(v) || Number(v.slice(0, 4)) < NAM_MIN)
      return { loi: "Ngày sinh không hợp lệ. Hãy chọn lại ngày." };
    if (v > homNay) return { loi: "Ngày sinh không được sau ngày hôm nay." };
    return { ngay: v };
  }
  const nam = Number(sp.get("nam"));
  if (!Number.isInteger(nam) || nam < NAM_MIN || nam > namNay) {
    return { loi: `Năm sinh không hợp lệ. Hãy nhập năm từ ${NAM_MIN} đến ${namNay}.` };
  }
  // Ngày cuối tháng, cuối năm hiện tại có thể sau hôm nay: khi đó chưa đủ 0 ngày tuổi, lấy hôm nay.
  const khongSauHomNay = (ngay: string) => ({ ngay: ngay > homNay ? homNay : ngay });
  if (kieu === "nam") return khongSauHomNay(ngaySinhTinh("nam", nam));
  const thang = Number(sp.get("thang"));
  if (!Number.isInteger(thang) || thang < 1 || thang > 12) return { loi: "Hãy chọn tháng sinh." };
  if (`${nam}-${String(thang).padStart(2, "0")}` > homNay.slice(0, 7)) {
    return { loi: "Tháng sinh không được sau tháng hiện tại." };
  }
  return khongSauHomNay(ngaySinhTinh("thang", nam, thang));
}

export function loader({ request }: Route.LoaderArgs) {
  const sp = new URL(request.url).searchParams;
  const homNay = todayIso();
  const k = sp.get("kieu");
  const kieu: KieuNgaySinh = k === "thang" || k === "nam" ? k : "ngay";
  const nhap = {
    kieu,
    ngaySinh: sp.get("ngay_sinh") ?? "",
    thang: sp.get("thang") ?? "",
    nam: sp.get("nam") ?? "",
  };
  if (!sp.has("ngay_sinh") && !sp.has("nam")) return { homNay, nhap, loi: null, kq: null };
  const r = docNgaySinh(sp, kieu, homNay);
  if ("loi" in r) return { homNay, nhap, loi: r.loi, kq: null };
  return { homNay, nhap, loi: null, kq: xacDinhTuoi(r.ngay, homNay, kieu) };
}

function CanCu({ ma }: { ma: keyof typeof CAN_CU }) {
  const c = CAN_CU[ma];
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">
      <span>Căn cứ: {c.nhan}.</span>
      {c.daDoiChieu ? null : <Badge tone="warn">Cần đối chiếu</Badge>}
    </p>
  );
}

function TheKetLuan({ tieuDe, kl }: { tieuDe: string; kl: KetLuan }) {
  return (
    <Card>
      <h3 className="text-base font-medium text-ink-2">{tieuDe}</h3>
      <p className="mt-1 text-lg font-bold">{kl.nhom}</p>
      <ul className="mt-2 grid list-disc gap-1 pl-5 text-base">
        {kl.noiDung.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <CanCu ma={kl.canCu} />
    </Card>
  );
}

export default function XacDinhTuoi({ loaderData }: Route.ComponentProps) {
  const { homNay, nhap, loi, kq } = loaderData;
  const busy = useNavigation().state !== "idle";
  const [kieu, datKieu] = useState<KieuNgaySinh>(nhap.kieu);
  const namNay = Number(homNay.slice(0, 4));

  return (
    <KhungTrang className="wrap max-w-3xl py-6 sm:py-10">
      <header className="tieu-de-trang tieu-de-trang-banner relative isolate flex min-w-0 items-center gap-3">
        <span
          className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"
          aria-hidden="true"
        >
          <Icon name="shield" kieu="net" className="size-6" />
        </span>
        <div className="min-w-0 flex-1 sm:max-w-[60%]">
          <h1 className="text-2xl font-bold leading-tight">Xác định tuổi vi phạm</h1>
          <p className="mt-1 text-sm text-ink-2">
            Tuổi tính đến hôm nay, {ngayDayDu(homNay)}. Người được coi là đủ N tuổi kể từ ngày sinh nhật thứ
            N.
          </p>
        </div>
      </header>

      <Form method="get" action="/cong-cu/xac-dinh-tuoi" replace className="mt-5 grid gap-4">
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-1.5 text-base font-medium">Ngày sinh</legend>
          {KIEU.map((k) => (
            <label key={k.ma} className={lopLuaChon}>
              <input
                type="radio"
                name="kieu"
                value={k.ma}
                checked={kieu === k.ma}
                onChange={() => datKieu(k.ma)}
                className="size-5"
              />
              {k.ten}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-end gap-3">
          {kieu === "ngay" ? (
            <div className="min-w-0 flex-1 basis-56">
              <label htmlFor="ngay-sinh" className="mb-1.5 block text-base font-medium">
                Ngày, tháng, năm sinh
              </label>
              <input
                id="ngay-sinh"
                name="ngay_sinh"
                type="date"
                required
                min={`${NAM_MIN}-01-01`}
                max={homNay}
                defaultValue={nhap.ngaySinh}
                className={lopO}
              />
            </div>
          ) : null}
          {kieu === "thang" ? (
            <div className="min-w-0 flex-1 basis-32">
              <label htmlFor="thang-sinh" className="mb-1.5 block text-base font-medium">
                Tháng sinh
              </label>
              <select id="thang-sinh" name="thang" required defaultValue={nhap.thang} className={lopO}>
                <option value="" disabled>
                  Chọn tháng
                </option>
                {Array.from({ length: 12 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: số tháng là chính giá trị, thứ tự cố định
                  <option key={i + 1} value={i + 1}>
                    Tháng {i + 1}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {kieu !== "ngay" ? (
            <div className="min-w-0 flex-1 basis-32">
              <label htmlFor="nam-sinh" className="mb-1.5 block text-base font-medium">
                Năm sinh
              </label>
              <input
                id="nam-sinh"
                name="nam"
                type="number"
                inputMode="numeric"
                required
                min={NAM_MIN}
                max={namNay}
                placeholder={String(namNay - 16)}
                defaultValue={nhap.nam}
                className={lopO}
              />
            </div>
          ) : null}
          <Button type="submit" size="lg" disabled={busy}>
            <Icon name="idCard" className="size-5" />
            Tra cứu kết quả
          </Button>
        </div>
      </Form>

      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}

      {kq ? (
        <section aria-labelledby="ket-qua-tieu-de" className="mt-8">
          <h2 id="ket-qua-tieu-de" className="text-xl font-bold">
            Kết quả
          </h2>
          <Card className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-ink-2">Tuổi</p>
              <p className="mt-1 text-xl font-bold text-primary">
                {kq.tuoi.nam} tuổi {kq.tuoi.thang} tháng {kq.tuoi.ngay} ngày
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-2">Tổng số ngày</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{so(kq.tongNgay)} ngày</p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-2">
                {kq.kieu === "ngay" ? "Ngày sinh" : "Ngày sinh dùng để tính"}
              </p>
              <p className="mt-1 text-lg font-semibold">{ngayDayDu(kq.ngaySinh)}</p>
            </div>
          </Card>

          {kq.kieu !== "ngay" ? (
            <Notice className="mt-4">
              Không rõ ngày sinh nên lấy ngày cuối cùng của {kq.kieu === "thang" ? "tháng" : "năm"} sinh (
              {formatDate(kq.ngaySinh)}) để tính, có lợi cho người vi phạm.
              {CAN_CU.ngaySinhThieu.daDoiChieu
                ? null
                : " Quy tắc này cần đối chiếu với văn bản đang có hiệu lực."}
            </Notice>
          ) : null}

          {kq.mocKeTiep ? (
            <p className="mt-4 flex items-start gap-2 text-base">
              <Icon name="calendar" className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                Còn <strong>{so(kq.mocKeTiep.conNgay)} ngày</strong> nữa đủ {kq.mocKeTiep.tuoi} tuổi (
                {ngayDayDu(kq.mocKeTiep.ngayDu)}).
              </span>
            </p>
          ) : null}

          <h2 className="mt-8 text-xl font-bold">Kết luận</h2>
          <div className="mt-3 grid gap-4">
            <TheKetLuan tieuDe="Xử phạt vi phạm hành chính" kl={kq.vphc} />
            <TheKetLuan tieuDe="Trách nhiệm hình sự" kl={kq.hinhSu} />
            <Card>
              <h3 className="text-base font-medium text-ink-2">Tuổi điều khiển phương tiện</h3>
              <ul className="mt-2 grid gap-3">
                {kq.laiXe.map((m) => (
                  <li key={m.tuoi} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <span className="min-w-0 flex-1 basis-64 text-base">
                      <strong>Đủ {m.tuoi} tuổi:</strong> {m.noiDung}
                    </span>
                    {m.conNgay === 0 ? (
                      <Badge tone="ok">Đã đủ từ {formatDate(m.ngayDu)}</Badge>
                    ) : (
                      <Badge tone="muted">
                        Còn {so(m.conNgay)} ngày ({formatDate(m.ngayDu)})
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
              <CanCu ma="laiXe" />
            </Card>
          </div>

          <Notice className="mt-6">
            Các căn cứ gắn nhãn "Cần đối chiếu" chưa được kiểm tra với nguyên văn đang có hiệu lực. Hãy đối
            chiếu văn bản gốc trước khi dùng kết luận này để xử lý vụ việc.
          </Notice>
        </section>
      ) : null}
    </KhungTrang>
  );
}
