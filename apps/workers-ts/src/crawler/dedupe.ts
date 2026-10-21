/**
 * Khử trùng lặp hai lớp (ke-hoach/04 §3):
 *  1) theo hash nội dung file  -> cùng một file đã tải trước đó;
 *  2) theo (số ký hiệu + cơ quan + ngày ban hành) -> cùng một văn bản ở nguồn khác.
 */
import { sql } from "@qdpl/db";
import { normalizeAgency, normalizeSoKyHieu, normalizeText } from "./normalize.ts";

/** SHA-256 hex của nội dung file (dùng cho tên file trong kho và khử trùng lặp). */
export function fileHash(bytes: Uint8Array | ArrayBuffer | string): string {
  const h = new Bun.CryptoHasher("sha256");
  h.update(bytes as any);
  return h.digest("hex");
}

/**
 * Khóa nội dung, bất biến với khác biệt hình thức giữa các nguồn.
 * Dùng tên cơ quan HIỆN HÀNH để hai nguồn ghi tên cũ/mới vẫn trùng khóa.
 */
export function contentKey(meta: {
  soKyHieu: string;
  issuer?: string | null;
  issuedDate?: string | null;
}): string {
  const sk = normalizeSoKyHieu(meta.soKyHieu);
  const ag = normalizeAgency(meta.issuer ?? "");
  const issuer = (ag.currentName ?? ag.name ?? "").toLowerCase();
  const date = meta.issuedDate ?? "";
  return `${sk}|${issuer}|${date}`;
}

/** Bộ nhớ tạm trong một lượt crawl, tránh tải trùng trong cùng tiến trình. */
export class DedupeIndex {
  private hashes = new Set<string>();
  private keys = new Set<string>();

  seenHash(hash: string): boolean {
    if (this.hashes.has(hash)) return true;
    this.hashes.add(hash);
    return false;
  }

  seenKey(key: string): boolean {
    if (this.keys.has(key)) return true;
    this.keys.add(key);
    return false;
  }

  get size(): number {
    return this.hashes.size + this.keys.size;
  }
}

export interface ExistingSourceRecord {
  id: string;
  source: string;
  source_id: string;
  url: string;
  file_hash: string | null;
  etag: string | null;
  last_modified: string | null;
  document_id: string | null;
  file_uri: string | null;
}

/** Bản ghi nguồn đã có theo khóa (source, source_id) — để gửi ETag/If-Modified-Since. */
export async function findSourceRecord(
  source: string,
  sourceId: string,
): Promise<ExistingSourceRecord | undefined> {
  const rows = await sql`
    SELECT id, source, source_id, url, file_hash, etag, last_modified, document_id, file_uri
    FROM source_records WHERE source = ${source} AND source_id = ${sourceId} LIMIT 1`;
  return rows[0] as ExistingSourceRecord | undefined;
}

/** Bất kỳ bản ghi nguồn nào (kể cả nguồn khác) có cùng hash file. */
export async function findSourceRecordByHash(hash: string): Promise<ExistingSourceRecord | undefined> {
  const rows = await sql`
    SELECT id, source, source_id, url, file_hash, etag, last_modified, document_id, file_uri
    FROM source_records WHERE file_hash = ${hash} LIMIT 1`;
  return rows[0] as ExistingSourceRecord | undefined;
}

/**
 * Tìm văn bản đã có theo (số ký hiệu + cơ quan + ngày ban hành).
 * So khớp cơ quan nới lỏng: chỉ cần một trong hai bên thiếu tên là bỏ qua điều kiện.
 */
export async function findDocumentByContentKey(meta: {
  soKyHieu: string;
  issuer?: string | null;
  issuedDate?: string | null;
}): Promise<{ id: string; urn: string; issuer_name: string | null } | undefined> {
  const sk = normalizeSoKyHieu(meta.soKyHieu);
  const rows = await sql`
    SELECT id, urn, issuer_name, issued_date FROM documents
    WHERE so_ky_hieu = ${sk}
      AND (${meta.issuedDate ?? null}::date IS NULL OR issued_date IS NULL
           OR issued_date = ${meta.issuedDate ?? null}::date)`;
  if (!rows.length) return undefined;
  const wanted = normalizeAgency(meta.issuer ?? "").currentName;
  if (!wanted) return rows[0] as any;
  const hit =
    rows.find((r: any) => {
      const got = normalizeAgency(r.issuer_name ?? "").currentName;
      return !got || !wanted || got === wanted;
    }) ?? rows[0];
  return hit as any;
}

/** So sánh hai tiêu đề đã chuẩn hóa (phát hiện nguồn ghi khác nhau chút ít). */
export function titleKey(title: string): string {
  return (
    normalizeText(title)
      .toLowerCase()
      // đ/Đ là chữ cái riêng, NFD không tách được dấu -> phải thay tay.
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}
