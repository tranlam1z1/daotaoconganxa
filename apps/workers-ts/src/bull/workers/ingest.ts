/**
 * Giai đoạn 3 — NẠP: `source_records` -> `documents` (danh tính văn bản, URN).
 * Dùng lại `pipeline/ingest.ts`; chỉ khác là đẩy job kế tiếp qua BullMQ thay vì bảng `jobs`.
 */
import { QUEUES } from "@qdpl/queue";
import { findSourceRecord } from "../../crawler/dedupe.ts";
import { ingestSourceRecord } from "../../pipeline/ingest.ts";
import { add } from "../queues.ts";
import { defineStage } from "../stage.ts";

export const ingestStage = defineStage(QUEUES.ingest, async (job, ctx) => {
  const { nguon, sourceId, runId } = job.data;

  const rec = await findSourceRecord(nguon, sourceId);
  if (!rec) throw new Error(`Chưa có source_record cho ${nguon}:${sourceId} — job fetch chưa chạy xong?`);

  // enqueueConvert: false vì `pipeline/ingest.ts` đẩy job vào bảng `jobs` của Postgres;
  // đường BullMQ tự đẩy job `convert` của mình ngay dưới đây.
  const r = await ingestSourceRecord(rec.id, { enqueueConvert: false });
  await ctx.progress(70, r.urn);

  await add(
    QUEUES.convert,
    { ...(runId ? { runId } : {}), documentUrn: r.urn, sourceRecordId: rec.id },
    { key: `${runId ?? "adhoc"}:${r.urn}` },
  );

  return {
    documentId: r.documentId,
    documentUrn: r.urn,
    next: 1,
    detail: { urn: r.urn, created: r.created, sourceRecordId: rec.id },
  };
});
