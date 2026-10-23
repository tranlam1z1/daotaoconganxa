/**
 * Tra ngược: chọn hoặc tìm xã, phường hiện nay, ra các xã, phường (huyện đảo) cũ đã nhập vào, nhóm
 * theo huyện cũ. Biểu mẫu GET: `tinh` lọc theo tỉnh mới, `q` tìm theo tên, `xa` xem một xã mới.
 */
import { Form, Link, useNavigation } from "react-router";
import {
  BangDiaChi,
  DongDiaChi,
  GhiChuNguon,
  NutLichSuDiaGioi,
  OBieuTuong,
} from "../components/dia-gioi/ChungDiaGioi";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { cn } from "../lib/cn";
import {
  DUONG_DIA_GIOI,
  dsTinhMoi,
  dsXaMoi,
  type KetQuaTraNguoc,
  LoiDiaGioi,
  layNguon,
  timXaMoi,
  traNguoc,
} from "../lib/dia-gioi";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/cong-cu.dia-gioi.tra-nguoc";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tra ngược từ xã, phường mới", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const dsTinh = await dsTinhMoi();
  const tinh = dsTinh.some((t) => t.ma === p.get("tinh")) ? p.get("tinh")! : "";
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  const xa = /^\d{5}$/.test(p.get("xa") ?? "") ? p.get("xa")! : "";
  const chung = { dsTinh, form: { tinh, q }, kq: null, ds: null, nguon: null, loi: null };

  if (xa) {
    try {
      const [kq, nguon] = await Promise.all([traNguoc(xa), layNguon().catch(() => null)]);
      return { ...chung, kq, nguon };
    } catch (e) {
      if (e instanceof LoiDiaGioi && e.status === 404)
        return { ...chung, loi: "Không có xã, phường mã này." };
      throw e;
    }
  }
  if (q) {
    const ds = await timXaMoi(q, tinh || undefined);
    return { ...chung, ds, loi: ds.length ? null : `Không tìm thấy xã, phường mới tên “${q}”.` };
  }
  if (tinh) {
    const tenTinh = dsTinh.find((t) => t.ma === tinh)!;
    return { ...chung, ds: (await dsXaMoi(tinh)).map((x) => ({ xa: x, tinh: tenTinh })) };
  }
  return chung;
}

const oNhap =
  "min-h-12 w-full min-w-0 rounded-xl border border-line-strong bg-surface px-4 text-base text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none";

export default function TraNguoc({ loaderData }: Route.ComponentProps) {
  const { dsTinh, form, kq, ds, nguon, loi } = loaderData;
  const dangTai = useNavigation().state !== "idle";

  return (
    <KhungTrang className="wrap max-w-2xl py-6 sm:py-10">
      <p className="hidden md:block">
        <Link
          to={DUONG_DIA_GIOI}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline"
        >
          <Icon name="arrowLeft" className="size-4" />
          Chuyển đổi địa giới hành chính
        </Link>
      </p>
      <div className="flex items-center gap-4">
        <OBieuTuong icon="turn" className="size-16 sm:size-16" />
        <div className="min-w-0">
          <TieuDeTrang icon="map" className="">
            Tra ngược từ xã, phường mới
          </TieuDeTrang>
          <p className="mt-1 text-base text-ink-2">Các xã, phường cũ đã nhập vào một xã, phường hiện nay.</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <NutLichSuDiaGioi
          them={kq ? { nhan: `${kq.xaMoi.ten}, ${kq.tinhMoi.ten}`, phu: "Tra ngược" } : null}
          className="-mr-2"
        />
      </div>
      <Form method="get" action={`${DUONG_DIA_GIOI}/tra-nguoc`} replace className="grid gap-3" role="search">
        <div>
          <label htmlFor="tn-tinh" className="mb-1.5 block text-base font-medium">
            Tỉnh/thành phố
          </label>
          <select id="tn-tinh" name="tinh" defaultValue={form.tinh} className={oNhap}>
            <option value="">Tất cả tỉnh/thành phố</option>
            {dsTinh.map((t) => (
              <option key={t.ma} value={t.ma}>
                {t.ten}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tn-q" className="mb-1.5 block text-base font-medium">
            Tên phường/xã mới{" "}
            <span className="text-sm font-normal text-ink-2">(bỏ trống để xem cả tỉnh)</span>
          </label>
          <input
            id="tn-q"
            name="q"
            type="search"
            defaultValue={form.q}
            maxLength={100}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Ví dụ: Hạc Thành"
            className={oNhap}
          />
        </div>
        <button
          type="submit"
          disabled={dangTai}
          className="lun flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-semibold text-on-primary shadow-card hover:bg-primary-hover disabled:opacity-70"
        >
          <Icon name="search" kieu="net" className="size-5" />
          {dangTai ? "Đang tra…" : "Tra ngược"}
        </button>
      </Form>

      <div className={cn("mt-6", dangTai && "opacity-60")} aria-live="polite">
        {loi ? <Notice tone="danger">{loi}</Notice> : null}
        {ds?.length ? (
          <>
            <p className="mb-2 text-sm text-ink-2">{ds.length} phường/xã</p>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
              {ds.map(({ xa, tinh }) => (
                <li key={xa.ma}>
                  <Link
                    to={`?xa=${xa.ma}`}
                    className="lun [--lun:0.99] flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-2"
                  >
                    <Icon name="ghim" className="size-6 shrink-0" />
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="block text-base font-semibold">{xa.ten}</span>
                      <span className="block text-sm text-ink-2">{tinh.ten}</span>
                    </span>
                    <Icon name="chevronRight" kieu="net" className="size-5 shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {kq ? (
          <>
            <ChiTiet kq={kq} />
            <GhiChuNguon nguon={nguon} />
          </>
        ) : null}
      </div>
    </KhungTrang>
  );
}

function ChiTiet({ kq }: { kq: KetQuaTraNguoc }) {
  // Nhóm xã cũ theo huyện cũ, giữ thứ tự API trả (tỉnh, huyện, xã theo tên).
  const nhom = new Map<string, { tieuDe: string; xa: KetQuaTraNguoc["xaCu"] }>();
  for (const x of kq.xaCu) {
    const n = nhom.get(x.huyen.ma) ?? { tieuDe: `${x.huyen.ten}, ${x.tinh.ten}`, xa: [] };
    n.xa.push(x);
    nhom.set(x.huyen.ma, n);
  }
  const coMotPhan = kq.xaCu.some((x) => x.motPhan);

  return (
    <BangDiaChi tieuDe={`${kq.xaMoi.ten}, ${kq.tinhMoi.ten}`}>
      <DongDiaChi icon="toaNha" nhan="Tỉnh/thành phố">
        {kq.tinhMoi.ten}
      </DongDiaChi>
      <DongDiaChi icon="map" nhan={`Đơn vị cũ đã nhập vào (${kq.xaCu.length + kq.huyenCu.length})`}>
        <div className="mt-1 grid gap-3 text-base font-normal">
          {kq.huyenCu.map(({ huyen, tinh }) => (
            <p key={huyen.ma}>
              {huyen.ten}, {tinh.ten} <span className="text-ink-2">(toàn huyện)</span>
            </p>
          ))}
          {[...nhom.entries()].map(([ma, n]) => (
            <div key={ma}>
              <p className="text-sm font-semibold text-ink-2">{n.tieuDe}</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {n.xa.map((x) => (
                  <li key={x.xa.ma}>
                    {x.xa.ten}
                    {x.motPhan ? <span className="text-ink-2"> (một phần)</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DongDiaChi>
      {coMotPhan ? (
        <p className="py-3.5 text-base text-ink-2">
          “Một phần”: xã, phường cũ được chia cho nhiều đơn vị mới, chỉ một phần địa giới nhập vào{" "}
          {kq.xaMoi.ten}.
        </p>
      ) : null}
    </BangDiaChi>
  );
}
