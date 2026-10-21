/**
 * Bảng xếp hạng (docs/PLAN.md GĐ9). Hàng nút "Phạm vi" gồm ba tab:
 *  - Trong đơn vị: họ tên người cùng đơn vị, xếp theo XP trong kỳ;
 *  - Các đơn vị: đơn vị ngang cấp, xếp theo XP trung bình mỗi người (không hiện tên người);
 *  - Mùa giải (docs/PLAN.md GĐ-G6): nhóm thi đấu của đơn vị, dùng BangMuaGiai.
 * Hai tab đầu có thêm hàng nút "Kỳ": tuần này hoặc tháng này (tính theo giờ Việt Nam).
 *
 * Chữ trên trang giữ ba thuật ngữ tách riêng:
 *  - Hạng: vị trí trong bảng, theo XP trong kỳ đang chọn. Đồng điểm thì đồng hạng (API tính).
 *  - Cấp: cấp độ cá nhân theo tổng XP tích lũy (NGUONG_CAP), không đặt lại khi sang kỳ mới.
 *  - Bậc: nhóm thi đấu ở tab Mùa giải.
 *
 * Hai tab đầu cùng một khung, từ trên xuống: thẻ vị trí của người xem, bục ba hạng đầu
 * (components/bang-xep-hang/BucBaHang.tsx), bảng từ dòng thứ tư, nhóm chưa có XP trong kỳ (không
 * đánh số hạng). Tab Trong đơn vị có thêm chú giải cách tính cấp. Hạng phân biệt bằng vị trí, cỡ chữ,
 * chữ "Hạng", và trên bục thêm màu và hoạt ảnh tăng dần theo hạng; cấp luôn là chip "Cấp N". Không
 * dùng huy chương, sao hay vạch giống cấp hiệu (docs/VISUAL_STYLE.md §1). Ngoài bục không có hoạt ảnh.
 */
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { BucBaHang } from "../components/bang-xep-hang/BucBaHang";
import { ChipCap, NhanCuaToi } from "../components/bang-xep-hang/NhanXepHang";
import { BangMuaGiai, type DuLieuMuaGiai } from "../components/tro-choi/BangMuaGiai";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import {
  bangCap,
  chiaBoCuc,
  type DongXepHang,
  diemXep,
  khoaDong,
  laCuaToi,
  laDongHang,
  viTriCuaToi,
} from "../lib/bang-xep-hang";
import { cn } from "../lib/cn";
import type { BangXepHang, TongQuanDiem } from "../lib/diem-thuong";
import { formatDate } from "../lib/format";
import { goiApiQuanTri } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/bang-xep-hang";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Bảng xếp hạng", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const p = new URL(request.url).searchParams;
  // Tab "Mùa giải" (docs/PLAN.md GĐ-G6): đọc /v1/mua-giai, không có lựa chọn tuần/tháng.
  if (p.get("pham_vi") === "mua_giai") {
    return {
      bang: null,
      tongQuan: null,
      muaGiai: await goiApiQuanTri<DuLieuMuaGiai>(token, "/v1/mua-giai"),
    };
  }
  const phamVi = p.get("pham_vi") === "cac_don_vi" ? "cac_don_vi" : "don_vi";
  const ky = p.get("ky") === "thang" ? "thang" : "tuan";
  // Thẻ "Vị trí của bạn" cần cấp và tiến độ lên cấp của người xem. Lỗi thì chỉ ẩn phần tiến độ.
  const [bang, tongQuan] = await Promise.all([
    goiApiQuanTri<BangXepHang>(token, `/v1/bang-xep-hang?pham_vi=${phamVi}&ky=${ky}`),
    phamVi === "don_vi" ? goiApiQuanTri<TongQuanDiem>(token, "/v1/toi/tong-quan").catch(() => null) : null,
  ]);
  return { bang, tongQuan, muaGiai: null };
}

const so = (n: number) => n.toLocaleString("vi-VN");
const KY_CHU = { tuan: "tuần này", thang: "tháng này" } as const;

function Chon({
  nhan,
  muc,
  dangChon,
}: {
  nhan: string;
  muc: Array<{ v: string; t: string; href: string }>;
  dangChon: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: nhóm liên kết điều hướng, không phải ô nhập nên không dùng <fieldset>
    <div role="group" aria-label={nhan}>
      {/* Nhãn đã có trong aria-label của nhóm: ẩn với trình đọc màn hình để không đọc hai lần. */}
      <p aria-hidden="true" className="mb-1.5 text-sm font-medium text-ink-2">
        {nhan}
      </p>
      <div className={cn("grid gap-2", muc.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {muc.map((m) => (
          <Link
            key={m.v}
            to={m.href}
            replace
            aria-current={m.v === dangChon ? "true" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-lg border px-2 text-center font-medium leading-tight",
              muc.length === 3 ? "text-sm" : "text-[15px]",
              m.v === dangChon
                ? "border-primary bg-primary text-on-primary"
                : "border-line-strong bg-surface text-ink-2 dong-bam",
            )}
          >
            {m.t}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thẻ vị trí của người xem                                            */
/* ------------------------------------------------------------------ */

/** Cấp hiện tại và vạch tiến độ lên cấp kế tiếp, theo tổng XP (/v1/toi/tong-quan). */
function PhanCap({ tongQuan }: { tongQuan: TongQuanDiem }) {
  const { cap, xp_tong } = tongQuan;
  const phanTram = Math.round(cap.tienDo * 100);
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <ChipCap cap={cap.cap} className="text-sm" />
        <span className="text-sm tabular-nums text-ink-2">
          Tổng XP: {so(xp_tong)}
          {cap.denXp !== null ? ` / ${so(cap.denXp)}` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={cap.denXp !== null ? `Tiến độ lên cấp ${cap.cap + 1}` : "Đã đạt cấp cao nhất"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={phanTram}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${phanTram}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-ink-2">
        {cap.denXp !== null
          ? `Còn ${so(Math.max(cap.denXp - xp_tong, 0))} XP để lên cấp ${cap.cap + 1}.`
          : "Đã đạt cấp cao nhất."}
      </p>
    </div>
  );
}

function TheViTri({ bang, tongQuan }: { bang: BangXepHang; tongQuan: TongQuanDiem | null }) {
  const caNhan = bang.pham_vi === "don_vi";
  const viTri = viTriCuaToi(bang);
  const kyChu = KY_CHU[bang.ky];
  return (
    <section
      aria-labelledby="vi-tri-cua-ban"
      className="mt-6 rounded-card border-2 border-primary bg-surface p-4 shadow-card"
    >
      <h2 id="vi-tri-cua-ban" className="text-sm font-semibold text-ink-2">
        {caNhan ? "Vị trí của bạn" : "Đơn vị của bạn"}
      </h2>
      {!caNhan && bang.don_vi ? (
        <p className="mt-0.5 line-clamp-2 break-words font-medium">{bang.don_vi.ten}</p>
      ) : null}
      {viTri ? (
        <>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="min-w-0">
              <span className="block text-2xl font-bold leading-tight tabular-nums sm:text-3xl">
                {viTri.dongHang ? "Đồng hạng" : "Hạng"} {viTri.hang}
              </span>
              <span className="block text-sm text-ink-2">
                trên {so(viTri.tren)} {caNhan ? "người" : "đơn vị"} có XP
              </span>
            </p>
            <p className="shrink-0 text-right">
              <span className="block text-2xl font-bold leading-tight tabular-nums">{so(viTri.diem)}</span>
              <span className="block text-xs text-ink-3">{caNhan ? `XP ${kyChu}` : `XP/người ${kyChu}`}</span>
            </p>
          </div>
          {viTri.lenHang ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm">
              <Icon name="arrowUp" className="size-4 shrink-0 text-primary" />
              <span>
                Còn <strong className="tabular-nums">{so(viTri.lenHang.con)}</strong> XP để lên hạng{" "}
                {viTri.lenHang.hang}.
              </span>
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px]">
            {caNhan ? "Bạn" : "Đơn vị của bạn"} chưa có XP trong {kyChu}.
          </p>
          <ButtonLink to="/luyen-tap" variant="secondary" className="mt-3">
            Luyện tập theo chủ đề
          </ButtonLink>
        </>
      )}
      {caNhan && tongQuan ? <PhanCap tongQuan={tongQuan} /> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng từ dòng thứ tư                                                 */
/* ------------------------------------------------------------------ */

function BangTiep({ bang, coDiem }: { bang: BangXepHang; coDiem: DongXepHang[] }) {
  const caNhan = bang.pham_vi === "don_vi";
  const kyChu = KY_CHU[bang.ky];
  if (coDiem.length <= 3) return null;
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
      {/* Điện thoại: cột Cấp (Số người) gộp xuống dưới tên để cột tên đủ rộng; từ 640px đủ 4 cột. Độ
          rộng cột khai ở ô tiêu đề, không dùng <col>: ô ẩn rời khỏi lưới bảng, <col> sẽ lệch cột. */}
      <table className="w-full border-collapse text-[15px] sm:table-fixed">
        <caption className="sr-only">
          {caNhan
            ? `Người từ hạng thứ tư trở đi, xếp theo XP ${kyChu}`
            : `Đơn vị từ hạng thứ tư trở đi, xếp theo XP trung bình mỗi người ${kyChu}`}
        </caption>
        <thead className="bg-surface-2 text-xs text-ink-2">
          <tr>
            <th scope="col" className="w-14 py-2 pl-1 pr-2.5 text-right font-semibold sm:w-24">
              Hạng
            </th>
            <th scope="col" className="px-2 py-2 text-left font-semibold">
              {caNhan ? "Họ tên" : "Đơn vị"}
            </th>
            <th
              scope="col"
              className={cn(
                "hidden px-2 py-2 font-semibold sm:table-cell sm:w-24",
                caNhan ? "text-left" : "text-right",
              )}
            >
              {caNhan ? "Cấp" : "Số người"}
            </th>
            <th scope="col" className="w-20 py-2 pl-1 pr-3 text-right font-semibold sm:w-32">
              {caNhan ? `XP ${kyChu}` : "XP/người"}
            </th>
          </tr>
        </thead>
        <tbody>
          {coDiem.slice(3).map((d, j) => {
            const i = j + 3;
            const laMinh = laCuaToi(bang, d);
            // Viền primary của dòng mình vẽ bằng viền ô (border-collapse): viền của <tr> không
            // hiện ổn định trên mọi trình duyệt.
            const vien = laMinh && "border-y-2 border-primary";
            return (
              <tr
                key={khoaDong(d)}
                aria-current={laMinh ? "true" : undefined}
                className={cn("border-t border-line", laMinh && "bg-primary-soft")}
              >
                <td
                  className={cn(
                    "py-2.5 pl-1 pr-2.5 text-right align-middle tabular-nums",
                    vien,
                    laMinh && "border-l-2",
                  )}
                >
                  <span className="block font-semibold">{d.hang}</span>
                  {laDongHang(coDiem, i) ? (
                    <span className="block text-xs leading-tight text-ink-3">Đồng hạng</span>
                  ) : null}
                </td>
                <th scope="row" className={cn("px-2 py-2.5 text-left align-middle font-medium", vien)}>
                  <span className="line-clamp-2 break-words">{d.ten}</span>
                  {laMinh ? <NhanCuaToi caNhan={caNhan} /> : null}
                  <span className="mt-1 flex text-sm font-normal text-ink-2 sm:hidden">
                    {caNhan ? d.cap ? <ChipCap cap={d.cap} /> : null : `${so(d.so_nguoi ?? 0)} người`}
                  </span>
                </th>
                <td
                  className={cn(
                    "hidden px-2 py-2.5 align-middle sm:table-cell",
                    !caNhan && "whitespace-nowrap text-right tabular-nums",
                    vien,
                  )}
                >
                  {caNhan ? d.cap ? <ChipCap cap={d.cap} /> : null : so(d.so_nguoi ?? 0)}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap py-2.5 pl-1 pr-3 text-right align-middle font-semibold tabular-nums",
                    vien,
                    laMinh && "border-r-2",
                  )}
                >
                  {so(diemXep(bang, d))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nhóm chưa có XP và chú giải cấp                                     */
/* ------------------------------------------------------------------ */

function TieuDeMo({ children }: { children: ReactNode }) {
  return (
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
      <Icon name="arrowRight" className="size-4 shrink-0 text-ink-3 group-open:rotate-90" />
      {children}
    </summary>
  );
}

function NhomChuaCoXp({ bang, ds }: { bang: BangXepHang; ds: DongXepHang[] }) {
  const caNhan = bang.pham_vi === "don_vi";
  if (!ds.length) return null;
  return (
    <details className="group mt-6 rounded-xl border border-line bg-surface">
      <TieuDeMo>
        Chưa có XP trong kỳ này ({so(ds.length)} {caNhan ? "người" : "đơn vị"})
      </TieuDeMo>
      <ul className="divide-y divide-line border-t border-line">
        {ds.map((d) => {
          const laMinh = laCuaToi(bang, d);
          return (
            <li
              key={khoaDong(d)}
              aria-current={laMinh ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 px-4 py-2",
                laMinh && "bg-primary-soft ring-2 ring-inset ring-primary",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words">{d.ten}</span>
                {laMinh ? <NhanCuaToi caNhan={caNhan} /> : null}
              </span>
              {caNhan ? (
                d.cap ? (
                  <ChipCap cap={d.cap} />
                ) : null
              ) : (
                <span className="shrink-0 text-sm tabular-nums text-ink-2">{so(d.so_nguoi ?? 0)} người</span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function ChuGiaiCap({ nguong, capCuaToi }: { nguong: number[]; capCuaToi: number | null }) {
  return (
    <details className="group mt-4 rounded-xl border border-line bg-surface">
      <TieuDeMo>Cách tính cấp</TieuDeMo>
      <div className="border-t border-line px-4 pb-4 pt-3">
        <p className="text-sm text-ink-2">
          Cấp tính theo tổng XP từ trước tới nay, không đặt lại khi sang tuần hoặc tháng mới. Bảng chỉ hiện
          cấp của từng người, không hiện tổng XP của họ.
        </p>
        <ol className="mt-3 grid gap-1">
          {bangCap(nguong).map((m) => {
            const cuaToi = m.cap === capCuaToi;
            return (
              <li
                key={m.cap}
                aria-current={cuaToi ? "true" : undefined}
                className={cn(
                  "flex min-h-10 items-center justify-between gap-3 rounded-lg px-2",
                  cuaToi && "bg-primary-soft ring-2 ring-inset ring-primary",
                )}
              >
                <span className="flex flex-wrap items-center gap-x-2">
                  <ChipCap cap={m.cap} />
                  {cuaToi ? <span className="text-sm font-semibold">cấp của bạn</span> : null}
                </span>
                <span className="whitespace-nowrap text-sm tabular-nums text-ink-2">
                  {m.denXp === null ? `từ ${so(m.tuXp)} XP` : `${so(m.tuXp)}–${so(m.denXp)} XP`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Trang                                                                */
/* ------------------------------------------------------------------ */

function DauTrang() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Bảng xếp hạng</h1>
      <p className="mt-1 text-[15px] text-ink-2">
        Hạng tính theo XP trong kỳ đang xem. Cấp tính theo tổng XP từ trước tới nay, không đặt lại khi sang kỳ
        mới.
      </p>
    </>
  );
}

export default function BangXepHangPage({ loaderData }: Route.ComponentProps) {
  const { bang, muaGiai, tongQuan } = loaderData;
  const [params] = useSearchParams();
  const href = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    return `/bang-xep-hang?${next}`;
  };
  const chonPhamVi = (dangChon: string) => (
    <Chon
      nhan="Phạm vi"
      dangChon={dangChon}
      muc={[
        { v: "don_vi", t: "Trong đơn vị", href: href("pham_vi", "don_vi") },
        { v: "cac_don_vi", t: "Các đơn vị", href: href("pham_vi", "cac_don_vi") },
        { v: "mua_giai", t: "Mùa giải", href: href("pham_vi", "mua_giai") },
      ]}
    />
  );

  if (muaGiai || !bang) {
    return (
      <div className="wrap max-w-xl py-8">
        <DauTrang />
        <div className="mt-5">{chonPhamVi("mua_giai")}</div>
        <p className="mt-4 text-sm text-ink-3">
          Đơn vị thi đấu theo tuần trong nhóm cùng bậc. Cuối tuần, đơn vị lên bậc, giữ bậc hoặc xuống bậc.
        </p>
        <div className="mt-5">{muaGiai ? <BangMuaGiai du={muaGiai} /> : null}</div>
      </div>
    );
  }
  const caNhan = bang.pham_vi === "don_vi";
  const kyChu = KY_CHU[bang.ky];
  const { coDiem, chuaCoDiem } = chiaBoCuc(bang);
  const capCuaToi = tongQuan?.cap.cap ?? bang.items.find((d) => d.la_toi)?.cap ?? null;

  return (
    <div className="wrap max-w-xl py-8">
      <DauTrang />

      <div className="mt-5 space-y-3">
        {chonPhamVi(bang.pham_vi)}
        <Chon
          nhan="Kỳ"
          dangChon={bang.ky}
          muc={[
            { v: "tuan", t: "Tuần này", href: href("ky", "tuan") },
            { v: "thang", t: "Tháng này", href: href("ky", "thang") },
          ]}
        />
      </div>

      <p className="mt-4 text-sm text-ink-3">
        XP tính từ ngày {formatDate(bang.tu_ngay)}
        {bang.don_vi ? ` · ${bang.don_vi.ten}` : ""}
      </p>
      {!caNhan && bang.items.length ? (
        <p className="mt-1 text-sm text-ink-3">
          Xếp theo XP trung bình mỗi người, để đơn vị đông người và ít người được so sánh công bằng.
        </p>
      ) : null}

      {bang.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="trophy" title={bang.ghi_chu ?? "Chưa có dữ liệu xếp hạng trong kỳ này"} />
        </div>
      ) : (
        <>
          <TheViTri bang={bang} tongQuan={tongQuan} />
          {coDiem.length ? (
            <>
              <BucBaHang bang={bang} coDiem={coDiem} />
              <BangTiep bang={bang} coDiem={coDiem} />
            </>
          ) : (
            <div className="mt-6">
              <EmptyState
                icon="trophy"
                title={
                  caNhan
                    ? `Chưa có ai trong đơn vị có XP trong ${kyChu}`
                    : `Chưa có đơn vị nào có XP trong ${kyChu}`
                }
              />
            </div>
          )}
          <NhomChuaCoXp bang={bang} ds={chuaCoDiem} />
          {caNhan && bang.nguong_cap?.length ? (
            <ChuGiaiCap nguong={bang.nguong_cap} capCuaToi={capCuaToi} />
          ) : null}
        </>
      )}
    </div>
  );
}
