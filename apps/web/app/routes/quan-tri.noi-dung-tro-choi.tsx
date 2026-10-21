/**
 * Nội dung trò chơi (docs/PLAN.md GĐ-G0): danh sách tình huống theo trò và trạng thái, tab Chờ
 * duyệt, tab Cần xem lại (tình huống trỏ tới mục đã đổi), và bật tắt từng trò cho người học.
 *
 * Nút Duyệt chỉ hiện với vai trò được duyệt; API kiểm quyền lại ở mọi thao tác.
 */
import { Form, Link, useNavigation, useSearchParams } from "react-router";

import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { inputClass, Label, Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { formatNgayGio } from "../lib/format";
import { TEN_TRANG_THAI, TONE_TRANG_THAI, type TrangThaiCauHoi } from "../lib/ngan-hang";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, type VaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.noi-dung-tro-choi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Nội dung trò chơi", { index: false });
}

const API = "/v1/quan-tri/noi-dung-tro-choi";
const MOI_TRANG = 25;

export interface TroChoiDangKy {
  code: string;
  name: string;
  description: string | null;
  offline_ok: boolean;
  enabled: boolean;
  engine: "luot_choi" | "cu";
}

interface NoiDungDong {
  id: string;
  code: string;
  game_code: string;
  title: string;
  topic_name: string | null;
  status: TrangThaiCauHoi;
  version: number;
  needs_review_reason: string | null;
  updated_at: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "bien_tap");
  const p = new URL(request.url).searchParams;
  const tab = p.get("tab") ?? "tat-ca";
  const qs = new URLSearchParams({ co: String(MOI_TRANG), trang: p.get("trang") || "1" });
  if (p.get("game")) qs.set("game", p.get("game")!);
  if (p.get("q")) qs.set("q", p.get("q")!);
  if (tab === "cho-duyet") qs.set("status", "cho_duyet");
  if (tab === "can-xem-lai") qs.set("can_xem_lai", "1");
  const [ds, tc] = await Promise.all([
    goiApiQuanTri<{
      items: NoiDungDong[];
      tong: number;
      trang: number;
      dem: Record<string, number>;
      vai_tro_duyet: VaiTro;
    }>(token, `${API}?${qs}`),
    goiApiQuanTri<{ items: TroChoiDangKy[] }>(token, `${API}/tro-choi`),
  ]);
  return {
    ...ds,
    troChoi: tc.items,
    tab,
    loc: { game: p.get("game") ?? "", q: p.get("q") ?? "" },
    duocDuyet: duVaiTro(nguoiDung, ds.vai_tro_duyet),
    laQuanTri: duVaiTro(nguoiDung, "quan_tri"),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "bien_tap");
  const f = await request.formData();
  try {
    if (f.get("intent") === "bat-tat") {
      await goiApiQuanTri(token, `${API}/tro-choi/${encodeURIComponent(String(f.get("ma")))}`, {
        method: "PATCH",
        body: { enabled: f.get("enabled") === "1" },
      });
      return { ok: "Đã cập nhật trò chơi." };
    }
    if (f.get("intent") === "duyet") {
      await goiApiQuanTri(token, `${API}/${encodeURIComponent(String(f.get("id")))}/duyet`, { body: {} });
      return { ok: "Đã duyệt." };
    }
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
  return null;
}

const TAB = [
  { id: "tat-ca", ten: "Tất cả" },
  { id: "cho-duyet", ten: "Chờ duyệt", dem: "cho_duyet" },
  { id: "can-xem-lai", ten: "Cần xem lại", dem: "can_xem_lai" },
] as const;

export default function NoiDungTroChoi({ loaderData, actionData }: Route.ComponentProps) {
  const { items, tong, trang, dem, troChoi, tab, loc, duocDuyet, laQuanTri } = loaderData;
  const [params] = useSearchParams();
  const busy = useNavigation().state !== "idle";
  const tenTro = new Map(troChoi.map((g) => [g.code, g.name]));
  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));
  const trangHref = (so: number) => {
    const next = new URLSearchParams(params);
    next.set("trang", String(so));
    return `?${next}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Nội dung trò chơi</h1>
        {/* Đang lọc theo một trò thì vào thẳng bước soạn của trò đó. */}
        <ButtonLink
          to={`/quan-tri/noi-dung-tro-choi/moi${loc.game ? `?game=${encodeURIComponent(loc.game)}` : ""}`}
        >
          Soạn nội dung mới
        </ButtonLink>
      </div>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
        Tình huống, cảnh và kịch bản của trò chơi đi qua cùng quy trình duyệt với câu hỏi. Trò chơi chỉ dùng
        nội dung đã duyệt mà mọi mức phạt, biển báo, câu hỏi được trỏ tới vẫn đã duyệt và đúng phiên bản lúc
        duyệt.
      </p>

      {actionData && "loi" in actionData && actionData.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData && actionData.ok ? (
        <Notice className="mt-4">{actionData.ok}</Notice>
      ) : null}

      <nav aria-label="Lọc theo trạng thái" className="mt-6 flex flex-wrap gap-2">
        {TAB.map((t) => (
          <Link
            key={t.id}
            to={`?tab=${t.id}`}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm",
              tab === t.id
                ? "border-primary bg-primary-soft font-semibold text-primary"
                : "border-line-strong",
            )}
          >
            {t.ten}
            {"dem" in t && dem[t.dem] ? ` (${dem[t.dem]})` : ""}
          </Link>
        ))}
      </nav>

      <Form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        <div className="w-full sm:w-auto">
          <Label htmlFor="loc-game">Trò chơi</Label>
          <select
            id="loc-game"
            name="game"
            defaultValue={loc.game}
            className={cn(inputClass, "mt-1 min-h-11")}
          >
            <option value="">Tất cả</option>
            {troChoi
              .filter((g) => g.engine === "luot_choi")
              .map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <Label htmlFor="loc-q">Tìm theo tên hoặc mã</Label>
          <input
            id="loc-q"
            name="q"
            type="search"
            defaultValue={loc.q}
            className={cn(inputClass, "mt-1 min-h-11")}
          />
        </div>
        <Button type="submit" variant="secondary">
          Lọc
        </Button>
      </Form>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="trophy" title="Chưa có nội dung nào khớp bộ lọc" />
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-2">{tong.toLocaleString("vi-VN")} nội dung</p>
          <ul className="mt-2 grid gap-2">
            {items.map((c) => (
              <li key={c.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/quan-tri/noi-dung-tro-choi/${c.id}`}
                    className="min-w-0 font-medium text-primary underline"
                  >
                    {c.code} · {c.title}
                  </Link>
                  {/* Mục được trỏ tới đã đổi phiên bản: trò chơi không còn dùng nội dung này, nên không ghi "Đã duyệt". */}
                  {c.status === "da_duyet" && c.needs_review_reason ? (
                    <Badge tone="warn">Cần duyệt lại</Badge>
                  ) : (
                    <Badge tone={TONE_TRANG_THAI[c.status]}>{TEN_TRANG_THAI[c.status]}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-2">
                  {tenTro.get(c.game_code) ?? c.game_code}
                  {c.topic_name ? ` · ${c.topic_name}` : ""} · phiên bản {c.version} · sửa{" "}
                  {formatNgayGio(c.updated_at)}
                </p>
                {c.needs_review_reason ? (
                  <p className="mt-1 text-sm text-danger">Cần xem lại: {c.needs_review_reason}</p>
                ) : null}
                {duocDuyet && c.status === "cho_duyet" ? (
                  <Form method="post" className="mt-2">
                    <input type="hidden" name="intent" value="duyet" />
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" size="sm" disabled={busy}>
                      Duyệt
                    </Button>
                  </Form>
                ) : null}
              </li>
            ))}
          </ul>

          {soTrang > 1 ? (
            <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {trang > 1 ? (
                <ButtonLink to={trangHref(trang - 1)} variant="secondary">
                  Trang trước
                </ButtonLink>
              ) : (
                <span />
              )}
              <span className="text-sm text-ink-2">
                Trang {trang}/{soTrang}
              </span>
              {trang < soTrang ? (
                <ButtonLink to={trangHref(trang + 1)} variant="secondary">
                  Trang sau
                </ButtonLink>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}

      <section aria-labelledby="tro-choi" className="mt-10">
        <h2 id="tro-choi" className="font-sans text-lg font-semibold">
          Trò chơi hiện cho người học
        </h2>
        <ul className="mt-3 grid gap-2">
          {troChoi.map((g) => (
            <li
              key={g.code}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3"
            >
              <span className="min-w-0">
                <span className="block font-medium">{g.name}</span>
                <span className="block text-sm text-ink-2">
                  {g.engine === "luot_choi" ? "Khung trò chơi chung" : "Trò cũ"}
                  {g.offline_ok ? " · chơi được offline" : ""}
                </span>
              </span>
              {laQuanTri ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="bat-tat" />
                  <input type="hidden" name="ma" value={g.code} />
                  <input type="hidden" name="enabled" value={g.enabled ? "0" : "1"} />
                  <Button type="submit" variant={g.enabled ? "secondary" : "primary"} disabled={busy}>
                    {g.enabled ? "Đang hiện · Ẩn đi" : "Đang ẩn · Hiện ra"}
                  </Button>
                </Form>
              ) : (
                <Badge tone={g.enabled ? "ok" : "muted"}>{g.enabled ? "Đang hiện" : "Đang ẩn"}</Badge>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
