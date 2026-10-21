/**
 * Lớp truy cập dữ liệu dùng chung (API, worker, script).
 * Mọi truy vấn "theo thời điểm" đều nhận tham số asOf dạng YYYY-MM-DD.
 */

import type { AmendOp, DocumentMeta, LegalNode } from "@qdpl/legal-model";
import { contextPath, deriveDocStatus, nodeKey, plainText, walk } from "@qdpl/legal-model";
import { sql } from "./client.ts";

export interface DocumentRow {
  id: string;
  urn: string;
  doc_type: string;
  rank: number;
  is_normative: boolean;
  so_ky_hieu: string;
  locality: string | null;
  title: string;
  short_title: string;
  issuer_name: string | null;
  signer: string | null;
  issued_date: string | null;
  effective_from: string | null;
  effective_to: string | null;
  gazette_no: string | null;
  gazette_date: string | null;
  fields: string[];
  status: string;
  summary: string | null;
  is_draft: boolean;
  /** Tệp PDF gốc của bản quét trong kho đối tượng (migration 0068). */
  original_file_uri?: string | null;
  /** Số trang của tệp gốc (migration 0069). */
  original_file_pages?: number | null;
}

const d = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
};

/** Chuẩn hóa ngày trong hàng trả về (postgres trả Date cho cột date). */
export function normalizeDates<T extends Record<string, any>>(row: T): T {
  const out: any = { ...row };
  for (const k of [
    "issued_date",
    "effective_from",
    "effective_to",
    "gazette_date",
    "valid_from",
    "valid_to",
    "as_of",
  ]) {
    if (k in out) out[k] = d(out[k]);
  }
  return out;
}

export async function upsertDocument(
  meta: DocumentMeta & { locality?: string; isDraft?: boolean; primarySource?: string },
) {
  const rows = await sql`
    INSERT INTO documents (urn, doc_type, rank, is_normative, so_ky_hieu, locality, title, short_title,
                           issuer_name, signer, issued_date, effective_from, effective_to,
                           gazette_no, gazette_date, fields, status, summary, is_draft, primary_source, updated_at)
    VALUES (${meta.urn}, ${meta.docType}, ${meta.rank}, ${meta.isNormative}, ${meta.soKyHieu}, ${meta.locality ?? null},
            ${meta.title}, ${meta.shortTitle}, ${meta.issuer}, ${meta.signer ?? null},
            ${meta.issuedDate || null}, ${meta.effectiveFrom || null}, ${meta.effectiveTo || null},
            ${meta.gazetteNo ?? null}, ${meta.gazetteDate ?? null}, ${meta.fields}, ${meta.status},
            ${meta.summary ?? null}, ${meta.isDraft ?? false}, ${meta.primarySource ?? null}, now())
    ON CONFLICT (urn) DO UPDATE SET
      doc_type = EXCLUDED.doc_type, rank = EXCLUDED.rank, title = EXCLUDED.title,
      short_title = EXCLUDED.short_title, issuer_name = COALESCE(EXCLUDED.issuer_name, documents.issuer_name),
      signer = COALESCE(EXCLUDED.signer, documents.signer),
      issued_date = COALESCE(EXCLUDED.issued_date, documents.issued_date),
      effective_from = COALESCE(EXCLUDED.effective_from, documents.effective_from),
      effective_to = COALESCE(EXCLUDED.effective_to, documents.effective_to),
      gazette_no = COALESCE(EXCLUDED.gazette_no, documents.gazette_no),
      gazette_date = COALESCE(EXCLUDED.gazette_date, documents.gazette_date),
      fields = CASE WHEN cardinality(EXCLUDED.fields) > 0 THEN EXCLUDED.fields ELSE documents.fields END,
      status = EXCLUDED.status, summary = COALESCE(EXCLUDED.summary, documents.summary),
      updated_at = now()
    RETURNING *`;
  return normalizeDates(rows[0] as any) as DocumentRow;
}

export async function getDocumentByUrn(urn: string): Promise<DocumentRow | undefined> {
  const rows = await sql`SELECT * FROM documents WHERE urn = ${urn}`;
  return rows[0] ? (normalizeDates(rows[0] as any) as DocumentRow) : undefined;
}

/**
 * Văn bản ở đường dẫn web /van-ban/:docType/:slug. Quy chuẩn, tiêu chuẩn ghi cả tên loại trong số
 * ký hiệu ("QCVN 41:2024/BGTVT") còn viện dẫn thì không ("qcvn:41/2024/BGTVT"), nên slug thiếu
 * tiền tố loại vẫn khớp.
 */
export async function getDocumentBySlug(docType: string, slug: string): Promise<DocumentRow | undefined> {
  // shortcut: quét mọi văn bản cùng loại, thêm chỉ mục biểu thức khi kho lớn làm trang đọc chậm.
  const rows = await sql`
    SELECT * FROM documents
    WHERE doc_type = ${docType}
      AND lower(regexp_replace(translate(so_ky_hieu, 'Đđ', 'Dd'), '[^A-Za-z0-9]+', '-', 'g'))
          IN (${slug}, ${docType + slug}, ${`${docType}-${slug}`})
    LIMIT 1`;
  return rows[0] ? (normalizeDates(rows[0] as any) as DocumentRow) : undefined;
}

/**
 * Lưu một phiên bản văn bản kèm toàn bộ nút. Thay thế phiên bản cùng (document, version_no).
 */
export async function saveVersion(opts: {
  documentId: string;
  versionNo: number;
  kind: string;
  validFrom: string;
  validTo?: string | null;
  root: LegalNode;
  markdown: string;
  docTitle: string;
  quality?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  appliedOps?: string[];
  /** Ngày hiệu lực và hết hiệu lực của cả văn bản, để suy ra trạng thái của phiên bản. */
  docEffectiveFrom?: string | null;
  docEffectiveTo?: string | null;
}): Promise<string> {
  const hash = Bun.hash(opts.markdown).toString(16);
  // Trạng thái của phiên bản được tính tại thời điểm nó bắt đầu có hiệu lực,
  // nhờ vậy bộ lọc trạng thái trong tìm kiếm chạy đúng theo tham số asOf.
  const versionStatus = deriveDocStatus(
    opts.root,
    { effectiveFrom: opts.docEffectiveFrom ?? undefined, effectiveTo: opts.docEffectiveTo ?? undefined },
    opts.validFrom,
  );
  return await sql.begin(async (tx) => {
    await tx`DELETE FROM document_versions WHERE document_id = ${opts.documentId} AND version_no = ${opts.versionNo}`;
    const [ver] = await tx`
      INSERT INTO document_versions (document_id, version_no, kind, valid_from, valid_to, markdown, tree,
                                     content_hash, quality, provenance, applied_ops, status)
      VALUES (${opts.documentId}, ${opts.versionNo}, ${opts.kind}, ${opts.validFrom}, ${opts.validTo ?? null},
              ${opts.markdown}, ${sql.json(opts.root as any)}, ${hash},
              ${sql.json((opts.quality ?? {}) as any)}, ${sql.json((opts.provenance ?? {}) as any)},
              ${opts.appliedOps ?? []}, ${versionStatus})
      RETURNING id`;
    const versionId = (ver as any).id as string;

    const rows: any[] = [];
    let ordinal = 0;
    walk(opts.root, (n) => {
      if (n.kind === "van_ban") return;
      const depth = n.fullPath ? n.fullPath.split(".").length : 0;
      rows.push({
        version_id: versionId,
        document_id: opts.documentId,
        path: n.path,
        lpath: n.fullPath ? n.fullPath.replace(/[^A-Za-z0-9._]/g, "_") : null,
        full_path: n.fullPath,
        kind: n.kind,
        label: n.label,
        heading: n.heading ?? null,
        text_md: n.text,
        text_plain: plainText({ ...n, children: [] }),
        context_path: ["dieu", "khoan", "diem", "bang", "cong_thuc", "phu_luc"].includes(n.kind)
          ? contextPath(opts.root, n, opts.docTitle)
          : null,
        ordinal: ordinal++,
        depth,
        node_status: n.status,
        note: n.note ?? null,
        stable_key: n.path || null,
      });
    });

    // Chèn theo lô để tránh câu lệnh quá lớn.
    const NODE_COLUMNS = [
      "version_id",
      "document_id",
      "path",
      "lpath",
      "full_path",
      "kind",
      "label",
      "heading",
      "text_md",
      "text_plain",
      "context_path",
      "ordinal",
      "depth",
      "node_status",
      "note",
      "stable_key",
    ] as const;
    // Tính `tsv` ngay trong câu chèn thay vì chèn rồi UPDATE: UPDATE tạo bản ghi mới cho MỌI nút và
    // ghi lại MỌI chỉ mục của bảng (GIN trigram, GIN tsv, GiST ltree, 5 btree) — gấp đôi khối lượng
    // ghi. Đợt nạp 08/9/2026 để lại 142 nghìn lượt sửa `nodes` và góp phần làm CPU cụm CSDL dùng
    // chung lên 100%.
    const cot = (tx as unknown as (cols: readonly string[]) => never)(NODE_COLUMNS);
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      await tx`
        INSERT INTO nodes (${cot}, tsv)
        SELECT ${cot}, to_tsvector('vietnamese', coalesce(r.heading, '') || ' ' || coalesce(r.text_plain, ''))
        FROM jsonb_populate_recordset(NULL::nodes, ${sql.json(batch as never)}) AS r`;
    }
    return versionId;
  });
}

/** Phiên bản có hiệu lực tại thời điểm asOf (mặc định hôm nay). */
export async function getVersionAsOf(documentId: string, asOf: string) {
  const rows = await sql`
    SELECT * FROM document_versions
    WHERE document_id = ${documentId} AND valid_from <= ${asOf}
      AND (valid_to IS NULL OR valid_to > ${asOf})
    ORDER BY valid_from DESC, version_no DESC LIMIT 1`;
  if (rows[0]) return normalizeDates(rows[0] as any);
  const [first] = await sql`
    SELECT * FROM document_versions WHERE document_id = ${documentId} ORDER BY valid_from ASC LIMIT 1`;
  return first ? normalizeDates(first as any) : undefined;
}

export async function listVersions(documentId: string) {
  const rows = await sql`
    SELECT id, version_no, kind, valid_from, valid_to, content_hash, quality, reviewed_at
    FROM document_versions WHERE document_id = ${documentId} ORDER BY valid_from ASC, version_no ASC`;
  return rows.map((r) => normalizeDates(r as any));
}

export async function getNode(versionId: string, path: string) {
  const rows = await sql`SELECT * FROM nodes WHERE version_id = ${versionId} AND path = ${path} LIMIT 1`;
  return rows[0];
}

export async function saveRelations(
  rels: Array<{
    fromUrn: string;
    toUrn: string;
    type: string;
    effectiveFrom?: string | null;
    source?: string;
    confidence?: number;
    evidence?: unknown;
  }>,
) {
  if (!rels.length) return 0;
  for (const r of rels) {
    await sql`
      INSERT INTO relations (from_urn, to_urn, type, effective_from, source, confidence, evidence)
      VALUES (${r.fromUrn}, ${r.toUrn}, ${r.type}, ${r.effectiveFrom ?? null}, ${r.source ?? "parsed"},
              ${r.confidence ?? 1}, ${sql.json((r.evidence ?? null) as any)})
      ON CONFLICT (from_urn, to_urn, type) DO UPDATE
        SET confidence = GREATEST(relations.confidence, EXCLUDED.confidence),
            evidence = COALESCE(EXCLUDED.evidence, relations.evidence)`;
  }
  return rels.length;
}

/** Quan hệ hai chiều của một văn bản, nhóm theo loại. */
export async function getRelations(urn: string) {
  const out = await sql`
    SELECT r.*, 'out' AS direction, dt.title AS other_title, dt.short_title AS other_short, dt.status AS other_status
    FROM relations r LEFT JOIN documents dt ON dt.urn = split_part(r.to_urn, '#', 1)
    WHERE split_part(r.from_urn, '#', 1) = ${urn}
    UNION ALL
    SELECT r.*, 'in' AS direction, df.title, df.short_title, df.status
    FROM relations r LEFT JOIN documents df ON df.urn = split_part(r.from_urn, '#', 1)
    WHERE split_part(r.to_urn, '#', 1) = ${urn}`;
  return out.map((r) => normalizeDates(r as any));
}

export async function saveAmendOps(ops: AmendOp[]) {
  for (const o of ops) {
    await sql`
      INSERT INTO amendment_ops (amending_doc_urn, amending_label, target_doc_urn, target_path, op, payload,
                                 effective_from, effective_to, ordinal, extraction, confidence, review_status)
      VALUES (${o.amendingDocUrn}, ${o.amendingLabel ?? null}, ${o.targetDocUrn}, ${o.targetPath}, ${o.op},
              ${sql.json((o.payload ?? null) as any)}, ${o.effectiveFrom}, ${o.effectiveTo ?? null}, ${o.ordinal},
              ${o.extraction}, ${o.confidence}, ${o.reviewStatus})`;
  }
  return ops.length;
}

export async function getAmendOpsFor(targetDocUrn: string): Promise<AmendOp[]> {
  const rows = await sql`
    SELECT * FROM amendment_ops WHERE target_doc_urn = ${targetDocUrn} ORDER BY effective_from, ordinal`;
  return rows.map((r: any) => ({
    id: r.id,
    amendingDocUrn: r.amending_doc_urn,
    amendingLabel: r.amending_label ?? undefined,
    targetDocUrn: r.target_doc_urn,
    targetPath: r.target_path,
    op: r.op,
    payload: r.payload ?? undefined,
    effectiveFrom: d(r.effective_from)!,
    effectiveTo: d(r.effective_to) ?? undefined,
    ordinal: r.ordinal,
    extraction: r.extraction,
    confidence: r.confidence,
    reviewStatus: r.review_status,
  }));
}

export async function enqueue(
  queue: string,
  payload: unknown,
  opts: { priority?: number; runAfter?: Date } = {},
) {
  const [row] = await sql`
    INSERT INTO jobs (queue, payload, priority, run_after)
    VALUES (${queue}, ${sql.json(payload as any)}, ${opts.priority ?? 0}, ${opts.runAfter ?? new Date()})
    RETURNING id`;
  return (row as any).id as string;
}

/** Lấy một job và khóa nó (SKIP LOCKED để nhiều worker chạy song song). */
export async function claimJob(queues: string[]) {
  const rows = await sql`
    UPDATE jobs SET state = 'active', attempts = attempts + 1, started_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE queue = ANY(${queues}) AND state = 'pending' AND run_after <= now()
      ORDER BY priority DESC, id ASC
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *`;
  return rows[0];
}

export async function finishJob(id: string, error?: string) {
  if (!error) {
    await sql`UPDATE jobs SET state = 'done', finished_at = now() WHERE id = ${id}`;
    return;
  }
  await sql`
    UPDATE jobs
    SET state = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
        last_error = ${error},
        run_after = now() + (interval '1 minute' * attempts)
    WHERE id = ${id}`;
}

export async function addReview(item: {
  kind: string;
  refId: string;
  documentUrn?: string;
  priority?: number;
  payload?: unknown;
}) {
  const [row] = await sql`
    INSERT INTO review_queue (kind, ref_id, document_urn, priority, payload)
    VALUES (${item.kind}, ${item.refId}, ${item.documentUrn ?? null}, ${item.priority ?? 0},
            ${sql.json((item.payload ?? {}) as any)})
    RETURNING id`;
  return (row as any).id as string;
}

export async function logRun(r: {
  documentId?: string;
  step: string;
  route?: string;
  status: string;
  model?: string;
  promptVersion?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  durationMs?: number;
  warnings?: unknown;
  error?: string;
}) {
  await sql`
    INSERT INTO pipeline_runs (document_id, step, route, status, model, prompt_version, tokens_in, tokens_out,
                               cost_usd, duration_ms, warnings, error, finished_at)
    VALUES (${r.documentId ?? null}, ${r.step}, ${r.route ?? null}, ${r.status}, ${r.model ?? null},
            ${r.promptVersion ?? null}, ${r.tokensIn ?? null}, ${r.tokensOut ?? null}, ${r.costUsd ?? null},
            ${r.durationMs ?? null}, ${sql.json((r.warnings ?? null) as any)}, ${r.error ?? null}, now())`;
}

export { nodeKey, sql };

/**
 * Trạng thái hiệu lực của một văn bản TẠI MỘT THỜI ĐIỂM.
 * Khác với `documents.status` (ảnh chụp hiện tại): hàm này đọc trạng thái của phiên bản
 * có hiệu lực tại `asOf`, đồng thời xét ngày hiệu lực/hết hiệu lực của cả văn bản.
 */
export async function getStatusAsOf(documentId: string, asOf: string): Promise<string> {
  const rows = await sql`
    SELECT v.status, d.effective_from, d.effective_to
    FROM document_versions v
    JOIN documents d ON d.id = v.document_id
    WHERE v.document_id = ${documentId} AND v.valid_from <= ${asOf}
      AND (v.valid_to IS NULL OR v.valid_to > ${asOf})
    ORDER BY v.valid_from DESC, v.version_no DESC
    LIMIT 1`;
  const row = rows[0] as any;
  if (!row) {
    // Chưa có phiên bản nào có hiệu lực tại thời điểm này.
    const [doc] = await sql`SELECT effective_from FROM documents WHERE id = ${documentId}`;
    const ef = d((doc as any)?.effective_from);
    return ef && ef > asOf ? "chua_hieu_luc" : "khong_xac_dinh";
  }
  const ef = d(row.effective_from);
  const et = d(row.effective_to);
  if (et && et <= asOf) return "het_hieu_luc";
  if (ef && ef > asOf) return "chua_hieu_luc";
  return row.status as string;
}
