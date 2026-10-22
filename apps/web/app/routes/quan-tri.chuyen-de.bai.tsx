/**
 * Soạn một bài giảng. Một tệp phục vụ hai route: /quan-tri/chuyen-de/:slug/bai/moi (chỉ thông tin
 * bài) và /quan-tri/chuyen-de/:slug/bai/:id (thông tin bài, khối nội dung, trạng thái).
 *
 * Khối nội dung thêm vào cuối bài, đổi chỗ bằng nút Lên/Xuống, sửa tại chỗ (components/quan-tri/
 * SuaKhoi.tsx). Bảng kiểm lấy từ API, đúng bộ luật API dùng để chặn xuất bản.
 */
import { useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";

import { KhoiNoiDung } from "../components/bai-giang/KhoiNoiDung";
import { NutTrangThai } from "../components/quan-tri/NutTrangThai";
import { SuaKhoi, ThongBaoLoiBangKiem } from "../components/quan-tri/SuaKhoi";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { cn } from "../lib/cn";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { type HoatDongQuanTri, TEN_CACH_CHAM, TEN_DANG_BAI } from "../lib/soan-bai-ai";
import {
  type BaiQuanTri,
  type BangKiemChuyenDe,
  type ChiTietChuyenDe,
  type ChuDeNganHang,
  KHOI_SOAN,
  KHOI_SOAN_THEO_KIND,
  type KhoiQuanTri,
  type LoiBangKiem,
  TEN_TRANG_THAI,
  TONE_TRANG_THAI,
  type TrangThaiNoiDung,
  taoSlug,
  tenKhoi,
  trangThaiDatDuoc,
} from "../lib/soan-bai-giang";
import type { Route } from "./+types/quan-tri.chuyen-de.bai";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.bai ? data.bai.title : "Thêm bài học", { index: false });
}

async function docChuyenDe(token: string, slug: string) {
  try {
    return await goiApiQuanTri<ChiTietChuyenDe>(
      token,
      `/v1/quan-tri/dao-tao/chuyen-de/${encodeURIComponent(slug)}`,
    );
  } catch (e) {
    if (e instanceof LoiApi && e.status === 404)
      throw new Response("Không tìm thấy chuyên đề.", { status: 404 });
    throw e;
  }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const [chiTiet, { items: chuDe }] = await Promise.all([
    docChuyenDe(token, params.slug),
    goiApiQuanTri<{ items: ChuDeNganHang[] }>(token, "/v1/quan-tri/ngan-hang/chu-de"),
  ]);
  const coTheXoa = duVaiTro(nguoiDung, "quan_ly");
  if (!params.id) {
    const thuTu = Number(new URL(request.url).searchParams.get("thuTu")) || chiTiet.bai.length + 1;
    return {
      chiTiet,
      chuDe,
      bai: null,
      khoi: [] as KhoiQuanTri[],
      hoatDong: [] as HoatDongQuanTri[],
      loiBangKiem: [],
      datDuoc: [],
      thuTu,
      coTheXoa,
    };
  }

  let kq: { bai: BaiQuanTri; khoi: KhoiQuanTri[]; hoatDong: HoatDongQuanTri[] };
  try {
    kq = await goiApiQuanTri(token, `/v1/quan-tri/dao-tao/bai/${encodeURIComponent(params.id)}`);
  } catch (e) {
    if (e instanceof LoiApi && (e.status === 404 || e.status === 400)) {
      throw new Response("Không tìm thấy bài học.", { status: 404 });
    }
    throw e;
  }
  if (kq.bai.course_id !== chiTiet.chuyenDe.id)
    throw new Response("Bài học không thuộc chuyên đề này.", { status: 404 });
  const bangKiem = await goiApiQuanTri<BangKiemChuyenDe>(
    token,
    `/v1/quan-tri/dao-tao/chuyen-de/${encodeURIComponent(params.slug)}/kiem-tra`,
  );
  const loiBangKiem: LoiBangKiem[] = bangKiem.theoBai.find((b) => b.id === kq.bai.id)?.loi ?? [];
  const datDuoc = trangThaiDatDuoc(kq.bai.status, (v) => duVaiTro(nguoiDung, v));
  return {
    chiTiet,
    chuDe,
    bai: kq.bai,
    khoi: kq.khoi,
    hoatDong: kq.hoatDong.filter((h) => !h.retired),
    loiBangKiem,
    datDuoc,
    thuTu: kq.bai.ordinal,
    coTheXoa,
  };
}

type KetQua = { loi: string; chiTiet?: LoiBangKiem[] } | { ok: string; moKhoi?: string; daLuuKhoi?: boolean };

function docJson<T>(v: FormDataEntryValue | null, macDinh: T): T {
  try {
    return v ? (JSON.parse(String(v)) as T) : macDinh;
  } catch {
    return macDinh;
  }
}

export async function action({ request, params }: Route.ActionArgs): Promise<KetQua> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "luu_bai");
  const baiId = params.id ?? "";
  try {
    switch (intent) {
      case "trang_thai": {
        const trangThai = String(f.get("trangThai") ?? "") as TrangThaiNoiDung;
        await goiApiQuanTri(token, `/v1/quan-tri/dao-tao/bai/${baiId}/trang-thai`, { body: { trangThai } });
        return {
          ok:
            trangThai === "xuat_ban"
              ? "Đã xuất bản bài. Học viên thấy bài khi chuyên đề cũng đã xuất bản."
              : `Đã chuyển bài sang "${TEN_TRANG_THAI[trangThai]}".`,
        };
      }

      case "them_khoi": {
        const kind = String(f.get("kind") ?? "");
        const mo = KHOI_SOAN_THEO_KIND.get(kind);
        if (!mo) return { loi: "Hãy chọn loại khối." };
        const { khoi } = await goiApiQuanTri<{ khoi: KhoiQuanTri }>(token, "/v1/quan-tri/dao-tao/khoi", {
          body: { lessonId: baiId, ordinal: Number(f.get("ordinal")) || 1, kind, data: mo.macDinh() },
        });
        return { ok: `Đã thêm khối ${mo.ten}. Điền nội dung rồi bấm Lưu khối.`, moKhoi: khoi.id };
      }

      case "luu_khoi": {
        const data = docJson<Record<string, unknown> | null>(f.get("data"), null);
        if (!data) return { loi: "Dữ liệu khối không hợp lệ." };
        const nguon = String(f.get("source") ?? "nguoi");
        await goiApiQuanTri(token, "/v1/quan-tri/dao-tao/khoi", {
          body: {
            id: String(f.get("id")),
            lessonId: baiId,
            ordinal: Number(f.get("ordinal")) || 1,
            kind: String(f.get("kind")),
            data,
            citations: docJson<string[]>(f.get("citations"), []),
            // Khối AI soạn đã qua tay người sửa thì ghi nhận là "AI soạn, người sửa".
            source: nguon === "ai" ? "ai_da_sua" : nguon,
            modes: docJson<string[]>(f.get("modes"), []),
            note: String(f.get("note") ?? "") || null,
          },
        });
        return { ok: "Đã lưu khối.", daLuuKhoi: true };
      }

      case "go_bai_tap":
        await goiApiQuanTri(token, `/v1/quan-tri/dao-tao/hoat-dong/${String(f.get("id"))}/go`, {
          body: { go: true },
        });
        return { ok: "Đã gỡ bài tập khỏi bài." };

      case "xoa_khoi":
        await goiApiQuanTri(token, `/v1/quan-tri/dao-tao/khoi/${String(f.get("id"))}`, { method: "DELETE" });
        return { ok: "Đã xóa khối." };

      case "sap_xep":
        await goiApiQuanTri(token, `/v1/quan-tri/dao-tao/bai/${baiId}/sap-xep-khoi`, {
          body: { thuTu: docJson<string[]>(f.get("thuTu"), []) },
        });
        return { ok: "Đã đổi thứ tự khối." };

      case "xoa_bai":
        await goiApiQuanTri(token, `/v1/quan-tri/dao-tao/bai/${baiId}`, { method: "DELETE" });
        throw redirect(`/quan-tri/chuyen-de/${params.slug}`);

      default: {
        const chiTiet = await docChuyenDe(token, params.slug);
        const slug = params.id
          ? (chiTiet.bai.find((b) => b.id === params.id)?.slug ?? "")
          : String(f.get("slug") ?? "").trim();
        if (!/^[a-z0-9-]+$/.test(slug)) {
          return { loi: "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang." };
        }
        if (!params.id && chiTiet.bai.some((b) => b.slug === slug)) {
          return { loi: `Chuyên đề đã có bài dùng đường dẫn "${slug}". Hãy đặt đường dẫn khác.` };
        }
        const title = String(f.get("title") ?? "").trim();
        if (title.length < 3) return { loi: "Tên bài cần ít nhất 3 ký tự." };
        const topicId = String(f.get("topicId") ?? "");
        const { bai } = await goiApiQuanTri<{ bai: { id: string } }>(token, "/v1/quan-tri/dao-tao/bai", {
          body: {
            ...(params.id ? { id: params.id } : {}),
            courseId: chiTiet.chuyenDe.id,
            slug,
            ordinal: Math.min(500, Math.max(1, Number(f.get("ordinal")) || 1)),
            title,
            summary: String(f.get("summary") ?? "").trim() || null,
            asOf: String(f.get("asOf") ?? "") || null,
            estimatedMinutes: Math.min(600, Math.max(1, Number(f.get("estimatedMinutes")) || 15)),
            topicId: topicId || null,
          },
        });
        if (!params.id) throw redirect(`/quan-tri/chuyen-de/${params.slug}/bai/${bai.id}`);
        return { ok: "Đã lưu thông tin bài." };
      }
    }
  } catch (e) {
    if (e instanceof LoiApi) {
      const chiTiet = Array.isArray(e.details)
        ? (e.details as LoiBangKiem[]).filter((l) => l?.thong_diep)
        : [];
      return { loi: e.message, ...(chiTiet.length ? { chiTiet } : {}) };
    }
    throw e;
  }
}

export default function SoanBai({ loaderData, actionData }: Route.ComponentProps) {
  const { chiTiet, chuDe, bai, khoi, hoatDong, loiBangKiem, datDuoc, thuTu, coTheXoa } = loaderData;
  const cd = chiTiet.chuyenDe;
  const busy = useNavigation().state !== "idle";
  const [slug, setSlug] = useState("");
  const [slugDaSua, setSlugDaSua] = useState(false);
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [xemCaBai, setXemCaBai] = useState(false);
  // Mỗi kết quả action xử lý một lần: khối vừa thêm mở sẵn biểu mẫu, khối vừa lưu đóng biểu mẫu.
  const [ketQuaDaXuLy, setKetQuaDaXuLy] = useState(actionData);
  if (actionData !== ketQuaDaXuLy) {
    setKetQuaDaXuLy(actionData);
    if (actionData && "moKhoi" in actionData && actionData.moKhoi) setDangSua(actionData.moKhoi);
    else if (actionData && "daLuuKhoi" in actionData) setDangSua(null);
  }

  const ordinalMoi = khoi.reduce((m, k) => Math.max(m, k.ordinal), 0) + 1;
  const thuTuId = khoi.map((k) => k.id);
  const doiCho = (i: number, j: number) => {
    const m = [...thuTuId];
    [m[i], m[j]] = [m[j] as string, m[i] as string];
    return JSON.stringify(m);
  };

  return (
    <section>
      <Link
        to={`/quan-tri/chuyen-de/${cd.slug}`}
        className="flex min-h-11 items-center text-sm font-medium text-primary"
      >
        Về chuyên đề: {cd.title}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{bai ? bai.title : "Thêm bài học"}</h2>
        {bai ? (
          <Badge tone={TONE_TRANG_THAI[bai.status] ?? "muted"}>
            {TEN_TRANG_THAI[bai.status] ?? bai.status}
          </Badge>
        ) : null}
        {bai?.status === "xuat_ban" && cd.status === "xuat_ban" ? (
          <Link
            to={`/hoc/${cd.slug}/${bai.slug}`}
            className="flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            Xem trang học viên
          </Link>
        ) : null}
      </div>

      {actionData && "loi" in actionData ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
          {actionData.chiTiet?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {actionData.chiTiet.map((l, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: danh sách chỉ đọc
                <li key={i}>
                  {l.ordinal ? `Khối ${l.ordinal}: ` : ""}
                  {l.thong_diep}
                </li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData ? <Notice className="mt-4">{actionData.ok}</Notice> : null}

      {bai ? (
        <div className="mt-4 space-y-3">
          <ThongBaoLoiBangKiem loi={loiBangKiem} />
          {!loiBangKiem.length ? <Notice>Bài đạt bảng kiểm, xuất bản được.</Notice> : null}
          <NutTrangThai datDuoc={datDuoc} ban={busy} />
        </div>
      ) : null}

      <details open={!bai} className="mt-6 rounded-xl border border-line bg-surface px-4">
        <summary className="flex min-h-12 cursor-pointer items-center font-semibold">Thông tin bài</summary>
        <Form method="post" className="space-y-4 pb-4">
          <input type="hidden" name="intent" value="luu_bai" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="bai-ten">Tên bài</Label>
              <Input
                id="bai-ten"
                name="title"
                required
                minLength={3}
                defaultValue={bai?.title ?? ""}
                onChange={(e) => {
                  if (!bai && !slugDaSua) setSlug(taoSlug(e.target.value));
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="bai-slug">Đường dẫn</Label>
              {bai ? (
                <p id="bai-slug" className="font-mono text-sm text-ink-2">
                  /hoc/{cd.slug}/{bai.slug}
                </p>
              ) : (
                <>
                  <Input
                    id="bai-slug"
                    name="slug"
                    required
                    pattern="[a-z0-9\-]+"
                    value={slug}
                    onChange={(e) => {
                      setSlugDaSua(true);
                      setSlug(e.target.value);
                    }}
                    className="font-mono"
                    aria-describedby="bai-slug-goi-y"
                  />
                  <p id="bai-slug-goi-y" className="mt-1 text-xs text-ink-3">
                    Chữ thường không dấu, số và dấu gạch ngang. Không đổi được sau khi tạo.
                  </p>
                </>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="bai-tom-tat">Tóm tắt (không bắt buộc)</Label>
              <textarea
                id="bai-tom-tat"
                name="summary"
                rows={2}
                defaultValue={bai?.summary ?? ""}
                className={cn(inputClass, "py-2")}
              />
            </div>
            <div>
              <Label htmlFor="bai-thu-tu">Thứ tự trong chuyên đề</Label>
              <Input
                id="bai-thu-tu"
                name="ordinal"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                required
                defaultValue={thuTu}
              />
            </div>
            <div>
              <Label htmlFor="bai-phut">Thời lượng dự kiến (phút)</Label>
              <Input
                id="bai-phut"
                name="estimatedMinutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                defaultValue={bai?.estimated_minutes ?? 15}
              />
            </div>
            <div>
              <Label htmlFor="bai-as-of">Quy định tính đến ngày</Label>
              <Input id="bai-as-of" name="asOf" type="date" defaultValue={bai?.asOf ?? cd.asOf} />
            </div>
            <div>
              <Label htmlFor="bai-chu-de">Kiểm tra cuối bài</Label>
              <select
                id="bai-chu-de"
                name="topicId"
                defaultValue={bai?.topic_id ?? ""}
                className={inputClass}
              >
                <option value="">Không có</option>
                {chuDe.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.so_da_duyet} câu đã duyệt)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-3">Rút 3 đến 5 câu từ chủ đề ngân hàng câu hỏi này.</p>
            </div>
          </div>
          <ThanhLuuBieuMau>
            <Button type="submit" disabled={busy} className="min-h-12 w-full md:w-auto">
              {bai ? "Lưu thông tin bài" : "Tạo bài (bản nháp)"}
            </Button>
          </ThanhLuuBieuMau>
        </Form>
      </details>

      {bai ? (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-sans text-lg font-semibold">Nội dung bài ({khoi.length} khối)</h3>
              <p className="mt-1 text-sm text-ink-2">
                Bài cần ít nhất một Thẻ căn cứ và nên kết bằng khối Ghi nhớ. Cứ khoảng 6 phút đọc nên có một
                khối tương tác (hỏi nhanh, thẻ lật, bảng tra, sơ đồ).
              </p>
            </div>
            {khoi.length ? (
              <Button variant="secondary" onClick={() => setXemCaBai((x) => !x)} aria-pressed={xemCaBai}>
                {xemCaBai ? "Quay lại soạn" : "Xem trước cả bài"}
              </Button>
            ) : null}
          </div>

          {xemCaBai ? (
            <div className="mt-4 space-y-6 rounded-xl border border-line bg-canvas p-4">
              {khoi.map((k) => (
                <KhoiNoiDung
                  key={k.id}
                  khoi={{
                    id: k.id,
                    ordinal: k.ordinal,
                    kind: k.kind,
                    data: k.data,
                    citations: k.citations,
                    citationHealth: k.citation_health,
                  }}
                />
              ))}
            </div>
          ) : (
            <>
              {khoi.length === 0 ? (
                <EmptyState icon="book" title="Bài chưa có khối nội dung nào" gon className="mt-4">
                  Chọn loại khối ở dưới để bắt đầu soạn.
                </EmptyState>
              ) : (
                <ol className="mt-4 space-y-3">
                  {khoi.map((k, i) => {
                    const loiKhoi = loiBangKiem.filter((l) => l.blockId === k.id);
                    const coLoi = loiKhoi.some((l) => l.muc === "loi");
                    return (
                      <li
                        key={k.id}
                        className={cn(
                          "rounded-xl border bg-surface p-3",
                          coLoi ? "border-danger" : "border-line",
                          dangSua === k.id && "border-primary",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-ink-3">{i + 1}.</span>
                          <span className="font-semibold">{tenKhoi(k.kind)}</span>
                          {k.source !== "nguoi" ? <Badge tone="info">AI soạn</Badge> : null}
                          {k.citations.length ? (
                            <span className="text-xs text-ink-3">{k.citations.length} viện dẫn</span>
                          ) : null}
                          {dangSua !== k.id ? (
                            <div className="ml-auto flex flex-wrap gap-1">
                              <Form method="post">
                                <input type="hidden" name="intent" value="sap_xep" />
                                <input type="hidden" name="thuTu" value={i > 0 ? doiCho(i, i - 1) : ""} />
                                <Button type="submit" size="sm" variant="ghost" disabled={busy || i === 0}>
                                  Lên
                                </Button>
                              </Form>
                              <Form method="post">
                                <input type="hidden" name="intent" value="sap_xep" />
                                <input
                                  type="hidden"
                                  name="thuTu"
                                  value={i < khoi.length - 1 ? doiCho(i, i + 1) : ""}
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy || i === khoi.length - 1}
                                >
                                  Xuống
                                </Button>
                              </Form>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setDangSua(k.id)}
                                disabled={busy}
                              >
                                Sửa
                              </Button>
                              <Form
                                method="post"
                                onSubmit={(e) => {
                                  if (!confirm(`Xóa khối ${tenKhoi(k.kind)} số ${i + 1}?`))
                                    e.preventDefault();
                                }}
                              >
                                <input type="hidden" name="intent" value="xoa_khoi" />
                                <input type="hidden" name="id" value={k.id} />
                                <Button type="submit" size="sm" variant="ghost" disabled={busy}>
                                  Xóa
                                </Button>
                              </Form>
                            </div>
                          ) : null}
                        </div>
                        {loiKhoi.length ? (
                          <ul className="mt-2 list-disc pl-5 text-sm">
                            {loiKhoi.map((l, j) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: danh sách chỉ đọc
                              <li key={j} className={l.muc === "loi" ? "text-danger" : "text-warn"}>
                                {l.thong_diep}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <div className="mt-3">
                          {dangSua === k.id ? (
                            <SuaKhoi key={k.id} khoi={k} ban={busy} onDong={() => setDangSua(null)} />
                          ) : (
                            <KhoiNoiDung
                              khoi={{
                                id: k.id,
                                ordinal: k.ordinal,
                                kind: k.kind,
                                data: k.data,
                                citations: k.citations,
                                citationHealth: k.citation_health,
                              }}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <Form method="post" className="mt-4 rounded-xl border border-dashed border-line-strong p-3">
                <input type="hidden" name="intent" value="them_khoi" />
                <input type="hidden" name="ordinal" value={ordinalMoi} />
                <fieldset>
                  <legend className="text-sm font-semibold">Thêm khối vào cuối bài</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {KHOI_SOAN.map((m) => (
                      <Button
                        key={m.kind}
                        type="submit"
                        name="kind"
                        value={m.kind}
                        variant="secondary"
                        disabled={busy}
                        // whitespace-normal! đè whitespace-nowrap của Button: cn chỉ nối lớp, không gộp lớp trùng.
                        className="h-auto min-h-14 w-full min-w-0 flex-col items-start justify-center whitespace-normal! py-2 text-left"
                      >
                        <span>{m.ten}</span>
                        <span className="text-xs font-normal text-ink-3">{m.goiY}</span>
                      </Button>
                    ))}
                  </div>
                </fieldset>
              </Form>
            </>
          )}

          <DanhSachBaiTap hoatDong={hoatDong} busy={busy} />

          {coTheXoa ? (
            <Form
              method="post"
              className="mt-10 border-t border-line pt-4"
              onSubmit={(e) => {
                if (!confirm(`Xóa hẳn bài "${bai.title}" cùng mọi khối nội dung? Không hoàn tác được.`)) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="xoa_bai" />
              <Button type="submit" variant="ghost" disabled={busy} className="text-danger">
                Xóa bài này
              </Button>
            </Form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Bài tập của bài (bảng `activities`), kèm đáp án và rubric: người duyệt phải đọc được cả phần
 * chỉ người chấm thấy trước khi xuất bản bài.
 */
function DanhSachBaiTap({ hoatDong, busy }: { hoatDong: HoatDongQuanTri[]; busy: boolean }) {
  return (
    <div className="mt-10">
      <h3 className="font-sans text-lg font-semibold">Bài tập ({hoatDong.length})</h3>
      <p className="mt-1 text-sm text-ink-2">
        Câu tự luận do AI chấm theo rubric; tiêu chí căn cứ nặng nhất và cho 0 điểm khi dùng văn bản hết hiệu
        lực. Câu trắc nghiệm kiểm tra cuối bài lấy từ ngân hàng câu hỏi theo chủ đề của bài.
      </p>
      {hoatDong.length === 0 ? (
        <EmptyState icon="list" title="Bài chưa có bài tập nào" gon className="mt-4" />
      ) : (
        <ol className="mt-4 space-y-3">
          {hoatDong.map((h, i) => (
            <li key={h.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-ink-3">{i + 1}.</span>
                <span className="font-semibold">{h.title ?? TEN_DANG_BAI[h.kind] ?? h.kind}</span>
                <Badge tone="muted">{TEN_DANG_BAI[h.kind] ?? h.kind}</Badge>
                <span className="text-ink-2">
                  {TEN_CACH_CHAM[h.mode] ?? h.mode} · {h.points} điểm
                </span>
                {h.source !== "nguoi" ? <Badge tone="info">AI soạn</Badge> : null}
                <Form
                  method="post"
                  className="ml-auto"
                  onSubmit={(e) => {
                    if (!confirm("Gỡ bài tập này khỏi bài? Lượt làm cũ vẫn được giữ.")) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="intent" value="go_bai_tap" />
                  <input type="hidden" name="id" value={h.id} />
                  <Button type="submit" size="sm" variant="ghost" disabled={busy}>
                    Gỡ
                  </Button>
                </Form>
              </div>
              <p className="mt-2 text-base leading-relaxed">{h.prompt.cau_hoi}</p>
              {h.prompt.huong_dan ? <p className="mt-1 text-ink-2">{h.prompt.huong_dan}</p> : null}
              {h.prompt.phuong_an?.length ? (
                <ul className="mt-2 space-y-1">
                  {h.prompt.phuong_an.map((p) => (
                    <li key={p.id} className={cn(h.answer.dung?.includes(p.id) && "font-semibold text-ok")}>
                      {p.id}. {p.text}
                      {h.answer.dung?.includes(p.id) ? " (đáp án)" : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {h.answer.giai_thich ? (
                <p className="mt-2 rounded-lg bg-surface-2 p-2">
                  <span className="font-semibold">Gợi ý đáp án (chỉ người chấm thấy): </span>
                  {h.answer.giai_thich}
                </p>
              ) : null}
              {h.rubric.tieu_chi?.length ? (
                <details className="mt-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-primary">
                    Rubric: {h.rubric.tieu_chi.length} tiêu chí, ngưỡng đạt {h.rubric.nguong_dat ?? "?"}%
                  </summary>
                  <ul className="mt-1 space-y-2">
                    {h.rubric.tieu_chi.map((tc) => (
                      <li key={tc.ma}>
                        <span className="font-semibold">{tc.ten}</span> (trọng số {tc.trong_so})
                        <ul className="list-disc pl-5 text-ink-2">
                          {tc.muc.map((m) => (
                            <li key={m.diem}>
                              {m.diem} điểm: {m.mo_ta}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {h.citations.length ? (
                <p className="mt-2 break-all font-mono text-xs text-ink-3">{h.citations.join(", ")}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
