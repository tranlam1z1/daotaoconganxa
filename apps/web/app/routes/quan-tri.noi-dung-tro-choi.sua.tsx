/**
 * Soạn và duyệt một nội dung trò chơi (docs/PLAN.md GĐ-G0). Một tệp cho `moi` và `:id`.
 *
 * Nội dung mới đi hai bước: chọn trò chơi (`moi`), rồi soạn (`moi?game=...`). Trò có trình soạn riêng
 * dùng trình soạn đó; các trò còn lại soạn theo mẫu (SoanTheoMau): biểu mẫu lấy sẵn số liệu của một
 * nội dung đã có của cùng trò (`?mau=<id>`), người soạn chỉ sửa chỗ khác đi, không gõ JSON.
 *
 * Căn cứ chọn từ kho văn bản (OCanCu). Dữ liệu liên quan (tham chiếu) chọn từ danh sách; lúc duyệt, hệ
 * thống ghi phiên bản của từng mục, mục chưa duyệt thì không duyệt được nội dung.
 */
import { useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";
import { OCanCu } from "../components/quan-tri/OCanCu";
import { type BienSoan, SoanDoanDuong } from "../components/quan-tri/tro-choi/SoanDoanDuong";
import { SoanDungCanh } from "../components/quan-tri/tro-choi/SoanDungCanh";
import { type MucPhatSoan, SoanKichBanXe } from "../components/quan-tri/tro-choi/SoanKichBanXe";
import { SoanTheoMau, TEN_LOAI } from "../components/quan-tri/tro-choi/SoanTheoMau";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { inputClass, Label, Notice } from "../components/ui/Field";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { cn } from "../lib/cn";
import { formatNgayGio } from "../lib/format";
import {
  type ChuDeCauHoi,
  sapXepCayChuDe,
  TEN_MUC_DO,
  TEN_TRANG_THAI,
  TONE_TRANG_THAI,
  type TrangThaiCauHoi,
} from "../lib/ngan-hang";
import { goiApiQuanTri, khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, type VaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { rutGoiY } from "../lib/soan-theo-mau";
import type { Route } from "./+types/quan-tri.noi-dung-tro-choi.sua";
import type { TroChoiDangKy } from "./quan-tri.noi-dung-tro-choi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Soạn nội dung trò chơi", { index: false });
}

const API = "/v1/quan-tri/noi-dung-tro-choi";
/** Trò có trình soạn riêng (GAME_DESIGN §3); các trò còn lại soạn theo mẫu. */
const CO_TRINH_SOAN_RIENG = new Set(["cam_bien", "soi_camera", "tai_dung_hien_truong"]);
/**
 * Trò không đọc `game_content` (nguồn ở packages/db/src/nguon-tro-choi.ts): nội dung của trò soạn ở
 * trang khác, nên bước chọn trò dẫn sang trang đó thay vì mở trình soạn.
 */
const SOAN_O_TRANG_KHAC: Record<string, { to: string; ghiChu: string }> = {
  thu_nghiem: {
    to: "/quan-tri/cau-hoi/moi",
    ghiChu:
      "Trò này lấy câu hỏi một đáp án và đúng/sai đã duyệt trong Ngân hàng câu hỏi. Bấm để soạn câu hỏi mới.",
  },
  cung_duong_bien_bao: {
    to: "/quan-tri/du-lieu-tra-cuu?loai=bien-bao",
    ghiChu: "Trò này lấy các biển báo đã duyệt có thao tác phản ứng. Bấm để mở danh sách biển báo.",
  },
};

interface NoiDung {
  id: string;
  code: string;
  game_code: string;
  topic_id: string | null;
  level: "de" | "trung_binh" | "kho";
  title: string;
  payload: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string | null;
  citations: string[];
  refs: Array<{ loai: string; ma: string; version?: number }>;
  status: TrangThaiCauHoi;
  version: number;
  offline_ok: boolean;
  reject_reason: string | null;
  needs_review_reason: string | null;
  approved_by: string | null;
  lich_su: Array<{ version: number; action: string; actor: string; note: string | null; created_at: string }>;
}

const TEN_HANH_DONG: Record<string, string> = {
  tao: "Tạo",
  sua: "Sửa",
  gui_duyet: "Gửi duyệt",
  duyet: "Duyệt",
  tu_choi: "Từ chối",
  luu_tru: "Lưu trữ",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "bien_tap");
  const [tc, chuDe] = await Promise.all([
    goiApiQuanTri<{ items: TroChoiDangKy[]; vai_tro_duyet: VaiTro }>(token, `${API}/tro-choi`),
    goiApiQuanTri<{ items: ChuDeCauHoi[] }>(token, "/v1/quan-tri/ngan-hang/chu-de"),
  ]);
  const nd = params.id
    ? await goiApiQuanTri<NoiDung>(token, `${API}/${encodeURIComponent(params.id)}`).catch(khongTimThay)
    : null;
  const tim = new URL(request.url).searchParams;
  const troChoi = tc.items.filter((g) => g.engine === "luot_choi");
  const game = nd?.game_code ?? tim.get("game") ?? "";
  // Chưa chọn trò (bước 1 của nội dung mới) thì không cần dữ liệu soạn.
  const canSoan = !!nd || (troChoi.some((g) => g.code === game) && !Object.hasOwn(SOAN_O_TRANG_KHAC, game));
  const ds = <T,>(duong: string): Promise<{ items: T[] }> | { items: T[] } =>
    canSoan ? goiApiQuanTri<{ items: T[] }>(token, duong) : { items: [] };
  // Biển báo cho trình soạn đoạn đường (trò Cắm biển, GĐ-T3): cả biển chưa duyệt, để báo lỗi.
  // Dòng mức phạt cho trình soạn kịch bản xe (trò Soi camera, GĐ-T5). Quy trình cho ô dữ liệu liên quan.
  // Nội dung đã có của trò: làm mẫu cho nội dung mới và nguồn gợi ý cho trình soạn theo mẫu.
  const [bien, mucPhat, quyTrinh, coSan] = await Promise.all([
    ds<any>("/v1/quan-tri/du-lieu-tra-cuu/bien-bao"),
    ds<any>("/v1/quan-tri/du-lieu-tra-cuu/muc-phat"),
    ds<any>("/v1/quan-tri/du-lieu-tra-cuu/quy-trinh"),
    ds<NoiDung>(`${API}?${new URLSearchParams({ game, co: "200" })}`),
  ]);
  const mau = nd
    ? null
    : (coSan.items.find((c) => c.id === tim.get("mau")) ??
      (CO_TRINH_SOAN_RIENG.has(game) ? null : (coSan.items[0] ?? null)));
  return {
    nd,
    game: canSoan ? game : "",
    mau: mau && {
      id: mau.id,
      level: mau.level,
      topic_id: mau.topic_id,
      payload: mau.payload,
      answer: mau.answer,
      refs: mau.refs,
    },
    mauDs: nd ? [] : coSan.items.map((c) => ({ id: c.id, code: c.code, title: c.title })),
    goiY: rutGoiY(coSan.items.flatMap((c) => [c.payload, c.answer])),
    quyTrinh: quyTrinh.items.map(
      (q): MucPhatSoan => ({ ma: q.code, ten: q.title ?? "", da_duyet: q.status === "da_duyet" }),
    ),
    mucPhat: mucPhat.items.map(
      (m): MucPhatSoan => ({ ma: m.code, ten: m.behavior ?? m.ten ?? "", da_duyet: m.status === "da_duyet" }),
    ),
    bien: bien.items.map(
      (b): BienSoan => ({
        ma: b.code,
        ten: b.name,
        anh: String(b.image_uri).split("/").at(-1)!,
        nhom: b.group_name,
        phan_ung: b.reaction ?? null,
        da_duyet: b.status === "da_duyet",
      }),
    ),
    troChoi,
    chuDe: sapXepCayChuDe(chuDe.items),
    duocDuyet: duVaiTro(nguoiDung, tc.vai_tro_duyet),
  };
}

function docJson(raw: FormDataEntryValue | null, ten: string): Record<string, unknown> {
  const s = String(raw ?? "").trim();
  if (!s) return {};
  const v = JSON.parse(s);
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new LoiApi(`${ten} phải là một đối tượng JSON.`, 400);
  return v as Record<string, unknown>;
}

export async function action({ request, params }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "bien_tap");
  const f = await request.formData();
  const intent = String(f.get("intent"));
  try {
    if (intent === "luu" || intent === "luu-gui-duyet") {
      let payload: Record<string, unknown>;
      let answer: Record<string, unknown>;
      try {
        payload = docJson(f.get("payload"), "Phần người chơi thấy");
        answer = docJson(f.get("answer"), "Đáp án");
      } catch (e) {
        return {
          loi: e instanceof LoiApi ? e.message : "JSON chưa đúng cú pháp. Kiểm tra dấu ngoặc và dấu phẩy.",
        };
      }
      const body = {
        game_code: String(f.get("game_code")),
        title: String(f.get("title") ?? ""),
        topic_id: f.get("topic_id") ? String(f.get("topic_id")) : null,
        level: String(f.get("level") ?? "trung_binh"),
        payload,
        answer,
        explanation: String(f.get("explanation") ?? "").trim() || null,
        citations: f
          .getAll("citations")
          .map((s) => String(s).trim())
          .filter(Boolean),
        refs: String(f.get("refs") ?? ""),
        offline_ok: f.get("offline_ok") === "on",
      };
      if (!params.id) {
        const moi = await goiApiQuanTri<{ id: string }>(token, API, {
          body: { ...body, gui_duyet: intent === "luu-gui-duyet" },
        });
        return redirect(`/quan-tri/noi-dung-tro-choi/${moi.id}`);
      }
      await goiApiQuanTri(token, `${API}/${params.id}`, {
        method: "PUT",
        body: { ...body, version: Number(f.get("version")) },
      });
      if (intent === "luu-gui-duyet")
        await goiApiQuanTri(token, `${API}/${params.id}/gui-duyet`, { body: {} });
      return { ok: "Đã lưu." };
    }
    const duong: Record<string, string> = {
      "gui-duyet": "gui-duyet",
      duyet: "duyet",
      "tu-choi": "tu-choi",
      "luu-tru": "luu-tru",
    };
    if (params.id && duong[intent]) {
      await goiApiQuanTri(token, `${API}/${params.id}/${duong[intent]}`, {
        body: intent === "tu-choi" ? { ly_do: String(f.get("ly_do") ?? "") } : {},
      });
      return { ok: "Đã cập nhật trạng thái." };
    }
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
  return null;
}

export default function SuaNoiDung({ loaderData, actionData }: Route.ComponentProps) {
  const { nd, game, mau, mauDs, goiY, troChoi, chuDe, duocDuyet, bien, mucPhat, quyTrinh } = loaderData;
  const busy = useNavigation().state !== "idle";
  const khoa = nd?.status === "luu_tru";
  const veDanhSach = (
    <p className="hidden text-sm md:block">
      <Link
        to="/quan-tri/noi-dung-tro-choi"
        className="inline-flex min-h-11 items-center text-primary underline"
      >
        Nội dung trò chơi
      </Link>
    </p>
  );

  // Bước 1 của nội dung mới: chọn trò chơi.
  if (!game) {
    return (
      <div className="max-w-3xl">
        {veDanhSach}
        <h1 className="mt-2 text-2xl font-semibold">Nội dung mới</h1>
        <p className="mt-2 text-[15px] text-ink-2">Chọn trò chơi cần thêm nội dung.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {troChoi.map((g) => (
            <li key={g.code}>
              <Link
                to={SOAN_O_TRANG_KHAC[g.code]?.to ?? `?game=${encodeURIComponent(g.code)}`}
                className="block h-full rounded-lg border border-line bg-surface p-3 hover:border-primary"
              >
                <span className="block font-medium text-primary">{g.name}</span>
                {g.description ? (
                  <span className="mt-1 block text-sm text-ink-2">{g.description}</span>
                ) : null}
                {SOAN_O_TRANG_KHAC[g.code] ? (
                  <span className="mt-1 block text-sm text-ink-2">{SOAN_O_TRANG_KHAC[g.code]!.ghiChu}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const tenTro = troChoi.find((g) => g.code === game)?.name ?? game;
  // Trò có trình soạn riêng thay cho trình soạn theo mẫu (GAME_DESIGN §3).
  const soanRieng = CO_TRINH_SOAN_RIENG.has(game);
  // Nội dung mới lấy sẵn số liệu của nội dung mẫu; tên, giải thích, căn cứ thì soạn mới.
  const goc = nd ?? mau;

  return (
    <div className="max-w-3xl">
      {veDanhSach}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {nd ? `${nd.code} · phiên bản ${nd.version}` : "Nội dung mới"}
        </h1>
        {nd ? (
          nd.status === "da_duyet" && nd.needs_review_reason ? (
            <Badge tone="warn">Cần duyệt lại</Badge>
          ) : (
            <Badge tone={TONE_TRANG_THAI[nd.status]}>{TEN_TRANG_THAI[nd.status]}</Badge>
          )
        ) : null}
      </div>
      <p className="mt-1 text-[15px] text-ink-2">
        Trò chơi: <span className="font-medium text-ink">{tenTro}</span>
        {nd ? null : (
          <>
            {" · "}
            <Link to="/quan-tri/noi-dung-tro-choi/moi" className="text-primary underline">
              Đổi trò chơi
            </Link>
          </>
        )}
      </p>

      {actionData && "loi" in actionData && actionData.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData && actionData.ok ? (
        <Notice className="mt-4">{actionData.ok}</Notice>
      ) : null}
      {nd?.needs_review_reason ? (
        <Notice tone="danger" className="mt-4">
          Cần xem lại: {nd.needs_review_reason} Sửa hoặc gửi duyệt lại để trò chơi dùng được nội dung này.
        </Notice>
      ) : null}
      {nd?.status === "tu_choi" && nd.reject_reason ? (
        <Notice tone="danger" className="mt-4">
          Lý do từ chối: {nd.reject_reason}
        </Notice>
      ) : null}
      {nd?.status === "da_duyet" ? (
        <Notice className="mt-4">
          Nội dung đã duyệt. Lưu thay đổi sẽ đưa nội dung về chờ duyệt và tăng phiên bản.
        </Notice>
      ) : null}

      {!nd && mauDs.length ? (
        <Form method="get" className="mt-6">
          <input type="hidden" name="game" value={game} />
          <Label htmlFor="mau">Soạn dựa trên nội dung đã có</Label>
          <select
            id="mau"
            name="mau"
            defaultValue={mau?.id ?? ""}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={cn(inputClass, "mt-1 min-h-11")}
          >
            {soanRieng ? <option value="">Không, soạn từ đầu</option> : null}
            {mauDs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-ink-2">
            Biểu mẫu bên dưới lấy sẵn số liệu của nội dung này, chỉ cần sửa những chỗ khác đi. Chọn nội dung
            khác sẽ bỏ phần đang soạn dở.
          </p>
        </Form>
      ) : null}

      <Form method="post" key={mau?.id ?? "moi"} className="mt-6 grid gap-4">
        <input type="hidden" name="version" value={nd?.version ?? 1} />
        <input type="hidden" name="game_code" value={game} />
        <div>
          <Label htmlFor="title">Tên tình huống</Label>
          <input
            id="title"
            name="title"
            required
            minLength={3}
            defaultValue={nd?.title}
            className={cn(inputClass, "mt-1 min-h-11")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="level">Mức độ</Label>
            <select
              id="level"
              name="level"
              defaultValue={goc?.level ?? "trung_binh"}
              className={cn(inputClass, "mt-1 min-h-11")}
            >
              {Object.entries(TEN_MUC_DO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="topic_id">Chủ đề (để tính hồ sơ điểm mạnh, điểm yếu)</Label>
            <select
              id="topic_id"
              name="topic_id"
              defaultValue={goc?.topic_id ?? ""}
              className={cn(inputClass, "mt-1 min-h-11")}
            >
              <option value="">Không gắn chủ đề</option>
              {chuDe.map((t) => (
                <option key={t.id} value={t.id}>
                  {"– ".repeat(t.cap)}
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {game === "soi_camera" ? (
          <SoanKichBanXe payload={goc?.payload} answer={goc?.answer} mucPhat={mucPhat} khoa={khoa} />
        ) : game === "tai_dung_hien_truong" ? (
          <SoanDungCanh payload={goc?.payload} answer={goc?.answer} mucPhat={mucPhat} khoa={khoa} />
        ) : game === "cam_bien" ? (
          <SoanDoanDuong payload={goc?.payload} answer={goc?.answer} bien={bien} khoa={khoa} />
        ) : (
          <SoanTheoMau
            payload={goc?.payload}
            answer={goc?.answer}
            refs={goc?.refs ?? []}
            goiY={goiY}
            nguon={{ violation: mucPhat, traffic_sign: bien, procedure: quyTrinh }}
            khoa={khoa}
          />
        )}
        <div>
          <Label htmlFor="explanation">Giải thích</Label>
          <textarea
            id="explanation"
            name="explanation"
            rows={3}
            defaultValue={nd?.explanation ?? ""}
            className={cn(inputClass, "mt-1")}
          />
        </div>
        <DanhSachCanCu macDinh={nd?.citations ?? []} khoa={khoa} />
        {nd?.refs.some((r) => r.version) ? (
          <p className="text-sm text-ink-2">
            Phiên bản đã ghi lúc duyệt:{" "}
            {nd.refs
              .map((r) => `${TEN_LOAI[r.loai]?.toLowerCase() ?? r.loai} ${r.ma} (phiên bản ${r.version})`)
              .join(", ")}
          </p>
        ) : null}
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="offline_ok"
            defaultChecked={nd?.offline_ok ?? true}
            className="size-5"
          />
          Được đưa vào gói chơi offline
        </label>
        {!khoa ? (
          <ThanhLuuBieuMau
            loi={actionData && "loi" in actionData ? actionData.loi : null}
            ok={actionData && "ok" in actionData ? actionData.ok : null}
          >
            <Button type="submit" name="intent" value="luu" variant="secondary" disabled={busy}>
              Lưu
            </Button>
            <Button type="submit" name="intent" value="luu-gui-duyet" disabled={busy}>
              Lưu và gửi duyệt
            </Button>
          </ThanhLuuBieuMau>
        ) : null}
      </Form>

      {nd ? (
        <section aria-labelledby="duyet" className="mt-8 rounded-xl border border-line bg-surface p-4">
          <h2 id="duyet" className="font-sans text-lg font-semibold">
            Duyệt
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {nd.status === "nhap" || nd.status === "tu_choi" ? (
              <Form method="post">
                <Button type="submit" name="intent" value="gui-duyet" disabled={busy}>
                  Gửi duyệt
                </Button>
              </Form>
            ) : null}
            {duocDuyet && nd.status === "cho_duyet" ? (
              <Form method="post">
                <Button type="submit" name="intent" value="duyet" disabled={busy}>
                  Duyệt
                </Button>
              </Form>
            ) : null}
            {nd.status !== "luu_tru" && nd.status !== "cho_duyet" ? (
              <Form method="post">
                <Button type="submit" name="intent" value="luu-tru" variant="secondary" disabled={busy}>
                  Lưu trữ
                </Button>
              </Form>
            ) : null}
          </div>
          {duocDuyet && nd.status === "cho_duyet" ? (
            <Form method="post" className="mt-4 grid gap-2">
              <Label htmlFor="ly_do">Lý do từ chối</Label>
              <textarea id="ly_do" name="ly_do" rows={2} required minLength={3} className={inputClass} />
              <Button type="submit" name="intent" value="tu-choi" variant="secondary" disabled={busy}>
                Từ chối
              </Button>
            </Form>
          ) : null}
          <h3 className="mt-6 text-sm font-semibold text-ink-2">Lịch sử</h3>
          <ol className="mt-2 grid gap-1 text-sm">
            {nd.lich_su.map((h) => (
              <li key={`${h.created_at}-${h.action}-${h.version}`}>
                {formatNgayGio(h.created_at)} · {TEN_HANH_DONG[h.action] ?? h.action} · phiên bản {h.version}{" "}
                · {h.actor}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/** Căn cứ pháp lý: mỗi căn cứ một ô chọn văn bản và điều khoản trong kho, thêm bớt được. */
function DanhSachCanCu({ macDinh, khoa }: { macDinh: readonly string[]; khoa: boolean }) {
  const [ds, dat] = useState(() => macDinh.map((urn, k) => ({ k, urn })));
  return (
    <fieldset className="grid gap-2" disabled={khoa}>
      <legend className="mb-1.5 text-sm font-medium text-ink-2">Căn cứ pháp lý</legend>
      {ds.map((c) => (
        <div key={c.k} className="rounded-lg border border-line p-3">
          <OCanCu id={`can-cu-${c.k}`} name="citations" macDinh={c.urn} />
          <div>
            <Button variant="ghost" size="sm" onClick={() => dat(ds.filter((x) => x !== c))}>
              Bỏ căn cứ này
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button variant="secondary" onClick={() => dat([...ds, { k: (ds.at(-1)?.k ?? -1) + 1, urn: "" }])}>
          Thêm căn cứ
        </Button>
      </div>
    </fieldset>
  );
}
