/**
 * Hàng chấm tự luận của bài giảng: /quan-tri/cham-tu-luan.
 *
 * Bài vào hàng khi AI không chấm được (học viên đang chờ điểm), khi học viên đề nghị phúc khảo,
 * hoặc khi hệ thống lấy mẫu bài AI chấm để đối chiếu. Giảng viên chọn mức điểm từng tiêu chí của
 * rubric, kèm nhận xét; điểm của giảng viên là điểm cuối cùng học viên thấy ở trang bài.
 */
import { ChamTheoRubric, docDiemTieuChi, NguonChamTuLuan } from "../components/quan-tri/ChamTheoRubric";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import type { DiemTieuChiHoc } from "../lib/bai-giang";
import { formatNgayGio } from "../lib/format";
import { laRubric, type Rubric } from "../lib/ngan-hang";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.cham-tu-luan";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Chấm tự luận bài giảng", { index: false });
}

/** Một lượt trong hàng chấm lại (GET /v1/quan-tri/dao-tao/cham-lai). Điểm là numeric nên về dạng chuỗi. */
interface LuotCanCham {
  id: string;
  attempt_no: number;
  response: { bai_viet?: string };
  score: string;
  max_score: string;
  feedback: { tom_tat?: string; tieu_chi?: DiemTieuChiHoc[]; phuc_khao?: { ly_do: string } };
  graded_by: string;
  created_at: string;
  title: string | null;
  prompt: { cau_hoi?: string; huong_dan?: string };
  answer: { giai_thich?: string };
  rubric: Rubric | Record<string, never>;
  citations: string[];
  course_title: string;
  account_name: string | null;
  unit_name: string | null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const { items } = await goiApiQuanTri<{ items: LuotCanCham[] }>(token, "/v1/quan-tri/dao-tao/cham-lai");
  return { items };
}

type KetQua = { loi: string } | { ok: string };

const so = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export async function action({ request }: Route.ActionArgs): Promise<KetQua> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  try {
    const { luot } = await goiApiQuanTri<{
      luot: { reviewer_score: string; max_score: string; passed: boolean };
    }>(token, `/v1/quan-tri/dao-tao/cham-lai/${String(f.get("luot") ?? "")}`, {
      body: { diem: docDiemTieuChi(f), nhan_xet: String(f.get("nhan_xet") ?? "") || null },
    });
    return {
      ok: `Đã chấm: ${so(Number(luot.reviewer_score))}/${so(Number(luot.max_score))} điểm, ${luot.passed ? "đạt" : "chưa đạt"}.`,
    };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

export default function ChamTuLuanBaiHoc({ loaderData, actionData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <section>
      <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
        Chấm tự luận
      </TieuDeTrang>
      <NguonChamTuLuan dangXem="bai-giang" />
      <p className="mt-4 max-w-3xl text-sm text-ink-2">
        Câu tự luận trong bài giảng được AI chấm ngay khi học viên nộp. Hàng này gồm bài AI chưa chấm được,
        bài học viên đề nghị phúc khảo và bài lấy mẫu để đối chiếu. Điểm bạn chấm là điểm cuối cùng của học
        viên.
      </p>

      {/* Bài chấm xong rời khỏi hàng, nên kết quả hiện ở đầu trang chứ không nằm trong thẻ bài. */}
      {actionData ? (
        <Notice tone={"loi" in actionData ? "danger" : undefined} className="mt-4">
          {"loi" in actionData ? actionData.loi : actionData.ok}
        </Notice>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="check" title="Không có bài nào chờ chấm" />
        </div>
      ) : (
        <ul className="mt-4 space-y-6">
          {items.map((l) => (
            <LuotCham key={l.id} l={l} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LuotCham({ l }: { l: LuotCanCham }) {
  const aiDaCham = l.graded_by === "ai";
  const lyDo = l.feedback.phuc_khao
    ? `Học viên đề nghị phúc khảo: ${l.feedback.phuc_khao.ly_do}`
    : aiDaCham
      ? "Bài lấy mẫu để đối chiếu điểm AI chấm."
      : "AI chưa chấm được. Học viên đang chờ điểm.";

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-3">
        {l.course_title}
        {l.title ? ` · ${l.title}` : ""} · {l.account_name ?? "Học viên"}
        {l.unit_name ? ` (${l.unit_name})` : ""} · nộp lần {l.attempt_no}, {formatNgayGio(l.created_at)}
      </p>
      <p className="mt-1 text-sm font-medium text-ink-2">{lyDo}</p>
      <p className="mt-2 text-[17px] leading-relaxed font-medium whitespace-pre-line">{l.prompt.cau_hoi}</p>
      {l.prompt.huong_dan ? <p className="mt-1 text-sm text-ink-2">{l.prompt.huong_dan}</p> : null}

      <h3 className="mt-4 font-sans text-sm font-semibold text-ink-2">Bài làm</h3>
      <p className="mt-1 rounded-lg border border-line bg-surface-2 p-3 text-base leading-relaxed whitespace-pre-line">
        {l.response.bai_viet || "(trống)"}
      </p>

      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
          Đáp án gợi ý và căn cứ
        </summary>
        <p className="text-[15px] leading-relaxed whitespace-pre-line">{l.answer.giai_thich || "—"}</p>
        {l.citations.length ? (
          <p className="mt-1 font-mono text-sm text-ink-3">{l.citations.join("; ")}</p>
        ) : null}
      </details>

      {aiDaCham ? (
        <Notice className="mt-3">
          AI đã chấm: {so(Number(l.score))}/{so(Number(l.max_score))} điểm. {l.feedback.tom_tat ?? ""}
        </Notice>
      ) : null}

      {laRubric(l.rubric) ? (
        <ChamTheoRubric
          khoa={l.id}
          rubric={l.rubric}
          diemCu={new Map((aiDaCham ? (l.feedback.tieu_chi ?? []) : []).map((t) => [t.ma, t.diem]))}
          nhanNhanXet="Nhận xét cho học viên (không bắt buộc)"
          nhanNut={aiDaCham ? "Chấm lại" : "Chấm bài này"}
        >
          <input type="hidden" name="luot" value={l.id} />
        </ChamTheoRubric>
      ) : (
        <Notice tone="danger" className="mt-3">
          Bài này không có tiêu chí chấm. Thêm tiêu chí cho bài tập trong bài giảng rồi chấm lại.
        </Notice>
      )}
    </li>
  );
}
