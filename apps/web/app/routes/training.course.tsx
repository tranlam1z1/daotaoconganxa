/**
 * Một chuyên đề trong danh mục bài giảng `/hoc/:course` (docs/PLAN.md GĐ11): lưới thẻ bài theo
 * thứ tự, phần trăm đã học của từng bài, và một nút to "Học tiếp" dẫn tới bài chưa xong đầu tiên.
 */
import { Link } from "react-router";

import { TheBaiHoc } from "../components/bai-giang/TheBaiHoc";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { iconChoBai } from "../lib/bai-giang";
import { chuyenDeHoc } from "../lib/bai-giang.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/training.course";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.chuyenDe.title ?? "Chuyên đề", { description: data?.chuyenDe.summary ?? undefined });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await yeuCauDangNhap(request);
  const d = await chuyenDeHoc(request, params.course);
  return { chuyenDe: d.chuyenDe, loTrinh: d.loTrinh };
}

export default function TrainingCourse({ loaderData }: Route.ComponentProps) {
  const { chuyenDe, loTrinh } = loaderData;
  const tiepTheo = loTrinh.find((b) => b.trangThai !== "xong") ?? loTrinh[0];
  const soXong = loTrinh.filter((b) => b.trangThai === "xong").length;

  return (
    <div className="wrap max-w-3xl py-8 lg:max-w-7xl">
      <p className="hidden text-sm md:block">
        <Link to="/hoc" className="inline-flex min-h-11 items-center text-primary hover:underline">
          Bài giảng
        </Link>
        {chuyenDe.linhVuc ? <span className="text-ink-3"> · {chuyenDe.linhVuc.name}</span> : null}
      </p>
      <h1 className="mt-2 text-3xl font-semibold lg:text-4xl">{chuyenDe.title}</h1>
      {chuyenDe.summary ? (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2 lg:max-w-3xl">{chuyenDe.summary}</p>
      ) : null}
      <p className="mt-2 text-sm text-ink-2">
        {loTrinh.length} bài · khoảng {chuyenDe.durationMinutes} phút
        {soXong ? ` · đã xong ${soXong}/${loTrinh.length}` : ""}
      </p>

      {tiepTheo ? (
        <ButtonLink
          to={`/hoc/${chuyenDe.slug}/${tiepTheo.slug}`}
          className="mt-5 min-h-12 w-full text-base lg:w-auto lg:px-8"
        >
          {soXong === 0 ? "Bắt đầu học" : soXong === loTrinh.length ? "Học lại từ đầu" : "Học tiếp"}
        </ButtonLink>
      ) : null}

      {loTrinh.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="cap" title="Chuyên đề chưa có bài nào mở được" />
        </div>
      ) : (
        <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loTrinh.map((b) => (
            <li key={b.id}>
              <TheBaiHoc
                to={`/hoc/${chuyenDe.slug}/${b.slug}`}
                icon={iconChoBai(b.slug, b.title)}
                tieuDe={`Bài ${b.soBai}. ${b.title}`}
                moTa={b.summary}
                dongPhu={`khoảng ${b.estimatedMinutes} phút`}
                phanTram={b.phanTram}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
