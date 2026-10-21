/**
 * Theo dõi sức khỏe viện dẫn: phát hiện khi nội dung nút được viện dẫn thay đổi.
 *
 * Mỗi viện dẫn (từ use case, bài học, câu trả lời) lưu hash nội dung nút tại thời điểm
 * viện dẫn. Sau mỗi lần hợp nhất, so lại hash để biết căn cứ còn đúng hay không.
 * Xem ke-hoach/08-truong-hop-ung-dung.md §4.
 */
import { parseUrn } from "@qdpl/legal-model";
import { sql } from "./client.ts";

export type CitationHealth = "ok" | "changed" | "repealed" | "missing";

export interface CitationRow {
  id: string;
  owner_kind: string;
  owner_id: string;
  node_urn: string;
  as_of: string;
  content_hash: string | null;
  health: CitationHealth;
}

/** Hash nội dung nút để phát hiện thay đổi câu chữ. Chuẩn hóa khoảng trắng trước khi hash. */
export function hashNodeContent(heading: string | null, text: string): string {
  const norm = `${heading ?? ""}\n${text}`.replace(/\s+/g, " ").trim();
  return Bun.hash(norm).toString(16);
}

/** Tra nội dung nút tại một thời điểm. Trả undefined nếu không tìm thấy. */
export async function lookupNode(nodeUrn: string, asOf: string) {
  const p = parseUrn(nodeUrn);
  if (!p?.path) return undefined;
  const docUrn = nodeUrn.split("#")[0]!;
  const rows = await sql`
    SELECT n.heading, n.text_md, n.node_status, n.label, d.status AS doc_status, d.short_title
    FROM documents d
    JOIN document_versions v ON v.document_id = d.id
      AND v.valid_from <= ${asOf} AND (v.valid_to IS NULL OR v.valid_to > ${asOf})
    JOIN nodes n ON n.version_id = v.id AND n.path = ${p.path}
    WHERE d.urn = ${docUrn}
    ORDER BY v.valid_from DESC
    LIMIT 1`;
  return rows[0] as
    | {
        heading: string | null;
        text_md: string;
        node_status: string;
        label: string;
        doc_status: string;
        short_title: string;
      }
    | undefined;
}

/** Ghi nhận một viện dẫn mới, kèm hash nội dung tại thời điểm viện dẫn. */
export async function recordCitation(opts: {
  ownerKind: "use_case" | "lesson" | "answer";
  ownerId: string;
  nodeUrn: string;
  asOf: string;
}): Promise<CitationHealth> {
  const node = await lookupNode(opts.nodeUrn, opts.asOf);
  const health: CitationHealth = !node ? "missing" : node.node_status === "repealed" ? "repealed" : "ok";
  const hash = node ? hashNodeContent(node.heading, node.text_md) : null;
  await sql`
    INSERT INTO citations (owner_kind, owner_id, node_urn, as_of, content_hash, health, checked_at)
    VALUES (${opts.ownerKind}, ${opts.ownerId}, ${opts.nodeUrn}, ${opts.asOf}, ${hash}, ${health}, now())`;
  return health;
}

export interface HealthReport {
  total: number;
  ok: number;
  changed: number;
  repealed: number;
  missing: number;
  /** Chi tiết những viện dẫn không còn "ok", để đưa vào hàng đợi biên tập. */
  issues: Array<{
    citationId: string;
    ownerKind: string;
    ownerId: string;
    nodeUrn: string;
    health: CitationHealth;
    detail: string;
  }>;
}

/**
 * Rà soát toàn bộ viện dẫn tại một thời điểm (mặc định hôm nay) và cập nhật trạng thái.
 * `enqueueReview = true` thì tạo việc trong review_queue cho những viện dẫn có vấn đề.
 */
export async function checkCitations(
  opts: { asOf?: string; enqueueReview?: boolean } = {},
): Promise<HealthReport> {
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const rows = (await sql`SELECT * FROM citations`) as unknown as CitationRow[];

  const report: HealthReport = { total: rows.length, ok: 0, changed: 0, repealed: 0, missing: 0, issues: [] };

  for (const c of rows) {
    // Viện dẫn được kiểm tra ở thời điểm HIỆN TẠI, không phải thời điểm viện dẫn ban đầu:
    // mục đích là phát hiện căn cứ đã đổi so với lúc biên tập.
    const node = await lookupNode(c.node_urn, asOf);
    let health: CitationHealth;
    let detail: string;

    if (!node) {
      health = "missing";
      detail = "Không tìm thấy nút tại thời điểm kiểm tra (văn bản bị bãi bỏ toàn bộ hoặc nút bị xóa)";
    } else if (node.node_status === "repealed") {
      health = "repealed";
      detail = `${node.label} của ${node.short_title} đã bị bãi bỏ`;
    } else if (node.node_status === "suspended") {
      health = "changed";
      detail = `${node.label} của ${node.short_title} đang bị ngưng hiệu lực`;
    } else {
      const now = hashNodeContent(node.heading, node.text_md);
      if (c.content_hash && now !== c.content_hash) {
        health = "changed";
        detail = `Nội dung ${node.label} của ${node.short_title} đã thay đổi so với thời điểm viện dẫn (${c.as_of})`;
      } else {
        health = "ok";
        detail = "";
      }
    }

    report[health] += 1;
    if (health !== "ok") {
      report.issues.push({
        citationId: c.id,
        ownerKind: c.owner_kind,
        ownerId: c.owner_id,
        nodeUrn: c.node_urn,
        health,
        detail,
      });
    }

    if (health !== c.health) {
      await sql`UPDATE citations SET health = ${health}, checked_at = now() WHERE id = ${c.id}`;
    }
  }

  // Lan trạng thái xấu nhất lên chủ sở hữu (use case / bài học).
  await sql`
    UPDATE use_cases u SET citation_health = COALESCE((
      SELECT CASE
        WHEN bool_or(c.health = 'repealed') THEN 'repealed'
        WHEN bool_or(c.health = 'missing')  THEN 'missing'
        WHEN bool_or(c.health = 'changed')  THEN 'changed'
        ELSE 'ok' END
      FROM citations c WHERE c.owner_kind = 'use_case' AND c.owner_id = u.id
    ), 'ok')`;
  await sql`
    UPDATE lessons l SET citation_health = COALESCE((
      SELECT CASE
        WHEN bool_or(c.health = 'repealed') THEN 'repealed'
        WHEN bool_or(c.health = 'missing')  THEN 'missing'
        WHEN bool_or(c.health = 'changed')  THEN 'changed'
        ELSE 'ok' END
      FROM citations c WHERE c.owner_kind = 'lesson' AND c.owner_id = l.id
    ), 'ok')`;

  if (opts.enqueueReview) {
    for (const i of report.issues) {
      // Không tạo trùng việc còn đang mở cho cùng một viện dẫn.
      const [existing] = await sql`
        SELECT id FROM review_queue
        WHERE kind = 'citation' AND ref_id = ${i.citationId} AND state = 'open' LIMIT 1`;
      if (existing) continue;
      await sql`
        INSERT INTO review_queue (kind, ref_id, document_urn, priority, payload)
        VALUES ('citation', ${i.citationId}, ${i.nodeUrn.split("#")[0]!},
                ${i.health === "repealed" ? 10 : 5},
                ${sql.json(i as any)})`;
    }
  }

  return report;
}
