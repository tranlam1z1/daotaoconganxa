/**
 * Danh mục bài giảng `/hoc` (docs/PLAN.md GĐ11): lĩnh vực → chuyên đề. Bỏ lớp nhóm đối tượng
 * và cấp độ của danh mục cũ; chỉ hiện chuyên đề đã mở được. Mỗi chuyên đề là một thẻ trong lưới,
 * cùng kiểu với thẻ bài ở `/hoc/:course`.
 */
import { Form } from "react-router";
import {
  NHOM_HIEN_THI,
  NHOM_HOC_TAP,
  TEN_NHOM_HOC_TAP,
} from "../../../../packages/dao-tao/src/nhom-doi-tuong";
import { TheBaiHoc } from "../components/bai-giang/TheBaiHoc";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { inputClass, Label } from "../components/ui/Field";
import { DauTrangAnh, KhungTrang } from "../components/ui/KhungTrang";
import { iconChoChuyenDe } from "../lib/bai-giang";
import { danhMucHoc } from "../lib/bai-giang.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/training";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Bài giảng", {
    description: "Chuyên đề học tập dành cho cán bộ, chiến sĩ Công an xã, có kiểm tra cuối bài.",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { nguoiDung } = await yeuCauDangNhap(request);
  const nhomCuaToi = nguoiDung.nhom_doi_tuong ?? [];
  const nhom = new URL(request.url).searchParams.get("nhom") ?? (nhomCuaToi.length ? "cua_toi" : "tat_ca");
  if (![...NHOM_HOC_TAP, "cua_toi", "tat_ca"].includes(nhom)) {
    throw new Response("Nhóm học tập không hợp lệ.", { status: 400 });
  }
  return { linhVuc: await danhMucHoc(request, nhom), nhom, nhomCuaToi };
}

export default function Training({ loaderData }: Route.ComponentProps) {
  const { linhVuc, nhom, nhomCuaToi } = loaderData;
  return (
    <KhungTrang className="wrap max-w-3xl py-8 lg:max-w-7xl">
      <DauTrangAnh icon="book" tieuDe="Bài giảng">
        Chọn một chuyên đề để học. Mỗi bài đọc được theo hai cách: cuộn từ trên xuống, hoặc xem từng trang như
        trình chiếu. Cuối bài có câu kiểm tra nhanh.
      </DauTrangAnh>

      <Form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-64">
          <Label htmlFor="loc-nhom-hoc">Nhóm đối tượng học tập</Label>
          <select key={nhom} id="loc-nhom-hoc" name="nhom" defaultValue={nhom} className={inputClass}>
            <option value="tat_ca">Tất cả chuyên đề</option>
            {nhomCuaToi.length > 0 ? <option value="cua_toi">Theo nhóm của tôi</option> : null}
            {NHOM_HIEN_THI.map((ma) => (
              <option key={ma} value={ma}>
                {TEN_NHOM_HOC_TAP[ma]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Lọc chuyên đề</Button>
      </Form>
      <p className="mt-2 text-sm text-ink-3">
        Chỉ hiển thị chuyên đề đã xuất bản và đã được gắn nhóm đối tượng học tập.
      </p>

      {linhVuc.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="cap"
            title={nhom === "tat_ca" ? "Chưa có bài giảng nào" : "Chưa có chuyên đề phù hợp"}
          >
            <p>
              {nhom === "tat_ca"
                ? "Bài giảng hiện ở đây sau khi được biên soạn và xuất bản."
                : "Chọn nhóm khác hoặc xem tất cả chuyên đề."}
            </p>
          </EmptyState>
        </div>
      ) : (
        linhVuc.map((lv) => (
          <section key={lv.slug} className="mt-8" aria-labelledby={`lv-${lv.slug}`}>
            <h2
              id={`lv-${lv.slug}`}
              className="border-b-2 border-ink pb-2 text-base font-bold uppercase tracking-[0.04em]"
            >
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
    </KhungTrang>
  );
}
