/**
 * Sinh vector nhúng (embedding) cho chunk văn bản.
 *
 * Hai chế độ, chọn bằng biến môi trường EMBEDDING_PROVIDER:
 *  - "tei"   : gọi HTTP tới server text-embeddings-inference (bge-m3) ở EMBEDDING_URL.
 *  - "local" : (mặc định) sinh vector TẤT ĐỊNH bằng hashing trick trên n-gram của văn bản
 *              đã bỏ dấu. Không cần GPU, chạy được trong test và môi trường dev.
 *
 * Chế độ local không phải là mô hình ngữ nghĩa thật, nhưng có tính chất cần thiết cho
 * kiểm thử: cùng đầu vào -> cùng vector; hai đoạn dùng chung nhiều từ/âm tiết -> cosine cao hơn.
 * Xem ke-hoach/07-tim-kiem-rag.md §2.
 */

export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM ?? 1024);

export type EmbeddingMode = "local" | "tei";

export function embeddingMode(): EmbeddingMode {
  const m = (process.env.EMBEDDING_PROVIDER ?? "local").toLowerCase();
  return m === "tei" ? "tei" : "local";
}

/** Tên mô hình ghi vào cột embeddings.model, để biết vector sinh bởi cái gì. */
export function embeddingModel(): string {
  return embeddingMode() === "tei"
    ? (process.env.EMBEDDING_MODEL ?? "BAAI/bge-m3")
    : `local-hash-${EMBEDDING_DIM}`;
}

/** Bỏ dấu tiếng Việt, hạ chữ thường, chuẩn hóa khoảng trắng. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** FNV-1a 32 bit — hàm băm nhanh, tất định, không phụ thuộc nền tảng. */
function fnv1a(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Sinh đặc trưng cho hashing trick:
 *  - unigram (âm tiết)      trọng số 1.0  — bắt từ khóa trùng nhau
 *  - bigram (2 âm tiết liền) trọng số 0.6 — bắt cụm từ ("ngan sach nha nuoc")
 *  - 3-gram ký tự trong từ   trọng số 0.2 — chịu được gõ sai/biến thể
 */
function features(text: string): Map<string, number> {
  const words = fold(text).split(" ").filter(Boolean);
  const out = new Map<string, number>();
  const add = (key: string, w: number) => out.set(key, (out.get(key) ?? 0) + w);
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    add(`u:${w}`, 1);
    if (i + 1 < words.length) add(`b:${w} ${words[i + 1]}`, 0.6);
    if (w.length >= 4) {
      for (let j = 0; j + 3 <= w.length; j++) add(`c:${w.slice(j, j + 3)}`, 0.2);
    }
  }
  return out;
}

/** Vector tất định, chuẩn hóa L2, độ dài EMBEDDING_DIM. */
export function localEmbed(text: string, dim = EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const [key, weight] of features(text)) {
    const h = fnv1a(key);
    const idx = h % dim;
    // Bit cao quyết định dấu -> giảm sai lệch do đụng độ băm (signed hashing).
    const sign = (h & 0x80000000) !== 0 ? -1 : 1;
    // sqrt(tf): giảm ảnh hưởng của từ lặp nhiều lần trong đoạn dài.
    vec[idx]! += sign * Math.sqrt(weight);
  }
  return l2normalize(vec);
}

export function l2normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum);
  if (!norm || !Number.isFinite(norm)) {
    // Văn bản rỗng: trả vector đơn vị cố định để tránh chia cho 0 và NaN trong pgvector.
    const z = new Array<number>(vec.length).fill(0);
    z[0] = 1;
    return z;
  }
  return vec.map((v) => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot;
}

interface TeiItem {
  embedding?: number[];
}

/** Gọi server TEI. Chấp nhận cả dạng trả về [[...]] lẫn [{embedding: [...]}]. */
async function teiEmbed(texts: string[]): Promise<number[][]> {
  const url = process.env.EMBEDDING_URL ?? "http://127.0.0.1:8080";
  const res = await fetch(`${url.replace(/\/$/, "")}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inputs: texts, normalize: true, truncate: true }),
  });
  if (!res.ok) {
    throw new Error(`Server embedding trả lỗi ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("Server embedding trả về dữ liệu không hợp lệ");
  const vectors = data.map((row): number[] => {
    if (Array.isArray(row)) return row as number[];
    const item = row as TeiItem;
    if (Array.isArray(item.embedding)) return item.embedding;
    throw new Error("Server embedding trả về phần tử không phải vector");
  });
  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIM) {
      throw new Error(`Chiều vector ${v.length} khác với EMBEDDING_DIM=${EMBEDDING_DIM}`);
    }
  }
  return vectors.map(l2normalize);
}

/** Nhúng một lô văn bản. Luôn trả về đúng số lượng vector như đầu vào. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (embeddingMode() === "tei") return await teiEmbed(texts);
  return texts.map((t) => localEmbed(t));
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  if (!v) throw new Error("Không sinh được vector nhúng");
  return v;
}

/** Chuỗi literal cho pgvector: "[0.1,0.2,…]". */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.map((v) => (Number.isFinite(v) ? v.toFixed(6) : "0")).join(",")}]`;
}
