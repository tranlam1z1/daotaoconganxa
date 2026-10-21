/**
 * POST /v1/ask — hỏi đáp có trích dẫn (RAG) theo ke-hoach/07-tim-kiem-rag.md §5.
 *
 * Luồng: phân tích câu hỏi -> retrieveForAsk -> gọi LLM với docs[] (key = URN nút) và bật
 * citations -> HẬU KIỂM bắt buộc:
 *   (a) mọi URN trích dẫn phải tồn tại trong CSDL và có hiệu lực tại asOf;
 *   (b) trích dẫn nút đã bị bãi bỏ -> gắn cờ cảnh báo;
 *   (c) không có trích dẫn hợp lệ nào -> trả insufficientBasis = true, KHÔNG bịa câu trả lời;
 *   (d) trích dẫn trải nhiều thứ bậc -> nhắc nguyên tắc ưu tiên văn bản có hiệu lực cao hơn.
 * Toàn bộ câu hỏi/câu trả lời/trích dẫn được ghi vào bảng ask_logs.
 *
 * Bắt buộc đăng nhập và giới hạn số câu mỗi tài khoản mỗi ngày (docs/PLAN.md GĐ0 S2): mỗi câu
 * hỏi gọi mô hình có tính phí, và ask_logs ghi account_id để truy được người hỏi.
 */

import { sql } from "@qdpl/db";
import { docTypeByCode } from "@qdpl/legal-model";
import { complete, isMock, type LlmCitation, type LlmTextDoc, loadPrompt, render } from "@qdpl/llm";
import { retrieveForAsk, type SearchHit } from "@qdpl/search";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { batBuocDangNhap } from "../auth.ts";
import { csv, parseBody, today } from "../http.ts";
import { NODE_STATUS_LABELS } from "../labels.ts";
import { resolveNodeUrn } from "../resolve.ts";

const schema = z.object({
  question: z.string().trim().min(3, "Câu hỏi quá ngắn").max(2000, "Câu hỏi quá dài (tối đa 2000 ký tự)"),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD")
    .optional(),
  docTypes: z.union([z.string(), z.array(z.string())]).optional(),
  fields: z.union([z.string(), z.array(z.string())]).optional(),
  rankMax: z.number().int().min(1).max(999).optional(),
  locality: z.string().trim().optional(),
  includeRepealed: z.boolean().default(false),
  topK: z.number().int().min(1).max(30).default(12),
  maxExpand: z.number().int().min(0).max(20).default(10),
  /** Bỏ qua bước phân tích câu hỏi bằng LLM (dùng cho test và chế độ tiết kiệm). */
  skipAnalysis: z.boolean().default(false),
});

/** Câu trả lời chuẩn khi không đủ căn cứ — không bao giờ được thay bằng suy đoán. */
export const NO_BASIS_ANSWER =
  "Không đủ căn cứ pháp lý trong cơ sở dữ liệu để trả lời câu hỏi này tại thời điểm được hỏi. " +
  "Vui lòng thu hẹp câu hỏi, nêu rõ số ký hiệu văn bản, hoặc kiểm tra lại thời điểm tra cứu.";

export const DISCLAIMER =
  "Thông tin mang tính tham khảo, được tổng hợp tự động từ văn bản quy phạm pháp luật; không thay thế tư vấn pháp lý.";

/**
 * Lược đồ JSON của bước phân tích câu hỏi. Phải khớp mục 6 của
 * `prompts/ask/analyze-question.md` (nhánh nội dung sở hữu file này).
 */
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    normalized_question: { type: "string" },
    intent: { type: "string" },
    intent_secondary: { type: "array", items: { type: "string" } },
    entities: { type: "object" },
    as_of: { type: "string" },
    time_sensitive: { type: "boolean" },
    sub_queries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          q: { type: "string" },
          aspect: { type: "string" },
          weight: { type: "number" },
        },
        required: ["q"],
      },
    },
    needs_multi_doc: { type: "boolean" },
    rank_filter: { type: ["integer", "null"] },
    include_repealed: { type: "boolean" },
    locality: { type: ["string", "null"] },
    expand_graph: { type: "boolean" },
    out_of_scope: { type: "boolean" },
    confidence: { type: "number" },
  },
  required: ["intent", "sub_queries"],
} as const;

/** Kết quả phân tích câu hỏi, đã chuẩn hóa về camelCase cho phần còn lại của luồng. */
interface Analysis {
  intent: string;
  normalizedQuestion: string | null;
  subQueries: string[];
  rankFilter: number | null;
  includeRepealed: boolean;
  locality: string | null;
  expandGraph: boolean;
  outOfScope: boolean;
  asOf: string | null;
  raw: unknown;
}

const EMPTY_ANALYSIS: Analysis = {
  intent: "tra_cuu",
  normalizedQuestion: null,
  subQueries: [],
  rankFilter: null,
  includeRepealed: false,
  locality: null,
  expandGraph: true,
  outOfScope: false,
  asOf: null,
  raw: null,
};

/** Chuẩn hóa JSON snake_case của prompt về Analysis; bỏ qua trường thiếu/sai kiểu. */
function normalizeAnalysis(json: unknown): Analysis {
  if (!json || typeof json !== "object") return EMPTY_ANALYSIS;
  const j = json as Record<string, unknown>;
  const subs = Array.isArray(j.sub_queries) ? j.sub_queries : [];
  const subQueries = subs
    .map((x) =>
      typeof x === "string" ? x : typeof x === "object" && x ? String((x as { q?: unknown }).q ?? "") : "",
    )
    .map((x) => x.trim())
    .filter(Boolean);
  const rank = typeof j.rank_filter === "number" && Number.isFinite(j.rank_filter) ? j.rank_filter : null;
  return {
    intent: typeof j.intent === "string" && j.intent ? j.intent : "tra_cuu",
    normalizedQuestion: typeof j.normalized_question === "string" ? j.normalized_question : null,
    subQueries,
    rankFilter: rank,
    includeRepealed: j.include_repealed === true,
    locality: typeof j.locality === "string" && j.locality ? j.locality : null,
    expandGraph: j.expand_graph !== false,
    outOfScope: j.out_of_scope === true,
    asOf: typeof j.as_of === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.as_of) ? j.as_of : null,
    raw: json,
  };
}

/* ------------------------------------------------------------------ */
/* Đăng nhập, hạn mức, cấu hình (docs/PLAN.md GĐ0 S2)                  */
/* ------------------------------------------------------------------ */

export const HAN_MUC_HOI_MAC_DINH = 30;
let daCanhBaoHanMuc = false;

/**
 * Số câu hỏi AI mỗi tài khoản mỗi ngày, từ ASK_QUOTA_PER_DAY. Thiếu biến thì dùng mặc định;
 * giá trị sai (không phải số nguyên dương) cũng dùng mặc định và báo một lần vào nhật ký, để lỗi
 * gõ cấu hình không vô tình mở hạn mức vô hạn hay khóa hẳn hỏi đáp.
 */
export function hanMucHoiMoiNgay(): number {
  const raw = process.env.ASK_QUOTA_PER_DAY?.trim();
  if (!raw) return HAN_MUC_HOI_MAC_DINH;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  if (!daCanhBaoHanMuc) {
    daCanhBaoHanMuc = true;
    console.warn(`[ask] ASK_QUOTA_PER_DAY="${raw}" không hợp lệ, dùng mặc định ${HAN_MUC_HOI_MAC_DINH}.`);
  }
  return HAN_MUC_HOI_MAC_DINH;
}

/**
 * LLM_PROVIDER=none: máy chủ không có dịch vụ AI (bản demo chưa có key). Hỏi đáp báo "chưa cấu
 * hình" thay vì trả văn bản giữ chỗ của provider mock, để không ai tưởng đó là câu trả lời pháp lý.
 */
export function aiChuaCauHinh(): boolean {
  return process.env.LLM_PROVIDER?.trim().toLowerCase().startsWith("none") ?? false;
}

/** Câu hỏi đang xử lý dở của từng tài khoản: tính vào hạn mức để gửi dồn song song không vượt được. */
const dangHoi = new Map<string, number>();

/** Số câu tài khoản đã hỏi trong ngày hiện tại theo giờ Việt Nam (từ 0 giờ Asia/Ho_Chi_Minh). */
async function soCauDaHoiHomNay(accountId: string): Promise<number> {
  const [row] = await sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM ask_logs
    WHERE account_id = ${accountId}::uuid
      AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
  return row?.n ?? 0;
}

export const ask = new Hono();

ask.post("/", async (c) => {
  const nguoi = await batBuocDangNhap(c);
  if (aiChuaCauHinh()) {
    return c.json(
      {
        error: {
          code: "chua_cau_hinh",
          message:
            "Hỏi đáp AI chưa được cấu hình trên máy chủ này. Bạn vẫn tra cứu văn bản được bình thường.",
        },
      },
      503,
    );
  }
  // Mọi phiên đăng nhập người dùng đều gắn tài khoản; phiên không có tài khoản thì tính theo email.
  const khoaHanMuc = nguoi.accountId ?? `email:${nguoi.email}`;
  const hanMuc = hanMucHoiMoiNgay();
  const dangXuLy = dangHoi.get(khoaHanMuc) ?? 0;
  const daHoi = nguoi.accountId ? await soCauDaHoiHomNay(nguoi.accountId) : 0;
  if (daHoi + dangXuLy >= hanMuc) {
    return c.json(
      {
        error: {
          code: "het_luot",
          message: `Tài khoản đã dùng hết ${hanMuc} câu hỏi AI trong ngày.`,
        },
      },
      429,
    );
  }
  dangHoi.set(khoaHanMuc, dangXuLy + 1);
  try {
    return await traLoi(c, nguoi.accountId ?? null);
  } finally {
    const con = (dangHoi.get(khoaHanMuc) ?? 1) - 1;
    if (con > 0) dangHoi.set(khoaHanMuc, con);
    else dangHoi.delete(khoaHanMuc);
  }
});

async function traLoi(c: Context, accountId: string | null) {
  const body = await parseBody(c, schema);
  const asOf = body.asOf ?? today();
  const warnings: string[] = [];
  const mock = isMock();

  // 1. Phân tích câu hỏi -> ý định + truy vấn con (prompts/ask/analyze-question.md).
  let analysis: Analysis = EMPTY_ANALYSIS;
  if (!body.skipAnalysis && !mock) {
    try {
      const p = requirePrompt("ask/analyze-question");
      const res = await complete({
        tier: "bulk",
        promptName: "ask/analyze-question",
        promptVersion: p.version,
        cacheableSystem: p.system,
        user: render(p.user, {
          question: body.question,
          today: today(),
          as_of_ui: body.asOf ?? "",
          conversation_context: "[]",
        }),
        jsonSchema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 1500,
      });
      analysis = normalizeAnalysis(res.json);
    } catch (err) {
      // Không nuốt lỗi: vẫn truy xuất bằng câu hỏi gốc nhưng phải báo cho người gọi biết.
      warnings.push(`Bỏ qua bước phân tích câu hỏi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Truy xuất.
  const retrieval = await retrieveForAsk({
    q: analysis.normalizedQuestion || body.question,
    subQueries: analysis.subQueries,
    asOf,
    docTypes: csv(body.docTypes),
    fields: csv(body.fields),
    // Tham số người gọi luôn thắng; gợi ý của bước phân tích chỉ dùng khi bỏ trống.
    rankMax: body.rankMax ?? analysis.rankFilter ?? undefined,
    locality: body.locality ?? analysis.locality ?? undefined,
    includeRepealed: body.includeRepealed || analysis.includeRepealed,
    topK: body.topK,
    maxExpand: analysis.expandGraph ? body.maxExpand : 0,
  });
  warnings.push(...retrieval.warnings);

  const byKey = new Map<string, SearchHit>();
  for (const h of retrieval.hits) if (!byKey.has(h.urn)) byKey.set(h.urn, h);
  const docs: LlmTextDoc[] = [...byKey.values()].map((h) => ({
    key: h.urn,
    title: h.contextPath || `${h.shortTitle} — ${h.label}`,
    text: [h.contextPath, h.heading ? `${h.label}. ${h.heading}` : h.label, h.text]
      .filter(Boolean)
      .join("\n"),
    citations: true,
  }));

  /**
   * `context_nodes` của prompt mang METADATA; toàn văn của từng nút đi kèm dưới dạng
   * document block trong `docs[]` (khóa `key` = URN, trùng trường `urn` ở đây) vì đó là
   * thứ API gán trích dẫn vào. Không lặp lại `text_md` ở cả hai chỗ để khỏi nhân đôi
   * token ngữ cảnh — xem ghi chú gửi nhánh nội dung.
   */
  const contextNodes = [...byKey.values()].map((h, index) => ({
    index,
    urn: h.urn,
    so_ky_hieu: h.soKyHieu,
    doc_type_name: docTypeByCode(h.docType)?.name ?? h.docType,
    rank: h.rank,
    issuer: h.issuer,
    issued_date: h.issuedDate,
    title: h.title,
    context_path: h.contextPath,
    label: h.label,
    heading: h.heading,
    node_status: h.nodeStatus,
    effective_from: h.validFrom,
    effective_to: h.validTo,
    version_kind: h.versionKind,
    text_in_document_block: true,
  }));
  const relations = await relationsFor([...new Set([...byKey.values()].map((h) => h.docUrn))]);

  // 3. Sinh câu trả lời (prompts/ask/answer.md).
  let answerText = "";
  let rawCitations: LlmCitation[] = [];
  let model = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;

  if (docs.length > 0) {
    const p = requirePrompt("ask/answer");
    const res = await complete({
      tier: "heavy",
      promptName: "ask/answer",
      promptVersion: p.version,
      cacheableSystem: p.system,
      user: render(p.user, {
        question: body.question,
        as_of: asOf,
        question_analysis: JSON.stringify(
          analysis.raw ?? { intent: analysis.intent, sub_queries: [] },
          null,
          2,
        ),
        context_nodes: JSON.stringify(contextNodes, null, 2),
        relations: JSON.stringify(relations, null, 2),
      }),
      docs,
      effort: "high",
      maxTokens: 4000,
    });
    answerText = res.text;
    rawCitations = res.citations;
    model = res.model;
    tokensIn = res.tokensIn;
    tokensOut = res.tokensOut;
    costUsd = res.costUsd;
  }

  // 4. Hậu kiểm trích dẫn.
  const checked = await Promise.all(
    dedupeCitations(rawCitations).map(async (cit) => {
      const resolved = await resolveNodeUrn(cit.docKey, asOf);
      const hit = byKey.get(cit.docKey);
      return {
        urn: cit.docKey,
        citedText: cit.citedText,
        exists: resolved.documentFound && resolved.nodeFound,
        effective: resolved.effective,
        nodeStatus: resolved.nodeStatus,
        nodeStatusLabel: resolved.nodeStatus
          ? (NODE_STATUS_LABELS[resolved.nodeStatus] ?? resolved.nodeStatus)
          : null,
        docUrn: resolved.docUrn,
        soKyHieu: resolved.soKyHieu,
        shortTitle: resolved.shortTitle,
        label: resolved.label ?? hit?.label ?? null,
        heading: resolved.heading ?? hit?.heading ?? null,
        contextPath: hit?.contextPath ?? null,
        validFrom: resolved.validFrom,
        validTo: resolved.validTo,
        rank: hit?.rank ?? null,
        docType: hit?.docType ?? null,
        docTypeName: hit?.docType ? (docTypeByCode(hit.docType)?.name ?? hit.docType) : null,
      };
    }),
  );

  const valid = checked.filter((x) => x.exists && x.effective);
  const invalid = checked.filter((x) => !x.exists);
  const repealed = checked.filter((x) => x.exists && x.nodeStatus === "repealed");
  const notEffective = checked.filter((x) => x.exists && !x.effective && x.nodeStatus !== "repealed");

  for (const x of invalid) warnings.push(`Trích dẫn không tồn tại trong CSDL và đã bị loại: ${x.urn}`);
  for (const x of notEffective) warnings.push(`Trích dẫn không có hiệu lực tại ${asOf}: ${x.urn}`);

  const flags: string[] = [];
  if (repealed.length > 0) {
    flags.push("trich_dan_da_bi_bai_bo");
    warnings.push(
      `Cảnh báo: câu trả lời có trích dẫn nội dung đã bị bãi bỏ (${repealed.map((x) => x.urn).join(", ")}).`,
    );
  }
  const ranks = new Set(valid.map((x) => x.rank).filter((r): r is number => typeof r === "number"));
  if (ranks.size > 1) {
    flags.push("nhieu_thu_bac");
    warnings.push(
      "Câu trả lời viện dẫn văn bản ở nhiều thứ bậc khác nhau; khi có mâu thuẫn thì áp dụng văn bản có hiệu lực pháp lý cao hơn (Điều 4 Luật Ban hành VBQPPL).",
    );
  }

  const insufficientBasis = valid.length === 0;
  const answer = insufficientBasis ? NO_BASIS_ANSWER : answerText;

  const note = mock
    ? "Chưa cấu hình ANTHROPIC_API_KEY nên hệ thống đang dùng provider mock: phần truy xuất là thật, phần sinh câu trả lời chỉ là văn bản giữ chỗ."
    : null;

  const retrievalLog = retrieval.hits.map((h) => ({
    urn: h.urn,
    score: h.score,
    matchedBy: h.matchedBy,
    kind: h.kind,
    nodeStatus: h.nodeStatus,
  }));

  // 5. Ghi log. Cột jsonb: truyền thẳng object, KHÔNG JSON.stringify.
  const [log] = await sql<Array<{ id: string }>>`
    INSERT INTO ask_logs (question, as_of, answer, citations, retrieval, model, tokens_in, tokens_out,
                          cost_usd, faithful, account_id)
    VALUES (${body.question}, ${asOf}::date, ${answer}, ${sql.json(checked)}, ${sql.json(retrievalLog)},
            ${model || null}, ${tokensIn}, ${tokensOut}, ${costUsd}, ${!insufficientBasis}, ${accountId}::uuid)
    RETURNING id`;

  return c.json({
    id: log?.id ?? null,
    question: body.question,
    asOf,
    intent: analysis.intent,
    subQueries: analysis.subQueries,
    answer,
    insufficientBasis,
    citations: valid,
    rejectedCitations: checked.filter((x) => !valid.includes(x)),
    flags,
    warnings: [...new Set(warnings)],
    retrieval: {
      total: retrieval.hits.length,
      expanded: retrieval.expanded,
      timings: retrieval.timings,
      hits: retrieval.hits.map((h) => ({
        urn: h.urn,
        docUrn: h.docUrn,
        shortTitle: h.shortTitle,
        label: h.label,
        heading: h.heading,
        contextPath: h.contextPath,
        kind: h.kind,
        nodeStatus: h.nodeStatus,
        snippet: h.snippet,
        score: Number(h.score.toFixed(6)),
        matchedBy: h.matchedBy,
      })),
    },
    model: model || null,
    mock,
    note,
    disclaimer: DISCLAIMER,
    usage: { tokensIn, tokensOut, costUsd },
  });
}

/** Gộp trích dẫn trùng URN, giữ đoạn trích dài nhất. */
function dedupeCitations(cits: LlmCitation[]): LlmCitation[] {
  const byUrn = new Map<string, LlmCitation>();
  for (const cit of cits) {
    const prev = byUrn.get(cit.docKey);
    if (!prev || cit.citedText.length > prev.citedText.length) byUrn.set(cit.docKey, cit);
  }
  return [...byUrn.values()];
}

/** Quan hệ giữa các văn bản xuất hiện trong ngữ cảnh, để mô hình nêu đúng cha/con/ảnh hưởng. */
async function relationsFor(docUrns: string[]) {
  if (docUrns.length === 0) return [];
  const rows = await sql<Array<{ from_urn: string; to_urn: string; type: string }>>`
    SELECT DISTINCT from_urn, to_urn, type FROM relations
    WHERE split_part(from_urn, '#', 1) = ANY(${docUrns}::text[])
       OR split_part(to_urn, '#', 1) = ANY(${docUrns}::text[])
    LIMIT 50`;
  return rows.map((r) => ({ from: r.from_urn, to: r.to_urn, type: r.type }));
}

/**
 * Đọc prompt từ `prompts/`. Prompt là một phần của hợp đồng chất lượng câu trả lời,
 * nên nếu thiếu file thì phải hỏng to chứ không âm thầm chạy bằng prompt tạm.
 */
function requirePrompt(name: string): { version: string; system: string; user: string } {
  const p = loadPrompt(name);
  if (!p.system.trim() || !p.user.trim()) {
    throw new Error(`Prompt ${name} thiếu mục ## SYSTEM hoặc ## USER`);
  }
  return p;
}
