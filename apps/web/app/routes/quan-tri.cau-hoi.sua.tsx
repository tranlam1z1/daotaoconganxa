/**
 * Soạn và sửa một câu hỏi (docs/PLAN.md GĐ3): /quan-tri/cau-hoi/moi và /quan-tri/cau-hoi/:id.
 *
 * Biểu mẫu thay đổi theo loại câu; phần "Xem trước" dựng bằng chính `HienThiCauHoi` mà người
 * học sẽ thấy, cập nhật ngay khi gõ. Với câu đã lưu, "Kiểm tra" gửi câu trả lời thử lên API để
 * chấm bằng đúng thuật toán của luyện tập và thi.
 *
 * Luật hợp lệ nằm ở API (@qdpl/dao-tao); biểu mẫu chỉ gom dữ liệu và hiện lại lỗi API trả về.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useFetcher,
  useNavigation,
} from "react-router";
import { HienThiCauHoi } from "../components/cau-hoi/HienThiCauHoi";
import { SuaRubric } from "../components/cau-hoi/SuaRubric";
import { Badge } from "../components/ui/Badge";
import { Button, buttonClass } from "../components/ui/Button";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { cn } from "../lib/cn";
import { urlAnhBienBao } from "../lib/du-lieu-tra-cuu";
import { formatNgayGio } from "../lib/format";
import {
  type CauHoi,
  type ChuDeCauHoi,
  type DapAnCauHoi,
  type DeCauHoi,
  type KetQuaCauHoi,
  type LoaiCauHoi,
  type LuaChonCauHoi,
  laRubric,
  type MucDoCauHoi,
  O_TRONG_RE,
  RUBRIC_TU_LUAN_MAC_DINH,
  type Rubric,
  sapXepCayChuDe,
  TEN_HANH_DONG,
  TEN_LOAI,
  TEN_MUC_DO,
  TEN_TRANG_THAI,
  TONE_TRANG_THAI,
  type TraLoiCauHoi,
} from "../lib/ngan-hang";
import { ghiNganHang } from "../lib/ngan-hang.server";
import { goiApiQuanTri, khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, type VaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.cau-hoi.sua";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.cauHoi ? `Câu hỏi ${data.cauHoi.code}` : "Thêm câu hỏi", { index: false });
}

const API = "/v1/quan-tri/ngan-hang";

interface ChiTietCauHoi extends CauHoi {
  lich_su: Array<{
    id: string;
    version: number;
    action: string;
    actor: string;
    note: string | null;
    created_at: string;
  }>;
  de: DeCauHoi;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const id = params.id;
  const [chuDe, cauHoi, ds, bien] = await Promise.all([
    goiApiQuanTri<{ items: ChuDeCauHoi[] }>(token, `${API}/chu-de`),
    id
      ? goiApiQuanTri<ChiTietCauHoi>(token, `${API}/cau-hoi/${id}`).catch(khongTimThay)
      : Promise.resolve(null),
    // Chỉ cần vai trò được duyệt; lấy một câu cho nhẹ.
    goiApiQuanTri<{ vai_tro_duyet: VaiTro }>(token, `${API}/cau-hoi?co=1`),
    // Danh mục biển báo, cho ô chọn ảnh minh họa.
    goiApiQuanTri<{ items: Array<{ code: string; name: string; image_uri: string | null }> }>(
      token,
      "/v1/quan-tri/du-lieu-tra-cuu/bien-bao",
    ),
  ]);
  return {
    chuDe: sapXepCayChuDe(chuDe.items, { giu: cauHoi?.topic_code }),
    cauHoi,
    coTheDuyet: duVaiTro(nguoiDung, ds.vai_tro_duyet),
    bien: bien.items.flatMap((b) => (b.image_uri ? [{ ma: b.code, ten: b.name, anh: b.image_uri }] : [])),
  };
}

/** Tải ảnh minh họa không đổi câu hỏi đã lưu: không tải lại, kẻo biểu mẫu đang sửa dở bị đặt về bản đã lưu. */
type BienChon = { ma: string; ten: string; anh: string };

export function shouldRevalidate({ formData, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formData?.get("intent") === "tai-anh" ? false : defaultShouldRevalidate;
}

type KetQuaThaoTac =
  | { loi: string; chiTiet: string[] }
  | { ok: string }
  | { cham: KetQuaCauHoi }
  | { anh: string }
  | undefined;

export async function action({ request, params }: Route.ActionArgs): Promise<KetQuaThaoTac | Response> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "");
  const id = params.id;
  const json = (k: string) => JSON.parse(String(f.get(k) ?? "{}"));

  const loiHoac = <T,>(
    r: Awaited<ReturnType<typeof ghiNganHang<T>>>,
    ok: (d: T) => KetQuaThaoTac | Response,
  ) => (r.ok ? ok(r.data) : { loi: r.loi, chiTiet: r.chiTiet });

  if (intent === "tai-anh") {
    const form = new FormData();
    const tep = f.get("tep");
    if (tep) form.set("tep", tep);
    try {
      const d = await goiApiQuanTri<{ image_uri: string }>(token, `${API}/cau-hoi/anh`, { form });
      return { anh: d.image_uri };
    } catch (e) {
      if (e instanceof LoiApi) return { loi: e.message, chiTiet: [] };
      throw e;
    }
  }
  if (intent === "luu" || intent === "luu-gui-duyet") {
    const duLieu = json("du_lieu");
    if (!id) {
      const r = await ghiNganHang<{ id: string }>(token, "/cau-hoi", {
        body: { ...duLieu, gui_duyet: intent === "luu-gui-duyet" },
      });
      return loiHoac(r, (d) => redirect(`/quan-tri/cau-hoi/${d.id}`));
    }
    const r = await ghiNganHang<CauHoi>(token, `/cau-hoi/${id}`, { method: "PUT", body: duLieu });
    return loiHoac(r, (d) => ({
      ok:
        d.status === "cho_duyet" && d.version > Number(duLieu.version)
          ? "Đã lưu. Câu quay về chờ duyệt."
          : "Đã lưu.",
    }));
  }
  if (!id) return { loi: "Hãy lưu câu hỏi trước.", chiTiet: [] };
  if (intent === "cham") {
    return loiHoac(
      await ghiNganHang<KetQuaCauHoi>(token, `/cau-hoi/${id}/cham`, { body: json("tra_loi") }),
      (d) => ({
        cham: d,
      }),
    );
  }
  const DUONG: Record<string, string> = {
    "gui-duyet": "gui-duyet",
    duyet: "duyet",
    "tu-choi": "tu-choi",
    "luu-tru": "luu-tru",
  };
  const OK: Record<string, string> = {
    "gui-duyet": "Đã gửi duyệt.",
    duyet: "Đã duyệt. Câu được dùng cho luyện tập và thi.",
    "tu-choi": "Đã từ chối.",
    "luu-tru": "Đã lưu trữ. Câu không còn được rút cho người học.",
  };
  if (!DUONG[intent]) return { loi: "Thao tác không hợp lệ.", chiTiet: [] };
  const body =
    intent === "tu-choi"
      ? { ly_do: String(f.get("ly_do") ?? "") }
      : intent === "duyet"
        ? { xac_nhan_trung: f.get("xac_nhan_trung") === "on" }
        : undefined;
  return loiHoac(await ghiNganHang(token, `/cau-hoi/${id}/${DUONG[intent]}`, { body }), () => ({
    ok: OK[intent]!,
  }));
}

/* ------------------------------------------------------------------ */
/* Trạng thái biểu mẫu                                                 */
/* ------------------------------------------------------------------ */

interface BieuMau {
  topic_code: string;
  level: MucDoCauHoi;
  kind: LoaiCauHoi;
  stem: string;
  explanation: string;
  /** Mỗi dòng một URN. */
  citations: string;
  /** Phương án (một/nhiều đáp án) hoặc các bước theo ĐÚNG thứ tự (sắp xếp). */
  muc: Array<{ text: string; dung: boolean /** Hình của phương án (URI trong kho). */; anh?: string | null }>;
  /** Cặp đúng của câu ghép cặp. */
  cap: Array<{ trai: string; phai: string }>;
  /** Vế phải không ghép với vế trái nào (gây nhiễu), mỗi dòng một mục. */
  phaiThem: string;
  dungSai: "dung" | "sai";
  /** Đáp án từng ô trống, các cách viết ngăn bằng dấu |. */
  oTrong: string[];
  /** Tiêu chí chấm của câu tự luận. */
  rubric: Rubric;
  /** Các ảnh minh họa (URI trong kho) theo thứ tự hiển thị: ảnh biển báo trong danh mục hoặc ảnh tải lên. */
  image_uris: string[];
}

const CHU = "abcdefghijkl";

function tuCauHoi(q: CauHoi | null): BieuMau {
  const rong: BieuMau = {
    topic_code: "",
    level: "de",
    kind: "mot_dap_an",
    stem: "",
    explanation: "",
    citations: "",
    muc: [
      { text: "", dung: true },
      { text: "", dung: false },
      { text: "", dung: false },
    ],
    cap: [
      { trai: "", phai: "" },
      { trai: "", phai: "" },
    ],
    phaiThem: "",
    dungSai: "dung",
    oTrong: [],
    rubric: RUBRIC_TU_LUAN_MAC_DINH,
    image_uris: [],
  };
  if (!q) return rong;
  const bm: BieuMau = {
    ...rong,
    topic_code: q.topic_code ?? "",
    level: q.level,
    kind: q.kind,
    stem: q.stem,
    explanation: q.explanation ?? "",
    citations: q.citations.join("\n"),
    image_uris: q.image_uris ?? [],
  };
  const pa = q.options.phuong_an ?? [];
  if (q.kind === "mot_dap_an" || q.kind === "nhieu_dap_an") {
    bm.muc = pa.map((m) => ({
      text: m.text,
      dung: (q.answer.dung ?? []).includes(m.id),
      ...(m.image_uri ? { anh: m.image_uri } : {}),
    }));
  } else if (q.kind === "sap_xep") {
    const theoId = new Map(pa.map((m) => [m.id, m.text]));
    bm.muc = (q.answer.thu_tu ?? []).map((id) => ({ text: theoId.get(id) ?? "", dung: false }));
  } else if (q.kind === "ghep_cap") {
    const phai = new Map((q.options.phai ?? []).map((m) => [m.id, m.text]));
    bm.cap = (q.options.trai ?? []).map((t) => ({
      trai: t.text,
      phai: phai.get(q.answer.cap?.[t.id] ?? "") ?? "",
    }));
    const daGhep = new Set(Object.values(q.answer.cap ?? {}));
    bm.phaiThem = (q.options.phai ?? [])
      .filter((m) => !daGhep.has(m.id))
      .map((m) => m.text)
      .join("\n");
  } else if (q.kind === "dung_sai") {
    bm.dungSai = q.answer.dung?.[0] === "sai" ? "sai" : "dung";
  } else if (q.kind === "dien_khuyet") {
    const o = q.answer.o_trong ?? {};
    bm.oTrong = Object.keys(o)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (o[k] ?? []).join(" | "));
  } else if (q.kind === "tu_luan" && laRubric(q.rubric)) {
    bm.rubric = q.rubric;
  }
  return bm;
}

const soOTrong = (stem: string) => (stem.match(O_TRONG_RE) ?? []).length;
const dong = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** Biểu mẫu -> nội dung gửi API. */
function sangNoiDung(bm: BieuMau): { options: LuaChonCauHoi; answer: DapAnCauHoi } {
  // Phương án trắc nghiệm được chỉ có hình (câu "chọn một biển trong các biển"); các loại khác phải có chữ.
  const coHinh = bm.kind === "mot_dap_an" || bm.kind === "nhieu_dap_an";
  const muc = bm.muc.filter((m) => m.text.trim() || (coHinh && m.anh));
  switch (bm.kind) {
    case "mot_dap_an":
    case "nhieu_dap_an": {
      const phuong_an = muc.map((m, i) => ({
        id: CHU[i]!,
        text: m.text.trim(),
        ...(m.anh ? { image_uri: m.anh } : {}),
      }));
      return { options: { phuong_an }, answer: { dung: muc.flatMap((m, i) => (m.dung ? [CHU[i]!] : [])) } };
    }
    case "sap_xep": {
      const phuong_an = muc.map((m, i) => ({ id: CHU[i]!, text: m.text.trim() }));
      return { options: { phuong_an }, answer: { thu_tu: phuong_an.map((m) => m.id) } };
    }
    case "ghep_cap": {
      const trai: Array<{ id: string; text: string }> = [];
      const phai: Array<{ id: string; text: string }> = [];
      const cap: Record<string, string> = {};
      const idPhai = (text: string) => {
        let p = phai.find((m) => m.text.toLowerCase() === text.toLowerCase());
        if (!p) {
          p = { id: `p${phai.length + 1}`, text };
          phai.push(p);
        }
        return p.id;
      };
      bm.cap
        .filter((c) => c.trai.trim() || c.phai.trim())
        .forEach((c, i) => {
          trai.push({ id: `t${i + 1}`, text: c.trai.trim() });
          cap[`t${i + 1}`] = idPhai(c.phai.trim());
        });
      for (const t of dong(bm.phaiThem)) idPhai(t);
      return { options: { trai, phai }, answer: { cap } };
    }
    case "dung_sai":
      return { options: {}, answer: { dung: [bm.dungSai] } };
    case "dien_khuyet": {
      const o_trong: Record<string, string[]> = {};
      for (let i = 0; i < soOTrong(bm.stem); i++) {
        o_trong[String(i + 1)] = (bm.oTrong[i] ?? "")
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return { options: {}, answer: { o_trong } };
    }
    case "tu_luan":
      return { options: {}, answer: {} };
  }
}

/** Đề như người học nhận, dựng ngay trên máy để xem trước khi chưa lưu (khớp deChoNguoiHoc). */
function deXemTruoc(bm: BieuMau): DeCauHoi {
  const { options } = sangNoiDung(bm);
  const theoChu = (ds?: Array<{ id: string; text: string }>) =>
    ds ? [...ds].sort((a, b) => a.text.localeCompare(b.text, "vi")) : ds;
  if (bm.kind === "dung_sai") {
    return {
      kind: bm.kind,
      stem: bm.stem,
      options: {
        phuong_an: [
          { id: "dung", text: "Đúng" },
          { id: "sai", text: "Sai" },
        ],
      },
    };
  }
  if (bm.kind === "ghep_cap")
    return { kind: bm.kind, stem: bm.stem, options: { ...options, phai: theoChu(options.phai) } };
  if (bm.kind === "sap_xep")
    return { kind: bm.kind, stem: bm.stem, options: { phuong_an: theoChu(options.phuong_an) } };
  if (bm.kind === "dien_khuyet")
    return { kind: bm.kind, stem: bm.stem, options: {}, so_o_trong: soOTrong(bm.stem) };
  if (bm.kind === "tu_luan") return { kind: bm.kind, stem: bm.stem, options: {} };
  return { kind: bm.kind, stem: bm.stem, options };
}

/* ------------------------------------------------------------------ */
/* Trang                                                               */
/* ------------------------------------------------------------------ */

export default function SuaCauHoi({ loaderData, actionData }: Route.ComponentProps) {
  const { chuDe, cauHoi, coTheDuyet, bien } = loaderData;
  const busy = useNavigation().state !== "idle";
  const goc = useMemo(() => tuCauHoi(cauHoi), [cauHoi]);
  const [bm, datBm] = useState<BieuMau>(goc);
  // Tải lại sau khi lưu: bắt đầu từ dữ liệu mới của máy chủ.
  useEffect(() => datBm(goc), [goc]);
  const doi = <K extends keyof BieuMau>(k: K, v: BieuMau[K]) => datBm((s) => ({ ...s, [k]: v }));
  const daSua = JSON.stringify(bm) !== JSON.stringify(goc);

  const noiDung = sangNoiDung(bm);
  const duLieu = {
    ...(cauHoi ? { version: cauHoi.version } : {}),
    topic_code: bm.topic_code || null,
    level: bm.level,
    kind: bm.kind,
    stem: bm.stem,
    options: noiDung.options,
    answer: noiDung.answer,
    explanation: bm.explanation || null,
    citations: dong(bm.citations),
    image_uris: bm.image_uris,
    ...(bm.kind === "tu_luan" ? { rubric: bm.rubric } : {}),
  };
  const khongSua = cauHoi?.status === "luu_tru";
  const tuLuan = bm.kind === "tu_luan";

  return (
    <section>
      <p className="hidden text-sm md:block">
        <Link to="/quan-tri/cau-hoi" className="inline-flex min-h-11 items-center text-primary underline">
          Ngân hàng câu hỏi
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
          {cauHoi ? `Câu hỏi ${cauHoi.code}` : "Thêm câu hỏi"}
        </TieuDeTrang>
        {cauHoi ? <Badge tone={TONE_TRANG_THAI[cauHoi.status]}>{TEN_TRANG_THAI[cauHoi.status]}</Badge> : null}
        {cauHoi && cauHoi.version > 1 ? (
          <span className="text-sm text-ink-2">phiên bản {cauHoi.version}</span>
        ) : null}
      </div>

      {actionData && "loi" in actionData ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
          {actionData.chiTiet.length ? (
            <ul className="mt-1 list-disc pl-5">
              {actionData.chiTiet.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData ? <Notice className="mt-4">{actionData.ok}</Notice> : null}
      {cauHoi?.status === "tu_choi" && cauHoi.reject_reason ? (
        <Notice tone="danger" className="mt-4">
          Lý do từ chối: {cauHoi.reject_reason}
        </Notice>
      ) : null}
      {cauHoi?.status === "da_duyet" ? (
        <Notice className="mt-4">Câu đã duyệt. Nếu sửa, câu quay về chờ duyệt và tăng phiên bản.</Notice>
      ) : null}
      {cauHoi?.source === "ai" && cauHoi.status === "cho_duyet" ? (
        <Notice className="mt-4">
          Câu do AI sinh. Đối chiếu đáp án và giải thích với nguyên văn căn cứ trước khi duyệt.
        </Notice>
      ) : null}
      {cauHoi?.duplicate_of ? (
        <Notice className="mt-4">
          Câu này gần giống câu{" "}
          <Link to={`/quan-tri/cau-hoi/${cauHoi.duplicate_of}`} className="font-semibold underline">
            {cauHoi.duplicate_code ?? "đã có"}
          </Link>{" "}
          trong ngân hàng. Xem lại trước khi duyệt; nếu trùng ý thì từ chối.
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-8 xl:grid-cols-2">
        <fieldset disabled={khongSua} className="grid min-w-0 content-start gap-4">
          <legend className="sr-only">Nội dung câu hỏi</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="loai">Loại câu</Label>
              <select
                id="loai"
                value={bm.kind}
                onChange={(e) => doi("kind", e.target.value as LoaiCauHoi)}
                className={inputClass}
              >
                {Object.entries(TEN_LOAI).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="muc-do">Mức độ</Label>
              <select
                id="muc-do"
                value={bm.level}
                onChange={(e) => doi("level", e.target.value as MucDoCauHoi)}
                className={inputClass}
              >
                {Object.entries(TEN_MUC_DO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="chu-de">Chủ đề</Label>
            <select
              id="chu-de"
              value={bm.topic_code}
              onChange={(e) => doi("topic_code", e.target.value)}
              className={inputClass}
            >
              <option value="">Chưa chọn</option>
              {chuDe.map((t) => (
                <option key={t.id} value={t.code}>
                  {"  ".repeat(t.cap)}
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="de">Câu hỏi</Label>
            <textarea
              id="de"
              rows={4}
              value={bm.stem}
              onChange={(e) => doi("stem", e.target.value)}
              className={cn(inputClass, "py-2 leading-relaxed")}
            />
            {bm.kind === "dien_khuyet" ? (
              <p className="mt-1 text-sm text-ink-2">Mỗi ô trống viết bằng ba dấu gạch dưới: ___</p>
            ) : null}
            {tuLuan ? (
              <p className="mt-1 text-sm text-ink-2">
                Câu tự luận chỉ dùng trong đề thi. Nên viết thành tình huống cụ thể, kết thúc bằng yêu cầu rõ
                ràng (ví dụ: nêu căn cứ và hướng xử lý).
              </p>
            ) : null}
          </div>

          <PhanAnh ds={bm.image_uris} doi={(ds) => doi("image_uris", ds)} bien={bien} />

          <PhanDapAn bm={bm} doi={doi} bien={bien} />

          <div>
            <Label htmlFor="giai-thich">{tuLuan ? "Đáp án gợi ý" : "Giải thích"}</Label>
            <textarea
              id="giai-thich"
              rows={tuLuan ? 6 : 3}
              value={bm.explanation}
              onChange={(e) => doi("explanation", e.target.value)}
              placeholder={
                tuLuan
                  ? "Dàn ý các ý cần có, mỗi ý kèm điều, khoản quy định. Người thi thấy sau khi nộp nếu đề cho xem đáp án; mô hình chấm không thấy."
                  : "Một đến hai câu nêu vì sao đáp án đúng, kèm điều, khoản làm căn cứ."
              }
              className={cn(inputClass, "py-2 leading-relaxed")}
            />
          </div>
          <div>
            <Label htmlFor="can-cu">Căn cứ (mỗi dòng một URN)</Label>
            <textarea
              id="can-cu"
              rows={2}
              value={bm.citations}
              onChange={(e) => doi("citations", e.target.value)}
              placeholder="vn:vbqppl:l:36/2024/QH15"
              className={cn(inputClass, "py-2 font-mono text-sm")}
            />
          </div>

          <ThanhLuuBieuMau
            loi={actionData && "loi" in actionData ? actionData.loi : null}
            ok={actionData && "ok" in actionData ? actionData.ok : null}
          >
            <Form method="post" className="flex flex-col gap-2 md:flex-row md:flex-wrap">
              <input type="hidden" name="du_lieu" value={JSON.stringify(duLieu)} />
              <Button type="submit" name="intent" value="luu" disabled={busy || (Boolean(cauHoi) && !daSua)}>
                {cauHoi ? "Lưu thay đổi" : "Lưu nháp"}
              </Button>
              {!cauHoi ? (
                <Button type="submit" name="intent" value="luu-gui-duyet" variant="secondary" disabled={busy}>
                  Lưu và gửi duyệt
                </Button>
              ) : null}
            </Form>
          </ThanhLuuBieuMau>
        </fieldset>

        <div className="min-w-0">
          <XemTruoc
            de={{ ...deXemTruoc(bm), ...(bm.image_uris.length ? { image_uris: bm.image_uris } : {}) }}
            coTheCham={Boolean(cauHoi) && !daSua && !tuLuan}
          />
          {cauHoi ? <ThaoTac cauHoi={cauHoi} coTheDuyet={coTheDuyet} busy={busy} daSua={daSua} /> : null}
          {cauHoi ? <LichSu lichSu={cauHoi.lich_su} /> : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Ô chọn một ảnh trong kho ảnh biển báo: chọn một biển trong danh mục, hoặc tải ảnh lên. Ảnh tải lên
 * được cất ngay (intent "tai-anh"); câu hỏi chỉ nhận ảnh khi lưu.
 */
function ChonAnh({
  id,
  anh,
  doi,
  bien,
}: {
  id: string;
  anh: string | null;
  doi: (uri: string | null) => void;
  bien: readonly BienChon[];
}) {
  const tai = useFetcher<KetQuaThaoTac>();
  // Theo `tai.data` chứ không theo URI: tải lại đúng tệp cũ (cùng URI) vẫn phải nhận.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ nhận ảnh một lần khi vừa tải xong
  useEffect(() => {
    if (tai.data && "anh" in tai.data) doi(tai.data.anh);
  }, [tai.data]);
  const loi = tai.data && "loi" in tai.data ? tai.data.loi : null;

  return (
    <div className="grid gap-2">
      {anh ? (
        <div className="flex flex-wrap items-center gap-3">
          <img
            src={urlAnhBienBao(anh)}
            alt="Ảnh đang chọn"
            className="size-24 rounded-btn border border-line bg-white object-contain p-1"
          />
          <Button variant="secondary" onClick={() => doi(null)}>
            Bỏ ảnh
          </Button>
        </div>
      ) : null}
      <div>
        <Label htmlFor={`${id}-bien`}>Chọn biển báo trong danh mục</Label>
        <select
          id={`${id}-bien`}
          value={anh && bien.some((b) => b.anh === anh) ? anh : ""}
          onChange={(e) => doi(e.target.value || null)}
          className={inputClass}
        >
          <option value="">Chưa chọn</option>
          {bien.map((b) => (
            <option key={b.ma} value={b.anh}>
              {b.ma} · {b.ten}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${id}-tep`}>Hoặc tải ảnh lên (SVG, PNG, WebP; tối đa 2 MB)</Label>
        <input
          id={`${id}-tep`}
          type="file"
          accept=".svg,.png,.webp"
          disabled={tai.state !== "idle"}
          onChange={(e) => {
            const tep = e.target.files?.[0];
            if (!tep) return;
            const f = new FormData();
            f.set("intent", "tai-anh");
            f.set("tep", tep);
            tai.submit(f, { method: "post", encType: "multipart/form-data" });
            e.target.value = "";
          }}
          className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-line-strong file:bg-surface file:px-3"
        />
        {tai.state !== "idle" ? <p className="mt-1 text-sm text-ink-2">Đang tải ảnh lên…</p> : null}
        {loi ? <p className="mt-1 text-sm text-danger">{loi}</p> : null}
      </div>
    </div>
  );
}

/** Số ảnh minh họa tối đa của một câu, khớp giới hạn của API. */
const ANH_TOI_DA = 8;

/** Danh sách mới với hai phần tử ở vị trí `i` và `j` đổi chỗ cho nhau. */
function doiCho(ds: readonly string[], i: number, j: number): string[] {
  return ds.map((x, k) => (k === i ? ds[j]! : k === j ? ds[i]! : x));
}

/**
 * Các ảnh minh họa của câu hỏi, cho mọi loại câu: hiện ngay dưới câu hỏi theo thứ tự, có từ hai ảnh thì
 * đánh số "Hình 1", "Hình 2"… để câu hỏi và phương án gọi tên (câu về biển báo giao thông).
 */
function PhanAnh({
  ds,
  doi,
  bien,
}: {
  ds: readonly string[];
  doi: (ds: string[]) => void;
  bien: readonly BienChon[];
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1.5 text-sm font-medium text-ink-2">
        Ảnh minh họa (không bắt buộc, tối đa {ANH_TOI_DA} ảnh)
      </legend>
      <p className="text-sm text-ink-2">
        Dùng khi câu hỏi cần hình, ví dụ câu về biển báo giao thông. Ảnh hiện ngay dưới câu hỏi. Có từ hai ảnh
        thì mỗi ảnh được đánh số "Hình 1", "Hình 2"… để câu hỏi và phương án gọi tên.
      </p>
      {ds.length ? (
        <ul className="flex flex-wrap items-end gap-3">
          {ds.map((uri, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: ảnh xác định theo thứ tự, một ảnh có thể lặp
            <li key={i} className="grid justify-items-center gap-1 text-sm">
              <img
                src={urlAnhBienBao(uri)}
                alt={`Hình ${i + 1}`}
                className="size-24 rounded-btn border border-line bg-white object-contain p-1"
              />
              Hình {i + 1}
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i === 0}
                  aria-label={`Đưa Hình ${i + 1} lên trước`}
                  onClick={() => doi(doiCho(ds, i, i - 1))}
                >
                  <Icon name="arrowLeft" className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i === ds.length - 1}
                  aria-label={`Đưa Hình ${i + 1} ra sau`}
                  onClick={() => doi(doiCho(ds, i, i + 1))}
                >
                  <Icon name="arrowRight" className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => doi(ds.filter((_, j) => j !== i))}>
                  Bỏ ảnh
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {ds.length < ANH_TOI_DA ? (
        <ChonAnh
          id="anh-de"
          anh={null}
          doi={(uri) => {
            if (uri) doi([...ds, uri]);
          }}
          bien={bien}
        />
      ) : null}
    </fieldset>
  );
}

function PhanDapAn({
  bm,
  doi,
  bien,
}: {
  bm: BieuMau;
  doi: <K extends keyof BieuMau>(k: K, v: BieuMau[K]) => void;
  bien: readonly BienChon[];
}) {
  // Câu "chọn một biển trong các biển": mỗi phương án một hình. Câu đã có hình thì mở sẵn.
  const [hinh, datHinh] = useState(() => bm.muc.some((m) => m.anh));
  if (bm.kind === "tu_luan") return <SuaRubric rubric={bm.rubric} onChange={(r) => doi("rubric", r)} />;

  if (bm.kind === "dung_sai") {
    return (
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-2">Đáp án</legend>
        <div className="flex gap-4">
          {(["dung", "sai"] as const).map((v) => (
            <label key={v} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="dung-sai"
                checked={bm.dungSai === v}
                onChange={() => doi("dungSai", v)}
                className="size-5"
              />
              {v === "dung" ? "Đúng" : "Sai"}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (bm.kind === "dien_khuyet") {
    const n = soOTrong(bm.stem);
    if (!n) return <p className="text-sm text-ink-2">Câu hỏi chưa có ô trống nào.</p>;
    return (
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-2">
          Đáp án từng ô (nhiều cách viết được chấp nhận thì ngăn bằng dấu |)
        </legend>
        {Array.from({ length: n }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ô trống xác định theo vị trí trong đề
          <div key={i} className="flex items-center gap-2">
            <label htmlFor={`o-${i}`} className="w-14 shrink-0 text-sm">
              Ô {i + 1}
            </label>
            <Input
              id={`o-${i}`}
              value={bm.oTrong[i] ?? ""}
              onChange={(e) => {
                const moi = [...bm.oTrong];
                moi[i] = e.target.value;
                doi("oTrong", moi);
              }}
            />
          </div>
        ))}
      </fieldset>
    );
  }

  if (bm.kind === "ghep_cap") {
    return (
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-2">
          Các cặp đúng (người học sẽ thấy vế phải xếp lại theo chữ cái)
        </legend>
        {bm.cap.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dòng nhập theo vị trí, chưa có id
          <div key={i} className="grid gap-2 rounded-btn border border-line p-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              aria-label={`Vế trái cặp ${i + 1}`}
              placeholder="Vế trái"
              value={c.trai}
              onChange={(e) =>
                doi(
                  "cap",
                  bm.cap.map((x, j) => (j === i ? { ...x, trai: e.target.value } : x)),
                )
              }
            />
            <Input
              aria-label={`Vế phải cặp ${i + 1}`}
              placeholder="Vế phải"
              value={c.phai}
              onChange={(e) =>
                doi(
                  "cap",
                  bm.cap.map((x, j) => (j === i ? { ...x, phai: e.target.value } : x)),
                )
              }
            />
            <Button
              variant="ghost"
              onClick={() =>
                doi(
                  "cap",
                  bm.cap.filter((_, j) => j !== i),
                )
              }
              disabled={bm.cap.length <= 2}
            >
              Bỏ
            </Button>
          </div>
        ))}
        <Button variant="secondary" onClick={() => doi("cap", [...bm.cap, { trai: "", phai: "" }])}>
          Thêm cặp
        </Button>
        <Label htmlFor="phai-them" className="mt-2">
          Vế phải gây nhiễu (không bắt buộc, mỗi dòng một mục)
        </Label>
        <textarea
          id="phai-them"
          rows={2}
          value={bm.phaiThem}
          onChange={(e) => doi("phaiThem", e.target.value)}
          className={cn(inputClass, "py-2")}
        />
      </fieldset>
    );
  }

  const sapXep = bm.kind === "sap_xep";
  const nhieu = bm.kind === "nhieu_dap_an";
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-2">
        {sapXep
          ? "Các bước, nhập theo ĐÚNG thứ tự (người học sẽ thấy xếp lại theo chữ cái)"
          : nhieu
            ? "Phương án; đánh dấu mọi đáp án đúng"
            : "Phương án; chọn một đáp án đúng"}
      </legend>
      {sapXep ? null : (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={hinh}
            onChange={(e) => {
              datHinh(e.target.checked);
              // Tắt thì bỏ hình đã chọn, kẻo hình ẩn vẫn được lưu.
              if (!e.target.checked)
                doi(
                  "muc",
                  bm.muc.map(({ anh: _, ...x }) => x),
                );
            }}
          />
          Mỗi phương án là một hình (ví dụ: chọn một biển trong các biển báo)
        </label>
      )}
      {bm.muc.map((m, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: dòng nhập theo vị trí, chưa có id
        <div key={i} className={cn(hinh && !sapXep && "grid gap-2 rounded-btn border border-line p-2")}>
          <div className="flex items-center gap-2">
            {sapXep ? (
              <span className="w-8 shrink-0 text-center font-semibold">{i + 1}.</span>
            ) : (
              // Vùng chạm 44×44 quanh ô chọn nhỏ.
              <label className="-m-3 grid size-11 shrink-0 cursor-pointer place-items-center">
                <input
                  type={nhieu ? "checkbox" : "radio"}
                  name="dap-an-dung"
                  checked={m.dung}
                  aria-label={`Phương án ${CHU[i]?.toUpperCase()} là đáp án đúng`}
                  onChange={() =>
                    doi(
                      "muc",
                      bm.muc.map((x, j) =>
                        nhieu ? (j === i ? { ...x, dung: !x.dung } : x) : { ...x, dung: j === i },
                      ),
                    )
                  }
                  className="size-5 shrink-0"
                />
              </label>
            )}
            <Input
              aria-label={sapXep ? `Bước ${i + 1}` : `Phương án ${CHU[i]?.toUpperCase()}`}
              placeholder={hinh && !sapXep ? "Chữ kèm hình (không bắt buộc)" : undefined}
              value={m.text}
              onChange={(e) =>
                doi(
                  "muc",
                  bm.muc.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                )
              }
            />
            <Button
              variant="ghost"
              onClick={() =>
                doi(
                  "muc",
                  bm.muc.filter((_, j) => j !== i),
                )
              }
              disabled={bm.muc.length <= 2}
            >
              Bỏ
            </Button>
          </div>
          {hinh && !sapXep ? (
            <ChonAnh
              id={`pa-${i}`}
              anh={m.anh ?? null}
              doi={(uri) =>
                doi(
                  "muc",
                  bm.muc.map((x, j) => (j === i ? { ...x, anh: uri } : x)),
                )
              }
              bien={bien}
            />
          ) : null}
        </div>
      ))}
      {bm.muc.length < 8 ? (
        <Button variant="secondary" onClick={() => doi("muc", [...bm.muc, { text: "", dung: false }])}>
          {sapXep ? "Thêm bước" : "Thêm phương án"}
        </Button>
      ) : null}
    </fieldset>
  );
}

function XemTruoc({ de, coTheCham }: { de: DeCauHoi; coTheCham: boolean }) {
  const fetcher = useFetcher<KetQuaThaoTac>();
  const [traLoi, datTraLoi] = useState<TraLoiCauHoi>({});
  const [daCham, datDaCham] = useState(false);
  const ketQua = daCham && fetcher.data && "cham" in fetcher.data ? fetcher.data.cham : null;
  const loiCham = daCham && fetcher.data && "loi" in fetcher.data ? fetcher.data.loi : null;

  // Đổi loại câu thì câu trả lời thử cũ không còn nghĩa.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ đặt lại khi loại câu đổi
  useEffect(() => {
    datTraLoi({});
    datDaCham(false);
  }, [de.kind]);

  return (
    <section aria-labelledby="xem-truoc" className="rounded-card border border-line bg-canvas p-4">
      <h3 id="xem-truoc" className="font-sans text-base font-semibold">
        Xem trước: người học sẽ thấy
      </h3>
      <div className="mt-3 max-w-[420px]">
        <HienThiCauHoi
          de={de}
          traLoi={traLoi}
          ketQua={ketQua}
          idGoc="xem-truoc"
          onChange={(t) => {
            datTraLoi(t);
            datDaCham(false);
          }}
        />
        {loiCham ? (
          <Notice tone="danger" className="mt-3">
            {loiCham}
          </Notice>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {ketQua ? (
            <Button
              variant="secondary"
              className="min-h-12 w-full"
              onClick={() => {
                datTraLoi({});
                datDaCham(false);
              }}
            >
              Làm lại
            </Button>
          ) : (
            <Button
              className="min-h-12 w-full"
              disabled={!coTheCham || fetcher.state !== "idle"}
              onClick={() => {
                datDaCham(true);
                fetcher.submit({ intent: "cham", tra_loi: JSON.stringify(traLoi) }, { method: "post" });
              }}
            >
              Kiểm tra
            </Button>
          )}
        </div>
        {!coTheCham ? (
          <p className="mt-2 text-sm text-ink-2">
            {de.kind === "tu_luan"
              ? "Câu tự luận được chấm theo tiêu chí khi thi, không kiểm tra thử ở đây."
              : "Lưu câu hỏi để làm thử và xem phản hồi đúng/sai."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ThaoTac({
  cauHoi,
  coTheDuyet,
  busy,
  daSua,
}: {
  cauHoi: ChiTietCauHoi;
  coTheDuyet: boolean;
  busy: boolean;
  daSua: boolean;
}) {
  const s = cauHoi.status;
  const nut = (intent: string, nhan: string, variant: "primary" | "secondary" = "secondary") => (
    <Form method="post">
      {intent === "duyet" && cauHoi.duplicate_of ? (
        <label className="mb-2 flex items-start gap-2 text-sm">
          <input type="checkbox" name="xac_nhan_trung" required className="mt-1" />
          Đã đối chiếu với {cauHoi.duplicate_code ?? "câu gần giống"}, không trùng ý
        </label>
      ) : null}
      <Button type="submit" name="intent" value={intent} variant={variant} disabled={busy || daSua}>
        {nhan}
      </Button>
    </Form>
  );
  return (
    <section aria-labelledby="thao-tac" className="mt-6">
      <h3 id="thao-tac" className="font-sans text-base font-semibold">
        Duyệt
      </h3>
      {daSua ? <p className="mt-1 text-sm text-ink-2">Lưu thay đổi trước khi gửi duyệt hoặc duyệt.</p> : null}
      <div className="mt-2 flex flex-wrap items-start gap-2">
        {s === "nhap" || s === "tu_choi" ? nut("gui-duyet", "Gửi duyệt", "primary") : null}
        {s === "cho_duyet" && coTheDuyet ? nut("duyet", "Duyệt", "primary") : null}
        {s === "cho_duyet" && coTheDuyet ? (
          <details className="w-full sm:w-auto">
            <summary className={buttonClass({ variant: "secondary", className: "cursor-pointer list-none" })}>
              Từ chối
            </summary>
            <Form method="post" className="mt-2 flex flex-col gap-2">
              <Label htmlFor="ly-do">Lý do từ chối</Label>
              <textarea
                id="ly-do"
                name="ly_do"
                required
                minLength={3}
                rows={2}
                className={cn(inputClass, "py-2")}
              />
              <Button type="submit" name="intent" value="tu-choi" disabled={busy}>
                Gửi từ chối
              </Button>
            </Form>
          </details>
        ) : null}
        {s === "cho_duyet" && !coTheDuyet ? (
          <p className="text-sm text-ink-2">Câu đang chờ người có quyền duyệt.</p>
        ) : null}
        {s === "nhap" || s === "tu_choi" || s === "da_duyet" ? nut("luu-tru", "Lưu trữ") : null}
        {s === "luu_tru" ? <p className="text-sm text-ink-2">Câu đã lưu trữ, không sửa được.</p> : null}
      </div>
    </section>
  );
}

function LichSu({ lichSu }: { lichSu: ChiTietCauHoi["lich_su"] }) {
  if (!lichSu.length) return null;
  return (
    <section aria-labelledby="lich-su" className="mt-6">
      <h3 id="lich-su" className="font-sans text-base font-semibold">
        Lịch sử
      </h3>
      <ol className="mt-2 space-y-2 text-sm">
        {lichSu.map((l) => (
          <li key={l.id} className="border-l-2 border-line pl-3">
            <span className="font-semibold">{TEN_HANH_DONG[l.action] ?? l.action}</span> · phiên bản{" "}
            {l.version} · {l.actor} · {formatNgayGio(l.created_at)}
            {l.note ? <p className="text-ink-2">{l.note}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
