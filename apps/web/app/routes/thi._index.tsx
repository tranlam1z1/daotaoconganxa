/**
 * Bài thi được giao (docs/PLAN.md GĐ6): thẻ chia hai nhóm "Cần làm" và "Đã làm, quá hạn".
 * Mỗi thẻ có hạn và một hành động chính: bắt đầu, làm tiếp, hoặc xem kết quả.
 */
import { Form, Link, redirect, useNavigation } from "react-router";

import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { KhungNoiDung } from "../components/ui/KhungNoiDung";
import { formatNgayGio } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { type BaiThi, diemSo, TEN_TRANG_THAI_BAI, TONE_TRANG_THAI_BAI } from "../lib/thi";
import type { Route } from "./+types/thi._index";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Thi", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const { items } = await goiApiQuanTri<{ items: BaiThi[] }>(token, "/v1/thi");
  return { items };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const giaoBai = String(f.get("giao_bai") ?? "");
  try {
    const kq = await goiApiQuanTri<{ luot_id: string }>(token, `/v1/thi/${giaoBai}/bat-dau`, {
      method: "POST",
    });
    throw redirect(`/thi/luot/${kq.luot_id}`);
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

function TheBaiThi({ b, busy }: { b: BaiThi; busy: boolean }) {
  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-display text-lg font-semibold leading-snug">
          {b.exam_title}
        </h3>
        <Badge tone={TONE_TRANG_THAI_BAI[b.trang_thai]}>
          {/* Đề cho làm nhiều lần: đã nộp một lượt mà còn lượt thì không ghi "Chưa làm". */}
          {b.trang_thai === "chua_lam" && b.so_luot_nop > 0
            ? `Đã làm ${b.so_luot_nop}/${b.max_attempts} lần`
            : TEN_TRANG_THAI_BAI[b.trang_thai]}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        {b.question_count} câu · {b.duration_minutes} phút · đạt từ {b.pass_score} điểm
      </p>
      <p className="mt-1 text-sm text-ink-2">
        {b.trang_thai === "chua_mo" ? `Mở lúc ${formatNgayGio(b.opens_at)}. ` : ""}
        Hạn làm bài: <span className="font-semibold text-ink">{formatNgayGio(b.due_at)}</span>
      </p>
      {b.so_luot_nop > 0 ? (
        <p className="mt-1 text-sm text-ink-2">
          Điểm cao nhất: <span className="font-semibold text-ink">{diemSo(b.diem_cao_nhat ?? 0)}</span>/100 ·{" "}
          {b.da_dat ? "Đạt" : "Chưa đạt"}
          {b.max_attempts > 1 ? ` · còn ${b.con_luot} lần làm` : ""}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {b.trang_thai === "dang_lam" && b.luot_dang_lam ? (
          <ButtonLink to={`/thi/luot/${b.luot_dang_lam}`} className="min-h-12 flex-1 text-base sm:flex-none">
            Làm tiếp
          </ButtonLink>
        ) : null}
        {b.duoc_bat_dau ? (
          <Form method="post" className="flex-1 sm:flex-none">
            <input type="hidden" name="giao_bai" value={b.assignment_id} />
            <Button type="submit" disabled={busy} className="min-h-12 w-full text-base">
              {b.so_luot_nop > 0 ? "Làm lại" : "Bắt đầu làm bài"}
            </Button>
          </Form>
        ) : null}
        {b.luot_gan_nhat ? (
          <ButtonLink to={`/thi/luot/${b.luot_gan_nhat}/ket-qua`} variant="secondary" className="min-h-12">
            Xem kết quả
          </ButtonLink>
        ) : null}
      </div>
      {b.duoc_bat_dau ? (
        <p className="mt-3 text-sm text-ink-3">
          Đồng hồ chạy ngay khi bắt đầu và không dừng khi đóng trang. Hết giờ, bài được tự động nộp.
        </p>
      ) : null}
    </li>
  );
}

export default function ThiIndex({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const canLam = loaderData.items.filter((b) => ["chua_mo", "chua_lam", "dang_lam"].includes(b.trang_thai));
  const daXong = loaderData.items.filter((b) => !canLam.includes(b));

  return (
    <KhungNoiDung
      title="Thi"
      icon="file"
      description="Theo dõi bài thi được giao, thời hạn làm bài và kết quả của bạn."
    >
      {actionData?.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}

      {loaderData.items.length === 0 ? (
        <div className="mt-6 border-t border-line pt-5">
          <EmptyState className="bg-surface-2" icon="cap" title="Chưa có bài thi được giao">
            <p>Bài thi do đơn vị giao sẽ hiện ở đây, kèm hạn làm bài.</p>
          </EmptyState>
          <p className="mt-4 text-sm text-ink-2">
            Trong lúc chờ, bạn có thể{" "}
            <Link to="/tra-cuu" className="text-primary underline">
              tra cứu quy định
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="can-lam" className="mt-6">
            <h2
              id="can-lam"
              className="border-b-2 border-ink pb-2 font-sans text-base font-bold uppercase tracking-[0.04em]"
            >
              Cần làm ({canLam.length})
            </h2>
            {canLam.length ? (
              <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                {canLam.map((b) => (
                  <TheBaiThi key={b.assignment_id} b={b} busy={busy} />
                ))}
              </ul>
            ) : (
              <EmptyState gon icon="steps" title="Không còn bài nào cần làm" className="mt-3" />
            )}
          </section>
          {daXong.length ? (
            <section aria-labelledby="da-lam" className="mt-8">
              <h2
                id="da-lam"
                className="border-b-2 border-ink pb-2 font-sans text-base font-bold uppercase tracking-[0.04em]"
              >
                Đã làm, đã quá hạn ({daXong.length})
              </h2>
              <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                {daXong.map((b) => (
                  <TheBaiThi key={b.assignment_id} b={b} busy={busy} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </KhungNoiDung>
  );
}
