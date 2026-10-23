/**
 * Ma trận của một đề thi, ở trang riêng. Một tệp phục vụ hai route:
 *  - /quan-tri/de-thi/:id/ma-tran: sửa ma trận của đề đã có, lưu riêng với thông tin chung của đề;
 *  - /quan-tri/de-thi/moi/ma-tran: bước hai khi tạo đề. Thông tin chung của bước một đi theo query,
 *    vì CSDL không nhận đề chưa có câu nào nên đề chỉ được tạo khi đã có ma trận.
 *
 * Trang chỉ hiện các chủ đề đề đang rút câu, kèm ô chọn để thêm chủ đề khác. Mỗi chủ đề hai dòng
 * Trắc nghiệm / Tự luận, mỗi dòng ba ô Dễ / Trung bình / Khó, dưới mỗi ô là số câu đã duyệt đang
 * có. Điểm mỗi câu khai theo dạng câu (API nhận điểm theo từng ô; giao diện áp một mức cho mọi ô
 * cùng dạng). Đề đã xuất bản thì ma trận khóa lại vì có thể đã có lượt thi.
 */
import { useMemo, useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";
import { Button } from "../components/ui/Button";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { cn } from "../lib/cn";
import type { MucDoCauHoi } from "../lib/ngan-hang";
import { TEN_MUC_DO } from "../lib/ngan-hang";
import { goiApiQuanTri, khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { urlTrang, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import {
  type CheDoXemDapAn,
  type ChuDeKhaDung,
  type DangCau,
  type DeThi,
  DIEM_MOI_CAU,
  type OMaTran,
  SO_CAU_DE,
  TEN_DANG_CAU,
  TEN_XEM_DAP_AN,
} from "../lib/thi";
import type { Route } from "./+types/quan-tri.de-thi.ma-tran";

const MUC: MucDoCauHoi[] = ["de", "trung_binh", "kho"];
const DANG: DangCau[] = ["trac_nghiem", "tu_luan"];

const khaDung = (t: ChuDeKhaDung, dang: DangCau, l: MucDoCauHoi) =>
  (dang === "tu_luan" ? t.kha_dung_tu_luan : t.kha_dung)[l] ?? 0;
const tongKhaDung = (t: ChuDeKhaDung) =>
  DANG.reduce((s, d) => s + MUC.reduce((x, l) => x + khaDung(t, d, l), 0), 0);
const khoaO = (topic: string, level: string, dang: DangCau) => `${topic}__${level}__${dang}`;
const so = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** Điểm mỗi câu đang dùng của một dạng câu trong ma trận đã lưu (ô đầu tiên của dạng đó). */
function diemDang(matrix: OMaTran[] | undefined, dang: DangCau, macDinh: number): number {
  const o = (matrix ?? []).find((x) => (x.dang ?? "trac_nghiem") === dang);
  return o?.diem_moi_cau ?? macDinh;
}

/** Thông tin chung của đề đang tạo, do bước một (/quan-tri/de-thi/moi) gửi sang qua query. */
interface CauHinhDeMoi {
  title: string;
  description: string | null;
  duration_minutes: number;
  pass_score: number;
  max_attempts: number;
  show_answers: CheDoXemDapAn;
  shuffle_questions: boolean;
  shuffle_options: boolean;
}

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.de ? `Ma trận đề ${data.de.code}` : "Ma trận đề mới", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const { chu_de } = await goiApiQuanTri<{ chu_de: ChuDeKhaDung[] }>(token, "/v1/quan-tri/de-thi/kha-dung");
  if (params.id) {
    const kq = await goiApiQuanTri<{ item: DeThi }>(token, `/v1/quan-tri/de-thi/${params.id}`).catch(
      khongTimThay,
    );
    return { chuDe: chu_de, de: kq.item, moi: null as CauHinhDeMoi | null };
  }
  const q = urlTrang(request).searchParams;
  const title = (q.get("title") ?? "").trim();
  if (!title) throw redirect("/quan-tri/de-thi/moi");
  const xem = q.get("show_answers") ?? "";
  const moi: CauHinhDeMoi = {
    title,
    description: (q.get("description") ?? "").trim() || null,
    duration_minutes: Number(q.get("duration_minutes")) || 45,
    pass_score: Number(q.get("pass_score") ?? 70),
    max_attempts: Number(q.get("max_attempts")) || 1,
    show_answers: (xem in TEN_XEM_DAP_AN ? xem : "sau_nop") as CheDoXemDapAn,
    shuffle_questions: q.get("shuffle_questions") === "on",
    shuffle_options: q.get("shuffle_options") === "on",
  };
  return { chuDe: chu_de, de: null as DeThi | null, moi };
}

type KetQua = { loi: string } | { ok: string; canhBao: string[] };

export async function action({ request, params }: Route.ActionArgs): Promise<KetQua> {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const f = await request.formData();
  const diem: Record<DangCau, number> = {
    trac_nghiem: Number(f.get("diem_trac_nghiem") || 1),
    tu_luan: Number(f.get("diem_tu_luan") || 5),
  };
  const matrix: OMaTran[] = [];
  for (const [k, v] of f.entries()) {
    const m = /^m__(.+)__(de|trung_binh|kho)__(trac_nghiem|tu_luan)$/.exec(k);
    const soCau = Number(v);
    if (m && soCau > 0) {
      const dang = m[3] as DangCau;
      matrix.push({
        topic_id: m[1] as string,
        level: m[2] as MucDoCauHoi,
        so_cau: soCau,
        dang,
        diem_moi_cau: diem[dang],
      });
    }
  }
  try {
    if (!params.id) {
      let moi: CauHinhDeMoi;
      try {
        moi = JSON.parse(String(f.get("cau_hinh") ?? "")) as CauHinhDeMoi;
      } catch {
        throw redirect("/quan-tri/de-thi/moi");
      }
      const kq = await goiApiQuanTri<{ item: DeThi }>(token, "/v1/quan-tri/de-thi", {
        body: { ...moi, matrix },
      });
      throw redirect(`/quan-tri/de-thi/${kq.item.id}?da-tao=1`);
    }
    // Trang này chỉ đổi ma trận: thông tin chung lấy nguyên từ đề đang lưu.
    const { item: cu } = await goiApiQuanTri<{ item: DeThi }>(token, `/v1/quan-tri/de-thi/${params.id}`);
    if (cu.status !== "nhap") return { loi: "Đề đã xuất bản nên ma trận đã khóa." };
    const kq = await goiApiQuanTri<{ canh_bao: string[] }>(token, `/v1/quan-tri/de-thi/${params.id}`, {
      method: "PUT",
      body: {
        title: cu.title,
        description: cu.description,
        matrix,
        duration_minutes: cu.duration_minutes,
        pass_score: cu.pass_score,
        max_attempts: cu.max_attempts,
        show_answers: cu.show_answers,
        shuffle_questions: cu.shuffle_questions,
        shuffle_options: cu.shuffle_options,
      },
    });
    return { ok: "Đã lưu ma trận.", canhBao: kq.canh_bao };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

export default function MaTranDe({ loaderData, actionData }: Route.ComponentProps) {
  const { chuDe, de, moi } = loaderData;
  const busy = useNavigation().state !== "idle";
  const khoa = Boolean(de && de.status !== "nhap");
  const tenDe = de?.title ?? moi?.title ?? "";

  const [soCau, setSoCau] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (de?.matrix ?? []).map((o) => [khoaO(o.topic_id, o.level, o.dang ?? "trac_nghiem"), o.so_cau]),
    ),
  );
  const [diem, setDiem] = useState<Record<DangCau, number>>(() => ({
    trac_nghiem: diemDang(de?.matrix, "trac_nghiem", 1),
    tu_luan: diemDang(de?.matrix, "tu_luan", 5),
  }));
  // Chủ đề đang nằm trong ma trận, theo thứ tự thêm vào.
  const [dangDung, setDangDung] = useState<string[]>(() => [
    ...new Set((de?.matrix ?? []).filter((o) => o.so_cau > 0).map((o) => o.topic_id)),
  ]);
  const [chonThem, setChonThem] = useState("");

  const theoId = useMemo(() => new Map(chuDe.map((t) => [t.id, t])), [chuDe]);
  const cacChuDe = dangDung.map((id) => theoId.get(id)).filter((t): t is ChuDeKhaDung => Boolean(t));
  const conLai = chuDe.filter((t) => !dangDung.includes(t.id));

  const tongTheoDang: Record<DangCau, number> = { trac_nghiem: 0, tu_luan: 0 };
  for (const t of cacChuDe) {
    for (const d of DANG) for (const l of MUC) tongTheoDang[d] += soCau[khoaO(t.id, l, d)] ?? 0;
  }
  const tong = tongTheoDang.trac_nghiem + tongTheoDang.tu_luan;
  const diemTL = tongTheoDang.tu_luan * diem.tu_luan;
  const tongDiem = tongTheoDang.trac_nghiem * diem.trac_nghiem + diemTL;
  const vuot = cacChuDe.flatMap((t) =>
    DANG.flatMap((d) =>
      MUC.filter((l) => (soCau[khoaO(t.id, l, d)] ?? 0) > khaDung(t, d, l)).map(
        (l) => `${t.name} (${TEN_MUC_DO[l]}${d === "tu_luan" ? ", tự luận" : ""})`,
      ),
    ),
  );
  const tongHopLe = tong >= SO_CAU_DE.toiThieu && tong <= SO_CAU_DE.toiDa;
  const canhBao = actionData && "canhBao" in actionData ? actionData.canhBao : [];

  const themChuDe = () => {
    if (!chonThem || dangDung.includes(chonThem)) return;
    setDangDung((ds) => [...ds, chonThem]);
    setChonThem("");
  };
  const boChuDe = (id: string) => {
    setDangDung((ds) => ds.filter((x) => x !== id));
    setSoCau((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith(`${id}__`))));
  };

  return (
    <section className="max-w-3xl">
      <Link
        to={de ? `/quan-tri/de-thi/${de.id}` : "/quan-tri/de-thi/moi"}
        className="flex min-h-11 items-center text-sm font-medium text-primary"
      >
        {de ? "Về đề thi" : "Về bước thông tin đề"}
      </Link>
      <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
        Ma trận đề
      </TieuDeTrang>
      <p className="mt-1 text-sm text-ink-2">
        {tenDe}
        {de ? <span className="ml-2 font-mono text-ink-3">{de.code}</span> : null}
      </p>
      <p className="mt-2 text-sm text-ink-2">
        Số câu rút ngẫu nhiên từ ngân hàng cho mỗi chủ đề, mức độ và dạng câu. Chỉ câu đã duyệt được rút. Trắc
        nghiệm gồm mọi loại chấm máy; tự luận được chấm theo tiêu chí khi nộp bài.
      </p>

      {actionData && "loi" in actionData ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData ? <Notice className="mt-4">{actionData.ok}</Notice> : null}
      {canhBao.length ? (
        <Notice tone="danger" className="mt-4">
          Ma trận đã lưu nhưng chưa sinh được đề; đề chưa xuất bản được cho tới khi đủ câu đã duyệt:
          <ul className="mt-1 list-disc pl-5">
            {canhBao.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {khoa ? <Notice className="mt-4">Đề đã xuất bản nên ma trận đã khóa, chỉ xem được.</Notice> : null}

      <Form method="post" className="mt-6 space-y-6">
        {moi ? <input type="hidden" name="cau_hinh" value={JSON.stringify(moi)} /> : null}
        <fieldset disabled={khoa} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {DANG.map((d) => (
              <div key={d}>
                <Label htmlFor={`mt-diem-${d}`}>Điểm mỗi câu {TEN_DANG_CAU[d].toLowerCase()}</Label>
                <Input
                  id={`mt-diem-${d}`}
                  name={d === "tu_luan" ? "diem_tu_luan" : "diem_trac_nghiem"}
                  type="number"
                  inputMode="decimal"
                  step={0.25}
                  min={DIEM_MOI_CAU.toiThieu}
                  max={DIEM_MOI_CAU.toiDa}
                  required
                  value={diem[d]}
                  onChange={(e) => setDiem((s) => ({ ...s, [d]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>

          <div>
            <p
              aria-live="polite"
              className={cn(
                "rounded-lg px-3 py-2 text-[15px] font-semibold",
                tongHopLe && !vuot.length ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
              )}
            >
              Tổng: {tong} câu ({tongTheoDang.trac_nghiem} trắc nghiệm, {tongTheoDang.tu_luan} tự luận),{" "}
              {so(tongDiem)} điểm
              {tongDiem > 0 && diemTL > 0 ? ` (tự luận chiếm ${so((diemTL / tongDiem) * 100)}%)` : ""}
              {!tongHopLe ? ` (cần từ ${SO_CAU_DE.toiThieu} đến ${SO_CAU_DE.toiDa} câu)` : ""}
              {vuot.length ? `. Vượt số câu đang có: ${vuot.join(", ")}` : ""}
            </p>
            <p className="mt-1 text-sm text-ink-2">Điểm của người thi được quy về thang 100.</p>
          </div>

          {cacChuDe.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-ink-2">
              Ma trận chưa có chủ đề nào. Chọn chủ đề ở dưới để thêm.
            </p>
          ) : (
            <ul className="grid gap-3">
              {cacChuDe.map((t) => (
                <li key={t.id} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-ink-3">
                        {t.code}
                        {t.field_name ? ` · ${t.field_name}` : ""}
                      </p>
                    </div>
                    {khoa ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => boChuDe(t.id)}
                        aria-label={`Bỏ chủ đề ${t.name} khỏi ma trận`}
                      >
                        Bỏ chủ đề
                      </Button>
                    )}
                  </div>
                  {DANG.map((d) => (
                    <fieldset key={d} className="mt-2">
                      <legend className="text-xs font-semibold text-ink-2">{TEN_DANG_CAU[d]}</legend>
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        {MUC.map((l) => {
                          const k = khoaO(t.id, l, d);
                          const id = `m-${t.id}-${l}-${d}`;
                          const co = khaDung(t, d, l);
                          const quaSo = (soCau[k] ?? 0) > co;
                          return (
                            <div key={l}>
                              <label htmlFor={id} className="block text-xs font-medium text-ink-2">
                                {TEN_MUC_DO[l]}
                              </label>
                              <input
                                id={id}
                                name={`m__${k}`}
                                type="number"
                                min={0}
                                max={SO_CAU_DE.toiDa}
                                inputMode="numeric"
                                value={soCau[k] || ""}
                                placeholder="0"
                                onChange={(e) =>
                                  setSoCau((s) => ({ ...s, [k]: Number(e.target.value) || 0 }))
                                }
                                aria-describedby={`${id}-co`}
                                className={cn(inputClass, "mt-1 tabular-nums", quaSo && "border-danger")}
                              />
                              <p
                                id={`${id}-co`}
                                className={cn("mt-0.5 text-xs", quaSo ? "text-danger" : "text-ink-3")}
                              >
                                có {co} câu
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </li>
              ))}
            </ul>
          )}

          {khoa ? null : chuDe.length === 0 ? (
            <p className="text-sm text-ink-2">
              Ngân hàng chưa có chủ đề nào.{" "}
              <Link to="/quan-tri/cau-hoi" className="text-primary underline">
                Mở ngân hàng câu hỏi
              </Link>
              .
            </p>
          ) : conLai.length ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor="mt-them">Thêm chủ đề vào ma trận</Label>
                <select
                  id="mt-them"
                  value={chonThem}
                  onChange={(e) => setChonThem(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Chọn chủ đề</option>
                  {conLai.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({tongKhaDung(t)} câu đã duyệt)
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" onClick={themChuDe} disabled={!chonThem}>
                Thêm chủ đề
              </Button>
            </div>
          ) : null}
        </fieldset>

        {khoa ? null : (
          <ThanhLuuBieuMau
            loi={actionData && "loi" in actionData ? actionData.loi : null}
            ok={actionData && "ok" in actionData ? actionData.ok : null}
          >
            <Button type="submit" disabled={busy || !tongHopLe} className="min-h-12 w-full md:w-auto">
              {de ? "Lưu ma trận" : "Tạo đề thi (bản nháp)"}
            </Button>
          </ThanhLuuBieuMau>
        )}
      </Form>
    </section>
  );
}
