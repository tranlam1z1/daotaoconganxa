/**
 * Tạo và sửa đề thi (docs/PLAN.md GĐ6). Một tệp phục vụ hai route: /quan-tri/de-thi/moi và
 * /quan-tri/de-thi/:id.
 *
 * Trang này lo thông tin chung của đề (tên, thời gian, điểm đạt, số lần làm, cách xem đáp án).
 * Ma trận nằm ở trang riêng (quan-tri.de-thi.ma-tran.tsx); ở đây chỉ có dòng tóm tắt và lối sang
 * trang đó. Tạo đề đi hai bước: biểu mẫu ở /moi gửi thông tin chung sang trang ma trận bằng GET,
 * trang ma trận mới thật sự tạo đề, vì CSDL không nhận đề chưa có câu nào. Đề đã xuất bản chỉ sửa
 * được tên và mô tả; cấu hình khóa lại vì có thể đã có lượt thi.
 *
 * Đề do AI sinh (từ văn bản hoặc từ tệp PDF) kèm khung tiến độ tự tải lại mỗi 4 giây khi còn việc
 * đang chạy, danh sách câu chờ duyệt kèm đáp án để xem lướt và từ chối từng câu, và một nút duyệt
 * hết các câu đó rồi xuất bản đề.
 */
import { useEffect } from "react";
import { Form, Link, redirect, useNavigation, useRevalidator } from "react-router";
import { HienThiCauHoi } from "../components/cau-hoi/HienThiCauHoi";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { cn } from "../lib/cn";
import type { DapAnCauHoi, DeCauHoi, LoaiCauHoi, MucDoCauHoi, TraLoiCauHoi } from "../lib/ngan-hang";
import { TEN_MUC_DO } from "../lib/ngan-hang";
import { goiApiQuanTri, khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import {
  type CheDoXemDapAn,
  type ChuDeKhaDung,
  type DeThi,
  TEN_TRANG_THAI_DE,
  TEN_XEM_DAP_AN,
  type TienDoSinhDe,
  TONE_TRANG_THAI_DE,
  tomTatMaTran,
  type ViecSinhCuaDe,
} from "../lib/thi";
import type { Route } from "./+types/quan-tri.de-thi.sua";

const so = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

interface CauXemTruoc {
  question_id: string;
  de: DeCauHoi;
  noi_dung: { answer: DapAnCauHoi; explanation: string | null; citations: string[] };
}

/** Một câu AI sinh cho đề còn chờ duyệt, kèm đáp án. */
interface CauChoDuyet extends CauXemTruoc {
  code: string;
  kind: LoaiCauHoi;
  level: MucDoCauHoi;
}

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.de ? `Đề thi ${data.de.code}` : "Tạo đề thi", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const { chu_de } = await goiApiQuanTri<{ chu_de: ChuDeKhaDung[] }>(token, "/v1/quan-tri/de-thi/kha-dung");
  if (!params.id)
    return {
      chuDe: chu_de,
      de: null as DeThi | null,
      canhBao: [] as string[],
      viecSinh: [] as ViecSinhCuaDe[],
      tienDo: null as TienDoSinhDe | null,
      choDuyet: [] as CauChoDuyet[],
    };
  const kq = await goiApiQuanTri<{
    item: DeThi;
    canh_bao: string[];
    viec_sinh?: ViecSinhCuaDe[];
    tien_do?: TienDoSinhDe | null;
  }>(token, `/v1/quan-tri/de-thi/${params.id}`).catch(khongTimThay);
  const tienDo = kq.tien_do ?? null;
  // Câu chờ duyệt chỉ tải khi AI đã sinh xong: đang sinh dở thì danh sách còn đổi.
  const choDuyet =
    tienDo && !tienDo.dang_chay && kq.item.status !== "xuat_ban"
      ? (
          await goiApiQuanTri<{ items: CauChoDuyet[] }>(
            token,
            `/v1/quan-tri/de-thi/${params.id}/cau-cho-duyet`,
          )
        ).items
      : [];
  return {
    chuDe: chu_de,
    de: kq.item,
    canhBao: kq.canh_bao,
    viecSinh: kq.viec_sinh ?? [],
    tienDo,
    choDuyet,
  };
}

type KetQuaThaoTac =
  | { loi: string; chiTiet?: string[] }
  | { ok: string; canhBao?: string[] }
  | { xemTruoc: CauXemTruoc[] };

export async function action({ request, params }: Route.ActionArgs): Promise<KetQuaThaoTac> {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "luu");
  try {
    if (intent === "duyet_xuat_ban") {
      const kq = await goiApiQuanTri<{ da_duyet: number }>(
        token,
        `/v1/quan-tri/de-thi/${params.id}/duyet-xuat-ban`,
        { method: "POST", body: {} },
      );
      return {
        ok: `Đã duyệt ${kq.da_duyet} câu và xuất bản đề thi. Cán bộ quản lý giao được đề này.`,
      };
    }
    if (intent === "tu_choi") {
      await goiApiQuanTri(
        token,
        `/v1/quan-tri/ngan-hang/cau-hoi/${encodeURIComponent(String(f.get("id") ?? ""))}/tu-choi`,
        { body: { ly_do: String(f.get("ly_do") ?? "").trim() } },
      );
      return { ok: `Đã từ chối câu ${String(f.get("code") ?? "")}. Câu này không vào đề.` };
    }
    if (intent === "sinh_tiep") {
      const kq = await goiApiQuanTri<{ da_chay: boolean }>(
        token,
        `/v1/quan-tri/de-thi/${params.id}/sinh-tiep`,
        { body: { so_ky_hieu: String(f.get("so_ky_hieu") ?? "").trim() || undefined } },
      );
      return { ok: kq.da_chay ? "Đã chạy tiếp phần còn dở." : "Không còn phần nào dang dở." };
    }
    if (intent === "xuat_ban" || intent === "dong") {
      await goiApiQuanTri(token, `/v1/quan-tri/de-thi/${params.id}/trang-thai`, { body: { status: intent } });
      return {
        ok: intent === "dong" ? "Đã đóng đề thi." : "Đã xuất bản đề thi. Cán bộ quản lý giao được đề này.",
      };
    }
    if (intent === "xem_truoc") {
      const kq = await goiApiQuanTri<{ items: CauXemTruoc[] }>(
        token,
        `/v1/quan-tri/de-thi/${params.id}/xem-truoc`,
        {
          method: "POST",
        },
      );
      return { xemTruoc: kq.items };
    }
    // Đề mới được tạo ở trang ma trận (bước hai); biểu mẫu ở /moi chỉ chuyển sang đó bằng GET.
    if (!params.id) throw redirect("/quan-tri/de-thi/moi");
    // Ma trận sửa ở trang riêng nên giữ nguyên ma trận đang lưu. Đề đã xuất bản thì các ô cấu hình
    // bị khóa không được gửi đi, lấy lại từ đề (API cũng chỉ lưu tên và mô tả của đề đó).
    const { item: cu } = await goiApiQuanTri<{ item: DeThi }>(token, `/v1/quan-tri/de-thi/${params.id}`);
    const khoa = cu.status !== "nhap";
    const body = {
      title: String(f.get("title") ?? "").trim(),
      description: String(f.get("description") ?? "").trim() || null,
      matrix: cu.matrix,
      duration_minutes: khoa ? cu.duration_minutes : Number(f.get("duration_minutes")),
      pass_score: khoa ? cu.pass_score : Number(f.get("pass_score")),
      max_attempts: khoa ? cu.max_attempts : Number(f.get("max_attempts")),
      show_answers: khoa ? cu.show_answers : (String(f.get("show_answers")) as CheDoXemDapAn),
      shuffle_questions: khoa ? cu.shuffle_questions : f.get("shuffle_questions") === "on",
      shuffle_options: khoa ? cu.shuffle_options : f.get("shuffle_options") === "on",
    };
    const kq = await goiApiQuanTri<{ canh_bao: string[]; ghi_chu?: string }>(
      token,
      `/v1/quan-tri/de-thi/${params.id}`,
      {
        method: "PUT",
        body,
      },
    );
    return { ok: kq.ghi_chu ?? "Đã lưu đề thi.", canhBao: kq.canh_bao };
  } catch (e) {
    if (e instanceof LoiApi) {
      const loi = (e.details as { loi?: unknown } | undefined)?.loi;
      return { loi: e.message, ...(Array.isArray(loi) ? { chiTiet: loi.map(String) } : {}) };
    }
    throw e;
  }
}

/** Câu trả lời đúng dựng từ đáp án, để xem trước hiện đề kèm đáp án bằng chính component thi. */
function traLoiDung(a: DapAnCauHoi): TraLoiCauHoi {
  if (a.dung) return { chon: a.dung };
  if (a.thu_tu) return { thu_tu: a.thu_tu };
  if (a.cap) return { cap: a.cap };
  if (a.o_trong)
    return { o_trong: Object.fromEntries(Object.entries(a.o_trong).map(([k, v]) => [k, v[0] ?? ""])) };
  return {};
}

export default function SuaDeThi({ loaderData, actionData }: Route.ComponentProps) {
  const { chuDe, de, canhBao, viecSinh, tienDo, choDuyet } = loaderData;
  const busy = useNavigation().state !== "idle";
  const revalidator = useRevalidator();
  const dangSinh = Boolean(tienDo?.dang_chay);
  useEffect(() => {
    if (!dangSinh) return;
    const hen = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 4000);
    return () => clearInterval(hen);
  }, [dangSinh, revalidator]);
  const khoa = Boolean(de && de.status !== "nhap");

  const maTran = de ? tomTatMaTran(de.matrix) : null;
  const tenChuDe = new Map(chuDe.map((c) => [c.id, c.name]));
  const canhBaoHienTai = actionData && "canhBao" in actionData ? (actionData.canhBao ?? []) : canhBao;

  return (
    <section>
      <Link
        to="/quan-tri/de-thi"
        className="hidden min-h-11 items-center text-sm font-medium text-primary md:flex"
      >
        Về danh sách đề thi
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
          {de ? de.title : "Tạo đề thi"}
        </TieuDeTrang>
        {de ? (
          <>
            <span className="font-mono text-sm text-ink-3">{de.code}</span>
            <Badge tone={TONE_TRANG_THAI_DE[de.status]}>{TEN_TRANG_THAI_DE[de.status]}</Badge>
          </>
        ) : null}
      </div>

      {actionData && "loi" in actionData ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
          {actionData.chiTiet?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {actionData.chiTiet.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData ? <Notice className="mt-4">{actionData.ok}</Notice> : null}
      {/* AI còn đang sinh hoặc còn câu chờ duyệt thì thiếu câu là điều đương nhiên; khung bên dưới nói việc cần làm. */}
      {canhBaoHienTai.length && !dangSinh && !choDuyet.length ? (
        <Notice tone="danger" className="mt-4">
          Ma trận chưa sinh được đề; đề chưa xuất bản được cho tới khi đủ câu:
          <ul className="mt-1 list-disc pl-5">
            {canhBaoHienTai.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {de && tienDo ? (
        <KhungCauAi
          tienDo={tienDo}
          viec={viecSinh}
          choDuyet={choDuyet}
          daXuatBan={de.status === "xuat_ban"}
          busy={busy}
        />
      ) : null}

      {de ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Form method="post">
            <input type="hidden" name="intent" value="xem_truoc" />
            <Button type="submit" variant="secondary" disabled={busy}>
              Xem trước một đề sinh thử
            </Button>
          </Form>
          {de.status !== "xuat_ban" ? (
            // Còn câu AI chờ duyệt thì nút "Duyệt và xuất bản" ở khung trên lo cả hai việc.
            choDuyet.length || dangSinh ? null : (
              <Form method="post">
                <input type="hidden" name="intent" value="xuat_ban" />
                <Button type="submit" disabled={busy}>
                  {de.status === "dong" ? "Mở lại đề thi" : "Xuất bản đề thi"}
                </Button>
              </Form>
            )
          ) : (
            <>
              <ButtonLink to={`/quan-tri/giao-bai?de=${de.id}`}>Giao bài</ButtonLink>
              <Form method="post">
                <input type="hidden" name="intent" value="dong" />
                <Button type="submit" variant="secondary" disabled={busy}>
                  Đóng đề thi
                </Button>
              </Form>
            </>
          )}
        </div>
      ) : null}

      {actionData && "xemTruoc" in actionData ? (
        <details open className="mt-4 rounded-card border border-line bg-surface px-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            Đề sinh thử: {actionData.xemTruoc.length} câu, kèm đáp án
          </summary>
          <ol className="space-y-5 pb-4">
            {actionData.xemTruoc.map((c, i) => (
              <li key={c.question_id}>
                <p className="mb-1 text-sm font-semibold text-ink-3">Câu {i + 1}</p>
                <HienThiCauHoi
                  de={c.de}
                  traLoi={traLoiDung(c.noi_dung.answer)}
                  ketQua={{
                    dung: true,
                    ty_le: 1,
                    dap_an: c.noi_dung.answer,
                    giai_thich: c.noi_dung.explanation,
                    can_cu: [],
                  }}
                  khoa
                  idGoc={`xt-${i}`}
                />
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {de && maTran ? (
        <section aria-labelledby="ma-tran" className="mt-6 rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="ma-tran" className="font-sans text-base font-semibold">
                Ma trận đề
              </h3>
              <p className="mt-1 text-sm text-ink-2">
                {maTran.tong} câu ({maTran.soCau.trac_nghiem} trắc nghiệm, {maTran.soCau.tu_luan} tự luận) ·{" "}
                {so(maTran.diem)} điểm · {maTran.chuDe.length} chủ đề
              </p>
            </div>
            <ButtonLink to={`/quan-tri/de-thi/${de.id}/ma-tran`} variant="secondary">
              {khoa ? "Xem ma trận" : "Sửa ma trận"}
            </ButtonLink>
          </div>
          <ul className="mt-2 text-sm text-ink-2">
            {maTran.chuDe.map((c) => (
              <li key={c.id}>
                {tenChuDe.get(c.id) ?? "Chủ đề đã xóa"}: {c.trac_nghiem} trắc nghiệm
                {c.tu_luan ? `, ${c.tu_luan} tự luận` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {de ? <h3 className="mt-8 font-sans text-base font-semibold">Thông tin đề thi</h3> : null}
      {/* Đề mới: gửi thông tin chung sang trang ma trận bằng GET, đề được tạo ở bước đó. */}
      <Form
        method={de ? "post" : "get"}
        action={de ? undefined : "/quan-tri/de-thi/moi/ma-tran"}
        className={de ? "mt-3 space-y-6" : "mt-6 space-y-6"}
      >
        {de ? <input type="hidden" name="intent" value="luu" /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="dt-ten">Tên đề thi</Label>
            <Input id="dt-ten" name="title" required defaultValue={de?.title ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="dt-mo-ta">Mô tả (không bắt buộc)</Label>
            <Input id="dt-mo-ta" name="description" defaultValue={de?.description ?? ""} />
          </div>
        </div>

        {khoa ? (
          <Notice>Đề đã xuất bản: chỉ sửa được tên và mô tả. Cấu hình dưới đây và ma trận đã khóa.</Notice>
        ) : null}

        <fieldset disabled={khoa} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dt-phut">Thời gian làm bài (phút)</Label>
              <Input
                id="dt-phut"
                name="duration_minutes"
                type="number"
                inputMode="numeric"
                min={5}
                max={240}
                required
                defaultValue={de?.duration_minutes ?? 45}
              />
            </div>
            <div>
              <Label htmlFor="dt-diem">Điểm đạt (thang 100)</Label>
              <Input
                id="dt-diem"
                name="pass_score"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                required
                defaultValue={de?.pass_score ?? 70}
              />
            </div>
            <div>
              <Label htmlFor="dt-lan">Số lần làm tối đa</Label>
              <Input
                id="dt-lan"
                name="max_attempts"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                required
                defaultValue={de?.max_attempts ?? 1}
              />
            </div>
            <div>
              <Label htmlFor="dt-xem">Cho xem đáp án</Label>
              <select
                id="dt-xem"
                name="show_answers"
                defaultValue={de?.show_answers ?? "sau_nop"}
                className={inputClass}
              >
                {Object.entries(TEN_XEM_DAP_AN).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="shuffle_questions"
                defaultChecked={de?.shuffle_questions ?? true}
              />
              Trộn thứ tự câu cho mỗi lượt thi
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="shuffle_options" defaultChecked={de?.shuffle_options ?? true} />
              Đảo thứ tự phương án trong mỗi câu
            </label>
          </div>
        </fieldset>

        <ThanhLuuBieuMau
          loi={actionData && "loi" in actionData ? actionData.loi : null}
          ok={actionData && "ok" in actionData ? actionData.ok : null}
        >
          <Button type="submit" disabled={busy} className="min-h-12 w-full md:w-auto">
            {de ? "Lưu đề thi" : "Tiếp tục: soạn ma trận"}
          </Button>
        </ThanhLuuBieuMau>
      </Form>
    </section>
  );
}

const TEN_TRANG_THAI_VIEC: Record<ViecSinhCuaDe["state"], string> = {
  cho: "Đang chờ",
  dang_chay: "Đang sinh",
  xong: "Xong",
  loi: "Lỗi",
  huy: "Đã hủy",
};

/**
 * Khung câu hỏi AI của đề: tiến độ đọc bản quét và sinh câu, nút chạy tiếp khi lỗi, danh sách câu
 * chờ duyệt kèm đáp án (từ chối được từng câu) và nút duyệt hết rồi xuất bản. Đề chỉ xuất bản
 * được khi đủ câu đã duyệt; API kiểm lại điều đó.
 */
function KhungCauAi({
  tienDo,
  viec,
  choDuyet,
  daXuatBan,
  busy,
}: {
  tienDo: TienDoSinhDe;
  viec: ViecSinhCuaDe[];
  choDuyet: CauChoDuyet[];
  daXuatBan: boolean;
  busy: boolean;
}) {
  const doc = tienDo.doc_pdf;
  let buoc: string;
  let phanTram: number | null = null;
  if (doc?.state === "loi") buoc = "Chưa đọc xong tệp PDF.";
  else if (doc && doc.state !== "xong") {
    buoc = doc.so_cum
      ? `AI đang đọc bản quét ${doc.so_trang} trang: xong ${doc.cum_xong}/${doc.so_cum} cụm trang.`
      : `AI đang đọc bản quét ${doc.so_trang} trang.`;
    phanTram = doc.so_cum ? Math.round((doc.cum_xong / doc.so_cum) * 100) : null;
  } else if (tienDo.dang_chay) {
    buoc = `AI đang sinh câu hỏi: xong ${tienDo.xong}/${tienDo.so_viec} lượt.`;
    phanTram = tienDo.so_viec ? Math.round((tienDo.xong / tienDo.so_viec) * 100) : null;
  } else if (tienDo.con_loi) {
    buoc = `AI đã sinh xong ${tienDo.xong}/${tienDo.so_viec} lượt, phần còn lại bị lỗi.`;
  } else if (daXuatBan) {
    buoc = "Câu hỏi của đề do AI sinh và đã được duyệt.";
  } else if (choDuyet.length) {
    buoc = `AI đã sinh xong, còn ${choDuyet.length} câu chờ duyệt. Xem lướt các câu bên dưới, từ chối câu sai, rồi duyệt và xuất bản.`;
  } else {
    buoc = "AI đã sinh xong và không còn câu nào chờ duyệt.";
  }

  return (
    <section aria-labelledby="cau-ai" className="mt-4 rounded-card border border-line bg-surface p-4">
      <h3 id="cau-ai" className="font-sans text-base font-semibold">
        Câu hỏi AI sinh cho đề này
      </h3>
      <p className="mt-1 text-sm text-ink-2" aria-live="polite">
        {buoc}
      </p>
      {tienDo.dang_chay ? (
        <progress
          className="mt-3 h-2 w-full"
          {...(phanTram === null ? {} : { value: phanTram, max: 100 })}
          aria-label="Tiến độ AI sinh câu hỏi"
        />
      ) : null}
      {doc && doc.so_cho_khong_doc > 0 ? (
        <p className="mt-2 text-sm text-danger">
          Bản quét có {doc.so_cho_khong_doc} chỗ AI không đọc được. Hãy soát lại văn bản ở mục Văn bản.
        </p>
      ) : null}

      {tienDo.con_loi && !tienDo.dang_chay ? (
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="sinh_tiep" />
          <Notice tone="danger">
            {tienDo.loi > 0 ? `${tienDo.loi} lượt sinh bị lỗi. ` : ""}
            {tienDo.loi_dau ?? "Việc sinh câu hỏi bị lỗi."}
          </Notice>
          {doc?.state === "loi" ? (
            <div className="max-w-xs">
              <Label htmlFor="td-so-ky-hieu">Số ký hiệu văn bản (nếu AI không đọc được)</Label>
              <Input id="td-so-ky-hieu" name="so_ky_hieu" placeholder="12/2026/TT-BCA" maxLength={100} />
            </div>
          ) : null}
          <Button type="submit" variant="secondary" disabled={busy}>
            Chạy tiếp
          </Button>
        </Form>
      ) : null}

      {choDuyet.length && !tienDo.dang_chay && !daXuatBan ? (
        <>
          <Form method="post" className="mt-3">
            <input type="hidden" name="intent" value="duyet_xuat_ban" />
            <Button type="submit" disabled={busy}>
              Duyệt {choDuyet.length} câu và xuất bản đề
            </Button>
          </Form>
          <details open className="mt-3 rounded-btn border border-line px-3">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">
              {choDuyet.length} câu chờ duyệt, kèm đáp án
            </summary>
            <ol className="space-y-5 pb-3">
              {choDuyet.map((c, i) => (
                <li key={c.question_id}>
                  <p className="mb-1 text-sm font-semibold text-ink-3">
                    Câu {i + 1} · <span className="font-mono">{c.code}</span> ·{" "}
                    {c.kind === "tu_luan" ? "Tự luận" : "Trắc nghiệm"} · {TEN_MUC_DO[c.level]}
                  </p>
                  <HienThiCauHoi
                    de={c.de}
                    traLoi={traLoiDung(c.noi_dung.answer)}
                    ketQua={{
                      dung: true,
                      ty_le: 1,
                      dap_an: c.noi_dung.answer,
                      giai_thich: c.noi_dung.explanation,
                      can_cu: [],
                    }}
                    khoa
                    idGoc={`cd-${i}`}
                  />
                  <details className="mt-1">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-danger">
                      Từ chối câu này
                    </summary>
                    <Form method="post" className="flex flex-wrap items-end gap-2 pb-2">
                      <input type="hidden" name="intent" value="tu_choi" />
                      <input type="hidden" name="id" value={c.question_id} />
                      <input type="hidden" name="code" value={c.code} />
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`ly-do-${c.question_id}`}>Lý do từ chối</Label>
                        <Input
                          id={`ly-do-${c.question_id}`}
                          name="ly_do"
                          required
                          minLength={3}
                          maxLength={1000}
                        />
                      </div>
                      <Button type="submit" variant="secondary" disabled={busy}>
                        Từ chối
                      </Button>
                    </Form>
                  </details>
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : null}

      {viec.length ? (
        <details className="mt-3">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink-2">
            Chi tiết {viec.length} lượt sinh
          </summary>
          <ul className="divide-y divide-line text-sm">
            {viec.map((v) => {
              const tuLuan = (v.input.loai ?? []).includes("tu_luan");
              const muc = v.input.muc_do ? TEN_MUC_DO[v.input.muc_do as MucDoCauHoi] : "Trộn mức";
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{tuLuan ? "Tự luận" : "Trắc nghiệm"}</span> · {muc} ·{" "}
                    <span className={cn(v.state === "loi" ? "text-danger" : "text-ink-2")}>
                      {TEN_TRANG_THAI_VIEC[v.state]}
                    </span>
                    {v.error ? <span className="block text-sm text-danger">{v.error}</span> : null}
                  </span>
                  <span className="flex items-center gap-3 text-sm text-ink-2">
                    <span>
                      {v.so_cau} câu sinh · {v.so_cho_duyet} chờ duyệt · {v.so_da_duyet} đã duyệt
                    </span>
                    {v.so_cho_duyet ? (
                      <Link
                        to={`/quan-tri/cau-hoi?tab=cho-duyet&viec=${v.id}`}
                        className="inline-flex min-h-11 items-center font-medium text-primary underline"
                      >
                        Mở ở ngân hàng
                      </Link>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
