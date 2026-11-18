/**
 * Ngân hàng câu hỏi (docs/PLAN.md GĐ3): lọc, duyệt từng câu hoặc hàng loạt, nhập và xuất Excel.
 *
 * Admin quản lý xem và nhập; nút Duyệt, Từ chối chỉ hiện với vai trò được duyệt (API trả về
 * `vai_tro_duyet`). Ẩn nút chỉ để cho gọn: API kiểm quyền lại ở mọi thao tác.
 *
 * "Sinh bằng AI" (GĐ8): chọn điều khoản, chủ đề, số câu rồi bấm sinh; tiến độ tự cập nhật như
 * trang đề thi, lượt lỗi có nút "Chạy tiếp". Câu AI sinh vào tab Chờ duyệt với nhãn "AI", câu có
 * thể trùng mang nhãn riêng.
 */
import { useEffect, useState } from "react";
import { Form, Link, redirect, useNavigation, useRevalidator } from "react-router";
import { OCanCu } from "../components/quan-tri/OCanCu";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink, buttonClass } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { cn } from "../lib/cn";
import { formatNgayGio } from "../lib/format";
import {
  type CauHoi,
  type ChuDeCauHoi,
  sapXepCayChuDe,
  TEN_LOAI,
  TEN_MUC_DO,
  TEN_NGUON,
  TEN_TRANG_THAI,
  TEN_TRANG_THAI_VIEC,
  TONE_TRANG_THAI,
  TONE_TRANG_THAI_VIEC,
  type TrangThaiCauHoi,
  type ViecSinhCauHoi,
} from "../lib/ngan-hang";
import { ghiNganHang } from "../lib/ngan-hang.server";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, type VaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.cau-hoi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Ngân hàng câu hỏi", { index: false });
}

const API = "/v1/quan-tri/ngan-hang";
const MOI_TRANG = 30;
/** `viec`: id việc AI sinh câu (từ trang đề sinh từ văn bản), để xem đúng lô câu cần duyệt. */
const LOC = ["q", "chu_de", "muc_do", "loai", "trang_thai", "nguon", "viec"] as const;

interface DanhSach {
  items: CauHoi[];
  tong: number;
  trang: number;
  dem: Record<TrangThaiCauHoi, number>;
  muc_tieu: number;
  vai_tro_duyet: VaiTro;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const p = new URL(request.url).searchParams;
  const choDuyet = p.get("tab") === "cho-duyet";
  const qs = new URLSearchParams({ co: String(MOI_TRANG), trang: p.get("trang") || "1" });
  for (const k of LOC) {
    const v = p.get(k);
    if (v) qs.set(k, v);
  }
  if (choDuyet) qs.set("trang_thai", "cho_duyet");
  const [ds, chuDe, sinhAi] = await Promise.all([
    goiApiQuanTri<DanhSach>(token, `${API}/cau-hoi?${qs}`).catch((e) => {
      // Tham số trên URL sai (trang=abc, bộ lọc lạ): API từ chối 400. Về danh sách không lọc, không báo lỗi 500.
      if (e instanceof LoiApi && e.status === 400 && p.size) throw redirect("/quan-tri/cau-hoi");
      throw e;
    }),
    goiApiQuanTri<{ items: ChuDeCauHoi[] }>(token, `${API}/chu-de`),
    goiApiQuanTri<{ items: ViecSinhCauHoi[] }>(token, `${API}/sinh-ai`),
  ]);
  const loc = Object.fromEntries(LOC.map((k) => [k, p.get(k) ?? ""])) as Record<(typeof LOC)[number], string>;
  return {
    ...ds,
    chuDe: sapXepCayChuDe(chuDe.items, { giu: p.get("chu_de") }),
    choDuyet,
    loc,
    coTheDuyet: duVaiTro(nguoiDung, ds.vai_tro_duyet),
    viecAi: sinhAi.items,
    moSinhAi: p.get("sinh") === "ai",
  };
}

interface KetQuaNhap {
  chay_thu: boolean;
  tao_chu_de: boolean;
  tong_dong: number;
  hop_le: number;
  da_tao: number;
  chu_de_moi: Array<{ ma: string; ten: string; so_cau: number }>;
  loi: Array<{ dong: number; loi: string[] }>;
}

type KetQuaThaoTac =
  | { loi: string; chiTiet?: string[]; sinhAi?: true }
  | { ok: string; sinhAi?: true }
  | { nhap: KetQuaNhap };

export async function action({ request }: Route.ActionArgs): Promise<KetQuaThaoTac> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "");
  try {
    if (intent === "sinh-ai") {
      // Mỗi ô chọn gửi một URN; ô chưa chọn gửi chuỗi rỗng.
      const urns = [
        ...new Set(
          f
            .getAll("urns")
            .map((x) => String(x).trim())
            .filter(Boolean),
        ),
      ];
      if (!urns.length) return { loi: "Chọn ít nhất một điều khoản.", sinhAi: true };
      const kq = await ghiNganHang<{ che_do: "hang_doi" | "trong_api" | "cho" }>(token, "/sinh-ai", {
        body: {
          urns,
          chu_de: String(f.get("chu_de") ?? ""),
          muc_do: String(f.get("muc_do") ?? "") || null,
          loai: f.getAll("loai").map(String),
          so_cau: Number(f.get("so_cau") ?? 5),
        },
      });
      if (!kq.ok) return { loi: kq.loi, chiTiet: kq.chiTiet, sinhAi: true };
      return {
        ok:
          kq.data.che_do === "cho"
            ? `Đã nhận yêu cầu sinh ${f.get("so_cau")} câu nhưng chưa chạy được. Bấm "Chạy tiếp" ở lượt sinh bên dưới.`
            : `AI đang sinh ${f.get("so_cau")} câu. Tiến độ tự cập nhật bên dưới; câu sinh xong vào tab Chờ duyệt với nhãn AI.`,
        sinhAi: true,
      };
    }
    if (intent === "chay-tiep") {
      const kq = await goiApiQuanTri<{ da_chay: boolean }>(
        token,
        `${API}/sinh-ai/${encodeURIComponent(String(f.get("id") ?? ""))}/chay-tiep`,
        { method: "POST" },
      );
      return {
        ok: kq.da_chay ? "Đã chạy tiếp lượt sinh." : "Lượt sinh này không còn gì để chạy.",
        sinhAi: true,
      };
    }
    if (intent === "nhap") {
      const tep = f.get("tep");
      if (!(tep instanceof File) || tep.size === 0) return { loi: "Chọn tệp Excel (.xlsx) theo mẫu." };
      const gui = new FormData();
      gui.set("tep", tep);
      const q = new URLSearchParams();
      if (f.get("chay_thu") === "on") q.set("chay_thu", "1");
      if (f.get("tao_chu_de") === "on") q.set("tao_chu_de", "1");
      return { nhap: await goiApiQuanTri<KetQuaNhap>(token, `${API}/nhap?${q}`, { form: gui }) };
    }
    if (intent === "duyet-hang-loat") {
      const ids = f.getAll("ids").map(String).filter(Boolean);
      if (!ids.length) return { loi: "Chưa chọn câu nào để duyệt." };
      const kq = await goiApiQuanTri<{ da_duyet: number; bo_qua: string[]; canh_bao_trung: string[] }>(
        token,
        `${API}/duyet-hang-loat`,
        {
          body: { ids },
        },
      );
      return {
        ok:
          `Đã duyệt ${kq.da_duyet} câu.` +
          (kq.bo_qua.length
            ? ` ${kq.bo_qua.length} câu không còn ở trạng thái chờ duyệt nên được bỏ qua.`
            : "") +
          (kq.canh_bao_trung.length
            ? ` ${kq.canh_bao_trung.length} câu có cảnh báo trùng chưa được duyệt: hãy đối chiếu rồi duyệt từng câu.`
            : ""),
      };
    }
    const id = String(f.get("id") ?? "");
    if (intent === "duyet") {
      await goiApiQuanTri(token, `${API}/cau-hoi/${id}/duyet`, {
        body: { xac_nhan_trung: f.get("xac_nhan_trung") === "on" },
      });
      return { ok: `Đã duyệt câu ${f.get("code")}.` };
    }
    if (intent === "tu-choi") {
      await goiApiQuanTri(token, `${API}/cau-hoi/${id}/tu-choi`, {
        body: { ly_do: String(f.get("ly_do") ?? "") },
      });
      return { ok: `Đã từ chối câu ${f.get("code")}. Người soạn sẽ thấy lý do khi mở câu hỏi.` };
    }
    return { loi: "Thao tác không hợp lệ." };
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

export default function QuanTriCauHoi({ loaderData, actionData }: Route.ComponentProps) {
  const { items, tong, trang, dem, muc_tieu, chuDe, choDuyet, loc, coTheDuyet, viecAi, moSinhAi } =
    loaderData;
  const busy = useNavigation().state !== "idle";
  // Kết quả của form Sinh bằng AI hiện ngay trong khung form; kết quả khác hiện ở đầu trang.
  const choSinhAi = actionData && "sinhAi" in actionData ? actionData : undefined;
  const thongBao = choSinhAi ? undefined : actionData;
  const tyLe = Math.min(100, Math.round((dem.da_duyet / muc_tieu) * 100));
  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));

  const qsLoc = new URLSearchParams(Object.entries(loc).filter(([, v]) => v));
  const lienKet = (thay: Record<string, string | null>) => {
    const q = new URLSearchParams(qsLoc);
    if (choDuyet) q.set("tab", "cho-duyet");
    for (const [k, v] of Object.entries(thay)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return `/quan-tri/cau-hoi${s ? `?${s}` : ""}`;
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TieuDeTrang as="h2" icon="shield" className="text-2xl font-bold sm:text-[28px]">
          Ngân hàng câu hỏi
        </TieuDeTrang>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/quan-tri/cau-hoi/moi" icon="plus">
            Thêm câu hỏi
          </ButtonLink>
          <ButtonLink to="/quan-tri/cau-hoi?sinh=ai#sinh-ai" variant="secondary">
            Sinh bằng AI
          </ButtonLink>
          <ButtonLink to="/quan-tri/chu-de" variant="secondary">
            Chủ đề
          </ButtonLink>
          <a
            href={`/quan-tri/cau-hoi/tep/xuat${qsLoc.size ? `?${qsLoc}` : ""}`}
            className={buttonClass({ variant: "secondary" })}
          >
            Xuất Excel
          </a>
        </div>
      </div>

      {/* Bộ đếm theo mục tiêu của khách hàng */}
      <div className="mt-3 rounded-card border border-line bg-surface px-4 py-3">
        <p className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">
            Đã duyệt: {dem.da_duyet.toLocaleString("vi-VN")} / mục tiêu {muc_tieu.toLocaleString("vi-VN")}
          </span>
          <span className="text-sm text-ink-2">
            Chờ duyệt {dem.cho_duyet} · Nháp {dem.nhap} · Bị từ chối {dem.tu_choi}
          </span>
        </p>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-primary-soft"
          role="progressbar"
          aria-valuenow={tyLe}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ so với mục tiêu"
        >
          <div className="h-full rounded-full bg-ok" style={{ width: `${tyLe}%` }} />
        </div>
      </div>

      <ThongBao kq={thongBao} />
      {thongBao && "nhap" in thongBao ? <KetQuaNhapExcel kq={thongBao.nhap} /> : null}

      <NhapExcel busy={busy} />
      <SinhBangAi
        busy={busy}
        mo={moSinhAi || Boolean(choSinhAi)}
        chuDe={chuDe}
        chuDeDangLoc={loc.chu_de}
        viec={viecAi}
        kq={choSinhAi}
      />

      {/* Tab */}
      <nav aria-label="Nhóm câu hỏi" className="mt-3 flex gap-1 border-b border-line">
        {[
          { to: lienKet({ tab: null, trang: null }), label: "Tất cả", on: !choDuyet },
          {
            to: lienKet({ tab: "cho-duyet", trang: null, trang_thai: null }),
            label: `Chờ duyệt (${dem.cho_duyet})`,
            on: choDuyet,
          },
        ].map((t) => (
          <Link
            key={t.label}
            to={t.to}
            aria-current={t.on ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 items-center border-b-2 px-4 text-sm",
              t.on
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <BoLoc loc={loc} chuDe={chuDe} choDuyet={choDuyet} />

      {loc.viec ? (
        <Notice className="mt-4">
          Đang xem các câu của một lần AI sinh câu hỏi.{" "}
          <Link to={lienKet({ viec: null, trang: null })} className="font-semibold underline">
            Bỏ lọc
          </Link>
        </Notice>
      ) : null}

      <p className="mt-2 text-sm text-ink-2">{tong.toLocaleString("vi-VN")} câu</p>

      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon="list"
            title={choDuyet ? "Không có câu nào chờ duyệt" : "Không có câu hỏi khớp bộ lọc"}
          />
        </div>
      ) : (
        <>
          {choDuyet && coTheDuyet ? (
            <Form method="post" id="duyet-hang-loat" className="mt-3 flex flex-wrap items-center gap-3">
              <input type="hidden" name="intent" value="duyet-hang-loat" />
              <Button type="submit" disabled={busy}>
                Duyệt các câu đã chọn
              </Button>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  // Danh sách đổi (vừa duyệt, sang trang) thì ô này về chưa chọn, khớp với các dòng mới.
                  key={items.map((q) => q.id).join()}
                  type="checkbox"
                  className="size-5"
                  onChange={(e) => {
                    for (const el of document.querySelectorAll<HTMLInputElement>(
                      'input[form="duyet-hang-loat"]',
                    )) {
                      el.checked = e.target.checked;
                    }
                  }}
                />
                Chọn cả trang
              </label>
            </Form>
          ) : null}

          <ul className="mt-2 grid gap-2">
            {items.map((q) => (
              <li key={q.id} className="rounded-card border border-line bg-surface px-4 py-3">
                <div className="flex gap-4 sm:gap-6">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-card bg-primary-soft text-primary sm:size-14"
                    aria-hidden="true"
                  >
                    <Icon name="file" kieu="net" className="size-7" />
                  </span>
                  {choDuyet && coTheDuyet ? (
                    <input
                      type="checkbox"
                      name="ids"
                      value={q.id}
                      form="duyet-hang-loat"
                      aria-label={`Chọn câu ${q.code}`}
                      className="mt-1 size-5 shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono font-semibold">{q.code}</span>
                      <Badge tone={TONE_TRANG_THAI[q.status]}>{TEN_TRANG_THAI[q.status]}</Badge>
                      <span className="border-l border-line-strong pl-3 text-ink-2">
                        {TEN_LOAI[q.kind]} · {TEN_MUC_DO[q.level]} · {q.topic_name ?? "Chưa có chủ đề"} ·{" "}
                        {TEN_NGUON[q.source]}
                        {q.version > 1 ? ` · phiên bản ${q.version}` : ""}
                      </span>
                      {q.source === "ai" ? <Badge tone="info">AI</Badge> : null}
                      {q.duplicate_of ? (
                        <Link to={`/quan-tri/cau-hoi/${q.duplicate_of}`} className="hover:underline">
                          <Badge tone="warn">Có thể trùng {q.duplicate_code ?? "câu khác"}</Badge>
                        </Link>
                      ) : null}
                    </p>
                    <Link
                      to={`/quan-tri/cau-hoi/${q.id}`}
                      className="mt-1 line-clamp-3 block text-base leading-snug text-ink-2 hover:text-primary"
                    >
                      {q.stem}
                    </Link>
                    {q.status === "tu_choi" && q.reject_reason ? (
                      <p className="mt-1 text-sm text-danger">Lý do từ chối: {q.reject_reason}</p>
                    ) : null}
                    {q.status === "cho_duyet" && coTheDuyet ? <NutDuyet q={q} busy={busy} /> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {soTrang > 1 ? (
            <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {trang > 1 ? (
                <ButtonLink to={lienKet({ trang: String(trang - 1) })} variant="secondary">
                  Trang trước
                </ButtonLink>
              ) : (
                <span />
              )}
              <span className="text-sm text-ink-2">
                Trang {trang}/{soTrang}
              </span>
              {trang < soTrang ? (
                <ButtonLink to={lienKet({ trang: String(trang + 1) })} variant="secondary">
                  Trang sau
                </ButtonLink>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

function BoLoc({
  loc,
  chuDe,
  choDuyet,
}: {
  loc: Record<string, string>;
  chuDe: Array<ChuDeCauHoi & { cap: number }>;
  choDuyet: boolean;
}) {
  const oChon = cn(inputClass, "pr-8");
  return (
    <Form
      method="get"
      className="mt-3 grid gap-x-6 gap-y-3 rounded-card border border-line bg-primary-soft/30 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {choDuyet ? <input type="hidden" name="tab" value="cho-duyet" /> : null}
      <div className="sm:col-span-2 lg:col-span-3">
        <Label htmlFor="loc-q">Tìm trong đề, mã câu, giải thích</Label>
        <div className="relative">
          <Icon
            name="search"
            kieu="net"
            className="pointer-events-none absolute left-4 top-3 size-5 text-ink-2"
          />
          <Input
            id="loc-q"
            name="q"
            type="search"
            defaultValue={loc.q}
            placeholder="Ví dụ: nồng độ cồn"
            className="pl-12"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="loc-chu-de">Chủ đề</Label>
        <select id="loc-chu-de" name="chu_de" defaultValue={loc.chu_de} className={oChon}>
          <option value="">Tất cả chủ đề</option>
          {chuDe.map((t) => (
            <option key={t.id} value={t.code}>
              {"  ".repeat(t.cap)}
              {t.name} ({t.so_da_duyet}/{t.so_cau})
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="loc-muc-do">Mức độ</Label>
        <select id="loc-muc-do" name="muc_do" defaultValue={loc.muc_do} className={oChon}>
          <option value="">Tất cả mức độ</option>
          {Object.entries(TEN_MUC_DO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="loc-loai">Loại câu</Label>
        <select id="loc-loai" name="loai" defaultValue={loc.loai} className={oChon}>
          <option value="">Tất cả loại</option>
          {Object.entries(TEN_LOAI).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {!choDuyet ? (
        <div>
          <Label htmlFor="loc-trang-thai">Trạng thái</Label>
          <select id="loc-trang-thai" name="trang_thai" defaultValue={loc.trang_thai} className={oChon}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(TEN_TRANG_THAI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <Label htmlFor="loc-nguon">Nguồn</Label>
        <select id="loc-nguon" name="nguon" defaultValue={loc.nguon} className={oChon}>
          <option value="">Tất cả nguồn</option>
          {Object.entries(TEN_NGUON).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        {loc.viec ? <input type="hidden" name="viec" value={loc.viec} /> : null}
        <Button type="submit" variant="secondary" icon="loc" className="w-full text-primary">
          Lọc
        </Button>
      </div>
    </Form>
  );
}

function NutDuyet({ q, busy }: { q: CauHoi; busy: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-start gap-2">
      <Form method="post">
        <input type="hidden" name="intent" value="duyet" />
        <input type="hidden" name="id" value={q.id} />
        <input type="hidden" name="code" value={q.code} />
        {q.duplicate_of ? (
          <label className="mb-2 flex items-start gap-2 text-sm">
            <input type="checkbox" name="xac_nhan_trung" required className="mt-1" />
            Đã đối chiếu với {q.duplicate_code ?? "câu gần giống"}, không trùng ý
          </label>
        ) : null}
        <Button type="submit" disabled={busy}>
          Duyệt
        </Button>
      </Form>
      <details className="min-w-0 flex-1">
        <summary className={buttonClass({ variant: "secondary", className: "cursor-pointer list-none" })}>
          Từ chối
        </summary>
        <Form method="post" className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="intent" value="tu-choi" />
          <input type="hidden" name="id" value={q.id} />
          <input type="hidden" name="code" value={q.code} />
          <label htmlFor={`ly-do-${q.id}`} className="text-sm font-medium sm:sr-only">
            Lý do từ chối câu {q.code}
          </label>
          <Input id={`ly-do-${q.id}`} name="ly_do" required minLength={3} placeholder="Lý do từ chối" />
          <Button type="submit" disabled={busy}>
            Gửi từ chối
          </Button>
        </Form>
      </details>
    </div>
  );
}

function NhapExcel({ busy }: { busy: boolean }) {
  return (
    <details className="mt-3 rounded-card border border-line bg-surface px-5 py-3">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-card bg-primary-soft text-ok"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-7">
            <path
              d="M14 4h7v16h-7M17 8h2m-2 4h2m-2 4h2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="m3 4 12-2v20L3 20Z" fill="currentColor" />
            <path d="m6 8 5 8m0-8-5 8" stroke="var(--surface)" strokeWidth="1.8" />
          </svg>
        </span>
        Nhập câu hỏi từ Excel
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Điền theo tệp mẫu; trang "Hướng dẫn" trong tệp mẫu nêu cách điền từng loại câu. Câu nhập vào ở trạng
        thái chờ duyệt.{" "}
        <a href="/quan-tri/cau-hoi/tep/mau" className="text-primary underline">
          Tải tệp mẫu
        </a>
      </p>
      <Form method="post" encType="multipart/form-data" className="mt-3 grid gap-3">
        <input type="hidden" name="intent" value="nhap" />
        <div>
          <Label htmlFor="tep-cau-hoi">Tệp Excel (.xlsx)</Label>
          <input
            id="tep-cau-hoi"
            name="tep"
            type="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-line-strong file:bg-surface file:px-3"
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="chay_thu" defaultChecked className="size-5" />
          Chạy thử: chỉ kiểm tra, chưa ghi câu nào
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="tao_chu_de" className="size-5" />
          Tự tạo chủ đề chưa có, lấy tên ở cột "Tên chủ đề"
        </label>
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? "Đang đọc tệp" : "Nhập tệp"}
        </Button>
      </Form>
    </details>
  );
}

function ThongBao({ kq }: { kq: KetQuaThaoTac | undefined }) {
  if (kq && "loi" in kq) {
    return (
      <Notice tone="danger" className="mt-4">
        {kq.loi}
        {kq.chiTiet?.length ? (
          <ul className="mt-1 list-disc pl-5">
            {kq.chiTiet.map((l) => (
              <li key={l} className="break-words">
                {l}
              </li>
            ))}
          </ul>
        ) : null}
      </Notice>
    );
  }
  if (kq && "ok" in kq) return <Notice className="mt-4">{kq.ok}</Notice>;
  return null;
}

/** Trần số URN của API `/sinh-ai`. */
const SO_DIEU_KHOAN_TOI_DA = 20;

/** Điều khoản làm căn cứ: mỗi dòng một ô chọn văn bản và điều khoản trong kho, thêm bớt được. */
function ChonDieuKhoanSinhAi() {
  const [ds, dat] = useState([0]);
  return (
    <fieldset className="grid gap-2 sm:col-span-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-2">Điều khoản làm căn cứ</legend>
      {ds.map((k) => (
        <div key={k} className="rounded-btn border border-line p-3">
          <OCanCu id={`sinh-ai-urn-${k}`} name="urns" batBuoc={ds.length === 1} />
          {ds.length > 1 ? (
            <div>
              <Button variant="ghost" size="sm" onClick={() => dat(ds.filter((x) => x !== k))}>
                Bỏ điều khoản này
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {ds.length < SO_DIEU_KHOAN_TOI_DA ? (
        <div>
          <Button variant="secondary" onClick={() => dat([...ds, (ds.at(-1) ?? -1) + 1])}>
            Thêm điều khoản
          </Button>
        </div>
      ) : null}
      <p className="text-sm text-ink-2">
        Tìm văn bản trong kho rồi chọn điều hoặc khoản. Chọn cả văn bản thì lấy mọi điều của văn bản (tối đa
        40 điều).
      </p>
    </fieldset>
  );
}

function SinhBangAi({
  busy,
  mo,
  chuDe,
  chuDeDangLoc,
  viec,
  kq,
}: {
  busy: boolean;
  mo: boolean;
  chuDe: Array<ChuDeCauHoi & { cap: number }>;
  chuDeDangLoc: string;
  viec: ViecSinhCauHoi[];
  kq: KetQuaThaoTac | undefined;
}) {
  const oChon = cn(inputClass, "pr-8");
  const revalidator = useRevalidator();
  const dangSinh = viec.some((v) => v.state === "cho" || v.state === "dang_chay");
  useEffect(() => {
    if (!dangSinh) return;
    const hen = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 4000);
    return () => clearInterval(hen);
  }, [dangSinh, revalidator]);
  return (
    <details
      id="sinh-ai"
      open={mo || dangSinh}
      className="mt-3 rounded-card border border-line bg-surface px-5 py-3"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-card bg-primary-soft text-primary"
          aria-hidden="true"
        >
          <Icon name="ai" kieu="net" className="size-7" />
        </span>
        Sinh câu hỏi bằng AI
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        AI soạn câu hỏi từ nguyên văn các điều khoản bạn chọn, kèm căn cứ, và được dặn không hỏi lại ý của câu
        đã có trên các điều khoản đó. Hệ thống tự loại câu sai định dạng, câu có căn cứ không còn hiệu lực và
        câu gần giống câu đã có, nên số câu nhận được có thể ít hơn số yêu cầu. Câu còn lại vào tab Chờ duyệt
        với nhãn AI; chưa dùng cho luyện tập hay thi cho tới khi được duyệt.
      </p>

      <ThongBao kq={kq} />

      <Form method="post" className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="intent" value="sinh-ai" />
        <ChonDieuKhoanSinhAi />
        <div>
          <Label htmlFor="sinh-ai-chu-de">Chủ đề</Label>
          <select id="sinh-ai-chu-de" name="chu_de" required defaultValue={chuDeDangLoc} className={oChon}>
            <option value="">Chọn chủ đề</option>
            {chuDe.map((t) => (
              <option key={t.id} value={t.code}>
                {"  ".repeat(t.cap)}
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="sinh-ai-muc-do">Mức độ</Label>
          <select id="sinh-ai-muc-do" name="muc_do" defaultValue="" className={oChon}>
            <option value="">Trộn: 4 dễ, 4 trung bình, 2 khó</option>
            {Object.entries(TEN_MUC_DO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Loại câu</legend>
          <div className="flex flex-wrap gap-x-4">
            {Object.entries(TEN_LOAI).map(([k, v]) => (
              <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="loai"
                  value={k}
                  defaultChecked={k === "mot_dap_an" || k === "dung_sai"}
                  className="size-5"
                />
                {v}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="sinh-ai-so-cau">Số câu (1–20)</Label>
          <Input
            id="sinh-ai-so-cau"
            name="so_cau"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            defaultValue={5}
            required
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Đang gửi" : "Sinh câu hỏi"}
          </Button>
        </div>
      </Form>

      {viec.length ? (
        <>
          <h3 className="mt-5 font-semibold">Các lần sinh gần đây</h3>
          {dangSinh ? (
            <p className="mt-1 text-sm text-ink-2" aria-live="polite">
              AI đang sinh câu hỏi. Trang tự cập nhật, không cần tải lại.
            </p>
          ) : null}
          <ul className="mt-2 grid gap-2">
            {viec.map((v) => (
              <li key={v.id} className="rounded-btn border border-line p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONE_TRANG_THAI_VIEC[v.state]}>{TEN_TRANG_THAI_VIEC[v.state]}</Badge>
                  <span>
                    {v.input.topic_name ?? "Chủ đề"} · {v.input.so_cau ?? "?"} câu ·{" "}
                    {formatNgayGio(v.created_at)}
                  </span>
                </p>
                {v.state === "dang_chay" ? (
                  <progress className="mt-2 h-2 w-full" aria-label="Tiến độ AI sinh câu hỏi" />
                ) : null}
                {v.state === "xong" ? (
                  <p className="mt-1 text-ink-2">
                    {v.so_cau} câu vào ngân hàng ({v.so_cho_duyet} chờ duyệt, {v.so_da_duyet} đã duyệt)
                    {v.output.so_loai ? ` · ${v.output.so_loai} câu bị loại` : ""}
                    {v.output.so_loai_trung ? ` (${v.output.so_loai_trung} câu vì trùng câu đã có)` : ""}
                    {v.output.so_danh_dau_trung ? ` · ${v.output.so_danh_dau_trung} câu có thể trùng` : ""}
                    {v.so_cho_duyet ? (
                      <>
                        {" · "}
                        <Link
                          to={`/quan-tri/cau-hoi?tab=cho-duyet&viec=${v.id}`}
                          className="font-semibold text-primary underline"
                        >
                          Duyệt {v.so_cho_duyet} câu của lượt này
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {v.error ? <p className="mt-1 break-words text-danger">{v.error}</p> : null}
                {v.state === "cho" || v.state === "loi" ? (
                  <Form method="post" className="mt-2">
                    <input type="hidden" name="intent" value="chay-tiep" />
                    <input type="hidden" name="id" value={v.id} />
                    <Button type="submit" variant="secondary" size="sm" disabled={busy}>
                      Chạy tiếp
                    </Button>
                  </Form>
                ) : null}
                {v.output.bi_loai?.length ? (
                  <details className="mt-1">
                    <summary className="flex min-h-11 cursor-pointer items-center text-primary">
                      Xem câu bị loại và lý do
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {v.output.bi_loai.map((b, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: danh sách chỉ đọc, không đổi thứ tự
                        <li key={i} className="break-words">
                          <span className="font-medium">{b.stem || "(không có đề)"}</span>:{" "}
                          {b.ly_do.join("; ")}.
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            <Link to="/quan-tri/cau-hoi?tab=cho-duyet&nguon=ai" className="text-primary underline">
              Xem câu AI đang chờ duyệt
            </Link>
          </p>
        </>
      ) : null}
    </details>
  );
}

function KetQuaNhapExcel({ kq }: { kq: KetQuaNhap }) {
  return (
    <div className="mt-4 rounded-card border border-line bg-surface p-4">
      <p className="font-semibold">
        {kq.chay_thu
          ? `Chạy thử: ${kq.hop_le}/${kq.tong_dong} câu hợp lệ. Chưa ghi câu nào.`
          : `Đã nhập ${kq.da_tao}/${kq.tong_dong} câu vào hàng chờ duyệt.`}
      </p>
      {kq.chu_de_moi.length ? (
        <>
          <p className="mt-2 text-sm">
            {!kq.tao_chu_de
              ? `${kq.chu_de_moi.length} mã chủ đề chưa có trong hệ thống. Nếu đây là chủ đề mới chứ không phải gõ sai mã, tích "Tự tạo chủ đề chưa có" rồi nhập lại.`
              : kq.chay_thu
                ? `Khi nhập thật sẽ tạo ${kq.chu_de_moi.length} chủ đề mới. Kiểm tra kỹ mã, tránh tạo chủ đề do gõ sai.`
                : `Đã tạo ${kq.chu_de_moi.length} chủ đề mới.`}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {kq.chu_de_moi.map((t) => (
              <li key={t.ma} className="break-words">
                <span className="font-semibold">{t.ma}</span>
                {t.ten === t.ma ? "" : `: ${t.ten}`} ({t.so_cau} câu)
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {kq.loi.length ? (
        <>
          <p className="mt-2 text-sm text-danger">
            {kq.loi.length} dòng lỗi{kq.chay_thu ? "" : " không được nhập"}. Sửa các dòng này trong tệp rồi
            nhập lại riêng chúng.
          </p>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-sm">
            {kq.loi.map((l) => (
              <li key={l.dong}>
                <span className="font-semibold">Dòng {l.dong}:</span> {l.loi.join("; ")}.
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
