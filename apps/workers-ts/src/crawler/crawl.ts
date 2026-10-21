/**
 * Điều phối một lượt crawl tuần tự: discover -> fetchItem -> tải file -> khử trùng lặp
 * -> lưu kho + source_records -> đẩy job `ingest` (bảng `jobs` của Postgres).
 *
 * Phần việc cho TỪNG văn bản nằm ở `fetch-item.ts` để worker BullMQ (`qdpl:fetch`)
 * dùng lại đúng logic này. Với việc nạp kho dài ngày, hãy dùng đường BullMQ
 * (`bull backfill` + `bull worker`) thay cho hàm này — xem README §7.
 */
import { enqueue } from "@qdpl/db";
import { errText, log } from "../log.ts";
import { getAdapter } from "./adapters/index.ts";
import { DedupeIndex } from "./dedupe.ts";
import { type CrawledItem, fetchAndStoreItem } from "./fetch-item.ts";
import { fetcher, RobotsDisallowedError } from "./fetcher.ts";
import { ensureStorageRoot } from "./store.ts";

export type { CrawledItem } from "./fetch-item.ts";

export interface CrawlOptions {
  adapter: string;
  type?: string;
  limit?: number;
  page?: number;
  since?: string;
  /** Bỏ qua tải file đính kèm (chỉ lấy thuộc tính). */
  skipFiles?: boolean;
  /** Không ghi CSDL, không tải file — chỉ đọc và in kết quả. */
  dryRun?: boolean;
  /** Đẩy job `ingest` sau khi lưu (mặc định true khi không dryRun). */
  enqueueIngest?: boolean;
  startDocId?: number;
}

export interface CrawlResult {
  adapter: string;
  discovered: number;
  fetched: number;
  stored: number;
  duplicates: number;
  blockedByRobots: number;
  errors: { url: string; error: string }[];
  items: CrawledItem[];
  httpRequests: number;
  bytesDownloaded: number;
}

export async function crawl(opts: CrawlOptions): Promise<CrawlResult> {
  const adapter = getAdapter(opts.adapter);
  const dedupe = new DedupeIndex();
  const result: CrawlResult = {
    adapter: adapter.id,
    discovered: 0,
    fetched: 0,
    stored: 0,
    duplicates: 0,
    blockedByRobots: 0,
    errors: [],
    items: [],
    httpRequests: 0,
    bytesDownloaded: 0,
  };

  if (!opts.dryRun) await ensureStorageRoot();

  const discoverOpts: any = { limit: opts.limit ?? 10 };
  if (opts.type) discoverOpts.type = opts.type;
  if (opts.page) discoverOpts.page = opts.page;
  if (opts.since) discoverOpts.since = opts.since;
  if (opts.startDocId) discoverOpts.startDocId = opts.startDocId;

  const found = await adapter.discover(discoverOpts);
  result.discovered = found.length;
  log.info("Đã tìm thấy mục ở nguồn", { adapter: adapter.id, count: found.length, type: opts.type });

  for (const d of found) {
    try {
      const one = await fetchAndStoreItem({
        adapter,
        target: d.url,
        ...(d.preview ? { preview: d.preview } : {}),
        ...(d.files ? { discoveredFiles: d.files } : {}),
        ...(opts.skipFiles ? { skipFiles: true } : {}),
        ...(opts.dryRun ? { dryRun: true } : {}),
        dedupe,
      });
      result.fetched += 1;
      result.blockedByRobots += one.blockedByRobots;
      result.bytesDownloaded += one.bytesDownloaded;
      result.errors.push(...one.errors);
      result.items.push(one.crawled);
      if (one.duplicateKey) {
        result.duplicates += 1;
        continue;
      }
      if (one.recordId) {
        result.stored += 1;
        if (opts.enqueueIngest !== false) await enqueue("ingest", { sourceRecordId: one.recordId });
      }
    } catch (e) {
      if (e instanceof RobotsDisallowedError) {
        result.blockedByRobots += 1;
        log.warn("robots.txt cấm, bỏ qua", { url: d.url });
        continue;
      }
      result.errors.push({ url: d.url, error: errText(e) });
      log.error("Lỗi xử lý văn bản", { url: d.url, error: errText(e) });
    }
  }

  result.httpRequests = fetcher.stats.requests;
  return result;
}
