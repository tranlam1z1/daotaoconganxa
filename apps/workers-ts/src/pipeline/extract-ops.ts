/**
 * Bước 5 (ke-hoach/02 §4.1, ke-hoach/06 §2): trích lệnh sửa đổi có cấu trúc.
 *
 * PHẦN CHÍNH LÀ RULE-BASED: quét Markdown của văn bản sửa đổi, tách theo Điều
 * rồi theo từng khoản lệnh, nhận diện các mẫu câu ở ke-hoach/06 §2.2 và lấy cả
 * nội dung mới trong dấu ngoặc kép NHIỀU DÒNG.
 * LLM chỉ dùng để ĐỐI CHIẾU (khi có ANTHROPIC_API_KEY); ở chế độ mock thì bỏ qua.
 */
import { randomUUID } from "node:crypto";
import { addReview, enqueue, getDocumentByUrn, saveAmendOps, saveRelations, sql } from "@qdpl/db";
import { type AmendOp, type AmendOpKind, buildUrn, inferDocType, type NodeKind } from "@qdpl/legal-model";
import { complete, isMock } from "@qdpl/llm";
import { normalizeSoKyHieu, normalizeText, parseVietnameseDate } from "../crawler/normalize.ts";
import { log } from "../log.ts";
import { tidyMarkdown } from "./html-md.ts";
import { getDocumentById, getOriginalVersion } from "./parse.ts";

/* ================================================================== */
/* 1. Tách văn bản thành Điều -> khoản lệnh (nhận biết dấu ngoặc kép)   */
/* ================================================================== */

const HEADING_PREFIX = /^\s*#{1,6}\s*/;
const RE_ARTICLE_START = /^\s*(?:#{1,6}\s*)?Điều\s+(\d+[a-zđ]?\d?)\s*[.．]?\s*(.*)$/i;
const RE_COMMAND_START = /^\s*(?:#{1,6}\s*)?(\d{1,3}[a-zđ]?)\s*[.．]\s+(.*)$/;

/** Số dấu " trên một dòng (dùng để biết đang ở trong khối trích dẫn hay không). */
function quoteCount(line: string): number {
  return (line.match(/"/g) ?? []).length;
}

export interface CommandChunk {
  /** Nhãn khoản lệnh, ví dụ "khoản 2 Điều 1". */
  label: string;
  /** Khóa khoản trong Điều chứa lệnh. */
  key: string;
  /** Dòng đầu (câu lệnh). */
  directive: string;
  /** Toàn bộ dòng của khoản lệnh, gồm phần trích dẫn nhiều dòng. */
  lines: string[];
}

export interface ArticleChunk {
  key: string;
  label: string;
  heading: string;
  /** Các dòng trước khoản đầu tiên (thường chứa tên văn bản bị sửa). */
  intro: string[];
  commands: CommandChunk[];
}

/** Tách Markdown thành các Điều, mỗi Điều thành các khoản lệnh. */
export function splitArticles(markdown: string): ArticleChunk[] {
  const lines = tidyMarkdown(markdown).split("\n");
  const articles: ArticleChunk[] = [];
  let current: ArticleChunk | undefined;
  let currentCmd: CommandChunk | undefined;
  let inQuote = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const atTopLevel = !inQuote;
    // Cập nhật trạng thái ngoặc kép SAU khi đã dùng trạng thái trước dòng này.
    const quotesHere = quoteCount(line);

    if (atTopLevel) {
      const art = RE_ARTICLE_START.exec(line);
      if (art) {
        current = {
          key: art[1]!.toLowerCase(),
          label: `Điều ${art[1]}`,
          heading: normalizeText(art[2] ?? ""),
          intro: [],
          commands: [],
        };
        currentCmd = undefined;
        articles.push(current);
        if (quotesHere % 2 === 1) inQuote = !inQuote;
        continue;
      }
      const cmd = current ? RE_COMMAND_START.exec(line) : null;
      if (cmd && current) {
        currentCmd = {
          key: cmd[1]!.toLowerCase(),
          label: `khoản ${cmd[1]} ${current.label}`,
          directive: normalizeText(cmd[2] ?? ""),
          lines: [line.replace(HEADING_PREFIX, "")],
        };
        current.commands.push(currentCmd);
        if (quotesHere % 2 === 1) inQuote = !inQuote;
        continue;
      }
    }

    if (currentCmd) currentCmd.lines.push(line);
    else if (current) current.intro.push(line);
    if (quotesHere % 2 === 1) inQuote = !inQuote;
  }
  return articles;
}

/* ================================================================== */
/* 2. Bóc nội dung mới trong dấu ngoặc kép (nhiều dòng)                */
/* ================================================================== */

/**
 * Lấy khối trích dẫn của một khoản lệnh: từ dấu " đầu tiên sau "như sau:"
 * đến dấu " cuối cùng trong khoản. Trả về undefined nếu không có.
 */
export function extractQuoted(chunk: CommandChunk): string | undefined {
  const body = chunk.lines.join("\n");
  const first = body.indexOf('"');
  if (first < 0) return undefined;
  const last = body.lastIndexOf('"');
  if (last <= first) return undefined;
  const inner = body.slice(first + 1, last);
  return normalizeQuoted(inner);
}

function normalizeQuoted(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(HEADING_PREFIX, "").trim())
    .filter((l, i, arr) => l !== "" || (i > 0 && i < arr.length - 1))
    .join("\n")
    .trim();
}

/* ================================================================== */
/* 3. Nhận diện nút đích                                               */
/* ================================================================== */

export interface TargetRef {
  dieu?: string;
  khoan?: string;
  diem?: string;
  path: string;
}

const RE_REF = /(?:điểm\s+([a-zđ]\d?)\s*\)?\s+)?(?:khoản\s+(\d+[a-zđ]?)\s+)?Điều\s+(\d+[a-zđ]?\d?)/i;
const RE_REF_NO_DIEU = /(?:điểm\s+([a-zđ]\d?)\s*\)?\s+)?khoản\s+(\d+[a-zđ]?)/i;

export function refToPath(r: { dieu?: string; khoan?: string; diem?: string }): string {
  if (!r.dieu) return "";
  let p = `dieu-${r.dieu.toLowerCase()}`;
  if (r.khoan) p += `.khoan-${r.khoan.toLowerCase()}`;
  if (r.diem) p += `.diem-${r.diem.toLowerCase()}`;
  return p;
}

/** Tìm nút đích trong một câu lệnh (thứ tự tiếng Việt: điểm -> khoản -> Điều). */
export function parseTargetRef(text: string): TargetRef | undefined {
  const s = normalizeText(text);
  const m = RE_REF.exec(s);
  if (m) {
    const ref: TargetRef = { path: "" };
    if (m[3]) ref.dieu = m[3].toLowerCase();
    if (m[2]) ref.khoan = m[2].toLowerCase();
    if (m[1]) ref.diem = m[1].toLowerCase();
    ref.path = refToPath(ref);
    return ref;
  }
  const m2 = RE_REF_NO_DIEU.exec(s);
  if (m2) {
    const ref: TargetRef = { path: "" };
    if (m2[2]) ref.khoan = m2[2].toLowerCase();
    if (m2[1]) ref.diem = m2[1].toLowerCase();
    return ref;
  }
  return undefined;
}

/**
 * Nhiều nút đích trong một lệnh, ví dụ "Bãi bỏ khoản 3 và khoản 4 Điều 5",
 * "Bãi bỏ Điều 20, Điều 21". Trả về ít nhất một phần tử nếu tìm được.
 */
export function parseTargetRefs(text: string): TargetRef[] {
  const s = normalizeText(text);
  const dieus = [...s.matchAll(/Điều\s+(\d+[a-zđ]?\d?)/gi)].map((m) => m[1]!.toLowerCase());
  const uniqueDieus = [...new Set(dieus)];
  if (uniqueDieus.length > 1) {
    return uniqueDieus.map((d) => ({ dieu: d, path: `dieu-${d}` }));
  }
  const dieu = uniqueDieus[0];
  const khoans = [...s.matchAll(/khoản\s+(\d+[a-zđ]?)/gi)].map((m) => m[1]!.toLowerCase());
  const diems = [...s.matchAll(/điểm\s+([a-zđ]\d?)\s*\)?/gi)].map((m) => m[1]!.toLowerCase());
  if (dieu && khoans.length > 1) {
    return [...new Set(khoans)].map((k) => ({ dieu, khoan: k, path: `dieu-${dieu}.khoan-${k}` }));
  }
  if (dieu && khoans.length === 1 && diems.length > 1) {
    return [...new Set(diems)].map((dm) => ({
      dieu,
      khoan: khoans[0]!,
      diem: dm,
      path: `dieu-${dieu}.khoan-${khoans[0]}.diem-${dm}`,
    }));
  }
  const single = parseTargetRef(s);
  return single ? [single] : [];
}

/* ================================================================== */
/* 4. Nhận diện văn bản bị sửa đổi                                     */
/* ================================================================== */

const SO_KY_HIEU_RE = /\b(\d+[A-ZĐa-zđ]?\/\d{4}\/[A-ZĐa-zđ0-9]+(?:-[A-ZĐa-zđ0-9]+)*)\b/;

export function findSoKyHieu(text: string): string | undefined {
  const m = SO_KY_HIEU_RE.exec(normalizeText(text));
  return m ? normalizeSoKyHieu(m[1]!) : undefined;
}

/** Số ký hiệu của văn bản BỊ sửa đổi: bỏ qua số ký hiệu của chính văn bản sửa đổi. */
export function findTargetSoKyHieu(text: string, selfSoKyHieu?: string): string | undefined {
  const self = selfSoKyHieu ? normalizeSoKyHieu(selfSoKyHieu) : undefined;
  for (const m of normalizeText(text).matchAll(new RegExp(SO_KY_HIEU_RE.source, "g"))) {
    const sk = normalizeSoKyHieu(m[1]!);
    if (self && sk === self) continue;
    return sk;
  }
  return undefined;
}

export function urnForSoKyHieu(soKyHieu: string): string | undefined {
  const sk = normalizeSoKyHieu(soKyHieu);
  const docType = inferDocType(sk);
  if (!docType) return undefined;
  return buildUrn({ docType, soKyHieu: sk });
}

/* ================================================================== */
/* 5. Trích lệnh sửa đổi (rule-based)                                  */
/* ================================================================== */

export interface ExtractedOp {
  op: AmendOpKind;
  targetDocUrn: string;
  targetSoKyHieu: string;
  targetPath: string;
  payload?: AmendOp["payload"];
  amendingLabel: string;
  effectiveFrom: string;
  effectiveTo?: string;
  ordinal: number;
  confidence: number;
  /** Câu lệnh gốc, để quản trị viên nội dung đối chiếu. */
  evidence: string;
}

export interface ExtractContext {
  /** URN của văn bản sửa đổi. */
  amendingUrn: string;
  /** Tên đầy đủ của văn bản sửa đổi (để lấy văn bản đích khi Điều không nêu). */
  title: string;
  /** Số ký hiệu của CHÍNH văn bản sửa đổi (để không tự trỏ vào mình). */
  soKyHieu?: string;
  /** Ngày hiệu lực mặc định của văn bản sửa đổi. */
  effectiveFrom?: string;
  issuedDate?: string;
}

export interface ExtractResult {
  ops: ExtractedOp[];
  warnings: string[];
  /** Ngày hiệu lực suy ra từ chính văn bản. */
  effectiveFrom: string;
}

/** "Nghị định này có hiệu lực thi hành từ ngày 01 tháng 7 năm 2027" -> 2027-07-01 */
export function findEffectiveDate(markdown: string): string | undefined {
  const s = normalizeText(markdown.replace(/\n/g, " "));
  const m =
    /có hiệu lực(?:\s+thi hành)?\s+(?:kể\s+)?từ\s+(ngày\s+\d{1,2}\s+tháng\s+[^\s]+\s+năm\s+\d{4}|ngày\s+[\d/.-]+)/i.exec(
      s,
    );
  return m ? parseVietnameseDate(m[1]!) : undefined;
}

/** Nhãn nút mới đúng định dạng parser: "4." / "a)" / "Điều 3a". */
export function newLabelFor(kind: NodeKind, key: string): string {
  if (kind === "dieu") return `Điều ${key}`;
  if (kind === "diem") return `${key})`;
  return `${key}.`;
}

/** "khoản 4" / "Điều 3a" / "điểm d" -> { kind, key } */
export function parseNewUnit(text: string): { kind: NodeKind; key: string } | undefined {
  const s = normalizeText(text);
  let m = /Điều\s+(\d+[a-zđ]?\d?)/i.exec(s);
  if (m) return { kind: "dieu", key: m[1]!.toLowerCase() };
  m = /khoản\s+(\d+[a-zđ]?)/i.exec(s);
  if (m) return { kind: "khoan", key: m[1]!.toLowerCase() };
  m = /điểm\s+([a-zđ]\d?)/i.exec(s);
  if (m) return { kind: "diem", key: m[1]!.toLowerCase() };
  return undefined;
}

/**
 * Điều này có phải Điều chứa lệnh sửa đổi không. Dùng để KHÔNG quét mọi khoản
 * của mọi Điều trong văn bản thường (tránh hàng trăm cảnh báo rác).
 */
export function articleLooksAmending(art: ArticleChunk): boolean {
  const scope = normalizeText(`${art.heading} ${art.intro.join(" ")}`).toLowerCase();
  if (/(sửa đổi|bổ sung|bãi bỏ|thay thế|ngưng hiệu lực|đình chỉ|hết hiệu lực)/.test(scope)) return true;
  return art.commands.some((c) => looksLikeAmendCommand(c.directive));
}

/** Câu lệnh có đúng dạng lệnh sửa đổi không (trước khi tốn công tìm văn bản đích). */
export function looksLikeAmendCommand(directive: string): boolean {
  const s = normalizeText(directive);
  if (/^(?:Sửa đổi|Bổ sung|Bãi bỏ|Hủy bỏ|Bỏ|Thay thế|Ngưng hiệu lực|Đình chỉ hiệu lực)(?=\s|,|$)/i.test(s)) {
    return true;
  }
  // "Nghị định số X hết hiệu lực kể từ ngày ..." trong Điều hiệu lực thi hành.
  if (/hết hiệu lực/i.test(s) && SO_KY_HIEU_RE.test(s)) return true;
  return false;
}

const RE_PHRASE = /Thay thế\s+cụm từ\s*"([^"]+)"\s*(?:bằng|thành)\s*(?:cụm từ\s*)?"([^"]*)"/i;
const RE_PHRASE_REMOVE = /(?:Bãi bỏ|Bỏ)\s+cụm từ\s*"([^"]+)"/i;

/**
 * Trích toàn bộ lệnh sửa đổi từ Markdown của văn bản sửa đổi.
 * Chỉ dùng quy tắc, không gọi mạng — nhờ vậy test được ngoại tuyến.
 */
export function extractOpsFromMarkdown(markdown: string, ctx: ExtractContext): ExtractResult {
  const warnings: string[] = [];
  const effectiveFrom =
    findEffectiveDate(markdown) ??
    ctx.effectiveFrom ??
    ctx.issuedDate ??
    new Date().toISOString().slice(0, 10);
  const docLevelTarget = findTargetSoKyHieu(ctx.title, ctx.soKyHieu);
  const articles = splitArticles(markdown);
  const ops: ExtractedOp[] = [];
  let ordinal = 0;

  for (const art of articles) {
    if (!articleLooksAmending(art)) continue;
    const articleScope = `${art.heading}\n${art.intro.join("\n")}`;
    const articleTarget = findTargetSoKyHieu(articleScope, ctx.soKyHieu) ?? docLevelTarget;

    for (const cmd of art.commands) {
      const directive = normalizeText(cmd.directive);
      // Khoản không phải lệnh sửa đổi (ví dụ nội dung mới được trích dẫn) -> bỏ qua im lặng.
      if (!looksLikeAmendCommand(directive)) continue;
      // Số ký hiệu nêu ngay trong lệnh thắng phạm vi Điều.
      const cmdTarget = findTargetSoKyHieu(directive, ctx.soKyHieu) ?? articleTarget;
      if (!cmdTarget) {
        warnings.push(`Không xác định được văn bản bị sửa đổi cho ${cmd.label}: "${directive.slice(0, 90)}"`);
        continue;
      }
      const targetDocUrn = urnForSoKyHieu(cmdTarget);
      if (!targetDocUrn) {
        warnings.push(`Không suy được loại văn bản từ số ký hiệu "${cmdTarget}" (${cmd.label})`);
        continue;
      }
      const base = {
        targetDocUrn,
        targetSoKyHieu: cmdTarget,
        amendingLabel: cmd.label,
        effectiveFrom,
        evidence: cmd.lines.join("\n").trim(),
      };
      const quoted = extractQuoted(cmd);
      const made = buildOpsForCommand({ directive, quoted, base, warnings, label: cmd.label });
      for (const o of made) {
        o.ordinal = ordinal++;
        ops.push(o);
      }
    }

    // Lệnh nằm thẳng trong thân Điều (không đánh khoản), ví dụ
    // "Điều 2. Bãi bỏ Nghị định số 50/2020/NĐ-CP."
    if (!art.commands.length) {
      const directive = normalizeText(`${art.heading} ${art.intro.join(" ")}`).trim();
      if (!directive) continue;
      if (!looksLikeAmendCommand(directive.replace(/^[^.]*\.\s*/, "")) && !looksLikeAmendCommand(directive)) {
        continue;
      }
      const target = findTargetSoKyHieu(directive, ctx.soKyHieu) ?? docLevelTarget;
      if (!target) continue;
      const targetDocUrn = urnForSoKyHieu(target);
      if (!targetDocUrn) continue;
      const base = {
        targetDocUrn,
        targetSoKyHieu: target,
        amendingLabel: art.label,
        effectiveFrom,
        evidence: directive,
      };
      const made = buildOpsForCommand({
        directive,
        quoted: undefined,
        base,
        warnings,
        label: art.label,
        articleLevel: true,
      });
      for (const o of made) {
        o.ordinal = ordinal++;
        ops.push(o);
      }
    }
  }

  return { ops, warnings, effectiveFrom };
}

interface BuildArgs {
  directive: string;
  quoted?: string;
  base: Omit<ExtractedOp, "op" | "targetPath" | "ordinal" | "confidence">;
  warnings: string[];
  label: string;
  articleLevel?: boolean;
}

function buildOpsForCommand(args: BuildArgs): ExtractedOp[] {
  const { directive, quoted, base, warnings, label } = args;
  const out: ExtractedOp[] = [];
  const mk = (o: Omit<ExtractedOp, "ordinal">): ExtractedOp => ({ ...o, ordinal: 0 });

  /* --- Thay thế cụm từ ------------------------------------------- */
  const phrase = RE_PHRASE.exec(directive);
  if (phrase) {
    const scopePaths = parseScopePaths(directive);
    out.push(
      mk({
        ...base,
        op: "replace_phrase",
        targetPath: "",
        payload: { find: phrase[1]!, replace: phrase[2] ?? "", ...(scopePaths.length ? { scopePaths } : {}) },
        confidence: 0.95,
      }),
    );
    return out;
  }
  const removePhrase = RE_PHRASE_REMOVE.exec(directive);
  if (removePhrase) {
    const scopePaths = parseScopePaths(directive);
    out.push(
      mk({
        ...base,
        op: "replace_phrase",
        targetPath: "",
        payload: { find: removePhrase[1]!, replace: "", ...(scopePaths.length ? { scopePaths } : {}) },
        confidence: 0.85,
      }),
    );
    return out;
  }

  /* --- Ngưng hiệu lực -------------------------------------------- */
  if (/^(?:Ngưng|Đình chỉ)\s+hiệu lực/i.test(directive)) {
    const ref = parseTargetRef(directive);
    const dates = [
      ...directive.matchAll(/(?:từ|đến)\s+(ngày\s+\d{1,2}\s+tháng\s+\S+\s+năm\s+\d{4}|ngày\s+[\d/.-]+)/gi),
    ]
      .map((m) => parseVietnameseDate(m[1]!))
      .filter(Boolean) as string[];
    out.push(
      mk({
        ...base,
        op: "suspend",
        targetPath: ref?.path ?? "",
        ...(dates[0] ? { effectiveFrom: dates[0] } : {}),
        ...(dates[1] ? { effectiveTo: dates[1] } : {}),
        confidence: ref ? 0.85 : 0.6,
      }),
    );
    return out;
  }

  /* --- Sửa tên điều (rename) -------------------------------------- */
  if (/(?:Sửa đổi(?:,?\s*bổ sung)?)\s+tên\s+(?:của\s+)?Điều/i.test(directive)) {
    const ref = parseTargetRef(directive);
    const heading =
      quoted?.replace(/^Điều\s+\d+[a-zđ]?\s*[.．]\s*/i, "").trim() ??
      /thành\s*[:"]?\s*(.+?)["".]?$/i.exec(directive)?.[1]?.trim();
    if (ref?.path && heading) {
      out.push(
        mk({
          ...base,
          op: "rename",
          targetPath: ref.path,
          payload: { heading, text: heading },
          confidence: 0.85,
        }),
      );
      return out;
    }
    warnings.push(`Lệnh đổi tên điều thiếu nút đích hoặc tên mới (${label})`);
  }

  /* --- Bổ sung (chèn nút mới) ------------------------------------- */
  if (/^Bổ sung(?=\s|$)/i.test(directive)) {
    const beforeVao = directive.split(/(?:^|\s)vào(?=\s|$)/i)[0] ?? directive;
    const afterVao = directive.slice(beforeVao.length);
    const unit = parseNewUnit(beforeVao.replace(/^Bổ sung\s*/i, ""));
    if (!unit) {
      warnings.push(`Không xác định được nút mới cần bổ sung (${label}): "${directive.slice(0, 90)}"`);
      return out;
    }
    if (!quoted) {
      warnings.push(`Lệnh bổ sung thiếu nội dung trong ngoặc kép (${label})`);
      return out;
    }
    const anchorText = afterVao.replace(/^\s*vào\s*/i, "");
    const isAfter = /^\s*sau\b/i.test(anchorText);
    const isBefore = /^\s*trước\b/i.test(anchorText);
    const anchor = parseTargetRef(anchorText);
    const payload: AmendOp["payload"] = {
      text: quoted,
      newLabel: newLabelFor(unit.kind, unit.key),
      newKind: unit.kind,
    };
    if (anchor?.path && (isAfter || isBefore)) {
      out.push(
        mk({
          ...base,
          op: isBefore ? "insert_before" : "insert_after",
          targetPath: anchor.path,
          payload,
          confidence: 0.92,
        }),
      );
      return out;
    }
    // "Bổ sung khoản 5 vào Điều 7" -> thêm con vào cuối.
    if (anchor?.path) {
      out.push(mk({ ...base, op: "append_child", targetPath: anchor.path, payload, confidence: 0.8 }));
      return out;
    }
    warnings.push(`Lệnh bổ sung không có vị trí neo (${label}): "${directive.slice(0, 90)}"`);
    return out;
  }

  /* --- Bãi bỏ ------------------------------------------------------ */
  if (/^(?:Bãi bỏ|Hủy bỏ|Bỏ)(?=\s|$)/i.test(directive)) {
    const refs = parseTargetRefs(directive);
    if (refs.length) {
      for (const r of refs) {
        out.push(mk({ ...base, op: "repeal", targetPath: r.path, confidence: 0.93 }));
      }
      return out;
    }
    // Bãi bỏ cấp văn bản: "Bãi bỏ Nghị định số 50/2020/NĐ-CP".
    if (findSoKyHieu(directive)) {
      out.push(mk({ ...base, op: "repeal", targetPath: "", confidence: 0.9 }));
      return out;
    }
    warnings.push(`Lệnh bãi bỏ không xác định được đối tượng (${label}): "${directive.slice(0, 90)}"`);
    return out;
  }

  /* --- Sửa đổi, bổ sung <nút> như sau ------------------------------ */
  if (/Sửa đổi|Thay thế/i.test(directive)) {
    const ref = parseTargetRef(directive);
    if (!ref?.path) {
      warnings.push(`Lệnh sửa đổi không xác định được nút đích (${label}): "${directive.slice(0, 90)}"`);
      return out;
    }
    if (!quoted) {
      warnings.push(`Lệnh sửa đổi thiếu nội dung mới trong ngoặc kép (${label})`);
      return out;
    }
    out.push(
      mk({ ...base, op: "replace", targetPath: ref.path, payload: { text: quoted }, confidence: 0.93 }),
    );
    return out;
  }

  /* --- Văn bản hết hiệu lực (thường ở Điều "Hiệu lực thi hành") ---- */
  if (/hết hiệu lực/i.test(directive) && findSoKyHieu(directive)) {
    out.push(mk({ ...base, op: "repeal", targetPath: "", confidence: 0.7 }));
    return out;
  }

  return out;
}

/** "tại các Điều 3, Điều 5 và khoản 2 Điều 7" -> danh sách path áp dụng. */
export function parseScopePaths(directive: string): string[] {
  const idx = directive.search(/\btại\b/i);
  if (idx < 0) return [];
  const scope = directive.slice(idx);
  // Phạm vi là cả văn bản -> không giới hạn path.
  if (SO_KY_HIEU_RE.test(scope) && !/Điều\s+\d/i.test(scope)) return [];
  const refs = parseTargetRefs(scope);
  return refs.map((r) => r.path).filter(Boolean);
}

/* ================================================================== */
/* 6. Kiểm tra nút đích + đối chiếu LLM + ghi CSDL                     */
/* ================================================================== */

/** Nút đích có tồn tại trong phiên bản hiện hành của văn bản bị sửa không. */
export async function targetNodeExists(targetDocUrn: string, path: string): Promise<boolean | undefined> {
  const doc = await getDocumentByUrn(targetDocUrn);
  if (!doc) return undefined; // chưa nạp văn bản đích -> không kết luận được
  if (!path) return true; // lệnh cấp văn bản
  const rows = await sql`
    SELECT 1 FROM nodes n
    JOIN document_versions v ON v.id = n.version_id
    WHERE n.document_id = ${doc.id} AND n.path = ${path}
      AND v.version_no = (SELECT max(version_no) FROM document_versions WHERE document_id = ${doc.id})
    LIMIT 1`;
  return rows.length > 0;
}

/** Schema JSON để LLM trả lệnh sửa đổi có cấu trúc (đối chiếu với rule). */
export const AMEND_OPS_SCHEMA = {
  type: "object",
  properties: {
    ops: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: {
            type: "string",
            enum: [
              "replace",
              "insert_after",
              "insert_before",
              "append_child",
              "repeal",
              "suspend",
              "rename",
              "replace_phrase",
            ],
          },
          targetSoKyHieu: { type: "string" },
          targetPath: { type: "string" },
          newLabel: { type: "string" },
          text: { type: "string" },
          find: { type: "string" },
          replace: { type: "string" },
          amendingLabel: { type: "string" },
        },
        required: ["op", "targetSoKyHieu", "targetPath"],
      },
    },
  },
  required: ["ops"],
} as const;

export interface LlmCrossCheck {
  used: boolean;
  agreed: number;
  disagreed: number;
  note?: string;
}

/**
 * Đối chiếu kết quả rule với LLM. Ở chế độ mock (không có ANTHROPIC_API_KEY)
 * trả về `{ used: false }` và giữ nguyên kết quả rule.
 */
export async function crossCheckWithLlm(markdown: string, ruleOps: ExtractedOp[]): Promise<LlmCrossCheck> {
  if (isMock())
    return { used: false, agreed: 0, disagreed: 0, note: "LLM ở chế độ mock — chỉ dùng rule-based" };
  const res = await complete({
    tier: "heavy",
    promptName: "amend-ops",
    system:
      "Bạn là chuyên gia kỹ thuật lập pháp Việt Nam. Trích các lệnh sửa đổi từ văn bản sửa đổi, " +
      "trả về JSON đúng schema. targetPath dạng dieu-15.khoan-2.diem-a.",
    user: markdown.slice(0, 200_000),
    jsonSchema: AMEND_OPS_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 8000,
  });
  const llmOps = ((res.json as any)?.ops ?? []) as any[];
  const keyOf = (o: { op: string; targetPath: string }) => `${o.op}|${o.targetPath}`;
  const llmKeys = new Set(llmOps.map((o) => keyOf(o)));
  let agreed = 0;
  for (const o of ruleOps) if (llmKeys.has(keyOf(o))) agreed += 1;
  return { used: true, agreed, disagreed: ruleOps.length - agreed };
}

export interface ExtractOpsSummary {
  documentId: string;
  urn: string;
  ops: number;
  needsLegal: number;
  warnings: string[];
  llm: LlmCrossCheck;
  targets: string[];
  /** Văn bản bị sửa đổi chưa có trong kho -> chưa hợp nhất được. */
  missingTargets: string[];
  consolidateJobIds: string[];
}

/** Chạy trích lệnh sửa đổi cho một văn bản đã có phiên bản gốc trong CSDL. */
export async function extractOpsForDocument(
  documentId: string,
  opts: { enqueueConsolidate?: boolean } = {},
): Promise<ExtractOpsSummary> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new Error(`Không có document ${documentId}`);
  const version = await getOriginalVersion(documentId);
  if (!version?.markdown) throw new Error(`Văn bản ${doc.urn} chưa có phiên bản gốc kèm Markdown`);

  const ctx: ExtractContext = {
    amendingUrn: doc.urn,
    title: doc.title,
    soKyHieu: doc.so_ky_hieu,
    ...(doc.effective_from ? { effectiveFrom: doc.effective_from } : {}),
    ...(doc.issued_date ? { issuedDate: doc.issued_date } : {}),
  };
  const { ops, warnings } = extractOpsFromMarkdown(version.markdown as string, ctx);
  const llm = await crossCheckWithLlm(version.markdown as string, ops);

  // Ghi lại: xóa ops cũ của chính văn bản này để idempotent.
  await sql`DELETE FROM amendment_ops WHERE amending_doc_urn = ${doc.urn}`;

  const rows: AmendOp[] = [];
  let needsLegal = 0;
  for (const o of ops) {
    const exists = await targetNodeExists(o.targetDocUrn, o.targetPath);
    // Nút chèn mới chưa tồn tại là bình thường: kiểm tra nút NEO thay vì nút mới.
    const reviewStatus: AmendOp["reviewStatus"] = exists === false ? "needs_legal" : "pending";
    if (reviewStatus === "needs_legal") {
      needsLegal += 1;
      warnings.push(`Không tìm thấy nút đích ${o.targetPath} trong ${o.targetDocUrn} (${o.amendingLabel})`);
    }
    rows.push({
      id: randomUUID(),
      amendingDocUrn: doc.urn,
      amendingLabel: o.amendingLabel,
      targetDocUrn: o.targetDocUrn,
      targetPath: o.targetPath,
      op: o.op,
      ...(o.payload ? { payload: o.payload } : {}),
      effectiveFrom: o.effectiveFrom,
      ...(o.effectiveTo ? { effectiveTo: o.effectiveTo } : {}),
      ordinal: o.ordinal,
      extraction: "rule",
      confidence: exists === undefined ? o.confidence * 0.9 : o.confidence,
      reviewStatus,
    });
  }
  await saveAmendOps(rows);

  // Hàng đợi duyệt: mỗi lệnh một mục để quản trị viên nội dung đối chiếu.
  for (let i = 0; i < rows.length; i++) {
    await addReview({
      kind: "amend_op",
      refId: rows[i]!.id,
      documentUrn: rows[i]!.targetDocUrn,
      priority: rows[i]!.reviewStatus === "needs_legal" ? 3 : 1,
      payload: {
        op: rows[i]!.op,
        targetPath: rows[i]!.targetPath,
        amendingDocUrn: doc.urn,
        amendingLabel: rows[i]!.amendingLabel,
        evidence: ops[i]!.evidence,
        confidence: rows[i]!.confidence,
      },
    });
  }

  // Quan hệ suy ra từ lệnh: văn bản sửa đổi -> văn bản bị sửa đổi.
  const targets = [...new Set(ops.map((o) => o.targetDocUrn))];
  const relTypeOf = (op: AmendOpKind): string =>
    op === "repeal" ? "bai_bo" : op === "suspend" ? "dinh_chi" : "sua_doi";
  const relSeen = new Set<string>();
  const rels = [] as {
    fromUrn: string;
    toUrn: string;
    type: string;
    effectiveFrom: string;
    source: string;
    confidence: number;
    evidence: unknown;
  }[];
  for (const o of ops) {
    const type = relTypeOf(o.op);
    const key = `${o.targetDocUrn}|${type}`;
    if (relSeen.has(key)) continue;
    relSeen.add(key);
    rels.push({
      fromUrn: doc.urn,
      toUrn: o.targetDocUrn,
      type,
      effectiveFrom: o.effectiveFrom,
      source: "parsed",
      confidence: 0.95,
      evidence: { step: "extract-ops", amendingLabel: o.amendingLabel },
    });
  }
  if (rels.length) await saveRelations(rels);

  // Chỉ hợp nhất văn bản đích ĐÃ có trong kho; văn bản chưa nạp sẽ được
  // ingest.ts kích hoạt hợp nhất khi nó được nạp (tránh job chết oan).
  const consolidateJobIds: string[] = [];
  const missingTargets: string[] = [];
  for (const t of targets) {
    const exists = await getDocumentByUrn(t);
    if (!exists) {
      missingTargets.push(t);
      continue;
    }
    if (opts.enqueueConsolidate !== false) {
      consolidateJobIds.push(await enqueue("consolidate", { targetDocUrn: t }, { priority: 2 }));
    }
  }
  for (const t of missingTargets) {
    warnings.push(`Chưa nạp văn bản bị sửa đổi ${t}; sẽ hợp nhất khi văn bản này được nạp`);
    await addReview({
      kind: "status_change",
      refId: `${doc.urn}->${t}`,
      documentUrn: t,
      priority: 2,
      payload: { step: "extract-ops", reason: "target_not_ingested", amendingDocUrn: doc.urn },
    });
  }

  log.info("Đã trích lệnh sửa đổi", {
    urn: doc.urn,
    ops: rows.length,
    needsLegal,
    warnings: warnings.length,
    llmUsed: llm.used,
  });
  return {
    documentId,
    urn: doc.urn,
    ops: rows.length,
    needsLegal,
    warnings,
    llm,
    targets,
    missingTargets,
    consolidateJobIds,
  };
}
