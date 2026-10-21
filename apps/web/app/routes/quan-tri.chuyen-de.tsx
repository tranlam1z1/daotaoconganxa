/**
 * Danh sách chuyên đề bài giảng, mọi trạng thái (ke-hoach/09-c). Biên tập viên tạo chuyên đề từ
 * một tệp PDF văn bản (AI soạn sẵn bài), hoặc tạo thủ công rồi vào từng chuyên đề để thêm bài và
 * soạn khối nội dung.
 */
import { Link } from "react-router";

import { Badge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { goiApiQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { type ChuyenDeQuanTri, TEN_CAP_DO, TEN_TRANG_THAI, TONE_TRANG_THAI } from "../lib/soan-bai-giang";
import type { Route } from "./+types/quan-tri.chuyen-de";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Chuyên đề", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "bien_tap");
  const { items } = await goiApiQuanTri<{ items: ChuyenDeQuanTri[] }>(
    token,
    "/v1/quan-tri/dao-tao/chuyen-de",
  );
  return { items };
}

export default function QuanTriChuyenDe({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Chuyên đề</h2>
          <p className="mt-1 text-sm text-ink-2">
            Học viên chỉ thấy chuyên đề đã xuất bản, có lĩnh vực và có ít nhất một bài đã xuất bản.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/quan-tri/chuyen-de/tu-pdf">Tạo từ tệp PDF</ButtonLink>
          <ButtonLink to="/quan-tri/chuyen-de/moi" variant="secondary">
            Tạo thủ công
          </ButtonLink>
          <ButtonLink to="/quan-tri/cham-tu-luan" variant="secondary">
            Chấm tự luận
          </ButtonLink>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="cap" title="Chưa có chuyên đề nào" />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {items.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to={`/quan-tri/chuyen-de/${c.slug}`}
                  className="flex min-h-11 items-center font-semibold hover:text-primary hover:underline"
                >
                  {c.title}
                </Link>
                <Badge tone={TONE_TRANG_THAI[c.status] ?? "muted"}>
                  {TEN_TRANG_THAI[c.status] ?? c.status}
                </Badge>
              </div>
              <p className="text-sm text-ink-2">
                {c.linhVuc ? c.linhVuc.name : "Chưa gắn lĩnh vực"} · {c.lessonCount} bài ·{" "}
                {TEN_CAP_DO[c.level] ?? c.level}
                {c.asOf ? ` · dữ liệu tính đến ${c.asOf.split("-").reverse().join("/")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
