/**
 * Tải và lưu MỘT văn bản từ nguồn: fetchItem -> tải file -> khử trùng lặp ->
 * ghi kho raw/ + `source_records`.
 *
 * Tách khỏi `crawl.ts` để cả hai đường chạy dùng chung đúng một logic:
 *  - `crawl()` (một lượt tuần tự, CLI `crawl`)
 *  - worker BullMQ `qdpl:fetch` (mỗi văn bản một job, có giới hạn tốc độ và thử lại)
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { errText, log } from "../log.ts";
import { getAdapter } from "./adapters/index.ts";
import type { RawDocMeta, SourceAdapter, SourceFile, SourceItem } from "./adapters/types.ts";
import { contentKey, DedupeIndex, fileHash, findSourceRecord, findSourceRecordByHash } from "./dedupe.ts";
import { fetcher, RobotsDisallowedError } from "./fetcher.ts";
import { normalizeDocType } from "./normalize.ts";
import {
  buildMetadata,
  ensureStorageRoot,
  rawDir,
  saveMetadata,
  saveRawFile,
  upsertSourceRecord,
  yearOf,
} from "./store.ts";

export interface CrawledItem {
  sourceId: string;
  url: string;
  soKyHieu: string;
  docType: string;
  title: string;
  issuedDate?: string;
  effectiveFrom?: string;
  issuer?: string;
  signer?: string;
  gazetteNo?: string;
  gazetteDate?: string;
  /** File đã tải và lưu vào kho. Ở chế độ --dry-run luôn rỗng. */
  files: { kind: string; url: string; hash?: string; uri?: string; bytes?: number }[];
  /** File phát hiện được ở nguồn (kể cả khi không tải). */
  discoveredFiles: { kind: string; url: string }[];
  recordId?: string;
  duplicateOf?: string;
  notes?: string[];
}

export interface FetchItemOptions {
  /** Adapter đã dựng, hoặc id của nó. */
  adapter: SourceAdapter | string;
  /** sourceId hoặc URL trang chi tiết. */
  target: string;
  /** Thuộc tính đọc được ở trang danh sách, dùng để bổ khuyết. */
  preview?: Partial<RawDocMeta>;
  /** File đã thấy ở trang danh sách (dùng khi trang chi tiết không liệt kê). */
  discoveredFiles?: SourceFile[];
  skipFiles?: boolean;
  dryRun?: boolean;
  /** Chỉ số khử trùng lặp dùng chung trong một lượt crawl. */
  dedupe?: DedupeIndex;
}

export interface FetchItemResult {
  crawled: CrawledItem;
  recordId?: string;
  /** Trùng với mục đã xử lý trong cùng lượt -> không lưu. */
  duplicateKey?: string;
  blockedByRobots: number;
  bytesDownloaded: number;
  errors: { url: string; error: string }[];
}

/** Phần mở rộng của file văn bản dạng chữ (lưu nguyên, chuyển đổi thẳng trong TS). */
const TEXT_EXT = /\.(md|markdown|txt)(\?|#|$)/i;

/** Chỉ tải các định dạng dùng được cho pipeline chuyển đổi. */
export function downloadable(files: SourceFile[]): SourceFile[] {
  const wanted = files.filter(
    (f) => f.kind === "docx" || f.kind === "pdf" || f.kind === "doc" || TEXT_EXT.test(f.url),
  );
  // Ưu tiên DOCX (chuyển đổi thẳng trong TS), rồi DOC, rồi PDF (đẩy sang services/docproc).
  return wanted.sort((a, b) => rank(a.kind) - rank(b.kind));
}
function rank(kind: string): number {
  return kind === "docx" ? 0 : kind === "doc" ? 1 : 2;
}

/**
 * Loại file để ghi vào metadata: với .md/.txt giữ đúng phần mở rộng, vì bước
 * `convert` định tuyến theo loại này (md -> chuyển thẳng, pdf -> docproc).
 */
export function storeKindOf(f: SourceFile): string {
  const m = TEXT_EXT.exec(f.url) ?? TEXT_EXT.exec(f.fileName ?? "");
  return m?.[1]?.toLowerCase() ?? f.kind;
}

/** Đọc nội dung file: hỗ trợ cả `file://` (fixture, nạp tay) lẫn HTTP(S). */
async function readFileOrFetch(
  url: string,
  referer: string,
  etag?: string,
): Promise<{ bytes: Uint8Array; contentType?: string; notModified?: boolean; ok: boolean; status: number }> {
  if (url.startsWith("file://")) {
    const bytes = new Uint8Array(await readFile(fileURLToPath(url)));
    return { bytes, ok: true, status: 200 };
  }
  const res = await fetcher.fetch(url, { accept: "*/*", referer, ...(etag ? { etag } : {}) });
  return {
    bytes: res.bytes,
    ...(res.contentType ? { contentType: res.contentType } : {}),
    ...(res.notModified ? { notModified: true } : {}),
    ok: res.ok,
    status: res.status,
  };
}

/** Bỏ các trường rỗng để không ghi đè giá trị đã có từ trang danh sách. */
export function stripEmpty<T extends Record<string, any>>(o: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

export async function fetchAndStoreItem(opts: FetchItemOptions): Promise<FetchItemResult> {
  const adapter = typeof opts.adapter === "string" ? getAdapter(opts.adapter) : opts.adapter;
  const dedupe = opts.dedupe ?? new DedupeIndex();
  const result: FetchItemResult = {
    crawled: {} as CrawledItem,
    blockedByRobots: 0,
    bytesDownloaded: 0,
    errors: [],
  };

  const existing = opts.dryRun ? undefined : await findSourceRecord(adapter.id, opts.target);
  const item: SourceItem = await adapter.fetchItem(opts.target);
  const meta = { ...(opts.preview ?? {}), ...stripEmpty(item.meta) } as SourceItem["meta"];
  item.meta = meta;
  if (opts.discoveredFiles?.length && !item.files.length) item.files = opts.discoveredFiles;

  const dt = normalizeDocType({ soKyHieu: meta.soKyHieu, typeName: meta.typeName, title: meta.title });
  const crawled: CrawledItem = {
    sourceId: item.sourceId,
    url: item.url,
    soKyHieu: meta.soKyHieu,
    docType: dt.docType,
    title: meta.title,
    ...(meta.issuedDate ? { issuedDate: meta.issuedDate } : {}),
    ...(meta.effectiveFrom ? { effectiveFrom: meta.effectiveFrom } : {}),
    ...(meta.issuer ? { issuer: meta.issuer } : {}),
    ...(meta.signer ? { signer: meta.signer } : {}),
    ...(meta.gazetteNo ? { gazetteNo: meta.gazetteNo } : {}),
    ...(meta.gazetteDate ? { gazetteDate: meta.gazetteDate } : {}),
    files: [],
    discoveredFiles: item.files.map((f) => ({ kind: f.kind, url: f.url })),
    ...(item.notes?.length ? { notes: item.notes } : {}),
  };
  result.crawled = crawled;

  const key = contentKey({ soKyHieu: meta.soKyHieu, issuer: meta.issuer, issuedDate: meta.issuedDate });
  if (dedupe.seenKey(key)) {
    crawled.duplicateOf = key;
    result.duplicateKey = key;
    log.info("Bỏ qua trùng lặp trong cùng lượt", { key, url: item.url });
    return result;
  }

  if (opts.dryRun) return result;

  await ensureStorageRoot();
  const dir = rawDir({
    source: adapter.id,
    year: yearOf(meta),
    docType: dt.docType,
    soKyHieu: meta.soKyHieu || item.sourceId,
  });

  // 1) Lưu HTML trang chi tiết làm bằng chứng nguồn.
  if (item.rawHtml) {
    const stored = await saveRawFile({
      dir,
      kind: "html",
      bytes: new TextEncoder().encode(item.rawHtml),
      contentType: "text/html",
    });
    crawled.files.push({
      kind: "html",
      url: item.url,
      hash: stored.hash,
      uri: stored.uri,
      bytes: stored.bytes,
    });
  }

  // 2) Tải file đính kèm.
  if (!opts.skipFiles) {
    for (const f of downloadable(item.files)) {
      try {
        const kind = storeKindOf(f);
        // Chỉ gửi If-None-Match khi bản ghi cũ đúng là file cùng loại (nếu không
        // nguồn trả 304 cho file khác và ta tưởng là không đổi).
        const etag = existing?.etag && existing.file_uri?.endsWith(f.kind) ? existing.etag : undefined;
        const res = await readFileOrFetch(f.url, item.url, etag);
        if (res.notModified) {
          log.info("File không đổi (304), bỏ tải lại", { url: f.url });
          continue;
        }
        if (!res.ok) {
          result.errors.push({ url: f.url, error: `HTTP ${res.status}` });
          continue;
        }
        const hash = fileHash(res.bytes);
        if (dedupe.seenHash(hash)) continue;
        const dup = await findSourceRecordByHash(hash);
        const stored = await saveRawFile({
          dir,
          kind: f.kind,
          bytes: res.bytes,
          ...(res.contentType ? { contentType: res.contentType } : {}),
          ...(kind !== f.kind ? { ext: kind } : {}),
        });
        crawled.files.push({ kind, url: f.url, hash: stored.hash, uri: stored.uri, bytes: stored.bytes });
        result.bytesDownloaded += stored.bytes;
        if (dup && dup.source_id !== item.sourceId) {
          log.info("File trùng hash với bản ghi nguồn đã có", { hash, existing: dup.source_id });
        }
      } catch (e) {
        if (e instanceof RobotsDisallowedError) {
          result.blockedByRobots += 1;
          continue;
        }
        result.errors.push({ url: f.url, error: errText(e) });
      }
    }
  }

  const metadata = buildMetadata(item, {
    docType: dt.docType,
    rank: dt.rank,
    storedFiles: crawled.files,
  });
  await saveMetadata(dir, metadata);

  const primary =
    crawled.files.find((f) => f.kind === "docx") ??
    crawled.files.find((f) => f.kind === "pdf") ??
    crawled.files.find((f) => f.kind !== "html") ??
    crawled.files[0];
  const recordId = await upsertSourceRecord({
    source: adapter.id,
    sourceId: item.sourceId,
    url: item.url,
    fileUri: primary?.uri ?? null,
    contentType: primary?.kind ?? null,
    fileHash: primary?.hash ?? null,
    etag: item.etag ?? existing?.etag ?? null,
    lastModified: item.lastModified ?? null,
    metadata,
  });
  crawled.recordId = recordId;
  result.recordId = recordId;

  log.info("Đã lưu văn bản nguồn", {
    source: adapter.id,
    soKyHieu: meta.soKyHieu,
    docType: dt.docType,
    files: crawled.files.length,
  });
  return result;
}
