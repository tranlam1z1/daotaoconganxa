/**
 * Hiển thị một nút văn bản và các nút con: Chương/Mục, Điều, khoản, điểm, phụ lục.
 * Dựa trên NodeView của giao diện cũ (git HEAD), bỏ bớt: không nút "lịch sử", không thuật ngữ
 * "hợp nhất" (docs/PLAN.md §0.4). Khoản/điểm được liên kết tới (#dieu-6.khoan-2) sẽ tô nền.
 */
import { Link } from "react-router";

import { cn } from "../../lib/cn";
import { renderMarkdown } from "../../lib/markdown";
import type { DocumentMeta, LegalNode, VersionKind } from "../../lib/types";
import { NodeStatusBadge } from "../ui/Badge";

export interface NguCanhDoc {
  meta: DocumentMeta;
  asOf: string;
  versionKind: VersionKind;
  /** Có thì tiêu đề Điều thành liên kết mở riêng Điều đó (dùng khi đọc toàn văn). */
  lienKetDieu?: (dieuPath: string) => string;
}

/** Nền tô cho nút đang được liên kết tới; scroll-mt chừa chỗ cho thanh đầu trang dính. */
const NEO = "scroll-mt-24 rounded-md target:bg-warn-soft target:ring-4 target:ring-warn-soft";

/** Chèn nhãn nút ("2.", "a)") vào đầu đoạn văn đầu tiên. */
function kemNhan(html: string, label: string): string {
  const marker = `<span class="mr-1 font-semibold">${label}</span>`;
  if (html.startsWith("<p>")) return `<p>${marker}${html.slice(3)}`;
  return `<p>${marker}</p>${html}`;
}

function GhiChuSuaDoi({ text }: { text: string }) {
  return (
    <details className="mt-2 rounded-lg border border-line bg-surface-2 px-3 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-ink-2">
        Ghi chú sửa đổi, bổ sung
      </summary>
      <p className="pb-3 text-ink-2">{text}</p>
    </details>
  );
}

function VanBan({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn("prose-legal", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung đã đi qua sanitizeHtml() trong app/lib/markdown.ts
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function NoiDungDieu({ node, ctx }: { node: LegalNode; ctx: NguCanhDoc }) {
  const id = node.path || undefined;
  const con = node.children.map((child) => (
    <NoiDungDieu key={child.path || child.label} node={child} ctx={ctx} />
  ));

  if (node.kind === "phan" || node.kind === "chuong" || node.kind === "muc" || node.kind === "tieu_muc") {
    return (
      <section id={id} className="mt-10 scroll-mt-24">
        <h2 className="border-b border-line pb-2 text-center text-base font-semibold uppercase tracking-wide">
          <span className="block">{node.label}</span>
          {node.heading ? <span className="mt-1 block">{node.heading}</span> : null}
        </h2>
        {con}
      </section>
    );
  }

  if (node.kind === "dieu") {
    const tieuDe = `${node.label}${node.heading ? `. ${node.heading}` : ""}`;
    return (
      <article id={id} data-node-kind="dieu" className={cn("mt-8", NEO)}>
        <h3 className="flex flex-wrap items-start gap-x-2 gap-y-1 text-lg font-semibold leading-snug">
          <span className="min-w-0 flex-1">
            {ctx.lienKetDieu ? (
              <Link
                to={ctx.lienKetDieu(node.path)}
                className="inline-flex min-h-11 items-center hover:text-primary hover:underline"
              >
                {tieuDe}
              </Link>
            ) : (
              tieuDe
            )}
          </span>
          <NodeStatusBadge status={node.status} />
        </h3>
        {node.text ? <VanBan html={renderMarkdown(node.text)} className="mt-2" /> : null}
        {node.note ? <GhiChuSuaDoi text={node.note} /> : null}
        {con}
      </article>
    );
  }

  if (node.kind === "khoan" || node.kind === "diem") {
    const html =
      node.status === "repealed"
        ? `<p><span class="mr-1 font-semibold">${node.label}</span><em>(được bãi bỏ)</em></p>`
        : kemNhan(renderMarkdown(node.text), node.label);
    return (
      <div id={id} className={cn(node.kind === "khoan" ? "mt-3" : "mt-2", NEO)}>
        <VanBan html={html} />
        {node.status !== "active" ? <NodeStatusBadge status={node.status} /> : null}
        {node.note ? <GhiChuSuaDoi text={node.note} /> : null}
        {con.length ? <div className="ml-4 sm:ml-6">{con}</div> : null}
      </div>
    );
  }

  if (node.kind === "phu_luc") {
    return (
      <section id={id} className="mt-10 scroll-mt-24">
        <h2 className="text-center text-base font-semibold uppercase">
          <span className="block">{node.label}</span>
          {node.heading ? <span className="mt-1 block">{node.heading}</span> : null}
        </h2>
        {node.text ? <VanBan html={renderMarkdown(node.text)} className="mt-3" /> : null}
        {con}
      </section>
    );
  }

  // Căn cứ ban hành, lời nói đầu, đoạn, phần ký.
  return (
    <div id={id} className="mt-4 scroll-mt-24">
      {node.kind === "can_cu" ? <h2 className="sr-only">Căn cứ ban hành</h2> : null}
      {node.text ? (
        <VanBan
          html={renderMarkdown(node.text)}
          className={node.kind === "can_cu" ? "text-ink-2" : undefined}
        />
      ) : null}
      {node.note ? <GhiChuSuaDoi text={node.note} /> : null}
      {con}
    </div>
  );
}
