/**
 * Giao bài thi (docs/PLAN.md GĐ6). Cán bộ quản lý giao đề đang mở cho một đơn vị trong cây đơn
 * vị của mình (có thể kèm các đơn vị cấp dưới) hoặc cho một người, đặt giờ mở và hạn làm bài.
 * Danh sách bên dưới cho biết bao nhiêu người đã nộp.
 */
import { useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { formatNgayGio, gioVietNamSangIso, isoSangGioVietNam } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { DeThi, GiaoBai } from "../lib/thi";
import type { Route } from "./+types/quan-tri.giao-bai";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Giao bài thi", { index: false });
}

interface DonVi {
  id: string;
  name: string;
  cap: number;
}
interface NguoiDung {
  id: string;
  name: string | null;
  username: string | null;
  unit_name: string | null;
  enabled: boolean;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "lanh_dao");
  const de = new URL(request.url).searchParams.get("de");
  const [deThi, donVi, nguoi, giaoBai] = await Promise.all([
    goiApiQuanTri<{ items: DeThi[] }>(token, "/v1/quan-tri/de-thi"),
    goiApiQuanTri<{ items: DonVi[] }>(token, "/v1/quan-tri/don-vi"),
    goiApiQuanTri<{ items: NguoiDung[] }>(token, "/v1/quan-tri/nguoi-dung?gioi_han=200"),
    goiApiQuanTri<{ items: GiaoBai[] }>(
      token,
      `/v1/giao-bai${de ? `?exam_id=${encodeURIComponent(de)}` : ""}`,
    ),
  ]);
  const bayNgay = new Date(Date.now() + 7 * 86_400_000);
  return {
    deThi: deThi.items.filter((d) => d.status === "xuat_ban"),
    donVi: donVi.items,
    nguoi: nguoi.items.filter((n) => n.enabled),
    giaoBai: giaoBai.items,
    hanMacDinh: `${isoSangGioVietNam(bayNgay).slice(0, 10)}T17:00`,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "lanh_dao");
  const f = await request.formData();
  const s = (k: string) => String(f.get(k) ?? "").trim();
  try {
    if (s("intent") === "huy") {
      await goiApiQuanTri(token, `/v1/giao-bai/${s("id")}/huy`, { method: "POST" });
      return { ok: "Đã hủy bài giao. Lượt đã nộp vẫn được giữ." };
    }
    const due = gioVietNamSangIso(s("due_at"));
    if (!due) return { loi: "Chọn hạn làm bài." };
    const theoDonVi = s("loai") !== "nguoi";
    await goiApiQuanTri(token, "/v1/giao-bai", {
      body: {
        exam_id: s("exam_id"),
        unit_id: theoDonVi ? s("unit_id") || null : null,
        account_id: theoDonVi ? null : s("account_id") || null,
        include_subunits: f.get("include_subunits") === "on",
        opens_at: gioVietNamSangIso(s("opens_at")) ?? undefined,
        due_at: due,
        note: s("note") || null,
      },
    });
    return { ok: "Đã giao bài. Người được giao thấy bài ở mục Thi." };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

export default function GiaoBaiPage({ loaderData, actionData }: Route.ComponentProps) {
  const { deThi, donVi, nguoi, giaoBai, hanMacDinh } = loaderData;
  const [params] = useSearchParams();
  const [loai, setLoai] = useState<"don_vi" | "nguoi">("don_vi");
  const busy = useNavigation().state !== "idle";
  const capGoc = Math.min(...donVi.map((d) => d.cap), 1);

  return (
    <section>
      <TieuDeTrang as="h2" icon="shield" className="text-xl font-semibold">
        Giao bài thi
      </TieuDeTrang>
      <p className="mt-1 text-sm text-ink-2">
        Giao đề đang mở cho một đơn vị hoặc một người trong phạm vi quản lý, kèm hạn làm bài.
      </p>

      {actionData && "loi" in actionData ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData ? <Notice className="mt-4">{actionData.ok}</Notice> : null}

      {deThi.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="cap" title="Chưa có đề thi đang mở để giao" />
        </div>
      ) : (
        <Form method="post" className="mt-4 space-y-4 rounded-xl border border-line bg-surface p-4">
          <input type="hidden" name="intent" value="giao" />
          <div>
            <Label htmlFor="gb-de">Đề thi</Label>
            <select
              id="gb-de"
              name="exam_id"
              required
              defaultValue={params.get("de") ?? ""}
              className={inputClass}
            >
              <option value="" disabled>
                Chọn đề thi
              </option>
              {deThi.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.question_count} câu, {d.duration_minutes} phút)
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-2">Giao cho</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "don_vi", t: "Một đơn vị" },
                { v: "nguoi", t: "Một người" },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3 text-[15px] has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="loai"
                    value={o.v}
                    checked={loai === o.v}
                    onChange={() => setLoai(o.v as "don_vi" | "nguoi")}
                  />
                  {o.t}
                </label>
              ))}
            </div>
          </fieldset>

          {loai === "don_vi" ? (
            <div>
              <Label htmlFor="gb-dv">Đơn vị</Label>
              <select id="gb-dv" name="unit_id" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Chọn đơn vị
                </option>
                {donVi.map((d) => (
                  <option key={d.id} value={d.id}>
                    {"· ".repeat(d.cap - capGoc)}
                    {d.name}
                  </option>
                ))}
              </select>
              <label className="mt-2 flex min-h-11 items-center gap-2 text-[15px]">
                <input type="checkbox" name="include_subunits" defaultChecked />
                Kèm các đơn vị cấp dưới
              </label>
            </div>
          ) : (
            <div>
              <Label htmlFor="gb-nguoi">Người được giao</Label>
              <select id="gb-nguoi" name="account_id" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Chọn người
                </option>
                {nguoi.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name ?? n.username} {n.unit_name ? `(${n.unit_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="gb-mo">Mở bài lúc (để trống: mở ngay)</Label>
              <Input id="gb-mo" name="opens_at" type="datetime-local" />
            </div>
            <div>
              <Label htmlFor="gb-han">Hạn làm bài</Label>
              <Input id="gb-han" name="due_at" type="datetime-local" required defaultValue={hanMacDinh} />
            </div>
          </div>
          <div>
            <Label htmlFor="gb-ghi-chu">Ghi chú cho người làm bài (không bắt buộc)</Label>
            <Input id="gb-ghi-chu" name="note" maxLength={1000} />
          </div>
          <ThanhLuuBieuMau
            className="bg-surface"
            loi={actionData && "loi" in actionData ? actionData.loi : null}
            ok={actionData && "ok" in actionData ? actionData.ok : null}
          >
            <Button type="submit" disabled={busy} className="min-h-12 w-full md:w-auto">
              Giao bài
            </Button>
          </ThanhLuuBieuMau>
        </Form>
      )}

      <h3 className="mt-8 font-sans text-base font-semibold">Bài đã giao</h3>
      {giaoBai.length === 0 ? (
        <EmptyState gon icon="list" title="Chưa giao bài nào trong phạm vi quản lý" className="mt-3" />
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
          {giaoBai.map((g) => (
            <li key={g.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{g.exam_title}</span>
                {g.cancelled_at ? <Badge tone="muted">Đã hủy</Badge> : null}
              </div>
              <p className="text-sm text-ink-2">
                {g.unit_name
                  ? `${g.unit_name}${g.include_subunits ? " và đơn vị cấp dưới" : ""}`
                  : `Cá nhân: ${g.account_name ?? ""}`}{" "}
                · hạn {formatNgayGio(g.due_at)} · {g.so_da_nop}/{g.so_nguoi} người đã nộp
              </p>
              {!g.cancelled_at ? (
                <Form method="post" className="mt-1">
                  <input type="hidden" name="intent" value="huy" />
                  <input type="hidden" name="id" value={g.id} />
                  <Button type="submit" variant="ghost" disabled={busy} className="px-0 text-danger">
                    Hủy giao bài
                  </Button>
                </Form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
