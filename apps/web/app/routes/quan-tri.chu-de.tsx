/**
 * Chủ đề câu hỏi: thêm, sửa tên, đổi chủ đề cha và thứ tự, ẩn hoặc xoá.
 *
 * Chủ đề gắn với câu hỏi, bài học, dữ liệu tra cứu, trò chơi..., nên chủ đề đã có dữ liệu chỉ được
 * ẩn: không hiện trong ô chọn và danh sách luyện tập nữa, dữ liệu cũ giữ nguyên, hiện lại được.
 * Chỉ chủ đề chưa có gì trỏ tới mới xoá được (API kiểm lại và trả 409 nếu còn dữ liệu).
 */
import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { HopThoai, useHop, VungNutHop } from "../components/ui/HopThoai";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { type ChuDeCauHoi, maChuDeMoi, sapXepCayChuDe } from "../lib/ngan-hang";
import { ghiNganHang } from "../lib/ngan-hang.server";
import { goiApiQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.chu-de";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Chủ đề câu hỏi", { index: false });
}

const API = "/v1/quan-tri/ngan-hang";

async function layChuDe(token: string): Promise<ChuDeCauHoi[]> {
  return (await goiApiQuanTri<{ items: ChuDeCauHoi[] }>(token, `${API}/chu-de`)).items;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  return { chuDe: sapXepCayChuDe(await layChuDe(token), { caAn: true }) };
}

type KetQua = { loi: string; chiTiet?: string[] } | { ok: string };

export async function action({ request }: Route.ActionArgs): Promise<KetQua> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "");
  const ma = String(f.get("code") ?? "");
  const ten = String(f.get("name") ?? "").trim();
  const duong = `/chu-de/${encodeURIComponent(ma)}`;
  const xong = (kq: Awaited<ReturnType<typeof ghiNganHang>>, ok: string): KetQua =>
    kq.ok ? { ok } : { loi: kq.loi, chiTiet: kq.chiTiet };

  if (intent === "tao") {
    if (!ten) return { loi: "Nhập tên chủ đề." };
    const daCo = new Set((await layChuDe(token)).map((t) => t.code));
    const kq = await ghiNganHang(token, "/chu-de", {
      body: {
        code: maChuDeMoi(ten, daCo),
        name: ten,
        parent_code: String(f.get("parent_code") ?? "") || null,
      },
    });
    return xong(kq, `Đã thêm chủ đề "${ten}".`);
  }
  if (intent === "sua") {
    if (!ten) return { loi: "Tên chủ đề không được để trống." };
    const kq = await ghiNganHang(token, duong, {
      method: "PATCH",
      body: {
        name: ten,
        parent_code: String(f.get("parent_code") ?? "") || null,
        ordinal: Number(f.get("ordinal") ?? 0) || 0,
      },
    });
    return xong(kq, `Đã lưu chủ đề "${ten}".`);
  }
  if (intent === "an" || intent === "hien") {
    const kq = await ghiNganHang(token, duong, { method: "PATCH", body: { hidden: intent === "an" } });
    return xong(kq, intent === "an" ? `Đã ẩn chủ đề "${ten}".` : `Đã hiện lại chủ đề "${ten}".`);
  }
  if (intent === "xoa") {
    const kq = await ghiNganHang(token, duong, { method: "DELETE" });
    return xong(kq, `Đã xoá chủ đề "${ten}".`);
  }
  return { loi: "Thao tác không hợp lệ." };
}

type ChuDeCay = ChuDeCauHoi & { cap: number };

/** Id của chủ đề và mọi chủ đề nằm dưới nó: không được chọn làm chủ đề cha của nó. */
function cayCon(chuDe: ChuDeCay[], id: string): Set<string> {
  const ra = new Set([id]);
  // `chuDe` xếp theo cây nên cha luôn đứng trước con: một lượt là đủ.
  for (const t of chuDe) if (t.parent_id && ra.has(t.parent_id)) ra.add(t.id);
  return ra;
}

export default function QuanTriChuDe({ loaderData, actionData }: Route.ComponentProps) {
  const { chuDe } = loaderData;
  const busy = useNavigation().state !== "idle";
  const hop = useHop<"xoa", ChuDeCay>();
  const dangHien = chuDe.filter((t) => !t.hidden);
  const soAn = chuDe.length - dangHien.length;

  return (
    <section>
      <p className="hidden text-sm md:block">
        <Link to="/quan-tri/cau-hoi" className="inline-flex min-h-11 items-center text-primary underline">
          Ngân hàng câu hỏi
        </Link>
      </p>
      <TieuDeTrang as="h2" icon="layers" className="mt-2 text-2xl font-bold sm:text-[28px]">
        Chủ đề câu hỏi
      </TieuDeTrang>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
        Chủ đề ẩn không hiện trong ô chọn khi soạn câu hỏi, sinh câu bằng AI, ma trận đề và danh sách luyện
        tập của học viên. Câu hỏi và dữ liệu đã gắn vẫn giữ nguyên; ẩn chủ đề cha thì các chủ đề con cũng ẩn
        theo. Chỉ xoá được chủ đề chưa có câu hỏi hay dữ liệu nào.
      </p>

      {actionData ? (
        <Notice tone={"loi" in actionData ? "danger" : "info"} className="mt-3">
          {"loi" in actionData ? actionData.loi : actionData.ok}
          {"chiTiet" in actionData && actionData.chiTiet?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {actionData.chiTiet.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}

      <Form
        method="post"
        className="mt-4 grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input type="hidden" name="intent" value="tao" />
        <div>
          <Label htmlFor="tao-ten">Tên chủ đề mới</Label>
          <Input id="tao-ten" name="name" required maxLength={200} autoComplete="off" />
        </div>
        <div>
          <Label htmlFor="tao-cha">Thuộc chủ đề</Label>
          <ChonCha id="tao-cha" chuDe={dangHien} />
        </div>
        <div className="flex items-end">
          <Button type="submit" icon="plus" disabled={busy} className="w-full sm:w-auto">
            Thêm chủ đề
          </Button>
        </div>
      </Form>

      <p className="mt-5 text-sm text-ink-2">
        {dangHien.length} chủ đề đang dùng{soAn ? ` · ${soAn} chủ đề đã ẩn` : ""}
      </p>
      <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
        {chuDe.map((t) => (
          <DongChuDe key={t.id} t={t} chuDe={chuDe} busy={busy} onXoa={() => hop.mo("xoa", t)} />
        ))}
      </ul>

      <HopThoai
        mo={hop.la("xoa")}
        tieuDe={`Xoá chủ đề "${hop.duLieu?.name ?? ""}"?`}
        onDong={hop.dong}
        quanTrong
      >
        <Form method="post" onSubmit={hop.dong}>
          <input type="hidden" name="intent" value="xoa" />
          <input type="hidden" name="code" value={hop.duLieu?.code ?? ""} />
          <input type="hidden" name="name" value={hop.duLieu?.name ?? ""} />
          <p>Chủ đề sẽ bị xoá hẳn, không hoàn tác được. Muốn dùng lại sau này thì chọn Ẩn thay vì xoá.</p>
          <VungNutHop className="mt-4">
            <Button type="button" variant="secondary" onClick={hop.dong}>
              Giữ lại
            </Button>
            <Button type="submit" disabled={busy}>
              Xoá chủ đề
            </Button>
          </VungNutHop>
        </Form>
      </HopThoai>
    </section>
  );
}

function ChonCha({ id, chuDe, macDinh = "" }: { id: string; chuDe: ChuDeCay[]; macDinh?: string }) {
  return (
    <select id={id} name="parent_code" defaultValue={macDinh} className={inputClass}>
      <option value="">Không có (chủ đề gốc)</option>
      {chuDe.map((t) => (
        <option key={t.id} value={t.code}>
          {"– ".repeat(t.cap)}
          {t.name}
        </option>
      ))}
    </select>
  );
}

function DongChuDe({
  t,
  chuDe,
  busy,
  onXoa,
}: {
  t: ChuDeCay;
  chuDe: ChuDeCay[];
  busy: boolean;
  onXoa: () => void;
}) {
  const [sua, setSua] = useState(false);
  const cha = chuDe.find((x) => x.id === t.parent_id);
  const coCon = chuDe.some((x) => x.parent_id === t.id);
  const khongDuocChon = cayCon(chuDe, t.id);
  // Chủ đề cha có thể chọn: chủ đề đang hiện, trừ chính nó và cây con; luôn giữ cha hiện tại.
  const chonCha = chuDe.filter((x) => !khongDuocChon.has(x.id) && (!x.hidden || x.id === t.parent_id));

  return (
    <li className={t.hidden ? "bg-surface-2 px-4 py-3" : "px-4 py-3"}>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
        style={{ paddingLeft: `${t.cap * 1.25}rem` }}
      >
        <span className={t.hidden ? "font-medium text-ink-3" : "font-medium"}>{t.name}</span>
        {t.hidden ? <Badge>Đã ẩn</Badge> : null}
        <span className="text-sm text-ink-2">
          {t.so_cau ? (
            <Link
              to={`/quan-tri/cau-hoi?chu_de=${encodeURIComponent(t.code)}`}
              className="text-primary underline"
            >
              {t.so_cau} câu
            </Link>
          ) : (
            "0 câu"
          )}{" "}
          · {t.so_da_duyet} đã duyệt
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSua((v) => !v)}
            aria-expanded={sua}
          >
            {sua ? "Đóng" : "Sửa"}
          </Button>
          <Form method="post">
            <input type="hidden" name="intent" value={t.hidden ? "hien" : "an"} />
            <input type="hidden" name="code" value={t.code} />
            <input type="hidden" name="name" value={t.name} />
            <Button type="submit" variant="ghost" size="sm" disabled={busy}>
              {t.hidden ? "Hiện lại" : "Ẩn"}
            </Button>
          </Form>
          {t.so_cau === 0 && !coCon ? (
            <Button type="button" variant="ghost" size="sm" onClick={onXoa}>
              Xoá
            </Button>
          ) : null}
        </div>
      </div>
      {sua ? (
        <Form
          method="post"
          onSubmit={() => setSua(false)}
          className="mt-3 grid gap-3 sm:grid-cols-[2fr_2fr_6rem_auto]"
          style={{ paddingLeft: `${t.cap * 1.25}rem` }}
        >
          <input type="hidden" name="intent" value="sua" />
          <input type="hidden" name="code" value={t.code} />
          <div>
            <Label htmlFor={`ten-${t.id}`}>Tên</Label>
            <Input id={`ten-${t.id}`} name="name" defaultValue={t.name} required maxLength={200} />
          </div>
          <div>
            <Label htmlFor={`cha-${t.id}`}>Thuộc chủ đề</Label>
            <ChonCha id={`cha-${t.id}`} chuDe={chonCha} macDinh={cha?.code ?? ""} />
          </div>
          <div>
            <Label htmlFor={`thu-tu-${t.id}`}>Thứ tự</Label>
            <Input
              id={`thu-tu-${t.id}`}
              name="ordinal"
              type="number"
              inputMode="numeric"
              defaultValue={t.ordinal}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              Lưu chủ đề
            </Button>
          </div>
        </Form>
      ) : null}
    </li>
  );
}
