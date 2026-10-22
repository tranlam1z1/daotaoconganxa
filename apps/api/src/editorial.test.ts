/**
 * Kiểm thử hàng đợi biên tập và duyệt lệnh sửa đổi trên Postgres thật.
 * Chỉ tạo/xóa dữ liệu mang tiền tố riêng của test; không đụng dữ liệu mẫu chung.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();

/** Tiền tố riêng để nhận diện và dọn sạch dữ liệu do test tạo. */
const PREFIX = "test-qdpl-editorial";
const TARGET_URN = `vn:doc:${PREFIX}:001`;
const AMENDING_URN = `vn:doc:${PREFIX}:002`;
/** Tài khoản Admin quản lý của test: đủ quyền xem hàng đợi và duyệt lệnh sửa đổi. */
const EMAIL = `${PREFIX}@vidu.vn`;
let token = "";

let opPendingId = "";
let opRejectId = "";
let queueId = "";

async function post(path: string, payload: unknown): Promise<{ status: number; body: any }> {
  const res = await app.request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path: string): Promise<{ status: number; body: any }> {
  const res = await app.request(`http://test${path}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json() };
}

async function cleanup() {
  await sql`DELETE FROM jobs WHERE payload::text LIKE ${`%${PREFIX}%`}`;
  await sql`DELETE FROM audit_log WHERE detail::text LIKE ${`%${PREFIX}%`}`;
  await sql`DELETE FROM review_queue WHERE ref_id LIKE ${`%${PREFIX}%`} OR document_urn = ${TARGET_URN}`;
  await sql`DELETE FROM amendment_ops WHERE amending_doc_urn = ${AMENDING_URN}`;
  await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
}

beforeAll(async () => {
  await cleanup();

  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${EMAIL}, 'quan_ly') RETURNING id`;
  token = (await createSession(acc!.id, "test")).token;

  const [pending] = await sql<Array<{ id: string }>>`
    INSERT INTO amendment_ops (amending_doc_urn, amending_label, target_doc_urn, target_path, op, payload,
                               effective_from, ordinal, extraction, confidence, review_status)
    VALUES (${AMENDING_URN}, 'khoản 1 Điều 1', ${TARGET_URN}, 'dieu-1.khoan-1', 'replace',
            ${sql.json({ text: "1. Nội dung mới dùng cho kiểm thử." })},
            '2027-07-01', 1, 'llm', 0.9, 'pending')
    RETURNING id`;
  opPendingId = pending!.id;

  const [reject] = await sql<Array<{ id: string }>>`
    INSERT INTO amendment_ops (amending_doc_urn, amending_label, target_doc_urn, target_path, op, payload,
                               effective_from, ordinal, extraction, confidence, review_status)
    VALUES (${AMENDING_URN}, 'khoản 2 Điều 1', ${TARGET_URN}, 'dieu-2', 'repeal', ${sql.json({})},
            '2027-07-01', 2, 'llm', 0.4, 'pending')
    RETURNING id`;
  opRejectId = reject!.id;

  const [q] = await sql<Array<{ id: string }>>`
    INSERT INTO review_queue (kind, ref_id, document_urn, priority, payload, state)
    VALUES ('amend_op', ${opPendingId}, ${TARGET_URN}, 5,
            ${sql.json({ note: `${PREFIX}: cần đối chiếu bản gốc` })}, 'open')
    RETURNING id`;
  queueId = q!.id;
});

afterAll(async () => {
  await cleanup();
});

describe("GET /v1/review-queue", () => {
  test("liệt kê mục đang mở, có phân trang và facet", async () => {
    const { status, body } = await get(`/v1/review-queue?documentUrn=${encodeURIComponent(TARGET_URN)}`);
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(1);
    const item = body.items.find((i: any) => i.id === queueId);
    expect(item).toBeDefined();
    expect(item.kind).toBe("amend_op");
    expect(item.state).toBe("open");
    // Cột jsonb phải đọc ra object, không phải chuỗi.
    expect(typeof item.payload).toBe("object");
    expect(item.payload.note).toContain(PREFIX);
    expect(body.facets.kind.some((f: any) => f.value === "amend_op")).toBe(true);
  });

  test("lọc theo state=all", async () => {
    const { body } = await get(`/v1/review-queue?state=all&documentUrn=${encodeURIComponent(TARGET_URN)}`);
    expect(body.items.some((i: any) => i.id === queueId)).toBe(true);
  });
});

describe("POST /v1/review-queue/:id/resolve", () => {
  test("id không phải UUID trả 400", async () => {
    const { status, body } = await post("/v1/review-queue/khong-phai-uuid/resolve", {});
    expect(status).toBe(400);
    expect(body.error.code).toBe("tham_so_khong_hop_le");
  });

  test("mục không tồn tại trả 404", async () => {
    const { status } = await post("/v1/review-queue/00000000-0000-4000-8000-000000000000/resolve", {});
    expect(status).toBe(404);
  });

  test("đóng mục và ghi resolution", async () => {
    const { status, body } = await post(`/v1/review-queue/${queueId}/resolve`, {
      state: "resolved",
      resolution: `${PREFIX}: đã đối chiếu, đúng bản gốc`,
      assignee: "bien-tap-vien-1",
    });
    expect(status).toBe(200);
    expect(body.item.state).toBe("resolved");
    expect(body.item.resolution).toContain(PREFIX);
    expect(body.item.assignee).toBe("bien-tap-vien-1");
    expect(body.item.resolvedAt).not.toBeNull();
  });
});

describe("POST /v1/amend-ops/:id/approve|reject", () => {
  test("lệnh không tồn tại trả 404", async () => {
    const { status } = await post("/v1/amend-ops/00000000-0000-4000-8000-000000000000/approve", {});
    expect(status).toBe(404);
  });

  test("duyệt lệnh: cập nhật review_status và đẩy job consolidate", async () => {
    const { status, body } = await post(`/v1/amend-ops/${opPendingId}/approve`, {
      notes: `${PREFIX}: đã kiểm tra`,
    });
    expect(status).toBe(200);
    expect(body.op.reviewStatus).toBe("approved");
    expect(body.op.reviewerId).toBe(EMAIL);
    expect(body.op.opLabel).toContain("Sửa đổi");
    // payload jsonb đọc ra object thật.
    expect(body.op.payload.text).toContain("Nội dung mới");
    expect(body.enqueuedJobId).not.toBeNull();

    const [job] = await sql<Array<{ queue: string; state: string; payload: Record<string, unknown> }>>`
      SELECT queue, state, payload FROM jobs WHERE id = ${body.enqueuedJobId}::bigint`;
    expect(job!.queue).toBe("consolidate");
    expect(job!.state).toBe("pending");
    expect(job!.payload.targetDocUrn).toBe(TARGET_URN);
    expect(job!.payload.opId).toBe(opPendingId);
  });

  test("duyệt lại lệnh đã duyệt trả 409", async () => {
    const { status, body } = await post(`/v1/amend-ops/${opPendingId}/approve`, {});
    expect(status).toBe(409);
    expect(body.error.code).toBe("xung_dot");
  });

  test("từ chối lệnh: không đẩy job", async () => {
    const { status, body } = await post(`/v1/amend-ops/${opRejectId}/reject`, {
      notes: `${PREFIX}: trích sai điều`,
    });
    expect(status).toBe(200);
    expect(body.op.reviewStatus).toBe("rejected");
    expect(body.enqueuedJobId).toBeNull();
  });

  test("duyệt lệnh cũng đóng mục hàng đợi tương ứng", async () => {
    const [row] = await sql<Array<{ state: string; resolution: string }>>`
      SELECT state, resolution FROM review_queue WHERE id = ${queueId}::uuid`;
    expect(row!.state).toBe("resolved");
  });

  test("ghi audit_log", async () => {
    const rows = await sql<Array<{ action: string; target: string }>>`
      SELECT action, target FROM audit_log WHERE detail::text LIKE ${`%${PREFIX}%`}`;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => r.action === "amendment_ops.approved")).toBe(true);
    expect(rows.some((r) => r.action === "amendment_ops.rejected")).toBe(true);
  });
});
