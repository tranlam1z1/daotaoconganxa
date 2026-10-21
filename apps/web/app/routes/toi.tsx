/**
 * Trang "Tôi" của cán bộ (docs/PLAN.md GĐ4): tên, đơn vị, số câu sai và 20 phiên luyện tập gần
 * nhất. Cài đặt tài khoản (đổi mật khẩu, token MCP…) vẫn ở /tai-khoan.
 *
 * Trang cần tài khoản đã được xác minh cán bộ; tài khoản chưa xác minh được chuyển về /tai-khoan.
 *
 * Bố cục: đầu trang và hàng thẻ số liệu rộng hết khung; từ 1024px chia lưới 12 cột, cột chính 8
 * cột và cột phụ 4 cột (dính khi cuộn). Dưới 1024px một cột.
 */
import type { ReactNode } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";

import { NhacHoc } from "../components/thong-bao/NhacHoc";
import { HoSoChuDe } from "../components/tro-choi/HoSoChuDe";
import { HuyHieu } from "../components/tro-choi/HuyHieu";
import { AnhDaiDien } from "../components/ui/AnhDaiDien";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { Icon, type IconName } from "../components/ui/Icon";
import { cn } from "../lib/cn";
import type { BangXepHang, TongQuanDiem } from "../lib/diem-thuong";
import { formatDate } from "../lib/format";
import { hoSoChuDe } from "../lib/luot-choi.server";
import { cauSaiCuaToi, lichSuCuaToi, taoPhien } from "../lib/luyen-tap.server";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/toi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tôi", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauDangNhap(request);
  const [lichSu, cauSai, tongQuan, hoSo, xepHang] = await Promise.all([
    lichSuCuaToi(token),
    cauSaiCuaToi(token),
    goiApiQuanTri<TongQuanDiem>(token, "/v1/toi/tong-quan"),
    hoSoChuDe(token),
    // Thẻ bảng xếp hạng rút gọn ở cột phụ: cùng API với trang /bang-xep-hang. Lỗi thì ẩn thẻ,
    // trang Tôi không hỏng theo.
    goiApiQuanTri<BangXepHang>(token, "/v1/bang-xep-hang?pham_vi=don_vi&ky=tuan").catch(() => null),
  ]);
  return { nguoiDung, lichSu: lichSu.items, soCauSai: cauSai.tong, tongQuan, hoSo, xepHang };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    const { id } = await taoPhien(token, { nguon: "cau_sai" });
    return redirect(`/luyen-tap/${id}`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

/** Thẻ số liệu: nhãn ở trên, số lớn ở dưới, biểu tượng nhỏ góc phải. */
function TheSoLieu({
  nhan,
  icon,
  mauIcon = "bg-primary-soft text-primary",
  phu,
  children,
}: {
  nhan: string;
  icon: IconName;
  mauIcon?: string;
  phu?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-surface p-4 shadow-card md:p-5">
      <dt className="flex items-start justify-between gap-2 text-sm font-medium text-ink-2">
        {nhan}
        <span
          aria-hidden="true"
          className={cn("grid size-8 shrink-0 place-items-center rounded-full", mauIcon)}
        >
          <Icon name={icon} className="size-4" />
        </span>
      </dt>
      <dd className="mt-auto pt-2 text-[28px] font-bold leading-tight tabular-nums md:text-3xl">
        {children}
      </dd>
      {phu ? <dd className="mt-0.5 text-sm text-ink-2">{phu}</dd> : null}
    </div>
  );
}

function TheCap({ tongQuan }: { tongQuan: TongQuanDiem }) {
  const { cap, chuoi } = tongQuan;
  const phanTram = Math.round(cap.tienDo * 100);
  return (
    <Card aria-labelledby="diem-thuong" role="region">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="diem-thuong" className="text-xl font-bold">
          Cấp {cap.cap}
        </h2>
        <p className="text-sm font-semibold tabular-nums text-ink-2">
          {tongQuan.xp_tong.toLocaleString("vi-VN")}
          {cap.denXp !== null ? ` / ${cap.denXp.toLocaleString("vi-VN")}` : ""} XP
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={cap.denXp !== null ? `Tiến độ lên cấp ${cap.cap + 1}` : "Đã đạt cấp cao nhất"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={phanTram}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${phanTram}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-ink-2">
        {cap.denXp !== null
          ? `Còn ${Math.max(cap.denXp - tongQuan.xp_tong, 0).toLocaleString("vi-VN")} XP để lên Cấp ${cap.cap + 1}`
          : "Bạn đã đạt cấp cao nhất."}
      </p>

      {/* Lời nhắc hằng ngày. */}
      <div
        className={cn(
          "mt-4 flex flex-col gap-3 rounded-btn px-4 py-3 sm:flex-row sm:items-center",
          chuoi.da_hoc_hom_nay ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
        )}
      >
        <p className="flex flex-1 items-start gap-2 text-[15px] font-medium">
          <Icon name="flame" className={cn("mt-0.5 size-5 shrink-0", chuoi.da_hoc_hom_nay && "ic-lay")} />
          <span>
            {chuoi.da_hoc_hom_nay
              ? "Hôm nay bạn đã học."
              : `Hôm nay chưa học. Còn ${chuoi.con_dong_bang} lượt giữ chuỗi khi lỡ một ngày trong tuần này.`}
          </span>
        </p>
        {!chuoi.da_hoc_hom_nay ? (
          <ButtonLink to="/luyen-tap" className="w-full sm:w-auto">
            Học ngay
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}

function TheXepHang({ bang }: { bang: BangXepHang | null }) {
  const cuaToi = bang?.items.find((r) => r.la_toi);
  const hienThi = bang ? bang.items.slice(0, 3) : [];
  if (cuaToi && cuaToi.hang > 3) hienThi.push(cuaToi);
  return (
    <Card aria-labelledby="xep-hang" role="region">
      <h2 id="xep-hang" className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="trophy" className="size-5 text-primary" />
        Bảng xếp hạng
      </h2>
      <p className="mt-0.5 text-sm text-ink-2">Trong đơn vị · tuần này</p>
      {hienThi.length === 0 ? (
        <p className="mt-4 rounded-btn bg-surface-2 px-4 py-3 text-sm text-ink-2">
          {bang?.ghi_chu ?? "Chưa có dữ liệu xếp hạng trong tuần này."}
        </p>
      ) : (
        <ol className="mt-3 grid grid-cols-1 gap-1">
          {hienThi.map((r) => (
            <li
              key={`${r.hang}-${r.ten}`}
              aria-current={r.la_toi ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-btn px-2",
                r.la_toi && "bg-primary-soft",
                cuaToi && r === cuaToi && r.hang > 3 && "mt-2",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums",
                  r.hang <= 3 ? "bg-primary text-on-primary" : "bg-surface-2 text-ink-2",
                )}
              >
                {r.hang}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                {r.ten}
                {r.la_toi ? <span className="font-normal text-ink-2"> (bạn)</span> : null}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {r.xp?.toLocaleString("vi-VN")} <span className="font-normal text-ink-2">XP</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <ButtonLink to="/bang-xep-hang" variant="secondary" className="mt-4 w-full">
        Xem bảng xếp hạng
      </ButtonLink>
    </Card>
  );
}

/** Mục tiêu hôm nay: thử thách trong ngày (bắt đầu ở trang chủ, nơi có sẵn nút làm thử thách). */
function TheMucTieu({ thuThach }: { thuThach: TongQuanDiem["thu_thach"] }) {
  if (thuThach.so_cau === 0) return null;
  return (
    <Card aria-labelledby="muc-tieu" role="region">
      <h2 id="muc-tieu" className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="star" className="size-5 text-primary" />
        Mục tiêu hôm nay
      </h2>
      {thuThach.da_xong ? (
        <>
          <p className="mt-2 text-[15px] text-ink-2">
            Đã hoàn thành thử thách: đúng <span className="font-semibold text-ink">{thuThach.dung}</span>/
            {thuThach.so_cau} câu.
          </p>
          {thuThach.phien_id ? (
            <Link
              to={`/luyen-tap/${thuThach.phien_id}/ket-qua`}
              className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              Xem lại bài làm
            </Link>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-ink-2">
            Thử thách {thuThach.so_cau} câu, làm trong khoảng 2 phút.
          </p>
          <ButtonLink
            to={thuThach.phien_id ? `/luyen-tap/${thuThach.phien_id}` : "/"}
            variant="secondary"
            className="mt-4 w-full"
          >
            {thuThach.phien_id ? "Làm tiếp thử thách" : "Làm thử thách"}
          </ButtonLink>
        </>
      )}
    </Card>
  );
}

export default function Toi({ loaderData, actionData }: Route.ComponentProps) {
  const { nguoiDung, lichSu, soCauSai, tongQuan, hoSo, xepHang } = loaderData;
  const { chuoi } = tongQuan;
  const busy = useNavigation().state !== "idle";
  const hoTen = nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email;
  const daXong = lichSu.filter((p) => p.finished_at && p.total);
  const tyLe = daXong.length
    ? Math.round(
        (daXong.reduce((s, p) => s + (p.correct ?? 0), 0) / daXong.reduce((s, p) => s + p.total, 0)) * 100,
      )
    : null;
  const soHuyHieuDat = tongQuan.huy_hieu.filter((h) => h.dat_luc).length;

  return (
    <div className="wrap py-6 md:py-10">
      {/* A. Đầu trang. */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to="/tai-khoan#anh-dai-dien"
            aria-label="Đổi ảnh đại diện"
            title="Đổi ảnh đại diện"
            className="shrink-0 rounded-full"
          >
            <AnhDaiDien nguoiDung={nguoiDung} className="size-14 text-2xl" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold md:text-3xl">{hoTen}</h1>
            <p className="mt-1 text-[15px] text-ink-2">
              {nguoiDung.don_vi ? nguoiDung.don_vi.ten : "Chưa gắn đơn vị"} · {nguoiDung.mo_ta_vai_tro}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
          {soCauSai > 0 ? (
            <Form method="post" className="sm:flex">
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                Luyện câu sai ({soCauSai})
              </Button>
            </Form>
          ) : null}
          <ButtonLink to="/luyen-tap" variant={soCauSai > 0 ? "secondary" : "primary"} size="lg">
            Luyện tập theo chủ đề
          </ButtonLink>
        </div>
      </div>

      {actionData?.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}

      {/* B. Hàng thẻ số liệu. */}
      <dl className="mt-6 grid grid-cols-2 gap-4 md:mt-8 lg:grid-cols-4 lg:gap-6">
        <TheSoLieu nhan="Câu sai cần luyện" icon="list" mauIcon="bg-danger-soft text-danger">
          {soCauSai.toLocaleString("vi-VN")}
        </TheSoLieu>
        <TheSoLieu nhan="Tỷ lệ đúng gần đây" icon="gauge" mauIcon="bg-ok-soft text-ok">
          {tyLe === null ? "–" : `${tyLe}%`}
        </TheSoLieu>
        <TheSoLieu
          nhan="Chuỗi ngày"
          icon="flame"
          mauIcon="bg-warn-soft text-warn"
          phu={`Dài nhất: ${chuoi.tot_nhat.toLocaleString("vi-VN")} ngày`}
        >
          {chuoi.hien_tai.toLocaleString("vi-VN")}
        </TheSoLieu>
        <TheSoLieu nhan="XP tuần này" icon="star">
          {tongQuan.xp_tuan.toLocaleString("vi-VN")}
        </TheSoLieu>
      </dl>

      {/* Dưới 1024px hai cột chung một track. Phải là grid-cols-1 (minmax(0, 1fr)): track mặc định
          `auto` bị tên dài không xuống dòng ở bảng xếp hạng kéo rộng, cả cột chính tràn màn hình. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* C. Cột chính. */}
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-8">
          <TheCap tongQuan={tongQuan} />

          {/* Hồ sơ chủ đề (docs/PLAN.md GĐ-G0). */}
          <HoSoChuDe hoSo={hoSo} />

          <section aria-labelledby="huy-hieu">
            <h2 id="huy-hieu" className="text-lg font-semibold">
              Huy hiệu ({soHuyHieuDat}/{tongQuan.huy_hieu.length})
            </h2>
            <div className="mt-3">
              <HuyHieu ds={tongQuan.huy_hieu} />
            </div>
          </section>

          {/* Nhắc học bằng thông báo đẩy (docs/PLAN.md GĐ15). */}
          <NhacHoc laQuanTri={nguoiDung.vai_tro === "quan_tri"} />

          <section aria-labelledby="lich-su">
            <h2 id="lich-su" className="text-lg font-semibold">
              Lịch sử luyện tập
            </h2>
            {lichSu.length === 0 ? (
              <div className="mt-3">
                <EmptyState icon="calendar" title="Chưa có phiên luyện tập nào">
                  Bắt đầu một phiên luyện tập theo chủ đề, kết quả sẽ hiện ở đây.
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
                {lichSu.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={p.finished_at ? `/luyen-tap/${p.id}/ket-qua` : `/luyen-tap/${p.id}`}
                      className="lun [--lun:0.985] flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base font-medium">
                          {p.source === "cau_sai" ? "Luyện lại câu sai" : (p.topic_name ?? "Luyện tập")}
                        </span>
                        <span className="block text-sm text-ink-2">
                          {formatDate(String(p.started_at).slice(0, 10))}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        {p.finished_at ? (
                          <span className="font-semibold tabular-nums">
                            {p.correct}/{p.total}
                          </span>
                        ) : (
                          <span className="font-semibold text-primary">
                            Làm tiếp ({p.da_tra_loi}/{p.total})
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* D. Cột phụ, dính khi cuộn trên máy tính. */}
        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20 lg:col-span-4 lg:self-start">
          {xepHang ? <TheXepHang bang={xepHang} /> : null}
          <TheMucTieu thuThach={tongQuan.thu_thach} />
          <Link
            to="/tai-khoan"
            className="lun flex min-h-11 items-center justify-center gap-2 rounded-btn text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="user" className="size-4" />
            Tài khoản và mật khẩu
          </Link>
        </aside>
      </div>
    </div>
  );
}
