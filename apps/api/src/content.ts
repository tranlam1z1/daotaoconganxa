/**
 * Dựng nội dung văn bản tại một thời điểm.
 * KHÔNG tự viết lại logic hợp nhất: lấy phiên bản gốc + các lệnh sửa đổi đã duyệt
 * rồi gọi `consolidate()` của @qdpl/legal-model (ke-hoach/06 §3).
 */
import { type DocumentRow, getAmendOpsFor, getDocumentByUrn, getStatusAsOf, sql } from "@qdpl/db";
import {
  type AmendOp,
  consolidate,
  type DocumentMeta,
  type LegalNode,
  serializeDocument,
  walk,
} from "@qdpl/legal-model";
import { asDate, notFound } from "./http.ts";

export interface VersionRow {
  id: string;
  version_no: number;
  kind: string;
  valid_from: string | null;
  valid_to: string | null;
  content_hash: string | null;
  tree: LegalNode | null;
  markdown: string | null;
  quality: Record<string, unknown>;
  reviewed_at: string | null;
}

export interface Footnote {
  index: number;
  path: string;
  label: string;
  kind: string;
  status: string;
  note: string;
}

export interface PointInTime {
  doc: DocumentRow;
  /** Phiên bản gốc dùng làm cơ sở hợp nhất. */
  baseVersion: VersionRow;
  /** Phiên bản đã vật hóa trùng thời điểm (nếu có). */
  materialized: VersionRow | undefined;
  root: LegalNode;
  applied: AmendOp[];
  conflicts: Array<{ op: AmendOp; reason: string }>;
  /** original nếu chưa có lệnh nào áp dụng, ngược lại consolidated_auto. */
  versionKind: string;
  /** Trạng thái hiệu lực của văn bản TẠI asOf (từ document_versions.status). */
  statusAsOf: string;
  footnotes: Footnote[];
}

/** Lấy văn bản theo URN, ném 404 nếu không có. */
export async function requireDocument(urn: string): Promise<DocumentRow> {
  const doc = await getDocumentByUrn(urn);
  if (!doc) throw notFound(`Không tìm thấy văn bản có URN ${urn}`);
  return doc;
}

function normVersion(row: Record<string, unknown>): VersionRow {
  return {
    id: String(row.id),
    version_no: Number(row.version_no),
    kind: String(row.kind),
    valid_from: asDate(row.valid_from),
    valid_to: asDate(row.valid_to),
    content_hash: (row.content_hash as string) ?? null,
    tree: (row.tree as LegalNode) ?? null,
    markdown: (row.markdown as string) ?? null,
    quality: (row.quality as Record<string, unknown>) ?? {},
    reviewed_at: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : null,
  };
}

export async function listVersionRows(documentId: string, withTree = false): Promise<VersionRow[]> {
  const rows = withTree
    ? await sql`SELECT id, version_no, kind, valid_from, valid_to, content_hash, tree, markdown, quality, reviewed_at
                FROM document_versions WHERE document_id = ${documentId}::uuid
                ORDER BY valid_from ASC, version_no ASC`
    : await sql`SELECT id, version_no, kind, valid_from, valid_to, content_hash, NULL::jsonb AS tree,
                       NULL::text AS markdown, quality, reviewed_at
                FROM document_versions WHERE document_id = ${documentId}::uuid
                ORDER BY valid_from ASC, version_no ASC`;
  return rows.map((r) => normVersion(r as Record<string, unknown>));
}

/** Phiên bản gốc (kind = original) hoặc phiên bản sớm nhất nếu chưa có. */
export async function baseVersionOf(documentId: string): Promise<VersionRow> {
  const rows = await sql`
    SELECT id, version_no, kind, valid_from, valid_to, content_hash, tree, markdown, quality, reviewed_at
    FROM document_versions
    WHERE document_id = ${documentId}::uuid
    ORDER BY (kind = 'original') DESC, version_no ASC
    LIMIT 1`;
  const row = rows[0];
  if (!row) throw notFound("Văn bản chưa có phiên bản nội dung nào");
  const v = normVersion(row as Record<string, unknown>);
  if (!v.tree) throw notFound("Phiên bản gốc không có cây cấu trúc (tree)");
  return v;
}

/** Ghi chú hợp nhất, đánh số theo đúng thứ tự serializeDocument sinh footnote. */
export function collectFootnotes(root: LegalNode): Footnote[] {
  const out: Footnote[] = [];
  walk(root, (n) => {
    if (n.kind === "van_ban") return;
    if (!n.note) return;
    out.push({
      index: out.length + 1,
      path: n.path,
      label: n.label,
      kind: n.kind,
      status: n.status,
      note: n.note,
    });
  });
  return out;
}

/** Dựng nội dung hợp nhất của một văn bản tại thời điểm asOf. */
export async function contentAsOf(urn: string, asOf: string): Promise<PointInTime> {
  const doc = await requireDocument(urn);
  const base = await baseVersionOf(doc.id);
  const ops = await getAmendOpsFor(urn);
  const result = consolidate(base.tree!, ops, asOf);

  const versions = await listVersionRows(doc.id);
  const materialized = versions.find(
    (v) => v.valid_from && v.valid_from <= asOf && (!v.valid_to || v.valid_to > asOf),
  );

  return {
    doc,
    baseVersion: base,
    materialized,
    root: result.root,
    applied: result.applied,
    conflicts: result.conflicts,
    versionKind: result.applied.length > 0 ? "consolidated_auto" : base.kind,
    statusAsOf: await getStatusAsOf(doc.id, asOf),
    footnotes: collectFootnotes(result.root),
  };
}

/** Metadata tối thiểu cho serializeDocument. */
export function metaOf(doc: DocumentRow): DocumentMeta {
  return {
    urn: doc.urn,
    docType: doc.doc_type,
    rank: doc.rank,
    isNormative: doc.is_normative,
    soKyHieu: doc.so_ky_hieu,
    title: doc.title,
    shortTitle: doc.short_title,
    issuer: doc.issuer_name ?? "",
    signer: doc.signer ?? undefined,
    issuedDate: doc.issued_date ?? "",
    effectiveFrom: doc.effective_from ?? undefined,
    effectiveTo: doc.effective_to ?? undefined,
    gazetteNo: doc.gazette_no ?? undefined,
    gazetteDate: doc.gazette_date ?? undefined,
    fields: doc.fields ?? [],
    status: doc.status as DocumentMeta["status"],
    summary: doc.summary ?? undefined,
  };
}

/** Markdown chuẩn nội bộ (có marker và footnote) của nội dung tại thời điểm. */
export function renderMarkdown(pit: PointInTime, asOf: string): string {
  return serializeDocument(pit.root, {
    markers: true,
    footnotes: true,
    meta: metaOf(pit.doc),
    asOf,
  });
}
