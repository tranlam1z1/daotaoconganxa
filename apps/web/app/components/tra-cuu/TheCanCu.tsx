import { dieuHrefFromUrn, nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import { formatDate } from "../../lib/format";
import type { Citation } from "../../lib/types";
import { StatusBadge } from "../ui/Badge";
import { ButtonLink } from "../ui/Button";

/**
 * Thẻ căn cứ của câu trả lời: điều khoản được viện dẫn, đoạn trích nguyên văn và nút mở đúng
 * khoản trong văn bản. Căn cứ đã hết hiệu lực được cảnh báo bằng chữ ở đầu thẻ
 * (QUY-TAC-HANH-VAN.md §10).
 */
export function TheCanCu({ citation }: { citation: Citation }) {
  const nhan = citation.urn ? nhanVienDan(citation.urn) : citation.label;
  return (
    <li
      className={cn("rounded-card border bg-surface p-4", citation.expired ? "border-danger" : "border-line")}
    >
      {citation.expired ? (
        <p className="mb-2 text-sm font-semibold text-danger">
          Căn cứ này đã hết hiệu lực
          {citation.effectiveTo ? ` từ ngày ${formatDate(citation.effectiveTo)}` : ""}.
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        <span>{nhan}</span>
        {citation.status && citation.status !== "con_hieu_luc" ? (
          <StatusBadge status={citation.status} />
        ) : null}
      </p>
      {citation.citedText ? (
        <blockquote className="mt-2 border-l-4 border-line-strong pl-3 text-sm leading-relaxed text-ink-2">
          {citation.citedText}
        </blockquote>
      ) : null}
      {citation.urn ? (
        <ButtonLink to={dieuHrefFromUrn(citation.urn)} variant="secondary" className="mt-3">
          Mở điều khoản
        </ButtonLink>
      ) : null}
    </li>
  );
}
