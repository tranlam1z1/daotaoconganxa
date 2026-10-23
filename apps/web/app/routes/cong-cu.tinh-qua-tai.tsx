/**
 * Tính % quá tải: chọn xe tải, đầu kéo hoặc sơ mi rơ moóc, nhập các khối lượng (kg), ra khối lượng
 * quá tải và % quá tải (lib/tinh-qua-tai.ts). Khai riêng trong routes.ts nên thắng route chung
 * cong-cu/:ma.
 */
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { DauTrangCongCu } from "../components/cong-cu/BieuMau";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { pageMeta } from "../lib/site";
import {
  type CongThuc,
  congThucChu,
  docSoKg,
  LOAI_XE,
  type LoaiXe,
  laLoaiXe,
  type MaO,
  type ONhap,
  tenO,
  tinhQuaTai,
} from "../lib/tinh-qua-tai";
import type { Route } from "./+types/cong-cu.tinh-qua-tai";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tính % quá tải", {
    description: "Tính khối lượng và phần trăm quá tải của xe tải, đầu kéo, sơ mi rơ moóc.",
  });
}

const DS_LOAI = Object.keys(LOAI_XE) as LoaiXe[];

const lopO =
  "min-h-12 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-4 text-lg tabular-nums focus:border-primary focus:outline-none";
const lopLuaChon =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 text-base has-[:checked]:border-primary has-[:checked]:bg-primary-soft";

const kg = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const phanTram = (n: number) =>
  n.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function loader({ request }: Route.LoaderArgs) {
  const sp = new URL(request.url).searchParams;
  const l = sp.get("loai");
  const loai: LoaiXe = laLoaiXe(l) ? l : "xe-tai";
  const nhap: Partial<Record<MaO, string>> = {};
  for (const o of LOAI_XE[loai].o) nhap[o.ma] = sp.get(o.ma) ?? "";
  if (!sp.has("can")) return { loai, nhap, loi: null, kq: null };

  const so: Partial<Record<MaO, number>> = {};
  for (const o of LOAI_XE[loai].o) {
    const v = docSoKg(nhap[o.ma] ?? "");
    if (v === null || v <= 0)
      return { loai, nhap, loi: `Hãy nhập ${o.ten.toLowerCase()} (số kg lớn hơn 0).`, kq: null };
    so[o.ma] = v;
  }
  return { loai, nhap, loi: null, kq: tinhQuaTai(loai, so) };
}

function ONhapKg({ o, giaTri }: { o: ONhap; giaTri: string }) {
  const [mo, datMo] = useState(false);
  const id = `o-${o.ma}`;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1">
        <label htmlFor={id} className="text-base font-medium">
          {o.ten} (kg)
        </label>
        {o.giaiThich ? (
          <button
            type="button"
            aria-label={`Giải thích: ${o.ten}`}
            aria-expanded={mo}
            aria-controls={`${id}-giai-thich`}
            onClick={() => datMo((v) => !v)}
            className="-my-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary-soft"
          >
            <Icon name="info" className="size-5" />
          </button>
        ) : null}
      </div>
      {o.giaiThich && mo ? (
        <p id={`${id}-giai-thich`} className="mb-2 rounded-lg bg-primary-soft px-3 py-2 text-sm">
          {o.giaiThich}
        </p>
      ) : null}
      <input
        id={id}
        name={o.ma}
        type="text"
        inputMode="decimal"
        required
        defaultValue={giaTri}
        className={lopO}
      />
    </div>
  );
}

/** Một dòng của phân số: cột dấu (rộng cố định) và ô tên đại lượng. */
function DaiLuong({ ma, dau }: { ma: MaO; dau?: string }) {
  return (
    <>
      <span className="text-center text-xl font-semibold leading-none">{dau}</span>
      <span className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-center text-sm leading-snug">
        {tenO(ma)}
      </span>
    </>
  );
}

/**
 * Công thức viết thành phân số dọc. Tử số đặt như phép trừ dọc: mỗi đại lượng một dòng, dấu trừ ở
 * cột bên trái, nên không bị xuống dòng lộn xộn khi màn hình hẹp.
 */
function PhanSo({ ct }: { ct: CongThuc }) {
  return (
    <div className="rounded-xl bg-surface-2 p-4">
      <p className="text-sm font-medium text-ink-2">Công thức</p>
      <p className="sr-only">{congThucChu(ct)}</p>
      <div aria-hidden="true" className="mt-3 grid gap-3 sm:flex sm:items-center">
        <span className="shrink-0 text-base font-semibold">% quá tải =</span>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-1.5 gap-y-2">
            {ct.tuSo.map((ma, i) => (
              <DaiLuong key={ma} ma={ma} dau={i > 0 ? "−" : undefined} />
            ))}
            <div className="col-span-2 my-1 h-0.5 rounded-full bg-ink" />
            <DaiLuong ma={ct.mauSo} />
          </div>
          <span className="shrink-0 text-base font-semibold">× 100%</span>
        </div>
      </div>
    </div>
  );
}

export default function TinhQuaTai({ loaderData }: Route.ComponentProps) {
  const { loai: loaiDaTinh, nhap, loi, kq } = loaderData;
  const busy = useNavigation().state !== "idle";
  const [loai, datLoai] = useState<LoaiXe>(loaiDaTinh);
  // Đổi loại xe thì ẩn kết quả và lỗi của lần tính trước; lần tính mới (loaderData mới) hiện lại.
  const [anKetQua, datAnKetQua] = useState(false);
  const [duLieuTruoc, datDuLieuTruoc] = useState(loaderData);
  if (duLieuTruoc !== loaderData) {
    datDuLieuTruoc(loaderData);
    datAnKetQua(false);
  }
  const xe = LOAI_XE[loai];

  return (
    <KhungTrang className="wrap max-w-3xl py-6 sm:py-10">
      <DauTrangCongCu tieuDe="Tính % quá tải">
        Nhập các khối lượng theo kg, lấy từ phiếu cân và giấy chứng nhận kiểm định của xe.
      </DauTrangCongCu>

      <Form method="get" action="/cong-cu/tinh-qua-tai" replace className="mt-5 grid gap-4">
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-1.5 text-base font-medium">Loại xe</legend>
          {DS_LOAI.map((m) => (
            <label key={m} className={lopLuaChon}>
              <input
                type="radio"
                name="loai"
                value={m}
                checked={loai === m}
                onChange={() => {
                  datLoai(m);
                  datAnKetQua(true);
                }}
                className="size-5"
              />
              {LOAI_XE[m].ten}
            </label>
          ))}
        </fieldset>

        <PhanSo ct={xe.congThuc} />

        <div className="grid gap-4 sm:grid-cols-2">
          {xe.o.map((o) => (
            <ONhapKg key={o.ma} o={o} giaTri={nhap[o.ma] ?? ""} />
          ))}
        </div>

        <div>
          <Button type="submit" size="lg" disabled={busy}>
            <Icon name="scale" className="size-5" />
            Tra cứu kết quả
          </Button>
        </div>
      </Form>

      {loi && !anKetQua ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}

      {kq && !anKetQua ? (
        <section aria-labelledby="ket-qua-tieu-de" className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="ket-qua-tieu-de" className="text-xl font-bold">
              Kết quả: {LOAI_XE[loaiDaTinh].ten.toLowerCase()}
            </h2>
            {kq.quaTai ? <Badge tone="danger">Quá tải</Badge> : <Badge tone="ok">Không quá tải</Badge>}
          </div>
          {kq.quaTai ? (
            <Card className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-ink-2">Phần trăm quá tải</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-danger [overflow-wrap:anywhere]">
                  {phanTram(kq.phanTram)}%
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-2">Khối lượng quá tải</p>
                <p className="mt-1 text-2xl font-bold tabular-nums [overflow-wrap:anywhere]">
                  {kg(kq.khoiLuongQuaTai)} kg
                </p>
              </div>
            </Card>
          ) : (
            <Card className="mt-3">
              <p className="text-base">
                Xe chưa vượt khối lượng cho phép
                {kq.khoiLuongQuaTai < 0 ? (
                  <>
                    , còn dưới mức cho phép{" "}
                    <strong className="tabular-nums">{kg(-kq.khoiLuongQuaTai)} kg</strong>
                  </>
                ) : null}
                .
              </p>
            </Card>
          )}
        </section>
      ) : null}
    </KhungTrang>
  );
}
