/**
 * Hàng chấm tự luận của đề thi: /quan-tri/cham-tu-luan/de-thi.
 *
 * - "Chờ chấm": câu mô hình không chấm được; lượt của người thi đang chờ điểm, chấm xong là chốt.
 * - "AI đã chấm": câu mô hình đã chấm, để lấy mẫu đối chiếu hoặc phúc khảo; chấm lại thì điểm
 *   lượt được tính lại.
 *
 * Giảng viên chọn mức điểm từng tiêu chí của rubric (như mô hình), kèm nhận xét cho người thi.
 */
import { Link } from "react-router";

import { ChamTheoRubric, docDiemTieuChi, NguonChamTuLuan } from "../components/quan-tri/ChamTheoRubric";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { formatNgayGio } from "../lib/format";
import { laRubric } from "../lib/ngan-hang";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { CauTuLuanCanCham } from "../lib/thi";
import type { Route } from "./+types/quan-tri.cham-tu-luan.de-thi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Chấm tự luận", { index: false });
}

type CheDo = "cho_nguoi" | "da_cham_ai";

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const cheDo: CheDo =
    new URL(request.url).searchParams.get("che_do") === "da_cham_ai" ? "da_cham_ai" : "cho_nguoi";
  const { items } = await goiApiQuanTri<{ items: CauTuLuanCanCham[] }>(
    token,
    `/v1/quan-tri/de-thi/cham-tu-luan?che_do=${cheDo}`,
  );
  return { items, cheDo };
}

type KetQua = { loi: string; khoa: string } | { ok: string; khoa: string };

export async function action({ request }: Route.ActionArgs): Promise<KetQua> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const luot = String(f.get("luot") ?? "");
  const cau = String(f.get("cau") ?? "");
  const khoa = `${luot}-${cau}`;
  const diem = docDiemTieuChi(f);
  try {
    const kq = await goiApiQuanTri<{
      diem_cau: number;
      diem_toi_da: number;
      luot: { trang_thai: string; diem: number | null; dat: boolean | null };
    }>(token, `/v1/quan-tri/de-thi/cham-tu-luan/${luot}/${cau}`, {
      body: { diem, nhan_xet: String(f.get("nhan_xet") ?? "") || null },
    });
    const so = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
    return {
      khoa,
      ok:
        `Đã chấm: ${so(kq.diem_cau)}/${so(kq.diem_toi_da)} điểm. ` +
        (kq.luot.trang_thai === "da_nop" && kq.luot.diem !== null
          ? `Lượt thi: ${so(kq.luot.diem)}/100, ${kq.luot.dat ? "đạt" : "chưa đạt"}.`
          : "Lượt thi còn câu khác chờ chấm."),
    };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message, khoa };
    throw e;
  }
}

export default function ChamTuLuan({ loaderData, actionData }: Route.ComponentProps) {
  const { items, cheDo } = loaderData;
  return (
    <section>
      <h2 className="text-xl font-semibold">Chấm tự luận</h2>
      <NguonChamTuLuan dangXem="de-thi" />
      <p className="mt-4 max-w-3xl text-sm text-ink-2">
        Câu tự luận trong đề thi được chấm tự động theo tiêu chí khi người thi nộp bài. Câu chưa chấm được nằm
        ở tab Chờ chấm. Tab AI đã chấm dùng để đối chiếu và phúc khảo: chấm lại thì điểm lượt thi được tính
        lại.
      </p>

      <nav aria-label="Hàng chấm" className="mt-4 flex gap-1 border-b border-line">
        {(
          [
            { che: "cho_nguoi", label: "Chờ chấm" },
            { che: "da_cham_ai", label: "AI đã chấm" },
          ] as const
        ).map((t) => (
          <Link
            key={t.che}
            to={t.che === "cho_nguoi" ? "?" : "?che_do=da_cham_ai"}
            aria-current={cheDo === t.che ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 items-center border-b-2 px-4 text-sm",
              cheDo === t.che
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Câu vừa chấm rời khỏi hàng thì thẻ của nó không còn để hiện lời báo. */}
      {actionData && !items.some((c) => `${c.attempt_id}-${c.ordinal}` === actionData.khoa) ? (
        <Notice tone={"loi" in actionData ? "danger" : undefined} className="mt-4">
          {"loi" in actionData ? actionData.loi : actionData.ok}
        </Notice>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="check"
            title={cheDo === "cho_nguoi" ? "Không có câu nào chờ chấm" : "Chưa có câu nào được AI chấm"}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-6">
          {items.map((c) => (
            <CauCham key={`${c.attempt_id}-${c.ordinal}`} c={c} kq={actionData} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CauCham({ c, kq }: { c: CauTuLuanCanCham; kq: KetQua | undefined }) {
  const khoa = `${c.attempt_id}-${c.ordinal}`;
  const kqNay = kq && kq.khoa === khoa ? kq : undefined;
  const rubric = c.item.noi_dung.rubric;
  const diemCu = new Map((c.feedback?.tieu_chi ?? []).map((t) => [t.ma, t.diem]));
  const so = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-3">
        {c.exam_title} · câu {c.ordinal} · {c.account_name ?? "Người thi"}
        {c.unit_name ? ` (${c.unit_name})` : ""}
        {c.submitted_at ? ` · nộp ${formatNgayGio(c.submitted_at)}` : ""}
      </p>
      <p className="mt-2 text-[17px] leading-relaxed font-medium whitespace-pre-line">
        {c.item.noi_dung.stem}
      </p>

      <h3 className="mt-4 font-sans text-sm font-semibold text-ink-2">Bài làm</h3>
      <p className="mt-1 rounded-lg border border-line bg-surface-2 p-3 text-base leading-relaxed whitespace-pre-line">
        {c.response.bai_viet || "(trống)"}
      </p>

      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
          Đáp án gợi ý và căn cứ
        </summary>
        <p className="text-[15px] leading-relaxed whitespace-pre-line">
          {c.item.noi_dung.explanation || "—"}
        </p>
        {c.item.noi_dung.citations.length ? (
          <p className="mt-1 font-mono text-sm text-ink-3">{c.item.noi_dung.citations.join("; ")}</p>
        ) : null}
      </details>

      {c.graded_by && c.points !== null ? (
        <Notice className="mt-3">
          {c.graded_by === "ai" ? "AI" : `Giảng viên ${c.reviewer ?? ""}`.trim()} đã chấm: {so(c.points)}/
          {so(c.max_points ?? 0)} điểm. {c.feedback?.tom_tat ?? ""}
        </Notice>
      ) : null}

      {kqNay ? (
        <Notice tone={"loi" in kqNay ? "danger" : undefined} className="mt-3">
          {"loi" in kqNay ? kqNay.loi : kqNay.ok}
        </Notice>
      ) : null}

      {laRubric(rubric) ? (
        <ChamTheoRubric
          khoa={khoa}
          rubric={rubric}
          diemCu={diemCu}
          nhanNhanXet="Nhận xét cho người thi (không bắt buộc)"
          nhanNut={c.grading_state === "cho_nguoi" ? "Chấm câu này" : "Chấm lại (phúc khảo)"}
        >
          <input type="hidden" name="luot" value={c.attempt_id} />
          <input type="hidden" name="cau" value={c.ordinal} />
        </ChamTheoRubric>
      ) : (
        <Notice tone="danger" className="mt-3">
          Câu này không có tiêu chí chấm. Sửa câu trong ngân hàng rồi chấm lại.
        </Notice>
      )}
    </li>
  );
}
