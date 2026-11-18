/**
 * Kết quả một phiên luyện tập (docs/PLAN.md GĐ4): số câu đúng, các câu sai kèm đáp án đúng và
 * giải thích, nút "Luyện lại câu sai".
 */
import { Form, Link, redirect, useNavigation } from "react-router";
import { PhanHoiCauTraLoi } from "../components/luyen-tap/PhanHoiCauTraLoi";
import { Button, ButtonLink } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { cn } from "../lib/cn";
import { layPhien, taoPhien } from "../lib/luyen-tap.server";
import type { DapAnCauHoi, DeCauHoi } from "../lib/ngan-hang";
import { tenPhienLuyenTap } from "../lib/nhom";
import { khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/luyen-tap.ket-qua";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Kết quả luyện tập", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const phien = await layPhien(token, params.phien).catch(khongTimThay);
  if (!phien.ket_thuc) throw redirect(`/luyen-tap/${phien.id}`);
  return { phien };
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

/** Đáp án đúng viết thành chữ, từ phần đề và đáp án trả về sau khi chấm. */
function dapAnBangChu(de: DeCauHoi, d: DapAnCauHoi): string {
  const ten = new Map(
    [...(de.options.phuong_an ?? []), ...(de.options.phai ?? [])].map((m) => [m.id, m.text]),
  );
  if (de.kind === "dung_sai") return d.dung?.[0] === "sai" ? "Sai" : "Đúng";
  if (d.dung) return d.dung.map((id) => ten.get(id) ?? id).join("; ");
  if (d.thu_tu) return d.thu_tu.map((id, i) => `${i + 1}. ${ten.get(id) ?? id}`).join("; ");
  if (d.cap) {
    const trai = new Map((de.options.trai ?? []).map((m) => [m.id, m.text]));
    return Object.entries(d.cap)
      .map(([t, p]) => `${trai.get(t) ?? t}: ${ten.get(p) ?? p}`)
      .join("; ");
  }
  if (d.o_trong) {
    return Object.entries(d.o_trong)
      .map(([k, v]) => `(${k}) ${v[0] ?? ""}`)
      .join("; ");
  }
  return "";
}

export default function KetQuaLuyenTap({ loaderData, actionData }: Route.ComponentProps) {
  const { phien } = loaderData;
  const busy = useNavigation().state !== "idle";
  const dung = phien.dung ?? 0;
  const phanTram = phien.tong ? Math.round((dung / phien.tong) * 100) : 0;
  const cauSai = phien.cau.filter((c) => c.ket_qua && !c.ket_qua.dung);
  const boQua = phien.cau.filter((c) => !c.ket_qua).length;

  return (
    <KhungTrang className="wrap max-w-xl py-8">
      <TieuDeTrang icon="cap" className="">
        Kết quả
      </TieuDeTrang>
      <p className="mt-1 text-sm text-ink-2">{tenPhienLuyenTap(phien)}</p>

      <div className="mt-6 rounded-card border border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.06em] text-ink-3">Tỉ lệ đúng</p>
        <p className={cn("mt-1 text-5xl font-bold tabular-nums", phanTram >= 70 ? "text-ok" : "text-danger")}>
          {phanTram}%
        </p>
        <p className="mt-2 text-lg tabular-nums">
          Đúng {dung}/{phien.tong} câu
        </p>
        {boQua ? <p className="mt-1 text-sm text-ink-2">{boQua} câu chưa trả lời.</p> : null}
      </div>

      {actionData?.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-3">
        {/* Đề ôn tập của nhóm học cùng (docs/PLAN.md GĐ16b, đề xuất Đ14): quay về nhóm là việc chính. */}
        {phien.nhom ? (
          <ButtonLink to={`/nhom/${phien.nhom.id}`} className="min-h-12 w-full text-base">
            Về nhóm
          </ButtonLink>
        ) : null}
        {cauSai.length ? (
          <Form method="post">
            <Button
              type="submit"
              variant={phien.nhom ? "secondary" : "primary"}
              className="min-h-12 w-full text-base"
              disabled={busy}
            >
              Luyện lại câu sai
            </Button>
          </Form>
        ) : null}
        <ButtonLink
          to="/luyen-tap"
          variant={cauSai.length || phien.nhom ? "secondary" : "primary"}
          className="min-h-12 w-full text-base"
        >
          Chọn chủ đề khác
        </ButtonLink>
      </div>

      {cauSai.length ? (
        <section aria-labelledby="cau-sai" className="mt-8">
          {/* Tiêu đề mục kiểu "Công văn": viết hoa, kẻ mực đậm bên dưới; mỗi câu một dòng kẻ. */}
          <h2
            id="cau-sai"
            className="border-b-2 border-ink pb-2 font-sans text-base font-bold uppercase tracking-[0.04em]"
          >
            Các câu chưa đúng ({cauSai.length})
          </h2>
          <ol className="grid">
            {cauSai.map((c) => (
              <li key={c.stt} className="border-b border-line py-5">
                <p className="text-sm font-semibold uppercase tracking-[0.06em] text-ink-3">Câu {c.stt}</p>
                <p className="mt-1 text-lg leading-relaxed font-semibold">{c.de.stem}</p>
                <p className="mt-2 text-base">
                  <span className="font-semibold">Đáp án đúng:</span> {dapAnBangChu(c.de, c.ket_qua!.dap_an)}
                </p>
                <div className="mt-3">
                  <PhanHoiCauTraLoi ketQua={c.ket_qua!} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-8 text-center text-sm">
        <Link to="/toi" className="inline-flex min-h-11 items-center text-ink-2 underline">
          Xem lịch sử luyện tập
        </Link>
      </p>
    </KhungTrang>
  );
}
