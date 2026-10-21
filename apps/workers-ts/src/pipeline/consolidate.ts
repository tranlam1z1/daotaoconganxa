/**
 * Bước 6 (ke-hoach/02 §4.1, ke-hoach/06 §3): hợp nhất theo thời điểm.
 * Lấy ops ĐÃ DUYỆT của văn bản đích, áp dụng tại từng mốc `changeDates()`,
 * vật hóa thành `document_versions(kind='consolidated_auto')`.
 */
import { addReview, enqueue, getAmendOpsFor, saveVersion, sql } from "@qdpl/db";
import {
  type AmendOp,
  consolidate as applyOps,
  changeDates,
  deriveDocStatus,
  type LegalNode,
  serializeDocument,
} from "@qdpl/legal-model";
import { log } from "../log.ts";
import { getOriginalVersion, requireDocument, treeOf } from "./parse.ts";

export interface ConsolidateSummary {
  urn: string;
  documentId: string;
  approvedOps: number;
  pendingOps: number;
  dates: string[];
  versions: {
    versionNo: number;
    validFrom: string;
    validTo: string | null;
    versionId: string;
    applied: number;
  }[];
  conflicts: { op: string; targetPath: string; reason: string }[];
  status: string;
}

/**
 * Hợp nhất một văn bản bị sửa đổi.
 * `asOf` chỉ dùng để suy trạng thái văn bản (mặc định hôm nay).
 */
export async function consolidateDocument(
  targetDocUrn: string,
  opts: { asOf?: string; enqueueIndex?: boolean } = {},
): Promise<ConsolidateSummary> {
  const doc = await requireDocument(targetDocUrn);
  const base = await getOriginalVersion(doc.id);
  if (!base) throw new Error(`Văn bản ${doc.urn} chưa có phiên bản gốc để hợp nhất`);
  const baseRoot: LegalNode = treeOf(base);

  const all = await getAmendOpsFor(doc.urn);
  const approved = all.filter((o) => o.reviewStatus === "approved");
  const pending = all.length - approved.length;
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);

  const summary: ConsolidateSummary = {
    urn: doc.urn,
    documentId: doc.id,
    approvedOps: approved.length,
    pendingOps: pending,
    dates: [],
    versions: [],
    conflicts: [],
    status: doc.status,
  };

  if (!approved.length) {
    log.info("Không có lệnh đã duyệt, bỏ qua hợp nhất", { urn: doc.urn, pending });
    return summary;
  }

  const dates = changeDates(approved);
  summary.dates = dates;

  // Phiên bản gốc chỉ còn hiệu lực tới mốc đầu tiên.
  const baseValidFrom = (
    base.valid_from instanceof Date ? base.valid_from.toISOString() : String(base.valid_from)
  ).slice(0, 10);
  const firstDate = dates[0]!;
  await sql`UPDATE document_versions SET valid_to = ${firstDate} WHERE id = ${base.id}`;

  let versionNo = Number(base.version_no) || 1;
  let lastRoot: LegalNode = baseRoot;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;
    if (date < baseValidFrom) {
      log.warn("Mốc hợp nhất sớm hơn ngày hiệu lực bản gốc, bỏ qua", { urn: doc.urn, date, baseValidFrom });
      continue;
    }
    const res = applyOps(baseRoot, approved, date);
    lastRoot = res.root;
    for (const c of res.conflicts) {
      summary.conflicts.push({ op: c.op.op, targetPath: c.op.targetPath, reason: c.reason });
    }
    versionNo += 1;
    const markdown = serializeDocument(res.root, { footnotes: true, asOf: date });
    const versionId = await saveVersion({
      documentId: doc.id,
      versionNo,
      kind: "consolidated_auto",
      validFrom: date,
      validTo: dates[i + 1] ?? null,
      root: res.root,
      markdown,
      docTitle: doc.short_title || doc.title,
      quality: { appliedOps: res.applied.length, conflicts: res.conflicts.length },
      provenance: {
        step: "consolidate",
        basisVersionId: base.id,
        amendingDocs: [...new Set(res.applied.map((o: AmendOp) => o.amendingDocUrn))],
        consolidatedAt: new Date().toISOString(),
      },
      appliedOps: res.applied.map((o: AmendOp) => o.id).filter(Boolean),
    });
    summary.versions.push({
      versionNo,
      validFrom: date,
      validTo: dates[i + 1] ?? null,
      versionId,
      applied: res.applied.length,
    });
    if (opts.enqueueIndex !== false) await enqueue("index", { documentId: doc.id, versionId });
  }

  // Xung đột -> hàng đợi biên tập (không tự ý bỏ qua).
  for (const c of summary.conflicts) {
    await addReview({
      kind: "amend_op",
      refId: `${doc.urn}#${c.targetPath || "doc"}`,
      documentUrn: doc.urn,
      priority: 3,
      payload: { step: "consolidate", ...c },
    });
  }

  const status = deriveDocStatus(
    lastRoot,
    {
      ...(doc.effective_from ? { effectiveFrom: doc.effective_from } : {}),
      ...(doc.effective_to ? { effectiveTo: doc.effective_to } : {}),
    },
    asOf,
  );
  await sql`UPDATE documents SET status = ${status}, status_as_of = now(), updated_at = now() WHERE id = ${doc.id}`;
  summary.status = status;

  log.info("Đã hợp nhất văn bản", {
    urn: doc.urn,
    versions: summary.versions.length,
    conflicts: summary.conflicts.length,
    status,
  });
  return summary;
}

/** Duyệt (approve) các lệnh của một văn bản sửa đổi — dùng cho vận hành/CLI. */
export async function approveOps(
  amendingDocUrn: string,
  opts: { minConfidence?: number; reviewer?: string } = {},
): Promise<number> {
  const min = opts.minConfidence ?? 0;
  const rows = await sql`
    UPDATE amendment_ops
    SET review_status = 'approved', reviewer_id = ${opts.reviewer ?? "cli"}, reviewed_at = now()
    WHERE amending_doc_urn = ${amendingDocUrn}
      AND review_status = 'pending'
      AND confidence >= ${min}
    RETURNING id`;
  await sql`
    UPDATE review_queue SET state = 'resolved', resolution = 'approved', resolved_at = now()
    WHERE kind = 'amend_op' AND state = 'open'
      AND ref_id IN (SELECT id::text FROM amendment_ops WHERE amending_doc_urn = ${amendingDocUrn} AND review_status = 'approved')`;
  log.info("Đã duyệt lệnh sửa đổi", { amendingDocUrn, approved: rows.length });
  return rows.length;
}

/** Văn bản bị tác động bởi một văn bản sửa đổi. */
export async function affectedDocuments(amendingDocUrn: string): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT target_doc_urn FROM amendment_ops WHERE amending_doc_urn = ${amendingDocUrn}`;
  return rows.map((r: any) => r.target_doc_urn as string);
}
