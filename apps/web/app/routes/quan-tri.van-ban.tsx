/**
 * Danh sách văn bản trong kho (quản trị). Admin quản lý tìm văn bản để sửa nội dung, hoặc thêm văn
 * bản mới bằng tệp PDF hoặc Markdown; nạp hàng loạt từ nguồn vẫn đi qua pipeline (LENH.md mục 3).
 */
import { Form, Link } from "react-router";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { docHrefFromUrn } from "../lib/citation";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import { goiApiQuanTri } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { API_VAN_BAN, type DanhMucVanBan, type DongVanBan, duongSuaVanBan } from "../lib/van-ban-quan-tri";
import type { Route } from "./+types/quan-tri.van-ban";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Văn bản", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const p = new URL(request.url).searchParams;
  const loc = { q: p.get("q") ?? "", loai: p.get("loai") ?? "" };
  const trang = Math.max(1, Number(p.get("trang")) || 1);
  const qs = new URLSearchParams({ page: String(trang) });
  if (loc.q) qs.set("q", loc.q);
  if (loc.loai) qs.set("docType", loc.loai);
  const [ds, danhMuc] = await Promise.all([
    goiApiQuanTri<{ total: number; page: number; pages: number; items: DongVanBan[] }>(
      token,
      `${API_VAN_BAN}?${qs}`,
    ),
    goiApiQuanTri<DanhMucVanBan>(token, `${API_VAN_BAN}/loai`),
  ]);
  return { ...ds, loc, loai: danhMuc.items, daXoa: p.get("daXoa") };
}

export default function QuanTriVanBan({ loaderData }: Route.ComponentProps) {
  const { items, total, page, pages, loc, loai, daXoa } = loaderData;
  const lienKet = (trang: number) => {
    const qs = new URLSearchParams();
    if (loc.q) qs.set("q", loc.q);
    if (loc.loai) qs.set("loai", loc.loai);
    qs.set("trang", String(trang));
    return `/quan-tri/van-ban?${qs}`;
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TieuDeTrang as="h2" icon="shield" className="text-2xl font-bold sm:text-3xl">
          Văn bản
        </TieuDeTrang>
        <ButtonLink to="/quan-tri/van-ban/moi" icon="plus" className="min-h-12 px-6">
          Thêm văn bản
        </ButtonLink>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        Sửa nội dung để chữa lỗi số hóa. Khi quy định thay đổi, hãy thêm văn bản sửa đổi thay vì sửa văn bản
        gốc. Thêm văn bản mới nhận tệp PDF có lớp chữ.
      </p>

      {daXoa ? <Notice className="mt-4">Đã xóa văn bản {daXoa}.</Notice> : null}

      <Form
        method="get"
        className="mt-4 grid gap-3 rounded-card bg-primary-soft/50 p-4 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-end"
      >
        <div>
          <Label htmlFor="vb-q">Tìm theo số ký hiệu hoặc tên</Label>
          <div className="relative">
            <Icon
              name="search"
              kieu="net"
              className="pointer-events-none absolute left-4 top-3 size-5 text-ink-2"
            />
            <Input
              id="vb-q"
              name="q"
              type="search"
              defaultValue={loc.q}
              placeholder="Ví dụ: 168/2024/NĐ-CP"
              className="pl-12"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="vb-loai">Loại văn bản</Label>
          <select id="vb-loai" name="loai" defaultValue={loc.loai} className={cn(inputClass, "pr-8")}>
            <option value="">Tất cả loại</option>
            {loai.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="lun flex min-h-11 items-center justify-center gap-2 rounded-btn border border-line-strong bg-surface px-4 text-sm font-semibold text-primary hover:bg-surface-2"
        >
          <Icon name="loc" kieu="net" className="size-5" /> Lọc
        </button>
      </Form>

      <p className="mt-4 text-sm font-semibold text-ink-2">{total} văn bản</p>

      {items.length === 0 ? (
        <div className="mt-2">
          <EmptyState icon="book" title="Không có văn bản nào khớp" />
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((d) => (
            <li
              key={d.urn}
              className="flex items-center gap-4 rounded-card border border-line bg-surface px-3 py-3 sm:gap-5"
            >
              <span
                className="grid size-12 shrink-0 place-items-center rounded-card bg-primary-soft text-primary sm:size-14"
                aria-hidden="true"
              >
                <Icon name="file" kieu="net" className="size-7" />
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-full sm:basis-0">
                  <p className="text-sm text-ink-2">
                    {d.docTypeName} số {d.soKyHieu}
                  </p>
                  <Link
                    to={duongSuaVanBan(d.urn)}
                    className="mt-1 block font-semibold leading-snug hover:text-primary hover:underline"
                  >
                    {d.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                    <StatusBadge status={d.statusAsOf ?? d.status} />
                    {d.coNoiDung ? null : d.coTepGoc ? (
                      <Badge tone="info">Bản quét, hiện tệp PDF</Badge>
                    ) : (
                      <Badge tone="warn">Chưa có nội dung</Badge>
                    )}
                    {d.suaTrongQuanTri ? <Badge tone="info">Đã sửa trong quản trị</Badge> : null}
                    <span className="border-l border-line-strong pl-3">
                      {d.issuedDate ? `Ban hành ${formatDate(d.issuedDate)}` : "Chưa có ngày ban hành"}
                    </span>
                  </div>
                </div>
                {d.coNoiDung || d.coTepGoc ? (
                  <Link
                    to={docHrefFromUrn(d.urn)}
                    className="flex min-h-11 shrink-0 items-center gap-3 text-sm font-semibold text-primary hover:underline"
                  >
                    Xem trang đọc
                    <Icon name="chevronRight" kieu="net" className="size-5" />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {page > 1 ? (
            <ButtonLink to={lienKet(page - 1)} variant="secondary">
              Trang trước
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink-2">
            Trang {page}/{pages}
          </span>
          {page < pages ? (
            <ButtonLink to={lienKet(page + 1)} variant="secondary">
              Trang sau
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
