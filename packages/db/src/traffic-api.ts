import { sql } from "./client.ts";

export interface TrafficQuery {
  q?: string;
  category?: string;
  vehicle?: string;
  legal_document?: string;
  as_of: string;
  page: number;
  page_size: number;
}

function publicRecord(row: Record<string, any>) {
  const {
    note: _note,
    created_by: _created,
    reviewed_by: _reviewer,
    topic_id: _topic,
    search_text: _search,
    ...record
  } = row;
  return record;
}

export async function trafficPenaltyFrames(codes: string[], day: string) {
  if (!codes.length) return [];
  const rows = await sql`SELECT * FROM violation_penalties WHERE violation_code = ANY(${codes}::text[])
  AND status='da_duyet' AND deleted_at IS NULL AND effective_from <= ${day}::date
  AND (effective_to IS NULL OR effective_to > ${day}::date)
  AND ${verifiedCitation(sql`citation_urn`, day)} ORDER BY fine_min,id`;
  return rows.map(publicRecord);
}

/** A citation is publishable only when the exact provision and source version are reviewed. */
export function verifiedCitation(urn: string | ReturnType<typeof sql>, day: string) {
  return sql`EXISTS (SELECT 1 FROM legal_provisions lp
 WHERE lp.urn = ${urn} AND lp.valid_from <= ${day}::date
 AND (lp.valid_to IS NULL OR lp.valid_to > ${day}::date)
 AND lp.reviewed_at IS NOT NULL AND lp.node_status = 'active'
 AND lp.primary_source ~ '^https://')`;
}

export async function searchTraffic(kind: "signs" | "violations", p: TrafficQuery) {
  const signs = kind === "signs";
  const table = signs ? sql`traffic_signs` : sql`violations`;
  const q = p.q?.trim() ?? "";
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const where = sql`status = 'da_duyet' AND deleted_at IS NULL
 AND effective_from <= ${p.as_of}::date AND (effective_to IS NULL OR effective_to > ${p.as_of}::date)
 AND ${verifiedCitation(sql`citation_urn`, p.as_of)}
 ${p.category ? sql`AND group_name = ${p.category}` : sql``}
 ${!signs && p.vehicle ? sql`AND vehicle = ${p.vehicle}` : sql``}
 ${p.legal_document ? sql`AND split_part(citation_urn, '#', 1) = ${p.legal_document}` : sql``}
 ${q ? sql`AND (search_text LIKE lower(unaccent(${pattern})) OR search_text % lower(unaccent(${q})))` : sql``}`;
  return sql.begin(async (tx) => {
    await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
    const [count] = await tx`SELECT count(*)::int AS total FROM ${table} WHERE ${where}`;
    const items = await tx`SELECT * FROM ${table} WHERE ${where}
   ORDER BY ${q ? sql`similarity(search_text, lower(unaccent(${q}))) DESC,` : sql``} code
   LIMIT ${p.page_size} OFFSET ${(p.page - 1) * p.page_size}`;
    return {
      items: items.map(publicRecord),
      total: Number(count!.total),
      page: p.page,
      page_size: p.page_size,
      as_of: p.as_of,
    };
  });
}

export async function trafficDetail(kind: "signs" | "violations", code: string, day: string) {
  const table = kind === "signs" ? sql`traffic_signs` : sql`violations`;
  const [row] = await sql`SELECT * FROM ${table} WHERE code = ${code}
 AND status = 'da_duyet' AND deleted_at IS NULL
 AND effective_from <= ${day}::date AND (effective_to IS NULL OR effective_to > ${day}::date)
 AND ${verifiedCitation(sql`citation_urn`, day)}`;
  if (!row) return undefined;
  const provisions = await sql`SELECT urn, heading, text_md, primary_source, valid_from, valid_to
 FROM legal_provisions WHERE urn = ${row.citation_urn} AND valid_from <= ${day}::date
 AND (valid_to IS NULL OR valid_to > ${day}::date) AND reviewed_at IS NOT NULL AND node_status = 'active'`;
  if (kind === "violations") {
    const penalties = await sql`SELECT * FROM violation_penalties WHERE violation_code = ${code}
   AND status = 'da_duyet' AND deleted_at IS NULL AND effective_from <= ${day}::date
   AND (effective_to IS NULL OR effective_to > ${day}::date)
   AND ${verifiedCitation(sql`citation_urn`, day)} ORDER BY fine_min, id`;
    return {
      ...publicRecord(row),
      provisions,
      penalties: penalties.map(publicRecord),
      data_completeness: penalties.length ? "reviewed_frames_available" : "no_reviewed_penalty_frames",
      required_facts: [...new Set(penalties.flatMap((p) => p.required_facts as string[]))],
      assessment: "requires_case_review",
      message: "Các khung phạt là kết quả tra cứu; cần đối chiếu tình tiết trước khi áp dụng.",
    };
  }
  const related = await sql`SELECT code, name, image_uri FROM traffic_signs
  WHERE group_name = ${row.group_name} AND code <> ${code} AND status = 'da_duyet' AND deleted_at IS NULL
  AND effective_from <= ${day}::date AND (effective_to IS NULL OR effective_to > ${day}::date)
  AND ${verifiedCitation(sql`citation_urn`, day)} ORDER BY ordinal, code LIMIT 6`;
  const violations = await sql`SELECT v.code, v.behavior FROM traffic_sign_violations l
  JOIN violations v ON v.code = l.violation_code WHERE l.sign_code = ${code}
  AND v.status = 'da_duyet' AND v.deleted_at IS NULL AND v.effective_from <= ${day}::date
  AND (v.effective_to IS NULL OR v.effective_to > ${day}::date)
  AND ${verifiedCitation(sql`l.citation_urn`, day)} AND ${verifiedCitation(sql`v.citation_urn`, day)}`;
  return { ...publicRecord(row), provisions, related, violations };
}
