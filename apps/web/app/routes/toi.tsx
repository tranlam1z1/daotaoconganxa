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
import { HoSoChuDe } from "../components/luyen-tap/HoSoChuDe";
import { NhacHoc } from "../components/thong-bao/NhacHoc";
import { AnhDaiDien } from "../components/ui/AnhDaiDien";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { Icon, type IconName } from "../components/ui/Icon";

import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import { hoSoChuDe } from "../lib/ho-so-chu-de";
import { cauSaiCuaToi, lichSuCuaToi, taoPhien } from "../lib/luyen-tap.server";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/toi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tôi", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauDangNhap(request);
  const [lichSu, cauSai, hoSo] = await Promise.all([
    lichSuCuaToi(token),
    cauSaiCuaToi(token),
    hoSoChuDe(token),
  ]);
  return { nguoiDung, lichSu: lichSu.items, soCauSai: cauSai.tong, hoSo };
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
    <div className="ho-so-so-lieu">
      <dt className="text-sm font-medium text-ink-2">
        {nhan}
        <span
          aria-hidden="true"
          className={cn("ho-so-so-lieu-icon grid size-11 shrink-0 place-items-center rounded-full", mauIcon)}
        >
          <Icon name={icon} className="size-4" />
        </span>
      </dt>
      <dd className="mt-1 text-[28px] font-bold leading-tight tabular-nums">{children}</dd>
      {phu ? <dd className="mt-0.5 text-sm text-ink-2">{phu}</dd> : null}
    </div>
  );
}

export default function Toi({ loaderData, actionData }: Route.ComponentProps) {
  const { nguoiDung, lichSu, soCauSai, hoSo } = loaderData;
  const busy = useNavigation().state !== "idle";
  const hoTen = nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email;
  const daXong = lichSu.filter((p) => p.finished_at && p.total);
  const tyLe = daXong.length
    ? Math.round(
        (daXong.reduce((s, p) => s + (p.correct ?? 0), 0) / daXong.reduce((s, p) => s + p.total, 0)) * 100,
      )
    : null;

  return (
    <div className="ho-so-trang wrap max-w-5xl py-6">
      <section className="ho-so-tong-quan">
        {/* A. Đầu trang. */}
        <div className="ho-so-banner flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to="/tai-khoan#anh-dai-dien"
              aria-label="Đổi ảnh đại diện"
              title="Đổi ảnh đại diện"
              className="shrink-0 rounded-full"
            >
              <AnhDaiDien nguoiDung={nguoiDung} className="size-16 text-2xl" />
            </Link>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold">{hoTen}</h1>
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
          </div>
        </div>

        {actionData?.loi ? (
          <Notice tone="danger" className="mt-4">
            {actionData.loi}
          </Notice>
        ) : null}

        {/* B. Hàng thẻ số liệu. */}
        <dl className="ho-so-thong-ke grid grid-cols-2 gap-4 lg:grid-cols-4">
          <TheSoLieu nhan="Câu sai cần luyện" icon="list" mauIcon="bg-danger-soft text-danger">
            {soCauSai.toLocaleString("vi-VN")}
          </TheSoLieu>
          <TheSoLieu nhan="Tỷ lệ đúng gần đây" icon="gauge" mauIcon="bg-ok-soft text-ok">
            {tyLe === null ? "–" : `${tyLe}%`}
          </TheSoLieu>
          <TheSoLieu nhan="Số phiên đã luyện" icon="calendar" mauIcon="bg-warn-soft text-warn">
            {daXong.length.toLocaleString("vi-VN")}
          </TheSoLieu>
          <TheSoLieu nhan="Chủ đề đã luyện" icon="layers">
            {hoSo.tong_luot.toLocaleString("vi-VN")}
          </TheSoLieu>
        </dl>
      </section>
      <div className="ho-so-noi-dung">
        {/* C. Cột chính. */}
        <div className="ho-so-cac-khoi">
          <HoSoChuDe hoSo={hoSo} />

          {/* Nhắc học bằng thông báo đẩy (docs/PLAN.md GĐ15). */}
          <NhacHoc laQuanTri={nguoiDung.vai_tro === "quan_tri"} />

          <section aria-labelledby="lich-su" className="ho-so-lich-su">
            <h2 id="lich-su" className="text-lg font-semibold">
              <Icon name="calendar" className="size-6 text-primary" /> Lịch sử luyện tập
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
      </div>
    </div>
  );
}
