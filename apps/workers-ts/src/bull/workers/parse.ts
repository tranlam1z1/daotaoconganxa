/**
 * Giai đoạn 5 — PHÂN TÍCH: Markdown -> cây nút -> `document_versions` + `nodes`.
 * Xong thì đẩy `relations` và `index`; nếu là văn bản sửa đổi thì đẩy thêm `extract-ops`.
 */
import { getDocumentByUrn } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { parseAndSave } from "../../pipeline/parse.ts";
import { add } from "../queues.ts";
import { defineStage } from "../stage.ts";

export const parseStage = defineStage(QUEUES.parse, async (job, ctx) => {
  const { documentUrn, markdownPath, runId } = job.data;
  const doc = await getDocumentByUrn(documentUrn);
  if (!doc) throw new Error(`Không có văn bản ${documentUrn} trong CSDL`);

  const r = await parseAndSave({
    documentId: doc.id,
    ...(markdownPath ? { markdownUri: markdownPath } : {}),
    enqueueNext: false, // các job kế tiếp đi qua BullMQ, không qua bảng `jobs`
  });
  await ctx.progress(70, `${r.nodeCount} nút`);

  const chung = { ...(runId ? { runId } : {}), documentUrn };
  const key = `${runId ?? "adhoc"}:${documentUrn}`;
  let next = 0;
  await add(QUEUES.relations, chung, { key });
  next += 1;
  await add(QUEUES.index, chung, { key });
  next += 1;
  if (r.isAmending) {
    await add(QUEUES.extractOps, chung, { key, priority: 3 });
    next += 1;
  }

  return {
    documentId: doc.id,
    documentUrn,
    next,
    ...(r.warnings.length ? { warnings: r.warnings } : {}),
    detail: {
      versionId: r.versionId,
      nodes: r.nodeCount,
      isAmending: r.isAmending,
      reviews: r.reviewIds.length,
    },
  };
});
