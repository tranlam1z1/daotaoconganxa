/**
 * Đối chiếu hai văn bản khác nhau (văn bản bị thay thế ↔ văn bản thay thế).
 * Trả lời câu hỏi thực tế: "quy định này ở văn bản mới nằm ở đâu?"
 *
 * Không dùng embedding: ghép cặp bằng độ tương đồng tiêu đề điều và nội dung
 * (n-gram ký tự đã bỏ dấu + trùng thuật ngữ), rồi giải bài toán ghép cặp tham lam
 * có ràng buộc một-một. Kết quả luôn cần biên tập viên xác nhận.
 * Xem ke-hoach/06-cau-truc-va-hop-nhat.md §5.
 */
import { walk } from "./parser.ts";
import type { LegalNode } from "./types.ts";

export interface AlignedPair {
  /** Path bên văn bản cũ; rỗng nghĩa là nội dung mới hoàn toàn. */
  fromPath: string;
  fromLabel: string;
  fromHeading?: string;
  /** Path bên văn bản mới; rỗng nghĩa là nội dung đã bị bỏ. */
  toPath: string;
  toLabel: string;
  toHeading?: string;
  score: number;
  kind: "khop" | "moi" | "bo" | "nghi_ngo";
}

export interface AlignOptions {
  /** Ngưỡng coi là khớp chắc chắn. */
  strongThreshold?: number;
  /** Ngưỡng dưới mức này thì coi như không khớp. */
  weakThreshold?: number;
  /** Chỉ đối chiếu ở cấp này (mặc định "dieu"). */
  level?: "dieu" | "khoan";
}

/** Bỏ dấu tiếng Việt và chuẩn hóa để so khớp. */
export function foldVietnamese(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const t = ` ${foldVietnamese(s)} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Từ hiếm mang nhiều thông tin hơn từ phổ biến; dùng làm trọng số. */
function contentWords(s: string): Set<string> {
  const STOP = new Set([
    "va",
    "cua",
    "cac",
    "trong",
    "theo",
    "quy",
    "dinh",
    "duoc",
    "co",
    "khi",
    "voi",
    "tai",
    "nay",
    "do",
    "cho",
    "tu",
    "den",
    "hoac",
    "la",
    "mot",
    "so",
    "ve",
    "thuc",
    "hien",
  ]);
  return new Set(
    foldVietnamese(s)
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function similarity(a: LegalNode, b: LegalNode): number {
  const headA = a.heading ?? "";
  const headB = b.heading ?? "";
  const headScore = headA && headB ? jaccard(trigrams(headA), trigrams(headB)) : 0;
  const bodyA = fullText(a);
  const bodyB = fullText(b);
  const bodyScore = jaccard(trigrams(bodyA.slice(0, 2000)), trigrams(bodyB.slice(0, 2000)));
  const wordScore = jaccard(contentWords(`${headA} ${bodyA}`), contentWords(`${headB} ${bodyB}`));
  // Tiêu đề điều là tín hiệu mạnh nhất trong VBQPPL Việt Nam.
  return 0.5 * headScore + 0.2 * bodyScore + 0.3 * wordScore;
}

function fullText(node: LegalNode): string {
  const parts: string[] = [];
  walk(node, (n) => {
    if (n.text) parts.push(n.text);
  });
  return parts.join(" ");
}

function collect(root: LegalNode, level: "dieu" | "khoan"): LegalNode[] {
  const out: LegalNode[] = [];
  walk(root, (n) => {
    if (n.kind === level) out.push(n);
  });
  return out;
}

/**
 * Ghép cặp điều giữa hai văn bản.
 * Thuật toán: tính ma trận điểm, sắp giảm dần, lấy tham lam với ràng buộc một-một
 * (đủ tốt cho quy mô vài trăm điều và cho kết quả ổn định, dễ giải thích cho biên tập viên).
 */
export function alignDocuments(
  oldRoot: LegalNode,
  newRoot: LegalNode,
  opts: AlignOptions = {},
): AlignedPair[] {
  const strong = opts.strongThreshold ?? 0.45;
  const weak = opts.weakThreshold ?? 0.2;
  const level = opts.level ?? "dieu";

  const olds = collect(oldRoot, level);
  const news = collect(newRoot, level);

  const candidates: Array<{ i: number; j: number; score: number }> = [];
  for (let i = 0; i < olds.length; i++) {
    for (let j = 0; j < news.length; j++) {
      const score = similarity(olds[i]!, news[j]!);
      if (score >= weak) candidates.push({ i, j, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const usedOld = new Set<number>();
  const usedNew = new Set<number>();
  const pairs: AlignedPair[] = [];
  for (const c of candidates) {
    if (usedOld.has(c.i) || usedNew.has(c.j)) continue;
    usedOld.add(c.i);
    usedNew.add(c.j);
    const o = olds[c.i]!;
    const n = news[c.j]!;
    pairs.push({
      fromPath: o.path,
      fromLabel: o.label,
      fromHeading: o.heading,
      toPath: n.path,
      toLabel: n.label,
      toHeading: n.heading,
      score: Number(c.score.toFixed(3)),
      kind: c.score >= strong ? "khop" : "nghi_ngo",
    });
  }
  for (let i = 0; i < olds.length; i++) {
    if (usedOld.has(i)) continue;
    const o = olds[i]!;
    pairs.push({
      fromPath: o.path,
      fromLabel: o.label,
      fromHeading: o.heading,
      toPath: "",
      toLabel: "",
      score: 0,
      kind: "bo",
    });
  }
  for (let j = 0; j < news.length; j++) {
    if (usedNew.has(j)) continue;
    const n = news[j]!;
    pairs.push({
      fromPath: "",
      fromLabel: "",
      toPath: n.path,
      toLabel: n.label,
      toHeading: n.heading,
      score: 0,
      kind: "moi",
    });
  }

  // Sắp theo thứ tự văn bản cũ, phần mới xếp cuối.
  return pairs.sort((a, b) => {
    const na = numOf(a.fromPath);
    const nb = numOf(b.fromPath);
    if (na !== nb) return na - nb;
    return numOf(a.toPath) - numOf(b.toPath);
  });
}

function numOf(path: string): number {
  if (!path) return Number.MAX_SAFE_INTEGER;
  const m = /dieu-(\d+)/.exec(path);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER - 1;
}

/** Bảng tra nhanh: path cũ -> path mới, chỉ gồm cặp đủ tin cậy. */
export function alignmentMap(pairs: AlignedPair[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of pairs) {
    if (p.kind === "khop" && p.fromPath && p.toPath) m.set(p.fromPath, p.toPath);
  }
  return m;
}
