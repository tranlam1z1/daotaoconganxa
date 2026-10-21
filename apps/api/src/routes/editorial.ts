/**
 * Hàng đợi biên tập và duyệt lệnh sửa đổi.
 * Duyệt xong thì đẩy job `consolidate` vào bảng jobs để worker sinh lại bản hợp nhất.
 *
 * Quyền: xem và xử lý hàng đợi cần `bien_tap`; duyệt/từ chối lệnh sửa đổi cần `phap_che`
 * (cùng mức với công cụ MCP `duyet_lenh_sua_doi`). Người duyệt lấy từ phiên đăng nhập,
 * không nhận từ body.
 */

import { enqueue, sql } from "@qdpl/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocVaiTro } from "../auth.ts";
import { asDate, badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";
import { AMEND_OP_LABELS } from "../labels.ts";

const uuid = z.string().uuid("Id phải là UUID hợp lệ");

const listSchema = z.object({
  state: z.enum(["open", "in_progress", "resolved", "all"]).default("open"),
  kind: z.string().trim().optional(),
  documentUrn: z.string().trim().optional(),
  assignee: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const resolveSchema = z.object({
  state: z.enum(["resolved", "open", "in_progress"]).default("resolved"),
  resolution: z.string().trim().max(2000).optional(),
  assignee: z.string().trim().max(200).optional(),
});

const reviewSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
});

export const editorial = new Hono();

/** GET /v1/review-queue — hàng đợi biên tập. */
editorial.get("/review-queue", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const p = parseQuery(c, listSchema);
  const state = p.state === "all" ? null : p.state;
  const kind = p.kind || null;
  const documentUrn = p.documentUrn || null;
  const assignee = p.assignee || null;
  const offset = (p.page - 1) * p.limit;

  const where = sql`
        (${state}::text IS NULL OR q.state = ${state}::text)
    AND (${kind}::text IS NULL OR q.kind = ${kind}::text)
    AND (${documentUrn}::text IS NULL OR q.document_urn = ${documentUrn}::text)
    AND (${assignee}::text IS NULL OR q.assignee = ${assignee}::text)`;

  const [rows, [totalRow], byKind] = await Promise.all([
    sql`SELECT q.* FROM review_queue q WHERE ${where}
        ORDER BY q.priority DESC, q.created_at ASC LIMIT ${p.limit} OFFSET ${offset}`,
    sql<Array<{ total: number }>>`SELECT count(*)::int AS total FROM review_queue q WHERE ${where}`,
    sql`SELECT q.kind AS value, count(*)::int AS count FROM review_queue q WHERE ${where}
        GROUP BY 1 ORDER BY 2 DESC`,
  ]);

  const total = Number(totalRow?.total ?? 0);
  return c.json({
    total,
    page: p.page,
    limit: p.limit,
    pages: Math.max(1, Math.ceil(total / p.limit)),
    facets: { kind: byKind },
    items: (rows as unknown as Array<Record<string, unknown>>).map(shapeReviewItem),
  });
});

/** POST /v1/review-queue/:id/resolve — đóng một mục trong hàng đợi. */
editorial.post("/review-queue/:id/resolve", async (c) => {
  const nguoi = await batBuocVaiTro(c, "bien_tap");
  const id = parseUuid(c.req.param("id"));
  const body = await parseBody(c, resolveSchema);
  const rows = await sql`
    UPDATE review_queue
    SET state = ${body.state},
        resolution = COALESCE(${body.resolution ?? null}, resolution),
        assignee = COALESCE(${body.assignee ?? null}, assignee),
        resolved_at = CASE WHEN ${body.state} = 'resolved' THEN now() ELSE NULL END
    WHERE id = ${id}::uuid
    RETURNING *`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw notFound(`Không tìm thấy mục hàng đợi ${id}`);
  await audit(nguoi.email, `review_queue.${body.state}`, id, { resolution: body.resolution ?? null });
  return c.json({ item: shapeReviewItem(row) });
});

/** POST /v1/amend-ops/:id/approve — duyệt lệnh sửa đổi và đẩy job hợp nhất. */
editorial.post("/amend-ops/:id/approve", async (c) => {
  return await reviewAmendOp(c, "approved");
});

/** POST /v1/amend-ops/:id/reject — từ chối lệnh sửa đổi. */
editorial.post("/amend-ops/:id/reject", async (c) => {
  return await reviewAmendOp(c, "rejected");
});

async function reviewAmendOp(c: Context, status: "approved" | "rejected") {
  const nguoi = await batBuocVaiTro(c, "phap_che");
  const id = parseUuid(c.req.param("id"));
  const body = await parseBody(c, reviewSchema);

  const [existing] = await sql<Array<{ id: string; review_status: string; target_doc_urn: string }>>`
    SELECT id, review_status, target_doc_urn FROM amendment_ops WHERE id = ${id}::uuid`;
  if (!existing) throw notFound(`Không tìm thấy lệnh sửa đổi ${id}`);
  if (existing.review_status === status) {
    throw conflict(`Lệnh sửa đổi ${id} đã ở trạng thái ${status}`);
  }

  const rows = await sql`
    UPDATE amendment_ops
    SET review_status = ${status},
        reviewer_id = ${nguoi.email},
        reviewed_at = now(),
        notes = COALESCE(${body.notes ?? null}, notes)
    WHERE id = ${id}::uuid
    RETURNING *`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw notFound(`Không tìm thấy lệnh sửa đổi ${id}`);

  // Đóng mục hàng đợi tương ứng (nếu có).
  await sql`
    UPDATE review_queue SET state = 'resolved', resolution = ${status}, resolved_at = now()
    WHERE kind = 'amend_op' AND ref_id = ${id} AND state <> 'resolved'`;

  let jobId: string | null = null;
  if (status === "approved") {
    // Nội dung hợp nhất phụ thuộc lệnh này -> yêu cầu worker sinh lại phiên bản.
    jobId = await enqueue(
      "consolidate",
      { targetDocUrn: existing.target_doc_urn, reason: "amend_op_approved", opId: id },
      { priority: 10 },
    );
  }
  await audit(nguoi.email, `amendment_ops.${status}`, id, { targetDocUrn: existing.target_doc_urn, jobId });

  return c.json({ op: shapeAmendOp(row), enqueuedJobId: jobId });
}

function parseUuid(raw: string | undefined): string {
  const res = uuid.safeParse(raw ?? "");
  if (!res.success) throw badRequest("Tham số id phải là UUID hợp lệ");
  return res.data;
}

async function audit(actor: string, action: string, target: string, detail: unknown) {
  // Cột jsonb: truyền thẳng object qua sql.json, không JSON.stringify.
  await sql`
    INSERT INTO audit_log (actor, action, target, detail)
    VALUES (${actor}, ${action}, ${target}, ${sql.json(detail as never)})`;
}

function shapeReviewItem(r: Record<string, unknown>) {
  return {
    id: r.id,
    kind: r.kind,
    refId: r.ref_id,
    documentUrn: r.document_urn ?? null,
    priority: r.priority,
    payload: r.payload ?? {},
    state: r.state,
    assignee: r.assignee ?? null,
    resolution: r.resolution ?? null,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at ?? null,
  };
}

function shapeAmendOp(r: Record<string, unknown>) {
  return {
    id: r.id,
    amendingDocUrn: r.amending_doc_urn,
    amendingLabel: r.amending_label ?? null,
    targetDocUrn: r.target_doc_urn,
    targetPath: r.target_path,
    op: r.op,
    opLabel: AMEND_OP_LABELS[String(r.op)] ?? String(r.op),
    payload: r.payload ?? null,
    effectiveFrom: asDate(r.effective_from),
    effectiveTo: asDate(r.effective_to),
    ordinal: r.ordinal,
    extraction: r.extraction,
    confidence: r.confidence,
    reviewStatus: r.review_status,
    reviewerId: r.reviewer_id ?? null,
    reviewedAt: r.reviewed_at ?? null,
    notes: r.notes ?? null,
  };
}
