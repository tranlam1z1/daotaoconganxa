/**
 * Danh sách đề thi (docs/PLAN.md GĐ6). Quản trị viên thấy mọi đề và tạo đề mới; cán bộ quản lý
 * chỉ thấy đề đang mở, kèm lối tắt sang giao bài.
 */
import { Link } from "react-router";

import { Badge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { goiApiQuanTri } from "../lib/quan-tri.server";
import { duVaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { type DeThi, TEN_TRANG_THAI_DE, TONE_TRANG_THAI_DE } from "../lib/thi";
import type { Route } from "./+types/quan-tri.de-thi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Đề thi", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const { items } = await goiApiQuanTri<{ items: DeThi[] }>(token, "/v1/quan-tri/de-thi");
  return { items, laQuanTri: nguoiDung.la_quan_tri, coTheCham: duVaiTro(nguoiDung, "bien_tap") };
}

export default function QuanTriDeThi({ loaderData }: Route.ComponentProps) {
  const { items, laQuanTri, coTheCham } = loaderData;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Đề thi</h2>
          <p className="mt-1 text-sm text-ink-2">
            {laQuanTri
              ? "Mỗi đề là một ma trận chủ đề × mức độ × dạng câu (trắc nghiệm, tự luận), 1 đến 60 câu. Mỗi lượt thi rút câu và đảo thứ tự riêng."
              : "Các đề đang mở. Chọn đề để giao cho đơn vị hoặc cán bộ."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {coTheCham ? (
            <ButtonLink to="/quan-tri/cham-tu-luan/de-thi" variant="secondary">
              Chấm tự luận
            </ButtonLink>
          ) : null}
          {laQuanTri ? (
            <>
              <ButtonLink to="/quan-tri/de-thi/tu-pdf">Tạo từ tệp PDF</ButtonLink>
              <ButtonLink to="/quan-tri/de-thi/moi" variant="secondary">
                Tạo đề thi
              </ButtonLink>
            </>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="cap" title={laQuanTri ? "Chưa có đề thi nào" : "Chưa có đề thi đang mở"} />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {items.map((d) => (
            <li key={d.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {laQuanTri ? (
                  <Link
                    to={`/quan-tri/de-thi/${d.id}`}
                    className="flex min-h-11 items-center font-semibold hover:text-primary hover:underline"
                  >
                    {d.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{d.title}</span>
                )}
                <span className="font-mono text-sm text-ink-3">{d.code}</span>
                <Badge tone={TONE_TRANG_THAI_DE[d.status]}>{TEN_TRANG_THAI_DE[d.status]}</Badge>
                {d.status === "xuat_ban" ? (
                  <Link
                    to={`/quan-tri/giao-bai?de=${d.id}`}
                    className="ml-auto flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                  >
                    Giao bài
                  </Link>
                ) : null}
              </div>
              <p className="text-sm text-ink-2">
                {d.question_count} câu · {d.duration_minutes} phút · đạt từ {d.pass_score} điểm ·{" "}
                {d.max_attempts} lần làm
                {laQuanTri ? ` · ${d.so_bai_giao ?? 0} lần giao · ${d.so_luot_nop ?? 0} lượt đã nộp` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
