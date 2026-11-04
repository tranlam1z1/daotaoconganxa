import { Link } from "react-router";
import { nguonAnToan, voiNgay } from "../../lib/bo-loc-van-ban";
import { cn } from "../../lib/cn";
import {
  DOC_STATUS_LABEL,
  DOC_STATUS_TONE,
  docTypeLabel,
  formatDate,
  NODE_STATUS_LABEL,
  type Tone,
} from "../../lib/format";
import { highlightSnippet } from "../../lib/markdown";
import type { DieuKhop, VanBanTraCuu } from "../../lib/tra-cuu-van-ban";
import { Icon } from "../ui/Icon";

/** Số điều, khoản khớp hiện sẵn dưới thẻ; phần còn lại nằm trong "Xem thêm". */
const SO_KHOP_HIEN = 3;

const MAU_CHU: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-info",
  muted: "text-muted",
};

/**
 * Đoạn trích từ API đã có thẻ <mark> (ts_headline, khớp theo từ gốc). Escape toàn bộ rồi chỉ
 * khôi phục đúng thẻ mark; đoạn trích không có mark thì tô từ khóa ở phía giao diện.
 */
function doanTrichHtml(snippet: string, q: string): string {
  if (!snippet.includes("<mark>")) return highlightSnippet(snippet, q);
  return highlightSnippet(snippet, "")
    .replaceAll("&lt;mark&gt;", "<mark>")
    .replaceAll("&lt;/mark&gt;", "</mark>");
}

/**
 * Thẻ một văn bản ở trang /tim-kiem: số văn bản, ngày ban hành, số thứ tự, tên, loại và hiệu lực.
 * Phần trên là một liên kết mở văn bản; khi đang tra theo từ khóa, bên dưới liệt kê các điều, khoản
 * khớp, mỗi dòng mở thẳng điều đó.
 */
export function TheVanBan({ vb, stt, q }: { vb: VanBanTraCuu; stt: number; q: string }) {
  const con = vb.khop.slice(SO_KHOP_HIEN);
  return (
    <li className="rounded-2xl border border-line bg-surface shadow-card">
      <Link to={voiNgay(vb.href, vb.asOf)} className="block rounded-2xl p-4 dong-bam">
        <span className="flex items-center justify-between gap-3 text-sm text-ink-3">
          <span className="min-w-0 break-words">Số văn bản: {vb.soKyHieu}</span>
          {vb.ngayBanHanh ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Icon name="clock" kieu="net" className="size-4" />
              <span className="sr-only">Ngày ban hành:</span>
              <time dateTime={vb.ngayBanHanh}>{formatDate(vb.ngayBanHanh)}</time>
            </span>
          ) : null}
        </span>
        <span className="mt-3 flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">
            {stt}
          </span>
          <span className="min-w-0 self-center text-base leading-snug font-semibold break-words">
            {vb.tieuDe}
          </span>
        </span>
        <span className="mt-3 block overflow-hidden border-t border-line pt-3 text-sm text-ink-3">
          {/* Vạch ngăn là viền trái của từng mục; lề âm đẩy viền của mục đầu dòng ra ngoài khung,
              nên khi mục thứ hai xuống dòng (màn hình hẹp, trạng thái dài) không còn vạch thừa. */}
          <span className="-ml-[9px] flex flex-wrap gap-x-2 gap-y-1">
            <span className="border-l border-line-strong pl-2">
              Loại văn bản: <strong className="font-semibold text-ink">{docTypeLabel(vb.docType)}</strong>
            </span>
            <span className="border-l border-line-strong pl-2">
              {vb.documentGroup === "dang" ? "Trạng thái ghi nhận:" : "Hiệu lực:"}{" "}
              <strong className={cn("font-semibold", MAU_CHU[DOC_STATUS_TONE[vb.status]])}>
                {DOC_STATUS_LABEL[vb.status]}
              </strong>
            </span>
          </span>
        </span>
      </Link>
      <div className="border-t border-line px-4 py-3 text-sm text-ink-2">
        <p>
          {vb.issuer || "Chưa có cơ quan ban hành"}
          {vb.effectiveFrom ? ` · Có hiệu lực từ ${formatDate(vb.effectiveFrom)}` : ""}
        </p>
        <p className="mt-1">
          Nguồn:{" "}
          {nguonAnToan(vb.primarySource) ? (
            <a
              href={nguonAnToan(vb.primarySource)}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Mở nguồn văn bản
            </a>
          ) : vb.primarySource === "quan-tri" ? (
            "Nhập trong quản trị"
          ) : (
            "Chưa có đường dẫn nguồn"
          )}
        </p>
        <Link
          to={voiNgay(`${vb.href}/thuoc-tinh`, vb.asOf)}
          className="mt-1 inline-flex min-h-11 items-center text-primary underline"
        >
          Thuộc tính và bản gốc
        </Link>
      </div>
      {vb.khop.length ? (
        <div className="border-t border-line px-4 pt-3 pb-4">
          <p className="text-sm text-ink-3">
            {(vb.matchCount ?? vb.khop.length).toLocaleString("vi-VN")} mục nội dung khớp từ khóa
            {vb.matchCount && vb.matchCount > vb.khop.length
              ? ` · Hiển thị ${vb.khop.length} đoạn trích`
              : ""}
          </p>
          <ul className="mt-2 grid gap-2">
            {vb.khop.slice(0, SO_KHOP_HIEN).map((k) => (
              <DongKhop key={k.path} k={{ ...k, href: voiNgay(k.href, vb.asOf) }} q={q} />
            ))}
          </ul>
          {con.length ? (
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
                Xem thêm {con.length.toLocaleString("vi-VN")} điều, khoản khớp
              </summary>
              <ul className="grid gap-2">
                {con.map((k) => (
                  <DongKhop key={k.path} k={{ ...k, href: voiNgay(k.href, vb.asOf) }} q={q} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function DongKhop({ k, q }: { k: DieuKhop; q: string }) {
  return (
    <li>
      <Link to={k.href} className="block rounded-xl border border-line px-3 py-2 dong-bam">
        <span className="block text-[15px] font-semibold text-primary">{k.nhan}</span>
        {k.trangThai && k.trangThai !== "active" ? (
          <span className="mt-1 block text-sm text-warn">
            {NODE_STATUS_LABEL[k.trangThai as keyof typeof NODE_STATUS_LABEL] ||
              "Cần đối chiếu trạng thái điều khoản"}
          </span>
        ) : null}
        {k.snippet ? (
          <span
            className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-ink-2 [&_mark]:rounded-sm [&_mark]:bg-warn-soft [&_mark]:px-0.5 [&_mark]:text-ink"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: doanTrichHtml() escape toàn bộ, chỉ giữ thẻ mark
            dangerouslySetInnerHTML={{ __html: doanTrichHtml(k.snippet, q) }}
          />
        ) : null}
      </Link>
    </li>
  );
}
