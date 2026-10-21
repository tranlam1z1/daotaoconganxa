/**
 * Danh mục bài giảng `/hoc` (docs/PLAN.md GĐ11): lĩnh vực → chuyên đề. Bỏ lớp nhóm đối tượng
 * và cấp độ của danh mục cũ; chỉ hiện chuyên đề đã mở được. Mỗi chuyên đề là một thẻ trong lưới,
 * cùng kiểu với thẻ bài ở `/hoc/:course`.
 */
import { Link } from "react-router";

import { TheBaiHoc } from "../components/bai-giang/TheBaiHoc";
import { EmptyState } from "../components/ui/EmptyState";
import { iconChoChuyenDe } from "../lib/bai-giang";
import { danhMucHoc } from "../lib/bai-giang.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/training";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Bài giảng", {
    description:
      "Bài giảng pháp luật giao thông ngắn gọn, đọc cuộn hoặc xem từng trang, có kiểm tra cuối bài.",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  await yeuCauDangNhap(request);
  return { linhVuc: await danhMucHoc(request) };
}

export default function Training({ loaderData }: Route.ComponentProps) {
  const { linhVuc } = loaderData;
  return (
    <div className="wrap max-w-3xl py-8 lg:max-w-7xl">
      <p className="hidden text-sm md:block">
        <Link to="/luyen-tap" className="inline-flex min-h-11 items-center text-primary hover:underline">
          Học & luyện tập
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold lg:text-4xl">Bài giảng</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2 lg:max-w-3xl">
        Chọn một chuyên đề để học. Mỗi bài đọc được theo hai cách: cuộn từ trên xuống, hoặc xem từng trang như
        trình chiếu. Cuối bài có câu kiểm tra nhanh.
      </p>

      {linhVuc.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="cap" title="Chưa có bài giảng nào">
            <p>Bài giảng hiện ở đây sau khi được biên soạn và xuất bản.</p>
          </EmptyState>
        </div>
      ) : (
        linhVuc.map((lv) => (
          <section key={lv.slug} className="mt-8" aria-labelledby={`lv-${lv.slug}`}>
            <h2 id={`lv-${lv.slug}`} className="text-xl font-semibold">
              {lv.name}
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lv.chuyenDe.map((c) => (
                <li key={c.slug}>
                  <TheBaiHoc
                    to={`/hoc/${c.slug}`}
                    icon={iconChoChuyenDe(c.slug, c.title)}
                    tieuDe={c.title}
                    moTa={c.summary}
                    dongPhu={
                      c.durationMinutes
                        ? `khoảng ${c.durationMinutes} phút · ${c.lessonCount} bài`
                        : `${c.lessonCount} bài`
                    }
                    phanTram={c.phanTram}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
