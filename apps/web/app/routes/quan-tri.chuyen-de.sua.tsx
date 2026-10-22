/**
 * Tạo và sửa chuyên đề bài giảng. Một tệp phục vụ hai route: /quan-tri/chuyen-de/moi và
 * /quan-tri/chuyen-de/:slug.
 *
 * Slug là khóa của chuyên đề (API lưu theo slug), nên chỉ đặt khi tạo, sau đó khóa lại. Trang
 * chuyên đề đã có kèm lộ trình bài và kết quả bảng kiểm của từng bài.
 *
 * Chuyên đề do AI soạn (tạo từ tệp PDF) có thêm khung tiến độ, tự tải lại mỗi 4 giây khi còn việc
 * đang chạy, và một nút đưa mọi bài đạt bảng kiểm tới duyệt hoặc xuất bản trong một lần bấm.
 */
import { useEffect, useState } from "react";
import { Form, Link, redirect, useNavigation, useRevalidator } from "react-router";

import { NutTrangThai } from "../components/quan-tri/NutTrangThai";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { cn } from "../lib/cn";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import {
  type BangKiemChuyenDe,
  type ChiTietChuyenDe,
  homNay,
  type KetQuaChuyenNhieuBai,
  type LinhVucQuanTri,
  TEN_CAP_DO,
  TEN_NHOM_DOI_TUONG,
  TEN_TRANG_THAI,
  type TienDoSoan,
  TONE_TRANG_THAI,
  type TrangThaiNoiDung,
  taoSlug,
  trangThaiDatDuoc,
} from "../lib/soan-bai-giang";
import type { Route } from "./+types/quan-tri.chuyen-de.sua";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.chiTiet ? data.chiTiet.chuyenDe.title : "Tạo chuyên đề", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const { items: linhVuc } = await goiApiQuanTri<{ items: LinhVucQuanTri[] }>(
    token,
    "/v1/quan-tri/dao-tao/linh-vuc",
  );
  if (!params.slug) {
    return {
      linhVuc,
      chiTiet: null,
      bangKiem: null,
      datDuoc: [],
      tienDo: null,
      coTheXuatBan: false,
      deThiKem: null,
    };
  }

  const slug = encodeURIComponent(params.slug);
  let chiTiet: ChiTietChuyenDe;
  try {
    chiTiet = await goiApiQuanTri<ChiTietChuyenDe>(token, `/v1/quan-tri/dao-tao/chuyen-de/${slug}`);
  } catch (e) {
    if (e instanceof LoiApi && e.status === 404)
      throw new Response("Không tìm thấy chuyên đề.", { status: 404 });
    throw e;
  }
  const [bangKiem, { tien_do: tienDo }] = await Promise.all([
    goiApiQuanTri<BangKiemChuyenDe>(token, `/v1/quan-tri/dao-tao/chuyen-de/${slug}/kiem-tra`),
    goiApiQuanTri<{ tien_do: TienDoSoan | null }>(
      token,
      `/v1/quan-tri/dao-tao/chuyen-de/${chiTiet.chuyenDe.id}/soan`,
    ),
  ]);
  const datDuoc = trangThaiDatDuoc(chiTiet.chuyenDe.status, (v) => duVaiTro(nguoiDung, v));
  // `?deThi=`: đề thi vừa tạo kèm chuyên đề này từ cùng một tệp PDF.
  const deThi = new URL(request.url).searchParams.get("deThi") ?? "";
  return {
    linhVuc,
    chiTiet,
    bangKiem,
    datDuoc,
    tienDo,
    coTheXuatBan: duVaiTro(nguoiDung, "quan_ly"),
    deThiKem: /^[0-9a-f-]{36}$/.test(deThi) ? deThi : null,
  };
}

type KetQua = { loi: string } | { ok: string };

export async function action({ request, params }: Route.ActionArgs): Promise<KetQua> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "luu");
  try {
    if ((intent === "xuat_ban_tat_ca" || intent === "gui_phap_che_tat_ca") && params.slug) {
      const den = intent === "xuat_ban_tat_ca" ? "xuat_ban" : "cho_phap_che";
      const kq = await goiApiQuanTri<KetQuaChuyenNhieuBai>(
        token,
        `/v1/quan-tri/dao-tao/chuyen-de/${String(f.get("id") ?? "")}/bai/trang-thai`,
        { body: { den } },
      );
      const viec = den === "xuat_ban" ? "xuất bản" : "gửi duyệt";
      const boQua = kq.bo_qua.length
        ? `${kq.bo_qua.length} bài chưa đạt bảng kiểm nên giữ nguyên: ${kq.bo_qua.map((b) => b.title).join("; ")}.`
        : "";
      if (!kq.da_chuyen.length) return { loi: boQua || "Không còn bài nào để chuyển." };
      return { ok: `Đã ${viec} ${kq.da_chuyen.length} bài. ${boQua}`.trim() };
    }

    if (intent === "soan_tiep" && params.slug) {
      const kq = await goiApiQuanTri<{ da_chay: boolean }>(
        token,
        `/v1/quan-tri/dao-tao/chuyen-de/${String(f.get("id") ?? "")}/soan-tiep`,
        {
          body: {
            so_ky_hieu: String(f.get("so_ky_hieu") ?? "").trim() || undefined,
            loai: String(f.get("loai") ?? "").trim() || undefined,
          },
        },
      );
      return { ok: kq.da_chay ? "Đã chạy tiếp phần soạn còn dở." : "Không còn phần nào dang dở." };
    }

    if (intent === "trang_thai" && params.slug) {
      const trangThai = String(f.get("trangThai") ?? "");
      const id = String(f.get("id") ?? "");
      await goiApiQuanTri(token, `/v1/quan-tri/dao-tao/chuyen-de/${id}/trang-thai`, { body: { trangThai } });
      return {
        ok: `Đã chuyển chuyên đề sang "${TEN_TRANG_THAI[trangThai as keyof typeof TEN_TRANG_THAI]}".`,
      };
    }

    const slug = params.slug ?? String(f.get("slug") ?? "").trim();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { loi: "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang." };
    }
    if (!params.slug) {
      // API lưu theo slug: slug trùng sẽ ghi đè chuyên đề đang có, nên chặn trước.
      const trung = await goiApiQuanTri(token, `/v1/quan-tri/dao-tao/chuyen-de/${slug}`).then(
        () => true,
        (e) => {
          if (e instanceof LoiApi && e.status === 404) return false;
          throw e;
        },
      );
      if (trung) return { loi: `Đường dẫn "${slug}" đã có chuyên đề khác dùng. Hãy đặt đường dẫn khác.` };
    }
    const fieldId = String(f.get("fieldId") ?? "");
    const body = {
      slug,
      title: String(f.get("title") ?? "").trim(),
      summary: String(f.get("summary") ?? "").trim() || null,
      fieldId: fieldId || null,
      audienceGroup: String(f.get("audienceGroup") ?? "khach_hang"),
      level: String(f.get("level") ?? "co_ban"),
      asOf: String(f.get("asOf") ?? ""),
      ordinal: Number(f.get("ordinal") ?? 0) || 0,
    };
    if (body.title.length < 3) return { loi: "Tên chuyên đề cần ít nhất 3 ký tự." };
    await goiApiQuanTri(token, "/v1/quan-tri/dao-tao/chuyen-de", { body });
    if (!params.slug) throw redirect(`/quan-tri/chuyen-de/${slug}`);
    return { ok: "Đã lưu chuyên đề." };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

/** Bài ở trạng thái này còn chuyển được tới đích bằng nút chuyển nhiều bài. */
const CON_CHUYEN: Record<"cho_phap_che" | "xuat_ban", TrangThaiNoiDung[]> = {
  cho_phap_che: ["nhap", "ai_soan", "bien_tap", "can_cap_nhat"],
  xuat_ban: ["nhap", "ai_soan", "bien_tap", "cho_phap_che", "can_cap_nhat"],
};

/** Khung tiến độ AI soạn chuyên đề: đọc bản quét, lập dàn ý, soạn từng bài; lỗi thì có nút chạy tiếp. */
function KhungTienDo({ tienDo, id, ban }: { tienDo: TienDoSoan; id: string; ban: boolean }) {
  const { doc_pdf: doc, soan } = tienDo;
  let buoc: string;
  let phanTram: number | null = null;
  if (doc?.state === "loi") buoc = "Chưa đọc xong tệp PDF.";
  else if (doc && doc.state !== "xong") {
    buoc = doc.so_cum
      ? `AI đang đọc bản quét ${doc.so_trang} trang: xong ${doc.cum_xong}/${doc.so_cum} cụm trang.`
      : `AI đang đọc bản quét ${doc.so_trang} trang.`;
    phanTram = doc.so_cum ? Math.round((doc.cum_xong / doc.so_cum) * 100) : null;
  } else if (!soan || (soan.state !== "xong" && soan.state !== "loi" && !soan.so_viec)) {
    buoc = "AI đang lập dàn ý các bài từ văn bản.";
  } else if (soan.state === "loi" && !soan.so_viec) {
    buoc = "Chưa lập được dàn ý.";
  } else if (tienDo.dang_chay) {
    buoc = `AI đang soạn bài: xong ${soan.xong}/${soan.so_viec} phần.`;
    phanTram = soan.so_viec ? Math.round((soan.xong / soan.so_viec) * 100) : null;
  } else if (tienDo.con_loi) {
    buoc = `AI đã soạn ${soan.xong}/${soan.so_viec} phần, phần còn lại bị lỗi.`;
  } else {
    buoc = `AI đã soạn xong ${soan.xong}/${soan.so_viec} phần. Xem lại các bài bên dưới rồi xuất bản.`;
  }
  const loi = doc?.state === "loi" ? doc.error : soan?.state === "loi" ? soan.error : (soan?.loi_dau ?? null);

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      <h3 className="font-sans text-base font-semibold">Tiến độ AI soạn</h3>
      <p className="mt-1 text-sm text-ink-2" aria-live="polite">
        {buoc}
      </p>
      {tienDo.dang_chay ? (
        <progress
          className="mt-3 h-2 w-full"
          {...(phanTram === null ? {} : { value: phanTram, max: 100 })}
          aria-label="Tiến độ AI soạn"
        />
      ) : null}
      {doc && doc.so_cho_khong_doc > 0 ? (
        <p className="mt-2 text-sm text-danger">
          Bản quét có {doc.so_cho_khong_doc} chỗ AI không đọc được. Hãy soát lại văn bản ở mục Văn bản.
        </p>
      ) : null}
      {tienDo.con_loi && !tienDo.dang_chay ? (
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="soan_tiep" />
          <input type="hidden" name="id" value={id} />
          <Notice tone="danger">
            {soan && soan.loi > 0 ? `${soan.loi} phần soạn bị lỗi. ` : ""}
            {loi ?? "Việc soạn bị lỗi."}
          </Notice>
          {doc?.state === "loi" ? (
            <div className="max-w-xs">
              <Label htmlFor="td-so-ky-hieu">Số ký hiệu văn bản (nếu AI không đọc được)</Label>
              <Input id="td-so-ky-hieu" name="so_ky_hieu" placeholder="12/2026/TT-BCA" maxLength={100} />
            </div>
          ) : null}
          <Button type="submit" variant="secondary" disabled={ban}>
            Chạy tiếp
          </Button>
        </Form>
      ) : null}
    </div>
  );
}

export default function SuaChuyenDe({ loaderData, actionData }: Route.ComponentProps) {
  const { linhVuc, chiTiet, bangKiem, datDuoc, tienDo, coTheXuatBan, deThiKem } = loaderData;
  const busy = useNavigation().state !== "idle";
  const revalidator = useRevalidator();
  const dangSoan = Boolean(tienDo?.dang_chay);
  useEffect(() => {
    if (!dangSoan) return;
    const hen = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 4000);
    return () => clearInterval(hen);
  }, [dangSoan, revalidator]);
  const cd = chiTiet?.chuyenDe ?? null;
  const [slug, setSlug] = useState("");
  const [slugDaSua, setSlugDaSua] = useState(false);
  const kiemTheoBai = new Map((bangKiem?.theoBai ?? []).map((b) => [b.id, b]));
  const baiTiepTheo = (chiTiet?.bai.reduce((m, b) => Math.max(m, b.ordinal), 0) ?? 0) + 1;
  const denHangLoat = coTheXuatBan ? "xuat_ban" : "cho_phap_che";
  const soBaiConChuyen = chiTiet?.bai.filter((b) => CON_CHUYEN[denHangLoat].includes(b.status)).length ?? 0;

  return (
    <section>
      <Link
        to="/quan-tri/chuyen-de"
        className="hidden min-h-11 items-center text-sm font-medium text-primary md:flex"
      >
        Về danh sách chuyên đề
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{cd ? cd.title : "Tạo chuyên đề"}</h2>
        {cd ? (
          <Badge tone={TONE_TRANG_THAI[cd.status] ?? "muted"}>{TEN_TRANG_THAI[cd.status] ?? cd.status}</Badge>
        ) : null}
        {cd?.status === "xuat_ban" ? (
          <Link
            to={`/hoc/${cd.slug}`}
            className="flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            Xem trang học viên
          </Link>
        ) : null}
      </div>

      {actionData && "loi" in actionData ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}
      {actionData && "ok" in actionData ? <Notice className="mt-4">{actionData.ok}</Notice> : null}

      {cd && deThiKem ? (
        <Notice className="mt-4">
          Một đề thi từ cùng văn bản đang được AI sinh câu hỏi.{" "}
          <Link to={`/quan-tri/de-thi/${deThiKem}`} className="font-semibold underline">
            Mở đề thi
          </Link>
        </Notice>
      ) : null}

      {cd && !cd.fieldId ? (
        <Notice tone="danger" className="mt-4">
          Chuyên đề chưa gắn lĩnh vực nên không hiện ở trang Học, kể cả khi đã xuất bản.
        </Notice>
      ) : null}

      {cd ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-ink-2">
            Thứ tự duyệt: Bản nháp → Đang biên tập → Chờ duyệt → Đã xuất bản. Xuất bản cần vai trò
            Admin quản lý trở lên.
          </p>
          <NutTrangThai datDuoc={datDuoc} ban={busy} an={{ id: cd.id }} />
        </div>
      ) : null}

      {cd && tienDo ? <KhungTienDo tienDo={tienDo} id={cd.id} ban={busy} /> : null}

      {cd && chiTiet ? (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-sans text-lg font-semibold">Bài học</h3>
              <p className="mt-1 text-sm text-ink-2">
                Bài chỉ hiện với học viên khi đã xuất bản. Bài phải qua bảng kiểm mới xuất bản được.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {soBaiConChuyen > 0 && !dangSoan ? (
                <Form method="post">
                  <input type="hidden" name="id" value={cd.id} />
                  <Button
                    type="submit"
                    name="intent"
                    value={coTheXuatBan ? "xuat_ban_tat_ca" : "gui_phap_che_tat_ca"}
                    disabled={busy}
                  >
                    {coTheXuatBan ? "Xuất bản cả chuyên đề" : "Gửi duyệt tất cả"}
                  </Button>
                </Form>
              ) : null}
              <ButtonLink
                to={`/quan-tri/chuyen-de/${cd.slug}/bai/moi?thuTu=${baiTiepTheo}`}
                variant="secondary"
              >
                Thêm bài
              </ButtonLink>
            </div>
          </div>
          {chiTiet.bai.length === 0 ? (
            <EmptyState icon="book" title="Chuyên đề chưa có bài nào" gon className="mt-4" />
          ) : (
            <ol className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
              {chiTiet.bai.map((b) => {
                const kt = kiemTheoBai.get(b.id);
                const soLoi = kt?.loi.filter((l) => l.muc === "loi").length ?? 0;
                return (
                  <li key={b.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-sm text-ink-3">{b.ordinal}.</span>
                      <Link
                        to={`/quan-tri/chuyen-de/${cd.slug}/bai/${b.id}`}
                        className="flex min-h-11 items-center font-semibold hover:text-primary hover:underline"
                      >
                        {b.title}
                      </Link>
                      <Badge tone={TONE_TRANG_THAI[b.status] ?? "muted"}>
                        {TEN_TRANG_THAI[b.status] ?? b.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-ink-2">
                      {b.soKhoi} khối · khoảng {kt?.phut ?? b.estimatedMinutes} phút ·{" "}
                      <span className={soLoi ? "text-danger" : "text-ok"}>
                        {soLoi ? `${soLoi} lỗi chặn xuất bản` : "đạt bảng kiểm"}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}

      {cd ? <h3 className="mt-10 font-sans text-lg font-semibold">Thông tin chuyên đề</h3> : null}
      <Form method="post" className={cd ? "mt-4 space-y-6" : "mt-6 space-y-6"}>
        <input type="hidden" name="intent" value="luu" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="cd-ten">Tên chuyên đề</Label>
            <Input
              id="cd-ten"
              name="title"
              required
              minLength={3}
              defaultValue={cd?.title ?? ""}
              onChange={(e) => {
                if (!cd && !slugDaSua) setSlug(taoSlug(e.target.value));
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cd-slug">Đường dẫn</Label>
            {cd ? (
              <p id="cd-slug" className="font-mono text-sm text-ink-2">
                /hoc/{cd.slug}
              </p>
            ) : (
              <>
                <Input
                  id="cd-slug"
                  name="slug"
                  required
                  pattern="[a-z0-9\-]+"
                  value={slug}
                  onChange={(e) => {
                    setSlugDaSua(true);
                    setSlug(e.target.value);
                  }}
                  aria-describedby="cd-slug-goi-y"
                  className="font-mono"
                />
                <p id="cd-slug-goi-y" className="mt-1 text-xs text-ink-3">
                  Chữ thường không dấu, số và dấu gạch ngang. Không đổi được sau khi tạo.
                </p>
              </>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cd-tom-tat">Tóm tắt (không bắt buộc)</Label>
            <textarea
              id="cd-tom-tat"
              name="summary"
              rows={3}
              defaultValue={cd?.summary ?? ""}
              className={cn(inputClass, "py-2")}
            />
          </div>
          <div>
            <Label htmlFor="cd-linh-vuc">Lĩnh vực</Label>
            <select id="cd-linh-vuc" name="fieldId" defaultValue={cd?.fieldId ?? ""} className={inputClass}>
              <option value="">Chưa gắn</option>
              {linhVuc.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cd-nhom">Nhóm người học</Label>
            <select
              id="cd-nhom"
              name="audienceGroup"
              defaultValue={cd?.audienceGroup ?? "khach_hang"}
              className={inputClass}
            >
              {Object.entries(TEN_NHOM_DOI_TUONG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cd-cap">Cấp độ</Label>
            <select id="cd-cap" name="level" defaultValue={cd?.level ?? "co_ban"} className={inputClass}>
              {Object.entries(TEN_CAP_DO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cd-as-of">Quy định tính đến ngày</Label>
            <Input id="cd-as-of" name="asOf" type="date" required defaultValue={cd?.asOf || homNay()} />
          </div>
          <div>
            <Label htmlFor="cd-thu-tu">Thứ tự trong lĩnh vực</Label>
            <Input
              id="cd-thu-tu"
              name="ordinal"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              defaultValue={cd?.ordinal ?? 0}
            />
          </div>
        </div>

        <ThanhLuuBieuMau
          loi={actionData && "loi" in actionData ? actionData.loi : null}
          ok={actionData && "ok" in actionData ? actionData.ok : null}
        >
          <Button type="submit" disabled={busy} className="min-h-12 w-full md:w-auto">
            {cd ? "Lưu chuyên đề" : "Tạo chuyên đề (bản nháp)"}
          </Button>
        </ThanhLuuBieuMau>
      </Form>
    </section>
  );
}
