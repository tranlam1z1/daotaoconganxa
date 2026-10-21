/**
 * Lưu file thô + bảng `source_records`.
 * Layout theo ke-hoach/04 §4, cùng một URI dùng được cho cả R2 lẫn thư mục cục bộ:
 *   raw/{source}/{yyyy}/{doc_type}/{so_ky_hieu_slug}/{hash}.{pdf|docx|html}
 *   raw/{source}/{yyyy}/{doc_type}/{so_ky_hieu_slug}/metadata.json
 * Việc chọn R2 hay thư mục do @qdpl/storage quyết định theo biến môi trường R2_*.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "@qdpl/db";
import { soKyHieuSlug } from "@qdpl/legal-model";
import { localPath, putObject, storageConfig, storageLabel } from "@qdpl/storage";
import { log } from "../log.ts";
import type { FileKind, RawDocMeta, SourceItem } from "./adapters/types.ts";
import { fileHash } from "./dedupe.ts";

const EXT: Record<FileKind, string> = {
  pdf: "pdf",
  docx: "docx",
  doc: "doc",
  html: "html",
  rtf: "rtf",
  xlsx: "xlsx",
  other: "bin",
};

/**
 * Thư mục kho cục bộ. STORAGE_DIR tương đối được tính từ GỐC MONOREPO (không phải cwd)
 * để chạy CLI ở thư mục nào cũng ra cùng một kho.
 */
export function storageRoot(): string {
  return storageConfig().dir;
}

/** Thư mục của một văn bản trong kho thô. */
export function rawDir(opts: { source: string; year: string; docType: string; soKyHieu: string }): string {
  return join("raw", opts.source, opts.year, opts.docType, soKyHieuSlug(opts.soKyHieu) || "khong-so");
}

/**
 * Đường dẫn tuyệt đối trên đĩa của một URI trong kho.
 * Ở chế độ R2 đây là vị trí BẢN SAO cục bộ (có thể chưa tải về) — muốn chắc chắn có tệp
 * thì dùng `ensureLocalCopy` của @qdpl/storage, còn muốn đọc nội dung thì dùng `getObject`.
 */
export function absolutePath(uri: string): string {
  return localPath(uri);
}

export interface StoredFile {
  /** URI tương đối trong kho (giá trị ghi vào source_records.file_uri). */
  uri: string;
  hash: string;
  bytes: number;
  contentType?: string;
}

/** Ghi một file thô vào kho, tên file là hash nội dung (idempotent). */
export async function saveRawFile(opts: {
  dir: string;
  kind: FileKind;
  bytes: Uint8Array;
  contentType?: string;
  /** Ghi đè phần mở rộng (ví dụ "md" cho Markdown nạp tay). */
  ext?: string;
}): Promise<StoredFile> {
  const hash = fileHash(opts.bytes);
  const uri = join(opts.dir, `${hash}.${opts.ext ?? EXT[opts.kind] ?? "bin"}`);
  await putObject(uri, opts.bytes, opts.contentType ? { contentType: opts.contentType } : {});
  return {
    uri,
    hash,
    bytes: opts.bytes.byteLength,
    ...(opts.contentType ? { contentType: opts.contentType } : {}),
  };
}

/** Ghi metadata.json cạnh các file thô. */
export async function saveMetadata(dir: string, metadata: unknown): Promise<string> {
  const uri = join(dir, "metadata.json");
  await putObject(uri, `${JSON.stringify(metadata, null, 2)}\n`, { contentType: "application/json" });
  return uri;
}

export interface SourceRecordInput {
  source: string;
  sourceId: string;
  url: string;
  fileUri?: string | null;
  contentType?: string | null;
  fileHash?: string | null;
  etag?: string | null;
  lastModified?: string | null;
  documentId?: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Ghi/cập nhật `source_records` theo khóa (source, source_id).
 * LƯU Ý: cột `metadata` là jsonb — dùng sql.json, KHÔNG JSON.stringify
 * (nếu không giá trị bị mã hóa hai lần và đọc ra thành chuỗi).
 */
export async function upsertSourceRecord(input: SourceRecordInput): Promise<string> {
  const [row] = await sql`
    INSERT INTO source_records (source, source_id, url, document_id, file_uri, content_type,
                                file_hash, etag, last_modified, metadata, fetched_at)
    VALUES (${input.source}, ${input.sourceId}, ${input.url}, ${input.documentId ?? null},
            ${input.fileUri ?? null}, ${input.contentType ?? null}, ${input.fileHash ?? null},
            ${input.etag ?? null}, ${input.lastModified ?? null}, ${sql.json(input.metadata as any)}, now())
    ON CONFLICT (source, source_id) DO UPDATE SET
      url = EXCLUDED.url,
      document_id = COALESCE(EXCLUDED.document_id, source_records.document_id),
      file_uri = COALESCE(EXCLUDED.file_uri, source_records.file_uri),
      content_type = COALESCE(EXCLUDED.content_type, source_records.content_type),
      file_hash = COALESCE(EXCLUDED.file_hash, source_records.file_hash),
      etag = EXCLUDED.etag,
      last_modified = EXCLUDED.last_modified,
      metadata = EXCLUDED.metadata,
      fetched_at = now()
    RETURNING id`;
  return (row as any).id as string;
}

export async function linkSourceRecordToDocument(recordId: string, documentId: string): Promise<void> {
  await sql`UPDATE source_records SET document_id = ${documentId} WHERE id = ${recordId}`;
}

/** Metadata thô đã chuẩn hóa, ghi kèm vào source_records và metadata.json. */
export function buildMetadata(
  item: SourceItem,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    source: item.source,
    sourceId: item.sourceId,
    url: item.url,
    meta: item.meta satisfies RawDocMeta,
    files: item.files,
    relations: item.relations,
    notes: item.notes ?? [],
    fetchedAt: new Date().toISOString(),
    ...extra,
  };
}

export function yearOf(meta: RawDocMeta): string {
  return (meta.issuedDate ?? meta.gazetteDate ?? new Date().toISOString()).slice(0, 4);
}

export async function ensureStorageRoot(): Promise<void> {
  const root = storageRoot();
  await mkdir(root, { recursive: true });
  log.debug("Kho file thô", { root, che_do: storageLabel() });
}
