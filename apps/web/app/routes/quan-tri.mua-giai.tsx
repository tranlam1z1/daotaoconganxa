/**
 * Quản trị mùa giải đơn vị (docs/PLAN.md GĐ-G6): tạo mùa, sửa cấu hình trước khi mùa bắt đầu, kết
 * thúc sớm, chạy ngay bước chốt tuần đã tới hạn. Chỉ quản trị viên. Mọi con số của mùa (số tuần,
 * số hạng, cỡ nhóm, số lên/xuống, trần XP) nằm trong cấu hình của từng mùa (GAME_DESIGN §7 Q11).
 */
import { Form, useNavigation } from "react-router";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, Label, Notice } from "../components/ui/Field";
import { formatDate } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.mua-giai";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Mùa giải đơn vị", { index: false });
}

interface CauHinh {
  so_tuan: number;
  so_hang: number;
  co_nhom: number;
  so_len: number;
  so_xuong: number;
  tran_xp_tuan: number;
  toi_thieu_thanh_vien: number;
}

interface Mua {
  id: string;
  code: string;
  name: string;
  starts_on: string;
  ends_on: string;
  unit_level_label: string;
  config: CauHinh;
  status: "sap_dien_ra" | "dang_dien_ra" | "ket_thuc";
}

const TRUONG: Array<{ k: keyof CauHinh; nhan: string; min: number; max: number; mac: number }> = [
  { k: "so_tuan", nhan: "Số tuần", min: 1, max: 52, mac: 12 },
  { k: "so_hang", nhan: "Số hạng", min: 1, max: 10, mac: 4 },
  { k: "co_nhom", nhan: "Cỡ nhóm", min: 2, max: 50, mac: 10 },
  { k: "so_len", nhan: "Số đơn vị lên hạng", min: 0, max: 10, mac: 2 },
  { k: "so_xuong", nhan: "Số đơn vị xuống hạng", min: 0, max: 10, mac: 2 },
  { k: "tran_xp_tuan", nhan: "Trần XP mỗi người mỗi tuần", min: 1, max: 100000, mac: 700 },
  { k: "toi_thieu_thanh_vien", nhan: "Quân số tối thiểu để xếp hạng", min: 1, max: 50, mac: 3 },
];

const TRANG_THAI: Record<Mua["status"], { t: string; tone: "ok" | "info" | "muted" }> = {
  sap_dien_ra: { t: "Sắp diễn ra", tone: "info" },
  dang_dien_ra: { t: "Đang diễn ra", tone: "ok" },
  ket_thuc: { t: "Đã kết thúc", tone: "muted" },
};

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const { items } = await goiApiQuanTri<{ items: Mua[] }>(token, "/v1/quan-tri/mua-giai");
  return { items };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_tri");
  const f = await request.formData();
  const chuoi = (k: string) => String(f.get(k) ?? "").trim();
  const config = Object.fromEntries(TRUONG.map((t) => [t.k, Number(chuoi(t.k))]));
  const intent = chuoi("intent");
  try {
    if (intent === "tao") {
      await goiApiQuanTri(token, "/v1/quan-tri/mua-giai", {
        body: {
          code: chuoi("code"),
          name: chuoi("name"),
          starts_on: chuoi("starts_on"),
          unit_level_label: chuoi("unit_level_label"),
          config,
        },
      });
      return { ok: `Đã tạo mùa giải ${chuoi("name")}.` };
    }
    if (intent === "sua") {
      await goiApiQuanTri(token, `/v1/quan-tri/mua-giai/${chuoi("id")}`, {
        method: "PATCH",
        body: {
          name: chuoi("name"),
          starts_on: chuoi("starts_on"),
          unit_level_label: chuoi("unit_level_label"),
          config,
        },
      });
      return { ok: "Đã lưu cấu hình." };
    }
    if (intent === "ket_thuc") {
      await goiApiQuanTri(token, `/v1/quan-tri/mua-giai/${chuoi("id")}/ket-thuc`, { method: "POST" });
      return { ok: "Đã kết thúc mùa giải." };
    }
    if (intent === "chay") {
      const kq = await goiApiQuanTri<{ bat_dau: string[]; tuan_da_chot: unknown[]; ket_thuc: string[] }>(
        token,
        "/v1/quan-tri/mua-giai/chay",
        { method: "POST" },
      );
      return {
        ok: `Đã chạy: bắt đầu ${kq.bat_dau.length} mùa, chốt ${kq.tuan_da_chot.length} tuần, kết thúc ${kq.ket_thuc.length} mùa.`,
      };
    }
    return { loi: "Thao tác không hợp lệ." };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

/** Thứ Hai gần nhất từ hôm nay trở đi, dạng YYYY-MM-DD, làm giá trị gợi ý. */
function thuHaiToi(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

function TruongMua({ m }: { m?: Mua }) {
  const id = m?.id ?? "moi";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor={`ten-${id}`}>Tên mùa</Label>
        <Input
          id={`ten-${id}`}
          name="name"
          required
          defaultValue={m?.name}
          placeholder="Mùa giải quý IV/2026"
        />
      </div>
      {!m ? (
        <div>
          <Label htmlFor="ma-moi">Mã mùa</Label>
          <Input id="ma-moi" name="code" required maxLength={40} placeholder="mua-2026-q4" />
        </div>
      ) : null}
      <div>
        <Label htmlFor={`bd-${id}`}>Ngày bắt đầu (thứ Hai)</Label>
        <Input
          id={`bd-${id}`}
          name="starts_on"
          type="date"
          required
          defaultValue={m?.starts_on ?? thuHaiToi()}
        />
      </div>
      <div>
        <Label htmlFor={`cap-${id}`}>Cấp đơn vị thi đấu</Label>
        <Input
          id={`cap-${id}`}
          name="unit_level_label"
          required
          defaultValue={m?.unit_level_label ?? "Đội"}
        />
      </div>
      {TRUONG.map((t) => (
        <div key={t.k}>
          <Label htmlFor={`${t.k}-${id}`}>{t.nhan}</Label>
          <Input
            id={`${t.k}-${id}`}
            name={t.k}
            type="number"
            inputMode="numeric"
            min={t.min}
            max={t.max}
            required
            defaultValue={m?.config[t.k] ?? t.mac}
          />
        </div>
      ))}
    </div>
  );
}

export default function QuanTriMuaGiai({ loaderData, actionData }: Route.ComponentProps) {
  const { items } = loaderData;
  const busy = useNavigation().state === "submitting";

  return (
    <section>
      <h2 className="text-xl font-semibold">Mùa giải đơn vị</h2>
      <p className="mt-1 text-sm text-ink-2">
        Đơn vị cùng cấp thi với nhau theo tuần, chia hạng và nhóm. Chốt tuần tự động lúc 06:00 thứ Hai. Cấu
        hình chỉ sửa được trước khi mùa bắt đầu.
      </p>

      {actionData && "loi" in actionData && actionData.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData && actionData.ok ? (
        <Notice className="mt-4">{actionData.ok}</Notice>
      ) : null}

      <div className="mt-5 space-y-3">
        {items.length === 0 ? <EmptyState icon="trophy" title="Chưa có mùa giải nào" /> : null}
        {items.map((m) => (
          <article key={m.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{m.name}</h3>
              <Badge tone={TRANG_THAI[m.status].tone}>{TRANG_THAI[m.status].t}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-2">
              {m.code} · {formatDate(m.starts_on)} – {formatDate(m.ends_on)} · cấp {m.unit_level_label} ·{" "}
              {m.config.so_hang} hạng, nhóm {m.config.co_nhom}, lên {m.config.so_len}/xuống{" "}
              {m.config.so_xuong}, trần {m.config.tran_xp_tuan.toLocaleString("vi-VN")} XP
            </p>
            {m.status === "sap_dien_ra" ? (
              <details className="mt-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">
                  Sửa cấu hình
                </summary>
                <Form method="post" className="mt-2 space-y-3">
                  <input type="hidden" name="intent" value="sua" />
                  <input type="hidden" name="id" value={m.id} />
                  <TruongMua m={m} />
                  <Button type="submit" disabled={busy}>
                    Lưu
                  </Button>
                </Form>
              </details>
            ) : null}
            {m.status !== "ket_thuc" ? (
              <Form
                method="post"
                className="mt-3"
                onSubmit={(e) => {
                  if (!confirm(`Kết thúc sớm mùa "${m.name}"? Các tuần chưa chốt sẽ không được chốt.`))
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="intent" value="ket_thuc" />
                <input type="hidden" name="id" value={m.id} />
                <Button type="submit" variant="secondary" size="sm" disabled={busy}>
                  Kết thúc sớm
                </Button>
              </Form>
            ) : null}
          </article>
        ))}
      </div>

      <Form method="post" className="mt-4">
        <input type="hidden" name="intent" value="chay" />
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          Chốt ngay các tuần đã tới hạn
        </Button>
      </Form>

      <details key={items.length} className="mt-6 rounded-xl border border-line bg-surface p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
          Tạo mùa giải mới
        </summary>
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="tao" />
          <TruongMua />
          <Button type="submit" disabled={busy}>
            Tạo mùa giải
          </Button>
        </Form>
      </details>
    </section>
  );
}
