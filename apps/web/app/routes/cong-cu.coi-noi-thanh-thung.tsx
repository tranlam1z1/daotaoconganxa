/**
 * Tính cơi nới thành thùng xe: nhập kích thước lòng thùng theo giấy chứng nhận kiểm định và kích
 * thước đo thực tế (mm), ra phần chênh từng chiều, thể tích tăng thêm và khung xử phạt
 * (lib/coi-noi-thung.ts). Khai riêng trong routes.ts nên thắng route chung cong-cu/:ma.
 */
import { Form, useNavigation } from "react-router";
import { DauTrangCongCu, ONhapSo } from "../components/cong-cu/BieuMau";
import { LuuYDoiChieu, TheKhungPhat } from "../components/cong-cu/TheKhungPhat";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { CHIEU, type Chieu, type SoSanhChieu, tinhCoiNoi } from "../lib/coi-noi-thung";
import { pageMeta } from "../lib/site";
// Kích thước theo mm gõ như khối lượng theo kg: dấu chấm là phân cách hàng nghìn ("2.350" là 2350 mm).
import { docSoKg as docSoMm } from "../lib/tinh-qua-tai";
import type { Route } from "./+types/cong-cu.coi-noi-thanh-thung";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tính cơi nới thành thùng xe", {
    description:
      "Đối chiếu kích thước thùng xe đo thực tế với kích thước ghi trong giấy chứng nhận kiểm định.",
  });
}

const mm = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const coDau = (n: number, hauTo: string) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}${hauTo}`;
const tenChieu = (ma: Chieu) => CHIEU.find((c) => c.ma === ma)?.ten ?? ma;

/** Tên tham số trên URL, cũng là `name` của các ô nhập. */
type MaO = `${Chieu}_${"giay" | "do"}` | "sai_so";
const O: readonly MaO[] = [...CHIEU.flatMap(({ ma }) => [`${ma}_giay`, `${ma}_do`] as const), "sai_so"];

export function loader({ request }: Route.LoaderArgs) {
  const sp = new URL(request.url).searchParams;
  const nhap = Object.fromEntries(O.map((o) => [o, sp.get(o) ?? ""])) as Record<MaO, string>;
  if (!sp.has("cao_giay")) return { nhap, loi: null, kq: null, saiSo: 0 };
  const loi = (l: string) => ({ nhap, loi: l, kq: null, saiSo: 0 });

  const so: Partial<Record<Chieu, { giay: number; doDuoc: number }>> = {};
  for (const { ma, ten } of CHIEU) {
    const g = nhap[`${ma}_giay`].trim();
    const d = nhap[`${ma}_do`].trim();
    if (!g && !d) continue;
    const giay = docSoMm(g);
    const doDuoc = docSoMm(d);
    if (giay === null || giay <= 0 || doDuoc === null || doDuoc <= 0) {
      return loi(`${ten}: hãy nhập đủ cả kích thước theo giấy và kích thước đo được (số mm lớn hơn 0).`);
    }
    so[ma] = { giay, doDuoc };
  }
  if (Object.keys(so).length === 0) return loi("Hãy nhập ít nhất một chiều của thùng xe.");

  let saiSo = 0;
  if (nhap.sai_so.trim()) {
    const v = docSoMm(nhap.sai_so);
    if (v === null) return loi("Sai số cho phép không hợp lệ. Hãy nhập số mm hoặc để trống.");
    saiSo = v;
  }
  return { nhap, loi: null, kq: tinhCoiNoi(so, saiSo), saiSo };
}

function DongChieu({ c }: { c: SoSanhChieu }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-base font-medium">{tenChieu(c.chieu)}</p>
        <p className="text-sm tabular-nums text-ink-2">
          Theo giấy {mm(c.giay)} mm, đo được {mm(c.doDuoc)} mm
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className={`text-lg font-bold tabular-nums ${c.trangThai === "dung" ? "" : "text-danger"}`}>
          {coDau(c.chenh, " mm")} <span className="text-sm font-medium">({coDau(c.phanTram, "%")})</span>
        </p>
        {c.trangThai === "dung" ? (
          <Badge tone="ok">Đúng</Badge>
        ) : c.trangThai === "lon-hon" ? (
          <Badge tone="danger">Cơi nới</Badge>
        ) : (
          <Badge tone="warn">Nhỏ hơn giấy</Badge>
        )}
      </div>
    </li>
  );
}

export default function CoiNoiThanhThung({ loaderData }: Route.ComponentProps) {
  const { nhap, loi, kq, saiSo } = loaderData;
  const busy = useNavigation().state !== "idle";

  return (
    <KhungTrang className="wrap max-w-3xl py-6 sm:py-10">
      <DauTrangCongCu tieuDe="Tính cơi nới thành thùng xe">
        Nhập kích thước lòng thùng theo mm: số ghi trong giấy chứng nhận kiểm định và số đo thực tế. Chiều nào
        không đo thì để trống.
      </DauTrangCongCu>

      <Form method="get" action="/cong-cu/coi-noi-thanh-thung" replace className="mt-5 grid gap-4">
        {CHIEU.map(({ ma, ten }) => (
          <fieldset key={ma} className="grid grid-cols-2 gap-3">
            <legend className="mb-1.5 text-base font-semibold">{ten} thùng xe</legend>
            <ONhapSo name={`${ma}_giay`} nhan="Theo giấy (mm)" giaTri={nhap[`${ma}_giay`]} />
            <ONhapSo name={`${ma}_do`} nhan="Đo được (mm)" giaTri={nhap[`${ma}_do`]} />
          </fieldset>
        ))}

        <ONhapSo
          name="sai_so"
          nhan="Sai số cho phép khi đo (mm)"
          giaTri={nhap.sai_so}
          goiY="Chênh lệch trong phạm vi này vẫn coi là đúng. Để trống là 0."
          className="sm:max-w-xs"
        />

        <div>
          <Button type="submit" size="lg" disabled={busy}>
            <Icon name="truck" className="size-5" />
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
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="ket-qua-tieu-de" className="text-xl font-bold">
              Kết quả
            </h2>
            {kq.coiNoi ? (
              <Badge tone="danger">Có cơi nới</Badge>
            ) : kq.khongDung ? (
              <Badge tone="danger">Không đúng giấy chứng nhận</Badge>
            ) : (
              <Badge tone="ok">Đúng giấy chứng nhận</Badge>
            )}
          </div>

          <Card className="mt-3 py-2">
            <ul className="divide-y divide-line">
              {kq.chieu.map((c) => (
                <DongChieu key={c.chieu} c={c} />
              ))}
            </ul>
          </Card>
          {saiSo > 0 ? (
            <p className="mt-2 text-sm text-ink-2">Sai số cho phép đã dùng: {mm(saiSo)} mm mỗi chiều.</p>
          ) : null}

          {kq.theTich ? (
            <Card className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-ink-2">Thể tích theo giấy</p>
                <p className="mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere]">
                  {mm(kq.theTich.giay)} m³
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-2">Thể tích đo được</p>
                <p className="mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere]">
                  {mm(kq.theTich.doDuoc)} m³
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-2">Chênh lệch thể tích</p>
                <p
                  className={`mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere] ${kq.theTich.chenh > 0 ? "text-danger" : ""}`}
                >
                  {coDau(kq.theTich.chenh, " m³")}{" "}
                  <span className="text-sm font-medium">({coDau(kq.theTich.phanTram, "%")})</span>
                </p>
              </div>
            </Card>
          ) : null}

          {kq.khung.length > 0 ? (
            <>
              <h2 className="mt-8 text-xl font-bold">Khung xử phạt</h2>
              <div className="mt-3 grid gap-4">
                {kq.khung.map((k) => (
                  <TheKhungPhat key={k.doiTuong} khung={k} />
                ))}
              </div>
              <LuuYDoiChieu />
            </>
          ) : (
            <p className="mt-4 text-base">
              Các chiều đã đo khớp với giấy chứng nhận kiểm định
              {saiSo > 0 ? " trong phạm vi sai số cho phép" : ""}.
            </p>
          )}
        </section>
      ) : null}
    </KhungTrang>
  );
}
