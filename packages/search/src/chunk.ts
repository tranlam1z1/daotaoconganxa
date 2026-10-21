/**
 * Chia nhỏ nội dung văn bản thành chunk để nhúng vector.
 * Quy tắc theo ke-hoach/07-tim-kiem-rag.md §2:
 *  - Đơn vị cơ sở là KHOẢN, có tiền tố ngữ cảnh (tên văn bản > chương > điều > khoản).
 *  - Điểm ngắn gộp vào khoản; khoản dài (> 512 token) tách theo điểm với overlap 10–15%.
 *  - Bảng và công thức là chunk riêng, gồm caption + nội dung + diễn giải nếu có.
 *  - Điều không có khoản (thân trực tiếp) tự nó là một chunk.
 */

/** Giới hạn token của một chunk (bge-m3 dùng 512 cho đoạn ngắn). */
export const MAX_TOKENS = 512;
/** Tỉ lệ chồng lấn khi phải tách khoản dài. */
export const OVERLAP_RATIO = 0.12;

/** Hàng nút lấy từ bảng `nodes` (chỉ các cột cần cho việc chia chunk). */
export interface ChunkNodeRow {
  id: string;
  path: string;
  full_path: string;
  kind: string;
  label: string;
  heading: string | null;
  text_md: string;
  text_plain: string;
  context_path: string | null;
  ordinal: number;
}

export interface Chunk {
  nodeId: string;
  chunkNo: number;
  text: string;
  /** Path nút gốc của chunk, để tra ngược. */
  path: string;
  kind: string;
}

/**
 * Ước lượng số token cho tiếng Việt.
 * Kinh nghiệm với bộ tokenizer đa ngữ: ~3.2 ký tự/token với văn bản tiếng Việt có dấu.
 * Chỉ dùng để quyết định có tách chunk hay không nên sai số nhỏ là chấp nhận được.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}

/** Loại nút được coi là "chunk riêng" bất kể độ dài. */
const STANDALONE = new Set(["bang", "cong_thuc", "hinh"]);

function cleanText(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Tiền tố ngữ cảnh của chunk. Ưu tiên context_path đã tính sẵn khi lưu nút. */
function prefixOf(node: ChunkNodeRow, docTitle: string, byPath: Map<string, ChunkNodeRow>): string {
  if (node.context_path) return node.context_path;
  const chain: string[] = [docTitle];
  const segs = node.path.split(".");
  for (let i = 1; i <= segs.length; i++) {
    const p = segs.slice(0, i).join(".");
    const anc = byPath.get(p);
    if (!anc) continue;
    chain.push(anc.heading ? `${anc.label}. ${anc.heading}` : anc.label);
  }
  return chain.join(" > ");
}

/** Nội dung đầy đủ của một nút gồm cả con cháu (điểm gộp vào khoản). */
function bodyOf(node: ChunkNodeRow, children: ChunkNodeRow[]): string {
  const parts: string[] = [];
  if (node.heading) parts.push(`${node.label}. ${node.heading}`);
  else if (node.label && node.kind !== "dieu") parts.push(node.label);
  if (node.text_md) parts.push(node.text_md);
  for (const c of children) {
    if (STANDALONE.has(c.kind)) continue; // bảng/công thức có chunk riêng
    parts.push(`${c.label} ${c.text_md}`.trim());
  }
  return cleanText(parts.join("\n"));
}

/**
 * Tách một khoản quá dài theo ranh giới điểm, giữ overlap OVERLAP_RATIO.
 * Mỗi mảnh đều được gắn lại tiền tố ngữ cảnh ở bước gọi.
 */
export function splitLong(units: string[], maxTokens = MAX_TOKENS): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let curTokens = 0;
  for (const u of units) {
    const t = estimateTokens(u);
    if (curTokens + t > maxTokens && cur.length > 0) {
      out.push(cur.join("\n"));
      // Chồng lấn: giữ lại phần cuối của mảnh trước, khoảng OVERLAP_RATIO số token.
      const keep: string[] = [];
      let kept = 0;
      for (let i = cur.length - 1; i >= 0; i--) {
        const kt = estimateTokens(cur[i]!);
        if (kept + kt > maxTokens * OVERLAP_RATIO && keep.length > 0) break;
        keep.unshift(cur[i]!);
        kept += kt;
      }
      cur = keep;
      curTokens = kept;
    }
    // Đơn vị đơn lẻ dài hơn cả giới hạn: cắt cứng theo ký tự.
    if (t > maxTokens) {
      if (cur.length) {
        out.push(cur.join("\n"));
        cur = [];
        curTokens = 0;
      }
      const size = Math.floor(maxTokens * 3.2);
      const step = Math.max(1, Math.floor(size * (1 - OVERLAP_RATIO)));
      for (let i = 0; i < u.length; i += step) out.push(u.slice(i, i + size));
      continue;
    }
    cur.push(u);
    curTokens += t;
  }
  if (cur.length) out.push(cur.join("\n"));
  return out.filter((s) => s.trim().length > 0);
}

/**
 * Sinh danh sách chunk cho toàn bộ nút của một phiên bản.
 * `nodes` phải là toàn bộ nút của phiên bản, sắp theo `ordinal`.
 */
export function buildChunks(nodes: ChunkNodeRow[], docTitle: string): Chunk[] {
  const byPath = new Map<string, ChunkNodeRow>();
  for (const n of nodes) if (n.path) byPath.set(n.path, n);

  const childrenOf = new Map<string, ChunkNodeRow[]>();
  for (const n of nodes) {
    if (!n.path) continue;
    const parent = n.path.split(".").slice(0, -1).join(".");
    if (!parent) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(n);
    childrenOf.set(parent, list);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.ordinal - b.ordinal);

  const chunks: Chunk[] = [];
  const covered = new Set<string>(); // path đã nằm trong chunk của cha

  for (const node of nodes) {
    if (!node.path) continue;

    // Bảng / công thức / hình: chunk riêng, kèm caption và ngữ cảnh điều.
    if (STANDALONE.has(node.kind)) {
      const prefix = prefixOf(node, docTitle, byPath);
      const caption = node.heading ? `${node.label}. ${node.heading}` : node.label;
      const body = cleanText(node.text_md || node.text_plain);
      const text = `${prefix}\n${caption}\n${body}`.trim();
      if (body) chunks.push({ nodeId: node.id, chunkNo: 0, text, path: node.path, kind: node.kind });
      continue;
    }

    if (node.kind !== "khoan" && node.kind !== "dieu") continue;
    if (node.kind === "dieu" && (childrenOf.get(node.path) ?? []).some((c) => c.kind === "khoan")) {
      // Điều có khoản: chunk nằm ở cấp khoản, điều chỉ đóng vai trò ngữ cảnh.
      continue;
    }
    if (covered.has(node.path)) continue;

    const kids = (childrenOf.get(node.path) ?? []).filter((c) => c.kind === "diem" || c.kind === "doan");
    for (const k of kids) covered.add(k.path);

    const prefix = prefixOf(node, docTitle, byPath);
    const body = bodyOf(node, kids);
    if (!body) continue;
    const full = `${prefix}\n${body}`;

    if (estimateTokens(full) <= MAX_TOKENS) {
      chunks.push({ nodeId: node.id, chunkNo: 0, text: full, path: node.path, kind: node.kind });
      continue;
    }

    // Khoản dài: tách theo điểm, mỗi mảnh gắn lại tiền tố ngữ cảnh.
    const head = node.heading ? `${node.label}. ${node.heading}` : node.label;
    const units = [
      cleanText(`${head} ${node.text_md}`),
      ...kids.map((c) => cleanText(`${c.label} ${c.text_md}`)),
    ].filter(Boolean);
    const parts = splitLong(units);
    parts.forEach((p, i) => {
      chunks.push({ nodeId: node.id, chunkNo: i, text: `${prefix}\n${p}`, path: node.path, kind: node.kind });
    });
  }

  return chunks;
}
