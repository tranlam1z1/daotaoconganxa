import { searchTraffic, sql, trafficDetail, verifiedCitation } from "@qdpl/db";
import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { batBuocDangNhap, batBuocVaiTro, diaChiIp } from "../auth.ts";
import { badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";
import { penaltyInput, trafficDate, trafficLimiter, trafficQuery } from "../traffic-contract.ts";
import { trafficOpenApi } from "../traffic-openapi.ts";
import { vaiTroDuyet } from "./ngan-hang.ts";

export const traffic = new Hono();
const allow = trafficLimiter();
export const trafficGuard: MiddlewareHandler = async (c, next) => {
  const peer = (c.env as { requestIP?: (r: Request) => { address: string } | null } | undefined)?.requestIP?.(
    c.req.raw,
  )?.address;
  const key = process.env.TRAFFIC_TRUST_PROXY === "1" ? diaChiIp(c) : peer;
  if (c.req.method !== "OPTIONS" && !allow(key ?? "unknown")) {
    c.header("Retry-After", "60");
    return c.json({ error: { code: "rate_limited", message: "Vui lòng thử lại sau." } }, 429);
  }
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "no-store");
  await next();
};
traffic.use("*", bodyLimit({ maxSize: 2 * 1024 * 1024 }));
traffic.get("/openapi.json", (c) => c.json(trafficOpenApi));

for (const kind of ["signs", "violations"] as const) {
  traffic.get(`/${kind}/categories`, async (c) => {
    const table = kind === "signs" ? sql`sign_categories` : sql`violation_categories`;
    return c.json({ items: await sql`SELECT code, name FROM ${table} ORDER BY name` });
  });
  traffic.get(`/${kind}`, async (c) => c.json(await searchTraffic(kind, parseQuery(c, trafficQuery))));
  traffic.get(`/${kind}/:code`, async (c) => {
    const p = parseQuery(c, trafficQuery);
    const code = z.string().min(1).max(80).safeParse(c.req.param("code"));
    if (!code.success) throw badRequest("Mã không hợp lệ.");
    const item = await trafficDetail(kind, code.data, p.as_of);
    if (!item) throw notFound("Không có dữ liệu đã duyệt tại ngày tra cứu.");
    return c.json(item);
  });
}

traffic.get("/history", async (c) => {
  const p = await batBuocDangNhap(c);
  if (!p.accountId) throw badRequest("Phiên không gắn tài khoản.");
  return c.json({
    items: await sql`SELECT id,kind,query,created_at FROM search_histories
 WHERE account_id = ${p.accountId} ORDER BY id DESC LIMIT 20`,
  });
});
traffic.post("/history", async (c) => {
  const p = await batBuocDangNhap(c);
  if (!p.accountId) throw badRequest("Phiên không gắn tài khoản.");
  const accountId = p.accountId;
  const b = await parseBody(
    c,
    z.object({ kind: z.enum(["signs", "violations"]), query: z.string().trim().min(1).max(200) }),
  );
  await sql.begin(async (tx) => {
    await tx`SELECT id FROM accounts WHERE id = ${accountId} FOR UPDATE`;
    await tx`INSERT INTO search_histories(account_id,kind,query) VALUES (${accountId},${b.kind},${b.query})`;
    await tx`DELETE FROM search_histories WHERE account_id = ${accountId} AND id NOT IN
   (SELECT id FROM search_histories WHERE account_id = ${accountId} ORDER BY id DESC LIMIT 100)`;
  });
  return c.json({ saved: true }, 201);
});
traffic.delete("/history", async (c) => {
  const p = await batBuocDangNhap(c);
  if (!p.accountId) throw badRequest("Phiên không gắn tài khoản.");
  await sql`DELETE FROM search_histories WHERE account_id = ${p.accountId}`;
  return c.body(null, 204);
});

traffic.use("/admin/*", async (c, next) => {
  await batBuocVaiTro(c, "quan_ly");
  await next();
});
traffic.get("/admin/penalties", async (c) => {
  const p = parseQuery(c, trafficQuery);
  return c.json({
    items: await sql`SELECT * FROM violation_penalties ORDER BY id
 LIMIT ${p.page_size} OFFSET ${(p.page - 1) * p.page_size}`,
  });
});
traffic.post("/admin/penalties", async (c) => {
  const actor = await batBuocVaiTro(c, "quan_ly");
  const b = await parseBody(c, penaltyInput);
  const [exists] =
    await sql`SELECT code FROM violations WHERE code = ${b.violation_code} AND deleted_at IS NULL`;
  if (!exists) throw badRequest("Hành vi không tồn tại.");
  const row = await sql.begin(async (tx) => {
    const [r] = await tx`INSERT INTO violation_penalties
   (violation_code,conditions,required_facts,fine_min,fine_max,point_deduction,
    suspension_months_min,suspension_months_max,additional_penalties,remedies,citation_urn,
    effective_from,effective_to,created_by)
   VALUES (${b.violation_code},${b.conditions},${b.required_facts},${b.fine_min},${b.fine_max},${b.point_deduction},
    ${b.suspension_months_min},${b.suspension_months_max},${b.additional_penalties},${b.remedies},${b.citation_urn},
    ${b.effective_from},${b.effective_to},${actor.email}) RETURNING *`;
    await tx`INSERT INTO audit_log(actor,action,target) VALUES (${actor.email},'traffic.penalty.create',${r!.id})`;
    return r;
  });
  return c.json(row!, 201);
});

traffic.put("/admin/penalties/:id", async (c) => {
  const actor = await batBuocVaiTro(c, "quan_ly");
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw badRequest("ID không hợp lệ.");
  const b = await parseBody(c, penaltyInput.and(z.object({ version: z.number().int().positive() })));
  const row = await sql.begin(async (tx) => {
    const [parent] =
      await tx`SELECT code FROM violations WHERE code = ${b.violation_code} AND deleted_at IS NULL`;
    if (!parent) throw badRequest("Hành vi không tồn tại.");
    const [r] = await tx`UPDATE violation_penalties SET violation_code=${b.violation_code},
   conditions=${b.conditions},required_facts=${b.required_facts},fine_min=${b.fine_min},fine_max=${b.fine_max},
   point_deduction=${b.point_deduction},suspension_months_min=${b.suspension_months_min},suspension_months_max=${b.suspension_months_max},
   additional_penalties=${b.additional_penalties},remedies=${b.remedies},citation_urn=${b.citation_urn},
   effective_from=${b.effective_from},effective_to=${b.effective_to},status='nhap',
   reviewed_by=NULL,reviewed_at=NULL,version=version+1
   WHERE id=${id.data} AND version=${b.version} AND deleted_at IS NULL RETURNING *`;
    if (!r) throw conflict("Phiên bản đã thay đổi hoặc bản ghi không còn tồn tại.");
    await tx`INSERT INTO audit_log(actor,action,target) VALUES (${actor.email},'traffic.penalty.edit',${id.data})`;
    return r;
  });
  return c.json(row!);
});

traffic.put("/admin/signs/:code/validity", async (c) => {
  const actor = await batBuocVaiTro(c, "quan_ly");
  const b = await parseBody(
    c,
    z
      .object({
        effective_from: trafficDate,
        effective_to: trafficDate.nullable(),
        version: z.number().int().positive(),
      })
      .refine((v) => !v.effective_to || v.effective_to > v.effective_from, "Khoảng hiệu lực không hợp lệ"),
  );
  const row = await sql.begin(async (tx) => {
    const [r] =
      await tx`UPDATE traffic_signs SET effective_from=${b.effective_from},effective_to=${b.effective_to},
   status='cho_duyet',version=version+1,updated_at=now()
   WHERE code=${c.req.param("code")} AND version=${b.version} AND deleted_at IS NULL RETURNING code,version,status`;
    if (!r) throw conflict("Phiên bản đã thay đổi hoặc bản ghi không còn tồn tại.");
    await tx`INSERT INTO content_reviews(kind,ref,version,action,actor) VALUES ('traffic_sign',${r.code},${r.version},'sua',${actor.email})`;
    return r;
  });
  return c.json(row!);
});

traffic.delete("/admin/:kind/:code", async (c) => {
  const actor = await batBuocVaiTro(c, "quan_ly");
  const kind = z.enum(["signs", "violations", "penalties"]).safeParse(c.req.param("kind"));
  if (!kind.success) throw badRequest("Loại không hợp lệ.");
  const b = await parseBody(c, z.object({ version: z.number().int().positive() }));
  const table =
    kind.data === "signs"
      ? sql`traffic_signs`
      : kind.data === "violations"
        ? sql`violations`
        : sql`violation_penalties`;
  const key = kind.data === "penalties" ? sql`id::text` : sql`code`;
  await sql.begin(async (tx) => {
    const rows = await tx`UPDATE ${table} SET deleted_at=now(),status='ngung',version=version+1
   WHERE ${key}=${c.req.param("code")} AND version=${b.version} AND deleted_at IS NULL RETURNING version`;
    if (!rows.length) throw conflict("Phiên bản đã thay đổi hoặc bản ghi không còn tồn tại.");
    await tx`INSERT INTO audit_log(actor,action,target) VALUES (${actor.email},${`traffic.${kind.data}.delete`},${c.req.param("code")})`;
  });
  return c.body(null, 204);
});

traffic.get("/admin/export/:kind", async (c) => {
  const kind = z.enum(["signs", "violations", "penalties"]).safeParse(c.req.param("kind"));
  if (!kind.success) throw badRequest("Loại không hợp lệ.");
  const p = parseQuery(c, trafficQuery.extend({ format: z.enum(["json", "csv"]).default("json") }));
  const table =
    kind.data === "signs"
      ? sql`traffic_signs`
      : kind.data === "violations"
        ? sql`violations`
        : sql`violation_penalties`;
  const key = kind.data === "penalties" ? sql`id` : sql`code`;
  const rows =
    await sql`SELECT * FROM ${table} ORDER BY ${key} LIMIT ${p.page_size} OFFSET ${(p.page - 1) * p.page_size}`;
  c.header("Content-Disposition", `attachment; filename="traffic-${kind.data}-${p.page}.${p.format}"`);
  if (p.format === "json") return c.json({ items: rows, page: p.page, page_size: p.page_size });
  const columns = Object.keys(rows[0] ?? {});
  const cell = (v: unknown) => {
    let text = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  c.header("Content-Type", "text/csv; charset=utf-8");
  return c.body(
    "\uFEFF" +
      [columns.map(cell).join(","), ...rows.map((row) => columns.map((k) => cell(row[k])).join(","))].join(
        "\r\n",
      ),
  );
});
traffic.post("/admin/penalties/:id/review", async (c) => {
  const actor = await batBuocVaiTro(c, vaiTroDuyet());
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw badRequest("ID không hợp lệ.");
  const b = await parseBody(c, z.object({ version: z.number().int().positive(), approve: z.boolean() }));
  const row = await sql.begin(async (tx) => {
    const [p] = await tx`SELECT * FROM violation_penalties WHERE id = ${id.data} FOR UPDATE`;
    if (!p) throw notFound("Không có khung phạt.");
    if (p.version !== b.version || p.deleted_at) throw conflict("Phiên bản đã thay đổi.");
    if (b.approve) {
      const [valid] =
        await tx`SELECT 1 WHERE ${verifiedCitation(p.citation_urn, String(p.effective_from instanceof Date ? p.effective_from.toISOString().slice(0, 10) : p.effective_from))}`;
      if (!valid) throw badRequest("Chưa có căn cứ và nguồn đã duyệt tại ngày bắt đầu hiệu lực.");
    }
    const [r] = await tx`UPDATE violation_penalties SET status = ${b.approve ? "da_duyet" : "ngung"},
   reviewed_by = ${actor.email}, reviewed_at = now(), version = version + 1 WHERE id = ${id.data} RETURNING *`;
    await tx`INSERT INTO audit_log(actor,action,target,detail) VALUES (${actor.email},'traffic.penalty.review',${id.data},${tx.json(b)})`;
    return r;
  });
  return c.json(row!);
});
traffic.get("/admin/revisions/:kind/:code", async (c) => {
  const kind = z.enum(["traffic_signs", "violations", "violation_penalties"]).safeParse(c.req.param("kind"));
  if (!kind.success) throw badRequest("Loại không hợp lệ.");
  const p = parseQuery(c, trafficQuery);
  return c.json({
    items: await sql`SELECT * FROM traffic_revisions WHERE entity = ${kind.data}
 AND ref = ${c.req.param("code")} ORDER BY id DESC LIMIT ${p.page_size} OFFSET ${(p.page - 1) * p.page_size}`,
  });
});
traffic.get("/admin/imports", async (c) => {
  const p = parseQuery(c, trafficQuery);
  return c.json({
    items: await sql`SELECT * FROM import_jobs ORDER BY created_at DESC
 LIMIT ${p.page_size} OFFSET ${(p.page - 1) * p.page_size}`,
  });
});
traffic.post("/admin/imports", async (c) => {
  const actor = await batBuocVaiTro(c, "quan_ly");
  const b = await parseBody(
    c,
    z.object({
      source_url: z.url().startsWith("https://"),
      source_hash: z.string().regex(/^[a-f0-9]{64}$/),
      records: z
        .array(
          z.object({
            kind: z.enum(["sign", "violation", "unclassified"]),
            text: z.string().max(50000),
            page: z.number().int().positive().nullable(),
            status: z.literal("nhap"),
            missing: z.array(z.string().max(100)).max(30),
          }),
        )
        .max(1000),
    }),
  );
  const result = await sql.begin(async (tx) => {
    const rows = await tx`INSERT INTO import_jobs(source_url,source_hash,payload,created_by)
   VALUES (${b.source_url},${b.source_hash},${tx.json(b as never)},${actor.email}) ON CONFLICT(source_hash) DO NOTHING RETURNING id,status`;
    if (!rows.length) throw conflict("Tài liệu đã được đưa vào staging.");
    await tx`INSERT INTO audit_log(actor,action,target) VALUES (${actor.email},'traffic.import.stage',${rows[0]!.id})`;
    return rows[0]!;
  });
  return c.json(result, 201);
});
