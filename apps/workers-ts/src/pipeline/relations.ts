/**
 * Trích quan hệ từ nội dung văn bản (ke-hoach/03 §2.6):
 *  - `can_cu`    : từ nút "Căn cứ ban hành";
 *  - `huong_dan` : từ tiêu đề ("quy định chi tiết ... Luật X");
 *  - `dan_chieu` : từ viện dẫn trong thân văn bản (cấp nút, dùng @qdpl/citation);
 *  - `cha_con`   : suy ra từ can_cu/huong_dan tới văn bản có thứ bậc cao hơn.
 */

import { type CitationRef, findCitations, toUrn } from "@qdpl/citation";
import { addReview, getDocumentByUrn, saveRelations, sql } from "@qdpl/db";
import { buildUrn, docUrnOf, inferDocType, type LegalNode, rankOf, walk } from "@qdpl/legal-model";
import { log } from "../log.ts";
import { getDocumentById, treeOf } from "./parse.ts";

export interface RelationDraft {
  fromUrn: string;
  toUrn: string;
  type: string;
  effectiveFrom?: string | null;
  source: string;
  confidence: number;
  evidence: unknown;
}

/** Viện dẫn -> URN văn bản (bỏ path) khi có số ký hiệu. */
function docUrnOfRef(ref: CitationRef): string | undefined {
  if (!ref.soKyHieu) return undefined;
  const docType = ref.docType ?? inferDocType(ref.soKyHieu);
  if (!docType) return undefined;
  return buildUrn({ docType, soKyHieu: ref.soKyHieu });
}

/**
 * Viện dẫn chỉ có TÊN văn bản ("Căn cứ Luật Tổ chức Chính phủ ngày 18/02/2025")
 * -> tra trong `documents` theo tên. Không tìm thấy thì trả undefined để đẩy
 * chuỗi vào hàng đợi biên tập thay vì đoán bừa.
 */
async function resolveByName(docName: string): Promise<string | undefined> {
  const name = docName.replace(/\s+này$/i, "").trim();
  if (name.length < 8) return undefined;
  const rows = await sql`
    SELECT urn FROM documents
    WHERE unaccent(lower(title)) LIKE unaccent(lower(${`%${name}%`}))
       OR unaccent(lower(short_title)) LIKE unaccent(lower(${`%${name}%`}))
    ORDER BY length(title) ASC
    LIMIT 2`;
  return rows.length === 1 ? ((rows[0] as any).urn as string) : undefined;
}

export interface ExtractRelationsOptions {
  /** Ghi cả viện dẫn nội bộ ("khoản 2 Điều 15 của Nghị định này"). */
  includeInternal?: boolean;
  /** Giới hạn số quan hệ dẫn chiếu để tránh bùng nổ với văn bản rất dài. */
  maxDanChieu?: number;
  persist?: boolean;
}

export interface RelationsSummary {
  urn: string;
  documentId: string;
  canCu: number;
  huongDan: number;
  danChieu: number;
  chaCon: number;
  saved: number;
  relations: RelationDraft[];
}

const HUONG_DAN_RE =
  /(quy định chi tiết|hướng dẫn thi hành|hướng dẫn|biện pháp thi hành|thi hành một số điều)/i;

export async function extractRelationsForDocument(
  documentId: string,
  opts: ExtractRelationsOptions = {},
): Promise<RelationsSummary> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new Error(`Không có document ${documentId}`);
  const [version] = await sql`
    SELECT * FROM document_versions WHERE document_id = ${documentId}
    ORDER BY version_no ASC LIMIT 1`;
  if (!version) throw new Error(`Văn bản ${doc.urn} chưa có phiên bản nào`);
  const root: LegalNode = treeOf(version);
  const effectiveFrom = doc.effective_from ?? doc.issued_date ?? null;

  const rels: RelationDraft[] = [];
  const seen = new Set<string>();
  const push = (r: RelationDraft) => {
    const key = `${r.fromUrn}|${r.toUrn}|${r.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    rels.push(r);
  };

  const counts = { canCu: 0, huongDan: 0, danChieu: 0, chaCon: 0 };
  /** URN văn bản mà văn bản này căn cứ / quy định chi tiết. */
  const upstream = new Set<string>();

  /* 1. Căn cứ ban hành ------------------------------------------------ */
  let canCuNode: LegalNode | undefined;
  walk(root, (n) => {
    if (n.kind === "can_cu") canCuNode = n;
  });
  const unresolved: { text: string; raw: string }[] = [];
  if (canCuNode?.text) {
    for (const line of canCuNode.text.split("\n")) {
      if (!/^Căn cứ/i.test(line.trim())) continue;
      const refs = findCitations(line);
      if (!refs.length || !refs.some((r) => r.soKyHieu || r.docName)) {
        unresolved.push({ text: line.trim().slice(0, 300), raw: line.trim().slice(0, 120) });
      }
      for (const ref of refs) {
        const target = docUrnOfRef(ref) ?? (ref.docName ? await resolveByName(ref.docName) : undefined);
        if (!target) {
          if (ref.docName) unresolved.push({ text: line.trim().slice(0, 300), raw: ref.docName });
          continue;
        }
        if (target === doc.urn) continue;
        upstream.add(target);
        counts.canCu += 1;
        push({
          fromUrn: doc.urn,
          toUrn: target,
          type: "can_cu",
          effectiveFrom,
          source: "parsed",
          confidence: ref.confidence,
          evidence: { node: "can-cu", text: line.trim().slice(0, 300) },
        });
      }
    }
  }

  /* 2. Hướng dẫn / quy định chi tiết (từ tiêu đề) ---------------------- */
  if (HUONG_DAN_RE.test(doc.title)) {
    for (const ref of findCitations(doc.title)) {
      const target = docUrnOfRef(ref);
      if (!target || target === doc.urn) continue;
      upstream.add(target);
      counts.huongDan += 1;
      push({
        fromUrn: doc.urn,
        toUrn: target,
        type: "huong_dan",
        effectiveFrom,
        source: "parsed",
        confidence: Math.min(0.9, ref.confidence),
        evidence: { from: "title", text: doc.title.slice(0, 300) },
      });
    }
  }

  /* 3. Dẫn chiếu trong thân văn bản (cấp nút) -------------------------- */
  const maxDanChieu = opts.maxDanChieu ?? 5000;
  const includeInternal = opts.includeInternal ?? true;
  walk(root, (n) => {
    if (counts.danChieu >= maxDanChieu) return;
    if (!n.path || !n.text) return;
    if (!["dieu", "khoan", "diem", "doan"].includes(n.kind)) return;
    for (const ref of findCitations(n.text)) {
      if (!ref.path && !ref.soKyHieu) continue;
      if (ref.selfRef && !includeInternal) continue;
      const target = toUrn(ref, doc.urn);
      if (!target) continue;
      if (docUrnOf(target) === doc.urn && !ref.path) continue;
      counts.danChieu += 1;
      push({
        fromUrn: `${doc.urn}#${n.path}`,
        toUrn: target,
        type: "dan_chieu",
        effectiveFrom,
        source: "parsed",
        confidence: ref.confidence,
        evidence: { node: n.path, raw: ref.raw },
      });
      if (counts.danChieu >= maxDanChieu) return;
    }
  });

  /* 4. Cha - con ------------------------------------------------------- */
  for (const parentUrn of upstream) {
    const parentType = parentUrn.split(":")[2] ?? "";
    if (rankOf(parentType) >= doc.rank) continue; // cha phải có thứ bậc cao hơn
    counts.chaCon += 1;
    push({
      fromUrn: parentUrn,
      toUrn: doc.urn,
      type: "cha_con",
      effectiveFrom,
      source: "parsed",
      confidence: 0.8,
      evidence: { derivedFrom: ["can_cu", "huong_dan"] },
    });
  }

  let saved = 0;
  if (opts.persist !== false && rels.length) {
    saved = await saveRelations(rels as any);
  }
  // Chuỗi viện dẫn không phân giải được -> hàng đợi biên tập (ke-hoach/06 §1.3).
  if (opts.persist !== false) {
    for (const u of unresolved.slice(0, 20)) {
      await addReview({
        kind: "citation",
        refId: `${doc.urn}#can-cu`,
        documentUrn: doc.urn,
        priority: 1,
        payload: { step: "relations", unresolved: u },
      });
    }
  }

  log.info("Đã trích quan hệ", { urn: doc.urn, ...counts, saved });
  return { urn: doc.urn, documentId, ...counts, saved, relations: rels };
}

/** Bổ sung quan hệ khi văn bản đích được nạp sau (dùng cho job quét lại). */
export async function backfillMissingTargets(): Promise<number> {
  const rows = await sql`
    SELECT DISTINCT split_part(to_urn, '#', 1) AS urn FROM relations
    WHERE split_part(to_urn, '#', 1) NOT IN (SELECT urn FROM documents)`;
  let n = 0;
  for (const r of rows as any[]) {
    if (await getDocumentByUrn(r.urn)) n += 1;
  }
  return n;
}
