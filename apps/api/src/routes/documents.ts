import { ngayTraCuuSchema } from "../ngay-tra-cuu.ts";
/** Endpoint tra cứu văn bản: danh sách, metadata, nội dung theo thời điểm, quan hệ, phiên bản, diff. */

import { getDocumentBySlug, getRelations, getStatusAsOf, sql } from "@qdpl/db";
import { diffTrees, docTypeByCode } from "@qdpl/legal-model";
import { getObject, objectExists, putObject } from "@qdpl/storage";
import { Hono } from "hono";
import { z } from "zod";
import { contentAsOf, listVersionRows, renderMarkdown, requireDocument } from "../content.ts";
import { asDate, badRequest, csv, decodeUrnParam, notFound, parseQuery, today } from "../http.ts";
import {
  DOC_STATUS_LABELS,
  GROUP_LABELS,
  type RelationGroup,
  relationGroup,
  relationLabel,
  VERSION_KIND_LABELS,
} from "../labels.ts";
import { traTepTaiLieu } from "../tep-tai-lieu.ts";

const dateSchema = ngayTraCuuSchema;

const listSchema = z.object({
  q: z.string().trim().optional(),
  docType: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  field: z.union([z.string(), z.array(z.string())]).optional(),
  issuer: z.string().trim().optional(),
  locality: z.string().trim().optional(),
  asOf: dateSchema.optional(),
  // "thu_bac": theo thứ bậc hiệu lực pháp lý; "moi_nhat": văn bản ban hành gần đây lên đầu.
  sort: z.enum(["thu_bac", "moi_nhat"]).default("thu_bac"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const asOfSchema = z.object({ asOf: dateSchema.optional() });

const contentSchema = z.object({
  asOf: dateSchema.optional(),
  format: z.enum(["md", "json"]).default("md"),
});

const diffSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  includeUnchanged: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/** Một dòng facet đếm. */
interface Facet {
  value: string;
  count: number;
}

export const documents = new Hono();

/** Danh sách văn bản có phân trang và facet đếm theo loại / trạng thái / lĩnh vực. */
documents.get("/", async (c) => {
  const p = parseQuery(c, listSchema);
  const q = p.q?.trim() || null;
  const docTypes = csv(p.docType) ?? null;
  const status = csv(p.status) ?? null;
  const fields = csv(p.field) ?? null;
  const issuer = p.issuer || null;
  const locality = p.locality || null;
  const asOf = p.asOf ?? today();
  const offset = (p.page - 1) * p.limit;

  /**
   * Trạng thái hiệu lực TẠI asOf: lấy `document_versions.status` của phiên bản đang
   * hiệu lực (migration 0002), phủ thêm hai mốc hiệu lực cấp văn bản. Logic khớp
   * `getStatusAsOf()` của @qdpl/db. `documents.status` chỉ là ảnh chụp hiện tại nên
   * không dùng để lọc theo thời điểm.
   */
  const from = sql`
    documents d
    LEFT JOIN LATERAL (
      SELECT v.status
      FROM document_versions v
      WHERE v.document_id = d.id AND v.valid_from <= ${asOf}::date
        AND (v.valid_to IS NULL OR v.valid_to > ${asOf}::date)
      ORDER BY v.valid_from DESC, v.version_no DESC
      LIMIT 1
    ) vs ON true`;

  const statusAsOf = sql`CASE WHEN d.document_group='dang' THEN d.status
   WHEN d.effective_to IS NOT NULL AND d.effective_to<=${asOf}::date THEN 'het_hieu_luc'
   WHEN d.effective_from IS NOT NULL AND d.effective_from>${asOf}::date THEN 'chua_hieu_luc'
   WHEN vs.status IS NULL THEN 'khong_xac_dinh' ELSE vs.status END`;

  const where = sql`
        NOT d.is_draft AND (${q}::text IS NULL
         OR d.title ILIKE '%' || ${q}::text || '%'
         OR d.short_title ILIKE '%' || ${q}::text || '%'
         OR d.so_ky_hieu ILIKE '%' || ${q}::text || '%'
         OR unaccent(d.title) ILIKE '%' || unaccent(${q}::text) || '%')
    AND (${docTypes}::text[] IS NULL OR d.doc_type = ANY(${docTypes}::text[]))
    AND (${status}::text[] IS NULL OR ${statusAsOf} = ANY(${status}::text[]))
    AND (${fields}::text[] IS NULL OR d.fields && ${fields}::text[])
    AND (${issuer}::text IS NULL OR d.issuer_name ILIKE '%' || ${issuer}::text || '%')
    AND (${locality}::text IS NULL OR d.locality = ${locality}::text)`;

  const orderBy =
    p.sort === "moi_nhat"
      ? sql`d.issued_date DESC NULLS LAST, d.rank ASC, d.so_ky_hieu ASC`
      : sql`d.rank ASC, d.issued_date DESC NULLS LAST, d.so_ky_hieu ASC`;

  const [rows, [totalRow], byType, byStatus, byField] = await Promise.all([
    sql`SELECT d.id, d.urn, d.doc_type, d.rank, d.so_ky_hieu, d.title, d.short_title, d.issuer_name,
               d.locality, d.issued_date, d.effective_from, d.effective_to, d.fields, d.status, d.summary, d.document_group, d.primary_source, d.original_file_uri,
               ${statusAsOf} AS status_as_of
        FROM ${from} WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ${p.limit} OFFSET ${offset}`,
    sql<Array<{ total: number }>>`SELECT count(*)::int AS total FROM ${from} WHERE ${where}`,
    sql<Facet[]>`SELECT d.doc_type AS value, count(*)::int AS count FROM ${from} WHERE ${where}
        GROUP BY 1 ORDER BY 2 DESC, 1`,
    sql<Facet[]>`SELECT ${statusAsOf} AS value, count(*)::int AS count FROM ${from} WHERE ${where}
        GROUP BY 1 ORDER BY 2 DESC, 1`,
    sql<Facet[]>`SELECT f AS value, count(*)::int AS count FROM ${from}, unnest(d.fields) AS f
        WHERE ${where} GROUP BY 1 ORDER BY 2 DESC, 1`,
  ]);

  const total = Number(totalRow?.total ?? 0);
  return c.json({
    total,
    asOf,
    page: p.page,
    limit: p.limit,
    pages: Math.max(1, Math.ceil(total / p.limit)),
    items: rows.map((r) => shapeDocument(r as Record<string, unknown>)),
    facets: {
      docType: byType.map((f) => ({ ...f, label: docTypeByCode(f.value)?.name ?? f.value })),
      // Facet trạng thái đếm theo trạng thái tại asOf, khớp với bộ lọc `status`.
      status: byStatus.map((f) => ({ ...f, label: DOC_STATUS_LABELS[f.value] ?? f.value })),
      field: [...byField],
    },
  });
});

/** URN của văn bản ở đường dẫn web /van-ban/:docType/:slug: slug không đảo ngược được thành URN. */
documents.get("/by-slug/:docType/:slug", async (c) => {
  const doc = await getDocumentBySlug(c.req.param("docType"), c.req.param("slug").toLowerCase());
  if (!doc || doc.is_draft) throw notFound("Không tìm thấy văn bản ở đường dẫn này");
  return c.json({ urn: doc.urn });
});

/** Metadata + danh sách phiên bản + trạng thái. */
documents.get("/:urn", async (c) => {
  const urn = decodeUrnParam(c.req.param("urn"));
  const p = parseQuery(c, asOfSchema);
  const asOf = p.asOf ?? today();
  const doc = await requireDocument(urn);
  const statusAsOf = doc.document_group === "dang" ? doc.status : await getStatusAsOf(doc.id, asOf);
  const versions = await listVersionRows(doc.id);
  const [opCounts] = await sql`
    SELECT count(*) FILTER (WHERE review_status = 'approved')::int AS approved,
           count(*) FILTER (WHERE review_status = 'pending')::int  AS pending,
           count(*)::int AS total
    FROM amendment_ops WHERE target_doc_urn = ${urn}`;
  return c.json({
    asOf,
    // `status` giữ nguyên ảnh chụp hiện tại để không phá vỡ client đang có;
    // `statusAsOf` mới là trạng thái đúng tại thời điểm tra cứu.
    document: shapeDocument(doc as unknown as Record<string, unknown>, statusAsOf),
    versions: versions.map(shapeVersion),
    amendmentOps: opCounts ?? { approved: 0, pending: 0, total: 0 },
    // Bản quét lưu kèm tệp PDF gốc: trang đọc hiện tệp này khi chưa có nội dung chữ.
    coTepGoc: Boolean(doc.original_file_uri),
    soTrangTepGoc: await soTrangTepGoc(doc),
  });
});

/**
 * Số trang của tệp gốc. Văn bản lưu trước migration 0069 chưa có số trang: đếm ở lượt xem đầu
 * rồi ghi lại, để điện thoại vẫn xem được từng trang.
 */
async function soTrangTepGoc(doc: {
  id: string;
  original_file_uri?: string | null;
  original_file_pages?: number | null;
}): Promise<number> {
  if (!doc.original_file_uri) return 0;
  if (doc.original_file_pages != null) return doc.original_file_pages;
  if (!(await objectExists(doc.original_file_uri))) return 0;
  const { soTrangPdf } = await import("@qdpl/sohoa");
  const soTrang = soTrangPdf(await getObject(doc.original_file_uri));
  await sql`UPDATE documents SET original_file_pages = ${soTrang} WHERE id = ${doc.id}`;
  return soTrang;
}

/** Ảnh trang đủ nét trên màn hình điện thoại (A4 rộng khoảng 1075 điểm ảnh). */
const DPI_ANH_TRANG = 130;

/**
 * Một trang của tệp gốc dưới dạng ảnh JPEG. Trình duyệt điện thoại thường không hiện PDF trong
 * khung, nên trang đọc xếp các ảnh này. Ảnh kết xuất lần đầu rồi cất cạnh tệp gốc; tên tệp gốc theo
 * hash nội dung nên ảnh đã cất không bao giờ lệch tệp.
 */
documents.get("/:urn/tep-goc/trang/:trang", async (c) => {
  const doc = await requireDocument(decodeUrnParam(c.req.param("urn")));
  const trang = Number(c.req.param("trang"));
  const tepGoc = doc.original_file_uri;
  if (!tepGoc || !Number.isInteger(trang) || trang < 1 || trang > (await soTrangTepGoc(doc))) {
    throw notFound("Không có trang này.");
  }
  const uri = `${tepGoc}.trang-${trang}.jpg`;
  let anh: Uint8Array;
  if (await objectExists(uri)) {
    anh = await getObject(uri);
  } else {
    // shortcut: mỗi trang chưa có ảnh là một lần nạp cả tệp; kết xuất sẵn lúc lưu nếu lượt xem đầu chậm.
    const { renderTrangJpeg } = await import("@qdpl/sohoa");
    anh = renderTrangJpeg(await getObject(tepGoc), trang, DPI_ANH_TRANG);
    await putObject(uri, anh, { contentType: "image/jpeg" });
  }
  return new Response(anh as BodyInit, {
    headers: {
      "content-type": "image/jpeg",
      // Tệp gốc của văn bản có thể được thay: không cho đệm quá lâu.
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
});

/** Tệp PDF gốc của văn bản nạp từ bản quét; mở ngay trong trình duyệt, `?tai=1` thì tải về. */
documents.get("/:urn/tep-goc", async (c) => {
  const doc = await requireDocument(decodeUrnParam(c.req.param("urn")));
  if (!doc.original_file_uri) throw notFound("Văn bản này không có tệp gốc.");
  return traTepTaiLieu(
    { uri: doc.original_file_uri, ten: `${doc.short_title}.pdf`, duoi: "pdf", kichThuoc: 0 },
    c.req.query("tai") === "1",
  );
});

/** Nội dung tại thời điểm: hợp nhất bằng consolidate() rồi render Markdown hoặc JSON. */
documents.get("/:urn/content", async (c) => {
  const urn = decodeUrnParam(c.req.param("urn"));
  const p = parseQuery(c, contentSchema);
  const asOf = p.asOf ?? today();
  const pit = await contentAsOf(urn, asOf);

  const common = {
    urn,
    asOf,
    versionKind: pit.versionKind,
    versionKindLabel: VERSION_KIND_LABELS[pit.versionKind] ?? pit.versionKind,
    baseVersion: {
      id: pit.baseVersion.id,
      versionNo: pit.baseVersion.version_no,
      kind: pit.baseVersion.kind,
    },
    materializedVersionId: pit.materialized?.id ?? null,
    appliedOps: pit.applied.map((o) => ({
      id: o.id,
      op: o.op,
      targetPath: o.targetPath,
      amendingDocUrn: o.amendingDocUrn,
      amendingLabel: o.amendingLabel ?? null,
      effectiveFrom: o.effectiveFrom,
    })),
    // Không nuốt xung đột: giao diện biên tập cần thấy lệnh nào không áp dụng được.
    conflicts: pit.conflicts.map((x) => ({
      opId: x.op.id,
      op: x.op.op,
      targetPath: x.op.targetPath,
      amendingDocUrn: x.op.amendingDocUrn,
      reason: x.reason,
    })),
    footnotes: pit.footnotes,
    statusAsOf: pit.statusAsOf,
    statusAsOfLabel: DOC_STATUS_LABELS[pit.statusAsOf] ?? pit.statusAsOf,
    document: shapeDocument(pit.doc as unknown as Record<string, unknown>, pit.statusAsOf),
  };

  if (p.format === "json") {
    return c.json({ ...common, format: "json", tree: pit.root });
  }
  return c.json({ ...common, format: "md", markdown: renderMarkdown(pit, asOf) });
});

/** Quan hệ nhóm theo loại, kèm nhãn tiếng Việt và chiều (cha / con / ảnh hưởng). */
documents.get("/:urn/relations", async (c) => {
  const urn = decodeUrnParam(c.req.param("urn"));
  await requireDocument(urn);
  const rows = await getRelations(urn);

  const groups: Record<RelationGroup, Array<Record<string, unknown>>> = {
    van_ban_cha: [],
    van_ban_con: [],
    anh_huong: [],
    khac: [],
  };
  const byType = new Map<string, Array<Record<string, unknown>>>();

  for (const r of rows as unknown as Array<Record<string, unknown>>) {
    const direction = String(r.direction) === "out" ? "out" : "in";
    const type = String(r.type);
    const otherUrn = direction === "out" ? String(r.to_urn) : String(r.from_urn);
    const item = {
      type,
      label: relationLabel(type, direction),
      direction,
      otherUrn,
      otherDocUrn: otherUrn.split("#")[0],
      otherTitle: (r.other_title as string) ?? null,
      otherShortTitle: (r.other_short as string) ?? null,
      otherStatus: (r.other_status as string) ?? null,
      otherStatusLabel: r.other_status ? (DOC_STATUS_LABELS[String(r.other_status)] ?? null) : null,
      effectiveFrom: asDate(r.effective_from),
      effectiveTo: asDate(r.effective_to),
      source: r.source,
      confidence: r.confidence,
      reviewed: r.reviewed,
      evidence: r.evidence ?? null,
    };
    groups[relationGroup(type, direction)].push(item);
    const list = byType.get(type) ?? [];
    list.push(item);
    byType.set(type, list);
  }

  return c.json({
    urn,
    total: rows.length,
    groups: (Object.keys(groups) as RelationGroup[]).map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      items: groups[g],
    })),
    byType: [...byType.entries()].map(([type, items]) => ({
      type,
      label: relationLabel(type, String(items[0]?.direction) === "out" ? "out" : "in"),
      items,
    })),
  });
});

/** Danh sách phiên bản với khoảng thời gian và lý do. */
documents.get("/:urn/versions", async (c) => {
  const urn = decodeUrnParam(c.req.param("urn"));
  const doc = await requireDocument(urn);
  const versions = await listVersionRows(doc.id);
  const ops = await sql`
    SELECT effective_from, amending_doc_urn, amending_label, op, target_path
    FROM amendment_ops
    WHERE target_doc_urn = ${urn} AND review_status = 'approved'
    ORDER BY effective_from, ordinal`;
  const reasonByDate = new Map<string, Set<string>>();
  for (const o of ops as unknown as Array<Record<string, unknown>>) {
    const d = asDate(o.effective_from);
    if (!d) continue;
    const set = reasonByDate.get(d) ?? new Set<string>();
    set.add(String(o.amending_doc_urn));
    reasonByDate.set(d, set);
  }
  return c.json({
    urn,
    versions: versions.map((v) => ({
      ...shapeVersion(v),
      causedBy: v.valid_from ? [...(reasonByDate.get(v.valid_from) ?? [])] : [],
    })),
  });
});

/** So sánh nội dung giữa hai thời điểm bằng diffTrees(). */
documents.get("/:urn/diff", async (c) => {
  const urn = decodeUrnParam(c.req.param("urn"));
  const p = parseQuery(c, diffSchema);
  if (p.from > p.to) throw badRequest("Tham số `from` phải nhỏ hơn hoặc bằng `to`");
  const [a, b] = await Promise.all([contentAsOf(urn, p.from), contentAsOf(urn, p.to)]);
  const diffs = diffTrees(a.root, b.root, { includeUnchanged: p.includeUnchanged });
  return c.json({
    urn,
    from: p.from,
    to: p.to,
    fromVersionKind: a.versionKind,
    toVersionKind: b.versionKind,
    summary: {
      added: diffs.filter((d) => d.change === "added").length,
      removed: diffs.filter((d) => d.change === "removed").length,
      modified: diffs.filter((d) => d.change === "modified").length,
      unchanged: diffs.filter((d) => d.change === "unchanged").length,
    },
    diffs,
  });
});

export function shapeDocument(r: Record<string, unknown>, statusAsOf?: string) {
  const sAsOf = statusAsOf ?? (r.status_as_of ? String(r.status_as_of) : undefined);
  return {
    id: r.id,
    urn: r.urn,
    docType: r.doc_type,
    docTypeName: docTypeByCode(String(r.doc_type))?.name ?? r.doc_type,
    rank: r.rank,
    soKyHieu: r.so_ky_hieu,
    title: r.title,
    shortTitle: r.short_title,
    issuer: r.issuer_name ?? null,
    signer: r.signer ?? null,
    documentGroup: r.document_group ?? "chua_phan_loai",
    primarySource: r.primary_source ?? null,
    coTepGoc: Boolean(r.original_file_uri),
    locality: r.locality ?? null,
    issuedDate: asDate(r.issued_date),
    effectiveFrom: asDate(r.effective_from),
    effectiveTo: asDate(r.effective_to),
    gazetteNo: r.gazette_no ?? null,
    gazetteDate: asDate(r.gazette_date),
    fields: r.fields ?? [],
    status: r.status,
    statusLabel: DOC_STATUS_LABELS[String(r.status)] ?? String(r.status),
    statusAsOf: sAsOf ?? null,
    statusAsOfLabel: sAsOf ? (DOC_STATUS_LABELS[sAsOf] ?? sAsOf) : null,
    summary: r.summary ?? null,
  };
}

function shapeVersion(v: {
  id: string;
  version_no: number;
  kind: string;
  valid_from: string | null;
  valid_to: string | null;
  content_hash: string | null;
  quality: Record<string, unknown>;
  reviewed_at: string | null;
}) {
  return {
    id: v.id,
    versionNo: v.version_no,
    kind: v.kind,
    kindLabel: VERSION_KIND_LABELS[v.kind] ?? v.kind,
    validFrom: v.valid_from,
    validTo: v.valid_to,
    contentHash: v.content_hash,
    quality: v.quality,
    reviewedAt: v.reviewed_at,
  };
}
