/** Endpoint tìm kiếm lai — gọi thẳng packages/search. */

import { docTypeByCode } from "@qdpl/legal-model";
import { search } from "@qdpl/search";
import { Hono } from "hono";
import { z } from "zod";
import { csv, parseQuery, today } from "../http.ts";
import { DOC_STATUS_LABELS, NODE_STATUS_LABELS, VERSION_KIND_LABELS } from "../labels.ts";

const schema = z.object({
  q: z.string().min(1, "Thiếu tham số `q`").max(500, "Truy vấn quá dài (tối đa 500 ký tự)"),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD")
    .optional(),
  docType: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  field: z.union([z.string(), z.array(z.string())]).optional(),
  kind: z.union([z.string(), z.array(z.string())]).optional(),
  issuer: z.string().trim().optional(),
  locality: z.string().trim().optional(),
  rankMax: z.coerce.number().int().min(1).max(999).optional(),
  includeRepealed: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  highlight: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export const searchRoute = new Hono();

searchRoute.get("/", async (c) => {
  const p = parseQuery(c, schema);
  const asOf = p.asOf ?? today();
  const res = await search({
    q: p.q,
    asOf,
    docTypes: csv(p.docType),
    status: csv(p.status),
    fields: csv(p.field),
    kinds: csv(p.kind),
    issuer: p.issuer,
    locality: p.locality,
    rankMax: p.rankMax,
    includeRepealed: p.includeRepealed,
    limit: p.limit,
    offset: (p.page - 1) * p.limit,
    highlight: p.highlight,
    dropLooseMatches: true,
  });

  return c.json({
    q: res.q,
    asOf: res.asOf,
    total: res.total,
    page: p.page,
    limit: p.limit,
    pages: Math.max(1, Math.ceil(res.total / p.limit)),
    citations: res.citations,
    timings: res.timings,
    warnings: res.warnings,
    hits: res.hits.map(shapeHit),
  });
});

/** Chuẩn hóa một kết quả tìm kiếm cho client (thêm nhãn tiếng Việt). */
export function shapeHit(h: {
  urn: string;
  docUrn: string;
  docType: string;
  rank: number;
  soKyHieu: string;
  shortTitle: string;
  title: string;
  issuer: string | null;
  fields: string[];
  docStatus: string;
  docStatusAsOf: string;
  issuedDate: string | null;
  path: string;
  kind: string;
  label: string;
  heading: string | null;
  contextPath: string | null;
  nodeStatus: string;
  versionKind: string;
  validFrom: string | null;
  validTo: string | null;
  text: string;
  snippet: string;
  score: number;
  matchedBy: string[];
  ranks: Record<string, number | undefined>;
}) {
  return {
    urn: h.urn,
    docUrn: h.docUrn,
    docType: h.docType,
    docTypeName: docTypeByCode(h.docType)?.name ?? h.docType,
    rank: h.rank,
    soKyHieu: h.soKyHieu,
    shortTitle: h.shortTitle,
    title: h.title,
    issuer: h.issuer,
    fields: h.fields,
    docStatus: h.docStatus,
    docStatusLabel: DOC_STATUS_LABELS[h.docStatus] ?? h.docStatus,
    // Trạng thái tại asOf (từ document_versions.status) — trường nên dùng để hiển thị.
    docStatusAsOf: h.docStatusAsOf,
    docStatusAsOfLabel: DOC_STATUS_LABELS[h.docStatusAsOf] ?? h.docStatusAsOf,
    issuedDate: h.issuedDate,
    path: h.path,
    kind: h.kind,
    label: h.label,
    heading: h.heading,
    contextPath: h.contextPath,
    nodeStatus: h.nodeStatus,
    nodeStatusLabel: NODE_STATUS_LABELS[h.nodeStatus] ?? h.nodeStatus,
    versionKind: h.versionKind,
    versionKindLabel: VERSION_KIND_LABELS[h.versionKind] ?? h.versionKind,
    validFrom: h.validFrom,
    validTo: h.validTo,
    text: h.text,
    snippet: h.snippet,
    score: Number(h.score.toFixed(6)),
    matchedBy: h.matchedBy,
    ranks: h.ranks,
  };
}
