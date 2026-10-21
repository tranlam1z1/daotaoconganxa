/**
 * Giai đoạn 2 — TẢI VỀ: lấy trang chi tiết + file đính kèm, lưu kho raw/ và
 * `source_records`, rồi đẩy job `ingest`.
 *
 * Giới hạn tốc độ do RATE_LIMITS của hàng đợi `qdpl:fetch` quyết định (1 yêu cầu/giây),
 * cộng với giới hạn theo host trong `crawler/fetcher.ts`. Không nới hai chỗ này.
 */
import { QUEUES } from "@qdpl/queue";
import { fetchAndStoreItem } from "../../crawler/fetch-item.ts";
import { add } from "../queues.ts";
import { defineStage } from "../stage.ts";

export const fetchStage = defineStage(QUEUES.fetch, async (job, ctx) => {
  const { nguon, sourceId, url, runId } = job.data;

  const r = await fetchAndStoreItem({ adapter: nguon, target: url });
  await ctx.progress(60, "đã tải xong");

  if (r.duplicateKey) {
    return { skipped: true, reason: `trùng nội dung với ${r.duplicateKey}` };
  }
  if (!r.recordId) {
    throw new Error(`Không lưu được source_record cho ${nguon}:${sourceId} (${url})`);
  }
  // Không có file nào tải được thì các bước sau không có gì để chuyển đổi.
  const coFile = r.crawled.files.some((f) => f.kind !== "html");
  if (!coFile && r.errors.length) {
    throw new Error(
      `Tải file của ${nguon}:${sourceId} hỏng: ${r.errors.map((e) => `${e.url} -> ${e.error}`).join("; ")}`,
    );
  }

  await add(
    QUEUES.ingest,
    { ...(runId ? { runId } : {}), nguon, sourceId },
    { key: `${runId ?? "adhoc"}:${nguon}:${sourceId}` },
  );

  return {
    next: 1,
    ...(r.crawled.soKyHieu ? { patch: { soKyHieu: r.crawled.soKyHieu, url: r.crawled.url } } : {}),
    detail: {
      recordId: r.recordId,
      so_ky_hieu: r.crawled.soKyHieu,
      files: r.crawled.files.length,
      bytes: r.bytesDownloaded,
      ...(r.errors.length ? { loi_file: r.errors.length } : {}),
    },
    ...(r.errors.length ? { warnings: r.errors } : {}),
  };
});
