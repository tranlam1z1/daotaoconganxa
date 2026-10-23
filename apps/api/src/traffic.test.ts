import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { createApp } from "./app.ts";

// Synthetic fixtures exist only in the isolated test database, never a production seed.
const prefix = "test-traffic-api";
const urn = `vn:vbqppl:nd:${prefix}`;
const app = createApp();
let docId: string;
let versionId: string;
let adminToken: string;
let userToken: string;
let otherToken: string;
async function mutate(method: string, path: string, token: string, body?: unknown) {
  const r = await app.request(`http://test/api/v1/traffic${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
async function get(path: string) {
  const r = await app.request(`http://test/api/v1/traffic${path}`);
  return { status: r.status, body: (await r.json()) as any };
}
beforeAll(async () => {
  for (const [role, name] of [
    ["quan_tri", "admin"],
    ["can_bo", "user"],
    ["can_bo", "other"],
  ] as const) {
    const [a] =
      await sql`INSERT INTO accounts(email,role) VALUES (${`${prefix}-${name}@example.test`},${role}) RETURNING id`;
    const token = (await createSession(a!.id, "test")).token;
    if (name === "admin") adminToken = token;
    else if (name === "user") userToken = token;
    else otherToken = token;
  }
  const [d] = await sql`INSERT INTO documents(urn,doc_type,rank,so_ky_hieu,title,short_title,primary_source)
 VALUES (${urn},'nd',50,${prefix},'Test fixture','Test fixture','https://example.gov.vn/test') RETURNING id`;
  docId = d!.id;
  const [v] =
    await sql`INSERT INTO document_versions(document_id,version_no,kind,valid_from,reviewed_at,reviewed_by)
 VALUES (${docId},1,'original','2025-01-01',now(),'test') RETURNING id`;
  versionId = v!.id;
  await sql`INSERT INTO nodes(version_id,document_id,path,full_path,kind,label,text_plain)
 VALUES (${versionId},${docId},'dieu-1','dieu-1','article','Điều 1','Test only')`;
  for (const [i, status] of [
    [1, "da_duyet"],
    [2, "nhap"],
    [3, "ngung"],
  ] as const) {
    await sql`INSERT INTO traffic_signs(code,group_name,name,meaning,image_uri,citation_urn,status,effective_from)
   VALUES (${`${prefix}-${i}`},'cam',${`${prefix} Cấm đỗ`},'Ý nghĩa thử nghiệm','assets/bien-bao/test.svg',
    ${`${urn}#dieu-1`},${status},'2025-01-01')`;
  }
  await sql`INSERT INTO violations(code,vehicle,behavior,fine_min,fine_max,citation_urn,effective_from,status,keywords)
 VALUES (${prefix},'o_to',${`${prefix} Không chấp hành`},100,200,${`${urn}#dieu-1`},'2025-01-01','da_duyet',ARRAY['test-synonym'])`;
});
afterAll(async () => {
  await sql`DELETE FROM violation_penalties WHERE violation_code = ${prefix}`;
  await sql`DELETE FROM import_jobs WHERE created_by LIKE ${`${prefix}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${prefix}%`}`;
  await sql`DELETE FROM traffic_signs WHERE code LIKE ${`${prefix}%`}`;
  await sql`DELETE FROM violations WHERE code = ${prefix}`;
  await sql`DELETE FROM documents WHERE id = ${docId}`;
  await sql`DELETE FROM traffic_revisions WHERE ref LIKE ${`${prefix}%`}`;
});
describe("traffic API on PostgreSQL", () => {
  test("publishes only reviewed rows and validates pagination", async () => {
    const r = await get(`/signs?q=${prefix}&as_of=2026-01-01&page_size=1`);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(1);
    expect(r.body.items).toHaveLength(1);
    expect((await get("/signs?page_size=101")).status).toBe(400);
    expect((await get("/signs?as_of=2026-02-30")).status).toBe(400);
  });
  test("searches unaccented meaning and keywords without SQL interpolation", async () => {
    const r = await get(`/signs?q=${encodeURIComponent("y nghia thu nghiem")}&as_of=2026-01-01`);
    expect(r.body.items.some((x: any) => x.code === `${prefix}-1`)).toBe(true);
    const v = await get("/violations?q=test-synonym&as_of=2026-01-01");
    expect(v.body.items.some((x: any) => x.code === prefix)).toBe(true);
    expect((await get(`/signs?q=${encodeURIComponent("'; DROP TABLE traffic_signs;--")}`)).status).toBe(200);
  });
  test("omits future, expired, missing or unreviewed provisions", async () => {
    expect((await get(`/signs/${prefix}-1?as_of=2024-12-31`)).status).toBe(404);
    await sql`UPDATE document_versions SET reviewed_at = NULL WHERE id = ${versionId}`;
    expect((await get(`/signs/${prefix}-1?as_of=2026-01-01`)).status).toBe(404);
    await sql`UPDATE document_versions SET reviewed_at = now() WHERE id = ${versionId}`;
    await sql`UPDATE traffic_signs SET effective_to = '2026-02-01' WHERE code = ${`${prefix}-1`}`;
    expect((await get(`/signs/${prefix}-1?as_of=2026-02-01`)).status).toBe(404);
    expect((await get(`/signs/${prefix}-1?as_of=2026-01-31`)).status).toBe(200);
  });
  test("archives prior content and never exposes deleted signs", async () => {
    await sql`UPDATE traffic_signs SET deleted_at = now() WHERE code = ${`${prefix}-1`}`;
    expect((await get(`/signs/${prefix}-1?as_of=2026-01-01`)).status).toBe(404);
    const rows = await sql`SELECT snapshot FROM traffic_revisions WHERE ref = ${`${prefix}-1`}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.snapshot.name).toContain("Cấm đỗ");
  });
  test("protects staging, revisions, penalties and private history", async () => {
    for (const path of [
      "/admin/imports",
      "/admin/penalties",
      `/admin/revisions/traffic_signs/${prefix}`,
      "/history",
    ])
      expect((await get(path)).status).toBe(401);
  });
  test("serves a usable OpenAPI document", async () => {
    const r = await get("/openapi.json");
    expect(r.body.openapi).toBe("3.0.3");
    expect(r.body.paths["/signs"]).toBeDefined();
  });
  test("admin stages without publishing and rejects duplicate sources", async () => {
    const input = {
      source_url: "https://example.gov.vn/test",
      source_hash: "e".repeat(64),
      records: [
        { kind: "violation", text: "Test staging only", page: 1, status: "nhap", missing: ["human_review"] },
      ],
    };
    expect((await mutate("POST", "/admin/imports", userToken, input)).status).toBe(403);
    const r = await mutate("POST", "/admin/imports", adminToken, input);
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("staging");
    expect((await mutate("POST", "/admin/imports", adminToken, input)).status).toBe(409);
  });
  test("penalty approval, editing and stale version protection", async () => {
    const input = {
      violation_code: prefix,
      conditions: ["Test condition"],
      required_facts: ["Test fact"],
      fine_min: 100,
      fine_max: 200,
      point_deduction: null,
      suspension_months_min: null,
      suspension_months_max: null,
      additional_penalties: [],
      remedies: [],
      citation_urn: `${urn}#dieu-1`,
      effective_from: "2025-01-01",
      effective_to: null,
    };
    const created = await mutate("POST", "/admin/penalties", adminToken, input);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("nhap");
    const path = `/admin/penalties/${created.body.id}`;
    expect((await mutate("POST", `${path}/review`, userToken, { version: 1, approve: true })).status).toBe(
      403,
    );
    expect((await mutate("POST", `${path}/review`, adminToken, { version: 1, approve: true })).status).toBe(
      200,
    );
    let detail = await get(`/violations/${prefix}?as_of=2026-01-01`);
    expect(detail.body.penalties).toHaveLength(1);
    expect(detail.body.required_facts).toEqual(["Test fact"]);
    expect((await mutate("PUT", path, adminToken, { ...input, version: 1 })).status).toBe(409);
    expect((await mutate("PUT", path, adminToken, { ...input, version: 2, fine_max: 300 })).status).toBe(200);
    detail = await get(`/violations/${prefix}?as_of=2026-01-01`);
    expect(detail.body.penalties).toHaveLength(0);
    expect(detail.body.data_completeness).toBe("no_reviewed_penalty_frames");
  });
  test("history belongs only to the authenticated account", async () => {
    expect((await mutate("POST", "/history", userToken, { kind: "signs", query: "test query" })).status).toBe(
      201,
    );
    expect((await mutate("GET", "/history", userToken)).body.items).toHaveLength(1);
    expect((await mutate("GET", "/history", otherToken)).body.items).toHaveLength(0);
    expect((await mutate("DELETE", "/history", userToken)).status).toBe(204);
  });
});
