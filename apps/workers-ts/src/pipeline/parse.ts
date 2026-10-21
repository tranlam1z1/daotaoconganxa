/**
 * Bước 4 (ke-hoach/02 §4.1): Markdown -> cây nút -> document_versions + nodes.
 * Cảnh báo của parser (gap / duplicate) được đẩy vào `review_queue`.
 */
import { addReview, type DocumentRow, enqueue, getDocumentByUrn, saveVersion, sql } from "@qdpl/db";
import { type LegalNode, type ParseWarning, parseDocument, walk } from "@qdpl/legal-model";
import { derivedMarkdownKey, putText } from "@qdpl/storage";
import { log } from "../log.ts";
import { readStoredFile } from "./convert.ts";

export interface ParseResultSummary {
  documentId: string;
  urn: string;
  versionId: string;
  versionNo: number;
  validFrom: string;
  counts: Record<string, number>;
  nodeCount: number;
  warnings: ParseWarning[];
  reviewIds: string[];
  isAmending: boolean;
  extractOpsJobId?: string;
}

export async function getDocumentById(id: string): Promise<DocumentRow | undefined> {
  const rows = await sql`SELECT * FROM documents WHERE id = ${id} LIMIT 1`;
  const r = rows[0] as any;
  if (!r) return undefined;
  for (const k of ["issued_date", "effective_from", "effective_to", "gazette_date"]) {
    if (r[k] instanceof Date) r[k] = r[k].toISOString().slice(0, 10);
    else if (typeof r[k] === "string") r[k] = r[k].slice(0, 10);
  }
  return r as DocumentRow;
}

/**
 * Văn bản có phải văn bản sửa đổi không (ke-hoach/06 §2.1).
 * Nhận cả trường hợp "một luật sửa nhiều luật" (mỗi Điều sửa một văn bản).
 */
export function isAmendingDocument(title: string, root: LegalNode): boolean {
  const t = title.toLowerCase();
  if (/sửa đổi,?\s*bổ sung/.test(t)) return true;
  if (/^\s*(luật|nghị định|thông tư|quyết định|nghị quyết|pháp lệnh)?\s*bãi bỏ(?=\s|$)/.test(t)) return true;
  let hit = false;
  walk(root, (n) => {
    if (hit || n.kind !== "dieu") return;
    const h = `${n.heading ?? ""} ${n.text}`.toLowerCase();
    if (
      /(sửa đổi,?\s*bổ sung|bãi bỏ|thay thế cụm từ|ngưng hiệu lực)/.test(h) &&
      /(điều|khoản|điểm|nghị định|luật|thông tư|quyết định)/.test(h)
    ) {
      hit = true;
    }
  });
  return hit;
}

function countNodes(root: LegalNode): number {
  let n = 0;
  walk(root, (node) => {
    if (node.kind !== "van_ban") n += 1;
  });
  return n;
}

export interface ParseInput {
  documentId: string;
  markdown?: string;
  markdownUri?: string;
  /** Loại phiên bản: original | consolidated_official | corrigendum | reissue. */
  kind?: string;
  versionNo?: number;
  validFrom?: string;
  enqueueNext?: boolean;
  provenance?: Record<string, unknown>;
}

export async function parseAndSave(input: ParseInput): Promise<ParseResultSummary> {
  const doc = await getDocumentById(input.documentId);
  if (!doc) throw new Error(`Không có document ${input.documentId}`);

  let markdown = input.markdown;
  if (!markdown && input.markdownUri) {
    markdown = new TextDecoder("utf-8").decode(await readStoredFile(input.markdownUri));
  }
  if (!markdown?.trim()) throw new Error(`Không có Markdown để phân tích (document ${doc.urn})`);

  const parsed = parseDocument(markdown);
  const validFrom =
    input.validFrom ?? doc.effective_from ?? doc.issued_date ?? new Date().toISOString().slice(0, 10);
  const versionNo = input.versionNo ?? 1;

  const versionId = await saveVersion({
    documentId: doc.id,
    versionNo,
    kind: input.kind ?? "original",
    validFrom,
    root: parsed.root,
    markdown,
    docTitle: doc.short_title || doc.title,
    quality: {
      counts: parsed.counts,
      warnings: parsed.warnings.length,
      nodeCount: countNodes(parsed.root),
    },
    provenance: {
      step: "parse",
      markdownUri: input.markdownUri ?? null,
      parsedAt: new Date().toISOString(),
      ...(input.provenance ?? {}),
    },
  });

  // CSDL là nguồn sự thật của Markdown (`document_versions.markdown`): nó phải nằm cùng
  // giao dịch với cây nút để không bao giờ lệch. Bản sao trên kho đối tượng là để xuất bản,
  // đối soát và khôi phục — hỏng bản sao thì KHÔNG được làm hỏng bước phân tích.
  const mirrorUri = derivedMarkdownKey(doc.id, versionNo);
  try {
    await putText(mirrorUri, markdown);
    await sql`UPDATE document_versions SET markdown_uri = ${mirrorUri} WHERE id = ${versionId}`;
  } catch (e) {
    log.warn("Không ghi được bản sao Markdown lên kho đối tượng", {
      documentId: doc.id,
      uri: mirrorUri,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Cảnh báo cấu trúc -> hàng đợi biên tập.
  const reviewIds: string[] = [];
  for (const w of parsed.warnings) {
    if (w.kind !== "gap" && w.kind !== "duplicate") continue;
    reviewIds.push(
      await addReview({
        kind: "conversion",
        refId: versionId,
        documentUrn: doc.urn,
        priority: w.kind === "duplicate" ? 2 : 1,
        payload: { warning: w, versionNo, step: "parse" },
      }),
    );
  }

  const isAmending = isAmendingDocument(doc.title, parsed.root);
  const summary: ParseResultSummary = {
    documentId: doc.id,
    urn: doc.urn,
    versionId,
    versionNo,
    validFrom,
    counts: parsed.counts,
    nodeCount: countNodes(parsed.root),
    warnings: parsed.warnings,
    reviewIds,
    isAmending,
  };

  if (input.enqueueNext !== false) {
    await enqueue("relations", { documentId: doc.id, versionId });
    await enqueue("index", { documentId: doc.id, versionId });
    if (isAmending) {
      summary.extractOpsJobId = await enqueue(
        "extract-ops",
        { documentId: doc.id, versionId },
        { priority: 3 },
      );
    }
  }

  log.info("Đã phân tích cấu trúc", {
    urn: doc.urn,
    versionId,
    nodes: summary.nodeCount,
    warnings: parsed.warnings.length,
    isAmending,
  });
  return summary;
}

/** Lấy phiên bản gốc (kind='original') mới nhất của một văn bản. */
export async function getOriginalVersion(documentId: string) {
  const rows = await sql`
    SELECT * FROM document_versions
    WHERE document_id = ${documentId} AND kind IN ('original', 'consolidated_official')
    ORDER BY version_no ASC LIMIT 1`;
  return rows[0] as any;
}

/** Cây nút của một phiên bản (cột tree là jsonb -> đã là object). */
export function treeOf(version: any): LegalNode {
  const t = version?.tree;
  if (!t) throw new Error("Phiên bản không có cây nút (cột tree rỗng)");
  if (typeof t === "string") {
    // Phòng khi dữ liệu cũ bị JSON.stringify hai lần.
    return JSON.parse(t) as LegalNode;
  }
  return t as LegalNode;
}

/** Tra văn bản theo URN, ném lỗi rõ ràng nếu không có. */
export async function requireDocument(urn: string): Promise<DocumentRow> {
  const doc = await getDocumentByUrn(urn);
  if (!doc) throw new Error(`Không có văn bản ${urn} trong CSDL`);
  return doc;
}
