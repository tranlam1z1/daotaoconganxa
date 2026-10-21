/** Endpoint tra cứu một nút (điều/khoản/điểm) kèm lịch sử sửa đổi. */

import { sql } from "@qdpl/db";
import { docUrnOf, parseUrn } from "@qdpl/legal-model";
import { Hono } from "hono";
import { z } from "zod";
import { requireDocument } from "../content.ts";
import { asDate, badRequest, decodeUrnParam, notFound, parseQuery, today } from "../http.ts";
import { AMEND_OP_LABELS, NODE_STATUS_LABELS, VERSION_KIND_LABELS } from "../labels.ts";

const schema = z.object({
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD")
    .optional(),
});

export const nodes = new Hono();

nodes.get("/:urn", async (c) => {
  const urn = decodeUrnParam(c.req.param("urn"));
  const p = parseQuery(c, schema);
  const asOf = p.asOf ?? today();

  const parsed = parseUrn(urn);
  if (!parsed) throw badRequest(`URN không phân giải được: ${urn}`);
  const path = parsed.path;
  if (!path) throw badRequest("URN nút phải có phần #path, ví dụ vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3.khoan-1");
  const docUrn = docUrnOf(urn);
  const doc = await requireDocument(docUrn);

  const rows = await sql`
    SELECT n.id, n.path, n.full_path, n.kind, n.label, n.heading, n.text_md, n.text_plain,
           n.context_path, n.node_status, n.ordinal, n.depth, n.stable_key,
           v.id AS version_id, v.version_no, v.kind AS version_kind, v.valid_from, v.valid_to
    FROM nodes n
    JOIN document_versions v ON v.id = n.version_id
    WHERE n.document_id = ${doc.id}::uuid AND n.path = ${path}
      AND v.valid_from <= ${asOf}::date AND (v.valid_to IS NULL OR v.valid_to > ${asOf}::date)
    ORDER BY v.version_no DESC
    LIMIT 1`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw notFound(`Không tìm thấy nút ${path} của ${docUrn} có hiệu lực tại ${asOf}`);

  const children = await sql`
    SELECT path, kind, label, heading, text_md, node_status, ordinal
    FROM nodes
    WHERE version_id = ${String(row.version_id)}::uuid AND path LIKE ${`${path}.%`}
    ORDER BY ordinal`;

  // Lịch sử sửa đổi: mọi lệnh trỏ tới nút này hoặc tới nút con của nó.
  const ops = await sql`
    SELECT id, amending_doc_urn, amending_label, target_path, op, payload, effective_from, effective_to,
           ordinal, extraction, confidence, review_status, reviewed_at, notes
    FROM amendment_ops
    WHERE target_doc_urn = ${docUrn}
      AND (target_path = ${path} OR target_path LIKE ${`${path}.%`})
    ORDER BY effective_from, ordinal`;

  // Các phiên bản mà nút này tồn tại, để hiển thị timeline.
  const timeline = await sql`
    SELECT v.version_no, v.kind, v.valid_from, v.valid_to, n.node_status, n.text_md
    FROM nodes n JOIN document_versions v ON v.id = n.version_id
    WHERE n.document_id = ${doc.id}::uuid AND n.path = ${path}
    ORDER BY v.valid_from, v.version_no`;

  return c.json({
    urn,
    asOf,
    docUrn,
    document: { urn: doc.urn, soKyHieu: doc.so_ky_hieu, shortTitle: doc.short_title, title: doc.title },
    node: {
      id: row.id,
      path: row.path,
      fullPath: row.full_path,
      kind: row.kind,
      label: row.label,
      heading: row.heading ?? null,
      text: row.text_md,
      textPlain: row.text_plain,
      contextPath: row.context_path ?? null,
      status: row.node_status,
      statusLabel: NODE_STATUS_LABELS[String(row.node_status)] ?? String(row.node_status),
      stableKey: row.stable_key ?? null,
    },
    version: {
      id: row.version_id,
      versionNo: row.version_no,
      kind: row.version_kind,
      kindLabel: VERSION_KIND_LABELS[String(row.version_kind)] ?? String(row.version_kind),
      validFrom: asDate(row.valid_from),
      validTo: asDate(row.valid_to),
    },
    children: (children as unknown as Array<Record<string, unknown>>).map((ch) => ({
      path: ch.path,
      kind: ch.kind,
      label: ch.label,
      heading: ch.heading ?? null,
      text: ch.text_md,
      status: ch.node_status,
      statusLabel: NODE_STATUS_LABELS[String(ch.node_status)] ?? String(ch.node_status),
    })),
    history: (ops as unknown as Array<Record<string, unknown>>).map((o) => ({
      id: o.id,
      op: o.op,
      opLabel: AMEND_OP_LABELS[String(o.op)] ?? String(o.op),
      targetPath: o.target_path,
      amendingDocUrn: o.amending_doc_urn,
      amendingLabel: o.amending_label ?? null,
      payload: o.payload ?? null,
      effectiveFrom: asDate(o.effective_from),
      effectiveTo: asDate(o.effective_to),
      extraction: o.extraction,
      confidence: o.confidence,
      reviewStatus: o.review_status,
      notes: o.notes ?? null,
    })),
    timeline: (timeline as unknown as Array<Record<string, unknown>>).map((t) => ({
      versionNo: t.version_no,
      versionKind: t.kind,
      validFrom: asDate(t.valid_from),
      validTo: asDate(t.valid_to),
      status: t.node_status,
      text: t.text_md,
    })),
  });
});
