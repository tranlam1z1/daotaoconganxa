/**
 * Tìm kiếm lai (hybrid) trên Postgres cho quydinhphapluat.vn.
 *
 * Ba tầng truy xuất chạy song song rồi hợp nhất bằng Reciprocal Rank Fusion (k = 60):
 *   1. BM25/full-text  : cột `nodes.tsv` (cấu hình `vietnamese` = simple + unaccent),
 *                        `websearch_to_tsquery` + `ts_rank_cd`; thêm nhánh trigram
 *                        (pg_trgm) cho truy vấn ngắn hoặc gõ sai.
 *   2. Vector          : bảng `embeddings` (pgvector), toán tử cosine `<=>`.
 *   3. Viện dẫn        : `findCitations()` trên câu truy vấn; nút được viện dẫn
 *                        trực tiếp luôn đứng đầu (điểm tuyệt đối).
 *
 * Xem ke-hoach/07-tim-kiem-rag.md §4.
 */

import { findCitations, toUrn } from "@qdpl/citation";
import { khopNut, khopTuTruyVan, sql } from "@qdpl/db";
import { docUrnOf, parseUrn } from "@qdpl/legal-model";
import { buildChunks, type ChunkNodeRow } from "./chunk.ts";
import { EMBEDDING_DIM, embed, embeddingModel, embedOne, toVectorLiteral } from "./embedding.ts";
import type {
  IndexResult,
  MatchLane,
  RetrieveOptions,
  RetrieveResult,
  SearchFilters,
  SearchHit,
  SearchOptions,
  SearchResult,
} from "./types.ts";

export * from "./chunk.ts";
export * from "./embedding.ts";
export * from "./types.ts";

/** Hằng số RRF theo ke-hoach/07 §4. */
export const RRF_K = 60;
/** Số ứng viên lấy ra ở mỗi tầng trước khi hợp nhất. */
const LANE_LIMIT = 100;
/**
 * Trần boost sau RRF. Vì boost là hệ số nhân trong [1, 1+BOOST_MAX], một kết quả
 * chỉ có thể vượt kết quả khác khi điểm RRF thô của chúng chênh nhau dưới BOOST_MAX.
 * Đây chính là ràng buộc "chỉ boost khi điểm gần nhau" của ke-hoach/07 §4.3.
 */
const BOOST_MAX = 0.15;
/** Điểm cộng tuyệt đối cho nút khớp viện dẫn — luôn lớn hơn mọi điểm RRF + boost. */
const CITATION_PIN = 1000;
/**
 * Bậc khớp cộng thẳng vào điểm, xếp trên RRF + boost (luôn dưới 1) và dưới CITATION_PIN: nút của văn
 * bản mang đúng số ký hiệu được gõ (3) > nút chứa nguyên cụm từ (2) > nút có đủ mọi từ (1) > nút chỉ
 * khớp vài từ lẻ, mảnh chữ hoặc gần nghĩa (0). "Đủ mọi từ" tính cả chữ của điều, khoản chứa nút.
 * Trong cùng một bậc, nút giữ được cụm liền nhau dài hơn của truy vấn xếp trước, rồi mới tới RRF + boost.
 */
const BAC_SO_KY_HIEU = 3;
/** Trọng số phần cụm liền nhau (trong [0, 1]): cộng với RRF + boost (dưới 0.06) vẫn không vượt sang bậc trên. */
const HE_SO_LIEN = 0.9;
/** Nút chưa đủ từ vẫn được coi là liên quan khi giữ liền nhau ít nhất chừng này phần truy vấn. */
const LIEN_TOI_THIEU = 0.5;

const khongDau = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** Truy vấn có nhắc đúng số ký hiệu này không; "136/2024/QH15" không tính là nhắc "36/2024/QH15". */
export function coSoKyHieu(q: string, soKyHieu: string): boolean {
  const cau = khongDau(q);
  const i = cau.indexOf(khongDau(soKyHieu.trim()));
  return i >= 0 && !/[0-9]/.test(cau[i - 1] ?? "");
}
/**
 * Ngưỡng cosine tối thiểu của tầng vector. ĐỪNG HẠ NGƯỠNG NÀY nếu chưa đo lại.
 *
 * Lý do: toán tử `<=>` của pgvector chỉ SẮP XẾP chứ không LỌC, nên nếu không có
 * ngưỡng thì mọi truy vấn — kể cả hoàn toàn lạc đề — đều nhận đủ LIMIT nút "gần
 * nhất". Hậu quả trực tiếp: `/v1/ask` luôn có ngữ cảnh để đưa vào prompt và luôn
 * tưởng là có căn cứ, phá vỡ bất biến `insufficientBasis` của ke-hoach/07 §5.4.c.
 *
 * Số đo trên dữ liệu mẫu (embedding local-hash-1024, 2 văn bản, 37 chunk):
 *   - "Thời hạn thẩm định kế hoạch thử nghiệm…" (đúng chủ đề) -> 0.40 / 0.37 / 0.35
 *   - "kế hoạch thử nghiệm gồm nội dung nào"    (đúng chủ đề) -> 0.45 / 0.38 / 0.36
 *   - "Quy định về xuất khẩu cá tra sang Hoa Kỳ" (lạc đề)     -> 0.18 / 0.13 / 0.13
 * Khoảng trống 0.18–0.35 cho phép đặt ngưỡng 0.30 an toàn ở cả hai phía.
 *
 * Khi đổi sang embedding thật (bge-m3 qua TEI) PHẢI đo lại và chỉnh ngưỡng: phân bố
 * cosine của mô hình dense thật thường dịch lên cao hơn (~0.5–0.7 cho cặp liên quan).
 */
const VECTOR_MIN_SIM = Number(process.env.SEARCH_VECTOR_MIN_SIM ?? 0.3);
/** Ngưỡng tương tự trigram; dưới mức này coi như không khớp. */
const TRIGRAM_MIN_SIM = Number(process.env.SEARCH_TRIGRAM_MIN_SIM ?? 0.34);

/**
 * Quan hệ dùng để mở rộng ngữ cảnh: văn bản hướng dẫn chi tiết và văn bản sửa đổi,
 * lấy cả chiều thuận lẫn chiều nghịch (ke-hoach/03 §2.6).
 */
const EXPAND_RELATIONS = ["huong_dan", "duoc_huong_dan_boi", "sua_doi", "bi_sua_doi_boi"];

/** Loại nút mặc định được tìm kiếm (bỏ chương/mục/căn cứ/chữ ký vì không mang quy phạm). */
export const DEFAULT_KINDS = ["dieu", "khoan", "diem", "bang", "cong_thuc", "hinh", "phu_luc"];

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface NormFilters {
  asOf: string;
  docTypes: string[] | null;
  rankMax: number | null;
  status: string[] | null;
  fields: string[] | null;
  issuer: string | null;
  locality: string | null;
  includeRepealed: boolean;
  kinds: string[] | null;
}

function normalize(f: SearchFilters): NormFilters {
  const arr = (v: string[] | undefined): string[] | null => (v?.length ? v : null);
  return {
    asOf: f.asOf && /^\d{4}-\d{2}-\d{2}$/.test(f.asOf) ? f.asOf : today(),
    docTypes: arr(f.docTypes),
    rankMax: typeof f.rankMax === "number" && Number.isFinite(f.rankMax) ? f.rankMax : null,
    status: arr(f.status),
    fields: arr(f.fields),
    issuer: f.issuer?.trim() ? f.issuer.trim() : null,
    locality: f.locality?.trim() ? f.locality.trim() : null,
    includeRepealed: Boolean(f.includeRepealed),
    kinds: arr(f.kinds) ?? DEFAULT_KINDS,
  };
}

/**
 * Trạng thái hiệu lực của văn bản TẠI THỜI ĐIỂM asOf.
 *
 * `documents.status` chỉ là ảnh chụp trạng thái mới nhất nên không dùng để lọc theo
 * thời điểm được: Nghị định 100/2026 hôm nay là `het_hieu_luc_mot_phan` nhưng tại
 * 2026-06-01 nó `con_hieu_luc` nguyên vẹn. Vì vậy lấy `document_versions.status` của
 * phiên bản có hiệu lực tại asOf (migration 0002), rồi phủ lên hai trường hợp mà
 * mốc hiệu lực của cả văn bản quyết định. Logic phải khớp `getStatusAsOf()` của @qdpl/db.
 * Bí danh bắt buộc: v (document_versions), d (documents).
 */
function statusAsOfExpr(asOf: string) {
  return sql`
    CASE
      WHEN d.effective_to IS NOT NULL AND d.effective_to <= ${asOf}::date THEN 'het_hieu_luc'
      WHEN d.effective_from IS NOT NULL AND d.effective_from > ${asOf}::date THEN 'chua_hieu_luc'
      ELSE v.status
    END`;
}

/**
 * Điều kiện lọc dùng chung cho mọi tầng: bí danh bắt buộc là n (nodes),
 * v (document_versions), d (documents).
 */
function scopeWhere(f: NormFilters) {
  return sql`
        v.valid_from <= ${f.asOf}::date
    AND (v.valid_to IS NULL OR v.valid_to > ${f.asOf}::date)
    AND (d.effective_from IS NULL OR d.effective_from <= ${f.asOf}::date)
    AND (${f.includeRepealed}::boolean
         OR (n.node_status <> 'repealed'
             AND (d.effective_to IS NULL OR d.effective_to > ${f.asOf}::date)))
    AND (${f.docTypes}::text[] IS NULL OR d.doc_type = ANY(${f.docTypes}::text[]))
    AND (${f.rankMax}::int IS NULL OR d.rank <= ${f.rankMax}::int)
    AND (${f.status}::text[] IS NULL OR ${statusAsOfExpr(f.asOf)} = ANY(${f.status}::text[]))
    AND (${f.fields}::text[] IS NULL OR d.fields && ${f.fields}::text[])
    AND (${f.issuer}::text IS NULL
         OR d.issuer_name ILIKE '%' || ${f.issuer}::text || '%'
         OR d.issuer_code = ${f.issuer}::text)
    AND (${f.locality}::text IS NULL OR d.locality = ${f.locality}::text)
    AND (${f.kinds}::text[] IS NULL OR n.kind = ANY(${f.kinds}::text[]))
  `;
}

interface LaneRow {
  id: string;
  score: number;
}

/** Tầng 1a — BM25 trên tsvector tiếng Việt. */
async function laneBm25(q: string, f: NormFilters, limit = LANE_LIMIT): Promise<LaneRow[]> {
  const rows = await sql<LaneRow[]>`
    SELECT n.id, ts_rank_cd(n.tsv, tsq)::float8 AS score
    FROM nodes n
    JOIN document_versions v ON v.id = n.version_id
    JOIN documents d ON d.id = n.document_id
    CROSS JOIN websearch_to_tsquery('vietnamese', ${q}) AS tsq
    WHERE n.tsv IS NOT NULL AND n.tsv @@ tsq AND ${scopeWhere(f)}
    -- Nút chứa nguyên cụm lấy trước, để không bị cắt khỏi nhóm ứng viên khi có quá nhiều nút khớp.
    ORDER BY (n.tsv @@ phraseto_tsquery('vietnamese', ${q})) DESC, score DESC, n.ordinal ASC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
}

/**
 * Tầng 1b — trigram (pg_trgm) cho truy vấn ngắn hoặc gõ sai dấu/chính tả.
 * So khớp cả nội dung nút lẫn số ký hiệu văn bản, đều bỏ dấu trước khi so.
 */
async function laneTrigram(q: string, f: NormFilters, limit = LANE_LIMIT): Promise<LaneRow[]> {
  const rows = await sql<LaneRow[]>`
    SELECT n.id,
           GREATEST(
             word_similarity(unaccent(${q}), unaccent(coalesce(n.heading, '') || ' ' || n.text_plain)),
             similarity(unaccent(d.so_ky_hieu), unaccent(${q})),
             word_similarity(unaccent(${q}), unaccent(d.short_title))
           )::float8 AS score
    FROM nodes n
    JOIN document_versions v ON v.id = n.version_id
    JOIN documents d ON d.id = n.document_id
    WHERE ${scopeWhere(f)}
      AND GREATEST(
            word_similarity(unaccent(${q}), unaccent(coalesce(n.heading, '') || ' ' || n.text_plain)),
            similarity(unaccent(d.so_ky_hieu), unaccent(${q})),
            word_similarity(unaccent(${q}), unaccent(d.short_title))
          ) >= ${TRIGRAM_MIN_SIM}
    ORDER BY score DESC, n.ordinal ASC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
}

/** Tầng 2 — vector cosine trên pgvector. */
async function laneVector(q: string, f: NormFilters, limit = LANE_LIMIT): Promise<LaneRow[]> {
  const vec = toVectorLiteral(await embedOne(q));
  const rows = await sql<LaneRow[]>`
    SELECT n.id, MAX(1 - (e.embedding <=> ${vec}::vector))::float8 AS score
    FROM embeddings e
    JOIN nodes n ON n.id = e.node_id
    JOIN document_versions v ON v.id = n.version_id
    JOIN documents d ON d.id = n.document_id
    WHERE e.embedding IS NOT NULL AND e.model = ${embeddingModel()} AND ${scopeWhere(f)}
    GROUP BY n.id
    HAVING MAX(1 - (e.embedding <=> ${vec}::vector)) >= ${VECTOR_MIN_SIM}
    ORDER BY score DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
}

export interface CitationMatch {
  raw: string;
  urn: string;
  found: boolean;
  nodeIds: string[];
}

/** Tầng 3 — nhận diện viện dẫn trong câu truy vấn rồi tra thẳng nút tương ứng. */
async function laneCitation(q: string, f: NormFilters): Promise<CitationMatch[]> {
  const refs = findCitations(q).filter((r) => r.soKyHieu && !r.selfRef);
  const out: CitationMatch[] = [];
  for (const ref of refs) {
    const urn = toUrn(ref);
    if (!urn) continue;
    const docUrn = docUrnOf(urn);
    const path = parseUrn(urn)?.path ?? null;
    const rows = await sql<Array<{ id: string }>>`
      SELECT n.id
      FROM nodes n
      JOIN document_versions v ON v.id = n.version_id
      JOIN documents d ON d.id = n.document_id
      WHERE d.urn = ${docUrn}
        AND (${path}::text IS NULL
             OR n.path = ${path}::text
             OR n.path LIKE ${path}::text || '.%')
        AND ${scopeWhere(f)}
      ORDER BY length(n.path) ASC, n.ordinal ASC
      LIMIT 8`;
    out.push({ raw: ref.raw, urn, found: rows.length > 0, nodeIds: rows.map((r) => r.id) });
  }
  return out;
}

interface Fused {
  id: string;
  rrf: number;
  pinned: boolean;
  matchedBy: MatchLane[];
  ranks: Partial<Record<MatchLane, number>>;
}

/** Hợp nhất nhiều danh sách xếp hạng bằng Reciprocal Rank Fusion: score = Σ 1/(k + rank). */
export function fuse(lanes: Array<{ lane: MatchLane; rows: LaneRow[] }>, k = RRF_K): Map<string, Fused> {
  const acc = new Map<string, Fused>();
  for (const { lane, rows } of lanes) {
    rows.forEach((row, i) => {
      const rank = i + 1;
      const cur = acc.get(row.id) ?? { id: row.id, rrf: 0, pinned: false, matchedBy: [], ranks: {} };
      cur.rrf += 1 / (k + rank);
      if (!cur.matchedBy.includes(lane)) cur.matchedBy.push(lane);
      const prev = cur.ranks[lane];
      if (prev === undefined || rank < prev) cur.ranks[lane] = rank;
      acc.set(row.id, cur);
    });
  }
  return acc;
}

interface HydratedRow {
  id: string;
  version_id: string;
  document_id: string;
  path: string;
  full_path: string;
  kind: string;
  label: string;
  heading: string | null;
  text_md: string;
  text_plain: string;
  context_path: string | null;
  node_status: string;
  doc_urn: string;
  doc_type: string;
  rank: number;
  so_ky_hieu: string;
  short_title: string;
  title: string;
  issuer_name: string | null;
  locality: string | null;
  fields: string[];
  doc_status: string;
  doc_status_as_of: string;
  issued_date: Date | string | null;
  version_kind: string;
  valid_from: Date | string | null;
  valid_to: Date | string | null;
  snippet: string | null;
  /** Chữ của điều, khoản chứa nút (tiêu đề + nội dung riêng), dùng để tính bậc khớp. */
  ngu_canh: string[];
}

const asDate = (v: Date | string | null): string | null => {
  if (!v) return null;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
};

/** Lấy đầy đủ thông tin nút + đoạn trích có đánh dấu cho danh sách id. */
async function hydrate(ids: string[], q: string, asOf: string): Promise<Map<string, HydratedRow>> {
  if (ids.length === 0) return new Map();
  const rows = await sql<HydratedRow[]>`
    SELECT n.id, n.version_id, n.document_id, n.path, n.full_path, n.kind, n.label, n.heading,
           n.text_md, n.text_plain, n.context_path, n.node_status,
           d.urn AS doc_urn, d.doc_type, d.rank, d.so_ky_hieu, d.short_title, d.title,
           d.issuer_name, d.locality, d.fields, d.status AS doc_status, d.issued_date,
           v.kind AS version_kind, v.valid_from, v.valid_to,
           ${statusAsOfExpr(asOf)} AS doc_status_as_of,
           CASE WHEN numnode(tsq) > 0
                THEN ts_headline('vietnamese',
                       coalesce(n.heading || '. ', '') || n.text_plain, tsq,
                       'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, FragmentDelimiter= … , MaxWords=40, MinWords=12')
                ELSE NULL END AS snippet,
           ARRAY(SELECT coalesce(a.heading || '. ', '') || a.text_plain
                 FROM nodes a
                 WHERE a.document_id = n.document_id AND a.version_id = n.version_id AND a.id <> n.id
                   AND a.path IN (split_part(n.path, '.', 1),
                                  split_part(n.path, '.', 1) || '.' || split_part(n.path, '.', 2))) AS ngu_canh
    FROM nodes n
    JOIN document_versions v ON v.id = n.version_id
    JOIN documents d ON d.id = n.document_id
    -- Đoạn trích khớp từng từ (OR): nút thiếu một từ vẫn có đoạn trích quanh các từ còn lại.
    CROSS JOIN (SELECT replace(websearch_to_tsquery('vietnamese', ${q})::text, '&', '|')::tsquery AS tsq) t
    WHERE n.id = ANY(${ids}::uuid[])`;
  return new Map(rows.map((r) => [r.id, r]));
}

/** Cắt đoạn quanh vị trí khớp khi ts_headline không dùng được (truy vấn rỗng/toàn stopword). */
function fallbackSnippet(text: string, q: string, width = 240): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const needle = q.trim().toLowerCase();
  const i = needle ? clean.toLowerCase().indexOf(needle) : -1;
  if (i < 0) return clean.slice(0, width) + (clean.length > width ? " …" : "");
  const start = Math.max(0, i - Math.floor(width / 3));
  const end = Math.min(clean.length, start + width);
  const head = start > 0 ? "… " : "";
  const tail = end < clean.length ? " …" : "";
  return `${head}${clean.slice(start, i)}<mark>${clean.slice(i, i + needle.length)}</mark>${clean.slice(i + needle.length, end)}${tail}`;
}

/**
 * Boost sau RRF (ke-hoach/07 §4.3):
 *   rankBoost  = clamp((100 - min(rank,100)) / 100, 0, 1)   — Luật (rank 20) > Nghị định (50) > Thông tư (80)
 *   freshBoost = exp(-(số năm kể từ ngày ban hành) / 10)     — văn bản mới hơn được ưu tiên nhẹ
 *   final      = rrf * (1 + BOOST_MAX * (0.65*rankBoost + 0.35*freshBoost))
 * Hệ số nhân nằm trong [1, 1.15] nên boost chỉ đảo thứ tự khi hai kết quả có RRF chênh < 15%.
 */
export function applyBoost(rrf: number, rank: number, issuedDate: string | null, asOf: string): number {
  const rankBoost = Math.min(1, Math.max(0, (100 - Math.min(rank, 100)) / 100));
  let freshBoost = 0;
  if (issuedDate) {
    const years = (Date.parse(asOf) - Date.parse(issuedDate)) / (365.25 * 24 * 3600 * 1000);
    freshBoost = Math.exp(-Math.max(0, years) / 10);
  }
  return rrf * (1 + BOOST_MAX * (0.65 * rankBoost + 0.35 * freshBoost));
}

function toHit(row: HydratedRow, fused: Fused, score: number, q: string, highlight: boolean): SearchHit {
  // ts_headline so bỏ dấu nên tô cả "phát" khi tìm "phạt": gỡ dấu tô ở chữ không khớp chắc.
  const khopTu = khopTuTruyVan(q);
  const snippet = highlight
    ? row.snippet?.trim()
      ? row.snippet.replace(/<mark>([^<]*)<\/mark>/g, (dau, chu: string) => (khopTu(chu) ? dau : chu))
      : fallbackSnippet(row.text_plain || row.text_md, q)
    : "";
  return {
    urn: row.path ? `${row.doc_urn}#${row.path}` : row.doc_urn,
    nodeId: row.id,
    documentId: row.document_id,
    versionId: row.version_id,
    docUrn: row.doc_urn,
    docType: row.doc_type,
    rank: Number(row.rank),
    soKyHieu: row.so_ky_hieu,
    shortTitle: row.short_title,
    title: row.title,
    issuer: row.issuer_name,
    locality: row.locality,
    fields: row.fields ?? [],
    docStatus: row.doc_status,
    docStatusAsOf: row.doc_status_as_of,
    issuedDate: asDate(row.issued_date),
    path: row.path,
    fullPath: row.full_path,
    kind: row.kind,
    label: row.label,
    heading: row.heading,
    contextPath: row.context_path,
    nodeStatus: row.node_status,
    versionKind: row.version_kind,
    validFrom: asDate(row.valid_from),
    validTo: asDate(row.valid_to),
    text: row.text_md,
    snippet,
    score,
    rrf: fused.rrf,
    matchedBy: fused.matchedBy,
    ranks: fused.ranks,
  };
}

/** Tìm kiếm lai: BM25 + trigram + vector + viện dẫn, hợp nhất bằng RRF. */
export async function search(opts: SearchOptions): Promise<SearchResult> {
  const f = normalize(opts);
  const q = (opts.q ?? "").trim();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const highlight = opts.highlight !== false;
  const warnings: string[] = [];
  const timings: Record<string, number> = {};

  if (!q) {
    return { q, asOf: f.asOf, total: 0, hits: [], citations: [], timings, warnings: ["Truy vấn rỗng"] };
  }

  const timed = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    const t0 = performance.now();
    try {
      return await fn();
    } catch (err) {
      warnings.push(`Tầng ${name} lỗi: ${err instanceof Error ? err.message : String(err)}`);
      return fallback;
    } finally {
      timings[name] = Math.round(performance.now() - t0);
    }
  };

  // Truy vấn dài thì bỏ nhánh trigram (chi phí cao, ích lợi thấp).
  const useTrigram = q.length <= 64;

  const [bm25, trigram, vector, citations] = await Promise.all([
    timed("bm25", () => laneBm25(q, f), [] as LaneRow[]),
    useTrigram
      ? timed("trigram", () => laneTrigram(q, f), [] as LaneRow[])
      : Promise.resolve([] as LaneRow[]),
    timed("vector", () => laneVector(q, f), [] as LaneRow[]),
    timed("citation", () => laneCitation(q, f), [] as CitationMatch[]),
  ]);

  const fused = fuse([
    { lane: "bm25", rows: bm25 },
    { lane: "trigram", rows: trigram },
    { lane: "vector", rows: vector },
  ]);

  // Nút được viện dẫn trực tiếp: ghim lên đầu bằng điểm tuyệt đối.
  for (const c of citations) {
    c.nodeIds.forEach((id, i) => {
      const cur = fused.get(id) ?? { id, rrf: 0, pinned: false, matchedBy: [], ranks: {} };
      cur.pinned = true;
      if (!cur.matchedBy.includes("citation")) cur.matchedBy.unshift("citation");
      cur.ranks.citation = i + 1;
      fused.set(id, cur);
    });
  }

  const t0 = performance.now();
  const ids = [...fused.keys()];
  const rows = await hydrate(ids, q, f.asOf);
  timings.hydrate = Math.round(performance.now() - t0);

  const scored = ids
    .map((id) => {
      const row = rows.get(id);
      const fu = fused.get(id)!;
      if (!row) return undefined;
      const base = applyBoost(fu.rrf, Number(row.rank), asDate(row.issued_date), f.asOf);
      const khop = khopNut(q, [row.heading ?? "", row.text_plain], row.ngu_canh);
      const bac = coSoKyHieu(q, row.so_ky_hieu) ? BAC_SO_KY_HIEU : khop.bac + HE_SO_LIEN * khop.lien;
      // Ghim viện dẫn: cộng hằng số lớn hơn mọi điểm RRF nên luôn đứng trước.
      const score = fu.pinned ? CITATION_PIN - (fu.ranks.citation ?? 1) + base : bac + base;
      return { row, fu, score, lienQuan: score >= 1 || khop.lien >= LIEN_TOI_THIEU };
    })
    .filter((x): x is { row: HydratedRow; fu: Fused; score: number; lienQuan: boolean } => x !== undefined)
    .sort((a, b) => b.score - a.score)
    // Bỏ nút chỉ khớp vài từ lẻ, mảnh chữ; không còn nút nào thì giữ hết, để gõ sai vẫn ra kết quả.
    .filter((s, _, ds) => !opts.dropLooseMatches || s.lienQuan || !ds.some((x) => x.lienQuan));

  const hits = scored.slice(offset, offset + limit).map((s) => toHit(s.row, s.fu, s.score, q, highlight));

  return {
    q,
    asOf: f.asOf,
    total: scored.length,
    hits,
    citations: citations.map((c) => ({ raw: c.raw, urn: c.urn, found: c.found })),
    timings,
    warnings,
  };
}

/**
 * Truy xuất cho `/ask`: chạy tìm kiếm cho câu hỏi và các truy vấn con, gộp,
 * rồi mở rộng ngữ cảnh bằng đồ thị quan hệ (nút cha + văn bản hướng dẫn/sửa đổi).
 * Xem ke-hoach/07 §4.5.
 */
export async function retrieveForAsk(opts: RetrieveOptions): Promise<RetrieveResult> {
  const f = normalize(opts);
  const topK = Math.min(Math.max(opts.topK ?? 12, 1), 40);
  const maxExpand = Math.min(Math.max(opts.maxExpand ?? 10, 0), 20);
  const queries = [opts.q, ...(opts.subQueries ?? [])].map((s) => s.trim()).filter(Boolean);
  const uniqueQueries = [...new Set(queries)];
  const warnings: string[] = [];
  const timings: Record<string, number> = {};
  const citations: RetrieveResult["citations"] = [];

  const t0 = performance.now();
  const results = await Promise.all(
    uniqueQueries.map((q) => search({ ...opts, q, limit: topK, offset: 0, highlight: true })),
  );
  timings.search = Math.round(performance.now() - t0);

  const best = new Map<string, SearchHit>();
  for (const r of results) {
    warnings.push(...r.warnings);
    for (const c of r.citations) if (!citations.some((x) => x.urn === c.urn)) citations.push(c);
    for (const h of r.hits) {
      const prev = best.get(h.nodeId);
      if (!prev || h.score > prev.score) best.set(h.nodeId, h);
    }
  }

  const core = [...best.values()].sort((a, b) => b.score - a.score).slice(0, topK);

  const t1 = performance.now();
  const extra = maxExpand > 0 ? await expandByGraph(core, opts.q, f, maxExpand, best) : [];
  timings.expand = Math.round(performance.now() - t1);

  return {
    asOf: f.asOf,
    hits: [...core, ...extra],
    expanded: extra.length,
    citations,
    warnings: [...new Set(warnings)],
    timings,
  };
}

/**
 * Mở rộng ngữ cảnh: với mỗi nút hạt nhân lấy thêm
 *  (a) nút cha cấp điều (để có đầy đủ ngữ cảnh của khoản/điểm);
 *  (b) nút của các văn bản có quan hệ `huong_dan` / `sua_doi` tới nút hoặc tới văn bản đó.
 * Tối đa `maxExpand` nút.
 */
async function expandByGraph(
  core: SearchHit[],
  q: string,
  f: NormFilters,
  maxExpand: number,
  seen: Map<string, SearchHit>,
): Promise<SearchHit[]> {
  if (core.length === 0) return [];
  const out: SearchHit[] = [];
  const taken = new Set(core.map((h) => h.nodeId));

  // (a) Nút cha cấp điều của các khoản/điểm.
  const versionIds = [...new Set(core.map((h) => h.versionId))];
  const parentPaths = [
    ...new Set(
      core
        .filter((h) => h.kind === "khoan" || h.kind === "diem")
        .map((h) => h.path.split(".")[0] ?? "")
        .filter(Boolean),
    ),
  ];
  if (parentPaths.length) {
    const rows = await sql<Array<{ id: string }>>`
      SELECT n.id FROM nodes n
      WHERE n.kind = 'dieu'
        AND n.version_id = ANY(${versionIds}::uuid[])
        AND n.path = ANY(${parentPaths}::text[])`;
    for (const r of rows) {
      if (out.length >= maxExpand) break;
      if (taken.has(r.id)) continue;
      taken.add(r.id);
      out.push(await stub(r.id, q, f.asOf, "graph"));
    }
  }

  // (b) Văn bản hướng dẫn / sửa đổi các nút hạt nhân (quan hệ hai chiều).
  const urns = [...new Set(core.flatMap((h) => [h.urn, h.docUrn]))];
  const related = await sql<Array<{ other: string }>>`
    SELECT DISTINCT split_part(r.from_urn, '#', 1) AS other
    FROM relations r
    WHERE r.type = ANY(${EXPAND_RELATIONS}::text[])
      AND split_part(r.to_urn, '#', 1) = ANY(${urns}::text[])
    UNION
    SELECT DISTINCT split_part(r.to_urn, '#', 1) AS other
    FROM relations r
    WHERE r.type = ANY(${EXPAND_RELATIONS}::text[])
      AND split_part(r.from_urn, '#', 1) = ANY(${urns}::text[])`;
  const otherDocs = related.map((r) => r.other).filter((u) => !core.some((h) => h.docUrn === u));

  if (otherDocs.length && out.length < maxExpand) {
    const rows = await sql<Array<{ id: string }>>`
      SELECT id FROM (
        SELECT n.id,
               row_number() OVER (PARTITION BY d.id
                 ORDER BY ts_rank_cd(coalesce(n.tsv, ''::tsvector), tsq) DESC, n.ordinal) AS rn
        FROM nodes n
        JOIN document_versions v ON v.id = n.version_id
        JOIN documents d ON d.id = n.document_id
        CROSS JOIN websearch_to_tsquery('vietnamese', ${q}) AS tsq
        WHERE d.urn = ANY(${otherDocs}::text[]) AND ${scopeWhere(f)}
      ) x WHERE rn <= 2
      LIMIT ${maxExpand}`;
    for (const r of rows) {
      if (out.length >= maxExpand) break;
      if (taken.has(r.id) || seen.has(r.id)) continue;
      taken.add(r.id);
      out.push(await stub(r.id, q, f.asOf, "graph"));
    }
  }

  return out.slice(0, maxExpand);
}

/** Dựng SearchHit cho một nút lấy từ đồ thị (không có điểm truy xuất). */
async function stub(nodeId: string, q: string, asOf: string, lane: MatchLane): Promise<SearchHit> {
  const rows = await hydrate([nodeId], q, asOf);
  const row = rows.get(nodeId)!;
  return toHit(row, { id: nodeId, rrf: 0, pinned: false, matchedBy: [lane], ranks: {} }, 0, q, true);
}

/**
 * Sinh embedding cho toàn bộ nút của một phiên bản và ghi vào bảng `embeddings`.
 * Ghi đè embedding cũ của cùng phiên bản + cùng model.
 */
export async function indexVersion(versionId: string): Promise<IndexResult> {
  const [ver] = await sql<Array<{ id: string; document_id: string; short_title: string; title: string }>>`
    SELECT v.id, v.document_id, d.short_title, d.title
    FROM document_versions v JOIN documents d ON d.id = v.document_id
    WHERE v.id = ${versionId}::uuid`;
  if (!ver) throw new Error(`Không tìm thấy phiên bản ${versionId}`);

  const nodes = await sql<ChunkNodeRow[]>`
    SELECT id, path, full_path, kind, label, heading, text_md, text_plain, context_path, ordinal
    FROM nodes WHERE version_id = ${versionId}::uuid ORDER BY ordinal ASC`;

  const chunks = buildChunks(nodes as unknown as ChunkNodeRow[], ver.short_title || ver.title);
  const model = embeddingModel();

  await sql`
    DELETE FROM embeddings
    WHERE model = ${model}
      AND node_id IN (SELECT id FROM nodes WHERE version_id = ${versionId}::uuid)`;

  let written = 0;
  const BATCH = 32;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embed(batch.map((c) => c.text));
    const rows = batch.map((c, j) => ({
      node_id: c.nodeId,
      document_id: ver.document_id,
      chunk_no: c.chunkNo,
      chunk_text: c.text,
      model,
      embedding: toVectorLiteral(vectors[j]!),
    }));
    await sql`INSERT INTO embeddings ${sql(rows, "node_id", "document_id", "chunk_no", "chunk_text", "model", "embedding")}`;
    written += rows.length;
  }

  return {
    versionId,
    documentId: ver.document_id,
    chunks: written,
    nodes: new Set(chunks.map((c) => c.nodeId)).size,
    model,
    dim: EMBEDDING_DIM,
  };
}

/** Index mọi phiên bản của một văn bản (dùng sau khi hợp nhất). */
export async function indexDocument(documentId: string): Promise<IndexResult[]> {
  const versions = await sql<Array<{ id: string }>>`
    SELECT id FROM document_versions WHERE document_id = ${documentId}::uuid ORDER BY version_no`;
  const out: IndexResult[] = [];
  for (const v of versions) out.push(await indexVersion(v.id));
  return out;
}
