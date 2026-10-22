/**
 * Nội dung văn bản, hai cách đọc (docs/PLAN.md GĐ1):
 *  - `?dieu=dieu-6`: chỉ Điều đó, kèm nút Điều trước / Điều sau. Kết quả tìm kiếm và thẻ căn
 *    cứ mở thẳng vào chế độ này, cuộn tới đúng khoản qua #dieu-6.khoan-2.
 *  - không có `dieu`: toàn văn; văn bản lớn chia theo từng phần 30 điều (`?tu=dieu-31`).
 * Ngày áp dụng mặc định là hôm nay (giờ Việt Nam), chỉ đổi trong "Xem theo ngày khác".
 */
import { useEffect } from "react";
import { Form, Link, useNavigation, useRevalidator, useRouteLoaderData, useSearchParams } from "react-router";

import { MucLucNganKeo } from "../components/tra-cuu/MucLucNganKeo";
import { type NguCanhDoc, NoiDungDieu } from "../components/tra-cuu/NoiDungDieu";
import { NutSaoChepTrichDan } from "../components/tra-cuu/NutSaoChepTrichDan";
import { Button, ButtonLink, buttonClass } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { ApiKhongTimThay, getDocumentContent, getDocumentUrnBySlug } from "../lib/api";
import { layToken, nguoiDungHienTai } from "../lib/auth.server";
import { formatDate, isIsoDate, todayIso } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, yeuCauVaiTro } from "../lib/session.server";
import {
  buildToc,
  computeWindow,
  dieuLabelFromPath,
  findDieu,
  listDieuPaths,
  sliceWindow,
} from "../lib/tree";
import { API_VAN_BAN, type TienDoDocTepGoc } from "../lib/van-ban-quan-tri";
import type { Route } from "./+types/document.read";
import type { loader as documentLoader } from "./document";

/** Đường API đọc tệp PDF gốc thành nội dung chữ (POST) và hỏi tiến độ đọc bản quét (GET). */
const duongDocTepGoc = (urn: string) => `${API_VAN_BAN}/${encodeURIComponent(urn)}/doc-tep-goc`;

export async function loader({ params, request }: Route.LoaderArgs) {
  const urn = await getDocumentUrnBySlug(params.docType, params.slug);
  const p = new URL(request.url).searchParams;
  const homNay = todayIso();
  const asOfRaw = p.get("asOf");
  const asOf = isIsoDate(asOfRaw) ? asOfRaw : homNay;
  const dieuRaw = (p.get("dieu") ?? "").trim();
  // Liên kết của trang ghi "dieu-15"; người gõ tay "15" hay "3a" cũng hiểu là Điều đó.
  const dieuYeuCau = /^d+[a-zđ]*$/i.test(dieuRaw) ? `dieu-${dieuRaw.toLowerCase()}` : dieuRaw;

  let content: Awaited<ReturnType<typeof getDocumentContent>>;
  try {
    content = await getDocumentContent(urn, asOf);
  } catch (e) {
    if (!(e instanceof ApiKhongTimThay)) throw e;
    // Chưa có nội dung chữ (văn bản nạp từ PDF): trang hiện tệp gốc. Admin quản lý có thêm nút
    // "Đọc bằng AI" và tiến độ đọc bản quét.
    const token = layToken(request);
    const duocDoc = Boolean(token) && duVaiTro(await nguoiDungHienTai(request), "quan_ly");
    const tienDo =
      token && duocDoc
        ? await goiApiQuanTri<TienDoDocTepGoc>(token, duongDocTepGoc(urn)).catch(() => null)
        : null;
    return { cheDo: "chua-co-chu" as const, duocDoc, tienDo };
  }
  const root = content.root;
  const toc = buildToc(root);
  const tenDieu = new Map(toc.filter((t) => t.kind === "dieu").map((t) => [t.path, t] as const));
  const nhanDieu = (path: string | undefined) => {
    if (!path) return undefined;
    const t = tenDieu.get(path);
    return { path, label: t?.label ?? dieuLabelFromPath(path), heading: t?.heading };
  };

  const chung = { asOf, homNay, versionKind: content.versionKind, toc };

  if (dieuYeuCau) {
    const found = findDieu(root, dieuYeuCau);
    if (found) {
      const paths = listDieuPaths(root);
      const i = paths.indexOf(dieuYeuCau);
      return {
        ...chung,
        cheDo: "dieu" as const,
        dieu: found.node,
        nguCanh: found.nguCanh,
        truoc: nhanDieu(paths[i - 1]),
        sau: nhanDieu(paths[i + 1]),
        thieuDieu: null,
      };
    }
  }

  const cuaSo = computeWindow(root, p.get("tu"));
  return {
    ...chung,
    cheDo: "toan-van" as const,
    root: cuaSo.windowed ? sliceWindow(root, cuaSo.from, cuaSo.to) : root,
    cuaSo,
    // Điều được yêu cầu không có tại ngày đang xem (chưa được bổ sung, hoặc số điều sai).
    thieuDieu: !dieuYeuCau
      ? null
      : dieuYeuCau.startsWith("dieu-")
        ? dieuLabelFromPath(dieuYeuCau)
        : `mục “${dieuYeuCau.slice(0, 50)}”`,
  };
}

/**
 * Nút "Đọc bằng AI": Admin quản lý cho đọc tệp PDF gốc thành nội dung chữ, lưu chung cho mọi người
 * đọc. PDF có lớp chữ xong ngay; bản quét chạy nền, trang tự hỏi lại tiến độ.
 */
export async function action({ params, request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const urn = await getDocumentUrnBySlug(params.docType, params.slug);
  try {
    await goiApiQuanTri(token, duongDocTepGoc(urn), { method: "POST", timeoutMs: 120_000 });
    return { loi: null };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

/** Văn bản chưa có nội dung chữ: hiện tệp PDF gốc, cùng cách với trang biểu mẫu. */
function TepGoc({
  href,
  tieuDe,
  coTep,
  soTrang,
  duocDoc,
  tienDo,
  loi,
}: {
  href: string;
  tieuDe: string;
  coTep: boolean;
  soTrang: number;
  /** Admin quản lý trở lên: có nút "Đọc bằng AI". */
  duocDoc: boolean;
  tienDo: TienDoDocTepGoc | null;
  loi: string | null;
}) {
  const dangGui = useNavigation().state === "submitting";
  const dangDoc = tienDo?.state === "cho" || tienDo?.state === "dang_chay";
  const revalidator = useRevalidator();
  // Bản quét đang được đọc: hỏi lại tiến độ; đọc xong thì loader trả nội dung chữ và trang đổi theo.
  useEffect(() => {
    if (!dangDoc) return;
    const hen = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 4000);
    return () => clearInterval(hen);
  }, [dangDoc, revalidator]);

  if (!coTep) return <Notice>Văn bản này chưa có nội dung trong kho.</Notice>;
  return (
    <div>
      <Notice>
        Văn bản này đang hiện bằng tệp PDF gốc, chưa có bản chữ: chưa tìm kiếm được trong nội dung và chưa dẫn
        tới từng Điều, khoản.
      </Notice>
      {duocDoc ? (
        <div className="mt-3 rounded-xl border border-line bg-surface p-4">
          {dangDoc ? (
            <p role="status" className="text-sm text-ink-2">
              {tienDo?.soCum
                ? `AI đang đọc tệp: xong ${tienDo.cumXong ?? 0}/${tienDo.soCum} cụm trang.`
                : "AI đang bắt đầu đọc tệp."}{" "}
              Việc này mất vài phút, trang tự cập nhật; bạn có thể rời trang rồi quay lại.
            </p>
          ) : (
            <Form method="post">
              {loi || tienDo?.state === "loi" ? (
                <Notice tone="danger" className="mb-3">
                  {loi ??
                    `Lần đọc trước bị lỗi: ${tienDo?.error ?? "không rõ"}. Bấm Đọc bằng AI để chạy tiếp.`}
                </Notice>
              ) : null}
              <Button type="submit" disabled={dangGui}>
                {dangGui ? "Đang đọc…" : "Đọc bằng AI"}
              </Button>
              <p className="mt-2 text-sm text-ink-3">
                Chuyển tệp PDF thành bản chữ cho mọi người đọc. Tệp bôi đen được chữ thì lấy chữ sẵn có, xong
                ngay. Bản quét thì AI đọc từng trang: mất vài phút và tốn chi phí AI. Bản chữ chưa có người
                soát, hãy đối chiếu với tệp gốc.
              </p>
            </Form>
          )}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={href} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary" })}>
          Mở tệp PDF
        </a>
        <a href={`${href}?tai=1`} className={buttonClass({ variant: "secondary" })}>
          Tải về
        </a>
      </div>
      <iframe
        src={href}
        title={`Tệp PDF gốc: ${tieuDe}`}
        className="mt-4 hidden h-[80vh] w-full rounded-2xl border border-line bg-surface md:block"
      />
      {/* Điện thoại thường không hiện PDF trong khung: thay bằng ảnh từng trang, tải dần khi cuộn tới. */}
      <ol className="mt-4 space-y-3 md:hidden">
        {Array.from({ length: soTrang }, (_, i) => i + 1).map((trang) => (
          <li key={trang}>
            <img
              src={`${href}/trang/${trang}`}
              alt={`Trang ${trang} trên ${soTrang}`}
              loading="lazy"
              // Chỗ giữ sẵn trước khi ảnh về, để trình duyệt chỉ tải các trang gần màn hình.
              className="h-auto min-h-[60vw] w-full rounded-lg border border-line bg-white"
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function DocumentRead({ loaderData: data, actionData }: Route.ComponentProps) {
  const layout = useRouteLoaderData<typeof documentLoader>("routes/document");
  const [params] = useSearchParams();
  if (!layout) return null;
  const meta = layout.detail.meta;
  const base = layout.basePath;
  if (data.cheDo === "chua-co-chu") {
    return (
      <TepGoc
        href={`${base}/tep-goc`}
        tieuDe={meta.title}
        coTep={layout.detail.coTepGoc}
        soTrang={layout.detail.soTrangTepGoc}
        duocDoc={data.duocDoc}
        tienDo={data.tienDo}
        loi={actionData?.loi ?? null}
      />
    );
  }

  /** Giữ ngày đang xem khi chuyển điều. */
  const voiNgay = (extra: Record<string, string>) => {
    const qs = new URLSearchParams(extra);
    if (data.asOf !== data.homNay) qs.set("asOf", data.asOf);
    return `${base}?${qs.toString()}`;
  };
  const hrefDieu = (path: string) => voiNgay({ dieu: path });
  const ctx: NguCanhDoc = {
    meta,
    asOf: data.asOf,
    versionKind: data.versionKind,
    ...(data.cheDo === "toan-van" ? { lienKetDieu: hrefDieu } : {}),
  };

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-2">
        <MucLucNganKeo
          muc={data.toc}
          hrefDieu={hrefDieu}
          dangDoc={data.cheDo === "dieu" ? data.dieu.path : undefined}
        />
        {data.cheDo === "dieu" ? (
          <ButtonLink to={data.asOf !== data.homNay ? `${base}?asOf=${data.asOf}` : base} variant="ghost">
            Đọc toàn văn
          </ButtonLink>
        ) : null}
      </div>

      <details
        className="no-print mt-3 rounded-lg border border-line bg-surface px-4"
        open={data.asOf !== data.homNay}
      >
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-2">
          <Icon name="calendar" className="size-4" />
          {data.asOf === data.homNay
            ? `Nội dung áp dụng hôm nay, ${formatDate(data.asOf)}`
            : `Nội dung áp dụng ngày ${formatDate(data.asOf)}`}
          <span className="ml-auto font-medium text-primary">Xem theo ngày khác</span>
        </summary>
        <Form method="get" action={base} className="flex flex-wrap items-end gap-3 pb-4">
          {params.get("dieu") ? <input type="hidden" name="dieu" value={params.get("dieu") ?? ""} /> : null}
          <div>
            <label htmlFor="doc-ngay" className="mb-1.5 block text-sm font-medium text-ink-2">
              Xem nội dung áp dụng tại ngày
            </label>
            <input
              id="doc-ngay"
              name="asOf"
              type="date"
              defaultValue={data.asOf}
              className="min-h-11 rounded-lg border border-line-strong bg-surface px-3 text-[15px]"
            />
          </div>
          <button
            type="submit"
            className="lun min-h-11 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-2"
          >
            Xem ngày này
          </button>
        </Form>
      </details>

      {data.versionKind === "consolidated_auto" ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-3">
          Nội dung đã cập nhật các lần sửa đổi, bổ sung có hiệu lực đến ngày {formatDate(data.asOf)}, do hệ
          thống tự tổng hợp và chỉ có giá trị tham khảo. Căn cứ chính thức là văn bản gốc và các văn bản sửa
          đổi, bổ sung.
        </p>
      ) : null}

      {data.cheDo === "dieu" ? (
        <>
          {data.nguCanh.length ? <p className="mt-6 text-sm text-ink-3">{data.nguCanh.join(" · ")}</p> : null}
          <NoiDungDieu node={data.dieu} ctx={ctx} />
          <div className="no-print mt-6">
            <NutSaoChepTrichDan
              meta={meta}
              path={data.dieu.path}
              asOf={data.asOf}
              versionKind={data.versionKind}
            />
          </div>
          <nav
            aria-label="Chuyển điều"
            className="no-print mt-8 grid gap-3 border-t border-line pt-6 sm:grid-cols-2"
          >
            {data.truoc ? (
              <Link
                to={hrefDieu(data.truoc.path)}
                className="flex min-h-14 flex-col justify-center rounded-xl border border-line bg-surface px-4 py-2 dong-bam"
              >
                <span className="flex items-center gap-1 text-sm text-ink-3">
                  <Icon name="arrowLeft" className="size-4" />
                  Điều trước
                </span>
                <span className="line-clamp-1 font-semibold">
                  {data.truoc.label}
                  {data.truoc.heading ? `. ${data.truoc.heading}` : ""}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {data.sau ? (
              <Link
                to={hrefDieu(data.sau.path)}
                className="flex min-h-14 flex-col justify-center rounded-xl border border-line bg-surface px-4 py-2 text-right dong-bam"
              >
                <span className="flex items-center justify-end gap-1 text-sm text-ink-3">
                  Điều sau
                  <Icon name="arrowRight" className="size-4" />
                </span>
                <span className="line-clamp-1 font-semibold">
                  {data.sau.label}
                  {data.sau.heading ? `. ${data.sau.heading}` : ""}
                </span>
              </Link>
            ) : null}
          </nav>
        </>
      ) : (
        <>
          {data.thieuDieu ? (
            <Notice className="mt-4">
              Văn bản không có {data.thieuDieu} tại ngày {formatDate(data.asOf)}. Dưới đây là toàn văn.
            </Notice>
          ) : null}
          {data.cuaSo.windowed ? (
            <p className="mt-4 text-sm text-ink-3">
              Văn bản có {data.cuaSo.totalDieu} điều. Đang hiển thị từ{" "}
              {dieuLabelFromPath(data.cuaSo.firstLabel)} đến {dieuLabelFromPath(data.cuaSo.lastLabel)}.
            </p>
          ) : null}
          <article>
            {data.root.children.map((child) => (
              <NoiDungDieu key={child.path || child.label} node={child} ctx={ctx} />
            ))}
          </article>
          {data.cuaSo.windowed ? (
            <nav
              aria-label="Chuyển phần văn bản"
              className="no-print mt-8 flex flex-wrap justify-between gap-3"
            >
              {data.cuaSo.prevPath ? (
                <ButtonLink to={voiNgay({ tu: data.cuaSo.prevPath })} variant="secondary">
                  Phần trước
                </ButtonLink>
              ) : (
                <span />
              )}
              {data.cuaSo.nextPath ? (
                <ButtonLink
                  to={voiNgay({ tu: data.cuaSo.nextPath })}
                  variant="secondary"
                  className="ml-auto max-w-full whitespace-normal py-2 text-center"
                >
                  Phần sau, từ {dieuLabelFromPath(data.cuaSo.nextPath)}
                </ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
